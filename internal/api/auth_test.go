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
	protected.POST("/auth/logout", handler.Logout)
	protected.POST("/auth/ws-ticket", handler.CreateWSTicket)

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

	// 8. Test /api/auth/ws-ticket with valid token -> returns ticket
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/ws-ticket", nil)
	req.Header.Set("Authorization", "Bearer "+loginToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for /auth/ws-ticket, got %d: %s", w.Code, w.Body.String())
	}
	var ticketRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &ticketRes)
	ticketVal, ok := ticketRes["ticket"].(string)
	if !ok || ticketVal == "" {
		t.Fatalf("Expected ticket in response, got %v", ticketRes)
	}

	// 9. Test /api/auth/logout -> revokes token
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/logout", nil)
	req.Header.Set("Authorization", "Bearer "+loginToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 for /auth/logout, got %d", w.Code)
	}

	// 10. Re-using the logged out token for /auth/me MUST FAIL with 401 Unauthorized
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+loginToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized using revoked token after logout, got %d", w.Code)
	}

	// 11. Test /api/auth/me without token
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

func TestErrorCodes_AuthenticationAndFeatureGuard(t *testing.T) {
	setupTestDB(t)

	cfg := &config.Config{
		JWTSecret: "test-jwt-secret-xyz",
		Features: config.FeatureFlags{
			EnableSFTP: false, // Disabled to test featureGuard error code
		},
	}
	r := SetupRouter(cfg)

	// 1. Setup with short password (< 8 chars) -> AUTH_SETUP_PASSWORD_TOO_SHORT
	body, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "123",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/auth/setup", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	var res map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["error_code"] != "AUTH_SETUP_PASSWORD_TOO_SHORT" {
		t.Errorf("Expected error_code AUTH_SETUP_PASSWORD_TOO_SHORT, got %v", res["error_code"])
	}

	// 2. Login with non-existent user -> AUTH_INVALID_CREDENTIALS
	body, _ = json.Marshal(map[string]string{
		"username": "nonexistent",
		"password": "password123",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	res = nil
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["error_code"] != "AUTH_INVALID_CREDENTIALS" {
		t.Errorf("Expected error_code AUTH_INVALID_CREDENTIALS, got %v", res["error_code"])
	}

	// 3. Test Feature Guard on disabled feature -> FEATURE_DISABLED
	adminUser := &db.User{ID: "adm-1", Username: "adm", Role: "admin"}
	token, _ := middleware.GenerateToken(adminUser, cfg.JWTSecret)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/sftp/dummy-host/list", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)

	res = nil
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["error_code"] != "FEATURE_DISABLED" {
		t.Errorf("Expected error_code FEATURE_DISABLED, got %v", res["error_code"])
	}
}

func Test2FA_SecretEncryptionAndRecoveryCodes(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM users")

	cfg := &config.Config{
		JWTSecret: "test-jwt-secret-xyz-long-enough!",
		MasterKey: "test-master-key-32-bytes-secure!",
	}
	r := SetupRouter(cfg)

	// 1. Setup admin user
	setupBody, _ := json.Marshal(map[string]string{
		"username":  "twofauser",
		"password":  "SecretPassword123!",
		"full_name": "2FA Admin",
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

	// 2. Generate 2FA
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/generate", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Generate 2FA failed: %s", w.Body.String())
	}
	var genRes map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &genRes)
	plainSecret := genRes["secret"].(string)

	validCode, _ := totpGenerateCode(plainSecret)

	// 3. Enable 2FA WITHOUT providing secret in body (must use server-side cached pending secret)
	enableBody, _ := json.Marshal(map[string]string{
		"code": validCode,
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/2fa/enable", bytes.NewBuffer(enableBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Enable 2FA using server-side pending secret failed: %s", w.Body.String())
	}

	var enableRes struct {
		Success       bool     `json:"success"`
		RecoveryCodes []string `json:"recovery_codes"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &enableRes)
	if len(enableRes.RecoveryCodes) != 8 {
		t.Fatalf("Expected 8 recovery codes, got %d", len(enableRes.RecoveryCodes))
	}

	// 4. Verify SQLite DB has encrypted secret, non-empty nonce, and NOT plaintext
	var dbUser db.User
	db.DB.First(&dbUser, "username = ?", "twofauser")
	if dbUser.TwoFactorSecret == plainSecret {
		t.Errorf("DB TwoFactorSecret must NOT be plaintext! Got: %s", dbUser.TwoFactorSecret)
	}
	if dbUser.TwoFactorNonce == "" {
		t.Errorf("DB TwoFactorNonce must be set for encrypted secret")
	}

	// 5. Test login with one-time recovery code
	recoveryCodeToUse := enableRes.RecoveryCodes[0]

	loginRecoveryBody, _ := json.Marshal(map[string]string{
		"username": "twofauser",
		"password": "SecretPassword123!",
		"code":     recoveryCodeToUse,
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginRecoveryBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected login with recovery code to succeed, got %d: %s", w.Code, w.Body.String())
	}

	// 6. Test login with the SAME recovery code again -> MUST FAIL (one-time use)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginRecoveryBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("Reused recovery code must fail with 401 Unauthorized, got %d", w.Code)
	}

	// 7. Test backward compatibility: plaintext secret (nonce == "")
	db.DB.Model(&dbUser).Updates(map[string]interface{}{
		"two_factor_secret": plainSecret,
		"two_factor_nonce":  "",
	})

	totpCode2, _ := totpGenerateCode(plainSecret)
	loginLegacyBody, _ := json.Marshal(map[string]string{
		"username": "twofauser",
		"password": "SecretPassword123!",
		"code":     totpCode2,
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginLegacyBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Legacy plaintext 2FA login should succeed, got %d: %s", w.Code, w.Body.String())
	}
}
