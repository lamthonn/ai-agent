using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CodesLoop.Api.Tests;

/// <summary>Each test gets its own SQLite file and a fresh seed: ma (admin), tq (qlkho), lt (web). Password codesloop-dev.</summary>
public sealed class ApiTests : IDisposable
{
    readonly string _db = Path.Combine(Path.GetTempPath(), $"codesloop-{Guid.NewGuid():N}.db");
    readonly WebApplicationFactory<Program> _factory;

    public ApiTests()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", $"Data Source={_db}");
        _factory = new WebApplicationFactory<Program>();
        _factory.CreateClient();   // boots the app, creates and seeds the database
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", null);
    }

    public void Dispose() { _factory.Dispose(); Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); try { File.Delete(_db); } catch { /* temp file */ } }

    async Task<HttpClient> As(string email)
    {
        var c = _factory.CreateClient();
        var r = await c.PostAsJsonAsync("/api/auth/login", new { email, password = "codesloop-dev" });
        r.StatusCode.Should().Be(HttpStatusCode.OK);
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString());
        return c;
    }
    HttpClient Worker(string token = "dev-worker-token") { var c = _factory.CreateClient(); c.DefaultRequestHeaders.Add("X-Worker-Token", token); return c; }
    static async Task<JsonElement> Json(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    const string Ma = "minhanh@codes.tech", Tq = "quochuy@codes.tech", Lt = "thutrang@codes.tech";

    async Task<string> NewJob(HttpClient c, string project = "qlkho", string? workflow = null) =>
        (await Json(await c.PostAsJsonAsync("/api/jobs", new { title = "Thêm bộ lọc", projectId = project, workflowId = workflow, requirement = "yêu cầu" }))).GetProperty("id").GetString()!;

    [Fact]
    public async Task Login_rejects_a_wrong_password_and_every_api_route_needs_a_token()
    {
        var c = _factory.CreateClient();
        (await c.PostAsJsonAsync("/api/auth/login", new { email = Ma, password = "sai" })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await c.GetAsync("/api/jobs")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task A_member_sees_and_creates_jobs_only_in_the_projects_granted_to_them()
    {
        var tq = await As(Tq); var lt = await As(Lt);
        var id = await NewJob(tq, "qlkho");

        (await lt.GetAsync($"/api/jobs/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);   // another project: not even visible
        (await Json(await lt.GetAsync("/api/jobs"))).GetArrayLength().Should().Be(0);
        (await lt.PostAsJsonAsync("/api/jobs", new { title = "x", projectId = "qlkho", requirement = "y" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Json(await tq.GetAsync("/api/projects"))).GetArrayLength().Should().Be(1);

        var ma = await As(Ma);                                                                     // an admin sees every project
        (await Json(await ma.GetAsync("/api/projects"))).GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task The_creator_cannot_approve_their_own_job_but_another_person_with_access_can()
    {
        var tq = await As(Tq); var ma = await As(Ma); var worker = Worker();
        var id = await NewJob(tq);
        (await worker.PostAsync("/internal/jobs/claim", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await worker.PostAsJsonAsync($"/internal/jobs/{id}/approval", new { nodeId = "approve_merge", kind = "merge", resumeNode = "end", context = new { } })).StatusCode.Should().Be(HttpStatusCode.OK);
        var apr = (await Json(await tq.GetAsync("/api/approvals?status=pending")))[0];
        apr.GetProperty("canApprove").GetBoolean().Should().BeFalse();

        var denied = await tq.PostAsJsonAsync($"/api/approvals/{apr.GetProperty("id").GetInt32()}/decide", new { decision = "approve" });
        denied.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Json(denied)).GetProperty("code").GetString().Should().Be("own-job");

        var ok = await ma.PostAsJsonAsync($"/api/approvals/{apr.GetProperty("id").GetInt32()}/decide", new { decision = "approve" });
        ok.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(await ma.GetAsync($"/api/jobs/{id}"))).GetProperty("status").GetString().Should().Be("queued");
    }

    [Fact]
    public async Task The_creator_may_approve_when_nobody_else_has_access_or_the_rule_is_off()
    {
        var lt = await As(Lt); var ma = await As(Ma); var worker = Worker();
        // an admin always counts as "someone else", so remove admin from the picture by switching the rule off instead
        (await ma.PutAsJsonAsync("/api/settings/rules", new { noSelfApprove = false })).StatusCode.Should().Be(HttpStatusCode.OK);
        var id = await NewJob(lt, "web");
        await worker.PostAsync("/internal/jobs/claim", null);
        await worker.PostAsJsonAsync($"/internal/jobs/{id}/approval", new { nodeId = "approve_merge", kind = "merge", resumeNode = "end", context = new { } });
        var aprId = (await Json(await lt.GetAsync("/api/approvals?status=pending")))[0].GetProperty("id").GetInt32();
        (await lt.PostAsJsonAsync($"/api/approvals/{aprId}/decide", new { decision = "approve" })).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Rejecting_cancels_the_job_and_only_admins_change_settings()
    {
        var tq = await As(Tq); var ma = await As(Ma); var worker = Worker();
        var id = await NewJob(tq);
        await worker.PostAsync("/internal/jobs/claim", null);
        await worker.PostAsJsonAsync($"/internal/jobs/{id}/approval", new { nodeId = "approve_plan", kind = "plan", resumeNode = "code", context = new { } });
        var aprId = (await Json(await ma.GetAsync("/api/approvals?status=pending")))[0].GetProperty("id").GetInt32();
        (await ma.PostAsJsonAsync($"/api/approvals/{aprId}/decide", new { decision = "reject", note = "sai hướng" })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(await ma.GetAsync($"/api/jobs/{id}"))).GetProperty("status").GetString().Should().Be("cancelled");

        (await tq.PutAsJsonAsync("/api/settings/rules", new { noSelfApprove = false })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await tq.GetAsync("/api/accounts")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Workflow_versions_are_append_only_and_a_job_keeps_the_version_it_started_with()
    {
        var tq = await As(Tq); var ma = await As(Ma);
        var id = await NewJob(tq, "qlkho", "ai-coding");
        var before = await Json(await ma.GetAsync("/api/workflows/ai-coding/versions/3"));

        var def = before.GetProperty("definition");
        var saved = await ma.PostAsJsonAsync("/api/workflows/ai-coding/versions", new { definition = def, note = "thử" });
        saved.StatusCode.Should().Be(HttpStatusCode.Created);
        (await Json(saved)).GetProperty("version").GetInt32().Should().Be(4);

        (await Json(await ma.GetAsync("/api/workflows/ai-coding/versions/3"))).GetProperty("definition").GetRawText().Should().Be(def.GetRawText());   // v3 untouched
        (await Json(await ma.GetAsync($"/api/jobs/{id}"))).GetProperty("workflowVersion").GetInt32().Should().Be(3);                                  // job pinned to v3
        (await Json(await ma.GetAsync("/api/workflows")))[0].GetProperty("latest").GetInt32().Should().BeGreaterThanOrEqualTo(4);
        (await tq.PostAsJsonAsync("/api/workflows/ai-coding/versions", new { definition = def })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task An_invalid_workflow_is_refused_with_the_reasons()
    {
        var ma = await As(Ma);
        var bad = JsonDocument.Parse("""
            { "nodes": [ {"id":"start","type":"start"}, {"id":"a","type":"agent","agent":"nope"}, {"id":"b","type":"command"}, {"id":"end","type":"end"} ],
              "edges": [ {"from":"start","to":"a"}, {"from":"a","to":"b"}, {"from":"b","to":"a"}, {"from":"b","to":"end"} ] }
            """).RootElement;
        var r = await ma.PostAsJsonAsync("/api/workflows/ai-coding/versions", new { definition = bad });
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await Json(r)).GetProperty("errors").EnumerateArray().Select(e => e.GetString()).ToList();
        errors.Should().Contain(e => e!.Contains("unknown agent")).And.Contain(e => e!.Contains("loop"));
    }

    [Fact]
    public async Task Worker_routes_reject_a_missing_or_wrong_token()
    {
        (await _factory.CreateClient().PostAsync("/internal/jobs/claim", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await Worker("wrong").PostAsync("/internal/jobs/claim", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Claim_gives_each_job_to_one_worker_with_its_pinned_workflow_and_resumes_after_approval()
    {
        var tq = await As(Tq); var ma = await As(Ma); var worker = Worker();
        var id = await NewJob(tq, "qlkho", "quick-fix");

        var first = await worker.PostAsync("/internal/jobs/claim", null);
        var claim = await Json(first);
        claim.GetProperty("job").GetProperty("id").GetString().Should().Be(id);
        claim.GetProperty("workflow").GetProperty("id").GetString().Should().Be("quick-fix");
        claim.GetProperty("project").GetProperty("baseBranch").GetString().Should().Be("system_test");
        claim.GetProperty("agents").GetArrayLength().Should().BeGreaterThan(3);
        (await worker.PostAsync("/internal/jobs/claim", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);   // nothing left to take

        await worker.PostAsJsonAsync($"/internal/jobs/{id}/steps", new { nodeId = "analyze", outcome = "done", tokens = 1200, cost = 0.01 });
        await worker.PostAsJsonAsync($"/internal/jobs/{id}/approval", new { nodeId = "approve_merge", kind = "merge", resumeNode = "end", context = new { analyze = new { text = "kết quả" } } });
        var aprId = (await Json(await ma.GetAsync("/api/approvals?status=pending")))[0].GetProperty("id").GetInt32();
        await ma.PostAsJsonAsync($"/api/approvals/{aprId}/decide", new { decision = "approve" });

        var again = await Json(await worker.PostAsync("/internal/jobs/claim", null));
        again.GetProperty("job").GetProperty("resumeNode").GetString().Should().Be("end");
        again.GetProperty("job").GetProperty("context").GetProperty("analyze").GetProperty("text").GetString().Should().Be("kết quả");
        again.GetProperty("tokensUsed").GetInt64().Should().Be(1200);

        (await worker.PostAsJsonAsync($"/internal/jobs/{id}/complete", new { status = "succeeded" })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(await ma.GetAsync($"/api/jobs/{id}"))).GetProperty("status").GetString().Should().Be("succeeded");
    }

    [Fact]
    public async Task Once_the_daily_token_limit_is_reached_no_job_is_handed_out_until_it_is_raised()
    {
        var tq = await As(Tq); var ma = await As(Ma); var worker = Worker();
        var first = await NewJob(tq);
        await worker.PostAsync("/internal/jobs/claim", null);
        await worker.PostAsJsonAsync($"/internal/jobs/{first}/steps", new { nodeId = "code", outcome = "done", tokens = 300_000, cost = 1.0 });   // over 277,778
        await NewJob(tq);

        (await worker.PostAsync("/internal/jobs/claim", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await ma.PutAsJsonAsync("/api/settings/budget", new { enabled = true, unit = "tokens", dailyTokens = 5_000_000, perJobTokens = 1_000_000, warnAt = 0.8, action = "queue", notify = "" })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await worker.PostAsync("/internal/jobs/claim", null)).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Cancelling_tells_the_worker_to_stop_and_the_last_admin_cannot_be_removed()
    {
        var tq = await As(Tq); var ma = await As(Ma); var worker = Worker();
        var id = await NewJob(tq);
        await worker.PostAsync("/internal/jobs/claim", null);
        (await tq.PostAsync($"/api/jobs/{id}/cancel", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(await worker.PostAsJsonAsync($"/internal/jobs/{id}/steps", new { nodeId = "code", outcome = "done", tokens = 1, cost = 0 }))).GetProperty("stop").GetBoolean().Should().BeTrue();

        (await ma.PutAsJsonAsync("/api/accounts/ma", new { isAdmin = false })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ma.PutAsJsonAsync("/api/accounts/lt", new { projects = new[] { "web", "qlkho" } })).StatusCode.Should().Be(HttpStatusCode.OK);
        var lt = await As(Lt);
        (await Json(await lt.GetAsync("/api/projects"))).GetArrayLength().Should().Be(2);
    }

    // ---- bug and test-case files ----
    const string SheetUrl = "https://docs.google.com/spreadsheets/d/1abcDEF_x-y/edit";
    static object BugLink(string mode = "suggest", int max = 1, string url = SheetUrl) => new { url, tab = "Bug", columns = new { id = "A", title = "B", steps = "C", severity = "D", status = "E", reporter = "F" },
        filter = "Trạng thái = Mới", mode, autoWorkflow = "quick-fix", maxPerDay = max, writeBack = true };
    static object Row(string key, int row, string status = "Mới") => new { key, row, title = $"Lỗi {key}", steps = "1. mở 2. bấm", severity = "Cao", reporter = "Thủ kho", status };

    async Task Sync(HttpClient worker, params object[] rows) =>
        (await worker.PostAsJsonAsync("/internal/sources/qlkho/bug/result", new { rows })).StatusCode.Should().Be(HttpStatusCode.OK);

    [Fact]
    public async Task Only_an_admin_links_a_sheet_and_only_a_google_sheet_with_the_required_columns_is_accepted()
    {
        var ma = await As(Ma); var tq = await As(Tq); var lt = await As(Lt);
        (await tq.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink())).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink(url: "https://evil.example/spreadsheets/d/x"))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ma.PutAsJsonAsync("/api/sources/qlkho/bug", new { url = SheetUrl, tab = "Bug", columns = new { id = "A" } })).StatusCode.Should().Be(HttpStatusCode.BadRequest);   // no title column
        (await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink())).StatusCode.Should().Be(HttpStatusCode.OK);

        var saved = await Json(await tq.GetAsync("/api/sources/qlkho"));                          // it survives a reload and the member of that project can read it
        saved.GetProperty("bug").GetProperty("columns").GetProperty("status").GetString().Should().Be("E");
        saved.GetProperty("bug").GetProperty("filter").GetString().Should().Be("Trạng thái = Mới");
        (await lt.GetAsync("/api/sources/qlkho")).StatusCode.Should().Be(HttpStatusCode.NotFound);   // another project: not even visible
    }

    [Fact]
    public async Task Rows_are_read_once_triaged_and_a_ready_bug_becomes_one_job_only()
    {
        var ma = await As(Ma); var tq = await As(Tq); var worker = Worker();
        await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink());
        (await Json(await worker.PostAsJsonAsync("/internal/sources/due", new { serviceAccount = "bot@x.iam.gserviceaccount.com" }))).GetArrayLength().Should().Be(1);

        await Sync(worker, Row("BUG-1", 2), Row("BUG-2", 3));
        await Sync(worker, Row("BUG-1", 2), Row("BUG-2", 3));                                      // read again: no duplicates
        (await Json(await worker.PostAsJsonAsync("/internal/sources/due", new { }))).GetArrayLength().Should().Be(0);   // just synced

        var pending = await Json(await worker.PostAsync("/internal/bugs/pending", null));
        pending.GetProperty("bugs").GetArrayLength().Should().Be(2);
        var id1 = pending.GetProperty("bugs")[0].GetProperty("id").GetInt32();
        (await worker.PostAsJsonAsync($"/internal/bugs/{id1}/triage", new { triage = "ready", workflow = "quick-fix", note = "nhỏ" })).StatusCode.Should().Be(HttpStatusCode.OK);

        var run = await tq.PostAsync($"/api/sources/qlkho/bugs/{id1}/run", null);
        run.StatusCode.Should().Be(HttpStatusCode.OK);
        var jobId = (await Json(run)).GetProperty("id").GetString()!;
        (await tq.PostAsync($"/api/sources/qlkho/bugs/{id1}/run", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);   // already a job
        var job = await Json(await tq.GetAsync($"/api/jobs/{jobId}"));
        job.GetProperty("workflowId").GetString().Should().Be("quick-fix");
        job.GetProperty("requirement").GetString().Should().Contain("BUG-1").And.Contain("1. mở 2. bấm");

        var list = await Json(await tq.GetAsync("/api/sources/qlkho"));
        list.GetProperty("bugs").EnumerateArray().Single(b => b.GetProperty("key").GetString() == "BUG-1").GetProperty("jobId").GetString().Should().Be(jobId);
        list.GetProperty("serviceAccount").GetString().Should().Be("bot@x.iam.gserviceaccount.com");
    }

    [Fact]
    public async Task Auto_mode_stops_at_the_daily_cap_and_its_jobs_can_be_approved_by_anyone_with_access()
    {
        var ma = await As(Ma); var tq = await As(Tq); var worker = Worker();
        await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink("auto", max: 1));
        await Sync(worker, Row("BUG-1", 2), Row("BUG-2", 3));
        foreach (var b in (await Json(await worker.PostAsync("/internal/bugs/pending", null))).GetProperty("bugs").EnumerateArray())
            await worker.PostAsJsonAsync($"/internal/bugs/{b.GetProperty("id").GetInt32()}/triage", new { triage = "ready" });

        (await Json(await worker.PostAsync("/internal/bugs/autorun", null))).GetProperty("created").GetInt32().Should().Be(1);
        (await Json(await worker.PostAsync("/internal/bugs/autorun", null))).GetProperty("created").GetInt32().Should().Be(0);   // cap of 1 a day

        var jobs = await Json(await tq.GetAsync("/api/jobs"));
        jobs.GetArrayLength().Should().Be(1);
        jobs[0].GetProperty("createdById").GetString().Should().Be("auto");
        await worker.PostAsync("/internal/jobs/claim", null);
        await worker.PostAsJsonAsync($"/internal/jobs/{jobs[0].GetProperty("id").GetString()}/approval", new { nodeId = "approve_plan", kind = "plan", resumeNode = "code", context = new { } });
        var ap = (await Json(await tq.GetAsync("/api/approvals")))[0];
        ap.GetProperty("canApprove").GetBoolean().Should().BeTrue();   // nobody "created" it, so even the only member may approve
    }

    [Fact]
    public async Task Status_is_written_back_only_when_it_changed_and_a_fixed_report_is_triaged_again()
    {
        var ma = await As(Ma); var tq = await As(Tq); var worker = Worker();
        await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink());
        await Sync(worker, Row("BUG-1", 2), Row("BUG-2", 3));
        var bugs = (await Json(await worker.PostAsync("/internal/bugs/pending", null))).GetProperty("bugs");
        var (a, b) = (bugs[0].GetProperty("id").GetInt32(), bugs[1].GetProperty("id").GetInt32());
        await worker.PostAsJsonAsync($"/internal/bugs/{a}/triage", new { triage = "need-info", note = "thiếu bước" });
        await worker.PostAsJsonAsync($"/internal/bugs/{b}/triage", new { triage = "ready", workflow = "quick-fix" });
        var jobId = (await Json(await tq.PostAsync($"/api/sources/qlkho/bugs/{b}/run", null))).GetProperty("id").GetString()!;

        var wb = await Json(await worker.PostAsync("/internal/bugs/writeback", null));
        wb.EnumerateArray().Select(x => x.GetProperty("text").GetString()).Should().BeEquivalentTo("Cần thêm thông tin", $"Đang xử lý · {jobId}");
        var first = wb.EnumerateArray().First(x => x.GetProperty("key").GetString() == "BUG-1");
        first.GetProperty("row").GetInt32().Should().Be(2);
        first.GetProperty("statusColumn").GetString().Should().Be("E");
        foreach (var x in wb.EnumerateArray()) await worker.PostAsJsonAsync($"/internal/bugs/{x.GetProperty("id").GetInt32()}/written", new { text = x.GetProperty("text").GetString() });
        (await Json(await worker.PostAsync("/internal/bugs/writeback", null))).GetArrayLength().Should().Be(0);   // nothing new to write

        await tq.PostAsync($"/api/jobs/{jobId}/cancel", null);                                    // the job state moves on: the sheet follows
        (await Json(await worker.PostAsync("/internal/bugs/writeback", null)))[0].GetProperty("text").GetString().Should().Be($"Không tự sửa được · {jobId}");

        await Sync(worker, Row("BUG-1", 2));                                                      // the reporter added the steps and set the status back to "Mới"
        (await Json(await worker.PostAsync("/internal/bugs/pending", null))).GetProperty("bugs").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task Linking_a_different_sheet_clears_its_rows_but_keeps_bugs_that_already_have_a_job()
    {
        var ma = await As(Ma); var tq = await As(Tq); var worker = Worker();
        await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink());
        await Sync(worker, Row("BUG-1", 2), Row("BUG-2", 3));
        var bugs = (await Json(await worker.PostAsync("/internal/bugs/pending", null))).GetProperty("bugs");
        await worker.PostAsJsonAsync($"/internal/bugs/{bugs[0].GetProperty("id").GetInt32()}/triage", new { triage = "ready" });
        await tq.PostAsync($"/api/sources/qlkho/bugs/{bugs[0].GetProperty("id").GetInt32()}/run", null);

        await ma.PutAsJsonAsync("/api/sources/qlkho/bug", BugLink(url: "https://docs.google.com/spreadsheets/d/another/edit"));
        (await Json(await tq.GetAsync("/api/sources/qlkho"))).GetProperty("bugs").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task The_worker_status_shows_who_is_connected_to_admins_only_and_goes_offline_when_nothing_reports()
    {
        var ma = await As(Ma); var tq = await As(Tq);
        var none = await Json(await ma.GetAsync("/api/worker"));
        none.GetProperty("online").GetBoolean().Should().BeFalse();                       // nothing ever reported

        (await Worker("wrong").PostAsJsonAsync("/internal/worker/heartbeat", new { host = "h" })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await Worker().PostAsJsonAsync("/internal/worker/heartbeat", new { host = "server", claudeInstalled = true, claudeLoggedIn = true, claudeEmail = "me@x.com", claudePlan = "pro", currentJob = "JOB-0001", googleKey = false })).StatusCode.Should().Be(HttpStatusCode.OK);

        var admin = await Json(await ma.GetAsync("/api/worker"));
        admin.GetProperty("online").GetBoolean().Should().BeTrue();
        admin.GetProperty("info").GetProperty("claudeEmail").GetString().Should().Be("me@x.com");
        var member = await Json(await tq.GetAsync("/api/worker"));                        // a member sees that it works, not whose login it is
        member.GetProperty("online").GetBoolean().Should().BeTrue();
        member.GetProperty("info").GetProperty("claudeLoggedIn").GetBoolean().Should().BeTrue();
        member.GetProperty("info").GetProperty("claudeEmail").ValueKind.Should().Be(JsonValueKind.Null);
    }
}
