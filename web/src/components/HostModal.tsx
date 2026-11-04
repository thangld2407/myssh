import React, { useEffect, useState } from 'react';
import { Server, X, PlusCircle } from 'lucide-react';
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
  const [port, setPort] = useState(hostToEdit?.port || 22);
  const [username, setUsername] = useState(hostToEdit?.username || 'root');
  const [folder, setFolder] = useState(hostToEdit?.folder || 'General');
  const [tags, setTags] = useState(hostToEdit?.tags || '');
  const [credentialId, setCredentialId] = useState(hostToEdit?.credential_id || '');
  const [jumpHostId, setJumpHostId] = useState(hostToEdit?.jump_host_id || '');
  const [description, setDescription] = useState(hostToEdit?.description || '');

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getCredentials().then((creds) => {
      setCredentials(creds);
      if (!credentialId && creds.length > 0) {
        setCredentialId(creds[0].id);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hostname.trim() || !credentialId) {
      alert('Vui lòng điền đầy đủ tên máy chủ, địa chỉ IP/Hostname và chọn Credential.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        hostname,
        port: Number(port),
        username,
        folder,
        tags,
        credential_id: credentialId,
        jump_host_id: jumpHostId || undefined,
        description,
      };

      if (hostToEdit) {
        await api.updateHost(hostToEdit.id, payload);
      } else {
        await api.createHost(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert('Lỗi lưu máy chủ: ' + err.message);
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tên máy chủ</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="vd: Prod-Web-01"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Thư mục / Môi trường</label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="Production, Staging..."
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Địa chỉ IP / Hostname</label>
              <input
                type="text"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="192.168.1.10 hoặc domain.com"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cổng Port</label>
              <input
                type="number"
                required
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">User SSH</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root, ubuntu..."
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tags (cách nhau dấu phẩy)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="web, db, aws"
                className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>
          </div>

          {/* Credential */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Khóa xác thực (Credential / Key)</label>
              <button
                type="button"
                onClick={onOpenCredentialModal}
                className="text-slate-500 hover:text-slate-900 text-xs flex items-center gap-1 font-medium transition active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-400" /> Quản lý Key Vault
              </button>
            </div>
            <select
              required
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="" disabled>-- Chọn Credential --</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Jump Host */}
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
                    {h.name} ({h.hostname})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ghi chú</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú thêm..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 active:scale-95 text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
            >
              {submitting ? 'Đang lưu...' : (hostToEdit ? 'Cập nhật' : 'Thêm Máy Chủ')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
