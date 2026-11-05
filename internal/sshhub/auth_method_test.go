package sshhub

import (
	"testing"

	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
)

func TestBuildAuthMethodPassword(t *testing.T) {
	masterKey := "super-master-key-32-bytes-test!!"
	plainPassword := "MySecretPassword123"

	encData, nonce, err := crypto.Encrypt([]byte(plainPassword), masterKey)
	if err != nil {
		t.Fatalf("Failed to encrypt: %v", err)
	}

	cred := &db.Credential{
		ID:            "cred-pass",
		Name:          "Root Password",
		Type:          "password",
		EncryptedData: encData,
		Nonce:         nonce,
	}

	authMethod, err := BuildAuthMethod(cred, masterKey)
	if err != nil {
		t.Fatalf("BuildAuthMethod failed: %v", err)
	}
	if authMethod == nil {
		t.Fatalf("Expected non-nil authMethod")
	}

	// Nil credential check
	_, err = BuildAuthMethod(nil, masterKey)
	if err == nil {
		t.Errorf("Expected error for nil credential")
	}

	// Wrong master key check
	_, err = BuildAuthMethod(cred, "wrong-master-key")
	if err == nil {
		t.Errorf("Expected decryption error for wrong master key")
	}

	// Unsupported type check
	unsupportedCred := &db.Credential{
		Type:          "unsupported_oauth",
		EncryptedData: encData,
		Nonce:         nonce,
	}
	_, err = BuildAuthMethod(unsupportedCred, masterKey)
	if err == nil {
		t.Errorf("Expected error for unsupported credential type")
	}
}

func TestBuildAuthMethodPrivateKey(t *testing.T) {
	masterKey := "super-master-key-32-bytes-test!!"

	// Generate a real Ed25519 keypair
	_, privPEM, err := crypto.GenerateEd25519KeyPair("test-key")
	if err != nil {
		t.Fatalf("GenerateEd25519KeyPair failed: %v", err)
	}

	encData, nonce, err := crypto.Encrypt([]byte(privPEM), masterKey)
	if err != nil {
		t.Fatalf("Failed to encrypt: %v", err)
	}

	cred := &db.Credential{
		ID:            "cred-key",
		Name:          "Deploy Key",
		Type:          "private_key",
		EncryptedData: encData,
		Nonce:         nonce,
	}

	authMethod, err := BuildAuthMethod(cred, masterKey)
	if err != nil {
		t.Fatalf("BuildAuthMethod failed: %v", err)
	}
	if authMethod == nil {
		t.Fatalf("Expected non-nil authMethod for private key")
	}
}
