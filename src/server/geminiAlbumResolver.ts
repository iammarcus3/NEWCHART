import { GoogleGenAI, Type } from '@google/genai';
import { UndersizedAlbumCandidate, AlbumMergeSuggestion } from '../types/albumResolver.ts';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Intelligent heuristic fallback for discography matching
 * Used when Gemini API is offline or as supplementary verification.
 */
export function generateHeuristicAlbumSuggestions(
  candidates: UndersizedAlbumCandidate[]
): AlbumMergeSuggestion[] {
  return candidates.map((cand) => {
    const rawAlbum = cand.currentAlbum.trim();
    const artist = cand.artist.trim();
    const tracks = cand.tracks.map((t) => t.title.trim());
    const masterAlbums = cand.knownArtistMasterAlbums || [];

    let suggestedMaster = '';
    let confidence = 75;
    let reasoning = '';

    // 1. Check if album title contains " - Single", " (Single)", " - EP", " [Single]", etc.
    const cleanAlbumWithoutSingle = rawAlbum
      .replace(/\s*[-–—]\s*(Single|EP|Maxi[- ]Single|Promo)$/i, '')
      .replace(/\s*\((Single|EP|Maxi[- ]Single|Promo|Deluxe|Special Edition)\)$/i, '')
      .replace(/\s*\[(Single|EP|Maxi[- ]Single|Promo|Deluxe)\]$/i, '')
      .trim();

    // Check if this cleaned name matches one of the artist's known master albums
    const exactMasterMatch = masterAlbums.find(
      (m) => m.toLowerCase() === cleanAlbumWithoutSingle.toLowerCase()
    );

    if (exactMasterMatch) {
      suggestedMaster = exactMasterMatch;
      confidence = 96;
      reasoning = `Matched release title variant to existing catalog master album '${exactMasterMatch}'. Consolidates single track(s) into the standard album.`;
    } else {
      // 2. Check if one of the candidate tracks matches a known master album or if the single title is a track from a master album
      let foundMatchingMaster = '';
      for (const m of masterAlbums) {
        // Simple case: album name shares root
        if (
          m.toLowerCase().includes(cleanAlbumWithoutSingle.toLowerCase()) ||
          cleanAlbumWithoutSingle.toLowerCase().includes(m.toLowerCase())
        ) {
          foundMatchingMaster = m;
          confidence = 88;
          reasoning = `Title similarity indicates this release is a promotional single or edition variation belonging to master album '${m}'.`;
          break;
        }
      }

      if (foundMatchingMaster) {
        suggestedMaster = foundMatchingMaster;
      } else if (masterAlbums.length === 1) {
        // Only 1 master album in library for this artist
        suggestedMaster = masterAlbums[0];
        confidence = 82;
        reasoning = `The primary established master album for ${artist} in your catalog is '${masterAlbums[0]}'. Merging single track(s) links them to this project.`;
      } else if (cleanAlbumWithoutSingle && cleanAlbumWithoutSingle !== rawAlbum) {
        suggestedMaster = cleanAlbumWithoutSingle;
        confidence = 85;
        reasoning = `Stripped single/promo identifier to form the canonical release title '${cleanAlbumWithoutSingle}'.`;
      } else {
        // Fallback: If no album or standalone single
        suggestedMaster = masterAlbums[0] || `${artist} Singles & Unassigned`;
        confidence = 70;
        reasoning = `Suggested grouping under master project '${suggestedMaster}' to meet the strict 3-song album qualification threshold.`;
      }
    }

    return {
      candidateId: cand.id,
      artist: cand.artist,
      currentAlbum: cand.currentAlbum,
      tracks,
      trackCount: cand.trackCount,
      totalPlays: cand.totalPlays,
      suggestedMasterAlbum: suggestedMaster || cand.currentAlbum,
      confidence,
      reasoning,
      source: 'heuristic-discography',
      targetAlbumExistsInCatalog: masterAlbums.includes(suggestedMaster),
      targetAlbumCatalogTracks: undefined,
      status: 'pending',
    };
  });
}

/**
 * Resolves undersized albums (< 3 tracks) using Gemini 3.8 Flash
 * Leverages deep music discography intelligence to find the master album.
 */
export async function resolveUndersizedAlbumsWithAI(
  candidates: UndersizedAlbumCandidate[]
): Promise<AlbumMergeSuggestion[]> {
  if (!candidates || candidates.length === 0) {
    return [];
  }

  const ai = getAiClient();
  if (!ai) {
    console.warn('[GeminiAlbumResolver] GEMINI_API_KEY not configured. Using heuristic discography engine.');
    return generateHeuristicAlbumSuggestions(candidates);
  }

  try {
    // Format candidate payload for Gemini prompt (batch up to 30 items per call for prompt efficiency)
    const candidatesSummary = candidates.slice(0, 30).map((c) => ({
      candidateId: c.id,
      artist: c.artist,
      currentAlbum: c.currentAlbum,
      tracks: c.tracks.map((t) => t.title),
      totalPlays: c.totalPlays,
      knownMasterAlbums: c.knownArtistMasterAlbums || [],
    }));

    const systemInstruction = `You are an elite music discography catalog specialist and music historian.
ZeroCharts requires a strict qualification minimum of at least 3 tracks for an entity to qualify as an Album for charts and official sales certifications.
Albums with fewer than 3 songs (e.g. standalone singles, promotional snippets, EP fragments, or mistagged releases) must be resolved and merged into their official master parent studio album.

Your job:
1. Examine each candidate release (artist, current album name, track names, and existing catalog albums).
2. Identify the official, canonical studio master album (e.g., standard LP or primary studio release) that these track(s) belong to in the artist's official discography.
   Examples:
   - Taylor Swift: "Anti-Hero - Single" / "Anti-Hero" -> belongs to master album "Midnights".
   - The Weeknd: "Blinding Lights - Single" -> belongs to master album "After Hours".
   - Harry Styles: "As It Was" -> belongs to master album "Harry's House".
   - Sabrina Carpenter: "Espresso - Single" -> belongs to master album "Short n' Sweet".
   - Olivia Rodrigo: "vampire" -> belongs to master album "GUTS".
   - Dua Lipa: "Don't Start Now" -> belongs to master album "Future Nostalgia".
   - Kendrick Lamar: "Not Like Us" -> if standalone non-album single, identify if there is a primary album or suggest "Not Like Us" (or known compilation) with accurate confidence.
3. If one of the knownMasterAlbums in the user's catalog is the correct parent album, prefer matching to that exact master album name so it consolidates cleanly.
4. If the track was an official standalone single never on a standard studio album, state that clearly and suggest the artist's most appropriate canonical project or compilation, with slightly lower confidence (e.g. 70-80).
5. Output confidence from 50 to 99, and a concise 1-2 sentence rationale explaining the album release year, album tracklist placement, or single history.`;

    const prompt = `Please analyze the following ${candidatesSummary.length} music catalog entries that currently have fewer than 3 tracks, and provide official master album merge suggestions:

${JSON.stringify(candidatesSummary, null, 2)}

Return a JSON array where each object has:
- candidateId: exact matching candidateId string
- artist: artist name
- currentAlbum: current album name
- suggestedMasterAlbum: the canonical studio/master album title
- confidence: integer number between 50 and 99
- reasoning: brief, precise explanation of why these track(s) belong to this master album in official discography`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              candidateId: { type: Type.STRING },
              artist: { type: Type.STRING },
              currentAlbum: { type: Type.STRING },
              suggestedMasterAlbum: { type: Type.STRING },
              confidence: { type: Type.INTEGER },
              reasoning: { type: Type.STRING },
            },
            required: ['candidateId', 'artist', 'currentAlbum', 'suggestedMasterAlbum', 'confidence', 'reasoning'],
          },
        },
      },
    });

    const text = response.text?.trim() || '';
    if (!text) {
      console.warn('[GeminiAlbumResolver] Empty response from Gemini. Falling back to heuristic.');
      return generateHeuristicAlbumSuggestions(candidates);
    }

    const aiResults: {
      candidateId: string;
      artist: string;
      currentAlbum: string;
      suggestedMasterAlbum: string;
      confidence: number;
      reasoning: string;
    }[] = JSON.parse(text);

    // Map AI results back to full suggestions
    const aiMap = new Map(aiResults.map((r) => [r.candidateId, r]));

    return candidates.map((cand) => {
      const aiMatch = aiMap.get(cand.id);
      const masterAlbums = cand.knownArtistMasterAlbums || [];
      const tracks = cand.tracks.map((t) => t.title);

      if (aiMatch && aiMatch.suggestedMasterAlbum) {
        return {
          candidateId: cand.id,
          artist: cand.artist,
          currentAlbum: cand.currentAlbum,
          tracks,
          trackCount: cand.trackCount,
          totalPlays: cand.totalPlays,
          suggestedMasterAlbum: aiMatch.suggestedMasterAlbum.trim(),
          confidence: Math.min(99, Math.max(50, aiMatch.confidence || 90)),
          reasoning: aiMatch.reasoning || `Identified as canonical release track in ${cand.artist}'s official discography.`,
          source: 'gemini-ai',
          targetAlbumExistsInCatalog: masterAlbums.some(
            (m) => m.toLowerCase() === aiMatch.suggestedMasterAlbum.trim().toLowerCase()
          ),
          status: 'pending',
        };
      }

      // If this specific candidate was not returned by AI, use heuristic
      const fallback = generateHeuristicAlbumSuggestions([cand])[0];
      return fallback;
    });
  } catch (err) {
    console.error('[GeminiAlbumResolver] AI resolution encountered error, using heuristic fallback:', err);
    return generateHeuristicAlbumSuggestions(candidates);
  }
}
