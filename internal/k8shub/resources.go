package k8shub

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"sigs.k8s.io/yaml"
)

// Resource DTOs for frontend

type K8sNamespace struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Age    string `json:"age"`
}

type K8sNode struct {
	Name          string            `json:"name"`
	Status        string            `json:"status"` // Ready, NotReady
	Roles         string            `json:"roles"`
	Version       string            `json:"version"`
	InternalIP    string            `json:"internal_ip"`
	OSImage       string            `json:"os_image"`
	KernelVersion string            `json:"kernel_version"`
	CPUCores      string            `json:"cpu_cores"`
	Memory        string            `json:"memory"`
	Age           string            `json:"age"`
	Labels        map[string]string `json:"labels,omitempty"`
}

type K8sContainerInfo struct {
	Name         string `json:"name"`
	Image        string `json:"image"`
	Ready        bool   `json:"ready"`
	RestartCount int32  `json:"restart_count"`
	State        string `json:"state"` // running, waiting, terminated
}

type K8sPod struct {
	Name       string             `json:"name"`
	Namespace  string             `json:"namespace"`
	Status     string             `json:"status"` // Running, Pending, Succeeded, Failed, CrashLoopBackOff
	Ready      string             `json:"ready"`  // e.g. "1/1", "2/3"
	Restarts   int32              `json:"restarts"`
	IP         string             `json:"ip"`
	Node       string             `json:"node"`
	Age        string             `json:"age"`
	Containers []K8sContainerInfo `json:"containers"`
}

type K8sDeployment struct {
	Name        string   `json:"name"`
	Namespace   string   `json:"namespace"`
	Replicas    string   `json:"replicas"` // e.g. "3/3"
	UpToDate    int32    `json:"up_to_date"`
	Available   int32    `json:"available"`
	Age         string   `json:"age"`
	Images      []string `json:"images"`
}

type K8sServicePort struct {
	Name       string `json:"name,omitempty"`
	Protocol   string `json:"protocol"`
	Port       int32  `json:"port"`
	TargetPort string `json:"target_port"`
	NodePort   int32  `json:"node_port,omitempty"`
}

type K8sService struct {
	Name       string           `json:"name"`
	Namespace  string           `json:"namespace"`
	Type       string           `json:"type"` // ClusterIP, NodePort, LoadBalancer
	ClusterIP  string           `json:"cluster_ip"`
	ExternalIP string           `json:"external_ip,omitempty"`
	Ports      []K8sServicePort `json:"ports"`
	Age        string           `json:"age"`
}

func formatAge(t time.Time) string {
	if t.IsZero() {
		return "0s"
	}
	d := time.Since(t).Round(time.Second)
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	} else if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	} else if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	return fmt.Sprintf("%dd", int(d.Hours()/24))
}

// GetNamespaces returns all cluster namespaces
func GetNamespaces(ctx context.Context, cs *kubernetes.Clientset) ([]K8sNamespace, error) {
	list, err := cs.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}

	result := make([]K8sNamespace, 0, len(list.Items))
	for _, ns := range list.Items {
		result = append(result, K8sNamespace{
			Name:   ns.Name,
			Status: string(ns.Status.Phase),
			Age:    formatAge(ns.CreationTimestamp.Time),
		})
	}
	return result, nil
}

// GetNodes returns all cluster nodes with summary stats
func GetNodes(ctx context.Context, cs *kubernetes.Clientset) ([]K8sNode, error) {
	list, err := cs.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}

	result := make([]K8sNode, 0, len(list.Items))
	for _, n := range list.Items {
		status := "NotReady"
		for _, cond := range n.Status.Conditions {
			if cond.Type == corev1.NodeReady && cond.Status == corev1.ConditionTrue {
				status = "Ready"
				break
			}
		}

		roles := []string{}
		for k := range n.Labels {
			if strings.HasPrefix(k, "node-role.kubernetes.io/") {
				role := strings.TrimPrefix(k, "node-role.kubernetes.io/")
				if role != "" {
					roles = append(roles, role)
				}
			}
		}
		rolesStr := "<none>"
		if len(roles) > 0 {
			rolesStr = strings.Join(roles, ", ")
		}

		internalIP := ""
		for _, addr := range n.Status.Addresses {
			if addr.Type == corev1.NodeInternalIP {
				internalIP = addr.Address
				break
			}
		}

		cpu := n.Status.Capacity.Cpu().String()
		memBytes := n.Status.Capacity.Memory().Value()
		memGB := fmt.Sprintf("%.1f GiB", float64(memBytes)/(1024*1024*1024))

		result = append(result, K8sNode{
			Name:          n.Name,
			Status:        status,
			Roles:         rolesStr,
			Version:       n.Status.NodeInfo.KubeletVersion,
			InternalIP:    internalIP,
			OSImage:       n.Status.NodeInfo.OSImage,
			KernelVersion: n.Status.NodeInfo.KernelVersion,
			CPUCores:      cpu,
			Memory:        memGB,
			Age:           formatAge(n.CreationTimestamp.Time),
			Labels:        n.Labels,
		})
	}
	return result, nil
}

// GetPods returns pods optionally filtered by namespace
func GetPods(ctx context.Context, cs *kubernetes.Clientset, namespace string) ([]K8sPod, error) {
	list, err := cs.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	result := make([]K8sPod, 0, len(list.Items))
	for _, p := range list.Items {
		var totalRestarts int32
		readyCount := 0
		containers := make([]K8sContainerInfo, 0, len(p.Spec.Containers))

		containerStatusMap := make(map[string]corev1.ContainerStatus)
		for _, cs := range p.Status.ContainerStatuses {
			containerStatusMap[cs.Name] = cs
			totalRestarts += cs.RestartCount
			if cs.Ready {
				readyCount++
			}
		}

		for _, c := range p.Spec.Containers {
			cs, hasStatus := containerStatusMap[c.Name]
			state := "unknown"
			isReady := false
			var restarts int32

			if hasStatus {
				isReady = cs.Ready
				restarts = cs.RestartCount
				if cs.State.Running != nil {
					state = "running"
				} else if cs.State.Waiting != nil {
					state = cs.State.Waiting.Reason
				} else if cs.State.Terminated != nil {
					state = cs.State.Terminated.Reason
				}
			}

			containers = append(containers, K8sContainerInfo{
				Name:         c.Name,
				Image:        c.Image,
				Ready:        isReady,
				RestartCount: restarts,
				State:        state,
			})
		}

		status := string(p.Status.Phase)
		// Check for container waiting reasons like CrashLoopBackOff or ImagePullBackOff
		for _, cs := range p.Status.ContainerStatuses {
			if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
				status = cs.State.Waiting.Reason
				break
			}
		}

		result = append(result, K8sPod{
			Name:       p.Name,
			Namespace:  p.Namespace,
			Status:     status,
			Ready:      fmt.Sprintf("%d/%d", readyCount, len(p.Spec.Containers)),
			Restarts:   totalRestarts,
			IP:         p.Status.PodIP,
			Node:       p.Spec.NodeName,
			Age:        formatAge(p.CreationTimestamp.Time),
			Containers: containers,
		})
	}
	return result, nil
}

// GetDeployments returns deployments optionally filtered by namespace
func GetDeployments(ctx context.Context, cs *kubernetes.Clientset, namespace string) ([]K8sDeployment, error) {
	list, err := cs.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list deployments: %w", err)
	}

	result := make([]K8sDeployment, 0, len(list.Items))
	for _, d := range list.Items {
		var images []string
		for _, c := range d.Spec.Template.Spec.Containers {
			images = append(images, c.Image)
		}

		desired := int32(1)
		if d.Spec.Replicas != nil {
			desired = *d.Spec.Replicas
		}

		result = append(result, K8sDeployment{
			Name:        d.Name,
			Namespace:   d.Namespace,
			Replicas:    fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, desired),
			UpToDate:    d.Status.UpdatedReplicas,
			Available:   d.Status.AvailableReplicas,
			Age:         formatAge(d.CreationTimestamp.Time),
			Images:      images,
		})
	}
	return result, nil
}

// GetServices returns services optionally filtered by namespace
func GetServices(ctx context.Context, cs *kubernetes.Clientset, namespace string) ([]K8sService, error) {
	list, err := cs.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	result := make([]K8sService, 0, len(list.Items))
	for _, s := range list.Items {
		var ports []K8sServicePort
		for _, p := range s.Spec.Ports {
			ports = append(ports, K8sServicePort{
				Name:       p.Name,
				Protocol:   string(p.Protocol),
				Port:       p.Port,
				TargetPort: p.TargetPort.String(),
				NodePort:   p.NodePort,
			})
		}

		extIP := ""
		if len(s.Status.LoadBalancer.Ingress) > 0 {
			if s.Status.LoadBalancer.Ingress[0].IP != "" {
				extIP = s.Status.LoadBalancer.Ingress[0].IP
			} else {
				extIP = s.Status.LoadBalancer.Ingress[0].Hostname
			}
		}

		result = append(result, K8sService{
			Name:       s.Name,
			Namespace:  s.Namespace,
			Type:       string(s.Spec.Type),
			ClusterIP:  s.Spec.ClusterIP,
			ExternalIP: extIP,
			Ports:      ports,
			Age:        formatAge(s.CreationTimestamp.Time),
		})
	}
	return result, nil
}

// GetResourceYAML fetches a specific resource and serializes it to clean YAML
func GetResourceYAML(ctx context.Context, restConfig *rest.Config, kind, namespace, name string) (string, error) {
	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create dynamic client: %w", err)
	}

	gvr, isNamespaced := kindToGVR(kind)
	if gvr.Resource == "" {
		return "", fmt.Errorf("unsupported resource kind: %s", kind)
	}

	var res *unstructured.Unstructured
	if isNamespaced {
		res, err = dynClient.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
	} else {
		res, err = dynClient.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	}
	if err != nil {
		return "", fmt.Errorf("failed to get %s/%s: %w", kind, name, err)
	}

	// Clean internal metadata that shouldn't clutter the editor
	cleanMetadata(res.Object)

	yamlBytes, err := yaml.Marshal(res.Object)
	if err != nil {
		return "", fmt.Errorf("failed to convert to YAML: %w", err)
	}

	return string(yamlBytes), nil
}

// ApplyResourceYAML creates or updates a resource from YAML
func ApplyResourceYAML(ctx context.Context, restConfig *rest.Config, yamlStr string) error {
	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(yamlStr)), 4096)
	var rawObj map[string]interface{}
	if err := decoder.Decode(&rawObj); err != nil {
		return fmt.Errorf("invalid YAML syntax: %w", err)
	}

	obj := &unstructured.Unstructured{Object: rawObj}
	gvk := obj.GroupVersionKind()
	if gvk.Kind == "" {
		return fmt.Errorf("YAML missing 'kind' field")
	}

	gvr, isNamespaced := kindToGVR(gvk.Kind)
	if gvr.Resource == "" {
		// Fallback: guess plural
		gvr = schema.GroupVersionResource{
			Group:    gvk.Group,
			Version:  gvk.Version,
			Resource: strings.ToLower(gvk.Kind) + "s",
		}
	}

	name := obj.GetName()
	namespace := obj.GetNamespace()
	if isNamespaced && namespace == "" {
		namespace = "default"
		obj.SetNamespace(namespace)
	}

	var client dynamic.ResourceInterface
	if isNamespaced {
		client = dynClient.Resource(gvr).Namespace(namespace)
	} else {
		client = dynClient.Resource(gvr)
	}

	// Try get first to determine create vs update
	existing, err := client.Get(ctx, name, metav1.GetOptions{})
	if err == nil && existing != nil {
		// Update existing
		obj.SetResourceVersion(existing.GetResourceVersion())
		_, err = client.Update(ctx, obj, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update resource: %w", err)
		}
		return nil
	}

	// Create new
	_, err = client.Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	return nil
}

// DeleteResource deletes a specified resource
func DeleteResource(ctx context.Context, restConfig *rest.Config, kind, namespace, name string) error {
	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	gvr, isNamespaced := kindToGVR(kind)
	if gvr.Resource == "" {
		return fmt.Errorf("unsupported resource kind: %s", kind)
	}

	var client dynamic.ResourceInterface
	if isNamespaced {
		client = dynClient.Resource(gvr).Namespace(namespace)
	} else {
		client = dynClient.Resource(gvr)
	}

	err = client.Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete %s/%s: %w", kind, name, err)
	}
	return nil
}

func kindToGVR(kind string) (schema.GroupVersionResource, bool) {
	k := strings.ToLower(kind)
	switch k {
	case "pod", "pods":
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}, true
	case "deployment", "deployments":
		return schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, true
	case "service", "services", "svc":
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, true
	case "node", "nodes":
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: "nodes"}, false
	case "namespace", "namespaces", "ns":
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}, false
	case "configmap", "configmaps", "cm":
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: "configmaps"}, true
	case "secret", "secrets":
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: "secrets"}, true
	default:
		return schema.GroupVersionResource{Group: "", Version: "v1", Resource: strings.ToLower(kind) + "s"}, true
	}
}

func cleanMetadata(obj map[string]interface{}) {
	if meta, ok := obj["metadata"].(map[string]interface{}); ok {
		delete(meta, "managedFields")
		delete(meta, "generation")
		delete(meta, "resourceVersion")
		delete(meta, "selfLink")
		delete(meta, "uid")
	}
	delete(obj, "status")
}
