package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

func TestTunnelEndpoints(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM tunnels")

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewTunnelHandler(cfg)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "admin-1")
		c.Next()
	})
	r.GET("/api/tunnels", handler.List)
	r.POST("/api/tunnels", handler.Create)
	r.POST("/api/tunnels/:id/start", handler.Start)
	r.POST("/api/tunnels/:id/stop", handler.Stop)
	r.DELETE("/api/tunnels/:id", handler.Delete)

	// 1. Create tunnel with invalid bind port (< 1)
	badTunnelReq := CreateTunnelRequest{
		HostID:     "host-1",
		Name:       "Bad Port Tunnel",
		BindPort:   0,
		TargetHost: "localhost",
		TargetPort: 8080,
	}
	badBody, _ := json.Marshal(badTunnelReq)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(badBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for bind port 0, got %d", w.Code)
	}

	// 2. Create valid tunnel
	validTunnelReq := CreateTunnelRequest{
		HostID:     "host-1",
		Name:       "Postgres Tunnel",
		Type:       "local",
		BindHost:   "127.0.0.1",
		BindPort:   5433,
		TargetHost: "localhost",
		TargetPort: 5432,
	}
	validBody, _ := json.Marshal(validTunnelReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(validBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	var createdTunnel db.Tunnel
	_ = json.Unmarshal(w.Body.Bytes(), &createdTunnel)

	// 3. List tunnels
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/tunnels", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var tunnels []db.Tunnel
	_ = json.Unmarshal(w.Body.Bytes(), &tunnels)
	if len(tunnels) != 1 {
		t.Errorf("Expected 1 tunnel, got %d", len(tunnels))
	}

	// 4. Stop inactive tunnel gracefully
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/tunnels/"+createdTunnel.ID+"/stop", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for stop, got %d", w.Code)
	}

	// 5. Delete tunnel
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/tunnels/"+createdTunnel.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for delete, got %d", w.Code)
	}
}

func TestTunnelBindHostValidation(t *testing.T) {
	setupTestDB(t)

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewTunnelHandler(cfg)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "admin-1")
		c.Next()
	})
	r.POST("/api/tunnels", handler.Create)
	r.POST("/api/tunnels/:id/start", handler.Start)

	// 1. Reject bind_host 0.0.0.0
	req0000 := CreateTunnelRequest{
		HostID:     "host-1",
		Name:       "Public Insecure Tunnel",
		BindHost:   "0.0.0.0",
		BindPort:   9001,
		TargetHost: "internal-service",
		TargetPort: 80,
	}
	b0, _ := json.Marshal(req0000)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(b0))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for bind_host 0.0.0.0, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Reject arbitrary private IP bind_host
	reqIP := req0000
	reqIP.BindHost = "192.168.1.100"
	b1, _ := json.Marshal(reqIP)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(b1))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for bind_host 192.168.1.100, got %d", w.Code)
	}

	// 3. Reject Start on existing DB record with insecure bind_host
	badTunnel := db.Tunnel{
		ID:         "tunnel-insecure-db",
		UserID:     "admin-1",
		HostID:     "host-1",
		Name:       "Pre-existing Insecure Tunnel",
		BindHost:   "0.0.0.0",
		BindPort:   9002,
		TargetHost: "internal",
		TargetPort: 80,
		Status:     "stopped",
	}
	db.DB.Create(&badTunnel)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/tunnels/"+badTunnel.ID+"/start", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request when attempting to start a 0.0.0.0 tunnel, got %d", w.Code)
	}

	// 4. Accept localhost and ::1
	reqLocalhost := req0000
	reqLocalhost.BindHost = "localhost"
	b2, _ := json.Marshal(reqLocalhost)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(b2))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Errorf("Expected 201 Created for localhost bind_host, got %d", w.Code)
	}
}

func TestSocks5TunnelCreationAndValidation(t *testing.T) {
	setupTestDB(t)

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewTunnelHandler(cfg)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "admin-1")
		c.Next()
	})
	r.POST("/api/tunnels", handler.Create)

	// SOCKS5 tunnel does not require TargetPort / TargetHost
	socksReq := CreateTunnelRequest{
		HostID:   "host-socks5",
		Name:     "Dynamic Proxy",
		Type:     "socks5",
		BindHost: "127.0.0.1",
		BindPort: 1080,
	}
	body, _ := json.Marshal(socksReq)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created for SOCKS5 tunnel, got %d: %s", w.Code, w.Body.String())
	}

	var created db.Tunnel
	json.Unmarshal(w.Body.Bytes(), &created)
	if created.Type != "socks5" {
		t.Errorf("Expected type socks5, got %s", created.Type)
	}
}
