package api

import (
	"os"
	"path/filepath"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/middleware"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// CORS Setup
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Handlers
	authHandler := NewAuthHandler(cfg)
	credHandler := NewCredentialHandler(cfg)
	hostHandler := NewHostHandler(cfg)
	termHandler := NewTerminalHandler(cfg)
	sftpHandler := NewSFTPHandler(cfg)
	sessHandler := NewSessionHandler(cfg)
	tunnHandler := NewTunnelHandler(cfg)

	// Public Auth routes
	api := r.Group("/api")
	{
		api.POST("/auth/login", authHandler.Login)
	}

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		// Auth
		protected.GET("/auth/me", authHandler.Me)

		// Credentials
		protected.GET("/credentials", credHandler.List)
		protected.POST("/credentials", credHandler.Create)
		protected.DELETE("/credentials/:id", credHandler.Delete)
		protected.POST("/credentials/generate-key", credHandler.GenerateKey)

		// Hosts
		protected.GET("/hosts", hostHandler.List)
		protected.POST("/hosts", hostHandler.Create)
		protected.POST("/hosts/import", hostHandler.ImportSSHConfig)
		protected.GET("/hosts/:id", hostHandler.Get)
		protected.PUT("/hosts/:id", hostHandler.Update)
		protected.DELETE("/hosts/:id", hostHandler.Delete)
		protected.POST("/hosts/:id/test", hostHandler.TestConnection)

		// Terminal WebSocket
		protected.GET("/ws/terminal/:host_id", termHandler.Connect)

		// SFTP
		protected.GET("/sftp/:host_id/list", sftpHandler.List)
		protected.GET("/sftp/:host_id/download", sftpHandler.Download)
		protected.POST("/sftp/:host_id/upload", sftpHandler.Upload)
		protected.POST("/sftp/:host_id/mkdir", sftpHandler.Mkdir)
		protected.DELETE("/sftp/:host_id/delete", sftpHandler.Delete)

		// Audit Sessions
		protected.GET("/audit/sessions", sessHandler.List)
		protected.GET("/audit/sessions/:id/recording", sessHandler.GetRecording)

		// Tunnels
		protected.GET("/tunnels", tunnHandler.List)
		protected.POST("/tunnels", tunnHandler.Create)
		protected.POST("/tunnels/:id/start", tunnHandler.Start)
		protected.POST("/tunnels/:id/stop", tunnHandler.Stop)
		protected.DELETE("/tunnels/:id", tunnHandler.Delete)
	}

	// Serve Static Frontend if exists
	webDist := filepath.Join("web", "dist")
	if stat, err := os.Stat(webDist); err == nil && stat.IsDir() {
		r.Static("/assets", filepath.Join(webDist, "assets"))
		r.NoRoute(func(c *gin.Context) {
			c.File(filepath.Join(webDist, "index.html"))
		})
	}

	return r
}
