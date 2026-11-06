namespace CodesLoop.Api.Domain;

public static class JobStatus
{
    public const string Queued = "queued", Running = "running", Approval = "approval",
        Succeeded = "succeeded", Failed = "failed", Cancelled = "cancelled";
    public static bool IsFinal(string s) => s is Succeeded or Failed or Cancelled;
}

public class Account
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool IsAdmin { get; set; }
    public bool Active { get; set; } = true;
    public List<ProjectMember> Projects { get; set; } = [];
}

public class ProjectMember
{
    public string AccountId { get; set; } = "";
    public string ProjectId { get; set; } = "";
}

public class Project
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Repo { get; set; } = "";
    public string BaseBranch { get; set; } = "main";
    public string Stack { get; set; } = "";
    public string BuildCommand { get; set; } = "";
    public string TestCommand { get; set; } = "";
    public string DefaultWorkflowId { get; set; } = "ai-coding";
}

public class AgentDef
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Model { get; set; } = "";
    public int MaxTurns { get; set; }
    public string Permission { get; set; } = "read";   // read | write | test
    public string ToolsJson { get; set; } = "[]";
    public string Prompt { get; set; } = "";
}

public class Workflow
{
    public string Id { get; set; } = "";
    public string NameVi { get; set; } = "";
    public string NameEn { get; set; } = "";
    public List<WorkflowVersion> Versions { get; set; } = [];
}

/// <summary>Append-only: a saved version is never edited, so a job keeps the flow it started with.</summary>
public class WorkflowVersion
{
    public int Id { get; set; }
    public string WorkflowId { get; set; } = "";
    public int Version { get; set; }
    public string DefinitionJson { get; set; } = "";
    public string Note { get; set; } = "";
    public string CreatedById { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public class Job
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string ProjectId { get; set; } = "";
    public string WorkflowId { get; set; } = "";
    public int WorkflowVersion { get; set; }
    public string CreatedById { get; set; } = "";
    public string Status { get; set; } = JobStatus.Queued;
    public string Requirement { get; set; } = "";
    public string? Branch { get; set; }
    public long? TokenLimit { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? FailReason { get; set; }
    /// <summary>Where the worker continues after an approval, and the data it carried (JSON).</summary>
    public string? ResumeNode { get; set; }
    public string? ContextJson { get; set; }
    public List<JobStep> Steps { get; set; } = [];
}

public class JobStep
{
    public int Id { get; set; }
    public string JobId { get; set; } = "";
    public string NodeId { get; set; } = "";
    public string Outcome { get; set; } = "done";
    public long Tokens { get; set; }
    public double Cost { get; set; }
    public string Note { get; set; } = "";
    public DateTime At { get; set; }
}

public class JobEvent
{
    public long Id { get; set; }
    public string JobId { get; set; } = "";
    public string Level { get; set; } = "info";
    public string Message { get; set; } = "";
    public DateTime At { get; set; }
}

public class Approval
{
    public int Id { get; set; }
    public string JobId { get; set; } = "";
    public string NodeId { get; set; } = "";
    public string Kind { get; set; } = "merge";          // plan | merge
    public string Status { get; set; } = "pending";      // pending | approved | rejected
    public DateTime RequestedAt { get; set; }
    public string? DecidedById { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? Note { get; set; }
}

public class Setting
{
    public string Key { get; set; } = "";
    public string Json { get; set; } = "{}";
}

/// <summary>Limits are kept in tokens; the unit (usd/tokens) is only how the screens show them.</summary>
public record BudgetSettings(bool Enabled = true, string Unit = "usd", long DailyTokens = 277_778, long PerJobTokens = 138_889,
    double WarnAt = 0.8, string Action = "queue", string Notify = "");

public record RuleSettings(bool NoSelfApprove = true);

/// <summary>A Google Sheet linked to a project: the bug file (kind "bug") or the test-case file (kind "case").</summary>
public class SourceLink
{
    public string ProjectId { get; set; } = "";
    public string Kind { get; set; } = "bug";
    public string Url { get; set; } = "";
    public string Tab { get; set; } = "Sheet1";
    public string ColumnsJson { get; set; } = "{}";     // field -> column letter
    public string Filter { get; set; } = "";             // bug file only, e.g. "Trạng thái = Mới"
    public string Mode { get; set; } = "suggest";        // suggest | auto
    public string AutoWorkflow { get; set; } = "quick-fix";
    public int MaxPerDay { get; set; } = 1;
    public bool WriteBack { get; set; } = true;
    public DateTime? LastSyncAt { get; set; }
    public DateTime? SyncRequestedAt { get; set; }
    public string? LastError { get; set; }
}

/// <summary>One row of the bug file, matched by Key (the Bug ID column) so a bug never becomes two jobs.</summary>
public class BugRow
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string Key { get; set; } = "";
    public int Row { get; set; }
    public string Title { get; set; } = "";
    public string Steps { get; set; } = "";
    public string Severity { get; set; } = "";
    public string Reporter { get; set; } = "";
    public string SheetStatus { get; set; } = "";
    public string Triage { get; set; } = "new";          // new | ready | need-info | duplicate | job
    public string? Workflow { get; set; }
    public string? Note { get; set; }
    public string? JobId { get; set; }
    public string? Written { get; set; }                 // last text the worker wrote into the status cell
    public DateTime CreatedAt { get; set; }
}

public class CaseRow
{
    public int Id { get; set; }
    public string ProjectId { get; set; } = "";
    public string Key { get; set; } = "";
    public string Module { get; set; } = "";
    public string Title { get; set; } = "";
    public string Steps { get; set; } = "";
    public string Expected { get; set; } = "";
}
