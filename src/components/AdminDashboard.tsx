import { useState, useEffect, useMemo } from 'react';
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
  Inbox,
  Coins,
  Smartphone,
} from 'lucide-react';
import type { ReportItem, User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
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

type ReportFilter = 'all' | 'pending' | 'resolved' | 'dismissed';

export default function AdminDashboard({ currentUser, onClose }: AdminDashboardProps) {
  const { tr } = useLanguage();
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('pending');
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Subscribe to live reports
  useEffect(() => {
    const unsub = subscribeToAllReports((data) => {
      setReports(data);
    });
    return () => unsub();
  }, []);

  // Fetch users on tab switch
  useEffect(() => {
    if (activeTab === 'users') {
      fetchAllUsers().then((res) => {
        setUsers(res);
        setUsersLoaded(true);
      });
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

  const filteredUsers = useMemo(
    () => users.filter((u) => u.username.toLowerCase().includes(userSearchTerm.toLowerCase())),
    [users, userSearchTerm],
  );

  const counts = useMemo(
    () => ({
      all: reports.length,
      pending: reports.filter((r) => r.status === 'pending').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      dismissed: reports.filter((r) => r.status === 'dismissed').length,
    }),
    [reports],
  );

  const visibleReports = reportFilter === 'all' ? reports : reports.filter((r) => r.status === reportFilter);
  const bannedCount = users.filter((u) => u.isBanned).length;

  const stats = [
    {
      label: tr('چاوەڕوانکراو', 'Pending'),
      value: counts.pending,
      icon: Clock,
      color: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    },
    {
      label: tr('چارەسەرکراو', 'Resolved'),
      value: counts.resolved,
      icon: ShieldCheck,
      color: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    },
    {
      label: tr('ڕەتکراوە', 'Dismissed'),
      value: counts.dismissed,
      icon: XCircle,
      color: 'text-slate-300 bg-slate-400/10 border-slate-400/20',
    },
  ];

  const filters: { key: ReportFilter; label: string }[] = [
    { key: 'pending', label: tr('چاوەڕوانکراو', 'Pending') },
    { key: 'resolved', label: tr('چارەسەرکراو', 'Resolved') },
    { key: 'dismissed', label: tr('ڕەتکراوە', 'Dismissed') },
    { key: 'all', label: tr('هەموو', 'All') },
  ];

  const statusStyle = (status: string) =>
    status === 'pending'
      ? 'bg-amber-400/15 text-amber-300 ring-amber-400/30'
      : status === 'resolved'
      ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30'
      : 'bg-slate-500/15 text-slate-300 ring-slate-400/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-black/60"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-rose-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                {tr('ناوەندی کۆنترۆڵی ئەدمین', 'Admin Control Center')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {tr('بەخێربێیت', 'Welcome')}, {currentUser.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 px-5 pt-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`flex items-center gap-3 rounded-2xl border p-3 ${color}`}>
              <Icon className="h-5 w-5 shrink-0" />
              <div className="leading-tight">
                <div className="text-lg font-extrabold text-white">{value}</div>
                <div className="text-[10px] font-medium opacity-80">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
            {[
              { key: 'reports' as const, icon: AlertTriangle, label: tr('ڕاپۆرتەکان', 'Reports'), badge: counts.pending },
              { key: 'users' as const, icon: Users, label: tr('بەکارهێنەران', 'Users'), badge: 0 },
            ].map(({ key, icon: Icon, label, badge }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  activeTab === key
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {activeTab === 'reports' ? (
            <>
              <div className="flex flex-wrap gap-2">
                {filters.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setReportFilter(key)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      reportFilter === key
                        ? 'bg-rose-500 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {label} <span className="opacity-70">{counts[key]}</span>
                  </button>
                ))}
              </div>

              {visibleReports.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                    <Inbox className="h-7 w-7 text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">{tr('هیچ ڕاپۆرتێک نییە', 'Nothing here')}</h4>
                  <p className="text-xs text-slate-400">{tr('هەموو شتێک چارەسەر کراوە', 'All caught up.')}</p>
                </div>
              ) : (
                <AnimatePresence>
                  {visibleReports.map((report) => (
                    <motion.div
                      key={report.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                            {report.targetType}
                          </span>
                          <h4 className="mt-0.5 break-words text-sm font-bold text-white">{report.reason}</h4>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${statusStyle(report.status)}`}
                          >
                            {report.status}
                          </span>
                          <button
                            onClick={() => handleDelete(report.id)}
                            aria-label="Delete report"
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {report.details && (
                        <p className="rounded-xl bg-black/30 p-3 text-xs leading-relaxed text-slate-300">
                          &quot;{report.details}&quot;
                        </p>
                      )}

                      <div className="flex flex-wrap justify-between gap-1 text-[11px] text-slate-500">
                        <span>
                          {tr('ڕاپۆرتکەر', 'Reporter')}: {report.reporterName || report.reporterUid}
                        </span>
                        <span className="truncate">ID: {report.targetId}</span>
                      </div>

                      {report.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleResolve(report.id, 'resolved')}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white transition hover:bg-emerald-400"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {tr('چارەسەر', 'Resolve')}
                          </button>
                          <button
                            onClick={() => handleResolve(report.id, 'dismissed')}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                          >
                            <XCircle className="h-4 w-4" />
                            {tr('ڕەتکردنەوە', 'Dismiss')}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </>
          ) : (
            <>
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder={tr('گەڕان بەدوای بەکارهێنەر...', 'Search users...')}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/60"
                />
              </div>

              {usersLoaded && (
                <p className="text-[11px] text-slate-500">
                  {filteredUsers.length} {tr('بەکارهێنەر', 'users')} · {bannedCount} {tr('باندکراو', 'banned')}
                </p>
              )}

              {filteredUsers.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-bold text-white">
                      {u.avatar || u.profileImage ? (
                        <img src={u.avatar || u.profileImage} alt={u.username} className="h-full w-full object-cover" />
                      ) : (
                        u.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="truncate text-sm font-bold text-white">{u.username}</h4>
                        {u.isBanned && (
                          <span className="rounded-full bg-rose-500/20 px-2 text-[9px] font-bold uppercase text-rose-300">
                            {tr('باند', 'Banned')}
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Lv {u.level || 1}</span>
                        <span className="flex items-center gap-0.5">
                          <Coins className="h-3 w-3 text-amber-300" />
                          {u.coins?.toLocaleString() || 0}
                        </span>
                      </p>
                      {u.deviceInfo && (
                        <p className="flex max-w-[200px] items-center gap-1 truncate text-[10px] text-cyan-300/80">
                          <Smartphone className="h-3 w-3 shrink-0" />
                          {u.deviceInfo.deviceModel} ({u.deviceInfo.os})
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBanToggle(u)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      u.isBanned
                        ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                    }`}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span>{u.isBanned ? tr('لابردنی باند', 'Unban') : tr('باندکردن', 'Ban')}</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
