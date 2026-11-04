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
  Terminal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Host } from '../types';

interface SidebarProps {
  activeView: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap';
  onSelectView: (view: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap') => void;
  hosts: Host[];
  selectedFolder: string;
  onSelectFolder: (folder: string) => void;
  onAddHost: () => void;
  onOpenSponsor: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  hosts,
  selectedFolder,
  onSelectFolder,
  onAddHost,
  onOpenSponsor,
}) => {
  const { user, logout } = useAuth();
  const folders = Array.from(new Set(hosts.map((h) => h.folder || 'General')));

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col justify-between select-none shrink-0 h-full">
      <div className="flex flex-col">
        {/* Workspace Brand */}
        <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-xs tracking-tight">
                MySSH
              </span>
              <span className="text-[10px] text-slate-400 font-mono">v1.1</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50" title="Gateway Online" />
        </div>

        {/* Navigation Sections */}
        <div className="p-2.5 space-y-5 overflow-y-auto">
          {/* Main Items */}
          <div className="space-y-1">
            <button
              onClick={() => onSelectView('hosts')}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between transition ${
                activeView === 'hosts'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Server className={`w-4 h-4 ${activeView === 'hosts' ? 'text-slate-900' : 'text-slate-500'}`} />
                <span>Máy chủ (Hosts)</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-700 font-medium">
                {hosts.length}
              </span>
            </button>

            <button
              onClick={() => onSelectView('credentials')}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition ${
                activeView === 'credentials'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <KeyRound className={`w-4 h-4 ${activeView === 'credentials' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span>Key Vault</span>
            </button>

            <button
              onClick={() => onSelectView('tunnels')}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition ${
                activeView === 'tunnels'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Network className={`w-4 h-4 ${activeView === 'tunnels' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span>Port Forwarding</span>
            </button>

            <button
              onClick={() => onSelectView('audit')}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition ${
                activeView === 'audit'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <History className={`w-4 h-4 ${activeView === 'audit' ? 'text-slate-900' : 'text-slate-500'}`} />
              <span>Session Audit</span>
            </button>
          </div>

          {/* Folder Hierarchy */}
          <div className="space-y-1">
            <div className="px-2 pb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Môi trường</span>
              <button
                onClick={onAddHost}
                className="hover:text-slate-900 p-0.5 text-slate-400 transition"
                title="Thêm máy chủ mới"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={() => {
                onSelectView('hosts');
                onSelectFolder('All');
              }}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition ${
                activeView === 'hosts' && selectedFolder === 'All'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-slate-500" />
                Tất cả
              </span>
              <span className="text-[10px] font-mono text-slate-500">{hosts.length}</span>
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
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {f}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Community */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200">
            <button
              onClick={() => onSelectView('roadmap')}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-2.5 transition ${
                activeView === 'roadmap'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/60 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-slate-500" />
              <span>Public Roadmap</span>
            </button>

            <button
              onClick={onOpenSponsor}
              className="w-full px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-between text-rose-700 bg-rose-50 hover:bg-rose-100 transition border border-rose-200/80 shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                <span>Sponsor Dự án</span>
              </div>
              <span className="text-[9px] font-mono px-1 rounded bg-white text-rose-700 border border-rose-200 font-semibold">
                Donate
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Profile */}
      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-semibold text-xs">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left truncate">
              <span className="font-semibold text-slate-900 text-xs truncate">{user?.username}</span>
              <span className="text-[10px] text-slate-500 font-mono capitalize">{user?.role}</span>
            </div>
          </div>

          <button
            onClick={logout}
            title="Đăng xuất"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
