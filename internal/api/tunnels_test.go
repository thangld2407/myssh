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
