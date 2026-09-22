import {
  Scrobble,
  ZeroChartSettings,
  PlaqueMilestone,
  PlaqueFrameStyle,
  PlaqueCertification,
} from '../types/music';
import { normalizeStrict, normalizeTrackTitle } from './similarity';
import {
  getAllCreditedArtists,
  getCanonicalAlbumLeadArtist,
  splitArtistList,
} from './artistCrediting';
import { resolvePersistentImage } from './lastfmImageFetcher';

export interface AutomaticCertification {
  id: string;
  type: 'track' | 'album';
  title: string;
  artist: string; // Formatted artist (shared credit for songs, single lead for albums)
  rawArtist: string;
  leadArtist: string;
  creditedArtists?: string[];
  albumTitle?: string;
  coverArt?: string;

  // Milestone info
  tier: PlaqueMilestone;
  tierLabel: string;
  multiplier: number;
  unitsEarned: number;
  totalPlays: number;
  equivalentStreams: number;

  // Chronological grouping
  awardTimestamp: number;
  awardedDate: string;
  year: number;
  month: string;
  monthIndex: number;

  frameStyle: PlaqueFrameStyle;
}

export interface MonthCertificationsGroup {
  year: number;
  month: string;
  monthIndex: number;
  totalCerts: number;
  trackCertsCount: number;
  albumCertsCount: number;
  plaques: AutomaticCertification[];
}

export interface YearCertificationsGroup {
  year: number;
  totalCerts: number;
  trackCertsCount: number;
  albumCertsCount: number;
  months: MonthCertificationsGroup[];
}

export interface CertificationsSummary {
  totalCertifications: number;
  totalDiamond: number;
  totalMultiPlatinum: number;
  totalPlatinum: number;
  totalGold: number;
  totalTrackCerts: number;
  totalAlbumCerts: number;
  totalCertifiedUnits: number;
  yearsList: number[];
  groupedByYear: YearCertificationsGroup[];
  allPlaques: AutomaticCertification[];
}

// In-memory cache for fast recalculation during search/filtering
let cachedScrobblesHash = '';
let cachedSettingsHash = '';
let cachedCertificationsSummary: CertificationsSummary | null = null;

function computeCertHash(scrobbles: Scrobble[], settings: ZeroChartSettings): string {
  if (scrobbles.length === 0) return '0_empty';
  const first = scrobbles[0];
  const last = scrobbles[scrobbles.length - 1];
  const mid = scrobbles[Math.floor(scrobbles.length / 2)];
  return `${scrobbles.length}_${first.timestamp}_${mid?.timestamp || 0}_${last.timestamp}_${first.id}_${last.id}`;
}

function computeSettingsHash(s: ZeroChartSettings): string {
  return `${s.goldThresholdTrack}_${s.platinumThresholdTrack}_${s.diamondThresholdTrack}_${s.trackPlayWeight}_${s.albumPlayWeight}_${s.minAlbumTracksToChart}`;
}

export function computeAutomaticCertifications(
  scrobbles: Scrobble[],
  settings: ZeroChartSettings
): CertificationsSummary {
  if (!scrobbles || scrobbles.length === 0) {
    return {
      totalCertifications: 0,
      totalDiamond: 0,
      totalMultiPlatinum: 0,
      totalPlatinum: 0,
      totalGold: 0,
      totalTrackCerts: 0,
      totalAlbumCerts: 0,
      totalCertifiedUnits: 0,
      yearsList: [],
      groupedByYear: [],
      allPlaques: [],
    };
  }

  const scrobblesHash = computeCertHash(scrobbles, settings);
  const settingsHash = computeSettingsHash(settings);

  if (
    cachedCertificationsSummary &&
    cachedScrobblesHash === scrobblesHash &&
    cachedSettingsHash === settingsHash
  ) {
    return cachedCertificationsSummary;
  }

  // Thresholds and weights from settings
  const trackPlayWeight = settings.trackPlayWeight ?? 50000;
  const albumPlayWeight = settings.albumPlayWeight ?? 5000;
  const streamFactor = settings.streamFactorPerPlay ?? 10875000;

  const goldTrack = settings.goldThresholdTrack ?? 500000;
  const platTrack = settings.platinumThresholdTrack ?? 1000000;
  const diamTrack = settings.diamondThresholdTrack ?? 10000000;

  const goldAlbum = settings.goldThresholdAlbum ?? 500000;
  const platAlbum = settings.platinumThresholdAlbum ?? 1000000;
  const diamAlbum = settings.diamondThresholdAlbum ?? 10000000;

  const minAlbumTracks = settings.minAlbumTracksToChart ?? 3;

  // 1. Group scrobbles for tracks & albums chronologically
  interface TrackGroup {
    title: string;
    rawArtist: string;
    albumTitle?: string;
    coverArt?: string;
    timestamps: number[];
  }

  interface AlbumGroup {
    albumTitle: string;
    rawArtist: string;
    trackTitles: Set<string>;
    coverArt?: string;
    timestamps: number[];
  }

  const trackMap = new Map<string, TrackGroup>();
  const albumMap = new Map<string, AlbumGroup>();

  // Sort scrobbles chronologically ascending
  const sortedScrobbles = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < sortedScrobbles.length; i++) {
    const s = sortedScrobbles[i];
    const artist = (s.artist || '').trim();
    const title = (s.title || '').trim();
    const album = (s.album || '').trim();

    if (!artist || !title) continue;

    // Track grouping
    const leadArtist = splitArtistList(artist)[0] || artist;
    const trackKey = `${normalizeStrict(leadArtist)}:::${normalizeTrackTitle(title)}`;
    let tg = trackMap.get(trackKey);
    if (!tg) {
      tg = {
        title,
        rawArtist: artist,
        albumTitle: album || undefined,
        coverArt: s.coverArt,
        timestamps: [],
      };
      trackMap.set(trackKey, tg);
    }
    if (!tg.coverArt && s.coverArt) {
      tg.coverArt = s.coverArt;
    }
    tg.timestamps.push(s.timestamp);

    // Album grouping
    if (album && album.length > 0 && !album.toLowerCase().includes('unknown') && !album.toLowerCase().includes('untitled')) {
      const primaryArtist = splitArtistList(artist)[0] || artist;
      const albumKey = `${normalizeStrict(primaryArtist)}:::${normalizeStrict(album)}`;
      let ag = albumMap.get(albumKey);
      if (!ag) {
        ag = {
          albumTitle: album,
          rawArtist: artist,
          trackTitles: new Set<string>(),
          coverArt: s.coverArt,
          timestamps: [],
        };
        albumMap.set(albumKey, ag);
      }
      if (!ag.coverArt && s.coverArt) {
        ag.coverArt = s.coverArt;
      }
      ag.trackTitles.add(title.toLowerCase());
      ag.timestamps.push(s.timestamp);
    }
  }

  const allPlaques: AutomaticCertification[] = [];

  // Helper to format date
  const createCertDate = (timestamp: number) => {
    const d = new Date(timestamp * 1000);
    const year = d.getFullYear();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const monthIndex = d.getMonth();
    const awardedDate = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return { year, month, monthIndex, awardedDate };
  };

  // 2. Evaluate Automatic Certifications for TRACKS (Songs)
  trackMap.forEach((tg, trackKey) => {
    const totalPlays = tg.timestamps.length;
    if (totalPlays === 0) return;

    // Songs must have shared credit if there are more than one artist
    const creditedInfos = getAllCreditedArtists(tg.rawArtist, tg.title);
    const credited = creditedInfos.map((c) => c.name);
    const displayArtist = credited.length > 1 ? credited.join(' & ') : tg.rawArtist;
    const leadArtist = credited[0] || tg.rawArtist;

    // Resolve cover art
    const coverArt =
      tg.coverArt ||
      resolvePersistentImage('track', tg.rawArtist, tg.title, tg.albumTitle, undefined);

    // Track milestone tiers reached chronologically
    let awardedGold = false;
    let awardedPlatMulti = 0;
    let awardedDiamMulti = 0;

    for (let playIndex = 0; playIndex < totalPlays; playIndex++) {
      const currentPlays = playIndex + 1;
      const currentUnits = currentPlays * trackPlayWeight;
      const ts = tg.timestamps[playIndex];

      // Check Gold
      if (!awardedGold && currentUnits >= goldTrack) {
        awardedGold = true;
        const dt = createCertDate(ts);
        allPlaques.push({
          id: `cert-track-${trackKey}-gold`,
          type: 'track',
          title: tg.title,
          artist: displayArtist,
          rawArtist: tg.rawArtist,
          leadArtist,
          creditedArtists: credited,
          albumTitle: tg.albumTitle,
          coverArt,
          tier: 'gold',
          tierLabel: 'Certified Gold',
          multiplier: 1,
          unitsEarned: goldTrack,
          totalPlays: currentPlays,
          equivalentStreams: currentPlays * streamFactor,
          awardTimestamp: ts,
          awardedDate: dt.awardedDate,
          year: dt.year,
          month: dt.month,
          monthIndex: dt.monthIndex,
          frameStyle: 'classic-walnut',
        });
      }

      // Check Platinum & Multi-Platinum (1M, 2M, 3M... up to 9M)
      if (currentUnits >= platTrack && currentUnits < diamTrack) {
        const platMulti = Math.floor(currentUnits / platTrack);
        if (platMulti > awardedPlatMulti) {
          awardedPlatMulti = platMulti;
          const dt = createCertDate(ts);
          allPlaques.push({
            id: `cert-track-${trackKey}-plat-${platMulti}`,
            type: 'track',
            title: tg.title,
            artist: displayArtist,
            rawArtist: tg.rawArtist,
            leadArtist,
            creditedArtists: credited,
            albumTitle: tg.albumTitle,
            coverArt,
            tier: platMulti > 1 ? 'multi-platinum' : 'platinum',
            tierLabel: platMulti > 1 ? `Certified ${platMulti}× Platinum` : 'Certified Platinum',
            multiplier: platMulti,
            unitsEarned: platMulti * platTrack,
            totalPlays: currentPlays,
            equivalentStreams: currentPlays * streamFactor,
            awardTimestamp: ts,
            awardedDate: dt.awardedDate,
            year: dt.year,
            month: dt.month,
            monthIndex: dt.monthIndex,
            frameStyle: 'platinum-brushed',
          });
        }
      }

      // Check Diamond (10M, 20M...)
      if (currentUnits >= diamTrack) {
        const diamMulti = Math.floor(currentUnits / diamTrack);
        if (diamMulti > awardedDiamMulti) {
          awardedDiamMulti = diamMulti;
          const dt = createCertDate(ts);
          allPlaques.push({
            id: `cert-track-${trackKey}-diam-${diamMulti}`,
            type: 'track',
            title: tg.title,
            artist: displayArtist,
            rawArtist: tg.rawArtist,
            leadArtist,
            creditedArtists: credited,
            albumTitle: tg.albumTitle,
            coverArt,
            tier: 'diamond',
            tierLabel: diamMulti > 1 ? `Certified ${diamMulti}× Diamond` : 'Certified Diamond',
            multiplier: diamMulti * 10,
            unitsEarned: diamMulti * diamTrack,
            totalPlays: currentPlays,
            equivalentStreams: currentPlays * streamFactor,
            awardTimestamp: ts,
            awardedDate: dt.awardedDate,
            year: dt.year,
            month: dt.month,
            monthIndex: dt.monthIndex,
            frameStyle: 'obsidian',
          });
        }
      }
    }
  });

  // 3. Evaluate Automatic Certifications for ALBUMS
  albumMap.forEach((ag, albumKey) => {
    // Qualification: must have minimum tracks count (default 3)
    if (ag.trackTitles.size < minAlbumTracks) return;

    const totalPlays = ag.timestamps.length;
    if (totalPlays === 0) return;

    // Strict rule: ONLY albums cannot have shared credit - strictly single lead artist!
    const leadArtist = getCanonicalAlbumLeadArtist(ag.rawArtist, ag.albumTitle);

    // Resolve cover art
    const coverArt =
      ag.coverArt ||
      resolvePersistentImage('album', leadArtist, undefined, ag.albumTitle, undefined);

    let awardedGold = false;
    let awardedPlatMulti = 0;
    let awardedDiamMulti = 0;

    for (let playIndex = 0; playIndex < totalPlays; playIndex++) {
      const currentPlays = playIndex + 1;
      const currentUnits = currentPlays * albumPlayWeight;
      const ts = ag.timestamps[playIndex];

      // Check Gold
      if (!awardedGold && currentUnits >= goldAlbum) {
        awardedGold = true;
        const dt = createCertDate(ts);
        allPlaques.push({
          id: `cert-album-${albumKey}-gold`,
          type: 'album',
          title: ag.albumTitle,
          artist: leadArtist,
          rawArtist: ag.rawArtist,
          leadArtist,
          creditedArtists: [leadArtist],
          albumTitle: ag.albumTitle,
          coverArt,
          tier: 'gold',
          tierLabel: 'Certified Gold Album',
          multiplier: 1,
          unitsEarned: goldAlbum,
          totalPlays: currentPlays,
          equivalentStreams: currentPlays * streamFactor,
          awardTimestamp: ts,
          awardedDate: dt.awardedDate,
          year: dt.year,
          month: dt.month,
          monthIndex: dt.monthIndex,
          frameStyle: 'classic-walnut',
        });
      }

      // Check Platinum & Multi-Platinum
      if (currentUnits >= platAlbum && currentUnits < diamAlbum) {
        const platMulti = Math.floor(currentUnits / platAlbum);
        if (platMulti > awardedPlatMulti) {
          awardedPlatMulti = platMulti;
          const dt = createCertDate(ts);
          allPlaques.push({
            id: `cert-album-${albumKey}-plat-${platMulti}`,
            type: 'album',
            title: ag.albumTitle,
            artist: leadArtist,
            rawArtist: ag.rawArtist,
            leadArtist,
            creditedArtists: [leadArtist],
            albumTitle: ag.albumTitle,
            coverArt,
            tier: platMulti > 1 ? 'multi-platinum' : 'platinum',
            tierLabel: platMulti > 1 ? `Certified ${platMulti}× Platinum Album` : 'Certified Platinum Album',
            multiplier: platMulti,
            unitsEarned: platMulti * platAlbum,
            totalPlays: currentPlays,
            equivalentStreams: currentPlays * streamFactor,
            awardTimestamp: ts,
            awardedDate: dt.awardedDate,
            year: dt.year,
            month: dt.month,
            monthIndex: dt.monthIndex,
            frameStyle: 'platinum-brushed',
          });
        }
      }

      // Check Diamond
      if (currentUnits >= diamAlbum) {
        const diamMulti = Math.floor(currentUnits / diamAlbum);
        if (diamMulti > awardedDiamMulti) {
          awardedDiamMulti = diamMulti;
          const dt = createCertDate(ts);
          allPlaques.push({
            id: `cert-album-${albumKey}-diam-${diamMulti}`,
            type: 'album',
            title: ag.albumTitle,
            artist: leadArtist,
            rawArtist: ag.rawArtist,
            leadArtist,
            creditedArtists: [leadArtist],
            albumTitle: ag.albumTitle,
            coverArt,
            tier: 'diamond',
            tierLabel: diamMulti > 1 ? `Certified ${diamMulti}× Diamond Album` : 'Certified Diamond Album',
            multiplier: diamMulti * 10,
            unitsEarned: diamMulti * diamAlbum,
            totalPlays: currentPlays,
            equivalentStreams: currentPlays * streamFactor,
            awardTimestamp: ts,
            awardedDate: dt.awardedDate,
            year: dt.year,
            month: dt.month,
            monthIndex: dt.monthIndex,
            frameStyle: 'obsidian',
          });
        }
      }
    }
  });

  // Sort all plaques chronologically descending (newest first)
  allPlaques.sort((a, b) => b.awardTimestamp - a.awardTimestamp);

  // 4. Group by Year -> Month
  const yearMap = new Map<number, Map<number, AutomaticCertification[]>>();

  allPlaques.forEach((p) => {
    if (!yearMap.has(p.year)) {
      yearMap.set(p.year, new Map<number, AutomaticCertification[]>());
    }
    const mmap = yearMap.get(p.year)!;
    if (!mmap.has(p.monthIndex)) {
      mmap.set(p.monthIndex, []);
    }
    mmap.get(p.monthIndex)!.push(p);
  });

  const yearsDescending = Array.from(yearMap.keys()).sort((a, b) => b - a);

  const groupedByYear: YearCertificationsGroup[] = yearsDescending.map((year) => {
    const mmap = yearMap.get(year)!;
    // Sort months descending (December = 11 to January = 0)
    const monthsDescending = Array.from(mmap.keys()).sort((a, b) => b - a);

    const monthGroups: MonthCertificationsGroup[] = monthsDescending.map((mIndex) => {
      const plaquesInMonth = mmap.get(mIndex)!;
      const trackCerts = plaquesInMonth.filter((x) => x.type === 'track').length;
      const albumCerts = plaquesInMonth.filter((x) => x.type === 'album').length;
      const monthName = plaquesInMonth[0]?.month || 'Unknown';

      return {
        year,
        month: monthName,
        monthIndex: mIndex,
        totalCerts: plaquesInMonth.length,
        trackCertsCount: trackCerts,
        albumCertsCount: albumCerts,
        plaques: plaquesInMonth,
      };
    });

    const totalCertsInYear = monthGroups.reduce((acc, mg) => acc + mg.totalCerts, 0);
    const trackCertsInYear = monthGroups.reduce((acc, mg) => acc + mg.trackCertsCount, 0);
    const albumCertsInYear = monthGroups.reduce((acc, mg) => acc + mg.albumCertsCount, 0);

    return {
      year,
      totalCerts: totalCertsInYear,
      trackCertsCount: trackCertsInYear,
      albumCertsCount: albumCertsInYear,
      months: monthGroups,
    };
  });

  // Summary tallies
  let totalDiamond = 0;
  let totalMultiPlatinum = 0;
  let totalPlatinum = 0;
  let totalGold = 0;
  let totalTrackCerts = 0;
  let totalAlbumCerts = 0;
  let totalCertifiedUnits = 0;

  allPlaques.forEach((p) => {
    if (p.tier === 'diamond') totalDiamond++;
    else if (p.tier === 'multi-platinum') totalMultiPlatinum++;
    else if (p.tier === 'platinum') totalPlatinum++;
    else if (p.tier === 'gold') totalGold++;

    if (p.type === 'track') totalTrackCerts++;
    else if (p.type === 'album') totalAlbumCerts++;

    totalCertifiedUnits += p.unitsEarned;
  });

  const summaryResult: CertificationsSummary = {
    totalCertifications: allPlaques.length,
    totalDiamond,
    totalMultiPlatinum,
    totalPlatinum,
    totalGold,
    totalTrackCerts,
    totalAlbumCerts,
    totalCertifiedUnits,
    yearsList: yearsDescending,
    groupedByYear,
    allPlaques,
  };

  cachedScrobblesHash = scrobblesHash;
  cachedSettingsHash = settingsHash;
  cachedCertificationsSummary = summaryResult;

  return summaryResult;
}

// Convert an AutomaticCertification to a PlaqueCertification for modal preview
export function toPlaqueCertification(cert: AutomaticCertification): PlaqueCertification {
  return {
    id: cert.id,
    subjectTitle: cert.title,
    subjectSubtitle: cert.artist,
    subjectType: cert.type,
    coverArt: cert.coverArt,
    milestone: cert.tier,
    threshold: cert.unitsEarned,
    scrobblesEarned: cert.totalPlays,
    awardedDate: cert.awardedDate,
    frameStyle: cert.frameStyle,
    customEngraving: `Official ${cert.tierLabel} • ${cert.unitsEarned.toLocaleString()} Certified Units`,
    isCustom: false,
  };
}
