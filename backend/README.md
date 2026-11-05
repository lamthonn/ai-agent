# Backend Codes Loop

ASP.NET Core 8 (minimal API) + EF Core. Một project `CodesLoop.Api`, test ở `CodesLoop.Api.Tests`.

## Chạy

```
cd backend
dotnet run --project CodesLoop.Api --urls http://localhost:5099     # môi trường Development: SQLite, tài khoản mẫu, mật khẩu codesloop-dev
dotnet test
```

Tài khoản mẫu (Development): `minhanh@codes.tech` (admin), `quochuy@codes.tech` (QLKho), `thutrang@codes.tech` (CongThongTin-Web).

Giao diện (cần backend đang chạy ở cổng 5099):

```
cd frontend
npm run dev        # http://localhost:5173, đăng nhập bằng tài khoản mẫu ở trên
```

Worker (một process, cùng máy hoặc máy khác):

```
cd agent-runtime
python -m runtime.worker --api http://localhost:5099 --token dev-worker-token --root D:\Out-works\.codesloop
```

## Cấu hình (bắt buộc ngoài Development)

| Khóa | Ý nghĩa |
|---|---|
| `Jwt:Key` | Bí mật ký token đăng nhập, từ 32 ký tự |
| `Worker:Token` | Token worker gửi ở header `X-Worker-Token` |
| `Seed:Password` | Mật khẩu 3 tài khoản tạo lần đầu (DB còn trống) |
| `Db:Provider` | `sqlite` (mặc định) hoặc `postgres` |
| `ConnectionStrings:Default` | Chuỗi kết nối |
| `Cors:Origins` | Địa chỉ frontend được gọi API |

## API

Người dùng (`Authorization: Bearer`): `POST /api/auth/login`, `GET /api/me`, `projects`, `agents`, `jobs` (+ `/{id}`, `/{id}/events?after=`, `POST`, `/{id}/cancel`), `approvals` (+ `POST /{id}/decide`), `workflows` (+ `/{id}/versions/{n}`, `POST /{id}/versions`), `settings/budget`, `settings/rules`, `accounts`.

Worker (`X-Worker-Token`): `POST /internal/jobs/claim`, `/{id}/steps`, `/events`, `/meta`, `/approval`, `/complete`.

## Đã kiểm chứng / chưa

- Có test: đăng nhập, thành viên chỉ thấy project được cấp, người tạo không tự duyệt, phiên bản workflow bất biến + job giữ đúng phiên bản, kiểm tra workflow, nhận job một lần duy nhất, chạy tiếp sau duyệt, hạn mức token theo ngày, hủy job.
- **Chưa thử với PostgreSQL** (máy chưa có Docker/PostgreSQL). Cần tạo migrations (hiện dùng `EnsureCreated`) và chạy thử bộ test trên PostgreSQL.
- Chưa có: log realtime SignalR (hiện đọc `events?after=`), "yêu cầu sửa" ở bước duyệt, tạm dừng job đang chạy khi chạm hạn mức, giới hạn thử đăng nhập sai, email cảnh báo hạn mức.
