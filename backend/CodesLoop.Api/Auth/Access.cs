using System.Security.Claims;
using CodesLoop.Api.Data;
using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Auth;

public enum ApprovalDenied { None, NoAccess, OwnJob }

/// <summary>The one place that decides who sees and approves what. Mirrors frontend/src/data/access.ts.</summary>
public static class Access
{
    public static string? AccountId(this ClaimsPrincipal u) => u.FindFirstValue(ClaimTypes.NameIdentifier);

    public static Task<Account?> CurrentAsync(this AppDb db, ClaimsPrincipal u) =>
        db.Accounts.Include(a => a.Projects).FirstOrDefaultAsync(a => a.Id == u.AccountId() && a.Active);

    /// <summary>Projects an account can open: all for an admin, the granted ones for a member, none when deactivated.</summary>
    public static async Task<List<string>> ProjectIdsAsync(this AppDb db, Account a) =>
        !a.Active ? [] : a.IsAdmin ? await db.Projects.Select(p => p.Id).ToListAsync() : a.Projects.Select(p => p.ProjectId).ToList();

    public static async Task<bool> CanSeeAsync(this AppDb db, Account a, string projectId) =>
        (await db.ProjectIdsAsync(a)).Contains(projectId);

    /// <summary>Anyone with access to the project may approve; with "no self-approval" on, the creator may not,
    /// unless nobody else has access (a one-person project would never get approved).</summary>
    public static async Task<ApprovalDenied> ApprovalCheckAsync(this AppDb db, Account a, Job job, RuleSettings rules)
    {
        if (!await db.CanSeeAsync(a, job.ProjectId)) return ApprovalDenied.NoAccess;
        if (!rules.NoSelfApprove || job.CreatedById != a.Id) return ApprovalDenied.None;
        var others = await db.Accounts.Include(x => x.Projects)
            .Where(x => x.Active && x.Id != a.Id && (x.IsAdmin || x.Projects.Any(p => p.ProjectId == job.ProjectId))).AnyAsync();
        return others ? ApprovalDenied.OwnJob : ApprovalDenied.None;
    }
}
