package api

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image/png"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/middleware"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
)

type failedAttempt struct {
	count     int
	lastTried time.Time
}

const maxAttemptsMapSize = 10000

type pending2FAEntry struct {
	secret    string
	expiresAt time.Time
}

var (
	loginAttempts   = make(map[string]*failedAttempt)
	loginAttemptsMu sync.Mutex

	pending2FAMu  sync.RWMutex
	pending2FAMap = make(map[string]pending2FAEntry)
)

func generateRecoveryCode() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	part1 := hex.EncodeToString(b[:2])
	part2 := hex.EncodeToString(b[2:4])
	return fmt.Sprintf("%s-%s", strings.ToUpper(part1), strings.ToUpper(part2))
}

func checkRateLimit(cfg *config.Config, key string) error {
	if cfg != nil && !cfg.RateLimitEnabled {
		return nil
	}
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	window := 5 * time.Minute
	maxAttempts := 5
	if cfg != nil {
		if cfg.RateLimitWindowMinutes > 0 {
			window = time.Duration(cfg.RateLimitWindowMinutes) * time.Minute
		}
		if cfg.RateLimitMaxAttempts > 0 {
			maxAttempts = cfg.RateLimitMaxAttempts
		}
	}

	attempt, exists := loginAttempts[key]
	if !exists {
		return nil
	}

	if time.Since(attempt.lastTried) > window {
		delete(loginAttempts, key)
		return nil
	}

	if attempt.count >= maxAttempts {
		remaining := window - time.Since(attempt.lastTried)
		return fmt.Errorf("too many failed login attempts. Please wait %d seconds before trying again", int(remaining.Seconds()))
	}
	return nil
}

func recordFailedAttempt(cfg *config.Config, key string) {
	if cfg != nil && !cfg.RateLimitEnabled {
		return
	}
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	window := 5 * time.Minute
	if cfg != nil && cfg.RateLimitWindowMinutes > 0 {
		window = time.Duration(cfg.RateLimitWindowMinutes) * time.Minute
	}

	// Evict stale or oldest entries if map exceeds capacity
	if len(loginAttempts) >= maxAttemptsMapSize {
		for k, att := range loginAttempts {
			if time.Since(att.lastTried) > window {
				delete(loginAttempts, k)
			}
		}
		if len(loginAttempts) >= maxAttemptsMapSize {
			var oldestKey string
			var oldestTime time.Time
			for k, att := range loginAttempts {
				if oldestKey == "" || att.lastTried.Before(oldestTime) {
					oldestKey = k
					oldestTime = att.lastTried
				}
			}
			if oldestKey != "" {
				delete(loginAttempts, oldestKey)
			}
		}
	}

	attempt, exists := loginAttempts[key]
	if !exists || time.Since(attempt.lastTried) > window {
		loginAttempts[key] = &failedAttempt{count: 1, lastTried: time.Now()}
		return
	}
	attempt.count++
	attempt.lastTried = time.Now()
}

func clearFailedAttempt(key string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, key)
}

type AuthHandler struct {
	cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

func (h *AuthHandler) SetupStatus(c *gin.Context) {
	var count int64
	db.DB.Model(&db.User{}).Count(&count)
	c.JSON(http.StatusOK, gin.H{
		"initialized": count > 0,
	})
}

type SetupRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	FullName string `json:"full_name"`
}

func (h *AuthHandler) Setup(c *gin.Context) {
	var count int64
	db.DB.Model(&db.User{}).Count(&count)
	if count > 0 {
		c.JSON(http.StatusForbidden, gin.H{
			"error_code": "AUTH_SETUP_ALREADY_COMPLETED",
			"error":      "System administrator has already been configured. Please log in.",
		})
		return
	}

	var req SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error_code": "AUTH_SETUP_INVALID_PAYLOAD",
			"error":      "Invalid setup configuration data",
		})
		return
	}
	req.Username = strings.TrimSpace(req.Username)

	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error_code": "AUTH_SETUP_PASSWORD_TOO_SHORT",
			"error":      "Admin password must be at least 8 characters long",
		})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_SETUP_PASSWORD_HASH_FAILED",
			"error":      "Failed to hash password",
		})
		return
	}

	fullName := req.FullName
	if fullName == "" {
		fullName = "Master Administrator"
	}

	admin := db.User{
		ID:           uuid.New().String(),
		Username:     req.Username,
		PasswordHash: string(hash),
		FullName:     fullName,
		Role:         "admin",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := db.DB.Create(&admin).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_SETUP_CREATE_USER_FAILED",
			"error":      "Failed to create admin user: " + err.Error(),
		})
		return
	}

	token, err := middleware.GenerateToken(&admin, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_SETUP_TOKEN_GEN_FAILED",
			"error":      "Failed to generate JWT authentication token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":        admin.ID,
			"username":  admin.Username,
			"full_name": admin.FullName,
			"role":      admin.Role,
		},
	})
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Code     string `json:"code"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	clientIP := c.ClientIP()
	ipKey := "ip:" + clientIP
	if err := checkRateLimit(h.cfg, ipKey); err != nil {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error_code": "AUTH_RATE_LIMIT_EXCEEDED",
			"error":      err.Error(),
		})
		return
	}

	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error_code": "AUTH_INVALID_PAYLOAD",
			"error":      "Invalid login request payload",
		})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	userKey := "user:" + strings.ToLower(req.Username)

	// Check Account / Username rate limit (locks out brute-force across arbitrary/spoofed IPs)
	if req.Username != "" {
		if err := checkRateLimit(h.cfg, userKey); err != nil {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error_code": "AUTH_RATE_LIMIT_EXCEEDED",
				"error":      err.Error(),
			})
			return
		}
	}

	var user db.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		recordFailedAttempt(h.cfg, ipKey)
		recordFailedAttempt(h.cfg, userKey)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error_code": "AUTH_INVALID_CREDENTIALS",
			"error":      "Invalid username or password",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		recordFailedAttempt(h.cfg, ipKey)
		recordFailedAttempt(h.cfg, userKey)
		c.JSON(http.StatusUnauthorized, gin.H{
			"error_code": "AUTH_INVALID_CREDENTIALS",
			"error":      "Invalid username or password",
		})
		return
	}

	// Check if account has 2FA enabled
	if user.TwoFactorEnabled {
		code := strings.TrimSpace(req.Code)
		if code == "" {
			c.JSON(http.StatusOK, gin.H{
				"two_factor_required": true,
				"message":             "Please enter your two-factor authentication (2FA) code",
			})
			return
		}

		plainSecret := user.TwoFactorSecret
		if user.TwoFactorNonce != "" {
			dec, err := crypto.Decrypt(user.TwoFactorSecret, user.TwoFactorNonce, h.cfg.MasterKey)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error_code": "AUTH_2FA_UPDATE_FAILED",
					"error":      "Failed to decrypt two-factor credentials",
				})
				return
			}
			plainSecret = string(dec)
		}

		totpValid := totp.Validate(code, plainSecret)
		recoveryValid := false

		if !totpValid && user.RecoveryCodes != "" {
			var hashes []string
			if err := json.Unmarshal([]byte(user.RecoveryCodes), &hashes); err == nil {
				for i, hVal := range hashes {
					if bcrypt.CompareHashAndPassword([]byte(hVal), []byte(code)) == nil {
						recoveryValid = true
						// One-time use: evict matched code and persist remaining
						hashes = append(hashes[:i], hashes[i+1:]...)
						newHashesJSON, _ := json.Marshal(hashes)
						user.RecoveryCodes = string(newHashesJSON)
						_ = db.DB.Model(&user).Update("recovery_codes", user.RecoveryCodes)
						break
					}
				}
			}
		}

		if !totpValid && !recoveryValid {
			recordFailedAttempt(h.cfg, ipKey)
			recordFailedAttempt(h.cfg, userKey)
			c.JSON(http.StatusUnauthorized, gin.H{
				"error_code": "AUTH_2FA_INVALID_CODE",
				"error":      "Invalid or expired 2FA verification code",
			})
			return
		}
	}

	clearFailedAttempt(ipKey)
	clearFailedAttempt(userKey)

	token, err := middleware.GenerateToken(&user, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_LOGIN_TOKEN_GEN_FAILED",
			"error":      "Failed to generate authentication token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":                 user.ID,
			"username":           user.Username,
			"full_name":          user.FullName,
			"role":               user.Role,
			"two_factor_enabled": user.TwoFactorEnabled,
		},
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                 user.ID,
		"username":           user.Username,
		"full_name":          user.FullName,
		"role":               user.Role,
		"two_factor_enabled": user.TwoFactorEnabled,
	})
}

// CreateWSTicket issues a short-lived (30s) single-use ticket for WebSockets and file downloads.
func (h *AuthHandler) CreateWSTicket(c *gin.Context) {
	userID, _ := c.Get("user_id")
	username, _ := c.Get("username")
	role, _ := c.Get("role")

	ticket, expiresIn := middleware.IssueWSTicket(
		fmt.Sprint(userID),
		fmt.Sprint(username),
		fmt.Sprint(role),
	)

	c.JSON(http.StatusOK, gin.H{
		"ticket":     ticket,
		"expires_in": expiresIn,
	})
}

// Logout revokes the active JWT token via JTI denylist.
func (h *AuthHandler) Logout(c *gin.Context) {
	claimsVal, exists := c.Get("jwt_claims")
	if exists {
		if claims, ok := claimsVal.(*middleware.JWTClaims); ok && claims.ID != "" {
			var exp time.Time
			if claims.ExpiresAt != nil {
				exp = claims.ExpiresAt.Time
			} else {
				exp = time.Now().Add(24 * time.Hour)
			}
			middleware.RevokeToken(claims.ID, exp)
		}
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// Generate2FA generates a TOTP secret and QR code for Google Authenticator / Authy
func (h *AuthHandler) Generate2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error_code": "AUTH_USER_NOT_FOUND",
			"error":      "User not found",
		})
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "MySSH Bastion",
		AccountName: user.Username,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_2FA_GENERATE_FAILED",
			"error":      "Failed to generate 2FA secret: " + err.Error(),
		})
		return
	}

	// Cache pending secret in server-side memory for 10 minutes
	pending2FAMu.Lock()
	pending2FAMap[fmt.Sprint(userID)] = pending2FAEntry{
		secret:    key.Secret(),
		expiresAt: time.Now().Add(10 * time.Minute),
	}
	pending2FAMu.Unlock()

	var buf bytes.Buffer
	var qrDataURL string
	img, err := key.Image(220, 220)
	if err == nil && img != nil {
		if err := png.Encode(&buf, img); err == nil {
			qrDataURL = "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"secret":      key.Secret(),
		"otpauth_url": key.URL(),
		"qr_code":     qrDataURL,
	})
}

type Enable2FARequest struct {
	Secret string `json:"secret"` // Optional: server-side pending secret takes precedence
	Code   string `json:"code" binding:"required"`
}

// Enable2FA validates the initial 6-digit TOTP code and enables 2FA for the account
func (h *AuthHandler) Enable2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req Enable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error_code": "AUTH_2FA_INVALID_PAYLOAD",
			"error":      "Invalid 2FA activation payload",
		})
		return
	}

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error_code": "AUTH_USER_NOT_FOUND",
			"error":      "User not found",
		})
		return
	}

	cleanCode := strings.TrimSpace(req.Code)

	// Retrieve pending secret from server-side cache first; fallback to client-provided secret
	var secretToVerify string
	pending2FAMu.Lock()
	if entry, ok := pending2FAMap[fmt.Sprint(userID)]; ok && time.Now().Before(entry.expiresAt) {
		secretToVerify = entry.secret
		delete(pending2FAMap, fmt.Sprint(userID))
	} else if req.Secret != "" {
		secretToVerify = strings.TrimSpace(req.Secret)
	}
	pending2FAMu.Unlock()

	if secretToVerify == "" || !totp.Validate(cleanCode, secretToVerify) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error_code": "AUTH_2FA_INVALID_CODE",
			"error":      "Invalid or expired 2FA verification code",
		})
		return
	}

	// Encrypt the TOTP secret with MasterKey
	encSecret, nonce, err := crypto.Encrypt([]byte(secretToVerify), h.cfg.MasterKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_2FA_UPDATE_FAILED",
			"error":      "Failed to encrypt 2FA secret: " + err.Error(),
		})
		return
	}

	// Generate 8 one-time recovery codes stored as bcrypt hashes
	recoveryCodes := make([]string, 8)
	recoveryHashes := make([]string, 8)
	for i := 0; i < 8; i++ {
		code := generateRecoveryCode()
		recoveryCodes[i] = code
		hash, _ := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
		recoveryHashes[i] = string(hash)
	}
	hashesJSON, _ := json.Marshal(recoveryHashes)

	user.TwoFactorEnabled = true
	user.TwoFactorSecret = encSecret
	user.TwoFactorNonce = nonce
	user.RecoveryCodes = string(hashesJSON)
	user.UpdatedAt = time.Now()

	if err := db.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_2FA_UPDATE_FAILED",
			"error":      "Failed to update security settings: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"message":        "Two-factor authentication (2FA) enabled successfully",
		"recovery_codes": recoveryCodes,
	})
}

type Disable2FARequest struct {
	Password string `json:"password" binding:"required"`
}

// Disable2FA disables 2FA upon verifying the account password
func (h *AuthHandler) Disable2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req Disable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error_code": "AUTH_2FA_CONFIRM_PASSWORD_REQUIRED",
			"error":      "Please enter your password to confirm",
		})
		return
	}

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error_code": "AUTH_USER_NOT_FOUND",
			"error":      "User not found",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error_code": "AUTH_2FA_PASSWORD_MISMATCH",
			"error":      "Incorrect confirmation password",
		})
		return
	}

	user.TwoFactorEnabled = false
	user.TwoFactorSecret = ""
	user.TwoFactorNonce = ""
	user.RecoveryCodes = ""
	user.UpdatedAt = time.Now()

	if err := db.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error_code": "AUTH_2FA_DISABLE_FAILED",
			"error":      "Failed to disable 2FA: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Two-factor authentication (2FA) disabled successfully",
	})
}
