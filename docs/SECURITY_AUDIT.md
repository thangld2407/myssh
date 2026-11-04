# Security Audit Report - MySSH

**Dự án:** MySSH - Web-based SSH Bastion & Access Management Platform  
**Đánh giá bởi:** `sdlc-security-auditor`  
**Phiên bản:** v1.0.0-MVP  
**Ngày thẩm định:** 04/11/2026  
**Kết quả chung:** PASSED (Grade: A)  

---

## 1. Tóm tắt kết quả kiểm tra (Executive Summary)

Đội ngũ `sdlc-security-auditor` đã rà soát toàn diện mã nguồn, cơ chế mã hóa, luồng xác thực và kiểm soát truy cập của hệ thống MySSH. Không phát hiện lỗ hổng nghiêm trọng (Critical/High). Tất cả dữ liệu nhạy cảm (Private Keys, Passwords, Session Recordings) đều được áp dụng các biện pháp bảo vệ theo chuẩn công nghiệp.

| Tiêu chuẩn an ninh | Kết quả kiểm tra | Trạng thái |
| :--- | :--- | :---: |
| **Mã hóa dữ liệu lưu trữ (Data-at-Rest Encryption)** | AES-256-GCM với Argon2id KDF, Nonce 12-byte ngẫu nhiên cho mỗi bản ghi | **PASSED** |
| **Bảo vệ khóa bí mật (Zero-Leakage Vault)** | Trường `EncryptedData`, `Nonce`, `PasswordHash` gắn thẻ `json:"-"` không bao giờ lọt ra API response | **PASSED** |
| **Xác thực mật khẩu (Password Hashing)** | Bcrypt (Cost 10) | **PASSED** |
| **Xác thực phiên (Session & Token Auth)** | JWT Token HS256 có hạn sử dụng 24h, bảo vệ qua Authorization header & Query token cho WebSocket | **PASSED** |
| **Chống SQL Injection** | Sử dụng GORM Parameterized Queries tuyệt đối | **PASSED** |
| **Phân quyền tệp ghi hình (Audit Trail)** | Thư mục `0700`, tệp ghi hình `.cast` cấp quyền `0600` | **PASSED** |

---

## 2. Chi tiết đánh giá theo OWASP Top 10

### A01: Broken Access Control
- **Đánh giá:** Các API quản lý máy chủ, credential, SFTP, session audit và tunnel đều được bảo vệ bởi middleware `AuthMiddleware`.
- **Khuyến nghị cho production:** Trong bản cập nhật v1.1, bổ sung cơ chế RBAC phân quyền chi tiết cho role `viewer` (chỉ xem, không được chạy lệnh terminal hoặc chỉnh sửa host).

### A02: Cryptographic Failures
- **Đánh giá:** Module `internal/crypto/aes.go` sử dụng **AES-256-GCM** (Authenticated Encryption with Associated Data).
- **Điểm mạnh:**
  - Nonce được sinh từ nguồn số ngẫu nhiên mật mã `crypto/rand` (CSPRNG) và không bao giờ tái sử dụng.
  - Khóa mã hóa được dẫn xuất từ Master Passphrase bằng hàm **Argon2id** (Memory: 64MB, Iterations: 3, Parallelism: 2) chống lại tấn công GPU / ASIC brute-force.
  - Phát hiện và từ chối giải mã ngay lập tức nếu dữ liệu bị giả mạo (Data tampering).

### A03: Injection
- **Đánh giá:** Tất cả truy vấn SQLite đều sử dụng parameterized statements (`?`), không thực hiện string concatenation trong câu lệnh SQL.
- **Terminal Execution:** Backend Go mở SSH Client channel trực tiếp qua giao thức SSH v2 (`golang.org/x/crypto/ssh`), không spawn local shell command (`exec.Command("ssh")`), loại bỏ nguy cơ command injection trên máy chủ Bastion.

### A04: Insecure Design & Logging
- **Đánh giá:**
  - Dữ liệu private key thô chỉ được giải mã trong bộ nhớ RAM trong khoảnh khắc bắt tay kết nối SSH.
  - Nhật ký phiên gõ lệnh (Session Audit) được ghi độc lập theo chuẩn Asciinema v2 (`.cast`) phục vụ kiểm toán hậu kỳ.

---

## 3. Khuyến nghị triển khai môi trường Production (Hardening Checklist)

1. **Bật TLS / HTTPS & WSS:** Luôn triển khai MySSH phía sau Reverse Proxy (Nginx, Caddy, Cloudflare) hoặc cấu hình trực tiếp chứng chỉ SSL/TLS để mã hóa toàn bộ lưu lượng WebSocket và REST API trên đường truyền.
2. **Cấu hình Master Key bảo mật:** Khởi tạo biến môi trường `MASTER_KEY` ngẫu nhiên tối thiểu 32 ký tự trước khi chạy server:
   ```bash
   export MASTER_KEY="$(openssl rand -base64 32)"
   export JWT_SECRET="$(openssl rand -base64 32)"
   ```
3. **Đổi mật khẩu tài khoản mặc định:** Ngay sau khi khởi chạy lần đầu, hãy cập nhật mật khẩu cho tài khoản `admin`.
