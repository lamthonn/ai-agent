"""Tells the server this worker is alive, which Claude login it uses and what it is doing, so the screen can show it.
Runs on its own thread: a job can take an hour and the worker must not look offline meanwhile."""
import json
import socket
import subprocess
import threading
import time

from .api import Api

EVERY = 10          # seconds between reports
CLAUDE_EVERY = 60   # seconds between asking the Claude CLI who is logged in


def claude_status(run=subprocess.run) -> dict:
    """What `claude auth status` says. Never raises: a missing or logged-out CLI is a status, not a crash."""
    try:
        p = run(["claude", "auth", "status"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
        v = run(["claude", "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30).stdout.strip()
    except FileNotFoundError:
        return {"claudeInstalled": False, "claudeLoggedIn": False, "claudeError": "Chưa cài Claude Code (lệnh claude không có)."}
    except Exception as e:
        return {"claudeInstalled": True, "claudeLoggedIn": False, "claudeError": f"Không hỏi được Claude Code: {e}"}
    try:
        d = json.loads(p.stdout)
    except json.JSONDecodeError:
        return {"claudeInstalled": True, "claudeLoggedIn": False, "claudeVersion": v, "claudeError": (p.stdout or p.stderr).strip()[:200] or "Claude Code chưa đăng nhập."}
    ok = bool(d.get("loggedIn"))
    return {"claudeInstalled": True, "claudeLoggedIn": ok, "claudeVersion": v, "claudeEmail": d.get("email"), "claudeOrg": d.get("orgName"),
            "claudePlan": d.get("subscriptionType"), "claudeError": None if ok else "Claude Code chưa đăng nhập: chạy `claude login`."}


class Heartbeat:
    def __init__(self, api: Api, google_key: bool, status=claude_status):
        self.api, self.google_key, self._status = api, google_key, status
        self.job: str | None = None
        self._claude, self._claude_at = {}, 0.0

    def report(self) -> None:
        if time.time() - self._claude_at >= CLAUDE_EVERY:
            self._claude, self._claude_at = self._status(), time.time()
        self.api.heartbeat({"host": socket.gethostname(), "currentJob": self.job, "googleKey": self.google_key, **self._claude})

    def start(self) -> None:
        def loop() -> None:
            while True:
                try:
                    self.report()
                except Exception:   # the server may be restarting; try again next time
                    pass
                time.sleep(EVERY)
        threading.Thread(target=loop, daemon=True, name="heartbeat").start()
