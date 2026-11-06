package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConfigDefaults(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DATA_DIR", tmpDir)
	t.Setenv("PORT", "")
	t.Setenv("DB_PATH", "")
	t.Setenv("RATE_LIMIT_ENABLED", "")

	cfg := Load()
	if cfg.Port == "" {
		t.Errorf("Expected default Port, got empty")
	}
	if cfg.DBPath != "data/myssh.db" {
		t.Errorf("Expected data/myssh.db, got %s", cfg.DBPath)
	}
	if !cfg.RateLimitEnabled {
		t.Errorf("Expected RateLimitEnabled to be true by default")
	}
	if cfg.RateLimitMaxAttempts != 5 {
		t.Errorf("Expected RateLimitMaxAttempts to be 5, got %d", cfg.RateLimitMaxAttempts)
	}
	if cfg.SessionIdleTimeoutMinutes != 30 {
		t.Errorf("Expected default SessionIdleTimeoutMinutes to be 30, got %d", cfg.SessionIdleTimeoutMinutes)
	}

	// Verify .secrets was created in the temp directory
	secretsPath := filepath.Join(tmpDir, ".secrets")
	if _, err := os.Stat(secretsPath); os.IsNotExist(err) {
		t.Errorf("Expected .secrets to be created at %s", secretsPath)
	}
}

func TestGetEnvBool(t *testing.T) {
	tests := []struct {
		envVal   string
		expected bool
	}{
		{"true", true},
		{"1", true},
		{"yes", true},
		{"on", true},
		{"enable", true},
		{"enabled", true},
		{"false", false},
		{"0", false},
		{"no", false},
		{"off", false},
		{"disable", false},
	}

	for _, tt := range tests {
		os.Setenv("TEST_BOOL_FLAG", tt.envVal)
		got := getEnvBool("TEST_BOOL_FLAG", false)
		if got != tt.expected {
			t.Errorf("getEnvBool(%q) = %v, expected %v", tt.envVal, got, tt.expected)
		}
	}
	os.Unsetenv("TEST_BOOL_FLAG")

	// Fallback to default
	if !getEnvBool("NON_EXISTENT_VAR", true) {
		t.Errorf("Expected fallback true for non-existent env var")
	}
}

func TestGetEnvInt(t *testing.T) {
	os.Setenv("TEST_INT_FLAG", "42")
	if getEnvInt("TEST_INT_FLAG", 10) != 42 {
		t.Errorf("Expected 42")
	}

	os.Setenv("TEST_INT_FLAG", "invalid_number")
	if getEnvInt("TEST_INT_FLAG", 10) != 10 {
		t.Errorf("Expected fallback 10 on invalid string")
	}
	os.Unsetenv("TEST_INT_FLAG")
}

func TestLoadDotEnv(t *testing.T) {
	tmpDir := t.TempDir()
	envPath := filepath.Join(tmpDir, ".env.test")
	content := `
# Sample test env
MYSSH_TEST_KEY1="quoted_value"
MYSSH_TEST_KEY2='single_quoted'
MYSSH_TEST_KEY3=plain_value
INVALID_LINE_WITHOUT_EQUALS
`
	if err := os.WriteFile(envPath, []byte(content), 0600); err != nil {
		t.Fatalf("Failed to write test env: %v", err)
	}

	os.Unsetenv("MYSSH_TEST_KEY1")
	os.Unsetenv("MYSSH_TEST_KEY2")
	os.Unsetenv("MYSSH_TEST_KEY3")

	loadDotEnv(envPath)

	if os.Getenv("MYSSH_TEST_KEY1") != "quoted_value" {
		t.Errorf("Expected quoted_value, got %s", os.Getenv("MYSSH_TEST_KEY1"))
	}
	if os.Getenv("MYSSH_TEST_KEY2") != "single_quoted" {
		t.Errorf("Expected single_quoted, got %s", os.Getenv("MYSSH_TEST_KEY2"))
	}
	if os.Getenv("MYSSH_TEST_KEY3") != "plain_value" {
		t.Errorf("Expected plain_value, got %s", os.Getenv("MYSSH_TEST_KEY3"))
	}

	os.Unsetenv("MYSSH_TEST_KEY1")
	os.Unsetenv("MYSSH_TEST_KEY2")
	os.Unsetenv("MYSSH_TEST_KEY3")
}

// F02 Branch 1: Environment empty -> auto-generates secure random keys and persists to .secrets
func TestLoad_UnsetSecretsAutoGenerates(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DATA_DIR", tmpDir)
	t.Setenv("JWT_SECRET", "")
	t.Setenv("MASTER_KEY", "")
	t.Setenv("KDF_SALT", "")

	cfg := Load()

	if len(cfg.JWTSecret) < 32 {
		t.Fatalf("Expected auto-generated JWTSecret of at least 32 chars, got %d", len(cfg.JWTSecret))
	}
	if len(cfg.MasterKey) < 32 {
		t.Fatalf("Expected auto-generated MasterKey of at least 32 chars, got %d", len(cfg.MasterKey))
	}
	if len(cfg.KDFSalt) != 16 {
		t.Fatalf("Expected auto-generated 16-byte KDF salt, got %d", len(cfg.KDFSalt))
	}

	// Verify persistence in .secrets
	secretsPath := filepath.Join(tmpDir, ".secrets")
	secrets := loadSecretsFile(secretsPath)
	if secrets["JWT_SECRET"] != cfg.JWTSecret {
		t.Errorf("Persisted JWT_SECRET (%s) != loaded cfg.JWTSecret (%s)", secrets["JWT_SECRET"], cfg.JWTSecret)
	}
	if secrets["MASTER_KEY"] != cfg.MasterKey {
		t.Errorf("Persisted MASTER_KEY (%s) != loaded cfg.MasterKey (%s)", secrets["MASTER_KEY"], cfg.MasterKey)
	}
}

// F02 Branch 2: Environment contains insecure sample/placeholder keys -> triggers warning, auto-generates, rejects sample
func TestLoad_SampleSecretsAutoGeneratesWithWarning(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DATA_DIR", tmpDir)
	t.Setenv("JWT_SECRET", "myssh-super-secret-jwt-key-2026")
	t.Setenv("MASTER_KEY", "myssh-master-encryption-key-32b!")
	t.Setenv("KDF_SALT", "")

	cfg := Load()

	if cfg.JWTSecret == "myssh-super-secret-jwt-key-2026" {
		t.Fatalf("Load() should NOT use the hardcoded sample JWT_SECRET")
	}
	if cfg.MasterKey == "myssh-master-encryption-key-32b!" {
		t.Fatalf("Load() should NOT use the hardcoded sample MASTER_KEY")
	}

	// Test placeholder __CHANGE_ME__
	t.Setenv("JWT_SECRET", "__CHANGE_ME__")
	t.Setenv("MASTER_KEY", "myssh-master-encryption-key-32b-change-me!")
	cfg2 := Load()

	if cfg2.JWTSecret == "__CHANGE_ME__" {
		t.Fatalf("Load() should reject __CHANGE_ME__ placeholder")
	}
	if cfg2.MasterKey == "myssh-master-encryption-key-32b-change-me!" {
		t.Fatalf("Load() should reject change-me placeholder")
	}
}

// F02 Branch 3: Environment contains valid custom user-supplied keys -> uses them as-is
func TestLoad_ValidUserSecretsPreserved(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DATA_DIR", tmpDir)
	customJWT := "my-very-strong-production-jwt-secret-xyz-987"
	customMaster := "my-very-strong-master-key-32-chars-long!"
	t.Setenv("JWT_SECRET", customJWT)
	t.Setenv("MASTER_KEY", customMaster)
	t.Setenv("KDF_SALT", "")

	cfg := Load()

	if cfg.JWTSecret != customJWT {
		t.Errorf("Expected custom JWT_SECRET %s, got %s", customJWT, cfg.JWTSecret)
	}
	if cfg.MasterKey != customMaster {
		t.Errorf("Expected custom MASTER_KEY %s, got %s", customMaster, cfg.MasterKey)
	}
}

// Verify that rebooting the application reloads the previously generated secrets from .secrets
func TestLoad_SecretsPersistenceAcrossRestarts(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("DATA_DIR", tmpDir)
	t.Setenv("JWT_SECRET", "")
	t.Setenv("MASTER_KEY", "")
	t.Setenv("KDF_SALT", "")

	// First boot: generates secrets
	cfg1 := Load()

	// Second boot: reloads same secrets
	cfg2 := Load()

	if cfg1.JWTSecret != cfg2.JWTSecret {
		t.Errorf("Second boot should reload identical JWT_SECRET: %s != %s", cfg1.JWTSecret, cfg2.JWTSecret)
	}
	if cfg1.MasterKey != cfg2.MasterKey {
		t.Errorf("Second boot should reload identical MASTER_KEY: %s != %s", cfg1.MasterKey, cfg2.MasterKey)
	}
	if string(cfg1.KDFSalt) != string(cfg2.KDFSalt) {
		t.Errorf("Second boot should reload identical KDFSalt")
	}
}

func TestParsePort(t *testing.T) {
	origArgs := os.Args
	defer func() { os.Args = origArgs }()

	// 1. Default fallback
	os.Args = []string{"myssh"}
	t.Setenv("PORT", "")
	t.Setenv("MYSSH_PORT", "")
	t.Setenv("SERVER_PORT", "")
	if got := parsePort(); got != "8080" {
		t.Errorf("Expected 8080 fallback, got %s", got)
	}

	// 2. Env PORT
	t.Setenv("PORT", "3000")
	if got := parsePort(); got != "3000" {
		t.Errorf("Expected 3000 from PORT, got %s", got)
	}

	// 3. Env MYSSH_PORT
	t.Setenv("PORT", "")
	t.Setenv("MYSSH_PORT", "4000")
	if got := parsePort(); got != "4000" {
		t.Errorf("Expected 4000 from MYSSH_PORT, got %s", got)
	}

	// 4. CLI flag -p
	t.Setenv("PORT", "8080")
	os.Args = []string{"myssh", "-p", "9090"}
	if got := parsePort(); got != "9090" {
		t.Errorf("Expected 9090 from CLI flag -p, got %s", got)
	}

	// 5. CLI flag --port=X
	os.Args = []string{"myssh", "--port=7070"}
	if got := parsePort(); got != "7070" {
		t.Errorf("Expected 7070 from CLI flag --port=, got %s", got)
	}

	// 6. Positional argument
	os.Args = []string{"myssh", "5000"}
	if got := parsePort(); got != "5000" {
		t.Errorf("Expected 5000 from positional arg, got %s", got)
	}
}

