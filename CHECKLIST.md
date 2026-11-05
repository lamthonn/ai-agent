# Checklist

`[x]` xong · `[ ]` chưa làm. Muốn sửa giao diện: ghi mã mục (VD: `G3`) + điều muốn đổi.

## A. Giao diện đã dựng (`frontend/`, dữ liệu mẫu)

- [x] A1. Tổng quan: việc cần xử lý, sandbox, job đang chạy, KPI 7 ngày, biểu đồ
- [x] A2. Jobs: tab trạng thái, tìm kiếm, lọc project, form Tạo job
- [x] A3. Chi tiết job: tiến trình, log, diff, test, thông tin, artifact
- [x] A4. Chờ duyệt: duyệt kế hoạch / merge, yêu cầu sửa, từ chối
- [x] A5. Workflow Builder: kéo thả node, nối cạnh, sửa thuộc tính, kiểm tra, xem JSON
- [x] A6. Agents: model, công cụ, system prompt
- [x] A7. Projects · A8. Giám sát · A9. Cài đặt
- [x] A10. Mobile / tablet

## B. Frontend còn thiếu

- [ ] B1. Gọi API thật thay `src/data/sample.ts`
- [ ] B2. Đăng nhập, phân quyền (người duyệt / người tạo job)
- [ ] B3. Log realtime qua SignalR
- [ ] B4. Trạng thái loading / lỗi khi gọi API
- [ ] B5. Builder: lưu phiên bản, chạy thử thật, tô trạng thái node khi job chạy
- [ ] B6. Tìm kiếm toàn cục (ô trên top bar)
- [ ] B7. Tách bundle (hiện ~1,4 MB)
- [ ] B8. Test E2E bằng Playwright

## C. Backend & runtime (theo roadmap)

- [ ] C1. Agent runtime Python: chạy 1 job trên 1 repo (Phase 1)
- [ ] C2. Multi-agent: phân tích, kế hoạch, code, test, review, sửa (Phase 2)
- [ ] C3. API ASP.NET Core + PostgreSQL: project, job, workflow, approval (Phase 3)
- [ ] C4. Docker sandbox + hàng đợi (Phase 5)
- [ ] C5. Giám sát: chi phí, token, chất lượng (Phase 6)

## D. Cần bạn chốt

- [ ] D1. Tên sản phẩm (đang dùng "Agent Platform") và logo
- [ ] D2. Giữ tiếng Việt hay song ngữ
- [ ] D3. Ai được duyệt kế hoạch / merge
- [ ] D4. Hạn mức chi phí mỗi ngày
