# ==========================================
# Stage 1: Build Frontend SPA
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /web

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY web/package.json ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY web/ ./
RUN pnpm build

# ==========================================
# Stage 2: Build Backend Binary
# ==========================================
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app

# Install git and ca-certificates
RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Copy compiled frontend assets into web/dist
COPY --from=frontend-builder /web/dist ./web/dist

# Compile CGO-free pure Go binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/myssh ./cmd/server

# ==========================================
# Stage 3: Minimal Production Image
# ==========================================
FROM alpine:3.20
LABEL maintainer="MySSH Team"

RUN apk add --no-cache ca-certificates tzdata openssh-client

# Create non-root user
RUN addgroup -S myssh && adduser -S myssh -G myssh

WORKDIR /app

COPY --from=backend-builder /app/bin/myssh /app/myssh
COPY --from=backend-builder /app/web/dist /app/web/dist

# Create persistent data volume directory
RUN mkdir -p /app/data /app/data/recordings && \
    chown -R myssh:myssh /app/data

USER myssh

ENV PORT=8080 \
    DATA_DIR=/app/data \
    DB_PATH=/app/data/myssh.db \
    RECORDINGS_DIR=/app/data/recordings

EXPOSE 8080

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

ENTRYPOINT ["/app/myssh"]
