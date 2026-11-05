import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { api } from '../services/api';
import { KubeCluster, K8sTestResult } from '../types';

interface K8sClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clusterToEdit?: KubeCluster | null;
}

export const K8sClusterModal: React.FC<K8sClusterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  clusterToEdit,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [selectedContext, setSelectedContext] = useState('');
  const [contexts, setContexts] = useState<string[]>([]);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<K8sTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (clusterToEdit) {
      setName(clusterToEdit.name);
      setDescription(clusterToEdit.description || '');
      setSelectedContext(clusterToEdit.current_context || '');
      setKubeconfig('');
      setTestResult(null);
      setTestError(null);
      setFormError(null);

      // Fetch available contexts for cluster
      api.getK8sCluster(clusterToEdit.id)
        .then((res) => {
          if (res.contexts && res.contexts.length > 0) {
            setContexts(res.contexts);
          }
        })
        .catch(() => {});
    } else {
      setName('');
      setDescription('');
      setKubeconfig('');
      setSelectedContext('');
      setContexts([]);
      setTestResult(null);
      setTestError(null);
      setFormError(null);
    }
  }, [clusterToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setKubeconfig(content);
      if (!name) {
        setName(file.name.replace(/\.[^/.]+$/, ''));
      }
      setTestResult(null);
      setTestError(null);
    };
    reader.readAsText(file);
  };

  const handleTestConnection = async () => {
    if (!kubeconfig && !clusterToEdit) {
      setTestError(t('k8s.errors.kubeconfigRequired', 'Kubeconfig YAML is required to test'));
      return;
    }
    setTesting(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await api.testK8sCluster({
        kubeconfig,
        current_context: selectedContext || undefined,
      });
      setTestResult(res);
      if (res.contexts && res.contexts.length > 0) {
        setContexts(res.contexts);
        if (!selectedContext) {
          setSelectedContext(res.current_context || res.contexts[0]);
        }
      }
    } catch (err: any) {
      setTestError(err.message || t('k8s.errors.testFailed', 'Failed to connect to cluster'));
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(t('k8s.errors.nameRequired', 'Cluster name is required'));
      return;
    }
    if (!clusterToEdit && !kubeconfig.trim()) {
      setFormError(t('k8s.errors.kubeconfigRequired', 'Kubeconfig is required'));
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (clusterToEdit) {
        await api.updateK8sCluster(clusterToEdit.id, {
          name: name.trim(),
          description: description.trim(),
          current_context: selectedContext || undefined,
          kubeconfig: kubeconfig.trim() ? kubeconfig.trim() : undefined,
        });
      } else {
        await api.createK8sCluster({
          name: name.trim(),
          description: description.trim(),
          kubeconfig: kubeconfig.trim(),
          current_context: selectedContext || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setFormError(err.message || t('k8s.errors.saveFailed', 'Failed to save cluster'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {clusterToEdit ? t('k8s.modal.editTitle', 'Edit Kubernetes Cluster') : t('k8s.modal.addTitle', 'Connect Kubernetes Cluster')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('k8s.modal.subtitle', 'Import Kubeconfig YAML to access Pods, Logs, and interactive terminals')}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.clusterName', 'Cluster Display Name')} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production EKS / Local K3s"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.description', 'Description (Optional)')}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Primary EU microservices cluster"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Context Selector */}
          {contexts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('k8s.context', 'Active Context')}
              </label>
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {contexts.map((ctx) => (
                  <option key={ctx} value={ctx}>
                    {ctx}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Kubeconfig Input Area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                {clusterToEdit
                  ? t('k8s.replaceKubeconfig', 'Replace Kubeconfig YAML (Leave empty to keep current)')
                  : t('k8s.kubeconfigYaml', 'Kubeconfig Content (YAML)') + ' *'}
              </label>
              <label className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                <span>{t('k8s.uploadFile', 'Upload .kube/config')}</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".yaml,.yml,.config,text/plain"
                />
              </label>
            </div>
            <textarea
              value={kubeconfig}
              onChange={(e) => {
                setKubeconfig(e.target.value);
                setTestResult(null);
                setTestError(null);
              }}
              rows={8}
              placeholder={`apiVersion: v1\nclusters:\n- cluster:\n    server: https://192.168.1.100:6443\n...`}
              className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 text-slate-100 placeholder-slate-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {t('k8s.encryptionNote', 'Your Kubeconfig is encrypted with military-grade AES-256-GCM before database storage.')}
            </p>
          </div>

          {/* Test Connection Button & Result */}
          <div className="pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || (!kubeconfig && !clusterToEdit)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? t('k8s.testing', 'Verifying Connection...') : t('k8s.testConnection', 'Test Connection')}</span>
              </button>

              {testResult && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {t('k8s.connected', 'Connected!')} (v{testResult.server_version}, {testResult.node_count} nodes)
                  </span>
                </div>
              )}
            </div>

            {testError && (
              <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}
          </div>

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
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{clusterToEdit ? t('common.saveChanges', 'Save Changes') : t('k8s.saveCluster', 'Save Cluster')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
