import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Credentials
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'API7QMERjkNUN7j';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'pFc6g6JdfXCOVbRLeRWmj3q4bgKPnyvPO15eqa5NfEoD';

app.use(cors());
app.use(express.json());

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
