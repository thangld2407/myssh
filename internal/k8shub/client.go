package k8shub

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// TestResult holds verification details for a kubeconfig
type TestResult struct {
	ServerVersion  string   `json:"server_version"`
	NodeCount      int      `json:"node_count"`
	Contexts       []string `json:"contexts"`
	CurrentContext string   `json:"current_context"`
}

// BuildRestConfig parses raw kubeconfig bytes and builds rest.Config
func BuildRestConfig(kubeconfigData []byte, contextName string) (*rest.Config, error) {
	clientConfig, err := clientcmd.NewClientConfigFromBytes(kubeconfigData)
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	rawCfg, err := clientConfig.RawConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to load raw config: %w", err)
	}

	overrides := &clientcmd.ConfigOverrides{}
	if contextName != "" {
		overrides.CurrentContext = contextName
	} else if rawCfg.CurrentContext != "" {
		overrides.CurrentContext = rawCfg.CurrentContext
	}

	restConfig, err := clientcmd.NewNonInteractiveClientConfig(rawCfg, overrides.CurrentContext, overrides, nil).ClientConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to build rest config: %w", err)
	}

	// Set reasonable timeout for API requests
	restConfig.Timeout = 15 * time.Second

	return restConfig, nil
}

// BuildClientset creates a kubernetes.Clientset from kubeconfig bytes
func BuildClientset(kubeconfigData []byte, contextName string) (*kubernetes.Clientset, *rest.Config, error) {
	restConfig, err := BuildRestConfig(kubeconfigData, contextName)
	if err != nil {
		return nil, nil, err
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create kubernetes clientset: %w", err)
	}

	return clientset, restConfig, nil
}

// TestKubeconfig tests connection to Kubernetes API and extracts cluster summary
func TestKubeconfig(kubeconfigData []byte, contextName string) (*TestResult, error) {
	clientConfig, err := clientcmd.NewClientConfigFromBytes(kubeconfigData)
	if err != nil {
		return nil, fmt.Errorf("invalid kubeconfig format: %w", err)
	}

	rawCfg, err := clientConfig.RawConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to inspect raw kubeconfig: %w", err)
	}

	var contexts []string
	for name := range rawCfg.Contexts {
		contexts = append(contexts, name)
	}

	effectiveContext := contextName
	if effectiveContext == "" {
		effectiveContext = rawCfg.CurrentContext
	}

	clientset, _, err := BuildClientset(kubeconfigData, effectiveContext)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Get Server Version
	versionInfo, err := clientset.Discovery().ServerVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to contact cluster API: %w", err)
	}

	// Try listing nodes (if RBAC permits)
	nodeCount := 0
	nodes, err := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{Limit: 50})
	if err == nil {
		nodeCount = len(nodes.Items)
	}

	return &TestResult{
		ServerVersion:  versionInfo.GitVersion,
		NodeCount:      nodeCount,
		Contexts:       contexts,
		CurrentContext: effectiveContext,
	}, nil
}
