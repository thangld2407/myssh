import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'minimal' | 'badge' | 'full';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  variant = 'badge'
}) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language.startsWith('vi') ? 'vi' : 'en';

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'vi' : 'en';
    i18n.changeLanguage(nextLang);
  };

  if (variant === 'minimal') {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-semibold transition active:scale-95 ${
          currentLang === 'vi'
            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
            : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
        } ${className}`}
        title={currentLang === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English'}
      >
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <span>{currentLang === 'en' ? 'EN' : 'VI'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-mono font-medium flex items-center gap-1.5 transition active:scale-95 shadow-2xs ${className}`}
      title={currentLang === 'en' ? 'Chuyển sang Tiếng Việt' : 'Switch to English'}
    >
      <Globe className="w-3.5 h-3.5 text-slate-400" />
      <span className={currentLang === 'en' ? 'font-bold text-slate-900' : 'text-slate-400'}>EN</span>
      <span className="text-slate-300">/</span>
      <span className={currentLang === 'vi' ? 'font-bold text-emerald-700' : 'text-slate-400'}>VI</span>
    </button>
  );
};
