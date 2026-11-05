package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/middleware"
	"github.com/myssh/myssh/web"
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
	snipHandler := NewSnippetHandler(cfg)

	// Public System & Auth routes
	api := r.Group("/api")
	{
		api.GET("/system/features", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"version":  "1.1.0",
				"features": cfg.Features,
				"rate_limit": gin.H{
					"enabled":        cfg.RateLimitEnabled,
					"max_attempts":   cfg.RateLimitMaxAttempts,
					"window_minutes": cfg.RateLimitWindowMinutes,
				},
			})
		})
		api.GET("/auth/setup-status", authHandler.SetupStatus)
		api.POST("/auth/setup", authHandler.Setup)
		api.POST("/auth/login", authHandler.Login)
	}

	featureGuard := func(enabled bool, name string) gin.HandlerFunc {
		return func(c *gin.Context) {
			if !enabled {
				c.AbortWithStatusJSON(403, gin.H{
					"error": "Tính năng '" + name + "' đã bị vô hiệu hóa trong cấu hình hệ thống (.env)",
				})
				return
			}
			c.Next()
		}
	}

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		// Auth & 2FA
		protected.GET("/auth/me", authHandler.Me)
		protected.POST("/auth/2fa/generate", authHandler.Generate2FA)
		protected.POST("/auth/2fa/enable", authHandler.Enable2FA)
		protected.POST("/auth/2fa/disable", authHandler.Disable2FA)

		// Credentials
		protected.GET("/credentials", credHandler.List)
		protected.POST("/credentials", credHandler.Create)
		protected.DELETE("/credentials/:id", credHandler.Delete)
		protected.POST("/credentials/generate-key", credHandler.GenerateKey)

		// Hosts
		protected.GET("/hosts", hostHandler.List)
		protected.POST("/hosts", hostHandler.Create)
		protected.POST("/hosts/import", featureGuard(cfg.Features.EnableImportSSHConfig, "Import SSH Config"), hostHandler.ImportSSHConfig)
		protected.GET("/hosts/:id", hostHandler.Get)
		protected.PUT("/hosts/:id", hostHandler.Update)
		protected.DELETE("/hosts/:id", hostHandler.Delete)
		protected.POST("/hosts/:id/test", hostHandler.TestConnection)
		protected.GET("/hosts/:id/metrics", hostHandler.GetMetrics)

		// Terminal WebSocket
		protected.GET("/ws/terminal/:host_id", termHandler.Connect)

		// SFTP
		sftp := protected.Group("/sftp", featureGuard(cfg.Features.EnableSFTP, "SFTP File Explorer"))
		{
			sftp.GET("/:host_id/list", sftpHandler.List)
			sftp.GET("/:host_id/read", sftpHandler.Read)
			sftp.POST("/:host_id/write", sftpHandler.Write)
			sftp.GET("/:host_id/download", sftpHandler.Download)
			sftp.POST("/:host_id/upload", sftpHandler.Upload)
			sftp.POST("/:host_id/mkdir", sftpHandler.Mkdir)
			sftp.DELETE("/:host_id/delete", sftpHandler.Delete)
		}

		// Snippets & Quick Commands
		snippets := protected.Group("/snippets", featureGuard(cfg.Features.EnableSnippets, "DevOps Snippets"))
		{
			snippets.GET("", snipHandler.List)
			snippets.POST("", snipHandler.Create)
			snippets.PUT("/:id", snipHandler.Update)
			snippets.DELETE("/:id", snipHandler.Delete)
		}

		// Audit Sessions
		audit := protected.Group("/audit", featureGuard(cfg.Features.EnableSessionAudit, "Session Audit Logs"))
		{
			audit.GET("/sessions", sessHandler.List)
			audit.GET("/sessions/:id/recording", sessHandler.GetRecording)
		}

		// Tunnels
		tunnels := protected.Group("/tunnels", featureGuard(cfg.Features.EnableTunnels, "Port Forwarding & Tunnels"))
		{
			tunnels.GET("", tunnHandler.List)
			tunnels.POST("", tunnHandler.Create)
			tunnels.POST("/:id/start", tunnHandler.Start)
			tunnels.POST("/:id/stop", tunnHandler.Stop)
			tunnels.DELETE("/:id", tunnHandler.Delete)
		}
	}

	// Serve Static Frontend:
	// Priority 1: Local web/dist folder on disk (useful for live dev or custom asset override)
	// Priority 2: Embedded filesystem inside single binary (self-contained release)
	webDist := filepath.Join("web", "dist")
	if stat, err := os.Stat(webDist); err == nil && stat.IsDir() {
		r.Static("/assets", filepath.Join(webDist, "assets"))
		r.NoRoute(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, "/api") {
				c.JSON(404, gin.H{"error": "API route not found"})
				return
			}
			c.File(filepath.Join(webDist, "index.html"))
		})
	} else if distFS, err := web.GetFS(); err == nil {
		fileServer := http.FileServer(distFS)
		r.NoRoute(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, "/api") {
				c.JSON(404, gin.H{"error": "API route not found"})
				return
			}
			reqPath := strings.TrimPrefix(c.Request.URL.Path, "/")
			if reqPath != "" {
				if f, err := distFS.Open(reqPath); err == nil {
					_ = f.Close()
					fileServer.ServeHTTP(c.Writer, c.Request)
					return
				}
			}
			c.Request.URL.Path = "/"
			fileServer.ServeHTTP(c.Writer, c.Request)
		})
	}

	return r
}
