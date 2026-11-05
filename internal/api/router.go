package api

import (
	"fmt"
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
	r := gin.New()
	r.MaxMultipartMemory = 8 << 20 // 8MB in-memory buffer for multipart uploads
	r.Use(gin.Recovery())

	// Custom access logger: strictly strips raw query strings from logs (redacting tokens, tickets, paths)
	r.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: func(param gin.LogFormatterParams) string {
			path := param.Path
			if idx := strings.Index(path, "?"); idx != -1 {
				path = path[:idx]
			}
			var statusColor, methodColor, resetColor string
			if param.IsOutputColor() {
				statusColor = param.StatusCodeColor()
				methodColor = param.MethodColor()
				resetColor = param.ResetColor()
			}
			return fmt.Sprintf("[GIN] %v |%s %3d %s| %13v | %15s |%s %-7s %s %#v\n%s",
				param.TimeStamp.Format("2006/01/02 - 15:04:05"),
				statusColor, param.StatusCode, resetColor,
				param.Latency,
				param.ClientIP,
				methodColor, param.Method, resetColor,
				path,
				param.ErrorMessage,
			)
		},
	}))

	// Trusted Proxies: default nil (trust no reverse proxies / ignore spoofed X-Forwarded-For)
	// unless explicitly configured via TRUSTED_PROXIES
	if cfg != nil && len(cfg.TrustedProxies) > 0 {
		_ = r.SetTrustedProxies(cfg.TrustedProxies)
	} else {
		_ = r.SetTrustedProxies(nil)
	}

	// CORS Setup
	corsConfig := cors.Config{
		AllowMethods:  []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders: []string{"Content-Length", "Content-Disposition"},
		MaxAge:        12 * time.Hour,
	}

	if cfg != nil && len(cfg.AllowedOrigins) > 0 {
		corsConfig.AllowOrigins = cfg.AllowedOrigins
	} else {
		corsConfig.AllowOriginFunc = func(origin string) bool {
			if origin == "" ||
				strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:") ||
				strings.HasPrefix(origin, "https://localhost:") ||
				strings.HasPrefix(origin, "https://127.0.0.1:") {
				return true
			}
			return false
		}
	}
	r.Use(cors.New(corsConfig))

	// Handlers
	authHandler := NewAuthHandler(cfg)
	credHandler := NewCredentialHandler(cfg)
	hostHandler := NewHostHandler(cfg)
	termHandler := NewTerminalHandler(cfg)
	sftpHandler := NewSFTPHandler(cfg)
	sessHandler := NewSessionHandler(cfg)
	tunnHandler := NewTunnelHandler(cfg)
	snipHandler := NewSnippetHandler(cfg)
	k8sHandler := NewK8sHandler(cfg)
	auditHandler := NewAuditHandler(cfg)

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
					"error_code": "FEATURE_DISABLED",
					"error":      fmt.Sprintf("Feature '%s' has been disabled in system configuration (.env)", name),
				})
				return
			}
			c.Next()
		}
	}

	// Protected routes
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	protected.Use(middleware.AuditMiddleware())
	{
		// Auth & 2FA
		protected.GET("/auth/me", authHandler.Me)
		protected.POST("/auth/logout", authHandler.Logout)
		protected.POST("/auth/ws-ticket", authHandler.CreateWSTicket)
		protected.POST("/auth/2fa/generate", authHandler.Generate2FA)
		protected.POST("/auth/2fa/enable", authHandler.Enable2FA)
		protected.POST("/auth/2fa/disable", authHandler.Disable2FA)

		// Credentials
		protected.GET("/credentials", middleware.RequireRole("admin", "member", "viewer"), credHandler.List)
		protected.POST("/credentials", middleware.RequireRole("admin"), credHandler.Create)
		protected.DELETE("/credentials/:id", middleware.RequireRole("admin"), credHandler.Delete)
		protected.POST("/credentials/generate-key", middleware.RequireRole("admin"), credHandler.GenerateKey)

		// Hosts
		protected.GET("/hosts", middleware.RequireRole("admin", "member", "viewer"), hostHandler.List)
		protected.POST("/hosts", middleware.RequireRole("admin"), hostHandler.Create)
		protected.POST("/hosts/import", middleware.RequireRole("admin"), featureGuard(cfg.Features.EnableImportSSHConfig, "Import SSH Config"), hostHandler.ImportSSHConfig)
		protected.GET("/hosts/:id", middleware.RequireRole("admin", "member", "viewer"), hostHandler.Get)
		protected.PUT("/hosts/:id", middleware.RequireRole("admin"), hostHandler.Update)
		protected.DELETE("/hosts/:id", middleware.RequireRole("admin"), hostHandler.Delete)
		protected.POST("/hosts/:id/test", middleware.RequireRole("admin", "member"), hostHandler.TestConnection)
		protected.POST("/hosts/:id/reset-fingerprint", middleware.RequireRole("admin"), hostHandler.ResetFingerprint)
		protected.GET("/hosts/:id/metrics", middleware.RequireRole("admin", "member", "viewer"), hostHandler.GetMetrics)

		// Terminal WebSocket
		protected.GET("/ws/terminal/:host_id", middleware.RequireRole("admin", "member"), termHandler.Connect)

		// SFTP
		sftp := protected.Group("/sftp", featureGuard(cfg.Features.EnableSFTP, "SFTP File Explorer"))
		{
			sftp.GET("/:host_id/list", middleware.RequireRole("admin", "member"), sftpHandler.List)
			sftp.GET("/:host_id/read", middleware.RequireRole("admin", "member"), sftpHandler.Read)
			sftp.POST("/:host_id/write", middleware.RequireRole("admin", "member"), sftpHandler.Write)
			sftp.GET("/:host_id/download", middleware.RequireRole("admin", "member"), sftpHandler.Download)
			sftp.POST("/:host_id/upload", middleware.RequireRole("admin", "member"), sftpHandler.Upload)
			sftp.POST("/:host_id/mkdir", middleware.RequireRole("admin", "member"), sftpHandler.Mkdir)
			sftp.DELETE("/:host_id/delete", middleware.RequireRole("admin", "member"), sftpHandler.Delete)
		}

		// Snippets & Quick Commands
		snippets := protected.Group("/snippets", featureGuard(cfg.Features.EnableSnippets, "DevOps Snippets"))
		{
			snippets.GET("", middleware.RequireRole("admin", "member", "viewer"), snipHandler.List)
			snippets.POST("", middleware.RequireRole("admin", "member"), snipHandler.Create)
			snippets.PUT("/:id", middleware.RequireRole("admin", "member"), snipHandler.Update)
			snippets.DELETE("/:id", middleware.RequireRole("admin", "member"), snipHandler.Delete)
		}

		// Audit Sessions
		audit := protected.Group("/audit", featureGuard(cfg.Features.EnableSessionAudit, "Session Audit Logs"))
		{
			audit.GET("/sessions", middleware.RequireRole("admin", "member", "viewer"), sessHandler.List)
			audit.GET("/sessions/:id/recording", middleware.RequireRole("admin", "member", "viewer"), sessHandler.GetRecording)
			audit.GET("/logs", middleware.RequireRole("admin"), auditHandler.ListLogs)
		}

		// Tunnels
		tunnels := protected.Group("/tunnels", featureGuard(cfg.Features.EnableTunnels, "Port Forwarding & Tunnels"))
		{
			tunnels.GET("", middleware.RequireRole("admin", "member"), tunnHandler.List)
			tunnels.POST("", middleware.RequireRole("admin"), tunnHandler.Create)
			tunnels.POST("/:id/start", middleware.RequireRole("admin"), tunnHandler.Start)
			tunnels.POST("/:id/stop", middleware.RequireRole("admin"), tunnHandler.Stop)
			tunnels.DELETE("/:id", middleware.RequireRole("admin"), tunnHandler.Delete)
		}

		// Kubernetes Hub
		k8s := protected.Group("/k8s", featureGuard(cfg.Features.EnableK8s, "Kubernetes Manager"))
		{
			k8s.GET("/clusters", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListClusters)
			k8s.POST("/clusters", middleware.RequireRole("admin"), k8sHandler.CreateCluster)
			k8s.POST("/clusters/test", middleware.RequireRole("admin"), k8sHandler.TestCluster)
			k8s.GET("/clusters/:id", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.GetCluster)
			k8s.PUT("/clusters/:id", middleware.RequireRole("admin"), k8sHandler.UpdateCluster)
			k8s.DELETE("/clusters/:id", middleware.RequireRole("admin"), k8sHandler.DeleteCluster)

			// Resources
			k8s.GET("/clusters/:id/namespaces", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListNamespaces)
			k8s.GET("/clusters/:id/nodes", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListNodes)
			k8s.GET("/clusters/:id/pods", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListPods)
			k8s.GET("/clusters/:id/deployments", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListDeployments)
			k8s.GET("/clusters/:id/services", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListServices)
			k8s.GET("/clusters/:id/yaml", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.GetYAML)
			k8s.PUT("/clusters/:id/yaml", middleware.RequireRole("admin"), k8sHandler.ApplyYAML)
			k8s.DELETE("/clusters/:id/resource", middleware.RequireRole("admin"), k8sHandler.DeleteResource)

			// Pod logs & exec
			k8s.GET("/clusters/:id/pods/:name/logs", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.GetPodLogs)
			k8s.GET("/clusters/:id/pods/:name/exec", middleware.RequireRole("admin", "member"), k8sHandler.PodExec)

			// Port forwarding
			k8s.GET("/portforwards", middleware.RequireRole("admin", "member", "viewer"), k8sHandler.ListPortForwards)
			k8s.POST("/portforwards", middleware.RequireRole("admin"), k8sHandler.CreatePortForward)
			k8s.POST("/portforwards/:id/start", middleware.RequireRole("admin"), k8sHandler.StartPortForward)
			k8s.POST("/portforwards/:id/stop", middleware.RequireRole("admin"), k8sHandler.StopPortForward)
			k8s.DELETE("/portforwards/:id", middleware.RequireRole("admin"), k8sHandler.DeletePortForward)
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
