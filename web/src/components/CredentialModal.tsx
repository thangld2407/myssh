import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  X,
  Sparkles,
  Copy,
  Check,
  Lock,
  Shield,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
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
  const [serverError, setServerError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Validation state
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const data = await api.getCredentials();
      setCredentials(data);
    } catch (err: any) {
      setServerError(err.message || 'Lỗi khi tải danh sách khóa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const validateField = (field: string, val: any): string => {
    switch (field) {
      case 'name':
        if (!val || !val.trim()) return 'Vui lòng nhập tên gợi nhớ cho khóa.';
        if (val.trim().length < 2) return 'Tên gợi nhớ tối thiểu 2 ký tự.';
        return '';
      case 'secret':
        if (!val || !val.trim()) {
          return type === 'password'
            ? 'Vui lòng nhập mật khẩu SSH.'
            : 'Vui lòng dán nội dung SSH Private Key.';
        }
        if (type === 'private_key' && !val.includes('PRIVATE KEY')) {
          return 'Định dạng khóa không hợp lệ (cần chứa -----BEGIN ... PRIVATE KEY-----).';
        }
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

  const handleGenerateKey = async () => {
    try {
      setServerError(null);
      const keyName = name.trim() || `Ed25519 Key ${new Date().toLocaleDateString('vi-VN')}`;
      const res = await api.generateKey(keyName);
      setGeneratedInfo({ pub: res.public_key, priv: res.private_key });
      setSecret(res.private_key);
      setPublicKey(res.public_key);
      setType('private_key');
      if (!name) setName(keyName);

      // Clear secret error if any
      setErrors((prev) => ({ ...prev, secret: '' }));
    } catch (err: any) {
      setServerError('Lỗi sinh khóa: ' + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateAll = (): boolean => {
    const errs: Record<string, string> = {
      name: validateField('name', name),
      secret: validateField('secret', secret),
    };

    setErrors(errs);
    setTouched({ name: true, secret: true });

    return !Object.values(errs).some((e) => e !== '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateAll()) return;

    setSubmitting(true);
    try {
      await api.createCredential({
        name: name.trim(),
        type,
        secret: secret.trim(),
        passphrase: passphrase.trim() || undefined,
        public_key: publicKey.trim() || undefined,
      });

      setName('');
      setSecret('');
      setPassphrase('');
      setPublicKey('');
      setGeneratedInfo(null);
      setShowForm(false);
      setTouched({});
      setErrors({});
      fetchCredentials();
      onCredentialsUpdated?.();
    } catch (err: any) {
      setServerError(err.message || 'Lỗi lưu credential.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, credName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa credential "${credName}"?`)) return;
    setDeletingId(id);
    try {
      await api.deleteCredential(id);
      fetchCredentials();
      onCredentialsUpdated?.();
    } catch (err: any) {
      setServerError('Không thể xóa: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-modal">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/75 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Key Vault & Credentials</h2>
              <p className="text-xs text-slate-500 font-normal">Mã hóa cấp quân sự AES-256-GCM • Argon2id</p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {!showForm ? (
              <button
                onClick={() => {
                  setShowForm(true);
                  setServerError(null);
                }}
                className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Credential
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowForm(false);
                  setServerError(null);
                }}
                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 text-xs font-semibold transition shadow-2xs"
              >
                Xem Danh Sách ({credentials.length})
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-90 shadow-2xs"
              title="Đóng (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-in fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Thông báo hệ thống</span>
              <span className="text-rose-600">{serverError}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {showForm ? (
            <form onSubmit={handleSubmit} noValidate className="bg-slate-50/60 border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Tạo Credential Mới</h3>
                  <p className="text-[11px] text-slate-500">Dữ liệu nhạy cảm được mã hóa trước khi lưu trữ vào cơ sở dữ liệu</p>
                </div>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tên gợi nhớ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleChange('name', e.target.value, setName)}
                    onBlur={(e) => handleBlur('name', e.target.value)}
                    placeholder="vd: AWS Production Key, Root Password..."
                    className={`w-full h-10 px-3.5 bg-white border rounded-lg text-xs text-slate-900 focus:outline-none transition ${
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Loại định danh <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as any);
                      setErrors((prev) => ({ ...prev, secret: '' }));
                    }}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  >
                    <option value="private_key">SSH Private Key (RSA / Ed25519 / ECDSA)</option>
                    <option value="password">Password (Mật khẩu SSH)</option>
                  </select>
                </div>
              </div>

              {generatedInfo && (
                <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-2 shadow-2xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Public Key mới tạo (Thêm vào remote server ~/.ssh/authorized_keys):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedInfo.pub)}
                      className="h-7 px-3 rounded-md bg-white hover:bg-slate-50 text-slate-800 text-xs flex items-center gap-1.5 font-mono border border-emerald-200 transition active:scale-95 shadow-2xs"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      {copied ? 'Đã sao chép' : 'Sao chép Public Key'}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-lg border border-emerald-100 overflow-x-auto select-all">
                    {generatedInfo.pub}
                  </pre>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {type === 'password' ? 'Mật khẩu SSH' : 'SSH Private Key (PEM format)'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                {type === 'password' ? (
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => handleChange('secret', e.target.value, setSecret)}
                    onBlur={(e) => handleBlur('secret', e.target.value)}
                    placeholder="Nhập mật khẩu SSH..."
                    className={`w-full h-10 px-3.5 bg-white border rounded-lg text-xs text-slate-900 focus:outline-none font-mono transition ${
                      touched.secret && errors.secret
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                    }`}
                  />
                ) : (
                  <textarea
                    rows={5}
                    value={secret}
                    onChange={(e) => handleChange('secret', e.target.value, setSecret)}
                    onBlur={(e) => handleBlur('secret', e.target.value)}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    className={`w-full p-3.5 bg-white border rounded-lg text-xs text-slate-900 focus:outline-none font-mono transition ${
                      touched.secret && errors.secret
                        ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                        : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                    }`}
                  />
                )}
                {touched.secret && errors.secret && (
                  <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.secret}</span>
                  </p>
                )}
              </div>

              {type === 'private_key' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Passphrase giải mã khóa (Nếu có)
                  </label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Để trống nếu khóa không đặt passphrase"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Passphrase dùng để giải mã Private Key được mã hóa bằng mật khẩu
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang mã hóa...</span>
                    </>
                  ) : (
                    <span>Mã hóa & Lưu Khóa</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Existing credentials list */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Danh sách khóa ({credentials.length})
                </h3>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  AES-256-GCM Vault
                </span>
              </div>

              {credentials.map((cred) => (
                <div
                  key={cred.id}
                  className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between shadow-xs transition"
                >
                  <div className="flex items-center space-x-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        cred.type === 'private_key'
                          ? 'bg-indigo-50 border-indigo-200/80 text-indigo-700'
                          : 'bg-emerald-50 border-emerald-200/80 text-emerald-700'
                      }`}
                    >
                      {cred.type === 'private_key' ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{cred.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                            cred.type === 'private_key'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          }`}
                        >
                          {cred.type === 'private_key' ? 'SSH Private Key' : 'Password'}
                        </span>
                        <span className="text-xs text-slate-400 font-normal">
                          • Đã mã hóa AES-256
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    {cred.public_key ? (
                      <button
                        onClick={() => copyToClipboard(cred.public_key!)}
                        className="h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-mono flex items-center gap-1.5 border border-slate-200 shadow-2xs transition"
                        title="Sao chép Public Key"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" /> Public Key
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono tracking-widest bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70 select-none">
                        ••••••••
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(cred.id, cred.name)}
                      disabled={deletingId === cred.id}
                      className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center active:scale-90 transition shadow-2xs disabled:opacity-50"
                      title="Xóa khóa này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {!loading && credentials.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">Chưa có credential nào</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Thêm SSH Private Key hoặc Password để bắt đầu kết nối an toàn tới các máy chủ từ xa.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs active:scale-95 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm Credential Đầu Tiên
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
