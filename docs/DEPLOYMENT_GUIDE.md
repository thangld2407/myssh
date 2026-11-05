# Hướng Dẫn Triển Khai Thực Chiến (Production Deployment Guide) - MySSH

Tài liệu này hướng dẫn các phương pháp triển khai MySSH an toàn, hiệu quả từ cá nhân (Homelab) đến môi trường sản xuất (Production).

---

## 🚀 1. Triển khai nhanh với Docker (Khuyên Dùng)

### 1.1 Lệnh Docker Run 1 dòng
```bash
docker run -d \
  --name myssh \
  -p 8080:8080 \
  -v myssh_data:/app/data \
  --restart unless-stopped \
  ghcr.io/myssh/myssh:latest
```

### 1.2 Docker Compose chuẩn
Tạo file `docker-compose.yml`:
```yaml
version: '3.8'

services:
  myssh:
    image: ghcr.io/myssh/myssh:latest
    container_name: myssh
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - PORT=8080
      - DB_PATH=/app/data/myssh.db
      - DATA_DIR=/app/data
      - RECORDINGS_DIR=/app/data/recordings
      - RATE_LIMIT_ENABLED=true
      - RATE_LIMIT_MAX_ATTEMPTS=5
      - RATE_LIMIT_WINDOW_MINUTES=5
```
Khởi chạy:
```bash
docker compose up -d
```

---

## 🔒 2. Triển khai Production kèm Tự Động Cấp SSL HTTPS (Caddy)

Caddy sẽ tự động đăng ký chứng chỉ SSL miễn phí từ Let's Encrypt và tự động gia hạn:

Tạo file `docker-compose.production.yml`:
```yaml
version: '3.8'

services:
  myssh:
    image: ghcr.io/myssh/myssh:latest
    container_name: myssh-backend
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    environment:
      - PORT=8080
      - DB_PATH=/app/data/myssh.db
      - DATA_DIR=/app/data
      - RECORDINGS_DIR=/app/data/recordings
    expose:
      - "8080"

  caddy:
    image: caddy:2-alpine
    container_name: myssh-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - myssh

volumes:
  caddy_data:
  caddy_config:
```

Tạo file `Caddyfile` cùng thư mục:
```caddy
{$DOMAIN:bastion.yourdomain.com} {
    encode gzip zstd
    reverse_proxy myssh:8080
}
```

Khởi chạy:
```bash
DOMAIN=bastion.example.com docker compose -f docker-compose.production.yml up -d
```

---

## 🛡️ 3. Triển khai Zero-Trust không cần mở cổng Public IP (Cloudflare Tunnel)

> [!TIP]
> **Phương pháp bảo mật an toàn nhất cho Homelab & VPS**: Bạn không cần mở Port 80 hay 443 trên Router gia đình. Tất cả lưu lượng đi qua đường hầm mã hóa của Cloudflare.

### Bước 1: Cài đặt `cloudflared`
```bash
# Trên máy chủ chạy Docker
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### Bước 2: Đăng nhập và tạo Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create myssh-tunnel
```

### Bước 3: Cấu hình file `~/.cloudflared/config.yml`
```yaml
tunnel: <UUID_TUNNEL_CỦA_BẠN>
credentials-file: /root/.cloudflared/<UUID_TUNNEL_CỦA_BẠN>.json

ingress:
  - hostname: ssh.yourdomain.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

### Bước 4: Tạo bản ghi DNS và chạy dịch vụ
```bash
cloudflared tunnel route dns myssh-tunnel ssh.yourdomain.com
sudo cloudflared service install
sudo systemctl start cloudflared
```
*Gợi ý bổ sung: Trong Cloudflare Zero Trust Dashboard, bạn có thể bật thêm "Access Application" để yêu cầu xác thực email mã PIN trước khi người dùng truy cập được trang đăng nhập MySSH.*

---

## 🖧 4. Triển khai qua mạng nội bộ ảo Tailscale

Nếu bạn chỉ muốn truy cập MySSH từ máy tính, iPad hoặc điện thoại trong mạng riêng Tailscale của bạn:

1. Chạy MySSH bind vào cổng nội bộ:
   ```bash
   docker run -d --name myssh -p 127.0.0.1:8080:8080 -v myssh_data:/app/data ghcr.io/myssh/myssh:latest
   ```
2. Dùng tính năng **Tailscale Serve**:
   ```bash
   tailscale serve --bg 8080
   ```
3. Truy cập an toàn qua tên máy tính Tailscale dạng: `https://my-server.tailnet-xyz.ts.net`.

---

## 💻 5. Chạy Single Binary với Systemd (Linux Không Cần Docker)

Tải file nhị phân sạch chỉ 26MB:
```bash
# Tải và giải nén
curl -LO https://github.com/myssh/myssh/releases/latest/download/myssh-linux-amd64.tar.gz
tar -xzf myssh-linux-amd64.tar.gz
sudo mv myssh /usr/local/bin/myssh
sudo chmod +x /usr/local/bin/myssh

# Chuẩn bị thư mục dữ liệu
sudo mkdir -p /var/lib/myssh/data
sudo useradd -r -s /bin/false myssh || true
sudo chown -R myssh:myssh /var/lib/myssh
```

Tạo file dịch vụ `/etc/systemd/system/myssh.service`:
```ini
[Unit]
Description=MySSH Web Bastion & Access Gateway
After=network.target

[Service]
Type=simple
User=myssh
Group=myssh
WorkingDirectory=/var/lib/myssh
ExecStart=/usr/local/bin/myssh
Restart=always
RestartSec=5
Environment=PORT=8080
Environment=DATA_DIR=/var/lib/myssh/data
Environment=DB_PATH=/var/lib/myssh/data/myssh.db
Environment=RECORDINGS_DIR=/var/lib/myssh/data/recordings

[Install]
WantedBy=multi-user.target
```

Kích hoạt dịch vụ:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myssh
sudo systemctl status myssh
```

---

## 💾 6. Hướng dẫn Sao lưu (Backup) & Khôi phục (Restore)

Toàn bộ thông tin máy chủ, SSH keys mã hóa, câu lệnh snippets, tunnels và video kiểm toán đều nằm trọn vẹn trong thư mục `data/`.

### Sao lưu tự động qua Cronjob:
```bash
#!/bin/bash
BACKUP_DIR="/backups/myssh"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M%S)

# Nén thư mục dữ liệu SQLite và recordings
tar -czvf "$BACKUP_DIR/myssh_backup_$DATE.tar.gz" -C /var/lib/myssh data

# Giữ bản sao lưu trong 30 ngày gần nhất
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +30 -delete
```

### Khôi phục (Restore):
1. Dừng container hoặc dịch vụ: `docker stop myssh` (hoặc `sudo systemctl stop myssh`).
2. Giải nén file backup đè vào thư mục `data/`.
3. Khởi động lại dịch vụ: `docker start myssh`. Mọi phiên làm việc, mật khẩu mã hóa và máy chủ sẽ được khôi phục nguyên vẹn 100%.
