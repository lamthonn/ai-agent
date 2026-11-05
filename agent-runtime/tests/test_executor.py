from pathlib import Path

import pytest

from runtime import workflow
from runtime.executor import Handlers, JobFailed, evaluate, run

WF = workflow.load(Path(__file__).parent.parent / "workflows" / "ai-coding.json")


def handlers(exit_codes, verdicts=("pass",), approve=True, tokens=1000):
    codes, verdicts = iter(exit_codes), iter(verdicts)
    seen = []

    def agent(n, c):
        seen.append(n.id)
        r = {"text": "ok", "tokens": tokens, "cost": 0.01}
        if n.id == "review":
            r["review"] = {"verdict": next(verdicts)}
        return r

    return Handlers(agent, lambda cmd, c: next(codes), lambda n, c: approve), seen


def test_happy_path_goes_through_every_step():
    h, seen = handlers([0])
    r = run(WF, h)
    assert r.status == "succeeded"
    assert seen == ["analyze", "plan", "code", "review"]


def test_failing_build_goes_to_fix_then_back_to_test():
    h, seen = handlers([1, 0])
    r = run(WF, h)
    assert r.status == "succeeded" and seen.count("fix") == 1


def test_fix_loop_stops_at_max_loops():
    h, seen = handlers([1] * 20)
    r = run(WF, h)
    assert r.status == "failed" and seen.count("fix") == 3 and "limit of 3" in r.reason


def test_review_failure_goes_back_to_fix():
    h, seen = handlers([0, 0], verdicts=("fail", "pass"))
    r = run(WF, h)
    assert r.status == "succeeded" and seen == ["analyze", "plan", "code", "review", "fix", "review"]


def test_rejected_approval_stops_the_job_before_code():
    h, seen = handlers([0], approve=False)
    r = run(WF, h)
    assert r.status == "rejected" and "code" not in seen


def test_token_limit_stops_between_nodes():
    h, _ = handlers([0], tokens=600)
    r = run(WF, h, token_limit=1000)
    assert r.status == "failed" and "token limit" in r.reason


def test_conditions_do_not_use_eval():
    assert evaluate('review.verdict == "pass"', {"review": {"verdict": "pass"}})
    assert not evaluate("exit_code == 0", {"exit_code": 2})
    with pytest.raises(JobFailed, match="unsupported"):
        evaluate("__import__('os').system('x')", {})
