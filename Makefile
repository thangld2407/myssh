.PHONY: all build build-web build-server dev test docker clean

# Output binary name
BIN_DIR := bin
BINARY := $(BIN_DIR)/myssh

all: test build

build-web:
	@echo "==> Building React Web Assets..."
	@cd web && pnpm install && pnpm build

build-server:
	@echo "==> Compiling Go Server Binary..."
	@mkdir -p $(BIN_DIR)
	@go build -ldflags="-s -w" -o $(BINARY) ./cmd/server

build: build-web build-server
	@echo "==> Build completed: $(BINARY)"

dev:
	@echo "==> Starting backend server in dev mode..."
	@go run ./cmd/server

dev-web:
	@echo "==> Starting Vite dev server..."
	@cd web && pnpm dev

test:
	@echo "==> Running Go Unit Tests..."
	@go test -v ./...

docker:
	@echo "==> Building Docker Image..."
	@docker build -t myssh:latest .

clean:
	@echo "==> Cleaning build artifacts..."
	@rm -rf $(BIN_DIR) data/myssh.db web/dist
