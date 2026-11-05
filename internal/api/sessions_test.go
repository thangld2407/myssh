package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

func TestSessionEndpointsAndPathTraversal(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM sessions")

	tmpDir := t.TempDir()
	recordingsDir := filepath.Join(tmpDir, "recordings")
	_ = os.MkdirAll(recordingsDir, 0700)

	cfg := &config.Config{
		RecordingsDir: recordingsDir,
	}
	handler := NewSessionHandler(cfg)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Set("user_id", "user-1")
		c.Next()
	})
	r.GET("/api/audit/sessions", handler.List)
	r.GET("/api/audit/sessions/:id/recording", handler.GetRecording)

	// Create valid cast recording file
	sessionID := "sess-audit-123"
	castFile := filepath.Join(recordingsDir, sessionID+".cast")
	_ = os.WriteFile(castFile, []byte(`{"version": 2, "width": 80, "height": 24}`+"\n"), 0600)

	now := time.Now()
	validSession := db.Session{
		ID:            sessionID,
		UserID:        "user-1",
		HostID:        "host-1",
		HostName:      "Bastion-1",
		Status:        "closed",
		RecordingPath: castFile,
		StartedAt:     now,
		EndedAt:       &now,
		ByteCount:     1024,
	}
	db.DB.Create(&validSession)

	// 1. List sessions
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/audit/sessions", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var sessions []db.Session
	_ = json.Unmarshal(w.Body.Bytes(), &sessions)
	if len(sessions) != 1 {
		t.Errorf("Expected 1 session, got %d", len(sessions))
	}

	// 2. Get valid recording
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/audit/sessions/"+sessionID+"/recording", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for valid recording, got %d", w.Code)
	}

	// 3. Test Path Traversal security:
	// A malicious session with RecordingPath outside cfg.RecordingsDir
	maliciousSessionID := "sess-evil-999"
	secretFile := filepath.Join(tmpDir, "secret.txt")
	_ = os.WriteFile(secretFile, []byte("TOP_SECRET_CREDENTIALS"), 0600)

	evilSession := db.Session{
		ID:            maliciousSessionID,
		UserID:        "user-evil",
		HostID:        "host-1",
		Status:        "closed",
		RecordingPath: secretFile, // Outside recordingsDir
		StartedAt:     now,
	}
	db.DB.Create(&evilSession)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/audit/sessions/"+maliciousSessionID+"/recording", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for path traversal attempt, got %d", w.Code)
	}

	// 4. Non-existent session returns 404
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/audit/sessions/non-existent-id/recording", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected 404 Not Found, got %d", w.Code)
	}
}
