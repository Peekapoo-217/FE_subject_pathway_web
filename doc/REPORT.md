# REPORT - FE_subject_pathway_web

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
