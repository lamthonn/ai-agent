# Checklist

`[x]` xong · `[ ]` chưa làm. Muốn sửa giao diện: ghi mã mục (VD: `A5`) + điều muốn đổi.

## A. Giao diện đã dựng (`frontend/`, dữ liệu mẫu)

- [x] A1. Tổng quan: việc cần xử lý, chi phí hôm nay, job đang chạy, KPI 7 ngày, biểu đồ, sandbox
- [x] A2. Jobs: tab trạng thái, tìm kiếm, lọc project/workflow, form Tạo job
- [x] A3. Chi tiết job: tiến trình, log, diff, test, thông tin, artifact
- [x] A4. Chờ duyệt: duyệt kế hoạch / merge, yêu cầu sửa, từ chối
- [x] A5. Workflow Builder: kéo thả, nối cạnh, thuộc tính, kiểm tra, JSON
- [x] A6. Agents: model, công cụ, system prompt
- [x] A7. Projects · A8. Giám sát · A9. Cài đặt
- [x] A10. Mobile / tablet
- [x] A11. Nhiều workflow: danh sách, phiên bản (xem bản cũ chỉ đọc), mặc định theo project, chọn khi tạo job, job giữ đúng phiên bản
- [x] A12. Thương hiệu Codes Tech: logo, favicon, màu, font; tên sản phẩm **Codes Loop**
- [x] A13. Song ngữ Việt / Anh (nút VI | EN, nhớ lựa chọn, `?lang=en`)
- [x] A14. Hạn mức chi phí: theo ngày, theo job, theo project, ngưỡng cảnh báo, hành động khi chạm mức, email

## B. Frontend còn thiếu

- [ ] B1. Gọi API thật thay `src/data/sample.ts`
- [ ] B2. Đăng nhập, phân quyền (người duyệt / người tạo job)
- [ ] B3. Log realtime qua SignalR
- [ ] B4. Trạng thái loading / lỗi khi gọi API
- [ ] B5. Builder: lưu phiên bản thật, chạy thử, tô trạng thái node khi job chạy
- [ ] B6. Tìm kiếm toàn cục (ô trên top bar)
- [ ] B7. Tách bundle (hiện ~1,4 MB)
- [ ] B8. Test E2E bằng Playwright
- [ ] B9. Dịch nội dung do người dùng nhập (tên node, log, kế hoạch) — hiện giữ nguyên tiếng Việt

## C. Backend & runtime (theo roadmap)

- [ ] C1. Agent runtime Python: chạy 1 job trên 1 repo (Phase 1)
- [ ] C2. Multi-agent: phân tích, kế hoạch, code, test, review, sửa (Phase 2)
- [ ] C3. API ASP.NET Core + PostgreSQL: project, job, workflow có phiên bản, approval (Phase 3)
- [ ] C4. Docker sandbox + hàng đợi (Phase 5)
- [ ] C5. Giám sát: chi phí, token, chất lượng (Phase 6)
- [ ] C6. Áp hạn mức chi phí ở worker: kiểm tra trước khi chạy job và giữa các node

## D. Cần bạn chốt

- [x] D1. Tên sản phẩm: Codes Loop · logo Codes Tech
- [x] D2. Song ngữ
- [ ] D3. Ai được duyệt kế hoạch / merge
- [ ] D4. Con số hạn mức thật (đang để mẫu: $25/ngày, $4/job)
