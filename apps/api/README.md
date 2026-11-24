# API Việc Thật (NestJS)

API của Việc Thật, chạy trên NestJS 12 với Express. Hợp đồng API nằm ở `shared/` (kiểu và JSON Schema dùng chung với web), ví dụ ở [`docs/API-CONTRACT.md`](../../docs/API-CONTRACT.md), mô tả máy đọc được ở [`docs/openapi.json`](../../docs/openapi.json).

## Chạy

Từ thư mục gốc của repo (npm workspaces):

```powershell
npm install
npm run dev:api                        # http://127.0.0.1:3000, tự tải lại khi sửa mã
npm run test -w apps/api               # unit, e2e và kiểm thử API
npm run typecheck -w apps/api
npm run openapi -w apps/api            # sinh lại docs/openapi.json sau khi đổi shared/schemas.ts
npm run check:services -w apps/api     # gọi thử Bedrock và Vietmap nếu đã cấu hình
npm run load:server -w apps/api        # máy chủ cho k6 (VT14), cổng 3900
npm run migrate -w apps/api            # chạy migration lịch sử (API cũng tự chạy khi khởi động)
```

API chạy TypeScript trực tiếp bằng `tsx`, không có bước build. Lệnh phải chạy trong `apps/api` (npm `-w` tự làm việc này) để `tsx` đọc `tsconfig.json` có `experimentalDecorators`. Mã khai báo `@Inject(...)` cho mọi tham số constructor nên không cần `emitDecoratorMetadata`.

Cấu hình đọc từ `.env` ở thư mục gốc. Xem `.env.example` ở gốc.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/main.ts` | Khởi động, chỉ nghe `HOST` (mặc định `127.0.0.1`), `TRUST_PROXY` khi chạy sau Caddy. |
| `src/viec-that/viec-that.controller.ts` | Các endpoint `/healthz`, `/api/v1/...`. |
| `src/viec-that/extract.ts`, `verify.ts`, `location.ts` | Trích dữ kiện, đối chiếu tin đăng, địa điểm, lời mời và hướng dẫn. |
| `src/viec-that/requirements.ts` | Luật cố định nhận diện yêu cầu (phí, giấy tờ, OTP...). |
| `src/viec-that/ai.ts`, `ai.service.ts` | Bedrock Converse (VT07). Bật khi có `BEDROCK_MODEL_ID`. |
| `src/geocoding/` | Client Vietmap (VT08), giới hạn số request và bộ nhớ đệm. |
| `src/viec-that/history*.ts`, `db.ts`, `migrations/` | Lịch sử tra cứu trên PostgreSQL. |
| `src/viec-that/invitation-rate.guard.ts` | Giới hạn tần suất theo IP cho `extract` và `verify`. |
| `test/harness.ts` | Dựng API thật với dịch vụ giả lập cho kiểm thử API và web. |
