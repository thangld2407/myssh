package main

import (
	"fmt"
	"log"

	"github.com/myssh/myssh/internal/api"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

func main() {
	log.Println("==================================================")
	log.Println("🚀 Starting MySSH - Web Bastion & Access Gateway")
	log.Println("==================================================")

	// 1. Load Configuration
	cfg := config.Load()
	log.Printf("[Config] Port: %s | DB: %s | Data: %s\n", cfg.Port, cfg.DBPath, cfg.DataDir)

	// 2. Initialize Database & Seed Default Admin
	_, err := db.Init(cfg.DBPath)
	if err != nil {
		log.Fatalf("[DB] Initialization error: %v", err)
	}

	// 3. Setup Router & Routes
	r := api.SetupRouter(cfg)

	// 4. Start HTTP Server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("✨ MySSH is listening on http://localhost%s\n", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[Server] Failed to run: %v", err)
	}
}
