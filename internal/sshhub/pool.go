package sshhub

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// PooledConn holds cached SSH and SFTP clients for a single host.
type PooledConn struct {
	hostID     string
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	lastUsed   time.Time
}

// ConnectionPool manages reusable SSH and SFTP connections keyed by host ID.
type ConnectionPool struct {
	conns  map[string]*PooledConn
	mu     sync.RWMutex
	ttl    time.Duration
	stopCh chan struct{}
}

// GlobalPool is the default application-wide SSH/SFTP connection pool.
var GlobalPool = NewConnectionPool(5 * time.Minute)

// NewConnectionPool creates a new pool with the given idle TTL and starts a background reaper.
func NewConnectionPool(ttl time.Duration) *ConnectionPool {
	p := &ConnectionPool{
		conns:  make(map[string]*PooledConn),
		ttl:    ttl,
		stopCh: make(chan struct{}),
	}
	go p.reaper()
	return p
}

// reaper runs periodically to close and evict idle connections exceeding the TTL.
func (p *ConnectionPool) reaper() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopCh:
			return
		case now := <-ticker.C:
			p.cleanupExpired(now)
		}
	}
}

// Stop terminates the background reaper goroutine and closes all pooled connections.
func (p *ConnectionPool) Stop() {
	select {
	case <-p.stopCh:
		// already stopped
		return
	default:
		close(p.stopCh)
	}
	p.CloseAll()
}

func (p *ConnectionPool) cleanupExpired(now time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for hostID, conn := range p.conns {
		if now.Sub(conn.lastUsed) > p.ttl {
			if conn.sftpClient != nil {
				_ = conn.sftpClient.Close()
			}
			if conn.sshClient != nil {
				_ = conn.sshClient.Close()
			}
			delete(p.conns, hostID)
		}
	}
}

// Invalidate closes and removes the cached connection for the specified host ID.
func (p *ConnectionPool) Invalidate(hostID string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if conn, ok := p.conns[hostID]; ok {
		if conn.sftpClient != nil {
			_ = conn.sftpClient.Close()
		}
		if conn.sshClient != nil {
			_ = conn.sshClient.Close()
		}
		delete(p.conns, hostID)
	}
}

// InvalidateAll closes and evicts all cached connections.
func (p *ConnectionPool) InvalidateAll() {
	p.CloseAll()
}

// CloseAll closes and evicts all connections.
func (p *ConnectionPool) CloseAll() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for hostID, conn := range p.conns {
		if conn.sftpClient != nil {
			_ = conn.sftpClient.Close()
		}
		if conn.sshClient != nil {
			_ = conn.sshClient.Close()
		}
		delete(p.conns, hostID)
	}
}

// Len returns the current number of active connections in the pool.
func (p *ConnectionPool) Len() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.conns)
}

// GetSSHClient returns an existing or freshly dialed SSH client for the host.
func (p *ConnectionPool) GetSSHClient(info SSHConnectionInfo) (*ssh.Client, error) {
	if info.Host == nil || info.Host.ID == "" {
		return DialTarget(info)
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if conn, ok := p.conns[info.Host.ID]; ok && conn.sshClient != nil {
		conn.lastUsed = time.Now()
		return conn.sshClient, nil
	}

	sshClient, err := DialTarget(info)
	if err != nil {
		return nil, err
	}

	p.conns[info.Host.ID] = &PooledConn{
		hostID:    info.Host.ID,
		sshClient: sshClient,
		lastUsed:  time.Now(),
	}

	return sshClient, nil
}

// GetSFTP returns a pooled SFTPBridge wrapping cached SSH and SFTP clients.
func (p *ConnectionPool) GetSFTP(info SSHConnectionInfo) (*SFTPBridge, error) {
	if info.Host == nil || info.Host.ID == "" {
		return OpenSFTP(info)
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	conn, ok := p.conns[info.Host.ID]
	if !ok || conn.sshClient == nil {
		sshClient, err := DialTarget(info)
		if err != nil {
			return nil, fmt.Errorf("ssh dial failed: %w", err)
		}
		sftpClient, err := sftp.NewClient(sshClient)
		if err != nil {
			_ = sshClient.Close()
			return nil, fmt.Errorf("sftp subsystem init failed: %w", err)
		}
		conn = &PooledConn{
			hostID:     info.Host.ID,
			sshClient:  sshClient,
			sftpClient: sftpClient,
			lastUsed:   time.Now(),
		}
		p.conns[info.Host.ID] = conn
	} else {
		if conn.sftpClient == nil {
			sftpClient, err := sftp.NewClient(conn.sshClient)
			if err != nil {
				// Existing SSH client might be stale/dead, recreate both
				_ = conn.sshClient.Close()
				delete(p.conns, info.Host.ID)

				sshClient, dialErr := DialTarget(info)
				if dialErr != nil {
					return nil, fmt.Errorf("ssh dial failed: %w", dialErr)
				}
				sftpClient, err = sftp.NewClient(sshClient)
				if err != nil {
					_ = sshClient.Close()
					return nil, fmt.Errorf("sftp subsystem init failed: %w", err)
				}
				conn = &PooledConn{
					hostID:     info.Host.ID,
					sshClient:  sshClient,
					sftpClient: sftpClient,
					lastUsed:   time.Now(),
				}
				p.conns[info.Host.ID] = conn
			} else {
				conn.sftpClient = sftpClient
			}
		}
		conn.lastUsed = time.Now()
	}

	return &SFTPBridge{
		sshClient:  conn.sshClient,
		sftpClient: conn.sftpClient,
		isPooled:   true,
		pool:       p,
		hostID:     info.Host.ID,
		info:       info,
	}, nil
}

// GetPooledSFTP obtains a pooled SFTPBridge from the global connection pool.
func GetPooledSFTP(info SSHConnectionInfo) (*SFTPBridge, error) {
	return GlobalPool.GetSFTP(info)
}

// IsConnError checks if an error indicates a broken, reset, or closed SSH/network connection.
func IsConnError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	s := strings.ToLower(err.Error())
	return strings.Contains(s, "broken pipe") ||
		strings.Contains(s, "connection reset") ||
		strings.Contains(s, "client is closed") ||
		strings.Contains(s, "connection is closed") ||
		strings.Contains(s, "use of closed network connection") ||
		strings.Contains(s, "channel is closed") ||
		strings.Contains(s, "connection lost") ||
		strings.Contains(s, "connection refused") ||
		strings.Contains(s, "closed")
}
