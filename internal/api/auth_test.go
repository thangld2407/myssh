package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/middleware"
	"github.com/pquerna/otp/totp"
)

func totpGenerateCode(secret string) (string, error) {
	return totp.GenerateCode(secret, time.Now())
}

func TestAuthFlow(t *testing.T) {
	setupTestDB(t)
	// Clear users
	db.DB.Exec("DELETE FROM users")

	cfg := &config.Config{
		JWTSecret:            "test-jwt-secret-key-12345",
		RateLimitEnabled:     true,
		RateLimitMaxAttempts: 5,
	}
	handler := NewAuthHandler(cfg)

	r := gin.New()
	r.GET("/api/auth/setup-status", handler.SetupStatus)
	r.POST("/api/auth/setup", handler.Setup)
	r.POST("/api/auth/login", handler.Login)

	protected := r.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	protected.GET("/auth/me", handler.Me)

	// 1. Check setup status before initial setup
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/auth/setup-status", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}
	var statusRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &statusRes)
	if statusRes["initialized"] != false {
		t.Errorf("Expected initialized=false, got %v", statusRes["initialized"])
	}

	// 2. Attempt setup with password < 8 characters (should fail)
	badSetupBody, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "123",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/setup", bytes.NewBuffer(badSetupBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for short password, got %d", w.Code)
	}

	// 3. Valid setup
	goodSetupBody, _ := json.Marshal(map[string]string{
		"username":  "  admin  ",
		"password":  "admin123456",
		"full_name": "Test Administrator",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/setup", bytes.NewBuffer(goodSetupBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK for valid setup, got %d: %s", w.Code, w.Body.String())
	}
	var setupRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &setupRes)
	token, ok := setupRes["token"].(string)
	if !ok || token == "" {
		t.Fatalf("Expected JWT token from setup response")
	}

	// 4. Second setup attempt should be forbidden (403)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/setup", bytes.NewBuffer(goodSetupBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden on second setup, got %d", w.Code)
	}

	// 5. Test Login with wrong password
	wrongLoginBody, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "WrongPassword!",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(wrongLoginBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized, got %d", w.Code)
	}

	// 6. Test Login with correct credentials
	correctLoginBody, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "admin123456",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(correctLoginBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var loginRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &loginRes)
	loginToken := loginRes["token"].(string)

	// 7. Test /api/auth/me with valid token
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+loginToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for /auth/me, got %d", w.Code)
	}

	// 8. Test /api/auth/me without token
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/auth/me", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized without token, got %d", w.Code)
	}
}

func TestTwoFactorAuthFlow(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM users")

	cfg := &config.Config{
		JWTSecret:        "test-jwt-secret-2fa-9999",
		RateLimitEnabled: false,
	}
	handler := NewAuthHandler(cfg)

	r := gin.New()
	r.POST("/api/auth/setup", handler.Setup)
	r.POST("/api/auth/login", handler.Login)

	protected := r.Group("/api/auth")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protected.GET("/me", handler.Me)
		protected.POST("/2fa/generate", handler.Generate2FA)
		protected.POST("/2fa/enable", handler.Enable2FA)
		protected.POST("/2fa/disable", handler.Disable2FA)
	}

	// 1. Setup admin account
	setupBody, _ := json.Marshal(map[string]string{
		"username": "superadmin",
		"password": "Password123456",
		"full_name": "Super Admin",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/setup", bytes.NewBuffer(setupBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Setup failed: %s", w.Body.String())
	}
	var setupRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &setupRes)
	token := setupRes["token"].(string)

	// 2. Generate 2FA Secret & QR Code
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/generate", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Generate 2FA failed: %s", w.Body.String())
	}
	var genRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &genRes)
	secret, ok := genRes["secret"].(string)
	if !ok || secret == "" {
		t.Fatalf("Expected secret in 2FA generate response")
	}
	qrCode, _ := genRes["qr_code"].(string)
	if qrCode == "" {
		t.Errorf("Expected base64 qr_code string")
	}

	// 3. Try to enable with wrong OTP code (should fail)
	badEnable, _ := json.Marshal(map[string]string{
		"secret": secret,
		"code":   "000000",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/enable", bytes.NewBuffer(badEnable))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for bad OTP code, got %d", w.Code)
	}

	// 4. Generate valid OTP code using secret
	validCode, err := totpGenerateCode(secret)
	if err != nil {
		t.Fatalf("Failed to generate test TOTP code: %v", err)
	}

	// 5. Enable 2FA with valid OTP code
	goodEnable, _ := json.Marshal(map[string]string{
		"secret": secret,
		"code":   validCode,
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/enable", bytes.NewBuffer(goodEnable))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for good 2FA enable, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Check /api/auth/me shows two_factor_enabled: true
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	var meRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &meRes)
	if meRes["two_factor_enabled"] != true {
		t.Errorf("Expected two_factor_enabled=true, got %v", meRes["two_factor_enabled"])
	}

	// 7. Login without code -> should return two_factor_required: true
	loginWithoutCode, _ := json.Marshal(map[string]string{
		"username": "superadmin",
		"password": "Password123456",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginWithoutCode))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for 2FA required prompt, got %d", w.Code)
	}
	var loginPromptRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &loginPromptRes)
	if loginPromptRes["two_factor_required"] != true {
		t.Errorf("Expected two_factor_required=true, got %v", loginPromptRes["two_factor_required"])
	}

	// 8. Login with wrong code -> should fail 401
	loginWrongCode, _ := json.Marshal(map[string]string{
		"username": "superadmin",
		"password": "Password123456",
		"code":     "999999",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginWrongCode))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for wrong 2FA code, got %d", w.Code)
	}

	// 9. Login with correct code -> should succeed 200 with token
	validLoginCode, _ := totpGenerateCode(secret)
	loginGoodCode, _ := json.Marshal(map[string]string{
		"username": "superadmin",
		"password": "Password123456",
		"code":     validLoginCode,
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginGoodCode))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for successful 2FA login, got %d: %s", w.Code, w.Body.String())
	}

	// 10. Disable 2FA with wrong password -> 401
	disableBadPass, _ := json.Marshal(map[string]string{
		"password": "wrong-password",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/disable", bytes.NewBuffer(disableBadPass))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for disable with wrong password, got %d", w.Code)
	}

	// 11. Disable 2FA with correct password -> 200
	disableGoodPass, _ := json.Marshal(map[string]string{
		"password": "Password123456",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/disable", bytes.NewBuffer(disableGoodPass))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for disable 2FA, got %d: %s", w.Code, w.Body.String())
	}

	// 12. Login directly without code now succeeds!
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginWithoutCode))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for direct login after 2FA disabled, got %d", w.Code)
	}
	var directRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &directRes)
	if _, hasToken := directRes["token"]; !hasToken {
		t.Errorf("Expected token directly without 2FA prompt")
	}
}

func TestLoginRateLimit_AccountLockoutBypassesSpoofedIP(t *testing.T) {
	setupTestDB(t)

	// Create a target user
	user := db.User{
		ID:           "test-lockout-uid",
		Username:     "targetuser",
		PasswordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // bcrypt for "correctpass"
		Role:         "admin",
	}
	db.DB.Create(&user)

	cfg := &config.Config{
		JWTSecret:              "test-jwt-secret-xyz",
		RateLimitEnabled:       true,
		RateLimitMaxAttempts:   5,
		RateLimitWindowMinutes: 5,
	}
	handler := NewAuthHandler(cfg)

	r := gin.New()
	_ = r.SetTrustedProxies(nil)
	r.POST("/api/auth/login", handler.Login)

	// Attempts 1 to 5: Different spoofed IP addresses, same target username, wrong password
	for i := 1; i <= 5; i++ {
		loginBody, _ := json.Marshal(map[string]string{
			"username": "targetuser",
			"password": "wrong-password",
		})
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", fmt.Sprintf("203.0.113.%d", i))
		req.RemoteAddr = fmt.Sprintf("203.0.113.%d:4321", i)
		r.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("Attempt %d should return 401 Unauthorized, got %d: %s", i, w.Code, w.Body.String())
		}
	}

	// Attempt 6: 6th different IP, same username -> MUST be locked out with 429 Too Many Requests
	loginBody, _ := json.Marshal(map[string]string{
		"username": "targetuser",
		"password": "wrong-password",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", "203.0.113.99")
	req.RemoteAddr = "203.0.113.99:4321"
	r.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("Attempt 6 must be blocked with 429 Too Many Requests, got %d: %s", w.Code, w.Body.String())
	}
}
