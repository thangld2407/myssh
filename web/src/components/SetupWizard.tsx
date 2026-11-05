import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal, Shield, ArrowRight, CheckCircle2, Lock, KeyRound, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export const SetupWizard: React.FC = () => {
  const { t } = useTranslation();
  const { setup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Field validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass)) score += 25;
    if (/[^A-Za-z0-9]/.test(pass)) score += 25;
    return score;
  };

  const strength = getPasswordStrength(password);

  const isPasswordShort = password.length > 0 && password.length < 8;
  const isMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({ username: true, password: true, confirmPassword: true });

    if (!username.trim()) {
      setError(t('setupWizard.usernameRequired'));
      return;
    }

    if (password.length < 8) {
      setError(t('setupWizard.shortPassword'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('setupWizard.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await setup(username.trim(), password, fullName.trim() || undefined);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center p-4 select-none relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="badge" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-8 shadow-2xl shadow-slate-200/80 animate-modal">
        {/* Wizard Header */}
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">{t('setupWizard.title')}</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold">
                {t('setupWizard.badge')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">{t('setupWizard.subtitle')}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('setupWizard.fullName')}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('setupWizard.fullNamePlaceholder')}
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('auth.username')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, username: true }))}
              placeholder="admin"
              className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition font-mono ${
                touched.username && !username.trim()
                  ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500'
                  : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
              }`}
            />
            {touched.username && !username.trim() && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{t('setupWizard.usernameRequired')}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('auth.password')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                placeholder="••••••••"
                className={`w-full h-10 pl-3.5 pr-10 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition font-mono ${
                  touched.password && isPasswordShort
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Validation warning */}
            {touched.password && isPasswordShort && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{t('setupWizard.shortPassword')}</span>
              </p>
            )}

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      strength <= 25
                        ? 'bg-rose-500'
                        : strength <= 50
                        ? 'bg-amber-500'
                        : strength <= 75
                        ? 'bg-blue-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{t('setupWizard.passwordStrength')}</span>
                  <span className="font-semibold">
                    {strength <= 25
                      ? t('setupWizard.weak')
                      : strength <= 50
                      ? t('setupWizard.medium')
                      : strength <= 75
                      ? t('setupWizard.fair')
                      : t('setupWizard.strong')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('setupWizard.confirmPassword')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
                placeholder={t('setupWizard.confirmPasswordPlaceholder')}
                className={`w-full h-10 pl-3.5 pr-10 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition font-mono ${
                  touched.confirmPassword && isMismatch
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {touched.confirmPassword && isMismatch && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{t('setupWizard.passwordMismatch')}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 mt-3"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('setupWizard.submitting')}</span>
              </>
            ) : (
              <>
                <span>{t('setupWizard.submit')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('setupWizard.securityNotice')}</span>
        </div>
      </div>
    </div>
  );
};
