import React, { useState, useEffect } from 'react';
import { X, Play, Copy, Check, Terminal, Variable } from 'lucide-react';
import { Snippet } from '../types';

interface SnippetRunnerModalProps {
  snippet: Snippet;
  onClose: () => void;
  onExecute: (resolvedCommand: string) => void;
}

export const SnippetRunnerModal: React.FC<SnippetRunnerModalProps> = ({
  snippet,
  onClose,
  onExecute,
}) => {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Extract variables of the form {{VARIABLE_NAME}}
  useEffect(() => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(snippet.command)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    const initialVars: Record<string, string> = {};
    matches.forEach((v) => {
      // Default sample values based on common variable names
      if (v.toLowerCase().includes('port')) initialVars[v] = '8080';
      else if (v.toLowerCase().includes('lines')) initialVars[v] = '100';
      else if (v.toLowerCase().includes('container')) initialVars[v] = 'web-app';
      else if (v.toLowerCase().includes('service')) initialVars[v] = 'nginx';
      else initialVars[v] = '';
    });
    setVariables(initialVars);
  }, [snippet]);

  const getResolvedCommand = () => {
    let resolved = snippet.command;
    Object.entries(variables).forEach(([key, val]) => {
      resolved = resolved.split(`{{${key}}}`).join(val || `{{${key}}}`);
    });
    return resolved;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getResolvedCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    onExecute(getResolvedCommand());
    onClose();
  };

  const resolved = getResolvedCommand();

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-backdrop">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-modal text-slate-800">
        
        {/* Modal Header */}
        <div className="h-12 border-b border-slate-200 bg-slate-50/80 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <Variable className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="font-semibold text-slate-900 text-xs truncate">
              Điền tham số: {snippet.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRun} className="p-5 space-y-4">
          {snippet.description && (
            <p className="text-xs text-slate-500 leading-relaxed">
              {snippet.description}
            </p>
          )}

          {/* Dynamic parameter inputs */}
          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
              Các tham số động
            </label>
            {Object.keys(variables).map((varName) => (
              <div key={varName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-emerald-700 font-medium">
                    &#123;&#123;{varName}&#125;&#125;
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={variables[varName]}
                  onChange={(e) =>
                    setVariables({ ...variables, [varName]: e.target.value })
                  }
                  placeholder={`Nhập giá trị cho ${varName}...`}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
            ))}
          </div>

          {/* Resolved command preview */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
              Lệnh sau khi thay thế
            </label>
            <div className="p-3 bg-slate-950 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
              <code>{resolved}</code>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Chèn vào Terminal</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
