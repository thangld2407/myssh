import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Play,
  Copy,
  Check,
  Edit2,
  Trash2,
  Terminal,
  Code2,
  Tag,
  AlertCircle,
  Folder
} from 'lucide-react';
import { Snippet } from '../types';
import { api } from '../services/api';
import { SnippetRunnerModal } from './SnippetRunnerModal';

interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand?: (cmd: string) => void;
}

export const SnippetModal: React.FC<SnippetModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit / Create state
  const [showForm, setShowForm] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formTags, setFormTags] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Runner state
  const [runningSnippet, setRunningSnippet] = useState<Snippet | null>(null);

  const fetchSnippets = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getSnippets();
      if (Array.isArray(data)) {
        setSnippets(data);
      } else {
        setSnippets([]);
      }
    } catch (err: any) {
      console.error('Failed to load snippets', err);
      setLoadError(err.message || 'Không thể nạp danh sách lệnh mẫu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnippets();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Categories list
  const categories = ['all', ...Array.from(new Set(snippets.map((s) => s.category || 'General')))];

  const filtered = snippets.filter((s) => {
    const matchCat = selectedCategory === 'all' || s.category === selectedCategory;
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.command.toLowerCase().includes(search.toLowerCase()) ||
      (s.tags && s.tags.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleOpenCreate = () => {
    setEditingSnippet(null);
    setFormName('');
    setFormCommand('');
    setFormDescription('');
    setFormCategory('General');
    setFormTags('');
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (s: Snippet) => {
    setEditingSnippet(s);
    setFormName(s.name);
    setFormCommand(s.command);
    setFormDescription(s.description || '');
    setFormCategory(s.category || 'General');
    setFormTags(s.tags || '');
    setFormError(null);
    setShowForm(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCommand.trim()) {
      setFormError('Vui lòng nhập tên và nội dung câu lệnh');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingSnippet) {
        await api.updateSnippet(editingSnippet.id, {
          name: formName,
          command: formCommand,
          description: formDescription,
          category: formCategory,
          tags: formTags,
        });
      } else {
        await api.createSnippet({
          name: formName,
          command: formCommand,
          description: formDescription,
          category: formCategory,
          tags: formTags,
        });
      }
      setShowForm(false);
      fetchSnippets();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi lưu snippet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa lệnh mẫu "${name}"?`)) return;
    try {
      await api.deleteSnippet(id);
      fetchSnippets();
    } catch (err: any) {
      alert('Lỗi xóa: ' + err.message);
    }
  };

  const handleCopy = (s: Snippet) => {
    navigator.clipboard.writeText(s.command);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRun = (s: Snippet) => {
    // Check if command has dynamic variables {{VAR}}
    if (/\{\{([^}]+)\}\}/.test(s.command)) {
      setRunningSnippet(s);
    } else {
      if (onExecuteCommand) {
        onExecuteCommand(s.command);
        onClose();
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-backdrop">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-modal text-slate-800">
          
          {/* Header */}
          <div className="h-14 border-b border-slate-200 bg-slate-50/80 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">
                  Quick Command & Snippet Library
                </h2>
                <p className="text-[11px] text-slate-500">
                  Kho lệnh mẫu DevOps & câu lệnh có tham số chạy nhanh vào Terminal
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleOpenCreate}
                className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm lệnh mẫu</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 active:scale-90 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm lệnh theo tên, nội dung hoặc tag..."
                className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Category pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto py-1 text-xs shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs transition capitalize whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'Tất cả' : cat}
                </button>
              ))}
            </div>
          </div>

          {loadError && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2 shrink-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Snippet Grid / List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-3">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                Đang tải danh sách lệnh mẫu...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                <Code2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Không tìm thấy câu lệnh phù hợp</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((s) => {
                  const hasVars = /\{\{([^}]+)\}\}/.test(s.command);
                  return (
                    <div
                      key={s.id}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between shadow-xs transition group space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                            {s.name}
                            {hasVars && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono font-normal">
                                Có biến số
                              </span>
                            )}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                            {s.category || 'General'}
                          </span>
                        </div>

                        {s.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {s.description}
                          </p>
                        )}

                        {/* Code box */}
                        <div className="p-2.5 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all border border-slate-800 max-h-24">
                          <code>{s.command}</code>
                        </div>

                        {s.tags && (
                          <div className="flex items-center gap-1 flex-wrap pt-1">
                            {s.tags.split(',').map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-mono"
                              >
                                #{tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition"
                            title="Sửa snippet"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                            title="Xóa snippet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleCopy(s)}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium flex items-center gap-1 transition"
                            title="Sao chép câu lệnh"
                          >
                            {copiedId === s.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span className="text-[11px]">
                              {copiedId === s.id ? 'Đã chép' : 'Chép'}
                            </span>
                          </button>

                          {onExecuteCommand && (
                            <button
                              onClick={() => handleRun(s)}
                              className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-2xs"
                              title="Thực thi vào terminal"
                            >
                              <Terminal className="w-3 h-3" />
                              <span>{hasVars ? 'Điền & Chạy' : 'Chạy ngay'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-backdrop">
          <form
            onSubmit={handleSaveForm}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-modal text-slate-800"
          >
            <div className="h-12 border-b border-slate-200 bg-slate-50/80 px-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-xs">
                {editingSnippet ? 'Chỉnh sửa lệnh mẫu' : 'Thêm lệnh mẫu mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Tên câu lệnh <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Nginx Test & Reload"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Danh mục (Category)
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Docker, System, Nginx..."
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Thẻ tags (cách nhau dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="docker, restart, prod"
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 block">
                    Nội dung câu lệnh <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Sử dụng &#123;&#123;TÊN_BIẾN&#125;&#125; cho tham số
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="docker logs -f --tail {{LINES}} {{CONTAINER_ID}}"
                  className="w-full p-2.5 bg-slate-950 text-slate-100 font-mono text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Mô tả / Ghi chú
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Mô tả công dụng của câu lệnh..."
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-8 px-3.5 rounded-lg text-xs text-slate-600 hover:bg-slate-200 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-8 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Đang lưu...' : 'Lưu snippet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Snippet Runner with dynamic variable inputs */}
      {runningSnippet && (
        <SnippetRunnerModal
          snippet={runningSnippet}
          onClose={() => setRunningSnippet(null)}
          onExecute={(resolvedCmd) => {
            if (onExecuteCommand) {
              onExecuteCommand(resolvedCmd);
              onClose();
            }
          }}
        />
      )}
    </>
  );
};
