import React, { useEffect, useState, useRef } from 'react';
import { Search, Terminal, HardDrive, KeyRound, Network, History, Heart, Sparkles, Server, ArrowRight } from 'lucide-react';
import { Host } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  hosts: Host[];
  onOpenTerminal: (host: Host) => void;
  onOpenSftp: (host: Host) => void;
  onSelectView: (view: 'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap') => void;
  onOpenSponsor: () => void;
  onOpenImport?: () => void;
  onChangeTheme: () => void;
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
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'import-ssh',
      title: 'Import Cấu Hình Máy Chủ (~/.ssh/config)',
      category: 'Actions',
      icon: <Server className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onOpenImport?.(); onClose(); },
    },
    {
      id: 'sponsor',
      title: 'Sponsor & Ủng Hộ Dự Án (Build in Public)',
      category: 'Community',
      icon: <Heart className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onOpenSponsor(); onClose(); },
    },
    {
      id: 'view-roadmap',
      title: 'Public Roadmap & Biểu Quyết Tính Năng',
      category: 'Navigation',
      icon: <Sparkles className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('roadmap'); onClose(); },
    },
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
    {
      id: 'view-tunnels',
      title: 'SSH Port Forwarding & Tunnels',
      category: 'Navigation',
      icon: <Network className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('tunnels'); onClose(); },
    },
    {
      id: 'view-audit',
      title: 'Session Audit Logs',
      category: 'Navigation',
      icon: <History className="w-3.5 h-3.5 text-zinc-400" />,
      run: () => { onSelectView('audit'); onClose(); },
    },
  ];

  const hostItems = hosts.map((h) => ({
    id: `host-term-${h.id}`,
    title: `Mở Terminal: ${h.name} (${h.username}@${h.hostname})`,
    category: 'Servers',
    icon: <Terminal className="w-3.5 h-3.5 text-zinc-400" />,
    run: () => { onOpenTerminal(h); onClose(); },
  }));

  const sftpItems = hosts.map((h) => ({
    id: `host-sftp-${h.id}`,
    title: `Mở SFTP: ${h.name} (${h.hostname})`,
    category: 'SFTP',
    icon: <HardDrive className="w-3.5 h-3.5 text-zinc-400" />,
    run: () => { onOpenSftp(h); onClose(); },
  }));

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
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-900/40 backdrop-blur-xs p-4 animate-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-slate-800 animate-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="h-13 border-b border-slate-200 px-4.5 flex items-center space-x-3 bg-slate-50/75">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Tìm máy chủ hoặc thao tác..."
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          <kbd className="px-1.5 py-0.5 rounded-md bg-white text-[10px] font-mono text-slate-500 border border-slate-200 font-semibold shadow-2xs">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1 bg-white">
          {filtered.map((item, index) => (
            <div
              key={item.id}
              onClick={() => item.run()}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`min-h-[42px] px-3.5 py-2.5 rounded-xl flex items-center justify-between cursor-pointer transition text-xs active:scale-[0.99] ${
                selectedIndex === index
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                {item.icon}
                <span>{item.title}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                  {item.category}
                </span>
                {selectedIndex === index && (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              Không tìm thấy mục nào.
            </div>
          )}
        </div>

        <div className="h-9 border-t border-slate-200 px-4 bg-slate-50/75 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <div className="flex items-center space-x-3">
            <span>↑↓ di chuyển</span>
            <span>↵ chọn</span>
          </div>
          <span>Command Palette</span>
        </div>
      </div>
    </div>
  );
};
