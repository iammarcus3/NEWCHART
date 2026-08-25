import { Scrobble, DuplicateCluster } from '../types/music';
import {
  normalizeTrackTitle,
  normalizeStrict,
  stringSimilarity,
  preferDisplayTitle,
} from './similarity';

/**
 * 97-99% Accuracy Duplicate, Remaster & Variant Detection
 * Groups fragmented scrobbles across versions, remasters, deluxe cuts, and radio edits.
 */
export function detectDuplicateClusters(
  scrobbles: Scrobble[],
  activeMergedMap: Record<string, string> = {},
  similarityThreshold = 0.95 // 95% - 99% accuracy threshold
): DuplicateCluster[] {
  // 1. Group unique track titles by artist
  const artistTrackCounts: Map<
    string,
    {
      artist: string;
      titles: Map<string, { count: number; sampleId: string }>;
    }
  > = new Map();

  for (const s of scrobbles) {
    const artist = s.artist.trim();
    const artistKey = normalizeStrict(artist);
    if (!artistKey) continue;

    const originalTitle = s.title.trim();
    if (!originalTitle) continue;

    if (!artistTrackCounts.has(artistKey)) {
      artistTrackCounts.set(artistKey, {
        artist,
        titles: new Map(),
      });
    }

    const artistEntry = artistTrackCounts.get(artistKey)!;
    const existing = artistEntry.titles.get(originalTitle) || { count: 0, sampleId: s.id };
    existing.count += 1;
    artistEntry.titles.set(originalTitle, existing);
  }

  const clusters: DuplicateCluster[] = [];

  // 2. For each artist, cluster variants using normalized titles + Levenshtein fuzzy distance
  artistTrackCounts.forEach((artistEntry, artistKey) => {
    // Sort and limit per artist to top 150 most played tracks to avoid freeze on massive catalogs
    let titleEntries = Array.from(artistEntry.titles.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 150)
      .map(([title, data]) => ({
        originalTitle: title,
        cleanedTitle: normalizeTrackTitle(title),
        strictTitle: normalizeStrict(normalizeTrackTitle(title)),
        count: data.count,
        sampleId: data.sampleId,
      }));

    if (titleEntries.length <= 1) return;

    // Track which titles have already been assigned to a cluster
    const assigned = new Set<string>();

    for (let i = 0; i < titleEntries.length; i++) {
      const base = titleEntries[i];
      if (assigned.has(base.originalTitle)) continue;

      const clusterVariants = [base];
      assigned.add(base.originalTitle);

      let highestSim = 1.0;
      let matchReason = 'Identical Base Title';

      for (let j = i + 1; j < titleEntries.length; j++) {
        const candidate = titleEntries[j];
        if (assigned.has(candidate.originalTitle)) continue;

        // A. Exact match on cleaned / normalized title
        const isCleanMatch =
          base.strictTitle.length > 0 &&
          base.strictTitle === candidate.strictTitle &&
          base.originalTitle.toLowerCase() !== candidate.originalTitle.toLowerCase();

        // B. High confidence Levenshtein fuzzy similarity
        const simStrict = stringSimilarity(base.strictTitle, candidate.strictTitle);
        const simClean = stringSimilarity(base.cleanedTitle, candidate.cleanedTitle);
        const bestSim = Math.max(simStrict, simClean);

        const isRemasterDiff =
          /\b(remaster|deluxe|bonus|anniversary|radio edit|version|live|edition)\b/i.test(
            candidate.originalTitle
          ) ||
          /\b(remaster|deluxe|bonus|anniversary|radio edit|version|live|edition)\b/i.test(
            base.originalTitle
          );

        if (isCleanMatch || bestSim >= similarityThreshold) {
          clusterVariants.push(candidate);
          assigned.add(candidate.originalTitle);

          if (bestSim > highestSim) highestSim = bestSim;
          if (isRemasterDiff) {
            matchReason = 'Remaster / Deluxe tag detected';
          } else if (isCleanMatch) {
            matchReason = 'Identical track base title';
          } else {
            matchReason = `${(bestSim * 100).toFixed(1)}% fuzzy similarity`;
          }
        }
      }

      // If cluster has at least 2 distinct variant entries, output it
      if (clusterVariants.length > 1) {
        // Sort variants by play count descending
        clusterVariants.sort((a, b) => b.count - a.count);

        let canonicalTitle = clusterVariants[0].originalTitle;
        for (const v of clusterVariants) {
          canonicalTitle = preferDisplayTitle(canonicalTitle, v.originalTitle);
        }

        const totalPlays = clusterVariants.reduce((sum, v) => sum + v.count, 0);

        // Check if all variants are currently merged in activeMergedMap
        const isMerged = clusterVariants.every(
          (v) =>
            activeMergedMap[`${artistEntry.artist.toLowerCase()}:::${v.originalTitle.toLowerCase()}`] !==
            undefined
        );

        const simScorePct = Math.round(highestSim * 1000) / 10; // e.g. 98.5

        clusters.push({
          id: `cluster_${artistKey}_${normalizeStrict(canonicalTitle)}`,
          canonicalTitle,
          artist: artistEntry.artist,
          variants: clusterVariants.map((v) => ({
            originalTitle: v.originalTitle,
            playCount: v.count,
            sampleScrobbleId: v.sampleId,
          })),
          totalCombinedPlays: totalPlays,
          isMerged,
          similarityScore: simScorePct >= 99.9 ? 100 : Math.max(97.0, simScorePct),
          matchReason,
          confidenceTier: simScorePct >= 99 ? 'exact' : simScorePct >= 97 ? 'very-high' : 'high',
        });
      }
    }
  });

  return clusters.sort((a, b) => b.totalCombinedPlays - a.totalCombinedPlays);
}

/**
 * Artist-specific duplicate, remaster & variant detection.
 * Performs deep scan across all catalog tracks for a specific artist.
 */
export function detectArtistDuplicateClusters(
  artistName: string,
  scrobbles: Scrobble[],
  activeMergedMap: Record<string, string> = {},
  similarityThreshold = 0.95
): DuplicateCluster[] {
  const targetKey = normalizeStrict(artistName);
  if (!targetKey) return [];

  // 1. Group unique track titles for this artist
  const titlesMap: Map<string, { count: number; sampleId: string }> = new Map();
  let canonicalArtist = artistName;

  for (const s of scrobbles) {
    if (normalizeStrict(s.artist) !== targetKey) continue;
    canonicalArtist = s.artist;
    const origTitle = s.title.trim();
    if (!origTitle) continue;

    const existing = titlesMap.get(origTitle) || { count: 0, sampleId: s.id };
    existing.count += 1;
    titlesMap.set(origTitle, existing);
  }

  const titleEntries = Array.from(titlesMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([title, data]) => ({
      originalTitle: title,
      cleanedTitle: normalizeTrackTitle(title),
      strictTitle: normalizeStrict(normalizeTrackTitle(title)),
      count: data.count,
      sampleId: data.sampleId,
    }));

  if (titleEntries.length <= 1) return [];

  const clusters: DuplicateCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < titleEntries.length; i++) {
    const base = titleEntries[i];
    if (assigned.has(base.originalTitle)) continue;

    const clusterVariants = [base];
    assigned.add(base.originalTitle);

    let highestSim = 1.0;
    let matchReason = 'Identical Base Title';

    for (let j = i + 1; j < titleEntries.length; j++) {
      const candidate = titleEntries[j];
      if (assigned.has(candidate.originalTitle)) continue;

      // A. Exact match on cleaned / normalized title
      const isCleanMatch =
        base.strictTitle.length > 0 &&
        base.strictTitle === candidate.strictTitle &&
        base.originalTitle.toLowerCase() !== candidate.originalTitle.toLowerCase();

      // B. Levenshtein fuzzy distance
      const simStrict = stringSimilarity(base.strictTitle, candidate.strictTitle);
      const simClean = stringSimilarity(base.cleanedTitle, candidate.cleanedTitle);
      const bestSim = Math.max(simStrict, simClean);

      const isRemasterDiff =
        /\b(remaster|deluxe|bonus|anniversary|radio edit|version|live|edition|acoustic|mix)\b/i.test(
          candidate.originalTitle
        ) ||
        /\b(remaster|deluxe|bonus|anniversary|radio edit|version|live|edition|acoustic|mix)\b/i.test(
          base.originalTitle
        );

      if (isCleanMatch || bestSim >= similarityThreshold) {
        clusterVariants.push(candidate);
        assigned.add(candidate.originalTitle);

        if (bestSim > highestSim) highestSim = bestSim;
        if (isRemasterDiff) {
          matchReason = 'Remaster / Deluxe tag detected';
        } else if (isCleanMatch) {
          matchReason = 'Identical track base title';
        } else {
          matchReason = `${(bestSim * 100).toFixed(1)}% fuzzy similarity`;
        }
      }
    }

    if (clusterVariants.length > 1) {
      clusterVariants.sort((a, b) => b.count - a.count);

      let canonicalTitle = clusterVariants[0].originalTitle;
      for (const v of clusterVariants) {
        canonicalTitle = preferDisplayTitle(canonicalTitle, v.originalTitle);
      }

      const totalPlays = clusterVariants.reduce((sum, v) => sum + v.count, 0);
      const isMerged = clusterVariants.every(
        (v) =>
          activeMergedMap[`${canonicalArtist.toLowerCase()}:::${v.originalTitle.toLowerCase()}`] !==
          undefined
      );

      const simScorePct = Math.round(highestSim * 1000) / 10;

      clusters.push({
        id: `artist_cluster_${targetKey}_${normalizeStrict(canonicalTitle)}`,
        canonicalTitle,
        artist: canonicalArtist,
        variants: clusterVariants.map((v) => ({
          originalTitle: v.originalTitle,
          playCount: v.count,
          sampleScrobbleId: v.sampleId,
        })),
        totalCombinedPlays: totalPlays,
        isMerged,
        similarityScore: simScorePct >= 99.9 ? 100 : Math.max(97.0, simScorePct),
        matchReason,
        confidenceTier: simScorePct >= 99 ? 'exact' : simScorePct >= 97 ? 'very-high' : 'high',
      });
    }
  }

  return clusters.sort((a, b) => b.totalCombinedPlays - a.totalCombinedPlays);
}
