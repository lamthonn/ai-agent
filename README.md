# AI Agent Engineering Platform

Nền tảng chạy AI coding agent (Claude) trên repository theo workflow: phân tích → kế hoạch → duyệt → code → build & test → sửa lỗi → review → duyệt merge.

- Kiến trúc và roadmap: [ai-agent-platform-roadmap.md](ai-agent-platform-roadmap.md)
- Việc cần làm: [CHECKLIST.md](CHECKLIST.md)

## Frontend (prototype giao diện)

React 19 + Vite + TypeScript + Ant Design 6 + React Flow. Dữ liệu mẫu nằm trong `frontend/src/data/sample.ts`, chưa nối backend.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + build ra dist/
```

Cần Node 20.19+ (khuyến nghị Node 22 hoặc 24).

| Màn | Route |
| --- | --- |
| Tổng quan | `#/` |
| Jobs / chi tiết job | `#/jobs`, `#/jobs/JOB-0148` |
| Chờ duyệt | `#/approvals` |
| Workflow Builder | `#/workflows` |
| Agents · Projects · Giám sát · Cài đặt | `#/agents`, `#/projects`, `#/monitoring`, `#/settings` |

## Công cụ cho Claude Code trong repo

- `.claude/skills/design-taste-frontend`: [taste-skill](https://github.com/Leonxlnx/taste-skill), hướng dẫn và kiểm tra giao diện.
- `.claude/agents/*`, `.claude/skills/*` khác: chọn lọc từ [ECC](https://github.com/affaan-m/ECC) v2.2.3 (MIT, xem `.claude/ECC-LICENSE`). Không cài hooks.
