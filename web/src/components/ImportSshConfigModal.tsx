import React, { useState, useEffect } from 'react';
import { FileUp, X, Check, Server, KeyRound, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Credential } from '../types';
import { api } from '../services/api';

interface ImportSshConfigModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportSshConfigModal: React.FC<ImportSshConfigModalProps> = ({
  onClose,
  onImportSuccess,
}) => {
  const [configContent, setConfigContent] = useState<string>('');
  const [folder, setFolder] = useState<string>('Imported');
  const [credentialId, setCredentialId] = useState<string>('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'create'>('skip');
  const [newCount, setNewCount] = useState<number>(0);
  const [existingCount, setExistingCount] = useState<number>(0);

  useEffect(() => {
    api.getCredentials().then((creds) => {
      setCredentials(creds);
      if (creds.length > 0) setCredentialId(creds[0].id);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setConfigContent(text);
        runPreview(text);
      }
    };
    reader.readAsText(file);
  };

  const runPreview = async (text: string) => {
    if (!text.trim()) {
      setParsedPreview([]);
      setError(null);
      return;
    }
    setError(null);
    try {
      const res = await api.importSSHConfig({
        content: text,
        dry_run: true,
      });
      setParsedPreview(res.hosts || []);
      setNewCount(res.new_count || 0);
      setExistingCount(res.existing_count || 0);
      if (!res.hosts || res.hosts.length === 0) {
        setError('Không tìm thấy định nghĩa Host hợp lệ nào trong nội dung SSH config.');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể đọc cấu hình SSH. Định dạng không hợp lệ.');
      setParsedPreview([]);
    }
  };

  const handleContentChange = (val: string) => {
    setConfigContent(val);
    runPreview(val);
  };

  const handleExecuteImport = async () => {
    if (!configContent.trim()) {
      setError('Vui lòng nhập hoặc tải lên nội dung file ~/.ssh/config.');
      return;
    }

    if (parsedPreview.length === 0) {
      setError('Chưa phát hiện máy chủ nào để nhập.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.importSSHConfig({
        content: configContent,
        default_credential_id: credentialId,
        folder: folder.trim() || 'Imported',
        duplicate_strategy: duplicateStrategy,
        dry_run: false,
      });

      setSuccessCount(res.count);
      setTimeout(() => {
        onImportSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập máy chủ từ config.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-modal">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/75 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FileUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Nhập Cấu Hình SSH (~/.ssh/config)
              </h2>
              <p className="text-xs text-slate-500 font-normal">Tự động nhận diện cấu hình Host, User, Port và ProxyJump</p>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {successCount !== null ? (
            <div className="py-12 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Nhập thành công!</h3>
              <p className="text-xs text-slate-500">
                Đã thêm <span className="font-semibold text-slate-800">{successCount}</span> máy chủ vào danh sách quản lý.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chuyển toàn bộ danh bạ máy chủ từ máy tính cũ, OpenSSH hoặc MobaXterm sang MySSH chỉ trong 1 thao tác.
              </p>

              {/* Upload and Inputs Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Gắn vào Môi trường / Nhóm
                  </label>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder="vd: Imported, Production..."
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Gắn Key Vault mặc định
                  </label>
                  <select
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  >
                    <option value="">-- Không gắn key mặc định --</option>
                    {credentials.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === 'private_key' ? 'SSH Key' : 'Password'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Xử lý trùng lặp (Dedupe)
                  </label>
                  <select
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                    className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  >
                    <option value="skip">Bỏ qua máy chủ đã có</option>
                    <option value="update">Cập nhật thông tin máy chủ đã có</option>
                    <option value="create">Tạo bản sao mới</option>
                  </select>
                </div>
              </div>

              {/* File Picker or Direct Paste */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Nội dung file ~/.ssh/config <span className="text-rose-500">*</span>
                  </label>
                  <label className="cursor-pointer text-xs text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1.5 active:scale-95 transition">
                    <FileUp className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tải file từ máy tính</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={5}
                  value={configContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={`Host prod-api\n    HostName 10.0.1.20\n    User ubuntu\n    Port 22\n\nHost bastion\n    HostName 203.0.113.1\n    User ec2-user`}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Live Parsed Preview Table */}
              {parsedPreview.length > 0 && (
                <div className="space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Xem trước máy chủ phát hiện ({parsedPreview.length} máy chủ: {newCount} mới, {existingCount} đã có):
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold">
                      Sẵn sàng nhập
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase">
                          <th className="py-2 px-3.5">Tên</th>
                          <th className="py-2 px-3.5">Host / IP</th>
                          <th className="py-2 px-3.5">Port</th>
                          <th className="py-2 px-3.5">User</th>
                          <th className="py-2 px-3.5">ProxyJump</th>
                          <th className="py-2 px-3.5">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {parsedPreview.map((h, i) => (
                          <tr key={i} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3.5 font-sans font-semibold text-slate-900">{h.name}</td>
                            <td className="py-2 px-3.5 text-slate-700">{h.hostname}</td>
                            <td className="py-2 px-3.5 text-slate-500">{h.port}</td>
                            <td className="py-2 px-3.5 text-slate-600">{h.username}</td>
                            <td className="py-2 px-3.5 text-slate-400">{h.proxy_jump || '-'}</td>
                            <td className="py-2 px-3.5 font-sans">
                              {h.status === 'existing' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Đã tồn tại
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Mới
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {successCount === null && (
          <div className="h-14 border-t border-slate-200 px-6 flex items-center justify-end space-x-3 bg-slate-50/75">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={loading || parsedPreview.length === 0}
              className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-950 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <span>{loading ? 'Đang nhập...' : `Nhập ${parsedPreview.length} Máy Chủ`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
