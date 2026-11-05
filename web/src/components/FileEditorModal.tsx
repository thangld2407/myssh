import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  RefreshCw,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { Host, FileItem } from '../types';
import { api } from '../services/api';

interface FileEditorModalProps {
  host: Host;
  fileItem: FileItem;
  onClose: () => void;
  onSaved?: () => void;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  host,
  fileItem,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showConfirmClose, setShowConfirmClose] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== originalContent;

  const loadFileContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.readSftp(host.id, fileItem.path);
      if (res && typeof res.content === 'string') {
        setContent(res.content);
        setOriginalContent(res.content);
      } else {
        throw new Error('Máy chủ trả về định dạng không đúng (có thể cần khởi động lại backend).');
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải nội dung tệp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFileContent();
  }, [host.id, fileItem.path]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.writeSftp(host.id, fileItem.path, content);
      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onSaved?.();
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu tệp lên máy chủ');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, originalContent, saving]);

  // Determine language badge
  const getFileExtension = (name: string) => {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() : 'TEXT';
  };

  const lineCount = content ? content.split('\n').length : 0;
  const charCount = content ? content.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs animate-backdrop">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-modal text-slate-100">
        
        {/* Editor Header */}
        <div className="h-12 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-2 truncate">
              <span className="font-semibold text-slate-100 text-xs truncate">
                {fileItem.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                {getFileExtension(fileItem.name)}
              </span>
              {isDirty && (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Chưa lưu
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium px-2 py-1 bg-emerald-950/60 border border-emerald-800 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đã lưu
              </span>
            )}

            <button
              onClick={loadFileContent}
              disabled={loading || saving}
              className="h-8 px-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1.5 transition disabled:opacity-50"
              title="Tải lại nội dung từ máy chủ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Nạp lại</span>
            </button>

            <button
              onClick={handleSave}
              disabled={loading || saving || !isDirty}
              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-sm"
              title="Lưu tệp lên máy chủ (Ctrl + S)"
            >
              <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Đang lưu...' : 'Lưu tệp (Ctrl+S)'}</span>
            </button>

            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-90 transition"
              title="Đóng trình soạn thảo (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Path banner & Error Notification */}
        <div className="bg-slate-950/40 px-4 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
          <div className="truncate flex items-center gap-1.5">
            <span className="text-slate-500">{host.name}:</span>
            <span className="text-slate-300 truncate">{fileItem.path}</span>
          </div>
          <div className="hidden sm:block text-slate-500 shrink-0">
            Dung lượng: {(fileItem.size / 1024).toFixed(1)} KB
          </div>
        </div>

        {error && (
          <div className="m-3 p-3 bg-red-950/70 border border-red-800 rounded-lg text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {/* Editor Body */}
        <div className="flex-1 flex overflow-hidden relative bg-[#0d1117]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs">Đang tải nội dung tệp từ {host.name}...</p>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden font-mono text-xs">
              {/* Line Numbers */}
              <div className="w-12 py-3 bg-[#090d13] text-slate-600 select-none text-right pr-2.5 font-mono text-xs border-r border-slate-800/70 overflow-hidden shrink-0">
                {Array.from({ length: Math.max(lineCount, 1) }).map((_, idx) => (
                  <div key={idx} className="leading-5 h-5">
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Textarea Code Input */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung tệp ở đây..."
                spellCheck={false}
                className="flex-1 p-3 bg-transparent text-slate-200 placeholder-slate-600 resize-none focus:outline-none font-mono text-xs leading-5 whitespace-pre overflow-auto selection:bg-slate-700 selection:text-white"
              />
            </div>
          )}
        </div>

        {/* Editor Footer Status Bar */}
        <div className="h-7 border-t border-slate-800 bg-slate-950 px-4 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0 select-none">
          <div className="flex items-center space-x-4">
            <span>Dòng: {lineCount}</span>
            <span>Ký tự: {charCount}</span>
            <span>UTF-8</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-500">
            <span>Ctrl + S để lưu</span>
            <span>Esc để thoát</span>
          </div>
        </div>

        {/* Confirmation Modal when Closing with Unsaved Changes */}
        {showConfirmClose && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-slate-200">
              <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bạn có thay đổi chưa lưu!</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nội dung tệp <span className="text-slate-200 font-mono font-medium">{fileItem.name}</span> đã được chỉnh sửa nhưng chưa lưu lên máy chủ. Bạn có chắc muốn đóng và hủy các thay đổi này?
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmClose(false)}
                  className="h-8 px-3 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
                >
                  Quay lại chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmClose(false);
                    onClose();
                  }}
                  className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
                >
                  Bỏ thay đổi & Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
