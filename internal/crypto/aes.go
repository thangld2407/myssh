package crypto

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"sync"

	"golang.org/x/crypto/argon2"
)

var (
	saltMu         sync.RWMutex
	currentKDFSalt = []byte("myssh-secure-salt-v1")
	legacyKDFSalt  = []byte("myssh-secure-salt-v1")

	keyCacheMu sync.RWMutex
	keyCache   = make(map[string][]byte)
)

// ResetKeyCache clears the in-memory derived key cache (used primarily for benchmarking/testing).
func ResetKeyCache() {
	keyCacheMu.Lock()
	defer keyCacheMu.Unlock()
	keyCache = make(map[string][]byte)
}

// SetKDFSalt updates the per-installation KDF salt used for Argon2id key derivation.
func SetKDFSalt(salt []byte) {
	saltMu.Lock()
	defer saltMu.Unlock()
	if len(salt) > 0 {
		currentKDFSalt = make([]byte, len(salt))
		copy(currentKDFSalt, salt)
	}
}

// GetKDFSalt returns a copy of the current KDF salt.
func GetKDFSalt() []byte {
	saltMu.RLock()
	defer saltMu.RUnlock()
	salt := make([]byte, len(currentKDFSalt))
	copy(salt, currentKDFSalt)
	return salt
}

// deriveKey derives a 32-byte AES key using Argon2id and the provided salt.
// Results are cached in-memory to prevent repeated ~75ms Argon2id CPU/RAM derivations (F07).
func deriveKey(masterKey string, salt []byte) []byte {
	cacheKey := string(salt) + "\x00" + masterKey

	keyCacheMu.RLock()
	cached, ok := keyCache[cacheKey]
	keyCacheMu.RUnlock()
	if ok {
		return cached
	}

	derived := argon2.IDKey([]byte(masterKey), salt, 3, 64*1024, 2, 32)

	keyCacheMu.Lock()
	keyCache[cacheKey] = derived
	keyCacheMu.Unlock()

	return derived
}

// Encrypt encrypts plaintext using AES-256-GCM with a derived key from masterKey.
// Returns base64 encoded ciphertext and base64 encoded nonce.
func Encrypt(plaintext []byte, masterKey string) (string, string, error) {
	key := deriveKey(masterKey, GetKDFSalt())
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
// If decryption fails and current KDF salt is not the legacy salt, it falls back
// to the legacy salt to seamlessly support existing databases.
func Decrypt(cipherB64, nonceB64, masterKey string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(cipherB64)
	if err != nil {
		return nil, errors.New("invalid base64 ciphertext")
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceB64)
	if err != nil {
		return nil, errors.New("invalid base64 nonce")
	}

	activeSalt := GetKDFSalt()
	key := deriveKey(masterKey, activeSalt)
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
	if err == nil {
		return plaintext, nil
	}

	// Migration fallback: If decryption failed with current salt, try legacy fixed salt
	if !bytes.Equal(activeSalt, legacyKDFSalt) {
		legacyKey := deriveKey(masterKey, legacyKDFSalt)
		legBlock, legErr := aes.NewCipher(legacyKey)
		if legErr == nil {
			legGCM, legErr := cipher.NewGCM(legBlock)
			if legErr == nil {
				if legPlaintext, legErr := legGCM.Open(nil, nonce, ciphertext, nil); legErr == nil {
					return legPlaintext, nil
				}
			}
		}
	}

	return nil, errors.New("decryption failed or data tampered")
}
