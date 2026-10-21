import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  BadgeCheck,
  Ban,
  Clock,
  Search,
  Users,
  Coins,
  Palette,
  CheckCircle,
  XCircle,
  Trash2,
  X,
  Sparkles,
  Lock,
  Unlock,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  RefreshCw,
  Image as ImageIcon,
  MapPin,
  Globe,
  Eye,
  EyeOff,
  Map,
  Navigation,
  Crosshair,
  LocateFixed,
  Copy,
  Crown,
} from 'lucide-react';
import type { User, ReportItem } from '../types';
import {
  fetchAllUsers,
  subscribeToAllReports,
  resolveReport,
  deleteReport,
  permanentBanUser,
  tempBanUser,
  unbanUserAccount,
  toggleVerificationBadge,
  assignPremiumCosmetics,
  modifyUserCoins,
  checkUserBanStatus,
} from '../services';

interface AnimatedCoverPreset {
  id: string;
  name: string;
  badge: string;
  backgroundCss: string;
}

const ANIMATED_COVER_PRESETS: AnimatedCoverPreset[] = [
  {
    id: 'gold_luxury',
    name: '24K Royal Gold VIP',
    badge: '👑 Gold VIP',
    backgroundCss:
      'linear-gradient(-45deg, #78350f 0%, #b45309 25%, #fef08a 50%, #d97706 75%, #451a03 100%)',
  },
  {
    id: 'diamond_aurora',
    name: 'Diamond VIP Elite Aurora',
    badge: '💎 Diamond VIP',
    backgroundCss:
      'linear-gradient(-45deg, #0f172a 0%, #0369a1 25%, #38bdf8 50%, #818cf8 75%, #0c4a6e 100%)',
  },
  {
    id: 'phoenix_fire',
    name: 'Inferno Phoenix Flame VIP',
    badge: '🔥 Phoenix VIP',
    backgroundCss:
      'linear-gradient(-45deg, #450a0a 0%, #991b1b 25%, #ea580c 50%, #f59e0b 75%, #7f1d1d 100%)',
  },
  {
    id: 'cosmic_galaxy',
    name: 'Cosmic Nebula VIP Galaxy',
    badge: '🌌 Galaxy VIP',
    backgroundCss:
      'linear-gradient(-45deg, #09090b 0%, #3b0764 25%, #7e22ce 50%, #06b6d4 75%, #1e1b4b 100%)',
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon Matrix VIP',
    badge: '⚡ Matrix VIP',
    backgroundCss:
      'linear-gradient(-45deg, #022c22 0%, #059669 25%, #10b981 50%, #06b6d4 75%, #042f2e 100%)',
  },
  {
    id: 'sakura_blossom',
    name: 'Royal Sakura Petal VIP',
    badge: '🌸 Sakura VIP',
    backgroundCss:
      'linear-gradient(-45deg, #500724 0%, #9d174d 25%, #f43f5e 50%, #f472b6 75%, #831843 100%)',
  },
  {
    id: 'dark_obsidian',
    name: 'Dark Obsidian Luxury Gold',
    badge: '🖤 Obsidian VIP',
    backgroundCss:
      'linear-gradient(-45deg, #000000 0%, #18181b 30%, #fbbf24 50%, #27272a 70%, #09090b 100%)',
  },
];

interface AdminPanelProps {
  currentUser: User;
  onClose: () => void;
  onOpenProfile?: (uid: string) => void;
}

function formatAccountAge(createdAt: number): string {
  if (!createdAt) return 'Unknown';
  const diffMs = Date.now() - createdAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Joined today';
  if (diffDays === 1) return 'Joined 1 day ago';
  if (diffDays < 30) return `Joined ${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'Joined 1 month ago';
  if (diffMonths < 12) return `Joined ${diffMonths} months ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `Joined ${diffYears} year(s) ago`;
}

function formatReportTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getMapEmbedUrl(lat?: number, lng?: number, queryText?: string, zoom = 15): string {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=${zoom}&output=embed`;
  }
  if (queryText) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(queryText)}&hl=en&z=${zoom}&output=embed`;
  }
  return '';
}

export default function AdminPanel({
  currentUser,
  onClose,
  onOpenProfile,
}: AdminPanelProps) {
  // Independent / Open access for administrators (Clearance requirement removed as requested)

  // Active Tab: 'users' | 'map' | 'reports' | 'analytics'
  const [activeTab, setActiveTab] = useState<'users' | 'map' | 'reports' | 'analytics'>('users');

  // Password visibility map for admin
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const togglePasswordVisibility = (uid: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  // Map Modal & Radar State
  const [mapModalUser, setMapModalUser] = useState<User | null>(null);
  const [selectedRadarUser, setSelectedRadarUser] = useState<User | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [mapZoom, setMapZoom] = useState<number>(15);

  // User Directory State
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [filterFilter, setFilterFilter] = useState<'all' | 'verified' | 'banned'>('all');
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Reports State
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  // Temporary Ban Modal State
  const [tempBanTarget, setTempBanTarget] = useState<User | null>(null);
  const [tempBanDuration, setTempBanDuration] = useState<number>(24);
  const [tempBanReason, setTempBanReason] = useState<string>('Violation of community guidelines');
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  // Premium Cosmetics Modal State
  const [cosmeticsTarget, setCosmeticsTarget] = useState<User | null>(null);
  const [coverInput, setCoverInput] = useState('');
  const [bgInput, setBgInput] = useState('');
  const [isSavingCosmetics, setIsSavingCosmetics] = useState(false);

  // Coin Adjustment Modal State
  const [coinsTarget, setCoinsTarget] = useState<User | null>(null);
  const [newCoinsValue, setNewCoinsValue] = useState<number>(0);
  const [isSavingCoins, setIsSavingCoins] = useState(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load Users
  const loadUsersList = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load user directory:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsersList();
  }, []);

  // Subscribe to live reports
  useEffect(() => {
    const unsub = subscribeToAllReports((data) => {
      setReports(data);
    });
    return () => unsub();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.uid.toLowerCase().includes(userSearchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterFilter === 'verified') return Boolean(u.isVerified);
      if (filterFilter === 'banned') return Boolean(checkUserBanStatus(u).isBlocked);

      return true;
    });
  }, [users, userSearchTerm, filterFilter]);

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (reportFilter === 'pending') return r.status === 'pending';
      if (reportFilter === 'resolved') return r.status === 'resolved' || r.status === 'dismissed';
      return true;
    });
  }, [reports, reportFilter]);

  // Users with captured telemetry locations
  const usersWithLocation = useMemo(() => {
    return users.filter((u) => u.location && (u.location.latitude || u.location.city || u.location.ip));
  }, [users]);

  // 1. Permanent Ban Handler
  const handlePermanentBan = async (userToBan: User) => {
    const confirmed = window.confirm(
      `PERMANENT BAN WARNING:\n\nAre you sure you want to permanently terminate access for user "${userToBan.username}" (${userToBan.uid})?\n\nThis will terminate their session and permanently lock their account.`,
    );
    if (!confirmed) return;

    try {
      await permanentBanUser(userToBan.uid, 'Lifetime suspension issued by Administrator.');
      showToast(`User ${userToBan.username} permanently banned.`);
      await loadUsersList();
    } catch (err: any) {
      alert(err.message || 'Failed to ban user.');
    }
  };

  // 2. Temporary Ban Execution
  const handleExecuteTempBan = async () => {
    if (!tempBanTarget) return;
    setIsSubmittingBan(true);
    try {
      await tempBanUser(
        tempBanTarget.uid,
        tempBanDuration,
        tempBanReason.trim() || 'Temporary suspension issued by Administration.',
      );
      showToast(`User ${tempBanTarget.username} suspended for ${tempBanDuration} hours.`);
      setTempBanTarget(null);
      await loadUsersList();
    } catch (err: any) {
      alert(err.message || 'Failed to apply temporary ban.');
    } finally {
      setIsSubmittingBan(false);
    }
  };

  // 3. Unban User Handler
  const handleUnban = async (userToUnban: User) => {
    try {
      await unbanUserAccount(userToUnban.uid);
      showToast(`Suspension removed for user ${userToUnban.username}.`);
      await loadUsersList();
    } catch (err: any) {
      alert(err.message || 'Failed to lift ban.');
    }
  };

  // 4. Verification Badge Toggle
  const handleToggleVerification = async (targetUser: User) => {
    const nextStatus = !targetUser.isVerified;
    try {
      await toggleVerificationBadge(targetUser.uid, nextStatus);
      // Automatically assign Royal Gold VIP Animated Cover if user gets VIP and doesn't have one
      if (nextStatus && !targetUser.profileCover) {
        const defaultVipCover = ANIMATED_COVER_PRESETS[0].backgroundCss;
        await assignPremiumCosmetics(targetUser.uid, defaultVipCover, defaultVipCover);
      }
      showToast(
        nextStatus
          ? `VIP Royale status & Animated Cover granted to ${targetUser.username}!`
          : `VIP status revoked from ${targetUser.username}.`,
      );
      await loadUsersList();
    } catch (err: any) {
      alert(err.message || 'Failed to update verification badge.');
    }
  };

  // 5. Save Custom Cosmetics
  const handleSaveCosmetics = async () => {
    if (!cosmeticsTarget) return;
    setIsSavingCosmetics(true);
    try {
      await assignPremiumCosmetics(cosmeticsTarget.uid, coverInput, bgInput);
      showToast(`Custom room & profile themes updated for ${cosmeticsTarget.username}.`);
      setCosmeticsTarget(null);
      await loadUsersList();
    } catch (err: any) {
      alert(err.message || 'Failed to assign custom cosmetics.');
    } finally {
      setIsSavingCosmetics(false);
    }
  };

  // 6. Save Coins Adjustment
  const handleSaveCoins = async () => {
    if (!coinsTarget) return;
    setIsSavingCoins(true);
    try {
      await modifyUserCoins(coinsTarget.uid, newCoinsValue);
      showToast(`Wallet balance adjusted for ${coinsTarget.username} to ${newCoinsValue.toLocaleString()} Coins.`);
      setCoinsTarget(null);
      await loadUsersList();
    } catch (err: any) {
      alert(err.message || 'Failed to update coins.');
    } finally {
      setIsSavingCoins(false);
    }
  };

  // 7. Resolve Report
  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await resolveReport(reportId, status, `Reviewed and settled by ${currentUser.username}`);
      showToast(`Report marked as ${status}.`);
    } catch (err: any) {
      alert(err.message || 'Failed to update report.');
    }
  };

  // 8. Delete Report
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Delete this report record permanently?')) return;
    try {
      await deleteReport(reportId);
      showToast('Report record permanently deleted.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete report.');
    }
  };

  // Analytics Metrics
  const totalUsersCount = users.length;
  const verifiedCount = users.filter((u) => u.isVerified).length;
  const bannedCount = users.filter((u) => checkUserBanStatus(u).isBlocked).length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-rose-500/30 bg-slate-950 shadow-2xl text-slate-100"
      >
        {/* Toast Alert */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-bold text-emerald-300 shadow-xl backdrop-blur-md"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR HEADER ── */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/60 p-4 sm:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-black tracking-wider text-white uppercase sm:text-base">
                  Live Management &amp; Radar Console
                </h2>
                <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-300 border border-rose-500/30 uppercase">
                  Open Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Real-Time User Directory, GPS Telemetry, Moderation &amp; Vaults
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadUsersList}
              disabled={isLoadingUsers}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:border-slate-700 transition"
              title="Refresh User & Telemetry Cache"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingUsers ? 'animate-spin text-rose-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* ── METRIC BANNER ROW ── */}
        <section className="grid grid-cols-2 gap-3 border-b border-slate-800/80 bg-slate-950/60 p-4 sm:grid-cols-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Registered Users</span>
              <p className="font-mono text-base font-black text-white">{totalUsersCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Located Members</span>
              <p className="font-mono text-base font-black text-emerald-300">{usersWithLocation.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <BadgeCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Verified VIPs</span>
              <p className="font-mono text-base font-black text-sky-300">{verifiedCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <Ban className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Active Bans</span>
              <p className="font-mono text-base font-black text-rose-300">{bannedCount}</p>
            </div>
          </div>
        </section>

        {/* ── TAB NAVIGATION BAR ── */}
        <nav className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/30 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'users'
                  ? 'border border-rose-400/40 bg-rose-500/15 text-rose-200 shadow-md shadow-rose-500/10'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>User Directory &amp; Assets</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'map'
                  ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-md shadow-emerald-500/15'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Map className="h-4 w-4 text-emerald-400" />
              <span>Live Radar &amp; Map ({usersWithLocation.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === 'reports'
                  ? 'border border-rose-400/40 bg-rose-500/15 text-rose-200 shadow-md shadow-rose-500/10'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Global Reports Feed ({pendingReportsCount})</span>
            </button>
          </div>
        </nav>

        {/* ── TAB 1: LIVE USER DIRECTORY & ASSET MANAGER ── */}
        {activeTab === 'users' && (
          <div className="flex flex-1 flex-col overflow-hidden p-4 sm:px-6 space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Search by username, email, or UID..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Filter:</span>
                {[
                  { id: 'all', label: 'All Users' },
                  { id: 'verified', label: 'Verified VIPs' },
                  { id: 'banned', label: 'Banned' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilterFilter(item.id as any)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      filterFilter === item.id
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User Directory Table Canvas */}
            <div className="flex-1 overflow-x-auto overflow-y-auto rounded-3xl border border-slate-800/80 bg-slate-900/40">
              {isLoadingUsers ? (
                <div className="flex h-64 items-center justify-center text-xs text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin text-rose-400 mr-2" />
                  Loading accounts &amp; live telemetry...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center text-slate-500">
                  <Users className="h-8 w-8 text-slate-700 mb-2" />
                  <h4 className="text-xs font-bold text-slate-300">No Users Match Query</h4>
                  <p className="mt-1 text-[11px] text-slate-500">Try adjusting your search or filter criteria.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="p-3.5 pl-4">User Identity</th>
                      <th className="p-3.5">Email &amp; Password</th>
                      <th className="p-3.5">Real Location</th>
                      <th className="p-3.5">Account Age</th>
                      <th className="p-3.5">Vault &amp; Tier</th>
                      <th className="p-3.5">Status &amp; Verification</th>
                      <th className="p-3.5 pr-4 text-right">Administrative Execution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((targetUser) => {
                      const banStatus = checkUserBanStatus(targetUser);
                      const isTargetAdmin = Boolean(targetUser.isAdmin);

                      return (
                        <tr
                          key={targetUser.uid}
                          className="transition hover:bg-slate-900/60"
                        >
                          {/* User Identity */}
                          <td className="p-3.5 pl-4">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => onOpenProfile?.(targetUser.uid)}
                                className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-xs font-black text-white shadow cursor-pointer hover:ring-2 hover:ring-rose-400 transition"
                              >
                                {targetUser.avatar || targetUser.profileImage ? (
                                  <img
                                    src={targetUser.avatar || targetUser.profileImage}
                                    alt={targetUser.username}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  targetUser.username.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    onClick={() => onOpenProfile?.(targetUser.uid)}
                                    className="font-bold text-white truncate max-w-[140px] cursor-pointer hover:underline"
                                  >
                                    {targetUser.username}
                                  </span>
                                  {targetUser.isVerified && (
                                    <span
                                      title="Verified VIP Royale Member"
                                      className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-black text-amber-300 shrink-0"
                                    >
                                      <Crown className="h-2.5 w-2.5 text-amber-400 fill-amber-400" />
                                      <span>VIP</span>
                                    </span>
                                  )}
                                  {isTargetAdmin && (
                                    <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[8px] font-bold text-rose-300 uppercase">
                                      Admin
                                    </span>
                                  )}
                                </div>
                                <span className="block font-mono text-[10px] text-slate-500 truncate max-w-[160px]">
                                  {targetUser.uid}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Email & Password */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="space-y-1">
                              <span
                                className="block font-mono text-[11px] text-slate-200 font-semibold truncate max-w-[170px]"
                                title={targetUser.email}
                              >
                                {targetUser.email || 'No email registered'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                                  {showPasswordMap[targetUser.uid]
                                    ? targetUser.accountPassword || '(Not captured)'
                                    : '••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(targetUser.uid)}
                                  className="text-slate-400 hover:text-white p-0.5 rounded transition"
                                  title={showPasswordMap[targetUser.uid] ? 'Hide password' : 'Show password'}
                                >
                                  {showPasswordMap[targetUser.uid] ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Real Location & Telemetry */}
                          <td className="p-3.5 whitespace-nowrap">
                            {targetUser.location ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                                  <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate max-w-[150px]">
                                    {targetUser.location.city ? `${targetUser.location.city}, ` : ''}
                                    {targetUser.location.country || targetUser.location.countryCode || 'Detected'}
                                  </span>
                                  {targetUser.location.isGps && (
                                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[8px] font-black text-emerald-300 uppercase">
                                      GPS
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                  {targetUser.location.ip && <span>IP: {targetUser.location.ip}</span>}
                                  {targetUser.location.latitude && targetUser.location.longitude && (
                                    <span className="text-slate-500">
                                      ({targetUser.location.latitude.toFixed(4)}, {targetUser.location.longitude.toFixed(4)})
                                    </span>
                                  )}
                                </div>
                                {(targetUser.location.latitude && targetUser.location.longitude) || targetUser.location.city ? (
                                  <button
                                    type="button"
                                    onClick={() => setMapModalUser(targetUser)}
                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95"
                                  >
                                    <Map className="h-3 w-3" />
                                    <span>View on Map</span>
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                <Globe className="h-3.5 w-3.5 text-slate-600" />
                                <span>Location pending</span>
                              </div>
                            )}
                          </td>

                          {/* Account Age */}
                          <td className="p-3.5 text-slate-400 font-medium whitespace-nowrap">
                            {formatAccountAge(targetUser.createdAt)}
                          </td>

                          {/* Vault & Tier */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 font-mono font-bold text-amber-300">
                                <Coins className="h-3.5 w-3.5 text-amber-400" />
                                <span>{(targetUser.coins || 0).toLocaleString()}</span>
                              </div>
                              <span className="text-[10px] text-purple-300 font-medium">
                                Level {targetUser.level || 1} &bull; {(targetUser.xp || 0).toLocaleString()} XP
                              </span>
                            </div>
                          </td>

                          {/* Status & Verification */}
                          <td className="p-3.5 whitespace-nowrap">
                            {banStatus.isBlocked ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                                  <Ban className="h-3 w-3" />
                                  <span>{banStatus.isPermanent ? 'Permanent Ban' : 'Timed Suspension'}</span>
                                </span>
                                {!banStatus.isPermanent && banStatus.remainingHours && (
                                  <p className="text-[9px] text-rose-400 font-medium">
                                    Expires in {banStatus.remainingHours}h
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                                <CheckCircle className="h-3 w-3" />
                                <span>Active Citizen</span>
                              </span>
                            )}
                          </td>

                          {/* Administrative Execution */}
                          <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* VIP Royale & Badge Toggle */}
                              <button
                                onClick={() => handleToggleVerification(targetUser)}
                                title={targetUser.isVerified ? 'Revoke VIP Status & Blue Tick' : 'Grant VIP Royale Status & Animated Cover'}
                                className={`rounded-xl p-2 transition flex items-center gap-1 ${
                                  targetUser.isVerified
                                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                                    : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                                }`}
                              >
                                <Crown className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                                <BadgeCheck className="h-3.5 w-3.5 text-sky-400" />
                              </button>

                              {/* Custom Profile & Room Themes */}
                              <button
                                onClick={() => {
                                  setCosmeticsTarget(targetUser);
                                  setCoverInput(targetUser.profileCover || '');
                                  setBgInput(targetUser.roomBackground || '');
                                }}
                                title="Assign Bespoke Themes & Backgrounds"
                                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-300 transition"
                              >
                                <Palette className="h-3.5 w-3.5" />
                              </button>

                              {/* Coin Balance Modifier */}
                              <button
                                onClick={() => {
                                  setCoinsTarget(targetUser);
                                  setNewCoinsValue(targetUser.coins || 0);
                                }}
                                title="Adjust Coin Reserves"
                                className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300 transition"
                              >
                                <Coins className="h-3.5 w-3.5" />
                              </button>

                              {/* Ban Controls */}
                              {banStatus.isBlocked ? (
                                <button
                                  onClick={() => handleUnban(targetUser)}
                                  className="flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow hover:bg-emerald-500 transition"
                                >
                                  <Unlock className="h-3.5 w-3.5" />
                                  <span>Unban</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setTempBanTarget(targetUser);
                                      setTempBanDuration(24);
                                    }}
                                    title="Timed Temporary Suspension"
                                    className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>Temp Ban</span>
                                  </button>

                                  <button
                                    onClick={() => handlePermanentBan(targetUser)}
                                    title="Permanent Lifetime Ban"
                                    className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 hover:bg-rose-500/20 transition"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                    <span>Lifetime</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: LIVE RADAR & INTERACTIVE WORLD MAP ── */}
        {activeTab === 'map' && (
          <div className="flex flex-1 flex-col sm:flex-row overflow-hidden">
            {/* Left sidebar: Directory of users with location */}
            <div className="w-full sm:w-80 border-r border-slate-800/80 bg-slate-950/60 flex flex-col shrink-0">
              <div className="p-3 border-b border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <LocateFixed className="h-4 w-4 text-emerald-400" />
                    <span>Located Members ({usersWithLocation.length})</span>
                  </div>
                  <button
                    onClick={() => loadUsersList()}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Refresh telemetry"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Search located users..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {usersWithLocation.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-400" />
                    No member locations recorded yet.<br />Locations sync in real time as members enter.
                  </div>
                ) : (
                  usersWithLocation
                    .filter(
                      (u) =>
                        u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                        u.location?.city?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                        u.location?.country?.toLowerCase().includes(userSearchTerm.toLowerCase()),
                    )
                    .map((locatedUser) => {
                      const isSelected =
                        selectedRadarUser?.uid === locatedUser.uid ||
                        (!selectedRadarUser && locatedUser.uid === usersWithLocation[0]?.uid);
                      const loc = locatedUser.location!;

                      return (
                        <div
                          key={locatedUser.uid}
                          onClick={() => setSelectedRadarUser(locatedUser)}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border cursor-pointer transition ${
                            isSelected
                              ? 'border-emerald-500/50 bg-emerald-500/15 shadow-md shadow-emerald-500/10'
                              : 'border-slate-800/60 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-xs font-bold text-white overflow-hidden">
                              {locatedUser.avatar ? (
                                <img src={locatedUser.avatar} alt={locatedUser.username} className="h-full w-full object-cover" />
                              ) : (
                                locatedUser.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="truncate text-xs font-bold text-white">{locatedUser.username}</span>
                                {loc.isGps && (
                                  <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[8px] font-black text-emerald-300">
                                    GPS
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-[10px] text-emerald-300 font-medium">
                                {loc.city ? `${loc.city}, ` : ''}{loc.country || 'Detected'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 transition ${
                              isSelected ? 'text-emerald-400 rotate-90 sm:rotate-0' : 'text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Right side: Live Map Canvas */}
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
              {(() => {
                const target = selectedRadarUser || usersWithLocation[0];
                if (!target || !target.location) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <Map className="h-12 w-12 text-slate-700 mb-3 animate-pulse" />
                      <p className="text-sm font-bold text-slate-400">Select a user to display their live map</p>
                      <p className="text-xs text-slate-600 mt-1">Real-time GPS coordinates and city details will render here.</p>
                    </div>
                  );
                }

                const loc = target.location;
                const embedUrl = getMapEmbedUrl(
                  loc.latitude,
                  loc.longitude,
                  loc.city ? `${loc.city}, ${loc.country}` : loc.country,
                  mapZoom,
                );

                return (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Top Radar Bar */}
                    <div className="p-3 sm:px-5 border-b border-slate-800/80 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-white">{target.username}</h3>
                            {loc.isGps ? (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                                Exact GPS Sensor {loc.accuracy ? `(±${loc.accuracy}m)` : ''}
                              </span>
                            ) : (
                              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold text-sky-300 border border-sky-500/30">
                                IP Geolocation Cell
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 font-medium">
                            {loc.address || `${loc.city ? loc.city + ', ' : ''}${loc.country || 'Detected Region'}`}
                          </p>
                        </div>
                      </div>

                      {/* Coordinates & Quick Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {loc.latitude && loc.longitude && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${loc.latitude}, ${loc.longitude}`);
                              setCopiedCoords(true);
                              setTimeout(() => setCopiedCoords(false), 2000);
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:text-white transition"
                            title="Copy Coordinates"
                          >
                            <Copy className="h-3 w-3" />
                            <span>
                              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                            </span>
                            {copiedCoords && <Check className="h-3 w-3 text-emerald-400" />}
                          </button>
                        )}

                        {loc.latitude && loc.longitude && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:scale-[1.02] active:scale-95"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Google Maps</span>
                          </a>
                        )}

                        <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-0.5 border border-slate-700">
                          <button
                            type="button"
                            onClick={() => setMapZoom((z) => Math.min(19, z + 2))}
                            className="px-2 py-1 text-xs font-bold text-slate-300 hover:text-white"
                            title="Zoom In"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapZoom((z) => Math.max(5, z - 2))}
                            className="px-2 py-1 text-xs font-bold text-slate-300 hover:text-white"
                            title="Zoom Out"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Embedded Map Iframe */}
                    <div className="flex-1 relative w-full h-full bg-slate-900 min-h-[350px]">
                      {embedUrl ? (
                        <iframe
                          key={`${loc.latitude}-${loc.longitude}-${mapZoom}`}
                          src={embedUrl}
                          title={`Live Map of ${target.username}`}
                          className="w-full h-full border-0 filter contrast-[1.05]"
                          loading="lazy"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                          Map coordinates not available for this user.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── TAB 3: GLOBAL SYSTEM REPORTS FEED ── */}
        {activeTab === 'reports' && (
          <div className="flex flex-1 flex-col overflow-hidden p-4 sm:px-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <h3 className="font-display text-xs font-bold text-white uppercase tracking-wider">
                  Active Moderation Reports ({filteredReports.length})
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Incidents' },
                  { id: 'pending', label: 'Pending Action' },
                  { id: 'resolved', label: 'Resolved / Dismissed' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setReportFilter(item.id as any)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      reportFilter === item.id
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredReports.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-center text-slate-500">
                  <CheckCircle className="h-8 w-8 text-emerald-500/40 mb-2" />
                  <h4 className="text-xs font-bold text-slate-300">No Reports Pending</h4>
                  <p className="mt-1 text-[11px] text-slate-500">All member disputes have been settled.</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          Report against <strong>{report.targetUsername || report.targetUserId}</strong>
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            report.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : report.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {report.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">"{report.reason}"</p>
                      <p className="text-[10px] text-slate-500">
                        Filed by {report.reporterUsername} &bull; {formatReportTime(report.timestamp)}
                        {report.roomId && ` in Room ${report.roomId}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {report.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleResolveReport(report.id, 'resolved')}
                            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Resolve</span>
                          </button>
                          <button
                            onClick={() => handleResolveReport(report.id, 'dismissed')}
                            className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Dismiss</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20 transition"
                        title="Delete Report Permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── USER MAP MODAL ── */}
        <AnimatePresence>
          {mapModalUser && mapModalUser.location && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.93, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.93, opacity: 0 }}
                className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-emerald-500/40 bg-slate-950 shadow-2xl text-slate-100"
              >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/70 p-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white overflow-hidden shadow">
                      {mapModalUser.avatar ? (
                        <img src={mapModalUser.avatar} alt={mapModalUser.username} className="h-full w-full object-cover" />
                      ) : (
                        mapModalUser.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-black text-white">{mapModalUser.username}</h3>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/30">
                          {mapModalUser.location.isGps ? '🛰️ Live High-Accuracy GPS' : '🌐 IP Network Cell'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        {mapModalUser.location.address || `${mapModalUser.location.city ? mapModalUser.location.city + ', ' : ''}${mapModalUser.location.country || 'Detected Region'}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMapModalUser(null)}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Map Canvas */}
                <div className="flex-1 relative w-full bg-slate-900">
                  <iframe
                    src={getMapEmbedUrl(
                      mapModalUser.location.latitude,
                      mapModalUser.location.longitude,
                      mapModalUser.location.city ? `${mapModalUser.location.city}, ${mapModalUser.location.country}` : mapModalUser.location.country,
                      15,
                    )}
                    title={`Map of ${mapModalUser.username}`}
                    className="w-full h-full border-0 filter contrast-[1.05]"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>

                {/* Footer Info & Action Bar */}
                <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
                    {mapModalUser.location.latitude && mapModalUser.location.longitude && (
                      <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                        <Crosshair className="h-3.5 w-3.5 text-emerald-400" />
                        <span>
                          {mapModalUser.location.latitude.toFixed(6)}, {mapModalUser.location.longitude.toFixed(6)}
                        </span>
                      </div>
                    )}
                    {mapModalUser.location.ip && (
                      <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-400">
                        <span>IP: {mapModalUser.location.ip}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {mapModalUser.location.latitude && mapModalUser.location.longitude && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${mapModalUser.location?.latitude}, ${mapModalUser.location?.longitude}`);
                            showToast('Coordinates copied to clipboard!');
                          }}
                          className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700 active:scale-95"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Coords</span>
                        </button>

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${mapModalUser.location.latitude},${mapModalUser.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:scale-[1.02] active:scale-95"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open in Google Maps</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── MODAL A: TIMED TEMPORARY SUSPENSION ── */}
        <AnimatePresence>
          {tempBanTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                      Temporary Suspension
                    </h3>
                    <p className="text-xs text-slate-400">
                      Restricting access for <strong>{tempBanTarget.username}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Suspension Duration
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 6, 24, 72].map((hours) => (
                        <button
                          key={hours}
                          type="button"
                          onClick={() => setTempBanDuration(hours)}
                          className={`rounded-xl py-2 text-xs font-bold transition ${
                            tempBanDuration === hours
                              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                              : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {hours}h
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Official Reason
                    </label>
                    <textarea
                      rows={3}
                      value={tempBanReason}
                      onChange={(e) => setTempBanReason(e.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setTempBanTarget(null)}
                    className="flex-1 rounded-2xl border border-slate-800 py-3 text-xs font-bold text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteTempBan}
                    disabled={isSubmittingBan}
                    className="flex-1 rounded-2xl bg-amber-500 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition"
                  >
                    {isSubmittingBan ? 'Suspending...' : 'Issue Suspension'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── MODAL B: BESPOKE COSMETICS APPOINTMENT ── */}
        <AnimatePresence>
          {cosmeticsTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                className="w-full max-w-lg rounded-3xl border border-purple-500/40 bg-slate-900 p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Palette className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                      Assign Bespoke Cosmetics
                    </h3>
                    <p className="text-xs text-slate-400">
                      Curating visuals for <strong>{cosmeticsTarget.username}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Curated Animated Themes
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ANIMATED_COVER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setCoverInput(preset.backgroundCss);
                            setBgInput(preset.backgroundCss);
                          }}
                          className={`group relative flex flex-col items-start justify-end rounded-2xl border p-2.5 text-left transition overflow-hidden h-20 ${
                            coverInput === preset.backgroundCss
                              ? 'border-purple-400 ring-2 ring-purple-500/50 scale-[1.02]'
                              : 'border-slate-800 hover:border-purple-400/60 hover:scale-[1.02]'
                          }`}
                          style={{ background: preset.backgroundCss }}
                        >
                          <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-colors" />
                          <div className="relative z-10 w-full">
                            <span className="text-xs">{preset.badge}</span>
                            <span className="block text-[10px] font-bold text-white truncate drop-shadow">
                              {preset.name}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Custom Profile Cover URL / CSS
                    </label>
                    <input
                      type="text"
                      value={coverInput}
                      onChange={(e) => setCoverInput(e.target.value)}
                      placeholder="https://images.unsplash.com/... or direct image link"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                    />
                    {coverInput && (
                      <div className="mt-2 h-20 w-full overflow-hidden rounded-xl border border-slate-800">
                        {coverInput.startsWith('http') || coverInput.startsWith('data:') ? (
                          <img src={coverInput} alt="Cover Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full vip-animated-cover" style={{ background: coverInput }} />
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Custom Live Room Background Theme URL / CSS
                    </label>
                    <input
                      type="text"
                      value={bgInput}
                      onChange={(e) => setBgInput(e.target.value)}
                      placeholder="https://images.unsplash.com/... or stage backdrop link"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
                    />
                    {bgInput && (
                      <div className="mt-2 h-20 w-full overflow-hidden rounded-xl border border-slate-800">
                        {bgInput.startsWith('http') || bgInput.startsWith('data:') ? (
                          <img src={bgInput} alt="Room Theme Preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full vip-animated-cover" style={{ background: bgInput }} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setCosmeticsTarget(null)}
                    className="flex-1 rounded-2xl border border-slate-800 py-3 text-xs font-bold text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCosmetics}
                    disabled={isSavingCosmetics}
                    className="flex-1 rounded-2xl bg-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-purple-600/20 hover:bg-purple-500 transition"
                  >
                    {isSavingCosmetics ? 'Saving Themes...' : 'Save Bespoke Themes'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── MODAL C: COIN RESERVES MODIFIER ── */}
        <AnimatePresence>
          {coinsTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                className="w-full max-w-sm rounded-3xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl space-y-4 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Coins className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
                    Adjust Coin Vault
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Modifying balance for <strong>{coinsTarget.username}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 justify-center">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={newCoinsValue}
                    onChange={(e) => setNewCoinsValue(Number(e.target.value))}
                    className="w-36 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-center font-mono text-base font-bold text-amber-300 outline-none focus:border-amber-400"
                  />
                  <span className="text-xs font-bold text-slate-400">Coins</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCoinsTarget(null)}
                    className="flex-1 rounded-2xl border border-slate-800 py-3 text-xs font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCoins}
                    disabled={isSavingCoins}
                    className="flex-1 rounded-2xl bg-amber-500 py-3 text-xs font-bold text-black shadow-lg shadow-amber-500/20"
                  >
                    {isSavingCoins ? 'Saving...' : 'Set Balance'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
