# Kế hoạch triển khai: Luồng đầu tiên

Ánh xạ sang [danh sách task trong README.md](../../../README.md#4-danh-sách-công-việc): mục 1–3 là **VT04**, mục 4–5 là **VT05**, mục 6–7 là **VT06**.

- [x] 1. Chốt kiểu dữ liệu dùng chung trong `shared/contract.ts` (VT04)
- [x] 2. Viết JSON Schema vào/ra trong `shared/schemas.ts`, ví dụ và mã lỗi trong `design.md` (VT04)
- [x] 3. Nạp `data/demo/cases.json`, tách `fixtures` khỏi `expected` (VT04)
- [x] 4. Dựng API Fastify: `GET /healthz`, `extract`, `verify`, `demo/cases`, xử lý lỗi thống nhất (VT05)
- [x] 5. Dựng web React + Vite + TypeScript, proxy `/api` và `/healthz`, workspace npm, `.env.example` (VT05)
- [x] 6. Form nhập, màn hình xác nhận và sửa dữ kiện, màn hình kết quả, nút sao chép (VT06)
- [x] 7. Kiểm thử bốn ca theo `expected` ở API và luồng VT-DEMO-01, 02, 04 ở web (VT06)
- [ ] 8. Thử trên Safari iPhone thật (còn mở, thuộc tiêu chí hoàn thành của VT06)

## Mở rộng: lịch sử tra cứu (PostgreSQL)

- [x] 9. Hợp đồng và schema cho `save`, `historyId`, `/api/v1/history*`, `HISTORY_DISABLED`
- [x] 10. Migration `001_create_checks.sql`, bộ chạy migration, lớp truy cập `db.ts` và `history.ts`
- [x] 11. Endpoint lưu, liệt kê, xem, xóa một mục, xóa nhiều mục, cookie thiết bị, tự hết hạn
- [x] 12. Web: hộp chọn lưu, tab Lịch sử, chọn nhiều, xác nhận xóa, xem lại kết quả
- [x] 13. Kiểm thử bằng PGlite (API và web)
- [x] 14. Chạy migration và thử lưu, xem, xóa trên PostgreSQL 18 thật (database `viecthat`, role `viecthat`)
## Mở rộng: chế độ live (VT07 đến VT11, mã xong, chờ dịch vụ thật)

- [x] 15. Bộ trích Bedrock Converse, loại mục thiếu trích dẫn, gộp với luật cố định (VT07)
- [x] 16. Client Google Places, so tên công ty và địa chỉ (VT08)
- [x] 17. Đối chiếu tin đăng từ dữ kiện người dùng nhập, ngày theo giờ Việt Nam (VT09)
- [x] 18. Câu hỏi và bước tiếp theo theo dữ kiện thiếu, yêu cầu giấy tờ cá nhân (VT10)
- [x] 19. Web: tự chọn chế độ, ô nhập dữ kiện tin, thông báo gửi AI, nhãn mới (VT11)
- [x] 20. Hạ cấp có thông báo khi thiếu dịch vụ, giới hạn tần suất, giới hạn lịch sử
- [ ] 21. Gọi Bedrock thật và Places thật rồi chạy ``npm run check:services`` (cần VT02, VT03)
- [ ] 22. Thử lời mời mới bằng AI thật trên iPhone (VT11, VT15)

## Rà soát sau VT03 (22/11/2026)

- [x] 23. Hợp đồng API `docs/API-CONTRACT.md` với ví dụ VT-DEMO-01 lấy từ phản hồi thật và danh sách điểm cần nhóm duyệt (VT04)
- [x] 24. Chặn lời mời chỉ có khoảng trắng ở API (R1)
- [x] 25. Thêm dòng `notices` khi Places lỗi giữa chừng (R19)
- [x] 26. Test giao diện: thiếu hạn nộp, đã đóng tuyển, Places lỗi, AI lỗi
- [x] 27. Thẻ Tin đăng có nút mở link tham chiếu (chỉ http, https)
- [x] 28. OpenAPI 3.1 `docs/openapi.json` sinh từ `shared/schemas.ts`, có test chống lệch
- [x] 29. Viết lại R23 bị cắt và cập nhật `design.md` theo mã
- [x] 30. Cấu hình Caddy, systemd và kịch bản k6 chạy local (VT12, VT14 phần chuẩn bị)
- [x] 31. Bộ 20 lời mời ngoài ca demo cho luật dự phòng (`data/evaluation/`)
- [ ] 32. Nhóm duyệt các điểm còn mở ở mục 7 của `docs/API-CONTRACT.md`
- [ ] 33. Triển khai EC2 và HTTPS công khai (VT12), đo k6 trên bản triển khai (VT14)

## Chuyển API sang NestJS (24/11/2026)

- [x] 34. Gộp nhánh `BE` và thay `apps/api` (Fastify) bằng NestJS, dùng chung `shared/` và `data/demo/cases.json`
- [x] 35. Đưa Bedrock (VT07), `HOST`, `TRUST_PROXY`, `DELETE /api/v1/history/:id`, `?limit=` và `HISTORY_MAX_PER_DEVICE` sang NestJS
- [x] 36. Địa điểm dùng Vietmap thay Google Places (VT08)
- [x] 37. `test/harness.ts` cho test API và web, chuyển các test cũ sang NestJS
- [ ] 38. Gọi Vietmap thật bằng `npm run check:services` khi có khóa

## Quyết định mục 7 của hợp đồng API (25/11/2026)

- [x] 39. Câu hỏi gợi ý VT-DEMO-01 dùng "kênh tuyển dụng chính thức"
- [x] 40. Tin hết hạn cho lời mời `caution`
- [x] 41. `contact.verified` khi email hoặc số điện thoại người gửi trùng trang tuyển dụng chính thức, web có mục nhập
- [x] 42. Xóa `SOURCE_MODE_UNSUPPORTED`
- [x] 43. Chuẩn hóa URL trước khi so ca mẫu
- [x] 44. 405 `METHOD_NOT_ALLOWED` kèm `Allow`, 413 có thông báo riêng
- [x] 45. Quy ước ổn định hợp đồng, web hiện "Chưa rõ" cho enum lạ