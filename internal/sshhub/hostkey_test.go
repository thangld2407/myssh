package sshhub

import (
	"crypto/ed25519"
	"crypto/rand"
	"net"
	"strings"
	"testing"

	"github.com/myssh/myssh/internal/db"
	"golang.org/x/crypto/ssh"
)

func generateTestSSHPublicKey(t *testing.T) ssh.PublicKey {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("Failed to generate test ed25519 key: %v", err)
	}
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatalf("Failed to convert to ssh.PublicKey: %v", err)
	}
	return sshPub
}

func TestKnownHostCallback_TOFUAndPinning(t *testing.T) {
	keyA := generateTestSSHPublicKey(t)
	keyB := generateTestSSHPublicKey(t)
	fpA := ssh.FingerprintSHA256(keyA)
	fpB := ssh.FingerprintSHA256(keyB)

	dummyAddr, _ := net.ResolveTCPAddr("tcp", "192.168.1.50:22")

	// 1. First connection: TOFU pins the host key
	host := &db.Host{
		ID:                 "host-test-1",
		Name:               "Test Host",
		Hostname:           "192.168.1.50",
		Port:               22,
		HostKeyFingerprint: "", // Empty initial fingerprint
	}

	callbackStrict := KnownHostCallback(host, true)

	err := callbackStrict("192.168.1.50:22", dummyAddr, keyA)
	if err != nil {
		t.Fatalf("First connection (TOFU) should succeed, got error: %v", err)
	}
	if host.HostKeyFingerprint != fpA {
		t.Fatalf("Expected TOFU to pin fingerprint %s, got %s", fpA, host.HostKeyFingerprint)
	}

	// 2. Second connection with the SAME key -> Must succeed
	err = callbackStrict("192.168.1.50:22", dummyAddr, keyA)
	if err != nil {
		t.Fatalf("Subsequent connection with identical key must succeed, got: %v", err)
	}

	// 3. Third connection with a DIFFERENT key -> Must fail with HOST KEY MISMATCH in strict mode
	err = callbackStrict("192.168.1.50:22", dummyAddr, keyB)
	if err == nil {
		t.Fatalf("Connection with altered host key must fail, but succeeded")
	}
	if !strings.Contains(err.Error(), "HOST KEY MISMATCH") {
		t.Fatalf("Expected HOST KEY MISMATCH error, got: %v", err)
	}
	if !strings.Contains(err.Error(), fpA) || !strings.Contains(err.Error(), fpB) {
		t.Fatalf("Error message should include expected and actual fingerprints: %v", err)
	}

	// 4. Non-strict mode (FEATURE_STRICT_HOST_KEY=false) -> Logs warning, permits mismatch
	callbackLenient := KnownHostCallback(host, false)
	err = callbackLenient("192.168.1.50:22", dummyAddr, keyB)
	if err != nil {
		t.Fatalf("Lenient mode should allow connection with warning, got error: %v", err)
	}
}

func TestResetFingerprint(t *testing.T) {
	keyA := generateTestSSHPublicKey(t)
	keyB := generateTestSSHPublicKey(t)
	fpB := ssh.FingerprintSHA256(keyB)
	dummyAddr, _ := net.ResolveTCPAddr("tcp", "192.168.1.50:22")

	host := &db.Host{
		ID:                 "host-test-reset",
		Name:               "Test Host Reset",
		Hostname:           "192.168.1.50",
		Port:               22,
		HostKeyFingerprint: "",
	}

	callback := KnownHostCallback(host, true)
	// Pin key A
	if err := callback("192.168.1.50:22", dummyAddr, keyA); err != nil {
		t.Fatalf("TOFU failed: %v", err)
	}

	// Simulate user clicking "Reset Fingerprint"
	host.HostKeyFingerprint = ""

	// Next connection with key B should now TOFU pin key B!
	if err := callback("192.168.1.50:22", dummyAddr, keyB); err != nil {
		t.Fatalf("After reset, connection with key B should succeed via TOFU, got: %v", err)
	}
	if host.HostKeyFingerprint != fpB {
		t.Fatalf("Expected new pinned fingerprint %s, got %s", fpB, host.HostKeyFingerprint)
	}
}
