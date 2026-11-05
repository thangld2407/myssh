package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/db"
)

type JWTClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// In-memory token revocation list (JTI -> Expiration)
var (
	revokedTokens   = make(map[string]time.Time)
	revokedTokensMu sync.RWMutex
)

// RevokeToken marks a JWT's JTI as revoked until its natural expiration.
func RevokeToken(jti string, expiresAt time.Time) {
	revokedTokensMu.Lock()
	defer revokedTokensMu.Unlock()
	revokedTokens[jti] = expiresAt

	// Periodic purge of expired denylist records
	now := time.Now()
	for id, exp := range revokedTokens {
		if now.After(exp) {
			delete(revokedTokens, id)
		}
	}
}

// IsTokenRevoked checks if a JTI has been revoked.
func IsTokenRevoked(jti string) bool {
	revokedTokensMu.RLock()
	defer revokedTokensMu.RUnlock()
	exp, exists := revokedTokens[jti]
	if !exists {
		return false
	}
	if time.Now().After(exp) {
		return false
	}
	return true
}

// One-time WebSocket and Download Ticket Store
type WSTicket struct {
	UserID    string
	Username  string
	Role      string
	ExpiresAt time.Time
}

var (
	wsTickets   = make(map[string]*WSTicket)
	wsTicketsMu sync.Mutex
)

// IssueWSTicket creates a 30-second one-time ticket for WebSocket or file download authentication.
func IssueWSTicket(userID, username, role string) (string, int) {
	wsTicketsMu.Lock()
	defer wsTicketsMu.Unlock()

	now := time.Now()
	for t, ticket := range wsTickets {
		if now.After(ticket.ExpiresAt) {
			delete(wsTickets, t)
		}
	}

	b := make([]byte, 16)
	_, _ = rand.Read(b)
	ticketStr := hex.EncodeToString(b)
	ttl := 30 * time.Second

	wsTickets[ticketStr] = &WSTicket{
		UserID:    userID,
		Username:  username,
		Role:      role,
		ExpiresAt: now.Add(ttl),
	}

	return ticketStr, int(ttl.Seconds())
}

// ConsumeWSTicket validates and immediately invalidates a one-time ticket.
func ConsumeWSTicket(ticketStr string) (*WSTicket, bool) {
	wsTicketsMu.Lock()
	defer wsTicketsMu.Unlock()

	ticket, exists := wsTickets[ticketStr]
	if !exists {
		return nil, false
	}
	delete(wsTickets, ticketStr) // Invalidate immediately upon consumption

	if time.Now().After(ticket.ExpiresAt) {
		return nil, false
	}
	return ticket, true
}

func GenerateToken(user *db.User, secret string) (string, error) {
	claims := JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(), // Unique JTI for revocation tracking
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenStr, secret string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		if claims.ID != "" && IsTokenRevoked(claims.ID) {
			return nil, errors.New("token has been revoked")
		}
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

func AuthMiddleware(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Check one-time ticket (for WebSockets & download endpoints)
		if ticketStr := c.Query("ticket"); ticketStr != "" {
			ticket, ok := ConsumeWSTicket(ticketStr)
			if !ok {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired ticket"})
				c.Abort()
				return
			}
			c.Set("user_id", ticket.UserID)
			c.Set("username", ticket.Username)
			c.Set("role", ticket.Role)
			c.Next()
			return
		}

		// 2. Check Bearer Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := ParseToken(tokenStr, secret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("jwt_claims", claims)
		c.Next()
	}
}

// RequireRole enforces role-based access control (RBAC).
// Returns 403 Forbidden if user role is not in the allowed list.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Access denied: missing role claim"})
			return
		}
		userRole, _ := roleVal.(string)
		for _, allowed := range allowedRoles {
			if strings.EqualFold(userRole, allowed) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("Access denied: role '%s' does not have permission to access this resource", userRole),
		})
	}
}
