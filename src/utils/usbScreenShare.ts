/* ─────────────────────────────────────────────────────────────
   USB Mobile Screen Share Utility
   Supports 3 ways to share a USB-connected mobile phone on PC:
   1. Direct WebUSB ADB Screen Stream (Android USB cable via navigator.usb)
   2. USB Video Capture Device Stream (UVC / Android 14+ USB video / DroidCam / Camo / Capture card)
   3. USB Mirrored Phone Window / Display Capture (Phone Link, Scrcpy, DeX, 3uTools, Vysor, etc.)
   ───────────────────────────────────────────────────────────── */

export interface UsbVideoDeviceOption {
  deviceId: string;
  label: string;
  isLikelyUsbOrMobile: boolean;
}

/**
 * Lists all video input devices connected to the PC (highlighting USB / Mobile video devices).
 */
export async function listConnectedVideoDevices(): Promise<UsbVideoDeviceOption[]> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== 'function'
  ) {
    return [];
  }

  try {
    // Request brief permission if labels are empty
    let devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');
    if (videoInputs.length > 0 && videoInputs.every((d) => !d.label)) {
      try {
        const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        temp.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch {}
    }

    return devices
      .filter((d) => d.kind === 'videoinput' && d.deviceId)
      .map((d, idx) => {
        const label = d.label || `USB / Camera Device #${idx + 1}`;
        const isLikelyUsbOrMobile =
          /usb|mobile|phone|android|iphone|ipad|droidcam|ivcam|camo|epoccam|scrcpy|capture|virtual|obs|elgato|hdmi/i.test(
            label,
          );
        return {
          deviceId: d.deviceId,
          label,
          isLikelyUsbOrMobile,
        };
      })
      .sort((a, b) => Number(b.isLikelyUsbOrMobile) - Number(a.isLikelyUsbOrMobile));
  } catch (err) {
    console.warn('Could not enumerate video devices:', err);
    return [];
  }
}

/**
 * Opens a MediaStream from a specific USB video input deviceId.
 */
export async function startUsbVideoDeviceStream(deviceId: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('MediaDevices API is not available.');
  }
  return await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  });
}

/* ─────────────────────────────────────────────────────────────
   Minimal WebUSB ADB Protocol Helpers for Direct USB Cable Capture
   ───────────────────────────────────────────────────────────── */

const ADB_CLASS = 0xff;
const ADB_SUBCLASS = 0x42;
const ADB_PROTOCOL = 0x01;

const A_CNXN = 0x4e584e43;
const A_OPEN = 0x4e45504f;
const A_OKAY = 0x59414b4f;
const A_CLSE = 0x45534c43;
const A_WRTE = 0x45545257;
const A_AUTH = 0x48545541;

const ADB_VERSION = 0x01000000;
const ADB_MAXDATA = 1024 * 1024;
const ADB_AUTH_TOKEN = 1;
const ADB_AUTH_RSAPUBLICKEY = 3;

function computeChecksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) >>> 0;
  }
  return sum;
}

function encodeAdbPacket(
  command: number,
  arg0: number,
  arg1: number,
  payload: Uint8Array = new Uint8Array(0),
): ArrayBuffer {
  const header = new ArrayBuffer(24);
  const view = new DataView(header);
  view.setUint32(0, command, true);
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, payload.byteLength, true);
  view.setUint32(16, computeChecksum(payload), true);
  view.setUint32(20, (command ^ 0xffffffff) >>> 0, true);
  return header;
}

/**
 * Checks whether the current browser supports WebUSB (`navigator.usb`).
 */
export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as any).usb);
}

/**
 * Connects to an Android phone over USB cable using WebUSB ADB and streams `screencap -p`
 * frames into a live HTMLCanvasElement MediaStream.
 */
export async function connectUsbPhoneViaWebUsb(): Promise<{
  stream: MediaStream;
  deviceName: string;
  stop: () => void;
}> {
  const usb = (navigator as any).usb;
  if (!usb) {
    throw new Error('WebUSB is not supported in this browser. Please use Chrome or Edge on PC.');
  }

  // Prompt user to select their USB-connected phone
  const device = await usb.requestDevice({
    filters: [{ classCode: ADB_CLASS, subclassCode: ADB_SUBCLASS, protocolCode: ADB_PROTOCOL }],
  });

  await device.open();
  if (!device.configuration) {
    await device.selectConfiguration(1);
  }

  // Locate ADB interface and bulk IN/OUT endpoints
  let ifaceNumber = -1;
  let inEndpoint = -1;
  let outEndpoint = -1;

  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      if (
        alt.interfaceClass === ADB_CLASS &&
        alt.interfaceSubclass === ADB_SUBCLASS &&
        alt.interfaceProtocol === ADB_PROTOCOL
      ) {
        ifaceNumber = iface.interfaceNumber;
        for (const ep of alt.endpoints) {
          if (ep.direction === 'in' && ep.type === 'bulk') {
            inEndpoint = ep.endpointNumber;
          } else if (ep.direction === 'out' && ep.type === 'bulk') {
            outEndpoint = ep.endpointNumber;
          }
        }
        break;
      }
    }
    if (ifaceNumber !== -1) break;
  }

  if (ifaceNumber === -1 || inEndpoint === -1 || outEndpoint === -1) {
    throw new Error('ADB USB interface not found on device. Make sure USB Debugging is enabled on your phone.');
  }

  await device.claimInterface(ifaceNumber);

  const textEncoder = new TextEncoder();

  const sendPacket = async (
    cmd: number,
    arg0: number,
    arg1: number,
    payload: Uint8Array = new Uint8Array(0),
  ) => {
    const header = encodeAdbPacket(cmd, arg0, arg1, payload);
    await device.transferOut(outEndpoint, header);
    if (payload.byteLength > 0) {
      await device.transferOut(outEndpoint, payload);
    }
  };

  const readPacket = async (): Promise<{
    cmd: number;
    arg0: number;
    arg1: number;
    payload: Uint8Array;
  }> => {
    const headerRes = await device.transferIn(inEndpoint, 24);
    if (!headerRes.data || headerRes.data.byteLength < 24) {
      throw new Error('Invalid ADB packet header from USB device.');
    }
    const view = headerRes.data;
    const cmd = view.getUint32(0, true);
    const arg0 = view.getUint32(4, true);
    const arg1 = view.getUint32(8, true);
    const len = view.getUint32(12, true);

    const payload = new Uint8Array(len);
    let offset = 0;
    while (offset < len) {
      const chunkRes = await device.transferIn(inEndpoint, len - offset);
      if (!chunkRes.data || chunkRes.data.byteLength === 0) break;
      const chunk = new Uint8Array(
        chunkRes.data.buffer,
        chunkRes.data.byteOffset,
        chunkRes.data.byteLength,
      );
      payload.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { cmd, arg0, arg1, payload };
  };

  // Send A_CNXN
  const banner = textEncoder.encode('host::ssmr_webusb\0');
  await sendPacket(A_CNXN, ADB_VERSION, ADB_MAXDATA, banner);

  let pkt = await readPacket();
  if (pkt.cmd === A_AUTH && pkt.arg0 === ADB_AUTH_TOKEN) {
    // Send public key so user gets the "Allow USB debugging?" dialog on their phone screen
    const storedPubKey =
      localStorage.getItem('ssmr_adb_pubkey') ||
      btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(256)))) +
        ' ssmr@pc\0';
    localStorage.setItem('ssmr_adb_pubkey', storedPubKey);
    await sendPacket(
      A_AUTH,
      ADB_AUTH_RSAPUBLICKEY,
      0,
      textEncoder.encode(storedPubKey),
    );
    pkt = await readPacket();
  }

  if (pkt.cmd !== A_CNXN) {
    throw new Error('Please tap "Allow USB Debugging" on your phone screen and try again.');
  }

  // Create live canvas stream for the USB mobile screen
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');

  let isStopped = false;
  let localIdCounter = 10;

  const captureSingleUsbFrame = async (): Promise<boolean> => {
    if (isStopped) return false;
    const localId = localIdCounter++;
    const openPayload = textEncoder.encode('exec:screencap -p\0');
    await sendPacket(A_OPEN, localId, 0, openPayload);

    const chunks: Uint8Array[] = [];
    let remoteId = 0;

    while (!isStopped) {
      const res = await readPacket();
      if (res.cmd === A_OKAY) {
        remoteId = res.arg0;
        continue;
      }
      if (res.cmd === A_WRTE) {
        remoteId = res.arg0;
        if (res.payload.byteLength > 0) {
          chunks.push(res.payload);
        }
        await sendPacket(A_OKAY, localId, remoteId);
        continue;
      }
      if (res.cmd === A_CLSE) {
        await sendPacket(A_CLSE, localId, remoteId || res.arg0);
        break;
      }
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    if (totalLen < 100) return false;

    const pngBytes = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
      pngBytes.set(c, pos);
      pos += c.byteLength;
    }

    const blob = new Blob([pngBytes], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    if (ctx && !isStopped) {
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }
      ctx.drawImage(bitmap, 0, 0);
    }
    bitmap.close();
    return true;
  };

  // Capture initial frame
  await captureSingleUsbFrame();

  // Loop frame captures continuously over USB
  const runLoop = async () => {
    while (!isStopped) {
      try {
        await captureSingleUsbFrame();
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  };
  runLoop();

  const stream: MediaStream = (canvas as any).captureStream
    ? (canvas as any).captureStream(25)
    : (canvas as any).mozCaptureStream(25);

  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      device.releaseInterface(ifaceNumber).catch(() => {});
      device.close().catch(() => {});
    } catch {}
  };

  stream.getVideoTracks()[0]?.addEventListener('ended', stop);

  return {
    stream,
    deviceName: device.productName || 'USB Mobile',
    stop,
  };
}
