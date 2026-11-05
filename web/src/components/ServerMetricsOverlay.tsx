import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Clock,
  Layers,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Play,
  Pause,
  Server
} from 'lucide-react';
import { ServerMetrics } from '../types';
import { api } from '../services/api';

interface ServerMetricsOverlayProps {
  hostId: string;
  isVisible: boolean;
  onToggleVisible: () => void;
}

export const ServerMetricsOverlay: React.FC<ServerMetricsOverlayProps> = ({
  hostId,
  isVisible,
  onToggleVisible,
}) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number>(10); // 0 = paused, 5s, 10s
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  const fetchMetrics = async (isManual = false) => {
    if (loading && !isManual) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getHostMetrics(hostId);
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || t('metrics.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchMetrics(true);
    }
  }, [hostId, isVisible]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isVisible && refreshInterval > 0) {
      timerRef.current = setInterval(() => {
        fetchMetrics(false);
      }, refreshInterval * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hostId, isVisible, refreshInterval]);

  const getUsageColor = (percent: number) => {
    if (percent >= 85) {
      return {
        text: 'text-rose-600',
        bg: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (percent >= 60) {
      return {
        text: 'text-amber-600',
        bg: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      text: 'text-emerald-600',
      bg: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggleVisible}
        className="h-6 px-2.5 bg-slate-900/90 hover:bg-slate-900 text-slate-200 hover:text-white border-b border-slate-800 text-[11px] font-mono flex items-center justify-between w-full transition select-none shadow-2xs"
        title={t('metrics.show')}
      >
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="font-semibold">{t('metrics.title')}</span>
          {metrics && (
            <span className="text-slate-400 font-normal">
              • CPU: {metrics.cpu_percent}% • RAM: {metrics.mem_percent}% • Disk: {metrics.disk_percent}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span>{t('metrics.show')}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </button>
    );
  }

  const cpuColor = getUsageColor(metrics?.cpu_percent || 0);
  const memColor = getUsageColor(metrics?.mem_percent || 0);
  const diskColor = getUsageColor(metrics?.disk_percent || 0);

  return (
    <div className="bg-[#0f172a] text-slate-200 border-b border-slate-800 select-none transition-all duration-200 text-xs shadow-md">
      {/* Top Main Bar */}
      <div className="px-3.5 py-1.5 flex items-center justify-between gap-3 overflow-x-auto min-h-[38px]">
        {/* Left: Metrics Chips */}
        <div className="flex items-center gap-2.5 flex-nowrap shrink-0 font-mono text-[11px]">
          {/* Badge: Live Telemetry */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 font-semibold">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Telemetry</span>
          </div>

          {error ? (
            <div className="flex items-center gap-1.5 text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/60">
              <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
              <span className="truncate max-w-xs">{error}</span>
            </div>
          ) : metrics ? (
            <>
              {/* CPU Chip */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                <Cpu className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">{t('metrics.cpu')}</span>
                <span className={`font-bold ${cpuColor.text}`}>{metrics.cpu_percent}%</span>
                <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-0.5">
                  <div
                    className={`h-full ${cpuColor.bg} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(3, metrics.cpu_percent))}%` }}
                  />
                </div>
              </div>

              {/* Memory Chip */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                <Database className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">{t('metrics.memory')}</span>
                <span className={`font-bold ${memColor.text}`}>{metrics.mem_percent}%</span>
                <span className="text-slate-500 font-normal">
                  ({(metrics.mem_used_mb / 1024).toFixed(1)}/{(metrics.mem_total_mb / 1024).toFixed(1)} GB)
                </span>
                <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-0.5">
                  <div
                    className={`h-full ${memColor.bg} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(3, metrics.mem_percent))}%` }}
                  />
                </div>
              </div>

              {/* Disk Chip */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                <HardDrive className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">{t('metrics.disk')}</span>
                <span className={`font-bold ${diskColor.text}`}>{metrics.disk_percent}%</span>
                <span className="text-slate-500 font-normal">
                  ({metrics.disk_used_gb}/{metrics.disk_total_gb} GB)
                </span>
                <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-0.5">
                  <div
                    className={`h-full ${diskColor.bg} transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(3, metrics.disk_percent))}%` }}
                  />
                </div>
              </div>

              {/* Load Average */}
              {metrics.load_avg && (
                <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  <Layers className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-400">{t('metrics.load')}:</span>
                  <span className="text-slate-200 font-medium">{metrics.load_avg}</span>
                </div>
              )}

              {/* Uptime */}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400">{t('metrics.uptime')}:</span>
                <span className="text-slate-200 font-medium">{metrics.uptime_text}</span>
              </div>
            </>
          ) : (
            <span className="text-slate-400 font-mono text-xs">{t('common.loading')}</span>
          )}
        </div>

        {/* Right Controls: Auto-refresh, Manual Refresh, Expand & Hide */}
        <div className="flex items-center space-x-1.5 shrink-0 font-mono text-[11px]">
          {/* Refresh Interval Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
            <button
              onClick={() => setRefreshInterval((prev) => (prev === 0 ? 10 : 0))}
              className={`px-1.5 py-0.5 rounded transition ${
                refreshInterval === 0
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={refreshInterval === 0 ? 'Resume polling' : 'Pause polling'}
            >
              {refreshInterval === 0 ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setRefreshInterval(5)}
              className={`px-1.5 py-0.5 rounded transition ${
                refreshInterval === 5
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              5s
            </button>
            <button
              onClick={() => setRefreshInterval(10)}
              className={`px-1.5 py-0.5 rounded transition ${
                refreshInterval === 10
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              10s
            </button>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchMetrics(true)}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition active:scale-95 disabled:opacity-50"
            title={t('metrics.refresh')}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Expand / Details Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 px-2 flex items-center gap-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition active:scale-95 text-[11px]"
            title={isExpanded ? t('metrics.compact') : t('metrics.detailed')}
          >
            <Server className="w-3 h-3" />
            <span className="hidden md:inline">{isExpanded ? t('metrics.compact') : t('metrics.detailed')}</span>
          </button>

          {/* Hide / Collapse Bar */}
          <button
            onClick={onToggleVisible}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition active:scale-90"
            title={t('metrics.hide')}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded System Info Drawer */}
      {isExpanded && metrics && (
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-slate-400">
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">OS:</span>{' '}
              <span className="text-slate-200 font-semibold">{metrics.os}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Kernel:</span>{' '}
              <span className="text-slate-200">{metrics.kernel}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Arch:</span>{' '}
              <span className="text-slate-200">{metrics.arch}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Memory Free:</span>{' '}
              <span className="text-slate-200">{(metrics.mem_free_mb / 1024).toFixed(2)} GB</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wider text-[10px]">Disk Free (/):</span>{' '}
              <span className="text-slate-200">{metrics.disk_free_gb} GB</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 flex items-center gap-2">
            <span>Last polled: {metrics.updated_at}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      )}
    </div>
  );
};
