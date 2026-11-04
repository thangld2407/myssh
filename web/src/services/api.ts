import { Credential, Host, SessionAudit, Tunnel, FileItem, User } from '../types';

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

  if (res.status === 401) {
    clearAuthToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let errorMsg = 'Request failed';
    try {
      const errData = await res.json();
      errorMsg = errData.error || errorMsg;
    } catch {
      errorMsg = await res.text();
    }
    throw new Error(errorMsg);
  }

  if (res.headers.get('Content-Type')?.includes('application/json')) {
    return res.json();
  }
  return res.text() as unknown as T;
}

export const api = {
  // Auth
  login: (data: { username: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMe: () => request<User>('/auth/me'),

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
  downloadSftpUrl: (hostId: string, path: string) => {
    const token = getAuthToken();
    return `${API_BASE}/sftp/${hostId}/download?path=${encodeURIComponent(path)}&token=${token}`;
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
  deleteSftp: (hostId: string, path: string) =>
    request<{ message: string }>(`/sftp/${hostId}/delete?path=${encodeURIComponent(path)}`, {
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
};
