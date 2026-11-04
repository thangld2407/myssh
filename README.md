# MySSH - The Modern Web-Native Bastion & Terminal Platform

[![Go Version](https://img.shields.io/badge/Go-1.24%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev)
[![xterm.js](https://img.shields.io/badge/xterm.js-5.5-red?style=flat)](https://xtermjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Security: AES-256-GCM](https://img.shields.io/badge/Vault-AES--256--GCM-green.svg)](#security--cryptography)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](Dockerfile)

> ⚡ **A lightweight, open-source, web-native alternative to MobaXterm and Termius.**  
> Access SSH terminals, manage files with split-screen SFTP, broadcast commands across multiple servers, and audit sessions right from any modern web browser on Mac, Windows, Linux, and iPad.

---

## ⚔️ Bảng So Sánh Tính Năng (MySSH vs. The Giants)

| Tính năng cốt lõi | **MySSH** | **MobaXterm** | **Termius** | **Apache Guacamole** |
| :--- | :---: | :---: | :---: | :---: |
| **Giá thành & Bản quyền** | **100% Free & Open-Source** | $69/user (Free bị giới hạn 12 sessions) | $12 - $20 / tháng | Free / Open-Source |
| **Hỗ trợ Nền tảng** | **Mọi OS (Web-based: Mac, iPad, Linux, Windows)** | Chỉ Windows (Chạy Wine lỗi trên Mac) | Electron Desktop & Mobile | Web-based |
| **Split-Screen Terminal + SFTP** | ✅ **Có sẵn (Song hành như MobaXterm)** | ✅ Có sẵn | ❌ Phải mở tab riêng | ❌ Không có SFTP tích hợp |
| **Multi-Host Broadcast (Multi-Exec)** | ✅ **Có sẵn (Grid View gõ 1 lệnh chạy N máy)** | ✅ Có sẵn (Giao diện cũ) | ❌ Chỉ bản Enterprise đắt đỏ | ❌ Không có |
| **1-Click Import ~/.ssh/config** | ✅ **Có sẵn (Live preview table)** | ⚠️ Nhập thủ công qua session file | ⚠️ Sync cloud có phí | ❌ Cấu hình qua XML/DB |
| **Ghi hình & Replay phiên làm việc** | ✅ **Chuẩn Asciinema v2 (`.cast`)** | ❌ Chỉ log raw text file | ❌ Không hỗ trợ web player | ⚠️ Guac recording cần tool convert |
| **Zero-Trust Key Vault** | ✅ **AES-256-GCM + Argon2id** | ⚠️ File cấu hình lưu plain/weak | ☁️ Cloud Sync (Rủi ro bên thứ ba) | ⚠️ Database Auth |
| **Cài đặt & Vận hành** | **1-Liner script hoặc 1 Docker container** | File cài EXE Windows | Cài App trên từng máy tính | Cài đặt phức tạp (Guacd + Tomcat) |

---

## 🚀 Tính năng nổi bật (Key Features)

- 💻 **Web Interactive Terminal:** Shell Linux/BSD thời gian thực mượt mà qua trình duyệt (`xterm.js` + WebSocket). Hỗ trợ đổi kích thước PTY linh hoạt, đa tab (Multi-tab) mở nhiều máy chủ đồng thời.
- ⚡ **Multi-Host Broadcast Terminal (Multi-Exec):** Chọn hàng loạt máy chủ và gõ một câu lệnh để broadcast thực thi đồng thời trên tất cả các server, hiển thị kết quả trực quan dạng chia lưới (Grid View).
- 📂 **Split-Screen SFTP Explorer:** Mở cây thư mục SFTP chạy song song bên cạnh Terminal trong cùng 1 tab như MobaXterm. Hỗ trợ kéo thả, upload, download, tạo thư mục và xóa tệp an toàn.
- 🪄 **1-Click OpenSSH / MobaXterm Importer:** Kéo thả hoặc dán trực tiếp file `~/.ssh/config` để tự động bóc tách Host, Port, User, ProxyJump và nhập hàng loạt vào hệ thống.
- 🔐 **Zero-Trust Credential Vault:** Bảo vệ SSH Private Keys (RSA, Ed25519) và mật khẩu bằng thuật toán mã hóa **AES-256-GCM** với khóa dẫn xuất **Argon2id**.
- 🔑 **Ed25519 Key Generator:** Tự động sinh cặp khóa SSH Ed25519 một chạm trực tiếp trên giao diện và sao chép Public Key vào clipboard.
- 🎥 **Session Audit & Web Player:** Ghi hình toàn bộ I/O phiên làm việc theo chuẩn **Asciinema v2 (`.cast`)** và cung cấp Web Player xem lại với tốc độ 1x, 2x, 4x phục vụ kiểm toán an toàn thông tin.
- 🔀 **SSH Port Forwarding & Tunnels:** Thiết lập và quản lý Local Port Forwarding và Dynamic SOCKS5 Proxy trực quan.
- 🛡️ **First-Run Setup Wizard:** Không chứa mật khẩu mặc định hardcoded! Khi khởi chạy lần đầu, wizard bảo mật yêu cầu người dùng tự đặt mật khẩu quản trị mạnh và tích hợp bộ đếm giới hạn tần suất (Rate Limiting) chống Brute-force.

---

## ⚡ Cài đặt nhanh trong 1 dòng lệnh (1-Liner Quick Install)

### Cách 1: Chạy trực tiếp lệnh Curl Installer (Linux / macOS VPS)

```bash
curl -fsSL https://raw.githubusercontent.com/myssh/myssh/main/scripts/install.sh | bash
```

### Cách 2: Sử dụng Docker Compose

```bash
# Clone dự án
git clone https://github.com/myssh/myssh.git
cd MySSH

# Khởi chạy dịch vụ
docker compose up -d
```
Truy cập giao diện tại: **`http://localhost:8080`**

### Cách 3: Docker Compose kèm Tự Động Cấp SSL HTTPS (Caddy)

```bash
DOMAIN=bastion.yourdomain.com docker compose -f docker-compose.production.yml up -d
```
Caddy sẽ tự động đăng ký chứng chỉ SSL Let's Encrypt và kích hoạt HTTPS cho domain của bạn.

---

## 🛡️ Khởi Tạo Lần Đầu (First-Run Setup)

Trong lần khởi chạy đầu tiên, MySSH sẽ hiển thị **First-Run Setup Wizard**:
1. Đặt họ tên và tên đăng nhập Quản trị viên (Master Admin).
2. Nhập mật khẩu mạnh (tối thiểu 8 ký tự với thanh đo độ an toàn thời gian thực).
3. Hệ thống sẽ tự động kích hoạt mã hóa AES-256-GCM và chuyển bạn vào màn hình điều khiển.

---

## ⚙️ Biến môi trường cấu hình (Configuration)

| Tên biến | Giá trị mặc định | Mô tả |
| :--- | :--- | :--- |
| `PORT` | `8080` | Cổng HTTP / WebSocket lắng nghe |
| `DB_PATH` | `data/myssh.db` | Đường dẫn file cơ sở dữ liệu SQLite |
| `DATA_DIR` | `data` | Thư mục lưu trữ dữ liệu ứng dụng |
| `RECORDINGS_DIR`| `data/recordings` | Thư mục lưu file ghi hình phiên `.cast` |
| `MASTER_KEY` | *(Tự sinh hoặc đặt)* | Chuỗi khóa mã hóa chính cho Credential Vault (AES-256-GCM) |
| `JWT_SECRET` | *(Tự sinh hoặc đặt)* | Secret key ký và xác thực JWT token |

---

## 🧪 Kiểm thử (Testing)

Dự án có đầy đủ bộ Unit Tests cho các module cốt lõi (Crypto, Keygen, Recorder, JWT, Middleware):

```bash
# Chạy toàn bộ Unit Tests
go test -v ./...
```

---

## ❤️ Sponsor & Build in Public

MySSH là dự án nguồn mở 100% miễn phí được phát triển công khai (Build in Public). Nếu MySSH giúp bạn tiết kiệm được tiền mua bản quyền MobaXterm ($69) hay Termius ($15/tháng), hãy cân nhắc ủng hộ dự án để duy trì hạ tầng:

- ☕ **Buy Me a Coffee:** [buymeacoffee.com](https://buymeacoffee.com)
- 💖 **GitHub Sponsors:** [github.com/sponsors](https://github.com/sponsors)
- 🏦 **VietQR / MoMo:** Quét mã QR trực tiếp trong mục **Sponsor** trên thanh công cụ của ứng dụng.
- 🪙 **Crypto (ETH / USDT):** `0x71C000000000000000000000000000000004f3B9`

---

## 📄 License

Phát hành dưới giấy phép mã nguồn mở **MIT License**.
