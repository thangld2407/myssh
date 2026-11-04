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
      <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span>Máy chủ</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-semibold">{selectedFolder}</span>
          <span className="text-slate-400 font-mono text-xs">({filteredHosts.length})</span>
        </div>

        {/* Search, View Mode & Action */}
        <div className="flex items-center space-x-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, IP, user..."
              className="w-full h-9 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all duration-150"
            />
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 active:scale-95 ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-semibold' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Chế độ Bảng"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 active:scale-95 ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-semibold' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Chế độ Lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Import SSH Config Button */}
          <button
            onClick={onImportSSHConfig}
            className="h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all duration-150 border border-slate-200 shadow-2xs"
            title="Nhập máy chủ từ file ~/.ssh/config"
          >
            <FileUp className="w-4 h-4 text-slate-500" />
            Import Config
          </button>

          {/* Primary Action Button: Modern Solid Black */}
          <button
            onClick={onAddHost}
            className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 active:bg-slate-950 text-white text-xs font-semibold flex items-center gap-2 transition-all duration-150 shadow-2xs"
          >
            <Plus className="w-4 h-4" />
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
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4 w-14 text-center">Status</th>
                  <th className="py-3 px-4">Tên Máy Chủ</th>
                  <th className="py-3 px-4">Địa Chỉ IP / Host</th>
                  <th className="py-3 px-4 w-32">User</th>
                  <th className="py-3 px-4 w-44">Khóa Xác Thực</th>
                  <th className="py-3 px-4 w-32">Thư Mục</th>
                  <th className="py-3 px-4 text-right pr-5 w-52">Thao Tác</th>
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
                      className="hover:bg-slate-50/80 group transition-colors duration-150 cursor-pointer select-none"
                    >
                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
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
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 group-hover:text-black transition-colors text-xs">
                            {host.name}
                          </span>
                          {host.jump_host_id && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                              JumpHost
                            </span>
                          )}
                        </div>
                        {host.description && (
                          <p className="text-xs text-slate-500 font-sans truncate max-w-xs mt-0.5">
                            {host.description}
                          </p>
                        )}
                      </td>

                      {/* Hostname:Port & Copy */}
                      <td className="py-3.5 px-4 text-slate-700 text-xs">
                        <div className="flex items-center space-x-2">
                          <span>{host.hostname}:{host.port}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyHost(host);
                            }}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all duration-150 active:scale-90"
                            title="Copy lệnh SSH"
                          >
                            {copiedId === host.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium text-xs">{host.username}</td>

                      {/* Credential */}
                      <td className="py-3.5 px-4 font-sans text-xs">
                        {host.credential ? (
                          <span className="text-slate-600 flex items-center gap-1.5 truncate max-w-[160px]">
                            <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{host.credential.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Chưa gắn key</span>
                        )}
                      </td>

                      {/* Folder */}
                      <td className="py-3.5 px-4 font-sans">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
                          {host.folder || 'General'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right pr-5 font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTerminal(host);
                            }}
                            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 shadow-2xs"
                            title="Mở Web Terminal"
                          >
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            Kết nối
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSftp(host);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all duration-150 active:scale-95 border border-transparent hover:border-slate-200"
                            title="Quản lý SFTP"
                          >
                            <HardDrive className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleTestConnection(host, e)}
                            disabled={isTesting}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all duration-150 active:scale-95 border border-transparent hover:border-slate-200"
                            title="Kiểm tra ping SSH"
                          >
                            <Radio className={`w-4 h-4 ${isTesting ? 'animate-pulse text-slate-900' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditHost(host);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all duration-150 active:scale-95 border border-transparent hover:border-slate-200"
                            title="Sửa máy chủ"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => handleDeleteHost(host, e)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all duration-150 active:scale-95 border border-transparent hover:border-red-200"
                            title="Xóa máy chủ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredHosts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 font-sans text-xs">
                      Không có máy chủ nào trong thư mục này. Bấm "Thêm Máy Chủ" hoặc "Import Config" để bắt đầu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View: Clean Minimalist Light Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHosts.map((host) => (
              <div
                key={host.id}
                onDoubleClick={() => onOpenTerminal(host)}
                className="bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md rounded-xl p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-200">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-xs group-hover:text-black transition-colors">
                          {host.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          {host.username}@{host.hostname}:{host.port}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditHost(host);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150 active:scale-90"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteHost(host, e)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-150 active:scale-90"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      {host.folder || 'General'}
                    </span>
                    {host.credential && (
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[140px] font-medium">
                        {host.credential.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-5 pt-3.5 border-t border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTerminal(host);
                    }}
                    className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 shadow-2xs"
                  >
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Terminal
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSftp(host);
                    }}
                    className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 border border-slate-200"
                  >
                    <HardDrive className="w-4 h-4" />
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
