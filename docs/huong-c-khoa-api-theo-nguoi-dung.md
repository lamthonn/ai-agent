# Hướng C: mỗi người dùng khóa API Anthropic của riêng mình

Trạng thái: **đề xuất, chưa làm.** Chờ chủ dự án chốt. Viết ngày 2026-11-06.

## 1. Mục tiêu

Codes Loop là phần mềm phân phối agent cho nhiều người. Mỗi người dùng Claude của chính mình: job của ai chạy bằng thông tin xác thực của người đó, token tính cho người đó, người này không dùng nhờ tài khoản người kia.

## 2. Vì sao chọn khóa API (căn cứ)

Hiện hệ thống có **một** worker dùng **một** đăng nhập Claude Code (gói Pro hoặc Team). Mọi job của mọi người chạy bằng đăng nhập đó.

Tài liệu Agent SDK của Anthropic (trang tổng quan và quickstart) ghi:

> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."

Tài liệu cũng nói dùng SDK để vận hành sản phẩm cho người dùng cuối thì chịu Điều khoản Thương mại của Anthropic.

Suy luận (không phải câu chữ của tài liệu): nền tảng dùng đăng nhập gói của từng người để chạy job thay họ trên server dùng chung có vẻ thuộc diện "cung cấp đăng nhập claude.ai" bị hạn chế. Tài liệu không nói rõ dùng nội bộ có khác không. **Cần hỏi Anthropic hoặc bộ phận pháp lý nếu muốn đi hướng đăng nhập gói.** Khóa API là cách tài liệu chỉ dẫn cho sản phẩm nhiều người dùng.

Nguồn: https://code.claude.com/docs/en/agent-sdk/overview.md, https://code.claude.com/docs/en/agent-sdk/quickstart.md, https://code.claude.com/docs/en/authentication.md

Đánh đổi: tính tiền **theo token API** (Console), không dùng hạn mức gói Pro/Team. Với tài khoản có `ANTHROPIC_API_KEY`, Claude Code luôn dùng khóa đó thay cho đăng nhập gói, kể cả khi đang đăng nhập.

## 3. Hai biến thể

| | C1: server giữ khóa | C2: khóa nằm ở máy chạy worker |
|---|---|---|
| Người dùng làm gì | Dán khóa vào màn Cài đặt → Tài khoản Claude | Đặt `ANTHROPIC_API_KEY` trên máy chạy worker của mình |
| Chạy ở đâu | Worker dùng chung trên server, nhiều job song song | Worker riêng của từng người, trên máy họ |
| Server có thấy khóa | Có (lưu mã hóa) | Không bao giờ |
| Rủi ro | Server bị chiếm là lộ mọi khóa. Khóa đi qua mạng tới worker | Người dùng tự cài worker, máy phải bật |
| Phù hợp | Nhiều người, không muốn cài gì | Ít người, ưu tiên an toàn |

Khuyến nghị: thiết kế để hỗ trợ **cả hai** từ cùng một mô hình dữ liệu. Làm C2 trước vì không phải giữ bí mật của ai.

## 4. Thiết kế

### 4.1 Mô hình dữ liệu (thêm)

- `ClaudeCredential`: `AccountId`, `Kind` (`api-key`), `Ciphertext`, `Last4`, `CreatedAt`, `LastUsedAt`, `Valid`. Một người một khóa đang dùng.
- `Worker`: `Id`, `OwnerId` (`AccountId`, hoặc null nếu worker dùng chung), `Name`, `TokenHash`, `CreatedAt`, `SeenAt`, thông tin heartbeat.
- `Job.RunnerId`: worker được phép chạy job (mặc định: worker của người tạo, hoặc worker dùng chung).
- `Project.AutoRunAsId`: ai là chủ job khi bug tự chạy (đang là "auto", không có chủ nên không có khóa để dùng).

### 4.2 Xác thực worker

Bỏ `Worker:Token` dùng chung. Mỗi worker có mã riêng, sinh trong giao diện, hiện đúng một lần, lưu băm trong DB. Thu hồi được từng cái. Heartbeat, claim, báo kết quả đều gắn vào `Worker.Id`.

### 4.3 Claim job

- Worker của người A chỉ nhận job có `RunnerId` của nó. Job quay lại sau duyệt trở về đúng worker cũ (workspace và branch nằm ở đó).
- Worker dùng chung (C1) nhận job của bất kỳ ai có khóa, truyền khóa của chủ job cho từng job, không dùng chung giữa các job.

### 4.4 Cách khóa tới Claude

- C2: worker đọc `ANTHROPIC_API_KEY` từ môi trường của chính nó. Server không biết khóa.
- C1: phản hồi `claim` kèm khóa đã giải mã của chủ job, **chỉ** qua HTTPS. Worker chuyền khóa vào môi trường của tiến trình Claude của riêng job đó (`ClaudeAgentOptions(env=...)`), không ghi log, không ghi file, bỏ sau khi job dừng.
- Mỗi job dùng `CLAUDE_CONFIG_DIR` riêng để phiên làm việc và trạng thái không lẫn giữa người dùng.

### 4.5 API và giao diện

- `PUT /api/me/claude-key` (dán khóa), `DELETE`, `POST .../test` (gọi thử một request nhỏ để kiểm tra khóa hợp lệ). Không bao giờ trả lại khóa; chỉ trả `last4` và trạng thái.
- `POST /api/workers` (sinh worker mới + mã), `GET /api/workers`, `DELETE /api/workers/{id}`.
- Màn **Cài đặt → Claude của tôi**: dán khóa, thấy `…ab12 · hợp lệ · dùng lần cuối`, nút xóa. Hiện hạn mức token của chính mình.
- Màn quản lý worker: danh sách, trạng thái online/offline, chủ sở hữu, nút tạo mã kết nối và lệnh chạy điền sẵn.
- Chip trên thanh đầu trang: hiện worker và Claude của **người đang đăng nhập**, không phải worker duy nhất.
- Tạo job mà người tạo chưa có khóa và không có worker: chặn ngay với thông báo rõ, thay vì để job nằm hàng đợi.

### 4.6 Hạn mức

Giữ cơ chế token hiện có nhưng tính **theo người** (hạn mức ngày, hạn mức mỗi job). Chi phí lấy từ `total_cost_usd` mà SDK đã trả. Thêm hạn mức tối đa theo từng khóa để một khóa lỗi không đốt hết tiền.

### 4.7 Bỏ quyết định "một worker"

Quyết định cũ "chỉ một worker" nhằm tránh nhiều job song song làm cạn cửa sổ 5 giờ của gói Pro. Với khóa API, giới hạn là rate limit của API, nên cho phép chạy song song. Cần đặt số job song song tối đa mỗi worker (mặc định 1).

## 5. Bảo mật

- Mã hóa khóa khi lưu (AES-GCM, khóa mã hóa nằm ở biến môi trường của `api`, không nằm trong DB). Xoay khóa mã hóa được.
- Không log khóa. Che trong mọi thông báo lỗi và trong nội dung job.
- **Bắt buộc HTTPS** trước khi triển khai C1. Hiện chỉ có HTTP, mật khẩu và token đi rõ chữ, tuyệt đối không gửi khóa API qua kênh này.
- Agent chạy Bash trên máy worker: nếu worker dùng chung (C1), mọi job nằm trên một máy. Cần cô lập từng job (container hoặc sandbox) để job của người A không đọc được môi trường hoặc thư mục của người B. Đây là mốc "sandbox Docker" đã ghi trong CHECKLIST, phải làm trước khi mở C1 cho nhiều người.
- Chỉ admin xem được ai có khóa nào (last4), không ai xem được khóa.
- Prompt injection: nội dung bug, yêu cầu job là dữ liệu không tin cậy; agent có quyền ghi và Bash dưới khóa của người dùng. Giữ các cổng duyệt kế hoạch và duyệt merge.

## 6. Thứ tự làm

1. Worker có danh tính riêng: bảng `Worker`, mã kết nối, bỏ token dùng chung, heartbeat theo worker. Chip hiện worker của mình.
2. Gán job cho worker (`RunnerId`), claim theo chủ, tiếp tục sau duyệt về đúng worker.
3. C2: worker dùng `ANTHROPIC_API_KEY` của máy. Hạn mức token theo người.
4. Giao diện quản lý worker và hướng dẫn kết nối.
5. HTTPS và sandbox từng job.
6. C1: lưu khóa mã hóa, endpoint dán/kiểm tra khóa, worker dùng chung nhận khóa theo job.
7. Bug tự chạy theo project (`AutoRunAsId`).

Ước lượng: bước 1-4 cỡ 2-3 lần phần Bug/Sheet đã làm. Bước 5-6 lớn hơn, phụ thuộc cách chọn sandbox.

## 7. Câu hỏi cần chốt

1. Làm C2, C1 hay cả hai? Ai cần chạy trên server dùng chung?
2. Nền tảng chỉ dùng nội bộ hay phân phối cho khách bên ngoài? Quyết định mức rủi ro điều khoản và yêu cầu HTTPS.
3. Ai trả tiền token API: từng người, từng project hay công ty (một workspace Console, nhiều khóa)?
4. Bug tự chạy tính vào khóa của ai?
5. Có cần giữ nhánh "đăng nhập gói" cho dùng cá nhân của chủ dự án không? Nếu có, tách rõ khỏi chế độ nhiều người dùng.

## 8. Không làm trong hướng này

- Không lưu hay chạy `claude login` của người khác trên server (xem mục 2).
- Không dùng `claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN` thay cho khóa API: đó vẫn là xác thực bằng gói, cùng câu hỏi chính sách.
