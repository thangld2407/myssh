package sshhub

import (
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
	"golang.org/x/crypto/ssh"
)

type SSHConnectionInfo struct {
	Host                  *db.Host
	JumpHost              *db.Host
	MasterKey             string
	InsecureIgnoreHostKey bool // Set true to bypass host key verification
}

// isStrictHostKeyEnabled returns true unless disabled via env or connection option
func isStrictHostKeyEnabled(info SSHConnectionInfo) bool {
	if info.InsecureIgnoreHostKey {
		return false
	}
	envVal := strings.ToLower(strings.TrimSpace(os.Getenv("FEATURE_STRICT_HOST_KEY")))
	if envVal == "false" || envVal == "0" || envVal == "no" || envVal == "off" {
		return false
	}
	return true
}

// KnownHostCallback returns an ssh.HostKeyCallback enforcing TOFU (Trust On First Use) or host key pinning.
func KnownHostCallback(host *db.Host, strict bool) ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		fingerprint := ssh.FingerprintSHA256(key)
		if host == nil {
			if !strict {
				log.Printf("[SSH] WARNING: Dialing %s with nil host record. Host key: %s (FEATURE_STRICT_HOST_KEY=false)\n", hostname, fingerprint)
				return nil
			}
			return fmt.Errorf("HOST KEY VERIFICATION FAILED: host record is nil for %s", hostname)
		}

		if host.HostKeyFingerprint == "" {
			// TOFU (Trust On First Use): pin fingerprint
			host.HostKeyFingerprint = fingerprint
			log.Printf("[SSH] TOFU: Pinning host key fingerprint for host '%s' (%s): %s\n", host.Name, hostname, fingerprint)
			if db.DB != nil && host.ID != "" {
				if err := db.DB.Model(&db.Host{}).Where("id = ?", host.ID).Update("host_key_fingerprint", fingerprint).Error; err != nil {
					log.Printf("[SSH] Warning: Failed to persist host key fingerprint for host '%s': %v\n", host.ID, err)
				}
			}
			return nil
		}

		// Verify pinned fingerprint
		if host.HostKeyFingerprint != fingerprint {
			if !strict {
				log.Printf("[SSH] WARNING: HOST KEY MISMATCH for %s: expected %s, got %s (FEATURE_STRICT_HOST_KEY=false)\n",
					hostname, host.HostKeyFingerprint, fingerprint)
				return nil
			}
			return fmt.Errorf("HOST KEY MISMATCH for %s: expected %s, got %s", hostname, host.HostKeyFingerprint, fingerprint)
		}

		return nil
	}
}

// BuildAuthMethod extracts and decrypts credential to return ssh.AuthMethod
func BuildAuthMethod(cred *db.Credential, masterKey string) (ssh.AuthMethod, error) {
	if cred == nil {
		return nil, fmt.Errorf("credential is nil")
	}

	secretBytes, err := crypto.Decrypt(cred.EncryptedData, cred.Nonce, masterKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt credential: %w", err)
	}

	switch cred.Type {
	case "password":
		return ssh.Password(string(secretBytes)), nil

	case "private_key":
		if cred.EncryptedPassphrase != "" && cred.PassphraseNonce != "" {
			passphrase, err := crypto.Decrypt(cred.EncryptedPassphrase, cred.PassphraseNonce, masterKey)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt passphrase: %w", err)
			}
			signer, err := ssh.ParsePrivateKeyWithPassphrase(secretBytes, passphrase)
			if err != nil {
				return nil, fmt.Errorf("failed to parse private key with passphrase: %w", err)
			}
			return ssh.PublicKeys(signer), nil
		}

		signer, err := ssh.ParsePrivateKey(secretBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %w", err)
		}
		return ssh.PublicKeys(signer), nil

	default:
		return nil, fmt.Errorf("unsupported credential type: %s", cred.Type)
	}
}

// DialTarget connects to the remote host, optionally proxying through Jump Host
func DialTarget(info SSHConnectionInfo) (*ssh.Client, error) {
	targetHost := info.Host
	authMethod, err := BuildAuthMethod(targetHost.Credential, info.MasterKey)
	if err != nil {
		return nil, fmt.Errorf("target host auth error: %w", err)
	}

	strict := isStrictHostKeyEnabled(info)

	targetConfig := &ssh.ClientConfig{
		User:            targetHost.Username,
		Auth:            []ssh.AuthMethod{authMethod},
		HostKeyCallback: KnownHostCallback(targetHost, strict),
		Timeout:         15 * time.Second,
	}

	targetAddr := fmt.Sprintf("%s:%d", targetHost.Hostname, targetHost.Port)

	// Direct connection if no Jump Host
	if info.JumpHost == nil {
		client, err := ssh.Dial("tcp", targetAddr, targetConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to dial target %s: %w", targetAddr, err)
		}
		return client, nil
	}

	// Dial Jump Host first
	jumpAuth, err := BuildAuthMethod(info.JumpHost.Credential, info.MasterKey)
	if err != nil {
		return nil, fmt.Errorf("jump host auth error: %w", err)
	}

	jumpConfig := &ssh.ClientConfig{
		User:            info.JumpHost.Username,
		Auth:            []ssh.AuthMethod{jumpAuth},
		HostKeyCallback: KnownHostCallback(info.JumpHost, strict),
		Timeout:         15 * time.Second,
	}

	jumpAddr := fmt.Sprintf("%s:%d", info.JumpHost.Hostname, info.JumpHost.Port)
	jumpClient, err := ssh.Dial("tcp", jumpAddr, jumpConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to dial jump host %s: %w", jumpAddr, err)
	}

	// Dial target via jump host net.Conn
	conn, err := jumpClient.Dial("tcp", targetAddr)
	if err != nil {
		_ = jumpClient.Close()
		return nil, fmt.Errorf("jump host failed to dial target %s: %w", targetAddr, err)
	}

	ncc, chans, reqs, err := ssh.NewClientConn(conn, targetAddr, targetConfig)
	if err != nil {
		_ = conn.Close()
		_ = jumpClient.Close()
		return nil, fmt.Errorf("ssh handshake via jump host failed: %w", err)
	}

	return ssh.NewClient(ncc, chans, reqs), nil
}

// TestConnection tries to dial and immediately close connection
func TestConnection(info SSHConnectionInfo) error {
	client, err := DialTarget(info)
	if err != nil {
		return err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("failed to open session: %w", err)
	}
	defer session.Close()

	return nil
}
