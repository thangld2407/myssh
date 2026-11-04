package sshhub

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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
	mu        sync.Mutex
	file      *os.File
	startTime time.Time
	filePath  string
	closed    bool
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

	if _, err := f.Write(append(headerBytes, '\n')); err != nil {
		_ = f.Close()
		return nil, err
	}

	return &SessionRecorder{
		file:      f,
		startTime: time.Now(),
		filePath:  filePath,
	}, nil
}

// WriteOutput writes output event to asciinema stream: [time_offset, "o", data]
func (r *SessionRecorder) WriteOutput(data []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.closed || r.file == nil {
		return nil
	}

	offset := time.Since(r.startTime).Seconds()
	event := []interface{}{
		offset,
		"o",
		string(data),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	_, err = r.file.Write(append(eventBytes, '\n'))
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
