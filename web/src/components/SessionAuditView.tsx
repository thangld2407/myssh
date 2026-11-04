import React, { useEffect, useState, useRef } from 'react';
import { History, Play, Pause, X, RotateCcw, FastForward, Download } from 'lucide-react';
import { SessionAudit } from '../types';
import { api } from '../services/api';

export const SessionAuditView: React.FC = () => {
  const [sessions, setSessions] = useState<SessionAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingSession, setPlayingSession] = useState<SessionAudit | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [renderedText, setRenderedText] = useState<string>('');
  const playbackTimer = useRef<any>(null);
  const eventsRef = useRef<Array<[number, string, string]>>([]);
  const currentIndexRef = useRef<number>(0);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err: any) {
      alert('Lỗi tải lịch sử phiên: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openPlayer = async (session: SessionAudit) => {
    try {
      const castText = await api.getRecordingContent(session.id);
      setPlayingSession(session);
      setIsPlaying(false);
      setProgress(0);
      setRenderedText('');
      currentIndexRef.current = 0;

      const lines = castText.split('\n').filter(Boolean);
      const parsedEvents: Array<[number, string, string]> = [];
      for (let i = 1; i < lines.length; i++) {
        try {
          const ev = JSON.parse(lines[i]);
          if (Array.isArray(ev) && ev.length >= 3 && ev[1] === 'o') {
            parsedEvents.push(ev as [number, string, string]);
          }
        } catch {}
      }
      eventsRef.current = parsedEvents;
    } catch (err: any) {
      alert('Không thể tải file ghi hình: ' + err.message);
    }
  };

  const closePlayer = () => {
    if (playbackTimer.current) clearInterval(playbackTimer.current);
    setPlayingSession(null);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (playbackTimer.current) clearInterval(playbackTimer.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (eventsRef.current.length === 0) return;

    if (currentIndexRef.current >= eventsRef.current.length) {
      currentIndexRef.current = 0;
      setRenderedText('');
    }

    if (playbackTimer.current) clearInterval(playbackTimer.current);

    playbackTimer.current = setInterval(() => {
      const idx = currentIndexRef.current;
      if (idx >= eventsRef.current.length) {
        clearInterval(playbackTimer.current);
        setIsPlaying(false);
        return;
      }

      const event = eventsRef.current[idx];
      setRenderedText((prev) => prev + event[2]);
      currentIndexRef.current = idx + 1;
      setProgress(Math.round(((idx + 1) / eventsRef.current.length) * 100));
    }, Math.max(10, 80 / speed));
  };

  const restartPlayback = () => {
    currentIndexRef.current = 0;
    setRenderedText('');
    setProgress(0);
    if (isPlaying) {
      startPlayback();
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4 text-slate-800">
      <div className="h-10 flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            Session Audit Logs
          </h1>
          <p className="text-[11px] text-slate-500">
            Nhật ký ghi hình phiên làm việc chuẩn Asciinema v2
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-4">Máy Chủ</th>
              <th className="py-2.5 px-4">User</th>
              <th className="py-2.5 px-4">Client IP</th>
              <th className="py-2.5 px-4">Bắt Đầu</th>
              <th className="py-2.5 px-4">Trạng Thái</th>
              <th className="py-2.5 px-4">Lưu Lượng</th>
              <th className="py-2.5 px-4 text-right">Replay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {sessions.map((sess) => (
              <tr key={sess.id} className="hover:bg-slate-50/80 transition">
                <td className="py-3 px-4 text-slate-900 font-sans font-semibold">
                  {sess.host_name || sess.host_id}
                </td>
                <td className="py-3 px-4 text-slate-700 font-sans">
                  {sess.user?.username || sess.user_id}
                </td>
                <td className="py-3 px-4 text-slate-500 text-[11px]">
                  {sess.client_ip || '127.0.0.1'}
                </td>
                <td className="py-3 px-4 text-slate-500 text-[11px]">
                  {new Date(sess.started_at).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border font-medium ${
                    sess.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : sess.status === 'closed'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {sess.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600 text-[11px]">
                  {sess.byte_count ? (sess.byte_count / 1024).toFixed(1) + ' KB' : '-'}
                </td>
                <td className="py-3 px-4 text-right font-sans">
                  {sess.recording_path ? (
                    <button
                      onClick={() => openPlayer(sess)}
                      className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 transition shadow-2xs"
                    >
                      <Play className="w-3 h-3 text-emerald-400" /> Replay
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px]">-</span>
                  )}
                </td>
              </tr>
            ))}

            {!loading && sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                  Chưa có phiên làm việc nào được ghi nhận.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Replay Modal */}
      {playingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl h-[75vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50/75">
              <span className="text-xs font-semibold text-slate-900 font-sans">
                Replay: {playingSession.host_name}
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href={`/api/audit/sessions/${playingSession.id}/recording`}
                  download={`${playingSession.id}.cast`}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-mono flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                >
                  <Download className="w-3 h-3 text-slate-500" /> .cast
                </a>
                <button onClick={closePlayer} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#09090b] p-3 overflow-auto font-mono text-xs text-zinc-100 select-text whitespace-pre-wrap">
              {renderedText || <span className="text-zinc-500">// Nhấn Play để bắt đầu phát lại...</span>}
            </div>

            <div className="h-12 border-t border-slate-200 bg-white px-4 flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={togglePlay}
                  className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white transition shadow-2xs"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={restartPlayback}
                  className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <div className="w-48 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-slate-900 h-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-mono text-slate-500">{progress}%</span>
              </div>

              <div className="flex items-center space-x-1.5 text-xs">
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition ${
                      speed === s ? 'bg-slate-900 text-white font-semibold shadow-2xs' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
