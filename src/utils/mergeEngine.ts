import { Scrobble } from '../types/music';

/**
 * Normalizes artist, track, and album strings for clean comparison.
 * Removes common remaster tags, accents, trailing whitespace, and special characters.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\b(remastered|remaster|deluxe edition|bonus track|live at|radio edit|explicit|clean)\b.*$/gi, '') // Strip remaster/edition tags
    .replace(/[^a-z0-9]/g, ''); // Strip all punctuation and spaces for strict matching
}

/**
 * Generates a deterministic unique ID for a scrobble based on timestamp and normalized track identity.
 */
export function generateScrobbleId(artist: string, trackOrTitle: string, timestamp: number): string {
  const cleanArtist = normalizeString(artist);
  const cleanTrack = normalizeString(trackOrTitle);
  return `${timestamp}-${cleanArtist}-${cleanTrack}`;
}

/**
 * Deduplicates an incoming batch of scrobbles against existing vault records.
 * Ensures existing user data is NEVER overwritten or destroyed.
 */
export function mergeScrobbleBatches(
  existingVaultScrobbles: Scrobble[],
  incomingScrobbles: Scrobble[]
): { merged: Scrobble[]; addedCount: number } {
  const vaultMap = new Map<string, Scrobble>();

  // Add existing scrobbles
  for (const s of existingVaultScrobbles) {
    const key = generateScrobbleId(s.artist, s.title, s.timestamp);
    vaultMap.set(key, s);
  }

  let addedCount = 0;

  // Merge incoming scrobbles
  for (const inc of incomingScrobbles) {
    const key = generateScrobbleId(inc.artist, inc.title, inc.timestamp);
    if (!vaultMap.has(key)) {
      vaultMap.set(key, {
        ...inc,
        id: inc.id || `scrobble_${key}`,
      });
      addedCount++;
    }
  }

  // Return chronologically descending (newest first)
  const merged = Array.from(vaultMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  return { merged, addedCount };
}
