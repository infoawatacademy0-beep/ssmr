/* ─────────────────────────────────────────────────────────────
   Text-to-Speech (TTS) Announcement Service
   Triggers hype, luxury audio announcements across the venue
   when high-tier gifts or grand tournament victories occur.
   ───────────────────────────────────────────────────────────── */

export function speakAnnouncement(
  text: string,
  options: { pitch?: number; rate?: number; volume?: number } = {},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    // Cancel any previous speech so announcements do not queue endlessly
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = options.pitch ?? 1.15; // Slightly energized high pitch
    utterance.rate = options.rate ?? 1.05; // Lively pace
    utterance.volume = options.volume ?? 1.0;

    // Pick an expressive voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('SpeechSynthesis announcement not supported or blocked:', err);
  }
}
