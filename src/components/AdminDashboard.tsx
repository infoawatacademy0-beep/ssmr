import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  X,
  CheckCircle,
  XCircle,
  Trash2,
  Users,
  Search,
  Ban,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { ReportItem, User } from '../types';
import {
  subscribeToAllReports,
  resolveReport,
  deleteReport,
  fetchAllUsers,
  banUser,
  unbanUser,
} from '../services';

interface AdminDashboardProps {
  currentUser: User;
  onClose: () => void;
}

export default function AdminDashboard({ currentUser, onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Subscribe to live reports
  useEffect(() => {
    const unsub = subscribeToAllReports((data) => {
      setReports(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch users on tab switch
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAllUsers().then((res) => setUsers(res));
    }
  }, [activeTab]);

  const handleResolve = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await resolveReport(reportId, status, `Reviewed by admin ${currentUser.username}`);
    } catch (err) {
      console.error('Failed to resolve report:', err);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Delete this report record permanently?')) return;
    try {
      await deleteReport(reportId);
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const handleBanToggle = async (targetUser: User) => {
    const isBanned = Boolean(targetUser.isBanned);
    if (isBanned) {
      if (!window.confirm(`Lift ban for ${targetUser.username}?`)) return;
      await unbanUser(targetUser.uid);
    } else {
      const reason = window.prompt(`Enter ban reason for ${targetUser.username}:`, 'Terms of service violation');
      if (!reason) return;
      await banUser(targetUser.uid, reason);
    }
    // Refresh user list
    const updated = await fetchAllUsers();
    setUsers(updated);
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(userSearchTerm.toLowerCase()),
  );

  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-rose-500/30 bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                  ناوەندی کۆنترۆڵی ئەدمین
                </h3>
                <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[8px] font-bold text-rose-300 uppercase">
                  ستاف
                </span>
              </div>
              <p className="text-[10px] text-slate-400">پانێڵی بەڕێوەبردن و چاودێری</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition ${
              activeTab === 'reports'
                ? 'border border-rose-400/40 bg-rose-400/15 text-rose-300'
                : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>ڕاپۆرتەکان ({pendingReportsCount} چاوەڕوانکراو)</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition ${
              activeTab === 'users'
                ? 'border border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
                : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4 text-cyan-400" />
            <span>بەڕێوەبردنی بەکارهێنەران</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'reports' ? (
            reports.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-slate-500">
                <CheckCircle className="h-10 w-10 text-emerald-500/40 mb-2" />
                <h4 className="text-xs font-bold text-white">Queue Empty</h4>
                <p className="text-[11px] text-slate-400">All reports have been reviewed.</p>
              </div>
            ) : (
              <AnimatePresence>
                {reports.map((report) => (
                  <motion.div
                    key={report.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`rounded-2xl border p-4 space-y-2.5 ${
                      report.status === 'pending'
                        ? 'border-rose-500/30 bg-rose-500/[0.03]'
                        : 'border-slate-800 bg-slate-950/40 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-md bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[9px] font-bold text-amber-400 uppercase">
                          Target: {report.targetType.toUpperCase()}
                        </span>
                        <h4 className="mt-1 text-xs font-bold text-white">
                          Reason: {report.reason}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${
                            report.status === 'pending'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : report.status === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {report.status}
                        </span>

                        <button
                          onClick={() => handleDelete(report.id)}
                          className="rounded-lg p-1 text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {report.details && (
                      <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-300 leading-relaxed">
                        &quot;{report.details}&quot;
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Reporter: {report.reporterName || report.reporterUid}</span>
                      <span>Target ID: {report.targetId}</span>
                    </div>

                    {report.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          onClick={() => handleResolve(report.id, 'resolved')}
                          className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Take Action &amp; Resolve</span>
                        </button>

                        <button
                          onClick={() => handleResolve(report.id, 'dismissed')}
                          className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )
          ) : (
            <div className="space-y-3">
              {/* User search bar */}
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Filter users by username..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              {filteredUsers.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-bold text-white">
                      {u.avatar || u.profileImage ? (
                        <img src={u.avatar || u.profileImage} alt={u.username} className="h-full w-full object-cover" />
                      ) : (
                        u.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white">{u.username}</h4>
                        {u.isBanned && (
                          <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[8px] font-bold text-rose-300 uppercase">
                            Banned
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Level {u.level || 1} &bull; {u.coins?.toLocaleString() || 0} Coins
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleBanToggle(u)}
                    className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      u.isBanned
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                    }`}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span>{u.isBanned ? 'Lift Ban' : 'Ban User'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
