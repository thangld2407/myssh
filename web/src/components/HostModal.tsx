import React, { useEffect, useState } from 'react';
import { Server, X, PlusCircle, AlertCircle, CheckCircle2, ShieldCheck, KeyRound, Globe, Hash, User, Folder, Tag } from 'lucide-react';
import { Host, Credential } from '../types';
import { api } from '../services/api';

interface HostModalProps {
  hostToEdit?: Host | null;
  existingHosts: Host[];
  onClose: () => void;
  onSaved: () => void;
  onOpenCredentialModal: () => void;
}

export const HostModal: React.FC<HostModalProps> = ({
  hostToEdit,
  existingHosts,
  onClose,
  onSaved,
  onOpenCredentialModal,
}) => {
  const [name, setName] = useState(hostToEdit?.name || '');
  const [hostname, setHostname] = useState(hostToEdit?.hostname || '');
  const [port, setPort] = useState<number | string>(hostToEdit?.port ?? 22);
  const [username, setUsername] = useState(hostToEdit?.username || 'root');
  const [folder, setFolder] = useState(hostToEdit?.folder || 'General');
  const [tags, setTags] = useState(hostToEdit?.tags || '');
  const [credentialId, setCredentialId] = useState(hostToEdit?.credential_id || '');
  const [jumpHostId, setJumpHostId] = useState(hostToEdit?.jump_host_id || '');
  const [description, setDescription] = useState(hostToEdit?.description || '');

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Field Validation State
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getCredentials().then((creds) => {
      setCredentials(creds);
      setLoadingCreds(false);
      if (!credentialId && creds.length > 0) {
        setCredentialId(creds[0].id);
      }
    }).catch(() => setLoadingCreds(false));
  }, []);

  // Real-time validation handler
  const validateField = (field: string, val: any): string => {
    switch (field) {
      case 'name':
        if (!val || !val.trim()) return 'Vui lòng nhập tên máy chủ.';
        if (val.trim().length < 2) return 'Tên máy chủ tối thiểu 2 ký tự.';
        return '';
      case 'hostname':
        if (!val || !val.trim()) return 'Vui lòng nhập IP hoặc Hostname.';
        if (/\s/.test(val)) return 'Địa chỉ IP hoặc Hostname không được chứa khoảng trắng.';
        return '';
      case 'port': {
        const p = Number(val);
        if (val === '' || isNaN(p)) return 'Cổng Port phải là số nguyên.';
        if (p < 1 || p > 65535) return 'Cổng Port phải từ 1 đến 65535.';
        return '';
      }
      case 'username':
        if (!val || !val.trim()) return 'Vui lòng nhập User SSH.';
        return '';
      case 'credentialId':
        if (!val) return 'Vui lòng chọn khóa xác thực (Credential).';
        return '';
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
      hostname: validateField('hostname', hostname),
      port: validateField('port', port),
      username: validateField('username', username),
      credentialId: validateField('credentialId', credentialId),
    };

    setErrors(errs);
    setTouched({
      name: true,
      hostname: true,
      port: true,
      username: true,
      credentialId: true,
    });

    return !Object.values(errs).some((e) => e !== '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateAll()) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        hostname: hostname.trim(),
        port: Number(port),
        username: username.trim(),
        folder: folder.trim() || 'General',
        tags: tags.trim(),
        credential_id: credentialId,
        jump_host_id: jumpHostId || undefined,
        description: description.trim(),
      };

      if (hostToEdit) {
        await api.updateHost(hostToEdit.id, payload);
      } else {
        await api.createHost(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'Lỗi khi lưu thông tin máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-800 animate-modal">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/75 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                {hostToEdit ? 'Chỉnh Sửa Máy Chủ' : 'Thêm Máy Chủ Mới'}
              </h2>
              <p className="text-xs text-slate-500 font-normal">Cấu hình kết nối SSH & Bastion Jump Host</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-90 shadow-2xs"
            title="Đóng (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Server Error Alert Banner */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Không thể lưu máy chủ</span>
              <span className="text-rose-600">{serverError}</span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-8rem)]">
          {/* Row 1: Tên máy chủ & Môi trường */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tên máy chủ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleChange('name', e.target.value, setName)}
                  onBlur={(e) => handleBlur('name', e.target.value)}
                  placeholder="vd: Prod-Web-01"
                  className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition ${
                    touched.name && errors.name
                      ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                  }`}
                />
              </div>
              {touched.name && errors.name && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Môi trường / Nhóm
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="Production, Staging, Local-Test..."
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
              <p className="text-[10px] text-slate-400 mt-1">Mặc định: General</p>
            </div>
          </div>

          {/* Row 2: IP / Hostname & Port */}
          <div className="grid grid-cols-3 gap-3.5">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Địa chỉ IP / Hostname <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={hostname}
                  onChange={(e) => handleChange('hostname', e.target.value, setHostname)}
                  onBlur={(e) => handleBlur('hostname', e.target.value)}
                  placeholder="192.168.1.10 hoặc vps.mydomain.com"
                  className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition font-mono ${
                    touched.hostname && errors.hostname
                      ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                  }`}
                />
              </div>
              {touched.hostname && errors.hostname && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.hostname}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cổng Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => handleChange('port', e.target.value, setPort)}
                onBlur={(e) => handleBlur('port', e.target.value)}
                placeholder="22"
                min={1}
                max={65535}
                className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition font-mono ${
                  touched.port && errors.port
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                }`}
              />
              {touched.port && errors.port && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.port}</span>
                </p>
              )}
            </div>
          </div>

          {/* Row 3: User SSH & Tags */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                User SSH <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleChange('username', e.target.value, setUsername)}
                onBlur={(e) => handleBlur('username', e.target.value)}
                placeholder="root, ubuntu, deploy..."
                className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition font-mono ${
                  touched.username && errors.username
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                }`}
              />
              {touched.username && errors.username && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{errors.username}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tags (cách nhau dấu phẩy)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="web, db, aws, docker"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>
          </div>

          {/* Row 4: Credential */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <span>Khóa xác thực (Credential)</span>
                <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={onOpenCredentialModal}
                className="text-slate-500 hover:text-slate-900 text-xs flex items-center gap-1 font-medium transition active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-400" /> Quản lý Key Vault
              </button>
            </div>

            {loadingCreds ? (
              <div className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center text-xs text-slate-400">
                Đang tải danh sách khóa...
              </div>
            ) : credentials.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <span className="text-xs text-amber-800">Chưa có khóa xác thực nào trong Vault.</span>
                <button
                  type="button"
                  onClick={onOpenCredentialModal}
                  className="px-2.5 py-1 rounded bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700 transition"
                >
                  Tạo khóa mới
                </button>
              </div>
            ) : (
              <select
                value={credentialId}
                onChange={(e) => handleChange('credentialId', e.target.value, setCredentialId)}
                onBlur={(e) => handleBlur('credentialId', e.target.value)}
                className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition ${
                  touched.credentialId && errors.credentialId
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                }`}
              >
                <option value="" disabled>-- Chọn Credential --</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === 'private_key' ? 'SSH Key' : 'Password'})
                  </option>
                ))}
              </select>
            )}

            {touched.credentialId && errors.credentialId && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.credentialId}</span>
              </p>
            )}
          </div>

          {/* Row 5: Jump Host */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jump Host / Bastion trung gian (Tùy chọn)
            </label>
            <select
              value={jumpHostId}
              onChange={(e) => setJumpHostId(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="">Không sử dụng (Kết nối trực tiếp)</option>
              {existingHosts
                .filter((h) => h.id !== hostToEdit?.id)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.hostname}:{h.port})
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Dùng khi server nằm trong Private Subnet cần đi qua Bastion</p>
          </div>

          {/* Row 6: Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ghi chú máy chủ</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú mục đích, hệ điều hành hoặc hướng dẫn vận hành..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 active:scale-95 text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{hostToEdit ? 'Cập nhật máy chủ' : 'Thêm Máy Chủ'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
