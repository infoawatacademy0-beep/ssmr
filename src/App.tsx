import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Ban, LogOut, Clock, AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts';
import LoadingScreen from './components/LoadingScreen';
import Auth from './components/Auth';
import { checkUserBanStatus } from './services';
import type { User } from './types';

/* ──────────────────────────────────────────────
   Error Boundary to prevent blank/white screen
   ────────────────────────────────────────────── */
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-base font-bold text-white mb-2">کێشەیەک ڕوویدا</h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {this.state.error?.message || 'هەڵەیەکی چاوەڕواننەکراو لە بەرنامەکەدا ڕوویدا.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
              className="rounded-2xl bg-violet-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500 active:scale-95"
            >
              دووبارە بارکردنەوە
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ──────────────────────────────────────────────
   Lazy-Loaded Heavy Screens & Game Layouts
   Prevents blocking the main thread and avoids
   downloading heavy audio/game chunks on initial landing.
   ────────────────────────────────────────────── */
const Dashboard = lazy(() => import('./components/Dashboard'));
const VoiceRoom = lazy(() => import('./components/VoiceRoom'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const LudoGamePanel = lazy(() => import('./components/LudoGamePanel'));

/* ──────────────────────────────────────────────
   App Root — wraps everything in providers and
   handles auth-based routing with Ban Middleware.
   ────────────────────────────────────────────── */

function BannedNoticeScreen({
  reason,
  isPermanent,
  remainingHours,
  onLogout,
}: {
  reason: string;
  isPermanent: boolean;
  remainingHours?: number;
  onLogout: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-5">
          <Ban className="h-8 w-8" />
        </div>

        <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-rose-300 border border-rose-500/30">
          {isPermanent ? 'هەژمار ڕاگیرا' : 'ڕاگرتنی کاتی'}
        </span>

        <h1 className="mt-3 font-display text-lg font-black text-white uppercase tracking-wider">
          ڕێگەپێدراو نییە
        </h1>

        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
          {reason}
        </p>

        {!isPermanent && remainingHours && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-300">
            <Clock className="h-4 w-4" />
            <span>ماوەی ماوە: نزیکەی {remainingHours} کاتژمێر</span>
          </div>
        )}

        <div className="mt-6 border-t border-slate-800 pt-5">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3 text-xs font-bold text-white transition hover:bg-slate-700 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span>چوونەدەرەوە لە هەژمار</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // Ban Check Middleware
  if (user) {
    const banStatus = checkUserBanStatus(user);
    if (banStatus.isBlocked) {
      return (
        <BannedNoticeScreen
          reason={banStatus.reason}
          isPermanent={banStatus.isPermanent}
          remainingHours={banStatus.remainingHours}
          onLogout={logout}
        />
      );
    }
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route
          path="/auth"
          element={user ? <Navigate to="/" replace /> : <Auth />}
        />
        <Route
          path="/"
          element={user ? <Dashboard /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/room/:roomId"
          element={user ? <VoiceRoom /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/maznmahdi"
          element={
            <AdminPanel
              currentUser={
                (user || {
                  uid: 'maznmahdi',
                  username: 'Mazn Mahdi',
                  email: 'maznmahdi@system.local',
                  isAdmin: true,
                  coins: 999999,
                  level: 99,
                  xp: 999999,
                  createdAt: Date.now(),
                  avatar: '',
                  badges: [],
                  giftsReceived: [],
                  isOnline: true,
                  lastSeen: Date.now(),
                }) as User
              }
              onClose={() => {
                window.location.href = '/';
              }}
            />
          }
        />
        <Route
          path="/game/ludo"
          element={
            user ? (
              <LudoGamePanel
                roomId="lobby"
                currentUser={user}
                activeLudoGame={null}
                seats={[]}
                onClose={() => window.history.back()}
              />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        {/* Catch-all → redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
