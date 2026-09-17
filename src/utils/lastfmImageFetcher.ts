/**
 * Last.fm Low-Resolution Photo & Artwork Service
 * Pulls low-resolution artist, album, and track photos (medium ~64px, small ~34px, large ~174px)
 * from Last.fm API with rotating key pools, persistent client-side caching, and zero-auth fallbacks.
 */

export interface PhotoCacheData {
  artists: Record<string, string>; // artistKey -> low-res image url
  albums: Record<string, string>;  // artist:::album -> low-res image url
  tracks: Record<string, string>;  // artist:::track -> low-res image url
}

const STORAGE_CACHE_KEY = 'yourhot100_photo_cache';

const DEFAULT_API_KEYS = [
  'b25b959554ed7605827dddb7961140ec',
  'c7429188e406f52e5052981ce81b0a88',
  '4cb0e3a5b4dc88c35b612147d6f3c6c0',
  '4437a346ef2741544a49c6691c95b6c3',
  '2c6856d5a10e1e1ad634148c4bbbba29',
  'a7114b3d8d67ec16ba7d10b757e1b9b1',
];

import { safeLocalStorageGet, safeLocalStorageSet } from './safeStorage';

// In-memory runtime cache
let memoryCache: PhotoCacheData = {
  artists: {},
  albums: {},
  tracks: {},
};

const MAX_PERSISTED_ENTRIES_PER_TYPE = 1000;

// Initialize cache from safe storage
try {
  const saved = safeLocalStorageGet(STORAGE_CACHE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object') {
      memoryCache = {
        artists: { ...(parsed.artists || {}) },
        albums: { ...(parsed.albums || {}) },
        tracks: { ...(parsed.tracks || {}) },
      };
    }
  }
} catch (e) {
  // Ignore storage access errors
}

function trimObjectEntries(obj: Record<string, string>, max: number): Record<string, string> {
  const keys = Object.keys(obj);
  if (keys.length <= max) return obj;
  const trimmed: Record<string, string> = {};
  const keepKeys = keys.slice(keys.length - max);
  for (const k of keepKeys) {
    trimmed[k] = obj[k];
  }
  return trimmed;
}

// Debounced save to safe storage
let saveTimeout: any = null;
function persistCache() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lastfm-photo-cached'));
  }
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const compactCache: PhotoCacheData = {
        artists: trimObjectEntries(memoryCache.artists, MAX_PERSISTED_ENTRIES_PER_TYPE),
        albums: trimObjectEntries(memoryCache.albums, MAX_PERSISTED_ENTRIES_PER_TYPE),
        tracks: trimObjectEntries(memoryCache.tracks, MAX_PERSISTED_ENTRIES_PER_TYPE),
      };
      safeLocalStorageSet(STORAGE_CACHE_KEY, JSON.stringify(compactCache));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lastfm-photo-cached'));
      }
    } catch (e) {
      console.warn('Photo cache quota limit reached');
    }
  }, 1000);
}

/**
 * Extracts low-res photo URL from Last.fm image array.
 * Prioritizes: extralarge -> large -> medium -> small
 */
export function extractLowResLastfmImage(imageArray: any, fallback?: string): string | undefined {
  if (!Array.isArray(imageArray) || imageArray.length === 0) {
    return fallback;
  }

  const preferredSizes = ['extralarge', 'large', 'medium', 'small'];
  for (const size of preferredSizes) {
    const item = imageArray.find((img: any) => img.size === size);
    if (item?.['#text'] && isValidImageUrl(item['#text'])) {
      return item['#text'];
    }
  }

  // 5. Any valid URL in the array
  for (const img of imageArray) {
    const url = img?.['#text'] || (typeof img === 'string' ? img : '');
    if (isValidImageUrl(url)) {
      return url;
    }
  }

  return fallback;
}

export function isValidImageUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  // Exclude empty Last.fm placeholder GIFs (2a96cbd8b46e442fc41c2b86b821562f is Last.fm default blank avatar)
  if (trimmed.includes('2a96cbd8b46e442fc41c2b86b821562f')) return false;
  // Exclude unsplash placeholders
  if (trimmed.includes('images.unsplash.com')) return false;
  return true;
}

/**
 * Fetch low-res artist photo from Last.fm (or fast fallback)
 */
export async function fetchLastfmArtistPhoto(
  artist: string,
  customApiKey?: string
): Promise<string | null> {
  const cleanArtist = artist.trim();
  if (!cleanArtist) return null;

  const key = cleanArtist.toLowerCase();
  if (memoryCache.artists[key]) {
    return memoryCache.artists[key];
  }

  const apiKeys = [customApiKey?.trim(), ...DEFAULT_API_KEYS].filter(
    (k): k is string => Boolean(k && k.length > 5)
  );

  // 1. Query Last.fm artist.getinfo
  for (const apiKey of apiKeys) {
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(
        cleanArtist
      )}&api_key=${apiKey}&format=json&autocorrect=1`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json().catch(() => null);
      if (data?.artist?.image) {
        const photo = extractLowResLastfmImage(data.artist.image);
        if (photo) {
          memoryCache.artists[key] = photo;
          persistCache();
          return photo;
        }
      }
    } catch (e) {
      // Continue to next key or fallback
    }
  }

  // 2. Fallback: Query iTunes Search for low-res 60x60 / 100x100 artwork
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      cleanArtist
    )}&entity=musicArtist&limit=1`;
    const res = await fetch(itunesUrl);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.results?.[0]?.artworkUrl60 || data?.results?.[0]?.artworkUrl100) {
        const photo = data.results[0].artworkUrl60 || data.results[0].artworkUrl100;
        if (isValidImageUrl(photo)) {
          memoryCache.artists[key] = photo;
          persistCache();
          return photo;
        }
      }
    }
  } catch (e) {}

  // 3. Fallback: Search song artwork by this artist on iTunes
  try {
    const itunesSongUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      cleanArtist
    )}&entity=song&limit=1`;
    const res = await fetch(itunesSongUrl);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const photo = data?.results?.[0]?.artworkUrl60 || data?.results?.[0]?.artworkUrl100;
      if (photo && isValidImageUrl(photo)) {
        memoryCache.artists[key] = photo;
        persistCache();
        return photo;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Fetch low-res album artwork from Last.fm
 */
export async function fetchLastfmAlbumPhoto(
  artist: string,
  album: string,
  customApiKey?: string
): Promise<string | null> {
  const cleanArtist = artist.trim();
  const cleanAlbum = album.trim();
  if (!cleanArtist || !cleanAlbum) return null;

  const key = `${cleanArtist.toLowerCase()}:::${cleanAlbum.toLowerCase()}`;
  if (memoryCache.albums[key]) {
    return memoryCache.albums[key];
  }

  const apiKeys = [customApiKey?.trim(), ...DEFAULT_API_KEYS].filter(
    (k): k is string => Boolean(k && k.length > 5)
  );

  // 1. Query Last.fm album.getinfo
  for (const apiKey of apiKeys) {
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=${encodeURIComponent(
        cleanArtist
      )}&album=${encodeURIComponent(cleanAlbum)}&api_key=${apiKey}&format=json&autocorrect=1`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json().catch(() => null);
      if (data?.album?.image) {
        const photo = extractLowResLastfmImage(data.album.image);
        if (photo) {
          memoryCache.albums[key] = photo;
          persistCache();
          return photo;
        }
      }
    } catch (e) {
      // Continue to next key
    }
  }

  // 2. Fallback: Query iTunes Search for low-res album art
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${cleanArtist} ${cleanAlbum}`
    )}&entity=album&limit=1`;
    const res = await fetch(itunesUrl);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const photo = data?.results?.[0]?.artworkUrl60 || data?.results?.[0]?.artworkUrl100;
      if (photo && isValidImageUrl(photo)) {
        memoryCache.albums[key] = photo;
        persistCache();
        return photo;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Fetch low-res track cover art from Last.fm
 */
export async function fetchLastfmTrackPhoto(
  artist: string,
  title: string,
  customApiKey?: string
): Promise<string | null> {
  const cleanArtist = artist.trim();
  const cleanTitle = title.trim();
  if (!cleanArtist || !cleanTitle) return null;

  const key = `${cleanArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
  if (memoryCache.tracks[key]) {
    return memoryCache.tracks[key];
  }

  const apiKeys = [customApiKey?.trim(), ...DEFAULT_API_KEYS].filter(
    (k): k is string => Boolean(k && k.length > 5)
  );

  // 1. Query Last.fm track.getinfo
  for (const apiKey of apiKeys) {
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=track.getinfo&artist=${encodeURIComponent(
        cleanArtist
      )}&track=${encodeURIComponent(cleanTitle)}&api_key=${apiKey}&format=json&autocorrect=1`;

      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json().catch(() => null);
      // Track image or track's album image
      const imageArray = data?.track?.album?.image || data?.track?.image;
      if (imageArray) {
        const photo = extractLowResLastfmImage(imageArray);
        if (photo) {
          memoryCache.tracks[key] = photo;
          persistCache();
          return photo;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // 2. Fallback: Query iTunes Search for low-res track cover
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      `${cleanArtist} ${cleanTitle}`
    )}&entity=song&limit=1`;
    const res = await fetch(itunesUrl);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const photo = data?.results?.[0]?.artworkUrl60 || data?.results?.[0]?.artworkUrl100;
      if (photo && isValidImageUrl(photo)) {
        memoryCache.tracks[key] = photo;
        persistCache();
        return photo;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Get current in-memory cache snapshot
 */
export function getPhotoCacheSnapshot(): PhotoCacheData {
  return { ...memoryCache };
}

/**
 * Manually update or inject a photo into the persistent cache
 */
export function updatePhotoCache(
  type: 'artist' | 'album' | 'track',
  key: string,
  url: string
): void {
  if (!isValidImageUrl(url)) return;
  const cleanKey = key.trim().toLowerCase();
  if (type === 'artist') {
    memoryCache.artists[cleanKey] = url;
  } else if (type === 'album') {
    memoryCache.albums[cleanKey] = url;
  } else if (type === 'track') {
    memoryCache.tracks[cleanKey] = url;
  }
  persistCache();
}

/**
 * Resolves an image for every song, artist, and album across the entire site.
 * Checks item coverArt -> cache -> cross-entity fallback (track -> album -> artist)
 * -> initiates non-blocking background fetch from Last.fm if missing.
 */
export function resolvePersistentImage(
  type: 'artist' | 'album' | 'track',
  artist: string,
  title?: string,
  album?: string,
  existingCoverArt?: string
): string {
  return getOrFetchUniversalImage({ type, artist, title, album, existingCoverArt });
}

export function getOrFetchUniversalImage(params: {
  type: 'artist' | 'album' | 'track';
  artist: string;
  title?: string;
  album?: string;
  existingCoverArt?: string;
}): string {
  const { type, artist, title, album, existingCoverArt } = params;
  if (isValidImageUrl(existingCoverArt)) {
    return existingCoverArt!;
  }

  const cleanArtist = (artist || '').trim().toLowerCase();
  const cleanTitle = (title || '').trim().toLowerCase();
  const cleanAlbum = (album || '').trim().toLowerCase();

  // 1. Direct cache lookup
  if (type === 'artist' && memoryCache.artists[cleanArtist]) {
    return memoryCache.artists[cleanArtist];
  }
  if (type === 'album' && cleanAlbum) {
    const albKey = `${cleanArtist}:::${cleanAlbum}`;
    if (memoryCache.albums[albKey]) return memoryCache.albums[albKey];
  }
  if (type === 'track' && cleanTitle) {
    const trkKey = `${cleanArtist}:::${cleanTitle}`;
    if (memoryCache.tracks[trkKey]) return memoryCache.tracks[trkKey];
    // Fallback to track's album
    if (cleanAlbum) {
      const albKey = `${cleanArtist}:::${cleanAlbum}`;
      if (memoryCache.albums[albKey]) return memoryCache.albums[albKey];
    }
    // Fallback to artist
    if (memoryCache.artists[cleanArtist]) return memoryCache.artists[cleanArtist];
  }

  // 2. Trigger asynchronous background fetch from Last.fm if not already cached
  if (type === 'artist' && cleanArtist) {
    fetchLastfmArtistPhoto(artist).catch(() => {});
  } else if (type === 'album' && cleanArtist && cleanAlbum) {
    fetchLastfmAlbumPhoto(artist, album!).catch(() => {});
  } else if (type === 'track' && cleanArtist && cleanTitle) {
    fetchLastfmTrackPhoto(artist, title!).catch(() => {});
    if (cleanAlbum) fetchLastfmAlbumPhoto(artist, album!).catch(() => {});
  }

  // 3. Fallback to artist image if album or track
  if (memoryCache.artists[cleanArtist]) {
    return memoryCache.artists[cleanArtist];
  }

  // 4. Guaranteed high-quality aesthetic vinyl/music artwork fallback
  return type === 'artist'
    ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&h=300&fit=crop&q=80';
}

/**
 * Batch enrich low-res photos for items in charts
 */
export async function batchEnrichPhotos(
  items: Array<{
    type: 'artist' | 'album' | 'track';
    artist: string;
    title?: string;
    album?: string;
  }>,
  onProgress?: (progressPercent: number, fetchedCount: number) => void,
  customApiKey?: string
): Promise<{ updatedCount: number }> {
  let updatedCount = 0;
  const total = items.length;
  if (total === 0) return { updatedCount: 0 };

  const concurrency = 4;
  for (let i = 0; i < total; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (item) => {
        if (item.type === 'artist') {
          const res = await fetchLastfmArtistPhoto(item.artist, customApiKey);
          if (res) updatedCount++;
        } else if (item.type === 'album' && item.album) {
          const res = await fetchLastfmAlbumPhoto(item.artist, item.album, customApiKey);
          if (res) updatedCount++;
        } else if (item.type === 'track' && item.title) {
          const res = await fetchLastfmTrackPhoto(item.artist, item.title, customApiKey);
          if (res) updatedCount++;
        }
      })
    );

    if (onProgress) {
      const progress = Math.min(100, Math.round(((i + batch.length) / total) * 100));
      onProgress(progress, updatedCount);
    }

    // Small delay to be polite with rate limits
    await new Promise((r) => setTimeout(r, 60));
  }

  persistCache();
  return { updatedCount };
}
