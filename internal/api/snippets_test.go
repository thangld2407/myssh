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

func setupTestDB(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var err error
	_, err = db.Init(":memory:")
	if err != nil {
		t.Fatalf("failed to init in-memory db: %v", err)
	}
}

func TestSnippetCRUD(t *testing.T) {
	setupTestDB(t)
	cfg := &config.Config{JWTSecret: "test-secret"}
	handler := NewSnippetHandler(cfg)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "test-user-1")
		c.Next()
	})
	r.GET("/api/snippets", handler.List)
	r.POST("/api/snippets", handler.Create)
	r.PUT("/api/snippets/:id", handler.Update)
	r.DELETE("/api/snippets/:id", handler.Delete)

	// 1. Verify default seed snippets are listed
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/snippets", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var snippets []db.Snippet
	if err := json.Unmarshal(w.Body.Bytes(), &snippets); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}
	if len(snippets) == 0 {
		t.Fatalf("expected seeded snippets, got 0")
	}

	// 2. Create new custom snippet
	newPayload := map[string]string{
		"name":        "Check Memory & Disk",
		"command":     "free -h && df -h",
		"description": "Kiểm tra nhanh tài nguyên",
		"category":    "System",
		"tags":        "memory,disk,quick",
	}
	body, _ := json.Marshal(newPayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/snippets", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created db.Snippet
	_ = json.Unmarshal(w.Body.Bytes(), &created)
	if created.Name != "Check Memory & Disk" {
		t.Fatalf("expected name to match, got %s", created.Name)
	}

	// 3. Search filter test
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/snippets?q=Memory", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var searchResults []db.Snippet
	_ = json.Unmarshal(w.Body.Bytes(), &searchResults)
	if len(searchResults) == 0 {
		t.Fatalf("expected search to find the snippet, got 0")
	}

	// 4. Update snippet
	updatePayload := map[string]string{
		"name": "Check Memory & Disk (Updated)",
	}
	body, _ = json.Marshal(updatePayload)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PUT", "/api/snippets/"+created.ID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d", w.Code)
	}

	// 5. Delete snippet
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/snippets/"+created.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d", w.Code)
	}
}
