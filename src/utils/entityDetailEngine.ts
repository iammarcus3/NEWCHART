import {
  Scrobble,
  ChartWeekInfo,
  ZeroChartSettings,
  PlaqueMilestone,
  TrackChartItem,
  AlbumChartItem,
  ArtistChartItem,
} from '../types/music';
import {
  normalizeStrict,
  normalizeTrackTitle,
  normalizeAlbumTitle,
  stringSimilarity,
} from './similarity';
import {
  getAllCreditedArtists,
  trackInvolvesArtist,
  splitArtistList,
  getCertificationLabel,
} from './artistCrediting';
import { computeEntityGenreChartHistory, GenreChartPerformance } from './genreEngine';
import { getPhotoCacheSnapshot } from './lastfmImageFetcher';

export interface WeeklyRankPoint {
  weekNumber: number;
  dateRange: string;
  rank: number;
  plays: number;
  sales: number;
  points: number;
}

export interface AlbumTrackDetailItem {
  title: string;
  playCount: number;
  peakRank: number | null;
  weeksOnChart: number;
  sales: number;
  streams: number;
  coverArt?: string;
}

export interface DetailedEntityStats {
  type: 'track' | 'album' | 'artist';
  title: string;
  artist: string;
  creditedArtists: { name: string; role: string; normalizedKey: string }[];
  albumName?: string;
  albumCoverArt?: string;
  coverArt: string;
  playCount: number;
  sales: number;
  streams: number;
  peakRank: number | null;
  weeksOnChart: number;
  weeksAtNumberOne: number;
  weeksInTop10: number;
  debutRank: number | null;
  debutWeekNumber: number | null;
  debutDate?: string;
  debutYear?: number | string;
  isDebutNumberOne: boolean;
  isHotShotDebut: boolean;
  bestWeek: {
    weekNumber: number;
    dateRange: string;
    rank: number;
    plays: number;
    sales: number;
  } | null;
  weeklyTrajectory: WeeklyRankPoint[];
  genrePerformances: GenreChartPerformance[];
  certLabel: string;
  certTier: PlaqueMilestone | null;
  nextMilestone: {
    name: string;
    targetUnits: number;
    currentUnits: number;
    progressPercent: number;
    remainingUnits: number;
  };
  albumTracks?: AlbumTrackDetailItem[];
}

/**
 * Computes deep analytics and verified stats for any track or album clicked across the app.
 */
export function computeDetailedEntityStats(
  type: 'track' | 'album' | 'artist',
  rawTitle: string,
  rawArtist: string,
  allScrobbles: Scrobble[],
  allWeeks: ChartWeekInfo[],
  allWeeklyCharts: {
    tracks: TrackChartItem[][];
    albums: AlbumChartItem[][];
    artists: ArtistChartItem[][];
  },
  mergedMap: Record<string, string> = {},
  mergedAlbumsMap: Record<string, string> = {},
  settings: ZeroChartSettings,
  selectedWeekNumber?: number
): DetailedEntityStats {
  const photoCache = getPhotoCacheSnapshot();

  const cleanArtist = (rawArtist || '').trim();
  const cleanTitle = (rawTitle || '').trim();
  const creditedArtists = getAllCreditedArtists(cleanArtist, cleanTitle);

  const primaryArtist = splitArtistList(cleanArtist)[0] || cleanArtist;
  const targetArtistNorm = normalizeStrict(cleanArtist);
  const primaryArtistNorm = normalizeStrict(primaryArtist);

  // Normalized title based on type and merge maps
  let targetTitleNorm = '';
  let mappedTitle = cleanTitle;

  if (type === 'track') {
    const rawTrackKey = `${cleanArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
    const primaryTrackKey = `${primaryArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
    mappedTitle = mergedMap[rawTrackKey] || mergedMap[primaryTrackKey] || cleanTitle;
    targetTitleNorm = normalizeStrict(normalizeTrackTitle(mappedTitle));
  } else if (type === 'album') {
    const rawAlbKey = `${cleanArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
    const primaryAlbKey = `${primaryArtist.toLowerCase()}:::${cleanTitle.toLowerCase()}`;
    mappedTitle = mergedAlbumsMap[rawAlbKey] || mergedAlbumsMap[primaryAlbKey] || cleanTitle;
    targetTitleNorm = normalizeStrict(normalizeAlbumTitle(mappedTitle));
  }

  // 1. Gather all scrobbles for this specific entity
  let totalPlays = 0;
  const albumTrackMap = new Map<string, { title: string; plays: number; coverArt?: string }>();
  let detectedAlbumName: string | undefined = undefined;
  let detectedAlbumCover: string | undefined = undefined;
  let detectedCover: string = '';

  for (let i = 0; i < allScrobbles.length; i++) {
    const s = allScrobbles[i];
    const sArtistNorm = normalizeStrict(s.artist);

    // Artist involvement check
    const artistMatches =
      sArtistNorm === targetArtistNorm ||
      sArtistNorm === primaryArtistNorm ||
      trackInvolvesArtist(s.artist, s.title, cleanArtist) ||
      creditedArtists.some((c) => sArtistNorm === c.normalizedKey);

    if (!artistMatches) continue;

    if (type === 'track') {
      const sRawKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
      const sMapped = mergedMap[sRawKey] || s.title;
      const sTitleNorm = normalizeStrict(normalizeTrackTitle(sMapped));

      if (
        sTitleNorm === targetTitleNorm ||
        stringSimilarity(sTitleNorm, targetTitleNorm) >= 0.88
      ) {
        totalPlays += 1;
        if (!detectedCover && s.coverArt) detectedCover = s.coverArt;
        if (s.album && !detectedAlbumName) {
          detectedAlbumName = s.album;
        }
      }
    } else if (type === 'album') {
      if (!s.album) continue;
      const sAlbRaw = `${s.artist.toLowerCase()}:::${s.album.toLowerCase()}`;
      const sAlbMapped = mergedAlbumsMap[sAlbRaw] || s.album;
      const sAlbNorm = normalizeStrict(normalizeAlbumTitle(sAlbMapped));

      if (
        sAlbNorm === targetTitleNorm ||
        stringSimilarity(sAlbNorm, targetTitleNorm) >= 0.88
      ) {
        totalPlays += 1;
        if (!detectedCover && s.coverArt) detectedCover = s.coverArt;

        const cleanTrTitle = normalizeTrackTitle(s.title);
        const trKey = normalizeStrict(cleanTrTitle);
        const existingTr = albumTrackMap.get(trKey);
        if (!existingTr) {
          albumTrackMap.set(trKey, { title: cleanTrTitle, plays: 1, coverArt: s.coverArt });
        } else {
          existingTr.plays += 1;
          if (!existingTr.coverArt && s.coverArt) existingTr.coverArt = s.coverArt;
        }
      }
    }
  }

  // Fallback cover resolution from photo cache
  if (!detectedCover) {
    if (type === 'track') {
      detectedCover =
        photoCache.tracks[`${cleanArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`] ||
        photoCache.tracks[`${primaryArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`] ||
        '';
    } else if (type === 'album') {
      detectedCover =
        photoCache.albums[`${cleanArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`] ||
        photoCache.albums[`${primaryArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`] ||
        '';
    }
  }

  if (type === 'track' && detectedAlbumName && !detectedAlbumCover) {
    detectedAlbumCover =
      photoCache.albums[`${cleanArtist.toLowerCase()}:::${detectedAlbumName.toLowerCase()}`] ||
      photoCache.albums[`${primaryArtist.toLowerCase()}:::${detectedAlbumName.toLowerCase()}`] ||
      '';
  }

  if (!detectedCover) {
    detectedCover =
      type === 'album'
        ? 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop&q=80';
  }

  // 2. Compute Chart History across all weekly charts
  const weeklyTrajectory: WeeklyRankPoint[] = [];
  let peakRank: number | null = null;
  let weeksAtNumberOne = 0;
  let weeksInTop10 = 0;
  let debutRank: number | null = null;
  let debutWeekNumber: number | null = null;
  let debutDate: string | undefined = undefined;
  let debutYear: number | string | undefined = undefined;
  let isDebutNumberOne = false;
  let isHotShotDebut = false;
  let stabilityPoints = 0;

  let bestWeek: {
    weekNumber: number;
    dateRange: string;
    rank: number;
    plays: number;
    sales: number;
  } | null = null;

  const totalWeeks = allWeeks.length;
  const chartSize = settings.chartSize || 100;

  for (let w = 1; w <= totalWeeks; w++) {
    const weekInfo = allWeeks[w - 1];
    const dateRange = weekInfo?.dateRange || `Week ${w}`;

    let matchedItem: TrackChartItem | AlbumChartItem | undefined = undefined;

    if (type === 'track') {
      const weekTracks = allWeeklyCharts.tracks[w - 1] || [];
      matchedItem = weekTracks.find((it) => {
        const itArtistNorm = normalizeStrict(it.artist);
        const itArtistMatch =
          itArtistNorm === targetArtistNorm ||
          itArtistNorm === primaryArtistNorm ||
          trackInvolvesArtist(it.artist, it.title, cleanArtist) ||
          creditedArtists.some((c) => itArtistNorm === c.normalizedKey);
        if (!itArtistMatch) return false;

        const itTitleNorm = normalizeStrict(normalizeTrackTitle(it.title));
        return (
          itTitleNorm === targetTitleNorm ||
          stringSimilarity(itTitleNorm, targetTitleNorm) >= 0.88
        );
      });
    } else if (type === 'album') {
      const weekAlbums = allWeeklyCharts.albums[w - 1] || [];
      matchedItem = weekAlbums.find((it) => {
        const itArtistNorm = normalizeStrict(it.artist);
        const itArtistMatch =
          itArtistNorm === targetArtistNorm ||
          itArtistNorm === primaryArtistNorm ||
          trackInvolvesArtist(it.artist, it.title, cleanArtist) ||
          creditedArtists.some((c) => itArtistNorm === c.normalizedKey);
        if (!itArtistMatch) return false;

        const itAlbNorm = normalizeStrict(normalizeAlbumTitle(it.title));
        return (
          itAlbNorm === targetTitleNorm ||
          stringSimilarity(itAlbNorm, targetTitleNorm) >= 0.88
        );
      });
    }

    if (matchedItem && matchedItem.rank <= chartSize) {
      const r = matchedItem.rank;
      const pts = matchedItem.points || Math.max(1, 101 - r);
      const sales = matchedItem.sales || 0;
      const plays = matchedItem.playCount || 0;

      weeklyTrajectory.push({
        weekNumber: w,
        dateRange,
        rank: r,
        plays,
        sales,
        points: pts,
      });

      if (peakRank === null || r < peakRank) {
        peakRank = r;
      }
      if (r === 1) {
        weeksAtNumberOne += 1;
      }
      if (r <= 10) {
        weeksInTop10 += 1;
      }

      // Rank-based chart stability: #1 = 100 pts down to #100 = 1 pt
      stabilityPoints += Math.max(1, 101 - r);

      // Debut tracking
      if (debutWeekNumber === null) {
        debutWeekNumber = w;
        debutRank = r;
        debutDate = dateRange;
        debutYear = weekInfo ? new Date(weekInfo.startTimestamp * 1000).getFullYear() : undefined;
        if (r === 1) isDebutNumberOne = true;
        if (matchedItem.isHotShotDebut) isHotShotDebut = true;
      }

      // Best week tracking
      if (!bestWeek || plays > bestWeek.plays || (plays === bestWeek.plays && r < bestWeek.rank)) {
        bestWeek = {
          weekNumber: w,
          dateRange,
          rank: r,
          plays,
          sales,
        };
      }
    }
  }

  const weeksOnChart = weeklyTrajectory.length;

  // 3. Certified Sales / Units Calculation
  let calculatedSales = 0;
  if (type === 'track') {
    const playWeight = settings.trackPlayWeight ?? 50000;
    const stabWeight = settings.trackStabilityWeight ?? 50;
    calculatedSales = totalPlays * playWeight + weeksOnChart * stabWeight;
  } else if (type === 'album') {
    const playWeight = settings.albumPlayWeight ?? 5000;
    const stabWeight = settings.albumStabilityWeight ?? 500;
    calculatedSales = totalPlays * playWeight + stabilityPoints * stabWeight;
  } else {
    calculatedSales = totalPlays * 50000;
  }

  // 4. Streams Calculation
  const streamFactor = settings.streamFactorPerPlay ?? 10875000;
  const calculatedStreams = totalPlays * streamFactor;

  // 5. Certification Tier & Label
  const goldThreshold =
    type === 'album'
      ? settings.goldThresholdAlbum ?? 500000
      : settings.goldThresholdTrack ?? 500000;
  const platThreshold =
    type === 'album'
      ? settings.platinumThresholdAlbum ?? 1000000
      : settings.platinumThresholdTrack ?? 1000000;
  const diamThreshold =
    type === 'album'
      ? settings.diamondThresholdAlbum ?? 10000000
      : settings.diamondThresholdTrack ?? 10000000;

  const { label: certLabel, tier: certTier } = getCertificationLabel(
    calculatedSales,
    goldThreshold,
    platThreshold,
    diamThreshold
  );

  // Next milestone calculation
  let nextMilestoneName = 'Gold';
  let targetUnits = goldThreshold;

  if (calculatedSales >= diamThreshold) {
    nextMilestoneName = 'Multi-Diamond';
    targetUnits = diamThreshold * 2;
  } else if (calculatedSales >= platThreshold * 5) {
    nextMilestoneName = 'Diamond';
    targetUnits = diamThreshold;
  } else if (calculatedSales >= platThreshold * 2) {
    nextMilestoneName = '5x Platinum';
    targetUnits = platThreshold * 5;
  } else if (calculatedSales >= platThreshold) {
    nextMilestoneName = '2x Multi-Platinum';
    targetUnits = platThreshold * 2;
  } else if (calculatedSales >= goldThreshold) {
    nextMilestoneName = 'Platinum';
    targetUnits = platThreshold;
  }

  const progressPercent = Math.min(100, Math.round((calculatedSales / targetUnits) * 100));
  const remainingUnits = Math.max(0, targetUnits - calculatedSales);

  // 6. Genre Chart History
  const genrePerformances =
    type === 'track' || type === 'album'
      ? computeEntityGenreChartHistory(
          type,
          cleanTitle,
          cleanArtist,
          allWeeks,
          mergedMap,
          selectedWeekNumber
        )
      : [];

  // 7. Album Tracks breakdown (if type === 'album')
  let albumTracks: AlbumTrackDetailItem[] | undefined = undefined;
  if (type === 'album') {
    const rawTrackList = Array.from(albumTrackMap.values());
    albumTracks = rawTrackList
      .map((tr) => {
        const normTr = normalizeStrict(normalizeTrackTitle(tr.title));
        // Find peak rank and weeks for this track
        let trPeak: number | null = null;
        let trWeeks = 0;
        for (let w = 0; w < allWeeklyCharts.tracks.length; w++) {
          const item = allWeeklyCharts.tracks[w].find((trackItem) => {
            const trackItemNorm = normalizeStrict(normalizeTrackTitle(trackItem.title));
            return (
              trackItemNorm === normTr ||
              stringSimilarity(trackItemNorm, normTr) >= 0.88
            );
          });
          if (item && item.rank <= chartSize) {
            trWeeks += 1;
            if (trPeak === null || item.rank < trPeak) {
              trPeak = item.rank;
            }
          }
        }
        const trSales =
          tr.plays * (settings.trackPlayWeight ?? 50000) +
          trWeeks * (settings.trackStabilityWeight ?? 50);
        const trStreams = tr.plays * streamFactor;

        return {
          title: tr.title,
          playCount: tr.plays,
          peakRank: trPeak,
          weeksOnChart: trWeeks,
          sales: trSales,
          streams: trStreams,
          coverArt: tr.coverArt || detectedCover,
        };
      })
      .sort((a, b) => b.playCount - a.playCount);
  }

  return {
    type,
    title: mappedTitle,
    artist: cleanArtist,
    creditedArtists: creditedArtists.map((c) => ({
      name: c.name,
      role: c.isFeatured ? 'Featured Artist' : 'Main Artist',
      normalizedKey: c.normalizedKey,
    })),
    albumName: detectedAlbumName,
    albumCoverArt: detectedAlbumCover,
    coverArt: detectedCover,
    playCount: totalPlays,
    sales: Math.round(calculatedSales),
    streams: calculatedStreams,
    peakRank,
    weeksOnChart,
    weeksAtNumberOne,
    weeksInTop10,
    debutRank,
    debutWeekNumber,
    debutDate,
    debutYear,
    isDebutNumberOne,
    isHotShotDebut,
    bestWeek,
    weeklyTrajectory,
    genrePerformances,
    certLabel,
    certTier,
    nextMilestone: {
      name: nextMilestoneName,
      targetUnits,
      currentUnits: Math.round(calculatedSales),
      progressPercent,
      remainingUnits,
    },
    albumTracks,
  };
}
