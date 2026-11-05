# Codes Loop

Nền tảng AI Agent Engineering của Codes Tech: chạy AI coding agent (Claude) trên repository theo workflow: phân tích → kế hoạch → duyệt → code → build & test → sửa lỗi → review → duyệt merge.

- Kiến trúc và roadmap: [ai-agent-platform-roadmap.md](ai-agent-platform-roadmap.md)
- Việc cần làm: [CHECKLIST.md](CHECKLIST.md)

## Frontend (prototype giao diện)

React 19 + Vite + TypeScript + Ant Design 6 + React Flow. Song ngữ Việt/Anh (`?lang=en`). Đã nối backend: đăng nhập, jobs, chờ duyệt, projects, agents, workflows, hạn mức, thành viên (`frontend/src/data/live.ts`). Tổng quan/Giám sát, Bug & test case và vài mục trong Cài đặt vẫn dữ liệu mẫu. Cần chạy backend trước (xem `backend/README.md`); `npm run dev` chuyển `/api` tới `http://localhost:5099` (đổi bằng biến `API_TARGET`).

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
| Jobs / chi tiết job | `#/jobs`, `#/jobs/JOB-0149` |
| Chờ duyệt | `#/approvals` |
| Workflows / Builder | `#/workflows`, `#/workflows/ai-coding?v=2` |
| Agents · Projects · Giám sát | `#/agents`, `#/projects`, `#/monitoring` |
| Bug & test case | `#/sources/bugs`, `#/sources/cases`, `#/sources/links` |
| Cài đặt (hạn mức chi phí) | `#/settings/budget` |

Logo và màu lấy từ bộ nhận diện Codes Tech (`codes-tech-brand-assets.zip`), favicon trong `frontend/public/brand/`.

## Công cụ cho Claude Code trong repo

- `.claude/skills/design-taste-frontend`: [taste-skill](https://github.com/Leonxlnx/taste-skill), hướng dẫn và kiểm tra giao diện.
- `.claude/agents/*`, `.claude/skills/*` khác: chọn lọc từ [ECC](https://github.com/affaan-m/ECC) v2.2.3 (MIT, xem `.claude/ECC-LICENSE`). Không cài hooks.
