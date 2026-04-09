# Database cho PHPUnit (không xóa dữ liệu dev)

`phpunit.xml` ghi đè **`DB_DATABASE=signalfeed_test`**. Mọi test dùng `RefreshDatabase` chỉ migrate / reset **database này**, không đụng database dev (thường là `signalfeed`).

## Thiết lập một lần (PostgreSQL)

**Cách A — script (đọc `.env`):**

```bash
chmod +x scripts/create-test-database.sh
./scripts/create-test-database.sh
```

**Cách B — tay:**

```bash
createdb -h 127.0.0.1 -U "$DB_USERNAME" signalfeed_test
# hoặc:
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE signalfeed_test;"
```

Sau đó:

```bash
php artisan test
```

Nếu chưa tạo DB test, lỗi kiểu: `database "signalfeed_test" does not exist` — chạy script hoặc lệnh tạo DB ở trên.

Lần đầu, `RefreshDatabase` sẽ chạy migration trên `signalfeed_test`.

## Quy tắc

| Lệnh | Database bị ảnh hưởng |
|------|------------------------|
| `php artisan test` | Chỉ `signalfeed_test` (theo `phpunit.xml`) |
| `php artisan migrate`, `pipeline:run`, Tinker | Database trong `.env` (thường `signalfeed`) |

**Không** chỉnh `phpunit.xml` để trỏ lại `signalfeed` khi chạy test — sẽ mất dữ liệu dev khi có `RefreshDatabase`.

## Đổi tên database test

Sửa giá trị `DB_DATABASE` trong `phpunit.xml` (hoặc tạo DB tương ứng).

## CI

Trên CI: tạo role/database test (vd. `signalfeed_test`) hoặc inject biến môi trường tương đương trước khi `php artisan test`.
