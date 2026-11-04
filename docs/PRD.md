# Product Requirements Document (PRD) - MySSH

**Dự án:** MySSH - Web-based SSH Bastion & Access Management Platform  
**Tác giả:** `sdlc-product-analyst`  
**Phiên bản:** v1.0.0-MVP  
**Trạng thái:** Approved / Ready for Architecture Design  
**Ngày lập:** 04/11/2026  

---

## 1. Tầm nhìn sản phẩm (Product Vision)

**MySSH** là giải pháp Web-based SSH Jump Server / Bastion Host hiện đại, tập trung và an toàn cao, giúp các kỹ sư phần mềm, DevOps và System Administrator quản lý hạ tầng máy chủ từ xa trực tiếp trên trình duyệt mà không cần cài đặt client phức tạp.

Hệ thống cung cấp:
- **Zero-Footprint Access:** Kết nối SSH & SFTP trực tiếp qua giao thức WebSocket và Web Terminal (`xterm.js`).
- **Zero-Trust Security & Credential Vault:** Bảo vệ SSH Keys, Passwords bằng mã hóa cấp quân sự AES-256-GCM với Master Key derivation (Argon2id). Người dùng cuối không bao giờ nhìn thấy Private Key thô.
- **Full Auditability:** Ghi hình toàn bộ phiên làm việc (Session Recording), lưu log gõ phím để phục vụ điều tra sự cố và tuân thủ an toàn thông tin (Compliance & Forensic Audit).
- **Network Agility:** Hỗ trợ quản lý Port Forwarding / SSH Tunnels và truyền nhận tệp (SFTP) tiện lợi.

---

## 2. Chân dung người dùng (User Personas)

| Persona | Vai trò | Nhu cầu chính | Nỗi đau hiện tại (Pain Points) |
| :--- | :--- | :--- | :--- |
| **DevOps / SysAdmin (Alex)** | Quản trị viên hệ thống | Truy cập nhanh nhiều cụm server (Dev, Staging, Prod), mở đa tab terminal, SFTP upload file config, mở SSH tunnel. | Phải phân tán private keys trên máy cá nhân, dễ rò rỉ; cấu hình `~/.ssh/config` phức tạp và không đồng bộ giữa các máy. |
| **Developer (Lan)** | Kỹ sư phần mềm | Cần vào server kiểm tra log, debug sự cố mà không cần xin cấp private key trực tiếp. | Mất thời gian xin quyền truy cập, loay hoay cài đặt VPN và SSH keys. |
| **Security Auditor / SecOps (Dũng)** | Kỹ sư an ninh | Giám sát ai truy cập server nào, vào lúc nào, đã chạy những lệnh gì (`who`, `sudo rm`, v.v.). | Không có bằng chứng kiểm toán (Audit Trail), không thể xem lại video phiên làm việc khi xảy ra sự cố rò rỉ dữ liệu. |

---

## 3. Ma trận phạm vi (Scope Matrix)

| Phân hệ / Tính năng | MVP Scope (v1.0) | v1.1 - v1.2 (Post-MVP) | Out of Scope (Future) |
| :--- | :---: | :---: | :---: |
| **Host & Credential Vault** | Quản lý Server, Credentials (AES-256-GCM), Jump Host (ProxyJump) | Dynamic Tagging, Health check ping | Discovery tự động từ AWS/GCP |
| **Web Terminal** | xterm.js, WebSocket, Multi-tab, Resize PTY, Copy/Paste | Split-screen (chia màn hình) | AI Command Autocomplete |
| **Session Audit** | Lưu trữ metadata phiên, ghi log raw stream (asciinema format), Web Player | Cảnh báo lệnh nguy hiểm (`sudo`, `rm -rf`) | Live Session Sharing / Kick user |
| **SFTP Manager** | Duyệt cây thư mục, Upload, Download, Đổi tên, Xóa | Kéo thả nhiều file đồng thời, Text Editor inline | Tích hợp S3/MinIO gateway |
| **Port Forwarding** | Local Port Forwarding & Dynamic SOCKS5 Proxy manager | Remote Port Forwarding qua UI | WireGuard Mesh integration |
| **Authentication & RBAC** | Local Auth + JWT Session, vai trò Admin/User | 2FA (TOTP / Google Authenticator) | SSO SAML / OIDC / LDAP |

---

## 4. Đặc tả yêu cầu chức năng (Functional Requirements - FR)

### FR-1: Quản lý Máy chủ & Thư mục (Host Inventory & Organization)
- **FR-1.1:** Cho phép tạo, xem, cập nhật, xóa (CRUD) thông tin máy chủ SSH: Name, IP/Hostname, Port (mặc định 22), Description, Environment (Production, Staging, Development).
- **FR-1.2:** Hỗ trợ nhóm máy chủ theo Thư mục/Nhãn (Folder/Tags).
- **FR-1.3:** Hỗ trợ cấu hình Jump Host (Bastion server trung gian) để kết nối vào máy chủ trong mạng nội bộ (Private VPC/Subnet).

### FR-2: Kho lưu trữ định danh & Mã hóa bảo mật (Credential Vault)
- **FR-2.1:** Lưu trữ các loại credential:
  - SSH Private Key (RSA, ECDSA, Ed25519) kèm Passphrase nếu có.
  - Username / Password.
- **FR-2.2:** Tất cả private keys và passwords phải được mã hóa trước khi ghi vào cơ sở dữ liệu bằng thuật toán **AES-256-GCM** với khóa dẫn xuất từ Master Key / Passphrase hệ thống (Argon2id KDF).
- **FR-2.3:** Hỗ trợ sinh cặp khóa mới (Key Generator) Ed25519 trực tiếp trên giao diện để người dùng copy Public Key.

### FR-3: Web Terminal Tương tác thời gian thực (Interactive Web Terminal)
- **FR-3.1:** Kết nối SSH Client chạy ở Backend Go (`golang.org/x/crypto/ssh`) và stream I/O qua WebSocket tới Frontend (`xterm.js`).
- **FR-3.2:** Hỗ trợ PTY Resize theo thời gian thực (đồng bộ số dòng/cột khi thay đổi kích thước cửa sổ trình duyệt).
- **FR-3.3:** Hỗ trợ giao diện đa tab (Multi-tab Terminal) để mở đồng thời nhiều kết nối tới các máy chủ khác nhau.
- **FR-3.4:** Hỗ trợ các phím tắt tiêu chuẩn (Ctrl+C, Ctrl+D, Ctrl+Z, Ctrl+L, Copy/Paste chuẩn xác).

### FR-4: Ghi hình phiên & Kiểm toán bảo mật (Session Recording & Audit Logs)
- **FR-4.1:** Ghi nhận metadata của mỗi phiên kết nối: User, Host, Thời điểm bắt đầu, Thời điểm kết thúc, Trạng thái (Connected, Disconnected, Error), Địa chỉ IP client.
- **FR-4.2:** Ghi lại toàn bộ dữ liệu I/O của phiên theo định dạng **asciinema v2 format** (timestamped stream).
- **FR-4.3:** Cung cấp Web Player trên giao diện quản trị để phát lại (Play, Pause, Speed up 2x/4x) toàn bộ phiên gõ lệnh của kỹ sư.

### FR-5: Trình quản lý tệp tin SFTP (Web-based SFTP Client)
- **FR-5.1:** Mở kênh SFTP subsystem song song hoặc độc lập với session SSH.
- **FR-5.2:** Hiển thị cây thư mục remote: Tên file/folder, Dung lượng, Quyền hạn (Permissions `rwxr-xr-x`), Ngày sửa đổi.
- **FR-5.3:** Các thao tác: Tải file lên (Upload), Tải file về (Download), Tạo thư mục, Đổi tên, Xóa file/thư mục.

### FR-6: Điều phối SSH Port Forwarding / Tunnels
- **FR-6.1:** Cho phép thiết lập Local Port Forwarding: ánh xạ `localhost:<local_port>` trên máy server MySSH tới `<remote_dest_ip>:<remote_dest_port>` qua kết nối SSH.
- **FR-6.2:** Cho phép khởi tạo Dynamic SOCKS5 Proxy trên một port được chỉ định để duyệt web hoặc forward traffic an toàn qua server đích.
- **FR-6.3:** Hiển thị trạng thái hoạt động (Active/Stopped) và lượng bandwidth/connection của từng tunnel.

---

## 5. Đặc tả yêu cầu phi chức năng (Non-Functional Requirements - NFR)

1. **Hiệu năng & Độ trễ (Performance & Latency):**
   - Độ trễ nhập ký tự terminal (Keystroke round-trip) < 50ms trên kết nối mạng tiêu chuẩn.
   - Hỗ trợ tối thiểu 100 WebSocket sessions đồng thời trên cấu hình máy chủ 2 vCPU / 4GB RAM mà mức sử dụng CPU < 30%.
2. **Bảo mật (Security Standards):**
   - Không lưu trữ plaintext secret/private key ở bất kỳ đâu trong database hoặc log.
   - Kết nối WebSocket bắt buộc qua WSS (WebSocket Secure qua TLS 1.3).
   - Bảo vệ chống brute-force và rate-limiting trên API login và endpoint SSH connection.
3. **Độ tin cậy & Phục hồi (Reliability):**
   - Tự động dọn dẹp các PTY zombie process và đóng SSH channel khi kết nối WebSocket bị ngắt bất thường (Disconnect/Timeout).
4. **Khả năng tương thích (Compatibility):**
   - Web UI tương thích trên mọi trình duyệt hiện đại (Chrome, Safari, Firefox, Edge).
   - Server tương thích hệ điều hành Linux (Ubuntu, Debian, RHEL/Rocky), macOS và Docker container.

---

## 6. Tiêu chí nghiệm thu dạng Gherkin (Acceptance Criteria)

### Kịch bản 1: Đăng nhập và mở phiên Web Terminal
```gherkin
Feature: Web-based SSH Terminal Connection
  Scenario: Kết nối SSH thành công tới máy chủ bằng SSH Key
    Given Người dùng đã đăng nhập vào MySSH với quyền hợp lệ
    And Máy chủ "Prod-Web-01" đã được cấu hình với Ed25519 Key hợp lệ trong Vault
    When Người dùng bấm nút "Connect Terminal" vào máy chủ "Prod-Web-01"
    Then Hệ thống khởi tạo WebSocket connection tới backend
    And Backend giải mã Private Key trong bộ nhớ tạm và mở SSH session
    And Trình duyệt hiển thị terminal xterm.js với shell prompt "ubuntu@prod-web-01:~$"
    And Hệ thống bắt đầu ghi log phiên vào Session Audit
```

### Kịch bản 2: Ghi hình và Xem lại phiên làm việc (Session Playback)
```gherkin
Feature: Audit Session Recording
  Scenario: Xem lại phiên làm việc đã hoàn thành
    Given Người dùng "alex" đã hoàn thành phiên SSH dài 5 phút trên máy "Prod-Web-01"
    When Quản trị viên truy cập màn hình "Audit Sessions"
    And Bấm nút "View Recording" trên phiên tương ứng của "alex"
    Then Trình phát Web Player hiển thị và tự động phát lại quá trình thao tác gõ lệnh
    And Quản trị viên có thể tua nhanh (2x, 4x), dừng lại (Pause) hoặc nhảy đến thời điểm bất kỳ
```

### Kịch bản 3: Tải file lên remote server qua SFTP
```gherkin
Feature: Web SFTP File Manager
  Scenario: Upload file cấu hình lên thư mục remote
    Given Người dùng đang mở giao diện SFTP của máy chủ "Dev-App-02" tại thư mục "/etc/nginx"
    When Người dùng chọn upload tệp "nginx.conf" từ máy cục bộ
    Then Tiến trình tải lên được hiển thị với thanh phần trăm (Progress bar)
    And Sau khi hoàn tất, danh sách file tại "/etc/nginx" hiển thị file "nginx.conf" với kích thước chính xác
```

---

## 7. Phê duyệt & Chuyển giao (Handoff)

Tài liệu PRD này được `sdlc-product-analyst` phê duyệt và bàn giao cho **`sdlc-system-architect`** để thiết kế Technical Specification, Sơ đồ kiến trúc C4, Entity Relationship Diagram (ERD) và API Contracts.
