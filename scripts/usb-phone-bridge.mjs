import http from 'node:http';
import { spawn, execFile } from 'node:child_process';

const PORT = 5038;

let latestPngFrame = null;
let latestFrameTime = 0;
let connectedDevice = null;
let isCapturing = false;
let activeSubscribers = 0;
let lastRequestTime = 0;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}

function checkAdbDevice() {
  return new Promise((resolve) => {
    execFile('adb', ['devices', '-l'], { timeout: 4000 }, (err, stdout) => {
      if (err || !stdout) {
        connectedDevice = null;
        return resolve(null);
      }
      const lines = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('List of devices') && !l.startsWith('*'));

      for (const line of lines) {
        if (/\bdevice\b/.test(line)) {
          const parts = line.split(/\s+/);
          const serial = parts[0];
          const modelMatch = line.match(/model:([^\s]+)/);
          const model = modelMatch ? modelMatch[1] : serial;
          connectedDevice = { serial, deviceName: model };
          return resolve(connectedDevice);
        }
      }
      connectedDevice = null;
      resolve(null);
    });
  });
}

function captureOneFrame() {
  return new Promise((resolve) => {
    if (isCapturing) return resolve(false);
    isCapturing = true;

    const child = spawn('adb', ['exec-out', 'screencap', '-p'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const chunks = [];
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
    }, 3000);

    child.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      isCapturing = false;
      if (code === 0 && chunks.length > 0) {
        const buf = Buffer.concat(chunks);
        // Verify PNG magic header: 0x89 0x50 0x4E 0x47
        if (buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
          latestPngFrame = buf;
          latestFrameTime = Date.now();
          return resolve(true);
        }
      }
      resolve(false);
    });

    child.on('error', () => {
      clearTimeout(timer);
      isCapturing = false;
      resolve(false);
    });
  });
}

// Continuous high-speed capture loop while browser client is streaming
async function captureLoop() {
  while (true) {
    const isClientActive = Date.now() - lastRequestTime < 6000 || activeSubscribers > 0;
    if (isClientActive) {
      await captureOneFrame();
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

captureLoop();

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/status') {
    lastRequestTime = Date.now();
    const dev = await checkAdbDevice();
    if (dev) {
      // Warm up initial frame if none captured recently
      if (!latestPngFrame || Date.now() - latestFrameTime > 2000) {
        captureOneFrame();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          connected: true,
          serial: dev.serial,
          deviceName: dev.deviceName,
        }),
      );
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, connected: false }));
    }
    return;
  }

  if (url.pathname === '/frame') {
    lastRequestTime = Date.now();
    if (!latestPngFrame || Date.now() - latestFrameTime > 1500) {
      await captureOneFrame();
    }
    if (latestPngFrame) {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': latestPngFrame.length,
      });
      res.end(latestPngFrame);
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No USB frame available yet' }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`USB Phone Screen Bridge listening on http://127.0.0.1:${PORT}`);
});
