import React, { useState } from 'react';
import { Heart, Coffee, Rocket, Crown, X, Copy, Check, ExternalLink, QrCode } from 'lucide-react';

interface SponsorModalProps {
  onClose: () => void;
}

export const SponsorModal: React.FC<SponsorModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'tiers' | 'backers' | 'qr'>('tiers');
  const [copiedCrypto, setCopiedCrypto] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCrypto(id);
    setTimeout(() => setCopiedCrypto(null), 2000);
  };

  const backers = [
    { name: 'Alex Nguyen', role: 'DevOps Lead', amount: '$50', tier: 'Legendary', message: 'Công cụ web bastion gọn nhẹ, thay thế hoàn toàn file private key rải rác.' },
    { name: 'Minh Tran', role: 'Senior SRE', amount: '$20', tier: 'Pro Backer', message: 'Session audit với asciinema rất hữu ích cho compliance.' },
    { name: 'David K.', role: 'Open Source Fan', amount: '$15', tier: 'Pro Backer', message: 'Clean code & great web terminal UX.' },
    { name: 'Hoang Le', role: 'Backend Engineer', amount: '$5', tier: 'Coffee', message: 'Tặng team ly cà phê đá.' },
    { name: 'Duc Pham', role: 'Cloud Architect', amount: '$25', tier: 'Pro Backer', message: 'Ủng hộ dự án build in public.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 animate-modal">
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center space-x-2.5">
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Sponsor MySSH (Build in Public)</h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 px-6 pt-3 pb-2.5 border-b border-slate-200 bg-slate-50/50 text-xs">
          <button
            onClick={() => setActiveTab('tiers')}
            className={`h-8 px-3.5 rounded-lg transition text-xs active:scale-95 ${
              activeTab === 'tiers'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            Gói Tài Trợ
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`h-8 px-3.5 rounded-lg transition text-xs flex items-center gap-1.5 active:scale-95 ${
              activeTab === 'qr'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            VietQR / MoMo
          </button>

          <button
            onClick={() => setActiveTab('backers')}
            className={`h-8 px-3.5 rounded-lg transition text-xs active:scale-95 ${
              activeTab === 'backers'
                ? 'bg-white text-slate-900 font-semibold shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            Nhà Tài Trợ ({backers.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 bg-white">
          {activeTab === 'tiers' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                MySSH là giải pháp mã nguồn mở 100% miễn phí. Khoản tài trợ giúp duy trì server hạ tầng và phát triển các tính năng tiếp theo trong roadmap.
              </p>

              {/* Tiers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Coffee */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                  <div>
                    <Coffee className="w-4 h-4 text-slate-600 mb-2" />
                    <h3 className="font-semibold text-slate-900 text-xs">Coffee</h3>
                    <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                      $3 - $5
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Vinh danh tên trên danh sách nhà tài trợ.
                    </p>
                  </div>

                  <a
                    href="https://buymeacoffee.com"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 w-full h-9 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition shadow-2xs"
                  >
                    Buy Coffee <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>

                {/* Pro Backer */}
                <div className="bg-slate-50/50 border-2 border-slate-900 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                  <div className="absolute top-2.5 right-2.5 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white font-semibold">
                    Popular
                  </div>
                  <div>
                    <Rocket className="w-4 h-4 text-slate-900 mb-2" />
                    <h3 className="font-semibold text-slate-900 text-xs">Pro Backer</h3>
                    <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                      $15
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2">
                      Nhân 3 trọng số biểu quyết tính năng trên Roadmap.
                    </p>
                  </div>

                  <a
                    href="https://github.com/sponsors"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 w-full h-9 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs"
                  >
                    GitHub Sponsors <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>

                {/* Legendary */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                  <div>
                    <Crown className="w-4 h-4 text-slate-600 mb-2" />
                    <h3 className="font-semibold text-slate-900 text-xs">Patron</h3>
                    <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                      $50+
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Đặt logo / tên thương hiệu trên README GitHub.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('qr')}
                    className="mt-4 w-full h-9 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition shadow-2xs"
                  >
                    Ủng hộ
                  </button>
                </div>
              </div>

              {/* Crypto Wallets */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                  Ví Crypto (USDT / ETH):
                </span>
                <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-mono shadow-2xs">
                  <span className="text-slate-700 truncate mr-2">0x71C...4f3B9</span>
                  <button
                    onClick={() => copyToClipboard('0x71C000000000000000000000000000000004f3B9', 'eth')}
                    className="h-7 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 text-xs font-sans font-medium active:scale-95 transition"
                  >
                    {copiedCrypto === 'eth' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCrypto === 'eth' ? 'Đã copy' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center p-4 space-y-3 text-center">
              <div className="p-3 bg-white rounded-xl inline-block border border-slate-200 shadow-xs">
                <div className="w-40 h-40 bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-2 border border-slate-200 rounded-lg">
                  <QrCode className="w-12 h-12 text-slate-800 mb-1" />
                  <p className="text-[11px] font-bold uppercase text-slate-900">VietQR / MoMo</p>
                  <p className="text-[9px] text-slate-500 font-mono">Chuyển khoản nhanh</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-700">
                  Nội dung chuyển khoản: <span className="font-mono text-slate-900 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">MySSH - Tên bạn</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Tên của bạn sẽ được hiển thị trên danh sách nhà tài trợ ở phiên bản tiếp theo.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'backers' && (
            <div className="space-y-2.5">
              {backers.map((backer, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900 text-xs">{backer.name}</h4>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        {backer.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mt-0.5">"{backer.message}"</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-900">{backer.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
