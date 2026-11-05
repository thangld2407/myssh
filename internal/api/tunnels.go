package api

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/sshhub"
)

// isAllowedTunnelBindHost verifies that bindHost is a secure loopback address unless public binding is explicitly enabled.
func isAllowedTunnelBindHost(bindHost string) bool {
	h := strings.ToLower(strings.TrimSpace(bindHost))
	if h == "127.0.0.1" || h == "localhost" || h == "::1" {
		return true
	}
	envVal := strings.ToLower(strings.TrimSpace(os.Getenv("FEATURE_TUNNEL_PUBLIC_BIND")))
	if envVal == "true" || envVal == "1" || envVal == "yes" {
		log.Printf("[TUNNEL] WARNING: FEATURE_TUNNEL_PUBLIC_BIND enabled. Allowing non-loopback bind_host '%s'. Listener is exposed on network!\n", bindHost)
		return true
	}
	return false
}

type TunnelHandler struct {
	cfg *config.Config
}

func NewTunnelHandler(cfg *config.Config) *TunnelHandler {
	return &TunnelHandler{cfg: cfg}
}

type CreateTunnelRequest struct {
	HostID     string `json:"host_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Type       string `json:"type"` // local, socks5
	BindHost   string `json:"bind_host"`
	BindPort   int    `json:"bind_port" binding:"required"`
	TargetHost string `json:"target_host"`
	TargetPort int    `json:"target_port"`
}

func (h *TunnelHandler) List(c *gin.Context) {
	var tunnels []db.Tunnel
	query := db.DB.Preload("Host").Order("created_at desc")

	// Ownership scoping (fail-closed): Non-admin users can only view their own tunnels
	var err error
	query, err = ScopeToOwner(c, query)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{
			"error_code": "FORBIDDEN_ROLE",
			"error":      err.Error(),
		})
		return
	}

	if err := query.Find(&tunnels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query tunnels"})
		return
	}

	// Update live status from memory Hub
	for i := range tunnels {
		if sshhub.Hub.IsRunning(tunnels[i].ID) {
			tunnels[i].Status = "running"
		} else if tunnels[i].Status == "running" {
			tunnels[i].Status = "stopped"
		}
	}

	c.JSON(http.StatusOK, tunnels)
}

func (h *TunnelHandler) Create(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)
	if userIDStr == "" {
		userIDStr = "system"
	}

	var req CreateTunnelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.BindPort < 1 || req.BindPort > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid bind_port, must be between 1 and 65535"})
		return
	}

	if req.Type == "local" && (req.TargetPort < 1 || req.TargetPort > 65535) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid target_port, must be between 1 and 65535"})
		return
	}

	if req.Type == "" {
		req.Type = "local"
	}
	if req.BindHost == "" {
		req.BindHost = "127.0.0.1"
	} else if !isAllowedTunnelBindHost(req.BindHost) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insecure bind_host: only loopback addresses (127.0.0.1, localhost, ::1) are permitted"})
		return
	}

	tunnel := db.Tunnel{
		ID:         uuid.New().String(),
		UserID:     userIDStr,
		HostID:     req.HostID,
		Name:       req.Name,
		Type:       req.Type,
		BindHost:   req.BindHost,
		BindPort:   req.BindPort,
		TargetHost: req.TargetHost,
		TargetPort: req.TargetPort,
		Status:     "stopped",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := db.DB.Create(&tunnel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tunnel"})
		return
	}

	db.DB.Preload("Host").First(&tunnel, "id = ?", tunnel.ID)
	c.JSON(http.StatusCreated, tunnel)
}

func (h *TunnelHandler) Start(c *gin.Context) {
	id := c.Param("id")
	var tunnel db.Tunnel
	if err := db.DB.Preload("Host").Preload("Host.Credential").First(&tunnel, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tunnel not found"})
		return
	}

	if tunnel.Host == nil || tunnel.Host.Credential == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Host or credential missing for this tunnel"})
		return
	}

	if !isAllowedTunnelBindHost(tunnel.BindHost) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insecure bind_host: only loopback addresses (127.0.0.1, localhost, ::1) are permitted"})
		return
	}

	info := sshhub.SSHConnectionInfo{
		Host:      tunnel.Host,
		MasterKey: h.cfg.MasterKey,
	}

	if tunnel.Host.JumpHostID != "" {
		var jumpHost db.Host
		if err := db.DB.Preload("Credential").First(&jumpHost, "id = ?", tunnel.Host.JumpHostID).Error; err == nil {
			info.JumpHost = &jumpHost
		}
	}

	err := sshhub.Hub.StartLocalTunnel(
		tunnel.ID,
		info,
		tunnel.BindHost,
		tunnel.BindPort,
		tunnel.TargetHost,
		tunnel.TargetPort,
	)
	if err != nil {
		tunnel.Status = "error"
		db.DB.Save(&tunnel)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to start tunnel: " + err.Error()})
		return
	}

	tunnel.Status = "running"
	db.DB.Save(&tunnel)
	c.JSON(http.StatusOK, gin.H{
		"message": "Tunnel started successfully",
		"tunnel":  tunnel,
	})
}

func (h *TunnelHandler) Stop(c *gin.Context) {
	id := c.Param("id")
	var tunnel db.Tunnel
	if err := db.DB.First(&tunnel, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tunnel not found"})
		return
	}

	if err := sshhub.Hub.StopTunnel(id); err != nil {
		// Even if not active in memory, update DB
		tunnel.Status = "stopped"
		db.DB.Save(&tunnel)
		c.JSON(http.StatusOK, gin.H{"message": "Tunnel is already stopped"})
		return
	}

	tunnel.Status = "stopped"
	db.DB.Save(&tunnel)
	c.JSON(http.StatusOK, gin.H{"message": "Tunnel stopped successfully"})
}

func (h *TunnelHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	_ = sshhub.Hub.StopTunnel(id)

	if err := db.DB.Delete(&db.Tunnel{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete tunnel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tunnel deleted successfully"})
}
