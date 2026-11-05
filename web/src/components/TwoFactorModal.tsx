import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, AlertCircle, ArrowRight, X, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Setup state
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Disable state
  const [disablePassword, setDisablePassword] = useState('');

  if (!isOpen) return null;

  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.generate2FA();
      setSecret(res.secret);
      setQrCode(res.qr_code);
      setStep('setup');
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(t('twoFactor.enterCodePrompt'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.enable2FA({ secret, code: code.trim() });
      await refreshUser();
      setSuccessMsg(t('twoFactor.enabledSuccess'));
      setStep('idle');
      setCode('');
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword) {
      setError(t('twoFactor.enterPasswordToDisable'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.disable2FA({ password: disablePassword });
      await refreshUser();
      setSuccessMsg(t('twoFactor.disabledSuccess'));
      setStep('idle');
      setDisablePassword('');
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = !!user?.two_factor_enabled;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-modal">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {isEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t('twoFactor.title')}</h2>
              <p className="text-xs text-slate-500">{t('twoFactor.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW: Status Idle */}
          {step === 'idle' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-start space-x-3.5 ${
                isEnabled
                  ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                  : 'bg-amber-50/50 border-amber-200 text-slate-800'
              }`}>
                {isEnabled ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-slate-900">
                    {isEnabled ? t('twoFactor.activeTitle') : t('twoFactor.inactiveTitle')}
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {isEnabled ? t('twoFactor.activeDesc') : t('twoFactor.inactiveDesc')}
                  </p>
                </div>
              </div>

              {isEnabled ? (
                <button
                  type="button"
                  onClick={() => setStep('disable')}
                  className="w-full h-10 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <span>{t('twoFactor.disable2FA')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartSetup}
                  disabled={loading}
                  className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm hover:shadow"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>{t('twoFactor.setupNow')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* VIEW: Step Setup (QR Scan & Enter Code) */}
          {step === 'setup' && (
            <form onSubmit={handleEnable2FA} className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-600">
                  {t('twoFactor.scanQrInstruction')}
                </p>
                {qrCode && (
                  <div className="inline-block p-2 bg-white border border-slate-200 rounded-xl shadow-xs">
                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
                  </div>
                )}
              </div>

              {/* Secret key fallback */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {t('twoFactor.secretKey')}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={secret}
                    className="w-full h-8 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t('common.copied') : t('common.copy')}</span>
                  </button>
                </div>
              </div>

              {/* 6-digit confirmation code */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  {t('twoFactor.enterCodePrompt')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full h-11 text-center text-xl font-mono tracking-[0.5em] bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-xl focus:outline-none transition"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('idle')}
                  className="w-1/3 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-2/3 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{t('twoFactor.confirmAndEnable')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* VIEW: Step Disable (Enter Password) */}
          {step === 'disable' && (
            <form onSubmit={handleDisable2FA} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                {t('twoFactor.disableWarning')}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  {t('twoFactor.enterPasswordToDisable')}
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 transition"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('idle')}
                  className="w-1/3 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || !disablePassword}
                  className="w-2/3 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('twoFactor.confirmDisable')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
