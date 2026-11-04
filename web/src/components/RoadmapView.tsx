import React, { useState } from 'react';
import { ThumbsUp, CheckCircle2, Clock, Flame, GitBranch, Heart } from 'lucide-react';

interface RoadmapItem {
  id: string;
  title: string;
  desc: string;
  votes: number;
  tags: string[];
  status: 'completed' | 'in_progress' | 'planned';
}

interface RoadmapViewProps {
  onOpenSponsor: () => void;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({ onOpenSponsor }) => {
  const [items, setItems] = useState<RoadmapItem[]>([
    {
      id: 'r-1',
      title: 'Web Terminal Interactive (xterm.js + WebSocket)',
      desc: 'Shell PTY thời gian thực, ANSI colors, copy/paste mượt mà, PTY auto-resize',
      votes: 142,
      tags: ['Core', 'Terminal'],
      status: 'completed',
    },
    {
      id: 'r-2',
      title: 'Zero-Trust Credential Vault (AES-256-GCM + Argon2id)',
      desc: 'Mã hóa cấp quân sự bảo vệ Private Keys và Passwords, chống rò rỉ secret',
      votes: 128,
      tags: ['Security', 'Vault'],
      status: 'completed',
    },
    {
      id: 'r-3',
      title: 'Session Audit Recording & Web Player (Asciinema v2)',
      desc: 'Ghi hình phiên làm việc phục vụ điều tra sự cố và kiểm toán bảo mật compliance',
      votes: 115,
      tags: ['Audit', 'Compliance'],
      status: 'completed',
    },
    {
      id: 'r-4',
      title: 'AI Shell Copilot & Command Intelligence',
      desc: 'Tích hợp AI giải thích câu lệnh terminal, cảnh báo lệnh nguy hiểm (rm -rf /) và gợi ý cú pháp',
      votes: 289,
      tags: ['AI', 'Productivity'],
      status: 'in_progress',
    },
    {
      id: 'r-5',
      title: 'Kubernetes Pod SSH Gateway (K8s Exec)',
      desc: 'Mở shell trực tiếp vào Pod / Container trong cụm Kubernetes mà không cần tải kubeconfig',
      votes: 231,
      tags: ['CloudNative', 'DevOps'],
      status: 'in_progress',
    },
    {
      id: 'r-6',
      title: 'Zmodem Drag & Drop File Upload',
      desc: 'Kéo thả tệp trực tiếp từ Desktop vào màn hình terminal đang chạy để tự động upload qua rz/sz',
      votes: 184,
      tags: ['Terminal', 'UX'],
      status: 'planned',
    },
    {
      id: 'r-7',
      title: 'Just-In-Time (JIT) Access Approval Bot',
      desc: 'Kỹ sư xin quyền SSH tạm thời trong 2 giờ, phê duyệt 1-chạm qua Telegram hoặc Slack bot',
      votes: 167,
      tags: ['Enterprise', 'Security'],
      status: 'planned',
    },
    {
      id: 'r-8',
      title: 'Biometric TouchID / WebAuthn Unlock',
      desc: 'Mở khóa Key Vault bằng vân tay TouchID / FaceID trên thiết bị mà không cần nhập mật khẩu',
      votes: 153,
      tags: ['Security', 'Hardware'],
      status: 'planned',
    },
  ]);

  const [votedIds, setVotedIds] = useState<string[]>([]);

  const handleVote = (id: string) => {
    if (votedIds.includes(id)) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, votes: it.votes - 1 } : it))
      );
      setVotedIds((prev) => prev.filter((i) => i !== id));
    } else {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, votes: it.votes + 1 } : it))
      );
      setVotedIds((prev) => [...prev, id]);
    }
  };

  const getStatusColumn = (status: 'completed' | 'in_progress' | 'planned') => {
    return items.filter((it) => it.status === status);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      {/* Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono font-medium">
              Build in Public
            </span>
            <span className="text-slate-500 text-xs">Cộng đồng biểu quyết tính năng</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Public Product Roadmap
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl">
            Các tính năng được phát triển dựa trên số lượt vote của cộng đồng kỹ sư.
          </p>
        </div>

        <button
          onClick={onOpenSponsor}
          className="h-9 px-4 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-2xs active:scale-95"
        >
          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
          Sponsor Dự án
        </button>
      </div>

      {/* 3 Columns Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Shipped */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Shipped
            </h3>
            <span className="text-xs font-mono font-medium text-slate-400">{getStatusColumn('completed').length}</span>
          </div>

          <div className="space-y-2.5">
            {getStatusColumn('completed').map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-slate-900 text-xs">{item.title}</h4>
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-xs font-mono font-semibold">Live</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  {item.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 text-xs font-mono font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> In Progress
            </h3>
            <span className="text-xs font-mono font-medium text-slate-400">{getStatusColumn('in_progress').length}</span>
          </div>

          <div className="space-y-2.5">
            {getStatusColumn('in_progress').map((item) => {
              const hasVoted = votedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl space-y-2 shadow-xs transition"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-slate-900 text-xs">{item.title}</h4>
                    <button
                      onClick={() => handleVote(item.id)}
                      className={`h-8 px-3 rounded-lg text-xs font-mono flex items-center gap-1.5 transition active:scale-95 ${
                        hasVoted
                          ? 'bg-slate-900 text-white font-semibold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs font-medium'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {item.votes}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {item.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 text-xs font-mono font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Planned */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Backlog
            </h3>
            <span className="text-xs font-mono font-medium text-slate-400">{getStatusColumn('planned').length}</span>
          </div>

          <div className="space-y-2.5">
            {getStatusColumn('planned').map((item) => {
              const hasVoted = votedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl space-y-2 shadow-xs transition"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-slate-800 text-xs">{item.title}</h4>
                    <button
                      onClick={() => handleVote(item.id)}
                      className={`h-8 px-3 rounded-lg text-xs font-mono flex items-center gap-1.5 transition active:scale-95 ${
                        hasVoted
                          ? 'bg-slate-900 text-white font-semibold shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs font-medium'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {item.votes}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {item.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 text-xs font-mono font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
