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
  const masterAlbumTracksByArtist: Record<string, Record<string, string[]>> = {};
  const undersizedCandidates: UndersizedAlbumCandidate[] = [];

  // Categorize into Master Albums (>= minTracks) vs Undersized (< minTracks)
  catalog.forEach((albumMap, artistKey) => {
    const masters: string[] = [];
    const albumTracksMap: Record<string, string[]> = {};

    albumMap.forEach((entry) => {
      const distinctTracksCount = entry.tracks.size;
      // Do not treat "[Single / No Album]" as a master album even if user played multiple untagged songs
      const isPlaceholder = entry.albumTitle.startsWith('[Single / No Album]');
      if (distinctTracksCount >= minTracks && !isPlaceholder) {
        masters.push(entry.albumTitle);
        albumTracksMap[entry.albumTitle] = Array.from(entry.tracks.values()).map((t) => t.title);
      }
    });

    if (masters.length > 0) {
      masterAlbumsByArtist[artistKey] = masters;
      masterAlbumTracksByArtist[artistKey] = albumTracksMap;
    }
  });

  catalog.forEach((albumMap, artistKey) => {
    const knownMasters = masterAlbumsByArtist[artistKey] || [];
    const masterTracksMap = masterAlbumTracksByArtist[artistKey] || {};

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
          knownArtistMasterAlbumTracks: masterTracksMap,
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
    const masterTracksMap = cand.knownArtistMasterAlbumTracks || {};

    // Strip single/EP suffixes
    const cleanAlbum = rawAlbum
      .replace(/\s*[-–—]\s*(Single|EP|Maxi[- ]Single|Promo|Remix|Acoustic|Live)$/i, '')
      .replace(/\s*\((Single|EP|Maxi[- ]Single|Promo|Deluxe|Special Edition|Explicit|Clean|Remix|Acoustic|Live)\)$/i, '')
      .replace(/\s*\[(Single|EP|Maxi[- ]Single|Promo|Deluxe|Explicit|Clean)\]$/i, '')
      .trim();

    let suggestedMaster = '';
    let confidence = 75;
    let reasoning = '';

    // Step 1: Direct track title matching against known master albums (Highest fidelity: 98%)
    // e.g. single track "Cruel Summer" appears on master album "Lover"
    let trackMatchedAlbum = '';
    let matchedTrackName = '';
    for (const track of cand.tracks) {
      const cleanTrack = track.title
        .replace(/\s*[-–—]\s*(Single|Radio Edit|Remix|Acoustic|Live)$/i, '')
        .replace(/\s*\(.*?\)$/i, '')
        .trim()
        .toLowerCase();

      for (const [masterTitle, masterTracks] of Object.entries(masterTracksMap)) {
        const found = masterTracks.some((mt) => {
          const cleanMt = mt.replace(/\s*\(.*?\)$/i, '').trim().toLowerCase();
          return cleanMt === cleanTrack || cleanMt.includes(cleanTrack) || cleanTrack.includes(cleanMt);
        });
        if (found) {
          trackMatchedAlbum = masterTitle;
          matchedTrackName = track.title;
          break;
        }
      }
      if (trackMatchedAlbum) break;
    }

    if (trackMatchedAlbum) {
      suggestedMaster = trackMatchedAlbum;
      confidence = 98;
      reasoning = `Track '${matchedTrackName}' is an official track on catalog master album '${trackMatchedAlbum}'. Consolidates single release into the LP.`;
    } else {
      // Step 2: Direct match with existing master album title
      const directMaster = masterAlbums.find((m) => m.toLowerCase() === cleanAlbum.toLowerCase());

      if (directMaster) {
        suggestedMaster = directMaster;
        confidence = 96;
        reasoning = `Direct match to existing master album '${directMaster}' (album tracks: ${cand.trackCount}). Consolidates plays into parent LP.`;
      } else {
        // Step 3: Check if clean single title matches a track title on any master album
        let albumByCleanNameTrack = '';
        const cleanAlbumLower = cleanAlbum.toLowerCase();
        for (const [masterTitle, masterTracks] of Object.entries(masterTracksMap)) {
          const found = masterTracks.some((mt) => {
            const cleanMt = mt.replace(/\s*\(.*?\)$/i, '').trim().toLowerCase();
            return cleanMt === cleanAlbumLower || cleanAlbumLower.includes(cleanMt) || cleanMt.includes(cleanAlbumLower);
          });
          if (found) {
            albumByCleanNameTrack = masterTitle;
            break;
          }
        }

        if (albumByCleanNameTrack) {
          suggestedMaster = albumByCleanNameTrack;
          confidence = 97;
          reasoning = `Single title '${cleanAlbum}' matches official track list on master album '${albumByCleanNameTrack}'.`;
        } else {
          // Step 4: Check partial match with master album title
          const partialMatch = masterAlbums.find(
            (m) =>
              m.toLowerCase().includes(cleanAlbum.toLowerCase()) ||
              cleanAlbum.toLowerCase().includes(m.toLowerCase())
          );

          if (partialMatch) {
            suggestedMaster = partialMatch;
            confidence = 90;
            reasoning = `Title correlation suggests single or edition variation belonging to master album '${partialMatch}'.`;
          } else if (masterAlbums.length === 1) {
            suggestedMaster = masterAlbums[0];
            confidence = 85;
            reasoning = `Consolidates to ${artist}'s primary catalog project '${masterAlbums[0]}'.`;
          } else if (cleanAlbum && cleanAlbum !== rawAlbum && !cleanAlbum.startsWith('[Single')) {
            suggestedMaster = cleanAlbum;
            confidence = 84;
            reasoning = `Normalized release title by removing single/EP label to create official album project '${cleanAlbum}'.`;
          } else if (tracks.length > 0 && !tracks[0].startsWith('Untitled')) {
            suggestedMaster = masterAlbums[0] || `${tracks[0]} - Single`;
            confidence = 72;
            reasoning = `Single release with under 3 songs. Grouping under '${suggestedMaster}' to satisfy album threshold.`;
          } else {
            suggestedMaster = rawAlbum;
            confidence = 65;
            reasoning = `Under 3-track release awaiting manual destination album assignment.`;
          }
        }
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

// Client-side persistent cache to guarantee instant 0ms responses across page reloads
const LOCAL_STORAGE_CACHE_KEY = 'zerocharts_ai_album_suggestions_v2';
const clientSuggestionCache = new Map<string, AlbumMergeSuggestion>();

// Initialize in-memory cache from localStorage if available
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          clientSuggestionCache.set(k, v as AlbumMergeSuggestion);
        }
      }
    }
  }
} catch {
  // Silent fallback if storage is restricted
}

function persistClientCache() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obj: Record<string, AlbumMergeSuggestion> = {};
      clientSuggestionCache.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(obj));
    }
  } catch {
    // Ignore quota errors
  }
}

/**
 * Requests Gemini 3.8 Flash to analyze candidates and return discographical master album suggestions.
 * High-confidence heuristics (>= 80%) resolve INSTANTLY (0 ms latency).
 * Only ambiguous candidates (< 80%) query AI in a fast, non-blocking background request.
 */
export async function fetchAiAlbumMergeSuggestions(
  candidates: UndersizedAlbumCandidate[]
): Promise<AlbumMergeSuggestion[]> {
  if (!candidates || candidates.length === 0) return [];

  const results: AlbumMergeSuggestion[] = [];
  const needAnalysis: UndersizedAlbumCandidate[] = [];

  // Check persistent cache first
  for (const c of candidates) {
    const cached = clientSuggestionCache.get(c.id);
    if (cached) {
      results.push(cached);
    } else {
      needAnalysis.push(c);
    }
  }

  if (needAnalysis.length === 0) {
    return results;
  }

  // Generate instant heuristics for items needing analysis
  const instantHeuristics = generateClientHeuristicSuggestions(needAnalysis);
  const ambiguousForAi: UndersizedAlbumCandidate[] = [];

  for (const h of instantHeuristics) {
    // If heuristic confidence is already high (>= 80%), resolve immediately without network delay!
    if (h.confidence >= 80) {
      clientSuggestionCache.set(h.candidateId, h);
      results.push(h);
    } else {
      const originalCandidate = needAnalysis.find((c) => c.id === h.candidateId);
      if (originalCandidate) {
        ambiguousForAi.push(originalCandidate);
      }
      // Add heuristic as provisional result in the meantime
      results.push(h);
    }
  }

  persistClientCache();

  // If no candidates are ambiguous or all have >= 80% confidence, return immediately!
  if (ambiguousForAi.length === 0) {
    return results;
  }

  // Query Gemini AI in background with a strict 3.5s timeout for only the ambiguous candidates
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const prunedPayload = ambiguousForAi.slice(0, 15).map((c) => ({
      candidateId: c.id,
      artist: c.artist,
      currentAlbum: c.currentAlbum,
      tracks: c.tracks.slice(0, 4).map((t) => t.title),
      totalPlays: c.totalPlays,
      knownArtistMasterAlbums: (c.knownArtistMasterAlbums || []).slice(0, 6),
    }));

    const response = await fetch('/api/ai/suggest-album-merges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ candidates: prunedPayload }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        for (const item of data.suggestions) {
          clientSuggestionCache.set(item.candidateId, item);
          const idx = results.findIndex((r) => r.candidateId === item.candidateId);
          if (idx !== -1) {
            results[idx] = item;
          } else {
            results.push(item);
          }
        }
        persistClientCache();
      }
    }
  } catch {
    // If AI network call times out or fails, the provisional heuristics are already in place
  }

  return results;
}
