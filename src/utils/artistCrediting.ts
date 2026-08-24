/**
 * Multi-Artist & Feature Crediting Engine
 * Guarantees that all primary and featured artists are credited for:
 * - Top 100 Chart entries
 * - Weeks on chart
 * - Peak rankings & #1 songs / #1 debuts
 * - Stream totals
 * - Plaque certifications (Gold, Platinum, Multi-Platinum, Diamond)
 */

import { Scrobble, ChartWeekInfo, ZeroChartSettings, PlaqueMilestone } from '../types/music';
import { getPhotoCacheSnapshot } from './lastfmImageFetcher';
import {
  normalizeStrict,
  normalizeTrackTitle,
  normalizeAlbumTitle,
  stringSimilarity,
  preferDisplayTitle,
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

  // Replace common divider words with delimiter
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
 * e.g. "Take Care (feat. Rihanna)" -> ["Rihanna"]
 * e.g. "Stuck with U (with Justin Bieber)" -> ["Justin Bieber"]
 * e.g. "Don't Start Now (Live / Acoustic feat. Dua Lipa)" -> ["Dua Lipa"]
 */
export function extractFeaturedFromTitle(titleStr: string): string[] {
  const s = String(titleStr || '');
  const found: string[] = [];

  // 1. Parenthetical or Bracketed features
  const reParens = /[\(\[](?:feat\.?|featuring|ft\.?|with|duet\s+with|x)\s+([^\)\]]+)[\)\]]/gi;
  let match: RegExpExecArray | null;
  while ((match = reParens.exec(s)) !== null) {
    found.push(match[1]);
  }

  // 2. Trailing inline feature
  const reInline = /(?:feat\.?|featuring|ft\.?|with|duet\s+with)\s+([^\-\(\)\[\]|•]+)$/gi;
  while ((match = reInline.exec(s)) !== null) {
    found.push(match[1]);
  }

  // Split any compound featured artists like "Rihanna & Future"
  return found
    .flatMap((f) => splitArtistList(f))
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/**
 * Gets all unique credited artists for a scrobble or chart row.
 */
export function getAllCreditedArtists(artistStr: string, titleStr: string): CreditedArtistInfo[] {
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

  return Array.from(artistMap.values());
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

export interface ArtistProfileSongEntry {
  key: string;
  titleDisplay: string;
  artistDisplay: string;
  playCount: number;
  salesBase: number;
  streamsBase: number;
  weeksOnChart: number;
  peakRank: number;
  popPeakRank: number; // Peak on popularity / points
  num1s: number; // Number of weeks at #1
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
  tracksCount: number;
  certLabel: string;
  certTier: PlaqueMilestone | null;
  coverArt?: string;
}

export interface ArtistProfileStats {
  artistName: string;
  totalSongsCharted: number;
  distinctNum1Songs: number;
  totalNum1Weeks: number;
  totalTop10s: number;
  debutAt1Count: number;
  totalPlays: number;
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
      tier: 'platinum',
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

/**
 * Formats compact numbers (e.g. 1.2M, 450K, 12)
 */
export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

/**
 * Computes a comprehensive Artist Profile from history and weekly charts.
 * Credits all features and collaborative works.
 */
export function computeArtistProfile(
  targetArtist: string,
  allScrobbles: Scrobble[],
  allWeeks: ChartWeekInfo[],
  mergedMap: Record<string, string> = {},
  settings: ZeroChartSettings
): ArtistProfileStats {
  const artistKey = normalizeStrict(targetArtist);
  const INF_RANK = 999999;
  const SIMILARITY_THRESHOLD = 0.95;

  // 1. Build weekly track rankings across history to detect peaks, weeks, and #1s
  const weeklyTrackRanks: Map<string, number>[] = [];
  const weeklyTrackPoints: Map<string, number>[] = [];

  for (let w = 1; w <= allWeeks.length; w++) {
    const weekInfo = allWeeks[w - 1];
    if (!weekInfo) continue;

    const weekScrobbles = allScrobbles.filter(
      (s) => s.timestamp >= weekInfo.startTimestamp && s.timestamp < weekInfo.endTimestamp
    );

    // Aggregate by canonical track
    const trackMap = new Map<string, { plays: number; points: number }>();
    for (const s of weekScrobbles) {
      const normT = normalizeTrackTitle(s.title);
      const normA = normalizeStrict(s.artist);
      const mergeKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
      const canonicalTitle = mergedMap[mergeKey] || normT;
      const key = `${normA}:::${normalizeStrict(canonicalTitle)}`;

      const cur = trackMap.get(key) || { plays: 0, points: 0 };
      cur.plays += 1;
      cur.points += settings.playMultiplier * 100;
      trackMap.set(key, cur);
    }

    const sorted = Array.from(trackMap.entries())
      .filter(([, v]) => v.plays >= (settings.minScrobblesToChart || 1))
      .sort((a, b) => b[1].points - a[1].points);

    const rankMap = new Map<string, number>();
    const pointMap = new Map<string, number>();
    sorted.forEach(([k, val], idx) => {
      rankMap.set(k, idx + 1);
      pointMap.set(k, val.points);
    });

    weeklyTrackRanks.push(rankMap);
    weeklyTrackPoints.push(pointMap);
  }

  // 2. Aggregate songs involving target artist
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
    }
  > = {};

  const albumsMap: Record<
    string,
    {
      name: string;
      salesBase: number;
      playCount: number;
      tracks: Set<string>;
      coverArt?: string;
    }
  > = {};

  const photoCache = getPhotoCacheSnapshot();

  // Process all scrobbles
  for (const s of allScrobbles) {
    if (!trackInvolvesArtist(s.artist, s.title, targetArtist)) {
      continue;
    }

    const normT = normalizeTrackTitle(s.title);
    const mergeKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const canonicalTitle = mergedMap[mergeKey] || normT;
    const titleKey = normalizeStrict(canonicalTitle);

    // Find fuzzy matching canonical song key
    let canonKey: string | null = null;
    for (const k of canonicalSongKeys) {
      if (stringSimilarity(titleKey, k) >= SIMILARITY_THRESHOLD) {
        canonKey = k;
        break;
      }
    }

    const trackPhoto = photoCache.tracks[`${s.artist.toLowerCase()}:::${canonicalTitle.toLowerCase()}`] ||
      photoCache.tracks[`${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`] ||
      s.coverArt;

    if (!canonKey) {
      canonKey = titleKey || `SONG_${canonicalSongKeys.length + 1}`;
      canonicalSongKeys.push(canonKey);
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
      };
    } else {
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

    // Track debut year minimum
    const scrobbleYear = new Date(s.timestamp * 1000).getFullYear();
    if (typeof song.debutYear === 'number' && scrobbleYear < song.debutYear) {
      song.debutYear = scrobbleYear;
    }

    // Albums aggregation
    if (s.album && s.album.trim().length > 0) {
      const albNorm = normalizeStrict(normalizeAlbumTitle(s.album));
      if (albNorm && albNorm !== 'NAN' && albNorm !== 'UNKNOWN') {
        const albumPhoto = photoCache.albums[`${s.artist.toLowerCase()}:::${s.album.toLowerCase()}`] || s.coverArt;
        if (!albumsMap[albNorm]) {
          albumsMap[albNorm] = {
            name: s.album,
            salesBase: 0,
            playCount: 0,
            tracks: new Set(),
            coverArt: albumPhoto,
          };
        }
        albumsMap[albNorm].playCount += 1;
        albumsMap[albNorm].tracks.add(canonKey);
        if (albumPhoto && !albumsMap[albNorm].coverArt) {
          albumsMap[albNorm].coverArt = albumPhoto;
        }
      }
    }
  }

  // Calculate Chart Performance (Weeks, Peak, #1s, First Debut) across the chart weeks
  for (let w = 1; w <= allWeeks.length; w++) {
    const rankMap = weeklyTrackRanks[w - 1];
    const pointMap = weeklyTrackPoints[w - 1];
    if (!rankMap) continue;

    for (const canonKey of canonicalSongKeys) {
      const song = songsMap[canonKey];
      if (!song) continue;

      // Check if this song charted in week w
      // Match against rankMap keys
      let foundRank = INF_RANK;
      let foundPoints = 0;

      rankMap.forEach((r, k) => {
        const [, kTitle] = k.split(':::');
        if (kTitle && stringSimilarity(canonKey, kTitle) >= SIMILARITY_THRESHOLD) {
          if (r < foundRank) {
            foundRank = r;
            foundPoints = pointMap.get(k) || 0;
          }
        }
      });

      if (foundRank <= (settings.chartSize || 100)) {
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

  // Calculate units and certifications for songs
  const songsList: ArtistProfileSongEntry[] = Object.entries(songsMap).map(([key, S]) => {
    const weeksCount = S.weeksSeen.size;
    const calcUnits =
      S.rawPlays * (settings.trackPlayWeight ?? 50000) +
      weeksCount * (settings.trackStabilityWeight ?? 500);

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
      streamsBase: S.rawPlays,
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

  // Calculate units and certifications for albums (strictly requiring at least 3 linked songs to qualify as an album)
  const minAlbumTracks = settings.minAlbumTracksToChart ?? 3;
  const albumsList: ArtistProfileAlbumEntry[] = Object.entries(albumsMap)
    .filter(([, A]) => A.tracks.size >= minAlbumTracks)
    .map(([key, A]) => {
      const calcUnits = A.playCount * (settings.albumPlayWeight ?? 5000);
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
        tracksCount: A.tracks.size,
        certLabel,
        certTier,
        coverArt: A.coverArt,
      };
    });

  // Sort albums by sales descending
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

  const songsByYear = sortedYears.map((year) => {
    const yrSongs = songsByYearMap.get(year) || [];
    // Sort songs within year: first by peak rank, then by plays
    yrSongs.sort((a, b) => a.peakRank - b.peakRank || b.playCount - a.playCount);

    const songsCount = yrSongs.length;
    const num1sCount = yrSongs.filter((s) => s.peakRank === 1).length;
    const top10sCount = yrSongs.filter((s) => s.peakRank <= 10).length;

    return {
      year,
      songsCount,
      num1sCount,
      top10sCount,
      songs: yrSongs,
    };
  });

  // Calculate Overall Totals
  const totalSongsCharted = songsList.length;
  const distinctNum1Songs = songsList.filter((s) => s.peakRank === 1).length;
  const totalNum1Weeks = songsList.reduce((acc, s) => acc + s.num1s, 0);
  const totalTop10s = songsList.filter((s) => s.peakRank <= 10).length;
  const debutAt1Count = songsList.filter((s) => s.firstRank === 1).length;
  const totalPlays = songsList.reduce((acc, s) => acc + s.playCount, 0);
  const totalCalculatedUnits = songsList.reduce((acc, s) => acc + s.salesBase, 0);

  // Certification summary counts
  const albumCertCounts: Record<string, number> = {};
  for (const alb of albumsList) {
    if (alb.certLabel && alb.certLabel !== '—') {
      albumCertCounts[alb.certLabel] = (albumCertCounts[alb.certLabel] || 0) + 1;
    }
  }

  const trackCertCounts: Record<string, number> = {};
  for (const s of songsList) {
    if (s.certLabel && s.certLabel !== '—') {
      trackCertCounts[s.certLabel] = (trackCertCounts[s.certLabel] || 0) + 1;
    }
  }

  return {
    artistName: targetArtist,
    totalSongsCharted,
    distinctNum1Songs,
    totalNum1Weeks,
    totalTop10s,
    debutAt1Count,
    totalPlays,
    totalCalculatedUnits,
    albumCertCounts,
    trackCertCounts,
    albums: albumsList,
    songsByYear,
  };
}
