package sshhub

import (
	"fmt"
	"io"
	"path/filepath"
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

	return &SFTPBridge{
		sshClient:  sshClient,
		sftpClient: sftpClient,
	}, nil
}

func (s *SFTPBridge) Close() {
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

	entries, err := s.sftpClient.ReadDir(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read remote dir: %w", err)
	}

	var items []FileItem
	for _, entry := range entries {
		itemPath := filepath.Join(dirPath, entry.Name())
		items = append(items, FileItem{
			Name:    entry.Name(),
			Path:    itemPath,
			Size:    entry.Size(),
			IsDir:   entry.IsDir(),
			ModTime: entry.ModTime(),
			Mode:    entry.Mode().String(),
		})
	}

	return items, nil
}

func (s *SFTPBridge) DownloadFile(remotePath string) (io.ReadCloser, int64, error) {
	file, err := s.sftpClient.Open(remotePath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to open remote file: %w", err)
	}

	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return nil, 0, fmt.Errorf("failed to stat remote file: %w", err)
	}

	return file, stat.Size(), nil
}

func (s *SFTPBridge) UploadFile(remotePath string, src io.Reader) error {
	remoteDir := filepath.Dir(remotePath)
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
}

func (s *SFTPBridge) Mkdir(remotePath string) error {
	return s.sftpClient.MkdirAll(remotePath)
}

func (s *SFTPBridge) Remove(remotePath string) error {
	stat, err := s.sftpClient.Stat(remotePath)
	if err != nil {
		return err
	}

	if stat.IsDir() {
		return s.sftpClient.RemoveDirectory(remotePath)
	}
	return s.sftpClient.Remove(remotePath)
}

func (s *SFTPBridge) Rename(oldPath, newPath string) error {
	return s.sftpClient.Rename(oldPath, newPath)
}
