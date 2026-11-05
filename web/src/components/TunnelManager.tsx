import React, { useEffect, useState } from 'react';
import { Network, Play, Square, Plus, Trash2, X, AlertCircle, CheckCircle2, Shield, ArrowRight } from 'lucide-react';
import { Tunnel, Host } from '../types';
import { api } from '../services/api';

interface TunnelManagerProps {
  hosts: Host[];
}

export const TunnelManager: React.FC<TunnelManagerProps> = ({ hosts }) => {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState('');
  const [type, setType] = useState<'local' | 'socks5'>('local');
  const [bindHost, setBindHost] = useState('127.0.0.1');
  const [bindPort, setBindPort] = useState<number | string>(8081);
  const [targetHost, setTargetHost] = useState('127.0.0.1');
  const [targetPort, setTargetPort] = useState<number | string>(80);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchTunnels = async () => {
    setLoading(true);
    try {
      const data = await api.getTunnels();
      setTunnels(data);
    } catch (err: any) {
      setServerError(err.message || 'Lỗi khi tải danh sách tunnel');
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

  const validateField = (field: string, val: any): string => {
    switch (field) {
      case 'name':
        if (!val || !val.trim()) return 'Vui lòng nhập tên Tunnel.';
        if (val.trim().length < 2) return 'Tên Tunnel tối thiểu 2 ký tự.';
        return '';
      case 'hostId':
        if (!val) return 'Vui lòng chọn Máy chủ Gateway.';
        return '';
      case 'bindHost':
        if (!val || !val.trim()) return 'Vui lòng nhập Bind Host.';
        return '';
      case 'bindPort': {
        const p = Number(val);
        if (val === '' || isNaN(p)) return 'Port phải là số nguyên.';
        if (p < 1 || p > 65535) return 'Port phải từ 1 đến 65535.';
        return '';
      }
      case 'targetHost':
        if (type === 'local' && (!val || !val.trim())) return 'Vui lòng nhập Target Host.';
        return '';
      case 'targetPort': {
        if (type === 'local') {
          const p = Number(val);
          if (val === '' || isNaN(p)) return 'Port phải là số nguyên.';
          if (p < 1 || p > 65535) return 'Port phải từ 1 đến 65535.';
        }
        return '';
      }
      default:
        return '';
    }
  };

  const handleBlur = (field: string, val: any) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, val);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleChange = (field: string, val: any, setter: (v: any) => void) => {
    setter(val);
    if (touched[field]) {
      const err = validateField(field, val);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const validateAll = (): boolean => {
    const errs: Record<string, string> = {
      name: validateField('name', name),
      hostId: validateField('hostId', hostId),
      bindHost: validateField('bindHost', bindHost),
      bindPort: validateField('bindPort', bindPort),
      targetHost: validateField('targetHost', targetHost),
      targetPort: validateField('targetPort', targetPort),
    };

    setErrors(errs);
    setTouched({
      name: true,
      hostId: true,
      bindHost: true,
      bindPort: true,
      targetHost: true,
      targetPort: true,
    });

    return !Object.values(errs).some((e) => e !== '');
  };

  const handleCreateTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validateAll()) return;

    setSubmitting(true);
    try {
      await api.createTunnel({
        name: name.trim(),
        host_id: hostId,
        type,
        bind_host: bindHost.trim(),
        bind_port: Number(bindPort),
        target_host: type === 'local' ? targetHost.trim() : '0.0.0.0',
        target_port: type === 'local' ? Number(targetPort) : 0,
      });

      setShowAddModal(false);
      setName('');
      setTouched({});
      setErrors({});
      fetchTunnels();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi tạo tunnel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTunnel = async (tunnel: Tunnel) => {
    try {
      setServerError(null);
      if (tunnel.status === 'running') {
        await api.stopTunnel(tunnel.id);
      } else {
        await api.startTunnel(tunnel.id);
      }
      fetchTunnels();
    } catch (err: any) {
      setServerError(err.message || 'Thao tác đổi trạng thái tunnel thất bại');
    }
  };

  const handleDeleteTunnel = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa tunnel này?')) return;
    try {
      setServerError(null);
      await api.deleteTunnel(id);
      fetchTunnels();
    } catch (err: any) {
      setServerError(err.message || 'Lỗi khi xóa tunnel');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 text-slate-800">
      {/* Header */}
      <div className="h-12 flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            SSH Port Forwarding & Tunnels
          </h1>
          <p className="text-xs text-slate-500">
            Local Port Forwarding và Dynamic SOCKS5 Proxy an toàn qua SSH Gateway
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setFormError(null);
          }}
          className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Tạo Tunnel
        </button>
      </div>

      {serverError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Grid of Tunnels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tunnels.map((tunnel) => (
          <div
            key={tunnel.id}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between shadow-xs transition"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-xs truncate max-w-[180px]">
                  {tunnel.name}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    tunnel.status === 'running'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {tunnel.status}
                </span>
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 font-mono text-xs space-y-1 text-slate-600">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Loại:</span>
                  <span className="font-semibold text-slate-700 uppercase">
                    {tunnel.type}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Local Bind:</span>
                  <span className="text-slate-800">
                    {tunnel.bind_host}:{tunnel.bind_port}
                  </span>
                </div>
                {tunnel.type === 'local' && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Target Remote:</span>
                    <span className="text-slate-800">
                      {tunnel.target_host}:{tunnel.target_port}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleToggleTunnel(tunnel)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                  tunnel.status === 'running'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {tunnel.status === 'running' ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" /> Dừng
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Bật
                  </>
                )}
              </button>

              <button
                onClick={() => handleDeleteTunnel(tunnel.id)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition active:scale-90"
                title="Xóa tunnel"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {!loading && tunnels.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Network className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">Chưa có SSH Tunnel nào</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Chuyển hướng cổng (Local Port Forwarding) giúp bạn kết nối database nội bộ hoặc service private an toàn.
            </p>
            <button
              onClick={() => {
                setShowAddModal(true);
                setFormError(null);
              }}
              className="mt-4 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo Tunnel Đầu Tiên
            </button>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop">
          <form
            onSubmit={handleCreateTunnel}
            noValidate
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-800 animate-modal"
          >
            <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/75 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <Network className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tạo SSH Tunnel Mới</h3>
                  <p className="text-xs text-slate-500 font-normal">Port Forwarding hoặc Dynamic SOCKS5</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-90 shadow-2xs"
                title="Đóng (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tên gợi nhớ Tunnel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleChange('name', e.target.value, setName)}
                  onBlur={(e) => handleBlur('name', e.target.value)}
                  placeholder="vd: Remote Postgres 5432, Staging Redis..."
                  className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition ${
                    touched.name && errors.name
                      ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                  }`}
                />
                {touched.name && errors.name && (
                  <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Máy chủ Gateway <span className="text-rose-500">*</span>
                  </label>
                  {hosts.length === 0 ? (
                    <div className="text-[11px] text-rose-600">Chưa có máy chủ nào trong danh sách.</div>
                  ) : (
                    <select
                      value={hostId}
                      onChange={(e) => handleChange('hostId', e.target.value, setHostId)}
                      onBlur={(e) => handleBlur('hostId', e.target.value)}
                      className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition ${
                        touched.hostId && errors.hostId
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                      }`}
                    >
                      {hosts.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.hostname})
                        </option>
                      ))}
                    </select>
                  )}
                  {touched.hostId && errors.hostId && (
                    <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{errors.hostId}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Loại Forwarding <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  >
                    <option value="local">Local Port Forwarding</option>
                    <option value="socks5">Dynamic SOCKS5 Proxy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bind Host <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bindHost}
                    onChange={(e) => handleChange('bindHost', e.target.value, setBindHost)}
                    onBlur={(e) => handleBlur('bindHost', e.target.value)}
                    className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white font-mono transition ${
                      touched.bindHost && errors.bindHost
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                    }`}
                  />
                  {touched.bindHost && errors.bindHost && (
                    <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{errors.bindHost}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bind Port <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={bindPort}
                    onChange={(e) => handleChange('bindPort', e.target.value, setBindPort)}
                    onBlur={(e) => handleBlur('bindPort', e.target.value)}
                    min={1}
                    max={65535}
                    className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white font-mono transition ${
                      touched.bindPort && errors.bindPort
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                    }`}
                  />
                  {touched.bindPort && errors.bindPort && (
                    <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{errors.bindPort}</span>
                    </p>
                  )}
                </div>
              </div>

              {type === 'local' && (
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Target Host <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={targetHost}
                      onChange={(e) => handleChange('targetHost', e.target.value, setTargetHost)}
                      onBlur={(e) => handleBlur('targetHost', e.target.value)}
                      placeholder="127.0.0.1"
                      className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white font-mono transition ${
                        touched.targetHost && errors.targetHost
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                      }`}
                    />
                    {touched.targetHost && errors.targetHost && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.targetHost}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Target Port <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={targetPort}
                      onChange={(e) => handleChange('targetPort', e.target.value, setTargetPort)}
                      onBlur={(e) => handleBlur('targetPort', e.target.value)}
                      min={1}
                      max={65535}
                      className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white font-mono transition ${
                        touched.targetPort && errors.targetPort
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                          : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                      }`}
                    />
                    {touched.targetPort && errors.targetPort && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{errors.targetPort}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <span>Tạo Tunnel</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
