import React, { useEffect, useState, useRef } from 'react';
import {
  Folder,
  File,
  FileCode,
  FileArchive,
  Upload,
  Download,
  Trash2,
  FolderPlus,
  ArrowUp,
  RefreshCw,
  X,
  AlertCircle,
  Search,
  HardDrive
} from 'lucide-react';
import { Host, FileItem } from '../types';
import { api } from '../services/api';

interface SftpPanelProps {
  host: Host;
  isEmbedded?: boolean;
  onClose?: () => void;
}

export const SftpPanel: React.FC<SftpPanelProps> = ({ host, isEmbedded = false, onClose }) => {
  const [currentPath, setCurrentPath] = useState('.');
  const [items, setItems] = useState<FileItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listSftp(host.id, path);
      setCurrentPath(res.path || path);
      const sorted = (res.items || []).sort((a, b) => {
        if (a.is_dir === b.is_dir) {
          return a.name.localeCompare(b.name);
        }
        return a.is_dir ? -1 : 1;
      });
      setItems(sorted);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách tệp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory('.');
  }, [host.id]);

  const handleNavigateUp = () => {
    if (currentPath === '.' || currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = parts.length === 0 ? '.' : (currentPath.startsWith('/') ? '/' + parts.join('/') : parts.join('/'));
    loadDirectory(upPath);
  };

  const handleItemClick = (item: FileItem) => {
    if (item.is_dir) {
      loadDirectory(item.path);
    }
  };

  const handleDownload = (item: FileItem) => {
    const downloadUrl = api.downloadSftpUrl(host.id, item.path);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Bạn có chắc muốn xóa "${item.name}"?`)) return;
    try {
      await api.deleteSftp(host.id, item.path);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await api.uploadSftp(host.id, currentPath, file);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert('Lỗi tải tệp: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const fullPath = currentPath === '.' ? newFolderName : `${currentPath}/${newFolderName}`;
    try {
      await api.mkdirSftp(host.id, fullPath);
      setShowNewFolderModal(false);
      setNewFolderName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      alert('Lỗi tạo thư mục: ' + err.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: FileItem) => {
    if (item.is_dir) return <Folder className="w-4 h-4 text-slate-700 shrink-0" />;
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (['zip', 'tar', 'gz', 'bz2', '7z'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-slate-500 shrink-0" />;
    }
    if (['go', 'js', 'ts', 'py', 'sh', 'json', 'yaml', 'yml', 'html', 'css', 'sql', 'md', 'txt'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-slate-600 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full bg-white text-slate-800 ${isEmbedded ? 'border-l border-slate-200' : ''}`}>
      {/* Top Header */}
      <div className="h-10 border-b border-slate-200 px-3 flex items-center justify-between bg-slate-50/80 shrink-0">
        <div className="flex items-center space-x-2 truncate">
          <HardDrive className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span className="font-semibold text-slate-900 text-xs truncate">
            SFTP {isEmbedded ? 'Explorer' : `: ${host.name}`}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 transition disabled:opacity-50 shadow-2xs"
            title="Tải tệp lên thư mục hiện tại"
          >
            <Upload className="w-3 h-3" />
            <span>{uploading ? '...' : 'Upload'}</span>
          </button>

          <button
            onClick={() => setShowNewFolderModal(true)}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
            title="Tạo thư mục mới"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
              title="Đóng SFTP"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Path & Search Bar */}
      <div className="bg-slate-50/40 px-2.5 py-1.5 border-b border-slate-200 flex items-center justify-between text-xs font-mono shrink-0 gap-2">
        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === '.' || currentPath === '/'}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent transition"
            title="Lên thư mục cha"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 flex-1 truncate select-all text-[11px] shadow-2xs">
            {currentPath}
          </span>
        </div>

        <div className="relative w-28 sm:w-36 shrink-0">
          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Lọc..."
            className="w-full pl-6 pr-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-sans"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="m-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-1.5 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold text-[10px] uppercase tracking-wider sticky top-0">
              <th className="py-1.5 pl-2.5">Tên</th>
              <th className="py-1.5 w-16">Size</th>
              {!isEmbedded && <th className="py-1.5 w-20">Perms</th>}
              <th className="py-1.5 w-16 text-right pr-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredItems.map((item) => (
              <tr
                key={item.path}
                onDoubleClick={() => handleItemClick(item)}
                className="hover:bg-slate-50/80 group transition cursor-pointer select-none"
              >
                <td className="py-1.5 pl-2.5 flex items-center space-x-1.5 truncate">
                  {getFileIcon(item)}
                  <span className={`truncate text-xs ${item.is_dir ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>
                    {item.name}
                  </span>
                </td>
                <td className="py-1.5 text-slate-500 text-[11px]">{item.is_dir ? '-' : formatSize(item.size)}</td>
                {!isEmbedded && <td className="py-1.5 text-slate-400 text-[10px]">{item.mode}</td>}
                <td className="py-1.5 text-right pr-2">
                  <div className="flex items-center justify-end space-x-1 opacity-60 group-hover:opacity-100">
                    {!item.is_dir && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item);
                        }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
                        title="Tải về"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                      title="Xóa"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={isEmbedded ? 3 : 4} className="py-8 text-center text-slate-400 font-sans text-xs">
                  Thư mục trống
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal New Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-2xs">
          <form onSubmit={handleCreateFolder} className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-xs font-semibold text-slate-900 mb-2">Tạo thư mục mới</h3>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Tên thư mục..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 mb-3 font-mono"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-2xs"
              >
                Tạo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
