"""The worker's heartbeat: which Claude login it reports, and that a missing or logged-out CLI is a status, not a crash."""
import json
from types import SimpleNamespace as R

from runtime.status import Heartbeat, claude_status


def fake_run(auth_out, version="2.1.318 (Claude Code)"):
    return lambda cmd, **kw: R(stdout=auth_out if cmd[1] == "auth" else version, stderr="", returncode=0)


def test_a_logged_in_cli_reports_the_account_and_plan():
    out = json.dumps({"loggedIn": True, "email": "me@x.com", "orgName": "Org", "subscriptionType": "pro", "orgId": "secret-id"})
    s = claude_status(fake_run(out))
    assert (s["claudeLoggedIn"], s["claudeEmail"], s["claudePlan"], s["claudeVersion"]) == (True, "me@x.com", "pro", "2.1.318 (Claude Code)")
    assert "secret-id" not in json.dumps(s)             # ids the screen has no use for are not sent


def test_a_logged_out_or_missing_cli_is_reported_not_raised():
    out = claude_status(fake_run("Not logged in. Run claude login"))
    assert out["claudeInstalled"] and not out["claudeLoggedIn"] and "login" in out["claudeError"]
    assert not claude_status(fake_run(json.dumps({"loggedIn": False})))["claudeLoggedIn"]

    def missing(cmd, **kw):
        raise FileNotFoundError(cmd[0])
    gone = claude_status(missing)
    assert not gone["claudeInstalled"] and not gone["claudeLoggedIn"]


class Api:
    def __init__(self): self.sent = []
    def heartbeat(self, info): self.sent.append(info)


def test_each_report_carries_the_current_job_and_the_claude_status_is_not_asked_every_time():
    asked, api = [], Api()
    beat = Heartbeat(api, google_key=True, status=lambda: asked.append(1) or {"claudeLoggedIn": True, "claudeEmail": "me@x.com"})
    beat.report()
    beat.job = "JOB-0007"
    beat.report()
    assert [m["currentJob"] for m in api.sent] == [None, "JOB-0007"] and len(asked) == 1
    assert api.sent[1]["claudeEmail"] == "me@x.com" and api.sent[1]["googleKey"] is True and api.sent[1]["host"]
