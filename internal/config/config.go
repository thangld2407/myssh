package config

import (
	"bufio"
	"log"
	"os"
	"strconv"
	"strings"
)

type FeatureFlags struct {
	EnableSFTP            bool `json:"enable_sftp"`
	EnableMultiExec       bool `json:"enable_multi_exec"`
	EnableSessionAudit    bool `json:"enable_session_audit"`
	EnableTunnels         bool `json:"enable_tunnels"`
	EnableImportSSHConfig bool `json:"enable_import_ssh_config"`
	EnableSnippets        bool `json:"enable_snippets"`
	EnablePublicRoadmap   bool `json:"enable_public_roadmap"`
	EnableSponsor         bool `json:"enable_sponsor"`
}

type Config struct {
	Port                   string       `json:"port"`
	DBPath                 string       `json:"db_path"`
	JWTSecret              string       `json:"-"`
	MasterKey              string       `json:"-"`
	RecordingsDir          string       `json:"recordings_dir"`
	DataDir                string       `json:"data_dir"`
	RateLimitEnabled       bool         `json:"rate_limit_enabled"`
	RateLimitMaxAttempts   int          `json:"rate_limit_max_attempts"`
	RateLimitWindowMinutes int          `json:"rate_limit_window_minutes"`
	Features               FeatureFlags `json:"features"`
}

// Load reads .env if present and loads configuration from environment variables
func Load() *Config {
	loadDotEnv(".env")

	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", "data/myssh.db")
	jwtSecret := getEnv("JWT_SECRET", "myssh-super-secret-jwt-key-2026")
	masterKey := getEnv("MASTER_KEY", "myssh-master-encryption-key-32b!")
	recordingsDir := getEnv("RECORDINGS_DIR", "data/recordings")
	dataDir := getEnv("DATA_DIR", "data")

	rateLimitEnabled := getEnvBool("RATE_LIMIT_ENABLED", true)
	rateLimitMaxAttempts := getEnvInt("RATE_LIMIT_MAX_ATTEMPTS", 5)
	rateLimitWindowMinutes := getEnvInt("RATE_LIMIT_WINDOW_MINUTES", 5)

	features := FeatureFlags{
		EnableSFTP:            getEnvBool("FEATURE_SFTP", true),
		EnableMultiExec:       getEnvBool("FEATURE_MULTI_EXEC", true),
		EnableSessionAudit:    getEnvBool("FEATURE_SESSION_AUDIT", true),
		EnableTunnels:         getEnvBool("FEATURE_TUNNELS", true),
		EnableImportSSHConfig: getEnvBool("FEATURE_IMPORT_SSH_CONFIG", true),
		EnableSnippets:        getEnvBool("FEATURE_SNIPPETS", true),
		EnablePublicRoadmap:   getEnvBool("FEATURE_PUBLIC_ROADMAP", true),
		EnableSponsor:         getEnvBool("FEATURE_SPONSOR", true),
	}

	// Ensure directories exist
	_ = os.MkdirAll(dataDir, 0700)
	if features.EnableSessionAudit {
		_ = os.MkdirAll(recordingsDir, 0700)
	}

	return &Config{
		Port:                   port,
		DBPath:                 dbPath,
		JWTSecret:              jwtSecret,
		MasterKey:              masterKey,
		RecordingsDir:          recordingsDir,
		DataDir:                dataDir,
		RateLimitEnabled:       rateLimitEnabled,
		RateLimitMaxAttempts:   rateLimitMaxAttempts,
		RateLimitWindowMinutes: rateLimitWindowMinutes,
		Features:               features,
	}
}

// loadDotEnv parses a standard key=value .env file without external dependencies
func loadDotEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return // File does not exist, fallback to system env
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	loadedCount := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// Strip surrounding single or double quotes
		if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
			val = val[1 : len(val)-1]
		}

		// Only set if not already set in OS environment (container / CI/CD precedence)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, val)
			loadedCount++
		}
	}
	if loadedCount > 0 {
		log.Printf("[Config] Loaded %d configuration variables from %s\n", loadedCount, filepath)
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	val = strings.ToLower(strings.TrimSpace(val))
	return val == "true" || val == "1" || val == "yes" || val == "on" || val == "enable" || val == "enabled"
}

func getEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(strings.TrimSpace(val))
	if err != nil {
		return defaultVal
	}
	return n
}
