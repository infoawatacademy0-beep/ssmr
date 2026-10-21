import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '../types';
import {
  registerUser,
  loginUser,
  logoutUser,
  onAuthChange,
  subscribeToUserProfile,
  initUserPresence,
} from '../services';
import { syncCurrentUserLocation } from '../services/locationService';

/* ──────────────────────────────────────────────
   Auth Context — provides authentication state &
   actions to the entire component tree with live
   coin & XP synchronization.
   ────────────────────────────────────────────── */

interface AuthState {
  /** The authenticated user profile (null while loading or if signed out). */
  user: User | null;
  /** True while the initial auth state is being resolved. */
  loading: boolean;
  /** Register → create Firebase Auth + DB profile. */
  register: (email: string, password: string, username: string, locationData?: any) => Promise<void>;
  /** Login → sign in + fetch profile. */
  login: (email: string, password: string, locationData?: any) => Promise<void>;
  /** Logout → sign out + mark offline. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function normalizeUserProfile(
  rawUser: Partial<User> | null,
  fbUser?: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null } | null,
): User | null {
  if (!rawUser && !fbUser) return null;
  const username =
    rawUser?.username ||
    (rawUser as any)?.displayName ||
    fbUser?.displayName ||
    rawUser?.email?.split('@')[0] ||
    fbUser?.email?.split('@')[0] ||
    'User';

  return {
    giftsReceived: [],
    lastSeen: Date.now(),
    isOnline: true,
    ...rawUser,
    uid: rawUser?.uid || fbUser?.uid || '',
    email: rawUser?.email || fbUser?.email || '',
    username,
    coins: typeof rawUser?.coins === 'number' ? rawUser.coins : 0,
    level: typeof rawUser?.level === 'number' ? rawUser.level : 1,
    xp: typeof rawUser?.xp === 'number' ? rawUser.xp : 0,
    createdAt: rawUser?.createdAt || Date.now(),
    avatar: rawUser?.avatar || (rawUser as any)?.profileImage || fbUser?.photoURL || '',
    badges: Array.isArray(rawUser?.badges) ? rawUser.badges : [],
    isAdmin: Boolean(rawUser?.isAdmin),
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* Listen for Firebase Auth state changes and sync profile in real-time. */
  useEffect(() => {
    let userUnsub: (() => void) | null = null;

    const authUnsub = onAuthChange((firebaseUser) => {
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (firebaseUser) {
        userUnsub = subscribeToUserProfile(firebaseUser.uid, (profile) => {
          if (!profile) {
            // Profile does not exist yet in RTDB; synthesize from Auth user
            const fallbackProfile: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              coins: 0,
              level: 1,
              xp: 0,
              createdAt: Date.now(),
              avatar: firebaseUser.photoURL || '',
              badges: [],
              giftsReceived: [],
              isOnline: true,
              lastSeen: Date.now(),
            };
            setUser(fallbackProfile);
          } else {
            setUser(normalizeUserProfile(profile, firebaseUser));
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (userUnsub) userUnsub();
    };
  }, []);

  /* Sync real-time online/offline presence lifecycle */
  useEffect(() => {
    if (!user?.uid) return;
    const cleanupPresence = initUserPresence(user.uid);
    return () => {
      cleanupPresence();
    };
  }, [user?.uid]);

  /* Sync real-time location telemetry */
  useEffect(() => {
    if (!user?.uid) return;
    syncCurrentUserLocation(user.uid).catch(console.error);
  }, [user?.uid]);

  const register = useCallback(
    async (email: string, password: string, username: string, locationData?: any) => {
      const profile = await registerUser(email, password, username, locationData);
      setUser(normalizeUserProfile(profile));
    },
    [],
  );

  const login = useCallback(async (email: string, password: string, locationData?: any) => {
    const profile = await loginUser(email, password, locationData);
    setUser(normalizeUserProfile(profile));
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context anywhere in the tree.
 * Throws if used outside `<AuthProvider>`.
 */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}
