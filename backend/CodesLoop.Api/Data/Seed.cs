using System.Text.Json;
using CodesLoop.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace CodesLoop.Api.Data;

public static class Seed
{
    public static async Task RunAsync(AppDb db, IConfiguration cfg, string contentRoot)
    {
        await db.Database.EnsureCreatedAsync();   // prototype: migrations come with the PostgreSQL deployment
        if (await db.Accounts.AnyAsync()) return;

        var password = cfg["Seed:Password"] ?? throw new InvalidOperationException("Set Seed:Password to create the first accounts.");
        var hasher = new PasswordHasher<Account>();
        Account A(string id, string name, string email, bool admin, params string[] projects)
        {
            var a = new Account { Id = id, Name = name, Email = email, IsAdmin = admin, Projects = projects.Select(p => new ProjectMember { AccountId = id, ProjectId = p }).ToList() };
            a.PasswordHash = hasher.HashPassword(a, password);
            return a;
        }
        db.Accounts.AddRange(
            A("ma", "Nguyễn Minh Anh", "minhanh@codes.tech", true),
            A("tq", "Trần Quốc Huy", "quochuy@codes.tech", false, "qlkho"),
            A("lt", "Lê Thu Trang", "thutrang@codes.tech", false, "web"));

        db.Projects.AddRange(
            new Project { Id = "qlkho", Name = "QLKho", Repo = "https://github.com/AnhN-V/QuanLyKhoSolution.git", BaseBranch = "system_test", Stack = "ASP.NET Core 8", BuildCommand = "dotnet build", TestCommand = "dotnet test" },
            new Project { Id = "web", Name = "CongThongTin-Web", Repo = "git.codes.tech/web/CongThongTin-Web.git", BaseBranch = "main", Stack = "React 18 + Vite", BuildCommand = "npm run build", TestCommand = "npm test -- --run" });

        AgentDef Ag(string id, string name, string model, string perm, int turns, string[] tools, string prompt) =>
            new() { Id = id, Name = name, Model = model, Permission = perm, MaxTurns = turns, ToolsJson = JsonSerializer.Serialize(tools), Prompt = prompt };
        db.Agents.AddRange(
            Ag("requirement-analyzer", "Requirement Analyzer", "claude-sonnet-5-5", "read", 20, ["Read", "Grep", "Glob"], "Bạn phân tích tài liệu yêu cầu cho một job lập trình.\n- Liệt kê mục tiêu, phạm vi, tiêu chí nghiệm thu.\n- Ghi lại điểm chưa rõ thành câu hỏi cho người duyệt.\n- Không sửa file nào."),
            Ag("architect", "Architect", "claude-opus-5-5", "read", 30, ["Read", "Grep", "Glob"], "Bạn lập kế hoạch triển khai dựa trên phân tích yêu cầu và codebase.\n- Nêu các file dự kiến thay đổi và lý do.\n- Chia bước nhỏ, mỗi bước kiểm chứng được.\n- Nêu rủi ro và phần cần người duyệt."),
            Ag("coder", "Coding Agent", "claude-sonnet-5-5", "write", 60, ["Read", "Edit", "Write", "Grep", "Glob", "Bash"], "Bạn thực hiện kế hoạch đã được duyệt trên branch của job.\n- Tuân thủ convention hiện có của repository.\n- Viết hoặc cập nhật test cho hành vi mới.\n- Không chạm vào file ngoài kế hoạch."),
            Ag("fixer", "Fix Agent", "claude-sonnet-5-5", "write", 30, ["Read", "Edit", "Grep", "Bash"], "Bạn sửa lỗi từ kết quả build/test hoặc review.\n- Tìm nguyên nhân trước khi sửa.\n- Mỗi vòng chỉ sửa những gì lỗi chỉ ra.\n- Không sửa test để test qua."),
            Ag("code-reviewer", "Code Reviewer", "claude-opus-5-5", "read", 20, ["Read", "Grep", "Glob"], "Bạn review Git diff của job.\n- Tìm bug, lỗ hổng bảo mật, thay đổi ngoài phạm vi.\n- Kết luận Đạt hoặc Không đạt kèm lý do.\n- Dòng cuối cùng của câu trả lời PHẢI là `VERDICT: pass` hoặc `VERDICT: fail`."));

        var names = new Dictionary<string, (string vi, string en)> {
            ["ai-coding"] = ("AI Coding đầy đủ", "Full AI coding"), ["quick-fix"] = ("Sửa lỗi nhanh", "Quick fix") };
        foreach (var file in Directory.GetFiles(Path.Combine(contentRoot, "Seed", "workflows"), "*.json"))
        {
            var json = await File.ReadAllTextAsync(file);
            var doc = JsonDocument.Parse(json).RootElement;
            var id = doc.GetProperty("id").GetString()!;
            var (vi, en) = names.GetValueOrDefault(id, (id, id));
            db.Workflows.Add(new Workflow { Id = id, NameVi = vi, NameEn = en, Versions = [new WorkflowVersion {
                Version = doc.GetProperty("version").GetInt32(), DefinitionJson = json, Note = "Bản đầu tiên", CreatedById = "ma", CreatedAt = DateTime.UtcNow }] });
        }
        await db.SaveChangesAsync();
    }
}
