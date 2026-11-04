package sshhub

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/myssh/myssh/internal/db"
	"golang.org/x/crypto/ssh"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev/embedded use
	},
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
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
) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Terminal] WebSocket upgrade error: %v\n", err)
		return
	}
	defer ws.Close()

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
		return
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		return
	}
	defer stdinPipe.Close()

	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		return
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		return
	}

	// 4. Start session recorder
	recorder, err := NewSessionRecorder(recordingsDir, sessionRecord.ID, initialCols, initialRows, sessionRecord.HostName)
	if err == nil {
		sessionRecord.RecordingPath = recorder.FilePath()
		defer recorder.Close()
	}

	// 5. Start remote shell
	if err := session.Shell(); err != nil {
		_ = ws.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[31m[MySSH Error] Failed to start shell: "+err.Error()+"\x1b[0m\r\n"))
		return
	}

	sessionRecord.Status = "active"
	db.DB.Save(sessionRecord)

	var (
		wg        sync.WaitGroup
		closeOnce sync.Once
		byteCount int64
		wsMu      sync.Mutex
	)

	safeWriteWS := func(messageType int, data []byte) error {
		wsMu.Lock()
		defer wsMu.Unlock()
		return ws.WriteMessage(messageType, data)
	}

	closeAll := func() {
		closeOnce.Do(func() {
			_ = session.Close()
			_ = ws.Close()
		})
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
