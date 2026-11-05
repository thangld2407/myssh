package sshhub

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

func startMockSSHAndSFTPServer(t *testing.T) (string, func()) {
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("Failed to generate host key: %v", err)
	}
	signer, err := ssh.NewSignerFromKey(priv)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	cfg := &ssh.ServerConfig{
		PasswordCallback: func(c ssh.ConnMetadata, pass []byte) (*ssh.Permissions, error) {
			if c.User() == "testuser" && string(pass) == "testpass" {
				return nil, nil
			}
			return nil, fmt.Errorf("invalid password")
		},
	}
	cfg.AddHostKey(signer)

	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Failed to listen: %v", err)
	}

	stopCh := make(chan struct{})

	go func() {
		for {
			tcpConn, err := l.Accept()
			if err != nil {
				select {
				case <-stopCh:
					return
				default:
					return
				}
			}

			go func(c net.Conn) {
				defer c.Close()
				sConn, chans, reqs, err := ssh.NewServerConn(c, cfg)
				if err != nil {
					return
				}
				defer sConn.Close()
				go ssh.DiscardRequests(reqs)

				for newCh := range chans {
					if newCh.ChannelType() != "session" {
						_ = newCh.Reject(ssh.UnknownChannelType, "unsupported channel type")
						continue
					}

					ch, requests, err := newCh.Accept()
					if err != nil {
						continue
					}

					go func(channel ssh.Channel, in <-chan *ssh.Request) {
						for req := range in {
							switch req.Type {
							case "subsystem":
								if len(req.Payload) >= 4 && string(req.Payload[4:]) == "sftp" {
									_ = req.Reply(true, nil)
									server, err := sftp.NewServer(channel)
									if err == nil {
										_ = server.Serve()
										_ = server.Close()
									}
									return
								}
								_ = req.Reply(false, nil)
							case "exec":
								_ = req.Reply(true, nil)
								// Output dummy metrics
								dummyOutput := "OS=\"Ubuntu 22.04 LTS\"\nUPTIME_SEC=3600\nCPU_PERCENT=15.5\nMEM_TOTAL_KB=2048000\nMEM_AVAIL_KB=1024000\nDISK_TOTAL_KB=10485760\nDISK_USED_KB=5242880\nDISK_AVAIL_KB=5242880\n"
								_, _ = channel.Write([]byte(dummyOutput))
								// Send exit status 0
								_, _ = channel.SendRequest("exit-status", false, []byte{0, 0, 0, 0})
								_ = channel.Close()
								return
							default:
								_ = req.Reply(false, nil)
							}
						}
					}(ch, requests)
				}
			}(tcpConn)
		}
	}()

	return l.Addr().String(), func() {
		close(stopCh)
		_ = l.Close()
	}
}

func TestConnectionPool_ReuseAndMetrics(t *testing.T) {
	addr, stop := startMockSSHAndSFTPServer(t)
	defer stop()

	hostStr, portStr, _ := net.SplitHostPort(addr)
	port, _ := strconv.Atoi(portStr)

	masterKey := "super-master-key-32-bytes-test!!"
	encPass, nonce, err := crypto.Encrypt([]byte("testpass"), masterKey)
	if err != nil {
		t.Fatalf("crypto.Encrypt failed: %v", err)
	}

	cred := &db.Credential{
		ID:            "cred-pool-test",
		Name:          "Test Cred",
		Type:          "password",
		EncryptedData: encPass,
		Nonce:         nonce,
	}

	host := &db.Host{
		ID:           "host-pool-test",
		Name:         "Mock Host",
		Hostname:     hostStr,
		Port:         port,
		Username:     "testuser",
		Credential:   cred,
		CredentialID: cred.ID,
	}

	info := SSHConnectionInfo{
		Host:      host,
		MasterKey: masterKey,
	}

	// 1. First metrics collection dials and caches in pool
	m1, err := CollectServerMetrics(info)
	if err != nil {
		t.Fatalf("First CollectServerMetrics failed: %v", err)
	}
	if m1.OS != "Ubuntu 22.04 LTS" {
		t.Errorf("Expected OS 'Ubuntu 22.04 LTS', got %q", m1.OS)
	}
	if GlobalPool.Len() != 1 {
		t.Fatalf("Expected pool length 1, got %d", GlobalPool.Len())
	}

	// 2. Second metrics collection reuses existing connection without dialing new one
	m2, err := CollectServerMetrics(info)
	if err != nil {
		t.Fatalf("Second CollectServerMetrics failed: %v", err)
	}
	if m2.CPUPercent != 15.5 {
		t.Errorf("Expected CPUPercent 15.5, got %v", m2.CPUPercent)
	}
	if GlobalPool.Len() != 1 {
		t.Fatalf("Expected pool length still 1 after reuse, got %d", GlobalPool.Len())
	}

	// 3. SFTP operation on same host reuses the pooled SSH connection
	bridge, err := GetPooledSFTP(info)
	if err != nil {
		t.Fatalf("GetPooledSFTP failed: %v", err)
	}
	items, err := bridge.ListDir(".")
	if err != nil {
		t.Fatalf("bridge.ListDir failed: %v", err)
	}
	_ = items
	// bridge.Close() should be a no-op on pooled bridge
	bridge.Close()

	if GlobalPool.Len() != 1 {
		t.Errorf("Expected pool length 1 after bridge.Close(), got %d", GlobalPool.Len())
	}

	// 4. Invalidation clears the pool entry
	GlobalPool.Invalidate(host.ID)
	if GlobalPool.Len() != 0 {
		t.Errorf("Expected pool length 0 after Invalidate, got %d", GlobalPool.Len())
	}
}

func TestConnectionPool_ReaperTTL(t *testing.T) {
	pool := NewConnectionPool(50 * time.Millisecond)
	defer pool.Stop()

	pool.mu.Lock()
	pool.conns["host-expired"] = &PooledConn{
		hostID:   "host-expired",
		lastUsed: time.Now().Add(-200 * time.Millisecond),
	}
	pool.conns["host-fresh"] = &PooledConn{
		hostID:   "host-fresh",
		lastUsed: time.Now(),
	}
	pool.mu.Unlock()

	if pool.Len() != 2 {
		t.Fatalf("Expected 2 conns, got %d", pool.Len())
	}

	pool.cleanupExpired(time.Now())

	if pool.Len() != 1 {
		t.Fatalf("Expected 1 conn after expired cleanup, got %d", pool.Len())
	}

	pool.mu.RLock()
	_, existsFresh := pool.conns["host-fresh"]
	_, existsExpired := pool.conns["host-expired"]
	pool.mu.RUnlock()

	if !existsFresh || existsExpired {
		t.Errorf("Fresh connection should exist, expired should not")
	}
}

func TestIsConnError(t *testing.T) {
	if !IsConnError(io.EOF) {
		t.Errorf("io.EOF should be recognized as connection error")
	}
	if !IsConnError(errors.New("write: broken pipe")) {
		t.Errorf("broken pipe should be recognized as connection error")
	}
	if !IsConnError(errors.New("connection reset by peer")) {
		t.Errorf("connection reset should be recognized as connection error")
	}
	if IsConnError(nil) {
		t.Errorf("nil error should not be recognized as connection error")
	}
	if IsConnError(errors.New("file not found")) {
		t.Errorf("file not found should not be connection error")
	}
}
