import { Scrobble } from '../types/music';
import { extractLowResLastfmImage } from './lastfmImageFetcher';

export interface ParseResult {
  scrobbles: Scrobble[];
  format: 'spotify-extended' | 'spotify-simple' | 'lastfm-json' | 'lastfm-csv' | 'apple-music' | 'csv' | 'generic';
  errors: string[];
  totalParsed: number;
  startDate?: Date;
  endDate?: Date;
  topArtists?: { artist: string; count: number }[];
  fileNames?: string[];
}

export interface ParseProgress {
  percent: number;
  message: string;
  count: number;
  fileIndex: number;
  totalFiles: number;
}

/**
 * Robust CSV Line Tokenizer handling quotes and commas inside quotes
 */
function tokenizeCSVLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        currentValue += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue.trim());
  return values;
}

/**
 * Detect delimiter: comma, tab, semicolon, or pipe
 */
function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  const pipes = (firstLine.match(/\|/g) || []).length;

  if (tabs >= commas && tabs >= semicolons && tabs >= pipes && tabs > 0) return '\t';
  if (semicolons > commas && semicolons > tabs && semicolons > pipes) return ';';
  if (pipes > commas && pipes > tabs && pipes > semicolons) return '|';
  return ',';
}

/**
 * Fast, highly accurate date/timestamp parser optimized for high-volume scrobble imports.
 * Uses native Date.parse and fast-path ISO checks before falling back to regex.
 */
export function parseTimestamp(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;

  // 1. Numeric unix timestamp
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    return val > 9999999999 ? Math.floor(val / 1000) : Math.floor(val);
  }

  const strVal = String(val).trim();
  if (!strVal) return null;

  const firstChar = strVal.charCodeAt(0);

  // 2. Pure digits string (e.g. "1700000000" or "1700000000000")
  if (firstChar >= 48 && firstChar <= 57 && /^\d+$/.test(strVal)) {
    const num = Number(strVal);
    if (!isNaN(num) && num > 0) {
      return num > 9999999999 ? Math.floor(num / 1000) : Math.floor(num);
    }
  }

  // 3. Fast ISO 8601 Date / UTC format (e.g. "2024-01-15T12:30:00Z" or "2024-01-15 12:30:00")
  if (strVal.length >= 10 && strVal.charCodeAt(4) === 45 && strVal.charCodeAt(7) === 45) {
    const parsed = Date.parse(strVal.endsWith('Z') || strVal.includes('+') ? strVal : strVal.replace(' ', 'T') + 'Z');
    if (!isNaN(parsed) && parsed > 0) {
      return Math.floor(parsed / 1000);
    }
    const directParsed = Date.parse(strVal);
    if (!isNaN(directParsed) && directParsed > 0) {
      return Math.floor(directParsed / 1000);
    }
  }

  // 4. Last.fm format: "31 Dec 2020, 23:59" or "31 Dec 2020 23:59:00"
  if (firstChar >= 48 && firstChar <= 57 && strVal.includes(' ')) {
    const lastfmDateMatch = strVal.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (lastfmDateMatch) {
      const month = lastfmDateMatch[2];
      const day = lastfmDateMatch[1];
      const year = lastfmDateMatch[3];
      const hour = lastfmDateMatch[4];
      const min = lastfmDateMatch[5];
      const sec = lastfmDateMatch[6] || '00';
      const d = Date.parse(`${month} ${day}, ${year} ${hour}:${min}:${sec} UTC`);
      if (!isNaN(d)) {
        return Math.floor(d / 1000);
      }
    }
  }

  // 5. Native JS Date Parser fallback
  const parsedDate = Date.parse(strVal);
  if (!isNaN(parsedDate) && parsedDate > 0) {
    return Math.floor(parsedDate / 1000);
  }

  return null;
}

/**
 * Parses raw text content from a single scrobble file.
 */
export function parseScrobbleFileContent(rawText: string, filename: string): ParseResult {
  const errors: string[] = [];
  const scrobbles: Scrobble[] = [];

  const trimmed = rawText.trim();
  const lowerName = filename.toLowerCase();

  // 1. Try JSON / NDJSON Parsing
  if (
    trimmed.startsWith('[') ||
    trimmed.startsWith('{') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.ndjson')
  ) {
    try {
      let rawData: any = null;

      // Handle NDJSON (newline-delimited JSON objects)
      if (trimmed.startsWith('{') && trimmed.includes('\n') && !trimmed.endsWith('}')) {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const parsedItems: any[] = [];
        for (const line of lines) {
          try {
            parsedItems.push(JSON.parse(line));
          } catch {}
        }
        if (parsedItems.length > 0) {
          rawData = parsedItems;
        }
      }

      if (!rawData) {
        rawData = JSON.parse(trimmed);
      }

      // Unpack potential wrapped structures (e.g. { scrobbles: [...] }, { recenttracks: { track: [...] } }, { history: [...] }, { items: [...] })
      let targetArray: any[] | null = null;
      let detectedFormat: 'spotify-extended' | 'spotify-simple' | 'lastfm-json' = 'spotify-extended';

      if (Array.isArray(rawData)) {
        targetArray = rawData;
      } else if (rawData && typeof rawData === 'object') {
        if (rawData.recenttracks?.track) {
          targetArray = Array.isArray(rawData.recenttracks.track)
            ? rawData.recenttracks.track
            : [rawData.recenttracks.track];
          detectedFormat = 'lastfm-json';
        } else if (rawData.track && Array.isArray(rawData.track)) {
          targetArray = rawData.track;
          detectedFormat = 'lastfm-json';
        } else if (rawData.scrobbles && Array.isArray(rawData.scrobbles)) {
          targetArray = rawData.scrobbles;
        } else if (rawData.history && Array.isArray(rawData.history)) {
          targetArray = rawData.history;
        } else if (rawData.items && Array.isArray(rawData.items)) {
          targetArray = rawData.items;
        } else if (rawData.tracks && Array.isArray(rawData.tracks)) {
          targetArray = rawData.tracks;
        } else if (rawData.data && Array.isArray(rawData.data)) {
          targetArray = rawData.data;
        }
      }

      if (targetArray && targetArray.length > 0) {
        let count = 1;

        for (const item of targetArray) {
          // Check Spotify vs Last.fm properties
          const isLastfmTrack = item.name !== undefined && (typeof item.artist === 'object' || typeof item.album === 'object' || item.date !== undefined);

          if (isLastfmTrack || detectedFormat === 'lastfm-json') {
            detectedFormat = 'lastfm-json';
            const track = item.name || item.title || item.track;
            const artist = typeof item.artist === 'object'
              ? item.artist?.['#text'] || item.artist?.name
              : item.artist;
            const album = typeof item.album === 'object'
              ? item.album?.['#text'] || item.album?.name || item.album?.title
              : item.album;
            const coverArt = Array.isArray(item.image)
              ? extractLowResLastfmImage(item.image, item.coverArt)
              : item.coverArt || undefined;

            let timestamp: number | null = null;
            if (item.date?.uts) {
              timestamp = parseTimestamp(item.date.uts);
            } else if (item.timestamp) {
              timestamp = parseTimestamp(item.timestamp);
            } else if (item.date?.['#text']) {
              timestamp = parseTimestamp(item.date['#text']);
            } else if (item['@attr']?.nowplaying) {
              timestamp = Math.floor(Date.now() / 1000);
            } else {
              timestamp = Math.floor(Date.now() / 1000) - count * 180;
            }

            if (track && artist && timestamp) {
              scrobbles.push({
                id: `lastfm_imp_${timestamp}_${count++}`,
                title: String(track).trim(),
                artist: String(artist).trim(),
                album: album ? String(album).trim() : undefined,
                timestamp,
                coverArt: coverArt && coverArt.startsWith('http') ? coverArt : undefined,
              });
            }
          } else {
            // Spotify Extended Streaming JSON or Spotify Simple
            const track =
              item.master_metadata_track_name ||
              item.trackName ||
              item.track_name ||
              item.track ||
              item.item_name ||
              item.name ||
              item.title;

            const artist =
              item.master_metadata_album_artist_name ||
              item.artistName ||
              item.artist_name ||
              item.artist ||
              item.album_artist_name;

            const album =
              item.master_metadata_album_album_name ||
              item.albumName ||
              item.album_name ||
              item.album;

            const msPlayed = item.ms_played ?? item.msPlayed ?? item.duration_ms ?? 30000;

            // Skip zero-play podcast items or empty tracks
            if (!track || !artist) continue;
            if (msPlayed !== undefined && msPlayed < 10000 && item.reason_end === 'fwdbtn') {
              // Skipped instantly within 10s
              continue;
            }

            let timestamp = parseTimestamp(item.ts) || parseTimestamp(item.endTime) || parseTimestamp(item.timestamp) || parseTimestamp(item.played_at);
            if (!timestamp) {
              timestamp = Math.floor(Date.now() / 1000) - count * 180;
            }

            scrobbles.push({
              id: `spotify_imp_${timestamp}_${count++}`,
              title: String(track).trim(),
              artist: String(artist).trim(),
              album: album ? String(album).trim() : undefined,
              timestamp,
              coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80',
            });
          }
        }

        if (scrobbles.length > 0) {
          return {
            scrobbles,
            format: detectedFormat,
            errors,
            totalParsed: scrobbles.length,
          };
        }
      }
    } catch (e: any) {
      errors.push(`JSON Parse failed: ${e.message}`);
    }
  }

  // 2. CSV / TSV / Semicolon / Pipe-delimited Parsing
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length >= 1) {
    const delimiter = detectDelimiter(lines[0]);
    const firstLineTokens = tokenizeCSVLine(lines[0], delimiter);
    const headerLower = firstLineTokens.map((h) => h.toLowerCase().replace(/["']/g, '').trim());

    // Check header mappings
    let artistIdx = headerLower.findIndex((h) =>
      h.includes('artist') || h === 'performer' || h === 'band'
    );
    let trackIdx = headerLower.findIndex((h) =>
      h.includes('track') || h.includes('title') || h.includes('song') || h === 'name'
    );
    let albumIdx = headerLower.findIndex((h) =>
      h.includes('album') || h.includes('release') || h === 'record'
    );
    let timestampIdx = headerLower.findIndex((h) =>
      h.includes('uts') ||
      h.includes('time') ||
      h.includes('date') ||
      h.includes('timestamp') ||
      h.includes('played')
    );

    // Apple Music Activity format: "Song Name", "Artist Name", "Event End Timestamp"
    if (headerLower.includes('song name') && headerLower.includes('artist name')) {
      trackIdx = headerLower.indexOf('song name');
      artistIdx = headerLower.indexOf('artist name');
      albumIdx = headerLower.indexOf('album');
      timestampIdx = headerLower.findIndex((h) => h.includes('timestamp') || h.includes('end'));
    }

    let startRow = 1;
    let format: 'lastfm-csv' | 'csv' = 'csv';

    // If headers were not detected, check if row 0 is already raw data (headerless CSV)
    if (artistIdx === -1 || trackIdx === -1) {
      startRow = 0;

      // Common Last.fm export format: uts,utc_time,artist,album,track
      if (firstLineTokens.length >= 5 && parseTimestamp(firstLineTokens[0])) {
        timestampIdx = 0;
        artistIdx = 2;
        albumIdx = 3;
        trackIdx = 4;
        format = 'lastfm-csv';
      }
      // uts,artist,album,track
      else if (firstLineTokens.length === 4 && parseTimestamp(firstLineTokens[0])) {
        timestampIdx = 0;
        artistIdx = 1;
        albumIdx = 2;
        trackIdx = 3;
        format = 'lastfm-csv';
      }
      // artist,album,track,timestamp
      else if (firstLineTokens.length === 4 && parseTimestamp(firstLineTokens[3])) {
        artistIdx = 0;
        albumIdx = 1;
        trackIdx = 2;
        timestampIdx = 3;
        format = 'lastfm-csv';
      }
      // artist,track,album,timestamp
      else if (firstLineTokens.length >= 3) {
        artistIdx = 0;
        trackIdx = 1;
        albumIdx = 2;
        timestampIdx = firstLineTokens.length > 3 ? 3 : -1;
      }
    }

    if (artistIdx !== -1 && trackIdx !== -1) {
      let count = 1;
      for (let i = startRow; i < lines.length; i++) {
        const parts = tokenizeCSVLine(lines[i], delimiter);
        if (parts.length <= Math.max(artistIdx, trackIdx)) continue;

        const artist = parts[artistIdx]?.replace(/["']/g, '').trim();
        const track = parts[trackIdx]?.replace(/["']/g, '').trim();
        const album = albumIdx >= 0 && albumIdx < parts.length ? parts[albumIdx]?.replace(/["']/g, '').trim() : undefined;
        const rawTimestamp = timestampIdx >= 0 && timestampIdx < parts.length ? parts[timestampIdx]?.replace(/["']/g, '').trim() : null;

        if (!artist || !track) continue;

        let timestamp = parseTimestamp(rawTimestamp);
        if (!timestamp) {
          timestamp = Math.floor(Date.now() / 1000) - (lines.length - i) * 180;
        }

        scrobbles.push({
          id: `csv_imp_${timestamp}_${count++}`,
          title: track,
          artist,
          album: album || undefined,
          timestamp,
          coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80',
        });
      }

      if (scrobbles.length > 0) {
        return {
          scrobbles,
          format: format === 'lastfm-csv' ? 'lastfm-csv' : 'csv',
          errors,
          totalParsed: scrobbles.length,
        };
      }
    }
  }

  return {
    scrobbles: [],
    format: 'generic',
    errors: errors.length > 0 ? errors : ['No valid track plays or recognized schema found in file.'],
    totalParsed: 0,
  };
}

/**
 * Asynchronous, non-blocking multi-file parser for large uploads.
 * Reads files in chunks, yields execution to keep UI smooth, and calculates aggregated stats.
 */
export async function parseScrobbleFilesAsync(
  files: File[],
  onProgress?: (progress: ParseProgress) => void
): Promise<ParseResult> {
  const allScrobbles: Scrobble[] = [];
  const errors: string[] = [];
  const fileNames: string[] = [];
  let detectedFormat: ParseResult['format'] = 'generic';

  const totalFiles = files.length;

  for (let fileIndex = 0; fileIndex < totalFiles; fileIndex++) {
    const file = files[fileIndex];
    fileNames.push(file.name);

    if (onProgress) {
      onProgress({
        percent: Math.round((fileIndex / totalFiles) * 85),
        message: `Reading ${file.name} (${fileIndex + 1} of ${totalFiles})...`,
        count: allScrobbles.length,
        fileIndex: fileIndex + 1,
        totalFiles,
      });
    }

    // Read text using FileReader promise
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsText(file);
    });

    // Yield to let browser breathe
    await new Promise((r) => setTimeout(r, 10));

    if (onProgress) {
      onProgress({
        percent: Math.round(((fileIndex + 0.6) / totalFiles) * 85),
        message: `Parsing ${file.name}...`,
        count: allScrobbles.length,
        fileIndex: fileIndex + 1,
        totalFiles,
      });
    }

    const singleResult = parseScrobbleFileContent(text, file.name);
    if (singleResult.errors.length > 0 && singleResult.scrobbles.length === 0) {
      errors.push(`${file.name}: ${singleResult.errors.join('; ')}`);
    } else {
      allScrobbles.push(...singleResult.scrobbles);
      if (singleResult.format !== 'generic') {
        detectedFormat = singleResult.format;
      }
    }

    // Yield again
    await new Promise((r) => setTimeout(r, 10));
  }

  // Fast Deduplication by fingerprint
  if (onProgress) {
    onProgress({
      percent: 92,
      message: 'Deduplicating & indexing timeline...',
      count: allScrobbles.length,
      fileIndex: totalFiles,
      totalFiles,
    });
  }

  const seen = new Set<string>();
  const uniqueScrobbles: Scrobble[] = [];
  const artistCounts: Record<string, number> = {};
  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  for (const s of allScrobbles) {
    const key = `${s.timestamp}_${s.artist.toLowerCase()}_${s.title.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueScrobbles.push(s);

      if (s.timestamp < minTimestamp) minTimestamp = s.timestamp;
      if (s.timestamp > maxTimestamp) maxTimestamp = s.timestamp;

      artistCounts[s.artist] = (artistCounts[s.artist] || 0) + 1;
    }
  }

  // Sort chronologically ascending (oldest to newest)
  uniqueScrobbles.sort((a, b) => a.timestamp - b.timestamp);

  // Compute top artists
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artist, count]) => ({ artist, count }));

  if (onProgress) {
    onProgress({
      percent: 100,
      message: `Parsed ${uniqueScrobbles.length.toLocaleString()} unique scrobbles across ${totalFiles} file(s).`,
      count: uniqueScrobbles.length,
      fileIndex: totalFiles,
      totalFiles,
    });
  }

  return {
    scrobbles: uniqueScrobbles,
    format: detectedFormat,
    errors,
    totalParsed: uniqueScrobbles.length,
    startDate: minTimestamp !== Infinity ? new Date(minTimestamp * 1000) : undefined,
    endDate: maxTimestamp !== -Infinity ? new Date(maxTimestamp * 1000) : undefined,
    topArtists,
    fileNames,
  };
}
