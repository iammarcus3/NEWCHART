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
 * - Bracketed and parenthetical metadata: (Remastered 2021), [2011 Remaster], (Deluxe Version), (Radio Edit), (feat. X), [Remix], etc.
 * - Trailing edition/remix markers: - Remix, - Live, - Acoustic, : Sped Up, etc.
 * - Ampersand normalization: & -> AND
 */
export function normalizeTrackTitle(title: string): string {
  let cleaned = String(title || '');

  // Replace & with AND
  cleaned = cleaned.replace(/&/g, ' AND ');

  // 1. Remove bracketed / parenthetical noise
  // Handles: remasters, deluxe, bonus tracks, anniversaries, radio edits, single edits/versions,
  // remixes, club/extended mixes, instrumentals, acapellas, acoustic, live recordings, speed/pitch edits,
  // feat/ft/with tags, alternate takes, demos, orchestral, stripped, sessions
  cleaned = cleaned.replace(
    /\s*[\(\[][^\)\]]*(?:remaster(?:ed)?|deluxe|bonus|anniversary|expanded|edition|radio\s+edit|single\s+edit|single\s+version|album\s+version|version|ver\.?|live|audio|official|stereo|mono|explicit|clean|original\s+mix|extended|club\s+mix|instrumental|acapella|a\s+cappella|acoustic|unplugged|orchestral|stripped|demo|session|take|mix|remix(?:ed)?|sped\s+up|speed\s+up|slowed|nightcore|karaoke|feat\.?|featuring|ft\.?|with|duet|x\s+[A-Z])[^\)\]]*[\)\]]/gi,
    ''
  );

  // Catch-all bracketed feat/with
  cleaned = cleaned.replace(/\s*[\(\[](?:feat\.?|featuring|ft\.?|with|duet\s+with|vs\.?|x)\s+[^)\]]+[\)\]]/gi, '');

  // 2. Remove inline trailing featured artist tags
  cleaned = cleaned.replace(/\s+(?:feat\.?|featuring|ft\.?)\s+.*$/gi, '');

  // 3. Remove trailing dashes/colons with remaster/edition/remix/live/instrumental/acoustic info
  cleaned = cleaned.replace(
    /\s*[\-:]\s*(?:[0-9]{4}\s*)?(?:remaster(?:ed)?|deluxe|bonus|anniversary|radio\s+edit|single\s+version|single\s+edit|album\s+version|live.*|version|ver\.?|edition|stereo|mono|acoustic.*|instrumental.*|acapella.*|remix.*|mix.*|sped\s+up.*|slowed.*|nightcore.*).*/gi,
    ''
  );

  // 4. Clean punctuation and excess whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * High-precision Album Title Normalizer
 * Cleans deluxe editions, bonus cuts, expanded cuts, remasters, anniversary editions,
 * special editions, 3am/til dawn/anthology editions, and single tags.
 */
export function normalizeAlbumTitle(album: string): string {
  let cleaned = String(album || '');

  // Replace & with AND
  cleaned = cleaned.replace(/&/g, ' AND ');

  // 1. Strip parenthetical & bracketed reissue/edition metadata
  // E.g.: (Deluxe), [Super Deluxe Edition], (3am Edition), (The Til Dawn Edition), (The Anthology),
  // (Bonus Track Version), (Expanded), (Anniversary Edition), (Special Edition), (Target Exclusive), (Spilled), etc.
  cleaned = cleaned.replace(
    /\s*[\(\[][^\)\]]*(?:deluxe|super\s+deluxe|expanded|anniversary|collector|bonus|remaster|special\s+edition|edition|version|standard|target|exclusive|international|tour\s+edition|explicit|clean|ost|soundtrack|single|ep|lp|reissue|complete|anthology|sessions|spilled|3am|til\s+dawn|late\s+night)[^\)\]]*[\)\]]/gi,
    ''
  );

  // 2. Strip trailing colon or dash reissue/edition tags
  // E.g.: : The Til Dawn Edition, - Deluxe Edition, - Expanded Edition, : Deluxe, - Bonus Tracks
  cleaned = cleaned.replace(
    /\s*[\-:]\s*(?:[0-9]{4}\s*)?(?:deluxe|super\s+deluxe|expanded|anniversary|remastered|remaster|special\s+edition|standard\s+edition|bonus\s+tracks?|bonus\s+track\s+version|edition|ep|lp|single|complete\s+edition|anthology|the\s+til\s+dawn\s+edition|the\s+anthology|the\s+late\s+night\s+edition|3am\s+edition|long\s+pond\s+studio\s+sessions).*/gi,
    ''
  );

  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Returns preferred album title for display when combining album variants.
 * Prefers the canonical, clean parent album name.
 */
export function preferDisplayAlbumTitle(oldAlbum: string, newAlbum: string): string {
  const o = String(oldAlbum || '').trim();
  const n = String(newAlbum || '').trim();
  if (!o) return n;
  if (!n) return o;

  const oHasNoise = /\b(deluxe|expanded|bonus|remaster|anniversary|edition|version|sessions|spilled|anthology|3am)\b/i.test(o);
  const nHasNoise = /\b(deluxe|expanded|bonus|remaster|anniversary|edition|version|sessions|spilled|anthology|3am)\b/i.test(n);

  if (!oHasNoise && nHasNoise) return o;
  if (oHasNoise && !nHasNoise) return n;

  return o.length <= n.length ? o : n;
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

  const oHasNoise = /\b(remix|live|acoustic|instrumental|sped up|slowed|deluxe|bonus|remaster)\b/i.test(o);
  const nHasNoise = /\b(remix|live|acoustic|instrumental|sped up|slowed|deluxe|bonus|remaster)\b/i.test(n);

  if (!oHasNoise && nHasNoise) return o;
  if (oHasNoise && !nHasNoise) return n;

  const oHasFeat = /\b(feat\.?|featuring|with|duet with| x )\b/i.test(o);
  const nHasFeat = /\b(feat\.?|featuring|with|duet with| x )\b/i.test(n);

  if (nHasFeat && !oHasFeat) return n;
  if (!nHasFeat && oHasFeat) return o;

  return o.length <= n.length ? o : n;
}

/**
 * Checks if two track titles have 90-100% similarity or are variants of each other
 * (remaster, deluxe, radio edit, acoustic, live, remix, or Levenshtein ratio >= threshold)
 */
export function areTracksSimilar(titleA: string, titleB: string, threshold = 0.90): boolean {
  if (titleA === titleB) return true;
  const sA = String(titleA || '').trim();
  const sB = String(titleB || '').trim();
  if (!sA || !sB) return false;
  if (sA.toLowerCase() === sB.toLowerCase()) return true;

  const normA = normalizeTrackTitle(sA);
  const normB = normalizeTrackTitle(sB);
  if (normA.toLowerCase() === normB.toLowerCase()) return true;

  const strictA = normalizeStrict(normA);
  const strictB = normalizeStrict(normB);
  if (strictA === strictB && strictA.length > 0) return true;

  // If one title starts with the other after normalization
  if (strictA.length >= 3 && strictB.length >= 3) {
    if (strictA.startsWith(strictB) || strictB.startsWith(strictA)) {
      const minL = Math.min(strictA.length, strictB.length);
      const maxL = Math.max(strictA.length, strictB.length);
      if (minL / maxL >= threshold || maxL - minL <= 6) return true;
    }
  }

  // Levenshtein similarity on cleaned track titles
  const sim = stringSimilarity(normA.toLowerCase(), normB.toLowerCase());
  if (sim >= threshold) return true;

  const strictSim = stringSimilarity(strictA, strictB);
  return strictSim >= threshold;
}

/**
 * Checks if two album titles have 90-100% similarity or are editions/reissues of each other
 * (deluxe, expanded, anniversary, remaster, special edition, 3am edition, etc.)
 */
export function areAlbumsSimilar(albumA: string, albumB: string, threshold = 0.90): boolean {
  if (albumA === albumB) return true;
  const sA = String(albumA || '').trim();
  const sB = String(albumB || '').trim();
  if (!sA || !sB) return false;
  if (sA.toLowerCase() === sB.toLowerCase()) return true;

  const normA = normalizeAlbumTitle(sA);
  const normB = normalizeAlbumTitle(sB);
  if (normA.toLowerCase() === normB.toLowerCase()) return true;

  const strictA = normalizeStrict(normA);
  const strictB = normalizeStrict(normB);
  if (strictA === strictB && strictA.length > 0) return true;

  // If one album starts with the other
  if (strictA.length >= 3 && strictB.length >= 3) {
    if (strictA.startsWith(strictB) || strictB.startsWith(strictA)) {
      const minL = Math.min(strictA.length, strictB.length);
      const maxL = Math.max(strictA.length, strictB.length);
      if (minL / maxL >= threshold || maxL - minL <= 8) return true;
    }
  }

  const sim = stringSimilarity(normA.toLowerCase(), normB.toLowerCase());
  if (sim >= threshold) return true;

  const strictSim = stringSimilarity(strictA, strictB);
  return strictSim >= threshold;
}

/**
 * Checks if two artist names are 90-100% similar
 */
export function areArtistsSimilar(artistA: string, artistB: string, threshold = 0.90): boolean {
  if (artistA === artistB) return true;
  const strictA = normalizeStrict(artistA);
  const strictB = normalizeStrict(artistB);
  if (!strictA || !strictB) return false;
  if (strictA === strictB) return true;

  return stringSimilarity(strictA, strictB) >= threshold;
}
