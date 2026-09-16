import { Scrobble } from '../types/music';
import { updatePhotoCache } from './lastfmImageFetcher';

/**
 * Fast, lightweight string normalization for high-performance timeline deduplication.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/[\s\-_.,/\\()[\]{}'":;!?~`@#$%^&*+=<>]/g, '');
}

/**
 * Normalizes timestamp to UTC seconds.
 */
export function normalizeTimestamp(rawTs: any): number {
  if (typeof rawTs === 'number') {
    return rawTs > 1e11 ? Math.floor(rawTs / 1000) : rawTs;
  }
  if (typeof rawTs === 'string') {
    const parsed = Date.parse(rawTs);
    if (!isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
    const num = Number(rawTs);
    if (!isNaN(num)) {
      return num > 1e11 ? Math.floor(num / 1000) : num;
    }
  }
  return Math.floor(Date.now() / 1000);
}

/**
 * Generates a deterministic unique ID for a scrobble based on timestamp and track identity.
 */
export function generateScrobbleId(artist: string, trackOrTitle: string, timestamp: number): string {
  const a = normalizeString(artist) || 'unknownartist';
  const t = normalizeString(trackOrTitle) || 'unknowntrack';
  const ts = normalizeTimestamp(timestamp);
  return `${ts}_${a}:::${t}`;
}

/**
 * High-precision scrobble deduplication and batch merging.
 * - Eliminates duplicate scrobbler client double-submissions (plays of the exact same track within a 35-second window).
 * - Matches exact plays across different import sources (CSV, JSON, Last.fm API).
 * - Preserves authentic repeated listens (plays separated by normal track durations).
 */
export function mergeScrobbleBatches(
  existingVaultScrobbles: Scrobble[],
  incomingScrobbles: Scrobble[]
): { merged: Scrobble[]; addedCount: number } {
  // Map of normalized track identity -> list of timestamps
  const trackPlayTimestamps = new Map<string, number[]>();
  const merged: Scrobble[] = [];

  // Helper to check if a play is a double-submission duplicate (< 35s apart)
  const isDuplicateSubmission = (trackKey: string, ts: number): boolean => {
    const list = trackPlayTimestamps.get(trackKey);
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      if (Math.abs(list[i] - ts) < 35) {
        return true;
      }
    }
    return false;
  };

  const recordPlay = (trackKey: string, ts: number) => {
    let list = trackPlayTimestamps.get(trackKey);
    if (!list) {
      list = [];
      trackPlayTimestamps.set(trackKey, list);
    }
    list.push(ts);
  };

  // Add existing scrobbles
  for (let i = 0; i < existingVaultScrobbles.length; i++) {
    const s = existingVaultScrobbles[i];
    const ts = normalizeTimestamp(s.timestamp);
    const trackKey = `${normalizeString(s.artist)}:::${normalizeString(s.title)}`;
    if (!isDuplicateSubmission(trackKey, ts)) {
      recordPlay(trackKey, ts);
      merged.push({
        ...s,
        timestamp: ts,
      });
    }
  }

  // Index existing merged scrobbles by track key for comprehensive artwork & album backfilling
  const trackToExistingScrobblesMap = new Map<string, Scrobble[]>();
  for (let i = 0; i < merged.length; i++) {
    const item = merged[i];
    const key = `${normalizeString(item.artist)}:::${normalizeString(item.title)}`;
    let list = trackToExistingScrobblesMap.get(key);
    if (!list) {
      list = [];
      trackToExistingScrobblesMap.set(key, list);
    }
    list.push(item);
  }

  let addedCount = 0;

  // Merge incoming scrobbles non-destructively
  for (let i = 0; i < incomingScrobbles.length; i++) {
    const inc = incomingScrobbles[i];
    const ts = normalizeTimestamp(inc.timestamp);
    const trackKey = `${normalizeString(inc.artist)}:::${normalizeString(inc.title)}`;

    // Sync artwork to global persistent photo cache
    if (inc.coverArt && inc.coverArt.startsWith('http')) {
      updatePhotoCache('track', `${inc.artist}:::${inc.title}`, inc.coverArt);
      updatePhotoCache('artist', inc.artist, inc.coverArt);
      if (inc.album) {
        updatePhotoCache('album', `${inc.artist}:::${inc.album}`, inc.coverArt);
      }
    }

    if (!isDuplicateSubmission(trackKey, ts)) {
      // New play discovered: add it to fill blank weeks / missing records
      recordPlay(trackKey, ts);
      const newScrobble: Scrobble = {
        ...inc,
        timestamp: ts,
        id: inc.id || `scrobble_${ts}_${trackKey}`,
      };
      merged.push(newScrobble);
      addedCount++;

      let list = trackToExistingScrobblesMap.get(trackKey);
      if (!list) {
        list = [];
        trackToExistingScrobblesMap.set(trackKey, list);
      }
      list.push(newScrobble);
    } else {
      // Existing play matched: backfill coverArt and album if missing
      const matchingExistingPlays = trackToExistingScrobblesMap.get(trackKey) || [];
      for (const existing of matchingExistingPlays) {
        if (!existing.coverArt && inc.coverArt) {
          existing.coverArt = inc.coverArt;
        }
        if (!existing.album && inc.album) {
          existing.album = inc.album;
        }
      }
    }
  }

  // Return chronologically descending (newest first)
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return { merged, addedCount };
}
