import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Save, RefreshCw, AlertCircle, FileCode } from 'lucide-react';
import { api } from '../services/api';

interface K8sYamlModalProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  kind: string;
  namespace: string;
  name: string;
  onSuccess?: () => void;
}

export const K8sYamlModal: React.FC<K8sYamlModalProps> = ({
  isOpen,
  onClose,
  clusterId,
  kind,
  namespace,
  name,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [yamlContent, setYamlContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [applying, setApplying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchYaml = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.getK8sYaml(clusterId, kind, namespace, name);
      setYamlContent(res.yaml || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch resource YAML');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchYaml();
    }
  }, [isOpen, clusterId, kind, namespace, name]);

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = async () => {
    setApplying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.applyK8sYaml(clusterId, yamlContent);
      setSuccessMsg(t('k8s.applySuccess', 'Resource updated and reconciled successfully!'));
      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply YAML changes');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl h-[85vh]">
        {/* Header */}
        <div className="h-13 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white font-mono">{name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300">
                  {kind}
                </span>
                {namespace && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400">
                    {namespace}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}</span>
            </button>
            <button
              onClick={fetchYaml}
              title="Refresh YAML"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border-b border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-950/60 border-b border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 p-3 bg-[#09090b] overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              <span>Loading manifest...</span>
            </div>
          ) : (
            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              className="flex-1 w-full p-3 font-mono text-xs bg-transparent text-slate-200 border border-slate-800 rounded-lg focus:outline-hidden focus:border-blue-500 resize-none leading-relaxed"
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="h-14 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            {t('k8s.editWarning', 'Editing will update live configuration in the Kubernetes cluster.')}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || loading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {applying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t('k8s.applyChanges', 'Apply Changes')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
