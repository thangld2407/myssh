package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/middleware"
)

func TestAuditLogMiddlewareAndEndpoint(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM audit_logs")
	db.DB.Exec("DELETE FROM hosts")
	db.DB.Exec("DELETE FROM credentials")

	cfg := &config.Config{
		JWTSecret: "test-audit-jwt-secret-key-32b!",
		MasterKey: "test-audit-master-key-32b-sec!",
		Features: config.FeatureFlags{
			EnableSessionAudit: true,
		},
	}
	r := SetupRouter(cfg)

	// Admin user token
	adminUser := &db.User{ID: "usr-admin-audit", Username: "auditadmin", Role: "admin"}
	adminToken, _ := middleware.GenerateToken(adminUser, cfg.JWTSecret)

	// Member user token
	memberUser := &db.User{ID: "usr-member-audit", Username: "auditmember", Role: "member"}
	memberToken, _ := middleware.GenerateToken(memberUser, cfg.JWTSecret)

	// Seed credential for host creation
	cred := db.Credential{
		ID:            "cred-audit-test",
		Name:          "Default Credential",
		Type:          "password",
		EncryptedData: "dummy-encrypted-data",
		Nonce:         "dummy-nonce",
	}
	db.DB.Create(&cred)

	// 1. Admin creates a Host (mutation POST /api/hosts) -> Should trigger AuditMiddleware
	createHostBody, _ := json.Marshal(CreateOrUpdateHostRequest{
		Name:         "Audit Target Host",
		Hostname:     "target.audit.local",
		Port:         22,
		Username:     "ubuntu",
		CredentialID: cred.ID,
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/hosts", bytes.NewBuffer(createHostBody))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("Create host failed: %d - %s", w.Code, w.Body.String())
	}

	// Verify AuditLog record in DB
	var logs []db.AuditLog
	db.DB.Find(&logs)
	if len(logs) == 0 {
		t.Fatalf("Expected at least 1 AuditLog entry, found 0")
	}

	foundHostLog := false
	for _, l := range logs {
		if l.ResourceType == "hosts" && l.Action == "CREATE" && l.Username == "auditadmin" {
			foundHostLog = true
			break
		}
	}
	if !foundHostLog {
		t.Errorf("Expected AuditLog entry with ResourceType='hosts' and Action='CREATE', found: %+v", logs)
	}

	// 2. Admin queries GET /api/audit/logs -> 200 OK with paginated logs
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/audit/logs?resource_type=hosts", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK from GET /api/audit/logs, got %d", w.Code)
	}

	var res struct {
		Total int64         `json:"total"`
		Logs  []db.AuditLog `json:"logs"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res.Total < 1 || len(res.Logs) < 1 {
		t.Errorf("Expected at least 1 log returned in API response, got total: %d, logs: %d", res.Total, len(res.Logs))
	}

	// 3. Member attempts to query GET /api/audit/logs -> 403 Forbidden
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/audit/logs", nil)
	req.Header.Set("Authorization", "Bearer "+memberToken)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for member accessing /api/audit/logs, got %d", w.Code)
	}
}
