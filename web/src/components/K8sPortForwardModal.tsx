import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Network, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface K8sPortForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  defaultNamespace?: string;
  defaultTargetType?: 'pod' | 'service';
  defaultTargetName?: string;
  defaultRemotePort?: number;
  onSuccess: () => void;
}

export const K8sPortForwardModal: React.FC<K8sPortForwardModalProps> = ({
  isOpen,
  onClose,
  clusterId,
  defaultNamespace = 'default',
  defaultTargetType = 'service',
  defaultTargetName = '',
  defaultRemotePort = 80,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [namespace, setNamespace] = useState(defaultNamespace);
  const [targetType, setTargetType] = useState<'pod' | 'service'>(defaultTargetType);
  const [targetName, setTargetName] = useState(defaultTargetName);
  const [remotePort, setRemotePort] = useState<number>(defaultRemotePort);
  const [localPort, setLocalPort] = useState<number>(defaultRemotePort > 1024 ? defaultRemotePort : defaultRemotePort + 10000);
  const [autoStart, setAutoStart] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim()) {
      setErrorMsg('Target name is required');
      return;
    }
    if (!localPort || !remotePort) {
      setErrorMsg('Both local and remote ports are required');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const pf = await api.createK8sPortForward({
        cluster_id: clusterId,
        namespace: namespace.trim(),
        target_type: targetType,
        target_name: targetName.trim(),
        local_port: Number(localPort),
        remote_port: Number(remotePort),
      });

      if (autoStart && pf.id) {
        try {
          await api.startK8sPortForward(pf.id);
        } catch (startErr: any) {
          console.warn('Created but failed to start immediately:', startErr);
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create port forward');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {t('k8s.portforward.title', 'Kubernetes Port Forward')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('k8s.portforward.subtitle', 'Forward cluster Pod or Service port to MySSH')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.targetType', 'Target Type')}
              </label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                <option value="service">Service</option>
                <option value="pod">Pod</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.namespace', 'Namespace')}
              </label>
              <input
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {targetType === 'service' ? t('k8s.serviceName', 'Service Name') : t('k8s.podName', 'Pod Name')} *
            </label>
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="e.g. redis-master / frontend"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.remotePort', 'Remote Cluster Port')} *
              </label>
              <input
                type="number"
                value={remotePort}
                onChange={(e) => setRemotePort(parseInt(e.target.value) || 0)}
                placeholder="6379"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.localPort', 'Local Port on MySSH')} *
              </label>
              <input
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(parseInt(e.target.value) || 0)}
                placeholder="16379"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="rounded-sm border-slate-300 text-blue-600 focus:ring-0"
            />
            <span>{t('k8s.autoStartPortforward', 'Start port forward immediately')}</span>
          </label>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('k8s.createForward', 'Create Port Forward')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
