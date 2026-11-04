import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, X, Sparkles, Copy, Check, Lock, Shield } from 'lucide-react';
import { Credential } from '../types';
import { api } from '../services/api';

interface CredentialModalProps {
  onClose: () => void;
  onCredentialsUpdated?: () => void;
}

export const CredentialModal: React.FC<CredentialModalProps> = ({ onClose, onCredentialsUpdated }) => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'password' | 'private_key'>('private_key');
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [generatedInfo, setGeneratedInfo] = useState<{ pub: string; priv: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const data = await api.getCredentials();
      setCredentials(data);
    } catch (err: any) {
      alert('Lỗi tải danh sách credentials: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleGenerateKey = async () => {
    try {
      const res = await api.generateKey(name || 'myssh-key');
      setGeneratedInfo({ pub: res.public_key, priv: res.private_key });
      setSecret(res.private_key);
      setPublicKey(res.public_key);
      setType('private_key');
      if (!name) setName('Ed25519 Key ' + new Date().toLocaleDateString());
    } catch (err: any) {
      alert('Lỗi sinh khóa: ' + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !secret.trim()) return;

    setSubmitting(true);
    try {
      await api.createCredential({
        name,
        type,
        secret,
        passphrase: passphrase || undefined,
        public_key: publicKey || undefined,
      });

      setName('');
      setSecret('');
      setPassphrase('');
      setPublicKey('');
      setGeneratedInfo(null);
      setShowForm(false);
      fetchCredentials();
      onCredentialsUpdated?.();
    } catch (err: any) {
      alert('Lỗi lưu credential: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, credName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa credential "${credName}"?`)) return;
    try {
      await api.deleteCredential(id);
      fetchCredentials();
      onCredentialsUpdated?.();
    } catch (err: any) {
      alert('Không thể xóa: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-modal">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center space-x-2.5">
            <KeyRound className="w-4 h-4 text-slate-700" />
            <h2 className="font-semibold text-slate-900 text-sm">Key Vault & Credentials (AES-256-GCM)</h2>
          </div>

          <div className="flex items-center space-x-2">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Credential
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-xs font-semibold text-slate-900">Tạo Credential mới</h3>
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="h-8 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-500" />
                  Sinh Ed25519 Key tự động
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tên gợi nhớ</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="vd: AWS Production Key"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Loại định danh</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  >
                    <option value="private_key">SSH Private Key (RSA / Ed25519)</option>
                    <option value="password">Password (Mật khẩu SSH)</option>
                  </select>
                </div>
              </div>

              {generatedInfo && (
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Public Key (Thêm vào remote server ~/.ssh/authorized_keys):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedInfo.pub)}
                      className="h-7 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs flex items-center gap-1 font-mono transition active:scale-95"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      {copied ? 'Đã copy' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 overflow-x-auto select-all">
                    {generatedInfo.pub}
                  </pre>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {type === 'password' ? 'Mật khẩu' : 'SSH Private Key (PEM format)'}
                </label>
                {type === 'password' ? (
                  <input
                    type="password"
                    required
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Nhập mật khẩu SSH..."
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                  />
                ) : (
                  <textarea
                    rows={5}
                    required
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                  />
                )}
              </div>

              {type === 'private_key' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Passphrase bảo vệ khóa (Nếu có)
                  </label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Để trống nếu không có passphrase"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs"
                >
                  {submitting ? 'Đang lưu...' : 'Mã hóa & Lưu'}
                </button>
              </div>
            </form>
          )}

          {/* Existing credentials */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Danh sách khóa ({credentials.length})
            </h3>

            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between shadow-xs transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">{cred.name}</h4>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                      {cred.type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {cred.public_key && (
                    <button
                      onClick={() => copyToClipboard(cred.public_key!)}
                      className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-mono flex items-center gap-1.5 border border-slate-200 shadow-2xs transition"
                      title="Copy Public Key"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" /> Public Key
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(cred.id, cred.name)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-600 active:scale-90 transition"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {!loading && credentials.length === 0 && !showForm && (
              <div className="text-center py-8 text-slate-400 text-xs">
                Chưa có credential nào được lưu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
