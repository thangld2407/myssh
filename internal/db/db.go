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
		&Snippet{},
		&KubeCluster{},
		&KubePortForward{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	// Seed default snippets if table is empty
	var snippetCount int64
	DB.Model(&Snippet{}).Count(&snippetCount)
	if snippetCount == 0 {
		seedDefaultSnippets(DB)
	}

	// Check if admin user exists; if empty, system requires First-Run Setup Wizard via Web UI
	var userCount int64
	DB.Model(&User{}).Count(&userCount)
	if userCount == 0 {
		log.Println("[DB] No users found. System is ready for First-Run Setup Wizard via Web UI.")
	}

	return DB, nil
}

func seedDefaultSnippets(database *gorm.DB) {
	defaultSnippets := []Snippet{
		{
			ID:          "snip-docker-logs",
			Name:        "Docker Follow Container Logs",
			Command:     "docker logs -f --tail {{LINES}} {{CONTAINER_ID}}",
			Description: "Theo dõi log thời gian thực của container với số dòng chỉ định",
			Category:    "Docker",
			Tags:        "docker,logs,container",
		},
		{
			ID:          "snip-docker-prune",
			Name:        "Docker Complete System Prune",
			Command:     "docker system prune -af --volumes",
			Description: "Dọn dẹp triệt để containers, images và volumes không dùng",
			Category:    "Docker",
			Tags:        "docker,cleanup,disk",
		},
		{
			ID:          "snip-open-ports",
			Name:        "Check Listening Ports",
			Command:     "ss -tulpn | grep LISTEN",
			Description: "Liệt kê tất cả các port đang mở và tiến trình tương ứng",
			Category:    "Network",
			Tags:        "network,ports,security",
		},
		{
			ID:          "snip-disk-usage",
			Name:        "Find Top 20 Largest Files/Dirs",
			Command:     "du -ahx / 2>/dev/null | sort -rh | head -n 20",
			Description: "Tìm 20 tệp và thư mục chiếm nhiều dung lượng nhất trên phân vùng root",
			Category:    "System",
			Tags:        "disk,storage,troubleshoot",
		},
		{
			ID:          "snip-nginx-reload",
			Name:        "Nginx Test & Safe Reload",
			Command:     "sudo nginx -t && sudo systemctl reload nginx",
			Description: "Kiểm tra cú pháp cấu hình Nginx trước khi nạp lại dịch vụ an toàn",
			Category:    "Nginx",
			Tags:        "nginx,web,reload",
		},
		{
			ID:          "snip-service-status",
			Name:        "Systemd Service Status",
			Command:     "systemctl status {{SERVICE_NAME}} --no-pager",
			Description: "Xem trạng thái chi tiết của một systemd service",
			Category:    "System",
			Tags:        "systemd,service,linux",
		},
	}

	for _, s := range defaultSnippets {
		_ = database.Create(&s).Error
	}
	log.Println("[DB] Seeded 6 DevOps default snippets successfully.")
}
