import React, { useState, useEffect } from 'react';
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
  FileUp,
  Zap,
  MoreVertical,
  Activity,
  FolderDown
} from 'lucide-react';
import { Host } from '../types';
import { api } from '../services/api';

interface HostListProps {
  hosts: Host[];
  selectedFolder: string;
  onOpenTerminal: (host: Host) => void;
  onOpenSftp: (host: Host) => void;
  onOpenMultiExec?: (hosts: Host[]) => void;
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
  onOpenMultiExec,
  onEditHost,
  onAddHost,
  onImportSSHConfig,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);

  // Persistent Host Status Map
  const [hostStatuses, setHostStatuses] = useState<
    Record<string, { success: boolean; latency?: number; message?: string }>
  >({});
  const [testingHostIds, setTestingHostIds] = useState<string[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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

  const handleTestSingleHost = async (hostId: string) => {
    if (testingHostIds.includes(hostId)) return;
    setTestingHostIds((prev) => [...prev, hostId]);
    const start = performance.now();
    try {
      const res = await api.testHost(hostId);
      const latency = Math.round(performance.now() - start);
      setHostStatuses((prev) => ({
        ...prev,
        [hostId]: { success: res.success, latency, message: res.message }
      }));
    } catch (err: any) {
      setHostStatuses((prev) => ({
        ...prev,
        [hostId]: { success: false, message: err.message || 'Kết nối thất bại' }
      }));
    } finally {
      setTestingHostIds((prev) => prev.filter((id) => id !== hostId));
    }
  };

  const handleTestAllHosts = async () => {
    if (isTestingAll || filteredHosts.length === 0) return;
    setIsTestingAll(true);
    // Test hosts in parallel with concurrency of 3
    const queue = [...filteredHosts];
    const worker = async () => {
      while (queue.length > 0) {
        const host = queue.shift();
        if (host) {
          await handleTestSingleHost(host.id);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setIsTestingAll(false);
  };

  const handleDeleteHost = async (host: Host, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
        <div className="flex items-center space-x-2.5">
          <div className="relative w-64 md:w-72">
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
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Chế độ Bảng"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 active:scale-95 ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Chế độ Lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Ping All Button */}
          <button
            onClick={handleTestAllHosts}
            disabled={isTestingAll || filteredHosts.length === 0}
            className="h-9 px-3 rounded-lg bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 border border-slate-200 shadow-2xs disabled:opacity-50"
            title="Kiểm tra kết nối toàn bộ máy chủ trong danh sách"
          >
            <Activity className={`w-3.5 h-3.5 text-slate-500 ${isTestingAll ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{isTestingAll ? 'Đang ping...' : 'Ping tất cả'}</span>
          </button>

          {/* Import SSH Config Button */}
          <button
            onClick={onImportSSHConfig}
            className="h-9 px-3 rounded-lg bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 border border-slate-200 shadow-2xs"
            title="Nhập máy chủ từ file ~/.ssh/config"
          >
            <FileUp className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Import Config</span>
          </button>

          {/* Primary Action Button: Modern Solid Black */}
          <button
            onClick={onAddHost}
            className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 active:bg-slate-950 text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 shadow-2xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Máy Chủ</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'table' ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-visible shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredHosts.length > 0 && selectedHostIds.length === filteredHosts.length}
                      onChange={() => {
                        if (selectedHostIds.length === filteredHosts.length) {
                          setSelectedHostIds([]);
                        } else {
                          setSelectedHostIds(filteredHosts.map((h) => h.id));
                        }
                      }}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 w-16 text-center">Status</th>
                  <th className="py-3 px-4">Tên Máy Chủ</th>
                  <th className="py-3 px-4">Địa Chỉ IP / Host</th>
                  <th className="py-3 px-4 w-28">User</th>
                  <th className="py-3 px-4 w-48">Khóa Xác Thực</th>
                  <th className="py-3 px-4 w-32">Môi Trường</th>
                  <th className="py-3 px-4 text-right pr-5 w-56">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredHosts.map((host) => {
                  const isTesting = testingHostIds.includes(host.id);
                  const status = hostStatuses[host.id];
                  const isSelected = selectedHostIds.includes(host.id);

                  return (
                    <tr
                      key={host.id}
                      onDoubleClick={() => onOpenTerminal(host)}
                      className={`hover:bg-slate-50/80 group transition-colors duration-150 cursor-pointer select-none ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedHostIds((prev) =>
                              prev.includes(host.id) ? prev.filter((i) => i !== host.id) : [...prev, host.id]
                            );
                          }}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => handleTestSingleHost(host.id)}
                            disabled={isTesting}
                            className="group/status relative inline-flex items-center justify-center p-1 rounded-full hover:bg-slate-100 transition active:scale-90"
                            title={
                              isTesting
                                ? 'Đang kiểm tra kết nối...'
                                : status
                                ? status.success
                                  ? `Online (Ping: ${status.latency}ms) - Bấm để kiểm tra lại`
                                  : `Lỗi: ${status.message} - Bấm để thử lại`
                                : 'Chưa kiểm tra - Bấm để ping'
                            }
                          >
                            {isTesting ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                            ) : status ? (
                              status.success ? (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-4 ring-emerald-50"></span>
                                </span>
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-50" />
                              )
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-300 group-hover/status:bg-slate-500 transition-colors" />
                            )}
                          </button>
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
                          <span
                            className="text-slate-600 flex items-center gap-1.5 truncate max-w-[190px]"
                            title={host.credential.name}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{host.credential.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Chưa gắn key</span>
                        )}
                      </td>

                      {/* Environment */}
                      <td className="py-3.5 px-4 font-sans">
                        <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 font-medium">
                          {host.folder || 'General'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right pr-5 font-sans relative" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Primary CTA: Connect Terminal */}
                          <button
                            onClick={() => onOpenTerminal(host)}
                            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 shadow-2xs"
                            title="Mở Web Terminal"
                          >
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Kết nối</span>
                          </button>

                          {/* Secondary CTA: SFTP Explorer */}
                          <button
                            onClick={() => onOpenSftp(host)}
                            className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all duration-150 border border-slate-200/60"
                            title="Quản lý File SFTP"
                          >
                            <FolderDown className="w-3.5 h-3.5 text-slate-600" />
                            <span>SFTP</span>
                          </button>

                          {/* More Options Dropdown */}
                          <div className="relative action-menu-container">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === host.id ? null : host.id)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95 border ${
                                activeMenuId === host.id
                                  ? 'bg-slate-200 text-slate-900 border-slate-300'
                                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900 border-transparent hover:border-slate-200'
                              }`}
                              title="Thao tác khác"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeMenuId === host.id && (
                              <div className="absolute right-0 top-full mt-1.5 z-50 w-44 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/60 p-1 text-xs text-left">
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleTestSingleHost(host.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <Radio className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Kiểm tra Ping SSH</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleCopyHost(host);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Sao chép lệnh SSH</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onEditHost(host);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Chỉnh sửa thông tin</span>
                                </button>

                                <div className="my-1 border-t border-slate-100" />

                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDeleteHost(host);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa máy chủ</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredHosts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-sans text-xs">
                      Không có máy chủ nào trong môi trường này. Bấm "Thêm Máy Chủ" hoặc "Import Config" để bắt đầu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View: Clean Minimalist Light Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHosts.map((host) => {
              const isTesting = testingHostIds.includes(host.id);
              const status = hostStatuses[host.id];

              return (
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
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 text-xs group-hover:text-black transition-colors">
                              {host.name}
                            </h3>
                            {/* Status Dot */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTestSingleHost(host.id);
                              }}
                              disabled={isTesting}
                              className="inline-flex items-center justify-center"
                              title={
                                isTesting
                                  ? 'Đang ping...'
                                  : status
                                  ? status.success
                                    ? `Online (${status.latency}ms)`
                                    : `Lỗi: ${status.message}`
                                  : 'Chưa kiểm tra'
                              }
                            >
                              {isTesting ? (
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              ) : status ? (
                                status.success ? (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100" />
                                )
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-slate-300" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">
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
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150 active:scale-90"
                          title="Sửa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteHost(host, e)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-150 active:scale-90"
                          title="Xóa"
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
                        <span
                          className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[140px] font-medium"
                          title={host.credential.name}
                        >
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
                      <FolderDown className="w-4 h-4 text-slate-600" />
                      SFTP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Multi-Exec Action Dock */}
      {selectedHostIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-modal border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold">Đã chọn {selectedHostIds.length} máy chủ</span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <button
            onClick={() => setSelectedHostIds([])}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Bỏ chọn
          </button>
          <button
            onClick={() => {
              const selected = hosts.filter((h) => selectedHostIds.includes(h.id));
              onOpenMultiExec?.(selected);
            }}
            className="h-8 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Chạy Multi-Exec ({selectedHostIds.length} máy)</span>
          </button>
        </div>
      )}
    </div>
  );
};
