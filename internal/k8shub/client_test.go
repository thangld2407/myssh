package k8shub

import (
	"testing"
)

const validKubeconfig = `apiVersion: v1
clusters:
- cluster:
    server: https://127.0.0.1:6443
    insecure-skip-tls-verify: true
  name: test-cluster
contexts:
- context:
    cluster: test-cluster
    user: test-admin
  name: test-context
current-context: test-context
kind: Config
preferences: {}
users:
- name: test-admin
  user:
    token: test-token
`

func TestBuildRestConfigAndClientset(t *testing.T) {
	cfg, err := BuildRestConfig([]byte(validKubeconfig), "")
	if err != nil {
		t.Fatalf("Failed to build rest config: %v", err)
	}
	if cfg.Host != "https://127.0.0.1:6443" {
		t.Fatalf("Expected host https://127.0.0.1:6443, got %s", cfg.Host)
	}

	cs, _, err := BuildClientset([]byte(validKubeconfig), "test-context")
	if err != nil {
		t.Fatalf("Failed to build clientset: %v", err)
	}
	if cs == nil {
		t.Fatal("Clientset is nil")
	}
}

func TestBuildRestConfigInvalid(t *testing.T) {
	_, err := BuildRestConfig([]byte("invalid-yaml-content"), "")
	if err == nil {
		t.Fatal("Expected error for invalid kubeconfig, got nil")
	}
}
