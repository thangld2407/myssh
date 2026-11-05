package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/sshhub"
)

type CredentialHandler struct {
	cfg *config.Config
}

func NewCredentialHandler(cfg *config.Config) *CredentialHandler {
	return &CredentialHandler{cfg: cfg}
}

type CreateCredentialRequest struct {
	Name       string `json:"name" binding:"required"`
	Type       string `json:"type" binding:"required"` // "password" or "private_key"
	Secret     string `json:"secret" binding:"required"`
	Passphrase string `json:"passphrase"`
	PublicKey  string `json:"public_key"`
}

func (h *CredentialHandler) List(c *gin.Context) {
	var creds []db.Credential
	if err := db.DB.Order("created_at desc").Find(&creds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query credentials"})
		return
	}
	c.JSON(http.StatusOK, creds)
}

func (h *CredentialHandler) Create(c *gin.Context) {
	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	encData, nonce, err := crypto.Encrypt([]byte(req.Secret), h.cfg.MasterKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Encryption failed"})
		return
	}

	var encPassphrase, passNonce string
	if req.Passphrase != "" {
		encPassphrase, passNonce, err = crypto.Encrypt([]byte(req.Passphrase), h.cfg.MasterKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Passphrase encryption failed"})
			return
		}
	}

	cred := db.Credential{
		ID:                  uuid.New().String(),
		Name:                req.Name,
		Type:                req.Type,
		EncryptedData:       encData,
		Nonce:               nonce,
		EncryptedPassphrase: encPassphrase,
		PassphraseNonce:     passNonce,
		PublicKey:           req.PublicKey,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	if err := db.DB.Create(&cred).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save credential"})
		return
	}

	c.JSON(http.StatusCreated, cred)
}

type UpdateCredentialRequest struct {
	Name       string `json:"name" binding:"required"`
	Secret     string `json:"secret"` // Optional: if empty, secret remains unchanged
	Passphrase string `json:"passphrase"`
	PublicKey  string `json:"public_key"`
}

func (h *CredentialHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var cred db.Credential
	if err := db.DB.First(&cred, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
		return
	}

	var req UpdateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cred.Name = req.Name
	if req.PublicKey != "" {
		cred.PublicKey = req.PublicKey
	}

	// Re-encrypt updated secret if provided
	if req.Secret != "" {
		encData, nonce, err := crypto.Encrypt([]byte(req.Secret), h.cfg.MasterKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Encryption failed"})
			return
		}
		cred.EncryptedData = encData
		cred.Nonce = nonce
	}

	// Re-encrypt updated passphrase if provided
	if req.Passphrase != "" {
		encPassphrase, passNonce, err := crypto.Encrypt([]byte(req.Passphrase), h.cfg.MasterKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Passphrase encryption failed"})
			return
		}
		cred.EncryptedPassphrase = encPassphrase
		cred.PassphraseNonce = passNonce
	}

	cred.UpdatedAt = time.Now()
	if err := db.DB.Save(&cred).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update credential"})
		return
	}

	// Invalidate cached connections across the pool
	sshhub.GlobalPool.InvalidateAll()

	c.JSON(http.StatusOK, cred)
}

func (h *CredentialHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	// Check if any host is using this credential
	var hostCount int64
	db.DB.Model(&db.Host{}).Where("credential_id = ?", id).Count(&hostCount)
	if hostCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete credential because it is used by one or more hosts"})
		return
	}

	if err := db.DB.Delete(&db.Credential{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete credential"})
		return
	}

	sshhub.GlobalPool.InvalidateAll()

	c.JSON(http.StatusOK, gin.H{"message": "Credential deleted successfully"})
}

func (h *CredentialHandler) GenerateKey(c *gin.Context) {
	comment := c.DefaultQuery("comment", "myssh-key")
	pubKey, privKey, err := crypto.GenerateEd25519KeyPair(comment)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate key pair: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"public_key":  pubKey,
		"private_key": privKey,
		"type":        "ed25519",
	})
}
