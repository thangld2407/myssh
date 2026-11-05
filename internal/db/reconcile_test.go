package db

import (
	"testing"
	"time"
)

func TestReconcileState(t *testing.T) {
	tmpDB := t.TempDir() + "/reconcile_test.db"
	database, err := Init(tmpDB)
	if err != nil {
		t.Fatalf("Init DB failed: %v", err)
	}

	// 1. Create stale active/connecting sessions
	s1 := Session{
		ID:        "sess-stale-active",
		Status:    "active",
		HostName:  "srv-1",
		StartedAt: time.Now(),
	}
	s2 := Session{
		ID:        "sess-stale-connecting",
		Status:    "connecting",
		HostName:  "srv-2",
		StartedAt: time.Now(),
	}
	s3 := Session{
		ID:        "sess-already-closed",
		Status:    "closed",
		HostName:  "srv-3",
		StartedAt: time.Now(),
	}
	database.Create(&s1)
	database.Create(&s2)
	database.Create(&s3)

	// 2. Create stale running tunnel
	t1 := Tunnel{
		ID:       "tun-stale-running",
		Name:     "Test Tunnel",
		Status:   "running",
		BindPort: 8080,
	}
	database.Create(&t1)

	// 3. Create stale running k8s port forward
	pf1 := KubePortForward{
		ID:        "pf-stale-running",
		ClusterID: "c1",
		Status:    "running",
		LocalPort: 9090,
	}
	database.Create(&pf1)

	// Run ReconcileState
	ReconcileState(database)

	// Verify s1 and s2 became 'closed'
	var checkS1, checkS2, checkS3 Session
	database.First(&checkS1, "id = ?", s1.ID)
	database.First(&checkS2, "id = ?", s2.ID)
	database.First(&checkS3, "id = ?", s3.ID)

	if checkS1.Status != "closed" {
		t.Errorf("Expected s1 status 'closed', got %s", checkS1.Status)
	}
	if checkS2.Status != "closed" {
		t.Errorf("Expected s2 status 'closed', got %s", checkS2.Status)
	}
	if checkS3.Status != "closed" {
		t.Errorf("Expected s3 status to remain 'closed', got %s", checkS3.Status)
	}

	// Verify t1 became 'stopped'
	var checkT1 Tunnel
	database.First(&checkT1, "id = ?", t1.ID)
	if checkT1.Status != "stopped" {
		t.Errorf("Expected t1 status 'stopped', got %s", checkT1.Status)
	}

	// Verify pf1 became 'stopped'
	var checkPF1 KubePortForward
	database.First(&checkPF1, "id = ?", pf1.ID)
	if checkPF1.Status != "stopped" {
		t.Errorf("Expected pf1 status 'stopped', got %s", checkPF1.Status)
	}
}
