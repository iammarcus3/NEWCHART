import { Scrobble } from '../types/music';
import {
  normalizeTrackTitle,
  normalizeAlbumTitle,
  normalizeStrict,
  preferDisplayTitle,
  preferDisplayAlbumTitle,
  areTracksSimilar,
  areAlbumsSimilar,
} from './similarity';
import {
  splitArtistList,
  buildCanonicalAlbumLeadArtistMap,
  getCanonicalAlbumLeadArtist,
} from './artistCrediting';

export interface CanonicalTrackIdentity {
  canonicalTitle: string;
  canonicalArtist: string;
  canonicalAlbum: string;
  coverArt: string;
}

export interface CanonicalAlbumIdentity {
  canonicalAlbum: string;
  canonicalArtist: string;
  coverArt: string;
}

interface CanonicalCatalog {
  fingerprint: string;
  trackMap: Map<string, CanonicalTrackIdentity>;
  albumMap: Map<string, CanonicalAlbumIdentity>;
  autoMergedTracksMap: Record<string, string>;
  autoMergedAlbumsMap: Record<string, string>;
}

let cachedCatalog: CanonicalCatalog | null = null;

export function invalidateCanonicalDeduplicationCache(): void {
  cachedCatalog = null;
}

function computeMapSignature(map: Record<string, string> = {}): string {
  const keys = Object.keys(map);
  if (keys.length === 0) return '0';
  let hash = keys.length;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = map[k] || '';
    hash = ((hash * 31 + k.length * 17 + v.length) | 0);
  }
  return `${keys.length}:${hash}`;
}

/**
 * High-performance Global Canonical Deduplication & Normalization Engine
 * Automatically merges:
 * 1. 90-100% similar tracks and albums
 * 2. Deluxe, Bonus, Reissue, Remix, Live, Acoustic, Sped Up, Slowed, Instrumental variants
 * 3. Featured artist variants into lead artist catalog
 * 4. User-specified manual merges from mergedMap & mergedAlbumsMap
 */
export function buildCanonicalCatalog(
  scrobbles: Scrobble[],
  manualMergedMap: Record<string, string> = {},
  manualMergedAlbumsMap: Record<string, string> = {},
  trackAlbumOverrides: Record<string, string> = {},
  albumLeadArtistRules: Record<string, string> = {}
): CanonicalCatalog {
  const totalScrobbles = scrobbles?.length || 0;
  const firstTs = totalScrobbles > 0 ? scrobbles[0]?.timestamp || 0 : 0;
  const lastTs = totalScrobbles > 0 ? scrobbles[totalScrobbles - 1]?.timestamp || 0 : 0;
  const mTrackSig = computeMapSignature(manualMergedMap);
  const mAlbSig = computeMapSignature(manualMergedAlbumsMap);
  const mOverSig = computeMapSignature(trackAlbumOverrides);
  const mLeadSig = computeMapSignature(albumLeadArtistRules);
  const fingerprint = `${totalScrobbles}_${firstTs}_${lastTs}_${mTrackSig}_${mAlbSig}_${mOverSig}_${mLeadSig}`;

  if (cachedCatalog && cachedCatalog.fingerprint === fingerprint) {
    return cachedCatalog;
  }

  const trackMap = new Map<string, CanonicalTrackIdentity>();
  const albumMap = new Map<string, CanonicalAlbumIdentity>();
  const autoMergedTracksMap: Record<string, string> = { ...manualMergedMap };
  const autoMergedAlbumsMap: Record<string, string> = { ...manualMergedAlbumsMap };

  if (totalScrobbles === 0) {
    const emptyCatalog: CanonicalCatalog = {
      fingerprint,
      trackMap,
      albumMap,
      autoMergedTracksMap,
      autoMergedAlbumsMap,
    };
    cachedCatalog = emptyCatalog;
    return emptyCatalog;
  }

  // 1. Build canonical album lead artist map first
  const albumLeadArtistMap = buildCanonicalAlbumLeadArtistMap(
    scrobbles,
    manualMergedAlbumsMap,
    trackAlbumOverrides,
    albumLeadArtistRules
  );

  // 2. Tally play counts, best cover art, and albums per track and album per artist
  const artistTracks = new Map<
    string,
    Map<
      string,
      {
        count: number;
        originalTitle: string;
        album: string;
        coverArt: string;
        leadArtist: string;
        rawArtists: Set<string>;
      }
    >
  >();

  const artistAlbums = new Map<
    string,
    Map<
      string,
      {
        count: number;
        originalAlbum: string;
        coverArt: string;
        leadArtist: string;
        rawArtists: Set<string>;
      }
    >
  >();

  for (let i = 0; i < totalScrobbles; i++) {
    const s = scrobbles[i];
    const rawArtist = s.artist ? s.artist.trim() : 'Unknown Artist';
    const rawTitle = s.title ? s.title.trim() : 'Untitled';
    const rawAlbum = s.album ? s.album.trim() : '';
    const leadArtist = splitArtistList(rawArtist)[0] || rawArtist;
    const artistNorm = normalizeStrict(leadArtist);

    if (!artistNorm) continue;

    const rawTrackKey = `${rawArtist.toLowerCase()}:::${rawTitle.toLowerCase()}`;
    const leadTrackKey = `${leadArtist.toLowerCase()}:::${rawTitle.toLowerCase()}`;
    const rawAlbumKey = rawAlbum ? `${leadArtist.toLowerCase()}:::${rawAlbum.toLowerCase()}` : '';

    const effectiveAlbum =
      trackAlbumOverrides[rawTrackKey] ||
      trackAlbumOverrides[leadTrackKey] ||
      (rawAlbumKey ? trackAlbumOverrides[rawAlbumKey] : '') ||
      rawAlbum;

    // Track aggregation
    let tMap = artistTracks.get(artistNorm);
    if (!tMap) {
      tMap = new Map();
      artistTracks.set(artistNorm, tMap);
    }
    const tEntry = tMap.get(rawTitle);
    if (!tEntry) {
      tMap.set(rawTitle, {
        count: 1,
        originalTitle: rawTitle,
        album: effectiveAlbum,
        coverArt: s.coverArt || '',
        leadArtist,
        rawArtists: new Set([rawArtist]),
      });
    } else {
      tEntry.count += 1;
      tEntry.rawArtists.add(rawArtist);
      if (!tEntry.album && effectiveAlbum) tEntry.album = effectiveAlbum;
      if (!tEntry.coverArt && s.coverArt) tEntry.coverArt = s.coverArt;
    }

    // Album aggregation
    if (effectiveAlbum) {
      const canonicalAlbLead = getCanonicalAlbumLeadArtist(effectiveAlbum, leadArtist, albumLeadArtistMap);
      const albArtistNorm = normalizeStrict(canonicalAlbLead);
      let aMap = artistAlbums.get(albArtistNorm);
      if (!aMap) {
        aMap = new Map();
        artistAlbums.set(albArtistNorm, aMap);
      }
      const aEntry = aMap.get(effectiveAlbum);
      if (!aEntry) {
        aMap.set(effectiveAlbum, {
          count: 1,
          originalAlbum: effectiveAlbum,
          coverArt: s.coverArt || '',
          leadArtist: canonicalAlbLead,
          rawArtists: new Set([rawArtist]),
        });
      } else {
        aEntry.count += 1;
        aEntry.rawArtists.add(rawArtist);
        if (!aEntry.coverArt && s.coverArt) aEntry.coverArt = s.coverArt;
      }
    }
  }

  // 3. Cluster and deduplicate tracks within each artist
  artistTracks.forEach((tracks, artistNorm) => {
    const trackList = Array.from(tracks.values()).sort((a, b) => b.count - a.count);
    const assigned = new Set<string>();

    for (let i = 0; i < trackList.length; i++) {
      const base = trackList[i];
      if (assigned.has(base.originalTitle)) continue;

      const cluster = [base];
      assigned.add(base.originalTitle);

      for (let j = i + 1; j < trackList.length; j++) {
        const candidate = trackList[j];
        if (assigned.has(candidate.originalTitle)) continue;

        // Check if explicitly manually merged
        const baseKey = `${base.leadArtist.toLowerCase()}:::${base.originalTitle.toLowerCase()}`;
        const candKey = `${candidate.leadArtist.toLowerCase()}:::${candidate.originalTitle.toLowerCase()}`;
        const manualTarget = manualMergedMap[candKey];

        const isManualMatch =
          manualTarget &&
          (manualTarget.toLowerCase() === base.originalTitle.toLowerCase() ||
            normalizeStrict(manualTarget) === normalizeStrict(base.originalTitle));

        const isSimilar = areTracksSimilar(base.originalTitle, candidate.originalTitle, 0.90);

        if (isManualMatch || isSimilar) {
          cluster.push(candidate);
          assigned.add(candidate.originalTitle);
        }
      }

      // Determine canonical parent track
      let canonicalTitle = cluster[0].originalTitle;
      // Check if any member has a manual override target
      for (const item of cluster) {
        const itemKey = `${item.leadArtist.toLowerCase()}:::${item.originalTitle.toLowerCase()}`;
        if (manualMergedMap[itemKey]) {
          canonicalTitle = manualMergedMap[itemKey];
          break;
        }
      }

      // If not manually set, pick cleanest title
      if (!cluster.some(item => manualMergedMap[`${item.leadArtist.toLowerCase()}:::${item.originalTitle.toLowerCase()}`])) {
        for (const item of cluster) {
          canonicalTitle = preferDisplayTitle(canonicalTitle, item.originalTitle);
        }
      }

      // Find best cover art and album in the cluster
      let bestCoverArt = '';
      let bestAlbum = '';
      for (const item of cluster) {
        if (!bestCoverArt && item.coverArt) bestCoverArt = item.coverArt;
        if (!bestAlbum && item.album) bestAlbum = item.album;
      }

      const canonicalArtist = cluster[0].leadArtist;
      const identity: CanonicalTrackIdentity = {
        canonicalTitle,
        canonicalArtist,
        canonicalAlbum: bestAlbum,
        coverArt: bestCoverArt,
      };

      // Map all variants to this canonical identity
      for (const item of cluster) {
        // Map with original lead artist
        const keyLead = `${item.leadArtist.toLowerCase()}:::${item.originalTitle.toLowerCase()}`;
        trackMap.set(keyLead, identity);
        autoMergedTracksMap[keyLead] = canonicalTitle;

        // Map with every raw artist string seen
        item.rawArtists.forEach(rawArt => {
          const keyRaw = `${rawArt.toLowerCase()}:::${item.originalTitle.toLowerCase()}`;
          trackMap.set(keyRaw, identity);
          autoMergedTracksMap[keyRaw] = canonicalTitle;
        });

        // Also map fuzzy/normalized track title
        const normKey = `${artistNorm}:::${normalizeStrict(normalizeTrackTitle(item.originalTitle))}`;
        trackMap.set(normKey, identity);
      }
    }
  });

  // 4. Cluster and deduplicate albums within each artist
  artistAlbums.forEach((albums, artistNorm) => {
    const albumList = Array.from(albums.values()).sort((a, b) => b.count - a.count);
    const assigned = new Set<string>();

    for (let i = 0; i < albumList.length; i++) {
      const base = albumList[i];
      if (assigned.has(base.originalAlbum)) continue;

      const cluster = [base];
      assigned.add(base.originalAlbum);

      for (let j = i + 1; j < albumList.length; j++) {
        const candidate = albumList[j];
        if (assigned.has(candidate.originalAlbum)) continue;

        const baseKey = `${base.leadArtist.toLowerCase()}:::${base.originalAlbum.toLowerCase()}`;
        const candKey = `${candidate.leadArtist.toLowerCase()}:::${candidate.originalAlbum.toLowerCase()}`;
        const manualTarget = manualMergedAlbumsMap[candKey];

        const isManualMatch =
          manualTarget &&
          (manualTarget.toLowerCase() === base.originalAlbum.toLowerCase() ||
            normalizeStrict(manualTarget) === normalizeStrict(base.originalAlbum));

        const isSimilar = areAlbumsSimilar(base.originalAlbum, candidate.originalAlbum, 0.90);

        if (isManualMatch || isSimilar) {
          cluster.push(candidate);
          assigned.add(candidate.originalAlbum);
        }
      }

      // Determine canonical parent album
      let canonicalAlbum = cluster[0].originalAlbum;
      for (const item of cluster) {
        const itemKey = `${item.leadArtist.toLowerCase()}:::${item.originalAlbum.toLowerCase()}`;
        if (manualMergedAlbumsMap[itemKey]) {
          canonicalAlbum = manualMergedAlbumsMap[itemKey];
          break;
        }
      }

      if (!cluster.some(item => manualMergedAlbumsMap[`${item.leadArtist.toLowerCase()}:::${item.originalAlbum.toLowerCase()}`])) {
        for (const item of cluster) {
          canonicalAlbum = preferDisplayAlbumTitle(canonicalAlbum, item.originalAlbum);
        }
      }

      let bestCoverArt = '';
      for (const item of cluster) {
        if (!bestCoverArt && item.coverArt) bestCoverArt = item.coverArt;
      }

      const canonicalArtist = cluster[0].leadArtist;
      const identity: CanonicalAlbumIdentity = {
        canonicalAlbum,
        canonicalArtist,
        coverArt: bestCoverArt,
      };

      for (const item of cluster) {
        const keyLead = `${item.leadArtist.toLowerCase()}:::${item.originalAlbum.toLowerCase()}`;
        albumMap.set(keyLead, identity);
        autoMergedAlbumsMap[keyLead] = canonicalAlbum;

        item.rawArtists.forEach(rawArt => {
          const keyRaw = `${rawArt.toLowerCase()}:::${item.originalAlbum.toLowerCase()}`;
          albumMap.set(keyRaw, identity);
          autoMergedAlbumsMap[keyRaw] = canonicalAlbum;
        });

        const normKey = `${artistNorm}:::${normalizeStrict(normalizeAlbumTitle(item.originalAlbum))}`;
        albumMap.set(normKey, identity);
      }
    }
  });

  const catalog: CanonicalCatalog = {
    fingerprint,
    trackMap,
    albumMap,
    autoMergedTracksMap,
    autoMergedAlbumsMap,
  };

  cachedCatalog = catalog;
  return catalog;
}

/**
 * Resolves a track to its canonical, deduplicated identity
 */
export function getCanonicalTrackIdentity(
  artist: string,
  title: string,
  album?: string,
  coverArt?: string,
  catalog?: CanonicalCatalog
): CanonicalTrackIdentity {
  const leadArtist = splitArtistList(artist)[0] || artist;
  const rawKey = `${artist.toLowerCase()}:::${title.toLowerCase()}`;
  const leadKey = `${leadArtist.toLowerCase()}:::${title.toLowerCase()}`;
  const normKey = `${normalizeStrict(leadArtist)}:::${normalizeStrict(normalizeTrackTitle(title))}`;

  if (catalog) {
    const found = catalog.trackMap.get(rawKey) || catalog.trackMap.get(leadKey) || catalog.trackMap.get(normKey);
    if (found) {
      return {
        ...found,
        coverArt: coverArt || found.coverArt,
        canonicalAlbum: album || found.canonicalAlbum,
      };
    }
  }

  // Fallback if not in catalog
  const cleanTitle = normalizeTrackTitle(title);
  return {
    canonicalTitle: cleanTitle || title,
    canonicalArtist: leadArtist,
    canonicalAlbum: album ? normalizeAlbumTitle(album) : '',
    coverArt: coverArt || '',
  };
}

/**
 * Resolves an album to its canonical, deduplicated identity
 */
export function getCanonicalAlbumIdentity(
  artist: string,
  album: string,
  coverArt?: string,
  catalog?: CanonicalCatalog
): CanonicalAlbumIdentity {
  const leadArtist = splitArtistList(artist)[0] || artist;
  const rawKey = `${artist.toLowerCase()}:::${album.toLowerCase()}`;
  const leadKey = `${leadArtist.toLowerCase()}:::${album.toLowerCase()}`;
  const normKey = `${normalizeStrict(leadArtist)}:::${normalizeStrict(normalizeAlbumTitle(album))}`;

  if (catalog) {
    const found = catalog.albumMap.get(rawKey) || catalog.albumMap.get(leadKey) || catalog.albumMap.get(normKey);
    if (found) {
      return {
        ...found,
        coverArt: coverArt || found.coverArt,
      };
    }
  }

  const cleanAlbum = normalizeAlbumTitle(album);
  return {
    canonicalAlbum: cleanAlbum || album,
    canonicalArtist: leadArtist,
    coverArt: coverArt || '',
  };
}

/**
 * Deduplicates and canonicalizes an entire scrobble timeline.
 * Ensures that EVERY modal, chart, table, and engine receives 100% deduplicated data.
 */
export function deduplicateScrobbles(
  scrobbles: Scrobble[],
  manualMergedMap: Record<string, string> = {},
  manualMergedAlbumsMap: Record<string, string> = {},
  trackAlbumOverrides: Record<string, string> = {},
  albumLeadArtistRules: Record<string, string> = {}
): Scrobble[] {
  if (!scrobbles || scrobbles.length === 0) return [];

  const catalog = buildCanonicalCatalog(
    scrobbles,
    manualMergedMap,
    manualMergedAlbumsMap,
    trackAlbumOverrides,
    albumLeadArtistRules
  );

  return scrobbles.map(s => {
    const rawArtist = s.artist ? s.artist.trim() : 'Unknown Artist';
    const rawTitle = s.title ? s.title.trim() : 'Untitled';
    const rawAlbum = s.album ? s.album.trim() : '';
    const leadArtist = splitArtistList(rawArtist)[0] || rawArtist;

    const rawTrackKey = `${rawArtist.toLowerCase()}:::${rawTitle.toLowerCase()}`;
    const leadTrackKey = `${leadArtist.toLowerCase()}:::${rawTitle.toLowerCase()}`;
    const rawAlbumKey = rawAlbum ? `${leadArtist.toLowerCase()}:::${rawAlbum.toLowerCase()}` : '';

    const effectiveAlbum =
      trackAlbumOverrides[rawTrackKey] ||
      trackAlbumOverrides[leadTrackKey] ||
      (rawAlbumKey ? trackAlbumOverrides[rawAlbumKey] : '') ||
      rawAlbum;

    const trackId = getCanonicalTrackIdentity(s.artist, s.title, effectiveAlbum, s.coverArt, catalog);
    const albId = effectiveAlbum
      ? getCanonicalAlbumIdentity(s.artist, effectiveAlbum, s.coverArt, catalog)
      : null;

    return {
      ...s,
      title: trackId.canonicalTitle,
      artist: trackId.canonicalArtist || s.artist,
      album: albId ? albId.canonicalAlbum : trackId.canonicalAlbum || effectiveAlbum,
      coverArt: trackId.coverArt || albId?.coverArt || s.coverArt,
    };
  });
}
