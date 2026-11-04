import React, { useState, useEffect } from 'react';
import { FileUp, X, Check, Server, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
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
      return;
    }
    setError(null);
    try {
      const res = await api.importSSHConfig({
        content: text,
        dry_run: true,
      });
      setParsedPreview(res.hosts || []);
    } catch (err: any) {
      setError(err.message || 'Không thể đọc cấu hình SSH');
    }
  };

  const handleContentChange = (val: string) => {
    setConfigContent(val);
    runPreview(val);
  };

  const handleExecuteImport = async () => {
    if (!configContent.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.importSSHConfig({
        content: configContent,
        default_credential_id: credentialId,
        folder: folder.trim() || 'Imported',
        dry_run: false,
      });

      alert(`Đã nhập thành công ${res.count} máy chủ từ SSH config!`);
      onImportSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        {/* Header */}
        <div className="h-12 border-b border-slate-200 px-5 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center space-x-2.5">
            <FileUp className="w-4 h-4 text-slate-700" />
            <h2 className="font-semibold text-slate-900 text-xs">
              1-Click Import ~/.ssh/config & PuTTY Sessions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Chuyển toàn bộ danh bạ máy chủ từ máy tính cũ, MobaXterm hoặc OpenSSH sang MySSH chỉ trong 1 bước.
          </p>

          {/* Upload and Inputs Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Gắn vào Thư mục / Môi trường
              </label>
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="vd: Imported, Production..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Gắn Key Vault mặc định
              </label>
              <select
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
              >
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File Picker or Direct Paste */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-700">
                Nội dung file ~/.ssh/config
              </label>
              <label className="cursor-pointer text-[11px] text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1">
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
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Live Parsed Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">
                  Xem trước máy chủ phát hiện ({parsedPreview.length}):
                </span>
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.2 rounded font-mono text-[10px]">
                  Sẵn sàng nhập
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase">
                      <th className="py-1.5 px-3">Tên</th>
                      <th className="py-1.5 px-3">Host / IP</th>
                      <th className="py-1.5 px-3">Port</th>
                      <th className="py-1.5 px-3">User</th>
                      <th className="py-1.5 px-3">ProxyJump</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {parsedPreview.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-3 font-sans font-semibold text-slate-900">{h.name}</td>
                        <td className="py-1.5 px-3 text-slate-700">{h.hostname}</td>
                        <td className="py-1.5 px-3 text-slate-500">{h.port}</td>
                        <td className="py-1.5 px-3 text-slate-600">{h.username}</td>
                        <td className="py-1.5 px-3 text-slate-400">{h.proxy_jump || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="h-14 border-t border-slate-200 px-5 flex items-center justify-end space-x-2 bg-slate-50/75">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={loading || parsedPreview.length === 0}
            className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
          >
            <span>{loading ? 'Đang nhập...' : `Nhập ${parsedPreview.length} Máy Chủ`}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
