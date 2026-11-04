import React, { useState } from 'react';
import {
  Server,
  Terminal,
  Folder,
  Edit2,
  Trash2,
  Search,
  Plus,
  Radio,
  Copy,
  Check,
  HardDrive,
  LayoutList,
  LayoutGrid,
  KeyRound,
  FileUp
} from 'lucide-react';
import { Host } from '../types';
import { api } from '../services/api';

interface HostListProps {
  hosts: Host[];
  selectedFolder: string;
  onOpenTerminal: (host: Host) => void;
  onOpenSftp: (host: Host) => void;
  onEditHost: (host: Host) => void;
  onAddHost: () => void;
  onImportSSHConfig: () => void;
  onRefresh: () => void;
  onOpenCredentialModal: () => void;
}

export const HostList: React.FC<HostListProps> = ({
  hosts,
  selectedFolder,
  onOpenTerminal,
  onOpenSftp,
  onEditHost,
  onAddHost,
  onImportSSHConfig,
  onRefresh,
  onOpenCredentialModal,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string; latency?: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHosts = hosts.filter((host) => {
    const matchFolder = selectedFolder === 'All' || host.folder === selectedFolder;
    const matchSearch =
      searchQuery === '' ||
      host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.tags.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFolder && matchSearch;
  });

  const handleCopyHost = (host: Host) => {
    const text = `ssh ${host.username}@${host.hostname} -p ${host.port}`;
    navigator.clipboard.writeText(text);
    setCopiedId(host.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleTestConnection = async (host: Host, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingId(host.id);
    setTestResult(null);
    const start = performance.now();
    try {
      const res = await api.testHost(host.id);
      const latency = Math.round(performance.now() - start);
      setTestResult({ id: host.id, success: res.success, message: res.message, latency });
    } catch (err: any) {
      setTestResult({ id: host.id, success: false, message: err.message || 'Kết nối thất bại' });
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleDeleteHost = async (host: Host, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Bạn có chắc muốn xóa máy chủ "${host.name}" (${host.hostname})?`)) return;
    try {
      await api.deleteHost(host.id);
      onRefresh();
    } catch (err: any) {
      alert('Lỗi xóa máy chủ: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-slate-800">
      {/* Top Application Toolbar */}
      <div className="h-13 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span>Máy chủ</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-semibold">{selectedFolder}</span>
          <span className="text-slate-400 font-mono text-[11px]">({filteredHosts.length})</span>
        </div>

        {/* Search, View Mode & Action */}
        <div className="flex items-center space-x-2.5">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, IP, user..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
            />
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-50 rounded-md border border-slate-200 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1 rounded transition ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Chế độ Bảng"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded transition ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Chế độ Lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Import SSH Config Button */}
          <button
            onClick={onImportSSHConfig}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200 shadow-2xs"
            title="Nhập máy chủ từ file ~/.ssh/config"
          >
            <FileUp className="w-3.5 h-3.5 text-slate-500" />
            Import Config
          </button>

          {/* Primary Action Button: Modern Solid Black */}
          <button
            onClick={onAddHost}
            className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm Máy Chủ
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'table' ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 w-12 text-center">Status</th>
                  <th className="py-2.5 px-4">Tên Máy Chủ</th>
                  <th className="py-2.5 px-4">Địa Chỉ IP / Host</th>
                  <th className="py-2.5 px-4 w-28">User</th>
                  <th className="py-2.5 px-4 w-40">Khóa Xác Thực</th>
                  <th className="py-2.5 px-4 w-28">Thư Mục</th>
                  <th className="py-2.5 px-4 text-right pr-4 w-44">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredHosts.map((host) => {
                  const isTesting = testingId === host.id;
                  const result = testResult && testResult.id === host.id ? testResult : null;

                  return (
                    <tr
                      key={host.id}
                      onDoubleClick={() => onOpenTerminal(host)}
                      className="hover:bg-slate-50/80 group transition cursor-pointer select-none"
                    >
                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center">
                          {result ? (
                            result.success ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" title={`Ping: ${result.latency}ms`} />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50" title={result.message} />
                            )
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-slate-400 transition-colors" />
                          )}
                        </div>
                      </td>

                      {/* Server Name */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 group-hover:text-black transition-colors">
                            {host.name}
                          </span>
                          {host.jump_host_id && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                              JumpHost
                            </span>
                          )}
                        </div>
                        {host.description && (
                          <p className="text-[11px] text-slate-500 font-sans truncate max-w-xs mt-0.5">
                            {host.description}
                          </p>
                        )}
                      </td>

                      {/* Hostname:Port & Copy */}
                      <td className="py-3 px-4 text-slate-700">
                        <div className="flex items-center space-x-1.5">
                          <span>{host.hostname}:{host.port}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyHost(host);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition"
                            title="Copy lệnh SSH"
                          >
                            {copiedId === host.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3 px-4 text-slate-600 font-medium">{host.username}</td>

                      {/* Credential */}
                      <td className="py-3 px-4 font-sans">
                        {host.credential ? (
                          <span className="text-[11px] text-slate-600 flex items-center gap-1.5 truncate max-w-[150px]">
                            <KeyRound className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{host.credential.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Chưa gắn key</span>
                        )}
                      </td>

                      {/* Folder */}
                      <td className="py-3 px-4 font-sans">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
                          {host.folder || 'General'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right pr-4 font-sans">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTerminal(host);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs"
                            title="Mở Web Terminal"
                          >
                            <Terminal className="w-3 h-3 text-emerald-400" />
                            Kết nối
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSftp(host);
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            title="Quản lý SFTP"
                          >
                            <HardDrive className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleTestConnection(host, e)}
                            disabled={isTesting}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            title="Kiểm tra ping SSH"
                          >
                            <Radio className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-slate-900' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditHost(host);
                            }}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                            title="Sửa máy chủ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleDeleteHost(host, e)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                            title="Xóa máy chủ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredHosts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      Không có máy chủ nào trong thư mục này. Bấm "Thêm Máy Chủ" để cấu hình kết nối.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View: Clean Minimalist Light Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHosts.map((host) => (
              <div
                key={host.id}
                onDoubleClick={() => onOpenTerminal(host)}
                className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl p-4 flex flex-col justify-between transition cursor-pointer select-none group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                        <Server className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-xs group-hover:text-black transition-colors">
                          {host.name}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {host.username}@{host.hostname}:{host.port}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditHost(host);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteHost(host, e)}
                        className="p-1 rounded text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-3 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      {host.folder || 'General'}
                    </span>
                    {host.credential && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[120px] font-medium">
                        {host.credential.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTerminal(host);
                    }}
                    className="py-1.5 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
                  >
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                    Terminal
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSftp(host);
                    }}
                    className="py-1.5 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-200"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    SFTP
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
