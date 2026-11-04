package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConfigDefaults(t *testing.T) {
	// Clear any relevant env vars
	os.Unsetenv("PORT")
	os.Unsetenv("DB_PATH")
	os.Unsetenv("RATE_LIMIT_ENABLED")

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
