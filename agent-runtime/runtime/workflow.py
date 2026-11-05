"""Workflow JSON: the same shape the builder's JSON button shows. Condition edges are labelled with "when"."""
import json
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Node:
    id: str
    type: str
    label: str = ""
    agent: str | None = None
    command: str | None = None
    expr: str | None = None
    max_loops: int | None = None
    approver: str | None = None


@dataclass
class Workflow:
    id: str
    version: int
    nodes: dict[str, Node]
    edges: list[dict] = field(default_factory=list)

    def start(self) -> Node:
        return next(n for n in self.nodes.values() if n.type == "start")

    def out(self, node_id: str) -> list[dict]:
        return [e for e in self.edges if e["from"] == node_id]


def load(path: str | Path) -> Workflow:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    nodes = {
        n["id"]: Node(n["id"], n["type"], n.get("label", ""), n.get("agent"), n.get("command"),
                      n.get("expr"), n.get("maxLoops"), n.get("approver"))
        for n in d["nodes"]
    }
    wf = Workflow(d["id"], d["version"], nodes, d["edges"])
    for e in wf.edges:
        assert e["from"] in nodes and e["to"] in nodes, f"edge to unknown node: {e}"
    return wf
