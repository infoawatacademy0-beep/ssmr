/* ─────────────────────────────────────────────────────────────
   Text-to-Speech (TTS) Announcement Service
   Triggers hype, luxury audio announcements across the venue
   when members enter the room, high-tier gifts arrive, or games end.
   ───────────────────────────────────────────────────────────── */

/**
 * Plays a pleasant crystal welcome chime using Web Audio API before reading the name.
 */
function playWelcomeChime(isVip: boolean = false): void {
  if (typeof window === 'undefined') return;
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

export function speakAnnouncement(
  text: string,
  options: { pitch?: number; rate?: number; volume?: number; lang?: string } = {},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
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
  if (!username) return;
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
