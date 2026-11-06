package db

import (
	"time"
)

type User struct {
	ID                string    `gorm:"primaryKey;size:36" json:"id"`
	Username          string    `gorm:"uniqueIndex;size:64;not null" json:"username"`
	PasswordHash      string    `gorm:"size:255;not null" json:"-"`
	FullName          string    `gorm:"size:128" json:"full_name"`
	Role              string    `gorm:"size:32;default:'admin'" json:"role"` // admin, member, viewer
	TwoFactorEnabled  bool      `gorm:"default:false" json:"two_factor_enabled"`
	TwoFactorSecret   string    `gorm:"type:text" json:"-"`
	TwoFactorNonce    string    `gorm:"size:64" json:"-"`
	RecoveryCodes     string    `gorm:"type:text" json:"-"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type Credential struct {
	ID                  string    `gorm:"primaryKey;size:36" json:"id"`
	Name                string    `gorm:"size:128;not null" json:"name"`
	Type                string    `gorm:"size:32;not null" json:"type"` // "password" or "private_key"
	EncryptedData       string    `gorm:"type:text;not null" json:"-"`  // Encrypted password or private key
	Nonce               string    `gorm:"size:64;not null" json:"-"`
	EncryptedPassphrase string    `gorm:"type:text" json:"-"` // Optional passphrase for private key
	PassphraseNonce     string    `gorm:"size:64" json:"-"`
	PublicKey           string    `gorm:"type:text" json:"public_key,omitempty"` // For private_key type
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type Host struct {
	ID           string      `gorm:"primaryKey;size:36" json:"id"`
	Name         string      `gorm:"size:128;not null" json:"name"`
	Hostname     string      `gorm:"size:255;not null" json:"hostname"`
	Port         int         `gorm:"default:22" json:"port"`
	Username     string      `gorm:"size:64;not null" json:"username"`
	Folder       string      `gorm:"size:64;default:'General'" json:"folder"`
	Tags         string      `gorm:"size:255" json:"tags"` // Comma-separated tags
	CredentialID string      `gorm:"size:36;index" json:"credential_id"`
	Credential   *Credential `gorm:"foreignKey:CredentialID" json:"credential,omitempty"`
	JumpHostID         string      `gorm:"size:36" json:"jump_host_id,omitempty"`
	HostKeyFingerprint string      `gorm:"size:128" json:"host_key_fingerprint,omitempty"`
	IsProduction       bool        `gorm:"default:false" json:"is_production"`
	Description        string      `gorm:"type:text" json:"description"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

type Session struct {
	ID            string     `gorm:"primaryKey;size:36" json:"id"`
	UserID        string     `gorm:"size:36;index" json:"user_id"`
	User          *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	HostID        string     `gorm:"size:36;index" json:"host_id"`
	Host          *Host      `gorm:"foreignKey:HostID" json:"host,omitempty"`
	HostName      string     `gorm:"size:128" json:"host_name"`
	Status        string     `gorm:"size:32;default:'active'" json:"status"` // active, closed, failed
	ClientIP      string     `gorm:"size:64" json:"client_ip"`
	RecordingPath string     `gorm:"size:255" json:"recording_path"`
	ByteCount     int64      `gorm:"default:0" json:"byte_count"`
	StartedAt     time.Time  `json:"started_at"`
	EndedAt       *time.Time `json:"ended_at,omitempty"`
}

type Tunnel struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	UserID     string    `gorm:"size:36;index" json:"user_id"`
	HostID     string    `gorm:"size:36;index" json:"host_id"`
	Host       *Host     `gorm:"foreignKey:HostID" json:"host,omitempty"`
	Name       string    `gorm:"size:128;not null" json:"name"`
	Type       string    `gorm:"size:32;default:'local'" json:"type"` // local, socks5
	BindHost   string    `gorm:"size:64;default:'127.0.0.1'" json:"bind_host"`
	BindPort   int       `gorm:"not null" json:"bind_port"`
	TargetHost string    `gorm:"size:255" json:"target_host,omitempty"`
	TargetPort int       `json:"target_port,omitempty"`
	Status     string    `gorm:"size:32;default:'stopped'" json:"status"` // running, stopped, error
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Snippet struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	UserID      string    `gorm:"size:36;index" json:"user_id"`
	Name        string    `gorm:"size:128;not null" json:"name"`
	Command     string    `gorm:"type:text;not null" json:"command"`
	Description string    `gorm:"type:text" json:"description"`
	Category    string    `gorm:"size:64;default:'General'" json:"category"`
	Tags        string    `gorm:"size:255" json:"tags"` // Comma-separated tags
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type KubeCluster struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	Name           string    `gorm:"size:128;not null" json:"name"`
	Description    string    `gorm:"type:text" json:"description"`
	CurrentContext string    `gorm:"size:128" json:"current_context"`
	EncryptedData  string    `gorm:"type:text;not null" json:"-"` // Encrypted kubeconfig YAML
	Nonce          string    `gorm:"size:64;not null" json:"-"`
	ServerVersion  string    `gorm:"size:64" json:"server_version,omitempty"`
	Status         string    `gorm:"size:32;default:'ready'" json:"status"` // ready, error, unreachable
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type KubePortForward struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	ClusterID  string    `gorm:"size:36;index;not null" json:"cluster_id"`
	Cluster    *KubeCluster `gorm:"foreignKey:ClusterID" json:"cluster,omitempty"`
	Namespace  string    `gorm:"size:128;not null" json:"namespace"`
	TargetType string    `gorm:"size:32;not null" json:"target_type"` // pod, service
	TargetName string    `gorm:"size:128;not null" json:"target_name"`
	LocalPort  int       `gorm:"not null" json:"local_port"`
	RemotePort int       `gorm:"not null" json:"remote_port"`
	Status     string    `gorm:"size:32;default:'stopped'" json:"status"` // running, stopped, error
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type AuditLog struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	UserID       string    `gorm:"size:36;index" json:"user_id"`
	Username     string    `gorm:"size:64;index" json:"username"`
	Action       string    `gorm:"size:64;index" json:"action"`
	ResourceType string    `gorm:"size:64;index" json:"resource_type"`
	ResourceID   string    `gorm:"size:128" json:"resource_id"`
	Detail       string    `gorm:"type:text" json:"detail"`
	ClientIP     string    `gorm:"size:64" json:"client_ip"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}
