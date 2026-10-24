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

/**
 * POST /api/upload-song
 * Uploads an MP3 or audio file to Internet Archive via S3 API,
 * returning a permanent direct MP3 streaming link.
 */
app.post('/api/upload-song', upload.single('songFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'تکایە فایلێکی دەنگی (MP3) هەڵبژێرە' });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = req.file.originalname.split('.').pop() || 'mp3';
    const fileName = `song-${uniqueSuffix}.${fileExtension}`;
    const itemIdentifier = `web-songs-${uniqueSuffix}`;

    const params = {
      Bucket: itemIdentifier,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype || 'audio/mpeg',
      ACL: 'public-read',
    };

    await archiveS3.upload(params).promise();

    const directLink = `https://archive.org/download/${itemIdentifier}/${fileName}`;
    return res.json({
      success: true,
      directLink,
      fileName,
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
