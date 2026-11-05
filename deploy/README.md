# Triển khai Codes Loop bằng Docker

Ba container trong một stack riêng (`codesloop`): **db** (PostgreSQL 16), **api** (ASP.NET Core 8), **web** (nginx + frontend, proxy `/api` tới api). Chỉ **web** mở cổng ra ngoài (mặc định 8200); db và api chỉ nằm trong mạng của stack. Dữ liệu ở volume `codesloop_pgdata`.

## Cài mới

```
cp deploy/.env.example deploy/.env      # điền DB_PASSWORD, JWT_KEY (32+ ký tự), WORKER_TOKEN, SEED_PASSWORD
cd deploy && docker compose up -d --build
```

Lần chạy đầu tự chạy migrations và tạo 3 tài khoản (`minhanh@`, `quochuy@`, `thutrang@codes.tech`) với mật khẩu `SEED_PASSWORD`.

## Cập nhật bản mới

Đưa mã nguồn mới lên (git pull hoặc giải nén), rồi `docker compose up -d --build`. Dữ liệu giữ nguyên; migrations mới tự áp dụng khi api khởi động.

## Việc thường làm

```
docker compose ps                         # trạng thái
docker compose logs -f api                # log API
docker compose exec -T db pg_dump -U codesloop codesloop > backup.sql      # sao lưu
docker compose down                       # dừng (giữ dữ liệu); thêm -v để xóa cả dữ liệu
```

## Worker

Worker chạy trên máy có đăng nhập Claude và `gh` (không chạy trong Docker):

```
cd agent-runtime
python -m runtime.worker --api http://<địa-chỉ-web> --token <WORKER_TOKEN> --root D:\Out-works\.codesloop
```

## Lưu ý bảo mật

- Mặc định chỉ có HTTP. Mật khẩu đăng nhập và `X-Worker-Token` đi qua mạng không mã hóa: dùng trong LAN, qua SSH tunnel (`ssh -L 8200:localhost:8200 user@server`), hoặc đặt HTTPS (tên miền + chứng chỉ) phía trước.
- `.env` chứa bí mật, quyền 600, không commit.
- Chưa giới hạn số lần đăng nhập sai.
