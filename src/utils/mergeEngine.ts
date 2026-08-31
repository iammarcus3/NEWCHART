import { Scrobble } from '../types/music';

/**
 * Fast, lightweight string normalization for high-performance timeline deduplication.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/[\s\-_.,/\\()[\]{}'":;!?~`@#$%^&*+=<>]/g, '');
}

/**
 * Generates a deterministic unique ID for a scrobble based on timestamp and track identity.
 */
export function generateScrobbleId(artist: string, trackOrTitle: string, timestamp: number): string {
  const a = artist ? artist.toLowerCase().trim() : 'unknown_artist';
  const t = trackOrTitle ? trackOrTitle.toLowerCase().trim() : 'unknown_track';
  return `${timestamp}_${a}:::${t}`;
}

/**
 * Deduplicates an incoming batch of scrobbles against existing vault records.
 * Runs in O(N + M) time with minimal memory allocations.
 */
export function mergeScrobbleBatches(
  existingVaultScrobbles: Scrobble[],
  incomingScrobbles: Scrobble[]
): { merged: Scrobble[]; addedCount: number } {
  const seenKeys = new Set<string>();
  const merged: Scrobble[] = [];

  // Add existing scrobbles
  for (let i = 0; i < existingVaultScrobbles.length; i++) {
    const s = existingVaultScrobbles[i];
    const key = generateScrobbleId(s.artist, s.title, s.timestamp);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(s);
    }
  }

  let addedCount = 0;

  // Merge incoming scrobbles
  for (let i = 0; i < incomingScrobbles.length; i++) {
    const inc = incomingScrobbles[i];
    const key = generateScrobbleId(inc.artist, inc.title, inc.timestamp);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push({
        ...inc,
        id: inc.id || `scrobble_${key}`,
      });
      addedCount++;
    }
  }

  // Return chronologically descending (newest first)
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return { merged, addedCount };
}
