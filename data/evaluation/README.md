# Kiểm thử lời mời ngoài bốn ca demo

`novel-invitations.json` gồm 20 lời mời tự tạo dựa trên các kiểu nhập có thể gặp. Bộ này kiểm tra chữ không dấu, viết tắt, trộn tiếng Anh, số tiền có dấu phân tách, câu phủ định, yêu cầu OTP và văn bản thiếu dữ kiện. Mỗi ca có nhãn kỳ vọng để kiểm thử. API chỉ nhận lời mời và dữ kiện đầu vào như địa chỉ hoặc hạn nộp. Hai trường `status` và `signals` chỉ được đọc trong test.

```powershell
npm run test -w apps/api -- test/novel-invitations.test.ts
```

Chạy theo chế độ `live` với AI và Maps tắt để kiểm tra luật dự phòng qua hai endpoint. Bản trước sửa đạt **3/16** ca ban đầu. Sau sửa, cả **16/16** ca ban đầu và **4/4** ca bổ sung đều đạt. Bộ ca đã được dùng để sửa lỗi, nên điểm sau sửa là kết quả kiểm thử hồi quy. Muốn ước lượng khả năng xử lý lời mời mới, cần một tập độc lập do người khác chuẩn bị.

## Thu thập dữ liệu thực cho vòng tiếp theo

1. Mời người dùng đồng ý cung cấp lời mời và loại số điện thoại, email cá nhân, số tài khoản, giấy tờ, mã xác thực và liên kết riêng trước khi lưu mẫu. Với tin tuyển công khai, ghi link, ngày kiểm tra và dữ kiện tối thiểu được phép dùng. Tin TopCV trong `data/demo/README.md` là ví dụ về kiểm tra hạn nộp.
2. Nhờ hai người ghi nhãn độc lập theo **yêu cầu thể hiện trong lời mời**, chẳng hạn yêu cầu chuyển tiền, gửi giấy tờ hoặc cung cấp mã xác thực. Ghi `chưa đủ thông tin` khi dữ kiện thiếu. Thống nhất nhãn sau khi so lại đoạn trích. Phân loại người gửi là lừa đảo cần nguồn xác minh riêng.
3. Giữ một tập kiểm thử tách theo nguồn gửi hoặc thời gian và bỏ mẫu trùng nội dung. Đánh giá riêng luật dự phòng và Bedrock khi có quyền. Theo dõi tỷ lệ cảnh báo đúng trong số cảnh báo đã phát, tỷ lệ tín hiệu thật được tìm ra, tỷ lệ đoạn trích có căn cứ và tỷ lệ trả `chưa đủ thông tin`.
