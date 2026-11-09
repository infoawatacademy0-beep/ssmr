import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import AWS from 'aws-sdk';
import multer from 'multer';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Multer memory storage configuration for audio uploads (100MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Internet Archive S3 client configuration with credentials
const archiveS3 = new AWS.S3({
  endpoint: 'https://s3.us.archive.org',
  accessKeyId: '8rf2XcHvDimQ65dX',
  secretAccessKey: 'zHvX8RH0QTna93bN',
  s3ForcePathStyle: true,
  signatureVersion: 'v2',
});

// Credentials
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APIDK99UVGG44Xy';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'maOH065lVZBlCxGHQeUb0El0kS4bxelTwn1xA7MqONs';

// OneSignal Configuration (App ID: b93b7d97-85fb-4b90-9639-94800375ba63)
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || 'b93b7d97-85fb-4b90-9639-94800375ba63';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';
const ONESIGNAL_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIAePpAesCmbZIJ1i7b505etLNN+q
m575890tN1jcPTPCXRVrmBwXhaesv5BrGqPd1UsGir7mgpuM4ZBLJ1JPjA==
-----END PUBLIC KEY-----`;

app.use(cors());
app.use(express.json());

/**
 * Helper to call OneSignal REST API
 */
async function sendOneSignalRequest(endpoint, method = 'POST', payload = null) {
  if (!ONESIGNAL_REST_API_KEY) {
    return { skipped: true, reason: 'ONESIGNAL_REST_API_KEY not configured on server' };
  }
  const response = await fetch(`https://api.onesignal.com${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

/**
 * Helper to send a push notification to a single target user (by UID tag + external_id alias)
 */
async function sendOneSignalToUser(targetUid, basePayload) {
  // 1. Send via tag filter (matches immediately on all devices where OneSignal.User.addTag('uid', targetUid) ran)
  const tagPayload = {
    ...basePayload,
    app_id: ONESIGNAL_APP_ID,
    target_channel: 'push',
    filters: [{ field: 'tag', key: 'uid', relation: '=', value: String(targetUid) }],
  };
  const resTag = await sendOneSignalRequest('/notifications', 'POST', tagPayload);

  // 2. If tag filter matched 0 recipients, also try external_id alias
  if (!resTag?.data?.id) {
    const aliasPayload = {
      ...basePayload,
      app_id: ONESIGNAL_APP_ID,
      target_channel: 'push',
      include_aliases: {
        external_id: [String(targetUid)],
      },
    };
    return await sendOneSignalRequest('/notifications', 'POST', aliasPayload);
  }
  return resTag;
}

/**
 * RULE 1: Room Entry Push Notification
 * POST /api/onesignal/room-entry
 * Automatically broadcasts a push notification to ALL subscribed members
 * for ANY room (including rooms owned by other users), showing the user's name and room title.
 */
app.post('/api/onesignal/room-entry', async (req, res) => {
  try {
    const { userId, username, roomId, roomName, siteUrl } = req.body || {};
    if (!username || !roomName) {
      return res.status(400).json({ error: 'username and roomName are required' });
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: 'push',
      included_segments: ['Total Subscriptions'],
      headings: {
        en: `🎙️ ${username} entered ${roomName}`,
        ckb: `🎙️ ${username} چووە ناو ژووری ${roomName}`,
      },
      contents: {
        en: `${username} just entered the room "${roomName}". Tap to join the voice chat!`,
        ckb: `${username} چووە ناو ژووری «${roomName}». کلیک بکە بۆ بەشداریکردن!`,
      },
      web_push_topic: `room_entry_${roomId || 'general'}_${Date.now()}`,
      url: siteUrl ? `${siteUrl.replace(/\/$/, '')}/room/${roomId}` : undefined,
      data: {
        type: 'room_entry',
        userId: userId || '',
        username,
        roomId: roomId || '',
        roomName,
      },
    };

    const result = await sendOneSignalRequest('/notifications', 'POST', payload);
    return res.json({ success: true, rule: 'room_entry', result });
  } catch (err) {
    console.error('OneSignal room-entry error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send room entry notification' });
  }
});

/**
 * RULE 2: Direct / Private Chat Message Push Notification
 * POST /api/onesignal/private-message
 * Sends a push notification ONLY to Member B (recipientUid) with Member A's name and message preview.
 */
app.post('/api/onesignal/private-message', async (req, res) => {
  try {
    const {
      senderUid,
      senderName,
      senderAvatar,
      recipientUid,
      messagePreview,
      threadId,
      siteUrl,
    } = req.body || {};

    if (!recipientUid || !senderName) {
      return res.status(400).json({ error: 'recipientUid and senderName are required' });
    }

    const cleanThreadId = threadId || [senderUid, recipientUid].sort().join('_');
    const topicTag = `dm_${cleanThreadId}`;
    const preview = messagePreview || 'نامەیەکی نوێت بۆ هات';

    const result = await sendOneSignalToUser(recipientUid, {
      headings: {
        en: `💬 ${senderName}`,
        ckb: `💬 نامەی نوێ لەلایەن ${senderName}`,
      },
      contents: {
        en: `${senderName}: ${preview}`,
        ckb: `${senderName}: ${preview}`,
      },
      collapse_id: topicTag,
      web_push_topic: topicTag,
      chrome_web_icon: senderAvatar || undefined,
      url: siteUrl || undefined,
      data: {
        type: 'private_message',
        threadId: cleanThreadId,
        senderUid: senderUid || '',
        senderName,
        recipientUid: String(recipientUid),
      },
    });

    return res.json({
      success: true,
      rule: 'private_message',
      notificationId: result?.data?.id || null,
      result,
    });
  } catch (err) {
    console.error('OneSignal private-message error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send private message push' });
  }
});

/**
 * Profile Visit Push Notification
 * POST /api/onesignal/profile-visit
 * Sends a push notification ONLY to the profile owner (targetUid) when someone visits their profile.
 */
app.post('/api/onesignal/profile-visit', async (req, res) => {
  try {
    const { visitorUid, visitorName, visitorAvatar, targetUid, siteUrl } = req.body || {};
    if (!targetUid || !visitorName) {
      return res.status(400).json({ error: 'targetUid and visitorName are required' });
    }

    const topicTag = `visit_${targetUid}_${visitorUid || 'user'}`;
    const result = await sendOneSignalToUser(targetUid, {
      headings: {
        en: `👁️ Profile Visitor: ${visitorName}`,
        ckb: `👁️ سەردانی پڕۆفایل لەلایەن ${visitorName}`,
      },
      contents: {
        en: `${visitorName} just visited your profile!`,
        ckb: `${visitorName} سەردانی پڕۆفایلەکەتی کرد!`,
      },
      collapse_id: topicTag,
      web_push_topic: topicTag,
      chrome_web_icon: visitorAvatar || undefined,
      url: siteUrl || undefined,
      data: {
        type: 'profile_visit',
        visitorUid: visitorUid || '',
        visitorName,
        targetUid: String(targetUid),
      },
    });

    return res.json({
      success: true,
      rule: 'profile_visit',
      notificationId: result?.data?.id || null,
      result,
    });
  } catch (err) {
    console.error('OneSignal profile-visit error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send profile visit push' });
  }
});

/**
 * RULE 3: Notification Dismissal / Clearance
 * POST /api/onesignal/dismiss-chat
 * Cancels/deletes unread OneSignal notifications when Member B opens or reads the chat.
 */
app.post('/api/onesignal/dismiss-chat', async (req, res) => {
  try {
    const { notificationIds = [], recipientUid, threadId } = req.body || {};
    const cancelled = [];

    if (Array.isArray(notificationIds)) {
      for (const notifId of notificationIds) {
        if (notifId && typeof notifId === 'string') {
          const delRes = await sendOneSignalRequest(
            `/notifications/${encodeURIComponent(notifId)}?app_id=${encodeURIComponent(ONESIGNAL_APP_ID)}`,
            'DELETE',
          );
          cancelled.push({ id: notifId, status: delRes.status });
        }
      }
    }

    return res.json({
      success: true,
      rule: 'dismiss_chat',
      recipientUid,
      threadId,
      cancelled,
    });
  } catch (err) {
    console.error('OneSignal dismiss-chat error:', err);
    return res.status(500).json({ error: err.message || 'Failed to dismiss notifications' });
  }
});

/**
 * GET/POST /api/livekit/token
 * Generates LiveKit WebRTC AccessToken with audio publish/subscribe permissions.
 */
app.all('/api/livekit/token', async (req, res) => {
  try {
    const roomId = req.query.roomId || req.body?.roomId;
    const uid = req.query.uid || req.body?.uid;
    const username = req.query.username || req.body?.username || uid;

    if (!roomId || !uid) {
      return res.status(400).json({
        error: 'Missing required parameters: roomId and uid are mandatory.',
      });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(uid),
      name: String(username),
      ttl: '6h',
    });

    at.addGrant({
      room: String(roomId),
      roomJoin: true,
      canPublish: true, // Audio publish permission
      canSubscribe: true, // Audio subscribe permission
      canPublishData: true,
      canPublishSources: [TrackSource.MICROPHONE], // Restrict to microphone audio only
    });

    const token = await at.toJwt();
    return res.json({ token, roomId, uid });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * POST /api/upload-song
 * Uploads ANY audio/song file format to Internet Archive via S3 API,
 * ensuring correct streaming MIME-types and permanent direct streaming links.
 */
app.post('/api/upload-song', upload.single('songFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'تکایە فایلێکی دەنگی هەڵبژێرە' });
    }

    // Clean and detect file extension from original name
    let fileExtension = 'mp3';
    if (req.file.originalname && req.file.originalname.includes('.')) {
      const parts = req.file.originalname.split('.');
      const rawExt = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rawExt) fileExtension = rawExt;
    }

    // Comprehensive audio MIME types mapping for all mobile & desktop audio formats
    const audioMimeMap = {
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      wav: 'audio/wav',
      wave: 'audio/wav',
      ogg: 'audio/ogg',
      oga: 'audio/ogg',
      opus: 'audio/opus',
      flac: 'audio/flac',
      webm: 'audio/webm',
      weba: 'audio/webm',
      wma: 'audio/x-ms-wma',
      mp4: 'audio/mp4',
      m4p: 'audio/mp4',
      '3gp': 'audio/3gpp',
      amr: 'audio/amr',
      aif: 'audio/x-aiff',
      aiff: 'audio/x-aiff',
      mid: 'audio/midi',
      midi: 'audio/midi',
    };

    const contentType = audioMimeMap[fileExtension] || req.file.mimetype || 'audio/mpeg';

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileName = `song-${uniqueSuffix}.${fileExtension}`;
    const itemIdentifier = `web-songs-${uniqueSuffix}`;

    const request = archiveS3.putObject({
      Bucket: itemIdentifier,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: contentType,
      ACL: 'public-read',
    });

    request.on('build', () => {
      request.httpRequest.headers['x-archive-auto-make-bucket'] = '1';
      request.httpRequest.headers['x-archive-meta-mediatype'] = 'audio';
      if (req.file.originalname) {
        request.httpRequest.headers['x-archive-meta-title'] = req.file.originalname.replace(/\.[^/.]+$/, '');
      }
    });

    await request.promise();

    const directLink = `https://archive.org/download/${itemIdentifier}/${fileName}`;
    return res.json({
      success: true,
      directLink,
      fileName,
      format: fileExtension,
      contentType,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Error uploading song to Archive.org:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'هەڵەیەک ڕوویدا لە بارکردنی گۆرانییەکە',
    });
  }
});

/**
 * GET /api/youtube-stream/:videoId
 * Resolves a direct playable MP4 stream URL for YouTube videos that have embedding disabled (Error 150 / 101).
 */
const ytStreamCache = new Map();
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.syncpundit.io',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.drgns.space',
];
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://iv.datura.network',
];

async function resolveDirectYouTubeStream(videoId) {
  const cached = ytStreamCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  // 1. Try Piped API instances concurrently
  try {
    const pipedResult = await Promise.any(
      PIPED_INSTANCES.map(async (host) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        try {
          const resp = await fetch(`${host}/streams/${encodeURIComponent(videoId)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          const videoStreams = Array.isArray(data?.videoStreams) ? data.videoStreams : [];
          // Find combined video+audio MP4 stream (videoOnly === false)
          const combined = videoStreams.find(
            (s) => s && s.url && s.videoOnly === false && (s.format === 'MPEG_4' || String(s.mimeType || '').includes('mp4')),
          ) || videoStreams.find((s) => s && s.url && s.videoOnly === false);

          if (combined?.url) {
            return {
              streamUrl: combined.url,
              title: data.title || '',
              duration: Number(data.duration) || 0,
              hlsUrl: data.hls || null,
            };
          }
          if (data?.hls) {
            return {
              streamUrl: data.hls,
              title: data.title || '',
              duration: Number(data.duration) || 0,
              hlsUrl: data.hls,
            };
          }
          throw new Error('No combined stream');
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    if (pipedResult?.streamUrl) {
      const entry = { ...pipedResult, expiresAt: Date.now() + 20 * 60 * 1000 };
      ytStreamCache.set(videoId, entry);
      return entry;
    }
  } catch {}

  // 2. Fallback: Try Invidious API instances concurrently
  try {
    const invResult = await Promise.any(
      INVIDIOUS_INSTANCES.map(async (host) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        try {
          const resp = await fetch(`${host}/api/v1/videos/${encodeURIComponent(videoId)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          const fmtStreams = Array.isArray(data?.formatStreams) ? data.formatStreams : [];
          // Prefer 720p (itag 22) or 360p (itag 18) combined MP4
          const best =
            fmtStreams.find((s) => s?.url && String(s.itag) === '22') ||
            fmtStreams.find((s) => s?.url && String(s.itag) === '18') ||
            fmtStreams.find((s) => s?.url && String(s.type || '').includes('mp4')) ||
            fmtStreams[0];

          if (best?.url) {
            return {
              streamUrl: best.url,
              title: data.title || '',
              duration: Number(data.lengthSeconds) || 0,
            };
          }
          throw new Error('No formatStreams');
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    if (invResult?.streamUrl) {
      const entry = { ...invResult, expiresAt: Date.now() + 20 * 60 * 1000 };
      ytStreamCache.set(videoId, entry);
      return entry;
    }
  } catch {}

  // 3. Fallback: Try Cobalt API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          vQuality: '720',
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.url) {
          const entry = {
            streamUrl: data.url,
            title: '',
            duration: 0,
            expiresAt: Date.now() + 20 * 60 * 1000,
          };
          ytStreamCache.set(videoId, entry);
          return entry;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {}

  return null;
}

app.get('/api/youtube-stream/:videoId', async (req, res) => {
  try {
    const videoId = String(req.params.videoId || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid YouTube video ID' });
    }
    const resolved = await resolveDirectYouTubeStream(videoId);
    if (!resolved || !resolved.streamUrl) {
      return res.status(404).json({ error: 'Could not resolve direct stream for this YouTube video' });
    }
    return res.json({
      success: true,
      videoId,
      streamUrl: resolved.streamUrl,
      title: resolved.title,
      duration: resolved.duration,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to resolve YouTube stream' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'SSMR LiveKit & Web App Service' });
});

// Serve frontend static build files (SPA)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`🎙️ SSMR Voice App & Token Server running on port ${PORT}`);
});

export default app;
