# Kịch Bản Phát Hành Cộng Đồng (Community Launch Playbook) - MySSH

Tài liệu này cung cấp toàn bộ chiến lược, phân cảnh video demo, mẫu bài đăng trên các diễn đàn (Việt Nam & Quốc tế), và cẩm nang xử lý câu hỏi phản biện khi chính thức công bố **MySSH**.

---

## 🎬 1. KỊCH BẢN QUAY DEMO GIF / VIDEO (30 - 45 GIÂY)

Video demo là yếu tố quyết định 80% người xem có dừng lại đọc tiếp hay lướt qua. Hãy dùng công cụ quay màn hình sạch (ví dụ: *CleanShot X*, *OBS*, hoặc *Screen Studio*) với độ phân giải Full HD (1920x1080) và chuyển đổi thành ảnh GIF/MP4 nhúng ngay đầu `README.md`.

| Thời gian | Phân cảnh (Action) | Nội dung hiển thị & Hiệu ứng | Mục tiêu cảm xúc |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:07** | **1-Click Import OpenSSH Config**<br>Mở modal import, kéo thả file `~/.ssh/config` (có 5-10 hosts) vào ô dán.<br>Bấm **"Nhập ngay"**. | Danh sách máy chủ hiện ra tức thì với đầy đủ Hostname, User, Port và phân loại Folder. | *"Wow, không cần nhập thủ công từng server, dùng được ngay lập tức!"* |
| **00:08 - 00:18** | **Mở Web Terminal song hành Split SFTP**<br>Nhấp đúp vào 1 Server, Terminal mở ra mượt mà, gõ `htop` hoặc `neofetch`.<br>Bấm nút **"Mở SFTP Split-screen"**, cây thư mục server hiện ngay bên phải. | Thao tác kéo một tệp cấu hình từ Desktop thả thẳng vào thư mục server. Tệp upload xong với thanh tiến trình xanh. | *"Trải nghiệm y hệt MobaXterm nhưng chạy mượt trên Web/Macbook!"* |
| **00:19 - 00:27** | **Inline Text Editor (Sửa file từ xa)**<br>Nhấp vào file `.env` hoặc `nginx.conf`, cửa sổ soạn thảo hiện lên với số dòng.<br>Sửa một dòng cấu hình $\rightarrow$ Bấm `Ctrl+S` $\rightarrow$ Thông báo *"Lưu tệp thành công"*. | Thao tác trực tiếp không cần mở Nano/Vim, không cần tải file về máy rồi upload lại. | *"Cực kỳ tiện lợi cho các tình huống sửa nhanh trên production."* |
| **00:28 - 00:36** | **Multi-Host Broadcast (Grid View)**<br>Chọn 4 máy chủ $\rightarrow$ Bật chế độ **Multi-Exec**.<br>Gõ lệnh `uptime` hoặc `docker ps` vào thanh nhập chung. | 4 terminal con cùng phản hồi kết quả đồng thời trong giao diện chia lưới (Grid). | *"Tính năng sát thủ! Quản lý cluster không cần Ansible/SSH loop."* |
| **00:37 - 00:45** | **Zero-Trust & 2FA / Session Audit**<br>Hiện huy hiệu 2FA quét QR Google Authenticator.<br>Mở mục **Session Audit**, bấm xem lại một phiên làm việc bằng Asciinema player tốc độ 2x. | Đóng video với dòng thông điệp:<br>**"MySSH: 100% Free & Open-Source. 1 Single Binary / Docker Container."** | *"Chuyên nghiệp, an toàn, chuẩn Enterprise."* |

---

## 📢 2. MẪU BÀI VIẾT CHO CỘNG ĐỒNG VIỆT NAM

### Kênh 1: Nhóm J2TEAM Community (Facebook)
- **Tiêu đề**: *(Dự án cá nhân)* Tự viết Web Bastion & Terminal thay thế MobaXterm và Termius: Hỗ trợ Split SFTP, Broadcast nhiều server, tự host 100% miễn phí bằng 1 Docker duy nhất
- **Nội dung gợi ý**:
```markdown
Chào anh em J2TEAM,

Mình chuyển sang dùng macOS từ lâu, nhưng điều mình nhớ nhất ở Windows chính là phần mềm **MobaXterm** — đặc biệt là tính năng cây thư mục SFTP chạy song song cạnh Terminal, cần sửa file gì chỉ việc double-click mở ra sửa rồi Ctrl+S là xong. Trên Mac thì Termius dùng giao diện khá mượt nhưng giá thuê bao quá chát ($12 - $20/tháng), lại phải sync SSH private key lên Cloud của họ nên mình không an tâm.

Vì vậy, mình quyết định tự code một giải pháp nguồn mở có tên là **MySSH**:
👉 GitHub Repository: https://github.com/myssh/myssh

🔥 Các điểm nổi bật mình đã tối ưu:
1. Web-native 100%: Dùng trên MacBook, iPad, Linux hay Windows qua bất kỳ trình duyệt nào (xterm.js + WebSocket siêu mượt).
2. Split-Screen SFTP + Inline Editor: Mở song song Terminal và cây thư mục, có editor sửa file trực tiếp từ xa với phím tắt Ctrl+S lưu đè.
3. Multi-Host Broadcast: Chọn nhiều server và gõ 1 lệnh chạy đồng loạt (Grid View) rất tiện khi bảo trì hàng loạt VPS.
4. Bảo mật Zero-Trust: Mã hóa Private Key bằng AES-256-GCM + Argon2id ngay trong SQLite nội bộ, tích hợp sẵn xác thực 2FA (Google Authenticator/Authy).
5. Ghi hình phiên làm việc (Session Recording): Tự động quay lại luồng I/O theo chuẩn Asciinema v2 (.cast) để kiểm toán.
6. Siêu nhẹ & Gọn gàng: Backend viết bằng Go tiêu thụ chưa tới 30MB RAM. Đóng gói sẵn toàn bộ giao diện thành 1 file nhị phân duy nhất (26MB) hoặc 1 lệnh Docker chạy ngay:

docker run -d --name myssh -p 8080:8080 -v myssh_data:/app/data ghcr.io/myssh/myssh:latest

Mã nguồn mở 100% theo giấy phép MIT. Rất mong nhận được góp ý và review bảo mật từ các anh em DevOps / Sysadmin trong nhóm! Nếu thấy hữu ích thì cho mình xin 1 ⭐️ trên GitHub nhé. Cảm ơn anh em!
```

---

### Kênh 2: Diễn đàn Voz.vn (F17 / F80 Lập trình)
- **Tiêu đề**: [Khoe/Chia sẻ] Em tự viết Web Bastion SSH thay thế MobaXterm/Termius bằng Go + React, mời các thím thẩm định
- **Tóm tắt bài**: Văn phong giản dị, tập trung vào lý do kỹ thuật (tại sao chọn Go, tại sao không dùng Guacamole, benchmark RAM 30MB, cách mã hóa AES-256-GCM, demo link).

---

## 🌍 3. MẪU BÀI VIẾT CHO CỘNG ĐỒNG QUỐC TẾ

### Kênh 1: Hacker News (Show HN)
- **URL nộp bài**: `https://news.ycombinator.com/submit`
- **Tiêu đề**: `Show HN: MySSH – Lightweight web bastion alternative to MobaXterm and Termius`
- **Nội dung thảo luận (Text / First Comment)**:
```markdown
Hi HN,

I built MySSH (https://github.com/myssh/myssh) because I missed MobaXterm's built-in split SFTP file tree after switching from Windows to macOS, and I was hesitant to sync sensitive infrastructure credentials to third-party clouds like Termius.

Key Highlights:
- **Web-native & Responsive:** Runs in any browser on Mac, iPad, Windows, or Chromebook via xterm.js & real-time WebSocket PTY.
- **Split SFTP + Inline Editor:** Side-by-side terminal & file explorer with remote code editing (Ctrl+S).
- **Multi-Host Broadcast:** Execute commands simultaneously across N servers with synchronized grid output.
- **Zero-Trust Vault & 2FA:** Private keys encrypted locally with AES-256-GCM and Argon2id. Integrated TOTP 2FA (Google Authenticator/Authy).
- **Asciinema v2 Audit:** Records all session I/O to .cast files with an embedded web replay player.
- **Ultra-lightweight:** Pure Go backend using <30MB of RAM. Packaged as a single 26MB binary (via go:embed) or a single multi-arch Docker container (amd64 & arm64).

Quick run:
`docker run -d -p 8080:8080 -v myssh_data:/app/data ghcr.io/myssh/myssh:latest`

Source code is 100% free & open-source under the MIT license. I'd love your feedback on the architecture and security implementation!
```

---

### Kênh 2: Reddit (`r/selfhosted` & `r/homelab`)
- **Subreddit**: `r/selfhosted` (Post Flair: `Self-Promotion` hoặc `Release`)
- **Tiêu đề**: `I made MySSH: A modern, self-hosted web bastion with split-screen SFTP and Multi-Host Broadcast (Single Docker / Binary)`
- **Điểm nhấn thu hút**:
  - Nhấn mạnh tính năng **100% Offline / Local-first** (không phụ thuộc bất kỳ cloud nào).
  - Tích hợp 2FA TOTP để tự tin expose qua Cloudflare Tunnel / Tailscale.
  - Hỗ trợ kiến trúc Raspberry Pi / ARM64.

---

## 🛡️ 4. BỘ CÂU HỎI THƯỜNG GẶP & PHẢN BIỆN (FAQ & OBJECTIONS)

### Q1: "Dùng Web SSH có nguy hiểm hơn SSH Client truyền thống trên Desktop không?"
> **Trả lời**: Mọi giải pháp Web SSH đều đưa một cổng HTTP/WS ra ngoài. Tuy nhiên, MySSH được thiết kế theo nguyên tắc phòng thủ đa lớp (Defense-in-depth):
> 1. Không có mật khẩu mặc định (Wizard bắt buộc đặt mật khẩu mạnh lần đầu).
> 2. Rate-limiting chống brute-force mật khẩu.
> 3. Xác thực hai yếu tố **2FA / TOTP** bắt buộc với mọi truy cập.
> 4. Tất cả SSH Private Key và mật khẩu lưu trong SQLite đều được mã hóa bằng thuật toán **AES-256-GCM** với khóa phụ thuộc mật mã quản trị.
> 5. Khuyến cáo cộng đồng: Sử dụng kết hợp **Cloudflare Zero Trust Tunnel** hoặc **Tailscale** để không cần mở bất kỳ cổng public nào trên Router.

### Q2: "Tại sao không dùng Apache Guacamole?"
> **Trả lời**: Apache Guacamole rất mạnh mẽ cho RDP/VNC của doanh nghiệp, nhưng đối với quản trị viên SSH/DevOps thì Guacamole:
> - Quá cồng kềnh (yêu cầu cụm Java Tomcat + Guacd daemon C + MySQL).
> - Tiêu tốn hàng trăm MB RAM.
> - Hoàn toàn không có cây thư mục SFTP kéo thả song song, không có editor sửa file từ xa, không có Multi-exec broadcast.
> MySSH tập trung giải quyết xuất sắc mảng SSH & SFTP trong **1 file nhị phân duy nhất** ngốn <30MB RAM.

### Q3: "Làm sao sao lưu dữ liệu server và khóa?"
> **Trả lời**: Toàn bộ dữ liệu của MySSH chỉ nằm gọn trong thư mục `data/` (gồm file SQLite `myssh.db` và các file ghi hình `recordings/`). Bạn chỉ cần sao lưu thư mục `data/` là có thể chuyển sang máy chủ mới trong 10 giây.
