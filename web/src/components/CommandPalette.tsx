import React, { useEffect, useState, useRef } from 'react';
import { Search, Terminal, HardDrive, KeyRound, Network, History, Heart, Sparkles, Server, ArrowRight, Code2 } from 'lucide-react';
import { Host, FeatureFlags } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  hosts: Host[];
  onOpenTerminal: (host: Host) => void;
  onOpenSftp: (host: Host) => void;
  onSelectView: (view: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap') => void;
  onOpenSponsor: () => void;
  onOpenImport?: () => void;
  onOpenSnippets?: () => void;
  onChangeTheme: () => void;
  features?: FeatureFlags;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  hosts,
  onOpenTerminal,
  onOpenSftp,
  onSelectView,
  onOpenSponsor,
  onOpenImport,
  onOpenSnippets,
  features,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    // Keep active item in visible scroll range
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const actions = [
    ...(features?.enable_import_ssh_config !== false ? [{
      id: 'import-ssh',
      title: 'Import Cấu Hình Máy Chủ (~/.ssh/config)',
      category: 'Actions',
      icon: <Server className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onOpenImport?.(); onClose(); },
    }] : []),
    ...(features?.enable_snippets !== false ? [{
      id: 'snippets',
      title: 'Kho Lệnh Mẫu & Snippet Library (DevOps Quick Commands)',
      category: 'Actions',
      icon: <Code2 className="w-3.5 h-3.5 text-emerald-500" />,
      run: () => { onOpenSnippets?.(); onClose(); },
    }] : []),
    ...(features?.enable_sponsor !== false ? [{
      id: 'sponsor',
      title: 'Sponsor & Ủng Hộ Dự Án (Build in Public)',
      category: 'Community',
      icon: <Heart className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onOpenSponsor(); onClose(); },
    }] : []),
    /* Public Roadmap commented out
    ...(features?.enable_public_roadmap !== false ? [{
      id: 'view-roadmap',
      title: 'Public Roadmap & Biểu Quyết Tính Năng',
      category: 'Navigation',
      icon: <Sparkles className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('roadmap'); onClose(); },
    }] : []),
    */
    {
      id: 'view-hosts',
      title: 'Quản Lý Máy Chủ & Hosts',
      category: 'Navigation',
      icon: <Server className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('hosts'); onClose(); },
    },
    {
      id: 'view-vault',
      title: 'Key Vault (Khóa SSH & Password)',
      category: 'Navigation',
      icon: <KeyRound className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('credentials'); onClose(); },
    },
    ...(features?.enable_tunnels !== false ? [{
      id: 'view-tunnels',
      title: 'SSH Port Forwarding & Tunnels',
      category: 'Navigation',
      icon: <Network className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('tunnels'); onClose(); },
    }] : []),
    ...(features?.enable_session_audit !== false ? [{
      id: 'view-audit',
      title: 'Session Audit Logs',
      category: 'Navigation',
      icon: <History className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('audit'); onClose(); },
    }] : []),
  ];

  const hostItems = hosts.map((h) => ({
    id: `host-term-${h.id}`,
    title: `Mở Terminal: ${h.name} (${h.username}@${h.hostname})`,
    category: 'Servers',
    icon: <Terminal className="w-3.5 h-3.5 text-zinc-400" />,
    run: () => { onOpenTerminal(h); onClose(); },
  }));

  const sftpItems = features?.enable_sftp !== false ? hosts.map((h) => ({
    id: `host-sftp-${h.id}`,
    title: `Mở SFTP: ${h.name} (${h.hostname})`,
    category: 'SFTP',
    icon: <HardDrive className="w-3.5 h-3.5 text-zinc-400" />,
    run: () => { onOpenSftp(h); onClose(); },
  })) : [];

  const allItems = [...actions, ...hostItems, ...sftpItems];

  const filtered = allItems.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-800 animate-modal max-h-[calc(100vh-5rem)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="h-14 border-b border-slate-200 px-5 flex items-center space-x-3 bg-white shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Gõ lệnh hoặc tìm máy chủ..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          <kbd className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-mono text-slate-500 border border-slate-200 font-bold shadow-2xs">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          className="flex-1 min-h-0 max-h-[380px] overflow-y-auto p-2 space-y-1 bg-slate-50/30 scroll-smooth"
        >
          {filtered.map((item, index) => (
            <div
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onClick={() => item.run()}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl flex items-center justify-between cursor-pointer transition text-xs active:scale-[0.99] ${
                selectedIndex === index
                  ? 'bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-900/10'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                    selectedIndex === index
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-600 border-slate-200/80'
                  }`}
                >
                  {item.icon}
                </div>
                <span className="font-medium text-xs text-slate-900">{item.title}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200/60 font-semibold">
                  {item.category}
                </span>
                {selectedIndex === index && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-900" />
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              Không tìm thấy lệnh hoặc máy chủ phù hợp với "{query}".
            </div>
          )}
        </div>

        <div className="h-10 border-t border-slate-200 px-5 bg-white flex items-center justify-between text-xs text-slate-500 font-mono shrink-0">
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-slate-100 border border-slate-200 text-[10px]">↑↓</kbd> Di chuyển
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-slate-100 border border-slate-200 text-[10px]">↵</kbd> Thực hiện
            </span>
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <span className="font-mono text-[10px] text-slate-400 font-semibold">
                {selectedIndex + 1}/{filtered.length}
              </span>
            )}
            <span className="font-sans font-medium text-[11px] text-slate-400">MySSH Quick Search</span>
          </div>
        </div>
      </div>
    </div>
  );
};
