import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Download, Trash2, Search, ArrowDown, Box, RefreshCw, FileText } from 'lucide-react';
import { K8sPod } from '../types';
import { getAuthToken } from '../services/api';

interface K8sPodLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  pod: K8sPod;
}

export const K8sPodLogsModal: React.FC<K8sPodLogsModalProps> = ({
  isOpen,
  onClose,
  clusterId,
  pod,
}) => {
  const { t } = useTranslation();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedContainer, setSelectedContainer] = useState<string>(
    pod.containers.length > 0 ? pod.containers[0].name : ''
  );
  const [tailLines, setTailLines] = useState<string>('200');
  const [follow, setFollow] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rawLogs, setRawLogs] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (pod.containers.length > 0 && !selectedContainer) {
      setSelectedContainer(pod.containers[0].name);
    }
  }, [pod]);

  const startLogStream = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setRawLogs('');
    setErrorMsg(null);
    setIsStreaming(true);

    try {
      const token = getAuthToken();
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const res = await fetch(
        `/api/k8s/clusters/${clusterId}/pods/${encodeURIComponent(
          pod.name
        )}/logs?namespace=${encodeURIComponent(pod.namespace)}&container=${encodeURIComponent(
          selectedContainer
        )}&tail=${tailLines}&follow=${follow}`,
        {
          headers,
          signal: abortController.signal,
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to stream logs (${res.status} ${res.statusText})`);
      }

      if (!res.body) {
        throw new Error('No readable log stream returned from server');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setRawLogs((prev) => {
          const next = prev + chunk;
          // Keep at most 20,000 lines in memory to prevent browser memory bloat
          if (next.length > 500000) {
            return next.slice(-400000);
          }
          return next;
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Error streaming logs');
      }
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startLogStream();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, selectedContainer, tailLines, follow]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [rawLogs, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([rawLogs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pod.name}-${selectedContainer || 'logs'}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  // Filter logs by search query
  const filteredLines = searchQuery.trim()
    ? rawLogs.split('\n').filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden w-full max-w-5xl h-[85vh]">
        {/* Header toolbar */}
        <div className="h-13 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono text-xs font-semibold text-white">{pod.name}</span>
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

            {/* Tail lines selector */}
            <div className="flex items-center gap-1 ml-2 text-xs text-slate-400">
              <span>Tail:</span>
              <select
                value={tailLines}
                onChange={(e) => setTailLines(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-md px-2 py-1 focus:outline-hidden"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
                <option value="all">All</option>
              </select>
            </div>

            {/* Follow Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={follow}
                onChange={(e) => setFollow(e.target.checked)}
                className="rounded-sm border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <span>Follow</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('k8s.filterLogs', 'Filter logs...')}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md pl-8 pr-2.5 py-1 focus:outline-hidden focus:border-slate-500 w-44"
              />
            </div>

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll'}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                autoScroll ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            {/* Restart stream */}
            <button
              onClick={startLogStream}
              title="Refresh log stream"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              title="Download logs"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Clear */}
            <button
              onClick={() => setRawLogs('')}
              title="Clear log buffer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logs Console */}
        <div
          ref={logContainerRef}
          className="flex-1 bg-[#09090b] text-slate-300 font-mono text-xs p-4 overflow-y-auto leading-relaxed select-text space-y-0.5"
        >
          {errorMsg && (
            <div className="p-3 mb-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
              {errorMsg}
            </div>
          )}

          {filteredLines ? (
            filteredLines.length > 0 ? (
              filteredLines.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-all hover:bg-slate-800/40 px-1 rounded-xs">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic py-4 text-center">
                No log lines matching "{searchQuery}"
              </div>
            )
          ) : rawLogs ? (
            rawLogs.split('\n').map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-all hover:bg-slate-800/40 px-1 rounded-xs">
                {line}
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic py-8 text-center flex flex-col items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              <span>Waiting for logs from container...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
