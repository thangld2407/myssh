package sshhub

import (
	"fmt"
	"time"

	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
	"golang.org/x/crypto/ssh"
)

type SSHConnectionInfo struct {
	Host     *db.Host
	JumpHost *db.Host
	MasterKey string
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

	targetConfig := &ssh.ClientConfig{
		User:            targetHost.Username,
		Auth:            []ssh.AuthMethod{authMethod},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // In production, known_hosts can be verified
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
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
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
