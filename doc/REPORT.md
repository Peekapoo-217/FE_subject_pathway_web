# REPORT - FE_subject_pathway_web

## Chọn lại năm học khi tra cứu — 2026-10-16

- [x] Giữ ô năm học hiển thị khi đã chọn trường; có trạng thái tải, trống và nút thử lại khi API lỗi.
- [x] Đổi năm tải đúng nhóm môn, xóa kết quả cũ và bỏ qua phản hồi nhóm môn/tra cứu đến muộn từ lựa chọn trước.
- [x] Gửi `schoolCode`, `academicYear`, `groupCode` trong cả request tổ hợp và request ngành theo đại học.
- [x] `npm.cmd test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/search/*.spec.ts`: 8/8 đạt. Chrome bị chặn trong sandbox; chạy lại ngoài sandbox thành công.
- [x] `npm.cmd run build`: thành công. Kiểm thử tương tác bằng DOM trong ChromeHeadless; chưa kiểm tra thủ công trình duyệt.

## Quản lý tài liệu và nhóm bản nháp THPT — 2026-10-14

- [x] T1. Bỏ nút và hàm “Thêm phiên bản”; giữ form upload tài liệu riêng.
- [x] T2. Hiển thị đúng nút theo quyền: ADMIN “Yêu cầu xóa”, SUPER_ADMIN “Xóa mềm” hoặc “Duyệt xóa”.
- [x] T3. Gom bản nháp theo trường/năm học dạng thu gọn; khi mở nhóm tải theo cursor và chia tiếp theo tài liệu/phiên bản nguồn.
- [x] T4. Khóa thao tác sửa/gửi/công bố trên bản nháp của tài liệu đang chờ xóa; SUPER_ADMIN có xác nhận hai bước để xóa từng nháp.
- [x] T5. Thêm unit test cho phân nhóm/tải khi mở, contract cursor API, quyền xóa theo role và xác nhận xóa nháp. `npm test -- --watch=false --browsers=ChromeHeadless`: 50/50 test đạt; `npm run build` thành công.

## OCR–ETL ảnh tài liệu THPT — 2026-10-13

- [x] Form nhận PDF/PNG/JPEG/WebP, kiểm tra loại và dung lượng trước upload, mỗi lần một ảnh; nhãn và thông báo phản ánh job bất đồng bộ.
- [x] Danh sách hiển thị lỗi trích xuất an toàn, nút thử lại job thất bại và nút làm mới; SUPER_ADMIN có thể xem và công bố bản nháp `DRAFT`.
- [x] `npm test -- --watch=false --browsers=ChromeHeadless`: 42 test đạt; `npm run build` thành công.
- [ ] Kiểm tra thủ công trên giao diện sau khi worker OCR văn bản được triển khai; model trích xuất không cần hỗ trợ vision.

## Hiển thị lỗi OCR ảnh — 2026-10-13

- [x] Hiển thị hướng dẫn riêng cho OCR rỗng, lỗi bộ OCR và quá thời gian OCR; giữ thông báo an toàn, không lộ exception nội bộ.
- [x] Bổ sung unit test cho cả ba mã lỗi OCR.
- [x] `npm test -- --watch=false --browsers=ChromeHeadless`: 42 test đạt; `npm run build` thành công.

## Cải thiện UI/UX trang quản trị — 2026-10-12

- [x] Giữ tab ngang, làm mới giao diện responsive cho tài liệu THPT, người dùng, tổ hợp xét tuyển và cấu hình AI.
- [x] Tách template/SCSS khỏi TypeScript; bổ sung nhãn tiếng Việt, phân cấp nút, badge trạng thái, focus dễ nhận biết và hỗ trợ reduced motion.
- [x] Bổ sung trạng thái tải, lỗi có nút thử lại và trạng thái danh sách trống cho từng phân hệ/danh sách.
- [x] Thay hộp thoại trình duyệt khi sửa tài liệu và từ chối bản nháp bằng form trên trang; thêm xác nhận trước khi lưu trữ tổ hợp.
- [x] Thêm test tương tác cho trạng thái lỗi, retry, validation mật khẩu, sửa tài liệu và xác nhận lưu trữ.
- [x] `npm test -- --watch=false --browsers=ChromeHeadless`: 39 test đạt. `npm run build`: production build đạt.
- [x] Chỉ thay đổi frontend; không đổi API, quyền backend, schema hoặc dependency.

### Tinh giản giao diện admin

- [x] Giảm bóng đổ, bo góc, màu nền và chuyển động; đưa tab về gạch chân xanh, nút và bảng về kiểu cơ bản gần giao diện ban đầu.
- [x] Chỉ chỉnh stylesheet admin; giữ nguyên template, API và các tương tác.
- [x] Production build thành công. Không chạy lại unit test do thay đổi chỉ giới hạn ở CSS.

## Access token trong bộ nhớ và refresh cookie — 2026-10-12

- [x] Chốt contract với backend: cookie HttpOnly, khôi phục phiên, nhiều tab và logout ngay.
- [x] F1. Auth state trong bộ nhớ, bootstrap, interceptor và guard.
- [x] F2. Web Locks/BroadcastChannel, trạng thái lỗi và logout trên header.
- [x] F3. 36 test frontend đạt, production build thành công; kiểm tra Chrome hai tab với API thật đạt.
- [x] F4. Tổng kết thay đổi và hướng dẫn cấu hình.

### Thay đổi hiện hành

- `AuthService` giữ access token và user trong bộ nhớ; xóa key auth cũ trong session/local storage khi khởi tạo. Frontend không đọc hoặc lưu refresh token.
- GET CSRF rồi POST auth với credentials/header; refresh/logout không gửi token trong JSON. Khôi phục phiên sau tải lại trang, guard chờ kết quả, header hiển thị trạng thái và thao tác thử lại khi lỗi tạm thời.
- Interceptor chỉ gắn Bearer cho đúng origin/path backend, gom refresh đồng thời trong một tab, thử lại request một lần. Lỗi nghiệp vụ 403/500 sau retry không xóa phiên; không gửi token tới RAG hoặc domain khác.
- `SessionCoordinator` dùng Web Locks cho thao tác cookie và BroadcastChannel cho sự kiện đổi phiên/logout. Sự kiện không chứa token. Response refresh cũ không khôi phục được phiên đã logout.
- Logout báo lỗi và cho phép thử lại nếu backend chưa xác nhận thu hồi. Logout từ tab khác cũng xóa state và đưa trang admin về login.
- `/admin` render ở browser; các trang public vẫn prerender. Không gọi khôi phục auth trên server, không đưa token vào HTML/transfer cache và không có state token dùng chung giữa request SSR.
- Production `API_URL=''` để reverse proxy phục vụ `/api/v1/` cùng origin; development vẫn dùng `http://localhost:8080` và frontend `http://localhost:4200`.

### Kiểm chứng đã thực hiện

- `npm test -- --watch=false --browsers=ChromeHeadless`: **36 test đạt**, gồm test storage/memory, HTTP/CSRF, single flight, 401/403/500/503, logout lỗi, response muộn, guard và Web Locks/BroadcastChannel thật trong browser.
- `npm run build`: thành công, 3 route public prerender; admin render client.
- Chrome headless, profile tạm riêng, frontend đang chạy tại localhost:4200 và backend Docker: login SUPER_ADMIN đạt; cookie HttpOnly/SameSite/path đúng; JavaScript không đọc được refresh cookie; không có token trong session/local storage; mở admin ở tab thứ hai, reload đồng thời cả hai tab giữ phiên; logout đưa cả hai khỏi admin.
- `git diff --check`: không có lỗi whitespace. Mật khẩu tối thiểu 6 ký tự và trạng thái đỏ cho form sai vẫn được kiểm tra trong bộ test.

### Cấu hình cho phiên sau

- Dùng browser hiện đại có Web Locks/BroadcastChannel, HTTPS production hoặc localhost development. Không có cơ chế fallback ghi token xuống storage.
- Backend phải chạy contract Redis/cookie mới. Đăng nhập lại sau cập nhật; production reverse proxy phải giữ Set-Cookie và route `/api/v1/` tới backend.
- Redis ngừng hoạt động có thể khiến khôi phục phiên/API có xác thực báo lỗi; UI giữ token đang có khi lỗi tạm thời và cho phép thử lại. Đây là hành vi đã chọn để logout có hiệu lực ngay.


## Validation form mật khẩu 6 ký tự — 2026-10-12

- [x] Form đăng ký và tạo người dùng trong admin áp dụng tối thiểu 6 ký tự, hiện viền đỏ và lời nhắc sát ô không hợp lệ; xác nhận mật khẩu sai cũng được đánh dấu đỏ.
- [x] Không gửi request khi form chưa hợp lệ. Thêm test cho mật khẩu 5 ký tự và xác nhận không khớp.
- [x] Xác nhận production build và toàn bộ 36 test giao diện ở đợt cập nhật auth Redis/cookie.


## Thông báo lỗi cho khách hàng — 2026-10-12

- [x] Login, quản trị, tra cứu và chat dùng chung hàm đọc `ApiResponse.message` và thông báo theo trạng thái HTTP.
- [x] Với HTTP 500 trở lên, giao diện chỉ hiển thị thông báo chung, không chuyển chi tiết kỹ thuật từ response đến khách hàng.
- [x] Kiểm tra `npm test -- --watch=false --browsers=ChromeHeadless` (20 test) và `npm run build` thành công.

## Admin THPT và quản trị hệ thống — 2026-10-12

- [x] Đăng nhập, duy trì access/refresh token và xử lý hết phiên.
- [x] Màn quản trị tài liệu PDF, trạng thái trích xuất, xem/chỉnh sửa bản nháp và evidence trang.
- [x] Màn phê duyệt SUPER_ADMIN cho trường/nhóm môn mới và yêu cầu xóa.
- [x] CRUD người dùng, tổ hợp tuyển sinh, cấu hình LLM theo role.
- [x] Dùng cursor API để tải thêm, giữ trạng thái bộ lọc khi chuyển trang.
- [x] Cập nhật test và ghi lệnh kiểm tra đã chạy.

Khởi động: ban đầu chờ contract endpoint từ backend; contract hiện được liệt kê trong backend `docs/openapi.md`. R2 được truy cập qua API backend, không đưa secret vào trình duyệt.

Kiểm tra trước cập nhật auth UI: `npm run build` thành công; `npm test -- --watch=false --browsers=ChromeHeadless` đạt 8 test. Việc gọi API admin end-to-end vẫn cần backend đã chạy với migration V6 và cấu hình môi trường phù hợp.

### Header login/register và trạng thái phiên (2026-10-12)

- Header dùng chung đã có trên mọi route. Khi chưa đăng nhập, hiển thị liên kết `/login` và `/register`; khi đăng nhập, hiển thị tài khoản, nút đăng xuất, và mục Quản trị cho ADMIN/SUPER_ADMIN.
- `/register` mở form tạo tài khoản USER riêng; `/login` mở form đăng nhập. Cả hai dùng chung component và vẫn có thể chuyển chế độ qua liên kết trong form.
- AuthService phát trạng thái tài khoản qua signal để header cập nhật sau login, refresh, logout.
- Kiểm tra lúc thêm header: `npm test -- --watch=false --browsers=ChromeHeadless` (10 test đạt); `npm run build` thành công.

### Cải thiện giao diện login/register (2026-10-12)

- Tách template và stylesheet khỏi component; thiết kế card hai cột theo nhận diện xanh của ứng dụng, tự chuyển thành một cột trên mobile.
- Màn đăng ký có xác nhận mật khẩu, giới hạn tối thiểu 7 ký tự, thông báo lỗi rõ ràng, trạng thái gửi và nút hiện/ẩn mật khẩu có nhãn trợ năng.
- Bổ sung test cho hiển thị login/register, mismatch mật khẩu, submit login/register và chuyển trạng thái hiện mật khẩu.
- Kiểm tra: `npm test -- --watch=false --browsers=ChromeHeadless` (15 test đạt); `npm run build` thành công.

### Đồng bộ validation mật khẩu bootstrap (2026-10-12)

- Backend và form đăng ký frontend thống nhất mức tối thiểu 7 ký tự để tài khoản bootstrap `adminsp` có thể đăng nhập; OpenAPI ghi nhận điều kiện.
- Regression tests: login với mật khẩu 7 ký tự được chấp nhận qua controller validation, 6 ký tự bị từ chối; frontend đăng ký kiểm tra được mật khẩu 7 ký tự.

## Admission combination labels
Ngày triển khai: 2026-10-10.

## Thay đổi

- `CombinationDto` trong `src/app/features/search/admission.service.ts` thêm `labels: CombinationLabelDto[]`, gồm `code` và `subjectDetails`.
- Cả hai vị trí hiển thị thẻ tổ hợp trong `subject-search.component.html` liệt kê mã và môn chi tiết dưới tên tổ hợp chuẩn. Khi chưa có nhãn, thẻ vẫn hiển thị `combinationDisplay`.
- Dữ liệu đến từ `POST /api/v1/admissions/search-by-subjects`; frontend không cào trang nguồn trực tiếp.

## Phụ thuộc và kiểm tra

Backend cần migration V3 và snapshot từ `data-scrawler` đã nhập để có nhãn. Tổ hợp chưa liên kết có mảng `labels` rỗng.

`npm run build` đã chạy thành công ngày 2026-10-10.

## Kiểm thử chọn nhóm môn và truy vấn tổ hợp (2026-10-11)

- [x] Tạo skill unit test riêng cho frontend tại `.agents/skills/angular-frontend-unit-tests/SKILL.md`.
- [x] Thêm test component qua DOM: chọn nhóm gửi đúng bốn mã môn, hiển thị tổ hợp, báo lỗi truy vấn, bỏ qua phản hồi cũ khi đổi nhóm nhanh.
- [x] Thêm test HttpClient: POST đúng endpoint `/api/v1/admissions/search-by-subjects` và body mã môn.
- [x] Kiểm tra: `npm test -- --watch=false --browsers=ChromeHeadless` (6 test đạt); `npm run build` thành công.

Skill cho `data-scrawler` cũng đã được tạo và xác thực; luồng được kiểm thử trong đợt này chỉ đi qua frontend và backend. Không thay đổi logic production trong đợt kiểm thử này.

## Công bố trực tiếp bởi SUPER_ADMIN — 2026-10-14

- [x] Chỉ ADMIN nhìn thấy thao tác “Lưu và gửi duyệt”; SUPER_ADMIN có thể công bố trực tiếp bản nháp `DRAFT` hoặc `SUBMITTED` sau khi tải hết trang và xác nhận đã rà soát.
- [x] Hiển thị trạng thái Neo4j cho tài liệu đã công bố, kể cả trạng thái `SYNCED` hoặc chưa có job đồng bộ.
- [x] Cập nhật component test để kiểm tra lô trộn `DRAFT`/`SUBMITTED` có thể công bố mà không gửi duyệt.
- [x] Kiểm tra: `npm test -- --watch=false --browsers=ChromeHeadless` (53 test đạt); `npm run build` thành công.

## Rà soát và công bố nhóm môn theo trường/năm — 2026-10-14

- [x] Bỏ field địa điểm trường mới khỏi form upload và FormData; địa điểm chỉ hiển thị từ metadata trường đã đăng ký.
- [x] Nhóm môn hỗ trợ 1–4 mã môn.
- [x] SUPER_ADMIN tải hết các trang của một nhóm trường/năm học, lưu các chỉnh sửa, xác nhận đã đọc toàn bộ rồi gửi một request công bố theo batch. Không bật nút khi còn trang hoặc nháp chưa gửi duyệt.
- [x] Bỏ nút duyệt riêng từng nháp; hiển thị trạng thái đang đồng bộ graph sau khi PostgreSQL công bố thành công.
- [x] Bổ sung HTTP contract test và component test cho payload không có location, batch publish, xác nhận rà soát và yêu cầu tải hết trang.
- [x] `npm test -- --watch=false --browsers=ChromeHeadless`: 53 test đạt; `npm run build`: thành công.

## Admin năm học, trường THPT và kích thước thẻ nhóm môn — 2026-10-14

- [x] F1. Dùng year picker dạng lịch năm ở form upload và sửa tài liệu; giá trị gửi backend là một năm `YYYY`. Khi mở dữ liệu cũ dạng `YYYY-YYYY`, form đưa năm đầu vào picker.
- [x] F2. Form trường mới tải danh sách trường và tỉnh qua backend, gợi ý mã theo các chữ cái đầu sau `THPT`, cho phép nhập mã khác và hiển thị thao tác dùng trường hiện hữu khi tên/tỉnh đã tồn tại.
- [x] F3. Thẻ `button.group-card` cố định `322.13px × 172.6px`, cả desktop và mobile; mobile có thể cuộn ngang để giữ kích thước thẻ.
- [x] F4. Thêm test cho year picker, API tỉnh/mã trường, tải lựa chọn form và thao tác chọn trường hiện có.
- [x] Kiểm tra: `npm test -- --watch=false --browsers=ChromeHeadless --progress=false` (58 test đạt); `npm run build` thành công; `git diff --check` không có lỗi whitespace.

## Quản trị trường THPT và bỏ cấu hình AI — 2026-10-16

- [x] Gỡ tab cấu hình AI và các request AI-config khỏi giao diện quản trị.
- [x] Thêm tab quản lý trường THPT cho ADMIN/SUPER_ADMIN: tạo, sửa tên/tỉnh/mã, gợi ý mã theo tên, xóa mềm có bước xác nhận.
- [x] Nạp danh sách theo keyset cursor; sau khi thêm/sửa/xóa, làm mới danh sách trường dùng cho upload tài liệu và nhóm bản nháp.
- [x] Thêm HTTP contract tests cho cursor và CRUD, component tests cho quyền hiển thị tab, tải danh sách và xác nhận xóa.
- [x] Kiểm tra: `npm test -- --watch=false --browsers=ChromeHeadless --progress=false` (62 test đạt); `npm run build` thành công.

## MinIO document storage error feedback - 2026-10-16

- [x] Explain `STORAGE_OBJECT_MISSING` in the admin extraction status so operators can identify files absent from the currently selected provider.
- [x] Verification: `npm test -- --watch=false --browsers=ChromeHeadless --progress=false` passed 63 tests; `npm run build` succeeded.
# Khôi phục trường THPT đã xóa mềm — 2026-10-16

- [x] Thêm API client và màn hình SUPER_ADMIN để xem trường đã xóa mềm, khôi phục trường và theo dõi trạng thái đồng bộ graph.
- [x] Giữ tài liệu liên quan trong danh sách đã xóa để SUPER_ADMIN khôi phục riêng sau khi khôi phục trường.
- [x] Kiểm thử: `npm.cmd test -- --watch=false --browsers=ChromeHeadless` (72/72 đạt); `npm.cmd run build` thành công.

## Luồng yêu cầu xóa tài liệu theo role — 2026-10-17

- [x] ADMIN thấy nút “Yêu cầu xóa”; sau khi gửi, danh sách thể hiện trạng thái chờ SUPER_ADMIN duyệt và ẩn thao tác gửi lặp.
- [x] SUPER_ADMIN thấy thao tác “Xóa mềm” trực tiếp. Tài liệu đã xóa hoặc chờ duyệt không còn thao tác xóa trên danh sách tài liệu đang hoạt động.
- [x] Kiểm thử component: 22/22 đạt; `npm.cmd run build` thành công.
