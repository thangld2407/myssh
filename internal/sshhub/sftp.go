package sshhub

import (
	"fmt"
	"io"
	"path"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type FileItem struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	IsDir   bool      `json:"is_dir"`
	ModTime time.Time `json:"mod_time"`
	Mode    string    `json:"mode"`
}

type SFTPBridge struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	isPooled   bool
	pool       *ConnectionPool
	hostID     string
	info       SSHConnectionInfo
}

func OpenSFTP(info SSHConnectionInfo) (*SFTPBridge, error) {
	sshClient, err := DialTarget(info)
	if err != nil {
		return nil, fmt.Errorf("ssh dial failed: %w", err)
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		_ = sshClient.Close()
		return nil, fmt.Errorf("sftp subsystem init failed: %w", err)
	}

	var hostID string
	if info.Host != nil {
		hostID = info.Host.ID
	}

	return &SFTPBridge{
		sshClient:  sshClient,
		sftpClient: sftpClient,
		isPooled:   false,
		hostID:     hostID,
		info:       info,
	}, nil
}

func (s *SFTPBridge) retryIfBroken(op func() error) error {
	err := op()
	if err != nil && s.isPooled && s.pool != nil && IsConnError(err) {
		s.pool.Invalidate(s.hostID)
		fresh, dialErr := s.pool.GetSFTP(s.info)
		if dialErr == nil {
			s.sshClient = fresh.sshClient
			s.sftpClient = fresh.sftpClient
			return op()
		}
	}
	return err
}

func (s *SFTPBridge) Close() {
	if s.isPooled {
		// Pooled connections are maintained by the connection pool reaper
		return
	}
	if s.sftpClient != nil {
		_ = s.sftpClient.Close()
	}
	if s.sshClient != nil {
		_ = s.sshClient.Close()
	}
}

func (s *SFTPBridge) ForceClose() {
	if s.sftpClient != nil {
		_ = s.sftpClient.Close()
	}
	if s.sshClient != nil {
		_ = s.sshClient.Close()
	}
}

func (s *SFTPBridge) ListDir(dirPath string) ([]FileItem, error) {
	if dirPath == "" {
		dirPath = "."
	}

	var items []FileItem
	err := s.retryIfBroken(func() error {
		entries, err := s.sftpClient.ReadDir(dirPath)
		if err != nil {
			return err
		}
		items = make([]FileItem, 0, len(entries))
		for _, entry := range entries {
			itemPath := path.Join(dirPath, entry.Name())
			items = append(items, FileItem{
				Name:    entry.Name(),
				Path:    itemPath,
				Size:    entry.Size(),
				IsDir:   entry.IsDir(),
				ModTime: entry.ModTime(),
				Mode:    entry.Mode().String(),
			})
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to read remote dir: %w", err)
	}

	return items, nil
}

func (s *SFTPBridge) DownloadFile(remotePath string) (io.ReadCloser, int64, error) {
	var file *sftp.File
	var size int64
	err := s.retryIfBroken(func() error {
		f, err := s.sftpClient.Open(remotePath)
		if err != nil {
			return err
		}
		stat, err := f.Stat()
		if err != nil {
			_ = f.Close()
			return err
		}
		file = f
		size = stat.Size()
		return nil
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to open remote file: %w", err)
	}

	return file, size, nil
}

func (s *SFTPBridge) UploadFile(remotePath string, src io.Reader) error {
	remoteDir := path.Dir(remotePath)
	return s.retryIfBroken(func() error {
		_ = s.sftpClient.MkdirAll(remoteDir)

		dstFile, err := s.sftpClient.Create(remotePath)
		if err != nil {
			return fmt.Errorf("failed to create remote file: %w", err)
		}
		defer dstFile.Close()

		if _, err := io.Copy(dstFile, src); err != nil {
			return fmt.Errorf("failed to write remote file: %w", err)
		}

		return nil
	})
}

func (s *SFTPBridge) Mkdir(remotePath string) error {
	return s.retryIfBroken(func() error {
		return s.sftpClient.MkdirAll(remotePath)
	})
}

func (s *SFTPBridge) Remove(remotePath string) error {
	return s.retryIfBroken(func() error {
		stat, err := s.sftpClient.Stat(remotePath)
		if err != nil {
			return err
		}

		if stat.IsDir() {
			return s.sftpClient.RemoveDirectory(remotePath)
		}
		return s.sftpClient.Remove(remotePath)
	})
}

func (s *SFTPBridge) Rename(oldPath, newPath string) error {
	return s.retryIfBroken(func() error {
		return s.sftpClient.Rename(oldPath, newPath)
	})
}

func (s *SFTPBridge) ReadFile(remotePath string, maxBytes int64) ([]byte, error) {
	var data []byte
	err := s.retryIfBroken(func() error {
		file, err := s.sftpClient.Open(remotePath)
		if err != nil {
			return fmt.Errorf("failed to open remote file: %w", err)
		}
		defer file.Close()

		stat, err := file.Stat()
		if err != nil {
			return fmt.Errorf("failed to stat remote file: %w", err)
		}

		if maxBytes > 0 && stat.Size() > maxBytes {
			return fmt.Errorf("file size (%d bytes) exceeds maximum editable limit (%d bytes)", stat.Size(), maxBytes)
		}

		res, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
		if err != nil {
			return err
		}
		data = res
		return nil
	})
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (s *SFTPBridge) WriteFile(remotePath string, data []byte) error {
	remoteDir := path.Dir(remotePath)
	return s.retryIfBroken(func() error {
		_ = s.sftpClient.MkdirAll(remoteDir)

		dstFile, err := s.sftpClient.Create(remotePath)
		if err != nil {
			return fmt.Errorf("failed to open/create remote file for writing: %w", err)
		}
		defer dstFile.Close()

		if _, err := dstFile.Write(data); err != nil {
			return fmt.Errorf("failed to write remote file content: %w", err)
		}

		return nil
	})
}
