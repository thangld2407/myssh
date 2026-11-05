import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  Plus,
  RefreshCw,
  Search,
  Terminal,
  FileText,
  FileCode,
  Network,
  Trash2,
  ExternalLink,
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  Server,
  Box,
  Cpu,
  Activity,
  MoreVertical,
  Edit2,
} from 'lucide-react';
import { api } from '../services/api';
import {
  KubeCluster,
  K8sNamespace,
  K8sPod,
  K8sDeployment,
  K8sService,
  K8sNode,
  K8sPortForward,
} from '../types';
import { K8sClusterModal } from './K8sClusterModal';
import { K8sPodExecModal } from './K8sPodExecModal';
import { K8sPodLogsModal } from './K8sPodLogsModal';
import { K8sYamlModal } from './K8sYamlModal';
import { K8sPortForwardModal } from './K8sPortForwardModal';

export const K8sManager: React.FC = () => {
  const { t } = useTranslation();

  // Cluster State
  const [clusters, setClusters] = useState<KubeCluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [selectedClusterDetail, setSelectedClusterDetail] = useState<{
    cluster: KubeCluster;
    contexts: string[];
  } | null>(null);

  // Filter & Navigation
  const [activeTab, setActiveTab] = useState<'pods' | 'deployments' | 'services' | 'nodes' | 'portforwards'>('pods');
  const [namespaces, setNamespaces] = useState<K8sNamespace[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Resources
  const [pods, setPods] = useState<K8sPod[]>([]);
  const [deployments, setDeployments] = useState<K8sDeployment[]>([]);
  const [services, setServices] = useState<K8sService[]>([]);
  const [nodes, setNodes] = useState<K8sNode[]>([]);
  const [portForwards, setPortForwards] = useState<K8sPortForward[]>([]);

  // Loading & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterToEdit, setClusterToEdit] = useState<KubeCluster | null>(null);

  const [execPod, setExecPod] = useState<K8sPod | null>(null);
  const [logsPod, setLogsPod] = useState<K8sPod | null>(null);

  const [yamlTarget, setYamlTarget] = useState<{
    kind: string;
    namespace: string;
    name: string;
  } | null>(null);

  const [showPortForwardModal, setShowPortForwardModal] = useState(false);
  const [portForwardDefaults, setPortForwardDefaults] = useState<{
    targetType: 'pod' | 'service';
    targetName: string;
    namespace: string;
    remotePort: number;
  } | null>(null);

  // Fetch Clusters list
  const fetchClusters = async () => {
    try {
      const data = await api.getK8sClusters();
      setClusters(data);
      if (data.length > 0 && !selectedClusterId) {
        setSelectedClusterId(data[0].id);
      } else if (data.length === 0) {
        setSelectedClusterId('');
        setSelectedClusterDetail(null);
      }
    } catch (err: any) {
      console.error('Failed to load clusters:', err);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  // Fetch Cluster Details & Contexts
  useEffect(() => {
    if (!selectedClusterId) {
      setSelectedClusterDetail(null);
      return;
    }
    api.getK8sCluster(selectedClusterId)
      .then((res) => {
        setSelectedClusterDetail(res);
      })
      .catch((err) => {
        console.error('Failed to load cluster detail:', err);
      });
  }, [selectedClusterId]);

  // Fetch Namespaces
  const fetchNamespaces = async () => {
    if (!selectedClusterId) return;
    try {
      const nsList = await api.getK8sNamespaces(selectedClusterId);
      setNamespaces(nsList);
    } catch (err) {
      console.error('Failed to fetch namespaces:', err);
    }
  };

  // Fetch active tab resources
  const fetchResources = async () => {
    if (!selectedClusterId) return;
    setLoading(true);
    setError(null);

    const ns = selectedNamespace === 'All' ? undefined : selectedNamespace;

    try {
      if (activeTab === 'pods') {
        const data = await api.getK8sPods(selectedClusterId, ns);
        setPods(data);
      } else if (activeTab === 'deployments') {
        const data = await api.getK8sDeployments(selectedClusterId, ns);
        setDeployments(data);
      } else if (activeTab === 'services') {
        const data = await api.getK8sServices(selectedClusterId, ns);
        setServices(data);
      } else if (activeTab === 'nodes') {
        const data = await api.getK8sNodes(selectedClusterId);
        setNodes(data);
      } else if (activeTab === 'portforwards') {
        const data = await api.getK8sPortForwards(selectedClusterId);
        setPortForwards(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Kubernetes resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClusterId) {
      fetchNamespaces();
      fetchResources();
    }
  }, [selectedClusterId, selectedNamespace, activeTab]);

  const handleDeleteResource = async (kind: string, ns: string, name: string) => {
    if (!confirm(t('k8s.confirmDelete', `Are you sure you want to delete ${kind} "${name}"?`))) {
      return;
    }
    try {
      await api.deleteK8sResource(selectedClusterId, kind, ns, name);
      fetchResources();
    } catch (err: any) {
      alert(err.message || 'Failed to delete resource');
    }
  };

  const handleDeleteCluster = async (cluster: KubeCluster) => {
    if (!confirm(t('k8s.confirmDeleteCluster', `Are you sure you want to delete cluster "${cluster.name}"?`))) {
      return;
    }
    try {
      await api.deleteK8sCluster(cluster.id);
      setSelectedClusterId('');
      fetchClusters();
    } catch (err: any) {
      alert(err.message || 'Failed to delete cluster');
    }
  };

  const handleTogglePortForward = async (pf: K8sPortForward) => {
    try {
      if (pf.status === 'running') {
        await api.stopK8sPortForward(pf.id);
      } else {
        await api.startK8sPortForward(pf.id);
      }
      fetchResources();
    } catch (err: any) {
      alert(err.message || 'Port forward action failed');
    }
  };

  const handleDeletePortForward = async (id: string) => {
    try {
      await api.deleteK8sPortForward(id);
      fetchResources();
    } catch (err: any) {
      alert(err.message || 'Failed to delete port forward');
    }
  };

  const currentCluster = clusters.find((c) => c.id === selectedClusterId);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Bar / Cluster Selector & Controls */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4" />
          </div>

          {/* Cluster Dropdown */}
          {clusters.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedClusterId}
                onChange={(e) => setSelectedClusterId(e.target.value)}
                className="font-semibold text-sm text-slate-900 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden cursor-pointer"
              >
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.server_version ? `(v${c.server_version})` : ''}
                  </option>
                ))}
              </select>

              {/* Context Selector */}
              {selectedClusterDetail && selectedClusterDetail.contexts.length > 1 && (
                <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                  <span>ctx:</span>
                  <select
                    value={currentCluster?.current_context}
                    onChange={async (e) => {
                      if (!currentCluster) return;
                      await api.updateK8sCluster(currentCluster.id, { current_context: e.target.value });
                      fetchClusters();
                    }}
                    className="bg-white border border-slate-200 text-slate-700 text-xs rounded-md px-2 py-1"
                  >
                    {selectedClusterDetail.contexts.map((ctx) => (
                      <option key={ctx} value={ctx}>
                        {ctx}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Edit / Delete Cluster Buttons */}
              {currentCluster && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => {
                      setClusterToEdit(currentCluster);
                      setShowClusterModal(true);
                    }}
                    title="Edit Cluster"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCluster(currentCluster)}
                    title="Delete Cluster"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm font-semibold text-slate-700">
              {t('k8s.noClusters', 'No Kubernetes Clusters')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setClusterToEdit(null);
              setShowClusterModal(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('k8s.addCluster', 'Add Cluster')}</span>
          </button>
        </div>
      </div>

      {clusters.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-xs mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {t('k8s.emptyTitle', 'Connect Your Kubernetes Fleet')}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
            {t(
              'k8s.emptyDesc',
              'Easily manage Pods, stream container logs, open interactive Web Terminals into containers, and forward ports using your Kubeconfig.'
            )}
          </p>
          <button
            onClick={() => {
              setClusterToEdit(null);
              setShowClusterModal(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('k8s.connectFirstCluster', 'Connect First Cluster')}</span>
          </button>
        </div>
      ) : (
        /* Main Resource Dashboard */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub Navigation Bar: Tabs + Namespace Dropdown + Search + Refresh */}
          <div className="h-12 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
            {/* Category Tabs */}
            <div className="flex items-center gap-1">
              {[
                { id: 'pods', label: 'Pods', icon: Box, count: pods.length },
                { id: 'deployments', label: 'Deployments', icon: Layers, count: deployments.length },
                { id: 'services', label: 'Services', icon: Network, count: services.length },
                { id: 'nodes', label: 'Nodes', icon: Server, count: nodes.length },
                { id: 'portforwards', label: 'Port Forwards', icon: Activity, count: portForwards.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-3">
              {/* Namespace Dropdown (Not applicable for nodes) */}
              {activeTab !== 'nodes' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="text-[11px] text-slate-400">ns:</span>
                  <select
                    value={selectedNamespace}
                    onChange={(e) => setSelectedNamespace(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-md px-2.5 py-1 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="All">All Namespaces</option>
                    {namespaces.map((ns) => (
                      <option key={ns.name} value={ns.name}>
                        {ns.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search', 'Filter by name...')}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-md pl-8 pr-2.5 py-1 focus:outline-hidden focus:border-blue-500 w-48"
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchResources}
                title="Refresh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchResources}
                className="text-xs font-semibold underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="flex-1 overflow-auto p-6">
            {/* 1. PODS TAB */}
            {activeTab === 'pods' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Namespace</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Ready</th>
                        <th className="px-4 py-3">Restarts</th>
                        <th className="px-4 py-3">Pod IP</th>
                        <th className="px-4 py-3">Node</th>
                        <th className="px-4 py-3">Age</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pods
                        .filter((p) =>
                          searchQuery ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
                        )
                        .map((p) => {
                          const isRunning = p.status.toLowerCase() === 'running';
                          const isSuccess = p.status.toLowerCase() === 'completed' || p.status.toLowerCase() === 'succeeded';
                          const isCrash = p.status.toLowerCase().includes('crash') || p.status.toLowerCase().includes('error');

                          return (
                            <tr key={`${p.namespace}-${p.name}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-mono font-medium text-slate-900 flex items-center gap-2">
                                <Box className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{p.name}</span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500">{p.namespace}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isRunning
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : isSuccess
                                      ? 'bg-slate-100 text-slate-600'
                                      : isCrash
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isRunning
                                        ? 'bg-emerald-500'
                                        : isSuccess
                                        ? 'bg-slate-400'
                                        : isCrash
                                        ? 'bg-rose-500'
                                        : 'bg-amber-500'
                                    }`}
                                  />
                                  {p.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">{p.ready}</td>
                              <td className="px-4 py-3 font-mono text-slate-600">{p.restarts}</td>
                              <td className="px-4 py-3 font-mono text-slate-500">{p.ip || '-'}</td>
                              <td className="px-4 py-3 font-mono text-slate-500">{p.node || '-'}</td>
                              <td className="px-4 py-3 text-slate-500">{p.age}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Exec Terminal */}
                                  <button
                                    onClick={() => setExecPod(p)}
                                    title="Open Container Terminal (Exec)"
                                    className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-slate-900 transition-colors"
                                  >
                                    <Terminal className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Live Logs */}
                                  <button
                                    onClick={() => setLogsPod(p)}
                                    title="Live Logs Stream"
                                    className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-emerald-600 transition-colors"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>

                                  {/* View YAML */}
                                  <button
                                    onClick={() =>
                                      setYamlTarget({
                                        kind: 'Pod',
                                        namespace: p.namespace,
                                        name: p.name,
                                      })
                                    }
                                    title="View / Edit Manifest YAML"
                                    className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-blue-600 transition-colors"
                                  >
                                    <FileCode className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    onClick={() => handleDeleteResource('Pod', p.namespace, p.name)}
                                    title="Delete Pod"
                                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {pods.length === 0 && !loading && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No Pods found in this namespace.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. DEPLOYMENTS TAB */}
            {activeTab === 'deployments' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Namespace</th>
                        <th className="px-4 py-3">Replicas</th>
                        <th className="px-4 py-3">Up-to-Date</th>
                        <th className="px-4 py-3">Available</th>
                        <th className="px-4 py-3">Images</th>
                        <th className="px-4 py-3">Age</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deployments
                        .filter((d) =>
                          searchQuery ? d.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
                        )
                        .map((d) => (
                          <tr key={`${d.namespace}-${d.name}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono font-medium text-slate-900 flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{d.name}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">{d.namespace}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-800">{d.replicas}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">{d.up_to_date}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">{d.available}</td>
                            <td className="px-4 py-3 font-mono text-slate-500 max-w-xs truncate" title={d.images.join(', ')}>
                              {d.images.join(', ')}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{d.age}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    setYamlTarget({
                                      kind: 'Deployment',
                                      namespace: d.namespace,
                                      name: d.name,
                                    })
                                  }
                                  title="View / Edit YAML"
                                  className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-blue-600 transition-colors"
                                >
                                  <FileCode className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteResource('Deployment', d.namespace, d.name)}
                                  title="Delete Deployment"
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {deployments.length === 0 && !loading && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No Deployments found in this namespace.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. SERVICES TAB */}
            {activeTab === 'services' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Namespace</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Cluster IP</th>
                        <th className="px-4 py-3">External IP</th>
                        <th className="px-4 py-3">Ports</th>
                        <th className="px-4 py-3">Age</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {services
                        .filter((s) =>
                          searchQuery ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
                        )
                        .map((s) => (
                          <tr key={`${s.namespace}-${s.name}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono font-medium text-slate-900 flex items-center gap-2">
                              <Network className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span>{s.name}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">{s.namespace}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-sm bg-slate-100 font-mono text-[11px] text-slate-700">
                                {s.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{s.cluster_ip}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">{s.external_ip || '<none>'}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">
                              {s.ports.map((p) => `${p.port}/${p.protocol}`).join(', ')}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{s.age}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Port Forward Service */}
                                <button
                                  onClick={() => {
                                    setPortForwardDefaults({
                                      targetType: 'service',
                                      targetName: s.name,
                                      namespace: s.namespace,
                                      remotePort: s.ports.length > 0 ? s.ports[0].port : 80,
                                    });
                                    setShowPortForwardModal(true);
                                  }}
                                  title="Forward Port to Localhost"
                                  className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-blue-600 transition-colors"
                                >
                                  <Activity className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() =>
                                    setYamlTarget({
                                      kind: 'Service',
                                      namespace: s.namespace,
                                      name: s.name,
                                    })
                                  }
                                  title="View / Edit YAML"
                                  className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-blue-600 transition-colors"
                                >
                                  <FileCode className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteResource('Service', s.namespace, s.name)}
                                  title="Delete Service"
                                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {services.length === 0 && !loading && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No Services found in this namespace.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. NODES TAB */}
            {activeTab === 'nodes' && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Roles</th>
                        <th className="px-4 py-3">Version</th>
                        <th className="px-4 py-3">Internal IP</th>
                        <th className="px-4 py-3">CPU Cores</th>
                        <th className="px-4 py-3">Memory</th>
                        <th className="px-4 py-3">OS / Kernel</th>
                        <th className="px-4 py-3">Age</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {nodes
                        .filter((n) =>
                          searchQuery ? n.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
                        )
                        .map((n) => {
                          const isReady = n.status.toLowerCase() === 'ready';
                          return (
                            <tr key={n.name} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-mono font-medium text-slate-900 flex items-center gap-2">
                                <Server className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{n.name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isReady
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isReady ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                  />
                                  {n.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">{n.roles}</td>
                              <td className="px-4 py-3 font-mono text-slate-700">{n.version}</td>
                              <td className="px-4 py-3 font-mono text-slate-500">{n.internal_ip}</td>
                              <td className="px-4 py-3 font-mono text-slate-600">{n.cpu_cores}</td>
                              <td className="px-4 py-3 font-mono text-slate-600">{n.memory}</td>
                              <td className="px-4 py-3 text-slate-500 truncate max-w-xs" title={`${n.os_image} (${n.kernel_version})`}>
                                {n.os_image}
                              </td>
                              <td className="px-4 py-3 text-slate-500">{n.age}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {nodes.length === 0 && !loading && (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No Nodes reported by API server.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. PORT FORWARDS TAB */}
            {activeTab === 'portforwards' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setPortForwardDefaults(null);
                      setShowPortForwardModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Port Forward</span>
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold">
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Target Name</th>
                          <th className="px-4 py-3">Namespace</th>
                          <th className="px-4 py-3">Local Port</th>
                          <th className="px-4 py-3">Remote Port</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {portForwards.map((pf) => {
                          const isRunning = pf.status === 'running';
                          return (
                            <tr key={pf.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 uppercase font-mono text-[10px] text-slate-500 font-semibold">
                                {pf.target_type}
                              </td>
                              <td className="px-4 py-3 font-mono font-medium text-slate-900">
                                {pf.target_name}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-500">{pf.namespace}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-blue-600">
                                <a
                                  href={`http://localhost:${pf.local_port}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:underline"
                                >
                                  <span>{pf.local_port}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </a>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">{pf.remote_port}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isRunning
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isRunning ? 'bg-emerald-500' : 'bg-slate-400'
                                    }`}
                                  />
                                  {pf.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleTogglePortForward(pf)}
                                    title={isRunning ? 'Stop Forwarding' : 'Start Forwarding'}
                                    className={`p-1.5 rounded-md transition-colors ${
                                      isRunning
                                        ? 'text-rose-600 hover:bg-rose-50'
                                        : 'text-emerald-600 hover:bg-emerald-50'
                                    }`}
                                  >
                                    {isRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => handleDeletePortForward(pf.id)}
                                    title="Delete Port Forward"
                                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {portForwards.length === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400 italic">
                        No active or configured port forwards for this cluster.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <K8sClusterModal
        isOpen={showClusterModal}
        onClose={() => setShowClusterModal(false)}
        onSuccess={fetchClusters}
        clusterToEdit={clusterToEdit}
      />

      {execPod && (
        <K8sPodExecModal
          isOpen={!!execPod}
          onClose={() => setExecPod(null)}
          clusterId={selectedClusterId}
          pod={execPod}
        />
      )}

      {logsPod && (
        <K8sPodLogsModal
          isOpen={!!logsPod}
          onClose={() => setLogsPod(null)}
          clusterId={selectedClusterId}
          pod={logsPod}
        />
      )}

      {yamlTarget && (
        <K8sYamlModal
          isOpen={!!yamlTarget}
          onClose={() => setYamlTarget(null)}
          clusterId={selectedClusterId}
          kind={yamlTarget.kind}
          namespace={yamlTarget.namespace}
          name={yamlTarget.name}
          onSuccess={fetchResources}
        />
      )}

      <K8sPortForwardModal
        isOpen={showPortForwardModal}
        onClose={() => setShowPortForwardModal(false)}
        clusterId={selectedClusterId}
        defaultNamespace={portForwardDefaults?.namespace || (selectedNamespace === 'All' ? 'default' : selectedNamespace)}
        defaultTargetType={portForwardDefaults?.targetType || 'service'}
        defaultTargetName={portForwardDefaults?.targetName || ''}
        defaultRemotePort={portForwardDefaults?.remotePort || 80}
        onSuccess={fetchResources}
      />
    </div>
  );
};
