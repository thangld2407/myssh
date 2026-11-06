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

func TestHostCRUDAndImport(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM hosts")
	db.DB.Exec("DELETE FROM credentials")

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewHostHandler(cfg)

	r := gin.New()
	r.GET("/api/hosts", handler.List)
	r.POST("/api/hosts", handler.Create)
	r.POST("/api/hosts/import", handler.ImportSSHConfig)
	r.GET("/api/hosts/:id", handler.Get)
	r.PUT("/api/hosts/:id", handler.Update)
	r.POST("/api/hosts/:id/reset-fingerprint", handler.ResetFingerprint)
	r.DELETE("/api/hosts/:id", handler.Delete)

	// Seed a test credential
	cred := db.Credential{
		ID:            "cred-123",
		Name:          "Default Credential",
		Type:          "password",
		EncryptedData: "dummy-encrypted-data",
		Nonce:         "dummy-nonce",
	}
	db.DB.Create(&cred)

	// 1. Create a Host
	createHostReq := CreateOrUpdateHostRequest{
		Name:         "Web Production",
		Hostname:     "web.example.com",
		Port:         22,
		Username:     "ubuntu",
		Folder:       "Production",
		Tags:         "prod,nginx,aws",
		CredentialID: cred.ID,
		Description:  "Main Web Server",
	}
	body, _ := json.Marshal(createHostReq)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/hosts", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	var createdHost db.Host
	_ = json.Unmarshal(w.Body.Bytes(), &createdHost)
	if createdHost.ID == "" || createdHost.Name != "Web Production" {
		t.Fatalf("Unexpected host created: %+v", createdHost)
	}

	// 2. Reject host with invalid port > 65535
	badPortReq := createHostReq
	badPortReq.Port = 99999
	badBody, _ := json.Marshal(badPortReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts", bytes.NewBuffer(badBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for port 99999, got %d", w.Code)
	}

	// 3. Get Host by ID
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/hosts/"+createdHost.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}

	// 4. Update Host (and reject self as jump host)
	updateReq := createHostReq
	updateReq.JumpHostID = createdHost.ID // Self-referencing Jump Host
	badUpdateBody, _ := json.Marshal(updateReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PUT", "/api/hosts/"+createdHost.ID, bytes.NewBuffer(badUpdateBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 when setting host as its own Jump Host, got %d", w.Code)
	}

	// Valid update
	updateReq.JumpHostID = ""
	updateReq.Name = "Web Production Updated"
	validUpdateBody, _ := json.Marshal(updateReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PUT", "/api/hosts/"+createdHost.ID, bytes.NewBuffer(validUpdateBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK on update, got %d", w.Code)
	}

	// 5. List with folder filter
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/hosts?folder=Production", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}
	var hosts []db.Host
	_ = json.Unmarshal(w.Body.Bytes(), &hosts)
	if len(hosts) != 1 {
		t.Errorf("Expected 1 host in Production folder, got %d", len(hosts))
	}

	// 6. Test Reset Host Key Fingerprint
	db.DB.Model(&db.Host{}).Where("id = ?", createdHost.ID).Update("host_key_fingerprint", "SHA256:dummy-pinned-fingerprint")
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts/"+createdHost.ID+"/reset-fingerprint", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on reset fingerprint, got %d", w.Code)
	}
	var resetHost db.Host
	_ = json.Unmarshal(w.Body.Bytes(), &resetHost)
	if resetHost.HostKeyFingerprint != "" {
		t.Errorf("Expected empty HostKeyFingerprint after reset, got %s", resetHost.HostKeyFingerprint)
	}

	// 7. Import SSH Config - Dry Run
	sshConfigContent := `
Host dev-api
    HostName api.dev.internal
    User devops
    Port 2222
`
	importReq := ImportSSHConfigRequest{
		Content: sshConfigContent,
		DryRun:  true,
	}
	importBody, _ := json.Marshal(importReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts/import", bytes.NewBuffer(importBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for dry run import, got %d", w.Code)
	}

	// 7. Delete Host
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/hosts/"+createdHost.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK on delete host, got %d", w.Code)
	}
}

func TestHostImport_Deduplication(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM hosts")

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewHostHandler(cfg)

	r := gin.New()
	r.POST("/api/hosts/import", handler.ImportSSHConfig)

	sshConfig := `
Host db-primary
    HostName db.example.com
    User postgres
    Port 5432
`

	// 1. First import: creates 1 new host
	req1 := ImportSSHConfigRequest{
		Content:           sshConfig,
		DuplicateStrategy: "skip",
	}
	body1, _ := json.Marshal(req1)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/hosts/import", bytes.NewBuffer(body1))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created on first import, got %d: %s", w.Code, w.Body.String())
	}
	var res1 map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &res1)
	if res1["created"] != float64(1) {
		t.Errorf("Expected 1 created host, got %v", res1["created"])
	}

	// 2. Second import with strategy "skip" -> skips existing host, total hosts in DB stays 1
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts/import", bytes.NewBuffer(body1))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created on second import, got %d", w.Code)
	}
	var res2 map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &res2)
	if res2["skipped"] != float64(1) {
		t.Errorf("Expected 1 skipped host, got %v", res2["skipped"])
	}

	var count int64
	db.DB.Model(&db.Host{}).Where("name = ?", "db-primary").Count(&count)
	if count != 1 {
		t.Errorf("Expected exactly 1 host in DB after skip strategy, got %d", count)
	}

	// 3. Third import with strategy "update" and modified username -> updates existing host
	updatedConfig := `
Host db-primary
    HostName db.example.com
    User postgres-admin
    Port 5432
`
	reqUpdate := ImportSSHConfigRequest{
		Content:           updatedConfig,
		DuplicateStrategy: "update",
	}
	bodyUpdate, _ := json.Marshal(reqUpdate)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts/import", bytes.NewBuffer(bodyUpdate))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	var res3 map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &res3)
	if res3["updated"] != float64(1) {
		t.Errorf("Expected 1 updated host, got %v", res3["updated"])
	}

	var updatedHost db.Host
	db.DB.First(&updatedHost, "name = ?", "db-primary")
	if updatedHost.Username != "postgres-admin" {
		t.Errorf("Expected updated username postgres-admin, got %s", updatedHost.Username)
	}

	// 4. Dry run with existing host should report existing_count = 1
	reqDry := ImportSSHConfigRequest{
		Content: updatedConfig,
		DryRun:  true,
	}
	bodyDry, _ := json.Marshal(reqDry)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/hosts/import", bytes.NewBuffer(bodyDry))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	var resDry map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resDry)
	if resDry["existing_count"] != float64(1) {
		t.Errorf("Expected dry run existing_count 1, got %v", resDry["existing_count"])
	}
}
