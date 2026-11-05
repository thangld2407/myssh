import React from 'react';
import {
  Terminal,
  Shield,
  KeyRound,
  Network,
  History,
  LogOut,
  Sparkles,
  Heart,
  Search,
  Star,
  ExternalLink,
  Palette,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeView: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap';
  onSelectView: (view: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap') => void;
  openTabsCount: number;
  onOpenTabsClick: () => void;
  onOpenCommandPalette: () => void;
  onOpenSponsor: () => void;
  onOpenSecurity: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onSelectView,
  openTabsCount,
  onOpenTabsClick,
  onOpenCommandPalette,
  onOpenSponsor,
  onOpenSecurity,
  theme,
  onToggleTheme,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#080d1a]/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30 sticky top-0 shadow-lg shadow-black/25">
      {/* Brand & Navigation */}
      <div className="flex items-center space-x-6">
        <div
          className="flex items-center space-x-2.5 cursor-pointer group"
          onClick={() => onSelectView('hosts')}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white group-hover:scale-105 transition-all shadow-md shadow-emerald-500/20">
            <Terminal className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-white text-base">
              MySSH
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
              Public Bastion
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center space-x-1">
          <button
            onClick={() => onSelectView('hosts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'hosts'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 font-semibold shadow-inner'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Máy chủ & Host
          </button>

          <button
            onClick={() => onSelectView('credentials')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'credentials'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 font-semibold shadow-inner'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Key Vault
          </button>

          <button
            onClick={() => onSelectView('tunnels')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'tunnels'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 font-semibold shadow-inner'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Tunnels
          </button>

          <button
            onClick={() => onSelectView('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'audit'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 font-semibold shadow-inner'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Session Audit
          </button>

          <button
            onClick={() => onSelectView('roadmap')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeView === 'roadmap'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-inner'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Roadmap & Vote
          </button>
        </nav>
      </div>

      {/* Right Area: Command Palette Search, Sponsor Button, User */}
      <div className="flex items-center space-x-2.5">
        {/* Quick Command Palette Button (⌘K) */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-400 hover:text-white transition shadow-sm"
          title="Mở bảng điều khiển phím tắt (⌘K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Tìm kiếm...</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
            ⌘K
          </kbd>
        </button>

        {/* Sponsor Button (Donate) with Heart Pulse */}
        <button
          onClick={onOpenSponsor}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-semibold transition shadow-md shadow-rose-600/30 hover:scale-105 active:scale-95"
        >
          <Heart className="w-3.5 h-3.5 fill-current animate-pulse" />
          <span className="hidden sm:inline">Sponsor</span>
        </button>

        {/* Active Terminals Indicator */}
        {openTabsCount > 0 && (
          <button
            onClick={onOpenTabsClick}
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-medium hover:bg-emerald-900/60 transition"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">{openTabsCount} Active</span>
          </button>
        )}

        {/* Theme Switcher Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
          title={`Theme hiện tại: ${theme.toUpperCase()} (Nhấp để đổi)`}
        >
          <Palette className="w-4 h-4" />
        </button>

        {/* Security & 2FA Setup */}
        <button
          onClick={onOpenSecurity}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition text-xs font-mono ${
            user?.two_factor_enabled
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
          }`}
          title="Bảo mật tài khoản & Xác thực hai yếu tố (2FA)"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px] font-medium">
            {user?.two_factor_enabled ? '2FA: Bật' : '2FA: Chưa Bật'}
          </span>
        </button>

        {/* User Badge */}
        <div className="flex items-center space-x-2 pl-2 pr-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-[11px]">
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline font-semibold text-white">{user?.username}</span>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Đăng xuất"
          className="p-2 rounded-xl bg-slate-900 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
