package db

import (
	"time"
)

type User struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	Username     string    `gorm:"uniqueIndex;size:64;not null" json:"username"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	FullName     string    `gorm:"size:128" json:"full_name"`
	Role         string    `gorm:"size:32;default:'admin'" json:"role"` // admin, member, viewer
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
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
	JumpHostID   string      `gorm:"size:36" json:"jump_host_id,omitempty"`
	Description  string      `gorm:"type:text" json:"description"`
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
