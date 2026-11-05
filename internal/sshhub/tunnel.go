package sshhub

import (
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"sync"

	"golang.org/x/crypto/ssh"
)

type ActiveTunnel struct {
	ID       string
	Listener net.Listener
	SSH      *ssh.Client
	StopChan chan struct{}
}

type TunnelHub struct {
	mu      sync.RWMutex
	tunnels map[string]*ActiveTunnel
}

var Hub = &TunnelHub{
	tunnels: make(map[string]*ActiveTunnel),
}

// StartLocalTunnel forwards connections on local bindHost:bindPort through SSH to targetHost:targetPort
func (h *TunnelHub) StartLocalTunnel(
	id string,
	info SSHConnectionInfo,
	bindHost string,
	bindPort int,
	targetHost string,
	targetPort int,
) error {
	h.mu.Lock()
	if _, exists := h.tunnels[id]; exists {
		h.mu.Unlock()
		return fmt.Errorf("tunnel %s is already running", id)
	}
	h.mu.Unlock()

	hHost := strings.ToLower(strings.TrimSpace(bindHost))
	if hHost != "127.0.0.1" && hHost != "localhost" && hHost != "::1" {
		envVal := strings.ToLower(strings.TrimSpace(os.Getenv("FEATURE_TUNNEL_PUBLIC_BIND")))
		if envVal != "true" && envVal != "1" && envVal != "yes" {
			return fmt.Errorf("insecure bind_host '%s': only loopback addresses (127.0.0.1, localhost, ::1) are permitted", bindHost)
		}
		log.Printf("[TUNNEL] WARNING: FEATURE_TUNNEL_PUBLIC_BIND enabled. Binding non-loopback host %s:%d\n", bindHost, bindPort)
	}

	sshClient, err := DialTarget(info)
	if err != nil {
		return fmt.Errorf("ssh dial failed: %w", err)
	}

	bindAddr := fmt.Sprintf("%s:%d", bindHost, bindPort)
	listener, err := net.Listen("tcp", bindAddr)
	if err != nil {
		_ = sshClient.Close()
		return fmt.Errorf("failed to bind address %s: %w", bindAddr, err)
	}

	stopChan := make(chan struct{})
	active := &ActiveTunnel{
		ID:       id,
		Listener: listener,
		SSH:      sshClient,
		StopChan: stopChan,
	}

	h.mu.Lock()
	h.tunnels[id] = active
	h.mu.Unlock()

	go func() {
		defer func() {
			_ = listener.Close()
			_ = sshClient.Close()
			h.mu.Lock()
			delete(h.tunnels, id)
			h.mu.Unlock()
		}()

		targetAddr := fmt.Sprintf("%s:%d", targetHost, targetPort)
		for {
			localConn, err := listener.Accept()
			if err != nil {
				select {
				case <-stopChan:
					return
				default:
					log.Printf("[Tunnel %s] Accept error: %v", id, err)
					return
				}
			}

			go func(local net.Conn) {
				defer local.Close()
				remoteConn, err := sshClient.Dial("tcp", targetAddr)
				if err != nil {
					log.Printf("[Tunnel %s] Dial remote target error: %v", id, err)
					return
				}
				defer remoteConn.Close()

				// Bidirectional pipe
				var wg sync.WaitGroup
				wg.Add(2)
				go func() {
					defer wg.Done()
					_, _ = io.Copy(remoteConn, local)
				}()
				go func() {
					defer wg.Done()
					_, _ = io.Copy(local, remoteConn)
				}()
				wg.Wait()
			}(localConn)
		}
	}()

	return nil
}

func (h *TunnelHub) StopTunnel(id string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	active, exists := h.tunnels[id]
	if !exists {
		return fmt.Errorf("tunnel %s is not active", id)
	}

	close(active.StopChan)
	_ = active.Listener.Close()
	_ = active.SSH.Close()
	delete(h.tunnels, id)
	return nil
}

func (h *TunnelHub) IsRunning(id string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, exists := h.tunnels[id]
	return exists
}

// StopAll stops all active tunnels during graceful shutdown.
func (h *TunnelHub) StopAll() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for id, active := range h.tunnels {
		close(active.StopChan)
		_ = active.Listener.Close()
		_ = active.SSH.Close()
		delete(h.tunnels, id)
	}
}
