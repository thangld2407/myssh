#!/usr/bin/env bash
# ==============================================================================
# MySSH 1-Liner Automated Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/myssh/myssh/main/scripts/install.sh | bash
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
cat << "EOF"
  __  __       _____ _____ _    _ 
 |  \/  |     / ____/ ____| |  | |
 | \  / |_   | (___| (___ | |__| |
 | |\/| | | | \___ \\___ \|  __  |
 | |  | | |_| |___) |___) | |  | |
 |_|  |_|\__, |_____/_____/|_|  |_|
          __/ |                   
         |___/                    
 Modern Web Bastion & Terminal Platform
EOF
echo -e "${NC}"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo -e "${RED}[!] Kiến trúc CPU $ARCH chưa được hỗ trợ.${NC}"; exit 1 ;;
esac

echo -e "${GREEN}[+] Phát hiện hệ điều hành: ${OS} (${ARCH})${NC}"

# Check Docker option first
if command -v docker &> /dev/null; then
  echo -e "${YELLOW}[?] Bạn có muốn cài đặt nhanh qua Docker không? [Y/n]${NC}"
  read -r USE_DOCKER || USE_DOCKER="Y"
  if [[ "$USE_DOCKER" =~ ^[Yy]$ || -z "$USE_DOCKER" ]]; then
    APP_PORT="${MYSSH_PORT:-${PORT:-8080}}"
    echo -e "${GREEN}[+] Khởi chạy MySSH Container qua Docker trên cổng ${APP_PORT}...${NC}"
    docker run -d \
      --name myssh \
      --restart unless-stopped \
      -p "${APP_PORT}:${APP_PORT}" \
      -v myssh_data:/app/data \
      -e PORT="${APP_PORT}" \
      ghcr.io/myssh/myssh:latest || docker run -d --name myssh -p "${APP_PORT}:${APP_PORT}" -e PORT="${APP_PORT}" myssh:latest

    echo -e "\n${GREEN}================================================================${NC}"
    echo -e "${GREEN}🎉 Cài đặt MySSH thành công!${NC}"
    echo -e "Truy cập ngay: ${BLUE}http://localhost:${APP_PORT}${NC} hoặc IP máy chủ của bạn."
    echo -e "Khởi tạo tài khoản: ${YELLOW}Truy cập web để tự đặt mật khẩu quản trị viên an toàn (Setup Wizard)${NC}"
    echo -e "${GREEN}================================================================${NC}\n"
    exit 0
  fi
fi

# Standalone binary install
INSTALL_DIR="/usr/local/bin"
DATA_DIR="/var/lib/myssh"

echo -e "${GREEN}[+] Chuẩn bị thư mục dữ liệu: ${DATA_DIR}${NC}"
mkdir -p "${DATA_DIR}"

echo -e "${GREEN}[+] Tải bản nhị phân MySSH mới nhất...${NC}"
# For testing local or GitHub release url:
RELEASE_URL="https://github.com/myssh/myssh/releases/latest/download/myssh-${OS}-${ARCH}"

if command -v curl &> /dev/null; then
  curl -fsSL -o /tmp/myssh "${RELEASE_URL}" || cp ./bin/myssh /tmp/myssh 2>/dev/null || true
elif command -v wget &> /dev/null; then
  wget -qO /tmp/myssh "${RELEASE_URL}" || cp ./bin/myssh /tmp/myssh 2>/dev/null || true
fi

if [ -f /tmp/myssh ]; then
  chmod +x /tmp/myssh
  mv /tmp/myssh "${INSTALL_DIR}/myssh"
  echo -e "${GREEN}[+] Đã cài đặt nhị phân vào ${INSTALL_DIR}/myssh${NC}"
else
  echo -e "${RED}[!] Không thể tải nhị phân. Vui lòng build thủ công bằng 'make build'.${NC}"
  exit 1
fi

# Setup systemd service if on Linux
if [ "$OS" = "linux" ] && command -v systemctl &> /dev/null; then
  echo -e "${GREEN}[+] Tạo Systemd Service /etc/systemd/system/myssh.service...${NC}"
  cat << EOF > /etc/systemd/system/myssh.service
[Unit]
Description=MySSH Web Bastion & Terminal Platform
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${DATA_DIR}
ExecStart=${INSTALL_DIR}/myssh
Restart=always
RestartSec=5
Environment=MYSSH_PORT=8080
Environment=MYSSH_DB_PATH=${DATA_DIR}/myssh.db

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now myssh
  echo -e "${GREEN}[+] Dịch vụ MySSH đã được kích hoạt và khởi chạy!${NC}"
fi

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 Cài đặt MySSH hoàn tất!${NC}"
echo -e "Truy cập giao diện tại: ${BLUE}http://localhost:8080${NC}"
echo -e "Khởi tạo tài khoản: ${YELLOW}Truy cập web để tự đặt mật khẩu quản trị viên an toàn (Setup Wizard)${NC}"
echo -e "${GREEN}================================================================${NC}\n"
