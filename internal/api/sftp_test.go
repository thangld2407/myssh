package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
)

func TestSFTPUpload_FileTooLarge(t *testing.T) {
	// Configure max upload limit of 1 MB for testing
	cfg := &config.Config{
		MaxUploadSizeMB: 1,
	}
	handler := NewSFTPHandler(cfg)

	r := gin.New()
	r.MaxMultipartMemory = 8 << 20
	r.POST("/api/sftp/:host_id/upload", handler.Upload)

	// Create a multipart form with a file larger than 1 MB (1.5 MB)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "oversized_payload.bin")
	if err != nil {
		t.Fatalf("Failed to create form file: %v", err)
	}

	largeData := make([]byte, 1500*1024) // 1.5 MB
	_, _ = part.Write(largeData)
	_ = writer.Close()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/sftp/dummy-host/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	r.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("Expected 413 StatusRequestEntityTooLarge, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["error_code"] != "FILE_TOO_LARGE" {
		t.Errorf("Expected error_code FILE_TOO_LARGE, got %v", res["error_code"])
	}
}
