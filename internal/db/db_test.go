package db

import (
	"path/filepath"
	"testing"
)

func TestInitDB(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_myssh.db")

	database, err := Init(dbPath)
	if err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}
	if database == nil {
		t.Fatalf("Expected db instance, got nil")
	}

	// Verify tables exist and snippets are seeded
	var snippetCount int64
	if err := DB.Model(&Snippet{}).Count(&snippetCount).Error; err != nil {
		t.Fatalf("Failed to count snippets: %v", err)
	}
	if snippetCount < 6 {
		t.Errorf("Expected at least 6 seeded snippets, got %d", snippetCount)
	}

	// Re-init should be idempotent
	_, err = Init(dbPath)
	if err != nil {
		t.Fatalf("Re-init failed: %v", err)
	}
	var newSnippetCount int64
	DB.Model(&Snippet{}).Count(&newSnippetCount)
	if newSnippetCount != snippetCount {
		t.Errorf("Snippet count changed on re-init: before %d, after %d", snippetCount, newSnippetCount)
	}
}
