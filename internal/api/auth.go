package api

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

type failedAttempt struct {
	count     int
	lastTried time.Time
}

var (
	loginAttempts   = make(map[string]*failedAttempt)
	loginAttemptsMu sync.Mutex
)

func checkRateLimit(ip string) error {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	attempt, exists := loginAttempts[ip]
	if !exists {
		return nil
	}

	if time.Since(attempt.lastTried) > 5*time.Minute {
		delete(loginAttempts, ip)
		return nil
	}

	if attempt.count >= 5 {
		remaining := 5*time.Minute - time.Since(attempt.lastTried)
		return fmt.Errorf("Quá nhiều lần đăng nhập thất bại. Vui lòng chờ %d giây trước khi thử lại", int(remaining.Seconds()))
	}
	return nil
}

func recordFailedAttempt(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	attempt, exists := loginAttempts[ip]
	if !exists || time.Since(attempt.lastTried) > 5*time.Minute {
		loginAttempts[ip] = &failedAttempt{count: 1, lastTried: time.Now()}
		return
	}
	attempt.count++
	attempt.lastTried = time.Now()
}

func clearFailedAttempt(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, ip)
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
}

func (h *AuthHandler) Login(c *gin.Context) {
	clientIP := c.ClientIP()
	if err := checkRateLimit(clientIP); err != nil {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": err.Error()})
		return
	}

	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Yêu cầu đăng nhập không hợp lệ"})
		return
	}

	var user db.User
	if err := db.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		recordFailedAttempt(clientIP)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tên đăng nhập hoặc mật khẩu không chính xác"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		recordFailedAttempt(clientIP)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tên đăng nhập hoặc mật khẩu không chính xác"})
		return
	}

	clearFailedAttempt(clientIP)

	token, err := middleware.GenerateToken(&user, h.cfg.JWTSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi sinh token xác thực"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"full_name": user.FullName,
			"role":      user.Role,
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
		"id":        user.ID,
		"username":  user.Username,
		"full_name": user.FullName,
		"role":      user.Role,
	})
}
