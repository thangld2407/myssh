package api

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
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

var (
	loginAttempts   = make(map[string]*failedAttempt)
	loginAttemptsMu sync.Mutex
)

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
		return fmt.Errorf("Quá nhiều lần đăng nhập thất bại. Vui lòng chờ %d giây trước khi thử lại", int(remaining.Seconds()))
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Hệ thống đã được thiết lập quản trị viên. Vui lòng đăng nhập."})
		return
	}

	var req SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu cấu hình không hợp lệ"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)

	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu quản trị phải có độ dài tối thiểu 8 ký tự"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể mã hóa mật khẩu"})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể tạo tài khoản admin: " + err.Error()})
		return
	}

	token, err := middleware.GenerateToken(&admin, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể tạo mã xác thực JWT"})
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
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
		return
	}

	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Yêu cầu đăng nhập không hợp lệ"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	userKey := "user:" + strings.ToLower(req.Username)

	// Check Account / Username rate limit (locks out brute-force across arbitrary/spoofed IPs)
	if req.Username != "" {
		if err := checkRateLimit(h.cfg, userKey); err != nil {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
			return
		}
	}

	var user db.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		recordFailedAttempt(h.cfg, ipKey)
		recordFailedAttempt(h.cfg, userKey)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tên đăng nhập hoặc mật khẩu không chính xác"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		recordFailedAttempt(h.cfg, ipKey)
		recordFailedAttempt(h.cfg, userKey)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tên đăng nhập hoặc mật khẩu không chính xác"})
		return
	}

	// Kiểm tra nếu tài khoản kích hoạt 2FA
	if user.TwoFactorEnabled {
		code := strings.TrimSpace(req.Code)
		if code == "" {
			c.JSON(http.StatusOK, gin.H{
				"two_factor_required": true,
				"message":             "Vui lòng nhập mã xác thực hai yếu tố (2FA)",
			})
			return
		}

		if !totp.Validate(code, user.TwoFactorSecret) {
			recordFailedAttempt(h.cfg, ipKey)
			recordFailedAttempt(h.cfg, userKey)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Mã xác thực 2FA không chính xác hoặc đã hết hạn"})
			return
		}
	}

	clearFailedAttempt(ipKey)
	clearFailedAttempt(userKey)

	token, err := middleware.GenerateToken(&user, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi sinh token xác thực"})
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

// Generate2FA tạo Secret Key và QR Code cho ứng dụng Google Authenticator / Authy
func (h *AuthHandler) Generate2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Người dùng không tồn tại"})
		return
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "MySSH Bastion",
		AccountName: user.Username,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể sinh mã 2FA: " + err.Error()})
		return
	}

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
	Secret string `json:"secret" binding:"required"`
	Code   string `json:"code" binding:"required"`
}

// Enable2FA kiểm tra mã 6 số đầu tiên và kích hoạt 2FA cho tài khoản
func (h *AuthHandler) Enable2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req Enable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dữ liệu kích hoạt 2FA không hợp lệ"})
		return
	}

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Người dùng không tồn tại"})
		return
	}

	cleanSecret := strings.TrimSpace(req.Secret)
	cleanCode := strings.TrimSpace(req.Code)

	if !totp.Validate(cleanCode, cleanSecret) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mã xác thực 2FA không chính xác hoặc đã hết hạn"})
		return
	}

	user.TwoFactorEnabled = true
	user.TwoFactorSecret = cleanSecret
	user.UpdatedAt = time.Now()

	if err := db.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể cập nhật cấu hình bảo mật: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Xác thực hai yếu tố (2FA) đã được kích hoạt thành công",
	})
}

type Disable2FARequest struct {
	Password string `json:"password" binding:"required"`
}

// Disable2FA tắt 2FA khi có xác nhận mật khẩu tài khoản
func (h *AuthHandler) Disable2FA(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req Disable2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vui lòng nhập mật khẩu xác nhận"})
		return
	}

	var user db.User
	if err := db.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Người dùng không tồn tại"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Mật khẩu xác nhận không chính xác"})
		return
	}

	user.TwoFactorEnabled = false
	user.TwoFactorSecret = ""
	user.UpdatedAt = time.Now()

	if err := db.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Không thể tắt 2FA: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Đã tắt xác thực hai yếu tố (2FA) thành công",
	})
}
