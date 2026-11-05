package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

type AuditHandler struct {
	cfg *config.Config
}

func NewAuditHandler(cfg *config.Config) *AuditHandler {
	return &AuditHandler{cfg: cfg}
}

// ListLogs lists paginated administrative audit logs.
func (h *AuditHandler) ListLogs(c *gin.Context) {
	var logs []db.AuditLog
	query := db.DB.Order("created_at desc")

	if resType := c.Query("resource_type"); resType != "" {
		query = query.Where("resource_type = ?", resType)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if username := c.Query("username"); username != "" {
		query = query.Where("username = ?", username)
	}

	limit := 50
	if lStr := c.Query("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	offset := 0
	if oStr := c.Query("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil && o >= 0 {
			offset = o
		}
	}

	var total int64
	query.Model(&db.AuditLog{}).Count(&total)

	if err := query.Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"logs":   logs,
	})
}
