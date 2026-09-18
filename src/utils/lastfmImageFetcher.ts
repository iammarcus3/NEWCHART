/**
 * Last.fm & Universal Music Photo & Artwork Service
 * Pulls authentic artist, album, and track photography from Last.fm API with rotating key pools,
 * fallback to Last.fm top albums/tracks, iTunes high-resolution search (600x600),
 * persistent client-side caching, in-flight request deduplication, and zero-missing-photo guarantee.
 */

export interface PhotoCacheData {
  artists: Record<string, string>; // artistKey -> image url
  albums: Record<string, string>;  // artist:::album -> image url
  tracks: Record<string, string>;  // artist:::track -> image url
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

const MAX_PERSISTED_ENTRIES_PER_TYPE = 2500;

// In-flight deduplication map so simultaneous requests for the same entity share a single network call
const inFlightRequests = new Map<string, Promise<string | null>>();

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
  }, 500);
}

/**
 * Validates if an image URL is a genuine, high-quality music photo
 * and not an empty placeholder or Unsplash stock photo.
 */
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
 * Transforms standard 100x100 iTunes thumbnails to crisp 600x600 album artwork
 */
function upscaleItunesUrl(url: string): string {
  if (!url) return url;
  return url.replace(/\/[0-9]+x[0-9]+bb\./, '/600x600bb.').replace(/100x100bb\./, '600x600bb.');
}

/**
 * Extracts photo URL from Last.fm image array.
 * Prioritizes: mega -> extralarge -> large -> medium -> small
 */
export function extractLowResLastfmImage(imageArray: any, fallback?: string): string | undefined {
  if (!Array.isArray(imageArray) || imageArray.length === 0) {
    return fallback;
  }

  const preferredSizes = ['mega', 'extralarge', 'large', 'medium', 'small'];
  for (const size of preferredSizes) {
    const item = imageArray.find((img: any) => img.size === size);
    if (item?.['#text'] && isValidImageUrl(item['#text'])) {
      return item['#text'];
    }
  }

  for (const img of imageArray) {
    const url = img?.['#text'] || (typeof img === 'string' ? img : '');
    if (isValidImageUrl(url)) {
      return url;
    }
  }

  return fallback;
}

/**
 * Fetch artist photo from Last.fm with fallback to artist top albums and iTunes
 */
export async function fetchLastfmArtistPhoto(
  artist: string,
  customApiKey?: string
): Promise<string | null> {
  const cleanArtist = (artist || '').trim();
  if (!cleanArtist) return null;

  const key = cleanArtist.toLowerCase();
  if (memoryCache.artists[key] && isValidImageUrl(memoryCache.artists[key])) {
    return memoryCache.artists[key];
  }

  const inFlightKey = `artist:::${key}`;
  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey)!;
  }

  const fetchPromise = (async (): Promise<string | null> => {
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
      } catch (e) {}
    }

    // 2. Query Last.fm artist.gettopalbums for leading album artwork
    for (const apiKey of apiKeys) {
      try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(
          cleanArtist
        )}&api_key=${apiKey}&format=json&autocorrect=1&limit=2`;

        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json().catch(() => null);
        const albums = data?.topalbums?.album;
        if (Array.isArray(albums) && albums.length > 0) {
          for (const alb of albums) {
            const photo = extractLowResLastfmImage(alb?.image);
            if (photo) {
              memoryCache.artists[key] = photo;
              persistCache();
              return photo;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Query iTunes Search for crisp album artwork of this artist (600x600)
    try {
      const itunesAlbumUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanArtist
      )}&entity=album&limit=1`;
      const res = await fetch(itunesAlbumUrl);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawArt = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
        if (rawArt) {
          const photo = upscaleItunesUrl(rawArt);
          if (isValidImageUrl(photo)) {
            memoryCache.artists[key] = photo;
            persistCache();
            return photo;
          }
        }
      }
    } catch (e) {}

    // 4. Fallback: Query iTunes Search for artist entity
    try {
      const itunesArtistUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanArtist
      )}&entity=musicArtist&limit=1`;
      const res = await fetch(itunesArtistUrl);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawArt = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
        if (rawArt) {
          const photo = upscaleItunesUrl(rawArt);
          if (isValidImageUrl(photo)) {
            memoryCache.artists[key] = photo;
            persistCache();
            return photo;
          }
        }
      }
    } catch (e) {}

    // 5. Fallback: Query iTunes Search for top song by artist
    try {
      const itunesSongUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanArtist
      )}&entity=song&limit=1`;
      const res = await fetch(itunesSongUrl);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawArt = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
        if (rawArt) {
          const photo = upscaleItunesUrl(rawArt);
          if (isValidImageUrl(photo)) {
            memoryCache.artists[key] = photo;
            persistCache();
            return photo;
          }
        }
      }
    } catch (e) {}

    return null;
  })();

  inFlightRequests.set(inFlightKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(inFlightKey);
  }
}

/**
 * Fetch album artwork from Last.fm or iTunes
 */
export async function fetchLastfmAlbumPhoto(
  artist: string,
  album: string,
  customApiKey?: string
): Promise<string | null> {
  const cleanArtist = (artist || '').trim();
  const cleanAlbum = (album || '').trim();
  if (!cleanArtist || !cleanAlbum) return null;

  const key = `${cleanArtist.toLowerCase()}:::${cleanAlbum.toLowerCase()}`;
  if (memoryCache.albums[key] && isValidImageUrl(memoryCache.albums[key])) {
    return memoryCache.albums[key];
  }

  const inFlightKey = `album:::${key}`;
  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey)!;
  }

  const fetchPromise = (async (): Promise<string | null> => {
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
      } catch (e) {}
    }

    // 2. Query Last.fm album.search
    for (const apiKey of apiKeys) {
      try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(
          cleanAlbum
        )}&api_key=${apiKey}&format=json&limit=2`;

        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json().catch(() => null);
        const matches = data?.results?.albummatches?.album;
        if (Array.isArray(matches) && matches.length > 0) {
          for (const m of matches) {
            const photo = extractLowResLastfmImage(m?.image);
            if (photo) {
              memoryCache.albums[key] = photo;
              persistCache();
              return photo;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Query iTunes Search for album artwork (600x600)
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        `${cleanArtist} ${cleanAlbum}`
      )}&entity=album&limit=1`;
      const res = await fetch(itunesUrl);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawArt = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
        if (rawArt) {
          const photo = upscaleItunesUrl(rawArt);
          if (isValidImageUrl(photo)) {
            memoryCache.albums[key] = photo;
            persistCache();
            return photo;
          }
        }
      }
    } catch (e) {}

    // 4. Fallback: Query iTunes Search for album without artist qualifier
    try {
      const itunesUrl2 = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanAlbum
      )}&entity=album&limit=1`;
      const res = await fetch(itunesUrl2);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawArt = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
        if (rawArt) {
          const photo = upscaleItunesUrl(rawArt);
          if (isValidImageUrl(photo)) {
            memoryCache.albums[key] = photo;
            persistCache();
            return photo;
          }
        }
      }
    } catch (e) {}

    // 5. Fallback: Cross-entity inherit artist photo
    const artistPhoto = await fetchLastfmArtistPhoto(cleanArtist, customApiKey);
    if (artistPhoto && isValidImageUrl(artistPhoto)) {
      memoryCache.albums[key] = artistPhoto;
      persistCache();
      return artistPhoto;
    }

    return null;
  })();

  inFlightRequests.set(inFlightKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(inFlightKey);
  }
}

/**
 * Fetch track cover art from Last.fm, track's album, or iTunes
 */
export async function fetchLastfmTrackPhoto(
  artist: string,
  title: string,
  customApiKey?: string
): Promise<string | null> {
  const cleanArtist = (artist || '').trim();
  const cleanTitle = (title || '').trim();
  if (!cleanArtist || !cleanTitle) return null;

  const key = `${cleanArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
  if (memoryCache.tracks[key] && isValidImageUrl(memoryCache.tracks[key])) {
    return memoryCache.tracks[key];
  }

  const inFlightKey = `track:::${key}`;
  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey)!;
  }

  const fetchPromise = (async (): Promise<string | null> => {
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
        const imageArray = data?.track?.album?.image || data?.track?.image;
        if (imageArray) {
          const photo = extractLowResLastfmImage(imageArray);
          if (photo) {
            memoryCache.tracks[key] = photo;
            persistCache();
            return photo;
          }
        }
      } catch (e) {}
    }

    // 2. Query Last.fm track.search
    for (const apiKey of apiKeys) {
      try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(
          cleanTitle
        )}&artist=${encodeURIComponent(cleanArtist)}&api_key=${apiKey}&format=json&limit=2`;

        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json().catch(() => null);
        const tracks = data?.results?.trackmatches?.track;
        if (Array.isArray(tracks) && tracks.length > 0) {
          for (const trk of tracks) {
            const photo = extractLowResLastfmImage(trk?.image);
            if (photo) {
              memoryCache.tracks[key] = photo;
              persistCache();
              return photo;
            }
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Query iTunes Search for song artwork (600x600)
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        `${cleanArtist} ${cleanTitle}`
      )}&entity=song&limit=1`;
      const res = await fetch(itunesUrl);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const rawArt = data?.results?.[0]?.artworkUrl100 || data?.results?.[0]?.artworkUrl60;
        if (rawArt) {
          const photo = upscaleItunesUrl(rawArt);
          if (isValidImageUrl(photo)) {
            memoryCache.tracks[key] = photo;
            persistCache();
            return photo;
          }
        }
      }
    } catch (e) {}

    // 4. Fallback: Inherit artist photo
    const artistPhoto = await fetchLastfmArtistPhoto(cleanArtist, customApiKey);
    if (artistPhoto && isValidImageUrl(artistPhoto)) {
      memoryCache.tracks[key] = artistPhoto;
      persistCache();
      return artistPhoto;
    }

    return null;
  })();

  inFlightRequests.set(inFlightKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(inFlightKey);
  }
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
    if (memoryCache.artists[cleanArtist]) return memoryCache.artists[cleanArtist];
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

  // 2. Trigger asynchronous background fetch from Last.fm if not already in flight
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

  // 4. Return an aesthetic dynamic vinyl SVG data URL with the item's initial
  const initial = (title || album || artist || 'M').charAt(0).toUpperCase();
  const hue = Math.abs(
    (cleanArtist || 'a').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  ) % 360;

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="hsl(${hue}, 60%, 15%)"/><stop offset="100%" stop-color="hsl(${(hue + 40) % 360}, 70%, 8%)"/></linearGradient></defs><rect width="300" height="300" rx="24" fill="url(%23g)"/><circle cx="150" cy="150" r="110" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="20"/><circle cx="150" cy="150" r="70" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/><circle cx="150" cy="150" r="42" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/><circle cx="150" cy="150" r="12" fill="rgba(0,0,0,0.8)"/><text x="150" y="270" fill="rgba(255,255,255,0.7)" font-family="sans-serif" font-weight="900" font-size="28" text-anchor="middle" letter-spacing="2">${initial}</text></svg>`;
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

  const concurrency = 5;
  for (let i = 0; i < total; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (item) => {
        try {
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
        } catch (e) {}
      })
    );

    if (onProgress) {
      const progress = Math.min(100, Math.round(((i + batch.length) / total) * 100));
      onProgress(progress, updatedCount);
    }

    // Gentle pacing to respect rate limits
    await new Promise((r) => setTimeout(r, 40));
  }

  persistCache();
  return { updatedCount };
}
