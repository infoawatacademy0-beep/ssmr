/* ─────────────────────────────────────────────────────────────
   Text-to-Speech (TTS) Announcement Service
   Triggers hype, luxury audio announcements across the venue
   when members enter the room, high-tier gifts arrive, or games end.
   ───────────────────────────────────────────────────────────── */

/**
 * Checks whether "In-App Sound Effects" is enabled in Settings.
 */
export function isSoundEffectsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('ssmr_sound_effects') !== 'false';
  } catch {
    return true;
  }
}

/**
 * Plays a pleasant crystal welcome chime using Web Audio API before reading the name.
 */
function playWelcomeChime(isVip: boolean = false): void {
  if (typeof window === 'undefined' || !isSoundEffectsEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = isVip ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.3);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignore audio context restrictions
  }
}

/**
 * Plays a gift fanfare sound effect when a gift animation triggers in the room.
 * Controlled by the "In-App Sound Effects" setting.
 */
export function playGiftSoundEffect(isHighTier: boolean = false): void {
  if (typeof window === 'undefined' || !isSoundEffectsEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = isHighTier
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
      : [659.25, 880, 1174.66];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isHighTier ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(isHighTier ? 0.16 : 0.11, now + idx * 0.08 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.38);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1400);
  } catch {
    // Ignore audio restrictions
  }
}

/**
 * Plays a crisp notification chime when an incoming Direct Message or Activity Notification arrives.
 */
export function playChatNotificationSound(): void {
  if (typeof window === 'undefined' || !isSoundEffectsEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [783.99, 1174.66]; // G5 -> D6 pleasant chat pop
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);

      gain.gain.setValueAtTime(0.001, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.075 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.24);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore audio restrictions
  }
}

export function speakAnnouncement(
  text: string,
  options: { pitch?: number; rate?: number; volume?: number; lang?: string } = {},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !isSoundEffectsEnabled()) {
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const triggerSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = options.pitch ?? 1.1;
      utterance.rate = options.rate ?? 1.0;
      utterance.volume = options.volume ?? 1.0;

      const voices = window.speechSynthesis.getVoices();
      const hasArabicScript = /[\u0600-\u06FF]/.test(text);

      let preferredVoice = null;
      if (hasArabicScript) {
        preferredVoice =
          voices.find((v) => v.lang.startsWith('ar') || v.lang.startsWith('ku') || v.lang.startsWith('fa')) ||
          voices.find((v) => v.name.includes('Google') || v.name.includes('Natural')) ||
          voices[0];
      } else {
        preferredVoice =
          voices.find((v) => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
      }

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    const existingVoices = window.speechSynthesis.getVoices();
    if (existingVoices.length > 0) {
      triggerSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        triggerSpeak();
      };
      // Also call directly as fallback for browsers that don't fire onvoiceschanged
      triggerSpeak();
    }
  } catch (err) {
    console.warn('SpeechSynthesis announcement not supported or blocked:', err);
  }
}

/**
 * Announces a member's name out loud when they enter a voice room.
 */
export function speakUserEntrance(username: string, level: number = 1): void {
  if (!username || !isSoundEffectsEnabled()) return;
  const cleanName = username.trim();
  const isVip = level >= 10;

  playWelcomeChime(isVip);

  const hasArabicOrKurdishScript = /[\u0600-\u06FF]/.test(cleanName);
  const announcementText = hasArabicOrKurdishScript
    ? `بەخێربێیت ${cleanName}`
    : isVip
      ? `Welcome VIP ${cleanName}`
      : `Welcome ${cleanName}`;

  setTimeout(() => {
    speakAnnouncement(announcementText, {
      pitch: 1.08,
      rate: 0.98,
      volume: 1.0,
    });
  }, 180);
}
