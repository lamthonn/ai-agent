"""The worker's calls to the backend's /internal routes. Standard library only."""
import json
import urllib.error
import urllib.request


class Api:
    def __init__(self, base: str, token: str):
        self.base, self.token = base.rstrip("/"), token

    def _post(self, path: str, body: dict | None = None) -> dict | None:
        req = urllib.request.Request(self.base + path, method="POST", data=json.dumps(body or {}).encode(),
                                     headers={"X-Worker-Token": self.token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            if e.code == 409:   # e.g. the job is no longer running
                return {"stop": True}
            raise

    def claim(self) -> dict | None:
        return self._post("/internal/jobs/claim")

    def step(self, job: str, node: str, outcome: str, tokens: int, cost: float, note: str = "") -> bool:
        """Returns True when the job was cancelled and the worker should stop."""
        r = self._post(f"/internal/jobs/{job}/steps", {"nodeId": node, "outcome": outcome, "tokens": tokens, "cost": cost, "note": note})
        return bool(r and r.get("stop"))

    def event(self, job: str, message: str, level: str = "info") -> None:
        self._post(f"/internal/jobs/{job}/events", {"level": level, "message": message})

    def meta(self, job: str, branch: str) -> None:
        self._post(f"/internal/jobs/{job}/meta", {"branch": branch})

    def approval(self, job: str, node: str, kind: str, resume: str, context: dict) -> None:
        self._post(f"/internal/jobs/{job}/approval", {"nodeId": node, "kind": kind, "resumeNode": resume, "context": context})

    def complete(self, job: str, status: str, reason: str = "") -> None:
        self._post(f"/internal/jobs/{job}/complete", {"status": status, "reason": reason})

    # ---- bug and test-case files ----
    def sources_due(self, service_account: str | None = None) -> list[dict]:
        return self._post("/internal/sources/due", {"serviceAccount": service_account}) or []

    def sources_result(self, project: str, kind: str, rows: list[dict] | None = None, error: str | None = None) -> None:
        self._post(f"/internal/sources/{project}/{kind}/result", {"rows": rows, "error": error})

    def bugs_pending(self) -> dict:
        return self._post("/internal/bugs/pending") or {"bugs": [], "known": [], "workflows": []}

    def bug_triage(self, bug: int, triage: str, workflow: str | None = None, note: str | None = None) -> None:
        self._post(f"/internal/bugs/{bug}/triage", {"triage": triage, "workflow": workflow, "note": note})

    def bugs_autorun(self) -> int:
        return int((self._post("/internal/bugs/autorun") or {}).get("created", 0))

    def bugs_writeback(self) -> list[dict]:
        return self._post("/internal/bugs/writeback") or []

    def bug_written(self, bug: int, text: str) -> None:
        self._post(f"/internal/bugs/{bug}/written", {"text": text})

    def heartbeat(self, info: dict) -> None:
        self._post("/internal/worker/heartbeat", info)
