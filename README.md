# Hướng nghiệp Đại học - Cổng thông tin Tuyển sinh (Frontend)

Dự án Frontend Angular xây dựng giao diện người dùng cho hệ thống **GraphRAG Hướng nghiệp và Tuyển sinh Đại học** (Phục vụ Khóa luận tốt nghiệp). Hệ thống giúp học sinh THPT tra cứu nhanh chóng các tổ hợp xét tuyển, ngành học và trường đại học dựa trên nhóm môn học thế mạnh.

## 1. Công nghệ sử dụng (Tech Stack)
- **Core Framework:** Angular 16+ (Standalone Components API)
- **Ngôn ngữ:** TypeScript 5.0+ (Strict Mode)
- **Reactivity:** RxJS
- **Styling:** CSS3 (Flexbox/Grid), BEM Methodology
- **Tích hợp:** HttpClient kết nối với Spring Boot 3 RESTful API

## 2. Tính năng cốt lõi (Core Features)
### Tra cứu môn học (Subject-based Pathway)
- **Lựa chọn môn học:** Cung cấp danh sách 9 môn thi THPT (Toán, Văn, Anh, Vật lí, Hóa học, Sinh học, Lịch sử, Địa lí, GD KT&PL).
- **Ràng buộc nghiệp vụ:** Thí sinh chỉ được chọn tối đa **04 môn thi**. Hệ thống có cơ chế chặn trực tiếp trên UI nếu vi phạm.
- **Hiển thị kết quả (Tuyensinh247 Clone):**
  - Giao diện thống kê trực quan (UI card nổi bật) với 3 chỉ số chính: Tổng số tổ hợp, Số ngành, Số trường đại học xét tuyển.
  - Render chi tiết danh sách mã tổ hợp (VD: A00, A01, D07) hợp lệ từ các môn đã chọn.
  - Hiển thị thông báo lỗi thân thiện (User-friendly error messages) khi không tìm thấy dữ liệu hoặc mất kết nối Backend.

## 3. Luồng dữ liệu (Data Flow)
1. **Client:** User chọn checkbox môn học -> Lưu vào mảng `subjectCodes` (VD: `['MATH', 'PHYSICS', 'CHEMISTRY']`).
2. **Action:** Click "Tra cứu" -> Component bật cờ `isLoading = true` -> Service gửi POST Request tới Backend.
3. **Backend (Spring Boot):** Xử lý logic lọc `HAVING COUNT` dưới PostgreSQL -> Trả về JSON theo chuẩn `ApiResponse<T>`.
4. **Render:** Angular nhận JSON, update State -> Template HTML tự động update qua cơ chế Data Binding.

## 4. Hướng dẫn cài đặt & Chạy dự án (Setup Guide)

### Yêu cầu môi trường
- Node.js v18.x trở lên
- Angular CLI v16.x trở lên

### Các bước chạy dự án
```bash
# 1. Clone repository (nếu có) hoặc di chuyển vào thư mục dự án
cd edu-guidance-web

# 2. Cài đặt các thư viện phụ thuộc
npm install

# 3. Chạy server phát triển (Development Server)
ng serve