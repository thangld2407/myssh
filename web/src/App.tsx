import React, { useState, useEffect } from 'react';
import { Terminal, Shield, Lock, ArrowRight, X, Server, Search, Heart, Sparkles } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Host } from './types';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { HostList } from './components/HostList';
import { HostModal } from './components/HostModal';
import { CredentialModal } from './components/CredentialModal';
import { TerminalTab } from './components/TerminalTab';
import { SftpExplorer } from './components/SftpExplorer';
import { SessionAuditView } from './components/SessionAuditView';
import { TunnelManager } from './components/TunnelManager';
import { SponsorModal } from './components/SponsorModal';
import { CommandPalette } from './components/CommandPalette';
import { RoadmapView } from './components/RoadmapView';
import { ImportSshConfigModal } from './components/ImportSshConfigModal';

interface OpenTerminalTab {
  id: string;
  host: Host;
}

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, login } = useAuth();

  // Navigation
  const [activeView, setActiveView] = useState<'hosts' | 'audit' | 'tunnels' | 'credentials' | 'roadmap'>('hosts');
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [terminalTabs, setTerminalTabs] = useState<OpenTerminalTab[]>([]);

  // Modals & State
  const [hosts, setHosts] = useState<Host[]>([]);
  const [showHostModal, setShowHostModal] = useState(false);
  const [hostToEdit, setHostToEdit] = useState<Host | null>(null);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sftpHost, setSftpHost] = useState<Host | null>(null);
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Login form state
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('admin123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const fetchHosts = async () => {
    try {
      const data = await api.getHosts();
      setHosts(data);
    } catch (err: any) {
      console.error('Error fetching hosts:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchHosts();
    }
  }, [isAuthenticated]);

  // Global Keyboard listener for ⌘K and Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    setLoginError(null);
    try {
      await login(loginUser, loginPass);
    } catch (err: any) {
      setLoginError(err.message || 'Đăng nhập không thành công');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleOpenTerminal = (host: Host) => {
    const existing = terminalTabs.find((t) => t.host.id === host.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const tabId = `term-${host.id}-${Date.now()}`;
    const newTab: OpenTerminalTab = { id: tabId, host };
    setTerminalTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
  };

  const handleCloseTerminal = (tabId: string) => {
    setTerminalTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId('dashboard');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-600">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono tracking-wider text-slate-500">Loading MySSH...</span>
      </div>
    );
  }

  // Clean, Minimalist Enterprise Login Screen (Light Swiss / Stripe style)
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center p-4 select-none">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-8 shadow-xl shadow-slate-200/60">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">MySSH Bastion</h1>
              <p className="text-[11px] text-slate-500 font-normal">Hệ thống Quản trị & Điều phối Truy cập SSH</p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tên đăng nhập</label>
              <input
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mật khẩu</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm hover:shadow disabled:opacity-50 mt-2"
            >
              {loginSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Tài khoản mặc định: <span className="text-slate-900 font-semibold font-mono">admin</span> / <span className="text-slate-900 font-semibold font-mono">admin123</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-[#F8FAFC] overflow-hidden text-slate-800">
      {/* 1. Left Application Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setActiveTabId('dashboard');
        }}
        hosts={hosts}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        onAddHost={() => {
          setHostToEdit(null);
          setShowHostModal(true);
        }}
        onOpenSponsor={() => setShowSponsorModal(true)}
      />

      {/* 2. Right Main Application Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header / Multi-Tabs Bar */}
        <header className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Tabs for Dashboard and Active Terminals */}
          <div className="flex items-center space-x-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTabId('dashboard')}
              className={`h-7 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
                activeTabId === 'dashboard'
                  ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-slate-700" />
              Workspace
            </button>

            {terminalTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`h-7 px-2.5 rounded-md text-xs font-mono flex items-center gap-2 transition cursor-pointer border ${
                  activeTabId === tab.id
                    ? 'bg-slate-900 text-white font-medium border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Terminal className="w-3 h-3 text-emerald-500" />
                <span className="truncate max-w-[140px]">{tab.host.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTerminal(tab.id);
                  }}
                  className={`p-0.5 rounded transition ${
                    activeTabId === tab.id
                      ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                      : 'hover:bg-slate-200 text-slate-400 hover:text-slate-800'
                  }`}
                  title="Đóng terminal"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Right quick tools: ⌘K, Sponsor */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-600 hover:text-slate-900 transition border border-slate-200 shadow-2xs"
              title="Mở Command Palette (⌘K)"
            >
              <Search className="w-3 h-3 text-slate-400" />
              <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-500 font-semibold">⌘K</kbd>
            </button>

            <button
              onClick={() => setShowSponsorModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-medium transition border border-rose-200/80 shadow-2xs"
            >
              <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
              <span>Sponsor</span>
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="flex-1 overflow-hidden relative">
          {/* Dashboard Tab Content */}
          <div className={`h-full overflow-y-auto ${activeTabId === 'dashboard' ? 'block' : 'hidden'}`}>
            {activeView === 'hosts' && (
              <HostList
                hosts={hosts}
                selectedFolder={selectedFolder}
                onOpenTerminal={handleOpenTerminal}
                onOpenSftp={(host) => setSftpHost(host)}
                onEditHost={(host) => {
                  setHostToEdit(host);
                  setShowHostModal(true);
                }}
                onAddHost={() => {
                  setHostToEdit(null);
                  setShowHostModal(true);
                }}
                onImportSSHConfig={() => setShowImportModal(true)}
                onRefresh={fetchHosts}
                onOpenCredentialModal={() => setShowCredentialModal(true)}
              />
            )}

            {activeView === 'credentials' && (
              <div className="p-6">
                <CredentialModal
                  onClose={() => setActiveView('hosts')}
                  onCredentialsUpdated={fetchHosts}
                />
              </div>
            )}

            {activeView === 'audit' && <SessionAuditView />}

            {activeView === 'tunnels' && <TunnelManager hosts={hosts} />}

            {activeView === 'roadmap' && (
              <RoadmapView onOpenSponsor={() => setShowSponsorModal(true)} />
            )}
          </div>

          {/* Active Terminal Tabs (Always in DOM for background execution) */}
          {terminalTabs.map((tab) => (
            <div
              key={tab.id}
              className={`h-full w-full ${activeTabId === tab.id ? 'block' : 'hidden'}`}
            >
              <TerminalTab
                host={tab.host}
                tabId={tab.id}
                onClose={() => handleCloseTerminal(tab.id)}
              />
            </div>
          ))}
        </main>
      </div>

      {/* Modals & Dialogs */}
      {showHostModal && (
        <HostModal
          hostToEdit={hostToEdit}
          existingHosts={hosts}
          onClose={() => setShowHostModal(false)}
          onSaved={fetchHosts}
          onOpenCredentialModal={() => {
            setShowHostModal(false);
            setShowCredentialModal(true);
          }}
        />
      )}

      {showCredentialModal && (
        <CredentialModal
          onClose={() => setShowCredentialModal(false)}
          onCredentialsUpdated={fetchHosts}
        />
      )}

      {showImportModal && (
        <ImportSshConfigModal
          onClose={() => setShowImportModal(false)}
          onImportSuccess={fetchHosts}
        />
      )}

      {sftpHost && (
        <SftpExplorer
          host={sftpHost}
          onClose={() => setSftpHost(null)}
        />
      )}

      {showSponsorModal && (
        <SponsorModal onClose={() => setShowSponsorModal(false)} />
      )}

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        hosts={hosts}
        onOpenTerminal={handleOpenTerminal}
        onOpenSftp={(host) => setSftpHost(host)}
        onSelectView={(v) => {
          setActiveView(v);
          setActiveTabId('dashboard');
        }}
        onOpenSponsor={() => setShowSponsorModal(true)}
        onOpenImport={() => setShowImportModal(true)}
        onChangeTheme={() => {}}
      />
    </div>
  );
};
