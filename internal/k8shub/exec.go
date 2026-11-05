package k8shub

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

// TerminalSession implements remotecommand.TerminalSizeQueue and streams data to/from WebSocket
type TerminalSession struct {
	wsConn   *websocket.Conn
	sizeChan chan remotecommand.TerminalSize
	readChan chan []byte
	readBuf  []byte
	doneChan chan struct{}
	cancel   context.CancelFunc
	once     sync.Once
}

func newTerminalSession(ws *websocket.Conn, cancel context.CancelFunc) *TerminalSession {
	return &TerminalSession{
		wsConn:   ws,
		sizeChan: make(chan remotecommand.TerminalSize, 5),
		readChan: make(chan []byte, 100),
		doneChan: make(chan struct{}),
		cancel:   cancel,
	}
}

// Next implements remotecommand.TerminalSizeQueue
func (s *TerminalSession) Next() *remotecommand.TerminalSize {
	select {
	case size := <-s.sizeChan:
		return &size
	case <-s.doneChan:
		return nil
	}
}

// Read implements io.Reader for Stdin
func (s *TerminalSession) Read(p []byte) (int, error) {
	if len(s.readBuf) > 0 {
		n := copy(p, s.readBuf)
		s.readBuf = s.readBuf[n:]
		return n, nil
	}

	select {
	case data, ok := <-s.readChan:
		if !ok {
			return 0, io.EOF
		}
		n := copy(p, data)
		if n < len(data) {
			s.readBuf = data[n:]
		}
		return n, nil
	case <-s.doneChan:
		return 0, io.EOF
	}
}

// Write implements io.Writer for Stdout and Stderr
func (s *TerminalSession) Write(p []byte) (int, error) {
	err := s.wsConn.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

// Close gracefully terminates the session
func (s *TerminalSession) Close() {
	s.once.Do(func() {
		close(s.doneChan)
		if s.cancel != nil {
			s.cancel()
		}
		_ = s.wsConn.Close()
	})
}

type ResizeMsg struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

// HandlePodExec attaches to a pod container PTY and bridges it to an active WebSocket connection
func HandlePodExec(
	cs *kubernetes.Clientset,
	restConfig *rest.Config,
	ws *websocket.Conn,
	namespace, podName, container string,
	command []string,
) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sess := newTerminalSession(ws, cancel)
	defer sess.Close()

	if len(command) == 0 {
		command = []string{"/bin/sh"}
	}

	req := cs.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   command,
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(restConfig, http.MethodPost, req.URL())
	if err != nil {
		return fmt.Errorf("failed to init SPDY executor: %w", err)
	}

	// Goroutine to read from WebSocket and push to stdin or size channel
	go func() {
		defer close(sess.readChan)
		for {
			messageType, payload, err := ws.ReadMessage()
			if err != nil {
				return
			}

			if messageType == websocket.TextMessage {
				// Check if it is a resize payload
				var resize ResizeMsg
				if err := json.Unmarshal(payload, &resize); err == nil && resize.Type == "resize" && resize.Cols > 0 && resize.Rows > 0 {
					select {
					case sess.sizeChan <- remotecommand.TerminalSize{Width: resize.Cols, Height: resize.Rows}:
					default:
					}
					continue
				}
			}

			// Forward normal input to stdin
			select {
			case sess.readChan <- payload:
			case <-sess.doneChan:
				return
			}
		}
	}()

	// Initial default terminal size
	sess.sizeChan <- remotecommand.TerminalSize{Width: 100, Height: 30}

	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:             sess,
		Stdout:            sess,
		Stderr:            sess,
		Tty:               true,
		TerminalSizeQueue: sess,
	})

	return err
}
