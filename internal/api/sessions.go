package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

type SessionHandler struct {
	cfg *config.Config
}

func NewSessionHandler(cfg *config.Config) *SessionHandler {
	return &SessionHandler{cfg: cfg}
}

func (h *SessionHandler) List(c *gin.Context) {
	var sessions []db.Session
	query := db.DB.Preload("User").Order("started_at desc")

	// Ownership scoping: Non-admin users can only view their own sessions
	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)
	if !strings.EqualFold(roleStr, "admin") {
		userIDVal, _ := c.Get("user_id")
		if userIDStr, ok := userIDVal.(string); ok && userIDStr != "" {
			query = query.Where("user_id = ?", userIDStr)
		}
	}

	if hostID := c.Query("host_id"); hostID != "" {
		query = query.Where("host_id = ?", hostID)
	}

	if err := query.Limit(100).Find(&sessions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query sessions"})
		return
	}

	c.JSON(http.StatusOK, sessions)
}

func (h *SessionHandler) GetRecording(c *gin.Context) {
	id := c.Param("id")
	var session db.Session
	if err := db.DB.First(&session, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
		return
	}

	if session.RecordingPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recording file not found for this session"})
		return
	}

	cleanPath := filepath.Clean(session.RecordingPath)
	cleanDir := filepath.Clean(h.cfg.RecordingsDir)
	rel, err := filepath.Rel(cleanDir, cleanPath)
	if err != nil || strings.HasPrefix(rel, "..") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied: invalid recording file path"})
		return
	}

	if _, err := os.Stat(cleanPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recording file on disk no longer exists"})
		return
	}

	c.Header("Content-Type", "application/x-asciicast; charset=utf-8")
	c.Header("Content-Disposition", "inline; filename="+id+".cast")
	c.File(cleanPath)
}
