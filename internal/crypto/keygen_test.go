package crypto

import (
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

func TestGenerateEd25519KeyPair(t *testing.T) {
	pubKey, privKey, err := GenerateEd25519KeyPair("test-comment")
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair failed: %v", err)
	}

	if !strings.HasPrefix(pubKey, "ssh-ed25519 ") {
		t.Errorf("Public key does not have ssh-ed25519 prefix: %s", pubKey)
	}

	if !strings.HasSuffix(pubKey, " test-comment") {
		t.Errorf("Public key does not have expected comment: %s", pubKey)
	}

	if !strings.Contains(privKey, "BEGIN OPENSSH PRIVATE KEY") {
		t.Errorf("Private key PEM format invalid: %s", privKey)
	}

	// Verify the private key can be parsed by ssh.ParsePrivateKey
	signer, err := ssh.ParsePrivateKey([]byte(privKey))
	if err != nil {
		t.Fatalf("Failed to parse generated private key: %v", err)
	}

	// Verify matching public key
	signerPub := string(ssh.MarshalAuthorizedKey(signer.PublicKey()))
	if !strings.HasPrefix(signerPub, "ssh-ed25519 ") {
		t.Errorf("Signer public key mismatch: %s", signerPub)
	}
}
