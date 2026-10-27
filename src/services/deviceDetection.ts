import { ref, update } from 'firebase/database';
import { database } from '../config/firebase';
import type { UserDeviceInfo } from '../types';

/**
 * Maps iPhone viewport dimensions & pixel ratio to exact iPhone commercial models.
 */
function resolveIPhoneModel(width: number, height: number, dpr: number): string {
  // Normalize landscape/portrait to portrait
  const w = Math.round(Math.min(width, height));
  const h = Math.round(Math.max(width, height));
  const match = (tw: number, th: number) => Math.abs(w - tw) <= 3 && Math.abs(h - th) <= 3;

  // Exact resolution check (pt and px)
  if (match(440, 956)) return 'iPhone 16 Pro Max';
  if (match(402, 874)) return 'iPhone 16 Pro';
  if (match(430, 932)) return 'iPhone 16 Plus / 15 Pro Max / 14 Pro Max';
  if (match(393, 852)) return 'iPhone 16 / 15 / 15 Pro / 14 Pro';
  if (match(428, 926)) return 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max';
  if (match(390, 844)) return 'iPhone 14 / 13 / 13 Pro / 12 / 12 Pro';
  if (match(360, 780)) return 'iPhone 13 mini / 12 mini';
  if (match(414, 896)) {
    return dpr >= 2.5 ? 'iPhone 11 Pro Max / XS Max' : 'iPhone 11 / XR';
  }
  if (match(375, 812)) return 'iPhone 11 Pro / XS / X';
  if (match(414, 736)) return 'iPhone 8 Plus / 7 Plus / 6s Plus';
  if (match(375, 667)) return 'iPhone SE (2nd/3rd gen) / iPhone 8 / 7';
  if (match(320, 568)) return 'iPhone SE (1st gen) / 5s';

  return 'iPhone (Apple Mobile)';
}

/**
 * Maps known Android model codes to user-friendly commercial device names.
 */
function resolveAndroidModel(rawModel: string): string {
  const model = rawModel.trim();
  const upper = model.toUpperCase();

  // Samsung Galaxy S series
  if (upper.includes('SM-S928')) return 'Samsung Galaxy S24 Ultra';
  if (upper.includes('SM-S926')) return 'Samsung Galaxy S24+';
  if (upper.includes('SM-S921')) return 'Samsung Galaxy S24';
  if (upper.includes('SM-S918')) return 'Samsung Galaxy S23 Ultra';
  if (upper.includes('SM-S916')) return 'Samsung Galaxy S23+';
  if (upper.includes('SM-S911')) return 'Samsung Galaxy S23';
  if (upper.includes('SM-S908')) return 'Samsung Galaxy S22 Ultra';
  if (upper.includes('SM-S906')) return 'Samsung Galaxy S22+';
  if (upper.includes('SM-S901')) return 'Samsung Galaxy S22';
  if (upper.includes('SM-G998')) return 'Samsung Galaxy S21 Ultra';
  if (upper.includes('SM-G996')) return 'Samsung Galaxy S21+';
  if (upper.includes('SM-G991')) return 'Samsung Galaxy S21';
  if (upper.includes('SM-G988')) return 'Samsung Galaxy S20 Ultra';
  if (upper.includes('SM-G986')) return 'Samsung Galaxy S20+';
  if (upper.includes('SM-G980')) return 'Samsung Galaxy S20';
  if (upper.includes('SM-N986')) return 'Samsung Galaxy Note 20 Ultra';
  if (upper.includes('SM-N981')) return 'Samsung Galaxy Note 20';
  if (upper.includes('SM-N975')) return 'Samsung Galaxy Note 10+';

  // Samsung Galaxy Z Fold & Flip
  if (upper.includes('SM-F956')) return 'Samsung Galaxy Z Fold 6';
  if (upper.includes('SM-F741')) return 'Samsung Galaxy Z Flip 6';
  if (upper.includes('SM-F946')) return 'Samsung Galaxy Z Fold 5';
  if (upper.includes('SM-F731')) return 'Samsung Galaxy Z Flip 5';
  if (upper.includes('SM-F936')) return 'Samsung Galaxy Z Fold 4';
  if (upper.includes('SM-F721')) return 'Samsung Galaxy Z Flip 4';

  // Samsung Galaxy A & M series
  if (upper.includes('SM-A556')) return 'Samsung Galaxy A55 5G';
  if (upper.includes('SM-A546')) return 'Samsung Galaxy A54 5G';
  if (upper.includes('SM-A536')) return 'Samsung Galaxy A53 5G';
  if (upper.includes('SM-A528') || upper.includes('SM-A526') || upper.includes('SM-A525')) return 'Samsung Galaxy A52s / A52';
  if (upper.includes('SM-A356')) return 'Samsung Galaxy A35 5G';
  if (upper.includes('SM-A346')) return 'Samsung Galaxy A34 5G';
  if (upper.includes('SM-A256')) return 'Samsung Galaxy A25 5G';
  if (upper.includes('SM-A245')) return 'Samsung Galaxy A24';
  if (upper.includes('SM-A156') || upper.includes('SM-A155')) return 'Samsung Galaxy A15';
  if (upper.includes('SM-A146') || upper.includes('SM-A145')) return 'Samsung Galaxy A14';
  if (upper.includes('SM-A137') || upper.includes('SM-A135')) return 'Samsung Galaxy A13';
  if (upper.includes('SM-A057') || upper.includes('SM-A055')) return 'Samsung Galaxy A05s / A05';
  if (upper.includes('SM-A047') || upper.includes('SM-A045') || upper.includes('SM-A042')) return 'Samsung Galaxy A04';
  if (upper.startsWith('SM-') || upper.startsWith('SAMSUNG')) return `Samsung Galaxy (${model})`;

  // Google Pixel
  if (/Pixel 9 Pro XL/i.test(model)) return 'Google Pixel 9 Pro XL';
  if (/Pixel 9 Pro/i.test(model)) return 'Google Pixel 9 Pro';
  if (/Pixel 9/i.test(model)) return 'Google Pixel 9';
  if (/Pixel 8 Pro/i.test(model)) return 'Google Pixel 8 Pro';
  if (/Pixel 8a/i.test(model)) return 'Google Pixel 8a';
  if (/Pixel 8/i.test(model)) return 'Google Pixel 8';
  if (/Pixel 7 Pro/i.test(model)) return 'Google Pixel 7 Pro';
  if (/Pixel 7a/i.test(model)) return 'Google Pixel 7a';
  if (/Pixel 7/i.test(model)) return 'Google Pixel 7';
  if (/Pixel 6 Pro/i.test(model)) return 'Google Pixel 6 Pro';
  if (/Pixel 6a/i.test(model)) return 'Google Pixel 6a';
  if (/Pixel 6/i.test(model)) return 'Google Pixel 6';
  if (/Pixel/i.test(model)) return `Google ${model}`;

  // Xiaomi & Redmi & POCO
  if (/23116PN5BC|Xiaomi 14/i.test(model)) return 'Xiaomi 14';
  if (/Xiaomi 13/i.test(model)) return 'Xiaomi 13';
  if (/Redmi Note 13 Pro/i.test(model)) return 'Xiaomi Redmi Note 13 Pro';
  if (/Redmi Note 13/i.test(model)) return 'Xiaomi Redmi Note 13';
  if (/Redmi Note 12 Pro/i.test(model)) return 'Xiaomi Redmi Note 12 Pro';
  if (/Redmi Note 12/i.test(model)) return 'Xiaomi Redmi Note 12';
  if (/Redmi Note 11/i.test(model)) return 'Xiaomi Redmi Note 11';
  if (/POCO F6/i.test(model)) return 'POCO F6';
  if (/POCO X6 Pro/i.test(model)) return 'POCO X6 Pro';
  if (/POCO X6/i.test(model)) return 'POCO X6';
  if (/POCO X5/i.test(model)) return 'POCO X5';
  if (/Redmi/i.test(model)) return `Xiaomi ${model}`;
  if (/POCO/i.test(model)) return `POCO (${model})`;
  if (/Xiaomi/i.test(model) || /Mi /i.test(model)) return `Xiaomi ${model}`;

  // Honor & Huawei
  if (/Honor 200/i.test(model)) return 'Honor 200';
  if (/Honor 90/i.test(model)) return 'Honor 90';
  if (/Honor 70/i.test(model)) return 'Honor 70';
  if (/Honor X9/i.test(model)) return 'Honor X9';
  if (/Honor X8/i.test(model)) return 'Honor X8';
  if (/Honor X7/i.test(model)) return 'Honor X7';
  if (/Magic/i.test(model)) return `Honor ${model}`;
  if (/HONOR/i.test(model)) return model;
  if (/Pura 70/i.test(model)) return 'Huawei Pura 70';
  if (/Mate 60/i.test(model)) return 'Huawei Mate 60';
  if (/Mate 50/i.test(model)) return 'Huawei Mate 50';
  if (/nova 12/i.test(model)) return 'Huawei nova 12';
  if (/nova 11/i.test(model)) return 'Huawei nova 11';
  if (/HUAWEI/i.test(model)) return model;

  // Tecno & Infinix
  if (/Infinix/i.test(model) || /^X68/i.test(model)) return `Infinix (${model})`;
  if (/Tecno|Spark|Camon|Pova/i.test(model) || /^KJ/i.test(model) || /^CK/i.test(model)) return `Tecno (${model})`;

  // OnePlus
  if (/OnePlus 12/i.test(model)) return 'OnePlus 12';
  if (/OnePlus 11/i.test(model)) return 'OnePlus 11';
  if (/OnePlus/i.test(model) || /^CPH/i.test(model)) return model.startsWith('CPH') ? `OnePlus (${model})` : model;

  // Oppo & Realme & Vivo
  if (/Realme/i.test(model) || /^RMX/i.test(model)) return `Realme (${model})`;
  if (/OPPO/i.test(model) || /^CPH/i.test(model)) return `Oppo (${model})`;
  if (/vivo/i.test(model) || /^V2/i.test(model)) return `Vivo (${model})`;

  // Other phones
  if (model.length > 0 && model !== 'Android' && model !== 'K') {
    return model;
  }

  return 'Android Smartphone';
}

/**
 * Detects device hardware model, OS, browser, and form factor.
 */
export async function captureDeviceInfo(): Promise<UserDeviceInfo> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const width = typeof window !== 'undefined' ? (window.screen?.width || window.innerWidth || 0) : 0;
  const height = typeof window !== 'undefined' ? (window.screen?.height || window.innerHeight || 0) : 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const screenStr = `${width}x${height} (@${dpr.toFixed(1)}x)`;

  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  let brand = 'Generic';
  let deviceModel = 'Desktop PC';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';

  // 1. Try High-Entropy User-Agent Client Hints if supported (Chromium Android & Desktop)
  let hintModel = '';
  let hintPlatform = '';
  if (typeof navigator !== 'undefined' && (navigator as any).userAgentData) {
    try {
      const uaData = (navigator as any).userAgentData;
      if (uaData.mobile) deviceType = 'mobile';
      if (typeof uaData.getHighEntropyValues === 'function') {
        const hints = await uaData.getHighEntropyValues(['model', 'platform', 'platformVersion']);
        if (hints.model) hintModel = String(hints.model);
        if (hints.platform) hintPlatform = String(hints.platform);
      }
    } catch {
      // Optional hints
    }
  }

  // 2. Detect Browser
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';

  // 3. Detect iOS (iPhone / iPad / iPod)
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    brand = 'Apple';
    const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIPad) {
      deviceType = 'tablet';
      deviceModel = 'Apple iPad';
    } else {
      deviceType = 'mobile';
      deviceModel = resolveIPhoneModel(width, height, dpr);
    }

    const iosVersionMatch = ua.match(/OS (\d+[_\.]\d+(?:[_\.]\d+)?)/);
    os = iosVersionMatch ? `iOS ${iosVersionMatch[1].replace(/_/g, '.')}` : 'iOS';
    return {
      deviceType,
      deviceModel,
      brand,
      os,
      browser,
      screen: screenStr,
      isMobile: true,
      detectedAt: Date.now(),
    };
  }

  // 4. Detect Android
  const isAndroid = /Android/i.test(ua) || hintPlatform.toLowerCase() === 'android';
  if (isAndroid) {
    deviceType = /Tablet|Tab/i.test(ua) ? 'tablet' : 'mobile';

    // Extract Android OS Version
    const androidVerMatch = ua.match(/Android\s*([0-9\.]+)/i);
    os = androidVerMatch ? `Android ${androidVerMatch[1]}` : 'Android';

    // Extract device model
    let extractedModel = hintModel;
    if (!extractedModel) {
      // Regex parse standard Android UA build model: e.g. "Linux; Android 14; SM-S928B Build/..."
      const modelMatch = ua.match(/Android[^;]+;\s*([^;\)]+?)(?:\s+Build|\s*;|\))/i);
      if (modelMatch && modelMatch[1]) {
        extractedModel = modelMatch[1].trim();
      }
    }

    if (extractedModel) {
      deviceModel = resolveAndroidModel(extractedModel);
      if (/Samsung/i.test(deviceModel)) brand = 'Samsung';
      else if (/Pixel/i.test(deviceModel)) brand = 'Google';
      else if (/Xiaomi|Redmi|POCO/i.test(deviceModel)) brand = 'Xiaomi';
      else if (/Huawei/i.test(deviceModel)) brand = 'Huawei';
      else if (/Honor/i.test(deviceModel)) brand = 'Honor';
      else if (/OnePlus/i.test(deviceModel)) brand = 'OnePlus';
      else brand = 'Android';
    } else {
      deviceModel = 'Android Phone';
      brand = 'Android';
    }

    return {
      deviceType,
      deviceModel,
      brand,
      os,
      browser,
      screen: screenStr,
      isMobile: deviceType === 'mobile',
      detectedAt: Date.now(),
    };
  }

  // 5. Desktop: Windows, macOS, Linux
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 11 / 10';
  else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
  else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    brand = 'Apple';
    deviceModel = 'Apple Mac / MacBook';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    brand = 'Linux';
    deviceModel = 'Linux Computer';
  }

  if (os.startsWith('Windows')) {
    brand = 'Microsoft';
    deviceModel = 'Windows Desktop / Laptop';
  }

  return {
    deviceType: 'desktop',
    deviceModel,
    brand,
    os,
    browser,
    screen: screenStr,
    isMobile: false,
    detectedAt: Date.now(),
  };
}

/**
 * Synchronizes the active user's device info directly to Firebase RTDB profile (`users/${uid}/deviceInfo`).
 */
export async function syncCurrentUserDevice(uid: string): Promise<UserDeviceInfo | null> {
  if (!uid) return null;
  try {
    const dev = await captureDeviceInfo();
    if (dev) {
      await update(ref(database, `users/${uid}`), {
        deviceInfo: dev,
      });
      return dev;
    }
  } catch (err) {
    console.warn('Failed to synchronize user device info:', err);
  }
  return null;
}
