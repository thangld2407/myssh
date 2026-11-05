package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/myssh/myssh/internal/config"
)

func TestCORS_AllowedOrigins(t *testing.T) {
	cfg := &config.Config{
		JWTSecret:      "test-cors-jwt-secret-key-32b!",
		AllowedOrigins: []string{"https://myssh.example.com"},
	}
	r := SetupRouter(cfg)

	// 1. Whitelisted origin preflight OPTIONS request
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/api/system/features", nil)
	req.Header.Set("Origin", "https://myssh.example.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "https://myssh.example.com" {
		t.Errorf("Expected Access-Control-Allow-Origin: https://myssh.example.com, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}

	// 2. Untrusted origin preflight OPTIONS request
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("OPTIONS", "/api/system/features", nil)
	req.Header.Set("Origin", "https://attacker.com")
	req.Header.Set("Access-Control-Request-Method", "GET")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") == "https://attacker.com" {
		t.Errorf("Untrusted origin must not receive Access-Control-Allow-Origin header")
	}
}
