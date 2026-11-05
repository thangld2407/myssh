package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/db"
)

const sampleKubeconfig = `apiVersion: v1
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
    token: test-token-123
`

func TestK8sClusterAndPortForwardCRUD(t *testing.T) {
	setupTestDB(t)
	db.DB.Exec("DELETE FROM kube_port_forwards")
	db.DB.Exec("DELETE FROM kube_clusters")

	cfg := &config.Config{
		MasterKey: "test-master-key-32-bytes-long!!",
	}
	handler := NewK8sHandler(cfg)

	r := gin.New()
	r.GET("/api/k8s/clusters", handler.ListClusters)
	r.POST("/api/k8s/clusters", handler.CreateCluster)
	r.POST("/api/k8s/clusters/test", handler.TestCluster)
	r.GET("/api/k8s/clusters/:id", handler.GetCluster)
	r.PUT("/api/k8s/clusters/:id", handler.UpdateCluster)
	r.DELETE("/api/k8s/clusters/:id", handler.DeleteCluster)

	r.GET("/api/k8s/portforwards", handler.ListPortForwards)
	r.POST("/api/k8s/portforwards", handler.CreatePortForward)
	r.DELETE("/api/k8s/portforwards/:id", handler.DeletePortForward)

	// 1. Create a Cluster
	createReq := CreateClusterRequest{
		Name:           "Dev Cluster",
		Description:    "Local K3s Development Cluster",
		Kubeconfig:     sampleKubeconfig,
		CurrentContext: "test-context",
	}
	body, _ := json.Marshal(createReq)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/k8s/clusters", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created db.KubeCluster
	json.Unmarshal(w.Body.Bytes(), &created)
	if created.ID == "" || created.Name != "Dev Cluster" {
		t.Fatalf("Unexpected cluster created: %+v", created)
	}

	// 2. List Clusters
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/k8s/clusters", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var clusterList []db.KubeCluster
	json.Unmarshal(w.Body.Bytes(), &clusterList)
	if len(clusterList) != 1 {
		t.Fatalf("Expected 1 cluster, got %d", len(clusterList))
	}

	// 3. Update Cluster
	updateReq := UpdateClusterRequest{
		Name:        "Dev Cluster Updated",
		Description: "Updated description",
	}
	body, _ = json.Marshal(updateReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("PUT", "/api/k8s/clusters/"+created.ID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on update, got %d", w.Code)
	}

	// 4. Create Port Forward
	pfReq := CreatePortForwardRequest{
		ClusterID:  created.ID,
		Namespace:  "default",
		TargetType: "service",
		TargetName: "redis-master",
		LocalPort:  16379,
		RemotePort: 6379,
	}
	body, _ = json.Marshal(pfReq)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/api/k8s/portforwards", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created on portforward, got %d: %s", w.Code, w.Body.String())
	}

	var createdPF db.KubePortForward
	json.Unmarshal(w.Body.Bytes(), &createdPF)

	// 5. List Port Forwards
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/api/k8s/portforwards?cluster_id="+created.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", w.Code)
	}
	var pfList []db.KubePortForward
	json.Unmarshal(w.Body.Bytes(), &pfList)
	if len(pfList) != 1 {
		t.Fatalf("Expected 1 port forward, got %d", len(pfList))
	}

	// 6. Delete Port Forward
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/k8s/portforwards/"+createdPF.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on delete pf, got %d", w.Code)
	}

	// 7. Delete Cluster
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("DELETE", "/api/k8s/clusters/"+created.ID, nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on delete cluster, got %d", w.Code)
	}
}
