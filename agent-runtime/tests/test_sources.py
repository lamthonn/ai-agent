"""Bug and test-case files: reading rows, the filter, triage answers, and one worker tick against fake sheets and a fake server."""
import pytest

from runtime import sources
from runtime.sources import SheetError, apply_filter, parse_rows, parse_triage, tick

COLS = {"id": "A", "title": "B", "steps": "C", "severity": "D", "status": "E", "reporter": "F"}
HEADER = ["Mã bug", "Mô tả", "Bước", "Mức độ", "Trạng thái", "Người báo"]
WORKFLOWS = [{"id": "quick-fix", "name": "Sửa lỗi nhanh"}, {"id": "ai-coding", "name": "AI Coding"}]


def test_rows_are_read_from_the_mapped_columns_and_rows_without_an_id_are_skipped():
    values = [HEADER, ["BUG-1", "Lỗi A", "1. mở", "Cao", "Mới", "Kho"], ["", "không có mã"], ["BUG-2", "Lỗi B"]]   # ragged rows are normal in a sheet
    rows = parse_rows(values, COLS)
    assert [(r["key"], r["row"]) for r in rows] == [("BUG-1", 2), ("BUG-2", 4)]
    assert rows[1]["steps"] == "" and rows[1]["status"] == ""
    assert parse_rows([["x"] * 28, ["k"] + [""] * 26 + ["tail"]], {"id": "A", "title": "AB"})[0]["title"] == "tail"   # column AB


def test_the_filter_keeps_matching_rows_in_any_case_and_rejects_what_it_cannot_read():
    rows = [{"key": "1", "status": "Mới"}, {"key": "2", "status": "đang xử lý"}, {"key": "3", "status": " mới "}]
    assert [r["key"] for r in apply_filter(rows, "Trạng thái = Mới")] == ["1", "3"]
    assert apply_filter(rows, "") == rows
    with pytest.raises(SheetError):
        apply_filter(rows, "Cột lạ = x")
    with pytest.raises(SheetError):
        apply_filter(rows, "không có dấu bằng")


def test_a_triage_answer_is_validated_and_an_invented_duplicate_does_not_bury_a_bug():
    bug = {"key": "BUG-5", "project": "p"}
    known = [{"key": "BUG-1", "project": "p", "title": "t", "triage": "ready"}]
    ok = parse_triage('Kết quả: {"triage":"duplicate","duplicate_of":"BUG-1","note":"cùng lỗi"}', bug, known, WORKFLOWS)
    assert ok["triage"] == "duplicate" and "BUG-1" in ok["note"] and ok["workflow"] is None
    fake = parse_triage('{"triage":"duplicate","duplicate_of":"BUG-99","note":"x"}', bug, known, WORKFLOWS)
    assert fake["triage"] == "ready" and fake["workflow"] == "quick-fix"
    assert parse_triage('{"triage":"ready","workflow":"nope"}', bug, known, WORKFLOWS)["workflow"] == "quick-fix"   # unknown workflow: fall back
    with pytest.raises(ValueError):
        parse_triage("tôi nghĩ là ổn", bug, known, WORKFLOWS)


class FakeSheets:
    def __init__(self, values, can_write=True):
        self.values, self.writes, self._can_write, self.account = values, [], can_write, "bot@x.iam.gserviceaccount.com"

    can_write = property(lambda self: self._can_write)

    def read(self, url, tab):
        if self.values is None:
            raise SheetError("Google Sheets 403: không có quyền.")
        return self.values

    def column(self, url, tab, letter):
        return [r[0] if r else "" for r in self.values]

    def write(self, url, tab, cell, text):
        self.writes.append((cell, text))


class FakeApi:
    def __init__(self, due=(), pending=(), writeback=(), autorun=0):
        self.due, self.pending, self.wb, self.auto = list(due), list(pending), list(writeback), autorun
        self.results, self.triaged, self.written = [], [], []

    def sources_due(self, account=None):
        self.account = account
        return self.due

    def sources_result(self, project, kind, rows=None, error=None):
        self.results.append((project, kind, rows, error))

    def bugs_pending(self):
        return {"bugs": self.pending, "known": [], "workflows": WORKFLOWS}

    def bug_triage(self, bug, triage, workflow=None, note=None):
        self.triaged.append((bug, triage, workflow, note))

    def bugs_autorun(self):
        return self.auto

    def bugs_writeback(self):
        return self.wb

    def bug_written(self, bug, text):
        self.written.append((bug, text))


def due_bug(filter_="Trạng thái = Mới"):
    return {"project": "qlkho", "kind": "bug", "url": "https://docs.google.com/spreadsheets/d/x", "tab": "Bug", "columns": COLS, "filter": filter_}


def test_a_tick_reads_the_due_sheet_with_the_filter_and_reports_the_service_account():
    api = FakeApi(due=[due_bug()])
    sheets = FakeSheets([HEADER, ["BUG-1", "A", "", "Cao", "Mới", ""], ["BUG-2", "B", "", "Thấp", "Đã sửa", ""]])
    tick(api, sheets, triage_fn=None, log=lambda *_: None)
    assert api.account == "bot@x.iam.gserviceaccount.com"
    (project, kind, rows, error), = api.results
    assert (project, kind, error) == ("qlkho", "bug", None) and [r["key"] for r in rows] == ["BUG-1"]


def test_a_sheet_that_cannot_be_read_is_reported_as_an_error_instead_of_crashing():
    api = FakeApi(due=[due_bug()])
    tick(api, FakeSheets(None), triage_fn=None, log=lambda *_: None)
    assert api.results[0][2] is None and "403" in api.results[0][3]


def test_each_new_bug_is_triaged_once_and_a_failing_triage_pauses_instead_of_retrying_at_once():
    api = FakeApi(pending=[{"id": 7, "project": "qlkho", "key": "BUG-1", "title": "t", "steps": "", "severity": "high"}])
    state = {}
    tick(api, FakeSheets([]), triage_fn=lambda b, k, w: {"triage": "need-info", "workflow": None, "note": "thiếu bước"}, state=state, log=lambda *_: None)
    assert api.triaged == [(7, "need-info", None, "thiếu bước")]

    def broken(*_):
        raise RuntimeError("not logged in")
    api2, calls = FakeApi(pending=api.pending), []
    tick(api2, FakeSheets([]), triage_fn=lambda *a: calls.append(1) or broken(), state=state, log=lambda *_: None)
    tick(api2, FakeSheets([]), triage_fn=lambda *a: calls.append(1) or broken(), state=state, log=lambda *_: None)   # paused: not asked again
    assert api2.triaged == [] and len(calls) == 1


def test_write_back_finds_the_bug_again_when_rows_moved_and_skips_one_that_is_gone():
    item = lambda i, key, row: {"id": i, "key": key, "row": row, "text": f"Đang xử lý · JOB-{i}", "url": "u", "tab": "Bug", "idColumn": "A", "statusColumn": "E"}
    api = FakeApi(writeback=[item(1, "BUG-1", 2), item(2, "BUG-2", 3), item(3, "BUG-9", 4)])
    sheets = FakeSheets([["Mã bug"], ["BUG-0"], ["BUG-1"], ["BUG-2"]])   # someone inserted a row above: BUG-1 is now row 3, BUG-2 row 4
    state = {}
    tick(api, sheets, triage_fn=None, state=state, log=lambda *_: None)
    assert sheets.writes == [("E3", "Đang xử lý · JOB-1"), ("E4", "Đang xử lý · JOB-2")]
    assert [w[0] for w in api.written] == [1, 2]                         # BUG-9 is not in the sheet: nothing written, nothing marked
    tick(api, sheets, triage_fn=None, state=state, log=lambda *_: None)   # and it is not retried every tick
    assert len(sheets.writes) == 4 and (3, "Đang xử lý · JOB-3") not in api.written


def test_without_a_key_nothing_is_written_to_the_sheet():
    api = FakeApi(writeback=[{"id": 1, "key": "BUG-1", "row": 2, "text": "x", "url": "u", "tab": "Bug", "idColumn": "A", "statusColumn": "E"}])
    sheets = FakeSheets([["Mã bug"], ["BUG-1"]], can_write=False)
    tick(api, sheets, triage_fn=None, log=lambda *_: None)
    assert sheets.writes == [] and api.written == []


def test_the_public_csv_export_is_used_without_a_key_and_the_sheet_id_is_taken_from_the_link(monkeypatch):
    seen = []

    class Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return "Mã bug,Mô tả\nBUG-1,\"dòng 1\nxuống dòng\"\n".encode("utf-8")
    monkeypatch.setattr(sources.urllib.request, "urlopen", lambda url, timeout: seen.append(url) or Resp())
    values = sources.Sheets(None).read("https://docs.google.com/spreadsheets/d/1abc_D-e/edit#gid=0", "Test case")
    assert "/d/1abc_D-e/gviz/tq" in seen[0] and "sheet=Test%20case" in seen[0]
    assert values[1] == ["BUG-1", "dòng 1\nxuống dòng"]
