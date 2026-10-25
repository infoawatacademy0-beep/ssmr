import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { database } from '../config/firebase';
import {
  Settings,
  X,
  LogOut,
  User as UserIcon,
  Volume2,
  Bell,
  Lock,
  ChevronRight,
  Info,
  Sliders,
  AlertTriangle,
  Trash2,
  Clock,
  Globe,
  Check,
} from 'lucide-react';
import type { User, AccountDeletionRequest } from '../types';
import { useLanguage } from '../contexts';
import {
  requestAccountDeletion,
  cancelAccountDeletionRequest,
  subscribeToUserDeletionRequest,
} from '../services';

interface SettingsModalProps {
  currentUser: User;
  onClose: () => void;
  onLogout: () => void;
  onOpenEditProfile: () => void;
}

export default function SettingsModal({
  currentUser,
  onClose,
  onLogout,
  onOpenEditProfile,
}: SettingsModalProps) {
  const { language, setLanguage, t, isRTL } = useLanguage();

  // Local settings toggles
  const [noiseSuppression, setNoiseSuppression] = useState(
    () => localStorage.getItem('ssmr_noise_suppression') !== 'false',
  );
  const [soundEffects, setSoundEffects] = useState(
    () => localStorage.getItem('ssmr_sound_effects') !== 'false',
  );
  const [pushNotifs, setPushNotifs] = useState(
    () =>
      currentUser.activityNotifications !== undefined
        ? currentUser.activityNotifications
        : localStorage.getItem('ssmr_push_notifs') !== 'false',
  );
  const [allowDirectMessages, setAllowDirectMessages] = useState(
    () =>
      currentUser.allowDirectMessages !== undefined
        ? currentUser.allowDirectMessages
        : localStorage.getItem('ssmr_allow_dms') !== 'false',
  );

  // Sign out confirmation prompt state
  const [showSignoutConfirm, setShowSignoutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Account Deletion Request state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRequestingDelete, setIsRequestingDelete] = useState(false);
  const [pendingDeletionReq, setPendingDeletionReq] = useState<AccountDeletionRequest | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToUserDeletionRequest(currentUser.uid, (req) => {
      setPendingDeletionReq(req);
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const handleRequestDeleteAccount = async () => {
    setIsRequestingDelete(true);
    try {
      await requestAccountDeletion(
        currentUser,
        language === 'en' ? 'Account deletion requested by user in Settings.' : 'داواکاری سڕینەوەی هەژمار لەلایەن بەکارهێنەرەوە لە بەشی Settings.',
      );
      setShowDeleteConfirm(false);
    } catch (err: any) {
      alert(err.message || (language === 'en' ? 'Failed to submit request.' : 'نەتوانرا داواکارییەکە بنێردرێت.'));
    } finally {
      setIsRequestingDelete(false);
    }
  };

  const handleCancelDeleteRequest = async () => {
    setIsRequestingDelete(true);
    try {
      await cancelAccountDeletionRequest(currentUser.uid);
    } catch (err: any) {
      alert(err.message || (language === 'en' ? 'Failed to cancel request.' : 'نەتوانرا داواکارییەکە هەڵبوەشێنرێتەوە.'));
    } finally {
      setIsRequestingDelete(false);
    }
  };

  const toggleNoiseSuppression = () => {
    const val = !noiseSuppression;
    setNoiseSuppression(val);
    localStorage.setItem('ssmr_noise_suppression', String(val));
    window.dispatchEvent(new Event('ssmr-settings-changed'));
  };

  const toggleSoundEffects = () => {
    const val = !soundEffects;
    setSoundEffects(val);
    localStorage.setItem('ssmr_sound_effects', String(val));
    window.dispatchEvent(new Event('ssmr-settings-changed'));
  };

  const togglePushNotifs = async () => {
    const val = !pushNotifs;
    setPushNotifs(val);
    localStorage.setItem('ssmr_push_notifs', String(val));
    window.dispatchEvent(new Event('ssmr-settings-changed'));
    if (currentUser?.uid) {
      try {
        await update(ref(database, `users/${currentUser.uid}`), {
          activityNotifications: val,
        });
      } catch (err) {
        console.warn('Failed to sync activityNotifications setting:', err);
      }
    }
  };

  const toggleAllowDMs = async () => {
    const val = !allowDirectMessages;
    setAllowDirectMessages(val);
    localStorage.setItem('ssmr_allow_dms', String(val));
    window.dispatchEvent(new Event('ssmr-settings-changed'));
    if (currentUser?.uid) {
      try {
        await update(ref(database, `users/${currentUser.uid}`), {
          allowDirectMessages: val,
        });
      } catch (err) {
        console.warn('Failed to sync allowDirectMessages setting:', err);
      }
    }
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onLogout();
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="flex h-[88vh] max-h-[680px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl"
      >
        {/* ── HEADER ── */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 p-4 sm:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-black text-white">
                {t('settings.title', 'ڕێکخستنەکان')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('settings.subtitle', 'هەژمار، دەنگ و ڕێکخستنەکانی سیستەم')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── SCROLLABLE SETTINGS BODY ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-5">
          {/* 1. Account Summary Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 font-bold text-black shadow-md">
                {currentUser.avatar || currentUser.profileImage ? (
                  <img
                    src={currentUser.avatar || currentUser.profileImage}
                    alt={currentUser.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl">
                    {(currentUser.username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white truncate">
                    {currentUser.username}
                  </h3>
                  {currentUser.isAdmin && (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[9px] font-black text-rose-300 uppercase">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                <span className="text-[10px] font-mono text-slate-500 block truncate">
                  UID: {currentUser.uid}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenEditProfile();
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:border-amber-400/40 hover:bg-slate-900"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                <span>{t('settings.editProfile', 'دەستکاریکردنی پڕۆفایل و بەرگ')}</span>
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-500 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* ── 2. LANGUAGE PREFERENCE (زمانی سەرەکی: کوردی / ئینگلیزی) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('settings.languageSection', 'زمان / Language')}
              </h4>
              <span className="text-[10px] text-amber-400 font-bold">
                {language === 'ku' ? 'کوردی سۆرانی' : 'English'}
              </span>
            </div>

            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>{t('settings.languageDesc', 'زمانی سەرەکی بەرنامە هەڵبژێرە (کوردی یان ئینگلیزی)')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Kurdish Option (Primary / Default) */}
                <button
                  type="button"
                  onClick={() => setLanguage('ku')}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    language === 'ku'
                      ? 'border-amber-400/80 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent text-white ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800/80 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-base border border-amber-400/20 shadow-sm">
                      ☀️
                    </span>
                    <div className="min-w-0 text-start">
                      <p className="text-xs font-black truncate text-white">کوردی (سۆرانی)</p>
                      <p className="text-[9px] text-amber-300 font-bold truncate">{language === 'en' ? 'Default' : 'سەرەکی'}</p>
                    </div>
                  </div>
                  {language === 'ku' && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-black shadow">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>

                {/* English Option */}
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    language === 'en'
                      ? 'border-amber-400/80 bg-gradient-to-br from-amber-500/20 via-blue-500/10 to-transparent text-white ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800/80 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-base border border-cyan-400/20 shadow-sm">
                      🌐
                    </span>
                    <div className="min-w-0 text-start">
                      <p className="text-xs font-black truncate text-white">English</p>
                      <p className="text-[9px] text-cyan-300 font-bold truncate">{language === 'en' ? 'International' : 'نێودەوڵەتی'}</p>
                    </div>
                  </div>
                  {language === 'en' && (
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-black shadow">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Audio & Live Voice Arena Settings */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              {t('settings.audioSection', 'دەنگ و بزوێنەری پەخش')}
            </h4>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 divide-y divide-slate-800/60 overflow-hidden">
              {/* Noise Suppression Toggle */}
              <div className="flex items-center justify-between p-3.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Volume2 className="h-4 w-4 text-cyan-400" />
                    <span>{t('settings.noiseSuppression', 'کەمکردنەوەی ژاوەژاوی دەنگ بە ژیری دەستکرد')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('settings.noiseSuppressionDesc', 'فلتەرکردنی دەنگی پانکە، دەنگدانەوە و دەنگە زیادەکانی دەوروبەر')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleNoiseSuppression}
                  className={`h-6 w-11 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    noiseSuppression ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <motion.div
                    animate={{ x: noiseSuppression ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="h-5 w-5 rounded-full bg-white shadow-md"
                  />
                </button>
              </div>

              {/* Sound Effects Toggle */}
              <div className="flex items-center justify-between p-3.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Sliders className="h-4 w-4 text-purple-400" />
                    <span>{t('settings.soundEffects', 'دەنگە تایبەتەکانی بەرنامە')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('settings.soundEffectsDesc', 'دەنگی ناردنی دیاری و هاتنەژوورەوەی ئەندامان')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleSoundEffects}
                  className={`h-6 w-11 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    soundEffects ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <motion.div
                    animate={{ x: soundEffects ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="h-5 w-5 rounded-full bg-white shadow-md"
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 4. Privacy & Communication */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              {t('settings.privacySection', 'پاراستن و نامەی تایبەتی')}
            </h4>
            <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 divide-y divide-slate-800/60 overflow-hidden">
              {/* Direct Messages Toggle */}
              <div className="flex items-center justify-between p-3.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Lock className="h-4 w-4 text-emerald-400" />
                    <span>{t('settings.allowDMs', 'ڕێگەدان بە نامەی تایبەتی')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('settings.allowDMsDesc', 'ڕێگەدان بە ئەندامانی تر تاوەکو نامەی تایبەتیت بۆ بنێرن')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAllowDMs}
                  className={`h-6 w-11 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    allowDirectMessages ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <motion.div
                    animate={{ x: allowDirectMessages ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="h-5 w-5 rounded-full bg-white shadow-md"
                  />
                </button>
              </div>

              {/* Push Notifications Toggle */}
              <div className="flex items-center justify-between p-3.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Bell className="h-4 w-4 text-yellow-400" />
                    <span>{t('settings.pushNotifs', 'ئاگادارکردنەوەی چالاکییەکان')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('settings.pushNotifsDesc', 'وەرگرتنی بانگهێشتی ژوور و ئاگاداری فۆڵۆکەران')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={togglePushNotifs}
                  className={`h-6 w-11 rounded-full transition-colors relative p-0.5 shrink-0 ${
                    pushNotifs ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                >
                  <motion.div
                    animate={{ x: pushNotifs ? 20 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="h-5 w-5 rounded-full bg-white shadow-md"
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 5. App Info & System Status */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/30 p-3.5 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              <span>{t('settings.appVersion', 'وەشانی گۆڕەپانی دەنگی SSMR')}</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">v2.4.0 (Production)</span>
          </div>

          {/* ── 6. PROMINENT SIGN OUT SECTION ── */}
          <div className="pt-2">
            <AnimatePresence mode="wait">
              {!showSignoutConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowSignoutConfirm(true)}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 active:scale-95 shadow-lg shadow-rose-500/10"
                >
                  <LogOut className="h-4 w-4 text-rose-400" />
                  <span>{t('settings.signOut', 'چوونەدەرەوە لە هەژمار')}</span>
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-center space-y-3"
                >
                  <div className="flex items-center justify-center gap-2 text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-xs font-bold">{t('settings.signOutConfirm', 'ئایا دڵنیایت دەتەوێت لە هەژمارەکەت دەربچیت؟')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {t('settings.signOutDesc', 'پێویستت بە ئیمەیڵ و وشەی نهێنیت دەبێت بۆ چوونەژوورەوەی دووبارە.')}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSignoutConfirm(false)}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-2 text-xs font-bold text-slate-300 hover:text-white"
                    >
                      {t('settings.cancel', 'پاشگەزبوونەوە')}
                    </button>
                    <button
                      type="button"
                      disabled={isSigningOut}
                      onClick={handleConfirmSignOut}
                      className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 py-2 text-xs font-black text-white shadow-md shadow-rose-600/30 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      {isSigningOut ? t('settings.signingOut', 'خەریکی دەرچوونە...') : t('settings.yesSignOut', 'بەڵێ، دەرچوون')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── 7. DELETE ACCOUNT (REQUIRES ADMIN APPROVAL) ── */}
          <div className="pt-1 pb-2">
            {pendingDeletionReq && pendingDeletionReq.status === 'pending' ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-2.5">
                <div className="flex items-center justify-center gap-2 text-amber-300">
                  <Clock className="h-5 w-5 animate-pulse" />
                  <span className="text-xs font-black">
                    {t('settings.deleteReqPending', 'داواکاری سڕینەوەی هەژمار نێردراوە بۆ ئەدمین')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {t('settings.deleteReqPendingDesc', 'داواکارییەکەت گەیشتووەتە لای ئەدمین. هەر کاتێک ئەدمین پەسەندی بکات، هەژمارەکەت بە یەکجاری دەسڕێتەوە.')}
                </p>
                <button
                  type="button"
                  disabled={isRequestingDelete}
                  onClick={handleCancelDeleteRequest}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50"
                >
                  {t('settings.cancelDeleteReq', 'پاشگەزبوونەوە و هەڵوەشاندنەوەی داواکاری')}
                </button>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-950/30 py-3 text-xs font-black text-red-400 transition hover:bg-red-900/40 active:scale-95"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <span>{t('settings.deleteAccount', 'سڕینەوەی هەژمار (Delete Account)')}</span>
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="rounded-2xl border border-red-500/50 bg-red-950/50 p-4 text-center space-y-3"
                  >
                    <div className="flex items-center justify-center gap-2 text-red-400">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="text-xs font-black">
                        {t('settings.deleteAccountConfirm', 'ئایا دڵنیایت دەتەوێت هەژمارەکەت بسڕیتەوە؟')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {t('settings.deleteAccountDesc', 'کاتێک دڵنیا دەبیتەوە، داواکاری سڕینەوەکەت دەچێت بۆ ئەدمین و دوای ئەوەی ئەدمین پەسەندی دەکات هەژمارەکەت بە یەکجاری دەسڕێتەوە.')}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-2 text-xs font-bold text-slate-300 hover:text-white"
                      >
                        {t('settings.noCancel', 'نەخێر، پاشگەزبوونەوە')}
                      </button>
                      <button
                        type="button"
                        disabled={isRequestingDelete}
                        onClick={handleRequestDeleteAccount}
                        className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 py-2 text-xs font-black text-white shadow-md shadow-red-600/30 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                      >
                        {isRequestingDelete ? t('settings.submitting', 'دەنێردرێت...') : t('settings.yesDelete', 'بەڵێ دڵنیام، بینێرە بۆ ئەدمین')}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
