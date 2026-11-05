# Kế hoạch coding backend — Codes Loop

Bám theo [roadmap](../ai-agent-platform-roadmap.md) và giao diện đã dựng ở `frontend/`. Mã `C1…`, `B1…`, `E1…` là mục trong [CHECKLIST.md](../CHECKLIST.md).

## 1. Kiến trúc chốt cho bản đầu

```
React (frontend/) ──HTTP + SignalR──> API ASP.NET Core 8 ──EF Core──> PostgreSQL
                                          ▲  (chủ duy nhất của DB)
                                          │ HTTP nội bộ (/internal, token worker)
                                          │
                                   Worker Python (agent-runtime/)
                                     ├─ chạy workflow JSON từng node
                                     ├─ Claude Agent SDK
                                     ├─ Docker sandbox mỗi job
                                     └─ đọc/ghi Google Sheet (E1, E2)
```

Lựa chọn và lý do:

| Việc | Chọn | Lý do |
|---|---|---|
| Hàng đợi job | Bảng `jobs` trong PostgreSQL, worker nhận job qua API (`FOR UPDATE SKIP LOCKED`) | Không thêm RabbitMQ/Temporal khi mới 1–2 worker (roadmap 5.1). Đổi sau nếu cần. |
| Ai giữ trạng thái workflow | Worker chạy, API lưu từng bước (`job_steps`) | Worker chết thì job tiếp tục từ bước cuối đã lưu. Duyệt = dừng, ghi trạng thái, giải phóng worker; duyệt xong job vào lại hàng đợi. |
| Worker nói chuyện với DB | Chỉ qua API nội bộ | Một nơi giữ schema, phân quyền và hạn mức. |
| Log realtime | Worker gửi sự kiện → API lưu `job_events` + đẩy SignalR | Khớp B3. |
| Định nghĩa workflow | JSON đúng như nút JSON trong Builder, mỗi phiên bản một dòng bất biến | Job giữ đúng phiên bản (A11). |

## 2. Cấu trúc repo

```
backend/        ASP.NET Core 8: CodesLoop.Api, CodesLoop.Domain, CodesLoop.Infrastructure (EF Core), tests/
agent-runtime/  Python 3.12: runtime/ (executor, nodes/), agents/ (prompt), tools/ (git, sheets), worker.py, cli.py, tests/
infrastructure/ docker/ (ảnh sandbox dotnet8, node20 + Playwright), docker-compose.yml (postgres, api, worker)
docs/           tài liệu này, schema workflow JSON
```

## 3. Bảng dữ liệu

Mở rộng schema roadmap mục Phase 3 theo những gì giao diện đã cần:

- `accounts` (role admin/member, active) · `project_members` (account, project) — A15, C7
- `projects` (repo, branch gốc, lệnh build/test/run, workflow mặc định)
- `agents` (model, công cụ, max turns, system prompt)
- `workflows` · `workflow_versions` (version, definition_json, ghi chú, người lưu) — không sửa, chỉ thêm
- `jobs` (project, workflow + version, người tạo, trạng thái, branch, yêu cầu, hạn mức riêng)
- `job_steps` (node, trạng thái, phút, số vòng sửa, token, chi phí) · `job_events` (log) · `artifacts` (diff, báo cáo, ảnh chụp test)
- `approvals` (job, node, loại, người duyệt, quyết định, ghi chú)
- `settings`: hạn mức (đơn vị usd/token, ngày, job, project, ngưỡng, hành động), luật duyệt (`noSelfApprove`)
- `sheet_sources` (project, loại bug/test case, link, tab, ghép cột, lọc, chế độ, workflow tự chạy, max/ngày, ghi ngược)
- `bug_items` (mã bug, dòng, nội dung, kết quả phân loại, job) · `test_cases` · `test_runs` / `test_results`
- `audit_log` (ai làm gì: duyệt, cấp quyền, đổi hạn mức)

## 4. Các mốc

Mỗi mốc có điều kiện "xong khi" kiểm chứng được. Làm theo thứ tự; mốc 1–2 không cần API.

### Mốc 1 — Runtime chạy 1 job trên máy (C1) · ~1 tuần
- `python -m runtime run --repo <đường dẫn> --req yeu-cau.md --workflow ai-coding.json`
- Node: agent (Claude Agent SDK, công cụ + quyền theo agent), command/test, condition, git (branch, diff, commit), approval (hỏi trên terminal), end.
- Đếm token/chi phí từ kết quả SDK cho từng node; dừng khi chạm hạn mức job (C6, phần job).
- **Xong khi:** chạy trên một repo thử, ra branch mới + diff + báo cáo Markdown; branch gốc không đổi; vòng sửa dừng đúng `maxLoops`.

### Mốc 2 — Đủ các agent và workflow mẫu (C2) · ~1 tuần
- Prompt 7 agent như màn Agents; 4 workflow mẫu (AI Coding v3, Sửa lỗi nhanh, Chỉ review, Kiểm thử theo test case).
- Test của runtime: executor đi đúng nhánh condition, dừng ở approval, giới hạn vòng lặp (dùng agent giả, không gọi Claude).
- **Xong khi:** cả 4 workflow chạy được bằng CLI; test runtime chạy không tốn token.

### Mốc 3 — API + PostgreSQL (C3, C7) · ~1,5 tuần
- Endpoint theo màn hình: `projects`, `jobs` (lọc, tạo, hủy, chi tiết + steps/events/artifacts), `approvals` (duyệt / yêu cầu sửa / từ chối), `workflows` (+ `versions`, lưu phiên bản mới, kiểm tra hợp lệ giống Builder), `agents`, `accounts` + `members`, `settings/budget`, `settings/rules`, `monitoring/summary`.
- Đăng nhập: email + mật khẩu, JWT (B10); SSO để sau.
- Phân quyền ở một chỗ: mọi truy vấn lọc theo project của tài khoản; duyệt dùng đúng luật như `approvalCheck` ở frontend (có quyền project, không tự duyệt nếu còn người khác).
- API nội bộ cho worker: nhận job, báo bước, gửi log, xin duyệt, nộp artifact.
- **Xong khi:** test tích hợp (Testcontainers PostgreSQL) chứng minh member không đọc được job project khác, người tạo không tự duyệt được, phiên bản workflow cũ không sửa được.

### Mốc 4 — Worker nối API, hạn mức, realtime (C6, B1, B3, B4) · ~1 tuần
- Worker lặp: nhận job → chạy → báo bước; dừng ở approval và trả job về; nhận lại khi đã duyệt.
- Hạn mức: kiểm tra trước khi nhận job và trước mỗi node (ngày, project, job; USD hoặc token); hết thì xếp hàng / tạm dừng / cảnh báo theo cài đặt.
- Frontend: thay `src/data/*.ts` bằng gọi API (giữ nguyên kiểu dữ liệu), thêm loading/lỗi, log qua SignalR.
- **Xong khi:** tạo job trên giao diện → thấy tiến trình chạy thật → duyệt merge trên giao diện → job xong; đặt hạn mức thấp thì job mới vào hàng đợi.

### Mốc 5 — Docker sandbox (C4) · ~1 tuần
- Mỗi job một container: không `--privileged`, không mount Docker socket, giới hạn CPU/RAM/thời gian, mạng chặn mặc định trừ Claude API và registry package cho phép.
- Ảnh: `agent-sandbox:dotnet8`, `agent-sandbox:node20` (có Playwright cho E2).
- Push branch bằng token ngắn hạn do worker cấp, không để credential trong container.
- **Xong khi:** 2 job chạy song song ở 2 container; màn Giám sát thấy đúng trạng thái sandbox.

### Mốc 6 — File bug và test case (E1, E2) · ~1 tuần
- Đọc Google Sheet qua service account (Excel: Microsoft Graph, làm sau nếu cần); 10 phút/lần; nhận dòng theo Mã bug.
- Agent phân loại (Haiku): đủ thông tin / thiếu / trùng → chọn workflow. Chế độ Chỉ đề xuất hoặc Tự chạy (giới hạn job/ngày + hạn mức).
- Ghi ngược trạng thái + link job vào sheet.
- Workflow Kiểm thử: chạy app trong sandbox, agent Test Case Runner chạy từng ca bằng Playwright, chạy lại ca lỗi 1 lần, ca lỗi thật thành dòng mới trong file bug. Không sửa code, không viết test.
- Nội dung sheet là dữ liệu không tin cậy: agent phân loại không có công cụ nào, chỉ trả JSON.
- **Xong khi:** thêm 1 dòng bug vào sheet thật → sau ≤10 phút thấy trong màn Bug, bấm Chạy ra job; chạy bộ test case → ca lỗi xuất hiện trong file bug.

### Mốc 7 — Giám sát và chất lượng (C5) · liên tục
- Số liệu màn Giám sát lấy từ `job_steps`; cảnh báo email khi chạm ngưỡng hạn mức; đánh giá chất lượng job sau merge (roadmap Phase 6).

## 5. Cần bạn chốt trước mốc 1

1. **D7 — Xác thực Claude.** Agent SDK chạy trong backend nên dùng **API key** (trả theo token). Gói Pro $20/tháng dùng cho Claude Code cá nhân; tài liệu Agent SDK hướng dẫn xác thực bằng API key, và roadmap (3.2, 5.4) cũng khuyên không dựa vào một phiên đăng nhập Pro cho worker. Mình đề xuất: tạo API key riêng, đặt hạn mức chi tiêu ở Console, giữ $1/ngày trong app.
2. **Máy chạy worker:** máy Windows có Docker Desktop hay một máy chủ Linux?
3. **Git server** `git.codes.tech` là GitLab, Gitea hay khác? (để tạo branch, push, mở merge request)
4. **Repo thử cho mốc 1:** một repo không quan trọng (bản sao QLKho?).
5. **File bug và file test case mẫu** (bạn gửi) để chốt ghép cột ở mốc 6.
