# Feature Spec: Luồng đầu tiên của Việc Thật

## Phạm vi và ánh xạ task

Spec này phủ ba task trong [danh sách task trong README.md](../../../README.md#4-danh-sách-công-việc).

| Task | Tên trong danh sách task | Phần trong spec này |
|---|---|---|
| **VT04** | Chốt schema vào/ra | Hợp đồng API cho `extract`, `verify`, `healthz` ([design.md](design.md)). Mã nguồn: `shared/contract.ts`, `shared/schemas.ts`. |
| **VT05** | Tạo khung React và Fastify | `apps/web` (React + Vite + TypeScript), `apps/api` (NestJS + TypeScript, thay Fastify từ 24/11/2026), `GET /healthz`, cấu hình mẫu `.env.example`. |
| **VT06** | Tạo form lời mời và màn hình xác nhận | Màn hình nhập, màn hình sửa dữ kiện, màn hình kết quả với phần sao chép câu hỏi. |

Ngoài phạm vi của ba task trên: triển khai AWS (VT12), k6, Street View, đọc ảnh. Chế độ live (VT07–VT11) và lịch sử tra cứu được thêm ở các mục dưới đây.

## Yêu cầu

**R1. Nhập lời mời.** Người dùng dán nội dung lời mời, có thể điền link tin tuyển dụng và địa chỉ hẹn. Nội dung rỗng hoặc chỉ có khoảng trắng bị chặn ở web và ở API (HTTP 400).

**R2. Trích và xác nhận dữ kiện.** `extract` trả công ty, vị trí, địa chỉ hẹn, link tin và danh sách yêu cầu cần xác minh. Người dùng sửa công ty, vị trí, địa chỉ và bỏ chọn yêu cầu trước khi đối chiếu.

**R3. Kết quả riêng cho từng phần.** `verify` trả bốn mục độc lập: tin đăng (`job`), địa điểm (`location`), người liên hệ (`contact`) và lời mời kèm yêu cầu (`invitation`). Mỗi mục có `status` và `basis`. Tin đăng và địa điểm có thêm nguồn và ngày kiểm tra.

**R4. Quy tắc trạng thái.**
- `job.status = expired` chỉ khi hạn nộp đã qua so với ngày kiểm tra, hoặc nguồn ghi rõ đã đóng tuyển.
- Nguồn không đọc được (ví dụ cần đăng nhập) cho `unavailable`. Chưa có link hoặc link ngoài dữ liệu mô phỏng cho `not_checked`.
- `location.status = company_unconfirmed` khi chỉ thấy tòa nhà, không gian dùng chung, hoặc công ty tại địa chỉ khác công ty đã xác nhận.
- `contact.status` giữ `unverified` khi chưa có căn cứ về người liên hệ, kể cả khi tin và địa chỉ khớp. Chỉ `verified` khi email hoặc số điện thoại của người gửi trùng với thông tin liên hệ trên trang tuyển dụng chính thức (LinkedIn, TopCV, trang của công ty) do người dùng nhập.
- Tin `expired` đưa lời mời về `caution`.

**R5. Đoạn trích có nguồn.** Mọi yêu cầu có `quote` nguyên văn từ lời mời. `verify` trả HTTP 422 `QUOTE_NOT_IN_SOURCE` nếu một `quote` không nằm trong `invitationText`.

**R6. Hướng dẫn.** `guidance` có một bước tiếp theo và một câu hỏi xác minh dựa trên dữ kiện đang thiếu. Người dùng sao chép được câu hỏi bằng một nút.

**R7. Nhãn mô phỏng.** Mọi phản hồi dùng nguồn giả lập có `simulated: true`. Web hiện nhãn "Dữ liệu mô phỏng" ở ca mẫu, màn hình xác nhận và kết quả.

**R8. Chế độ chạy.** `mode = simulated` dùng `fixtures` của ca mẫu. `mode = live` xử lý nội dung người dùng tự nhập và luôn nói rõ phần nào đã hạ cấp khi thiếu dịch vụ ngoài (R19). Web tự chọn `simulated` khi người dùng bấm ca mẫu nguyên bản và `live` trong mọi trường hợp khác.

**R9. Dữ liệu demo.** `fixtures` dựng nguồn mô phỏng. `expected` chỉ dùng trong kiểm thử. API `GET /api/v1/demo/cases` không trả `fixtures` hay `expected`.

**R10. Quyền nguồn.** Link sàn việc làm (TopCV, LinkedIn) chỉ là tham chiếu do người dùng nhập. Không có mã thu thập tự động từ các sàn này.

**R11. Riêng tư.** Nhật ký máy chủ không ghi nội dung lời mời hay nội dung yêu cầu. Nội dung chỉ nằm trong cơ sở dữ liệu khi người dùng bật lưu lịch sử (R13).

**R12. Lỗi.** Mọi lỗi dùng một dạng `{ "error": { "code", "message", "details?" } }` với thông báo tiếng Việt.

## Lịch sử tra cứu (mở rộng, PostgreSQL)

**R13. Lưu có chủ đích.** `verify` nhận `save: true` thì lưu lời mời, dữ kiện đã xác nhận và kết quả vào PostgreSQL, trả `historyId`. Mặc định không lưu. Web có hộp chọn "Lưu vào lịch sử" (mặc định tắt). Ngay dưới hộp chọn ghi rõ có lưu nội dung lời mời và thời hạn tự xóa. Server tự tính lại kết quả rồi mới lưu, không nhận kết quả từ client.

**R14. Xem lại.** Người dùng xem danh sách (mới nhất trước) với tên công ty và vị trí, thời điểm, trạng thái lời mời, tin đăng, địa điểm. Mở một mục thì thấy lại lời mời đã nhập và đủ kết quả, kể cả câu hỏi để sao chép.

**R15. Xóa do người dùng chọn.** Chọn một hoặc nhiều mục (hoặc tất cả), có bước xác nhận, rồi xóa vĩnh viễn khỏi cơ sở dữ liệu. Mục không chọn được giữ nguyên.

**R16. Phạm vi theo thiết bị, không đăng nhập.** Mỗi trình duyệt có một mã ngẫu nhiên 256 bit trong cookie `vt_device` (HttpOnly, SameSite=Lax, Secure khi chạy HTTPS, hạn 1 năm). Cơ sở dữ liệu chỉ lưu SHA-256 của mã. Một thiết bị không đọc hay xóa được bản ghi của thiết bị khác (trả 404). Xóa cookie thì mất quyền xem lại.

**R17. Tự hết hạn.** Mỗi bản ghi có `expires_at` (mặc định 30 ngày, đổi bằng `HISTORY_TTL_DAYS`). Bản ghi quá hạn không hiện ra và bị dọn khi khởi động và mỗi giờ.

**R18. Tùy chọn.** Không đặt `DATABASE_URL` thì API chạy như trước, `/healthz` báo `history.enabled = false`, web ẩn mục Lịch sử, `save: true` trả 503 `HISTORY_DISABLED`.

## Chế độ live: AI, địa điểm, tin đăng (VT07 đến VT11)

**R19. Hạ cấp có thông báo.** Thiếu `BEDROCK_MODEL_ID` thì chỉ dùng luật cố định để trích yêu cầu. Thiếu `VIETMAP_API_KEY` thì địa điểm là `not_checked` (Chưa đối chiếu tự động) kèm nút mở bản đồ. Dịch vụ lỗi giữa chừng thì phần đó là `unavailable` hoặc quay về luật cố định, các phần khác vẫn có kết quả, không trả 500. Mọi trường hợp đều có dòng trong `notices`.

**R20. AI chỉ trả dữ kiện có nguồn (VT07).** Bedrock Converse với công cụ bắt buộc, nhiệt độ 0. Mỗi mục AI cần có đoạn trích trong lời mời. Máy chủ báo số mục bị loại, kể cả trích đoạn bị tách khỏi câu phủ định rõ ràng. Luật cố định chạy trên chữ có dấu và không dấu, nhận diện một số cách viết tắt về phí, giấy tờ và mã xác thực. Trạng thái do máy chủ quyết định theo dữ kiện. Chỉ văn bản lời mời được gửi tới AI.

**R21. Địa điểm (VT08).** Tìm bằng Vietmap theo tên công ty và địa chỉ (bỏ phần tầng, phòng khi tra). `matched` chỉ khi tên công ty khớp và địa chỉ trả về khớp địa chỉ hẹn. Công ty ở địa chỉ khác, chỉ thấy tòa nhà, hoặc không có kết quả đều là `company_unconfirmed`.

**R22. Tin đăng (VT09).** Việc Thật không tự đọc trang TopCV, LinkedIn hay sàn khác. Người dùng nhập hạn nộp, ngày đăng, mã tin và trạng thái đóng tuyển mà họ thấy. `expired` chỉ khi hạn đã qua (theo giờ Việt Nam) hoặc tin ghi rõ đã đóng. Có link mà chưa có dữ kiện thì `unavailable` (Chưa kiểm tra được).

**R23. Hướng dẫn (VT10).** Câu hỏi và bước tiếp theo sinh từ dữ kiện đang thiếu. Yêu cầu cung cấp mã xác thực hoặc phí đưa lời mời về `caution`. Yêu cầu gửi giấy tờ cá nhân cho `needs_verification` khi chưa có tín hiệu `caution` và thêm hướng dẫn giữ giấy tờ. Khi tin chưa kiểm tra được và địa điểm chưa khớp, hệ thống dùng `insufficient_information` nếu chưa có tín hiệu cụ thể cần xử lý. Câu hỏi luôn xin kênh tuyển dụng chính thức. Tin `expired` thì câu hỏi nêu mã tin nếu có. Địa điểm `company_unconfirmed` thì câu hỏi xin tên tòa nhà (hoặc đơn vị đặt phòng khi hẹn ở văn phòng dùng chung) và số tầng. Công ty đã biết thì bỏ qua câu hỏi tên công ty.

*Ghi chú: đoạn R23 trong bản commit `d03b258` bị cắt sau chữ "thêm bước". Nội dung trên được viết lại theo hành vi của `buildGuidance` trong `apps/api/src/verify.ts` và các test trong `apps/api/test/live.test.ts`. Nhóm cần rà lại.*

## Tiêu chí nghiệm thu

| Ca | Điều kiện đạt |
|---|---|
| **VT-DEMO-01** (chính) | Nhập lời mời, sửa được dữ kiện, thấy tin `expired`, địa điểm `company_unconfirmed`, trích dẫn "đóng phí giữ suất phỏng vấn", người liên hệ `unverified`. Sao chép được câu hỏi có mã `SG-101`. |
| **VT-DEMO-02** | Địa điểm `matched`, tin `open`, người liên hệ vẫn `unverified`. |
| **VT-DEMO-03** | Địa điểm `company_unconfirmed`, lời mời `needs_verification`, câu hỏi nêu đơn vị đặt phòng và số tầng. |
| **VT-DEMO-04** | Tin `unavailable` vì cần đăng nhập, địa điểm `not_checked`, lời mời `insufficient_information`. |
