import { useState, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Trophy,
  Coins,
  ArrowRight,
  Shield,
  Zap,
  Star,
} from 'lucide-react';
import { useAuth, useLanguage } from '../contexts';
import { captureUserLocation } from '../services/locationService';

/* ──────────────────────────────────────────────
   Auth Screen — Ultra-premium gamified dark UI
   with smooth Framer Motion transitions between
   Login ↔ Register states.
   ────────────────────────────────────────────── */

type AuthMode = 'login' | 'register';

/* ---------- floating orb background ---------- */

function FloatingOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Large purple orb — top-left */}
      <div
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full animate-float"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)',
          animationDelay: '0s',
        }}
      />
      {/* Cyan orb — bottom-right */}
      <div
        className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full animate-float"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />
      {/* Rose accent — mid-right */}
      <div
        className="absolute top-1/3 -right-16 h-64 w-64 rounded-full animate-float"
        style={{
          background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)',
          animationDelay: '4s',
        }}
      />
      {/* Gold micro orb */}
      <div
        className="absolute top-1/4 left-1/4 h-40 w-40 rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

/* ---------- animated particle grid ---------- */

function ParticleGrid() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-20" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(124,58,237,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}

/* ---------- animated logo ---------- */

function Logo() {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
      className="relative mx-auto mb-2 flex h-20 w-20 items-center justify-center"
    >
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 animate-pulse-glow" />
      {/* Inner bg */}
      <div className="absolute inset-[2px] rounded-2xl bg-surface-900" />
      {/* Icon */}
      <Gamepad2 className="relative z-10 h-10 w-10 text-violet-400" strokeWidth={1.5} />
      {/* Sparkle */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="absolute -top-1 -right-1"
      >
        <Sparkles className="h-5 w-5 text-amber-400" />
      </motion.div>
    </motion.div>
  );
}

/* ---------- feature pills ---------- */

const features = [
  { icon: Coins, ku: '١,٠٠٠ کۆین', en: '1,000 Coins', color: 'text-amber-400' },
  { icon: Trophy, ku: 'ئاستی ١', en: 'Level 1', color: 'text-emerald-400' },
  { icon: Star, ku: 'زیادکەری XP', en: 'XP Booster', color: 'text-cyan-400' },
];

function FeaturePills() {
  const { tr } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      className="mt-3 flex items-center justify-center gap-2"
    >
      {features.map((f) => (
        <div
          key={f.ku}
          className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-400"
        >
          <f.icon className={`h-3.5 w-3.5 ${f.color}`} />
          {tr(f.ku, f.en)}
        </div>
      ))}
    </motion.div>
  );
}

/* ---------- reusable input ---------- */

interface InputFieldProps {
  id: string;
  type: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ElementType;
  placeholder: string;
  autoComplete?: string;
  togglePassword?: boolean;
}

function InputField({
  id,
  type,
  label,
  value,
  onChange,
  icon: Icon,
  placeholder,
  autoComplete,
  togglePassword,
}: InputFieldProps) {
  const [showPwd, setShowPwd] = useState(false);
  const resolvedType = togglePassword ? (showPwd ? 'text' : 'password') : type;

  return (
    <div className="group relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-violet-400">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <input
          id={id}
          type={resolvedType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          className="
            w-full rounded-xl border border-white/[0.06] bg-white/[0.03]
            py-3 pl-11 pr-11 text-sm text-slate-200 placeholder-slate-600
            outline-none transition-all duration-200
            focus:border-violet-500/50 focus:bg-white/[0.05]
            focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]
          "
        />
        {togglePassword && (
          <button
            type="button"
            onClick={() => setShowPwd((p) => !p)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- submit button ---------- */

interface SubmitButtonProps {
  loading: boolean;
  label: string;
}

function SubmitButton({ loading, label }: SubmitButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      disabled={loading}
      type="submit"
      className="
        relative mt-2 flex w-full items-center justify-center gap-2
        overflow-hidden rounded-xl py-3.5 text-sm font-semibold text-white
        shadow-lg shadow-violet-500/20 transition-shadow duration-300
        hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-70
      "
    >
      {/* Gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600" />
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 animate-shimmer opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%)',
        }}
      />
      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            {label}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </span>
    </motion.button>
  );
}

/* ---------- error toast ---------- */

function ErrorToast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300"
    >
      <Shield className="h-4 w-4 shrink-0 text-rose-400" />
      {message}
    </motion.div>
  );
}

/* ===================================================================
   MAIN AUTH COMPONENT
   =================================================================== */

export default function Auth() {
  const { register, login } = useAuth();
  const { language, setLanguage, tr, isRTL } = useLanguage();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Switch modes & clear state */
  const switchMode = useCallback(() => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  }, []);

  /* Map Firebase error codes → friendly messages */
  const friendlyError = (code: string): string => {
    if (language === 'en') {
      const enMap: Record<string, string> = {
        'auth/email-already-in-use': 'This email is already registered. Try logging in.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Invalid email or password. Please try again.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
        'auth/network-request-failed': 'Network error. Check your connection.',
      };
      return enMap[code] ?? 'Something went wrong. Please try again.';
    }

    const map: Record<string, string> = {
      'auth/email-already-in-use': 'ئەم ئیمەیڵە پێشتر تۆمارکراوە. هەوڵی چوونەژوورەوە بدە.',
      'auth/invalid-email': 'تکایە ئیمەیڵێکی دروست بنووسە.',
      'auth/weak-password': 'وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت.',
      'auth/user-not-found': 'هیچ هەژمارێک بەم ئیمەیڵە نەدۆزرایەوە.',
      'auth/wrong-password': 'وشەی نهێنی هەڵەیە. تکایە دووبارە هەوڵبدەرەوە.',
      'auth/invalid-credential': 'ئیمەیڵ یان وشەی نهێنی هەڵەیە. تکایە دووبارە هەوڵبدەرەوە.',
      'auth/too-many-requests': 'هەوڵی زۆر دراوە. تکایە کەمێک چاوەڕێ بکە.',
      'auth/network-request-failed': 'کێشەی هێڵ هەیە. پەیوەندی ئینتەرنێتەکەت بپشکنە.',
    };
    return map[code] ?? 'کێشەیەک ڕوویدا. تکایە دووبارە هەوڵبدەرەوە.';
  };

  /* Form submit handler */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
        let locationData: any = null;
        try {
          locationData = await captureUserLocation();
        } catch {
          // Fallback gracefully
        }

        if (mode === 'register') {
          if (username.trim().length < 3) {
            throw {
              code: 'custom',
              message: tr(
                'ناوی بەکارهێنەر دەبێت لانیکەم ٣ پیت بێت.',
                'Username must be at least 3 characters.',
              ),
            };
          }
          await register(email.trim(), password, username.trim(), locationData);
        } else {
          await login(email.trim(), password, locationData);
        }
      } catch (err: unknown) {
        const firebaseErr = err as { code?: string; message?: string };
        if (firebaseErr.code === 'custom') {
          setError(
            firebaseErr.message ??
              tr('هەڵەی پشتڕاستکردنەوە.', 'Validation error.'),
          );
        } else {
          setError(friendlyError(firebaseErr.code ?? ''));
        }
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, username, register, login, language, tr],
  );

  /* Animation variants */
  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
    },
    exit: { opacity: 0, y: -20, scale: 0.96, transition: { duration: 0.2 } },
  };

  const staggerChildren = {
    visible: { transition: { staggerChildren: 0.07 } },
  };

  const itemVariant = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-8">
      {/* Top language toggle pill */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={() => setLanguage(language === 'ku' ? 'en' : 'ku')}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-300 shadow-md backdrop-blur-md transition hover:border-amber-400/40 hover:text-white"
        >
          <span>{language === 'ku' ? '☀️ کوردی' : '🌐 EN'}</span>
        </button>
      </div>

      {/* Background layers */}
      <FloatingOrbs />
      <ParticleGrid />

      {/* Main card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative z-10 w-full max-w-[420px]"
        >
          {/* Card glass container */}
          <div className="glass-strong rounded-3xl p-6 sm:p-8">
            {/* ── Header ── */}
            <Logo />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-center"
            >
              <h1 className="font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
                SSMR
              </h1>
              <p className="mt-1 text-xs font-medium tracking-widest text-violet-400/80 uppercase">
                {tr('چاتی دەنگی و یاری', 'Voice Chat & Gaming')}
              </p>
            </motion.div>

            {mode === 'register' && <FeaturePills />}

            {/* ── Mode heading ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-6 mb-5 flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                {mode === 'login' ? (
                  <Zap className="h-4 w-4 text-violet-400" />
                ) : (
                  <Sparkles className="h-4 w-4 text-violet-400" />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  {mode === 'login'
                    ? tr('بەخێربێیتەوە', 'Welcome Back')
                    : tr('دروستکردنی هەژمار', 'Create Account')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {mode === 'login'
                    ? tr('بچۆ ژوورەوە بۆ گەڕانەوە بۆ نێو چالاکییەکان', 'Sign in to access your arenas & community')
                    : tr('بەشداری لە گۆڕەپان بکە و دەست بە گەشتەکەت بکە', 'Join the arena and begin your journey')}
                </p>
              </div>
            </motion.div>

            {/* ── Error display ── */}
            <AnimatePresence>
              {error && <ErrorToast message={error} />}
            </AnimatePresence>

            {/* ── Form ── */}
            <motion.form
              onSubmit={handleSubmit}
              variants={staggerChildren}
              initial="hidden"
              animate="visible"
              className="mt-4 flex flex-col gap-4"
            >
              {/* Username — only for register */}
              <AnimatePresence>
                {mode === 'register' && (
                  <motion.div
                    key="username-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <InputField
                      id="username"
                      type="text"
                      label={tr('ناوی بەکارهێنەر', 'Username')}
                      value={username}
                      onChange={setUsername}
                      icon={User}
                      placeholder={tr('ناوێک هەڵبژێرە', 'Choose a username')}
                      autoComplete="username"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <motion.div variants={itemVariant}>
                <InputField
                  id="email"
                  type="email"
                  label={tr('ئیمەیڵ', 'Email')}
                  value={email}
                  onChange={setEmail}
                  icon={Mail}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </motion.div>

              {/* Password */}
              <motion.div variants={itemVariant}>
                <InputField
                  id="password"
                  type="password"
                  label={tr('وشەی نهێنی', 'Password')}
                  value={password}
                  onChange={setPassword}
                  icon={Lock}
                  placeholder="••••••••"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  togglePassword
                />
              </motion.div>

              {/* Submit */}
              <motion.div variants={itemVariant}>
                <SubmitButton
                  loading={loading}
                  label={
                    mode === 'login'
                      ? tr('چوونەژوورەوە', 'Sign In')
                      : tr('دروستکردنی هەژمار', 'Create Account')
                  }
                />
              </motion.div>
            </motion.form>

            {/* ── Divider ── */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              <span className="text-[10px] font-medium tracking-widest text-slate-600 uppercase">
                {tr('یان', 'OR')}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>

            {/* ── Switch mode ── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center text-sm text-slate-500"
            >
              {mode === 'login'
                ? tr('هەژمارت نییە؟', "Don't have an account?")
                : tr('پێشتر هەژمارت دروستکردووە؟', 'Already have an account?')}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-violet-400 transition-colors hover:text-violet-300"
              >
                {mode === 'login'
                  ? tr('خۆتۆمارکردن', 'Sign Up')
                  : tr('چوونەژوورەوە', 'Sign In')}
              </button>
            </motion.p>
          </div>

          {/* ── Bottom security badge ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-600"
          >
            <Shield className="h-3 w-3" />
            <span>{tr('پارێزراوە بە تەواوی · هێڵی پارێزراو', 'End-to-End Encrypted & Secure')}</span>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
