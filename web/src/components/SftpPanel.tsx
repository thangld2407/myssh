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
  HardDrive,
  Edit3
} from 'lucide-react';
import { Host, FileItem } from '../types';
import { api } from '../services/api';
import { FileEditorModal } from './FileEditorModal';

const isTextFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const textExtensions = [
    'txt', 'sh', 'bash', 'zsh', 'conf', 'cfg', 'cnf', 'ini', 'env',
    'json', 'yaml', 'yml', 'toml', 'xml', 'md', 'markdown',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'rb', 'php', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'sql', 'log', 'service', 'properties', 'dockerfile', 'makefile'
  ];
  return textExtensions.includes(ext) || fileName.toLowerCase() === 'dockerfile' || fileName.toLowerCase() === 'makefile' || fileName.startsWith('.');
};

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
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
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
    } else if (isTextFile(item.name)) {
      setEditingFile(item);
    }
  };

  const handleDownload = async (item: FileItem) => {
    try {
      const downloadUrl = await api.downloadSftpUrl(host.id, item.path);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Lỗi tải tệp: ' + err.message);
    }
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
    if (!bytes || bytes <= 0) return '-';
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
      <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50/80 shrink-0">
        <div className="flex items-center space-x-2 truncate">
          <HardDrive className="w-4 h-4 text-slate-700 shrink-0" />
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
            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs"
            title="Tải tệp lên thư mục hiện tại"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? '...' : 'Upload'}</span>
          </button>

          <button
            onClick={() => setShowNewFolderModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 active:scale-90 transition"
            title="Tạo thư mục mới"
          >
            <FolderPlus className="w-4 h-4" />
          </button>

          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 active:scale-90 transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 active:scale-90 transition"
              title="Đóng SFTP"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb Path & Search Bar */}
      <div className="bg-slate-50/40 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-mono shrink-0 gap-2.5">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === '.' || currentPath === '/'}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent active:scale-90 transition"
            title="Lên thư mục cha"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <span className="text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200 flex-1 truncate select-all text-xs shadow-2xs font-mono">
            {currentPath}
          </span>
        </div>

        <div className="relative w-32 sm:w-40 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Lọc tệp..."
            className="w-full pl-7 pr-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 font-sans"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold text-[10px] uppercase tracking-wider sticky top-0">
              <th className="py-2 pl-3">Tên</th>
              <th className="py-2 w-16">Size</th>
              {!isEmbedded && <th className="py-2 w-20">Perms</th>}
              <th className="py-2 w-20 text-right pr-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredItems.map((item) => (
              <tr
                key={item.path}
                onDoubleClick={() => handleItemClick(item)}
                className="hover:bg-slate-50/80 group transition cursor-pointer select-none"
              >
                <td className="py-2 pl-3 flex items-center space-x-2 truncate">
                  {getFileIcon(item)}
                  <span className={`truncate text-xs ${item.is_dir ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>
                    {item.name}
                  </span>
                </td>
                <td className="py-2 text-slate-500 text-xs">{item.is_dir ? '-' : formatSize(item.size)}</td>
                {!isEmbedded && <td className="py-2 text-slate-400 text-xs">{item.mode}</td>}
                <td className="py-2 text-right pr-3">
                  <div className="flex items-center justify-end space-x-1 opacity-60 group-hover:opacity-100">
                    {!item.is_dir && isTextFile(item.name) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFile(item);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-90 transition"
                        title="Chỉnh sửa tệp"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!item.is_dir && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-90 transition"
                        title="Tải về"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 active:scale-90 transition"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && filteredItems.length === 0 && (
              <tr>
                <td colSpan={isEmbedded ? 3 : 4} className="py-10 text-center text-slate-400 font-sans text-xs">
                  Thư mục trống
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal New Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-backdrop">
          <form onSubmit={handleCreateFolder} className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-modal">
            <h3 className="text-xs font-semibold text-slate-900 mb-2.5">Tạo thư mục mới</h3>
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Tên thư mục..."
              className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 mb-4 font-mono"
            />
            <div className="flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition active:scale-95"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold transition shadow-xs"
              >
                Tạo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline File Editor Modal */}
      {editingFile && (
        <FileEditorModal
          host={host}
          fileItem={editingFile}
          onClose={() => setEditingFile(null)}
          onSaved={() => loadDirectory(currentPath)}
        />
      )}
    </div>
  );
};
