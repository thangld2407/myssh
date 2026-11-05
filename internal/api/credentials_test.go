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

func TestCredentialEndpoints(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM hosts")
	db.DB.Exec("DELETE FROM credentials")

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewCredentialHandler(cfg)

	r := gin.New()
	r.GET("/api/credentials", handler.List)
	r.POST("/api/credentials", handler.Create)
	r.PUT("/api/credentials/:id", handler.Update)
	r.DELETE("/api/credentials/:id", handler.Delete)
	r.POST("/api/credentials/generate-key", handler.GenerateKey)

	// 1. Generate Ed25519 Key
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/credentials/generate-key?comment=test-agent", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for generate-key, got %d", w.Code)
	}
	var keyGenRes map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &keyGenRes)
	if keyGenRes["public_key"] == "" || keyGenRes["private_key"] == "" {
		t.Errorf("Expected public and private keys in response")
	}

	// 2. Create password credential
	createCredBody, _ := json.Marshal(map[string]string{
		"name":   "Prod Root Password",
		"type":   "password",
		"secret": "MySuperSecretPassword!2026",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/credentials", bytes.NewBuffer(createCredBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	var createdCred db.Credential
	_ = json.Unmarshal(w.Body.Bytes(), &createdCred)
	if createdCred.ID == "" {
		t.Fatalf("Expected saved credential with ID")
	}

	// Verify that EncryptedData is hidden from JSON response (Zero-Trust)
	if createdCred.EncryptedData != "" {
		t.Errorf("EncryptedData should be hidden from JSON response")
	}

	// Verify that EncryptedData is properly saved in the database
	var dbCred db.Credential
	if err := db.DB.First(&dbCred, "id = ?", createdCred.ID).Error; err != nil || dbCred.EncryptedData == "" {
		t.Fatalf("Expected credential with EncryptedData in database, err: %v", err)
	}

	// 3. List credentials
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/credentials", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var creds []db.Credential
	_ = json.Unmarshal(w.Body.Bytes(), &creds)
	if len(creds) != 1 {
		t.Errorf("Expected 1 credential, got %d", len(creds))
	}

	// 4. Attach a Host to this credential to test delete protection
	testHost := db.Host{
		ID:           "test-host-with-cred",
		Name:         "Server 1",
		Hostname:     "192.168.1.100",
		Port:         22,
		Username:     "root",
		CredentialID: createdCred.ID,
	}
	db.DB.Create(&testHost)

	// F16: Test PUT /api/credentials/:id to rotate credential secret while attached to host
	updateCredBody, _ := json.Marshal(map[string]string{
		"name":   "Prod Root Password Rotated",
		"secret": "BrandNewRotatedPassword!999",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PUT", "/api/credentials/"+createdCred.ID, bytes.NewBuffer(updateCredBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for credential update/rotation, got %d: %s", w.Code, w.Body.String())
	}

	// Verify in DB that credential was updated and re-encrypted
	var updatedDBCred db.Credential
	db.DB.First(&updatedDBCred, "id = ?", createdCred.ID)
	if updatedDBCred.Name != "Prod Root Password Rotated" {
		t.Errorf("Expected updated name, got %s", updatedDBCred.Name)
	}
	if updatedDBCred.EncryptedData == dbCred.EncryptedData {
		t.Errorf("Expected re-encrypted data with new secret, but data was identical")
	}

	// Attempt delete should fail (400) because it's in use
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/credentials/"+createdCred.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request when deleting in-use credential, got %d", w.Code)
	}

	// Remove host and delete should succeed
	db.DB.Delete(&testHost)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/credentials/"+createdCred.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK when deleting unused credential, got %d", w.Code)
	}
}
