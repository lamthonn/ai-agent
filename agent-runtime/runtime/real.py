"""The handlers that touch the world: a git worktree for the job, Claude through the Agent SDK, shell commands."""
import asyncio
import re
import subprocess
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, query

from .agents import AGENTS
from .executor import Handlers, JobFailed
from .workflow import Node

_TAIL = 6000  # characters of command output kept for the next agent


def sh(cmd: str, cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    p = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and p.returncode:
        raise JobFailed(f"`{cmd}` failed: {(p.stderr or p.stdout)[-500:]}")
    return p


@dataclass
class Job:
    id: str
    title: str
    requirement: str
    repo: Path
    base: str            # branch the job branches from and merges back to
    build: str
    test: str
    token_limit: int | None = None

    @property
    def branch(self) -> str:
        ascii_title = unicodedata.normalize("NFD", self.title.replace("đ", "d").replace("Đ", "D")).encode("ascii", "ignore").decode()
        slug = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")[:30].strip("-")
        return f"ai/{self.id.lower()}-{slug}"

    @property
    def workdir(self) -> Path:
        return self.repo.parent / ".codesloop" / self.id


def prepare(job: Job) -> Path:
    """An isolated checkout on a new branch. The user's own working tree is never touched."""
    sh(f"git fetch origin {job.base}", job.repo)
    job.workdir.parent.mkdir(exist_ok=True)
    sh(f'git worktree add -b {job.branch} "{job.workdir}" origin/{job.base}', job.repo)
    return job.workdir


def diff(job: Job) -> str:
    sh("git add -A", job.workdir, check=False)  # new files count as part of the change
    return sh(f"git diff --cached origin/{job.base}", job.workdir, check=False).stdout


def _prompt(job: Job, node: Node, ctx: dict) -> str:
    parts = [f"# Yêu cầu của job {job.id}: {job.title}\n{job.requirement}"]
    for step, label in (("analyze", "Phân tích yêu cầu"), ("plan", "Kế hoạch đã duyệt")):
        if step in ctx:
            parts.append(f"# {label}\n{ctx[step]['text']}")
    if node.agent == "fixer" and ctx.get("test_output"):
        parts.append(f"# Kết quả build/test vừa lỗi\n{ctx['test_output']}")
    if node.agent == "fixer" and ctx.get("review", {}).get("verdict") == "fail":
        parts.append(f"# Nhận xét của reviewer\n{ctx['review']['text']}")
    if node.agent == "code-reviewer":
        parts.append(f"# Git diff cần review\n{diff(job)[:60000]}")
    return "\n\n".join(parts)


async def _ask(job: Job, node: Node, ctx: dict) -> dict:
    spec = AGENTS[node.agent]
    opts = ClaudeAgentOptions(
        model=spec.model, system_prompt=spec.prompt, allowed_tools=list(spec.tools), max_turns=spec.max_turns,
        cwd=str(job.workdir), permission_mode="acceptEdits" if spec.writes else "default",
    )
    text, tokens, cost = "", 0, 0.0
    async for m in query(prompt=_prompt(job, node, ctx), options=opts):
        if isinstance(m, AssistantMessage):
            text = "".join(b.text for b in m.content if isinstance(b, TextBlock)) or text
        elif isinstance(m, ResultMessage):
            if m.is_error:
                raise JobFailed(f"{node.label}: {m.subtype} {m.result or ''}".strip())
            u = m.usage or {}
            tokens = int(u.get("input_tokens", 0)) + int(u.get("output_tokens", 0))
            cost = m.total_cost_usd or 0.0
            text = m.result or text
    out = {"text": text, "tokens": tokens, "cost": cost}
    if node.agent == "code-reviewer":
        v = re.findall(r"VERDICT:\s*(pass|fail)", text, re.I)
        out["review"] = {"verdict": v[-1].lower() if v else "fail", "text": text}
    return out


def handlers(job: Job, approve) -> Handlers:
    def agent(node: Node, ctx: dict) -> dict:
        return asyncio.run(_ask(job, node, ctx))

    def command(cmd: str, ctx: dict) -> int:
        cmd = cmd.replace("{project.build}", job.build).replace("{project.test}", job.test)
        p = sh(cmd, job.workdir, check=False)
        ctx["test_output"] = ((p.stdout or "") + (p.stderr or ""))[-_TAIL:]
        return p.returncode

    return Handlers(agent=agent, command=command, approval=lambda n, c: approve(job, n, c))
