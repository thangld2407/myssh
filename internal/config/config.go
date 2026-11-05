package config

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/myssh/myssh/internal/crypto"
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
	EnableK8s             bool `json:"enable_k8s"`
	EnableStrictHostKey   bool `json:"strict_host_key"`
	EnableTunnelPublicBind bool `json:"enable_tunnel_public_bind"`
}

type Config struct {
	Port                   string       `json:"port"`
	DBPath                 string       `json:"db_path"`
	JWTSecret              string       `json:"-"`
	MasterKey              string       `json:"-"`
	KDFSalt                []byte       `json:"-"`
	RecordingsDir          string       `json:"recordings_dir"`
	DataDir                string       `json:"data_dir"`
	RateLimitEnabled       bool         `json:"rate_limit_enabled"`
	RateLimitMaxAttempts   int          `json:"rate_limit_max_attempts"`
	RateLimitWindowMinutes int          `json:"rate_limit_window_minutes"`
	TrustedProxies         []string     `json:"trusted_proxies,omitempty"`
	Features               FeatureFlags `json:"features"`
}

// EnsureDirs ensures that necessary runtime storage directories exist.
func (c *Config) EnsureDirs() error {
	if err := os.MkdirAll(c.DataDir, 0700); err != nil {
		return err
	}
	if c.Features.EnableSessionAudit {
		if err := os.MkdirAll(c.RecordingsDir, 0700); err != nil {
			return err
		}
	}
	return nil
}

// isSampleOrInsecureKey checks if a given secret is empty, a placeholder, or a known sample key.
func isSampleOrInsecureKey(val string) bool {
	v := strings.TrimSpace(val)
	if v == "" {
		return true
	}
	samples := []string{
		"myssh-super-secret-jwt-key-2026",
		"myssh-super-secret-jwt-key-change-me-in-production-2026",
		"myssh-master-encryption-key-32b!",
		"myssh-master-encryption-key-32b-change-me!",
	}
	for _, s := range samples {
		if v == s {
			return true
		}
	}
	if strings.Contains(v, "__CHANGE_ME__") || strings.Contains(strings.ToLower(v), "change-me") {
		return true
	}
	return false
}

// generateSecureRandomHex generates cryptographically secure random bytes and returns them as a hex string.
func generateSecureRandomHex(n int) string {
	b := make([]byte, n)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		log.Fatalf("[Config] Failed to generate cryptographically secure random bytes: %v", err)
	}
	return hex.EncodeToString(b)
}

// loadSecretsFile reads key-value pairs from a .secrets file.
func loadSecretsFile(filePath string) map[string]string {
	secrets := make(map[string]string)
	file, err := os.Open(filePath)
	if err != nil {
		return secrets
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			if len(v) >= 2 && ((v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'')) {
				v = v[1 : len(v)-1]
			}
			secrets[k] = v
		}
	}
	return secrets
}

// Load reads .env if present and loads configuration from environment variables.
// If JWT_SECRET or MASTER_KEY are unset or sample values, it auto-generates secure keys
// and persists them in data/.secrets (mode 0600).
func Load() *Config {
	loadDotEnv(".env")

	port := getEnv("PORT", "8080")
	dbPath := getEnv("DB_PATH", "data/myssh.db")
	recordingsDir := getEnv("RECORDINGS_DIR", "data/recordings")
	dataDir := getEnv("DATA_DIR", "data")

	rateLimitEnabled := getEnvBool("RATE_LIMIT_ENABLED", true)
	rateLimitMaxAttempts := getEnvInt("RATE_LIMIT_MAX_ATTEMPTS", 5)
	rateLimitWindowMinutes := getEnvInt("RATE_LIMIT_WINDOW_MINUTES", 5)

	rawTrustedProxies := os.Getenv("TRUSTED_PROXIES")
	var trustedProxies []string
	if rawTrustedProxies != "" {
		for _, p := range strings.Split(rawTrustedProxies, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				trustedProxies = append(trustedProxies, p)
			}
		}
	}

	features := FeatureFlags{
		EnableSFTP:            getEnvBool("FEATURE_SFTP", true),
		EnableMultiExec:       getEnvBool("FEATURE_MULTI_EXEC", true),
		EnableSessionAudit:    getEnvBool("FEATURE_SESSION_AUDIT", true),
		EnableTunnels:         getEnvBool("FEATURE_TUNNELS", true),
		EnableImportSSHConfig: getEnvBool("FEATURE_IMPORT_SSH_CONFIG", true),
		EnableSnippets:        getEnvBool("FEATURE_SNIPPETS", true),
		EnablePublicRoadmap:   getEnvBool("FEATURE_PUBLIC_ROADMAP", false),
		EnableSponsor:         getEnvBool("FEATURE_SPONSOR", true),
		EnableK8s:             getEnvBool("FEATURE_K8S", true),
		EnableStrictHostKey:   getEnvBool("FEATURE_STRICT_HOST_KEY", true),
		EnableTunnelPublicBind: getEnvBool("FEATURE_TUNNEL_PUBLIC_BIND", false),
	}

	// Resolve secrets (JWT_SECRET, MASTER_KEY, KDF_SALT)
	secretsPath := filepath.Join(dataDir, ".secrets")
	persistedSecrets := loadSecretsFile(secretsPath)
	secretsDirty := false

	// 1. JWT_SECRET
	rawJWT := os.Getenv("JWT_SECRET")
	var jwtSecret string
	if rawJWT != "" && !isSampleOrInsecureKey(rawJWT) {
		jwtSecret = rawJWT
	} else {
		if rawJWT != "" && isSampleOrInsecureKey(rawJWT) {
			log.Printf("[Config] WARNING: JWT_SECRET matches an insecure default or placeholder ('%s'). Auto-generating or loading persisted secret.\n", rawJWT)
		}
		if s, ok := persistedSecrets["JWT_SECRET"]; ok && s != "" && !isSampleOrInsecureKey(s) {
			jwtSecret = s
		} else {
			jwtSecret = generateSecureRandomHex(32)
			persistedSecrets["JWT_SECRET"] = jwtSecret
			secretsDirty = true
			log.Println("[Config] Generated new random 32-byte JWT_SECRET.")
		}
	}

	// 2. MASTER_KEY
	rawMaster := os.Getenv("MASTER_KEY")
	var masterKey string
	if rawMaster != "" && !isSampleOrInsecureKey(rawMaster) {
		masterKey = rawMaster
	} else {
		if rawMaster != "" && isSampleOrInsecureKey(rawMaster) {
			log.Printf("[Config] WARNING: MASTER_KEY matches an insecure default or placeholder ('%s'). Auto-generating or loading persisted secret.\n", rawMaster)
		}
		if s, ok := persistedSecrets["MASTER_KEY"]; ok && s != "" && !isSampleOrInsecureKey(s) {
			masterKey = s
		} else {
			masterKey = generateSecureRandomHex(32)
			persistedSecrets["MASTER_KEY"] = masterKey
			secretsDirty = true
			log.Println("[Config] Generated new random 32-byte MASTER_KEY.")
		}
	}

	// 3. KDF_SALT
	rawSalt := os.Getenv("KDF_SALT")
	var kdfSaltHex string
	if rawSalt != "" {
		kdfSaltHex = rawSalt
	} else if s, ok := persistedSecrets["KDF_SALT"]; ok && s != "" {
		kdfSaltHex = s
	} else {
		kdfSaltHex = generateSecureRandomHex(16)
		persistedSecrets["KDF_SALT"] = kdfSaltHex
		secretsDirty = true
		log.Println("[Config] Generated new per-install random 16-byte KDF_SALT.")
	}

	var kdfSaltBytes []byte
	if decoded, err := hex.DecodeString(kdfSaltHex); err == nil && len(decoded) > 0 {
		kdfSaltBytes = decoded
	} else {
		kdfSaltBytes = []byte(kdfSaltHex)
	}

	// If any secret was generated or needs persistence, write to data/.secrets (mode 0600)
	if secretsDirty {
		if err := os.MkdirAll(dataDir, 0700); err != nil {
			log.Fatalf("[Config] CRITICAL: Failed to create data directory %s: %v", dataDir, err)
		}
		var b strings.Builder
		b.WriteString("# MySSH auto-generated secrets. DO NOT LOSE THIS FILE!\n")
		b.WriteString("# Losing MASTER_KEY or KDF_SALT will prevent decrypting stored vault credentials.\n")
		b.WriteString(fmt.Sprintf("JWT_SECRET=%s\n", persistedSecrets["JWT_SECRET"]))
		b.WriteString(fmt.Sprintf("MASTER_KEY=%s\n", persistedSecrets["MASTER_KEY"]))
		b.WriteString(fmt.Sprintf("KDF_SALT=%s\n", persistedSecrets["KDF_SALT"]))

		if err := os.WriteFile(secretsPath, []byte(b.String()), 0600); err != nil {
			log.Fatalf("[Config] CRITICAL: Failed to persist generated secrets to %s: %v. Please ensure data directory is writable or supply keys via environment variables.", secretsPath, err)
		}
		log.Printf("[Config] Persisted secrets to %s (permissions 0600)\n", secretsPath)
	}

	// Configure crypto package with active salt
	crypto.SetKDFSalt(kdfSaltBytes)

	return &Config{
		Port:                   port,
		DBPath:                 dbPath,
		JWTSecret:              jwtSecret,
		MasterKey:              masterKey,
		KDFSalt:                kdfSaltBytes,
		RecordingsDir:          recordingsDir,
		DataDir:                dataDir,
		RateLimitEnabled:       rateLimitEnabled,
		RateLimitMaxAttempts:   rateLimitMaxAttempts,
		RateLimitWindowMinutes: rateLimitWindowMinutes,
		TrustedProxies:         trustedProxies,
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
