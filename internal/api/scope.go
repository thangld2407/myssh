package api

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ScopeToOwner applies user_id filtering for non-admin users.
// If a non-admin user lacks a valid user_id in the context, it fails closed with an error.
func ScopeToOwner(c *gin.Context, query *gorm.DB) (*gorm.DB, error) {
	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)

	if strings.EqualFold(roleStr, "admin") {
		return query, nil
	}

	userIDVal, _ := c.Get("user_id")
	userIDStr, ok := userIDVal.(string)
	if !ok || strings.TrimSpace(userIDStr) == "" {
		return nil, errors.New("forbidden: missing or invalid user context")
	}

	return query.Where("user_id = ?", userIDStr), nil
}
