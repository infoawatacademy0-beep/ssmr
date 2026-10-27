import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

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
            canPublishSources: [TrackSource.MICROPHONE],
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
  plugins: [react(), tailwindcss(), livekitTokenPlugin()],
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
