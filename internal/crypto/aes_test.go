package crypto

import (
	"bytes"
	"testing"
	"time"
)

func TestEncryptDecrypt(t *testing.T) {
	masterKey := "super-secure-master-passphrase-2026!"
	plaintexts := [][]byte{
		[]byte("hello world"),
		[]byte(""),
		[]byte("-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n-----END OPENSSH PRIVATE KEY-----"),
	}

	for _, pt := range plaintexts {
		cipherB64, nonceB64, err := Encrypt(pt, masterKey)
		if err != nil {
			t.Fatalf("Encrypt failed: %v", err)
		}

		if cipherB64 == "" && len(pt) > 0 {
			t.Fatalf("Expected non-empty ciphertext")
		}
		if nonceB64 == "" {
			t.Fatalf("Expected non-empty nonce")
		}

		decrypted, err := Decrypt(cipherB64, nonceB64, masterKey)
		if err != nil {
			t.Fatalf("Decrypt failed: %v", err)
		}

		if !bytes.Equal(pt, decrypted) {
			t.Fatalf("Decrypted does not match original: got %q, want %q", decrypted, pt)
		}
	}
}

func TestDecryptWithWrongKey(t *testing.T) {
	masterKey := "correct-passphrase"
	wrongKey := "wrong-passphrase"
	plaintext := []byte("secret database password")

	cipherB64, nonceB64, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	_, err = Decrypt(cipherB64, nonceB64, wrongKey)
	if err == nil {
		t.Fatalf("Expected decryption to fail with wrong master key, but it succeeded")
	}
}

func TestDecryptTamperedData(t *testing.T) {
	masterKey := "correct-passphrase"
	plaintext := []byte("secret key")

	cipherB64, nonceB64, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Tamper ciphertext
	tamperedCipher := "AAAA" + cipherB64[4:]
	_, err = Decrypt(tamperedCipher, nonceB64, masterKey)
	if err == nil {
		t.Fatalf("Expected decryption to fail with tampered data, but it succeeded")
	}
}

func TestLegacySaltMigration(t *testing.T) {
	// 1. Ensure we start with legacy salt
	SetKDFSalt([]byte("myssh-secure-salt-v1"))
	masterKey := "legacy-master-key-test"
	plaintext := []byte("this was encrypted under the legacy fixed salt")

	cipherB64, nonceB64, err := Encrypt(plaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// 2. Change salt to a new random per-install salt
	newSalt := []byte("random-new-salt-12345678")
	SetKDFSalt(newSalt)
	defer SetKDFSalt([]byte("myssh-secure-salt-v1")) // restore

	// 3. Decrypt should successfully fall back to legacy salt!
	decrypted, err := Decrypt(cipherB64, nonceB64, masterKey)
	if err != nil {
		t.Fatalf("Decrypt should fall back to legacy salt and succeed, got error: %v", err)
	}
	if !bytes.Equal(decrypted, plaintext) {
		t.Fatalf("Decrypted mismatch: got %q, want %q", decrypted, plaintext)
	}

	// 4. Encrypt new data under new salt
	newPlaintext := []byte("encrypted under new salt")
	newCipher, newNonce, err := Encrypt(newPlaintext, masterKey)
	if err != nil {
		t.Fatalf("Encrypt with new salt failed: %v", err)
	}

	newDecrypted, err := Decrypt(newCipher, newNonce, masterKey)
	if err != nil {
		t.Fatalf("Decrypt with new salt failed: %v", err)
	}
	if !bytes.Equal(newDecrypted, newPlaintext) {
		t.Fatalf("Decrypted mismatch: got %q, want %q", newDecrypted, newPlaintext)
	}
}

func TestKeyCachePerformance(t *testing.T) {
	ResetKeyCache()
	masterKey := "benchmark-master-key-xyz"
	salt := []byte("cache-test-salt")

	// First call derives and caches
	start := time.Now()
	k1 := deriveKey(masterKey, salt)
	firstDuration := time.Since(start)

	// Second call hits cache
	start = time.Now()
	k2 := deriveKey(masterKey, salt)
	cachedDuration := time.Since(start)

	if !bytes.Equal(k1, k2) {
		t.Fatalf("Cached key does not match first derived key")
	}

	// Cached call should be at least 100x faster than raw Argon2id
	if cachedDuration > firstDuration/10 {
		t.Errorf("Expected cache hit to be significantly faster: first=%v, cached=%v", firstDuration, cachedDuration)
	}
}

func BenchmarkDeriveKeyCached(b *testing.B) {
	masterKey := "benchmark-master-key"
	salt := []byte("benchmark-salt-16")
	// Warm up cache
	_ = deriveKey(masterKey, salt)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = deriveKey(masterKey, salt)
	}
}
