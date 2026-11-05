package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/importer"
	"github.com/myssh/myssh/internal/sshhub"
)

type HostHandler struct {
	cfg *config.Config
}

func NewHostHandler(cfg *config.Config) *HostHandler {
	return &HostHandler{cfg: cfg}
}

type CreateOrUpdateHostRequest struct {
	Name         string `json:"name" binding:"required"`
	Hostname     string `json:"hostname" binding:"required"`
	Port         int    `json:"port"`
	Username     string `json:"username" binding:"required"`
	Folder       string `json:"folder"`
	Tags         string `json:"tags"`
	CredentialID string `json:"credential_id" binding:"required"`
	JumpHostID   string `json:"jump_host_id"`
	Description  string `json:"description"`
}

func (h *HostHandler) List(c *gin.Context) {
	query := db.DB.Preload("Credential").Order("folder asc, name asc")

	if folder := c.Query("folder"); folder != "" {
		query = query.Where("folder = ?", folder)
	}

	if search := c.Query("q"); search != "" {
		s := "%" + search + "%"
		query = query.Where("name LIKE ? OR hostname LIKE ? OR tags LIKE ?", s, s, s)
	}

	var hosts []db.Host
	if err := query.Find(&hosts).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query hosts"})
		return
	}

	c.JSON(http.StatusOK, hosts)
}

func (h *HostHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var host db.Host
	if err := db.DB.Preload("Credential").First(&host, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Host not found"})
		return
	}
	c.JSON(http.StatusOK, host)
}

func (h *HostHandler) Create(c *gin.Context) {
	var req CreateOrUpdateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Port <= 0 {
		req.Port = 22
	} else if req.Port > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Port must be between 1 and 65535"})
		return
	}
	if req.Folder == "" {
		req.Folder = "General"
	}

	host := db.Host{
		ID:           uuid.New().String(),
		Name:         req.Name,
		Hostname:     req.Hostname,
		Port:         req.Port,
		Username:     req.Username,
		Folder:       req.Folder,
		Tags:         req.Tags,
		CredentialID: req.CredentialID,
		JumpHostID:   req.JumpHostID,
		Description:  req.Description,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := db.DB.Create(&host).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create host"})
		return
	}

	db.DB.Preload("Credential").First(&host, "id = ?", host.ID)
	c.JSON(http.StatusCreated, host)
}

func (h *HostHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var host db.Host
	if err := db.DB.First(&host, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Host not found"})
		return
	}

	var req CreateOrUpdateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Port <= 0 {
		req.Port = 22
	} else if req.Port > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Port must be between 1 and 65535"})
		return
	}
	if req.Folder == "" {
		req.Folder = "General"
	}

	if req.JumpHostID != "" && req.JumpHostID == id {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A host cannot use itself as a Jump Host"})
		return
	}

	host.Name = req.Name
	host.Hostname = req.Hostname
	host.Port = req.Port
	host.Username = req.Username
	host.Folder = req.Folder
	host.Tags = req.Tags
	host.CredentialID = req.CredentialID
	host.JumpHostID = req.JumpHostID
	host.Description = req.Description
	host.UpdatedAt = time.Now()

	if err := db.DB.Save(&host).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update host"})
		return
	}

	db.DB.Preload("Credential").First(&host, "id = ?", host.ID)
	c.JSON(http.StatusOK, host)
}

func (h *HostHandler) ResetFingerprint(c *gin.Context) {
	id := c.Param("id")
	var host db.Host
	if err := db.DB.First(&host, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Host not found"})
		return
	}

	if err := db.DB.Model(&host).Update("host_key_fingerprint", "").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset host key fingerprint"})
		return
	}
	host.HostKeyFingerprint = ""
	db.DB.Preload("Credential").First(&host, "id = ?", host.ID)
	c.JSON(http.StatusOK, host)
}

func (h *HostHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := db.DB.Delete(&db.Host{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete host"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Host deleted successfully"})
}

func (h *HostHandler) TestConnection(c *gin.Context) {
	id := c.Param("id")
	var host db.Host
	if err := db.DB.Preload("Credential").First(&host, "id = ?", id).Error; err != nil {
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

	if err := sshhub.TestConnection(info); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "SSH Connection tested successfully!",
	})
}

func (h *HostHandler) GetMetrics(c *gin.Context) {
	id := c.Param("id")
	var host db.Host
	if err := db.DB.Preload("Credential").First(&host, "id = ?", id).Error; err != nil {
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

	metrics, err := sshhub.CollectServerMetrics(info)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Failed to collect server metrics: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

type ImportSSHConfigRequest struct {
	Content             string `json:"content" binding:"required"`
	DefaultCredentialID string `json:"default_credential_id"`
	Folder              string `json:"folder"`
	DryRun              bool   `json:"dry_run"`
}

func (h *HostHandler) ImportSSHConfig(c *gin.Context) {
	var req ImportSSHConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	parsed, err := importer.ParseSSHConfig(strings.NewReader(req.Content))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse SSH config: " + err.Error()})
		return
	}

	if req.DryRun {
		c.JSON(http.StatusOK, gin.H{
			"count": len(parsed),
			"hosts": parsed,
		})
		return
	}

	folder := req.Folder
	if folder == "" {
		folder = "Imported"
	}

	// If no default credential ID provided, pick the first existing one if available
	credID := req.DefaultCredentialID
	if credID == "" {
		var firstCred db.Credential
		if err := db.DB.First(&firstCred).Error; err == nil {
			credID = firstCred.ID
		}
	}

	createdCount := 0
	var createdHosts []db.Host

	for _, p := range parsed {
		h := db.Host{
			ID:           uuid.New().String(),
			Name:         p.Name,
			Hostname:     p.Hostname,
			Port:         p.Port,
			Username:     p.Username,
			Folder:       folder,
			Tags:         "imported",
			CredentialID: credID,
			Description:  "Imported from ~/.ssh/config",
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		if err := db.DB.Create(&h).Error; err == nil {
			createdCount++
			createdHosts = append(createdHosts, h)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Imported successfully",
		"count":   createdCount,
		"hosts":   createdHosts,
	})
}
