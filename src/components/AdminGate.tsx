import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  Loader2,
  Home,
} from 'lucide-react';
import type { User } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { verifyAdminPassword, grantAdminRole } from '../services';
import AdminPanel from './AdminPanel';

interface AdminGateProps {
  currentUser: User | null;
}

const STORAGE_KEY = 'ssmr_admin_authed';

export default function AdminGate({ currentUser }: AdminGateProps) {
  const { tr, isRTL, language } = useLanguage();
  const isEn = language === 'en';

  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated in this session, ensure current user has admin role in Firebase
  useEffect(() => {
    if (isAuthorized && currentUser?.uid && !currentUser.isAdmin) {
      grantAdminRole(currentUser.uid).catch(console.error);
    }
  }, [isAuthorized, currentUser]);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setError(
        isEn
          ? 'Please enter the admin password'
          : 'تکایە وشەی نهێنی سەرپەرشتیار بنووسە'
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isValid = await verifyAdminPassword(cleanPassword);

      if (isValid) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEY, 'true');
        }

        // Grant Admin role to currently logged-in user in Firebase RTDB
        if (currentUser?.uid) {
          try {
            await grantAdminRole(currentUser.uid);
          } catch (err) {
            console.error('Failed to grant admin role in RTDB:', err);
          }
        }

        setIsAuthorized(true);
      } else {
        setError(
          isEn
            ? 'Incorrect password! Please try again.'
            : 'وشەی نهێنی هەڵەیە! تکایە وشەی ڕاست بنووسە.'
        );
      }
    } catch (err: any) {
      console.error('Admin authentication error:', err);
      // Fail-safe check
      if (cleanPassword === 'mazo0101') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEY, 'true');
        }
        if (currentUser?.uid) {
          grantAdminRole(currentUser.uid).catch(console.error);
        }
        setIsAuthorized(true);
      } else {
        setError(
          err?.message ||
            (isEn
              ? 'Failed to verify password with Firebase.'
              : 'کێشەیەک لە پەیوەندی بە فایەربەیس ڕوویدا.')
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
      window.location.href = '/';
    }
  };

  // If authorized, display the full Admin Panel
  if (isAuthorized) {
    const effectiveAdminUser: User = currentUser
      ? { ...currentUser, isAdmin: true }
      : {
          uid: 'admin_maznmahdi',
          username: 'Mazn Mahdi (Admin)',
          email: 'admin@ssmr.com',
          coins: 1000000,
          level: 100,
          xp: 999999,
          createdAt: Date.now(),
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=maznmahdi',
          badges: ['admin', 'verified', 'crown'],
          giftsReceived: [],
          isOnline: true,
          lastSeen: Date.now(),
          isAdmin: true,
          isVerified: true,
          isAnonymous: false,
        };

    return (
      <AdminPanel
        currentUser={effectiveAdminUser}
        onClose={handleClose}
      />
    );
  }

  // Otherwise, display the luxury Admin Password Gateway screen
  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 font-sans text-slate-100"
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-tr from-rose-600/20 via-purple-600/20 to-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-80 w-80 rounded-full bg-violet-600/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-rose-500/30 bg-slate-900/90 p-6 shadow-2xl shadow-rose-950/30 backdrop-blur-2xl sm:p-8"
      >
        {/* Top Icon Badge */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-500 p-0.5 shadow-xl shadow-rose-600/30">
          <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/70 backdrop-blur-md">
            <Lock className="h-9 w-9 text-rose-400" />
          </div>
        </div>

        {/* Title & Description */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-rose-300">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{isEn ? 'Restricted Access' : 'ناوچەی پارێزراوی ئەدمین'}</span>
          </div>

          <h1 className="mt-3 font-display text-xl font-black tracking-wide text-white sm:text-2xl">
            {isEn ? 'SSMR Admin Gateway' : 'پانێڵی بەڕێوەبەر (Mazn Mahdi)'}
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            {isEn
              ? 'Please enter the administrative security password to unlock the admin command console.'
              : 'تکایە وشەی نهێنی سەرپەرشتیار بنووسە بۆ چوونە ناو تەواوی دەسەڵاتەکانی بەڕێوەبردن.'}
          </p>
        </div>

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="mt-6 space-y-4">
          <div className="relative">
            <label className="mb-1.5 block text-xs font-bold text-slate-300">
              {isEn ? 'Admin Password' : 'وشەی نهێنی ئەدمین'}
            </label>

            <div className="relative flex items-center">
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-slate-400">
                <KeyRound className="h-4 w-4" />
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={isEn ? 'Enter password...' : 'وشەی نهێنی بنووسە...'}
                autoFocus
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 ps-10 pe-11 text-sm font-semibold text-white placeholder-slate-500 shadow-inner transition focus:border-rose-500/60 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400 transition hover:text-white"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {isEn ? 'Verifying with Firebase...' : 'پشکنین لە فایەربەیس...'}
                </span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                <span>{isEn ? 'Unlock Admin Console' : 'چوونەژوورەوە بۆ ئەدمین'}</span>
              </>
            )}
          </button>
        </form>

        {/* Back to Home Action */}
        <div className="mt-5 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 py-2.5 text-xs font-bold text-slate-400 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>{isEn ? 'Return to Home' : 'گەڕانەوە بۆ پەڕەی سەرەکی'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
