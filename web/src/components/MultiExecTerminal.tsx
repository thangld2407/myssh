import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Zap, X, Terminal as TerminalIcon, Send, RefreshCw, Layers } from 'lucide-react';
import { Host } from '../types';
import { api, getAuthToken } from '../services/api';

interface MultiExecTerminalProps {
  hosts: Host[];
  onClose: () => void;
}

interface MiniTerminalInstance {
  term: Terminal;
  fit: FitAddon;
  ws: WebSocket;
  status: 'connecting' | 'connected' | 'disconnected';
}

export const MultiExecTerminal: React.FC<MultiExecTerminalProps> = ({ hosts, onClose }) => {
  const [broadcastCommand, setBroadcastCommand] = useState('');
  const [terminalsStatus, setTerminalsStatus] = useState<Record<string, 'connecting' | 'connected' | 'disconnected'>>({});
  const terminalRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const instances = useRef<Record<string, MiniTerminalInstance>>({});

  const snippets = [
    { label: 'uptime', cmd: 'uptime\n' },
    { label: 'uname -a', cmd: 'uname -a\n' },
    { label: 'df -h', cmd: 'df -h\n' },
    { label: 'free -m', cmd: 'free -m\n' },
    { label: 'docker ps', cmd: 'docker ps\n' },
    { label: 'clear', cmd: 'clear\n' },
  ];

  const initHostTerminal = async (host: Host) => {
    const el = terminalRefs.current[host.id];
    if (!el) return;

    // Clean up if already exists
    if (instances.current[host.id]) {
      try {
        instances.current[host.id].ws.close();
        instances.current[host.id].term.dispose();
      } catch {}
    }

    setTerminalsStatus((prev) => ({ ...prev, [host.id]: 'connecting' }));

    let ticket = '';
    try {
      const ticketRes = await api.getWsTicket();
      ticket = ticketRes.ticket;
    } catch {
      setTerminalsStatus((prev) => ({ ...prev, [host.id]: 'disconnected' }));
      return;
    }

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#ededed',
        cursor: '#f4f4f5',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        green: '#22c55e',
        blue: '#3b82f6',
        yellow: '#eab308',
        red: '#ef4444',
      },
      fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, monospace',
      fontSize: 12,
      lineHeight: 1.25,
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 3000,
      scrollOnUserInput: true,
      smoothScrollDuration: 0,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(el);
    setTimeout(() => {
      try {
        fitAddon.fit();
        term.scrollToBottom();
      } catch {}
    }, 60);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/terminal/${host.id}?ticket=${ticket}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setTerminalsStatus((prev) => ({ ...prev, [host.id]: 'connected' }));
      try {
        fitAddon.fit();
        term.scrollToBottom();
      } catch {}
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        term.write(new Uint8Array(event.data));
      }
      if (term.buffer.active.baseY - term.buffer.active.viewportY <= 2) {
        term.scrollToBottom();
      }
    };

    ws.onclose = () => {
      setTerminalsStatus((prev) => ({ ...prev, [host.id]: 'disconnected' }));
    };

    ws.onerror = () => {
      setTerminalsStatus((prev) => ({ ...prev, [host.id]: 'disconnected' }));
    };

    // User typing directly into this specific terminal
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
      term.scrollToBottom();
    });

    instances.current[host.id] = {
      term,
      fit: fitAddon,
      ws,
      status: 'connecting',
    };
  };

  useEffect(() => {
    // Wait for DOM to render grid
    const timer = setTimeout(() => {
      hosts.forEach((h) => initHostTerminal(h));
    }, 80);

    const handleResize = () => {
      Object.values(instances.current).forEach((inst) => {
        try {
          inst.fit.fit();
          inst.term.scrollToBottom();
        } catch {}
      });
    };
    window.addEventListener('resize', handleResize);

    if (document.fonts) {
      document.fonts.ready.then(() => {
        setTimeout(handleResize, 100);
      });
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      Object.values(instances.current).forEach((inst) => {
        try {
          inst.ws.close();
          inst.term.dispose();
        } catch {}
      });
      instances.current = {};
    };
  }, [hosts]);

  const sendBroadcast = (cmd: string) => {
    if (!cmd) return;
    Object.values(instances.current).forEach((inst) => {
      if (inst.ws && inst.ws.readyState === WebSocket.OPEN) {
        inst.ws.send(cmd);
        inst.term.scrollToBottom();
      }
    });
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastCommand.trim()) return;
    sendBroadcast(broadcastCommand + '\n');
    setBroadcastCommand('');
  };

  // Determine grid columns
  const getGridClass = () => {
    if (hosts.length === 1) return 'grid-cols-1';
    if (hosts.length === 2) return 'grid-cols-1 md:grid-cols-2';
    if (hosts.length === 3) return 'grid-cols-1 md:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-2';
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] text-zinc-100 select-none">
      {/* Master Broadcast Control Bar (Light Swiss Toolbar) */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">Multi-Exec Broadcast Terminal</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-semibold">
                {hosts.length} Máy chủ
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">Gõ 1 lệnh và chạy đồng thời trên toàn bộ các server</p>
          </div>
        </div>

        {/* Master Command Input Form */}
        <form onSubmit={handleCommandSubmit} className="flex items-center space-x-2 w-full sm:w-auto flex-1 max-w-xl">
          <div className="relative flex-1">
            <TerminalIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={broadcastCommand}
              onChange={(e) => setBroadcastCommand(e.target.value)}
              placeholder="Gõ lệnh broadcast (nhấn Enter để gửi tới tất cả)..."
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 font-medium"
            />
          </div>
          <button
            type="submit"
            className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Gửi</span>
          </button>
        </form>

        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition active:scale-90 shadow-2xs shrink-0"
          title="Đóng Multi-Exec"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Snippet bar */}
      <div className="h-8 bg-slate-50 border-b border-slate-200 px-5 flex items-center space-x-2 overflow-x-auto shrink-0 select-none">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mr-1">
          Broadcast Quick:
        </span>
        {snippets.map((snip) => (
          <button
            key={snip.label}
            onClick={() => sendBroadcast(snip.cmd)}
            className="h-6 px-2.5 rounded-md bg-white hover:bg-slate-100 active:scale-95 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-mono whitespace-nowrap transition shadow-2xs"
          >
            {snip.label}
          </button>
        ))}
      </div>

      {/* Grid of Terminals */}
      <div className={`flex-1 p-2.5 grid ${getGridClass()} gap-2.5 overflow-hidden min-h-0`}>
        {hosts.map((host) => (
          <div
            key={host.id}
            className="flex flex-col bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden shadow-lg h-full min-h-0"
          >
            {/* Terminal Mini Header */}
            <div className="h-8 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between text-xs font-mono select-none shrink-0">
              <div className="flex items-center space-x-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full ${
                    terminalsStatus[host.id] === 'connected'
                      ? 'bg-emerald-500'
                      : terminalsStatus[host.id] === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="font-semibold text-zinc-100 truncate">{host.name}</span>
                <span className="text-zinc-500 text-[11px] truncate">({host.username}@{host.hostname})</span>
              </div>

              <button
                onClick={() => initHostTerminal(host)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition active:scale-90"
                title="Kết nối lại terminal này"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Terminal Canvas */}
            <div className="flex-1 p-2 overflow-hidden relative min-h-0 flex flex-col">
              <div
                ref={(el) => {
                  terminalRefs.current[host.id] = el;
                }}
                className="w-full h-full min-h-0 flex-1 overflow-hidden"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
