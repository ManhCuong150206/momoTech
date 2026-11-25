# Việc Thật — MoMo Tech Contest 2026

Web tiếng Việt giúp sinh viên đối chiếu lời mời việc làm, tin đăng và địa điểm phỏng vấn trước khi đi gặp, gửi giấy tờ hoặc chuyển tiền. Chủ đề Chống lừa đảo. Tối ưu cho Safari iPhone.

Đây là tài liệu chính. Hai phần để riêng vì là luồng riêng:

| Tài liệu | Nội dung |
|---|---|
| [Feature Spec luồng đầu tiên](.kiro/specs/viec-that-luong-dau/requirements.md) | Yêu cầu, thiết kế (schema, ví dụ JSON, mã lỗi, lịch sử, chế độ live) và kế hoạch của luồng nhập, xác nhận, đối chiếu. Đặt trong `.kiro/specs/` theo định dạng Spec của Kiro. Gồm [`requirements.md`](.kiro/specs/viec-that-luong-dau/requirements.md), [`design.md`](.kiro/specs/viec-that-luong-dau/design.md), [`tasks.md`](.kiro/specs/viec-that-luong-dau/tasks.md). |
| [Dữ liệu demo](data/demo/README.md) | Bốn ca mô phỏng, mẫu TopCV và danh sách nguồn dữ liệu ngoài kèm quyền sử dụng. Nằm cạnh [`cases.json`](data/demo/cases.json). |
| [Kiểm thử lời mời mới](data/evaluation/README.md) | 20 ca riêng để kiểm tra luật dự phòng trên cách viết và tình huống ngoài bốn ca demo. |

## Mục lục

1. [Trạng thái hiện tại](#1-trạng-thái-hiện-tại)
2. [Bối cảnh và môi trường](#2-bối-cảnh-và-môi-trường)
3. [Đặc tả bản thi](#3-đặc-tả-bản-thi)
4. [Danh sách công việc](#4-danh-sách-công-việc)
5. [Lộ trình từ số 0 đến bản nộp](#5-lộ-trình-từ-số-0-đến-bản-nộp)
6. [Chạy trên máy](#6-chạy-trên-máy)
7. [Kiểm tra dịch vụ ngoài (VT02, VT03)](#7-kiểm-tra-dịch-vụ-ngoài-vt02-vt03)
8. [Bàn giao cho Kiro](#8-bàn-giao-cho-kiro)
9. [Khai báo tài sản và AI (bản nháp VT18)](#9-khai-báo-tài-sản-và-ai-bản-nháp-vt18)

---

## 1. Trạng thái hiện tại

Cập nhật ngày 25/11/2026.

**Đã làm và đã kiểm tra**
- Hợp đồng API (VT04): kiểu TypeScript và JSON Schema trong `shared/`, ví dụ và mã lỗi trong `design.md`.
- Khung chạy (VT05): React + Vite + TypeScript, NestJS + TypeScript (thay Fastify từ 24/11/2026), `/healthz`, npm workspaces, `.env.example`.
- Giao diện (VT06): nhập lời mời, sửa dữ kiện, xem kết quả bốn phần (tin đăng, địa điểm, lời mời, người liên hệ), sao chép câu hỏi, mở bản đồ.
- Bốn ca mô phỏng chạy đúng `expected` ở API. VT-DEMO-01, 02, 04 chạy hết luồng ở giao diện.
- Lịch sử tra cứu bằng PostgreSQL: lưu theo thiết bị (cookie ẩn danh), xem lại, chọn và xóa từng mục, tự hết hạn sau 30 ngày, tối đa 100 bản mỗi thiết bị. Đã thử trên PostgreSQL 18 thật.
- Chế độ live (mã VT07 đến VT11): AI đọc lời mời qua Bedrock, địa điểm qua Vietmap, tin đăng từ dữ kiện người dùng nhập, hạ cấp có thông báo khi thiếu dịch vụ, giới hạn 30 yêu cầu mỗi phút mỗi IP.
- Kiểm thử local: API 123 test, web 25 test, typecheck và build đạt. Các test của AI và Vietmap dùng bản giả lập.
- Caddy phục vụ được bản build và chuyển tiếp API ở local. k6 đo đủ 600 luồng mô phỏng với 0 lỗi HTTP. Xem [triển khai](deploy/README.md) và [kiểm thử tải](#kiểm-thử-tải-local-vt14).

**Chưa làm hoặc chưa kiểm chứng**
- VT02, VT03: chưa có bằng chứng về quyền Bedrock, EC2/HTTPS và hạn mức AWS. Địa điểm chuyển từ Google Places (trả `403 PERMISSION_DENIED`) sang Vietmap, chưa có khóa Vietmap để gọi thật. Xem [mục 7](#7-kiểm-tra-dịch-vụ-ngoài-vt02-vt03).
- VT07, VT08: mã đã xong nhưng chưa gọi Bedrock và Vietmap thật.
- VT06, VT15: chưa thử trên Safari iPhone thật.
- VT12, VT14: đã chuẩn bị cấu hình máy chủ và đo tải local. Còn triển khai EC2, đo trên bản chạy công khai và thu bằng chứng để hoàn thiện hồ sơ nộp.
- Chưa commit các thay đổi ngày 22/11/2026. Git có 2 commit, mới nhất là `6a86e78`.

| Mốc | Task | Trạng thái |
|---|---|---|
| 1. Biết sản phẩm cần trả lời gì | VT01 | Xong. Dữ liệu có sẵn từ trước. Cần nhóm xác nhận câu mục tiêu và đọc lại bốn ca. |
| 2. Kiểm tra máy và dịch vụ | VT02, VT03 | Máy phát triển xong. AWS và Google chờ nhóm. |
| 3. Bản chạy đầu tiên trên máy | VT04 đến VT06 | Xong, trừ thử trên Safari iPhone. |
| 4. Thay mô phỏng bằng xử lý thật | VT07 đến VT11 | Mã và test xong. Chờ Bedrock và Vietmap thật. |
| 5. Đưa lên mạng và kiểm tra | VT12 đến VT17 | Cấu hình Caddy và bài đo k6 đã chạy local. Còn EC2, HTTPS công khai và kiểm thử iPhone. |
| 6. Nộp và duy trì | VT18 đến VT20 | Chưa bắt đầu. |

---

## 2. Bối cảnh và môi trường

**Môi trường đã chốt**
- Antigravity để trao đổi và rà soát. Kiro IDE hỗ trợ triển khai giai đoạn giữa và cuối. VS Code là trình soạn thảo đã dùng trong quy trình trước.
- TypeScript cho web. Nhóm kiểm thử bằng iPhone. Phương án triển khai là Amazon EC2 chạy Amazon Linux 2023 trong AWS Sandbox, với HTTPS công khai nếu quyền Sandbox cho phép.
- BTC cấp IAM User cho AWS Sandbox và hướng dẫn đăng nhập Kiro qua AWS IAM Identity Center. Vùng, quyền, dịch vụ AI và hạn mức cần xác minh ở tài khoản đội.
- Tech Contest chủ đề Chống lừa đảo. Hạn nộp **23:59:59 ngày 03/12/2026 GMT+7**, mục tiêu nội bộ 02/12. Duy trì sản phẩm đến hết **11/12/2026**. Ban giám khảo phải tự thử được sản phẩm online. AI phải tạo giá trị cốt lõi.

**Phạm vi**
- Trợ lý AI giúp sinh viên xác minh lời mời việc làm trước khi đi phỏng vấn, gửi giấy tờ hoặc chuyển tiền.
- Bản thi đối chiếu lời mời, công ty, địa điểm và tin đăng. Hiện ngày đăng hoặc hạn tuyển khi có dữ kiện, nguồn tra cứu và câu hỏi xác minh để người dùng tự gửi.
- Ca demo chính dùng một tin có thật từng đăng nhưng đã hết hạn, địa điểm chưa xác nhận công ty và lời mời đòi phí giữ chỗ. Mỗi phần được đánh giá bằng nguồn riêng.
- Bản đồ là phần chính. Street View, đọc ảnh, đánh giá địa điểm và Phím tắt iPhone là phần mở rộng tùy điều kiện.
- Stack: React, Vite, NestJS, TypeScript. Bedrock và Vietmap cần xác nhận quyền và hạn mức. Bản đầu xử lý từng yêu cầu. Lịch sử tra cứu dùng PostgreSQL (mở rộng đã thêm).

---

## 3. Đặc tả bản thi

### Luồng sử dụng

1. Dán lời mời nhận qua tin nhắn, điền link tin tuyển và địa chỉ hẹn nếu có. Nếu chỉ có ảnh, bản đầu cho dán phần chữ nhìn thấy. Đọc ảnh là phần bổ sung.
2. AI trích tên công ty, vị trí tuyển, địa chỉ hẹn, kênh liên hệ và yêu cầu như đóng phí. Người dùng xem lại và sửa trước khi tra cứu.
3. Web đối chiếu từng phần rồi hiển thị **tin đăng**, **địa điểm**, **lời mời** và **người liên hệ**. Mỗi kết quả ghi nguồn và thời điểm kiểm tra khi có. Thiếu dữ kiện ở phần nào thì ghi rõ ở phần đó.
4. AI gợi ý câu hỏi xác minh và bước tiếp theo. Người dùng sao chép câu hỏi hoặc mở kênh chính thức để tự xác minh.
5. Người dùng có thể lưu lần tra cứu vào lịch sử, xem lại và xóa các mục đã chọn.

Hai chế độ: ca mẫu chạy bằng **dữ liệu mô phỏng** (có nhãn "Dữ liệu mô phỏng"), nội dung người dùng tự nhập chạy **chế độ thật**.

### Phạm vi và nguồn dữ liệu

| Phần | Bản thi cần làm | Khi thiếu dữ liệu |
|---|---|---|
| **Địa điểm** | So tên công ty và địa chỉ hẹn với kết quả Vietmap khi có khóa. Hiện địa chỉ phù hợp nhất, loại địa điểm nếu nguồn có, và nút mở bản đồ. | Chỉ tìm được tòa nhà hoặc kết quả khác công ty thì hiện "Chưa xác nhận công ty tại địa chỉ này". Phân biệt trụ sở, chi nhánh và địa điểm thuê phỏng vấn. Chưa có khóa Vietmap thì hiện "Chưa đối chiếu tự động". |
| **Tin đăng** | Đối chiếu công ty, vị trí, mã tin, ngày đăng, hạn nộp và trạng thái theo nguồn nhìn thấy. Với TopCV hoặc LinkedIn, nhận link làm tham chiếu kèm nội dung người dùng cung cấp. | Link không truy cập được hoặc thiếu hạn nộp thì ghi "Chưa kiểm tra được". Chỉ ghi "Hết hạn" khi có hạn đã qua hoặc nguồn ghi rõ đã đóng tuyển. |
| **Lời mời** | AI trích yêu cầu cần xác minh, ví dụ "đóng phí giữ chỗ" hoặc "gửi giấy tờ", và đối chiếu với nội dung tin hoặc kênh chính thức đã rà. Danh tính người liên hệ có trạng thái riêng. | Khi địa chỉ khớp hoặc tin có thật, giữ trạng thái người gửi là "Chưa xác minh" cho đến khi có căn cứ về người liên hệ. |
| **Hướng dẫn** | Gợi ý một hành động cụ thể và một câu hỏi để sao chép. Ví dụ, "Cho em xin mã tuyển dụng hiện tại, số tầng phỏng vấn và email tuyển dụng chính thức để em xác nhận lịch." | Gợi ý đúng dữ kiện đang thiếu. Email, website và thông tin liên hệ lấy từ nguồn đã đối chiếu. |
| **Mở rộng khi có điều kiện** | Ảnh Street View kèm ngày chụp, Phím tắt chia sẻ trên iPhone, nhận ảnh chụp và đánh giá địa điểm có ghi nguồn. | Hiển thị bản đồ thay cho ảnh nếu thiếu độ phủ. Điểm đánh giá chỉ để tham khảo về địa điểm. |

Cổng đăng ký doanh nghiệp hỗ trợ đối chiếu tên pháp lý và trụ sở chính khi có thông tin tra cứu. Địa chỉ đăng ký và dữ liệu bản đồ phản ánh nguồn công bố tại thời điểm kiểm tra. LinkedIn và TopCV chỉ được tích hợp tự động khi có quyền hoặc phương thức phù hợp với điều khoản. Bản thi dùng thông tin do người dùng cung cấp hoặc dữ liệu nhóm có quyền sử dụng. Hiện mã **không tự đọc** trang của sàn việc làm: người dùng nhập hạn nộp, ngày đăng, mã tin và trạng thái đóng tuyển mà họ thấy.

Nguồn: [Vietmap](https://maps.vietmap.vn/docs/) · [Street View](https://developers.google.com/maps/documentation/streetview/metadata) · [Đăng ký doanh nghiệp](https://bocaodientu.dkkd.gov.vn/inf/default.aspx) · [LinkedIn](https://www.linkedin.com/legal/user-agreement) · [TopCV](https://www.topcv.vn/terms-of-service)

### Công nghệ và công cụ

| Phần | Lựa chọn | Hiện trạng |
|---|---|---|
| Làm việc | Antigravity để trao đổi, VS Code để sửa mã, Git quản lý phiên bản, Kiro IDE triển khai theo đặc tả. | Đang dùng. |
| Web | React + Vite + TypeScript. Kiểm tra trên Safari iPhone thật. | Đã làm. Chưa thử trên iPhone thật. |
| API | Node.js + NestJS 12 (Express) + TypeScript, chạy bằng `tsx`. JSON Schema kiểm tra dữ liệu. OpenAPI ghi cách gọi. | Đã làm. OpenAPI 3.1 ở [`docs/openapi.json`](docs/openapi.json), sinh từ JSON Schema. Ví dụ ở [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md). |
| AI | AWS SDK cho JavaScript, Bedrock Converse. Mô hình trích nội dung có cấu trúc. Máy chủ kiểm tra đoạn trích. | Mã xong, chưa gọi thật. |
| Địa điểm | Vietmap (tìm theo tên công ty và địa chỉ), Google Maps URLs để mở bản đồ. Street View là phần bổ sung. Hạn mức Vietmap tính riêng với AWS Sandbox. | Mã xong, chưa có khóa Vietmap. Nút mở bản đồ chạy. |
| Dữ liệu | Bộ ca mô phỏng trong JSON. PostgreSQL cho lịch sử tra cứu. | Đã làm. PostgreSQL 18 chạy cục bộ, kiểm thử bằng PGlite. |
| Triển khai | AWS EC2 Amazon Linux 2023, Caddy, systemd, HTTPS công khai. Nhật ký kỹ thuật không ghi nội dung lời mời. IAM role cho EC2 để gọi Bedrock. | Chưa làm. |
| Kiểm thử | Vitest và kiểm thử API. k6 đo độ trễ và lỗi. Safari iPhone cho luồng thực tế. | Vitest và k6 đã chạy local. Còn iPhone thật. |

Dùng ML hoặc DL tự huấn luyện chỉ khi có bài toán riêng và bộ nhãn phù hợp. Bản thi chọn mô hình ngôn ngữ đã huấn luyện sẵn vì giá trị chính nằm ở hiểu lời mời, trích đoạn và đề xuất xác minh. Chuẩn hóa địa chỉ, so hạn nộp và kiểm tra nguồn dùng logic TypeScript có thể kiểm chứng. Tài liệu: [Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html) · [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)

### Cổng mạng

| Cổng TCP | Vai trò |
|---|---|
| **443** | HTTPS công khai cho giám khảo và người dùng qua Caddy. |
| **80** | Chuyển HTTP sang HTTPS hoặc xác thực chứng chỉ tùy cấu hình Caddy. |
| **3000** | Cổng API. NestJS nghe nội bộ ở `127.0.0.1:3000`. Vite dev (5173) chuyển `/api` và `/healthz` sang đây. |
| **5432** | PostgreSQL cho lịch sử tra cứu, chỉ nội bộ. |
| **22** | Quản trị SSH nếu Sandbox dùng phương án này. Giới hạn nguồn truy cập theo cấu hình đội. |

Trước khi triển khai, xác minh tên miền hoặc địa chỉ ổn định, chứng chỉ, quyền mạng và hạn mức vận hành đến hết **11/12/2026**. Khi chạy sau Caddy đặt `TRUST_PROXY=true` và `COOKIE_SECURE=true`. [Caddy HTTPS](https://caddyserver.com/docs/automatic-https) · [Cổng mạng EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)

### API

Hợp đồng API kèm ví dụ VT-DEMO-01 lấy từ phản hồi thật, quy tắc trạng thái và mã lỗi: [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md). Mô tả máy đọc được: [`docs/openapi.json`](docs/openapi.json). Thiết kế: [`design.md`](.kiro/specs/viec-that-luong-dau/design.md). Schema nguồn: `shared/contract.ts` và `shared/schemas.ts`.

| Endpoint | Mục đích |
|---|---|
| `GET /healthz` | Kiểm tra API, báo chế độ chạy, dịch vụ đã cấu hình (`capabilities.ai`, `capabilities.places`) và trạng thái lịch sử. |
| `POST /api/v1/invitations/extract` | Nhận lời mời và các trường người dùng nhập. Trả công ty, vị trí, địa chỉ, yêu cầu kèm đoạn trích để người dùng sửa. |
| `POST /api/v1/invitations/verify` | Nhận dữ kiện đã xác nhận, `jobPosting` (dữ kiện tin do người dùng nhập) và `save`. Trả kết quả riêng cho tin đăng, địa điểm, lời mời, người liên hệ, câu hỏi xác minh và `historyId`. |
| `GET /api/v1/demo/cases` | Danh sách ca mẫu cho nút chọn ca. Không trả `fixtures` hay `expected`. |
| `GET /api/v1/history`, `GET /api/v1/history/:id` | Danh sách và chi tiết lịch sử của thiết bị này. |
| `DELETE /api/v1/history/:id`, `POST /api/v1/history/delete` | Xóa một mục hoặc nhiều mục đã chọn (`{ "ids": [...] }`). |

Trạng thái mỗi phần: `job` là `open`, `expired`, `unavailable`, `not_checked`. `location` là `matched`, `company_unconfirmed`, `unavailable`, `not_checked`. `contact` là `unverified`, `verified`. `invitation` là `caution`, `needs_verification`, `no_signal_observed`, `insufficient_information`. Dùng `unavailable` khi nguồn không truy cập được. Đoạn trích phải có nguyên văn trong lời mời, nếu không API trả 422 `QUOTE_NOT_IN_SOURCE`.

Lịch sử gắn với trình duyệt qua cookie `vt_device` (HttpOnly, SameSite=Lax), cơ sở dữ liệu chỉ lưu bản băm. Không đăng nhập: xóa cookie hoặc đổi máy thì không xem lại được. Lịch sử có lưu nội dung lời mời nên có hộp chọn "Lưu vào lịch sử" và thời hạn tự xóa.

### Ca nghiệm thu chính

| Ca | Kết quả mong đợi |
|---|---|
| Tin thật đã hết hạn, địa chỉ có tòa nhà nhưng chưa xác nhận công ty, lời mời đòi phí | Hiện ba dữ kiện, trích câu đòi phí và đề xuất xác nhận mã tin, địa điểm qua kênh chính thức trước khi thanh toán hoặc đi gặp. |
| Tin còn mở, địa chỉ khớp, chưa xác minh người gửi | Hiện điểm khớp và giữ trạng thái người gửi là chưa xác minh. |
| Hẹn tại chi nhánh hoặc văn phòng dùng chung | Gợi ý hỏi chi nhánh, tên tòa nhà và số tầng. |
| Link thiếu hạn nộp, trang cần đăng nhập hoặc nguồn Maps lỗi | Nêu đúng phần chưa kiểm tra được và cách bổ sung, vẫn hiện các kết quả có căn cứ. |

Bốn ca này ứng với VT-DEMO-01 đến 04 và đã có trong kiểm thử tự động. So với tra cứu thủ công, đo thời gian chọn đúng bước xác minh và số ca hợp lệ bị cảnh báo nhầm. k6 đo hiệu năng API thử nghiệm, ưu tiên giả lập AI và Maps khi tạo tải, chạy ít yêu cầu thật để đo độ trễ thực tế trong hạn mức.

---

## 4. Danh sách công việc

Phân vai đề xuất: **A** dữ liệu và AI, **B** web và AWS, **C** kiểm thử iPhone và hồ sơ. Nhóm hai người thì chia việc của C cho A và B. Trưởng nhóm rà và nộp. Dấu `[x]` chỉ dùng khi đã đạt tiêu chí hoàn thành. Chữ in nghiêng ghi tình trạng thực tế.

### 1. Dữ liệu, quyền và hợp đồng API · 21–23/11

| Task | Vai trò | Sau | Tiêu chí hoàn thành |
|---|---|---|---|
| [x] VT01 — Chuẩn bị ca demo và bộ ca đối chứng | A + C | — | Một ca demo và ba ca đối chứng bằng dữ liệu mô phỏng, kèm kết quả mong đợi và mẫu TopCV. Xem [dữ liệu demo](data/demo/README.md). |
| [ ] VT02 — Kiểm tra AWS | B | — | Xác nhận EC2 AL2023, HTTPS, quyền Bedrock, hạn mức và thời hạn đến hết 11/12. *Chưa có bằng chứng. Công cụ kiểm tra đã sẵn, xem [mục 7](#7-kiểm-tra-dịch-vụ-ngoài-vt02-vt03).* |
| [ ] VT03 — Kiểm tra nguồn Maps và tuyển dụng | A + B | — | Có kết quả Places thử với một địa chỉ, hoặc ghi rõ trạng thái truy cập. Rà quyền sử dụng và chọn nguồn tin đăng. *Google Places trả 403 nên chuyển sang Vietmap, chưa có khóa. Đang dùng dữ kiện người dùng nhập cho tin đăng, nhóm cần xác nhận.* |
| [x] VT04 — Chốt schema vào/ra | A + B | VT01 | Có ví dụ JSON, mã lỗi và trạng thái riêng cho địa điểm, tin đăng, người liên hệ và lời yêu cầu. |

### 2. Xây luồng chính với Kiro · 23–28/11

| Task | Vai trò | Sau | Tiêu chí hoàn thành |
|---|---|---|---|
| [x] VT05 — Tạo khung React và API (NestJS, ban đầu là Fastify) | B | VT04 | Web, API và health endpoint chạy trên máy phát triển. Có cấu hình mẫu. |
| [ ] VT06 — Tạo form lời mời và màn hình xác nhận | B | VT05 | Người dùng dán văn bản, link và địa chỉ, sửa được dữ kiện trước khi tra cứu trên Safari iPhone. *Chạy và test được trên máy phát triển, chưa thử trên iPhone thật.* |
| [ ] VT07 — AI trích thông tin lời mời | A | VT02, VT04, VT05 | Mô hình trả công ty, vị trí, địa chỉ, hành động được yêu cầu và trích đoạn có thật. *Mã và test xong với bản giả lập. Chờ VT02 để gọi Bedrock thật.* |
| [ ] VT08 — Đối chiếu địa điểm | B | VT03, VT05 | Tìm theo tên và địa chỉ. Phân biệt khớp công ty, chỉ thấy địa điểm, hoặc chưa kiểm tra. Hiện nút bản đồ. *Mã và test xong với Vietmap giả lập. Dùng nút mở bản đồ khi chưa có khóa Vietmap.* |
| [ ] VT09 — Đối chiếu tin đăng | A | VT03–VT05 | Đọc dữ kiện được phép dùng, so ngày và trạng thái. Giữ nguồn kèm kết quả. Xử lý link đóng, cần đăng nhập hoặc thiếu hạn nộp. *Mã và test xong với dữ kiện người dùng nhập. Chờ nhóm chốt VT03.* |
| [ ] VT10 — Giải thích và gợi ý câu hỏi | A + B | VT07–VT09 | Hiện từng căn cứ và một câu hỏi xác minh theo dữ kiện thiếu. Kiểm tra đoạn trích và nguồn liên hệ trước khi trả cho web. *Mã và test xong. Chờ VT07–VT09 chạy thật.* |
| [ ] VT11 — Tích hợp kết quả vào web | B + C | VT06, VT10 | Trọn luồng từ nhập lời mời đến mở bản đồ, xem nguồn và sao chép câu hỏi. Nhận biết rõ trạng thái đang xử lý và lỗi nguồn. *Mã và test xong. Chờ dịch vụ thật và thử iPhone.* |
| [ ] VT12 — Triển khai EC2 qua HTTPS | B | VT02, VT11 | Đúng link dự kiến nộp mở được qua mạng ngoài nhóm và phân tích một lời mời mới bằng AI. *Đã kiểm tra web và proxy Caddy ở local.* |

### 3. Kiểm thử và chốt bài · 28/11–02/12

| Task | Vai trò | Sau | Tiêu chí hoàn thành |
|---|---|---|---|
| [ ] VT13 — Kiểm thử logic và API | A + B | VT11 | Chạy ca tin hết hạn, địa chỉ dùng chung, thiếu dữ kiện, lỗi Maps/AI, và kiểm tra trích dẫn. *148 test tự động đạt (API 123, web 25), gồm 20 ca lời mời mới. Còn kiểm thử dịch vụ thật.* |
| [ ] VT14 — Đo API bằng k6 | B | VT11 | Đo p95 và tỷ lệ lỗi ở môi trường thử. *Đã đo local trên NestJS ngày 25/11: p95 dưới 2 ms, 0% lỗi. Còn đo trên bản triển khai và lấy mẫu gọi AI thật trong hạn mức.* |
| [ ] VT15 — Thử người dùng trên iPhone | C | VT12, VT13 | So điểm chọn đúng bước xác minh và thời gian thao tác với tra cứu thủ công. Ghi số lượt và lỗi thực tế. |
| [ ] VT16 — Bổ sung Street View hoặc đọc ảnh nếu còn thời gian | B + C | VT12 | Tính năng bổ sung chạy trên máy thật. Street View có nguồn, ngày chụp nếu có và phương án chỉ hiện bản đồ khi thiếu ảnh. |
| [ ] VT17 — Chốt bản nộp | Cả nhóm | VT13–VT15 | Sửa lỗi luồng chính, thử lại link ngoài mạng nhóm và ghi phiên bản Git tương ứng với bản chạy. |

### 4. Hồ sơ và vận hành · đến hết 11/12

| Task | Vai trò | Sau | Tiêu chí hoàn thành |
|---|---|---|---|
| [ ] VT18 — Hoàn thiện hồ sơ | A + C, B đóng ZIP | VT17 | PDF hướng dẫn tối đa 1 trang A4, ZIP mã nguồn kèm README khai báo tài sản và AI, slide PDF tối đa 10 trang, video MP4 tối đa 3 phút quay sản phẩm chạy thật. |
| [ ] VT19 — Nộp bài | Trưởng nhóm | VT18 | Mục tiêu nội bộ 02/12. Hạn chính thức **23:59:59 ngày 03/12/2026 GMT+7**. |
| [ ] VT20 — Giữ bản nộp hoạt động | B | VT19 | Theo dõi EC2, HTTPS và quota Bedrock/Maps đến hết **11/12/2026**, giữ phiên bản đã nộp theo thể lệ. |

**Bắt đầu cùng lúc:** VT01, VT02 và VT03. Sau VT04, giao Kiro các việc VT05–VT11 theo đầu ra cụ thể. VT16 triển khai sau khi luồng chính ổn định.

**Việc ngoài danh sách đã làm:** lịch sử tra cứu bằng PostgreSQL, giới hạn tần suất, giới hạn số bản lịch sử, công cụ `check:services`.

---

## 5. Lộ trình từ số 0 đến bản nộp

Lộ trình thao tác cho người mới. Trạng thái từng mốc ở [mục 1](#1-trạng-thái-hiện-tại), chi tiết task ở [mục 4](#4-danh-sách-công-việc).

### Mốc 1. Biết sản phẩm cần trả lời gì (VT01)

1. Viết câu mục tiêu vào đầu tài liệu nhóm: "Khi nhận lời mời phỏng vấn, sinh viên có thể đối chiếu tin tuyển, địa điểm hẹn và yêu cầu của người liên hệ trước khi đi gặp, gửi giấy tờ hoặc chuyển tiền." *Câu này đang ở đầu tài liệu này, nhóm cần xác nhận.*
2. Chuẩn bị bốn bộ đầu vào mẫu, mỗi bộ có lời mời, nội dung hoặc link tin, địa chỉ và kết quả mong đợi. Dùng tên, địa chỉ và lời thoại mô phỏng để tránh gán nhầm hành vi cho công ty có thật. *Đã có trong `data/demo/cases.json`.*
3. Chốt bảng dưới đây với nhóm. Ghi rõ căn cứ nào đến từ nguồn, căn cứ nào do người dùng cung cấp và phần nào chưa xác minh.

| Ca | Đầu vào | Kết quả mong đợi |
|---|---|---|
| Chính | Tin đã hết hạn, chỉ tìm thấy tòa nhà, lời mời yêu cầu đóng phí | Hiện ba dữ kiện riêng, trích câu đòi phí và gợi ý hỏi mã tin, địa điểm và kênh xác nhận. |
| Đối chứng | Tin còn mở, địa điểm khớp, nội dung mời không đề cập khoản phí | Hiện điểm khớp và giữ trạng thái người liên hệ là chưa xác minh nếu thiếu căn cứ. |
| Địa chỉ khác | Phỏng vấn ở chi nhánh, địa chỉ khác trụ sở | Gợi ý xác minh tên chi nhánh và số tầng. |
| Thiếu dữ kiện | Trang yêu cầu đăng nhập hoặc thiếu hạn nộp | Hiện "Chưa kiểm tra được" và đề nghị người dùng bổ sung nội dung họ có. |

**Qua mốc khi** mỗi thành viên nhìn đầu vào và nói được kết quả đúng phải hiển thị gì.

### Mốc 2. Kiểm tra máy và dịch vụ song song (VT02, VT03)

1. Mở thư mục dự án trong VS Code hoặc Antigravity. Chạy `git --version`, `node --version`, `npm --version`. Chọn chung phiên bản Node tương thích với Vite và NestJS. *Đã đo trên máy phát triển.*
2. Đăng nhập AWS Sandbox theo hướng dẫn BTC. Ghi vùng, quyền EC2 AL2023, phương án HTTPS công khai, quyền gọi mô hình Bedrock và hạn mức đến 11/12. Một yêu cầu phân tích câu mô phỏng trả kết quả thật xác nhận quyền mô hình: `npm run check:services -w apps/api`.
3. Kiểm tra Vietmap riêng với AWS Sandbox. Nếu có quyền, thử một địa chỉ công khai và lưu kết quả. Nếu thiếu quyền, vẫn có nút "Mở bản đồ" và hiện rõ địa điểm chưa đối chiếu tự động.
4. Chọn ít nhất một nguồn tin có trạng thái tuyển đọc được. Lưu thông tin tối thiểu được phép dùng gồm tên công ty, vị trí, trạng thái hoặc hạn nộp, link và ngày kiểm tra. Khi nguồn sàn hạn chế truy cập, dùng thông tin ứng viên cung cấp và nêu nguồn trong kết quả.

**Qua mốc khi** nhóm biết dịch vụ nào gọi thật được, phần nào cần thêm quyền và phần nào vẫn phát triển bằng dữ liệu mô phỏng.

### Mốc 3. Dựng bản chạy đầu tiên trên máy (VT04–VT06)

1. Viết ví dụ dữ liệu gửi và nhận trước khi code. *Xong, trong `design.md`.*
2. Tạo khung React + Vite và API bằng TypeScript (nay là NestJS). Chạy `GET /healthz`, mở web, thử gửi một yêu cầu. *Xong.*
3. Nối form đến API bằng phản hồi mô phỏng, gắn nhãn mô phỏng. *Xong.*
4. Thêm trạng thái đang xử lý, lỗi và thiếu dữ kiện. Thử gửi rỗng, nhập sai địa chỉ, nguồn lỗi. Viết README để người khác chạy được. *Xong, xem [mục 6](#6-chạy-trên-máy).*

**Qua mốc khi** một thành viên mở web trên máy và đi hết luồng từ nhập lời mời đến đọc kết quả. *Đạt trên máy phát triển. Còn thử Safari iPhone.*

### Mốc 4. Thay từng phần mô phỏng bằng xử lý thật (VT07–VT11)

1. **AI đọc lời mời.** Gọi Bedrock bằng câu thử tiếng Việt. Trích tên công ty, vị trí, địa chỉ và yêu cầu. Cho người dùng sửa. Kiểm tra mọi đoạn trích có trong văn bản nguồn. *Mã xong.*
2. **Tra địa điểm.** Gửi tên công ty và địa chỉ qua nguồn được cấp quyền. Hiện kết quả phù hợp và link bản đồ. Nếu chỉ tìm được tòa nhà, ghi "Chưa xác nhận công ty tại địa chỉ này". *Mã xong.*
3. **Đối chiếu tin đăng.** Dùng nguồn được phép hoặc nội dung người dùng nhập. So công ty, vị trí, hạn nhận hồ sơ và trạng thái tuyển. Tin hết hạn và dấu hiệu mạo danh là hai kết quả riêng. *Mã xong.*
4. **Trả hướng dẫn.** Ghép dữ kiện và tạo một câu hỏi sao chép được. Kênh chính thức lấy từ nguồn đã đối chiếu. *Mã xong.*
5. **Thử ca mới.** Đưa một lời mời ngoài mẫu demo, thử link thiếu ngữ cảnh và dịch vụ tra cứu tạm lỗi. *Đã thử với dịch vụ giả lập. Chưa thử với dịch vụ thật.*

**Qua mốc khi** mô hình thật giải thích được yêu cầu trong lời mời mới, bản đồ mở được và mỗi dữ kiện có trạng thái đúng.

### Mốc 5. Đưa bản thử lên mạng và kiểm tra (VT12–VT17)

1. Đưa bản thử lên EC2 AL2023. Cấu hình Caddy phục vụ HTTPS qua cổng `443`, chuyển yêu cầu API vào NestJS nghe nội bộ, cấu hình dịch vụ tự khởi động lại. Tạo database và role PostgreSQL riêng trên máy chủ.
2. Từ iPhone qua 4G/5G, mở đúng đường dẫn dự kiến nộp. Thử nhập lời mời mới, mở bản đồ, sao chép câu hỏi. Nhờ một người ngoài nhóm làm thử mà không hướng dẫn.
3. Chạy bốn ca đối chứng và các lỗi nguồn. Với k6, tạo tải trên môi trường thử dùng phản hồi AI/Maps mô phỏng. Ghi p95 và tỷ lệ lỗi. Gọi AI thật với số lượt giới hạn để đo thời gian chờ thực tế.
4. Ghi số người chọn đúng bước tiếp theo và bước họ bị vướng. Sửa lỗi luồng chính trước, rồi mới thêm Street View, đọc ảnh hoặc Phím tắt.

**Qua mốc khi** người ngoài nhóm tự mở link công khai, kiểm tra được lời mời mới và hiểu cần làm gì.

### Mốc 6. Nộp và duy trì (VT18–VT20)

1. Lưu phiên bản Git khớp với bản đang chạy. Rà hạn mức EC2, Bedrock và Maps.
2. Chuẩn bị PDF hướng dẫn tối đa một trang A4, ZIP mã nguồn kèm README, slide PDF tối đa 10 trang và video MP4 tối đa 3 phút quay sản phẩm chạy thật.
3. Kiểm tra lại toàn bộ từ máy khác. Mục tiêu nội bộ **02/12**. Hạn nộp **23:59:59 ngày 03/12/2026 GMT+7**.
4. Theo dõi link và khả năng phân tích đến hết **11/12/2026**.

---

## 6. Chạy trên máy

Cần Node.js 20 trở lên.

```powershell
npm install
npm run dev:api    # API tại http://127.0.0.1:3000
npm run dev:web    # Web tại http://127.0.0.1:5173 (chuyển /api sang API)
```

Mở http://127.0.0.1:5173, chọn một ca mẫu rồi bấm "Phân tích lời mời". Kiểm tra API: http://127.0.0.1:5173/healthz.

**Biến môi trường** (xem `.env.example`, đặt trong `.env` ở thư mục gốc, Git bỏ qua tệp này): `PORT`, `HOST`, `LOG_LEVEL`, `DATABASE_URL`, `HISTORY_TTL_DAYS`, `HISTORY_MAX_PER_DEVICE`, `COOKIE_SECURE`, `RATE_LIMIT_PER_MINUTE`, `TRUST_PROXY`, `BEDROCK_MODEL_ID`, `AWS_REGION`, `VIETMAP_API_KEY`, `VIETMAP_MAX_REQUESTS_PER_MINUTE`, `VIETMAP_MAX_REQUESTS_PER_DAY`, `VIETMAP_MAX_CONCURRENT_REQUESTS`, `GEOCODING_SUSPICIOUS_DISTANCE_KM`, `DEMO_CASES_ENABLED` (mặc định `true`; đặt `false` trên bản chạy thực tế để ẩn ca mẫu và chỉ nhận chế độ live). Không đặt khóa AWS vào `.env`: SDK dùng IAM role (EC2) hoặc đăng nhập SSO.

**Lịch sử tra cứu (PostgreSQL, tùy chọn).** Không đặt `DATABASE_URL` thì API chạy không lịch sử và web ẩn tab Lịch sử. Để bật:

```powershell
# Tạo role và database một lần, bằng tài khoản quản trị Postgres của bạn
psql -U postgres -c "create role viecthat login password 'MAT_KHAU'"
psql -U postgres -c "create database viecthat owner viecthat"

# Đặt DATABASE_URL trong .env, hoặc đặt biến môi trường:
$env:DATABASE_URL = 'postgres://viecthat:MAT_KHAU@127.0.0.1:5432/viecthat'
npm run migrate -w apps/api   # tạo bảng; API cũng tự chạy migration khi khởi động
npm run dev:api
```

**Kiểm thử**

```powershell
npm run typecheck
npm test            # API 123 test, web 25 test
npm run build
npm run openapi -w apps/api          # sinh lại docs/openapi.json sau khi đổi shared/schemas.ts
npm run check:services -w apps/api   # gọi thử Bedrock và Vietmap nếu đã cấu hình
```

**Cấu trúc**

| Thư mục | Nội dung |
|---|---|
| `shared/` | Kiểu TypeScript và JSON Schema của API. |
| `apps/api/` | NestJS. `src/viec-that/` (controller, `extract.ts`, `verify.ts`, `location.ts`, `requirements.ts`, `ai.ts` Bedrock, lịch sử PostgreSQL), `src/geocoding/` (Vietmap), `migrations/` (SQL), `test/harness.ts`. Xem [`apps/api/README.md`](apps/api/README.md). |
| `apps/web/` | React + Vite. |
| `data/demo/` | Bốn ca mô phỏng. `expected` chỉ dùng trong kiểm thử, không đi vào code xử lý hay gửi cho AI. |
| `data/evaluation/` | 20 lời mời ngoài bốn ca demo để kiểm thử luật dự phòng. |
| `docs/` | Hợp đồng API và OpenAPI. |
| `deploy/` | Caddyfile, unit systemd và hướng dẫn triển khai EC2. |
| `tests/load/` | Kịch bản k6 (VT14). |
| `.kiro/specs/` | Feature Spec của luồng đầu tiên. |

Quy ước khi làm việc: bản thi không ghi nội dung lời mời vào nhật ký máy chủ. Trên Windows PowerShell 5.1, `Set-Content -Encoding UTF8` thêm BOM làm hỏng JSON, dùng `[IO.File]::WriteAllText` với `UTF8Encoding($false)`.

---

## 7. Kiểm tra dịch vụ ngoài (VT02, VT03)

Ghi theo bằng chứng đã có. Mục "chưa có" cần người có tài khoản AWS và Google của đội.

### Máy phát triển (xong)

| Công cụ | Đo ngày 21/11/2026 |
|---|---|
| Node.js | v24.21.0 (`engines` yêu cầu 20 trở lên) |
| npm | 11.19.0 |
| Git | 2.54.0 |
| PostgreSQL | 18.6 cục bộ, database `viecthat` đã có bảng `checks` |
| AWS CLI | Chưa cài. Không bắt buộc, SDK dùng thông tin xác thực của môi trường. |

### AWS Sandbox (VT02, chưa có)

Máy này chưa có thông tin xác thực AWS. Việc cần làm, theo thứ tự:

1. Đăng nhập AWS Sandbox theo hướng dẫn BTC. Ghi **vùng** và **loại tài khoản** (IAM User hoặc IAM Identity Center).
2. Bedrock, mục Model access: bật một mô hình hỗ trợ **tiếng Việt** và **tool use** trong Converse API. Ghi **model ID** hoặc **inference profile ID**.
3. Chạy kiểm tra thật:
   ```powershell
   $env:AWS_REGION = '<vùng>'
   $env:BEDROCK_MODEL_ID = '<model id hoặc inference profile>'
   npm run check:services -w apps/api
   ```
   Dòng `AWS Bedrock (VT02)` phải là `OK` và trích được công ty `Công ty Mô phỏng Sao Giấy` cùng yêu cầu `fee_request`. Lỗi thường gặp: `AccessDeniedException` (thiếu quyền `bedrock:InvokeModel` hoặc chưa bật model), `ResourceNotFoundException` (sai vùng hoặc model ID), `ValidationException` (model không hỗ trợ tool use).
4. EC2 Amazon Linux 2023: tạo được EC2, gắn **IAM role** có `bedrock:InvokeModel`, Security Group mở **80** và **443** cho mọi nơi, **22** chỉ cho IP đội.
5. HTTPS công khai: có tên miền hoặc Elastic IP ổn định và Caddy lấy được chứng chỉ.
6. Hạn mức: ghi quota Bedrock (yêu cầu mỗi phút, token) và thời hạn Sandbox so với **11/12/2026**.

| Mục cần ghi | Giá trị |
|---|---|
| Vùng | _chưa có_ |
| Model ID | _chưa có_ |
| Kết quả `check:services` | _chưa có_ |
| EC2 AL2023 và IAM role | _chưa có_ |
| HTTPS (tên miền, chứng chỉ) | _chưa có_ |
| Quota và hạn Sandbox | _chưa có_ |

### Địa điểm (Vietmap) và nguồn tin (VT03)

**Đã chuyển sang Vietmap (24/11/2026).** Trước đó Google Places API (New) đã bật, thanh toán hoạt động và khóa giới hạn đúng API, nhưng gọi từ máy phát triển vẫn trả `403 PERMISSION_DENIED`. Bản NestJS dùng Vietmap và không còn mã Google Places.

1. Đăng ký khóa Vietmap, ghi hạn mức miễn phí và điều khoản sử dụng.
2. Đặt `VIETMAP_API_KEY` và giữ các giới hạn `VIETMAP_MAX_REQUESTS_PER_MINUTE`, `VIETMAP_MAX_REQUESTS_PER_DAY` trong hạn mức.
3. Chạy `npm run check:services -w apps/api`. Dòng `Vietmap (VT03)` phải là `OK` với địa chỉ thử `135 Nam Kỳ Khởi Nghĩa, Quận 1, Hồ Chí Minh`.
4. Chưa có khóa thì web vẫn chạy: địa điểm hiện "Chưa đối chiếu tự động" kèm nút "Mở bản đồ".

**Nguồn tin đăng (quyết định đã chốt trong mã).**

| Nguồn | Cách dùng trong bản thi | Lý do |
|---|---|---|
| Dữ kiện người dùng nhập (hạn nộp, ngày đăng, mã tin, đã đóng) | Dùng. Là nguồn tin đăng của chế độ live. | Không khai thác tự động nên không vướng điều khoản. |
| Link TopCV, LinkedIn | Chỉ lưu và hiện làm tham chiếu. Không tự đọc trang. | [TopCV](https://www.topcv.vn/terms-of-service), [LinkedIn](https://www.linkedin.com/legal/user-agreement) hạn chế khai thác tự động. |
| Trang tuyển dụng của chính doanh nghiệp | Chưa tích hợp. | Cần rà quyền và `robots.txt` từng trang, mỗi trang một cách đọc. |
| Ca mô phỏng và mẫu TopCV `j1095867` | Chỉ dùng khi kiểm thử và quay demo, ghi nhãn "Dữ liệu mô phỏng" cho ca mô phỏng. | Theo [dữ liệu demo](data/demo/README.md). |

Nhóm cần xác nhận quyết định này. Muốn có nguồn tin tự động thì chọn một nguồn được phép rồi thêm bộ đọc.

| Mục cần ghi | Giá trị |
|---|---|
| Khóa Vietmap và hạn mức | _chưa có_ |
| Kết quả `check:services` | _chưa có_ (Google Places trước đây: `403 PERMISSION_DENIED`) |
| Nguồn tin tự động được phép | _chưa chọn_ (đang dùng dữ kiện người dùng nhập) |

### Kiểm thử tải local (VT14)

Chạy API kiểm thử ở một terminal và chạy k6 ở terminal khác, đều tại thư mục gốc.

```powershell
npm run load:server -w apps/api
```

```powershell
k6 run tests/load/invitations.js
```

Kịch bản luân phiên bốn ca mô phỏng ở mức 20 luồng/giây trong 30 giây. Mỗi luồng gọi `extract` rồi `verify`, kiểm tra bốn trạng thái và đoạn trích. API thử chạy trên `127.0.0.1:3900`, với giới hạn tần suất tắt và không bật lưu lịch sử. Các nguồn trong ca đều là dữ liệu giả lập, nên phép đo chỉ phản ánh thời gian xử lý local.

Đo ngày 25/11/2026 trên bản API NestJS (commit `ffa83fc` cộng các sửa chưa commit), máy phát triển Windows, Node.js v24.21.0.

| Chỉ số đo bằng k6 v2.4.0 | Kết quả |
| --- | --- |
| Luồng hoàn tất / yêu cầu HTTP | 601 / 1.202 |
| p95 `extract` / p95 `verify` | 1,92 ms / 1,51 ms |
| Lỗi HTTP / lỗi luồng / kiểm tra đạt | 0% / 0% / 1.803 trên 1.803 |
| Luồng bỏ lỡ | 0 |

Bản Fastify cũ (22/11/2026) đo được p95 `extract` 1,52 ms và `verify` 1,30 ms. Cả hai đều xa ngưỡng 250 ms, nên chênh lệch không đáng kể. Số đo này chưa gồm mạng, HTTPS, Bedrock hay Vietmap. VT14 còn cần đo trên bản triển khai.

p95 là mốc thời gian mà 95% yêu cầu hoàn thành trong hoặc dưới mốc đó. Ngưỡng local của bài đo là p95 dưới 250 ms cho mỗi bước, lỗi dưới 1% và không bỏ lỡ luồng.

---

## 8. Bàn giao cho Kiro

Mở thư mục gốc `MoMo tech` trong Kiro IDE để agent thấy tài liệu và dữ liệu mẫu. Kiro đọc theo thứ tự:

| Tệp | Thông tin cần lấy |
|---|---|
| Tài liệu này | Mục tiêu, phạm vi, môi trường, hạn thi, trạng thái, danh sách task và lộ trình. |
| [Feature Spec](.kiro/specs/viec-that-luong-dau/requirements.md) | Yêu cầu, schema, ví dụ JSON, mã lỗi, lịch sử, chế độ live. |
| [Dữ liệu demo](data/demo/README.md) và [`cases.json`](data/demo/cases.json) | Bốn ca mô phỏng, kết quả mong đợi, mẫu TopCV và giới hạn sử dụng nguồn. |

**Quy tắc khi giao việc**
- Giữ TypeScript, React + Vite và NestJS. Kết quả nêu riêng trạng thái tin đăng, địa điểm, người liên hệ và yêu cầu cần xác minh. Giữ lời mời và đoạn trích có nguồn. Link sàn việc làm dùng theo quyền của nguồn.
- Gắn nhãn mô phỏng cho dữ liệu nguồn giả lập, dùng `expected` làm đáp án kiểm thử và giữ nó ở phía kiểm thử. Khi gọi AI thật, chỉ gửi đầu vào và dữ kiện nguồn hợp lệ.
- Ca nghiệm thu đầu tiên là VT-DEMO-01: người dùng nhập lời mời, sửa dữ kiện, xem ba kết quả (tin hết hạn, chưa xác nhận công ty tại địa chỉ hẹn, câu yêu cầu đóng phí) và sao chép được câu hỏi xác minh. Kiểm tra thêm ca địa điểm khớp và ca nguồn không truy cập được.
- Cuối mỗi lượt ghi: tệp đã sửa, lệnh chạy và kiểm thử thực sự đã chạy, kết quả, và việc còn mở.

**Bàn giao tiếp**
- **VT02:** chuyển cho Kiro vùng AWS, model ID được phép gọi, kết quả `check:services` và phương án HTTPS trên EC2. Cấu hình quyền ở môi trường máy chủ, dùng tên biến môi trường hoặc IAM role.
- **VT03:** ghi cách truy cập nguồn tin được phép, các trường được dùng và trạng thái Vietmap. Giữ phương án mở bản đồ và hiện "Chưa đối chiếu tự động" khi thiếu quyền.
- **VT12–VT17:** triển khai, thử trên iPhone qua mạng ngoài nhóm và chốt bản nộp.
- **VT18–VT20:** bàn giao đường dẫn HTTPS, mã phiên bản Git, kết quả kiểm thử, README khai báo nguồn dữ liệu và AI, ZIP, PDF hướng dẫn, slide và video. Hạn nộp **23:59:59 ngày 03/12/2026 GMT+7**. Duy trì bản nộp đến hết **11/12/2026**.

---

## 9. Khai báo tài sản và AI (bản nháp VT18)

Bản nháp này ghi theo những gì có trong mã ngày 25/11/2026. Ô ghi *cần nhóm xác nhận* phải được điền trước khi đóng ZIP.

### AI trong sản phẩm

| Thành phần | Vai trò | Giới hạn |
|---|---|---|
| AWS Bedrock Converse (`apps/api/src/viec-that/ai.ts`) | Đọc lời mời, trích công ty, vị trí, địa chỉ và yêu cầu kèm đoạn trích nguyên văn. | Mô hình: *cần nhóm xác nhận* (`BEDROCK_MODEL_ID`). Nhiệt độ 0, công cụ bắt buộc. Chỉ gửi văn bản lời mời. Máy chủ loại mục không có đoạn trích trong lời mời. AI không quyết định trạng thái. Trạng thái và câu hỏi gợi ý do luật TypeScript sinh ra. |
| Luật cố định (`apps/api/src/viec-that/requirements.ts`) | Luôn chạy để không bỏ sót yêu cầu đóng phí, gửi giấy tờ, mã xác thực. Là phương án dự phòng khi AI chưa cấu hình hoặc lỗi. | Không dùng mô hình. |
| Xác minh người liên hệ (`apps/api/src/viec-that/contact.ts`) | So email hoặc số điện thoại của người gửi với thông tin liên hệ người dùng chép từ trang tuyển dụng chính thức. | Không dùng mô hình. Không tự đọc LinkedIn, TopCV hay trang công ty. |

### AI dùng khi phát triển

| Công cụ | Dùng cho |
|---|---|
| Kiro IDE | Viết và sửa mã, test, tài liệu theo Feature Spec trong `.kiro/specs/`. |
| Antigravity | Trao đổi và rà soát. |
| *Công cụ khác, cần nhóm xác nhận* | |

### Dữ liệu

| Nguồn | Cách dùng |
|---|---|
| `data/demo/cases.json` | Bốn ca do nhóm tự tạo. Tên công ty, địa chỉ, tin đăng và bản đồ là mô phỏng, có nhãn "Dữ liệu mô phỏng". |
| `data/evaluation/novel-invitations.json` | 20 lời mời tự tạo để kiểm thử luật dự phòng. |
| Tin TopCV `j1095867` | Chỉ ghi link và trạng thái tối thiểu để kiểm tra thủ công. Không sao chép nội dung, không đưa vào mã. |
| VietJobs, EMSCAD | Chỉ là tài liệu tham khảo. Chưa tải và chưa đưa vào ZIP. |
| Google Maps URLs | Nút "Mở bản đồ" tạo link tìm kiếm. Không cần khóa API. |
| Vietmap | Tìm địa điểm theo tên công ty và địa chỉ. Có mã client, chưa gọi thật. Cần rà điều khoản sử dụng. |
| LinkedIn, TopCV, trang tuyển dụng công ty | Chỉ là nơi người dùng tự xem hạn nộp và thông tin liên hệ rồi chép vào. Việc Thật không thu thập tự động. |

### Thư viện chính

Phiên bản lấy từ `package-lock.json`.

| Gói | Phiên bản | Giấy phép |
|---|---|---|
| @nestjs/core, common, platform-express | 12.6.0 | MIT |
| @nestjs/config | 12.1.1 | MIT |
| express | 5.3.0 | MIT |
| reflect-metadata | 0.2.2 | Apache-2.0 |
| rxjs | 7.8.2 | Apache-2.0 |
| react, react-dom | 18.3.1 | MIT |
| vite | 5.4.21 | MIT |
| pg | 8.23.1 | MIT |
| @aws-sdk/client-bedrock-runtime | 3.1175.0 | Apache-2.0 |
| typescript | 5.9.3 (web), 6.0.3 (API) | Apache-2.0 |
| tsx | 4.23.15 | MIT |
| vitest (kiểm thử) | 2.1.9 (web), 4.1.12 (API) | MIT |
| @electric-sql/pglite (kiểm thử) | 0.5.17 | Apache-2.0 |

Hình ảnh và biểu tượng: `apps/web/public/favicon.png`. Nguồn gốc: *cần nhóm xác nhận*.
