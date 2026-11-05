import React from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Coffee, X, Sparkles, UserCheck } from 'lucide-react';
import momoQr from '../assets/momo.jpg';

interface SponsorModalProps {
  onClose: () => void;
}

export const SponsorModal: React.FC<SponsorModalProps> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-backdrop">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-modal">
        {/* Modal Header */}
        <div className="h-16 border-b border-slate-100 px-6 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shadow-xs">
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">{t('sponsor.title')}</h2>
              <p className="text-xs text-slate-500 font-normal">{t('sponsor.subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-90"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-4 bg-white">
          {/* Author Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-xs text-slate-700 font-medium">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('sponsor.author')}: <strong>Victor Le</strong></span>
          </div>

          {/* MoMo QR Code */}
          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition">
            <img
              src={momoQr}
              alt="MoMo QR - Victor Le"
              className="w-56 h-auto object-contain rounded-xl mx-auto select-none"
            />
          </div>

          {/* Friendly Note */}
          <div className="space-y-1.5 max-w-xs">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800">
              <Coffee className="w-4 h-4 text-amber-600" />
              <span>{t('sponsor.momoPrompt')}</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('sponsor.freeNote')}
            </p>
          </div>

          {/* Footer note */}
          <div className="w-full pt-3 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 font-mono">
              {t('sponsor.madeWithLove')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
