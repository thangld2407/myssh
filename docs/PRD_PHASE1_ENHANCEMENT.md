# Phase 1 Enhancement PRD: SFTP Inline Code Editor & Snippet Library

**Dự án:** MySSH - Modern Web Bastion & Terminal Platform  
**Vai trò:** `sdlc-product-analyst`  
**Phiên bản:** v1.1.0-Enhancement  
**Ngày:** 04/11/2026  
**Trạng thái:** In-Progress (Execution)

---

## 1. Mục tiêu (Objectives)

Nâng cấp trải nghiệm người dùng (UX) và năng suất vận hành (Productivity) của kỹ sư DevOps / SysAdmin với hai tính năng cốt lõi:
1. **SFTP Inline Code & Text Editor:** Cho phép xem, sửa và lưu trực tiếp các tệp tin cấu hình (`.conf`, `.env`, `.sh`, `.yml`, `.json`, `.py`, `.txt`...) từ xa mà không cần tải về máy cá nhân rồi upload ngược lại.
2. **Snippet & Quick Command Library:** Lưu trữ, quản lý kho lệnh mẫu có tham số động (`{{PORT}}`, `{{CONTAINER_ID}}`), phân loại theo thư mục/thẻ và hỗ trợ 1-click đưa lệnh vào phiên terminal đang mở.

---

## 2. Đặc tả tính năng (Feature Specifications)

### Feature 1: SFTP Inline Code / Text Editor

- **FR-1.1:** Người dùng nhấp đúp vào tệp tin văn bản hoặc nhấn nút *"Edit"* trong menu thao tác SFTP để mở trình soạn thảo trực tiếp trên giao diện web.
- **FR-1.2:** Giới hạn dung lượng an toàn tối đa 5MB đối với tệp mở chỉnh sửa để tránh tràn bộ nhớ trình duyệt hoặc backend.
- **FR-1.3:** Giao diện soạn thảo hỗ trợ:
  - Hiển thị số dòng (Line Numbers) và font monospace chuẩn lập trình.
  - Tự động nhận diện loại tệp (Bash, JSON, YAML, Config, Python, JavaScript/TypeScript, SQL, Markdown, Plain Text).
  - Thanh trạng thái hiển thị: Đường dẫn file, Dung lượng, Trạng thái sửa đổi (*Unsaved Changes*).
  - Phím tắt `Ctrl + S` / `Cmd + S` để lưu trực tiếp về server qua SFTP.
  - Cảnh báo khi người dùng nhấn đóng nếu có thay đổi chưa lưu (*Unsaved changes dialog*).

### Feature 2: Snippet & Quick Command Library

- **FR-2.1:** Quản lý kho câu lệnh mẫu (CRUD): Tên lệnh, Nội dung câu lệnh (hỗ trợ nhiều dòng), Mô tả, Thư mục/Danh mục phân loại (vd: *Docker*, *System*, *Network*, *Nginx*, *Kubernetes*), Danh sách thẻ (Tags).
- **FR-2.2:** Hỗ trợ tham số động định dạng `{{TÊN_BIẾN}}` (ví dụ: `docker logs -f {{CONTAINER_ID}} --tail {{LINES}}`).
- **FR-2.3:** Tự động khởi tạo (Seed) sẵn một bộ sưu tập lệnh mẫu DevOps hữu ích khi hệ thống khởi chạy lần đầu:
  - *Docker Container Cleanup*
  - *Server Resource & Open Ports Check*
  - *Nginx Configuration Test & Reload*
  - *Disk Space Hog Analyzer (`ncdu` / `du -sh`)*
  - *Systemd Service Logs Inspection*
- **FR-2.4:** Tích hợp trực tiếp vào thanh công cụ của Terminal:
  - Nút **"Snippets" (⚡)** trên thanh tab terminal.
  - Khi người dùng chọn lệnh không có tham số: Lệnh được dán thẳng vào terminal đang hoạt động.
  - Khi lệnh có tham số `{{...}}`: Hiển thị modal nhỏ cho phép điền giá trị tham số trước khi thực thi.

---

## 3. Tiêu chí nghiệm thu (Acceptance Criteria - Gherkin)

```gherkin
Scenario: Chỉnh sửa và lưu tệp từ xa qua SFTP Inline Editor
  Given Người dùng đang mở cây thư mục SFTP của máy chủ "prod-api-01"
  When Người dùng click vào tệp "nginx.conf"
  Then Hệ thống tải nội dung tệp và hiển thị trong màn hình Editor kèm số dòng
  When Người dùng thay đổi cấu hình và nhấn tổ hợp phím "Ctrl + S"
  Then Hệ thống gửi nội dung cập nhật lên máy chủ và hiển thị thông báo "File saved successfully"

Scenario: Thực thi lệnh mẫu có tham số vào Terminal
  Given Người dùng đang mở tab SSH Terminal của server "db-cluster-01"
  When Người dùng mở thanh công cụ Snippet và chọn lệnh "Docker Inspect Container"
  Then Modal điền tham số hiển thị ô nhập cho "{{CONTAINER_ID}}"
  When Người dùng nhập "redis-prod" và nhấn "Insert into Terminal"
  Then Câu lệnh hoàn chỉnh được gửi trực tiếp vào phiên terminal
```
