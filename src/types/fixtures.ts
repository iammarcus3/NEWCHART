export interface ApprovedAiResolution {
  id: string;
  type: 'single_to_parent' | 'track_variant' | 'album_variant' | 'artist_credit';
  artist: string;
  source: string;
  target: string;
  tracks?: string[];
  approvedAt: string;
  reasoning?: string;
  confidence?: number;
}

export interface SongCreditRule {
  leadArtist: string;
  featuredArtists: string[];
}

export interface CanonicalCatalogFixtures {
  version: string;
  description: string;
  lastUpdated: string;
  // Map of "artist:::trackTitle" OR "artist:::singleReleaseTitle" -> Master Parent Studio Album
  parentAlbumMappings: Record<string, string>;
  // Map of "artist:::variantTrackTitle" -> Canonical Master Track Title
  trackMerges: Record<string, string>;
  // Map of "artist:::variantAlbumTitle" -> Canonical Master Album Title
  albumMerges: Record<string, string>;
  // Map of "normalizedAlbumTitle" -> Single Canonical Lead Artist (enforcing real-life 1-artist album chart rules)
  albumLeadArtistRules: Record<string, string>;
  // Map of "artist:::trackTitle" -> explicit lead + featured artist splitting
  songFeaturedCredits: Record<string, SongCreditRule>;
  // History of AI suggestions that were reviewed and approved by the user
  approvedAiResolutions: ApprovedAiResolution[];
}
