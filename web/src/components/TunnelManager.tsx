import React, { useEffect, useState } from 'react';
import { Network, Play, Square, Plus, Trash2 } from 'lucide-react';
import { Tunnel, Host } from '../types';
import { api } from '../services/api';

interface TunnelManagerProps {
  hosts: Host[];
}

export const TunnelManager: React.FC<TunnelManagerProps> = ({ hosts }) => {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState('');
  const [type, setType] = useState<'local' | 'socks5'>('local');
  const [bindHost, setBindHost] = useState('127.0.0.1');
  const [bindPort, setBindPort] = useState(8081);
  const [targetHost, setTargetHost] = useState('127.0.0.1');
  const [targetPort, setTargetPort] = useState(80);
  const [submitting, setSubmitting] = useState(false);

  const fetchTunnels = async () => {
    setLoading(true);
    try {
      const data = await api.getTunnels();
      setTunnels(data);
    } catch (err: any) {
      alert('Lỗi tải danh sách tunnels: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTunnels();
    if (hosts.length > 0 && !hostId) {
      setHostId(hosts[0].id);
    }
  }, [hosts]);

  const handleCreateTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hostId) return;

    setSubmitting(true);
    try {
      await api.createTunnel({
        name,
        host_id: hostId,
        type,
        bind_host: bindHost,
        bind_port: Number(bindPort),
        target_host: targetHost,
        target_port: Number(targetPort),
      });

      setShowAddModal(false);
      setName('');
      fetchTunnels();
    } catch (err: any) {
      alert('Lỗi tạo tunnel: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTunnel = async (tunnel: Tunnel) => {
    try {
      if (tunnel.status === 'running') {
        await api.stopTunnel(tunnel.id);
      } else {
        await api.startTunnel(tunnel.id);
      }
      fetchTunnels();
    } catch (err: any) {
      alert('Thao tác thất bại: ' + err.message);
    }
  };

  const handleDeleteTunnel = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa tunnel này?')) return;
    try {
      await api.deleteTunnel(id);
      fetchTunnels();
    } catch (err: any) {
      alert('Lỗi xóa tunnel: ' + err.message);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 text-slate-800">
      {/* Header */}
      <div className="h-10 flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            SSH Port Forwarding & Tunnels
          </h1>
          <p className="text-[11px] text-slate-500">
            Local Port Forwarding và Dynamic SOCKS5 Proxy
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Tạo Tunnel
        </button>
      </div>

      {/* Grid of Tunnels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tunnels.map((tunnel) => (
          <div
            key={tunnel.id}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between shadow-xs transition"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-xs">{tunnel.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        {tunnel.type}
                      </span>
                      <span className={`text-[10px] font-mono font-medium ${tunnel.status === 'running' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {tunnel.status}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTunnel(tunnel.id)}
                  className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Network flow */}
              <div className="mt-3.5 p-3 bg-slate-50 rounded-lg border border-slate-200/80 font-mono text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span className="text-slate-400 font-medium">Local:</span>
                  <span className="text-slate-900 font-semibold">{tunnel.bind_host}:{tunnel.bind_port}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span className="text-slate-400 font-medium">Gateway:</span>
                  <span className="text-slate-800">{tunnel.host?.name || 'Server'}</span>
                </div>

                {tunnel.type === 'local' && (
                  <div className="flex items-center justify-between text-slate-600 text-[11px] pt-1.5 border-t border-slate-200/60">
                    <span className="text-slate-400 font-medium">Target:</span>
                    <span className="text-slate-800 font-medium">{tunnel.target_host}:{tunnel.target_port}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleToggleTunnel(tunnel)}
                className={`w-full py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  tunnel.status === 'running'
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                }`}
              >
                {tunnel.status === 'running' ? (
                  <>
                    <Square className="w-3 h-3 fill-current" /> Dừng
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" /> Chạy
                  </>
                )}
              </button>
            </div>
          </div>
        ))}

        {tunnels.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            Chưa có Port Forwarding Tunnel nào được cấu hình.
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateTunnel}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-3.5 text-slate-800"
          >
            <h3 className="text-xs font-semibold text-slate-900">Tạo SSH Tunnel mới</h3>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tên Tunnel</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="vd: Remote Postgres 5432"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Máy chủ Gateway</label>
                <select
                  required
                  value={hostId}
                  onChange={(e) => setHostId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                >
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.hostname})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Loại Forwarding</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                >
                  <option value="local">Local Port Forwarding</option>
                  <option value="socks5">Dynamic SOCKS5 Proxy</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bind Host</label>
                <input
                  type="text"
                  value={bindHost}
                  onChange={(e) => setBindHost(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bind Port</label>
                <input
                  type="number"
                  required
                  value={bindPort}
                  onChange={(e) => setBindPort(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 font-mono"
                />
              </div>
            </div>

            {type === 'local' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Host</label>
                  <input
                    type="text"
                    required
                    value={targetHost}
                    onChange={(e) => setTargetHost(e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Port</label>
                  <input
                    type="number"
                    required
                    value={targetPort}
                    onChange={(e) => setTargetPort(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 font-mono"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition"
              >
                Tạo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
