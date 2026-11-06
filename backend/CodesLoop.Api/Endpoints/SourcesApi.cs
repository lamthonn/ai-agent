using System.Text.Json;
using System.Text.RegularExpressions;
using CodesLoop.Api.Auth;
using CodesLoop.Api.Data;
using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Endpoints;

public record LinkRequest(string? Url, string? Tab, Dictionary<string, string>? Columns, string? Filter, string? Mode, string? AutoWorkflow, int? MaxPerDay, bool? WriteBack);
public record RunBugRequest(string? WorkflowId);
public record SheetRowReport(string Key, int Row, string? Title, string? Steps, string? Severity, string? Reporter, string? Status, string? Module, string? Expected);
public record SyncResult(List<SheetRowReport>? Rows, string? Error);
public record TriageReport(string Triage, string? Workflow, string? Note);
public record WrittenReport(string Text);
public record DueRequest(string? ServiceAccount);
public record SheetsInfo(string ServiceAccount);

/// <summary>Bug and test-case files linked to a project. The worker reads the sheets (it holds the Google key and the Claude login),
/// the API keeps the rows, decides who may see them and turns a bug into a job.</summary>
public static partial class SourcesApi
{
    public const string AutoUser = "auto";                       // CreatedById of jobs made without a person: nobody is barred from approving them
    static readonly string[] BugFields = ["id", "title", "steps", "severity", "status", "reporter"];
    static readonly string[] CaseFields = ["id", "module", "title", "steps", "expected"];
    [GeneratedRegex(@"^https://docs\.google\.com/spreadsheets/d/[\w-]+")] private static partial Regex SheetUrl();
    [GeneratedRegex(@"^[A-Z]{1,2}$")] private static partial Regex Column();

    static string Severity(string? s)
    {
        s = (s ?? "").Trim().ToLowerInvariant();
        return s.Contains("cao") || s.Contains("high") || s.Contains("critical") || s.Contains("nghiêm") ? "high" : s.Contains("thấp") || s.Contains("low") || s.Contains("minor") ? "low" : "medium";
    }

    static string Clip(string? s, int n) => (s ?? "").Length > n ? s![..n] : s ?? "";

    public static string BugRequirement(BugRow r) =>
        $"Bug {r.Key} (mức độ: {r.Severity}, người báo: {r.Reporter})\n\nMô tả:\n{r.Title}\n\nCác bước tái hiện:\n{(string.IsNullOrWhiteSpace(r.Steps) ? "(không có)" : r.Steps)}" +
        (string.IsNullOrWhiteSpace(r.Note) ? "" : $"\n\nGhi chú của agent phân loại:\n{r.Note}");

    static string JobLabel(string status) => status switch
    {
        JobStatus.Approval => "Chờ duyệt", JobStatus.Succeeded => "Đã sửa", JobStatus.Failed or JobStatus.Cancelled => "Không tự sửa được", _ => "Đang xử lý",
    };

    static object LinkDto(SourceLink l) => new { l.Url, l.Tab, columns = JsonDocument.Parse(l.ColumnsJson).RootElement, l.Filter, l.Mode, l.AutoWorkflow, l.MaxPerDay, l.WriteBack, l.LastSyncAt, l.LastError };

    /// <summary>Turns ready bugs into jobs for projects set to "auto": at most MaxPerDay per project per day, and none while the daily token limit is used up.</summary>
    public static async Task<int> AutoRunAsync(AppDb db)
    {
        var budget = await db.GetAsync("budget", new BudgetSettings());
        var created = 0;
        foreach (var link in await db.SourceLinks.Where(l => l.Kind == "bug" && l.Mode == "auto" && l.Url != "").ToListAsync())
        {
            var today = await db.Jobs.CountAsync(j => j.ProjectId == link.ProjectId && j.CreatedById == AutoUser && j.CreatedAt >= SettingsStore.TodayStartUtc());
            var ready = await db.BugRows.Where(r => r.ProjectId == link.ProjectId && r.Triage == "ready")
                .OrderBy(r => r.Severity == "high" ? 0 : r.Severity == "medium" ? 1 : 2).ThenBy(r => r.Id).ToListAsync();
            foreach (var r in ready)
            {
                if (today >= link.MaxPerDay) break;
                if (budget.Enabled && budget.Action != "warn" && await db.TokensTodayAsync() >= budget.DailyTokens) break;
                var job = await JobFactory.CreateAsync(db, link.ProjectId, link.AutoWorkflow, Clip($"{r.Key}: {r.Title}", 100), BugRequirement(r), null, AutoUser);
                if (job is null) { link.LastError = $"Workflow '{link.AutoWorkflow}' không tồn tại."; await db.SaveChangesAsync(); break; }
                r.Triage = "job"; r.JobId = job.Id; r.Workflow = link.AutoWorkflow;
                await db.SaveChangesAsync();
                today++; created++;
            }
        }
        return created;
    }

    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/sources").RequireAuthorization();

        g.MapGet("/{project}", async (string project, AppDb db, System.Security.Claims.ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a || !await db.CanSeeAsync(a, project)) return Results.NotFound();
            var links = await db.SourceLinks.Where(l => l.ProjectId == project).ToListAsync();
            var bugs = await db.BugRows.Where(r => r.ProjectId == project).OrderByDescending(r => r.Row).ToListAsync();
            var cases = await db.CaseRows.Where(r => r.ProjectId == project).OrderBy(r => r.Id).ToListAsync();
            var sheets = await db.GetAsync<SheetsInfo?>("sheets", null);
            return Results.Ok(new
            {
                bug = links.FirstOrDefault(l => l.Kind == "bug") is { } b ? LinkDto(b) : null,
                @case = links.FirstOrDefault(l => l.Kind == "case") is { } c ? LinkDto(c) : null,
                serviceAccount = sheets?.ServiceAccount,
                bugs = bugs.Select(r => new { r.Id, r.Key, r.Row, r.Title, r.Severity, r.Reporter, r.Triage, r.Workflow, r.Note, r.JobId }),
                cases = cases.Select(r => new { r.Key, r.Module, r.Title, r.Expected, steps = r.Steps.Split('\n', StringSplitOptions.RemoveEmptyEntries).Length }),
            });
        });

        g.MapPut("/{project}/{kind}", async (string project, string kind, LinkRequest r, AppDb db, System.Security.Claims.ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { IsAdmin: true }) return Results.Json(new { error = "Chỉ admin sửa file nguồn." }, statusCode: 403);
            if (kind is not ("bug" or "case") || await db.Projects.FindAsync(project) is null) return Results.NotFound();
            var url = (r.Url ?? "").Trim();
            if (!SheetUrl().IsMatch(url)) return Results.BadRequest(new { error = "Chỉ nhận link Google Sheet (https://docs.google.com/spreadsheets/d/…)." });
            var tab = (r.Tab ?? "").Trim();
            if (tab.Length == 0) return Results.BadRequest(new { error = "Nhập tên tab." });
            var fields = kind == "bug" ? BugFields : CaseFields;
            var cols = (r.Columns ?? []).Where(kv => fields.Contains(kv.Key) && !string.IsNullOrEmpty(kv.Value)).ToDictionary(kv => kv.Key, kv => kv.Value.Trim().ToUpperInvariant());
            if (cols.Values.Any(v => !Column().IsMatch(v))) return Results.BadRequest(new { error = "Cột phải là chữ cái, ví dụ A hoặc AB." });
            if (!cols.ContainsKey("id") || !cols.ContainsKey("title")) return Results.BadRequest(new { error = kind == "bug" ? "Chọn cột cho Mã bug và Mô tả." : "Chọn cột cho Mã test case và Tên test case." });
            if (cols.Values.Distinct().Count() != cols.Count) return Results.BadRequest(new { error = "Hai thông tin không được lấy từ cùng một cột." });

            var link = await db.SourceLinks.FindAsync(project, kind);
            if (link is null) db.SourceLinks.Add(link = new SourceLink { ProjectId = project, Kind = kind });
            if (kind == "bug")
            {
                var mode = r.Mode ?? "suggest";
                var wf = r.AutoWorkflow ?? "quick-fix";
                var max = r.MaxPerDay ?? 1;
                if (mode is not ("suggest" or "auto") || max is < 1 or > 20) return Results.BadRequest(new { error = "Chế độ hoặc số job mỗi ngày không hợp lệ." });
                if (!await db.Workflows.AnyAsync(w => w.Id == wf)) return Results.BadRequest(new { error = "Workflow tự chạy không tồn tại." });
                link.Filter = (r.Filter ?? "").Trim(); link.Mode = mode; link.AutoWorkflow = wf; link.MaxPerDay = max; link.WriteBack = r.WriteBack ?? true;
            }
            if (link.Url != url || link.Tab != tab)   // another file: the rows of the old one no longer apply (bugs that already have a job stay as history)
            {
                if (kind == "bug") db.BugRows.RemoveRange(db.BugRows.Where(x => x.ProjectId == project && x.Triage != "job"));
                else db.CaseRows.RemoveRange(db.CaseRows.Where(x => x.ProjectId == project));
                link.LastSyncAt = null;
            }
            link.Url = url; link.Tab = tab; link.ColumnsJson = JsonSerializer.Serialize(cols); link.LastError = null; link.SyncRequestedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(LinkDto(link));
        });

        g.MapPost("/{project}/sync", async (string project, AppDb db, System.Security.Claims.ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a || !await db.CanSeeAsync(a, project)) return Results.NotFound();
            await db.SourceLinks.Where(l => l.ProjectId == project).ExecuteUpdateAsync(s => s.SetProperty(l => l.SyncRequestedAt, DateTime.UtcNow));
            return Results.Accepted();
        });

        g.MapPost("/{project}/bugs/{id:int}/run", async (string project, int id, RunBugRequest? r, AppDb db, System.Security.Claims.ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a || !await db.CanSeeAsync(a, project)) return Results.NotFound();
            var row = await db.BugRows.FirstOrDefaultAsync(x => x.Id == id && x.ProjectId == project);
            if (row is null) return Results.NotFound();
            if (row.Triage != "ready") return Results.Conflict(new { error = "Bug này không ở trạng thái Sẵn sàng." });
            var budget = await db.GetAsync("budget", new BudgetSettings());
            if (budget.Enabled && budget.Action == "pause" && await db.TokensTodayAsync() >= budget.DailyTokens)
                return Results.Json(new { error = "Đã chạm hạn mức ngày; job mới bị chặn." }, statusCode: 409);
            var job = await JobFactory.CreateAsync(db, project, r?.WorkflowId ?? row.Workflow, Clip($"{row.Key}: {row.Title}", 100), BugRequirement(row), null, a.Id);
            if (job is null) return Results.BadRequest(new { error = "Unknown workflow." });
            row.Triage = "job"; row.JobId = job.Id; row.Workflow = job.WorkflowId;
            await db.SaveChangesAsync();
            return Results.Ok(new { job.Id });
        });
    }

    /// <summary>The worker's side: which sheets to read, the rows it read, the triage it decided, what to write back.</summary>
    public static void MapWorker(RouteGroupBuilder g)
    {
        g.MapPost("/sources/due", async (DueRequest r, AppDb db) =>
        {
            if (!string.IsNullOrWhiteSpace(r.ServiceAccount) && (await db.GetAsync<SheetsInfo?>("sheets", null))?.ServiceAccount != r.ServiceAccount)
                await db.SetAsync("sheets", new SheetsInfo(r.ServiceAccount));
            var cutoff = DateTime.UtcNow.AddMinutes(-10);
            var due = await db.SourceLinks.Where(l => l.Url != "" && (l.LastSyncAt == null || l.LastSyncAt < cutoff || (l.SyncRequestedAt != null && l.SyncRequestedAt > l.LastSyncAt))).ToListAsync();
            return Results.Ok(due.Select(l => new { project = l.ProjectId, kind = l.Kind, l.Url, l.Tab, columns = JsonDocument.Parse(l.ColumnsJson).RootElement, l.Filter }));
        });

        g.MapPost("/sources/{project}/{kind}/result", async (string project, string kind, SyncResult r, AppDb db) =>
        {
            var link = await db.SourceLinks.FindAsync(project, kind);
            if (link is null) return Results.NotFound();
            link.LastSyncAt = DateTime.UtcNow; link.LastError = r.Error is null ? null : Clip(r.Error, 500);   // an attempt counts as a sync so a broken link is retried every 10 minutes, not every 10 seconds
            if (r.Error is null && r.Rows is not null)
            {
                var rows = r.Rows.Where(x => !string.IsNullOrWhiteSpace(x.Key)).GroupBy(x => x.Key.Trim()).Select(x => x.First()).ToList();
                if (kind == "bug")
                {
                    var have = await db.BugRows.Where(x => x.ProjectId == project).ToDictionaryAsync(x => x.Key);
                    foreach (var s in rows)
                    {
                        var key = s.Key.Trim();
                        if (!have.TryGetValue(key, out var b)) db.BugRows.Add(b = new BugRow { ProjectId = project, Key = Clip(key, 100), CreatedAt = DateTime.UtcNow });
                        else if (b.Triage is "need-info" or "duplicate" && b.Written is not null && s.Status != b.Written)
                        { b.Triage = "new"; b.Written = null; b.Note = null; }   // the person set the status back after fixing the report: triage it again
                        b.Row = s.Row; b.Title = Clip(s.Title, 500); b.Steps = Clip(s.Steps, 4000); b.Severity = Severity(s.Severity); b.Reporter = Clip(s.Reporter, 200); b.SheetStatus = Clip(s.Status, 200);
                    }
                }
                else
                {
                    var have = await db.CaseRows.Where(x => x.ProjectId == project).ToDictionaryAsync(x => x.Key);
                    foreach (var s in rows)
                    {
                        var key = s.Key.Trim();
                        if (!have.TryGetValue(key, out var c)) db.CaseRows.Add(c = new CaseRow { ProjectId = project, Key = Clip(key, 100) });
                        c.Module = Clip(s.Module, 200); c.Title = Clip(s.Title, 500); c.Steps = Clip(s.Steps, 4000); c.Expected = Clip(s.Expected, 2000);
                    }
                    var keep = rows.Select(x => x.Key.Trim()).ToHashSet();
                    db.CaseRows.RemoveRange(have.Values.Where(x => !keep.Contains(x.Key)));
                }
            }
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        g.MapPost("/bugs/pending", async (AppDb db) =>
        {
            var rows = await db.BugRows.Where(r => r.Triage == "new").OrderBy(r => r.Id).Take(10).ToListAsync();
            var projects = rows.Select(r => r.ProjectId).Distinct().ToList();
            var known = await db.BugRows.Where(r => projects.Contains(r.ProjectId) && r.Triage != "new").OrderByDescending(r => r.Id).Take(200)
                .Select(r => new { project = r.ProjectId, key = r.Key, title = r.Title, triage = r.Triage }).ToListAsync();
            var workflows = await db.Workflows.Select(w => new { id = w.Id, name = w.NameVi }).ToListAsync();
            return Results.Ok(new { bugs = rows.Select(r => new { r.Id, project = r.ProjectId, key = r.Key, r.Title, r.Steps, r.Severity }), known, workflows });
        });

        g.MapPost("/bugs/{id:int}/triage", async (int id, TriageReport r, AppDb db) =>
        {
            if (r.Triage is not ("ready" or "need-info" or "duplicate")) return Results.BadRequest(new { error = "triage must be ready, need-info or duplicate." });
            var row = await db.BugRows.FindAsync(id);
            if (row is null) return Results.NotFound();
            if (row.Triage != "new") return Results.Ok();   // already decided (e.g. someone ran it meanwhile)
            row.Triage = r.Triage; row.Note = Clip(r.Note, 1000);
            row.Workflow = r.Triage == "ready" && r.Workflow is not null && await db.Workflows.AnyAsync(w => w.Id == r.Workflow) ? r.Workflow : null;
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        g.MapPost("/bugs/autorun", async (AppDb db) => Results.Ok(new { created = await AutoRunAsync(db) }));

        g.MapPost("/bugs/writeback", async (AppDb db) =>
        {
            var result = new List<object>();
            foreach (var link in await db.SourceLinks.Where(l => l.Kind == "bug" && l.WriteBack && l.Url != "").ToListAsync())
            {
                var cols = JsonSerializer.Deserialize<Dictionary<string, string>>(link.ColumnsJson)!;
                if (!cols.TryGetValue("status", out var statusCol)) continue;
                var rows = await db.BugRows.Where(r => r.ProjectId == link.ProjectId && (r.Triage == "job" || r.Triage == "need-info" || r.Triage == "duplicate")).ToListAsync();
                var jobIds = rows.Where(r => r.JobId != null).Select(r => r.JobId!).ToList();
                var jobs = await db.Jobs.Where(j => jobIds.Contains(j.Id)).ToDictionaryAsync(j => j.Id, j => j.Status);
                foreach (var r in rows)
                {
                    var text = r.Triage switch
                    {
                        "job" => r.JobId is not null && jobs.TryGetValue(r.JobId, out var st) ? $"{JobLabel(st)} · {r.JobId}" : null,
                        "need-info" => "Cần thêm thông tin",
                        _ => "Trùng",
                    };
                    if (text is not null && text != r.Written)
                        result.Add(new { id = r.Id, project = link.ProjectId, key = r.Key, row = r.Row, text, url = link.Url, tab = link.Tab, idColumn = cols["id"], statusColumn = statusCol });
                }
            }
            return Results.Ok(result);
        });

        g.MapPost("/bugs/{id:int}/written", async (int id, WrittenReport r, AppDb db) =>
            await db.BugRows.Where(x => x.Id == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Written, Clip(r.Text, 300))) == 0 ? Results.NotFound() : Results.Ok());
    }
}
