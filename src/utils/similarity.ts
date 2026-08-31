/**
 * Advanced Levenshtein & Fuzzy Similarity Utility for Track & Album Deduplication
 * Designed for 97-99% accuracy duplicate, remaster, and variant detection.
 */

// LRU/Map memoization cache to prevent redundant Levenshtein matrix computations across large catalogs
const similarityCache = new Map<string, number>();
const MAX_CACHE_ENTRIES = 50000;

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Swap to ensure n is the shorter string to minimize array allocations
  if (m < n) {
    return levenshteinDistance(b, a);
  }

  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (aChar === b.charCodeAt(j - 1) ? 0 : 1) // substitution
      );
      prev = temp;
    }
  }

  return dp[n];
}

/**
 * Calculates normalized string similarity ratio between 0.0 and 1.0 (1.0 = identical)
 * Includes fast-path length difference pruning and memoization.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const s1 = String(a || '').trim();
  const s2 = String(b || '').trim();
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = len1 > len2 ? len1 : len2;
  if (maxLen === 0) return 1.0;

  // Fast pruning: If length difference alone makes similarity < 0.90, return early without running matrix
  const lenDiff = Math.abs(len1 - len2);
  if (lenDiff / maxLen > 0.15) {
    return Math.max(0, 1 - lenDiff / maxLen);
  }

  const cacheKey = len1 <= len2 ? `${s1}::${s2}` : `${s2}::${s1}`;
  const cached = similarityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const dist = levenshteinDistance(s1, s2);
  const result = Math.max(0, 1 - dist / maxLen);

  if (similarityCache.size >= MAX_CACHE_ENTRIES) {
    // Clear half of cache to manage memory
    const keys = Array.from(similarityCache.keys()).slice(0, 10000);
    for (const k of keys) similarityCache.delete(k);
  }
  similarityCache.set(cacheKey, result);

  return result;
}

/**
 * Canonical text normalizer:
 * - Converts to uppercase
 * - Strips all non-alphanumeric characters
 */
export function normalizeStrict(str: string): string {
  return String(str || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * High-precision Track Title Normalizer
 * Cleans out:
 * - Bracketed and parenthetical metadata: (Remastered 2021), [2011 Remaster], (Deluxe Version), (Radio Edit), etc.
 * - Featured artists: (feat. X), (ft. Y), (with Z)
 * - Trailing dashes: - 2011 Remaster, - Deluxe Edition, - Live
 * - Ampersand normalization: & -> AND
 */
export function normalizeTrackTitle(title: string): string {
  let cleaned = String(title || '');

  // Replace & with AND
  cleaned = cleaned.replace(/&/g, ' AND ');

  // 1. Remove bracketed / parenthetical noise
  cleaned = cleaned.replace(
    /\s*[\(\[](?:[0-9]{4}\s*)?(?:remaster(?:ed)?|deluxe|bonus(?:\s+track)?|anniversary|expanded|edition|radio\s+edit|single\s+edit|single\s+version|version|live|audio|official(?:\s+audio)?|stereo|mono|explicit|clean|original\s+mix|extended\s+mix|club\s+mix|instrumental|acoustic)[\)\]]/gi,
    ''
  );

  // 2. Remove featured artist tags in parentheses/brackets (feat. X, with Y, ft. Z, duet with W, x V)
  cleaned = cleaned.replace(/\s*[\(\[](?:feat\.?|featuring|ft\.?|with|duet\s+with|vs\.?|x)\s+[^)\]]+[\)\]]/gi, '');

  // 3. Remove inline trailing featured artist tags
  cleaned = cleaned.replace(/\s+(?:feat\.?|featuring|ft\.?)\s+.*$/gi, '');

  // 4. Remove trailing dashes with remaster/edition info (e.g. " - 2011 Remaster", " - Remastered", " - Deluxe")
  cleaned = cleaned.replace(
    /\s*-\s*(?:[0-9]{4}\s*)?(?:remaster(?:ed)?|deluxe|bonus|anniversary|radio\s+edit|live|version|edition|stereo|mono|acoustic).*/gi,
    ''
  );

  // 5. Clean punctuation and excess whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * High-precision Album Title Normalizer
 */
export function normalizeAlbumTitle(album: string): string {
  let cleaned = String(album || '');

  // Replace & with AND
  cleaned = cleaned.replace(/&/g, ' AND ');

  // Strip brackets & common reissue tags
  cleaned = cleaned.replace(
    /\s*[\(\[](?:[0-9]{4}\s*)?(?:deluxe(?:\s+edition)?|expanded(?:\s+edition)?|anniversary(?:\s+edition)?|bonus(?:\s+tracks)?|remaster(?:ed)?|special\s+edition|international\s+version|ep|lp)[\)\]]/gi,
    ''
  );

  cleaned = cleaned.replace(
    /\s*-\s*(?:[0-9]{4}\s*)?(?:deluxe|expanded|anniversary|remastered|special\s+edition|ep|lp).*/gi,
    ''
  );

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Returns preferred title for display when combining variants
 * Prefers the cleaner title or title with featured artist credited cleanly.
 */
export function preferDisplayTitle(oldTitle: string, newTitle: string): string {
  const o = String(oldTitle || '').trim();
  const n = String(newTitle || '').trim();
  if (!o) return n;
  if (!n) return o;

  const oHasFeat = /\b(feat\.?|featuring|with|duet with| x )\b/i.test(o);
  const nHasFeat = /\b(feat\.?|featuring|with|duet with| x )\b/i.test(n);

  if (nHasFeat && !oHasFeat) return n;
  if (!nHasFeat && oHasFeat) return o;

  // Otherwise prefer the one without messy remaster timestamps if available
  const oHasRemaster = /\b(remaster|deluxe|anniversary)\b/i.test(o);
  const nHasRemaster = /\b(remaster|deluxe|anniversary)\b/i.test(n);
  if (!nHasRemaster && oHasRemaster) return n;
  if (!oHasRemaster && nHasRemaster) return o;

  return n.length >= o.length ? n : o;
}
