package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/middleware"
)

func TestRouterRBACEnforcement(t *testing.T) {
	setupTestDB(t)

	cfg := &config.Config{
		JWTSecret: "test-rbac-jwt-secret-key-32b!",
		MasterKey: "test-rbac-master-key-32b-secure!",
		Features: config.FeatureFlags{
			EnableSessionAudit:    true,
			EnableTunnels:         true,
			EnableSFTP:            true,
			EnableSnippets:        true,
			EnableK8s:             true,
			EnableImportSSHConfig: true,
		},
	}
	r := SetupRouter(cfg)

	// Create users with different roles
	viewerUser := &db.User{ID: "usr-viewer", Username: "viewer", Role: "viewer"}
	memberUser := &db.User{ID: "usr-member", Username: "member", Role: "member"}
	adminUser := &db.User{ID: "usr-admin", Username: "admin", Role: "admin"}

	viewerToken, _ := middleware.GenerateToken(viewerUser, cfg.JWTSecret)
	memberToken, _ := middleware.GenerateToken(memberUser, cfg.JWTSecret)
	adminToken, _ := middleware.GenerateToken(adminUser, cfg.JWTSecret)

	// 1. Viewer attempts to create a Host (Admin only) -> 403 Forbidden
	hostReq := CreateOrUpdateHostRequest{
		Name:         "Unauthorized Host",
		Hostname:     "unauthorized.com",
		Port:         22,
		Username:     "root",
		CredentialID: "cred-1",
	}
	bHost, _ := json.Marshal(hostReq)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/hosts", bytes.NewBuffer(bHost))
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for Viewer creating host, got %d", w.Code)
	}

	// 2. Member attempts to create a Host (Admin only) -> 403 Forbidden
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts", bytes.NewBuffer(bHost))
	req.Header.Set("Authorization", "Bearer "+memberToken)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for Member creating host, got %d", w.Code)
	}

	// 3. Viewer can list Hosts -> 200 OK
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/hosts", nil)
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for Viewer listing hosts, got %d", w.Code)
	}

	// 4. Viewer attempts to create Tunnel (Admin only) -> 403 Forbidden
	tunnelReq := CreateTunnelRequest{
		HostID:     "host-1",
		Name:       "Unauthorized Tunnel",
		BindHost:   "127.0.0.1",
		BindPort:   8081,
		TargetHost: "localhost",
		TargetPort: 80,
	}
	bTun, _ := json.Marshal(tunnelReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/tunnels", bytes.NewBuffer(bTun))
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for Viewer creating tunnel, got %d", w.Code)
	}

	_ = adminToken
}

func TestSessionAndTunnelOwnershipScoping(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM sessions")
	db.DB.Exec("DELETE FROM tunnels")

	cfg := &config.Config{
		JWTSecret: "test-ownership-jwt-secret-xyz",
		Features: config.FeatureFlags{
			EnableSessionAudit:    true,
			EnableTunnels:         true,
			EnableSFTP:            true,
			EnableSnippets:        true,
			EnableK8s:             true,
			EnableImportSSHConfig: true,
		},
	}

	userA := &db.User{ID: "usr-a", Username: "alice", Role: "member"}
	userB := &db.User{ID: "usr-b", Username: "bob", Role: "member"}
	admin := &db.User{ID: "usr-admin-owner", Username: "superadmin", Role: "admin"}

	tokenA, _ := middleware.GenerateToken(userA, cfg.JWTSecret)
	adminToken, _ := middleware.GenerateToken(admin, cfg.JWTSecret)

	// Seed sessions: 1 for Alice, 1 for Bob
	sessA := db.Session{
		ID:        "sess-alice",
		UserID:    userA.ID,
		HostName:  "srv-alice",
		StartedAt: time.Now(),
	}
	sessB := db.Session{
		ID:        "sess-bob",
		UserID:    userB.ID,
		HostName:  "srv-bob",
		StartedAt: time.Now(),
	}
	db.DB.Create(&sessA)
	db.DB.Create(&sessB)

	// Seed tunnels: 1 for Alice, 1 for Bob
	tunA := db.Tunnel{
		ID:       "tun-alice",
		UserID:   userA.ID,
		Name:     "Alice Tunnel",
		BindPort: 8001,
	}
	tunB := db.Tunnel{
		ID:       "tun-bob",
		UserID:   userB.ID,
		Name:     "Bob Tunnel",
		BindPort: 8002,
	}
	db.DB.Create(&tunA)
	db.DB.Create(&tunB)

	sessHandler := NewSessionHandler(cfg)
	tunnHandler := NewTunnelHandler(cfg)

	r := SetupRouter(cfg)
	_ = sessHandler
	_ = tunnHandler

	// Alice queries sessions -> should only see 1 session (her own)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/audit/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+tokenA)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var aliceSessions []db.Session
	_ = json.Unmarshal(w.Body.Bytes(), &aliceSessions)
	if len(aliceSessions) != 1 || aliceSessions[0].ID != "sess-alice" {
		t.Errorf("Alice should only see her own session, got %d", len(aliceSessions))
	}

	// Alice queries tunnels -> should only see 1 tunnel (her own)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/tunnels", nil)
	req.Header.Set("Authorization", "Bearer "+tokenA)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var aliceTunnels []db.Tunnel
	_ = json.Unmarshal(w.Body.Bytes(), &aliceTunnels)
	if len(aliceTunnels) != 1 || aliceTunnels[0].ID != "tun-alice" {
		t.Errorf("Alice should only see her own tunnel, got %d", len(aliceTunnels))
	}

	// Admin queries sessions -> should see both sessions
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/audit/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var allSessions []db.Session
	_ = json.Unmarshal(w.Body.Bytes(), &allSessions)
	if len(allSessions) != 2 {
		t.Errorf("Admin should see all sessions, got %d", len(allSessions))
	}

	// Admin queries tunnels -> should see both tunnels
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/tunnels", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var allTunnels []db.Tunnel
	_ = json.Unmarshal(w.Body.Bytes(), &allTunnels)
	if len(allTunnels) != 2 {
		t.Errorf("Admin should see all tunnels, got %d", len(allTunnels))
	}
}
