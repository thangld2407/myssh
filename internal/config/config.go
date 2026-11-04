package config

import (
	"os"
)

type Config struct {
	Port          string
	DBPath        string
	JWTSecret     string
	MasterKey     string
	RecordingsDir string
	DataDir       string
}

func Load() *Config {
	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", "data/myssh.db")
	jwtSecret := getEnv("JWT_SECRET", "myssh-super-secret-jwt-key-2026")
	masterKey := getEnv("MASTER_KEY", "myssh-master-encryption-key-32b!")
	recordingsDir := getEnv("RECORDINGS_DIR", "data/recordings")
	dataDir := getEnv("DATA_DIR", "data")

	// Ensure directories exist
	_ = os.MkdirAll(dataDir, 0700)
	_ = os.MkdirAll(recordingsDir, 0700)

	return &Config{
		Port:          port,
		DBPath:        dbPath,
		JWTSecret:     jwtSecret,
		MasterKey:     masterKey,
		RecordingsDir: recordingsDir,
		DataDir:       dataDir,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
