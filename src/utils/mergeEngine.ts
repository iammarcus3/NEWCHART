import { Scrobble } from '../types/music';

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

  let addedCount = 0;

  // Merge incoming scrobbles
  for (let i = 0; i < incomingScrobbles.length; i++) {
    const inc = incomingScrobbles[i];
    const ts = normalizeTimestamp(inc.timestamp);
    const trackKey = `${normalizeString(inc.artist)}:::${normalizeString(inc.title)}`;
    if (!isDuplicateSubmission(trackKey, ts)) {
      recordPlay(trackKey, ts);
      merged.push({
        ...inc,
        timestamp: ts,
        id: inc.id || `scrobble_${ts}_${trackKey}`,
      });
      addedCount++;
    }
  }

  // Return chronologically descending (newest first)
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return { merged, addedCount };
}
