package crypto

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"
	"strings"

	"golang.org/x/crypto/ssh"
)

// GenerateEd25519KeyPair generates an Ed25519 SSH keypair.
// Returns the authorized public key string and the PEM formatted private key string.
func GenerateEd25519KeyPair(comment string) (publicKeyAuthorized, privateKeyPEM string, err error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate ed25519 key: %w", err)
	}

	// Generate OpenSSH authorized public key
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		return "", "", fmt.Errorf("failed to create ssh public key: %w", err)
	}

	if comment == "" {
		comment = "myssh-generated-key"
	}
	publicKeyAuthorized = strings.TrimSpace(string(ssh.MarshalAuthorizedKey(sshPub))) + " " + comment

	// Marshal private key using PKCS#8 or OpenSSH format
	privBytes, err := ssh.MarshalPrivateKey(priv, comment)
	if err != nil {
		return "", "", fmt.Errorf("failed to marshal private key: %w", err)
	}

	privateKeyPEM = string(pem.EncodeToMemory(privBytes))
	return publicKeyAuthorized, privateKeyPEM, nil
}
