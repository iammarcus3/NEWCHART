import { Scrobble } from '../types/music.ts';
import { UndersizedAlbumCandidate, AlbumMergeSuggestion } from '../types/albumResolver.ts';
import { splitArtistList } from './artistCrediting.ts';

/**
 * Extracts all albums across the user's catalog that have fewer than minTracks (default 3) distinct tracks.
 * Also discovers existing master albums (>= 3 tracks) per artist to assist in matching.
 */
export function extractUndersizedAlbums(
  scrobbles: Scrobble[],
  trackAlbumOverrides: Record<string, string> = {},
  mergedAlbumsMap: Record<string, string> = {},
  minTracks: number = 3
): {
  undersizedCandidates: UndersizedAlbumCandidate[];
  masterAlbumsByArtist: Record<string, string[]>;
} {
  if (!scrobbles || scrobbles.length === 0) {
    return { undersizedCandidates: [], masterAlbumsByArtist: {} };
  }

  // Map: artistKey -> albumKey -> { albumTitle, tracks: Map<trackKey, { title, playCount }>, coverArt }
  const catalog = new Map<
    string, // artistKey
    Map<
      string, // albumKey
      {
        rawArtist: string;
        albumTitle: string;
        tracks: Map<string, { title: string; playCount: number }>;
        coverArt?: string;
      }
    >
  >();

  for (let i = 0; i < scrobbles.length; i++) {
    const s = scrobbles[i];
    const rawArtist = (s.artist || 'Unknown Artist').trim();
    const primaryArtist = splitArtistList(rawArtist)[0] || rawArtist;
    const artistKey = primaryArtist.toLowerCase().trim();

    const trackKey = `${rawArtist.toLowerCase()}:::${(s.title || '').toLowerCase()}`;
    const assignedAlbum = (trackAlbumOverrides[trackKey] || s.album || '').trim();

    // Map album through mergedAlbumsMap if merged
    const mappedAlbum =
      mergedAlbumsMap[`${primaryArtist.toLowerCase()}:::${assignedAlbum.toLowerCase()}`] ||
      mergedAlbumsMap[`${rawArtist.toLowerCase()}:::${assignedAlbum.toLowerCase()}`] ||
      assignedAlbum;

    // Even if assignedAlbum is empty (e.g. standalone single without album tag), treat as "[No Album / Single]"
    const displayAlbum = mappedAlbum.length > 0 ? mappedAlbum : `[Single / No Album]`;
    const albumKey = displayAlbum.toLowerCase();

    let artistEntry = catalog.get(artistKey);
    if (!artistEntry) {
      artistEntry = new Map();
      catalog.set(artistKey, artistEntry);
    }

    let albumEntry = artistEntry.get(albumKey);
    if (!albumEntry) {
      albumEntry = {
        rawArtist: primaryArtist,
        albumTitle: displayAlbum,
        tracks: new Map(),
        coverArt: s.coverArt,
      };
      artistEntry.set(albumKey, albumEntry);
    } else if (!albumEntry.coverArt && s.coverArt) {
      albumEntry.coverArt = s.coverArt;
    }

    const tTitle = (s.title || 'Untitled').trim();
    const tKey = tTitle.toLowerCase();
    const existingTrack = albumEntry.tracks.get(tKey);
    if (!existingTrack) {
      albumEntry.tracks.set(tKey, { title: tTitle, playCount: 1 });
    } else {
      existingTrack.playCount += 1;
    }
  }

  const masterAlbumsByArtist: Record<string, string[]> = {};
  const undersizedCandidates: UndersizedAlbumCandidate[] = [];

  // Categorize into Master Albums (>= minTracks) vs Undersized (< minTracks)
  catalog.forEach((albumMap, artistKey) => {
    const masters: string[] = [];

    albumMap.forEach((entry) => {
      const distinctTracksCount = entry.tracks.size;
      // Do not treat "[Single / No Album]" as a master album even if user played multiple untagged songs
      const isPlaceholder = entry.albumTitle.startsWith('[Single / No Album]');
      if (distinctTracksCount >= minTracks && !isPlaceholder) {
        masters.push(entry.albumTitle);
      }
    });

    if (masters.length > 0) {
      masterAlbumsByArtist[artistKey] = masters;
    }
  });

  catalog.forEach((albumMap, artistKey) => {
    const knownMasters = masterAlbumsByArtist[artistKey] || [];

    albumMap.forEach((entry) => {
      const distinctTracksCount = entry.tracks.size;
      const isPlaceholder = entry.albumTitle.startsWith('[Single / No Album]');

      // Candidates: albums with < minTracks, or [Single / No Album] placeholders
      if (distinctTracksCount < minTracks || isPlaceholder) {
        const trackList = Array.from(entry.tracks.values()).sort((a, b) => b.playCount - a.playCount);
        const totalPlays = trackList.reduce((sum, t) => sum + t.playCount, 0);

        undersizedCandidates.push({
          id: `${artistKey}:::${entry.albumTitle.toLowerCase()}`,
          artist: entry.rawArtist,
          currentAlbum: entry.albumTitle,
          tracks: trackList,
          trackCount: distinctTracksCount,
          totalPlays,
          coverArt: entry.coverArt,
          knownArtistMasterAlbums: knownMasters,
        });
      }
    });
  });

  // Sort candidates by total plays descending so most-played orphan tracks appear first
  undersizedCandidates.sort((a, b) => b.totalPlays - a.totalPlays);

  return {
    undersizedCandidates,
    masterAlbumsByArtist,
  };
}

/**
 * Quick client-side discography heuristic generator
 * Produces preliminary suggestions immediately while AI is fetching or as a fallback.
 */
export function generateClientHeuristicSuggestions(
  candidates: UndersizedAlbumCandidate[]
): AlbumMergeSuggestion[] {
  return candidates.map((cand) => {
    const rawAlbum = cand.currentAlbum.trim();
    const artist = cand.artist.trim();
    const tracks = cand.tracks.map((t) => t.title.trim());
    const masterAlbums = cand.knownArtistMasterAlbums || [];

    // Strip single/EP suffixes
    const cleanAlbum = rawAlbum
      .replace(/\s*[-–—]\s*(Single|EP|Maxi[- ]Single|Promo)$/i, '')
      .replace(/\s*\((Single|EP|Maxi[- ]Single|Promo|Deluxe|Special Edition)\)$/i, '')
      .replace(/\s*\[(Single|EP|Maxi[- ]Single|Promo|Deluxe)\]$/i, '')
      .trim();

    let suggestedMaster = '';
    let confidence = 75;
    let reasoning = '';

    // Direct match with existing master album
    const directMaster = masterAlbums.find((m) => m.toLowerCase() === cleanAlbum.toLowerCase());

    if (directMaster) {
      suggestedMaster = directMaster;
      confidence = 96;
      reasoning = `Direct match to existing master album '${directMaster}' (album tracks: ${cand.trackCount}). Consolidates plays into parent LP.`;
    } else {
      // Check partial match
      const partialMatch = masterAlbums.find(
        (m) => m.toLowerCase().includes(cleanAlbum.toLowerCase()) || cleanAlbum.toLowerCase().includes(m.toLowerCase())
      );

      if (partialMatch) {
        suggestedMaster = partialMatch;
        confidence = 88;
        reasoning = `Title correlation suggests single/bonus variation of master album '${partialMatch}'.`;
      } else if (masterAlbums.length === 1) {
        suggestedMaster = masterAlbums[0];
        confidence = 82;
        reasoning = `Linked to primary catalog project '${masterAlbums[0]}' for ${artist}.`;
      } else if (cleanAlbum && cleanAlbum !== rawAlbum && !cleanAlbum.startsWith('[Single')) {
        suggestedMaster = cleanAlbum;
        confidence = 84;
        reasoning = `Normalized release title by removing single/EP label to create official album project '${cleanAlbum}'.`;
      } else if (tracks.length > 0 && !tracks[0].startsWith('Untitled')) {
        suggestedMaster = masterAlbums[0] || `${tracks[0]} - EP`;
        confidence = 70;
        reasoning = `Single track with under 3 songs. Grouping under '${suggestedMaster}' to satisfy album qualification threshold.`;
      } else {
        suggestedMaster = rawAlbum;
        confidence = 60;
        reasoning = `Under 3-track release awaiting manual destination album assignment.`;
      }
    }

    return {
      candidateId: cand.id,
      artist: cand.artist,
      currentAlbum: cand.currentAlbum,
      tracks,
      trackCount: cand.trackCount,
      totalPlays: cand.totalPlays,
      suggestedMasterAlbum: suggestedMaster,
      confidence,
      reasoning,
      source: 'heuristic-discography',
      targetAlbumExistsInCatalog: masterAlbums.some((m) => m.toLowerCase() === suggestedMaster.toLowerCase()),
      status: 'pending',
    };
  });
}

// Client-side cache to minimize network requests and API quota usage
const clientSuggestionCache = new Map<string, AlbumMergeSuggestion>();

/**
 * Requests Gemini 3.8 Flash to analyze candidates and return discographical master album suggestions.
 * Uses client-side caching and silent heuristic fallbacks to ensure smooth, resilient UI.
 */
export async function fetchAiAlbumMergeSuggestions(
  candidates: UndersizedAlbumCandidate[]
): Promise<AlbumMergeSuggestion[]> {
  if (!candidates || candidates.length === 0) return [];

  // Check cache first
  const uncached: UndersizedAlbumCandidate[] = [];
  const results: AlbumMergeSuggestion[] = [];

  for (const c of candidates) {
    const cached = clientSuggestionCache.get(c.id);
    if (cached) {
      results.push(cached);
    } else {
      uncached.push(c);
    }
  }

  if (uncached.length === 0) {
    return results;
  }

  try {
    const response = await fetch('/api/ai/suggest-album-merges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ candidates: uncached }),
    });

    if (!response.ok) {
      const fallback = generateClientHeuristicSuggestions(uncached);
      for (const item of fallback) {
        clientSuggestionCache.set(item.candidateId, item);
        results.push(item);
      }
      return results;
    }

    const data = await response.json();
    if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      for (const item of data.suggestions) {
        clientSuggestionCache.set(item.candidateId, item);
        results.push(item);
      }
      return results;
    }

    const fallback = generateClientHeuristicSuggestions(uncached);
    for (const item of fallback) {
      clientSuggestionCache.set(item.candidateId, item);
      results.push(item);
    }
    return results;
  } catch {
    const fallback = generateClientHeuristicSuggestions(uncached);
    for (const item of fallback) {
      clientSuggestionCache.set(item.candidateId, item);
      results.push(item);
    }
    return results;
  }
}
