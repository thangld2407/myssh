import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { X, Maximize2, Minimize2, RefreshCw, Terminal as TerminalIcon, Box } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { K8sPod } from '../types';
import { api, getAuthToken } from '../services/api';

interface K8sPodExecModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  pod: K8sPod;
}

export const K8sPodExecModal: React.FC<K8sPodExecModalProps> = ({
  isOpen,
  onClose,
  clusterId,
  pod,
}) => {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const wsInstance = useRef<WebSocket | null>(null);

  const [selectedContainer, setSelectedContainer] = useState<string>(
    pod.containers.length > 0 ? pod.containers[0].name : ''
  );
  const [shellCmd, setShellCmd] = useState<string>('/bin/sh');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (pod.containers.length > 0 && !selectedContainer) {
      setSelectedContainer(pod.containers[0].name);
    }
  }, [pod]);

  const connectTerminal = async () => {
    if (!terminalRef.current) return;

    if (wsInstance.current) {
      wsInstance.current.close();
    }
    if (xtermInstance.current) {
      xtermInstance.current.dispose();
    }

    setStatus('connecting');

    let ticket = '';
    try {
      const ticketRes = await api.getWsTicket();
      ticket = ticketRes.ticket;
    } catch {
      setStatus('disconnected');
      return;
    }

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#ededed',
        cursor: '#38bdf8',
        cursorAccent: '#09090b',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
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
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      term.loadAddon(webglAddon);
    } catch {}

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {}
    }, 50);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/k8s/clusters/${clusterId}/pods/${encodeURIComponent(
      pod.name
    )}/exec?namespace=${encodeURIComponent(pod.namespace)}&container=${encodeURIComponent(
      selectedContainer
    )}&command=${encodeURIComponent(shellCmd)}&ticket=${encodeURIComponent(ticket)}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsInstance.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      try {
        fitAddon.fit();
        ws.send(
          JSON.stringify({
            type: 'resize',
            cols: term.cols,
            rows: term.rows,
          })
        );
      } catch {}
      term.focus();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        const u8 = new Uint8Array(event.data);
        term.write(u8);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    term.onResize((size) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'resize',
            cols: size.cols,
            rows: size.rows,
          })
        );
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        connectTerminal();
      }, 100);
    }

    return () => {
      if (wsInstance.current) {
        wsInstance.current.close();
      }
      if (xtermInstance.current) {
        xtermInstance.current.dispose();
      }
    };
  }, [isOpen, selectedContainer, shellCmd]);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonInstance.current) {
        try {
          fitAddonInstance.current.fit();
        } catch {}
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[80vh]'
        }`}
      >
        {/* Header Toolbar */}
        <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
                <TerminalIcon className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono text-xs font-semibold text-white">
                {pod.name}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-sm bg-slate-800 text-slate-400">
                {pod.namespace}
              </span>
            </div>

            {/* Container Selector */}
            {pod.containers.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2">
                <Box className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedContainer}
                  onChange={(e) => setSelectedContainer(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-hidden"
                >
                  {pod.containers.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Shell Command Selector */}
            <select
              value={shellCmd}
              onChange={(e) => setShellCmd(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-md px-2 py-1 focus:outline-hidden"
            >
              <option value="/bin/sh">/bin/sh</option>
              <option value="/bin/bash">/bin/bash</option>
              <option value="sh">sh</option>
              <option value="bash">bash</option>
            </select>

            {/* Connection Status Indicator */}
            <div className="flex items-center gap-1.5 ml-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'connected'
                    ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                    : status === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-mono text-slate-400 capitalize">
                {status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={connectTerminal}
              title={t('common.reconnect', 'Reconnect')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsFullscreen(!isFullscreen);
                setTimeout(() => {
                  try {
                    fitAddonInstance.current?.fit();
                  } catch {}
                }, 100);
              }}
              title={isFullscreen ? t('common.exitFullscreen', 'Exit Fullscreen') : t('common.fullscreen', 'Fullscreen')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title={t('common.close', 'Close')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Screen */}
        <div className="flex-1 p-2 bg-[#09090b] relative overflow-hidden">
          <div ref={terminalRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};
