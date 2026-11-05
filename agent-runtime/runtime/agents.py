"""Agent settings, mirroring the Agents screen. Read-only agents get no write tools; Bash is limited to patterns."""
from dataclasses import dataclass


@dataclass(frozen=True)
class AgentSpec:
    id: str
    model: str
    tools: tuple[str, ...]
    max_turns: int
    prompt: str
    writes: bool = False


# Bash patterns the coder and fixer may run on the machine (no sandbox yet; Docker comes in milestone 5).
SAFE_BASH = ("Bash(dotnet build:*)", "Bash(dotnet test:*)", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)")

AGENTS: dict[str, AgentSpec] = {a.id: a for a in [
    AgentSpec("requirement-analyzer", "claude-sonnet-5-5", ("Read", "Grep", "Glob"), 20,
              "Bạn phân tích tài liệu yêu cầu cho một job lập trình.\n- Liệt kê mục tiêu, phạm vi, tiêu chí nghiệm thu.\n"
              "- Ghi lại điểm chưa rõ thành câu hỏi cho người duyệt.\n- Không sửa file nào."),
    AgentSpec("architect", "claude-opus-5-5", ("Read", "Grep", "Glob"), 30,
              "Bạn lập kế hoạch triển khai dựa trên phân tích yêu cầu và codebase.\n- Nêu các file dự kiến thay đổi và lý do.\n"
              "- Chia bước nhỏ, mỗi bước kiểm chứng được.\n- Nêu rủi ro và phần cần người duyệt."),
    AgentSpec("coder", "claude-sonnet-5-5", ("Read", "Edit", "Write", "Grep", "Glob") + SAFE_BASH, 60,
              "Bạn thực hiện kế hoạch đã được duyệt trên branch của job.\n- Tuân thủ convention hiện có của repository.\n"
              "- Viết hoặc cập nhật test cho hành vi mới.\n- Không chạm vào file ngoài kế hoạch.", writes=True),
    AgentSpec("fixer", "claude-sonnet-5-5", ("Read", "Edit", "Grep") + SAFE_BASH, 30,
              "Bạn sửa lỗi từ kết quả build/test hoặc review.\n- Tìm nguyên nhân trước khi sửa.\n"
              "- Mỗi vòng chỉ sửa những gì lỗi chỉ ra.\n- Không sửa test để test qua.", writes=True),
    AgentSpec("code-reviewer", "claude-opus-5-5", ("Read", "Grep", "Glob"), 20,
              "Bạn review Git diff của job.\n- Tìm bug, lỗ hổng bảo mật, thay đổi ngoài phạm vi.\n"
              "- Kết luận Đạt hoặc Không đạt kèm lý do.\n- Dòng cuối cùng của câu trả lời PHẢI là `VERDICT: pass` hoặc `VERDICT: fail`."),
]}
