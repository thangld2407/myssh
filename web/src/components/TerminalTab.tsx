import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { RefreshCw, X, Maximize2, Trash2, Clock, Terminal as TerminalIcon, HardDrive, Columns, Code2, Zap } from 'lucide-react';
import { Host, FeatureFlags } from '../types';
import { getAuthToken } from '../services/api';
import { SftpPanel } from './SftpPanel';
import { SnippetModal } from './SnippetModal';

interface TerminalTabProps {
  host: Host;
  tabId: string;
  onClose: () => void;
  features?: FeatureFlags;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({ host, onClose, features }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const wsInstance = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [fontSize, setFontSize] = useState<number>(13);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [showSplitSftp, setShowSplitSftp] = useState<boolean>(false);
  const [showSnippetModal, setShowSnippetModal] = useState<boolean>(false);

  const snippets = [
    { label: 'ls -la', cmd: 'ls -la\n' },
    { label: 'top', cmd: 'top\n' },
    { label: 'df -h', cmd: 'df -h\n' },
    { label: 'free -m', cmd: 'free -m\n' },
    { label: 'docker ps', cmd: 'docker ps\n' },
    { label: 'uname -a', cmd: 'uname -a\n' },
    { label: 'clear', cmd: 'clear\n' },
  ];

  useEffect(() => {
    let timer: any = null;
    if (status === 'connected') {
      timer = setInterval(() => {
        setSessionSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const connectWebSocket = () => {
    if (!terminalRef.current) return;

    if (wsInstance.current) {
      wsInstance.current.close();
    }
    if (xtermInstance.current) {
      xtermInstance.current.dispose();
    }

    setStatus('connecting');
    setSessionSeconds(0);

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#ededed',
        cursor: '#f4f4f5',
        cursorAccent: '#09090b',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, monospace',
      fontSize: fontSize,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      scrollback: 10000,
      scrollOnUserInput: true,
      smoothScrollDuration: 0,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    // Initial fit
    setTimeout(() => {
      try {
        fitAddon.fit();
        term.scrollToBottom();
      } catch {}
    }, 50);

    // Re-fit when web fonts (JetBrains Mono) finish loading
    if (document.fonts) {
      document.fonts.ready.then(() => {
        setTimeout(() => {
          try {
            fitAddon.fit();
            term.scrollToBottom();
          } catch {}
        }, 80);
      });
    }

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    const cols = term.cols || 120;
    const rows = term.rows || 36;

    const token = getAuthToken();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/terminal/${host.id}?token=${token}&cols=${cols}&rows=${rows}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsInstance.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      term.focus();
      try {
        fitAddon.fit();
      } catch {}
      ws.send(JSON.stringify({
        type: 'resize',
        cols: term.cols,
        rows: term.rows,
      }));
    };

    ws.onmessage = (event) => {
      const isNearBottom = term.buffer.active.baseY - term.buffer.active.viewportY <= 2;
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        const uint8 = new Uint8Array(event.data);
        term.write(uint8);
      }
      if (isNearBottom) {
        term.scrollToBottom();
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[33m[MySSH] Session disconnected.\x1b[0m');
    };

    ws.onerror = (err) => {
      console.error('Terminal WebSocket error:', err);
      setStatus('disconnected');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
      term.scrollToBottom();
    });

    term.onResize((size) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: size.cols,
          rows: size.rows,
        }));
      }
    });
  };

  useEffect(() => {
    connectWebSocket();

    const handleWindowResize = () => {
      if (fitAddonInstance.current && xtermInstance.current) {
        try {
          fitAddonInstance.current.fit();
          xtermInstance.current.scrollToBottom();
        } catch {}
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Active ResizeObserver to continuously track layout changes (Split SFTP, sidebar toggle, devtools)
    let resizeObserver: ResizeObserver | null = null;
    if (terminalRef.current) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (fitAddonInstance.current && xtermInstance.current) {
            try {
              fitAddonInstance.current.fit();
              const { cols, rows } = xtermInstance.current;
              if (cols && rows && wsInstance.current?.readyState === WebSocket.OPEN) {
                wsInstance.current.send(JSON.stringify({
                  type: 'resize',
                  cols,
                  rows,
                }));
              }
            } catch {}
          }
        });
      });
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (wsInstance.current) {
        wsInstance.current.close();
      }
      if (xtermInstance.current) {
        xtermInstance.current.dispose();
      }
    };
  }, [host.id]);

  const sendSnippet = (cmd: string) => {
    if (wsInstance.current?.readyState === WebSocket.OPEN) {
      wsInstance.current.send(cmd);
      xtermInstance.current?.scrollToBottom();
      xtermInstance.current?.focus();
    }
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(10, Math.min(20, fontSize + delta));
    setFontSize(newSize);
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = newSize;
      setTimeout(() => {
        try {
          fitAddonInstance.current?.fit();
          xtermInstance.current?.scrollToBottom();
        } catch {}
      }, 50);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-200 min-h-0">
      {/* Control Bar (Light Minimalist Toolbar) */}
      <div className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between text-xs font-mono select-none shadow-2xs shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2">
            <TerminalIcon className="w-4 h-4 text-slate-700" />
            <span className="font-semibold text-slate-900 text-xs">{host.name}</span>
            <span className="text-slate-500 font-normal text-xs">
              ({host.username}@{host.hostname}:{host.port})
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500 ring-2 ring-emerald-100'
                  : status === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="capitalize text-slate-700 font-medium">{status}</span>
          </div>

          {status === 'connected' && (
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatDuration(sessionSeconds)}</span>
            </div>
          )}
        </div>

        {/* Right Toolbar */}
        <div className="flex items-center space-x-2">
          {/* MobaXterm-style Split SFTP Button */}
          {features?.enable_sftp !== false && (
            <button
              onClick={() => {
                setShowSplitSftp((prev) => !prev);
                setTimeout(() => fitAddonInstance.current?.fit(), 60);
              }}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-sans font-semibold transition active:scale-95 border ${
                showSplitSftp
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
              }`}
              title="Mở/Đóng cây thư mục SFTP song song với Terminal (như MobaXterm)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split SFTP</span>
            </button>
          )}

          {/* Font Controls */}
          <div className="flex items-center h-8 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => changeFontSize(-1)}
              className="px-2.5 h-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-semibold active:scale-90 transition"
              title="Giảm font"
            >
              A-
            </button>
            <span className="px-2 text-xs text-slate-500 font-mono font-medium">{fontSize}px</span>
            <button
              onClick={() => changeFontSize(1)}
              className="px-2.5 h-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-semibold active:scale-90 transition"
              title="Tăng font"
            >
              A+
            </button>
          </div>

          {status === 'disconnected' && (
            <button
              onClick={connectWebSocket}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-sans font-semibold transition shadow-xs"
              title="Kết nối lại"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect
            </button>
          )}

          <button
            onClick={() => xtermInstance.current?.clear()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-90 transition"
            title="Xóa màn hình (Clear)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => fitAddonInstance.current?.fit()}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-90 transition"
            title="Căn chỉnh khung nhìn (Fit)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 active:scale-90 transition"
            title="Đóng phiên"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Snippet Quick Bar (Light Toolbar) */}
      {features?.enable_snippets !== false && (
        <div className="h-9 bg-slate-50 border-b border-slate-200 px-3.5 flex items-center space-x-2 overflow-x-auto select-none shrink-0">
          <button
            onClick={() => setShowSnippetModal(true)}
            className="flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-2xs transition active:scale-95"
            title="Mở thư viện lệnh mẫu DevOps đầy đủ"
          >
            <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" />
            <span>Snippets Library</span>
          </button>

          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold ml-1 mr-1">
            Lệnh nhanh:
          </span>
          {snippets.map((snip) => (
            <button
              key={snip.label}
              onClick={() => sendSnippet(snip.cmd)}
              className="h-6 px-2.5 rounded-md bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-mono whitespace-nowrap transition shadow-2xs"
            >
              {snip.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Terminal View (Supports Split-View with Embedded SFTP) */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        <div className="flex-1 bg-[#09090b] px-3 pt-2 pb-1 overflow-hidden relative h-full min-h-0 flex flex-col">
          <div ref={terminalRef} className="w-full h-full min-h-0 flex-1 overflow-hidden" />
        </div>

        {showSplitSftp && (
          <div className="w-80 sm:w-96 h-full flex flex-col shrink-0 shadow-lg min-h-0">
            <SftpPanel
              host={host}
              isEmbedded={true}
              onClose={() => {
                setShowSplitSftp(false);
                setTimeout(() => {
                  try {
                    fitAddonInstance.current?.fit();
                    xtermInstance.current?.scrollToBottom();
                  } catch {}
                }, 60);
              }}
            />
          </div>
        )}
      </div>

      <SnippetModal
        isOpen={showSnippetModal}
        onClose={() => setShowSnippetModal(false)}
        onExecuteCommand={(cmd) => {
          sendSnippet(cmd + '\n');
        }}
      />
    </div>
  );
};
