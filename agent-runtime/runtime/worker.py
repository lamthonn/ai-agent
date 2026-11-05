"""python -m runtime.worker --api http://localhost:5000 --token ... [--root D:\\Out-works\\.codesloop] [--once]

Takes one job at a time from the backend and runs its workflow. At an approval node it saves its place on the
server and lets go of the job; once a person decides, the job comes back through the queue and continues from there.
Uses your Claude Code login (Pro): run one worker only, so the 5-hour usage window is not drained by parallel jobs."""
import argparse
import json
import time
from pathlib import Path

from . import workflow
from .agents import from_claim
from .api import Api
from .executor import Handlers, run
from .real import Job, handlers, prepare, publish, sh
from .workflow import Workflow


def _load(definition: dict, tmp: Path) -> Workflow:
    tmp.mkdir(parents=True, exist_ok=True)
    f = tmp / f"{definition['id']}-v{definition['version']}.json"
    f.write_text(json.dumps(definition), encoding="utf-8")
    return workflow.load(f)


def ensure_repo(project: dict, root: Path) -> Path:
    repo = root / "repos" / project["id"]
    if not repo.exists():
        repo.parent.mkdir(parents=True, exist_ok=True)
        sh(["git", "clone", project["repo"], str(repo)], root)
    return repo


def process(claim: dict, api: Api, root: Path, make_handlers=handlers, open_pr: bool = True) -> str:
    """Runs one claimed job until it ends or stops at an approval. Returns the final status."""
    j, p = claim["job"], claim["project"]
    job = Job(j["id"], j["title"], j["requirement"], ensure_repo(p, root), p["baseBranch"], p["buildCommand"], p["testCommand"],
              token_limit=claim["tokenLimit"], root=root / "jobs", agents=from_claim(claim["agents"]))
    resuming = j.get("branch") is not None
    prepare(job, j["branch"] if resuming else None)
    if not resuming:
        api.meta(job.id, job.branch)
        api.event(job.id, f"Bắt đầu trên branch {job.branch}")
    else:
        api.event(job.id, f"Tiếp tục từ bước {j['resumeNode']}")

    wf = _load(claim["workflow"], root / "workflows")

    def approve(_job, node, ctx):   # not a question to a person here: record it and pause
        return "pause"

    def on_step(node, step) -> bool:
        stop = api.step(job.id, node.id, step.outcome, step.tokens, step.cost, step.note)
        text = ""
        if node.type == "agent":
            text = f"\n{(step_ctx.get(node.id) or {}).get('text', '')[:1500]}"
        api.event(job.id, f"{node.label}: {step.outcome} ({step.tokens} token){text}", "error" if step.outcome == "failed" else "info")
        return stop

    step_ctx = j.get("context") or {}
    res = run(wf, make_handlers(job, approve), ctx=step_ctx, token_limit=job.token_limit, start=j.get("resumeNode"),
              tokens_used=claim["tokensUsed"], on_step=on_step)

    if res.status == "paused":
        kind = "plan" if res.approval.id == "approve_plan" else "merge"
        api.approval(job.id, res.approval.id, kind, res.resume, step_ctx)
        api.event(job.id, f"Chờ duyệt: {res.approval.label}")
        return "approval"
    if res.status == "succeeded" and open_pr:
        try:
            api.event(job.id, f"Đã mở pull request: {publish(job)}")
        except Exception as e:   # e.g. gh is not logged in: the branch and diff are still there
            api.complete(job.id, "failed", f"Không mở được pull request: {e}")
            return "failed"
    if res.status == "cancelled":
        return "cancelled"       # the server already holds that status
    api.complete(job.id, "succeeded" if res.status == "succeeded" else "failed", res.reason)
    return res.status


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("--api", default="http://localhost:5000")
    a.add_argument("--token", required=True)
    a.add_argument("--root", type=Path, default=Path.home() / ".codesloop")
    a.add_argument("--poll", type=int, default=10, help="seconds between checks when the queue is empty")
    a.add_argument("--once", action="store_true", help="handle at most one job, then exit")
    a.add_argument("--no-pr", action="store_true")
    args = a.parse_args()
    api = Api(args.api, args.token)
    while True:
        claim = api.claim()
        if claim:
            print(f"{claim['job']['id']}: {claim['job']['title']}")
            try:
                print("  ->", process(claim, api, args.root, open_pr=not args.no_pr))
            except Exception as e:   # never leave a job "running" without telling the server
                api.complete(claim["job"]["id"], "failed", f"Worker lỗi: {e}")
                print("  -> lỗi:", e)
            if args.once:
                return
        elif args.once:
            print("Không có job nào trong hàng đợi.")
            return
        else:
            time.sleep(args.poll)


if __name__ == "__main__":
    main()
