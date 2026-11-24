# Triển khai Việc Thật trên EC2

Caddy phục vụ bản web đã build tại `/var/www/viec-that` và chuyển `/healthz`, `/api/*` đến API NestJS tại `127.0.0.1:3000`. Cấu hình dành cho Amazon Linux 2023. Cần một máy EC2, tên miền trỏ về máy đó và quyền quản trị trên máy.

## Chuẩn bị máy chủ

1. Dùng một bản Git xác định tại `/opt/viec-that`. Cài Node.js 24 (`nodejs24`, `nodejs24-npm`), Caddy và PostgreSQL theo môi trường của đội. Tạo user hệ thống `viecthat` và một role/database riêng cho ứng dụng. Cho user `viecthat` quyền đọc bản mã. Cho user `caddy` quyền đọc thư mục web.
2. Trong thư mục mã, chạy `npm ci --include=dev` rồi `npm run build`. API chạy TypeScript qua `tsx`. Chép nội dung `apps/web/dist/` vào `/var/www/viec-that/`.
3. Tạo `/etc/viec-that/api.env` với quyền `0600` và chủ tệp `root`. Cấu hình bên dưới dùng HTTPS phía Caddy và PostgreSQL đã cấp cho ứng dụng. Thay giá trị `DATABASE_URL` bằng kết nối thật. API tự chạy migration khi khởi động.

   ```dotenv
   HOST=127.0.0.1
   PORT=3000
   DATABASE_URL=postgres://ROLE:PASSWORD@127.0.0.1:5432/DATABASE
   TRUST_PROXY=true
   COOKIE_SECURE=true
   ```

   Khi có quyền Bedrock, đặt `AWS_REGION` và `BEDROCK_MODEL_ID`. Máy EC2 nhận quyền gọi mô hình từ IAM role của đội. Khi có khóa Vietmap, đặt `VIETMAP_API_KEY`. Để trống thì địa điểm chạy chế độ dự phòng. Nút **Mở bản đồ** vẫn dùng được khi có địa chỉ.

4. Cài unit systemd và Caddyfile với quyền `0644`. Trong cấu hình bổ sung của dịch vụ Caddy (`sudo systemctl edit caddy`), đặt tên miền thực tế bằng biến `VIECTHAT_SITE`.

   ```bash
   sudo install -m 0644 deploy/viec-that.service /etc/systemd/system/viec-that.service
   sudo install -m 0644 deploy/Caddyfile /etc/caddy/Caddyfile
   ```

   ```ini
   [Service]
   Environment=VIECTHAT_SITE=viec-that.example.org
   ```

5. Security Group mở TCP `80` và `443` cho người thử. Giới hạn `22` cho IP quản trị. Sau khi DNS trỏ đúng máy và thay tên miền mẫu, khởi động dịch vụ.

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable viec-that caddy
   sudo systemctl restart viec-that caddy
   sudo systemctl status viec-that caddy
   ```

## Thu bằng chứng nghiệm thu

- Mở trang web và `/healthz` qua HTTPS từ mạng ngoài đội. Xác nhận API trả `status: ok`, `history.enabled` theo cấu hình và `capabilities` phù hợp với dịch vụ đã bật.
- Trên Safari iPhone qua 4G/5G, thử một lời mời mới, mở bản đồ, sao chép câu hỏi, lưu và xóa lịch sử. Ghi mẫu máy, phiên bản iOS, URL, ngày giờ, kết quả và lỗi gặp phải.
- Với VT15, cho người thử làm cùng một tình huống bằng tra cứu thủ công và bằng ứng dụng. Ghi thời gian từ khi đọc tình huống đến khi chọn hành động, hành động đã chọn, và bước bị vướng. Mỗi hành động đúng cần khớp căn cứ của ca, ví dụ tạm dừng chuyển phí và xác minh qua kênh tuyển dụng chính thức.
- Ghi mã phiên bản bằng `git rev-parse HEAD` trên bản được triển khai. Dùng đúng bản này để quay video, kiểm tra lại đường dẫn và lập hồ sơ nộp.
