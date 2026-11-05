"""Walks a workflow one node at a time. Pure logic: everything that touches the world (agents, shell, git,
approval) is a handler passed in, so the executor is tested with fakes and costs no tokens."""
import operator
import re
from dataclasses import dataclass, field
from typing import Callable

from .workflow import Node, Workflow


class JobFailed(Exception):
    pass


@dataclass
class StepLog:
    node: str
    outcome: str
    tokens: int = 0
    cost: float = 0.0
    note: str = ""


@dataclass
class Handlers:
    agent: Callable[[Node, dict], dict]      # -> {"text", "tokens", "cost", optional "review": {"verdict"}}
    command: Callable[[str, dict], int]      # -> exit code
    approval: Callable[[Node, dict], bool]   # -> approved?
    git: Callable[[Node, dict], None] = lambda n, c: None


@dataclass
class Result:
    status: str                              # succeeded | failed | rejected
    steps: list[StepLog] = field(default_factory=list)
    reason: str = ""

    @property
    def tokens(self) -> int:
        return sum(s.tokens for s in self.steps)


_OPS = {"==": operator.eq, "!=": operator.ne, ">=": operator.ge, "<=": operator.le, ">": operator.gt, "<": operator.lt}
_COND = re.compile(r"\s*([\w.]+)\s*(==|!=|>=|<=|>|<)\s*(\"[^\"]*\"|-?\d+(?:\.\d+)?)\s*")


def evaluate(expr: str, ctx: dict) -> bool:
    """`<path> <op> <literal>` only, e.g. `exit_code == 0` or `review.verdict == "pass"`. Never eval()."""
    m = _COND.fullmatch(expr)
    if not m:
        raise JobFailed(f"unsupported condition: {expr!r}")
    path, op, lit = m.groups()
    value = ctx
    for part in path.split("."):
        value = value.get(part) if isinstance(value, dict) else None
    lit = lit.strip('"') if lit.startswith('"') else float(lit) if "." in lit else int(lit)
    return _OPS[op](value, lit)


def run(wf: Workflow, h: Handlers, ctx: dict | None = None, token_limit: int | None = None, max_steps: int = 200) -> Result:
    ctx = ctx if ctx is not None else {}
    res = Result("succeeded")
    visits: dict[str, int] = {}
    node = wf.start()
    for _ in range(max_steps):
        visits[node.id] = visits.get(node.id, 0) + 1
        if node.max_loops is not None and visits[node.id] > node.max_loops:
            res.status, res.reason = "failed", f"'{node.label}' reached its limit of {node.max_loops} rounds"
            return res
        if token_limit is not None and res.tokens >= token_limit:
            res.status, res.reason = "failed", f"token limit {token_limit} reached before '{node.label}'"
            return res

        step = StepLog(node.id, "done")
        nxt: str | None = None
        try:
            if node.type == "agent":
                r = h.agent(node, ctx)
                step.tokens, step.cost = r.get("tokens", 0), r.get("cost", 0.0)
                ctx[node.id] = r
                if "review" in r:
                    ctx["review"] = r["review"]
            elif node.type in ("command", "test"):
                ctx["exit_code"] = h.command(node.command or "", ctx)
                step.outcome = "done" if ctx["exit_code"] == 0 else "failed"
            elif node.type == "git":
                h.git(node, ctx)
            elif node.type == "approval":
                if not h.approval(node, ctx):
                    step.outcome = "rejected"
                    res.steps.append(step)
                    res.status, res.reason = "rejected", f"rejected at '{node.label}'"
                    return res
            elif node.type == "condition":
                ok = evaluate(node.expr or "", ctx)
                step.note = "true" if ok else "false"
                nxt = next((e["to"] for e in wf.out(node.id) if e.get("when") == ok), None)
                if nxt is None:
                    raise JobFailed(f"'{node.label}' has no branch for {ok}")
            elif node.type == "end":
                res.steps.append(step)
                return res
        except JobFailed as e:
            step.outcome = "failed"
            res.steps.append(step)
            res.status, res.reason = "failed", str(e)
            return res

        res.steps.append(step)
        if nxt is None:
            outs = wf.out(node.id)
            if len(outs) != 1:
                res.status, res.reason = "failed", f"'{node.label}' needs exactly one outgoing edge"
                return res
            nxt = outs[0]["to"]
        node = wf.nodes[nxt]
    res.status, res.reason = "failed", "too many steps"
    return res
