# ==========================================
# Stage 1: Build Frontend SPA
# ==========================================
FROM node:20-alpine3.20 AS frontend-builder
WORKDIR /web

# Enable corepack for pnpm 9
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build

# ==========================================
# Stage 2: Build Backend Binary
# ==========================================
FROM golang:1.26-alpine3.20 AS backend-builder
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
FROM alpine:3.20.3
LABEL maintainer="MySSH Team"

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -S myssh && adduser -S myssh -G myssh

WORKDIR /app

COPY --from=backend-builder /app/bin/myssh /app/myssh

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
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/app/myssh"]
