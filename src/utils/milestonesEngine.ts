import {
  Scrobble,
  ChartWeekInfo,
  ZeroChartSettings,
  PlaqueMilestone,
} from '../types/music';
import {
  computeWeeklyTrackChart,
  computeWeeklyArtistChart,
  computeWeeklyAlbumChart,
  getFuzzyTrackKey,
  getFuzzyArtistKey,
  getFuzzyAlbumKey,
} from './weeklyChartEngine';
import { getCertificationLabel } from './artistCrediting';
import { normalizeStrict } from './similarity';

export interface MilestoneItem {
  id: string;
  rank: number;
  title: string;
  subtitle: string;
  artist?: string;
  album?: string;
  coverArt?: string;
  statValue: string | number;
  statLabel: string;
  secondaryStat?: string;
  extraBadge?: string;
  badgeType?: string;
  weekNumber?: number;
  dateRange?: string;
  type: 'track' | 'artist' | 'album' | 'week';
  year?: number;
  plays?: number;
  points?: number;
  salesUnits?: number;
  peakPosition?: number;
  weeksAtNum1?: number;
  weeksOnChart?: number;
}

export interface EraMilestoneItem {
  albumName: string;
  artist: string;
  coverArt: string;
  totalEraStreams: number;
  albumWeeksOnChart: number;
  albumPeak: number;
  trackCount: number;
  num1SinglesCount: number;
  top10SinglesCount: number;
  totalEraPoints: number;
  totalUnits: number;
  certLabel: string;
  certTier: PlaqueMilestone | null;
  topTracks: { title: string; plays: number; peak: number }[];
}

export interface PerfectAllKillItem {
  weekNumber: number;
  dateRange: string;
  artist: string;
  trackTitle: string;
  albumTitle: string;
  coverArt: string;
  totalWeekPlays: number;
  notes: string;
}

export interface MilestonesData {
  allNumberOnes: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  artistsWithMostNum1s: MilestoneItem[];
  songsWithMostWeeksAtNum1: MilestoneItem[];
  mostWeeksAccumulatedAtNum1: MilestoneItem[];
  artistsWithMostConsecutiveNum1s: MilestoneItem[];
  albumsWithMostNum1s: MilestoneItem[];
  artistsWithMostDebutsAtNum1: MilestoneItem[];
  songsWithMostConsecutiveWeeksAtNum1: MilestoneItem[];
  mostWeeksUntilReachingNum1: MilestoneItem[];
  artistsWithMostSimultaneousTracks: MilestoneItem[];
  albumsWithMostTracksAtNum1: MilestoneItem[];
  bestDebuts: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  mostPlaysInAWeek: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  pointsAccumulators: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  fastestArtistsToReachMilestones: {
    to5: MilestoneItem[];
    to10: MilestoneItem[];
    to20: MilestoneItem[];
  };
  longestActiveNum1CareerSpan: MilestoneItem[];
  songsWithBiggestJumpToNum1: MilestoneItem[];
  songsWithLongestClimbToNum1: MilestoneItem[];
  artistsWithHighestNum1ConversionRate: MilestoneItem[];
  perfectAllKills: PerfectAllKillItem[];
  chartDominationScores: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  mostWeeksAccumulated: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  mostWeeksAtNum1: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  mostConsecutiveWeeksAtNum1: {
    tracks: MilestoneItem[];
    artists: MilestoneItem[];
    albums: MilestoneItem[];
  };
  mostUnitsSold: {
    tracks: MilestoneItem[];
    albums: MilestoneItem[];
  };
  artistsWithMostSales: MilestoneItem[];
  biggestEras: EraMilestoneItem[];
  certificationsSummary: {
    totalGold: number;
    totalPlatinum: number;
    totalMultiPlatinum: number;
    totalDiamond: number;
    topCertifiedTracks: MilestoneItem[];
    topCertifiedAlbums: MilestoneItem[];
  };
}

export function computeMilestonesData(
  allWeeks: ChartWeekInfo[],
  allScrobbles: Scrobble[],
  mergedMap: Record<string, string>,
  settings: ZeroChartSettings
): MilestonesData {
  const totalWeeks = allWeeks.length;
  if (totalWeeks === 0 || allScrobbles.length === 0) {
    return getEmptyMilestonesData();
  }

  // Pre-calculate weekly charts for all historical weeks 1..totalWeeks
  const weeklyTracks: ReturnType<typeof computeWeeklyTrackChart>[] = [];
  const weeklyArtists: ReturnType<typeof computeWeeklyArtistChart>[] = [];
  const weeklyAlbums: ReturnType<typeof computeWeeklyAlbumChart>[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    weeklyTracks.push(computeWeeklyTrackChart(w, allWeeks, allScrobbles, mergedMap, settings));
    weeklyArtists.push(computeWeeklyArtistChart(w, allWeeks, allScrobbles, settings));
    weeklyAlbums.push(computeWeeklyAlbumChart(w, allWeeks, allScrobbles, settings));
  }

  // 1. All #1s Chronicle
  const allNum1Tracks: MilestoneItem[] = [];
  const allNum1Artists: MilestoneItem[] = [];
  const allNum1Albums: MilestoneItem[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    const weekInfo = allWeeks[w];
    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    const topArtist = weeklyArtists[w]?.find((a) => a.rank === 1);
    const topAlbum = weeklyAlbums[w]?.find((alb) => alb.rank === 1);

    const weekYear = weekInfo?.startTimestamp
      ? new Date(weekInfo.startTimestamp * 1000).getFullYear()
      : undefined;

    if (topTrack) {
      allNum1Tracks.push({
        id: `num1_track_w${weekNum}_${topTrack.id}`,
        rank: weekNum,
        title: topTrack.title,
        subtitle: topTrack.artist,
        artist: topTrack.artist,
        album: topTrack.album,
        coverArt: topTrack.coverArt,
        statValue: `Week ${weekNum}`,
        statLabel: weekInfo?.dateRange || `Week ${weekNum}`,
        secondaryStat: `${topTrack.playCount} plays (${topTrack.points.toLocaleString()} pts)`,
        extraBadge: `#1 Single`,
        badgeType: 'crown',
        weekNumber: weekNum,
        dateRange: weekInfo?.dateRange,
        type: 'track',
        peakPosition: 1,
        plays: topTrack.playCount,
        points: topTrack.points,
        year: weekYear,
      });
    }

    if (topArtist) {
      allNum1Artists.push({
        id: `num1_art_w${weekNum}_${topArtist.artist}`,
        rank: weekNum,
        title: topArtist.artist,
        subtitle: `${topArtist.trackCount} charted songs`,
        artist: topArtist.artist,
        coverArt: topArtist.coverArt,
        statValue: `Week ${weekNum}`,
        statLabel: weekInfo?.dateRange || `Week ${weekNum}`,
        secondaryStat: `${topArtist.playCount} total plays`,
        extraBadge: `#1 Artist`,
        badgeType: 'crown',
        weekNumber: weekNum,
        dateRange: weekInfo?.dateRange,
        type: 'artist',
        peakPosition: 1,
        plays: topArtist.playCount,
        points: topArtist.points,
        year: weekYear,
      });
    }

    if (topAlbum) {
      allNum1Albums.push({
        id: `num1_alb_w${weekNum}_${topAlbum.title}`,
        rank: weekNum,
        title: topAlbum.title,
        subtitle: topAlbum.artist,
        artist: topAlbum.artist,
        album: topAlbum.title,
        coverArt: topAlbum.coverArt,
        statValue: `Week ${weekNum}`,
        statLabel: weekInfo?.dateRange || `Week ${weekNum}`,
        secondaryStat: `${topAlbum.playCount} album plays`,
        extraBadge: `#1 Album`,
        badgeType: 'crown',
        weekNumber: weekNum,
        dateRange: weekInfo?.dateRange,
        type: 'album',
        peakPosition: 1,
        plays: topAlbum.playCount,
        points: topAlbum.points,
        year: weekYear,
      });
    }
  }

  // 2. Artists with Most #1s
  const artistNum1Map = new Map<
    string,
    { artist: string; coverArt: string; distinctNum1Tracks: Set<string>; totalNum1Weeks: number }
  >();

  for (let w = 0; w < totalWeeks; w++) {
    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (topTrack) {
      const art = topTrack.artist;
      const key = getFuzzyArtistKey(art);
      if (!artistNum1Map.has(key)) {
        artistNum1Map.set(key, {
          artist: art,
          coverArt: topTrack.coverArt,
          distinctNum1Tracks: new Set([topTrack.title]),
          totalNum1Weeks: 1,
        });
      } else {
        const ent = artistNum1Map.get(key)!;
        ent.distinctNum1Tracks.add(topTrack.title);
        ent.totalNum1Weeks += 1;
      }
    }
  }

  const artistsWithMostNum1s: MilestoneItem[] = Array.from(artistNum1Map.values())
    .sort((a, b) => b.distinctNum1Tracks.size - a.distinctNum1Tracks.size || b.totalNum1Weeks - a.totalNum1Weeks)
    .map((ent, idx) => ({
      id: `art_most_num1_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `${ent.totalNum1Weeks} total weeks at #1`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.distinctNum1Tracks.size} #1 Hits`,
      statLabel: 'Distinct #1 Songs',
      secondaryStat: Array.from(ent.distinctNum1Tracks).slice(0, 3).join(', ') + (ent.distinctNum1Tracks.size > 3 ? '...' : ''),
      badgeType: idx === 0 ? 'crown' : 'gold',
      type: 'artist',
      peakPosition: 1,
      weeksAtNum1: ent.totalNum1Weeks,
    }));

  // 3. Albums with Most #1 Hits / Most Weeks at #1
  const albumNum1HitsMap = new Map<
    string,
    {
      album: string;
      artist: string;
      coverArt: string;
      num1Singles: Set<string>;
      albumNum1Weeks: number;
    }
  >();

  for (let w = 0; w < totalWeeks; w++) {
    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (topTrack && topTrack.album) {
      const albKey = getFuzzyAlbumKey(topTrack.album, topTrack.artist);
      if (!albumNum1HitsMap.has(albKey)) {
        albumNum1HitsMap.set(albKey, {
          album: topTrack.album,
          artist: topTrack.artist,
          coverArt: topTrack.coverArt,
          num1Singles: new Set([topTrack.title]),
          albumNum1Weeks: 0,
        });
      } else {
        albumNum1HitsMap.get(albKey)!.num1Singles.add(topTrack.title);
      }
    }

    const topAlb = weeklyAlbums[w]?.find((a) => a.rank === 1);
    if (topAlb) {
      const albKey = getFuzzyAlbumKey(topAlb.title, topAlb.artist);
      if (!albumNum1HitsMap.has(albKey)) {
        albumNum1HitsMap.set(albKey, {
          album: topAlb.title,
          artist: topAlb.artist,
          coverArt: topAlb.coverArt,
          num1Singles: new Set(),
          albumNum1Weeks: 1,
        });
      } else {
        albumNum1HitsMap.get(albKey)!.albumNum1Weeks += 1;
      }
    }
  }

  const albumsWithMostNum1s: MilestoneItem[] = Array.from(albumNum1HitsMap.values())
    .filter((a) => a.num1Singles.size > 0 || a.albumNum1Weeks > 0)
    .sort((a, b) => b.num1Singles.size - a.num1Singles.size || b.albumNum1Weeks - a.albumNum1Weeks)
    .map((ent, idx) => ({
      id: `alb_num1_${idx}_${ent.album}`,
      rank: idx + 1,
      title: ent.album,
      subtitle: ent.artist,
      artist: ent.artist,
      album: ent.album,
      coverArt: ent.coverArt,
      statValue: `${ent.num1Singles.size} #1 Single${ent.num1Singles.size === 1 ? '' : 's'}`,
      statLabel: 'Number 1 Singles',
      secondaryStat: `${ent.albumNum1Weeks} weeks at #1 album`,
      badgeType: 'pro',
      type: 'album',
    }));

  // 4. Most Weeks Accumulated (All-time chart longevity)
  const trackAccumMap = new Map<string, { title: string; artist: string; coverArt: string; weeks: number; peak: number }>();
  const artistAccumMap = new Map<string, { artist: string; coverArt: string; weeks: number; peak: number }>();
  const albumAccumMap = new Map<string, { album: string; artist: string; coverArt: string; weeks: number; peak: number }>();

  for (let w = 0; w < totalWeeks; w++) {
    for (const t of weeklyTracks[w]) {
      const k = t._key;
      if (!trackAccumMap.has(k)) {
        trackAccumMap.set(k, { title: t.title, artist: t.artist, coverArt: t.coverArt, weeks: 1, peak: t.rank });
      } else {
        const ent = trackAccumMap.get(k)!;
        ent.weeks += 1;
        if (t.rank < ent.peak) ent.peak = t.rank;
      }
    }

    for (const a of weeklyArtists[w]) {
      const k = a._key;
      if (!artistAccumMap.has(k)) {
        artistAccumMap.set(k, { artist: a.artist, coverArt: a.coverArt, weeks: 1, peak: a.rank });
      } else {
        const ent = artistAccumMap.get(k)!;
        ent.weeks += 1;
        if (a.rank < ent.peak) ent.peak = a.rank;
      }
    }

    for (const alb of weeklyAlbums[w]) {
      const k = alb._key;
      if (!albumAccumMap.has(k)) {
        albumAccumMap.set(k, { album: alb.title, artist: alb.artist, coverArt: alb.coverArt, weeks: 1, peak: alb.rank });
      } else {
        const ent = albumAccumMap.get(k)!;
        ent.weeks += 1;
        if (alb.rank < ent.peak) ent.peak = alb.rank;
      }
    }
  }

  const mostWeeksTracks: MilestoneItem[] = Array.from(trackAccumMap.values())
    .sort((a, b) => b.weeks - a.weeks || a.peak - b.peak)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `accum_trk_${idx}_${ent.title}`,
      rank: idx + 1,
      title: ent.title,
      subtitle: ent.artist,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.weeks} Weeks`,
      statLabel: 'Total Weeks on Chart',
      secondaryStat: `Peak Rank: #${ent.peak}`,
      badgeType: 'fire',
      type: 'track',
      peakPosition: ent.peak,
      weeksOnChart: ent.weeks,
    }));

  const mostWeeksArtists: MilestoneItem[] = Array.from(artistAccumMap.values())
    .sort((a, b) => b.weeks - a.weeks || a.peak - b.peak)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `accum_art_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `Peak Rank: #${ent.peak}`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.weeks} Weeks`,
      statLabel: 'Weeks Charted',
      badgeType: 'fire',
      type: 'artist',
      peakPosition: ent.peak,
      weeksOnChart: ent.weeks,
    }));

  const mostWeeksAlbums: MilestoneItem[] = Array.from(albumAccumMap.values())
    .sort((a, b) => b.weeks - a.weeks || a.peak - b.peak)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `accum_alb_${idx}_${ent.album}`,
      rank: idx + 1,
      title: ent.album,
      subtitle: ent.artist,
      artist: ent.artist,
      album: ent.album,
      coverArt: ent.coverArt,
      statValue: `${ent.weeks} Weeks`,
      statLabel: 'Weeks on Album Chart',
      secondaryStat: `Peak Rank: #${ent.peak}`,
      badgeType: 'fire',
      type: 'album',
      peakPosition: ent.peak,
      weeksOnChart: ent.weeks,
    }));

  // 5. Most Weeks at #1
  const trackNum1WeeksMap = new Map<string, { title: string; artist: string; coverArt: string; count: number }>();
  const artistNum1WeeksMap = new Map<string, { artist: string; coverArt: string; count: number }>();
  const albumNum1WeeksMap = new Map<string, { album: string; artist: string; coverArt: string; count: number }>();

  for (let w = 0; w < totalWeeks; w++) {
    const t = weeklyTracks[w]?.find((item) => item.rank === 1);
    if (t) {
      const k = t._key;
      if (!trackNum1WeeksMap.has(k)) {
        trackNum1WeeksMap.set(k, { title: t.title, artist: t.artist, coverArt: t.coverArt, count: 1 });
      } else {
        trackNum1WeeksMap.get(k)!.count += 1;
      }
    }

    const a = weeklyArtists[w]?.find((item) => item.rank === 1);
    if (a) {
      const k = a._key;
      if (!artistNum1WeeksMap.has(k)) {
        artistNum1WeeksMap.set(k, { artist: a.artist, coverArt: a.coverArt, count: 1 });
      } else {
        artistNum1WeeksMap.get(k)!.count += 1;
      }
    }

    const alb = weeklyAlbums[w]?.find((item) => item.rank === 1);
    if (alb) {
      const k = alb._key;
      if (!albumNum1WeeksMap.has(k)) {
        albumNum1WeeksMap.set(k, { album: alb.title, artist: alb.artist, coverArt: alb.coverArt, count: 1 });
      } else {
        albumNum1WeeksMap.get(k)!.count += 1;
      }
    }
  }

  const mostWeeksAtNum1Tracks: MilestoneItem[] = Array.from(trackNum1WeeksMap.values())
    .sort((a, b) => b.count - a.count)
    .map((ent, idx) => ({
      id: `w1_trk_${idx}_${ent.title}`,
      rank: idx + 1,
      title: ent.title,
      subtitle: ent.artist,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.count} Week${ent.count === 1 ? '' : 's'}`,
      statLabel: 'Cumulative Weeks at #1',
      badgeType: 'crown',
      type: 'track',
    }));

  const mostWeeksAtNum1Artists: MilestoneItem[] = Array.from(artistNum1WeeksMap.values())
    .sort((a, b) => b.count - a.count)
    .map((ent, idx) => ({
      id: `w1_art_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: 'Artist Chart Dominance',
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.count} Week${ent.count === 1 ? '' : 's'}`,
      statLabel: 'Cumulative Weeks at #1',
      badgeType: 'crown',
      type: 'artist',
    }));

  const mostWeeksAtNum1Albums: MilestoneItem[] = Array.from(albumNum1WeeksMap.values())
    .sort((a, b) => b.count - a.count)
    .map((ent, idx) => ({
      id: `w1_alb_${idx}_${ent.album}`,
      rank: idx + 1,
      title: ent.album,
      subtitle: ent.artist,
      artist: ent.artist,
      album: ent.album,
      coverArt: ent.coverArt,
      statValue: `${ent.count} Week${ent.count === 1 ? '' : 's'}`,
      statLabel: 'Cumulative Weeks at #1',
      badgeType: 'crown',
      type: 'album',
    }));

  // 6. Most Consecutive Weeks at #1
  const calcConsecutiveNum1 = (weeklyArray: any[][], keyExtractor: (item: any) => string, titleExtractor: (item: any) => { title: string; subtitle: string; coverArt: string; type: any }) => {
    const streaks = new Map<string, { current: number; max: number; itemInfo: any }>();
    let lastKey = '';

    for (let w = 0; w < weeklyArray.length; w++) {
      const num1 = weeklyArray[w]?.find((item) => item.rank === 1);
      if (num1) {
        const key = keyExtractor(num1);
        if (key === lastKey) {
          const s = streaks.get(key)!;
          s.current += 1;
          if (s.current > s.max) s.max = s.current;
        } else {
          if (!streaks.has(key)) {
            streaks.set(key, { current: 1, max: 1, itemInfo: titleExtractor(num1) });
          } else {
            const s = streaks.get(key)!;
            s.current = 1;
          }
          lastKey = key;
        }
      } else {
        lastKey = '';
      }
    }

    return Array.from(streaks.values())
      .filter((s) => s.max > 0)
      .sort((a, b) => b.max - a.max)
      .map((s, idx) => ({
        id: `consec_${idx}_${s.itemInfo.title}`,
        rank: idx + 1,
        title: s.itemInfo.title,
        subtitle: s.itemInfo.subtitle,
        artist: s.itemInfo.artist,
        album: s.itemInfo.album,
        coverArt: s.itemInfo.coverArt,
        statValue: `${s.max} Consecutive Wks`,
        statLabel: 'Unbroken #1 Streak',
        badgeType: 'pro' as const,
        type: s.itemInfo.type,
      }));
  };

  const consecTracks = calcConsecutiveNum1(
    weeklyTracks,
    (t) => t._key,
    (t) => ({ title: t.title, subtitle: t.artist, artist: t.artist, album: t.album, coverArt: t.coverArt, type: 'track' })
  );

  const consecArtists = calcConsecutiveNum1(
    weeklyArtists,
    (a) => a._key,
    (a) => ({ title: a.artist, subtitle: 'Artist Chart Streak', artist: a.artist, coverArt: a.coverArt, type: 'artist' })
  );

  const consecAlbums = calcConsecutiveNum1(
    weeklyAlbums,
    (alb) => alb._key,
    (alb) => ({ title: alb.title, subtitle: alb.artist, artist: alb.artist, album: alb.title, coverArt: alb.coverArt, type: 'album' })
  );

  // 7. Best Debuts (Highest charting debuts in history)
  const trackDebuts: MilestoneItem[] = [];
  const artistDebuts: MilestoneItem[] = [];
  const albumDebuts: MilestoneItem[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    for (const t of weeklyTracks[w]) {
      if (t.moveStatus === 'new') {
        trackDebuts.push({
          id: `debut_trk_w${weekNum}_${t._key}`,
          rank: t.rank,
          title: t.title,
          subtitle: t.artist,
          artist: t.artist,
          album: t.album,
          coverArt: t.coverArt,
          statValue: `Debuted #${t.rank}`,
          statLabel: `Week ${weekNum} Debut`,
          secondaryStat: `${t.playCount} streams on debut week`,
          extraBadge: t.rank === 1 ? '#1 Debut' : `Top ${t.rank <= 10 ? '10' : '40'} Debut`,
          badgeType: t.rank === 1 ? 'crown' : 'gold',
          weekNumber: weekNum,
          type: 'track',
        });
      }
    }

    for (const a of weeklyArtists[w]) {
      if (a.moveStatus === 'new') {
        artistDebuts.push({
          id: `debut_art_w${weekNum}_${a._key}`,
          rank: a.rank,
          title: a.artist,
          subtitle: 'Artist Chart Debut',
          artist: a.artist,
          coverArt: a.coverArt,
          statValue: `Debuted #${a.rank}`,
          statLabel: `Week ${weekNum} Debut`,
          secondaryStat: `${a.playCount} plays on debut`,
          extraBadge: a.rank === 1 ? '#1 Artist Debut' : undefined,
          badgeType: a.rank === 1 ? 'crown' : 'gold',
          weekNumber: weekNum,
          type: 'artist',
        });
      }
    }

    for (const alb of weeklyAlbums[w]) {
      if (alb.moveStatus === 'new') {
        const albumUnits = alb.playCount * (settings.albumPlayWeight ?? 5000);
        albumDebuts.push({
          id: `debut_alb_w${weekNum}_${alb._key}`,
          rank: alb.rank,
          title: alb.title,
          subtitle: alb.artist,
          artist: alb.artist,
          album: alb.title,
          coverArt: alb.coverArt,
          statValue: `Debuted #${alb.rank}`,
          statLabel: `Week ${weekNum} Debut`,
          secondaryStat: `${alb.playCount} plays • ${albumUnits.toLocaleString()} sales units (${alb.tracksCount || 3} tracks)`,
          extraBadge: alb.rank === 1 ? '#1 Album Debut' : undefined,
          badgeType: alb.rank === 1 ? 'crown' : 'gold',
          weekNumber: weekNum,
          type: 'album',
        });
      }
    }
  }

  const sortedTrackDebuts = trackDebuts.sort((a, b) => a.rank - b.rank || (b.weekNumber || 0) - (a.weekNumber || 0));
  const sortedArtistDebuts = artistDebuts.sort((a, b) => a.rank - b.rank);
  const sortedAlbumDebuts = albumDebuts.sort((a, b) => a.rank - b.rank);

  // 8. Most Plays in a Single Week
  const trackWeeklyPeaks: MilestoneItem[] = [];
  const artistWeeklyPeaks: MilestoneItem[] = [];
  const albumWeeklyPeaks: MilestoneItem[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    for (const t of weeklyTracks[w]) {
      trackWeeklyPeaks.push({
        id: `pk_trk_w${weekNum}_${t._key}`,
        rank: 0,
        title: t.title,
        subtitle: t.artist,
        artist: t.artist,
        album: t.album,
        coverArt: t.coverArt,
        statValue: `${t.playCount} Plays`,
        statLabel: `Single Week (${t.points.toLocaleString()} pts)`,
        secondaryStat: `Charted #${t.rank} in Week ${weekNum}`,
        badgeType: 'fire',
        weekNumber: weekNum,
        type: 'track',
      });
    }

    for (const a of weeklyArtists[w]) {
      artistWeeklyPeaks.push({
        id: `pk_art_w${weekNum}_${a._key}`,
        rank: 0,
        title: a.artist,
        subtitle: 'Peak Weekly Plays',
        artist: a.artist,
        coverArt: a.coverArt,
        statValue: `${a.playCount} Plays`,
        statLabel: `Single Week (${a.trackCount} songs)`,
        secondaryStat: `Charted #${a.rank} in Week ${weekNum}`,
        badgeType: 'fire',
        weekNumber: weekNum,
        type: 'artist',
      });
    }

    for (const alb of weeklyAlbums[w]) {
      albumWeeklyPeaks.push({
        id: `pk_alb_w${weekNum}_${alb._key}`,
        rank: 0,
        title: alb.title,
        subtitle: alb.artist,
        artist: alb.artist,
        album: alb.title,
        coverArt: alb.coverArt,
        statValue: `${alb.playCount} Plays`,
        statLabel: `Single Week Peak`,
        secondaryStat: `Charted #${alb.rank} in Week ${weekNum}`,
        badgeType: 'fire',
        weekNumber: weekNum,
        type: 'album',
      });
    }
  }

  const formatLeaderboard = (list: MilestoneItem[]) => {
    return list
      .sort((a, b) => parseInt(String(b.statValue), 10) - parseInt(String(a.statValue), 10))
      .slice(0, 50)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  };

  const mostPlaysTrackList = formatLeaderboard(trackWeeklyPeaks);
  const mostPlaysArtistList = formatLeaderboard(artistWeeklyPeaks);
  const mostPlaysAlbumList = formatLeaderboard(albumWeeklyPeaks);

  // 9. Artists with Most Debuts at #1
  const artistDebutAt1Map = new Map<string, { artist: string; coverArt: string; count: number; tracks: string[] }>();
  for (const td of trackDebuts) {
    if (td.rank === 1 && td.artist) {
      const k = getFuzzyArtistKey(td.artist);
      if (!artistDebutAt1Map.has(k)) {
        artistDebutAt1Map.set(k, { artist: td.artist, coverArt: td.coverArt || '', count: 1, tracks: [td.title] });
      } else {
        const ent = artistDebutAt1Map.get(k)!;
        ent.count += 1;
        ent.tracks.push(td.title);
      }
    }
  }

  const artistsWithMostDebutsAtNum1: MilestoneItem[] = Array.from(artistDebutAt1Map.values())
    .sort((a, b) => b.count - a.count)
    .map((ent, idx) => ({
      id: `art_deb1_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `${ent.count} Songs Debuted at #1`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.count} #1 Debut${ent.count === 1 ? '' : 's'}`,
      statLabel: 'Instant #1 Hits',
      secondaryStat: ent.tracks.join(', '),
      badgeType: 'crown',
      type: 'artist',
    }));

  // 10. Artists with Most Simultaneous Tracks in a Single Week
  const artistSimulTracks: MilestoneItem[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    const countMap = new Map<string, { artist: string; coverArt: string; titles: string[]; playCount: number }>();
    for (const t of weeklyTracks[w]) {
      const k = getFuzzyArtistKey(t.artist);
      if (!countMap.has(k)) {
        countMap.set(k, { artist: t.artist, coverArt: t.coverArt, titles: [t.title], playCount: t.playCount });
      } else {
        const ent = countMap.get(k)!;
        ent.titles.push(t.title);
        ent.playCount += t.playCount;
      }
    }

    countMap.forEach((val) => {
      if (val.titles.length >= 2) {
        artistSimulTracks.push({
          id: `simul_w${weekNum}_${val.artist}`,
          rank: 0,
          title: val.artist,
          subtitle: `Week ${weekNum} Chart Takeover`,
          artist: val.artist,
          coverArt: val.coverArt,
          statValue: `${val.titles.length} Tracks`,
          statLabel: 'Simultaneous Top 100 Entries',
          secondaryStat: val.titles.slice(0, 4).join(', ') + (val.titles.length > 4 ? ` (+${val.titles.length - 4} more)` : ''),
          badgeType: 'pro',
          weekNumber: weekNum,
          type: 'artist',
        });
      }
    });
  }

  const sortedArtistSimulTracks = artistSimulTracks
    .sort((a, b) => parseInt(String(b.statValue), 10) - parseInt(String(a.statValue), 10))
    .slice(0, 50)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // 11. Most Weeks Until Reaching #1 (Slow-Burn Climbers)
  const slowBurnTracks: MilestoneItem[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (topTrack && topTrack.weeksOnChart > 1) {
      // Reached #1 after multiple weeks
      slowBurnTracks.push({
        id: `slowburn_w${w + 1}_${topTrack._key}`,
        rank: 0,
        title: topTrack.title,
        subtitle: topTrack.artist,
        artist: topTrack.artist,
        album: topTrack.album,
        coverArt: topTrack.coverArt,
        statValue: `${topTrack.weeksOnChart} Weeks`,
        statLabel: 'Time to Reach #1',
        secondaryStat: `Crowned #1 in Week ${w + 1}`,
        badgeType: 'pro',
        type: 'track',
      });
    }
  }

  const sortedSlowBurns = slowBurnTracks
    .sort((a, b) => parseInt(String(b.statValue), 10) - parseInt(String(a.statValue), 10))
    .slice(0, 30)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // 12. Perfect All-Kill (Holds #1 on Track, Artist, AND Album charts simultaneously in the same week!)
  const perfectAllKills: PerfectAllKillItem[] = [];
  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    const t1 = weeklyTracks[w]?.find((t) => t.rank === 1);
    const a1 = weeklyArtists[w]?.find((a) => a.rank === 1);
    const alb1 = weeklyAlbums[w]?.find((alb) => alb.rank === 1);

    if (t1 && a1 && alb1) {
      const normTrackArtist = getFuzzyArtistKey(t1.artist);
      const normArtist = getFuzzyArtistKey(a1.artist);
      const normAlbArtist = getFuzzyArtistKey(alb1.artist);

      if (normTrackArtist === normArtist && normArtist === normAlbArtist) {
        perfectAllKills.push({
          weekNumber: weekNum,
          dateRange: allWeeks[w]?.dateRange || `Week ${weekNum}`,
          artist: a1.artist,
          trackTitle: t1.title,
          albumTitle: alb1.title,
          coverArt: t1.coverArt || alb1.coverArt || a1.coverArt,
          totalWeekPlays: a1.playCount,
          notes: `Simultaneous #1 on Track (${t1.title}), Artist (${a1.artist}), and Album (${alb1.title}) charts!`,
        });
      }
    }
  }

  // 13. Points Accumulators (All-time chart points leaders)
  const trackPointsMap = new Map<string, { title: string; artist: string; coverArt: string; totalPoints: number; weeks: number }>();
  const artistPointsMap = new Map<string, { artist: string; coverArt: string; totalPoints: number; weeks: number }>();
  const albumPointsMap = new Map<string, { album: string; artist: string; coverArt: string; totalPoints: number; weeks: number }>();

  for (let w = 0; w < totalWeeks; w++) {
    for (const t of weeklyTracks[w]) {
      const k = t._key;
      if (!trackPointsMap.has(k)) {
        trackPointsMap.set(k, { title: t.title, artist: t.artist, coverArt: t.coverArt, totalPoints: t.points, weeks: 1 });
      } else {
        const ent = trackPointsMap.get(k)!;
        ent.totalPoints += t.points;
        ent.weeks += 1;
      }
    }

    for (const a of weeklyArtists[w]) {
      const k = a._key;
      if (!artistPointsMap.has(k)) {
        artistPointsMap.set(k, { artist: a.artist, coverArt: a.coverArt, totalPoints: a.points, weeks: 1 });
      } else {
        const ent = artistPointsMap.get(k)!;
        ent.totalPoints += a.points;
        ent.weeks += 1;
      }
    }

    for (const alb of weeklyAlbums[w]) {
      const k = alb._key;
      if (!albumPointsMap.has(k)) {
        albumPointsMap.set(k, { album: alb.title, artist: alb.artist, coverArt: alb.coverArt, totalPoints: alb.points, weeks: 1 });
      } else {
        const ent = albumPointsMap.get(k)!;
        ent.totalPoints += alb.points;
        ent.weeks += 1;
      }
    }
  }

  const pointsTracks: MilestoneItem[] = Array.from(trackPointsMap.values())
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `pts_trk_${idx}_${ent.title}`,
      rank: idx + 1,
      title: ent.title,
      subtitle: ent.artist,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.totalPoints.toLocaleString()} Pts`,
      statLabel: 'All-Time Chart Points',
      secondaryStat: `${ent.weeks} Weeks on chart`,
      badgeType: 'gold',
      type: 'track',
      points: ent.totalPoints,
      weeksOnChart: ent.weeks,
    }));

  const pointsArtists: MilestoneItem[] = Array.from(artistPointsMap.values())
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `pts_art_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `${ent.weeks} Weeks on artist chart`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.totalPoints.toLocaleString()} Pts`,
      statLabel: 'All-Time Artist Points',
      badgeType: 'gold',
      type: 'artist',
      points: ent.totalPoints,
      weeksOnChart: ent.weeks,
    }));

  const pointsAlbums: MilestoneItem[] = Array.from(albumPointsMap.values())
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `pts_alb_${idx}_${ent.album}`,
      rank: idx + 1,
      title: ent.album,
      subtitle: ent.artist,
      artist: ent.artist,
      album: ent.album,
      coverArt: ent.coverArt,
      statValue: `${ent.totalPoints.toLocaleString()} Pts`,
      statLabel: 'All-Time Album Points',
      secondaryStat: `${ent.weeks} Weeks on album chart`,
      badgeType: 'gold',
      type: 'album',
      points: ent.totalPoints,
      weeksOnChart: ent.weeks,
    }));

  // 14. Most Units Sold & Certifications (Formula: Plays * Weight + StabilityWeeks * Weight)
  const trackSalesMap = new Map<string, { title: string; artist: string; coverArt: string; plays: number; weeks: number }>();
  const albumSalesMap = new Map<string, { album: string; artist: string; coverArt: string; plays: number; weeks: number }>();

  const albumTracksOverall = new Map<string, Set<string>>();
  for (const s of allScrobbles) {
    const rawKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const mappedTitle = mergedMap[rawKey] || s.title;
    const k = getFuzzyTrackKey(mappedTitle, s.artist);

    if (!trackSalesMap.has(k)) {
      trackSalesMap.set(k, {
        title: mappedTitle,
        artist: s.artist,
        coverArt: s.coverArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80',
        plays: 1,
        weeks: trackAccumMap.get(k)?.weeks || 1,
      });
    } else {
      trackSalesMap.get(k)!.plays += 1;
    }

    if (s.album && s.album.trim().length > 0) {
      const albKey = getFuzzyAlbumKey(s.album, s.artist);
      if (!albumTracksOverall.has(albKey)) {
        albumTracksOverall.set(albKey, new Set());
      }
      albumTracksOverall.get(albKey)!.add(normalizeStrict(s.title));

      if (!albumSalesMap.has(albKey)) {
        albumSalesMap.set(albKey, {
          album: s.album,
          artist: s.artist,
          coverArt: s.coverArt || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80',
          plays: 1,
          weeks: albumAccumMap.get(albKey)?.weeks || 1,
        });
      } else {
        albumSalesMap.get(albKey)!.plays += 1;
      }
    }
  }

  const trackPlayWeight = settings.trackPlayWeight ?? 50000;
  const trackStabWeight = settings.trackStabilityWeight ?? 500;
  const albumPlayWeight = settings.albumPlayWeight ?? 5000;
  const albumStabWeight = settings.albumStabilityWeight ?? 500;

  const soldTracks: MilestoneItem[] = Array.from(trackSalesMap.entries())
    .map(([k, ent]) => {
      const stabilityPoints = trackPointsMap.get(k)?.totalPoints || ent.weeks;
      const units = ent.plays * trackPlayWeight + stabilityPoints * trackStabWeight;
      const { label: certLabel, tier: certTier } = getCertificationLabel(
        units,
        settings.goldThresholdTrack ?? 500000,
        settings.platinumThresholdTrack ?? 1000000,
        settings.diamondThresholdTrack ?? 10000000
      );
      return {
        id: `sale_trk_${ent.title}`,
        rank: 0,
        title: ent.title,
        subtitle: ent.artist,
        artist: ent.artist,
        coverArt: ent.coverArt,
        statValue: units.toLocaleString(),
        statLabel: settings.salesUnitName || 'Units Sold',
        secondaryStat: `${ent.plays} Pure Plays | Cert: ${certLabel}`,
        extraBadge: certLabel !== '—' ? certLabel : undefined,
        badgeType: certTier === 'diamond' ? 'diamond' : certTier === 'platinum' ? 'platinum' : 'gold',
        type: 'track' as const,
        salesUnits: units,
        plays: ent.plays,
        points: stabilityPoints,
        weeksOnChart: ent.weeks,
        _units: units,
      };
    })
    .sort((a, b) => b._units - a._units)
    .slice(0, 50)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const soldAlbums: MilestoneItem[] = Array.from(albumSalesMap.entries())
    .filter(([albKey, ent]) => (albumTracksOverall.get(getFuzzyAlbumKey(ent.album, ent.artist))?.size || 0) >= 3)
    .map(([albKey, ent]) => {
      const stabilityPoints = albumPointsMap.get(albKey)?.totalPoints || ent.weeks;
      const units = ent.plays * albumPlayWeight + stabilityPoints * albumStabWeight;
      const { label: certLabel, tier: certTier } = getCertificationLabel(
        units,
        settings.goldThresholdAlbum ?? 500000,
        settings.platinumThresholdAlbum ?? 1000000,
        settings.diamondThresholdAlbum ?? 10000000
      );
      return {
        id: `sale_alb_${ent.album}`,
        rank: 0,
        title: ent.album,
        subtitle: ent.artist,
        artist: ent.artist,
        album: ent.album,
        coverArt: ent.coverArt,
        statValue: units.toLocaleString(),
        statLabel: settings.salesUnitName || 'Units Sold',
        secondaryStat: `${ent.plays} Album Plays | Cert: ${certLabel}`,
        extraBadge: certLabel !== '—' ? certLabel : undefined,
        badgeType: certTier === 'diamond' ? 'diamond' : certTier === 'platinum' ? 'platinum' : 'gold',
        type: 'album' as const,
        salesUnits: units,
        plays: ent.plays,
        points: stabilityPoints,
        weeksOnChart: ent.weeks,
        _units: units,
      };
    })
    .sort((a, b) => b._units - a._units)
    .slice(0, 50)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // 15. Artists with Most Sales (Total career units across songs + albums)
  const artistSalesMap = new Map<string, { artist: string; coverArt: string; totalUnits: number; purePlays: number }>();
  soldTracks.forEach((t: any) => {
    if (t.artist) {
      const k = getFuzzyArtistKey(t.artist);
      if (!artistSalesMap.has(k)) {
        artistSalesMap.set(k, { artist: t.artist, coverArt: t.coverArt, totalUnits: t._units || 0, purePlays: t.plays || 0 });
      } else {
        artistSalesMap.get(k)!.totalUnits += t._units || 0;
        artistSalesMap.get(k)!.purePlays += t.plays || 0;
      }
    }
  });

  soldAlbums.forEach((alb: any) => {
    if (alb.artist) {
      const k = getFuzzyArtistKey(alb.artist);
      if (!artistSalesMap.has(k)) {
        artistSalesMap.set(k, { artist: alb.artist, coverArt: alb.coverArt, totalUnits: alb._units || 0, purePlays: alb.plays || 0 });
      } else {
        artistSalesMap.get(k)!.totalUnits += alb._units || 0;
        artistSalesMap.get(k)!.purePlays += alb.plays || 0;
      }
    }
  });

  const artistsWithMostSales: MilestoneItem[] = Array.from(artistSalesMap.values())
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `art_sales_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: 'Career Certified Sales',
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: ent.totalUnits.toLocaleString(),
      statLabel: settings.salesUnitName || 'Total Career Units',
      badgeType: 'pro',
      type: 'artist',
      salesUnits: ent.totalUnits,
      plays: ent.purePlays,
    }));

  // 16. Biggest Eras (Album eras with highest combined track streams + chart dominance)
  const eraMap = new Map<
    string,
    {
      albumName: string;
      artist: string;
      coverArt: string;
      trackPlays: Map<string, number>;
      albumPlays: number;
    }
  >();

  for (const s of allScrobbles) {
    if (!s.album || s.album.trim().length === 0) continue;
    const k = getFuzzyAlbumKey(s.album, s.artist);
    if (!eraMap.has(k)) {
      eraMap.set(k, {
        albumName: s.album,
        artist: s.artist,
        coverArt: s.coverArt || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80',
        trackPlays: new Map([[s.title, 1]]),
        albumPlays: 1,
      });
    } else {
      const ent = eraMap.get(k)!;
      ent.albumPlays += 1;
      ent.trackPlays.set(s.title, (ent.trackPlays.get(s.title) || 0) + 1);
    }
  }

  const biggestEras: EraMilestoneItem[] = Array.from(eraMap.values())
    .filter((e) => e.trackPlays.size >= 3)
    .map((e) => {
      const albKey = getFuzzyAlbumKey(e.albumName, e.artist);
      const albChartEntry = albumAccumMap.get(albKey);
      const weeksOnChart = albChartEntry?.weeks || 0;
      const peak = albChartEntry?.peak || 99;

      let totalEraStreams = e.albumPlays;
      const topTracks = Array.from(e.trackPlays.entries())
        .map(([title, plays]) => {
          totalEraStreams += plays;
          const trkKey = getFuzzyTrackKey(title, e.artist);
          const trkChart = trackAccumMap.get(trkKey);
          return { title, plays, peak: trkChart?.peak || 99 };
        })
        .sort((a, b) => b.plays - a.plays);

      const num1Singles = topTracks.filter((t) => t.peak === 1).length;
      const top10Singles = topTracks.filter((t) => t.peak <= 10).length;

      const totalUnits = totalEraStreams * albumPlayWeight + weeksOnChart * albumStabWeight;
      const { label: certLabel, tier: certTier } = getCertificationLabel(
        totalUnits,
        settings.goldThresholdAlbum ?? 500000,
        settings.platinumThresholdAlbum ?? 1000000,
        settings.diamondThresholdAlbum ?? 10000000
      );

      const totalEraPoints = totalEraStreams * 100 + num1Singles * 5000 + (peak === 1 ? 10000 : 0);

      return {
        albumName: e.albumName,
        artist: e.artist,
        coverArt: e.coverArt,
        totalEraStreams,
        albumWeeksOnChart: weeksOnChart,
        albumPeak: peak,
        trackCount: e.trackPlays.size,
        num1SinglesCount: num1Singles,
        top10SinglesCount: top10Singles,
        totalEraPoints,
        totalUnits,
        certLabel,
        certTier,
        topTracks: topTracks.slice(0, 5),
      };
    })
    .sort((a, b) => b.totalEraPoints - a.totalEraPoints)
    .slice(0, 30);

  // 17. Certifications Summary
  let totalGold = 0;
  let totalPlatinum = 0;
  let totalMultiPlatinum = 0;
  let totalDiamond = 0;

  [...soldTracks, ...soldAlbums].forEach((item: any) => {
    if (item.badgeType === 'diamond') totalDiamond++;
    else if (item.badgeType === 'platinum') totalPlatinum++;
    else if (item.badgeType === 'gold') totalGold++;
  });

  // ==========================================
  // NEW EXTENDED HISTORICAL MILESTONE METRICS
  // ==========================================

  // 18. Artists with Most Consecutive #1s (Unbroken string of consecutive weeks with a #1 hit on Song Chart)
  const artistConsecutiveNum1Hits = new Map<string, { artist: string; coverArt: string; currentStreak: number; maxStreak: number; songs: string[] }>();
  let lastNum1ArtistKey = '';

  for (let w = 0; w < totalWeeks; w++) {
    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (topTrack && topTrack.artist) {
      const artKey = getFuzzyArtistKey(topTrack.artist);
      if (!artistConsecutiveNum1Hits.has(artKey)) {
        artistConsecutiveNum1Hits.set(artKey, {
          artist: topTrack.artist,
          coverArt: topTrack.coverArt,
          currentStreak: 1,
          maxStreak: 1,
          songs: [topTrack.title],
        });
      } else {
        const ent = artistConsecutiveNum1Hits.get(artKey)!;
        if (artKey === lastNum1ArtistKey) {
          ent.currentStreak += 1;
          if (ent.currentStreak > ent.maxStreak) {
            ent.maxStreak = ent.currentStreak;
          }
          if (!ent.songs.includes(topTrack.title)) {
            ent.songs.push(topTrack.title);
          }
        } else {
          ent.currentStreak = 1;
        }
      }
      lastNum1ArtistKey = artKey;
    } else {
      lastNum1ArtistKey = '';
    }
  }

  const artistsWithMostConsecutiveNum1s: MilestoneItem[] = Array.from(artistConsecutiveNum1Hits.values())
    .filter((a) => a.maxStreak >= 1)
    .sort((a, b) => b.maxStreak - a.maxStreak)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `art_consec_1_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `${ent.maxStreak} consecutive weeks with #1 song`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.maxStreak} Consecutive Wks`,
      statLabel: 'Unbroken #1 Reign',
      secondaryStat: ent.songs.slice(0, 3).join(', ') + (ent.songs.length > 3 ? ` (+${ent.songs.length - 3})` : ''),
      badgeType: 'crown',
      type: 'artist',
    }));

  // 19. Albums with Most Tracks That Reached #1
  const albumsWithMostTracksAtNum1: MilestoneItem[] = Array.from(albumNum1HitsMap.values())
    .filter((a) => a.num1Singles.size > 0)
    .sort((a, b) => b.num1Singles.size - a.num1Singles.size || b.albumNum1Weeks - a.albumNum1Weeks)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `alb_tracks_num1_${idx}_${ent.album}`,
      rank: idx + 1,
      title: ent.album,
      subtitle: ent.artist,
      artist: ent.artist,
      album: ent.album,
      coverArt: ent.coverArt,
      statValue: `${ent.num1Singles.size} #1 Song${ent.num1Singles.size === 1 ? '' : 's'}`,
      statLabel: 'Crowned #1 Tracks From Album',
      secondaryStat: Array.from(ent.num1Singles).slice(0, 4).join(', ') + (ent.num1Singles.size > 4 ? ` (+${ent.num1Singles.size - 4})` : ''),
      badgeType: 'crown',
      type: 'album',
    }));

  // 20. Fastest Artist to Reach 5 / 10 / 20 #1s
  const artistFirstAppearanceWeek = new Map<string, number>();
  const artistNum1Timeline = new Map<string, { artist: string; coverArt: string; num1SongHits: { song: string; week: number }[] }>();

  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    // Track earliest debut
    for (const t of weeklyTracks[w]) {
      const artKey = getFuzzyArtistKey(t.artist);
      if (!artistFirstAppearanceWeek.has(artKey)) {
        artistFirstAppearanceWeek.set(artKey, weekNum);
      }
    }

    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (topTrack && topTrack.artist) {
      const artKey = getFuzzyArtistKey(topTrack.artist);
      if (!artistNum1Timeline.has(artKey)) {
        artistNum1Timeline.set(artKey, {
          artist: topTrack.artist,
          coverArt: topTrack.coverArt,
          num1SongHits: [{ song: topTrack.title, week: weekNum }],
        });
      } else {
        const ent = artistNum1Timeline.get(artKey)!;
        if (!ent.num1SongHits.some((h) => normalizeStrict(h.song) === normalizeStrict(topTrack.title))) {
          ent.num1SongHits.push({ song: topTrack.title, week: weekNum });
        }
      }
    }
  }

  const calcFastestArtists = (targetCount: number): MilestoneItem[] => {
    const eligible: { artist: string; coverArt: string; elapsedWeeks: number; hitWeek: number; songs: string[] }[] = [];
    artistNum1Timeline.forEach((data, artKey) => {
      if (data.num1SongHits.length >= targetCount) {
        const debutWeek = artistFirstAppearanceWeek.get(artKey) || 1;
        const hitWeek = data.num1SongHits[targetCount - 1].week;
        const elapsedWeeks = Math.max(1, hitWeek - debutWeek + 1);
        eligible.push({
          artist: data.artist,
          coverArt: data.coverArt,
          elapsedWeeks,
          hitWeek,
          songs: data.num1SongHits.slice(0, targetCount).map((s) => s.song),
        });
      }
    });

    return eligible
      .sort((a, b) => a.elapsedWeeks - b.elapsedWeeks || a.hitWeek - b.hitWeek)
      .slice(0, 30)
      .map((item, idx) => ({
        id: `fast_${targetCount}_${idx}_${item.artist}`,
        rank: idx + 1,
        title: item.artist,
        subtitle: `Achieved ${targetCount}th #1 in Week ${item.hitWeek}`,
        artist: item.artist,
        coverArt: item.coverArt,
        statValue: `${item.elapsedWeeks} Weeks`,
        statLabel: `Speed to ${targetCount} #1 Hits`,
        secondaryStat: `Key Hits: ${item.songs.slice(0, 3).join(', ')}...`,
        badgeType: 'pro',
        type: 'artist',
      }));
  };

  const fastestArtistsToReachMilestones = {
    to5: calcFastestArtists(5),
    to10: calcFastestArtists(10),
    to20: calcFastestArtists(20),
  };

  // 21. Longest Active #1 Career Span (First #1 Week -> Last #1 Week)
  const artistNum1SpanMap = new Map<string, { artist: string; coverArt: string; firstWeek: number; lastWeek: number; distinctHits: number; hitSongs: string[] }>();
  for (let w = 0; w < totalWeeks; w++) {
    const weekNum = w + 1;
    const topTrack = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (topTrack && topTrack.artist) {
      const artKey = getFuzzyArtistKey(topTrack.artist);
      if (!artistNum1SpanMap.has(artKey)) {
        artistNum1SpanMap.set(artKey, {
          artist: topTrack.artist,
          coverArt: topTrack.coverArt,
          firstWeek: weekNum,
          lastWeek: weekNum,
          distinctHits: 1,
          hitSongs: [topTrack.title],
        });
      } else {
        const ent = artistNum1SpanMap.get(artKey)!;
        ent.lastWeek = weekNum;
        if (!ent.hitSongs.includes(topTrack.title)) {
          ent.hitSongs.push(topTrack.title);
          ent.distinctHits += 1;
        }
      }
    }
  }

  const longestActiveNum1CareerSpan: MilestoneItem[] = Array.from(artistNum1SpanMap.values())
    .map((ent) => {
      const spanWeeks = ent.lastWeek - ent.firstWeek + 1;
      return {
        ...ent,
        spanWeeks,
      };
    })
    .sort((a, b) => b.spanWeeks - a.spanWeeks || b.distinctHits - a.distinctHits)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `span_art_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `First #1: Week ${ent.firstWeek} • Latest #1: Week ${ent.lastWeek}`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.spanWeeks} Wks Span`,
      statLabel: 'Career #1 Longevity Span',
      secondaryStat: `${ent.distinctHits} distinct #1 hits across span`,
      badgeType: 'crown',
      type: 'artist',
    }));

  // 22. Songs with Biggest Jump to #1 (Single-week position jumps into #1)
  const biggestJumpsToNum1: MilestoneItem[] = [];
  for (let w = 1; w < totalWeeks; w++) {
    const weekNum = w + 1;
    const curNum1 = weeklyTracks[w]?.find((t) => t.rank === 1);
    if (curNum1) {
      const prevWeekTrack = weeklyTracks[w - 1]?.find((t) => t._key === curNum1._key);
      if (prevWeekTrack && prevWeekTrack.rank > 1) {
        const jumpDelta = prevWeekTrack.rank - 1;
        biggestJumpsToNum1.push({
          id: `jump_w${weekNum}_${curNum1._key}`,
          rank: 0,
          title: curNum1.title,
          subtitle: curNum1.artist,
          artist: curNum1.artist,
          album: curNum1.album,
          coverArt: curNum1.coverArt,
          statValue: `+${jumpDelta} Spot Leap`,
          statLabel: `#${prevWeekTrack.rank} ➔ #1 Jump`,
          secondaryStat: `Week ${weekNum} (${curNum1.playCount} streams)`,
          badgeType: 'fire',
          weekNumber: weekNum,
          type: 'track',
          _jumpDelta: jumpDelta,
        } as any);
      }
    }
  }

  const songsWithBiggestJumpToNum1 = biggestJumpsToNum1
    .sort((a: any, b: any) => b._jumpDelta - a._jumpDelta)
    .slice(0, 50)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // 23. Songs with Longest Climb to #1 (Most total weeks on chart prior to reaching #1)
  const songsWithLongestClimbToNum1 = sortedSlowBurns;

  // 24. Artists with Highest #1 Conversion Rate (Percentage of charted songs that reached #1)
  const artistChartedSongsMap = new Map<string, { artist: string; coverArt: string; allSongs: Set<string>; num1Songs: Set<string> }>();
  for (let w = 0; w < totalWeeks; w++) {
    for (const t of weeklyTracks[w]) {
      const artKey = getFuzzyArtistKey(t.artist);
      if (!artistChartedSongsMap.has(artKey)) {
        artistChartedSongsMap.set(artKey, {
          artist: t.artist,
          coverArt: t.coverArt,
          allSongs: new Set([t.title]),
          num1Songs: t.rank === 1 ? new Set([t.title]) : new Set(),
        });
      } else {
        const ent = artistChartedSongsMap.get(artKey)!;
        ent.allSongs.add(t.title);
        if (t.rank === 1) {
          ent.num1Songs.add(t.title);
        }
      }
    }
  }

  const artistsWithHighestNum1ConversionRate: MilestoneItem[] = Array.from(artistChartedSongsMap.values())
    .filter((a) => a.allSongs.size >= 3 && a.num1Songs.size >= 1) // Minimum 3 charted tracks for statistical relevance
    .map((ent) => {
      const rate = Math.round((ent.num1Songs.size / ent.allSongs.size) * 100);
      return {
        ...ent,
        rate,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.num1Songs.size - a.num1Songs.size)
    .slice(0, 50)
    .map((ent, idx) => ({
      id: `conv_art_${idx}_${ent.artist}`,
      rank: idx + 1,
      title: ent.artist,
      subtitle: `${ent.num1Songs.size} of ${ent.allSongs.size} Charted Songs Reached #1`,
      artist: ent.artist,
      coverArt: ent.coverArt,
      statValue: `${ent.rate}% Rate`,
      statLabel: '#1 Conversion Rate',
      secondaryStat: `Hits: ${Array.from(ent.num1Songs).slice(0, 3).join(', ')}`,
      badgeType: 'crown',
      type: 'artist',
    }));

  // 25. Biggest Chart Domination Score (Weeks at #1 + Top 10 + Top 50 weighted score)
  // Domination formula: (Weeks at #1 * 50) + (Weeks in Top 10 * 15) + (Weeks in Top 50 * 5)
  const trackDominationMap = new Map<string, { title: string; artist: string; coverArt: string; w1: number; top10: number; top50: number }>();
  const artistDominationMap = new Map<string, { artist: string; coverArt: string; w1: number; top10: number; top50: number }>();
  const albumDominationMap = new Map<string, { album: string; artist: string; coverArt: string; w1: number; top10: number; top50: number }>();

  for (let w = 0; w < totalWeeks; w++) {
    for (const t of weeklyTracks[w]) {
      const k = t._key;
      if (!trackDominationMap.has(k)) {
        trackDominationMap.set(k, { title: t.title, artist: t.artist, coverArt: t.coverArt, w1: t.rank === 1 ? 1 : 0, top10: t.rank <= 10 ? 1 : 0, top50: t.rank <= 50 ? 1 : 0 });
      } else {
        const ent = trackDominationMap.get(k)!;
        if (t.rank === 1) ent.w1 += 1;
        if (t.rank <= 10) ent.top10 += 1;
        if (t.rank <= 50) ent.top50 += 1;
      }
    }

    for (const a of weeklyArtists[w]) {
      const k = a._key;
      if (!artistDominationMap.has(k)) {
        artistDominationMap.set(k, { artist: a.artist, coverArt: a.coverArt, w1: a.rank === 1 ? 1 : 0, top10: a.rank <= 10 ? 1 : 0, top50: a.rank <= 50 ? 1 : 0 });
      } else {
        const ent = artistDominationMap.get(k)!;
        if (a.rank === 1) ent.w1 += 1;
        if (a.rank <= 10) ent.top10 += 1;
        if (a.rank <= 50) ent.top50 += 1;
      }
    }

    for (const alb of weeklyAlbums[w]) {
      const k = alb._key;
      if (!albumDominationMap.has(k)) {
        albumDominationMap.set(k, { album: alb.title, artist: alb.artist, coverArt: alb.coverArt, w1: alb.rank === 1 ? 1 : 0, top10: alb.rank <= 10 ? 1 : 0, top50: alb.rank <= 50 ? 1 : 0 });
      } else {
        const ent = albumDominationMap.get(k)!;
        if (alb.rank === 1) ent.w1 += 1;
        if (alb.rank <= 10) ent.top10 += 1;
        if (alb.rank <= 50) ent.top50 += 1;
      }
    }
  }

  const calcDomScores = (map: Map<string, any>, type: 'track' | 'artist' | 'album'): MilestoneItem[] => {
    return Array.from(map.values())
      .map((ent) => {
        const score = ent.w1 * 50 + ent.top10 * 15 + ent.top50 * 5;
        return {
          ...ent,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((ent, idx) => ({
        id: `dom_${type}_${idx}_${ent.title || ent.artist || ent.album}`,
        rank: idx + 1,
        title: ent.title || ent.artist || ent.album,
        subtitle: ent.artist || `${ent.w1} Wks at #1 • ${ent.top10} Wks Top 10`,
        artist: ent.artist,
        album: ent.album,
        coverArt: ent.coverArt,
        statValue: `${ent.score.toLocaleString()} Pts`,
        statLabel: 'Chart Domination Index',
        secondaryStat: `${ent.w1} Wks at #1 • ${ent.top10} Wks in Top 10 • ${ent.top50} Wks in Top 50`,
        badgeType: 'fire',
        type,
      }));
  };

  const chartDominationScores = {
    tracks: calcDomScores(trackDominationMap, 'track'),
    artists: calcDomScores(artistDominationMap, 'artist'),
    albums: calcDomScores(albumDominationMap, 'album'),
  };

  return {
    allNumberOnes: {
      tracks: allNum1Tracks,
      artists: allNum1Artists,
      albums: allNum1Albums,
    },
    artistsWithMostNum1s,
    songsWithMostWeeksAtNum1: mostWeeksAtNum1Tracks,
    mostWeeksAccumulatedAtNum1: mostWeeksAtNum1Artists,
    artistsWithMostConsecutiveNum1s,
    albumsWithMostNum1s,
    artistsWithMostDebutsAtNum1,
    songsWithMostConsecutiveWeeksAtNum1: consecTracks,
    mostWeeksUntilReachingNum1: sortedSlowBurns,
    artistsWithMostSimultaneousTracks: sortedArtistSimulTracks,
    albumsWithMostTracksAtNum1,
    bestDebuts: {
      tracks: sortedTrackDebuts,
      artists: sortedArtistDebuts,
      albums: sortedAlbumDebuts,
    },
    mostPlaysInAWeek: {
      tracks: mostPlaysTrackList,
      artists: mostPlaysArtistList,
      albums: mostPlaysAlbumList,
    },
    pointsAccumulators: {
      tracks: pointsTracks,
      artists: pointsArtists,
      albums: pointsAlbums,
    },
    fastestArtistsToReachMilestones,
    longestActiveNum1CareerSpan,
    songsWithBiggestJumpToNum1,
    songsWithLongestClimbToNum1,
    artistsWithHighestNum1ConversionRate,
    perfectAllKills,
    chartDominationScores,
    mostWeeksAccumulated: {
      tracks: mostWeeksTracks,
      artists: mostWeeksArtists,
      albums: mostWeeksAlbums,
    },
    mostWeeksAtNum1: {
      tracks: mostWeeksAtNum1Tracks,
      artists: mostWeeksAtNum1Artists,
      albums: mostWeeksAtNum1Albums,
    },
    mostConsecutiveWeeksAtNum1: {
      tracks: consecTracks,
      artists: consecArtists,
      albums: consecAlbums,
    },
    mostUnitsSold: {
      tracks: soldTracks,
      albums: soldAlbums,
    },
    artistsWithMostSales,
    biggestEras,
    certificationsSummary: {
      totalGold,
      totalPlatinum,
      totalMultiPlatinum,
      totalDiamond,
      topCertifiedTracks: soldTracks.filter((t) => t.extraBadge),
      topCertifiedAlbums: soldAlbums.filter((a) => a.extraBadge),
    },
  };
}

function getEmptyMilestonesData(): MilestonesData {
  return {
    allNumberOnes: { tracks: [], artists: [], albums: [] },
    artistsWithMostNum1s: [],
    songsWithMostWeeksAtNum1: [],
    mostWeeksAccumulatedAtNum1: [],
    artistsWithMostConsecutiveNum1s: [],
    albumsWithMostNum1s: [],
    artistsWithMostDebutsAtNum1: [],
    songsWithMostConsecutiveWeeksAtNum1: [],
    mostWeeksUntilReachingNum1: [],
    artistsWithMostSimultaneousTracks: [],
    albumsWithMostTracksAtNum1: [],
    bestDebuts: { tracks: [], artists: [], albums: [] },
    mostPlaysInAWeek: { tracks: [], artists: [], albums: [] },
    pointsAccumulators: { tracks: [], artists: [], albums: [] },
    fastestArtistsToReachMilestones: { to5: [], to10: [], to20: [] },
    longestActiveNum1CareerSpan: [],
    songsWithBiggestJumpToNum1: [],
    songsWithLongestClimbToNum1: [],
    artistsWithHighestNum1ConversionRate: [],
    perfectAllKills: [],
    chartDominationScores: { tracks: [], artists: [], albums: [] },
    mostWeeksAccumulated: { tracks: [], artists: [], albums: [] },
    mostWeeksAtNum1: { tracks: [], artists: [], albums: [] },
    mostConsecutiveWeeksAtNum1: { tracks: [], artists: [], albums: [] },
    mostUnitsSold: { tracks: [], albums: [] },
    artistsWithMostSales: [],
    biggestEras: [],
    certificationsSummary: {
      totalGold: 0,
      totalPlatinum: 0,
      totalMultiPlatinum: 0,
      totalDiamond: 0,
      topCertifiedTracks: [],
      topCertifiedAlbums: [],
    },
  };
}
