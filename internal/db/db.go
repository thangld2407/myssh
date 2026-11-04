package db

import (
	"fmt"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dbPath string) (*gorm.DB, error) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	// Auto-migrate tables
	err = DB.AutoMigrate(
		&User{},
		&Credential{},
		&Host{},
		&Session{},
		&Tunnel{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	// Check if admin user exists; if empty, system requires First-Run Setup Wizard via Web UI
	var userCount int64
	DB.Model(&User{}).Count(&userCount)
	if userCount == 0 {
		log.Println("[DB] No users found. System is ready for First-Run Setup Wizard via Web UI.")
	}

	return DB, nil
}
