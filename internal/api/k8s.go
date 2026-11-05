package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/myssh/myssh/internal/config"
	"github.com/myssh/myssh/internal/crypto"
	"github.com/myssh/myssh/internal/db"
	"github.com/myssh/myssh/internal/k8shub"
	"github.com/myssh/myssh/internal/sshhub"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type K8sHandler struct {
	cfg *config.Config
}

func NewK8sHandler(cfg *config.Config) *K8sHandler {
	return &K8sHandler{cfg: cfg}
}

type CreateClusterRequest struct {
	Name           string `json:"name" binding:"required"`
	Description    string `json:"description"`
	Kubeconfig     string `json:"kubeconfig" binding:"required"`
	CurrentContext string `json:"current_context"`
}

type UpdateClusterRequest struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	Kubeconfig     string `json:"kubeconfig"`
	CurrentContext string `json:"current_context"`
}

type TestClusterRequest struct {
	Kubeconfig     string `json:"kubeconfig" binding:"required"`
	CurrentContext string `json:"current_context"`
}

type ApplyYamlRequest struct {
	YAML string `json:"yaml" binding:"required"`
}

type CreatePortForwardRequest struct {
	ClusterID  string `json:"cluster_id" binding:"required"`
	Namespace  string `json:"namespace" binding:"required"`
	TargetType string `json:"target_type" binding:"required"` // pod or service
	TargetName string `json:"target_name" binding:"required"`
	LocalPort  int    `json:"local_port" binding:"required"`
	RemotePort int    `json:"remote_port" binding:"required"`
}

// Helper to decrypt kubeconfig and instantiate Clientset
func (h *K8sHandler) getClusterClientset(clusterID string) (*db.KubeCluster, *kubernetes.Clientset, *rest.Config, error) {
	var cluster db.KubeCluster
	if err := db.DB.First(&cluster, "id = ?", clusterID).Error; err != nil {
		return nil, nil, nil, fmt.Errorf("cluster not found: %w", err)
	}

	kubeconfigBytes, err := crypto.Decrypt(cluster.EncryptedData, cluster.Nonce, h.cfg.MasterKey)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to decrypt kubeconfig: %w", err)
	}

	clientset, restConfig, err := k8shub.BuildClientset(kubeconfigBytes, cluster.CurrentContext)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to initialize cluster client: %w", err)
	}

	return &cluster, clientset, restConfig, nil
}

// ListClusters returns all registered Kubernetes clusters
func (h *K8sHandler) ListClusters(c *gin.Context) {
	var clusters []db.KubeCluster
	if err := db.DB.Order("created_at desc").Find(&clusters).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list clusters"})
		return
	}
	c.JSON(http.StatusOK, clusters)
}

// TestCluster tests raw kubeconfig connectivity before saving
func (h *K8sHandler) TestCluster(c *gin.Context) {
	var req TestClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	res, err := k8shub.TestKubeconfig([]byte(req.Kubeconfig), req.CurrentContext)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cluster connectivity test failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// CreateCluster securely encrypts Kubeconfig and registers new cluster
func (h *K8sHandler) CreateCluster(c *gin.Context) {
	var req CreateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Test kubeconfig first to ensure valid data and retrieve server version
	res, err := k8shub.TestKubeconfig([]byte(req.Kubeconfig), req.CurrentContext)
	serverVersion := "unknown"
	currentCtx := req.CurrentContext
	if err == nil {
		serverVersion = res.ServerVersion
		if currentCtx == "" {
			currentCtx = res.CurrentContext
		}
	}

	// Encrypt kubeconfig
	encryptedData, nonce, err := crypto.Encrypt([]byte(req.Kubeconfig), h.cfg.MasterKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Encryption error: " + err.Error()})
		return
	}

	cluster := db.KubeCluster{
		ID:             uuid.New().String(),
		Name:           req.Name,
		Description:    req.Description,
		CurrentContext: currentCtx,
		EncryptedData:  encryptedData,
		Nonce:          nonce,
		ServerVersion:  serverVersion,
		Status:         "ready",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := db.DB.Create(&cluster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save cluster: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cluster)
}

// GetCluster returns cluster metadata and available contexts
func (h *K8sHandler) GetCluster(c *gin.Context) {
	id := c.Param("id")
	var cluster db.KubeCluster
	if err := db.DB.First(&cluster, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cluster not found"})
		return
	}

	kubeconfigBytes, err := crypto.Decrypt(cluster.EncryptedData, cluster.Nonce, h.cfg.MasterKey)
	contexts := []string{}
	if err == nil {
		if testRes, err := k8shub.TestKubeconfig(kubeconfigBytes, cluster.CurrentContext); err == nil {
			contexts = testRes.Contexts
			cluster.ServerVersion = testRes.ServerVersion
			cluster.Status = "ready"
			db.DB.Model(&cluster).Updates(map[string]interface{}{
				"server_version": testRes.ServerVersion,
				"status":         "ready",
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"cluster":  cluster,
		"contexts": contexts,
	})
}

// UpdateCluster updates cluster details, context or kubeconfig
func (h *K8sHandler) UpdateCluster(c *gin.Context) {
	id := c.Param("id")
	var cluster db.KubeCluster
	if err := db.DB.First(&cluster, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cluster not found"})
		return
	}

	var req UpdateClusterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if req.Name != "" {
		cluster.Name = req.Name
	}
	cluster.Description = req.Description
	if req.CurrentContext != "" {
		cluster.CurrentContext = req.CurrentContext
	}

	if req.Kubeconfig != "" {
		res, err := k8shub.TestKubeconfig([]byte(req.Kubeconfig), cluster.CurrentContext)
		if err == nil {
			cluster.ServerVersion = res.ServerVersion
			cluster.Status = "ready"
		}
		encryptedData, nonce, err := crypto.Encrypt([]byte(req.Kubeconfig), h.cfg.MasterKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Encryption error: " + err.Error()})
			return
		}
		cluster.EncryptedData = encryptedData
		cluster.Nonce = nonce
	}
	cluster.UpdatedAt = time.Now()

	if err := db.DB.Save(&cluster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cluster: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, cluster)
}

// DeleteCluster removes cluster and terminates port forwards
func (h *K8sHandler) DeleteCluster(c *gin.Context) {
	id := c.Param("id")

	// Stop any active port forwards
	var pfs []db.KubePortForward
	db.DB.Where("cluster_id = ?", id).Find(&pfs)
	for _, pf := range pfs {
		_ = k8shub.GlobalPFManager.Stop(pf.ID)
	}
	db.DB.Where("cluster_id = ?", id).Delete(&db.KubePortForward{})

	if err := db.DB.Delete(&db.KubeCluster{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete cluster"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cluster deleted successfully"})
}

// ListNamespaces lists all namespaces in the cluster
func (h *K8sHandler) ListNamespaces(c *gin.Context) {
	clusterID := c.Param("id")
	_, cs, _, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	namespaces, err := k8shub.GetNamespaces(ctx, cs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

// ListNodes lists nodes in cluster
func (h *K8sHandler) ListNodes(c *gin.Context) {
	clusterID := c.Param("id")
	_, cs, _, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	nodes, err := k8shub.GetNodes(ctx, cs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, nodes)
}

// ListPods lists pods optionally filtered by namespace
func (h *K8sHandler) ListPods(c *gin.Context) {
	clusterID := c.Param("id")
	namespace := c.Query("namespace")

	_, cs, _, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	pods, err := k8shub.GetPods(ctx, cs, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pods)
}

// ListDeployments lists deployments
func (h *K8sHandler) ListDeployments(c *gin.Context) {
	clusterID := c.Param("id")
	namespace := c.Query("namespace")

	_, cs, _, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	deployments, err := k8shub.GetDeployments(ctx, cs, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

// ListServices lists services
func (h *K8sHandler) ListServices(c *gin.Context) {
	clusterID := c.Param("id")
	namespace := c.Query("namespace")

	_, cs, _, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	services, err := k8shub.GetServices(ctx, cs, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

// GetYAML retrieves resource manifest
func (h *K8sHandler) GetYAML(c *gin.Context) {
	clusterID := c.Param("id")
	kind := c.Query("kind")
	namespace := c.Query("namespace")
	name := c.Query("name")

	if kind == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind and name query parameters are required"})
		return
	}

	_, _, restConfig, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	yamlContent, err := k8shub.GetResourceYAML(ctx, restConfig, kind, namespace, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"yaml": yamlContent})
}

// ApplyYAML applies updated manifest
func (h *K8sHandler) ApplyYAML(c *gin.Context) {
	clusterID := c.Param("id")
	var req ApplyYamlRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	_, _, restConfig, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	if err := k8shub.ApplyResourceYAML(ctx, restConfig, req.YAML); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply YAML: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Resource applied successfully"})
}

// DeleteResource deletes specified resource
func (h *K8sHandler) DeleteResource(c *gin.Context) {
	clusterID := c.Param("id")
	kind := c.Query("kind")
	namespace := c.Query("namespace")
	name := c.Query("name")

	if kind == "" || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kind and name query parameters are required"})
		return
	}

	_, _, restConfig, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	if err := k8shub.DeleteResource(ctx, restConfig, kind, namespace, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete resource: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Resource deleted successfully"})
}

// GetPodLogs streams container logs
func (h *K8sHandler) GetPodLogs(c *gin.Context) {
	clusterID := c.Param("id")
	podName := c.Param("name")
	namespace := c.DefaultQuery("namespace", "default")
	container := c.Query("container")
	tailStr := c.DefaultQuery("tail", "200")
	follow := c.DefaultQuery("follow", "false") == "true"

	var tailLines *int64
	if tailStr != "all" {
		if t, err := strconv.ParseInt(tailStr, 10, 64); err == nil {
			tailLines = &t
		}
	}

	_, cs, _, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Transfer-Encoding", "chunked")
	c.Header("X-Content-Type-Options", "nosniff")

	opts := k8shub.PodLogOptions{
		Namespace:  namespace,
		PodName:    podName,
		Container:  container,
		TailLines:  tailLines,
		Follow:     follow,
		Timestamps: true,
	}

	err = k8shub.StreamPodLogs(c.Request.Context(), cs, opts, c.Writer)
	if err != nil && err != context.Canceled {
		_, _ = c.Writer.Write([]byte(fmt.Sprintf("\n[Error streaming logs: %v]\n", err)))
	}
}

// PodExec handles interactive WebSocket terminal into Pod container
func (h *K8sHandler) PodExec(c *gin.Context) {
	clusterID := c.Param("id")
	podName := c.Param("name")
	namespace := c.DefaultQuery("namespace", "default")
	container := c.Query("container")
	shellCmd := c.DefaultQuery("command", "/bin/sh")

	_, cs, restConfig, err := h.getClusterClientset(clusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			var allowed []string
			if h.cfg != nil {
				allowed = h.cfg.AllowedOrigins
			}
			return sshhub.IsOriginAllowed(r, allowed)
		},
		ReadBufferSize:  4096,
		WriteBufferSize: 4096,
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	commands := strings.Split(shellCmd, " ")
	err = k8shub.HandlePodExec(cs, restConfig, ws, namespace, podName, container, commands)
	if err != nil {
		_ = ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("\r\n[Session ended: %v]\r\n", err)))
	}
}

// ListPortForwards returns port forward list with live status
func (h *K8sHandler) ListPortForwards(c *gin.Context) {
	var pfs []db.KubePortForward
	clusterID := c.Query("cluster_id")
	q := db.DB.Order("created_at desc")
	if clusterID != "" {
		q = q.Where("cluster_id = ?", clusterID)
	}
	if err := q.Find(&pfs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list port forwards"})
		return
	}

	// Update live status from manager
	for i := range pfs {
		if k8shub.GlobalPFManager.IsRunning(pfs[i].ID) {
			pfs[i].Status = "running"
		} else if pfs[i].Status == "running" {
			pfs[i].Status = "stopped"
		}
	}

	c.JSON(http.StatusOK, pfs)
}

// CreatePortForward saves a new port forward configuration
func (h *K8sHandler) CreatePortForward(c *gin.Context) {
	var req CreatePortForwardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	pf := db.KubePortForward{
		ID:         uuid.New().String(),
		ClusterID:  req.ClusterID,
		Namespace:  req.Namespace,
		TargetType: req.TargetType,
		TargetName: req.TargetName,
		LocalPort:  req.LocalPort,
		RemotePort: req.RemotePort,
		Status:     "stopped",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := db.DB.Create(&pf).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create port forward: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pf)
}

// StartPortForward starts active forwarding tunnel
func (h *K8sHandler) StartPortForward(c *gin.Context) {
	id := c.Param("id")
	var pf db.KubePortForward
	if err := db.DB.First(&pf, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Port forward not found"})
		return
	}

	_, cs, restConfig, err := h.getClusterClientset(pf.ClusterID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = k8shub.GlobalPFManager.Start(cs, restConfig, pf.ID, pf.ClusterID, pf.Namespace, pf.TargetType, pf.TargetName, pf.LocalPort, pf.RemotePort)
	if err != nil {
		pf.Status = "error"
		db.DB.Save(&pf)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start port forward: " + err.Error()})
		return
	}

	pf.Status = "running"
	db.DB.Save(&pf)

	c.JSON(http.StatusOK, pf)
}

// StopPortForward stops active forwarding tunnel
func (h *K8sHandler) StopPortForward(c *gin.Context) {
	id := c.Param("id")
	var pf db.KubePortForward
	if err := db.DB.First(&pf, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Port forward not found"})
		return
	}

	_ = k8shub.GlobalPFManager.Stop(pf.ID)
	pf.Status = "stopped"
	db.DB.Save(&pf)

	c.JSON(http.StatusOK, pf)
}

// DeletePortForward removes port forward
func (h *K8sHandler) DeletePortForward(c *gin.Context) {
	id := c.Param("id")
	_ = k8shub.GlobalPFManager.Stop(id)

	if err := db.DB.Delete(&db.KubePortForward{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete port forward"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Port forward deleted"})
}
