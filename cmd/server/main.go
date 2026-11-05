package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/myssh/myssh/internal/api"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/k8shub"
	"github.com/myssh/myssh/internal/sshhub"
)

func main() {
	log.Println("==================================================")
	log.Println("🚀 Starting MySSH - Web Bastion & Access Gateway")
	log.Println("==================================================")

	// 1. Load Configuration
	cfg := config.Load()
	if err := cfg.EnsureDirs(); err != nil {
		log.Fatalf("[Config] Failed to initialize storage directories: %v", err)
	}
	log.Printf("[Config] Port: %s | DB: %s | Data: %s\n", cfg.Port, cfg.DBPath, cfg.DataDir)

	// 2. Initialize Database & Seed Default Admin & Reconcile Boot State
	_, err := db.Init(cfg.DBPath)
	if err != nil {
		log.Fatalf("[DB] Initialization error: %v", err)
	}

	// 3. Setup Router & Routes
	r := api.SetupRouter(cfg)

	// 4. Configure HTTP Server with Safe Timeouts (ReadHeaderTimeout & IdleTimeout)
	// (Note: Do NOT set global ReadTimeout/WriteTimeout as they would terminate long-running WebSockets)
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// 5. Setup Signal Handling for Graceful Shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Start session recording retention reaper if audit enabled
	if cfg.Features.EnableSessionAudit {
		sshhub.StartRecordingReaper(cfg.RecordingsDir, cfg.RecordingRetentionDays, ctx.Done())
	}

	// 6. Start HTTP Server in background goroutine
	go func() {
		log.Printf("✨ MySSH is listening on http://localhost%s\n", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[Server] Listen error: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-ctx.Done()
	log.Println("🛑 Shutdown signal received. Initiating graceful shutdown...")

	// 7. Stop all active SSH tunnels and Kubernetes port-forwards, and close connection pool
	sshhub.Hub.StopAll()
	k8shub.GlobalPFManager.StopAll()
	sshhub.GlobalPool.CloseAll()

	// 8. Reconcile database state: mark all active/connecting sessions as closed
	db.ReconcileState(db.DB)

	// 9. Shutdown HTTP server with 10-second timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Server] Graceful shutdown error: %v\n", err)
	} else {
		log.Println("✅ MySSH server gracefully stopped.")
	}
}
