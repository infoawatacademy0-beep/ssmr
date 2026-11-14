import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { spawn, execFile } from 'node:child_process';

function usbPhoneBridgePlugin(): Plugin {
  let latestFrame: Buffer | null = null;
  let latestFrameAt = 0;
  let capturing = false;

  const captureOnce = () =>
    new Promise<boolean>((resolve) => {
      if (capturing) return resolve(false);
      capturing = true;
      const child = spawn('adb', ['exec-out', 'screencap', '-p'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {}
      }, 3000);
      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.on('close', (code) => {
        clearTimeout(timer);
        capturing = false;
        if (code === 0 && chunks.length > 0) {
          const buf = Buffer.concat(chunks);
          if (buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50) {
            latestFrame = buf;
            latestFrameAt = Date.now();
            return resolve(true);
          }
        }
        resolve(false);
      });
      child.on('error', () => {
        clearTimeout(timer);
        capturing = false;
        resolve(false);
      });
    });

  return {
    name: 'usb-phone-bridge-api',
    configureServer(server) {
      server.middlewares.use('/api/usb-phone/status', (_req, res) => {
        execFile('adb', ['devices', '-l'], { timeout: 3500 }, (err, stdout) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          if (err || !stdout) {
            res.end(JSON.stringify({ ok: true, connected: false }));
            return;
          }
          const lines = stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('List of devices') && !l.startsWith('*'));
          for (const line of lines) {
            if (/\bdevice\b/.test(line)) {
              const serial = line.split(/\s+/)[0];
              const m = line.match(/model:([^\s]+)/);
              captureOnce();
              res.end(
                JSON.stringify({
                  ok: true,
                  connected: true,
                  serial,
                  deviceName: m ? m[1] : serial,
                }),
              );
              return;
            }
          }
          res.end(JSON.stringify({ ok: true, connected: false }));
        });
      });

      server.middlewares.use('/api/usb-phone/frame', async (_req, res) => {
        if (!latestFrame || Date.now() - latestFrameAt > 350) {
          await captureOnce();
        } else {
          captureOnce();
        }
        if (latestFrame) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          res.end(latestFrame);
        } else {
          res.statusCode = 503;
          res.end('No USB frame');
        }
      });
    },
  };
}

/**
 * Embedded Vite API Plugin for LiveKit Token Generation.
 * Provides `/api/livekit/token` directly within the development server.
 */
function livekitTokenPlugin(): Plugin {
  return {
    name: 'livekit-token-api',
    configureServer(server) {
      server.middlewares.use('/api/livekit/token', async (req, res) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host}`);
          const roomId = url.searchParams.get('roomId');
          const uid = url.searchParams.get('uid');
          const username = url.searchParams.get('username') || uid || 'User';

          if (!roomId || !uid) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing required query params: roomId and uid' }));
            return;
          }

          const at = new AccessToken(
            'APIDK99UVGG44Xy',
            'maOH065lVZBlCxGHQeUb0El0kS4bxelTwn1xA7MqONs',
            {
              identity: uid,
              name: username,
              ttl: '6h',
            },
          );

          at.addGrant({
            room: roomId,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canPublishSources: [
              TrackSource.MICROPHONE,
              TrackSource.SCREEN_SHARE,
              TrackSource.SCREEN_SHARE_AUDIO,
              TrackSource.CAMERA,
            ],
          });

          const token = await at.toJwt();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ token, roomId, uid }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Token generation failed' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), livekitTokenPlugin(), usbPhoneBridgePlugin()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Split Firebase into a dedicated vendor chunk
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'vendor-firebase';
          }

          // Split LiveKit client and React LiveKit components
          if (id.includes('livekit-client') || id.includes('@livekit')) {
            return 'vendor-livekit';
          }

          // Split animation engine (framer-motion)
          if (id.includes('framer-motion')) {
            return 'vendor-framer-motion';
          }

          // Split React runtime and routing
          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router')
          ) {
            return 'vendor-react';
          }

          // Split UI icons
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
});
