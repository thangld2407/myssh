package sshhub

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type AsciinemaHeader struct {
	Version   int               `json:"version"`
	Width     int               `json:"width"`
	Height    int               `json:"height"`
	Timestamp int64             `json:"timestamp"`
	Title     string            `json:"title,omitempty"`
	Env       map[string]string `json:"env,omitempty"`
}

type SessionRecorder struct {
	mu           sync.Mutex
	file         *os.File
	startTime    time.Time
	filePath     string
	closed       bool
	maxBytes     int64
	writtenBytes int64
}

func NewSessionRecorder(dir, sessionID string, width, height int, title string) (*SessionRecorder, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create recordings directory: %w", err)
	}

	filePath := filepath.Join(dir, fmt.Sprintf("%s.cast", sessionID))
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return nil, fmt.Errorf("failed to create cast file: %w", err)
	}

	header := AsciinemaHeader{
		Version:   2,
		Width:     width,
		Height:    height,
		Timestamp: time.Now().Unix(),
		Title:     title,
		Env: map[string]string{
			"TERM":  "xterm-256color",
			"SHELL": "/bin/bash",
		},
	}

	headerBytes, err := json.Marshal(header)
	if err != nil {
		_ = f.Close()
		return nil, err
	}

	line := append(headerBytes, '\n')
	n, err := f.Write(line)
	if err != nil {
		_ = f.Close()
		return nil, err
	}

	return &SessionRecorder{
		file:         f,
		startTime:    time.Now(),
		filePath:     filePath,
		writtenBytes: int64(n),
	}, nil
}

// SetMaxBytes limits the maximum size in bytes that this recorder will write to disk.
func (r *SessionRecorder) SetMaxBytes(maxBytes int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.maxBytes = maxBytes
}

// WriteOutput writes output event to asciinema stream: [time_offset, "o", data]
func (r *SessionRecorder) WriteOutput(data []byte) error {
	return r.writeEvent("o", data)
}

// WriteInput writes input (keystroke) event to asciinema stream: [time_offset, "i", data]
func (r *SessionRecorder) WriteInput(data []byte) error {
	return r.writeEvent("i", data)
}

func (r *SessionRecorder) writeEvent(eventType string, data []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed || r.file == nil {
		return nil
	}

	if r.maxBytes > 0 && r.writtenBytes >= r.maxBytes {
		return nil // Capped per-session size
	}

	offset := time.Since(r.startTime).Seconds()
	event := []interface{}{
		offset,
		eventType,
		string(data),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	line := append(eventBytes, '\n')
	n, err := r.file.Write(line)
	r.writtenBytes += int64(n)
	return err
}

func (r *SessionRecorder) FilePath() string {
	return r.filePath
}

func (r *SessionRecorder) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed {
		return nil
	}
	r.closed = true
	if r.file != nil {
		return r.file.Close()
	}
	return nil
}

// PruneRecordings deletes .cast files older than maxAgeDays from dir.
func PruneRecordings(dir string, maxAgeDays int) (int, error) {
	if maxAgeDays <= 0 || dir == "" {
		return 0, nil
	}

	cutoff := time.Now().AddDate(0, 0, -maxAgeDays)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}

	deleted := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".cast") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(dir, entry.Name())
			if err := os.Remove(path); err == nil {
				deleted++
			}
		}
	}
	return deleted, nil
}

// StartRecordingReaper launches a background reaper goroutine that prunes expired recordings.
func StartRecordingReaper(dir string, maxAgeDays int, stopCh <-chan struct{}) {
	if maxAgeDays <= 0 || dir == "" {
		return
	}

	// Run initial prune on boot
	_, _ = PruneRecordings(dir, maxAgeDays)

	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				_, _ = PruneRecordings(dir, maxAgeDays)
			}
		}
	}()
}
