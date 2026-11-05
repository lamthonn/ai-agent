"""python -m runtime --repo D:\\Out-works\\QLKho --base system_test --req yeu-cau.md --title "..." [--build ...] [--test ...]

Runs one job end to end on this machine. Uses your Claude Code login (Pro). If you approve the merge step the
branch is pushed and a pull request into --base is opened (needs `gh auth login`); nothing is ever merged."""
import argparse
import os
import sys
from pathlib import Path

from . import workflow
from .executor import run
from .real import Job, diff, handlers, prepare, sh


def ask(question: str) -> bool:
    return input(f"\n{question} [y/N] ").strip().lower() in ("y", "yes", "c", "co", "có")


def main() -> int:
    a = argparse.ArgumentParser()
    a.add_argument("--repo", required=True, type=Path)
    a.add_argument("--base", default="system_test")
    a.add_argument("--req", required=True, type=Path, help="requirement file (md/txt)")
    a.add_argument("--title", required=True)
    a.add_argument("--id", default="JOB-0001")
    a.add_argument("--workflow", default=Path(__file__).parent.parent / "workflows" / "ai-coding.json", type=Path)
    a.add_argument("--build", default="dotnet build")
    a.add_argument("--test", default="dotnet test")
    a.add_argument("--token-limit", type=int, default=None, help="stop between nodes once this many tokens are used")
    a.add_argument("--no-pr", action="store_true", help="stop after approval: keep the branch local, push nothing")
    args = a.parse_args()

    if os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is set: this run will be billed to the API key, not your Pro plan.")
    job = Job(args.id, args.title, args.req.read_text(encoding="utf-8"), args.repo.resolve(), args.base, args.build, args.test, args.token_limit)
    wf = workflow.load(args.workflow)

    def approve(j: Job, node, ctx) -> bool:
        if node.id == "approve_plan":
            print("\n--- KẾ HOẠCH ---\n" + ctx["plan"]["text"])
            return ask("Duyệt kế hoạch này?")
        print("\n--- THAY ĐỔI ---\n" + diff(j)[:8000] + "\n--- REVIEW ---\n" + ctx.get("review", {}).get("text", "")[:3000])
        return ask("Duyệt merge (tạo pull request)?")

    wd = prepare(job)
    print(f"Branch {job.branch} tại {wd}")
    res = run(wf, handlers(job, approve), ctx={}, token_limit=job.token_limit)
    for s in res.steps:
        print(f"  {s.node:14} {s.outcome:9} {s.tokens:>8} token {s.note}")
    print(f"=> {res.status} {res.reason} | {res.tokens} token")
    if res.status == "succeeded" and not args.no_pr:
        print(publish(job))
    return 0 if res.status == "succeeded" else 1


if __name__ == "__main__":
    sys.exit(main())
