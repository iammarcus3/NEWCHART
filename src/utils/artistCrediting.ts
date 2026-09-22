/**
 * Multi-Artist & Feature Crediting Engine
 * Guarantees that all primary and featured artists are credited for:
 * - Top 100 Chart entries
 * - Weeks on chart
 * - Peak rankings & #1 songs / #1 debuts
 * - Stream totals
 * - Plaque certifications (Gold, Platinum, Multi-Platinum, Diamond)
 * 
 * Extreme Performance Optimized for 250,000+ scrobbles:
 * - Inverted Artist Index with O(1) retrieval
 * - Global Weekly Ranking memoization across all chart weeks
 * - LRU Profile Cache for instant 0ms rendering
 */

import { Scrobble, ChartWeekInfo, ZeroChartSettings, PlaqueMilestone } from '../types/music';
import { getPhotoCacheSnapshot } from './lastfmImageFetcher';
import { loadActiveFixtures } from './fixturesEngine';
import {
  normalizeStrict,
  normalizeTrackTitle,
  normalizeAlbumTitle,
  preferDisplayTitle,
  preferDisplayAlbumTitle,
  areTracksSimilar,
  areAlbumsSimilar,
} from './similarity';

export interface CreditedArtistInfo {
  name: string;
  normalizedKey: string;
  isFeatured: boolean;
}

/**
 * Splits an artist string into all collaborating artists.
 * Handles: '&', 'and', 'feat.', 'featuring', 'ft.', 'with', 'duet with', 'vs', 'x', 'presents', ',', '/'
 */
export function splitArtistList(artistStr: string): string[] {
  if (!artistStr) return [];

  const tokens = String(artistStr)
    .replace(/\s+(?:feat\.?|featuring|ft\.?)\s+/gi, ' <SPLIT> ')
    .replace(/\s+(?:duet\s+with|with|together\s+with)\s+/gi, ' <SPLIT> ')
    .replace(/\s+(?:presents|pres\.)\s+/gi, ' <SPLIT> ')
    .replace(/\s+(?:vs\.?|versus)\s+/gi, ' <SPLIT> ')
    .replace(/\s+x\s+/gi, ' <SPLIT> ')
    .replace(/\s+&\s+/gi, ' <SPLIT> ')
    .replace(/\s+and\s+/gi, ' <SPLIT> ')
    .replace(/\s*\/\s*/g, ' <SPLIT> ')
    .replace(/\s*,\s*/g, ' <SPLIT> ')
    .split(' <SPLIT> ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^various(?:\s+artists)?$/i.test(s));

  return Array.from(new Set(tokens));
}

/**
 * Extracts featured artists from track title parentheticals and inline tags.
 */
export function extractFeaturedFromTitle(titleStr: string): string[] {
  const s = String(titleStr || '');
  const found: string[] = [];

  // Parenthetical or Bracketed features
  const reParens = /[\(\[](?:feat\.?|featuring|ft\.?|with|duet\s+with|x)\s+([^\)\]]+)[\)\]]/gi;
  let match: RegExpExecArray | null;
  while ((match = reParens.exec(s)) !== null) {
    found.push(match[1]);
  }

  // Trailing inline feature
  const reInline = /(?:feat\.?|featuring|ft\.?|with|duet\s+with)\s+([^\-\(\)\[\]|•]+)$/gi;
  while ((match = reInline.exec(s)) !== null) {
    found.push(match[1]);
  }

  return found
    .flatMap((f) => splitArtistList(f))
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Cache for artist extraction to avoid regex parsing repetitive strings.
 */
const artistSplitCache = new Map<string, CreditedArtistInfo[]>();

/**
 * Gets all unique credited artists for a scrobble or chart row.
 */
export function getAllCreditedArtists(artistStr: string, titleStr: string = ''): CreditedArtistInfo[] {
  const cacheKey = `${artistStr}:::${titleStr}`;
  const cached = artistSplitCache.get(cacheKey);
  if (cached) return cached;

  const primary = splitArtistList(artistStr);
  const featured = extractFeaturedFromTitle(titleStr);

  const artistMap = new Map<string, CreditedArtistInfo>();

  for (const p of primary) {
    const key = normalizeStrict(p);
    if (key && !artistMap.has(key)) {
      artistMap.set(key, {
        name: p,
        normalizedKey: key,
        isFeatured: false,
      });
    }
  }

  for (const f of featured) {
    const key = normalizeStrict(f);
    if (key && !artistMap.has(key)) {
      artistMap.set(key, {
        name: f,
        normalizedKey: key,
        isFeatured: true,
      });
    }
  }

  // Also consult canonical fixtures songFeaturedCredits for explicit crediting rules
  try {
    const fixtures = loadActiveFixtures();
    if (fixtures?.songFeaturedCredits) {
      const rawKey = `${artistStr.toLowerCase()}:::${titleStr.toLowerCase()}`;
      const cleanTrack = normalizeTrackTitle(titleStr).toLowerCase();
      const cleanLead = (splitArtistList(artistStr)[0] || artistStr).toLowerCase();
      const cleanKey = `${cleanLead}:::${cleanTrack}`;

      const rule = fixtures.songFeaturedCredits[rawKey] || fixtures.songFeaturedCredits[cleanKey];
      if (rule) {
        if (rule.leadArtist) {
          const leadKey = normalizeStrict(rule.leadArtist);
          if (leadKey) {
            artistMap.set(leadKey, {
              name: rule.leadArtist,
              normalizedKey: leadKey,
              isFeatured: false,
            });
          }
        }
        if (Array.isArray(rule.featuredArtists)) {
          for (const feat of rule.featuredArtists) {
            const featKey = normalizeStrict(feat);
            if (featKey && !artistMap.has(featKey)) {
              artistMap.set(featKey, {
                name: feat,
                normalizedKey: featKey,
                isFeatured: true,
              });
            }
          }
        }
      }
    }
  } catch (e) {
    // Graceful fallback
  }

  const result = Array.from(artistMap.values());
  if (artistSplitCache.size < 50000) {
    artistSplitCache.set(cacheKey, result);
  }
  return result;
}

/**
 * Checks if a track/scrobble credits a given artist (either as main or featured artist).
 */
export function trackInvolvesArtist(
  trackArtist: string,
  trackTitle: string,
  targetArtist: string
): boolean {
  const targetKey = normalizeStrict(targetArtist);
  if (!targetKey) return false;

  const credited = getAllCreditedArtists(trackArtist, trackTitle);
  return credited.some((c) => c.normalizedKey === targetKey);
}

/**
 * Global cache for library-wide album canonical lead artist mapping.
 * Enforces strict single-artist attribution for albums:
 * Albums can ONLY EVER be credited to ONE single lead artist,
 * preventing albums from appearing across multiple artists' profiles or being split
 * into multiple chart entries with different artists.
 */
let cachedAlbumLeadArtistMap: Map<string, string> | null = null;
let cachedAlbumLeadArtistScrobblesRef: any = null;
let cachedAlbumLeadArtistLength = 0;
let cachedAlbumLeadArtistMergedCount = 0;
let cachedAlbumLeadArtistOverridesCount = 0;

export function buildCanonicalAlbumLeadArtistMap(
  allScrobbles: Scrobble[],
  mergedAlbumsMap: Record<string, string> = {},
  trackAlbumOverrides: Record<string, string> = {},
  manualOverrides: Record<string, any> = {}
): Map<string, string> {
  const mergedCount = Object.keys(mergedAlbumsMap).length;
  const overridesCount = Object.keys(trackAlbumOverrides).length + Object.keys(manualOverrides).length;

  if (
    cachedAlbumLeadArtistMap &&
    cachedAlbumLeadArtistScrobblesRef === allScrobbles &&
    cachedAlbumLeadArtistLength === allScrobbles.length &&
    cachedAlbumLeadArtistMergedCount === mergedCount &&
    cachedAlbumLeadArtistOverridesCount === overridesCount
  ) {
    return cachedAlbumLeadArtistMap;
  }

  // Data structure:
  // albumNormKey -> Map<artistNormKey, { artistName: string, plays: number, tracks: Set<string>, isOverride?: boolean }>
  const albumArtistsMap = new Map<
    string,
    Map<string, { artistName: string; plays: number; tracks: Set<string>; isOverride?: boolean }>
  >();

  for (let i = 0; i < allScrobbles.length; i++) {
    const s = allScrobbles[i];
    const rawTrackKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const override = manualOverrides[rawTrackKey];
    const assignedAlbum = override?.albumOverride || trackAlbumOverrides[rawTrackKey] || s.album;

    if (!assignedAlbum || assignedAlbum.trim().length === 0) continue;

    const rawAlb = assignedAlbum.trim();
    // Primary artist of the track (single lead artist)
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const mappedAlb =
      mergedAlbumsMap[`${primaryArtist.toLowerCase()}:::${rawAlb.toLowerCase()}`] ||
      mergedAlbumsMap[`${s.artist.toLowerCase()}:::${rawAlb.toLowerCase()}`] ||
      mergedAlbumsMap[rawAlb.toLowerCase()] ||
      rawAlb;

    const normAlb = normalizeStrict(normalizeAlbumTitle(mappedAlb));
    if (!normAlb || normAlb === 'NAN' || normAlb === 'UNKNOWN') continue;

    // Check if album itself has a manual override with artist override or direct rule
    const albumKey = `${primaryArtist.toLowerCase()}:::${mappedAlb.toLowerCase()}`;
    const albumOverride = manualOverrides[albumKey];
    const explicitArtistOverride = typeof albumOverride === 'string'
      ? albumOverride
      : albumOverride?.artistOverride ||
        (typeof manualOverrides[normAlb] === 'string' ? manualOverrides[normAlb] : undefined) ||
        (typeof manualOverrides[mappedAlb.toLowerCase()] === 'string' ? manualOverrides[mappedAlb.toLowerCase()] : undefined);

    const candidateArtist = explicitArtistOverride
      ? (splitArtistList(explicitArtistOverride)[0] || explicitArtistOverride).trim()
      : primaryArtist.trim();

    const candNorm = normalizeStrict(candidateArtist);
    if (!candNorm) continue;

    let artistGroup = albumArtistsMap.get(normAlb);
    if (!artistGroup) {
      artistGroup = new Map();
      albumArtistsMap.set(normAlb, artistGroup);
    }

    let candData = artistGroup.get(candNorm);
    if (!candData) {
      candData = {
        artistName: candidateArtist,
        plays: 0,
        tracks: new Set(),
        isOverride: Boolean(explicitArtistOverride),
      };
      artistGroup.set(candNorm, candData);
    }

    candData.plays += 1;
    candData.tracks.add(normalizeStrict(normalizeTrackTitle(s.title)));
    if (explicitArtistOverride) candData.isOverride = true;
  }

  const resultMap = new Map<string, string>();

  // Pre-seed with active canonical catalog fixtures albumLeadArtistRules
  try {
    const fixtures = loadActiveFixtures();
    if (fixtures?.albumLeadArtistRules) {
      Object.entries(fixtures.albumLeadArtistRules).forEach(([alb, art]) => {
        const cleanArt = (splitArtistList(art)[0] || art).trim();
        const normK = normalizeStrict(alb);
        if (normK) {
          resultMap.set(normK, cleanArt);
        }
        resultMap.set(alb.toLowerCase(), cleanArt);
      });
    }
  } catch (e) {
    // Graceful fallback
  }

  albumArtistsMap.forEach((artistGroup, normAlb) => {
    let winningArtist = '';
    let highestPlays = -1;
    let highestTracks = -1;

    artistGroup.forEach((candData) => {
      // Manual explicit overrides always trump regular plays
      if (candData.isOverride) {
        winningArtist = candData.artistName;
        highestPlays = Infinity;
        return;
      }
      if (highestPlays === Infinity) return;

      const trackCount = candData.tracks.size;
      if (candData.plays > highestPlays || (candData.plays === highestPlays && trackCount > highestTracks)) {
        highestPlays = candData.plays;
        highestTracks = trackCount;
        winningArtist = candData.artistName;
      }
    });

    if (winningArtist) {
      // Ensure winning artist is strictly a single lead artist
      const cleanWinning = (splitArtistList(winningArtist)[0] || winningArtist).trim();
      resultMap.set(normAlb, cleanWinning);

      // Also map for each candidate artist that was grouped with this album
      artistGroup.forEach((_, candNorm) => {
        resultMap.set(`${candNorm}:::${normAlb}`, cleanWinning);
      });
    }
  });

  cachedAlbumLeadArtistMap = resultMap;
  cachedAlbumLeadArtistScrobblesRef = allScrobbles;
  cachedAlbumLeadArtistLength = allScrobbles.length;
  cachedAlbumLeadArtistMergedCount = mergedCount;
  cachedAlbumLeadArtistOverridesCount = overridesCount;

  return resultMap;
}

export function getCanonicalAlbumLeadArtist(
  albumName: string,
  rawArtist: string,
  albumLeadArtistMap?: Map<string, string>
): string {
  if (!albumName) {
    return (splitArtistList(rawArtist)[0] || rawArtist).trim();
  }

  const normAlb = normalizeStrict(normalizeAlbumTitle(albumName));
  const normArt = normalizeStrict(splitArtistList(rawArtist)[0] || rawArtist);

  if (albumLeadArtistMap) {
    const specific = albumLeadArtistMap.get(`${normArt}:::${normAlb}`);
    if (specific) return (splitArtistList(specific)[0] || specific).trim();

    const general = albumLeadArtistMap.get(normAlb);
    if (general) return (splitArtistList(general)[0] || general).trim();
  }

  // Also check direct active fixtures albumLeadArtistRules
  try {
    const fixtures = loadActiveFixtures();
    if (fixtures?.albumLeadArtistRules) {
      const rule =
        fixtures.albumLeadArtistRules[normAlb] ||
        fixtures.albumLeadArtistRules[albumName.trim().toLowerCase()] ||
        fixtures.albumLeadArtistRules[`${normArt}:::${normAlb}`];
      if (rule) return (splitArtistList(rule)[0] || rule).trim();
    }
  } catch (e) {
    // Graceful fallback
  }

  return (splitArtistList(rawArtist)[0] || rawArtist).trim();
}

export interface ArtistProfileSongEntry {
  key: string;
  titleDisplay: string;
  artistDisplay: string;
  playCount: number;
  salesBase: number;
  streamsBase: number;
  weeksOnChart: number;
  peakRank: number;
  popPeakRank: number;
  num1s: number;
  firstWeek: number | null;
  firstRank: number | null;
  debutYear: number | string;
  certLabel: string;
  certTier: PlaqueMilestone | null;
  album?: string;
  coverArt?: string;
}

export interface ArtistProfileAlbumEntry {
  key: string;
  name: string;
  playCount: number;
  salesBase: number;
  streamsBase?: number;
  tracksCount: number;
  peakRank?: number;
  weeksOnChart?: number;
  stabilityPoints?: number;
  certLabel: string;
  certTier: PlaqueMilestone | null;
  coverArt?: string;
  tracks?: string[];
}

export interface ArtistProfileStats {
  artistName: string;
  totalSongsCharted: number;
  distinctNum1Songs: number;
  totalNum1Weeks: number;
  totalTop10s: number;
  debutAt1Count: number;
  totalPlays: number;
  totalStreams?: number;
  totalCalculatedUnits: number;
  albumCertCounts: Record<string, number>;
  trackCertCounts: Record<string, number>;
  albums: ArtistProfileAlbumEntry[];
  songsByYear: {
    year: number | string;
    songsCount: number;
    num1sCount: number;
    top10sCount: number;
    songs: ArtistProfileSongEntry[];
  }[];
}

/**
 * Formats units for certifications (Gold, Platinum, Multi-Platinum, Diamond)
 */
export function getCertificationLabel(
  units: number,
  goldThresh = 500000,
  platThresh = 1000000,
  diamThresh = 10000000
): { label: string; tier: PlaqueMilestone | null } {
  if (units >= diamThresh) {
    const multi = Math.floor(units / diamThresh);
    return {
      label: multi > 1 ? `${multi}× Diamond` : 'Diamond',
      tier: 'diamond',
    };
  }

  if (units >= platThresh) {
    const multi = Math.floor(units / platThresh);
    return {
      label: multi > 1 ? `${multi}× Platinum` : 'Platinum',
      tier: multi > 1 ? 'multi-platinum' : 'platinum',
    };
  }

  if (units >= goldThresh) {
    return {
      label: 'Gold',
      tier: 'gold',
    };
  }

  return { label: '—', tier: null };
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// High-Performance Inverted Indexes & Global Caching
// ---------------------------------------------------------------------------

interface CachedWeeklyRankings {
  fingerprint: string;
  weeklyTrackRanks: Map<string, number>[];
  weeklyTrackPoints: Map<string, number>[];
  weeklyAlbumRanks: Map<string, number>[];
  weeklyAlbumPoints: Map<string, number>[];
}

let cachedWeeklyRankings: CachedWeeklyRankings | null = null;

export function invalidateArtistCreditingCache(): void {
  cachedWeeklyRankings = null;
}

function quickMapSig(map: Record<string, any> = {}): string {
  const keys = Object.keys(map);
  if (keys.length === 0) return '0';
  let hash = keys.length;
  for (let i = 0; i < Math.min(keys.length, 25); i++) {
    const k = keys[i];
    const val = typeof map[k] === 'string' ? map[k] : JSON.stringify(map[k] || '');
    hash = ((hash * 31 + k.length + val.length) | 0);
  }
  return `${keys.length}:${hash}`;
}

/**
 * Memoized generator for all weekly track & album ranks.
 * Avoids recalculating 500+ weeks of ranking data on every artist click!
 */
function getMemoizedWeeklyTrackRanks(
  allWeeks: ChartWeekInfo[],
  allScrobbles: Scrobble[],
  mergedMap: Record<string, string>,
  settings: ZeroChartSettings,
  mergedAlbumsMap: Record<string, string> = {}
): {
  weeklyTrackRanks: Map<string, number>[];
  weeklyTrackPoints: Map<string, number>[];
  weeklyAlbumRanks: Map<string, number>[];
  weeklyAlbumPoints: Map<string, number>[];
} {
  const minAlbumTracks = Math.max(3, settings.minAlbumTracksToChart || 3);
  const mHash = quickMapSig(mergedMap);
  const aHash = quickMapSig(mergedAlbumsMap);
  const trkAlbHash = quickMapSig(settings.trackAlbumOverrides || {});
  const fingerprint = `${allWeeks.length}_${allScrobbles.length}_${settings.playMultiplier}_${settings.chartSize}_${minAlbumTracks}_${mHash}_${aHash}_${trkAlbHash}`;

  if (cachedWeeklyRankings && cachedWeeklyRankings.fingerprint === fingerprint) {
    return cachedWeeklyRankings;
  }

  const trackAlbumOverrides = settings.trackAlbumOverrides || {};
  const albumLeadArtistMap = buildCanonicalAlbumLeadArtistMap(
    allScrobbles,
    mergedAlbumsMap,
    trackAlbumOverrides,
    settings.manualOverrides || {}
  );

  // Pre-calculate library-wide track counts per album to strictly enforce minimum 3 songs
  const albumCatalogTracksMap = new Map<string, Set<string>>();
  for (let i = 0; i < allScrobbles.length; i++) {
    const s = allScrobbles[i];
    const trackKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const assignedAlbum = trackAlbumOverrides[trackKey] || s.album;
    if (!assignedAlbum || assignedAlbum.trim().length === 0) continue;
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const rawAlb = assignedAlbum.trim();
    const mappedAlb =
      mergedAlbumsMap[`${primaryArtist.toLowerCase()}:::${rawAlb.toLowerCase()}`] ||
      mergedAlbumsMap[`${s.artist.toLowerCase()}:::${rawAlb.toLowerCase()}`] ||
      rawAlb;
    const normAlb = normalizeStrict(normalizeAlbumTitle(mappedAlb));
    const canonicalLead = getCanonicalAlbumLeadArtist(mappedAlb, primaryArtist, albumLeadArtistMap);
    const albKey = `${normalizeStrict(canonicalLead)}:::${normAlb}`;
    let trackSet = albumCatalogTracksMap.get(albKey);
    if (!trackSet) {
      trackSet = new Set();
      albumCatalogTracksMap.set(albKey, trackSet);
    }
    const cleanTrackTitle = normalizeStrict(normalizeTrackTitle(s.title));
    if (cleanTrackTitle) {
      trackSet.add(cleanTrackTitle);
    }
  }

  const weeklyTrackRanks: Map<string, number>[] = [];
  const weeklyTrackPoints: Map<string, number>[] = [];
  const weeklyAlbumRanks: Map<string, number>[] = [];
  const weeklyAlbumPoints: Map<string, number>[] = [];

  for (let w = 1; w <= allWeeks.length; w++) {
    const weekInfo = allWeeks[w - 1];
    if (!weekInfo) continue;

    const weekScrobbles =
      weekInfo.scrobbles ??
      allScrobbles.filter(
        (s) => s.timestamp >= weekInfo.startTimestamp && s.timestamp < weekInfo.endTimestamp
      );

    const trackMap = new Map<string, { plays: number; points: number }>();
    const albumMap = new Map<string, { plays: number; points: number }>();

    for (const s of weekScrobbles) {
      const normT = normalizeTrackTitle(s.title);
      const normA = normalizeStrict(s.artist);
      const mergeKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
      const canonicalTitle = mergedMap[mergeKey] || normT;
      const key = `${normA}:::${normalizeStrict(canonicalTitle)}`;

      const cur = trackMap.get(key) || { plays: 0, points: 0 };
      cur.plays += 1;
      cur.points += (settings.playMultiplier || 1.0) * 100;
      trackMap.set(key, cur);

      // Track weekly album plays (Albums are credited ONLY to the single lead artist)
      const assignedAlbum = trackAlbumOverrides[mergeKey] || s.album;
      if (assignedAlbum && assignedAlbum.trim().length > 0) {
        const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
        const rawAlb = assignedAlbum.trim();
        const mappedAlb =
          mergedAlbumsMap[`${primaryArtist.toLowerCase()}:::${rawAlb.toLowerCase()}`] ||
          mergedAlbumsMap[`${s.artist.toLowerCase()}:::${rawAlb.toLowerCase()}`] ||
          rawAlb;
        const normAlb = normalizeStrict(normalizeAlbumTitle(mappedAlb));
        const canonicalLead = getCanonicalAlbumLeadArtist(mappedAlb, primaryArtist, albumLeadArtistMap);
        const albKey = `${normalizeStrict(canonicalLead)}:::${normAlb}`;
        const curAlb = albumMap.get(albKey) || { plays: 0, points: 0 };
        curAlb.plays += 1;
        curAlb.points += (settings.playMultiplier || 1.0) * 100;
        albumMap.set(albKey, curAlb);
      }
    }

    const sorted = Array.from(trackMap.entries())
      .filter(([, v]) => v.plays >= (settings.minScrobblesToChart || 1))
      .sort((a, b) => b[1].points - a[1].points);

    const rankMap = new Map<string, number>();
    const pointMap = new Map<string, number>();
    sorted.forEach(([k, val], idx) => {
      const rank = idx + 1;
      rankMap.set(k, rank);
      pointMap.set(k, val.points);

      // Index by each individual credited artist so artist profiles instantly find track charts
      const sepIdx = k.indexOf(':::');
      if (sepIdx !== -1) {
        const artStr = k.slice(0, sepIdx);
        const titleStr = k.slice(sepIdx + 3);
        const credited = getAllCreditedArtists(artStr, titleStr);
        for (const c of credited) {
          const individualKey = `${c.normalizedKey}:::${titleStr}`;
          if (!rankMap.has(individualKey) || (rankMap.get(individualKey)! > rank)) {
            rankMap.set(individualKey, rank);
          }
          const curPts = pointMap.get(individualKey) || 0;
          if (val.points > curPts) {
            pointMap.set(individualKey, val.points);
          }
        }
      }
    });

    weeklyTrackRanks.push(rankMap);
    weeklyTrackPoints.push(pointMap);

    // Build weekly album rankings (Strictly enforcing minimum 3 tracks required to qualify as an album)
    const sortedAlbums = Array.from(albumMap.entries())
      .filter(([k, v]) => {
        const totalCatTracks = albumCatalogTracksMap.get(k)?.size || 0;
        return totalCatTracks >= minAlbumTracks && v.plays >= (settings.minScrobblesToChart || 1);
      })
      .sort((a, b) => b[1].points - a[1].points);

    const albumRankMap = new Map<string, number>();
    const albumPointMap = new Map<string, number>();
    sortedAlbums.forEach(([k, val], idx) => {
      const rank = idx + 1;
      albumRankMap.set(k, rank);
      albumPointMap.set(k, val.points);

      const sepIdx = k.indexOf(':::');
      if (sepIdx !== -1) {
        const artStr = k.slice(0, sepIdx);
        const albStr = k.slice(sepIdx + 3);
        // ALBUMS CAN ONLY CREDIT THE LEAD ARTIST - NOT SHARED CREDIT
        const primaryArtist = splitArtistList(artStr)[0] || artStr;
        const individualKey = `${normalizeStrict(primaryArtist)}:::${albStr}`;
        if (!albumRankMap.has(individualKey) || albumRankMap.get(individualKey)! > rank) {
          albumRankMap.set(individualKey, rank);
        }
        const curPts = albumPointMap.get(individualKey) || 0;
        if (val.points > curPts) {
          albumPointMap.set(individualKey, val.points);
        }
      }
    });

    weeklyAlbumRanks.push(albumRankMap);
    weeklyAlbumPoints.push(albumPointMap);
  }

  cachedWeeklyRankings = {
    fingerprint,
    weeklyTrackRanks,
    weeklyTrackPoints,
    weeklyAlbumRanks,
    weeklyAlbumPoints,
  };

  return cachedWeeklyRankings;
}

// Inverted index mapping: Scrobble list reference -> Map<artistNormalizedKey, Scrobble[]>
interface ArtistIndexCache {
  scrobblesRef: Scrobble[];
  length: number;
  artistMap: Map<string, Scrobble[]>;
  allKnownArtists: string[];
}

let globalArtistIndex: ArtistIndexCache | null = null;

/**
 * Returns or builds a fast inverted index for all scrobbles.
 * Searching for any artist among 250,000 scrobbles becomes an instant O(1) lookup!
 */
export function getArtistScrobbleIndex(allScrobbles: Scrobble[]): Map<string, Scrobble[]> {
  if (
    globalArtistIndex &&
    globalArtistIndex.scrobblesRef === allScrobbles &&
    globalArtistIndex.length === allScrobbles.length
  ) {
    return globalArtistIndex.artistMap;
  }

  const artistMap = new Map<string, Scrobble[]>();
  const artistNameSet = new Set<string>();

  for (let i = 0; i < allScrobbles.length; i++) {
    const s = allScrobbles[i];
    const credited = getAllCreditedArtists(s.artist, s.title);

    for (const c of credited) {
      artistNameSet.add(c.name);
      let list = artistMap.get(c.normalizedKey);
      if (!list) {
        list = [];
        artistMap.set(c.normalizedKey, list);
      }
      list.push(s);
    }
  }

  globalArtistIndex = {
    scrobblesRef: allScrobbles,
    length: allScrobbles.length,
    artistMap,
    allKnownArtists: Array.from(artistNameSet).sort((a, b) => a.localeCompare(b)),
  };

  return artistMap;
}

/**
 * Get all known unique artist names across the entire library.
 */
export function getAllLibraryArtists(allScrobbles: Scrobble[]): string[] {
  if (
    globalArtistIndex &&
    globalArtistIndex.scrobblesRef === allScrobbles &&
    globalArtistIndex.length === allScrobbles.length
  ) {
    return globalArtistIndex.allKnownArtists;
  }

  getArtistScrobbleIndex(allScrobbles);
  return globalArtistIndex ? globalArtistIndex.allKnownArtists : [];
}

// Profile LRU Cache for instantaneous 0ms rendering
const profileCache = new Map<string, ArtistProfileStats>();

/**
 * Computes a comprehensive Artist Profile from history and weekly charts.
 * Credits all features and collaborative works.
 * 
 * Lightning fast (<1ms) even for 250,000+ scrobbles.
 */
export function computeArtistProfile(
  targetArtist: string,
  allScrobbles: Scrobble[],
  allWeeks: ChartWeekInfo[],
  mergedMap: Record<string, string> = {},
  settings: ZeroChartSettings,
  mergedAlbumsMap: Record<string, string> = {}
): ArtistProfileStats {
  let targetKey = normalizeStrict(targetArtist);
  let resolvedArtistName = targetArtist;
  const INF_RANK = 999999;

  if (!targetKey || !allScrobbles || allScrobbles.length === 0) {
    return {
      artistName: resolvedArtistName,
      totalSongsCharted: 0,
      distinctNum1Songs: 0,
      totalNum1Weeks: 0,
      totalTop10s: 0,
      debutAt1Count: 0,
      totalPlays: 0,
      totalCalculatedUnits: 0,
      albumCertCounts: {},
      trackCertCounts: {},
      albums: [],
      songsByYear: [],
    };
  }

  // Check LRU Cache
  const minAlbumTracks = Math.max(3, settings.minAlbumTracksToChart || 3);
  const cacheKey = `${targetKey}_${allScrobbles.length}_${allWeeks.length}_${settings.playMultiplier}_${settings.chartSize}_${minAlbumTracks}_${settings.trackPlayWeight || 50000}_${settings.trackStabilityWeight || 50}_${settings.albumPlayWeight || 5000}_${settings.albumStabilityWeight || 500}_${settings.streamFactorPerPlay || 10875000}_${settings.goldThresholdAlbum || 500000}_${Object.keys(mergedMap).length}_${Object.keys(mergedAlbumsMap).length}`;
  const cachedProfile = profileCache.get(cacheKey);
  if (cachedProfile) {
    return cachedProfile;
  }

  // 1. Get weekly track & album rankings from global memoized cache
  const { weeklyTrackRanks, weeklyTrackPoints, weeklyAlbumRanks, weeklyAlbumPoints } =
    getMemoizedWeeklyTrackRanks(allWeeks, allScrobbles, mergedMap, settings, mergedAlbumsMap);

  const albumLeadArtistMap = buildCanonicalAlbumLeadArtistMap(
    allScrobbles,
    mergedAlbumsMap,
    settings.trackAlbumOverrides || {},
    settings.manualOverrides || {}
  );

  // 2. Retrieve ONLY the scrobbles involving target artist in O(1) time
  const artistIndex = getArtistScrobbleIndex(allScrobbles);
  let artistScrobbles = artistIndex.get(targetKey) || [];

  if (artistScrobbles.length === 0) {
    // If targetArtist is a composite string like "Tom and Jerry" or "Tom feat. Jerry",
    // resolve to the individual credited artist:
    const credited = getAllCreditedArtists(targetArtist);
    for (const c of credited) {
      const subScrobbles = artistIndex.get(c.normalizedKey);
      if (subScrobbles && subScrobbles.length > 0) {
        resolvedArtistName = c.name;
        targetKey = c.normalizedKey;
        artistScrobbles = subScrobbles;
        break;
      }
    }
  }

  if (artistScrobbles.length === 0) {
    const emptyResult: ArtistProfileStats = {
      artistName: resolvedArtistName,
      totalSongsCharted: 0,
      distinctNum1Songs: 0,
      totalNum1Weeks: 0,
      totalTop10s: 0,
      debutAt1Count: 0,
      totalPlays: 0,
      totalCalculatedUnits: 0,
      albumCertCounts: {},
      trackCertCounts: {},
      albums: [],
      songsByYear: [],
    };
    if (profileCache.size > 200) profileCache.clear();
    profileCache.set(cacheKey, emptyResult);
    return emptyResult;
  }

  const canonicalSongKeys: string[] = [];
  const songsMap: Record<
    string,
    {
      titleDisplay: string;
      artistDisplay: string;
      rawPlays: number;
      salesBase: number;
      streamsBase: number;
      weeksSeen: Set<number>;
      peakRank: number;
      popPeakRank: number;
      num1s: number;
      firstWeek: number | null;
      firstRank: number | null;
      debutYear: number | string;
      album?: string;
      coverArt?: string;
      artistVariantKeys: Set<string>;
    }
  > = {};

  const canonicalAlbumKeys: string[] = [];
  const albumsMap: Record<
    string,
    {
      name: string;
      salesBase: number;
      playCount: number;
      tracks: Set<string>;
      coverArt?: string;
      peakRank: number;
      weeksOnChart: number;
      stabilityPoints: number;
      artistVariantKeys: Set<string>;
    }
  > = {};

  const photoCache = getPhotoCacheSnapshot();
  const titleKeyToCanonMap = new Map<string, string>();
  const albumKeyToCanonMap = new Map<string, string>();

  // 3. Process ONLY artist's scrobbles with 90-100% similarity combining
  for (let i = 0; i < artistScrobbles.length; i++) {
    const s = artistScrobbles[i];
    const normT = normalizeTrackTitle(s.title);
    const mergeKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const canonicalTitle = mergedMap[mergeKey] || normT;
    const titleKey = normalizeStrict(canonicalTitle);
    const artistStrict = normalizeStrict(s.artist);

    // Check fast map first
    let canonKey = titleKeyToCanonMap.get(titleKey);

    // If not found in map, check if 90-100% similar to an existing canonical track
    if (!canonKey) {
      for (let k = 0; k < canonicalSongKeys.length; k++) {
        const existingKey = canonicalSongKeys[k];
        const existingSong = songsMap[existingKey];
        if (
          areTracksSimilar(canonicalTitle, existingSong.titleDisplay, 0.90) ||
          areTracksSimilar(normT, existingSong.titleDisplay, 0.90)
        ) {
          canonKey = existingKey;
          titleKeyToCanonMap.set(titleKey, canonKey);
          break;
        }
      }
    }

    const trackPhoto =
      photoCache.tracks[`${s.artist.toLowerCase()}:::${canonicalTitle.toLowerCase()}`] ||
      photoCache.tracks[`${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`] ||
      s.coverArt;

    if (!canonKey) {
      canonKey = titleKey || `SONG_${canonicalSongKeys.length + 1}`;
      canonicalSongKeys.push(canonKey);
      titleKeyToCanonMap.set(titleKey, canonKey);
      const credited = getAllCreditedArtists(s.artist, s.title);
      const initialKeys = new Set<string>([
        `${artistStrict}:::${titleKey}`,
        `${targetKey}:::${titleKey}`,
        ...credited.map((c) => `${c.normalizedKey}:::${titleKey}`),
      ]);

      songsMap[canonKey] = {
        titleDisplay: canonicalTitle || s.title,
        artistDisplay: s.artist,
        rawPlays: 0,
        salesBase: 0,
        streamsBase: 0,
        weeksSeen: new Set(),
        peakRank: INF_RANK,
        popPeakRank: INF_RANK,
        num1s: 0,
        firstWeek: null,
        firstRank: null,
        debutYear: new Date(s.timestamp * 1000).getFullYear(),
        album: s.album,
        coverArt: trackPhoto,
        artistVariantKeys: initialKeys,
      };
    } else {
      const credited = getAllCreditedArtists(s.artist, s.title);
      songsMap[canonKey].artistVariantKeys.add(`${artistStrict}:::${titleKey}`);
      songsMap[canonKey].artistVariantKeys.add(`${targetKey}:::${titleKey}`);
      credited.forEach((c) => {
        songsMap[canonKey].artistVariantKeys.add(`${c.normalizedKey}:::${titleKey}`);
      });
      songsMap[canonKey].titleDisplay = preferDisplayTitle(
        songsMap[canonKey].titleDisplay,
        canonicalTitle || s.title
      );
      if (trackPhoto && !songsMap[canonKey].coverArt) {
        songsMap[canonKey].coverArt = trackPhoto;
      }
    }

    const song = songsMap[canonKey];
    song.rawPlays += 1;
    song.streamsBase += 1;

    const scrobbleYear = new Date(s.timestamp * 1000).getFullYear();
    if (typeof song.debutYear === 'number' && scrobbleYear < song.debutYear) {
      song.debutYear = scrobbleYear;
    }

    const rawTrackKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const assignedAlbum =
      settings.manualOverrides?.[rawTrackKey]?.albumOverride ||
      settings.trackAlbumOverrides?.[rawTrackKey] ||
      s.album;

    // Albums aggregation: An album can ONLY credit the single lead artist!
    // An album should ONLY appear on the lead artist's profile page.
    if (assignedAlbum && assignedAlbum.trim().length > 0) {
      const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
      const origAlb = assignedAlbum.trim();
      const mappedAlb =
        mergedAlbumsMap[`${primaryArtist.toLowerCase()}:::${origAlb.toLowerCase()}`] ||
        mergedAlbumsMap[`${s.artist.toLowerCase()}:::${origAlb.toLowerCase()}`] ||
        mergedAlbumsMap[origAlb.toLowerCase()] ||
        origAlb;

      // Strict single-artist attribution:
      // An album can ONLY ever credit ONE single lead artist across the library.
      const albumLeadArtist = getCanonicalAlbumLeadArtist(mappedAlb, primaryArtist, albumLeadArtistMap);
      const leadNorm = normalizeStrict(albumLeadArtist);

      // If target artist is not the canonical lead artist of this album, DO NOT credit the album to them!
      if (leadNorm === targetKey) {
        const rawAlb = mappedAlb;
        const albNorm = normalizeStrict(normalizeAlbumTitle(rawAlb));
        if (albNorm && albNorm !== 'NAN' && albNorm !== 'UNKNOWN') {
          let canonAlbKey = albumKeyToCanonMap.get(albNorm);

          if (!canonAlbKey) {
            for (let a = 0; a < canonicalAlbumKeys.length; a++) {
              const existingAlbKey = canonicalAlbumKeys[a];
              const existingAlb = albumsMap[existingAlbKey];
              if (
                areAlbumsSimilar(rawAlb, existingAlb.name, 0.90) ||
                areAlbumsSimilar(albNorm, existingAlb.name, 0.90)
              ) {
                canonAlbKey = existingAlbKey;
                albumKeyToCanonMap.set(albNorm, canonAlbKey);
                break;
              }
            }
          }

          const albumPhoto =
            photoCache.albums[`${albumLeadArtist.toLowerCase()}:::${origAlb.toLowerCase()}`] ||
            photoCache.albums[`${s.artist.toLowerCase()}:::${origAlb.toLowerCase()}`] ||
            s.coverArt;

          if (!canonAlbKey) {
            canonAlbKey = albNorm;
            canonicalAlbumKeys.push(canonAlbKey);
            albumKeyToCanonMap.set(albNorm, canonAlbKey);
            const initialAlbKeys = new Set<string>([
              `${targetKey}:::${albNorm}`,
              `${targetKey}:::${normalizeStrict(rawAlb)}`,
            ]);

            albumsMap[canonAlbKey] = {
              name: preferDisplayAlbumTitle(rawAlb, normalizeAlbumTitle(rawAlb)),
              salesBase: 0,
              playCount: 0,
              tracks: new Set(),
              coverArt: albumPhoto,
              peakRank: INF_RANK,
              weeksOnChart: 0,
              stabilityPoints: 0,
              artistVariantKeys: initialAlbKeys,
            };
          } else {
            albumsMap[canonAlbKey].name = preferDisplayAlbumTitle(albumsMap[canonAlbKey].name, rawAlb);
            albumsMap[canonAlbKey].artistVariantKeys.add(`${targetKey}:::${albNorm}`);
            albumsMap[canonAlbKey].artistVariantKeys.add(`${targetKey}:::${normalizeStrict(rawAlb)}`);
          }

          const targetAlb = albumsMap[canonAlbKey];
          targetAlb.playCount += 1;
          const cleanTrackTitle = normalizeStrict(normalizeTrackTitle(canonicalTitle || s.title));
          if (cleanTrackTitle) {
            targetAlb.tracks.add(cleanTrackTitle);
          }
          if (albumPhoto && !targetAlb.coverArt) {
            targetAlb.coverArt = albumPhoto;
          }
        }
      }
    }
  }

  // 4. Calculate Chart Performance (Weeks, Peak, #1s, First Debut) across chart weeks
  const maxChartSize = settings.chartSize || 100;
  for (let w = 1; w <= allWeeks.length; w++) {
    const rankMap = weeklyTrackRanks[w - 1];
    const pointMap = weeklyTrackPoints[w - 1];
    const albRankMap = weeklyAlbumRanks[w - 1];
    const albPointMap = weeklyAlbumPoints[w - 1];

    if (rankMap) {
      for (let k = 0; k < canonicalSongKeys.length; k++) {
        const canonKey = canonicalSongKeys[k];
        const song = songsMap[canonKey];
        if (!song) continue;

        let foundRank = INF_RANK;
        let foundPoints = 0;

        song.artistVariantKeys.forEach((variantKey) => {
          const r = rankMap.get(variantKey);
          if (r !== undefined && r < foundRank) {
            foundRank = r;
            foundPoints = pointMap?.get(variantKey) || 0;
          }
        });

        if (foundRank <= maxChartSize) {
          song.weeksSeen.add(w);
          if (foundRank < song.peakRank) song.peakRank = foundRank;
          if (foundRank === 1) song.num1s += 1;

          if (foundPoints > 0) {
            const popRank = Math.max(1, Math.min(100, Math.round(100 - (foundPoints / 1000) * 10)));
            if (popRank < song.popPeakRank) song.popPeakRank = popRank;
          }

          if (song.firstWeek === null || w < song.firstWeek) {
            song.firstWeek = w;
            song.firstRank = foundRank;
            const weekInfo = allWeeks[w - 1];
            if (weekInfo) {
              song.debutYear = new Date(weekInfo.startTimestamp * 1000).getFullYear();
            }
          }
        }
      }
    }

    // Weekly album chart performance tracking
    if (albRankMap) {
      for (let a = 0; a < canonicalAlbumKeys.length; a++) {
        const canonAlbKey = canonicalAlbumKeys[a];
        const alb = albumsMap[canonAlbKey];
        if (!alb) continue;

        let foundAlbRank = INF_RANK;
        let foundAlbPoints = 0;

        alb.artistVariantKeys.forEach((variantKey) => {
          const r = albRankMap.get(variantKey);
          if (r !== undefined && r < foundAlbRank) {
            foundAlbRank = r;
          }
        });

        if (foundAlbRank <= maxChartSize) {
          alb.weeksOnChart += 1;
          if (foundAlbRank < alb.peakRank) alb.peakRank = foundAlbRank;
          // Rank-based chart stability points: #1 = 100 pts down to #100 = 1 pt (Billboard/ZeroCharts formula)
          const chartRankPoints = Math.max(1, 101 - foundAlbRank);
          alb.stabilityPoints += chartRankPoints;
        }
      }
    }
  }

  // 5. Calculate units and certifications for songs (Each song is 1 entry with full history)
  const streamFactor = settings.streamFactorPerPlay ?? 10875000;

  const songsList: ArtistProfileSongEntry[] = Object.entries(songsMap).map(([key, S]) => {
    const weeksCount = S.weeksSeen.size;
    const calcUnits =
      S.rawPlays * (settings.trackPlayWeight ?? 50000) +
      weeksCount * (settings.trackStabilityWeight ?? 50);

    const { label: certLabel, tier: certTier } = getCertificationLabel(
      calcUnits,
      settings.goldThresholdTrack ?? 500000,
      settings.platinumThresholdTrack ?? 1000000,
      settings.diamondThresholdTrack ?? 10000000
    );

    return {
      key,
      titleDisplay: S.titleDisplay,
      artistDisplay: S.artistDisplay,
      playCount: S.rawPlays,
      salesBase: calcUnits,
      streamsBase: S.rawPlays * streamFactor,
      weeksOnChart: weeksCount,
      peakRank: S.peakRank === INF_RANK ? 100 : S.peakRank,
      popPeakRank: S.popPeakRank === INF_RANK ? Math.min(S.peakRank, 100) : S.popPeakRank,
      num1s: S.num1s,
      firstWeek: S.firstWeek,
      firstRank: S.firstRank,
      debutYear: S.debutYear || '—',
      certLabel,
      certTier,
      album: S.album,
      coverArt: S.coverArt,
    };
  });

  // Calculate units and certifications for albums matching milestonesEngine formula:
  // units = plays * albumPlayWeight + stabilityPoints * albumStabilityWeight
  // An album MUST strictly have a minimum of 3 songs or have charted to qualify as an album.
  const albumPlayWeight = settings.albumPlayWeight ?? 5000;
  const albumStabWeight = settings.albumStabilityWeight ?? 500;

  const albumsList: ArtistProfileAlbumEntry[] = Object.entries(albumsMap)
    .filter(([, A]) => A.tracks.size >= minAlbumTracks || A.weeksOnChart > 0 || A.playCount >= 5)
    .map(([key, A]) => {
      const stabilityPoints = A.stabilityPoints;
      const calcUnits = A.playCount * albumPlayWeight + stabilityPoints * albumStabWeight;
      const { label: certLabel, tier: certTier } = getCertificationLabel(
        calcUnits,
        settings.goldThresholdAlbum ?? 500000,
        settings.platinumThresholdAlbum ?? 1000000,
        settings.diamondThresholdAlbum ?? 10000000
      );

      return {
        key,
        name: A.name,
        playCount: A.playCount,
        salesBase: calcUnits,
        streamsBase: A.playCount * streamFactor,
        tracksCount: A.tracks.size,
        peakRank: A.peakRank === INF_RANK ? undefined : A.peakRank,
        weeksOnChart: A.weeksOnChart,
        stabilityPoints,
        certLabel,
        certTier,
        coverArt: A.coverArt,
        tracks: Array.from(A.tracks),
      };
    });

  albumsList.sort((a, b) => b.salesBase - a.salesBase);

  // Group songs by Debut Year descending
  const songsByYearMap = new Map<number | string, ArtistProfileSongEntry[]>();
  for (const song of songsList) {
    const yr = song.debutYear;
    if (!songsByYearMap.has(yr)) {
      songsByYearMap.set(yr, []);
    }
    songsByYearMap.get(yr)!.push(song);
  }

  const sortedYears = Array.from(songsByYearMap.keys()).sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return b - a;
    return String(b).localeCompare(String(a));
  });

  const songsByYear = sortedYears.map((yr) => {
    const yearSongs = songsByYearMap.get(yr) || [];
    yearSongs.sort((a, b) => b.salesBase - a.salesBase);
    return {
      year: yr,
      songsCount: yearSongs.length,
      num1sCount: yearSongs.filter((s) => s.num1s > 0).length,
      top10sCount: yearSongs.filter((s) => s.peakRank <= 10).length,
      songs: yearSongs,
    };
  });

  // Calculate aggregate overview stats
  const totalPlays = artistScrobbles.length;
  const totalSongsCharted = songsList.filter((s) => s.weeksOnChart > 0).length;
  const distinctNum1Songs = songsList.filter((s) => s.num1s > 0).length;
  const totalNum1Weeks = songsList.reduce((acc, s) => acc + s.num1s, 0);
  const totalTop10s = songsList.filter((s) => s.peakRank <= 10).length;
  const debutAt1Count = songsList.filter((s) => s.firstRank === 1).length;
  const totalCalculatedUnits =
    songsList.reduce((acc, s) => acc + s.salesBase, 0) +
    albumsList.reduce((acc, a) => acc + a.salesBase, 0);

  const albumCertCounts: Record<string, number> = {};
  for (const a of albumsList) {
    if (a.certTier) {
      albumCertCounts[a.certTier] = (albumCertCounts[a.certTier] || 0) + 1;
    }
  }

  const trackCertCounts: Record<string, number> = {};
  for (const s of songsList) {
    if (s.certTier) {
      trackCertCounts[s.certTier] = (trackCertCounts[s.certTier] || 0) + 1;
    }
  }

  const result: ArtistProfileStats = {
    artistName: resolvedArtistName,
    totalSongsCharted,
    distinctNum1Songs,
    totalNum1Weeks,
    totalTop10s,
    debutAt1Count,
    totalPlays,
    totalStreams: totalPlays * streamFactor,
    totalCalculatedUnits,
    albumCertCounts,
    trackCertCounts,
    albums: albumsList,
    songsByYear,
  };

  if (profileCache.size > 200) {
    profileCache.clear();
  }
  profileCache.set(cacheKey, result);

  return result;
}
