package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/argon2"
)

// Salt used for deriving the 32-byte key from master passphrase
var kdfSalt = []byte("myssh-secure-salt-v1")

// deriveKey derives a 32-byte AES key using Argon2id
func deriveKey(masterKey string) []byte {
	return argon2.IDKey([]byte(masterKey), kdfSalt, 3, 64*1024, 2, 32)
}

// Encrypt encrypts plaintext using AES-256-GCM with a derived key from masterKey.
// Returns base64 encoded ciphertext and base64 encoded nonce.
func Encrypt(plaintext []byte, masterKey string) (string, string, error) {
	key := deriveKey(masterKey)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", err
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), base64.StdEncoding.EncodeToString(nonce), nil
}

// Decrypt decrypts base64 encoded ciphertext and nonce using AES-256-GCM.
func Decrypt(cipherB64, nonceB64, masterKey string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(cipherB64)
	if err != nil {
		return nil, errors.New("invalid base64 ciphertext")
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceB64)
	if err != nil {
		return nil, errors.New("invalid base64 nonce")
	}

	key := deriveKey(masterKey)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(nonce) != gcm.NonceSize() {
		return nil, errors.New("invalid nonce size")
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed or data tampered")
	}

	return plaintext, nil
}
