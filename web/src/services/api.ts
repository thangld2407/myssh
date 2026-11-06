import {
  Credential,
  Host,
  SessionAudit,
  Tunnel,
  FileItem,
  User,
  Snippet,
  SystemFeaturesResponse,
  ServerMetrics,
  KubeCluster,
  K8sNamespace,
  K8sNode,
  K8sPod,
  K8sDeployment,
  K8sService,
  K8sPortForward,
  K8sTestResult,
} from '../types';
import i18n from '../i18n';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('myssh_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('myssh_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('myssh_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !endpoint.startsWith('/auth/login')) {
    clearAuthToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let errorMsg = 'Request failed';
    try {
      const errData = await res.json();
      if (errData.error_code && i18n.exists(`api_errors.${errData.error_code}`)) {
        errorMsg = i18n.t(`api_errors.${errData.error_code}`);
      } else {
        errorMsg = errData.error || errorMsg;
      }
    } catch {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg);
  }

  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  if (contentType.includes('text/html')) {
    throw new Error(`Endpoint ${endpoint} trả về HTML thay vì dữ liệu JSON. Máy chủ backend cần được khởi động lại.`);
  }
  return res.text() as unknown as T;
}

export const api = {
  // System Config & Features
  getSystemFeatures: () => request<SystemFeaturesResponse>('/system/features'),

  // Auth & 2FA
  getSetupStatus: () => request<{ initialized: boolean }>('/auth/setup-status'),
  setupAdmin: (data: { username: string; password: string; full_name?: string }) =>
    request<{ token: string; user: User }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (data: { username: string; password: string; code?: string }) =>
    request<{ token?: string; user?: User; two_factor_required?: boolean; message?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMe: () => request<User>('/auth/me'),
  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),
  getWsTicket: () =>
    request<{ ticket: string; expires_in: number }>('/auth/ws-ticket', {
      method: 'POST',
    }),
  generate2FA: () =>
    request<{ secret: string; otpauth_url: string; qr_code: string }>('/auth/2fa/generate', {
      method: 'POST',
    }),
  enable2FA: (data: { secret?: string; code: string }) =>
    request<{ success: boolean; message: string; recovery_codes?: string[] }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  disable2FA: (data: { password: string }) =>
    request<{ success: boolean; message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Credentials
  getCredentials: () => request<Credential[]>('/credentials'),
  createCredential: (data: {
    name: string;
    type: 'password' | 'private_key';
    secret: string;
    passphrase?: string;
    public_key?: string;
  }) =>
    request<Credential>('/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCredential: (id: string) =>
    request<{ message: string }>(`/credentials/${id}`, {
      method: 'DELETE',
    }),
  generateKey: (comment?: string) =>
    request<{ public_key: string; private_key: string; type: string }>(
      `/credentials/generate-key?comment=${encodeURIComponent(comment || 'myssh-key')}`,
      { method: 'POST' }
    ),

  // Hosts
  getHosts: (folder?: string, search?: string) => {
    const params = new URLSearchParams();
    if (folder) params.append('folder', folder);
    if (search) params.append('q', search);
    return request<Host[]>(`/hosts?${params.toString()}`);
  },
  getHost: (id: string) => request<Host>(`/hosts/${id}`),
  createHost: (data: Partial<Host>) =>
    request<Host>('/hosts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateHost: (id: string, data: Partial<Host>) =>
    request<Host>(`/hosts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteHost: (id: string) =>
    request<{ message: string }>(`/hosts/${id}`, {
      method: 'DELETE',
    }),
  testHost: (id: string) =>
    request<{ success: boolean; message: string }>(`/hosts/${id}/test`, {
      method: 'POST',
    }),
  resetHostFingerprint: (id: string) =>
    request<Host>(`/hosts/${id}/reset-fingerprint`, {
      method: 'POST',
    }),
  getHostMetrics: (id: string) => request<ServerMetrics>(`/hosts/${id}/metrics`),
  importSSHConfig: (data: {
    content: string;
    default_credential_id?: string;
    folder?: string;
    dry_run?: boolean;
  }) =>
    request<{ count: number; hosts: any[]; message?: string }>('/hosts/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // SFTP
  listSftp: (hostId: string, path: string = '.') =>
    request<{ path: string; items: FileItem[] }>(`/sftp/${hostId}/list?path=${encodeURIComponent(path)}`),
  downloadSftpUrl: async (hostId: string, path: string) => {
    const ticketRes = await api.getWsTicket();
    return `${API_BASE}/sftp/${hostId}/download?path=${encodeURIComponent(path)}&ticket=${ticketRes.ticket}`;
  },
  uploadSftp: (hostId: string, path: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ message: string; path: string }>(`/sftp/${hostId}/upload?path=${encodeURIComponent(path)}`, {
      method: 'POST',
      body: formData,
    });
  },
  mkdirSftp: (hostId: string, path: string) =>
    request<{ message: string }>(`/sftp/${hostId}/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  renameSftp: (hostId: string, oldPath: string, newPath: string) =>
    request<{ message: string; old_path: string; new_path: string }>(`/sftp/${hostId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
    }),
  chmodSftp: (hostId: string, path: string, mode: string) =>
    request<{ message: string; path: string; mode: string }>(`/sftp/${hostId}/chmod`, {
      method: 'POST',
      body: JSON.stringify({ path, mode }),
    }),
  deleteSftp: (hostId: string, path: string) =>
    request<{ message: string }>(`/sftp/${hostId}/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),
  readSftp: (hostId: string, path: string) =>
    request<{ path: string; content: string; size: number }>(`/sftp/${hostId}/read?path=${encodeURIComponent(path)}`),
  writeSftp: (hostId: string, path: string, content: string) =>
    request<{ message: string; path: string; size: number }>(`/sftp/${hostId}/write`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),

  // Snippets
  getSnippets: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('q', search);
    return request<Snippet[]>(`/snippets?${params.toString()}`);
  },
  createSnippet: (data: Partial<Snippet>) =>
    request<Snippet>('/snippets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSnippet: (id: string, data: Partial<Snippet>) =>
    request<Snippet>(`/snippets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteSnippet: (id: string) =>
    request<{ message: string }>(`/snippets/${id}`, {
      method: 'DELETE',
    }),

  // Session Audits
  getSessions: (hostId?: string) => {
    const query = hostId ? `?host_id=${hostId}` : '';
    return request<SessionAudit[]>(`/audit/sessions${query}`);
  },
  getRecordingContent: (sessionId: string) =>
    request<string>(`/audit/sessions/${sessionId}/recording`),

  // Tunnels
  getTunnels: () => request<Tunnel[]>('/tunnels'),
  createTunnel: (data: Partial<Tunnel>) =>
    request<Tunnel>('/tunnels', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  startTunnel: (id: string) =>
    request<{ message: string; tunnel: Tunnel }>(`/tunnels/${id}/start`, {
      method: 'POST',
    }),
  stopTunnel: (id: string) =>
    request<{ message: string }>(`/tunnels/${id}/stop`, {
      method: 'POST',
    }),
  deleteTunnel: (id: string) =>
    request<{ message: string }>(`/tunnels/${id}`, {
      method: 'DELETE',
    }),

  // Kubernetes Hub
  getK8sClusters: () => request<KubeCluster[]>('/k8s/clusters'),
  testK8sCluster: (data: { kubeconfig: string; current_context?: string }) =>
    request<K8sTestResult>('/k8s/clusters/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createK8sCluster: (data: { name: string; description?: string; kubeconfig: string; current_context?: string }) =>
    request<KubeCluster>('/k8s/clusters', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getK8sCluster: (id: string) =>
    request<{ cluster: KubeCluster; contexts: string[] }>(`/k8s/clusters/${id}`),
  updateK8sCluster: (id: string, data: { name?: string; description?: string; kubeconfig?: string; current_context?: string }) =>
    request<KubeCluster>(`/k8s/clusters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteK8sCluster: (id: string) =>
    request<{ message: string }>(`/k8s/clusters/${id}`, {
      method: 'DELETE',
    }),

  getK8sNamespaces: (clusterId: string) =>
    request<K8sNamespace[]>(`/k8s/clusters/${clusterId}/namespaces`),
  getK8sNodes: (clusterId: string) =>
    request<K8sNode[]>(`/k8s/clusters/${clusterId}/nodes`),
  getK8sPods: (clusterId: string, namespace?: string) => {
    const q = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    return request<K8sPod[]>(`/k8s/clusters/${clusterId}/pods${q}`);
  },
  getK8sDeployments: (clusterId: string, namespace?: string) => {
    const q = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    return request<K8sDeployment[]>(`/k8s/clusters/${clusterId}/deployments${q}`);
  },
  getK8sServices: (clusterId: string, namespace?: string) => {
    const q = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    return request<K8sService[]>(`/k8s/clusters/${clusterId}/services${q}`);
  },

  getK8sYaml: (clusterId: string, kind: string, namespace: string, name: string) =>
    request<{ yaml: string }>(
      `/k8s/clusters/${clusterId}/yaml?kind=${encodeURIComponent(kind)}&namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`
    ),
  applyK8sYaml: (clusterId: string, yaml: string) =>
    request<{ message: string }>(`/k8s/clusters/${clusterId}/yaml`, {
      method: 'PUT',
      body: JSON.stringify({ yaml }),
    }),
  deleteK8sResource: (clusterId: string, kind: string, namespace: string, name: string) =>
    request<{ message: string }>(
      `/k8s/clusters/${clusterId}/resource?kind=${encodeURIComponent(kind)}&namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    ),

  getK8sPortForwards: (clusterId?: string) => {
    const q = clusterId ? `?cluster_id=${encodeURIComponent(clusterId)}` : '';
    return request<K8sPortForward[]>(`/k8s/portforwards${q}`);
  },
  createK8sPortForward: (data: {
    cluster_id: string;
    namespace: string;
    target_type: 'pod' | 'service';
    target_name: string;
    local_port: number;
    remote_port: number;
  }) =>
    request<K8sPortForward>('/k8s/portforwards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  startK8sPortForward: (id: string) =>
    request<K8sPortForward>(`/k8s/portforwards/${id}/start`, {
      method: 'POST',
    }),
  stopK8sPortForward: (id: string) =>
    request<K8sPortForward>(`/k8s/portforwards/${id}/stop`, {
      method: 'POST',
    }),
  deleteK8sPortForward: (id: string) =>
    request<{ message: string }>(`/k8s/portforwards/${id}`, {
      method: 'DELETE',
    }),
};
