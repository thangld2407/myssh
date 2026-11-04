package api

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/sshhub"
)

type SFTPHandler struct {
	cfg *config.Config
}

func NewSFTPHandler(cfg *config.Config) *SFTPHandler {
	return &SFTPHandler{cfg: cfg}
}

func (h *SFTPHandler) getBridge(c *gin.Context, hostID string) (*sshhub.SFTPBridge, error) {
	var host db.Host
	if err := db.DB.Preload("Credential").First(&host, "id = ?", hostID).Error; err != nil {
		return nil, fmt.Errorf("host not found")
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

	return sshhub.OpenSFTP(info)
}

func (h *SFTPHandler) List(c *gin.Context) {
	hostID := c.Param("host_id")
	path := c.DefaultQuery("path", ".")

	bridge, err := h.getBridge(c, hostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer bridge.Close()

	items, err := bridge.ListDir(path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"path":  path,
		"items": items,
	})
}

func (h *SFTPHandler) Download(c *gin.Context) {
	hostID := c.Param("host_id")
	remotePath := c.Query("path")
	if remotePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path query parameter is required"})
		return
	}

	bridge, err := h.getBridge(c, hostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer bridge.Close()

	reader, size, err := bridge.DownloadFile(remotePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer reader.Close()

	filename := filepath.Base(remotePath)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Header("Content-Length", fmt.Sprintf("%d", size))
	c.Header("Content-Type", "application/octet-stream")

	_, _ = io.Copy(c.Writer, reader)
}

func (h *SFTPHandler) Upload(c *gin.Context) {
	hostID := c.Param("host_id")
	targetDir := c.DefaultQuery("path", ".")

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file field required in form-data"})
		return
	}

	srcFile, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read uploaded file"})
		return
	}
	defer srcFile.Close()

	bridge, err := h.getBridge(c, hostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer bridge.Close()

	cleanFilename := filepath.Base(fileHeader.Filename)
	remotePath := filepath.Join(targetDir, cleanFilename)
	if err := bridge.UploadFile(remotePath, srcFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "File uploaded successfully",
		"path":    remotePath,
	})
}

func (h *SFTPHandler) Mkdir(c *gin.Context) {
	hostID := c.Param("host_id")
	var req struct {
		Path string `json:"path" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	bridge, err := h.getBridge(c, hostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer bridge.Close()

	if err := bridge.Mkdir(req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Directory created successfully"})
}

func (h *SFTPHandler) Delete(c *gin.Context) {
	hostID := c.Param("host_id")
	remotePath := c.Query("path")
	if remotePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path query parameter is required"})
		return
	}

	bridge, err := h.getBridge(c, hostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer bridge.Close()

	if err := bridge.Remove(remotePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Item deleted successfully"})
}
