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