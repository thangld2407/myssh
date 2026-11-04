package db

import (
	"fmt"
	"log"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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

	// Seed default admin if table is empty
	var userCount int64
	DB.Model(&User{}).Count(&userCount)
	if userCount == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash default admin password: %w", err)
		}

		admin := User{
			ID:           uuid.New().String(),
			Username:     "admin",
			PasswordHash: string(hash),
			FullName:     "Administrator",
			Role:         "admin",
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		if err := DB.Create(&admin).Error; err != nil {
			return nil, fmt.Errorf("failed to seed admin user: %w", err)
		}
		log.Println("[DB] Initialized with default admin account: admin / admin123")
	}

	return DB, nil
}
