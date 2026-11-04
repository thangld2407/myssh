export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
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
