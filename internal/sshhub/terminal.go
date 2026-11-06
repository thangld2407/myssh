package sshhub

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/myssh/myssh/internal/db"
	"golang.org/x/crypto/ssh"
)

// IsOriginAllowed validates whether an HTTP/WebSocket Origin header is permissible.
func IsOriginAllowed(r *http.Request, allowedOrigins []string) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // Same-origin or non-browser client
	}

	u, err := url.Parse(origin)
	if err == nil && u.Host != "" && (u.Host == r.Host || u.Host == r.Header.Get("Host")) {
		return true // Same-host origin
	}

	if len(allowedOrigins) == 0 {
		// Default development allowance: localhost and loopback interfaces
		if strings.HasPrefix(origin, "http://localhost:") ||
			strings.HasPrefix(origin, "http://127.0.0.1:") ||
			strings.HasPrefix(origin, "https://localhost:") ||
			strings.HasPrefix(origin, "https://127.0.0.1:") {
			return true
		}
		return false
	}

	for _, allowed := range allowedOrigins {
		if allowed == "*" || strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

type WindowSizeMessage struct {
	Type string `json:"type"` // "resize"
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
}

// HandleTerminalSession handles an active interactive web terminal session over WebSocket
func HandleTerminalSession(
	w http.ResponseWriter,
	r *http.Request,
	connInfo SSHConnectionInfo,
	sessionRecord *db.Session,
	recordingsDir string,
	initialCols, initialRows int,
	recordInput bool,
	maxRecordingBytes int64,
	allowedOrigins []string,
	idleTimeoutMinutes int,
) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(req *http.Request) bool {
			return IsOriginAllowed(req, allowedOrigins)
		},
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Terminal] WebSocket upgrade error: %v\n", err)
		return
	}
	defer ws.Close()

	const (
		pongWait   = 60 * time.Second
		pingPeriod = 30 * time.Second
	)

	_ = ws.SetReadDeadline(time.Now().Add(pongWait))
	ws.SetPongHandler(func(string) error {
		_ = ws.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	if initialCols <= 0 {
		initialCols = 120
	}
	if initialRows <= 0 {
		initialRows = 36
	}

	// 1. Dial SSH client
	client, err := DialTarget(connInfo)
	if err != nil {
		_ = ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[MySSH Error] Failed to connect to remote host: "+err.Error()+"\x1b[0m\r\n"))
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}
	defer client.Close()

	// 2. Open SSH session
	session, err := client.NewSession()
	if err != nil {
		_ = ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[MySSH Error] Failed to create SSH session: "+err.Error()+"\x1b[0m\r\n"))
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}
	defer session.Close()

	// 3. Request PTY
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", initialRows, initialCols, modes); err != nil {
		_ = ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[MySSH Error] Failed to request PTY: "+err.Error()+"\x1b[0m\r\n"))
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}
	defer stdinPipe.Close()

	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}

	// 4. Start session recorder
	recorder, err := NewSessionRecorder(recordingsDir, sessionRecord.ID, initialCols, initialRows, sessionRecord.HostName)
	if err == nil {
		if maxRecordingBytes > 0 {
			recorder.SetMaxBytes(maxRecordingBytes)
		}
		sessionRecord.RecordingPath = recorder.FilePath()
		defer recorder.Close()
	}

	// 5. Start remote shell
	if err := session.Shell(); err != nil {
		_ = ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[MySSH Error] Failed to start shell: "+err.Error()+"\x1b[0m\r\n"))
		sessionRecord.Status = "failed"
		now := time.Now()
		sessionRecord.EndedAt = &now
		db.DB.Save(sessionRecord)
		return
	}

	sessionRecord.Status = "active"
	db.DB.Save(sessionRecord)

	var (
		wg           sync.WaitGroup
		closeOnce    sync.Once
		byteCount    int64
		wsMu         sync.Mutex
		doneChan     = make(chan struct{})
		lastActivity int64
	)
	atomic.StoreInt64(&lastActivity, time.Now().Unix())

	updateActivity := func() {
		atomic.StoreInt64(&lastActivity, time.Now().Unix())
	}

	safeWriteWS := func(messageType int, data []byte) error {
		wsMu.Lock()
		defer wsMu.Unlock()
		return ws.WriteMessage(messageType, data)
	}

	closeAll := func() {
		closeOnce.Do(func() {
			close(doneChan)
			_ = session.Close()
			_ = ws.Close()
		})
	}

	// Keepalive: periodic ping to detect dead TCP connections
	go func() {
		pingTicker := time.NewTicker(pingPeriod)
		defer pingTicker.Stop()
		for {
			select {
			case <-pingTicker.C:
				if err := safeWriteWS(websocket.PingMessage, nil); err != nil {
					closeAll()
					return
				}
			case <-doneChan:
				return
			}
		}
	}()

	// Idle timeout reaper: terminates inactive sessions after N minutes
	if idleTimeoutMinutes > 0 {
		idleTimeout := time.Duration(idleTimeoutMinutes) * time.Minute
		go func() {
			idleTicker := time.NewTicker(30 * time.Second)
			defer idleTicker.Stop()
			for {
				select {
				case <-idleTicker.C:
					last := atomic.LoadInt64(&lastActivity)
					if time.Since(time.Unix(last, 0)) >= idleTimeout {
						log.Printf("[Terminal] Session %s closed due to %d minutes of inactivity\n", sessionRecord.ID, idleTimeoutMinutes)
						_ = safeWriteWS(websocket.TextMessage, []byte("\r\n\x1b[33m[MySSH] Session terminated due to inactivity (idle timeout).\x1b[0m\r\n"))
						time.Sleep(100 * time.Millisecond)
						closeAll()
						return
					}
				case <-doneChan:
					return
				}
			}
		}()
	}

	// Stream stdout & stderr to WebSocket and Recorder
	copyOutput := func(reader io.Reader) {
		defer wg.Done()
		buf := make([]byte, 4096)
		for {
			n, err := reader.Read(buf)
			if n > 0 {
				chunk := buf[:n]
				atomic.AddInt64(&byteCount, int64(n))
				updateActivity()

				// Write to WebSocket
				if err := safeWriteWS(websocket.BinaryMessage, chunk); err != nil {
					closeAll()
					return
				}

				// Write to Asciinema Recorder
				if recorder != nil {
					_ = recorder.WriteOutput(chunk)
				}
			}
			if err != nil {
				closeAll()
				return
			}
		}
	}

	wg.Add(2)
	go copyOutput(stdoutPipe)
	go copyOutput(stderrPipe)

	// Stream WebSocket input to SSH stdin (and handle resize)
	go func() {
		defer func() {
			closeAll()
			_ = stdinPipe.Close()
		}()

		for {
			msgType, data, err := ws.ReadMessage()
			if err != nil {
				return
			}

			_ = ws.SetReadDeadline(time.Now().Add(pongWait))
			updateActivity()

			if msgType == websocket.TextMessage {
				// Check if it's a resize control message
				var resizeMsg WindowSizeMessage
				if err := json.Unmarshal(data, &resizeMsg); err == nil && resizeMsg.Type == "resize" {
					if resizeMsg.Cols > 0 && resizeMsg.Rows > 0 {
						_ = session.WindowChange(resizeMsg.Rows, resizeMsg.Cols)
					}
					continue
				}
			}

			// Forward stdin keystrokes
			if _, err := stdinPipe.Write(data); err != nil {
				return
			}

			// Record keystrokes if configured
			if recorder != nil && recordInput {
				_ = recorder.WriteInput(data)
			}
		}
	}()

	_ = session.Wait()
	closeAll()
	wg.Wait()

	// Update session end metadata
	now := time.Now()
	sessionRecord.EndedAt = &now
	sessionRecord.Status = "closed"
	sessionRecord.ByteCount = atomic.LoadInt64(&byteCount)
	db.DB.Save(sessionRecord)
}
