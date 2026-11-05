package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/sshhub"
)

type TerminalHandler struct {
	cfg *config.Config
}

func NewTerminalHandler(cfg *config.Config) *TerminalHandler {
	return &TerminalHandler{cfg: cfg}
}

func (h *TerminalHandler) Connect(c *gin.Context) {
	hostID := c.Param("host_id")
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)
	if userIDStr == "" {
		userIDStr = "system"
	}

	var host db.Host
	if err := db.DB.Preload("Credential").First(&host, "id = ?", hostID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Host not found"})
		return
	}

	info := sshhub.SSHConnectionInfo{
		Host:      &host,
		MasterKey: h.cfg.MasterKey,
	}

	if host.JumpHostID != "" {
		var jumpHost db.Host
		if err := db.DB.Preload("Credential").First(&jumpHost, "id = ?", host.JumpHostID).Error; err == nil {
			info.JumpHost = &jumpHost
		}
	}

	cols, _ := strconv.Atoi(c.DefaultQuery("cols", "120"))
	rows, _ := strconv.Atoi(c.DefaultQuery("rows", "36"))

	sessionRecord := db.Session{
		ID:        uuid.New().String(),
		UserID:    userIDStr,
		HostID:    host.ID,
		HostName:  host.Name,
		Status:    "connecting",
		ClientIP:  c.ClientIP(),
		StartedAt: time.Now(),
	}

	if err := db.DB.Create(&sessionRecord).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session audit record"})
		return
	}

	maxRecordingBytes := int64(h.cfg.RecordingMaxSizeMB) * 1024 * 1024

	sshhub.HandleTerminalSession(
		c.Writer,
		c.Request,
		info,
		&sessionRecord,
		h.cfg.RecordingsDir,
		cols,
		rows,
		h.cfg.RecordInputKeystrokes,
		maxRecordingBytes,
	)
}
