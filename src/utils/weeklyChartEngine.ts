import {
  Scrobble,
  TrackChartItem,
  ArtistChartItem,
  AlbumChartItem,
  ZeroChartSettings,
  ChartWeekInfo,
  MoveStatus,
  SubjectType,
  PlaqueMilestone,
} from '../types/music';
import {
  normalizeStrict,
  normalizeTrackTitle,
  normalizeAlbumTitle,
  preferDisplayTitle,
  stringSimilarity,
} from './similarity';
import {
  getAllCreditedArtists,
  trackInvolvesArtist,
  splitArtistList,
  extractFeaturedFromTitle,
  getCertificationLabel,
} from './artistCrediting';
import { getPhotoCacheSnapshot } from './lastfmImageFetcher';

export const DEFAULT_ZERO_SETTINGS: ZeroChartSettings = {
  chartTitle: 'Billboard Hot 100',
  chartSubtitle: 'Dark Edition • ZeroCharts Dynamic Weekly Engine',
  chartSize: 100,
  playMultiplier: 1.0,
  radioStreamsRatio: 0.7,
  enableRecurrentRule: false,
  recurrentWeeksCutoff: 20,
  recurrentRankCutoff: 50,
  minScrobblesToChart: 1,
  minAlbumTracksToChart: 3,
  tieBreaker: 'recent',

  // ZeroCharts Certification Formula & Thresholds
  trackPlayWeight: 50000,
  albumPlayWeight: 5000,
  trackStabilityWeight: 500,
  albumStabilityWeight: 500,
  goldThresholdTrack: 500000,
  goldThresholdAlbum: 500000,
  platinumThresholdTrack: 1000000,
  platinumThresholdAlbum: 1000000,
  diamondThresholdTrack: 10000000,
  diamondThresholdAlbum: 10000000,
  salesUnitName: 'Units Sold',

  goldThreshold: 50,
  platinumThreshold: 100,
  diamondThreshold: 500,
  manualOverrides: {},
  blacklistedKeys: [],
};

export const getFuzzyTrackKey = (title: string, artist: string) => {
  const normA = normalizeStrict(artist);
  const normT = normalizeStrict(normalizeTrackTitle(title));
  return `${normA}:::${normT}`;
};

export const getFuzzyArtistKey = (artist: string) => normalizeStrict(artist);

export const getFuzzyAlbumKey = (album: string, artist: string) => {
  const primaryArtist = splitArtistList(artist)[0] || artist;
  const normA = normalizeStrict(primaryArtist);
  const normAlb = normalizeStrict(normalizeAlbumTitle(album));
  return `${normA}:::${normAlb}`;
};

/**
 * Aligns any unix timestamp to the preceding Friday 00:00:00.
 * In official music chart tracking (ZeroCharts / Billboard), tracking cycles run Friday 00:00:00 through Thursday 23:59:59.
 */
export function getPrecedingFridayMidnight(timestampSec: number): number {
  const d = new Date(timestampSec * 1000);
  d.setHours(0, 0, 0, 0);
  // getDay: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const day = d.getDay();
  const daysToSubtract = day >= 5 ? day - 5 : day + 2;
  d.setDate(d.getDate() - daysToSubtract);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Generate official Friday-to-Thursday 7-day chart tracking weeks based on scrobbles timestamps.
 * Single O(N) partition binning for instant responsiveness, memory-capped for safety.
 */
export function buildWeekPartitions(scrobbles: Scrobble[]): ChartWeekInfo[] {
  const now = Math.floor(Date.now() / 1000);
  const currentFridayMidnight = getPrecedingFridayMidnight(now);
  const MIN_REASONABLE_TS = 946684800; // Jan 1, 2000 (Last.fm launched in 2002)
  const MAX_REASONABLE_TS = now + 86400 * 30; // 30 days into future

  if (!scrobbles || scrobbles.length === 0) {
    const start = currentFridayMidnight;
    const end = start + 7 * 86400;
    return [
      {
        weekNumber: 1,
        startTimestamp: start,
        endTimestamp: end,
        label: 'Week 1',
        dateRange: formatTimestampRange(start, end - 1),
        tracksCount: 0,
        artistsCount: 0,
        albumsCount: 0,
        scrobbles: [],
      },
    ];
  }

  // Find min and max timestamps in single pass, filtering out corrupted outlier timestamps
  let minTs = Infinity;
  let maxTs = -Infinity;
  let validCount = 0;

  for (let i = 0; i < scrobbles.length; i++) {
    let ts = scrobbles[i].timestamp;
    if (typeof ts !== 'number' || isNaN(ts)) continue;
    if (ts > 9999999999) ts = Math.floor(ts / 1000);
    if (ts < MIN_REASONABLE_TS || ts > MAX_REASONABLE_TS) continue;

    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
    validCount++;
  }

  if (validCount === 0 || minTs === Infinity || maxTs === -Infinity) {
    minTs = currentFridayMidnight - 7 * 86400;
    maxTs = currentFridayMidnight + 7 * 86400;
  } else {
    maxTs = Math.max(maxTs, minTs + 7 * 86400);
  }

  // Align start timestamp strictly to preceding Friday 00:00:00 (Fri-Thu tracking cycle)
  const baseStart = getPrecedingFridayMidnight(minTs);
  const WEEK_SECS = 7 * 86400;
  const rawTotalWeeks = Math.ceil((maxTs - baseStart) / WEEK_SECS);
  // Cap total weeks to max 2,500 (~48 years) to prevent memory crashes on aberrant timestamps
  const totalWeeks = Math.max(1, Math.min(2500, rawTotalWeeks));

  // Initialize week buckets
  const weekScrobblesBuckets: Scrobble[][] = Array.from({ length: totalWeeks }, () => []);

  // Single O(N) pass to bin scrobbles into week buckets
  for (let i = 0; i < scrobbles.length; i++) {
    const s = scrobbles[i];
    let ts = s.timestamp;
    if (typeof ts !== 'number' || isNaN(ts)) continue;
    if (ts > 9999999999) ts = Math.floor(ts / 1000);
    if (ts < baseStart) continue;

    const weekIdx = Math.floor((ts - baseStart) / WEEK_SECS);
    if (weekIdx >= 0 && weekIdx < totalWeeks) {
      weekScrobblesBuckets[weekIdx].push(s);
    }
  }

  const weeks: ChartWeekInfo[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    const start = baseStart + (w - 1) * WEEK_SECS;
    const end = start + WEEK_SECS;
    const bScrobbles = weekScrobblesBuckets[w - 1];

    weeks.push({
      weekNumber: w,
      startTimestamp: start,
      endTimestamp: end,
      label: `Week ${w}`,
      dateRange: formatTimestampRange(start, end - 1),
      tracksCount: bScrobbles.length,
      artistsCount: 0,
      albumsCount: 0,
      scrobbles: bScrobbles,
    });
  }

  // Strict User Mandate: Do not show in-progress/incomplete current weeks on charts!
  // Week ends on Thursday 23:59:59 (represented by end timestamp = Friday 00:00:00).
  // E.g. If today is Wed Sep 02, the week ending Thu Sep 03 is incomplete; latest chart week is Aug 21 - Aug 27.
  const finalizedWeeks = weeks.filter((wk) => wk.endTimestamp <= now);
  if (finalizedWeeks.length > 0) {
    // Re-index week numbers sequentially
    return finalizedWeeks.map((wk, idx) => ({
      ...wk,
      weekNumber: idx + 1,
      label: `Week ${idx + 1}`,
    }));
  }

  return weeks;
}

function formatTimestampRange(startSec: number, endSec: number): string {
  const dStart = new Date(startSec * 1000);
  const dEnd = new Date(endSec * 1000);
  const fmt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  return `${dStart.toLocaleDateString('en-GB', fmt)} – ${dEnd.toLocaleDateString('en-GB', fmt)}`;
}

/**
 * Compute Weekly Track Chart for a given week with ZeroCharts rules & overrides
 * Guaranteed rule: The same song cannot debut as new if it has history (reentry instead).
 */
export function computeWeeklyTrackChart(
  weekNumber: number,
  allWeeks: ChartWeekInfo[],
  allScrobbles: Scrobble[],
  mergedMap: Record<string, string> = {},
  settings: ZeroChartSettings = DEFAULT_ZERO_SETTINGS
): TrackChartItem[] {
  if (!allWeeks || allWeeks.length === 0 || !allScrobbles || allScrobbles.length === 0) {
    return [];
  }

  // 1. Build historical presence for all weeks 1..weekNumber
  const photoCache = getPhotoCacheSnapshot();
  const weeklyTrackMaps: Map<
    string,
    {
      title: string;
      artist: string;
      album?: string;
      playCount: number;
      coverArt: string;
      lastTimestamp: number;
      firstTimestamp: number;
      points: number;
    }
  >[] = [];

  for (let w = 1; w <= weekNumber; w++) {
    const weekInfo = allWeeks[w - 1];
    const map = new Map<
      string,
      {
        title: string;
        artist: string;
        album?: string;
        playCount: number;
        coverArt: string;
        lastTimestamp: number;
        firstTimestamp: number;
        points: number;
      }
    >();

    if (weekInfo) {
      const weekScrobbles =
        weekInfo.scrobbles ??
        allScrobbles.filter(
          (s) => s.timestamp >= weekInfo.startTimestamp && s.timestamp < weekInfo.endTimestamp
        );

      for (const s of weekScrobbles) {
        const rawKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
        const mappedTitle = mergedMap[rawKey] || s.title;
        const key = getFuzzyTrackKey(mappedTitle, s.artist);

        // Check blacklist
        if (settings.blacklistedKeys.includes(key)) continue;

        const override = settings.manualOverrides[key];
        if (override?.isBlacklisted) continue;

        const existing = map.get(key);
        const title = override?.titleOverride || mappedTitle;
        const artist = override?.artistOverride || s.artist;
        const trackCacheKey = `${s.artist.toLowerCase()}:::${mappedTitle.toLowerCase()}`;
        const cachedTrackPhoto = photoCache.tracks[trackCacheKey] || photoCache.tracks[`${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`];
        const coverArt =
          override?.coverArtOverride ||
          cachedTrackPhoto ||
          s.coverArt ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';

        if (!existing) {
          map.set(key, {
            title,
            artist,
            album: s.album,
            playCount: 1,
            coverArt,
            firstTimestamp: s.timestamp,
            lastTimestamp: s.timestamp,
            points: 1,
          });
        } else {
          existing.playCount += 1;
          if (s.timestamp < existing.firstTimestamp) existing.firstTimestamp = s.timestamp;
          if (s.timestamp > existing.lastTimestamp) existing.lastTimestamp = s.timestamp;
          if (!existing.coverArt && coverArt) existing.coverArt = coverArt;
        }
      }

      // Apply multiplier & manual points override to map
      map.forEach((val, key) => {
        const override = settings.manualOverrides[key];
        const adj = override?.pointAdjustment || 0;
        val.points = val.playCount * settings.playMultiplier * 100 + adj;
      });
    }

    weeklyTrackMaps.push(map);
  }

  // Current week map
  const currentWeekMap = weeklyTrackMaps[weekNumber - 1] || new Map();

  // Filter by min scrobbles
  const qualifiedCurrent = Array.from(currentWeekMap.entries())
    .filter(([, v]) => v.playCount >= (settings.minScrobblesToChart || 1))
    .map(([key, v]) => ({ key, ...v }));

  // Sort current week by locked ranks or points
  qualifiedCurrent.sort((a, b) => {
    const lockA = settings.manualOverrides[a.key]?.lockedRank;
    const lockB = settings.manualOverrides[b.key]?.lockedRank;
    if (lockA !== undefined && lockB !== undefined) return lockA - lockB;
    if (lockA !== undefined) return -1;
    if (lockB !== undefined) return 1;

    if (b.points !== a.points) return b.points - a.points;
    if (settings.tieBreaker === 'recent') return b.lastTimestamp - a.lastTimestamp;
    if (settings.tieBreaker === 'alpha') return a.title.localeCompare(b.title);
    return b.playCount - a.playCount;
  });

  // Fast running historical aggregations (Peak, Weeks on Chart, Cumulative Chart Points, Cumulative Plays)
  const cumulativePlaysMap = new Map<string, number>();
  const historicalTrackStats = new Map<
    string,
    {
      peakRank: number;
      weeksOnChart: number;
      cumulativeChartPoints: number;
      hasChartHistory: boolean;
    }
  >();

  // Calculate cumulative stats across history in a single linear pass
  const pastWeekRankings: Map<string, number>[] = [];
  for (let w = 1; w <= weekNumber; w++) {
    const wMap = weeklyTrackMaps[w - 1] || new Map();
    // Accumulate total plays
    wMap.forEach((v, k) => {
      cumulativePlaysMap.set(k, (cumulativePlaysMap.get(k) || 0) + v.playCount);
    });

    if (w < weekNumber) {
      const sortedW = Array.from(wMap.entries())
        .filter(([, v]) => v.playCount >= (settings.minScrobblesToChart || 1))
        .sort((a, b) => {
          const lockA = settings.manualOverrides[a[0]]?.lockedRank;
          const lockB = settings.manualOverrides[b[0]]?.lockedRank;
          if (lockA !== undefined && lockB !== undefined) return lockA - lockB;
          if (lockA !== undefined) return -1;
          if (lockB !== undefined) return 1;
          return b[1].points - a[1].points;
        });

      const rankMap = new Map<string, number>();
      for (let idx = 0; idx < sortedW.length; idx++) {
        const [k] = sortedW[idx];
        const pRank = idx + 1;
        rankMap.set(k, pRank);

        const existingStats = historicalTrackStats.get(k);
        const chartPts = pRank <= 100 ? Math.max(1, 101 - pRank) : 0;
        if (!existingStats) {
          historicalTrackStats.set(k, {
            peakRank: pRank,
            weeksOnChart: 1,
            cumulativeChartPoints: chartPts,
            hasChartHistory: true,
          });
        } else {
          existingStats.hasChartHistory = true;
          existingStats.weeksOnChart += 1;
          if (pRank < existingStats.peakRank) existingStats.peakRank = pRank;
          existingStats.cumulativeChartPoints += chartPts;
        }
      }
      pastWeekRankings.push(rankMap);
    }
  }

  const lastWeekRankings = pastWeekRankings[pastWeekRankings.length - 1] || new Map<string, number>();

  let maxGainerDiff = -9999;
  let greatestGainerKey = '';
  let highestDebutRank = 9999;
  let hotShotDebutKey = '';

  const chartItems: TrackChartItem[] = qualifiedCurrent.map((item, idx) => {
    const rank = idx + 1;
    const key = item.key;
    const override = settings.manualOverrides[key];

    // Read historical stats in O(1)
    const hist = historicalTrackStats.get(key);
    const hasChartHistory = hist?.hasChartHistory ?? false;
    const peakRank = hist ? Math.min(rank, hist.peakRank) : rank;
    const weeksOnChart = (hist?.weeksOnChart ?? 0) + 1; // including current week

    const lastRank = lastWeekRankings.get(key) ?? null;

    // Movement Status
    // CRITICAL USER REQUIREMENT: "the same song cannot debut as new if it has history"
    let moveStatus: MoveStatus = 'flat';
    let moveDiff = 0;

    if (override?.forceStatus) {
      moveStatus = override.forceStatus;
      moveDiff = moveStatus === 'up' ? 1 : moveStatus === 'down' ? -1 : 0;
    } else if (!hasChartHistory && lastRank === null) {
      // True brand-new first-time charting song
      moveStatus = 'new';
      if (rank < highestDebutRank) {
        highestDebutRank = rank;
        hotShotDebutKey = key;
      }
    } else if (lastRank === null) {
      // Has history from earlier weeks, but was not on chart last week -> ALWAYS REENTRY, NEVER NEW
      moveStatus = 'reentry';
    } else {
      moveDiff = lastRank - rank;
      if (moveDiff > 0) {
        moveStatus = 'up';
        if (moveDiff > maxGainerDiff) {
          maxGainerDiff = moveDiff;
          greatestGainerKey = key;
        }
      } else if (moveDiff < 0) {
        moveStatus = 'down';
      } else {
        moveStatus = 'flat';
      }
    }

    // Cumulative units for certifications (Formula: Plays * PlayWeight + Stability Chart Points * StabilityWeight)
    const cumulativePlays = cumulativePlaysMap.get(key) || item.playCount;
    let cumulativeChartPoints = hist?.cumulativeChartPoints ?? 0;
    if (rank <= 100) {
      cumulativeChartPoints += Math.max(1, 101 - rank);
    }

    // Rank-based chart points: Highest point is 100 for #1 and lowest is 1 for #100
    const pointAdj = override?.pointAdjustment || 0;
    const rankPoints = rank <= 100 ? Math.max(1, 101 - rank + pointAdj) : Math.max(1, 1 + pointAdj);

    // Points simulation (streaming vs radio)
    const streamPoints = Math.round(rankPoints * (settings.radioStreamsRatio || 0.7));
    const radioPoints = Math.max(0, rankPoints - streamPoints);

    const trackUnits =
      cumulativePlays * (settings.trackPlayWeight ?? 50000) +
      cumulativeChartPoints * (settings.trackStabilityWeight ?? 500);

    const weeklySales =
      item.playCount * (settings.trackPlayWeight ?? 50000) +
      rankPoints * (settings.trackStabilityWeight ?? 500);

    const { tier: certTier } = getCertificationLabel(
      trackUnits,
      settings.goldThresholdTrack ?? 500000,
      settings.platinumThresholdTrack ?? 1000000,
      settings.diamondThresholdTrack ?? 10000000
    );

    // % Change based on rank trajectory
    let changePct: number | null = null;
    if (lastRank !== null && lastRank <= 100) {
      const prevPoints = Math.max(1, 101 - lastRank);
      changePct = Math.round(((rankPoints - prevPoints) / prevPoints) * 100);
    }

    return {
      id: `track_w${weekNumber}_${rank}_${key}`,
      rank,
      previousRank: lastRank || undefined,
      lastRank,
      moveDiff,
      moveStatus,
      title: item.title,
      artist: item.artist,
      subtitle: item.artist,
      album: item.album,
      playCount: item.playCount,
      purePlays: item.playCount,
      points: Math.round(rankPoints),
      sales: Math.round(weeklySales),
      totalSales: Math.round(trackUnits),
      radioPoints,
      streamPoints,
      coverArt: item.coverArt,
      peakRank,
      weeksOnChart,
      changePct,
      isHotShotDebut: false,
      isGreatestGainer: false,
      isLocked: override?.lockedRank !== undefined,
      isManuallyEdited: Boolean(override),
      certification: certTier,
      firstListened: item.firstTimestamp,
      lastListened: item.lastTimestamp,
      _key: key,
    };
  });

  // Assign special badges (Hot Shot Debut & Greatest Gainer)
  return chartItems
    .map((item) => ({
      ...item,
      isHotShotDebut: item._key === hotShotDebutKey && item.moveStatus === 'new',
      isGreatestGainer: item._key === greatestGainerKey && item.moveStatus === 'up',
    }))
    .slice(0, settings.chartSize || 100);
}

/**
 * Compute Weekly Artist Chart
 * Credits ALL collaborating and featured artists for points, plays, and weeks.
 * Guaranteed rule: Artists with history cannot debut as new (reentry instead).
 */
export function computeWeeklyArtistChart(
  weekNumber: number,
  allWeeks: ChartWeekInfo[],
  allScrobbles: Scrobble[],
  settings: ZeroChartSettings = DEFAULT_ZERO_SETTINGS
): ArtistChartItem[] {
  if (!allWeeks || allWeeks.length === 0 || !allScrobbles || allScrobbles.length === 0) {
    return [];
  }

  const photoCache = getPhotoCacheSnapshot();
  const weeklyArtistMaps: Map<
    string,
    {
      artist: string;
      playCount: number;
      trackMap: Map<string, number>;
      coverArt: string;
      lastTimestamp: number;
      points: number;
    }
  >[] = [];

  for (let w = 1; w <= weekNumber; w++) {
    const weekInfo = allWeeks[w - 1];
    const map = new Map<
      string,
      {
        artist: string;
        playCount: number;
        trackMap: Map<string, number>;
        coverArt: string;
        lastTimestamp: number;
        points: number;
      }
    >();

    if (weekInfo) {
      const weekScrobbles =
        weekInfo.scrobbles ??
        allScrobbles.filter(
          (s) => s.timestamp >= weekInfo.startTimestamp && s.timestamp < weekInfo.endTimestamp
        );

      for (const s of weekScrobbles) {
        // Credit ALL primary and featured artists
        const creditedArtists = getAllCreditedArtists(s.artist, s.title);
        const artistsToCredit =
          creditedArtists.length > 0
            ? creditedArtists
            : [{ name: s.artist, normalizedKey: getFuzzyArtistKey(s.artist), isFeatured: false }];

        for (const artistInfo of artistsToCredit) {
          const key = artistInfo.normalizedKey;
          if (settings.blacklistedKeys.includes(key)) continue;

          const override = settings.manualOverrides[key];
          if (override?.isBlacklisted) continue;

          const artistName = override?.artistOverride || artistInfo.name;
          const cachedArtistPhoto = photoCache.artists[artistInfo.name.toLowerCase()] || photoCache.artists[artistInfo.normalizedKey];
          const coverArt =
            override?.coverArtOverride ||
            cachedArtistPhoto ||
            s.coverArt ||
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop&q=80';

          if (!map.has(key)) {
            map.set(key, {
              artist: artistName,
              playCount: 1,
              trackMap: new Map([[s.title, 1]]),
              coverArt,
              lastTimestamp: s.timestamp,
              points: 1,
            });
          } else {
            const ent = map.get(key)!;
            ent.playCount += 1;
            ent.trackMap.set(s.title, (ent.trackMap.get(s.title) || 0) + 1);
            if (s.timestamp > ent.lastTimestamp) ent.lastTimestamp = s.timestamp;
          }
        }
      }

      map.forEach((val, key) => {
        const override = settings.manualOverrides[key];
        const adj = override?.pointAdjustment || 0;
        val.points = val.playCount * settings.playMultiplier * 100 + adj;
      });
    }

    weeklyArtistMaps.push(map);
  }

  const currentMap = weeklyArtistMaps[weekNumber - 1] || new Map();
  const qualifiedCurrent = Array.from(currentMap.entries())
    .filter(([, v]) => v.playCount >= (settings.minScrobblesToChart || 1))
    .map(([key, v]) => ({ key, ...v }));

  qualifiedCurrent.sort((a, b) => {
    const lockA = settings.manualOverrides[a.key]?.lockedRank;
    const lockB = settings.manualOverrides[b.key]?.lockedRank;
    if (lockA !== undefined && lockB !== undefined) return lockA - lockB;
    if (lockA !== undefined) return -1;
    if (lockB !== undefined) return 1;
    return b.points - a.points;
  });

  // Historical rankings and linear statistics aggregation
  const cumulativeArtistPlaysMap = new Map<string, number>();
  const historicalArtistStats = new Map<
    string,
    {
      peakRank: number;
      weeksOnChart: number;
      hasChartHistory: boolean;
    }
  >();

  const pastWeekRankings: Map<string, number>[] = [];
  for (let w = 1; w <= weekNumber; w++) {
    const wMap = weeklyArtistMaps[w - 1] || new Map();
    wMap.forEach((v, k) => {
      cumulativeArtistPlaysMap.set(k, (cumulativeArtistPlaysMap.get(k) || 0) + v.playCount);
    });

    if (w < weekNumber) {
      const sortedW = Array.from(wMap.entries()).sort((a, b) => b[1].points - a[1].points);
      const rankMap = new Map<string, number>();
      for (let idx = 0; idx < sortedW.length; idx++) {
        const [k] = sortedW[idx];
        const pRank = idx + 1;
        rankMap.set(k, pRank);

        const existingStats = historicalArtistStats.get(k);
        if (!existingStats) {
          historicalArtistStats.set(k, {
            peakRank: pRank,
            weeksOnChart: 1,
            hasChartHistory: true,
          });
        } else {
          existingStats.hasChartHistory = true;
          existingStats.weeksOnChart += 1;
          if (pRank < existingStats.peakRank) existingStats.peakRank = pRank;
        }
      }
      pastWeekRankings.push(rankMap);
    }
  }

  const lastWeekRankings = pastWeekRankings[pastWeekRankings.length - 1] || new Map<string, number>();

  return qualifiedCurrent.slice(0, settings.chartSize || 100).map((item, idx) => {
    const rank = idx + 1;
    const key = item.key;
    const override = settings.manualOverrides[key];

    const hist = historicalArtistStats.get(key);
    const hasChartHistory = hist?.hasChartHistory ?? false;
    const peakRank = hist ? Math.min(rank, hist.peakRank) : rank;
    const weeksOnChart = (hist?.weeksOnChart ?? 0) + 1;

    const lastRank = lastWeekRankings.get(key) ?? null;
    let moveStatus: MoveStatus = 'flat';
    let moveDiff = 0;

    if (override?.forceStatus) {
      moveStatus = override.forceStatus;
      moveDiff = moveStatus === 'up' ? 1 : moveStatus === 'down' ? -1 : 0;
    } else if (!hasChartHistory && lastRank === null) {
      moveStatus = 'new';
    } else if (lastRank === null) {
      moveStatus = 'reentry';
    } else {
      moveDiff = lastRank - rank;
      moveStatus = moveDiff > 0 ? 'up' : moveDiff < 0 ? 'down' : 'flat';
    }

    const pointAdj = override?.pointAdjustment || 0;
    const rankPoints = rank <= 100 ? Math.max(1, 101 - rank + pointAdj) : Math.max(1, 1 + pointAdj);

    const weeklySales =
      item.playCount * (settings.trackPlayWeight ?? 50000) +
      rankPoints * (settings.trackStabilityWeight ?? 500);
    const cumulativePlays = cumulativeArtistPlaysMap.get(key) || item.playCount;
    const totalSales = cumulativePlays * (settings.trackPlayWeight ?? 50000);

    const topTracks = Array.from(item.trackMap?.entries() || [])
      .map(([title, playCount]) => ({ title, playCount }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 5);

    return {
      rank,
      previousRank: lastRank || undefined,
      lastRank,
      moveDiff,
      moveStatus,
      artist: item.artist,
      playCount: item.playCount,
      purePlays: item.playCount,
      points: Math.round(rankPoints),
      sales: Math.round(weeklySales),
      totalSales: Math.round(totalSales),
      trackCount: item.trackMap?.size || 0,
      coverArt: item.coverArt,
      peakRank,
      weeksOnChart,
      isLocked: override?.lockedRank !== undefined,
      isManuallyEdited: Boolean(override),
      topTracks,
      _key: key,
    };
  });
}

// Module-level cached album catalog map to avoid re-scanning 250k scrobbles on every render
let cachedAlbumCatalogMap: Map<string, Set<string>> | null = null;
let cachedAlbumCatalogScrobblesRef: Scrobble[] | null = null;
let cachedAlbumCatalogLength = -1;

function getAlbumCatalogMap(allScrobbles: Scrobble[]): Map<string, Set<string>> {
  if (
    cachedAlbumCatalogMap &&
    cachedAlbumCatalogScrobblesRef === allScrobbles &&
    cachedAlbumCatalogLength === allScrobbles.length
  ) {
    return cachedAlbumCatalogMap;
  }

  const map = new Map<string, Set<string>>();
  for (let i = 0; i < allScrobbles.length; i++) {
    const s = allScrobbles[i];
    if (!s.album || s.album.trim().length === 0) continue;
    const key = getFuzzyAlbumKey(s.album, s.artist);
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    const cleanTrackTitle = normalizeStrict(normalizeTrackTitle(s.title));
    if (cleanTrackTitle) {
      set.add(cleanTrackTitle);
    }
  }

  cachedAlbumCatalogMap = map;
  cachedAlbumCatalogScrobblesRef = allScrobbles;
  cachedAlbumCatalogLength = allScrobbles.length;
  return map;
}

/**
 * Compute Weekly Album Chart (zerocharts rule: qualified with >= 2 tracks or 2 scrobbles)
 * Guaranteed rule: Albums with history cannot debut as new (reentry instead).
 */
export function computeWeeklyAlbumChart(
  weekNumber: number,
  allWeeks: ChartWeekInfo[],
  allScrobbles: Scrobble[],
  settings: ZeroChartSettings = DEFAULT_ZERO_SETTINGS
): AlbumChartItem[] {
  if (!allWeeks || allWeeks.length === 0 || !allScrobbles || allScrobbles.length === 0) {
    return [];
  }

  const minAlbumTracks = settings.minAlbumTracksToChart ?? 3;
  const albumCatalogTracksMap = getAlbumCatalogMap(allScrobbles);

  const photoCache = getPhotoCacheSnapshot();
  const weeklyAlbumMaps: Map<
    string,
    {
      title: string;
      artist: string;
      playCount: number;
      tracks: Set<string>;
      coverArt: string;
      lastTimestamp: number;
      points: number;
    }
  >[] = [];

  for (let w = 1; w <= weekNumber; w++) {
    const weekInfo = allWeeks[w - 1];
    const map = new Map<
      string,
      {
        title: string;
        artist: string;
        playCount: number;
        tracks: Set<string>;
        coverArt: string;
        lastTimestamp: number;
        points: number;
      }
    >();

    if (weekInfo) {
      const weekScrobbles =
        weekInfo.scrobbles ??
        allScrobbles.filter(
          (s) => s.timestamp >= weekInfo.startTimestamp && s.timestamp < weekInfo.endTimestamp
        );

      for (const s of weekScrobbles) {
        if (!s.album || s.album.trim().length === 0) continue;

        const key = getFuzzyAlbumKey(s.album, s.artist);
        if (settings.blacklistedKeys.includes(key)) continue;

        // Check if album meets minimum 3 tracks overall qualification across library catalog
        const totalCatalogTracks = albumCatalogTracksMap.get(key)?.size || 0;
        if (totalCatalogTracks < minAlbumTracks) continue;

        const override = settings.manualOverrides[key];
        if (override?.isBlacklisted) continue;

        const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
        const albumTitle = override?.titleOverride || s.album;
        const artist = override?.artistOverride || primaryArtist;
        const albumCacheKey = `${artist.toLowerCase()}:::${s.album.toLowerCase()}`;
        const cachedAlbumPhoto = photoCache.albums[albumCacheKey];
        const coverArt =
          override?.coverArtOverride ||
          cachedAlbumPhoto ||
          s.coverArt ||
          'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';

        if (!map.has(key)) {
          map.set(key, {
            title: albumTitle,
            artist,
            playCount: 1,
            tracks: new Set([s.title]),
            coverArt,
            lastTimestamp: s.timestamp,
            points: 1,
          });
        } else {
          const ent = map.get(key)!;
          ent.playCount += 1;
          ent.tracks.add(s.title);
          if (s.timestamp > ent.lastTimestamp) ent.lastTimestamp = s.timestamp;
        }
      }

      map.forEach((val, key) => {
        const override = settings.manualOverrides[key];
        const adj = override?.pointAdjustment || 0;
        val.points = val.playCount * settings.playMultiplier * 100 + adj;
      });
    }

    weeklyAlbumMaps.push(map);
  }

  const currentMap = weeklyAlbumMaps[weekNumber - 1] || new Map();
  const qualifiedCurrent = Array.from(currentMap.entries())
    .filter(([key, v]) => {
      const totalCatalogTracks = albumCatalogTracksMap.get(key)?.size || 0;
      return v.playCount >= (settings.minScrobblesToChart || 1) && totalCatalogTracks >= minAlbumTracks;
    })
    .map(([key, v]) => ({ key, ...v }));

  qualifiedCurrent.sort((a, b) => {
    const lockA = settings.manualOverrides[a.key]?.lockedRank;
    const lockB = settings.manualOverrides[b.key]?.lockedRank;
    if (lockA !== undefined && lockB !== undefined) return lockA - lockB;
    if (lockA !== undefined) return -1;
    if (lockB !== undefined) return 1;
    return b.points - a.points;
  });

  const cumulativeAlbumPlaysMap = new Map<string, number>();
  const historicalAlbumStats = new Map<
    string,
    {
      peakRank: number;
      weeksOnChart: number;
      cumulativeChartPoints: number;
      hasChartHistory: boolean;
    }
  >();

  const pastWeekRankings: Map<string, number>[] = [];
  for (let w = 1; w <= weekNumber; w++) {
    const wMap = weeklyAlbumMaps[w - 1] || new Map();
    wMap.forEach((v, k) => {
      cumulativeAlbumPlaysMap.set(k, (cumulativeAlbumPlaysMap.get(k) || 0) + v.playCount);
    });

    if (w < weekNumber) {
      const sortedW = Array.from(wMap.entries()).sort((a, b) => b[1].points - a[1].points);
      const rankMap = new Map<string, number>();
      for (let idx = 0; idx < sortedW.length; idx++) {
        const [k] = sortedW[idx];
        const pRank = idx + 1;
        rankMap.set(k, pRank);

        const existingStats = historicalAlbumStats.get(k);
        const chartPts = pRank <= 100 ? Math.max(1, 101 - pRank) : 0;
        if (!existingStats) {
          historicalAlbumStats.set(k, {
            peakRank: pRank,
            weeksOnChart: 1,
            cumulativeChartPoints: chartPts,
            hasChartHistory: true,
          });
        } else {
          existingStats.hasChartHistory = true;
          existingStats.weeksOnChart += 1;
          if (pRank < existingStats.peakRank) existingStats.peakRank = pRank;
          existingStats.cumulativeChartPoints += chartPts;
        }
      }
      pastWeekRankings.push(rankMap);
    }
  }

  const lastWeekRankings = pastWeekRankings[pastWeekRankings.length - 1] || new Map<string, number>();

  return qualifiedCurrent.slice(0, settings.chartSize || 100).map((item, idx) => {
    const rank = idx + 1;
    const key = item.key;
    const override = settings.manualOverrides[key];

    const hist = historicalAlbumStats.get(key);
    const hasChartHistory = hist?.hasChartHistory ?? false;
    const peakRank = hist ? Math.min(rank, hist.peakRank) : rank;
    const weeksOnChart = (hist?.weeksOnChart ?? 0) + 1;

    const lastRank = lastWeekRankings.get(key) ?? null;
    let moveStatus: MoveStatus = 'flat';
    let moveDiff = 0;

    if (override?.forceStatus) {
      moveStatus = override.forceStatus;
      moveDiff = moveStatus === 'up' ? 1 : moveStatus === 'down' ? -1 : 0;
    } else if (!hasChartHistory && lastRank === null) {
      moveStatus = 'new';
    } else if (lastRank === null) {
      moveStatus = 'reentry';
    } else {
      moveDiff = lastRank - rank;
      moveStatus = moveDiff > 0 ? 'up' : moveDiff < 0 ? 'down' : 'flat';
    }

    // Cumulative units for album certifications (Formula: Plays * PlayWeight + Stability Chart Points * StabilityWeight)
    const cumulativePlays = cumulativeAlbumPlaysMap.get(key) || item.playCount;
    let cumulativeChartPoints = hist?.cumulativeChartPoints ?? 0;
    if (rank <= 100) {
      cumulativeChartPoints += Math.max(1, 101 - rank);
    }

    const pointAdj = override?.pointAdjustment || 0;
    const rankPoints = rank <= 100 ? Math.max(1, 101 - rank + pointAdj) : Math.max(1, 1 + pointAdj);

    const weeklySales =
      item.playCount * (settings.albumPlayWeight ?? 5000) +
      rankPoints * (settings.albumStabilityWeight ?? 500);

    const albumUnits =
      cumulativePlays * (settings.albumPlayWeight ?? 5000) +
      cumulativeChartPoints * (settings.albumStabilityWeight ?? 500);

    const { tier: certTier } = getCertificationLabel(
      albumUnits,
      settings.goldThresholdAlbum ?? 500000,
      settings.platinumThresholdAlbum ?? 1000000,
      settings.diamondThresholdAlbum ?? 10000000
    );

    return {
      rank,
      previousRank: lastRank || undefined,
      lastRank,
      moveDiff,
      moveStatus,
      title: item.title,
      artist: item.artist,
      playCount: item.playCount,
      purePlays: item.playCount,
      points: Math.round(rankPoints),
      sales: Math.round(weeklySales),
      totalSales: Math.round(albumUnits),
      coverArt: item.coverArt,
      peakRank,
      weeksOnChart,
      isLocked: override?.lockedRank !== undefined,
      isManuallyEdited: Boolean(override),
      tracksCount: albumCatalogTracksMap.get(key)?.size || item.tracks.size,
      certification: certTier,
      _key: key,
    };
  });
}
