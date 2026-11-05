export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  two_factor_enabled?: boolean;
}

export interface Credential {
  id: string;
  name: string;
  type: 'password' | 'private_key';
  public_key?: string;
  created_at: string;
}

export interface Host {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  folder: string;
  tags: string;
  credential_id: string;
  credential?: Credential;
  jump_host_id?: string;
  host_key_fingerprint?: string;
  description: string;
  created_at: string;
}

export interface SessionAudit {
  id: string;
  user_id: string;
  user?: User;
  host_id: string;
  host_name: string;
  status: 'active' | 'closed' | 'failed' | 'connecting';
  client_ip: string;
  recording_path: string;
  byte_count: number;
  started_at: string;
  ended_at?: string;
}

export interface Tunnel {
  id: string;
  user_id: string;
  host_id: string;
  host?: Host;
  name: string;
  type: 'local' | 'socks5';
  bind_host: string;
  bind_port: number;
  target_host: string;
  target_port: number;
  status: 'running' | 'stopped' | 'error';
  created_at: string;
}

export interface FileItem {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  mod_time: string;
  mode: string;
}

export interface Snippet {
  id: string;
  user_id?: string;
  name: string;
  command: string;
  description: string;
  category: string;
  tags: string;
  created_at?: string;
  updated_at?: string;
}

export interface FeatureFlags {
  enable_sftp: boolean;
  enable_multi_exec: boolean;
  enable_session_audit: boolean;
  enable_tunnels: boolean;
  enable_import_ssh_config: boolean;
  enable_snippets: boolean;
  enable_public_roadmap: boolean;
  enable_sponsor: boolean;
  enable_k8s?: boolean;
}

export interface SystemFeaturesResponse {
  version: string;
  features: FeatureFlags;
  rate_limit?: {
    enabled: boolean;
    max_attempts: number;
    window_minutes: number;
  };
}

export interface ServerMetrics {
  os: string;
  kernel: string;
  arch: string;
  uptime_sec: number;
  uptime_text: string;
  load_avg: string;
  cpu_percent: number;
  mem_total_mb: number;
  mem_used_mb: number;
  mem_free_mb: number;
  mem_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_free_gb: number;
  disk_percent: number;
  updated_at: string;
}

export interface KubeCluster {
  id: string;
  name: string;
  description: string;
  current_context: string;
  server_version?: string;
  status: 'ready' | 'error' | 'unreachable';
  created_at: string;
  updated_at: string;
}

export interface K8sNamespace {
  name: string;
  status: string;
  age: string;
}

export interface K8sNode {
  name: string;
  status: string;
  roles: string;
  version: string;
  internal_ip: string;
  os_image: string;
  kernel_version: string;
  cpu_cores: string;
  memory: string;
  age: string;
  labels?: Record<string, string>;
}

export interface K8sContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restart_count: number;
  state: string;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  ip: string;
  node: string;
  age: string;
  containers: K8sContainerInfo[];
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  replicas: string;
  up_to_date: number;
  available: number;
  age: string;
  images: string[];
}

export interface K8sServicePort {
  name?: string;
  protocol: string;
  port: number;
  target_port: string;
  node_port?: number;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  cluster_ip: string;
  external_ip?: string;
  ports: K8sServicePort[];
  age: string;
}

export interface K8sPortForward {
  id: string;
  cluster_id: string;
  namespace: string;
  target_type: 'pod' | 'service';
  target_name: string;
  local_port: number;
  remote_port: number;
  status: 'running' | 'stopped' | 'error';
  created_at: string;
}

export interface K8sTestResult {
  server_version: string;
  node_count: number;
  contexts: string[];
  current_context: string;
}

export interface ApiErrorResponse {
  error_code?: string;
  error: string;
}


