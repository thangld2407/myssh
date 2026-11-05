package sshhub

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSessionRecorder_OutputAndInputEvents(t *testing.T) {
	tempDir := t.TempDir()

	sessionID := "test-session-123"
	rec, err := NewSessionRecorder(tempDir, sessionID, 100, 30, "Test Terminal")
	if err != nil {
		t.Fatalf("NewSessionRecorder failed: %v", err)
	}

	// 1. Write output chunk
	if err := rec.WriteOutput([]byte("ls -la\r\n")); err != nil {
		t.Fatalf("WriteOutput failed: %v", err)
	}

	// 2. Write input chunk ("i" event)
	if err := rec.WriteInput([]byte("clear\r")); err != nil {
		t.Fatalf("WriteInput failed: %v", err)
	}

	filePath := rec.FilePath()
	if err := rec.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// Verify file exists and conforms to Asciinema v2 format
	f, err := os.Open(filePath)
	if err != nil {
		t.Fatalf("Failed to open cast file: %v", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)

	// Line 1: Header
	if !scanner.Scan() {
		t.Fatalf("Expected header line in cast file")
	}
	var header AsciinemaHeader
	if err := json.Unmarshal(scanner.Bytes(), &header); err != nil {
		t.Fatalf("Failed to unmarshal header: %v", err)
	}
	if header.Version != 2 || header.Width != 100 || header.Height != 30 {
		t.Errorf("Header attributes incorrect: %+v", header)
	}

	// Line 2: Output event
	if !scanner.Scan() {
		t.Fatalf("Expected event line 1")
	}
	var event1 []interface{}
	if err := json.Unmarshal(scanner.Bytes(), &event1); err != nil {
		t.Fatalf("Failed to unmarshal event 1: %v", err)
	}
	if len(event1) < 3 || event1[1] != "o" || event1[2] != "ls -la\r\n" {
		t.Errorf("Event 1 mismatch: %+v", event1)
	}

	// Line 3: Input event
	if !scanner.Scan() {
		t.Fatalf("Expected event line 2")
	}
	var event2 []interface{}
	if err := json.Unmarshal(scanner.Bytes(), &event2); err != nil {
		t.Fatalf("Failed to unmarshal event 2: %v", err)
	}
	if len(event2) < 3 || event2[1] != "i" || event2[2] != "clear\r" {
		t.Errorf("Event 2 mismatch (expected 'i' event): %+v", event2)
	}
}

func TestSessionRecorder_MaxBytesCap(t *testing.T) {
	tempDir := t.TempDir()

	rec, err := NewSessionRecorder(tempDir, "capped-session", 80, 24, "Capped")
	if err != nil {
		t.Fatalf("NewSessionRecorder failed: %v", err)
	}

	// Cap at 250 bytes
	rec.SetMaxBytes(250)

	// Write 100 bytes repeatedly
	chunk := []byte("1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890")
	for i := 0; i < 20; i++ {
		_ = rec.WriteOutput(chunk)
	}

	filePath := rec.FilePath()
	_ = rec.Close()

	info, err := os.Stat(filePath)
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}

	// File size should not significantly exceed cap (accounting for the last written event)
	if info.Size() > 400 {
		t.Errorf("Recording size exceeded cap: expected <= 400 bytes, got %d", info.Size())
	}
}

func TestPruneRecordings_Retention(t *testing.T) {
	tempDir := t.TempDir()

	// 1. Create an old recording file (40 days old)
	oldPath := filepath.Join(tempDir, "old-session.cast")
	_ = os.WriteFile(oldPath, []byte(`{"version": 2}`+"\n"), 0600)
	oldTime := time.Now().AddDate(0, 0, -40)
	_ = os.Chtimes(oldPath, oldTime, oldTime)

	// 2. Create a fresh recording file (1 day old)
	freshPath := filepath.Join(tempDir, "fresh-session.cast")
	_ = os.WriteFile(freshPath, []byte(`{"version": 2}`+"\n"), 0600)
	freshTime := time.Now().AddDate(0, 0, -1)
	_ = os.Chtimes(freshPath, freshTime, freshTime)

	// 3. Prune files older than 30 days
	deleted, err := PruneRecordings(tempDir, 30)
	if err != nil {
		t.Fatalf("PruneRecordings failed: %v", err)
	}

	if deleted != 1 {
		t.Errorf("Expected 1 file deleted, got %d", deleted)
	}

	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Errorf("Old recording should have been pruned")
	}

	if _, err := os.Stat(freshPath); os.IsNotExist(err) {
		t.Errorf("Fresh recording should have been preserved")
	}
}
