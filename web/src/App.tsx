import React, { useState, useEffect } from 'react';
import { Terminal, Shield, Lock, ArrowRight, X, Server, Search, Heart, Sparkles, Zap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Host, FeatureFlags } from './types';
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
import { SetupWizard } from './components/SetupWizard';
import { MultiExecTerminal } from './components/MultiExecTerminal';
import { SnippetModal } from './components/SnippetModal';

interface OpenTerminalTab {
  id: string;
  host: Host;
}

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, isInitialized, login } = useAuth();

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
  const [multiExecHosts, setMultiExecHosts] = useState<Host[] | null>(null);
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSnippetModal, setShowSnippetModal] = useState(false);

  const [features, setFeatures] = useState<FeatureFlags>({
    enable_sftp: true,
    enable_multi_exec: true,
    enable_session_audit: true,
    enable_tunnels: true,
    enable_import_ssh_config: true,
    enable_snippets: true,
    enable_public_roadmap: true,
    enable_sponsor: true,
  });

  // Login form state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginTouched, setLoginTouched] = useState<Record<string, boolean>>({});

  const fetchHosts = async () => {
    try {
      const data = await api.getHosts();
      setHosts(data);
    } catch (err: any) {
      console.error('Error fetching hosts:', err);
    }
  };

  useEffect(() => {
    api.getSystemFeatures()
      .then((res) => {
        if (res?.features) {
          setFeatures(res.features);
        }
      })
      .catch((err) => console.error('Failed to load system features:', err));
  }, []);

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
    setLoginTouched({ user: true, pass: true });
    setLoginError(null);

    if (!loginUser.trim() || !loginPass.trim()) {
      setLoginError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLoginSubmitting(true);
    try {
      await login(loginUser.trim(), loginPass);
    } catch (err: any) {
      setLoginError(err.message || 'Đăng nhập không thành công. Sai tài khoản hoặc mật khẩu.');
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

  // First-Run Setup Wizard (If fresh install or no admin user)
  if (!isInitialized) {
    return <SetupWizard />;
  }

  // Clean, Minimalist Enterprise Login Screen (Light Swiss / Stripe style)
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center p-4 select-none">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-8 shadow-xl shadow-slate-200/60 animate-modal">
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
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tên đăng nhập <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                onBlur={() => setLoginTouched((p) => ({ ...p, user: true }))}
                placeholder="Tên tài khoản..."
                className={`w-full h-10 px-3.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition ${
                  loginTouched.user && !loginUser.trim()
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500'
                    : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                }`}
              />
              {loginTouched.user && !loginUser.trim() && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Vui lòng nhập tên đăng nhập</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  onBlur={() => setLoginTouched((p) => ({ ...p, pass: true }))}
                  placeholder="••••••••"
                  className={`w-full h-10 pl-3.5 pr-10 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white transition font-mono ${
                    loginTouched.pass && !loginPass.trim()
                      ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500'
                      : 'border-slate-200 focus:border-slate-900 focus:ring-1 focus:ring-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition"
                  tabIndex={-1}
                >
                  {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {loginTouched.pass && !loginPass.trim() && (
                <p className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-1 animate-in fade-in">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Vui lòng nhập mật khẩu</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm hover:shadow disabled:opacity-50 mt-2"
            >
              {loginSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Hệ thống quản trị truy cập an toàn với mã hóa AES-256-GCM.
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
        onOpenSnippets={() => setShowSnippetModal(true)}
        onOpenSponsor={() => setShowSponsorModal(true)}
        features={features}
      />

      {/* 2. Right Main Application Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header / Multi-Tabs Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between select-none shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Tabs for Dashboard and Active Terminals */}
          <div className="flex items-center space-x-2 overflow-x-auto">
            <button
              onClick={() => setActiveTabId('dashboard')}
              className={`h-8 px-3.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition active:scale-95 ${
                activeTabId === 'dashboard'
                  ? 'bg-slate-100 text-slate-900 border border-slate-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-slate-700" />
              Workspace
            </button>

            {features.enable_multi_exec && multiExecHosts && (
              <div
                onClick={() => setActiveTabId('multi-exec')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer border active:scale-95 ${
                  activeTabId === 'multi-exec'
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
                <span>Multi-Exec ({multiExecHosts.length})</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMultiExecHosts(null);
                    if (activeTabId === 'multi-exec') setActiveTabId('dashboard');
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-amber-600/30 text-slate-950 transition"
                  title="Đóng Multi-Exec"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {terminalTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`h-8 px-3 rounded-lg text-xs font-mono flex items-center gap-2 transition cursor-pointer border active:scale-95 ${
                  activeTabId === tab.id
                    ? 'bg-slate-900 text-white font-semibold border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span className="truncate max-w-[150px]">{tab.host.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTerminal(tab.id);
                  }}
                  className={`w-5 h-5 flex items-center justify-center rounded transition active:scale-90 ${
                    activeTabId === tab.id
                      ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                      : 'hover:bg-slate-200 text-slate-400 hover:text-slate-800'
                  }`}
                  title="Đóng terminal"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Right quick tools: ⌘K Command Palette */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 h-8 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-95 text-xs text-slate-600 hover:text-slate-900 transition border border-slate-200 shadow-2xs font-medium"
              title="Mở Command Palette (⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-sans hidden sm:inline">Tìm kiếm...</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 font-semibold shadow-2xs">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* View Switcher Container */}
        <main className="flex-1 overflow-hidden relative min-h-0">
          {/* Dashboard Tab Content */}
          <div className={`h-full overflow-y-auto ${activeTabId === 'dashboard' ? 'block' : 'hidden'}`}>
            {activeView === 'hosts' && (
              <HostList
                hosts={hosts}
                selectedFolder={selectedFolder}
                onOpenTerminal={handleOpenTerminal}
                onOpenSftp={(host) => setSftpHost(host)}
                onOpenMultiExec={(selected) => {
                  setMultiExecHosts(selected);
                  setActiveTabId('multi-exec');
                }}
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
                features={features}
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
                features={features}
              />
            </div>
          ))}
          {/* Multi-Exec Broadcast Terminal */}
          {features.enable_multi_exec && multiExecHosts && (
            <div className={`h-full w-full ${activeTabId === 'multi-exec' ? 'block' : 'hidden'}`}>
              <MultiExecTerminal
                hosts={multiExecHosts}
                onClose={() => {
                  setMultiExecHosts(null);
                  setActiveTabId('dashboard');
                }}
              />
            </div>
          )}
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

      <SnippetModal
        isOpen={showSnippetModal}
        onClose={() => setShowSnippetModal(false)}
      />

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
        onOpenSnippets={() => setShowSnippetModal(true)}
        onChangeTheme={() => {}}
        features={features}
      />
    </div>
  );
};
