# MySSH - The Modern Web-Native Bastion & Terminal Platform

[![Go Version](https://img.shields.io/badge/Go-1.26%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev)
[![xterm.js](https://img.shields.io/badge/xterm.js-5.5-red?style=flat)](https://xtermjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Security: AES-256-GCM](https://img.shields.io/badge/Vault-AES--256--GCM-green.svg)](#-security--cryptography-architecture)
[![2FA: TOTP](https://img.shields.io/badge/2FA-TOTP%20Ready-blue.svg)](#-two-factor-authentication-2fa--totp)
[![Docker](https://img.shields.io/badge/Docker-Multi--Arch-2496ED?style=flat&logo=docker)](Dockerfile)

> ⚡ **A lightweight, open-source, web-native alternative to MobaXterm and Termius.**  
> Access interactive SSH terminals, manage files with split-screen SFTP, broadcast commands across multiple servers, and audit sessions right from any modern web browser on macOS, Linux, Windows, or iPad.

---

## ⚔️ Feature Comparison (MySSH vs. The Alternatives)

| Core Capabilities | **MySSH** | **MobaXterm** | **Termius** | **Apache Guacamole** |
| :--- | :---: | :---: | :---: | :---: |
| **Pricing & License** | **100% Free & Open-Source (MIT)** | $69/user (Free tier capped at 12 sessions) | $12 - $20 / month / user | Free / Open-Source (Apache 2.0) |
| **Supported Platforms** | **Web-Native (macOS, iPad, Linux, Windows)** | Windows only (Wine on macOS is buggy) | Electron Desktop & Mobile | Web-Native |
| **Split-Screen Terminal + SFTP** | ✅ **Built-in (Side-by-side like MobaXterm)** | ✅ Built-in | ❌ Separate tab/window | ❌ No built-in SFTP tree |
| **Multi-Host Command Broadcast** | ✅ **Built-in (Grid View: 1 input $\rightarrow$ N servers)** | ✅ Built-in (Classic UI) | ❌ Paid Enterprise tier only | ❌ Not supported |
| **1-Click `~/.ssh/config` Import** | ✅ **Built-in (Instant parser & live preview)** | ⚠️ Manual session import | ⚠️ Cloud sync required | ❌ Manual XML/DB config |
| **Session Recording & Audit Replay** | ✅ **Asciinema v2 (`.cast`) Web Player** | ❌ Raw text logs only | ❌ No web replay player | ⚠️ Guac recording needs conversion |
| **Zero-Trust Credential Vault** | ✅ **AES-256-GCM + Argon2id** | ⚠️ Plaintext or weak INI files | ☁️ 3rd-party Cloud Sync risk | ⚠️ Database Auth |
| **Two-Factor Authentication (2FA)** | ✅ **TOTP (Google Authenticator, Authy)** | ❌ No native 2FA | ⚠️ Cloud account 2FA | ⚠️ Extension required |
| **Resource Consumption** | **Ultra-lightweight (<30MB RAM)** | Lightweight (Win32) | Heavy (Electron >300MB RAM) | Heavy (Java Tomcat + Guacd daemon) |
| **Packaging & Deployment** | **Single 26MB Binary or 1 Docker Container** | Windows `.exe` installer | Desktop client per computer | Complex setup (Tomcat + Guacd + DB) |

---

## 🚀 Key Features

- 💻 **Real-Time Interactive Web Terminal:** Hardware-accelerated terminal emulation in any browser powered by `xterm.js` and WebSocket PTY. Full 256-color and 24-bit truecolor support, smooth resize handling, and multi-tab concurrent server sessions.
- 📊 **Zero-Agent Live Server Telemetry:** Instant live telemetry overlay directly on top of active terminal tabs without installing any daemon or agent on target servers. Real-time CPU usage, RAM free/used, root Disk (/), Load Averages, and Uptime with automated 5s/10s polling and compact/detailed modes.
- ⚡ **Multi-Host Broadcast Terminal (Multi-Exec):** Select multiple servers and type once to broadcast commands across your entire fleet simultaneously with synchronized output in an adaptive Grid View.
- ☸️ **Direct Kubernetes (K8s) Cluster Hub:** Native cluster fleet management with AES-256-GCM encrypted Kubeconfigs. Explore Pods, Deployments, Services, and Nodes across Namespaces; stream **Live Container Logs** in real-time; open hardware-accelerated **Interactive Web Pod Exec Terminals** (`/bin/sh`, `/bin/bash`); inspect & apply live **YAML Manifests**; and effortlessly establish **K8s Port Forwarding** directly to localhost.
- 📂 **Split-Screen SFTP File Explorer:** Open a remote SFTP directory tree side-by-side with your active terminal session just like MobaXterm. Includes drag-and-drop file uploads, directory creation, downloads, and permission management.
- 📝 **Inline Remote Code & Text Editor:** Inspect and edit configuration files (`.conf`, `.sh`, `.env`, `.py`, `.yaml`, `.json`) directly on remote hosts with line numbers, code syntax cues, and `Ctrl+S` / `Cmd+S` hotkeys to save directly over SFTP.
- 🪄 **1-Click OpenSSH Config Importer:** Drag & drop or paste your existing `~/.ssh/config` to automatically extract Host, Hostname, Port, User, IdentityFile, and ProxyJump relationships with an instant confirmation preview.
- 🔐 **Zero-Trust Credential Vault:** Securely store passwords and SSH Private Keys (RSA, ECDSA, Ed25519) encrypted with **AES-256-GCM** using keys derived via **Argon2id**. Keys never leave your server in plaintext.
- 🛡️ **Two-Factor Authentication (2FA / TOTP):** Native RFC 6238 TOTP verification compatible with Google Authenticator, Authy, 1Password, and Apple Passwords with 1-click QR code provisioning and brute-force protection.
- 🔑 **Built-in Ed25519 Key Generator:** Generate military-grade SSH Ed25519 key pairs on the fly and copy public keys to your clipboard with a single click.
- 🎥 **Session Audit & Web Player:** Automatically record session terminal output (with optional keystroke input capture via `RECORD_INPUT_KEYSTROKES`) in the open **Asciinema v2 (`.cast`)** format with automatic 30-day retention pruning, per-session size caps, and an integrated web player offering 1x, 2x, and 4x playback speeds for security auditing.
- 🔀 **SSH Port Forwarding & Tunnels:** Visually configure and manage Local Port Forwarding and Dynamic SOCKS5 Proxies.
- ⚡ **DevOps Snippet & Dynamic Command Library:** Save frequently used operations with variable placeholders (e.g. `docker logs -f --tail {{LINES}} {{CONTAINER_ID}}`) and inject them directly into running terminals.
- 🛡️ **First-Run Setup Wizard:** Zero hardcoded default credentials! On first boot, an onboarding wizard guides you to create a strong administrator password with real-time strength evaluation and brute-force rate-limiting.

---

## ⚡ Quickstart

### Option 1: Docker (Recommended)

Run MySSH with persistent data in a single command:

```bash
docker run -d \
  --name myssh \
  -p 8080:8080 \
  -v myssh_data:/app/data \
  --restart unless-stopped \
  ghcr.io/thangld2407/myssh:latest
```

> [!NOTE]
> **Automatic Key Generation & Security**: On first boot, if `JWT_SECRET` and `MASTER_KEY` are not explicitly provided in the environment, MySSH automatically generates cryptographically secure 32-byte keys and a per-install 16-byte KDF salt. These are securely saved to `data/.secrets` (mode `0600`). Please ensure the `myssh_data` volume is backed up so you never lose your encryption keys.

Access the dashboard at: **`http://localhost:8080`**

> [!TIP]
> **Custom Port Configuration**:
> - **Standard Docker Port Mapping (e.g. Host Port 9090)**: Use `-p 9090:8080` to map host port 9090 to container port 8080: `docker run -d -p 9090:8080 -v myssh_data:/app/data ghcr.io/thangld2407/myssh:latest`
> - **Internal Port Overriding (e.g. Port 9090)**: Pass `-e PORT=9090 -p 9090:9090` (or CLI argument `myssh -p 9090`). MySSH automatically adapts its internal listener, dynamic Docker healthcheck, and CORS origins.

### Option 2: Pre-Compiled Single Binary (No Docker, Zero Runtime Dependencies)

Download the self-contained binary (~26MB, includes all web assets via `go:embed`) from [GitHub Releases](https://github.com/thangld2407/myssh/releases):

```bash
# Example for Linux AMD64:
curl -LO https://github.com/thangld2407/myssh/releases/latest/download/myssh-v1.1.0-linux-amd64.tar.gz
tar -xzf myssh-v1.1.0-linux-amd64.tar.gz
./myssh
```

Available architectures:
* `myssh-v1.1.0-darwin-arm64.tar.gz` (macOS Apple Silicon M1/M2/M3/M4)
* `myssh-v1.1.0-darwin-amd64.tar.gz` (macOS Intel)
* `myssh-v1.1.0-linux-amd64.tar.gz` (Linux x86_64)
* `myssh-v1.1.0-linux-arm64.tar.gz` (Raspberry Pi & ARM64 Cloud VPS)
* `myssh-v1.1.0-windows-amd64.zip` (Windows 64-bit)

### Option 3: Docker Compose with Automatic HTTPS SSL (Caddy)

For internet-facing production deployments with automatic Let's Encrypt certificates:

```bash
DOMAIN=bastion.yourdomain.com docker compose -f docker-compose.production.yml up -d
```

### Option 4: Zero-Trust Access Without Public Open Ports (Cloudflare Tunnel & Tailscale)

Keep MySSH bound to `127.0.0.1:8080` without forwarding ports 80/443 on your router or cloud firewall:

1. **Cloudflare Tunnel:**
   ```bash
   cloudflared tunnel create myssh-tunnel
   cloudflared tunnel route dns myssh-tunnel bastion.yourdomain.com
   cloudflared tunnel run --url http://localhost:8080 myssh-tunnel
   ```
2. **Tailscale:**
   ```bash
   tailscale serve --bg 8080
   ```

---

## 🔒 Security & Cryptography Architecture

MySSH is built with a zero-trust mindset:

1. **At-Rest Vault Encryption:** All sensitive credential data (SSH private keys, passwords, passphrases) are encrypted at rest using **AES-256-GCM** with authenticated metadata and distinct random nonces per credential.
2. **Key Derivation (Argon2id):** Cryptographic keys are derived from your master secret using **Argon2id** (memory-hard, resistant to GPU/ASIC attacks).
3. **Defense-in-Depth Authentication:**
   * Password hashing with **Bcrypt** (cost 10+).
   * **RFC 6238 TOTP Two-Factor Authentication** with Google Authenticator and Authy.
   * Sliding-window IP rate limiting (defaults to 5 attempts per 5-minute window) to block brute-force attacks.
4. **Transport Security:** Ephemeral JWT authentication over encrypted WebSocket and TLS.
5. **Role-Based Access Control (RBAC) & Ownership:**
   * **Admin**: Full authority to mutate credentials, hosts, tunnels, and execute destructive operations on Kubernetes clusters.
   * **Member**: Standard operational access (Terminal, SFTP, Snippets, Pod Exec, read-only telemetry).
   * **Viewer**: Read-only observation of server fleet, metrics, logs, and audit records.
   * *Shared vs. Scoped Assets*: By design, Hosts and Credentials act as shared infrastructure assets across team bastions, whereas Sessions and Tunnels are scoped strictly to the creating user account (unless queried by an administrator).

---

## 🏛️ Architecture & Deployment Model (Single-Instance Design)

> [!IMPORTANT]
> **Single-Instance Deployment Constraint**: MySSH is purposefully engineered as an ultra-lightweight, self-hosted, single-binary gateway and access bastion.

To deliver microsecond-latency terminal bridging, connection multiplexing, and defense-in-depth rate limiting without external dependencies (such as Redis or message queues), active operational state is maintained in-memory within the running instance:
* **Interactive Terminal Bridges & WebSocket Streams**: Open PTY streams and WebSocket sessions are bound directly to the hosting process.
* **Connection Pools & SFTP Clients**: `sshhub.GlobalPool` caches active SSH/SFTP client connections with automated idle reaping.
* **Tunnels & Port Forwarding**: Active background SSH tunnels (`sshhub.Hub`) and Kubernetes port-forward streams (`k8shub.GlobalPFManager`) run inside managed goroutines.
* **Ephemeral Rate Limiting & Auth Tickets**: Brute-force lockout counters and one-time short-lived WebSocket tickets operate with in-process synchronized caches.

**Scaling Recommendation**: Deploy MySSH as a single container or single systemd daemon (`replicas: 1`). Running multiple active replicas behind a stateless round-robin load balancer is unsupported. For resilient operations, deploy as an auto-restarting single replica attached to a persistent volume for `data/` and automated database backups.

---

## ⚙️ Configuration (.env)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | HTTP & WebSocket listening port |
| `DB_PATH` | `data/myssh.db` | Path to the SQLite database file |
| `DATA_DIR` | `data` | Directory for application runtime storage |
| `RECORDINGS_DIR` | `data/recordings` | Directory storing `.cast` session recordings |
| `RECORDING_RETENTION_DAYS` | `30` | Auto-prune `.cast` session recordings older than N days |
| `RECORDING_MAX_SIZE_MB` | `50` | Maximum file size limit in MB per terminal recording session |
| `RECORD_INPUT_KEYSTROKES` | `false` | Enable capturing client keystroke input (`"i"` events) in recordings |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum file upload size limit in MB for SFTP transfers |
| `SESSION_IDLE_TIMEOUT_MINUTES` | `30` | Auto-terminate inactive terminal sessions after N minutes (0 to disable) |
| `MASTER_KEY` | *(Auto-generated / Set)* | 32-byte master encryption key for AES-256-GCM credential vault |
| `JWT_SECRET` | *(Auto-generated / Set)* | Secret string used for signing authentication JWT tokens |
| `RATE_LIMIT_ENABLED` | `true` | Enable brute-force protection rate limiter |
| `RATE_LIMIT_MAX_ATTEMPTS` | `5` | Maximum failed logins before temporary IP lockout |
| `RATE_LIMIT_WINDOW_MINUTES` | `5` | Lockout window duration in minutes |
| `ALLOWED_ORIGINS` | *(Localhost / Same-Origin)* | Comma-separated list of allowed CORS and WebSocket origins |

---

## 🧪 Testing & Local Development

### Prerequisites
* Go 1.26+
* Node.js 20+ & pnpm (only needed for frontend asset development)

```bash
# 1. Clone repository
git clone https://github.com/thangld2407/myssh.git
cd myssh

# 2. Run backend unit tests
go test -v ./...

# 3. Build single self-contained binary
make build
# Binary output is ready at bin/myssh
```

---

## 👨‍💻 Author & Support

MySSH is created & maintained with ❤️ by **Victor Le** ([@thangld2407](https://github.com/thangld2407)).

If you find MySSH useful, please consider giving the project a ⭐️ on [GitHub](https://github.com/thangld2407/myssh) to boost visibility!

<p align="center">
  <img src="web/public/momo.jpg" width="200" alt="MoMo QR - Victor Le" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" />
  <br />
  <sub>☕ <i>Buy author Victor Le a coffee via MoMo QR</i></sub>
</p>

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
