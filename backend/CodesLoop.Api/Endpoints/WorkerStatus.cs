using System.Security.Claims;
using CodesLoop.Api.Auth;
using CodesLoop.Api.Data;
using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Endpoints;

public record WorkerHeartbeat(string Host, string? Version, bool ClaudeInstalled, bool ClaudeLoggedIn, string? ClaudeVersion, string? ClaudeEmail, string? ClaudeOrg, string? ClaudePlan,
    string? ClaudeError, string? CurrentJob, bool GoogleKey);
public record WorkerSeen(WorkerHeartbeat Info, DateTime SeenAt);

/// <summary>"Is a worker connected, and to which Claude?" The worker reports every few seconds; the server only remembers the latest report (one worker by design).</summary>
public static class WorkerStatus
{
    public static readonly TimeSpan OnlineWithin = TimeSpan.FromSeconds(45);

    public static void MapWorker(RouteGroupBuilder g) =>
        g.MapPost("/worker/heartbeat", async (WorkerHeartbeat r, AppDb db) =>
        {
            await db.SetAsync("worker", new WorkerSeen(r with { Host = r.Host.Length > 100 ? r.Host[..100] : r.Host }, DateTime.UtcNow));
            return Results.Ok();
        });

    public static void Map(RouteGroupBuilder api) =>
        api.MapGet("/worker", async (AppDb db, ClaimsPrincipal u) =>
        {
            var w = await db.GetAsync<WorkerSeen?>("worker", null);
            var admin = await db.CurrentAsync(u) is { IsAdmin: true };
            if (w is not null && !admin) w = w with { Info = w.Info with { Host = "", ClaudeEmail = null, ClaudeOrg = null, ClaudeVersion = null, Version = null } };   // who owns the login is for admins only
            var running = await db.Jobs.CountAsync(j => j.Status == JobStatus.Running);
            return Results.Ok(new { online = w is not null && DateTime.UtcNow - w.SeenAt <= OnlineWithin, seenAt = w?.SeenAt, info = w?.Info, runningJobs = running });
        });
}
