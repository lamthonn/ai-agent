using CodesLoop.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Data;

public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<AgentDef> Agents => Set<AgentDef>();
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<WorkflowVersion> WorkflowVersions => Set<WorkflowVersion>();
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<JobStep> JobSteps => Set<JobStep>();
    public DbSet<JobEvent> JobEvents => Set<JobEvent>();
    public DbSet<Approval> Approvals => Set<Approval>();
    public DbSet<Setting> Settings => Set<Setting>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Account>().HasIndex(a => a.Email).IsUnique();
        b.Entity<ProjectMember>().HasKey(m => new { m.AccountId, m.ProjectId });
        b.Entity<Account>().HasMany(a => a.Projects).WithOne().HasForeignKey(m => m.AccountId);
        b.Entity<WorkflowVersion>().HasIndex(v => new { v.WorkflowId, v.Version }).IsUnique();
        b.Entity<Workflow>().HasMany(w => w.Versions).WithOne().HasForeignKey(v => v.WorkflowId);
        b.Entity<Job>().HasMany(j => j.Steps).WithOne().HasForeignKey(s => s.JobId);
        b.Entity<Job>().HasIndex(j => new { j.Status, j.CreatedAt });
        b.Entity<JobEvent>().HasIndex(e => new { e.JobId, e.Id });
        b.Entity<Setting>().HasKey(s => s.Key);
    }
}
