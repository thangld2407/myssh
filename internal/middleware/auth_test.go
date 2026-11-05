package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/db"
)

func TestJWTGenerationAndParsing(t *testing.T) {
	secret := "test-secret-key-12345"
	user := &db.User{
		ID:       "usr-1",
		Username: "admin",
		Role:     "admin",
	}

	token, err := GenerateToken(user, secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	claims, err := ParseToken(token, secret)
	if err != nil {
		t.Fatalf("ParseToken failed: %v", err)
	}

	if claims.UserID != user.ID || claims.Username != user.Username || claims.Role != user.Role {
		t.Errorf("Claims mismatch: got %+v, want %+v", claims, user)
	}
}

func TestJWTWrongSecret(t *testing.T) {
	user := &db.User{
		ID:       "usr-2",
		Username: "operator",
		Role:     "member",
	}

	token, err := GenerateToken(user, "secret-one")
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	_, err = ParseToken(token, "secret-two")
	if err == nil {
		t.Fatalf("Expected token parsing to fail with wrong secret")
	}
}

func TestAuthMiddleware(t *testing.T) {
	secret := "middleware-test-secret"
	user := &db.User{
		ID:       "usr-mid",
		Username: "miduser",
		Role:     "admin",
	}
	validToken, err := GenerateToken(user, secret)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AuthMiddleware(secret))
	r.GET("/protected", func(c *gin.Context) {
		uid, _ := c.Get("user_id")
		uname, _ := c.Get("username")
		c.JSON(http.StatusOK, gin.H{
			"user_id":  uid,
			"username": uname,
		})
	})

	// 1. Missing token -> 401
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 without token, got %d", w.Code)
	}

	// 2. Invalid token -> 401
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid.jwt.token")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 with invalid token, got %d", w.Code)
	}

	// 3. Valid Bearer token in header -> 200
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 with Bearer token, got %d", w.Code)
	}

	// 4. Valid token in query parameter (for WebSocket/download) -> 200
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/protected?token="+validToken, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 with query token, got %d", w.Code)
	}
}
