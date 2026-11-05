using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using CodesLoop.Api.Auth;
using CodesLoop.Api.Data;
using CodesLoop.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace CodesLoop.Api.Endpoints;

public record LoginRequest(string Email, string Password);
public record CreateJobRequest(string Title, string ProjectId, string? WorkflowId, string Requirement, long? TokenLimit);
public record DecideRequest(string Decision, string? Note);
public record SaveVersionRequest(JsonElement Definition, string? Note);
public record AccountRequest(string? Name, string? Email, string? Password, bool? IsAdmin, bool? Active, string[]? Projects);

public static class UserApi
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/auth/login", async (LoginRequest r, AppDb db, IConfiguration cfg) =>
        {
            var a = await db.Accounts.FirstOrDefaultAsync(x => x.Email == r.Email.Trim().ToLower() && x.Active);
            if (a is null || new PasswordHasher<Account>().VerifyHashedPassword(a, a.PasswordHash, r.Password) == PasswordVerificationResult.Failed)
                return Results.Json(new { error = "Email hoặc mật khẩu không đúng." }, statusCode: 401);
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(cfg["Jwt:Key"]!));
            var jwt = new JwtSecurityToken(claims: [new Claim(ClaimTypes.NameIdentifier, a.Id)], expires: DateTime.UtcNow.AddHours(12),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(jwt) });
        });

        var api = app.MapGroup("/api").RequireAuthorization();

        api.MapGet("/me", async (AppDb db, ClaimsPrincipal u) =>
            await db.CurrentAsync(u) is { } a ? Results.Ok(new { a.Id, a.Name, a.Email, a.IsAdmin, projects = await db.ProjectIdsAsync(a) }) : Results.Unauthorized());

        api.MapGet("/projects", async (AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var ids = await db.ProjectIdsAsync(a);
            return Results.Ok(await db.Projects.Where(p => ids.Contains(p.Id)).ToListAsync());
        });

        api.MapGet("/agents", async (AppDb db) => Results.Ok(await db.Agents.ToListAsync()));

        // ---- jobs: every query is filtered by the projects this account may open ----
        api.MapGet("/jobs", async (AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var ids = await db.ProjectIdsAsync(a);
            var jobs = await db.Jobs.Include(j => j.Steps).Where(j => ids.Contains(j.ProjectId)).OrderByDescending(j => j.CreatedAt).ToListAsync();
            return Results.Ok(jobs.Select(j => new { j.Id, j.Title, j.ProjectId, j.WorkflowId, j.WorkflowVersion, j.CreatedById, j.Status, j.Branch, j.CreatedAt, j.StartedAt, j.EndedAt,
                tokens = j.Steps.Sum(s => s.Tokens), cost = j.Steps.Sum(s => s.Cost) }));
        });

        api.MapGet("/jobs/{id}", async (string id, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var j = await db.Jobs.Include(x => x.Steps).FirstOrDefaultAsync(x => x.Id == id);
            if (j is null || !await db.CanSeeAsync(a, j.ProjectId)) return Results.NotFound();   // not 403: do not reveal it exists
            var approvals = await db.Approvals.Where(x => x.JobId == id).OrderBy(x => x.Id).ToListAsync();
            return Results.Ok(new { j.Id, j.Title, j.ProjectId, j.WorkflowId, j.WorkflowVersion, j.CreatedById, j.Status, j.Requirement, j.Branch, j.FailReason,
                j.CreatedAt, j.StartedAt, j.EndedAt, steps = j.Steps.OrderBy(s => s.Id), approvals });
        });

        api.MapGet("/jobs/{id}/events", async (string id, long? after, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var j = await db.Jobs.FindAsync(id);
            if (j is null || !await db.CanSeeAsync(a, j.ProjectId)) return Results.NotFound();
            return Results.Ok(await db.JobEvents.Where(e => e.JobId == id && e.Id > (after ?? 0)).OrderBy(e => e.Id).Take(500).ToListAsync());
        });

        api.MapPost("/jobs", async (CreateJobRequest r, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            if (string.IsNullOrWhiteSpace(r.Title) || string.IsNullOrWhiteSpace(r.Requirement)) return Results.BadRequest(new { error = "Title and requirement are required." });
            if (!await db.CanSeeAsync(a, r.ProjectId)) return Results.Json(new { error = "Bạn không có quyền vào project này." }, statusCode: 403);
            var project = await db.Projects.FindAsync(r.ProjectId);
            var wf = await db.Workflows.Include(w => w.Versions).FirstOrDefaultAsync(w => w.Id == (r.WorkflowId ?? project!.DefaultWorkflowId));
            if (wf is null) return Results.BadRequest(new { error = "Unknown workflow." });

            var budget = await db.GetAsync("budget", new BudgetSettings());
            if (budget.Enabled && budget.Action == "pause" && await db.TokensTodayAsync() >= budget.DailyTokens)
                return Results.Json(new { error = "Đã chạm hạn mức ngày; job mới bị chặn." }, statusCode: 409);

            var last = (await db.Jobs.Select(x => x.Id).ToListAsync()).Select(x => int.TryParse(x.AsSpan(4), out var n) ? n : 0).DefaultIfEmpty(0).Max();
            var job = new Job { Id = $"JOB-{last + 1:0000}", Title = r.Title.Trim(), ProjectId = r.ProjectId, WorkflowId = wf.Id, WorkflowVersion = wf.Versions.Max(v => v.Version),
                CreatedById = a.Id, Requirement = r.Requirement, TokenLimit = r.TokenLimit, CreatedAt = DateTime.UtcNow };
            db.Jobs.Add(job);
            await db.SaveChangesAsync();
            return Results.Created($"/api/jobs/{job.Id}", new { job.Id, job.Status, job.WorkflowVersion });
        });

        api.MapPost("/jobs/{id}/cancel", async (string id, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var j = await db.Jobs.FindAsync(id);
            if (j is null || !await db.CanSeeAsync(a, j.ProjectId)) return Results.NotFound();
            if (JobStatus.IsFinal(j.Status)) return Results.Conflict(new { error = "Job đã kết thúc." });
            j.Status = JobStatus.Cancelled; j.EndedAt = DateTime.UtcNow; j.FailReason = $"Hủy bởi {a.Name}";
            await db.Approvals.Where(x => x.JobId == id && x.Status == "pending").ExecuteDeleteAsync();
            await db.SaveChangesAsync();
            return Results.Ok(new { j.Status });
        });

        // ---- approvals ----
        api.MapGet("/approvals", async (string? status, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var ids = await db.ProjectIdsAsync(a);
            var rules = await db.GetAsync("rules", new RuleSettings());
            var rows = await (from x in db.Approvals join j in db.Jobs on x.JobId equals j.Id where ids.Contains(j.ProjectId) && (status == null || x.Status == status)
                              orderby x.Id descending select new { x, j }).ToListAsync();
            var result = new List<object>();
            foreach (var r in rows)
                result.Add(new { r.x.Id, r.x.JobId, r.x.NodeId, r.x.Kind, r.x.Status, r.x.RequestedAt, r.x.DecidedById, r.x.DecidedAt, r.x.Note, jobTitle = r.j.Title, projectId = r.j.ProjectId,
                    canApprove = await db.ApprovalCheckAsync(a, r.j, rules) == ApprovalDenied.None });
            return Results.Ok(result);
        });

        api.MapPost("/approvals/{id:int}/decide", async (int id, DecideRequest r, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { } a) return Results.Unauthorized();
            var ap = await db.Approvals.FindAsync(id);
            var job = ap is null ? null : await db.Jobs.FindAsync(ap.JobId);
            if (ap is null || job is null || !await db.CanSeeAsync(a, job.ProjectId)) return Results.NotFound();
            if (ap.Status != "pending") return Results.Conflict(new { error = "Yêu cầu này đã được xử lý." });
            if (r.Decision is not ("approve" or "reject")) return Results.BadRequest(new { error = "decision must be 'approve' or 'reject'." });

            var denied = await db.ApprovalCheckAsync(a, job, await db.GetAsync("rules", new RuleSettings()));
            if (denied != ApprovalDenied.None)
                return Results.Json(new { error = denied == ApprovalDenied.OwnJob ? "Bạn tạo job này nên cần người khác duyệt." : "Bạn không có quyền duyệt project này.", code = denied == ApprovalDenied.OwnJob ? "own-job" : "no-access" }, statusCode: 403);

            ap.DecidedById = a.Id; ap.DecidedAt = DateTime.UtcNow; ap.Note = r.Note;
            if (r.Decision == "approve") { ap.Status = "approved"; job.Status = JobStatus.Queued; }       // back in the queue; the worker resumes at ResumeNode
            else { ap.Status = "rejected"; job.Status = JobStatus.Cancelled; job.EndedAt = DateTime.UtcNow; job.FailReason = $"Bị từ chối bởi {a.Name}"; }
            db.JobEvents.Add(new JobEvent { JobId = job.Id, Level = "info", Message = $"{a.Name}: {(r.Decision == "approve" ? "duyệt" : "từ chối")} {ap.NodeId}", At = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok(new { ap.Status, jobStatus = job.Status });
        });

        // ---- workflows: versions are append-only ----
        api.MapGet("/workflows", async (AppDb db) =>
        {
            var wfs = await db.Workflows.Include(w => w.Versions).ToListAsync();
            return Results.Ok(wfs.Select(w => new { w.Id, w.NameVi, w.NameEn, latest = w.Versions.Max(v => v.Version), versions = w.Versions.OrderBy(v => v.Version).Select(v => new { v.Version, v.Note, v.CreatedById, v.CreatedAt }) }));
        });

        api.MapGet("/workflows/{id}/versions/{version:int}", async (string id, int version, AppDb db) =>
            await db.WorkflowVersions.FirstOrDefaultAsync(v => v.WorkflowId == id && v.Version == version) is { } v
                ? Results.Ok(new { v.Version, v.Note, v.CreatedAt, definition = JsonDocument.Parse(v.DefinitionJson).RootElement }) : Results.NotFound());

        api.MapPost("/workflows/{id}/versions", async (string id, SaveVersionRequest r, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { IsAdmin: true } a) return Results.Json(new { error = "Chỉ admin lưu workflow." }, statusCode: 403);
            var wf = await db.Workflows.Include(w => w.Versions).FirstOrDefaultAsync(w => w.Id == id);
            if (wf is null) return Results.NotFound();
            var errors = WorkflowValidator.Check(r.Definition, (await db.Agents.Select(x => x.Id).ToListAsync()).ToHashSet());
            if (errors.Count > 0) return Results.BadRequest(new { errors });
            var next = wf.Versions.Max(v => v.Version) + 1;
            var node = JsonNode.Parse(r.Definition.GetRawText())!.AsObject();
            node["id"] = id; node["version"] = next;
            db.WorkflowVersions.Add(new WorkflowVersion { WorkflowId = id, Version = next, DefinitionJson = node.ToJsonString(), Note = r.Note ?? "", CreatedById = a.Id, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Created($"/api/workflows/{id}/versions/{next}", new { version = next });
        });

        // ---- settings and members (admin) ----
        api.MapGet("/settings/budget", async (AppDb db) => Results.Ok(await db.GetAsync("budget", new BudgetSettings())));
        api.MapGet("/settings/rules", async (AppDb db) => Results.Ok(await db.GetAsync("rules", new RuleSettings())));
        api.MapPut("/settings/budget", async (BudgetSettings b, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { IsAdmin: true }) return Results.Json(new { error = "Chỉ admin đổi hạn mức." }, statusCode: 403);
            if (b.DailyTokens <= 0 || b.PerJobTokens <= 0 || b.WarnAt is < 0.5 or > 0.95 || b.Action is not ("queue" or "pause" or "warn")) return Results.BadRequest(new { error = "Invalid budget." });
            await db.SetAsync("budget", b); return Results.Ok(b);
        });
        api.MapPut("/settings/rules", async (RuleSettings r, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { IsAdmin: true }) return Results.Json(new { error = "Chỉ admin đổi quy tắc duyệt." }, statusCode: 403);
            await db.SetAsync("rules", r); return Results.Ok(r);
        });

        api.MapGet("/accounts", async (AppDb db, ClaimsPrincipal u) =>
            await db.CurrentAsync(u) is { IsAdmin: true }
                ? Results.Ok((await db.Accounts.Include(a => a.Projects).ToListAsync()).Select(a => new { a.Id, a.Name, a.Email, a.IsAdmin, a.Active, projects = a.Projects.Select(p => p.ProjectId) }))
                : Results.Json(new { error = "Chỉ admin xem danh sách thành viên." }, statusCode: 403));

        api.MapPost("/accounts", async (AccountRequest r, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { IsAdmin: true }) return Results.Json(new { error = "Chỉ admin mời thành viên." }, statusCode: 403);
            if (string.IsNullOrWhiteSpace(r.Name) || string.IsNullOrWhiteSpace(r.Email) || string.IsNullOrWhiteSpace(r.Password) || r.Password.Length < 8) return Results.BadRequest(new { error = "Name, email and a password of 8+ characters are required." });
            var email = r.Email.Trim().ToLower();
            if (await db.Accounts.AnyAsync(a => a.Email == email)) return Results.Conflict(new { error = "Email đã tồn tại." });
            var acc = new Account { Id = Guid.NewGuid().ToString("N")[..8], Name = r.Name.Trim(), Email = email, IsAdmin = r.IsAdmin ?? false };
            acc.PasswordHash = new PasswordHasher<Account>().HashPassword(acc, r.Password);
            acc.Projects = (r.Projects ?? []).Select(p => new ProjectMember { AccountId = acc.Id, ProjectId = p }).ToList();
            db.Accounts.Add(acc); await db.SaveChangesAsync();
            return Results.Created($"/api/accounts/{acc.Id}", new { acc.Id });
        });

        api.MapPut("/accounts/{id}", async (string id, AccountRequest r, AppDb db, ClaimsPrincipal u) =>
        {
            if (await db.CurrentAsync(u) is not { IsAdmin: true }) return Results.Json(new { error = "Chỉ admin phân quyền." }, statusCode: 403);
            var acc = await db.Accounts.Include(a => a.Projects).FirstOrDefaultAsync(a => a.Id == id);
            if (acc is null) return Results.NotFound();
            var admin = r.IsAdmin ?? acc.IsAdmin; var active = r.Active ?? acc.Active;
            if (acc.IsAdmin && acc.Active && !(admin && active) && await db.Accounts.CountAsync(a => a.IsAdmin && a.Active) <= 1)
                return Results.Conflict(new { error = "Phải còn ít nhất một admin đang hoạt động." });
            acc.IsAdmin = admin; acc.Active = active; acc.Name = r.Name ?? acc.Name;
            if (r.Projects is not null) { db.ProjectMembers.RemoveRange(acc.Projects); acc.Projects = r.Projects.Distinct().Select(p => new ProjectMember { AccountId = id, ProjectId = p }).ToList(); }
            await db.SaveChangesAsync();
            return Results.Ok();
        });
    }
}
