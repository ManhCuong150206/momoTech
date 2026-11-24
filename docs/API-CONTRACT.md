# Hợp đồng API Việc Thật v1 (VT04)

Tài liệu này mô tả ba endpoint của luồng đầu tiên: `GET /healthz`, `POST /api/v1/invitations/extract` và `POST /api/v1/invitations/verify`. Lịch sử tra cứu và `GET /api/v1/demo/cases` được mô tả trong [design.md](../.kiro/specs/viec-that-luong-dau/design.md).

- Kiểu TypeScript: [`shared/contract.ts`](../shared/contract.ts). JSON Schema (draft-07): [`shared/schemas.ts`](../shared/schemas.ts). OpenAPI 3.1: [`openapi.json`](openapi.json), sinh từ schema bằng `npm run openapi -w apps/api`. Khi tài liệu này và mã khác nhau, mã là nguồn sự thật và tài liệu cần sửa.
- Mọi ví dụ JSON dưới đây lấy từ phản hồi thật của API (ban đầu chạy trên Fastify ở commit `6a86e78`, đã kiểm lại trên NestJS ngày 24/11/2026) với ca **VT-DEMO-01** trong [`data/demo/cases.json`](../data/demo/cases.json).
- **VT-DEMO-01 là dữ liệu mô phỏng.** Công ty, địa chỉ, tin đăng và bản đồ đều giả lập. Phản hồi có `simulated: true` và web phải hiện nhãn "Dữ liệu mô phỏng".

## 1. Quy ước chung

| Mục | Quy ước |
|---|---|
| Đường dẫn | `/api/v1/...` cho nghiệp vụ, `/healthz` ở gốc. Web gọi cùng origin qua proxy Vite. |
| Định dạng | Gửi và nhận `application/json; charset=utf-8`. Chuỗi được chuẩn hóa Unicode NFC trước khi so khớp. |
| Trường lạ | Bị từ chối (`additionalProperties: false`), trả 400. Không ép kiểu (`"true"` không phải `true`). |
| Trường tùy chọn | `jobUrl`, `meetingAddress`, `jobPosting` có thể bỏ hoặc gửi `null`. Chuỗi chỉ có khoảng trắng được coi như `null`. |
| Ngày | `YYYY-MM-DD`, hiểu theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). `healthz.time` là ISO 8601 UTC. |
| Chế độ `mode` | `simulated`: dùng `fixtures` của ca mẫu, ngày kiểm tra cố định là `demoAsOf` = `2026-11-21`. `live`: dùng AI, Vietmap và dữ kiện người dùng nhập, ngày kiểm tra là hôm nay. |
| Văn bản hiển thị | `basis`, `nextStep`, `suggestedQuestion`, `notices` là tiếng Việt để hiện thẳng cho người dùng. Web không phân tích các chuỗi này, chỉ dựa vào `status` và `kind`. |
| Riêng tư | Nhật ký máy chủ chỉ ghi phương thức, đường dẫn và mã trạng thái, không ghi nội dung lời mời. |

### Giới hạn đầu vào

| Trường | Giới hạn |
|---|---|
| `invitationText` | 1 đến 5000 ký tự, phải có ít nhất một ký tự không phải khoảng trắng |
| `jobUrl` | tối đa 2000 ký tự |
| `meetingAddress` | tối đa 500 ký tự |
| `confirmed.company`, `confirmed.role` | tối đa 200 ký tự |
| `confirmed.requirements` | tối đa 10 mục |
| `requirements[].quote` | 1 đến 300 ký tự |
| `jobPosting.jobCode` | tối đa 100 ký tự |
| `jobPosting.postedOn`, `jobPosting.closesOn` | `YYYY-MM-DD`. Ngày không có trên lịch (ví dụ `2026-02-30`) bị bỏ qua như `null`. |

## 2. Dạng lỗi và mã lỗi

Mọi lỗi có cùng một dạng. `details` chỉ có khi giúp người gọi sửa yêu cầu.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [] } }
```

| HTTP | `error.code` | Khi nào | `details` |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Thiếu trường, sai kiểu, chuỗi rỗng hoặc chỉ có khoảng trắng, vượt giới hạn, trường lạ, `mode` sai. | Mảng lỗi Ajv (`instancePath`, `keyword`, `params`, `message`). |
| 400 (413 khi thân quá lớn) | `VALIDATION_ERROR` | JSON hỏng, hoặc thân vượt giới hạn của Express (mặc định 100 KB). `message` là "Yêu cầu không hợp lệ." Gửi `text/plain` thì thân được đọc như chuỗi và trả 400 do schema (`must be object`). | Không có. |
| 404 | `NOT_FOUND` | Đường dẫn không tồn tại, kể cả gọi sai phương thức (ví dụ `GET /api/v1/invitations/extract`). | Không có. |
| 422 | `QUOTE_NOT_IN_SOURCE` | `verify`: một `quote` trong `confirmed.requirements` không nằm trong `invitationText`. | `{ "quotes": [ ... ] }` liệt kê đoạn sai. |
| 429 | `RATE_LIMITED` | Mỗi IP gọi `POST /api/v1/invitations/*` quá `RATE_LIMIT_PER_MINUTE` lần (mặc định 30) trong 60 giây, hoặc quá 5 lần trong 10 giây. `Retry-After` là số giây còn phải chờ. Đặt giới hạn bằng 0 thì tắt cả hai. | Không có. |
| 503 | `HISTORY_DISABLED` | `verify` có `save: true` khi máy chủ chưa cấu hình `DATABASE_URL`. | Không có. |
| 500 | `INTERNAL_ERROR` | Lỗi không lường trước. Thông báo chung, không lộ nội dung. | Không có. |

`SOURCE_MODE_UNSUPPORTED` có trong enum của `ErrorCode` nhưng hiện không endpoint nào trả mã này (xem mục 7).

Lỗi dịch vụ ngoài (Bedrock, Vietmap) **không** trả lỗi HTTP. Phần bị ảnh hưởng hạ cấp thành `unavailable` hoặc luật cố định, và có dòng giải thích trong `notices`.

## 3. Trạng thái của bốn phần kết quả

`verify` trả bốn phần độc lập. Mỗi phần có `status` riêng và `basis` giải thích căn cứ. Không có điểm tổng hợp. Một phần tốt không làm phần khác tốt lên.

### 3.1. Tin đăng (`job.status`)

| Giá trị | Nghĩa | Khi nào |
|---|---|---|
| `open` | Tin còn nhận hồ sơ. | Hạn nộp chưa qua so với ngày kiểm tra, hoặc nguồn ghi đang tuyển mà không nêu hạn. |
| `expired` | Tin đã hết hạn. | **Chỉ khi** hạn nộp đã qua so với ngày kiểm tra, hoặc nguồn ghi rõ đã đóng tuyển. |
| `unavailable` | Có nguồn nhưng chưa đọc được. | `simulated`: nguồn cần đăng nhập (`details.reason = "login_required"`). `live`: có link hoặc mã tin nhưng người dùng chưa nhập hạn nộp hay trạng thái (`details.reason = "no_deadline"`). |
| `not_checked` | Chưa đối chiếu. | Không có link, hoặc link không thuộc ca mô phỏng nào (`simulated`), hoặc không có link lẫn dữ kiện tin (`live`). `checkedOn` là `null`. |

Kèm theo: `source { label, url, simulated }`, `checkedOn`, `details { company, role, jobCode, postedOn, closesOn, reason }`. Việc Thật không tự đọc trang TopCV, LinkedIn hay sàn khác. `source.url` chỉ là link tham chiếu người dùng nhập.

### 3.2. Địa điểm (`location.status`)

| Giá trị | Nghĩa | Khi nào |
|---|---|---|
| `matched` | Thấy đúng công ty tại địa chỉ hẹn. | Nguồn bản đồ ghi tên công ty trùng công ty đã xác nhận và địa chỉ trùng địa chỉ hẹn. |
| `company_unconfirmed` | Địa chỉ có thật nhưng chưa thấy công ty ở đó. | Chỉ thấy tòa nhà, không gian làm việc dùng chung, công ty khác ở địa chỉ đó, hoặc (`live`) không có kết quả khớp. |
| `unavailable` | Dịch vụ bản đồ lỗi. | Chỉ ở `live`, khi gọi Vietmap thất bại (mạng, khóa sai, vượt hạn mức). |
| `not_checked` | Chưa đối chiếu tự động. | Không có địa chỉ hẹn (`mapUrl = null`), địa chỉ đã sửa khác địa chỉ của ca mô phỏng, hoặc (`live`) chưa cấu hình Google Maps. |

Kèm theo: `source`, `checkedOn`, `place { displayName, address }` là nơi nguồn bản đồ tìm thấy, `mapUrl` là link Google Maps tìm theo địa chỉ hẹn để người dùng tự mở. `mapUrl` có mặt mỗi khi có địa chỉ hẹn, kể cả khi `not_checked`.

### 3.3. Người liên hệ (`contact.status`)

| Giá trị | Nghĩa | Khi nào |
|---|---|---|
| `unverified` | Chưa có căn cứ về người liên hệ. | Mọi trường hợp ở giai đoạn này, **kể cả khi tin đăng và địa điểm đều khớp**. |
| `verified` | Đã xác minh người liên hệ. | Có trong enum, hiện không trả. Chưa có tiêu chí (xem mục 7). |

Kèm theo: `basis`. Người liên hệ không có `source` hay `checkedOn` vì chưa có nguồn đối chiếu.

### 3.4. Lời mời và yêu cầu trong lời mời (`invitation`)

`invitation.status` xét theo thứ tự, gặp điều kiện đầu tiên thì dừng:

| Thứ tự | Điều kiện | `status` |
|---|---|---|
| 1 | Có yêu cầu `credential_request` hoặc `fee_request` | `caution` |
| 2 | Có yêu cầu `document_request` | `needs_verification` |
| 3 | Địa điểm `company_unconfirmed` hoặc có `other_request` | `needs_verification` |
| 4 | Tin `unavailable` hoặc `not_checked` và địa điểm chưa `matched` | `insufficient_information` |
| 5 | Còn lại | `no_signal_observed` |

`no_signal_observed` nghĩa là chưa thấy dấu hiệu cần cảnh báo trong dữ kiện đã đối chiếu. Đây không phải xác nhận lời mời là thật.

`invitation.requirements` là danh sách yêu cầu người dùng đã giữ lại ở bước xác nhận. Mỗi mục có `kind` và `quote` nguyên văn từ lời mời:

| `kind` | Ý nghĩa | Ví dụ `quote` |
|---|---|---|
| `fee_request` | Đòi đóng, nộp, chuyển phí hoặc đặt cọc. | `đóng phí giữ suất phỏng vấn` (VT-DEMO-01) |
| `document_request` | Đòi gửi CCCD, hộ chiếu, giấy tờ cá nhân. | `gửi ảnh CCCD hai mặt` |
| `credential_request` | Yêu cầu cung cấp OTP, mã xác thực hoặc mật khẩu. | `gửi mã OTP vừa nhận nhé` |
| `attendance_confirmation` | Đề nghị xác nhận tham dự. | `xác nhận có tham dự được không` (VT-DEMO-02) |
| `shared_office_meeting` | Hẹn ở văn phòng dùng chung. | `văn phòng dùng chung Số 35 Đường Mẫu` (VT-DEMO-03) |
| `address_pending` | Địa chỉ chưa có, sẽ gửi sau. | `địa chỉ sẽ gửi sau` (VT-DEMO-04) |
| `other_request` | Yêu cầu khác AI tìm được ở `live`. | |

Kiểm tra `quote`: gom khoảng trắng liên tiếp thành một, chuẩn hóa NFC, rồi tìm chuỗi con trong `invitationText`. Phân biệt hoa thường.

### 3.5. Hướng dẫn (`guidance`)

`guidance.nextStep` và `guidance.suggestedQuestion` sinh bằng luật từ dữ kiện đang thiếu, không dùng văn bản AI tự do. Câu hỏi luôn xin "kênh tuyển dụng chính thức". Tin `expired` thêm mã tin vào đầu câu. Địa điểm `company_unconfirmed` xin tên tòa nhà (hoặc đơn vị đặt phòng) và số tầng. Có `fee_request` thì `nextStep` bắt đầu bằng "Tạm dừng đóng phí."

## 4. `GET /healthz`

Không có tham số. Luôn trả 200 khi tiến trình chạy.

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `status` | `"ok"` | |
| `service` | `"viec-that-api"` | |
| `version` | string | Phiên bản API, hiện `0.1.0`. |
| `time` | string | Giờ máy chủ, ISO 8601 UTC. |
| `modes` | `("simulated" \| "live")[]` | Chế độ máy chủ nhận. |
| `history` | `{ enabled, ttlDays }` | `enabled = false` khi chưa đặt `DATABASE_URL`. Web ẩn mục Lịch sử. |
| `capabilities` | `{ ai, places }` | Dịch vụ ngoài đã cấu hình. `false` thì chế độ `live` hạ cấp phần đó. |

Phản hồi 200 (máy phát triển, chưa cấu hình cơ sở dữ liệu, Bedrock và Vietmap). `capabilities.places` là `true` khi đã có `VIETMAP_API_KEY`:

```json
{
  "status": "ok",
  "service": "viec-that-api",
  "version": "0.1.0",
  "time": "2026-11-22T04:34:55.798Z",
  "modes": ["simulated", "live"],
  "history": { "enabled": false, "ttlDays": 30 },
  "capabilities": { "ai": false, "places": false }
}
```

Lỗi: `/healthz` không có lỗi nghiệp vụ. Gọi sai đường dẫn (ví dụ `/health`) trả 404 `NOT_FOUND`.

## 5. `POST /api/v1/invitations/extract`

Đọc lời mời, trả dữ kiện để người dùng xem và sửa ở bước xác nhận. Endpoint này không đánh giá trạng thái.

### Yêu cầu (`ExtractRequest`)

| Trường | Bắt buộc | Kiểu | Ghi chú |
|---|---|---|---|
| `mode` | có | `"simulated" \| "live"` | |
| `invitationText` | có | string, 1–5000 | Nội dung lời mời người dùng dán. |
| `jobUrl` | không | string \| null | `simulated`: phải khớp chính xác `input.jobUrl` của một ca mẫu để điền sẵn công ty và vị trí. |
| `meetingAddress` | không | string \| null | Địa chỉ hẹn người dùng nhập. |

```json
{
  "mode": "simulated",
  "invitationText": "Bên Công ty Mô phỏng Sao Giấy mời em phỏng vấn vị trí Thực tập sinh Phân tích dữ liệu tại Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4. Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.",
  "jobUrl": "https://saogiay.example/jobs/SG-101",
  "meetingAddress": "Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4"
}
```

### Kết quả 200 (`ExtractResponse`)

Mỗi trường trong `fields` có `value`, `quote` và `origin`:

| `origin` | Nghĩa | `quote` |
|---|---|---|
| `invitation_text` | Giá trị có nguyên văn trong lời mời. | Đoạn nguyên văn. |
| `user_input` | Người dùng tự nhập (link, địa chỉ). | Đoạn nguyên văn nếu địa chỉ cũng có trong lời mời, ngược lại `null`. |
| `simulated_source` | Lấy từ nguồn giả lập, không có trong lời mời. | `null` |
| `ai` | AI đọc được (chỉ `live`). Máy chủ đã loại mục không có trích dẫn. | Đoạn nguyên văn. |
| `not_found` | Không tìm thấy. `value` là `null`. | `null` |

VT-DEMO-01 (mô phỏng):

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
  "requirements": [
    { "kind": "fee_request", "quote": "đóng phí giữ suất phỏng vấn" }
  ],
  "notices": ["Dữ liệu mô phỏng: kết quả trích dùng luật cố định, chưa gọi AI."]
}
```

Khi `jobUrl` không thuộc ca mẫu nào, `company` và `role` là `not_found` và `notices` có thêm: "Link tin không thuộc ca mô phỏng nào nên chưa điền sẵn công ty và vị trí. Hãy nhập tay ở bước xác nhận."

### Lỗi

400, `invitationText` rỗng. Bộ kiểm tra báo mọi lỗi cùng lúc nên có cả `minLength` và `pattern`:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [
  { "instancePath": "/invitationText", "schemaPath": "#/properties/invitationText/minLength", "keyword": "minLength", "params": { "limit": 1 }, "message": "must NOT have fewer than 1 characters" },
  { "instancePath": "/invitationText", "schemaPath": "#/properties/invitationText/pattern", "keyword": "pattern", "params": { "pattern": "\\S" }, "message": "must match pattern \"\\S\"" }
] } }
```

400, `invitationText` chỉ có khoảng trắng (`" \n\t "`) bị chặn bằng `pattern`:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [
  { "instancePath": "/invitationText", "schemaPath": "#/properties/invitationText/pattern", "keyword": "pattern", "params": { "pattern": "\\S" }, "message": "must match pattern \"\\S\"" }
] } }
```

400, thiếu `invitationText`:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [
  { "instancePath": "", "schemaPath": "#/required", "keyword": "required", "params": { "missingProperty": "invitationText" }, "message": "must have required property 'invitationText'" }
] } }
```

400, `mode` sai giá trị (`"mode": "real"`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [
  { "instancePath": "/mode", "schemaPath": "#/properties/mode/enum", "keyword": "enum", "params": { "allowedValues": ["simulated", "live"] }, "message": "must be equal to one of the allowed values" }
] } }
```

400, có trường lạ (`"foo": 1`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu gửi lên không hợp lệ.", "details": [
  { "instancePath": "", "schemaPath": "#/additionalProperties", "keyword": "additionalProperties", "params": { "additionalProperty": "foo" }, "message": "must NOT have additional properties" }
] } }
```

## 6. `POST /api/v1/invitations/verify`

Đối chiếu dữ kiện người dùng đã xác nhận, trả bốn phần kết quả và hướng dẫn. Máy chủ tự tính kết quả, không nhận kết quả từ client.

### Yêu cầu (`VerifyRequest`)

| Trường | Bắt buộc | Kiểu | Ghi chú |
|---|---|---|---|
| `mode` | có | `"simulated" \| "live"` | |
| `invitationText` | có | string, 1–5000 | Gửi lại nguyên văn để kiểm tra `quote`. |
| `jobUrl` | không | string \| null | `simulated`: chọn ca mẫu theo chuỗi khớp chính xác. |
| `confirmed` | có | object | Dữ kiện người dùng đã xem và sửa. |
| `confirmed.company` | có | string \| null | |
| `confirmed.role` | có | string \| null | |
| `confirmed.meetingAddress` | có | string \| null | Khác địa chỉ của ca mẫu thì bản đồ mô phỏng không áp dụng. |
| `confirmed.requirements` | có | `Requirement[]`, tối đa 10 | Mảng rỗng nếu người dùng bỏ chọn hết. |
| `jobPosting` | không | object \| null | Chỉ dùng ở `live`: `{ jobCode, postedOn, closesOn, closed }` người dùng đọc trên tin. |
| `save` | không | boolean | `true` thì lưu vào lịch sử và trả `historyId`. Mặc định `false`. |

VT-DEMO-01 (mô phỏng), sau khi người dùng giữ nguyên dữ kiện đã trích:

```json
{
  "mode": "simulated",
  "invitationText": "Bên Công ty Mô phỏng Sao Giấy mời em phỏng vấn vị trí Thực tập sinh Phân tích dữ liệu tại Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4. Em cần đóng phí giữ suất phỏng vấn trước buổi hẹn.",
  "jobUrl": "https://saogiay.example/jobs/SG-101",
  "confirmed": {
    "company": "Công ty Mô phỏng Sao Giấy",
    "role": "Thực tập sinh Phân tích dữ liệu",
    "meetingAddress": "Tòa nhà Demo A, Số 10 Đường Mẫu, tầng 4",
    "requirements": [
      { "kind": "fee_request", "quote": "đóng phí giữ suất phỏng vấn" }
    ]
  }
}
```

### Kết quả 200 (`VerifyResponse`)

| Trường | Ý nghĩa |
|---|---|
| `mode`, `simulated` | `simulated` là `true` ở chế độ `simulated`, `false` ở `live`. |
| `checkedOn` | Ngày kiểm tra chung của lượt đối chiếu. |
| `job` | Tin đăng, mục 3.1. |
| `location` | Địa điểm, mục 3.2. |
| `contact` | Người liên hệ, mục 3.3. |
| `invitation` | Lời mời và yêu cầu, mục 3.4. |
| `guidance` | Bước tiếp theo và câu hỏi để sao chép, mục 3.5. |
| `notices` | Thông báo về dữ liệu mô phỏng, hạ cấp dịch vụ, dữ kiện không khớp. |
| `historyId` | Id bản ghi lịch sử khi `save: true`, ngược lại `null`. |

VT-DEMO-01 (mô phỏng):

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
    "details": {
      "company": "Công ty Mô phỏng Sao Giấy",
      "role": "Thực tập sinh Phân tích dữ liệu",
      "jobCode": "SG-101",
      "postedOn": "2026-10-05",
      "closesOn": "2026-11-10",
      "reason": null
    }
  },
  "location": {
    "status": "company_unconfirmed",
    "basis": "Chỉ tìm thấy Tòa nhà Demo A. Chưa xác nhận công ty tại địa chỉ này.",
    "source": { "label": "Bản đồ mô phỏng", "url": null, "simulated": true },
    "checkedOn": "2026-11-21",
    "place": { "displayName": "Tòa nhà Demo A", "address": "Số 10 Đường Mẫu" },
    "mapUrl": "https://www.google.com/maps/search/?api=1&query=T%C3%B2a%20nh%C3%A0%20Demo%20A%2C%20S%E1%BB%91%2010%20%C4%90%C6%B0%E1%BB%9Dng%20M%E1%BA%ABu%2C%20t%E1%BA%A7ng%204"
  },
  "contact": {
    "status": "unverified",
    "basis": "Chưa có căn cứ về người liên hệ. Xác minh qua kênh tuyển dụng chính thức của công ty."
  },
  "invitation": {
    "status": "caution",
    "basis": "Lời mời yêu cầu một khoản phí. Cần xác minh trước khi chuyển tiền.",
    "requirements": [
      { "kind": "fee_request", "quote": "đóng phí giữ suất phỏng vấn" }
    ]
  },
  "guidance": {
    "nextStep": "Tạm dừng đóng phí. Xác minh mã tin hiện tại và địa điểm phỏng vấn qua kênh chính thức của công ty trước khi đi gặp.",
    "suggestedQuestion": "Em thấy tin SG-101 đã hết hạn. Anh/chị cho em xin mã tuyển dụng hiện tại, tên tòa nhà, số tầng và kênh tuyển dụng chính thức để em xác nhận lịch được không ạ?"
  },
  "notices": ["Dữ liệu mô phỏng: nguồn tin và bản đồ là giả lập, không phản ánh công ty thật."],
  "historyId": null
}
```

Đối chiếu với `expected` của VT-DEMO-01: `jobStatus = expired`, `locationStatus = company_unconfirmed`, `contactStatus = unverified`, `invitationStatus = caution`, `evidenceQuotes = ["đóng phí giữ suất phỏng vấn"]`. Bốn trạng thái và đoạn trích khớp. `suggestedQuestion` cùng ý nhưng khác chữ (xem mục 7).

### Biến thể của VT-DEMO-01 khi người dùng sửa ở bước xác nhận

Chỉ ghi phần khác với kết quả trên.

Người dùng bỏ chọn yêu cầu phí (`confirmed.requirements = []`). Lời mời chuyển sang quy tắc thứ 3 vì địa điểm chưa xác nhận công ty:

```json
{
  "invitation": {
    "status": "needs_verification",
    "basis": "Địa điểm hẹn chưa xác nhận được công ty. Cần hỏi lại qua kênh chính thức.",
    "requirements": []
  },
  "guidance": {
    "nextStep": "Xác minh mã tin hiện tại và địa điểm phỏng vấn qua kênh chính thức của công ty trước khi đi gặp."
  }
}
```

Người dùng sửa địa chỉ thành `Số 12 Đường Mẫu`. Bản đồ mô phỏng không áp dụng, tin đăng và lời mời giữ nguyên:

```json
{
  "location": {
    "status": "not_checked",
    "basis": "Chưa đối chiếu tự động. Mở bản đồ để tự kiểm tra địa chỉ.",
    "source": { "label": null, "url": null, "simulated": true },
    "checkedOn": null,
    "place": { "displayName": null, "address": null },
    "mapUrl": "https://www.google.com/maps/search/?api=1&query=S%E1%BB%91%2012%20%C4%90%C6%B0%E1%BB%9Dng%20M%E1%BA%ABu"
  },
  "guidance": {
    "nextStep": "Tạm dừng đóng phí. Xác minh mã tin hiện tại qua kênh chính thức của công ty trước khi đi gặp.",
    "suggestedQuestion": "Em thấy tin SG-101 đã hết hạn. Anh/chị cho em xin mã tuyển dụng hiện tại và kênh tuyển dụng chính thức để em xác nhận lịch được không ạ?"
  },
  "notices": [
    "Dữ liệu mô phỏng: nguồn tin và bản đồ là giả lập, không phản ánh công ty thật.",
    "Địa chỉ đã sửa khác địa chỉ trong ca mô phỏng nên bản đồ mô phỏng không áp dụng."
  ]
}
```

### Lỗi

422, `quote` không có trong lời mời (gửi `{ "kind": "fee_request", "quote": "chuyển khoản 500.000 đồng" }`):

```json
{ "error": { "code": "QUOTE_NOT_IN_SOURCE", "message": "Có đoạn trích không nằm trong nội dung lời mời.", "details": { "quotes": ["chuyển khoản 500.000 đồng"] } } }
```

503, gửi `"save": true` khi máy chủ chưa bật lịch sử:

```json
{ "error": { "code": "HISTORY_DISABLED", "message": "Lịch sử tra cứu chưa được bật trên máy chủ này." } }
```

400, thân không phải JSON hợp lệ:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Yêu cầu không hợp lệ." } }
```

Các lỗi 400 do schema (thiếu `confirmed`, `requirements` quá 10 mục, `kind` lạ) có cùng dạng như ở `extract`.

## 7. Điểm cần nhóm duyệt trước VT05

README đã đánh dấu VT05 xong. Nếu nhóm đổi một điểm dưới đây, cần sửa lại `shared/`, mã API và test tương ứng.

1. **Câu hỏi gợi ý của VT-DEMO-01 khác `expected`.** API trả "... tên tòa nhà, số tầng và **kênh tuyển dụng chính thức** ...", `cases.json` ghi "... tên tòa nhà, số tầng và **email phòng nhân sự** ...". Test chỉ so theo mẫu nên vẫn đạt. Nhóm chọn một cách nói và sửa bên còn lại.
2. ~~**Lời mời chỉ có khoảng trắng vẫn được nhận.**~~ *Đã sửa ngày 22/11/2026:* `invitationText` có thêm `pattern: "\\S"`, API trả 400 ở cả `extract` và `verify`. Có test trong `apps/api/test/api.test.ts`.
3. **Tin hết hạn không ảnh hưởng `invitation.status`.** Nếu tin `expired`, địa điểm `matched` và không có yêu cầu phí hay giấy tờ, lời mời là `no_signal_observed`. Nhóm cần quyết định tin hết hạn có nên đưa lời mời về `needs_verification` không.
4. **`contact.status = verified` chưa có tiêu chí.** Giá trị có trong enum nhưng không bao giờ trả. Chọn một: ghi tiêu chí xác minh (ví dụ email cùng tên miền với trang tuyển dụng chính thức), hoặc bỏ khỏi enum đến khi có tiêu chí để web không phải xử lý trạng thái chết.
5. **`SOURCE_MODE_UNSUPPORTED` không còn dùng.** Mã này có trong `ErrorCode` và schema lỗi, nhưng không endpoint nào trả. *Đã bỏ chỗ nhắc test 501 trong `design.md`.* Nhóm còn cần chọn: bỏ mã khỏi enum, hoặc giữ cho sau.
6. ~~**`design.md` lệch với mã ở `/healthz`.**~~ *Đã sửa:* ví dụ trong `design.md` có `modes: ["simulated", "live"]` và `capabilities`, kèm liên kết về tệp này và `openapi.json`.
7. **Hai nghĩa của "chưa kiểm tra" ở tin đăng.** `simulated`: link ngoài dữ liệu mô phỏng là `not_checked`. `live`: có link mà chưa có hạn nộp là `unavailable` (`reason = no_deadline`). Cả hai theo R4 và R22, nhưng web cần nhãn rõ để người dùng hiểu vì sao cùng một link lại có hai trạng thái.
8. **Khớp ca mẫu theo chuỗi `jobUrl` chính xác.** Thêm `/` cuối, đổi `http`/`https` hay thêm tham số thì không khớp, kết quả thành `not_checked`. Chấp nhận cho bản demo, hoặc chuẩn hóa URL trước khi so.
9. **Lỗi giao thức gộp chung vào `VALIDATION_ERROR`.** JSON hỏng và thân quá lớn đều dùng mã này với thông báo chung. Gọi sai phương thức trả 404 thay vì 405. Nhóm xác nhận web chỉ cần phân biệt theo `error.code`.
10. **Hai cách so `quote` khác nhau.** `verify` gom khoảng trắng trước khi so. `extract` điền `fields.meetingAddress.quote` bằng so chuỗi chính xác, nên địa chỉ có thêm khoảng trắng sẽ có `quote = null`. Nên dùng chung một hàm so.
11. **`requirements.md` bị cắt ở R23.** *Đã viết lại* theo hành vi của `buildGuidance` và các test, có ghi chú trong tệp. Nhóm cần rà nội dung này vì đoạn gốc không còn trong Git.
12. **Ổn định hợp đồng.** Đề xuất quy ước: trong `/api/v1` chỉ thêm trường tùy chọn hoặc giá trị enum mới, không đổi tên hay xóa. Web phải hiện trạng thái lạ như "Chưa rõ" thay vì lỗi. Đổi phá vỡ thì sang `/api/v2` và tăng `version` ở `/healthz`.
