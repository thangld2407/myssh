package k8shub

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

type ActivePortForward struct {
	ID         string
	ClusterID  string
	Namespace  string
	TargetType string
	TargetName string
	LocalPort  int
	RemotePort int
	StopChan   chan struct{}
	ReadyChan  chan struct{}
	Error      error
}

type PortForwardManager struct {
	mu        sync.RWMutex
	forwarders map[string]*ActivePortForward
}

var GlobalPFManager = &PortForwardManager{
	forwarders: make(map[string]*ActivePortForward),
}

// Start launches a background port forward session
func (m *PortForwardManager) Start(
	cs *kubernetes.Clientset,
	restConfig *rest.Config,
	id, clusterID, namespace, targetType, targetName string,
	localPort, remotePort int,
) error {
	m.mu.Lock()
	if _, exists := m.forwarders[id]; exists {
		m.mu.Unlock()
		return fmt.Errorf("port forward '%s' is already running", id)
	}
	m.mu.Unlock()

	// If target is service, find a healthy pod behind the service
	podName := targetName
	if strings.ToLower(targetType) == "service" || strings.ToLower(targetType) == "svc" {
		svc, err := cs.CoreV1().Services(namespace).Get(context.Background(), targetName, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("service '%s' not found: %w", targetName, err)
		}
		if len(svc.Spec.Selector) == 0 {
			return fmt.Errorf("service '%s' has no pod selectors", targetName)
		}

		var selectors []string
		for k, v := range svc.Spec.Selector {
			selectors = append(selectors, fmt.Sprintf("%s=%s", k, v))
		}
		podList, err := cs.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: strings.Join(selectors, ","),
		})
		if err != nil || len(podList.Items) == 0 {
			return fmt.Errorf("no active pods found backing service '%s'", targetName)
		}

		// Find first running pod
		found := false
		for _, p := range podList.Items {
			if p.Status.Phase == corev1.PodRunning {
				podName = p.Name
				found = true
				break
			}
		}
		if !found {
			podName = podList.Items[0].Name
		}
	}

	req := cs.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(podName).
		SubResource("portforward")

	transport, upgrader, err := spdy.RoundTripperFor(restConfig)
	if err != nil {
		return fmt.Errorf("failed to create SPDY round tripper: %w", err)
	}

	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, http.MethodPost, req.URL())

	stopChan := make(chan struct{})
	readyChan := make(chan struct{})

	ports := []string{fmt.Sprintf("%d:%d", localPort, remotePort)}
	pf, err := portforward.New(dialer, ports, stopChan, readyChan, io.Discard, io.Discard)
	if err != nil {
		return fmt.Errorf("failed to initialize port forwarder: %w", err)
	}

	apf := &ActivePortForward{
		ID:         id,
		ClusterID:  clusterID,
		Namespace:  namespace,
		TargetType: targetType,
		TargetName: targetName,
		LocalPort:  localPort,
		RemotePort: remotePort,
		StopChan:   stopChan,
		ReadyChan:  readyChan,
	}

	m.mu.Lock()
	m.forwarders[id] = apf
	m.mu.Unlock()

	errChan := make(chan error, 1)
	go func() {
		errChan <- pf.ForwardPorts()
	}()

	select {
	case <-readyChan:
		return nil
	case err := <-errChan:
		m.mu.Lock()
		delete(m.forwarders, id)
		m.mu.Unlock()
		return fmt.Errorf("port forward failed: %w", err)
	}
}

// Stop stops an active port forward session
func (m *PortForwardManager) Stop(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	apf, exists := m.forwarders[id]
	if !exists {
		return fmt.Errorf("port forward '%s' is not active", id)
	}

	close(apf.StopChan)
	delete(m.forwarders, id)
	return nil
}

// IsRunning checks whether a port forward is active
func (m *PortForwardManager) IsRunning(id string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, exists := m.forwarders[id]
	return exists
}
