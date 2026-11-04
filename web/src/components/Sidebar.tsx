import React from 'react';
import {
  Server,
  KeyRound,
  Network,
  History,
  Sparkles,
  Heart,
  LogOut,
  Folder,
  Plus,
  Terminal,
  Code2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Host, FeatureFlags } from '../types';

interface SidebarProps {
  activeView: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap';
  onSelectView: (view: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap') => void;
  hosts: Host[];
  selectedFolder: string;
  onSelectFolder: (folder: string) => void;
  onAddHost: () => void;
  onOpenSnippets: () => void;
  onOpenSponsor: () => void;
  features?: FeatureFlags;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  hosts,
  selectedFolder,
  onSelectFolder,
  onAddHost,
  onOpenSnippets,
  onOpenSponsor,
  features,
}) => {
  const { user, logout } = useAuth();
  const folders = Array.from(new Set(hosts.map((h) => h.folder || 'General')));

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between select-none shrink-0 h-full">
      <div className="flex flex-col">
        {/* Workspace Brand */}
        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm tracking-tight">
                MySSH
              </span>
              <span className="text-xs text-slate-400 font-mono">v1.1</span>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" title="Gateway Online" />
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-5 overflow-y-auto">
          {/* Main Items */}
          <div className="space-y-1">
            <button
              onClick={() => onSelectView('hosts')}
              className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-all duration-150 active:scale-[0.98] ${
                activeView === 'hosts'
                  ? 'bg-slate-100 text-slate-900 border border-slate-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Server className={`w-4 h-4 ${activeView === 'hosts' ? 'text-slate-900' : 'text-slate-500'}`} />
                <span>Máy chủ (Hosts)</span>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-700 font-semibold">
                {hosts.length}
              </span>
            </button>

            <button
              onClick={() => onSelectView('credentials')}
              className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${
                activeView === 'credentials'
                  ? 'bg-slate-100 text-slate-900 border border-slate-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <KeyRound className={`w-4 h-4 ${activeView === 'credentials' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span>Key Vault</span>
            </button>

            {features?.enable_tunnels !== false && (
              <button
                onClick={() => onSelectView('tunnels')}
                className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${
                  activeView === 'tunnels'
                    ? 'bg-slate-100 text-slate-900 border border-slate-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Network className={`w-4 h-4 ${activeView === 'tunnels' ? 'text-slate-900' : 'text-slate-500'}`} />
                <span>Port Forwarding</span>
              </button>
            )}

            {features?.enable_session_audit !== false && (
              <button
                onClick={() => onSelectView('audit')}
                className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${
                  activeView === 'audit'
                    ? 'bg-slate-100 text-slate-900 border border-slate-200/80 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <History className={`w-4 h-4 ${activeView === 'audit' ? 'text-slate-900' : 'text-slate-500'}`} />
                <span>Session Audit</span>
              </button>
            )}

            {features?.enable_snippets !== false && (
              <button
                onClick={onOpenSnippets}
                className="w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              >
                <Code2 className="w-4 h-4 text-emerald-600" />
                <span>Lệnh mẫu (Snippets)</span>
              </button>
            )}
          </div>

          {/* Folder Hierarchy */}
          <div className="space-y-1">
            <div className="px-2.5 pb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Môi trường</span>
              <button
                onClick={onAddHost}
                className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all duration-150 active:scale-90"
                title="Thêm máy chủ mới"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                onSelectView('hosts');
                onSelectFolder('All');
              }}
              className={`w-full h-8 px-3 rounded-lg text-xs flex items-center justify-between transition-all duration-150 active:scale-[0.98] ${
                activeView === 'hosts' && selectedFolder === 'All'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Folder className="w-4 h-4 text-slate-500" />
                Tất cả
              </span>
              <span className="text-xs font-mono text-slate-500">{hosts.length}</span>
            </button>

            {folders.map((f) => {
              const count = hosts.filter((h) => h.folder === f).length;
              const isSelected = activeView === 'hosts' && selectedFolder === f;
              return (
                <button
                  key={f}
                  onClick={() => {
                    onSelectView('hosts');
                    onSelectFolder(f);
                  }}
                  className={`w-full h-8 px-3 rounded-lg text-xs flex items-center justify-between transition-all duration-150 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="truncate flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    {f}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Community */}
          {(features?.enable_public_roadmap !== false || features?.enable_sponsor !== false) && (
            <div className="space-y-1.5 pt-3.5 border-t border-slate-200">
              {features?.enable_public_roadmap !== false && (
                <button
                  onClick={() => onSelectView('roadmap')}
                  className={`w-full h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all duration-150 active:scale-[0.98] ${
                    activeView === 'roadmap'
                      ? 'bg-slate-100 text-slate-900 border border-slate-200/80 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-slate-500" />
                  <span>Public Roadmap</span>
                </button>
              )}

              {features?.enable_sponsor !== false && (
                <button
                  onClick={onOpenSponsor}
                  className="w-full h-9 px-3 rounded-lg text-xs font-medium flex items-center justify-between text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150 active:scale-[0.98] border border-slate-200 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-50" />
                    <span>Ủng hộ dự án</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-rose-600 font-semibold border border-rose-100 shadow-2xs">
                    Sponsor
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Profile */}
      <div className="p-3.5 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 truncate">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-bold text-xs shadow-2xs">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left truncate">
              <span className="font-semibold text-slate-900 text-xs truncate">{user?.username}</span>
              <span className="text-xs text-slate-500 font-mono capitalize">{user?.role}</span>
            </div>
          </div>

          <button
            onClick={logout}
            title="Đăng xuất"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 active:scale-90"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
