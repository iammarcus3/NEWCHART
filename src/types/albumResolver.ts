export interface UndersizedAlbumCandidate {
  id: string; // e.g. "taylor swift:::anti-hero - single"
  artist: string;
  currentAlbum: string;
  tracks: {
    title: string;
    playCount: number;
  }[];
  trackCount: number; // strictly < minAlbumTracks (default < 3)
  totalPlays: number;
  coverArt?: string;
  knownArtistMasterAlbums?: string[]; // Artist's albums with >= 3 tracks in catalog
}

export interface AlbumMergeSuggestion {
  candidateId: string;
  artist: string;
  currentAlbum: string;
  tracks: string[]; // List of track titles
  trackCount: number;
  totalPlays: number;
  suggestedMasterAlbum: string;
  confidence: number; // 0 to 100
  reasoning: string;
  source: 'gemini-ai' | 'heuristic-discography';
  targetAlbumExistsInCatalog: boolean;
  targetAlbumCatalogTracks?: number;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  customMasterAlbum?: string;
  mergedAt?: number;
}

export interface AlbumResolverState {
  isScanning: boolean;
  isAiAnalyzing: boolean;
  lastAiAnalysisTime?: number;
  suggestions: Record<string, AlbumMergeSuggestion>; // candidateId -> suggestion
  ignoredCandidateIds: string[];
}
