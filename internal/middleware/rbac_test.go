package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequireRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		userRole     string
		allowedRoles []string
		expectedCode int
	}{
		{"Admin accessing Admin route", "admin", []string{"admin"}, http.StatusOK},
		{"Member accessing Member/Admin route", "member", []string{"admin", "member"}, http.StatusOK},
		{"Viewer accessing Viewer route", "viewer", []string{"admin", "member", "viewer"}, http.StatusOK},
		{"Member attempting Admin-only mutation", "member", []string{"admin"}, http.StatusForbidden},
		{"Viewer attempting Member action", "viewer", []string{"admin", "member"}, http.StatusForbidden},
		{"Viewer attempting Admin mutation", "viewer", []string{"admin"}, http.StatusForbidden},
		{"Missing role claim", "", []string{"admin"}, http.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			r.Use(func(c *gin.Context) {
				if tt.userRole != "" {
					c.Set("role", tt.userRole)
				}
				c.Next()
			})
			r.GET("/test-endpoint", RequireRole(tt.allowedRoles...), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test-endpoint", nil)
			r.ServeHTTP(w, req)

			if w.Code != tt.expectedCode {
				t.Errorf("Role %q with allowed %v: expected HTTP %d, got %d (body: %s)",
					tt.userRole, tt.allowedRoles, tt.expectedCode, w.Code, w.Body.String())
			}
		})
	}
}
