/**
 * Extracts the 11-character YouTube Video ID from any YouTube URL format:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/live/dQw4w9WgXcQ
 * - https://m.youtube.com/watch?v=dQw4w9WgXcQ
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();
  if (!clean) return null;

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname
      .replace(/^www\./, '')
      .replace(/^m\./, '')
      .replace(/^music\./, '')
      .toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }

      const parts = parsed.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        (parts[0] === 'embed' ||
          parts[0] === 'shorts' ||
          parts[0] === 'live' ||
          parts[0] === 'v' ||
          parts[0] === 'e')
      ) {
        const id = parts[1];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    // Fallback regex if URL constructor fails on partial strings or raw 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
      return clean;
    }
    const match = clean.match(
      /(?:youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/|v\/|e\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    if (match?.[1]) return match[1];
  }

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export function getYouTubeThumbnailUrl(url: string): string | null {
  const id = extractYouTubeVideoId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

const clientStreamCache = new Map<string, { streamUrl: string; expiresAt: number }>();

const PUBLIC_PIPED_APIS = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.drgns.space',
];

const PUBLIC_INVIDIOUS_APIS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://iv.datura.network',
];

/**
 * Resolves a direct playable MP4/HLS stream URL for a YouTube video ID when IFrame embedding is blocked (Error 101 / 150).
 */
export async function resolveYouTubeDirectStreamUrl(videoId: string): Promise<string | null> {
  if (!videoId) return null;

  const cached = clientStreamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.streamUrl;
  }

  // 1. Try our own backend proxy first (/api/youtube-stream/:videoId)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`/api/youtube-stream/${encodeURIComponent(videoId)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.streamUrl) {
          clientStreamCache.set(videoId, {
            streamUrl: data.streamUrl,
            expiresAt: Date.now() + 20 * 60 * 1000,
          });
          return data.streamUrl;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {}

  // 2. Client-side fallback: Try public Piped APIs concurrently
  try {
    const streamUrl = await Promise.any(
      PUBLIC_PIPED_APIS.map(async (host) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        try {
          const res = await fetch(`${host}/streams/${encodeURIComponent(videoId)}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          const videoStreams = Array.isArray(data?.videoStreams) ? data.videoStreams : [];
          const combined =
            videoStreams.find(
              (s: any) =>
                s?.url &&
                s.videoOnly === false &&
                (s.format === 'MPEG_4' || String(s.mimeType || '').includes('mp4')),
            ) || videoStreams.find((s: any) => s?.url && s.videoOnly === false);
          if (combined?.url) return String(combined.url);
          if (data?.hls) return String(data.hls);
          throw new Error('No stream');
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    if (streamUrl) {
      clientStreamCache.set(videoId, {
        streamUrl,
        expiresAt: Date.now() + 20 * 60 * 1000,
      });
      return streamUrl;
    }
  } catch {}

  // 3. Client-side fallback: Try public Invidious APIs concurrently
  try {
    const streamUrl = await Promise.any(
      PUBLIC_INVIDIOUS_APIS.map(async (host) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        try {
          const res = await fetch(`${host}/api/v1/videos/${encodeURIComponent(videoId)}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          const fmtStreams = Array.isArray(data?.formatStreams) ? data.formatStreams : [];
          const best =
            fmtStreams.find((s: any) => s?.url && String(s.itag) === '22') ||
            fmtStreams.find((s: any) => s?.url && String(s.itag) === '18') ||
            fmtStreams.find((s: any) => s?.url && String(s.type || '').includes('mp4')) ||
            fmtStreams[0];
          if (best?.url) return String(best.url);
          throw new Error('No stream');
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    if (streamUrl) {
      clientStreamCache.set(videoId, {
        streamUrl,
        expiresAt: Date.now() + 20 * 60 * 1000,
      });
      return streamUrl;
    }
  } catch {}

  return null;
}
