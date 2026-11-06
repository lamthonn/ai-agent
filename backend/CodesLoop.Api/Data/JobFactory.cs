using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Data;

public static class JobFactory
{
    /// <summary>Queues a job on the latest version of the workflow (the project's default when none is named). Null when the workflow does not exist.</summary>
    public static async Task<Job?> CreateAsync(AppDb db, string projectId, string? workflowId, string title, string requirement, long? tokenLimit, string createdById)
    {
        var project = await db.Projects.FindAsync(projectId);
        var wf = await db.Workflows.Include(w => w.Versions).FirstOrDefaultAsync(w => w.Id == (workflowId ?? project!.DefaultWorkflowId));
        if (wf is null) return null;
        var last = (await db.Jobs.Select(x => x.Id).ToListAsync()).Select(x => int.TryParse(x.AsSpan(4), out var n) ? n : 0).DefaultIfEmpty(0).Max();
        var job = new Job { Id = $"JOB-{last + 1:0000}", Title = title.Trim(), ProjectId = projectId, WorkflowId = wf.Id, WorkflowVersion = wf.Versions.Max(v => v.Version),
            CreatedById = createdById, Requirement = requirement, TokenLimit = tokenLimit, CreatedAt = DateTime.UtcNow };
        db.Jobs.Add(job);
        await db.SaveChangesAsync();
        return job;
    }
}
