using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CodesLoop.Api.Data;
using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Endpoints;

public record StepReport(string NodeId, string Outcome, long Tokens, double Cost, string? Note);
public record EventReport(string Level, string Message);
public record ApprovalRequest(string NodeId, string Kind, string ResumeNode, JsonElement Context);
public record CompleteReport(string Status, string? Reason);
public record MetaReport(string? Branch);

/// <summary>What the Python worker calls. Separate from the user API: guarded by a shared token, never exposed to browsers.</summary>
public static class WorkerApi
{
    public static void Map(WebApplication app)
    {
        var token = app.Configuration["Worker:Token"] ?? throw new InvalidOperationException("Set Worker:Token.");
        var g = app.MapGroup("/internal").AddEndpointFilter(async (ctx, next) =>
        {
            var given = ctx.HttpContext.Request.Headers["X-Worker-Token"].ToString();
            return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(given), Encoding.UTF8.GetBytes(token)) ? await next(ctx) : Results.Unauthorized();
        });

        // Hands out the oldest queued job, or nothing when the daily limit is reached. Claiming is one conditional UPDATE,
        // so two workers can never take the same job (works the same on SQLite and PostgreSQL).
        g.MapPost("/jobs/claim", async (AppDb db) =>
        {
            var budget = await db.GetAsync("budget", new BudgetSettings());
            if (budget.Enabled && budget.Action != "warn" && await db.TokensTodayAsync() >= budget.DailyTokens) return Results.NoContent();

            var now = DateTime.UtcNow;
            foreach (var id in await db.Jobs.Where(j => j.Status == JobStatus.Queued).OrderBy(j => j.CreatedAt).Select(j => j.Id).Take(5).ToListAsync())
            {
                var took = await db.Jobs.Where(j => j.Id == id && j.Status == JobStatus.Queued)
                    .ExecuteUpdateAsync(s => s.SetProperty(j => j.Status, JobStatus.Running).SetProperty(j => j.StartedAt, j => j.StartedAt ?? now));
                if (took == 0) continue;

                var job = await db.Jobs.AsNoTracking().FirstAsync(j => j.Id == id);
                var project = await db.Projects.FindAsync(job.ProjectId);
                var version = await db.WorkflowVersions.FirstAsync(v => v.WorkflowId == job.WorkflowId && v.Version == job.WorkflowVersion);
                var used = await db.JobSteps.Where(s => s.JobId == id).SumAsync(s => (long?)s.Tokens) ?? 0;
                var agents = await db.Agents.ToListAsync();
                return Results.Ok(new
                {
                    job = new { job.Id, job.Title, job.Requirement, job.Branch, job.ResumeNode, context = job.ContextJson is null ? (JsonElement?)null : JsonDocument.Parse(job.ContextJson).RootElement },
                    project = new { project!.Id, project.Repo, project.BaseBranch, project.BuildCommand, project.TestCommand },
                    workflow = JsonDocument.Parse(version.DefinitionJson).RootElement,
                    agents = agents.Select(a => new { a.Id, a.Model, a.MaxTurns, a.Permission, tools = JsonDocument.Parse(a.ToolsJson).RootElement, a.Prompt }),
                    tokenLimit = job.TokenLimit ?? budget.PerJobTokens,
                    tokensUsed = used,
                });
            }
            return Results.NoContent();
        });

        g.MapPost("/jobs/{id}/steps", async (string id, StepReport r, AppDb db) =>
        {
            var job = await db.Jobs.FindAsync(id);
            if (job is null) return Results.NotFound();
            db.JobSteps.Add(new JobStep { JobId = id, NodeId = r.NodeId, Outcome = r.Outcome, Tokens = r.Tokens, Cost = r.Cost, Note = r.Note ?? "", At = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok(new { stop = job.Status == JobStatus.Cancelled });   // the worker stops when someone cancelled the job
        });

        g.MapPost("/jobs/{id}/events", async (string id, EventReport r, AppDb db) =>
        {
            if (!await db.Jobs.AnyAsync(j => j.Id == id)) return Results.NotFound();
            db.JobEvents.Add(new JobEvent { JobId = id, Level = r.Level, Message = r.Message.Length > 4000 ? r.Message[..4000] : r.Message, At = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        g.MapPost("/jobs/{id}/meta", async (string id, MetaReport r, AppDb db) =>
            await db.Jobs.Where(j => j.Id == id).ExecuteUpdateAsync(s => s.SetProperty(j => j.Branch, r.Branch)) == 0 ? Results.NotFound() : Results.Ok());

        // The worker stops at an approval node, saves where to continue and what it carried, and gives the job back.
        g.MapPost("/jobs/{id}/approval", async (string id, ApprovalRequest r, AppDb db) =>
        {
            var job = await db.Jobs.FindAsync(id);
            if (job is null) return Results.NotFound();
            if (job.Status != JobStatus.Running) return Results.Conflict(new { error = "Job is not running.", stop = true });
            job.Status = JobStatus.Approval; job.ResumeNode = r.ResumeNode; job.ContextJson = r.Context.GetRawText();
            db.Approvals.Add(new Approval { JobId = id, NodeId = r.NodeId, Kind = r.Kind, RequestedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        g.MapPost("/jobs/{id}/complete", async (string id, CompleteReport r, AppDb db) =>
        {
            if (r.Status is not (JobStatus.Succeeded or JobStatus.Failed)) return Results.BadRequest(new { error = "status must be succeeded or failed." });
            var job = await db.Jobs.FindAsync(id);
            if (job is null) return Results.NotFound();
            if (JobStatus.IsFinal(job.Status)) return Results.Ok();   // e.g. cancelled while the last node ran: keep that
            job.Status = r.Status; job.FailReason = r.Reason; job.EndedAt = DateTime.UtcNow; job.ResumeNode = null;   // the context stays: the finished job still shows its plan and diff
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        SourcesApi.MapWorker(g);
    }
}
