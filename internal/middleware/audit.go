package middleware

import (
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/db"
)

// AuditMiddleware logs mutation operations (POST, PUT, PATCH, DELETE) by authenticated users into db.AuditLog.
func AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method != "POST" && method != "PUT" && method != "PATCH" && method != "DELETE" {
			c.Next()
			return
		}

		// Skip login and ticket creation endpoints from audit log spam
		path := c.Request.URL.Path
		if strings.HasSuffix(path, "/auth/login") || strings.HasSuffix(path, "/auth/ws-ticket") {
			c.Next()
			return
		}

		c.Next()

		// Record mutation if response was successful (< 400)
		if c.Writer.Status() >= 400 {
			return
		}

		userIDVal, exists := c.Get("user_id")
		if !exists {
			return
		}
		userID := fmt.Sprint(userIDVal)
		if userID == "" || userID == "<nil>" {
			return
		}

		usernameVal, _ := c.Get("username")
		username := fmt.Sprint(usernameVal)
		if username == "<nil>" {
			username = ""
		}

		resourceType, action := parseResourceAndAction(method, path)

		resourceID := c.Param("id")
		if resourceID == "" {
			resourceID = c.Param("host_id")
		}

		logEntry := db.AuditLog{
			ID:           uuid.New().String(),
			UserID:       userID,
			Username:     username,
			Action:       action,
			ResourceType: resourceType,
			ResourceID:   resourceID,
			Detail:       fmt.Sprintf("%s %s (status %d)", method, path, c.Writer.Status()),
			ClientIP:     c.ClientIP(),
			CreatedAt:    time.Now(),
		}

		if db.DB != nil {
			_ = db.DB.Create(&logEntry)
		}
	}
}

func parseResourceAndAction(method, path string) (resourceType string, action string) {
	action = method
	switch method {
	case "POST":
		action = "CREATE"
	case "PUT", "PATCH":
		action = "UPDATE"
	case "DELETE":
		action = "DELETE"
	}

	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 2 && parts[0] == "api" {
		resourceType = parts[1]
		lastPart := parts[len(parts)-1]
		if lastPart == "start" || lastPart == "stop" || lastPart == "import" || lastPart == "reset-fingerprint" || lastPart == "apply" {
			action = strings.ToUpper(lastPart)
		}
	} else {
		resourceType = "system"
	}
	return
}
