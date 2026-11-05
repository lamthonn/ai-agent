"""The worker against a fake backend and a real (temporary) git repository: pause at approvals, resume, finish."""
import json
import subprocess
from pathlib import Path

import pytest

from runtime.executor import Handlers
from runtime.worker import process

WORKFLOW = json.loads((Path(__file__).parent.parent / "workflows" / "ai-coding.json").read_text(encoding="utf-8"))
AGENTS = [{"id": i, "model": "m", "maxTurns": 1, "permission": "read", "tools": ["Read"], "prompt": "p"}
          for i in ("requirement-analyzer", "architect", "coder", "fixer", "code-reviewer")]


def git(*args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


@pytest.fixture
def origin(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    git("init", "-q", "-b", "system_test", cwd=src)
    git("config", "user.email", "t@t", cwd=src)
    git("config", "user.name", "t", cwd=src)
    (src / "a.txt").write_text("hi")
    git("add", ".", cwd=src)
    git("commit", "-qm", "init", cwd=src)
    return src


class FakeApi:
    def __init__(self):
        self.steps, self.events, self.approvals, self.completed, self.meta_branch = [], [], [], [], None
        self.cancel_after = None

    def step(self, job, node, outcome, tokens, cost, note=""):
        self.steps.append((node, outcome, tokens))
        return node == self.cancel_after

    def event(self, job, message, level="info"):
        self.events.append(message)

    def meta(self, job, branch):
        self.meta_branch = branch

    def approval(self, job, node, kind, resume, context):
        self.approvals.append((node, kind, resume, context))

    def complete(self, job, status, reason=""):
        self.completed.append((status, reason))


def fake_handlers(job, approve):
    def agent(node, ctx):
        r = {"text": f"{node.id} xong", "tokens": 100, "cost": 0.0}
        if node.id == "review":
            r["review"] = {"verdict": "pass", "text": "ok"}
        return r
    return Handlers(agent, lambda cmd, ctx: 0, lambda n, c: approve(job, n, c))   # same wrapping as real.handlers


def claim(origin, resume=None, context=None, branch=None, used=0):
    return {"job": {"id": "JOB-0001", "title": "Thêm bộ lọc", "requirement": "r", "branch": branch, "resumeNode": resume, "context": context},
            "project": {"id": "p", "repo": str(origin), "baseBranch": "system_test", "buildCommand": "b", "testCommand": "t"},
            "workflow": WORKFLOW, "agents": AGENTS, "tokenLimit": 10_000, "tokensUsed": used}


def test_job_pauses_at_each_approval_and_finishes_after_the_last_one(origin, tmp_path):
    api, root = FakeApi(), tmp_path / "w"

    assert process(claim(origin), api, root, fake_handlers, open_pr=False) == "approval"
    node, kind, resume, ctx = api.approvals[-1]
    assert (node, kind, resume) == ("approve_plan", "plan", "code") and api.meta_branch == "ai/job-0001-them-bo-loc"
    assert ctx["plan"]["text"] == "plan xong"

    # the person approved the plan; the job comes back with the saved place and data
    assert process(claim(origin, "code", json.loads(json.dumps(ctx)), api.meta_branch, used=200), api, root, fake_handlers, open_pr=False) == "approval"
    node, kind, resume, ctx = api.approvals[-1]
    assert (node, kind, resume) == ("approve_merge", "merge", "end")
    assert [s[0] for s in api.steps if s[1] != "waiting"] == ["start", "analyze", "plan", "code", "build_test", "build_ok", "review", "review_ok"]

    assert process(claim(origin, "end", json.loads(json.dumps(ctx)), api.meta_branch), api, root, fake_handlers, open_pr=False) == "succeeded"
    assert api.completed == [("succeeded", "")]


def test_cancelling_on_the_server_stops_the_run_without_reporting_a_result(origin, tmp_path):
    api = FakeApi()
    api.cancel_after = "analyze"
    assert process(claim(origin), api, tmp_path / "w", fake_handlers, open_pr=False) == "cancelled"
    assert api.completed == [] and api.approvals == []


def test_a_failure_is_reported_with_its_reason(origin, tmp_path):
    api = FakeApi()
    c = claim(origin, used=9_950)    # the limit is nearly used up by earlier runs
    assert process(c, api, tmp_path / "w", fake_handlers, open_pr=False) == "failed"
    assert api.completed[0][0] == "failed" and "token limit" in api.completed[0][1]
