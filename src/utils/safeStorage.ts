/**
 * Bulletproof localStorage wrapper to prevent DOMException: QuotaExceededError,
 * silent storage exceptions, and application crashes on large catalogs.
 */

const BULKY_CACHE_KEYS = [
  'yourhot100_photo_cache',
  'yourhot100_genre_tag_cache',
  'yourhot100_scrobbles',
  'groovevault_scrobbles',
  'yourhot100_library_synced',
];

export function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageGetJSON<T>(key: string, fallback?: T): T | null {
  try {
    const raw = safeLocalStorageGet(key);
    if (!raw) return fallback !== undefined ? fallback : null;
    return JSON.parse(raw) as T;
  } catch {
    return fallback !== undefined ? fallback : null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    // Quota recovery mechanism: clear non-critical thumbnail/genre caches and retry
    try {
      for (const k of BULKY_CACHE_KEYS) {
        if (k !== key) {
          localStorage.removeItem(k);
        }
      }
      localStorage.setItem(key, value);
      return true;
    } catch {
      console.warn(`[safeStorage] Storage quota reached, cannot write key "${key}". State retained in memory.`);
      return false;
    }
  }
}

export function safeLocalStorageSetJSON(key: string, value: any): boolean {
  try {
    const serialized = JSON.stringify(value);
    return safeLocalStorageSet(key, serialized);
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.removeItem(key);
  } catch {}
}
