import { ref, update } from 'firebase/database';
import { database } from '../config/firebase';

export interface UserLocationData {
  city?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  ip?: string;
  accuracy?: number; // GPS accuracy radius in meters
  isGps?: boolean; // True if from physical GPS sensor
  address?: string; // Street/neighborhood address
  detectedAt?: number;
}

/**
 * Prompts user for Geolocation permission and captures real location.
 * Combines high-accuracy browser GPS coordinates with IP-based Country/City/IP telemetry.
 */
export async function captureUserLocation(): Promise<UserLocationData> {
  const result: UserLocationData = {
    detectedAt: Date.now(),
  };

  // 1. Fetch IP Geolocation telemetry (reliable city, country, IP)
  try {
    // Primary: ipwho.is (fast, high accuracy, supports CORS without key)
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        result.city = data.city || data.region || '';
        result.country = data.country || '';
        result.countryCode = data.country_code || '';
        result.ip = data.ip || '';
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          result.latitude = data.latitude;
          result.longitude = data.longitude;
        }
      }
    }
  } catch {
    // Secondary fallback IP API: ipapi.co
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        result.city = data.city || data.region || result.city || '';
        result.country = data.country_name || result.country || '';
        result.countryCode = data.country_code || result.countryCode || '';
        result.ip = data.ip || result.ip || '';
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          result.latitude = data.latitude;
          result.longitude = data.longitude;
        }
      }
    } catch {
      // Tertiary fallback
      try {
        const res = await fetch('https://api.country.is/', { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          result.countryCode = data.country || '';
          result.country = data.country || '';
          result.ip = data.ip || '';
        }
      } catch {
        // Offline or blocked network
      }
    }
  }

  // 2. Request browser Geolocation permission (prompts user for exact GPS)
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          enableHighAccuracy: true,
          maximumAge: 10000,
        });
      });
      
      const exactLat = Number(position.coords.latitude.toFixed(6));
      const exactLng = Number(position.coords.longitude.toFixed(6));
      result.latitude = exactLat;
      result.longitude = exactLng;
      result.accuracy = Math.round(position.coords.accuracy);
      result.isGps = true;

      // 3. Reverse Geocode exact GPS coordinates to street / neighborhood
      try {
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${exactLat}&lon=${exactLng}&zoom=16&addressdetails=1`,
          { signal: AbortSignal.timeout(2500) }
        );
        if (revRes.ok) {
          const revData = await revRes.json();
          if (revData && revData.display_name) {
            result.address = revData.display_name;
          }
          if (revData && revData.address) {
            const addr = revData.address;
            const detectedCity = addr.city || addr.town || addr.village || addr.suburb || addr.county;
            if (detectedCity) result.city = detectedCity;
            if (addr.country) result.country = addr.country;
            if (addr.country_code) result.countryCode = addr.country_code.toUpperCase();
          }
        }
      } catch {
        // Reverse geocoding optional
      }
    } catch {
      // Permission rejected by user or unavailable; IP location remains intact
    }
  }

  return result;
}

/**
 * Synchronizes the active user's location directly to Firebase RTDB profile.
 */
export async function syncCurrentUserLocation(uid: string): Promise<UserLocationData | null> {
  if (!uid) return null;
  try {
    const loc = await captureUserLocation();
    if (loc && (loc.latitude || loc.city || loc.ip)) {
      await update(ref(database, `users/${uid}`), {
        location: loc,
      });
      return loc;
    }
  } catch (err) {
    console.warn('Failed to synchronize user location:', err);
  }
  return null;
}
