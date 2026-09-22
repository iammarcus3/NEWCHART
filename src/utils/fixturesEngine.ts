import { CanonicalCatalogFixtures, ApprovedAiResolution, SongCreditRule } from '../types/fixtures';
import defaultFixtures from '../data/canonicalCatalogFixtures.json';

const FIXTURES_STORAGE_KEY = 'zerocharts_canonical_fixtures_v1';

let inMemoryFixtures: CanonicalCatalogFixtures | null = null;

/**
 * Loads the active canonical fixtures from persistent localStorage,
 * falling back to the bundled canonicalCatalogFixtures.json seed file.
 */
export function loadActiveFixtures(): CanonicalCatalogFixtures {
  if (inMemoryFixtures) {
    return inMemoryFixtures;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(FIXTURES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CanonicalCatalogFixtures;
        if (parsed && parsed.parentAlbumMappings && parsed.trackMerges && parsed.albumMerges) {
          // Merge with default seed fixtures to ensure all base discographical rules are present
          const merged: CanonicalCatalogFixtures = {
            version: parsed.version || (defaultFixtures as any).version || '1.0.0',
            description: parsed.description || (defaultFixtures as any).description,
            lastUpdated: parsed.lastUpdated || new Date().toISOString(),
            parentAlbumMappings: {
              ...(defaultFixtures as any).parentAlbumMappings,
              ...parsed.parentAlbumMappings,
            },
            trackMerges: {
              ...(defaultFixtures as any).trackMerges,
              ...parsed.trackMerges,
            },
            albumMerges: {
              ...(defaultFixtures as any).albumMerges,
              ...parsed.albumMerges,
            },
            albumLeadArtistRules: {
              ...(defaultFixtures as any).albumLeadArtistRules,
              ...(parsed.albumLeadArtistRules || {}),
            },
            songFeaturedCredits: {
              ...(defaultFixtures as any).songFeaturedCredits,
              ...(parsed.songFeaturedCredits || {}),
            },
            approvedAiResolutions: parsed.approvedAiResolutions || [],
          };
          inMemoryFixtures = merged;
          return merged;
        }
      }
    } catch (e) {
      console.warn('[FixturesEngine] Could not load localStorage fixtures, using default seed:', e);
    }
  }

  const seed: CanonicalCatalogFixtures = {
    version: (defaultFixtures as any).version || '1.0.0',
    description: (defaultFixtures as any).description || 'ZeroCharts Official Canonical Catalog Fixtures',
    lastUpdated: (defaultFixtures as any).lastUpdated || new Date().toISOString(),
    parentAlbumMappings: { ...(defaultFixtures as any).parentAlbumMappings },
    trackMerges: { ...(defaultFixtures as any).trackMerges },
    albumMerges: { ...(defaultFixtures as any).albumMerges },
    albumLeadArtistRules: { ...(defaultFixtures as any).albumLeadArtistRules },
    songFeaturedCredits: { ...(defaultFixtures as any).songFeaturedCredits },
    approvedAiResolutions: [...((defaultFixtures as any).approvedAiResolutions || [])],
  };

  inMemoryFixtures = seed;
  saveActiveFixtures(seed);
  return seed;
}

/**
 * Saves updated fixtures to persistent storage and updates in-memory cache.
 */
export function saveActiveFixtures(fixtures: CanonicalCatalogFixtures): void {
  const updated: CanonicalCatalogFixtures = {
    ...fixtures,
    lastUpdated: new Date().toISOString(),
  };
  inMemoryFixtures = updated;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FIXTURES_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[FixturesEngine] Failed saving to localStorage:', e);
    }
  }
}

/**
 * Exports current fixtures as a formatted JSON string.
 */
export function exportFixturesToJson(fixtures?: CanonicalCatalogFixtures): string {
  const data = fixtures || loadActiveFixtures();
  return JSON.stringify(data, null, 2);
}

/**
 * Triggers a file download of canonical_catalog_fixtures.json in the browser.
 */
export function downloadFixturesFile(fixtures?: CanonicalCatalogFixtures): void {
  const content = exportFixturesToJson(fixtures);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `canonical_catalog_fixtures_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Imports a JSON string into active fixtures with schema validation.
 */
export function importFixturesFromJson(jsonStr: string): {
  success: boolean;
  error?: string;
  fixtures?: CanonicalCatalogFixtures;
  addedCount?: number;
} {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid JSON: root must be an object' };
    }

    const current = loadActiveFixtures();
    const updated: CanonicalCatalogFixtures = {
      version: parsed.version || current.version,
      description: parsed.description || current.description,
      lastUpdated: new Date().toISOString(),
      parentAlbumMappings: {
        ...current.parentAlbumMappings,
        ...(parsed.parentAlbumMappings || {}),
      },
      trackMerges: {
        ...current.trackMerges,
        ...(parsed.trackMerges || {}),
      },
      albumMerges: {
        ...current.albumMerges,
        ...(parsed.albumMerges || {}),
      },
      albumLeadArtistRules: {
        ...current.albumLeadArtistRules,
        ...(parsed.albumLeadArtistRules || {}),
      },
      songFeaturedCredits: {
        ...current.songFeaturedCredits,
        ...(parsed.songFeaturedCredits || {}),
      },
      approvedAiResolutions: [
        ...current.approvedAiResolutions,
        ...(parsed.approvedAiResolutions || []),
      ],
    };

    saveActiveFixtures(updated);
    return {
      success: true,
      fixtures: updated,
      addedCount:
        Object.keys(parsed.parentAlbumMappings || {}).length +
        Object.keys(parsed.trackMerges || {}).length +
        Object.keys(parsed.albumMerges || {}).length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not parse JSON file' };
  }
}

/**
 * Adds an approved AI resolution into the canonical fixtures registry.
 */
export function addApprovedResolutionToFixtures(resolution: ApprovedAiResolution): CanonicalCatalogFixtures {
  const fixtures = loadActiveFixtures();
  const cArtist = resolution.artist.trim().toLowerCase();
  const cSource = resolution.source.trim().toLowerCase();
  const cTarget = resolution.target.trim();

  const key = `${cArtist}:::${cSource}`;

  if (resolution.type === 'single_to_parent') {
    fixtures.parentAlbumMappings[key] = cTarget;
    if (resolution.tracks && resolution.tracks.length > 0) {
      for (const t of resolution.tracks) {
        const tKey = `${cArtist}:::${t.trim().toLowerCase()}`;
        fixtures.parentAlbumMappings[tKey] = cTarget;
      }
    }
  } else if (resolution.type === 'track_variant') {
    fixtures.trackMerges[key] = cTarget;
  } else if (resolution.type === 'album_variant') {
    fixtures.albumMerges[key] = cTarget;
  } else if (resolution.type === 'artist_credit') {
    fixtures.albumLeadArtistRules[cSource.toLowerCase()] = cTarget;
  }

  // Prevent duplicate resolution entries in history
  const filteredResolutions = fixtures.approvedAiResolutions.filter((r) => r.id !== resolution.id);
  fixtures.approvedAiResolutions = [resolution, ...filteredResolutions];

  saveActiveFixtures(fixtures);
  return fixtures;
}

/**
 * Batch adds multiple approved resolutions.
 */
export function batchAddApprovedResolutionsToFixtures(
  resolutions: ApprovedAiResolution[]
): CanonicalCatalogFixtures {
  const fixtures = loadActiveFixtures();

  for (const resolution of resolutions) {
    const cArtist = resolution.artist.trim().toLowerCase();
    const cSource = resolution.source.trim().toLowerCase();
    const cTarget = resolution.target.trim();
    const key = `${cArtist}:::${cSource}`;

    if (resolution.type === 'single_to_parent') {
      fixtures.parentAlbumMappings[key] = cTarget;
      if (resolution.tracks && resolution.tracks.length > 0) {
        for (const t of resolution.tracks) {
          const tKey = `${cArtist}:::${t.trim().toLowerCase()}`;
          fixtures.parentAlbumMappings[tKey] = cTarget;
        }
      }
    } else if (resolution.type === 'track_variant') {
      fixtures.trackMerges[key] = cTarget;
    } else if (resolution.type === 'album_variant') {
      fixtures.albumMerges[key] = cTarget;
    } else if (resolution.type === 'artist_credit') {
      fixtures.albumLeadArtistRules[cSource.toLowerCase()] = cTarget;
    }
  }

  const newIds = new Set(resolutions.map((r) => r.id));
  const filtered = fixtures.approvedAiResolutions.filter((r) => !newIds.has(r.id));
  fixtures.approvedAiResolutions = [...resolutions, ...filtered];

  saveActiveFixtures(fixtures);
  return fixtures;
}

/**
 * Reverts an approved resolution from active fixtures.
 */
export function revertApprovedResolution(id: string): CanonicalCatalogFixtures {
  const fixtures = loadActiveFixtures();
  const target = fixtures.approvedAiResolutions.find((r) => r.id === id);
  if (!target) return fixtures;

  const cArtist = target.artist.trim().toLowerCase();
  const cSource = target.source.trim().toLowerCase();
  const key = `${cArtist}:::${cSource}`;

  if (target.type === 'single_to_parent') {
    delete fixtures.parentAlbumMappings[key];
    if (target.tracks) {
      for (const t of target.tracks) {
        delete fixtures.parentAlbumMappings[`${cArtist}:::${t.trim().toLowerCase()}`];
      }
    }
  } else if (target.type === 'track_variant') {
    delete fixtures.trackMerges[key];
  } else if (target.type === 'album_variant') {
    delete fixtures.albumMerges[key];
  } else if (target.type === 'artist_credit') {
    delete fixtures.albumLeadArtistRules[cSource.toLowerCase()];
  }

  fixtures.approvedAiResolutions = fixtures.approvedAiResolutions.filter((r) => r.id !== id);
  saveActiveFixtures(fixtures);
  return fixtures;
}

/**
 * Summary statistics for active fixtures.
 */
export function getFixturesStats(fixtures: CanonicalCatalogFixtures) {
  return {
    parentAlbumMappingsCount: Object.keys(fixtures.parentAlbumMappings || {}).length,
    trackMergesCount: Object.keys(fixtures.trackMerges || {}).length,
    albumMergesCount: Object.keys(fixtures.albumMerges || {}).length,
    leadArtistRulesCount: Object.keys(fixtures.albumLeadArtistRules || {}).length,
    approvedAiCount: (fixtures.approvedAiResolutions || []).length,
    lastUpdated: fixtures.lastUpdated,
  };
}
