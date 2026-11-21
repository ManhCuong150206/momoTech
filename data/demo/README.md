# Dữ liệu demo Việc Thật

## Dùng ngay để dựng giao diện và kiểm tra logic

`cases.json` chứa một ca demo chính và ba ca đối chứng. Mỗi ca có `input` là dữ liệu nhập, `fixtures` là phản hồi nguồn mô phỏng và `expected` là kết quả mong đợi. Cố định ngày xử lý mô phỏng bằng `demoAsOf` để trạng thái hết hạn không đổi khi chạy lại. Mọi tên công ty, địa chỉ và nguồn trong tệp là dữ liệu mô phỏng. Các URL `.example` chỉ dùng làm mẫu.

| Ca | Trọng tâm |
|---|---|
| VT-DEMO-01 | Tin hết hạn, bản đồ chỉ trả tòa nhà và lời mời có yêu cầu phí. |
| VT-DEMO-02 | Tin còn mở, địa điểm khớp, người liên hệ vẫn chưa được xác minh. |
| VT-DEMO-03 | Nơi phỏng vấn là văn phòng dùng chung, khác trụ sở đăng ký. |
| VT-DEMO-04 | Link cần đăng nhập và chưa có địa chỉ. |

Dùng `fixtures` để dựng bản mô phỏng và dùng `expected` để đối chiếu trong kiểm thử. Khi chạy AI thật, gửi dữ kiện đầu vào và phản hồi nguồn phù hợp với chế độ chạy cho mô hình. Giữ trường `expected` ở phía kiểm thử. So trạng thái và bằng chứng, chấp nhận câu hướng dẫn khác chữ nhưng cùng ý. Gắn nhãn “Dữ liệu mô phỏng” khi dùng các ca này trong giao diện hoặc video.

## Mẫu nguồn thật dùng riêng

**TopCV, tin j1095867.** Trang nguồn ghi hạn ứng tuyển **30/09/2026** và hiển thị trạng thái **“Hết hạn ứng tuyển”** khi đối chiếu ngày 21/11/2026. Dùng như ca kiểm tra riêng cho trường ngày và trạng thái tin đăng. Không nối tin này với lời đòi phí, địa chỉ hư cấu hoặc cáo buộc. Khi quay demo, mở lại trang nguồn vì trạng thái có thể thay đổi. [Tin đăng TopCV](https://www.topcv.vn/brand/topcv/tuyen-dung/chuyen-vien-kinh-doanh-mang-tu-van-tuyen-dung-j1095867.html)

## Nguồn tham khảo cho mở rộng dữ liệu

| Nguồn | Giá trị cho Việc Thật | Quyết định cho bản demo |
|---|---|---|
| **TopCV** | Mẫu cách hiển thị công ty, vị trí, hạn nộp và trạng thái hết hạn. | Ghi link và thông tin trạng thái tối thiểu. Dùng tin riêng ở trên để rà thủ công. |
| **LinkedIn Jobs** | Tham chiếu việc đối chiếu tin mà ứng viên tự tìm được. | Ứng viên có thể cung cấp link và phần nội dung họ được phép dùng. Chưa tích hợp tự động. Điều khoản giới hạn khai thác tự động và sao chép dữ liệu. |
| **VietJobs, LREC 2026** | **48.092 tin tuyển dụng tiếng Việt** giúp khảo sát từ ngữ và kiểm thử trích vị trí, địa điểm hoặc yêu cầu. Các trường công bố phục vụ phân tích tin tuyển, chưa thấy nhãn gian lận phù hợp cho bài toán này. | Xem là nguồn ứng viên cho đánh giá đọc tiếng Việt. Kho dự án ghi MIT, cần đối chiếu phạm vi quyền áp dụng cho bản dữ liệu trước khi đưa các mẫu vào ZIP bài thi. |
| **EMSCAD, bản Real / Fake Job Posting Prediction trên Kaggle** | **17.880 tin** giai đoạn 2012–2014, trong đó **866** được gán nhãn gian lận. Nguồn nghiên cứu đối chứng cho phân loại tin tuyển và dữ liệu mất cân bằng. | Giống nhau ở chủ đề tuyển dụng nhưng khác ngôn ngữ, thời điểm và đơn vị phân tích. Nhãn đánh giá tin đăng, chưa đánh giá người nhắn riêng, địa chỉ hẹn hoặc hiệu lực tin hôm nay. Chưa nhập bản dữ liệu và cần xác nhận quyền tái sử dụng với nguồn gốc. |

Nguồn kiểm chứng: [Điều khoản TopCV](https://www.topcv.vn/terms-of-service) · [Điều khoản LinkedIn Jobs](https://www.linkedin.com/legal/jobs-terms-conditions) · [Bài báo VietJobs](https://aclanthology.org/2026.lrec-1.501/) · [Kho VietJobs](https://github.com/VinNLP/VietJobs) · [Bản dữ liệu VietJobs](https://huggingface.co/datasets/dinhieufam/VietJobs) · [Bản Kaggle](https://www.kaggle.com/datasets/shivamb/real-or-fake-fake-jobposting-prediction) · [Bài báo EMSCAD gốc](https://www.mdpi.com/1999-5903/9/1/6)

Các bộ nghiên cứu bên ngoài chưa được tải hoặc đưa vào huấn luyện. Bốn ca mô phỏng dùng để phát triển và kiểm tra luồng. Khi đo chất lượng AI, nhóm cần thêm ca mới được thành viên rà độc lập.
