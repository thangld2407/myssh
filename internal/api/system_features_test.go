package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/myssh/myssh/internal/config"
)

func TestSystemFeatures_DoesNotExposeRateLimit(t *testing.T) {
	cfg := &config.Config{
		RateLimitEnabled:       true,
		RateLimitMaxAttempts:   5,
		RateLimitWindowMinutes: 15,
		Features: config.FeatureFlags{
			EnableSFTP: true,
			EnableK8s:  true,
		},
	}

	r := SetupRouter(cfg)
	req, _ := http.NewRequest("GET", "/api/system/features", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if _, exists := resp["version"]; !exists {
		t.Errorf("Expected 'version' in response")
	}
	if _, exists := resp["features"]; !exists {
		t.Errorf("Expected 'features' in response")
	}

	// F21 assertion: rate_limit must NOT be leaked in public features endpoint
	if _, exists := resp["rate_limit"]; exists {
		t.Errorf("Security finding F21: 'rate_limit' configuration must not be exposed in public /api/system/features")
	}
}

func TestHealthzAndReadyz(t *testing.T) {
	setupTestDB(t)
	cfg := &config.Config{}
	r := SetupRouter(cfg)

	// 1. Test /healthz
	req, _ := http.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for /healthz, got %d", w.Code)
	}

	// 2. Test /readyz
	req, _ = http.NewRequest("GET", "/readyz", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for /readyz, got %d", w.Code)
	}
	var readyResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &readyResp)
	if readyResp["status"] != "ready" {
		t.Errorf("Expected ready status, got %v", readyResp["status"])
	}
}

