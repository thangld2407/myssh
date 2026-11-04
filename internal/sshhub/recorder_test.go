package sshhub

import (
	"bufio"
	"encoding/json"
	"os"
	"testing"
)

func TestSessionRecorder(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "myssh-recorder-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	sessionID := "test-session-123"
	rec, err := NewSessionRecorder(tempDir, sessionID, 100, 30, "Test Terminal")
	if err != nil {
		t.Fatalf("NewSessionRecorder failed: %v", err)
	}

	// Write output chunks
	if err := rec.WriteOutput([]byte("ls -la\r\n")); err != nil {
		t.Fatalf("WriteOutput failed: %v", err)
	}
	if err := rec.WriteOutput([]byte("total 0\r\n")); err != nil {
		t.Fatalf("WriteOutput failed: %v", err)
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

	// Line 2: First event
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

	// Line 3: Second event
	if !scanner.Scan() {
		t.Fatalf("Expected event line 2")
	}
	var event2 []interface{}
	if err := json.Unmarshal(scanner.Bytes(), &event2); err != nil {
		t.Fatalf("Failed to unmarshal event 2: %v", err)
	}
	if len(event2) < 3 || event2[1] != "o" || event2[2] != "total 0\r\n" {
		t.Errorf("Event 2 mismatch: %+v", event2)
	}
}
