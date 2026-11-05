package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

type SnippetHandler struct {
	cfg *config.Config
}

func NewSnippetHandler(cfg *config.Config) *SnippetHandler {
	return &SnippetHandler{cfg: cfg}
}

func generateSnippetID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (h *SnippetHandler) List(c *gin.Context) {
	category := c.Query("category")
	tag := c.Query("tag")
	search := strings.TrimSpace(c.Query("q"))

	query := db.DB.Model(&db.Snippet{})

	if category != "" && category != "all" {
		query = query.Where("category = ?", category)
	}

	if tag != "" {
		query = query.Where("tags LIKE ?", "%"+tag+"%")
	}

	if search != "" {
		searchTerm := "%" + search + "%"
		query = query.Where("name LIKE ? OR command LIKE ? OR description LIKE ? OR tags LIKE ?",
			searchTerm, searchTerm, searchTerm, searchTerm)
	}

	var snippets []db.Snippet
	if err := query.Order("updated_at DESC").Find(&snippets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch snippets: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, snippets)
}

func (h *SnippetHandler) Create(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Command     string `json:"command" binding:"required"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Tags        string `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	userIDStr, _ := userID.(string)

	cat := strings.TrimSpace(req.Category)
	if cat == "" {
		cat = "General"
	}

	snippet := db.Snippet{
		ID:          "snip-" + generateSnippetID(),
		UserID:      userIDStr,
		Name:        strings.TrimSpace(req.Name),
		Command:     strings.TrimSpace(req.Command),
		Description: strings.TrimSpace(req.Description),
		Category:    cat,
		Tags:        strings.TrimSpace(req.Tags),
	}

	if err := db.DB.Create(&snippet).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create snippet: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, snippet)
}

func (h *SnippetHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var snippet db.Snippet
	if err := db.DB.First(&snippet, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Snippet not found"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Command     string `json:"command"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Tags        string `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		snippet.Name = strings.TrimSpace(req.Name)
	}
	if req.Command != "" {
		snippet.Command = strings.TrimSpace(req.Command)
	}
	snippet.Description = strings.TrimSpace(req.Description)
	if req.Category != "" {
		snippet.Category = strings.TrimSpace(req.Category)
	}
	snippet.Tags = strings.TrimSpace(req.Tags)

	if err := db.DB.Save(&snippet).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update snippet: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, snippet)
}

func (h *SnippetHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var snippet db.Snippet
	if err := db.DB.First(&snippet, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Snippet not found"})
		return
	}

	if err := db.DB.Delete(&snippet).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete snippet: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Snippet deleted successfully"})
}
