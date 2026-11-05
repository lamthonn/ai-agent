# Thêm unit test cho NgayTuongLaiHelper

Hàm `NgayTuongLaiHelper.KiemTra` trong `QLKho.Application/Helpers/NgayTuongLaiHelper.cs` chưa có test nào.

## Việc cần làm
Thêm một file test mới `QLKho.Application.Tests/Helpers/NgayTuongLaiHelperTests.cs` (xUnit + FluentAssertions, theo kiểu các test sẵn có như `CongNoVay/CongNoHelpperTests.cs`) kiểm tra các trường hợp:

1. `ngayMoi` là null → không ném lỗi.
2. `ngayMoi` là hôm nay hoặc ngày trong quá khứ → không ném lỗi.
3. `ngayMoi` là ngày mai (tương lai) và không có `ngayCu` → ném `ApiException`, thông báo chứa tên ngày truyền vào.
4. `ngayMoi` ở tương lai nhưng bằng `ngayCu` (cùng ngày, khác giờ cũng tính là cùng ngày) → không ném lỗi.
5. `ngayMoi` ở tương lai và khác `ngayCu` → ném `ApiException`.

## Ràng buộc
- Không sửa bất kỳ file nào ngoài file test mới.
- Không sửa code của `NgayTuongLaiHelper`.
- Tên test và comment viết tiếng Việt như các test hiện có.
- Chạy `dotnet test` phải qua.

## Tiêu chí nghiệm thu
- Chỉ có đúng 1 file mới được thêm.
- 5 nhóm trường hợp trên đều có test, test đều đạt.
