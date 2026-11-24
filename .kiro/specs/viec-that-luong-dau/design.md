# Thiết kế: Luồng đầu tiên của Việc Thật

## Kiến trúc

```
Safari / trình duyệt ── Vite dev (5173) ──proxy /api, /healthz──▶ NestJS (127.0.0.1:3000)
                                                                   ├─ extract.ts   (luật + fixtures)
                                                                   ├─ verify.ts    (luật trên fixtures)
                                                                   └─ demo-data.ts (data/demo/cases.json)
shared/contract.ts   kiểu TypeScript dùng chung
shared/schemas.ts    JSON Schema, API dùng Ajv để kiểm tra đầu vào, test kiểm tra đầu ra
```

- Web gọi API cùng origin qua proxy của Vite, nên không cần CORS.
- `extract.ts` và `verify.ts` là điểm thay thế ở giai đoạn sau. VT07 thay `extract` bằng Bedrock. VT08/VT09 thay phần đọc `fixtures` bằng Vietmap và nguồn tin. Hình dạng phản hồi giữ nguyên.
- Ca mô phỏng được chọn theo `jobUrl` khớp chính xác với `cases.json`. Không khớp thì `job` là `not_checked`.
- Ngày kiểm tra ở chế độ mô phỏng là `demoAsOf` (2026-11-21) để kết quả không đổi theo ngày chạy.
- Địa chỉ đã sửa khác địa chỉ của ca mô phỏng thì bản đồ mô phỏng không áp dụng, `location` là `not_checked` kèm thông báo.
- Khi gọi AI thật ở giai đoạn sau, chỉ gửi `invitationText`, các trường đã xác nhận và dữ kiện nguồn hợp lệ. Không gửi `expected`.

## Bảng trạng thái

| Mục | Giá trị `status` |
|---|---|
| `job` | `open`, `expired`, `unavailable`, `not_checked` |
| `location` | `matched`, `company_unconfirmed`, `unavailable`, `not_checked` |
| `contact` | `unverified`, `verified` (giai đoạn này chỉ trả `unverified`) |
| `invitation` | `caution`, `needs_verification`, `no_signal_observed`, `insufficient_information` |
| `requirements[].kind` | `fee_request`, `attendance_confirmation`, `shared_office_meeting`, `address_pending`, `document_request`, `credential_request`, `other_request` |

`invitation.status` xét theo thứ tự. Yêu cầu mã xác thực hoặc phí cho `caution`. Yêu cầu giấy tờ, địa điểm chưa xác nhận công ty hoặc yêu cầu khác cần làm rõ cho `needs_verification`. Tin chưa kiểm tra được và địa điểm chưa khớp cho `insufficient_information`. Những trường hợp còn lại cho `no_signal_observed` trong phạm vi dữ kiện đã đối chiếu.

Hợp đồng đầy đủ kèm ví dụ VT-DEMO-01 lấy từ phản hồi thật: [`docs/API-CONTRACT.md`](../../../docs/API-CONTRACT.md). Mô tả máy đọc được: [`docs/openapi.json`](../../../docs/openapi.json) (OpenAPI 3.1, sinh từ `shared/schemas.ts` bằng `npm run openapi -w apps/api`).

## Mã lỗi

| HTTP | `error.code` | Khi nào |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu trường, sai kiểu, chuỗi rỗng hoặc chỉ có khoảng trắng, có trường lạ. `details` chứa lỗi từ bộ kiểm tra. JSON hỏng cũng trả mã này, không có `details`. |
| 404 | `NOT_FOUND` | Đường dẫn không tồn tại, kể cả gọi sai phương thức. |
| 422 | `QUOTE_NOT_IN_SOURCE` | Một `quote` không nằm trong `invitationText`. `details.quotes` liệt kê đoạn sai. |
| 500 | `INTERNAL_ERROR` | Lỗi không lường trước. Thông báo chung, không lộ nội dung. |
| 503 | `HISTORY_DISABLED` | Gọi lịch sử hoặc `save: true` khi chưa cấu hình `DATABASE_URL`. |
| 429 | `RATE_LIMITED` | Vượt giới hạn yêu cầu mỗi phút. Có header `Retry-After`. |

`SOURCE_MODE_UNSUPPORTED` còn trong enum `ErrorCode` nhưng không endpoint nào trả, vì cả hai chế độ đều đã được hỗ trợ.

Dạng lỗi:

```json
{ "error": { "code": "QUOTE_NOT_IN_SOURCE", "message": "Có đoạn trích không nằm trong nội dung lời mời.", "details": { "quotes": ["đóng phí"] } } }
```

Giới hạn đầu vào: `invitationText` 1–5000 ký tự, `jobUrl` tối đa 2000, địa chỉ tối đa 500, tối đa 10 yêu cầu, mỗi `quote` 1–300 ký tự.

## `GET /healthz`

Phản hồi 200:

```json
{ "status": "ok", "service": "viec-that-api", "version": "0.1.0", "time": "2026-11-22T04:34:55.798Z", "modes": ["simulated", "live"], "history": { "enabled": true, "ttlDays": 30 }, "capabilities": { "ai": false, "places": false } }
```

## `POST /api/v1/invitations/extract`

Yêu cầu (`ExtractRequest`). `jobUrl` và `meetingAddress` có thể bỏ hoặc `null`.

```json
{
  "mode": "simulated",
  "invitationText": "Bên Công ty Mô phỏng Sao Giấy mời em phỏng vấn vị trí Thực tập sinh Phân tích dữ liệu tại Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4. Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.",
  "jobUrl": "https://saogiay.example/jobs/SG-101",
  "meetingAddress": "Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4"
}
```

Phản hồi 200 (`ExtractResponse`). Mỗi trường có `origin`: `invitation_text` (có `quote` nguyên văn), `user_input`, `simulated_source` (giá trị từ dữ kiện giả lập, `quote` là `null`) hoặc `not_found`.

```json
{
  "mode": "simulated",
  "simulated": true,
  "fields": {
    "company": { "value": "Công ty Mô phỏng Sao Giấy", "quote": "Công ty Mô phỏng Sao Giấy", "origin": "invitation_text" },
    "role": { "value": "Thực tập sinh Phân tích dữ liệu", "quote": "Thực tập sinh Phân tích dữ liệu", "origin": "invitation_text" },
    "meetingAddress": { "value": "Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4", "quote": "Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4", "origin": "user_input" },
    "jobUrl": { "value": "https://saogiay.example/jobs/SG-101", "quote": null, "origin": "user_input" }
  },
  "requirements": [{ "kind": "fee_request", "quote": "đóng phí giữ suất phỏng vấn" }],
  "notices": ["Dữ liệu mô phỏng: kết quả trích dùng luật cố định, chưa gọi AI."]
}
```

Lỗi ví dụ (400), thiếu `invitationText`:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [ { "keyword": "required", "params": { "missingProperty": "invitationText" } } ] } }
```

## `POST /api/v1/invitations/verify`

Yêu cầu (`VerifyRequest`). `confirmed` là dữ kiện người dùng đã xem và sửa.

```json
{
  "mode": "simulated",
  "invitationText": "Bên Công ty Mô phỏng Sao Giấy mời em phỏng vấn ... Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.",
  "jobUrl": "https://saogiay.example/jobs/SG-101",
  "confirmed": {
    "company": "Công ty Mô phỏng Sao Giấy",
    "role": "Thực tập sinh Phân tích dữ liệu",
    "meetingAddress": "Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4",
    "requirements": [{ "kind": "fee_request", "quote": "đóng phí giữ suất phỏng vấn" }]
  }
}
```

Phản hồi 200 (`VerifyResponse`), rút gọn `mapUrl`:

```json
{
  "mode": "simulated",
  "simulated": true,
  "checkedOn": "2026-11-21",
  "job": {
    "status": "expired",
    "basis": "Hạn nhận hồ sơ 2026-11-10 đã qua so với ngày kiểm tra 2026-11-21.",
    "source": { "label": "Trang tuyển dụng mô phỏng", "url": "https://saogiay.example/jobs/SG-101", "simulated": true },
    "checkedOn": "2026-11-21",
    "details": { "company": "Công ty Mô phỏng Sao Giấy", "role": "Thực tập sinh Phân tích dữ liệu", "jobCode": "SG-101", "postedOn": "2026-10-05", "closesOn": "2026-11-10", "reason": null }
  },
  "location": {
    "status": "company_unconfirmed",
    "basis": "Chỉ tìm thấy Tòa nhà Demo A. Chưa xác nhận công ty tại địa chỉ này.",
    "source": { "label": "Bản đồ mô phỏng", "url": null, "simulated": true },
    "checkedOn": "2026-11-21",
    "place": { "displayName": "Tòa nhà Demo A", "address": "Số 10 Đường Mẫu" },
    "mapUrl": "https://www.google.com/maps/search/?api=1&query=..."
  },
  "contact": { "status": "unverified", "basis": "Chưa có căn cứ về người liên hệ. Xác minh qua kênh tuyển dụng chính thức của công ty." },
  "invitation": {
    "status": "caution",
    "basis": "Lời mời yêu cầu một khoản phí. Cần xác minh trước khi chuyển tiền.",
    "requirements": [{ "kind": "fee_request", "quote": "đóng phí giữ suất phỏng vấn" }]
  },
  "guidance": {
    "nextStep": "Tạm dừng đóng phí. Xác minh mã tin hiện tại và địa điểm phỏng vấn qua kênh chính thức của công ty trước khi đi gặp.",
    "suggestedQuestion": "Em thấy tin SG-101 đã hết hạn. Anh/chị cho em xin mã tuyển dụng hiện tại, tên tòa nhà, số tầng và kênh tuyển dụng chính thức để em xác nhận lịch được không ạ?"
  },
  "notices": ["Dữ liệu mô phỏng: nguồn tin và bản đồ là giả lập, không phản ánh công ty thật."]
}
```

Ví dụ nguồn không truy cập được (VT-DEMO-04), phần khác biệt:

```json
{
  "job": { "status": "unavailable", "basis": "Chưa kiểm tra được tin: trang yêu cầu đăng nhập.", "details": { "reason": "login_required" } },
  "location": { "status": "not_checked", "basis": "Chưa có địa chỉ hẹn để tra cứu.", "mapUrl": null },
  "invitation": { "status": "insufficient_information" }
}
```

Lỗi ví dụ (422):

```json
{ "error": { "code": "QUOTE_NOT_IN_SOURCE", "message": "Có đoạn trích không nằm trong nội dung lời mời.", "details": { "quotes": ["đóng phí"] } } }
```

## `GET /api/v1/demo/cases` (bổ sung)

Trả `{ "cases": [{ "id", "title", "kind": "simulated", "input": { "invitationText", "jobUrl", "meetingAddress" } }] }` cho nút chọn ca mẫu. Không trả `fixtures` và `expected`.

## Chế độ live (VT07 đến VT11)

Mã (trong `apps/api/src/`): `viec-that/ai.ts` và `ai.service.ts` (Bedrock), `geocoding/` (Vietmap), `viec-that/location.ts` (đối chiếu địa điểm), `viec-that/extract.ts` (`extractLive`), `viec-that/verify.ts` (`verifyLive`).

```
extract live:  lời mời ──▶ Bedrock Converse (tool bắt buộc) ──▶ kiểm tra đoạn trích và phủ định rõ ràng
                      └──▶ luật cố định (phí, giấy tờ, mã xác thực…) ──▶ ưu tiên đoạn trích của luật khi trùng loại, AI bổ sung loại còn thiếu
verify live:   dữ kiện đã xác nhận ──▶ job: dữ kiện người dùng nhập + ngày hôm nay (giờ VN)
                                  └──▶ location: Vietmap (theo công ty + địa chỉ) ──▶ evaluateLocationLive
                                  └──▶ invitation + guidance: luật trên các kết quả trên
```

- `VerifyRequest.jobPosting` (tùy chọn): `{ jobCode, postedOn, closesOn, closed }`. Ngày dạng `YYYY-MM-DD`.
- `HealthResponse.capabilities`: `{ ai, places }` cho web biết dịch vụ nào đã bật.
- `RequirementKind` hỗ trợ `document_request`, `credential_request` và `other_request`. `FieldOrigin` hỗ trợ `ai`.
- Cấu hình: `BEDROCK_MODEL_ID`, `AWS_REGION`, `VIETMAP_API_KEY` và các giới hạn `VIETMAP_MAX_*`. Thông tin xác thực AWS lấy từ chuỗi mặc định (IAM role trên EC2, SSO trên máy cá nhân). Không đặt khóa AWS vào `.env`.
- Kiểm tra dịch vụ thật: `npm run check:services -w apps/api` (xem mục 7 của `README.md`).

Quyết định: không thu thập trang của sàn việc làm vì điều khoản của TopCV và LinkedIn hạn chế khai thác tự động. Nguồn tin đăng là dữ kiện người dùng nhập. Tin trên trang tuyển dụng của chính doanh nghiệp có thể thêm sau khi nhóm rà quyền từng nguồn.

## Lịch sử tra cứu (PostgreSQL)

Mã: `apps/api/src/db.ts`, `history.ts`, `migrate.ts`, `migrations/001_create_checks.sql`. Kiểu và schema: `shared/contract.ts`, `shared/schemas.ts`.

### Bảng `checks`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `device_hash` | `text` | SHA-256 của mã trong cookie `vt_device` |
| `mode` | `text` | `simulated` hoặc `live` |
| `title` | `text` | "Công ty · Vị trí", nếu thiếu thì 80 ký tự đầu của lời mời |
| `invitation_text` | `text` | Nội dung lời mời người dùng đã nhập |
| `job_url` | `text` null | |
| `confirmed` | `jsonb` | Dữ kiện đã xác nhận, gồm yêu cầu và đoạn trích |
| `result` | `jsonb` | `VerifyResponse` đầy đủ lúc kiểm tra |
| `job_status`, `location_status`, `invitation_status` | `text` | Tách ra để hiện danh sách không cần đọc `result` |
| `created_at`, `expires_at` | `timestamptz` | |

Chỉ mục: `(device_hash, created_at desc)` cho danh sách, `(expires_at)` cho dọn dẹp. Bảng `schema_migrations` ghi các tệp SQL đã chạy. Mỗi migration chạy trong một giao dịch.

### Endpoint

| Phương thức và đường dẫn | Mô tả |
|---|---|
| `POST /api/v1/invitations/verify` với `"save": true` | Lưu và trả thêm `historyId`. Lần đầu đặt cookie `Set-Cookie: vt_device=...`. |
| `GET /api/v1/history?limit=50` | `{ "items": [{ id, createdAt, expiresAt, mode, simulated, title, jobStatus, locationStatus, invitationStatus }] }`. Không có cookie hợp lệ thì `items` rỗng. |
| `GET /api/v1/history/:id` | `{ id, createdAt, expiresAt, title, input: { invitationText, jobUrl }, confirmed, result }`. Không thuộc thiết bị này hoặc hết hạn: 404. |
| `DELETE /api/v1/history/:id` | 204. Không tìm thấy: 404. |
| `POST /api/v1/history/delete` | Thân `{ "ids": ["<uuid>", ...] }` (1–100 id). Trả `{ "deleted": n }`. Id không thuộc thiết bị này bị bỏ qua. Dùng POST vì một số proxy bỏ thân của DELETE. |

Ví dụ danh sách:

```json
{ "items": [ {
  "id": "5b0c5f2e-3c1e-4c1f-9d7a-0a1b2c3d4e5f",
  "createdAt": "2026-11-21T11:40:00.000Z",
  "expiresAt": "2026-12-21T11:40:00.000Z",
  "mode": "simulated", "simulated": true,
  "title": "Công ty Mô phỏng Sao Giấy · Thực tập sinh Phân tích dữ liệu",
  "jobStatus": "expired", "locationStatus": "company_unconfirmed", "invitationStatus": "caution"
} ] }
```

### Quyết định và đánh đổi

- **Không đăng nhập.** Cookie ẩn danh đủ cho bản thi và tránh lưu thông tin định danh. Đổi lại, lịch sử gắn với một trình duyệt: xóa cookie, đổi máy hay dùng chế độ riêng tư thì mất. Đăng nhập hoặc đồng bộ nhiều thiết bị là việc sau.
- **Cookie phía máy chủ** thay vì `localStorage`, vì Safari iPhone xóa `localStorage` của trang không dùng sau khoảng 7 ngày.
- **Lưu nội dung lời mời** là điều lịch sử cần để xem lại, nên nó có thời hạn, có hộp chọn rõ ràng và xóa là xóa thật (`DELETE`, không đánh dấu).
- **Kiểm thử bằng PGlite** (Postgres chạy trong tiến trình) cho cùng SQL và migration. Đường kết nối `pg` thật chỉ kiểm tra được khi có `DATABASE_URL` hợp lệ.

## Giao diện (VT06)

Ba bước trên một trang, tối ưu cho điện thoại: chữ nhập 16px để Safari iOS không tự phóng to, nút cao tối thiểu 44px. Điện thoại dùng một cột, nút chính rộng hết khung. Desktop giữ form rộng 640px, phần kết quả rộng tới 1040px.

1. **Nhập.** Ô dán lời mời và nút Phân tích lời mời nằm đầu form. Link, địa chỉ và dữ kiện tin đăng nằm ở nhóm "Thêm thông tin". Nút "Thử với dữ liệu mẫu" mở danh sách ca mẫu có tên dễ hiểu và nhãn "Dữ liệu mô phỏng". Thử mẫu không làm mất lời mời đã gõ: có nút khôi phục. Gửi trống thì báo lỗi ngay dưới ô nhập và đưa con trỏ về ô đó.
2. **Xác nhận.** Sửa công ty, vị trí, địa chỉ. Bỏ chọn yêu cầu không đúng. Mỗi yêu cầu hiện đoạn trích.
3. **Kết quả.** Khối "Việc nên làm ngay" đứng đầu: bước tiếp theo, câu hỏi gợi ý và nút Sao chép câu hỏi (dùng `navigator.clipboard`, có đường dự phòng cho Safari cũ). Viền đỏ khi lời mời `caution`, hổ phách khi `needs_verification`. Bên dưới là bốn thẻ căn cứ: Tin đăng, Địa điểm (kèm nút Mở bản đồ), Lời mời, Người liên hệ. Desktop xếp bốn thẻ thành lưới 2 × 2.

Khi chuyển bước, điểm tập trung chuyển tới tiêu đề bước mới. "Kiểm tra lời mời khác" xóa toàn bộ dữ liệu của lượt trước.

Khi lịch sử bật, thanh tab Kiểm tra / Lịch sử xuất hiện. Tab Lịch sử có danh sách chọn nhiều, nút Xóa đã chọn (có hộp xác nhận) và màn xem lại một mục.

Trạng thái xử lý: nút đổi chữ và bị khóa khi đang gọi API. Lỗi hiện trong khung cảnh báo tiếng Việt, gồm lỗi mạng.

## Chiến lược kiểm thử

- API (`apps/api/test`): chạy cả bốn ca qua `extract` rồi `verify`, so `jobStatus`, `locationStatus`, `contactStatus`, `invitationStatus` và `evidenceQuotes` với `expected`. Phản hồi được kiểm tra bằng Ajv theo schema. Có ca lỗi 400 (kể cả lời mời chỉ có khoảng trắng), 404, 422, 429, 503. `docs/openapi.json` được so với schema hiện tại và mọi đường dẫn trong đó phải có trên API.
- Web (`apps/web/test`): dựng giao diện với `fetch` nối vào API NestJS thật (`apps/api/test/harness.ts`, nghe trên 127.0.0.1). Chạy VT-DEMO-01 đến bước sao chép, VT-DEMO-02, VT-DEMO-04, gửi rỗng và lỗi mạng. Kiểm tra thứ tự trên trang (ô nhập và nút chính trước ca mẫu, "Việc nên làm ngay" trước bốn thẻ), giữ bản nháp khi thử mẫu, xóa dữ liệu khi bắt đầu lượt mới và điểm tập trung khi chuyển bước.
- Câu hướng dẫn so theo mẫu và từ khóa, không so từng chữ với `expected`.
