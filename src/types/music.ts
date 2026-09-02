export type TimeRangeFilter = '7d' | '30d' | '90d' | '365d' | 'all';

export type SubjectType = 'track' | 'artist' | 'album';

export type PlaqueMilestone = 'silver' | 'gold' | 'platinum' | 'multi-platinum' | 'diamond' | 'custom';

export type MoveStatus = 'new' | 'up' | 'down' | 'reentry' | 'flat';

export type PlaqueFrameStyle =
  | 'classic-walnut'
  | 'platinum-brushed'
  | 'obsidian'
  | 'rosegold'
  | 'cyberpunk-neon'
  | 'emerald-velvet';

export interface Scrobble {
  id: string;
  title: string;
  artist: string;
  album?: string;
  timestamp: number; // Unix timestamp in seconds
  coverArt?: string;
}

export interface ManualChartOverride {
  key: string; // e.g. "kavinsky:::nightcall" or "kavinsky"
  type: SubjectType;
  titleOverride?: string;
  artistOverride?: string;
  coverArtOverride?: string;
  pointAdjustment?: number; // +/- points
  lockedRank?: number; // e.g. 1 to force #1
  forceStatus?: MoveStatus;
  isBlacklisted?: boolean;
  notes?: string;
}

export interface ZeroChartSettings {
  chartTitle: string;
  chartSubtitle: string;
  chartSize: number; // 10, 20, 50, 100, 200
  playMultiplier: number;
  radioStreamsRatio: number; // weight ratio
  enableRecurrentRule: boolean;
  recurrentWeeksCutoff: number; // e.g. 20
  recurrentRankCutoff: number; // e.g. 50
  minScrobblesToChart: number; // e.g. 1
  minAlbumTracksToChart: number; // e.g. 3 (minimum 3 songs required overall to qualify for album chart)
  tieBreaker: 'recent' | 'peak' | 'plays' | 'alpha';
  
  // ZeroCharts Certification Formula & Thresholds
  trackPlayWeight: number; // default 50000
  albumPlayWeight: number; // default 5000
  trackStabilityWeight: number; // default 500
  albumStabilityWeight: number; // default 500
  goldThresholdTrack: number; // default 500000
  goldThresholdAlbum: number; // default 500000
  platinumThresholdTrack: number; // default 1000000
  platinumThresholdAlbum: number; // default 1000000
  diamondThresholdTrack: number; // default 10000000
  diamondThresholdAlbum: number; // default 10000000
  salesUnitName: string; // default "Units Sold"

  goldThreshold: number;
  platinumThreshold: number;
  diamondThreshold: number;
  manualOverrides: Record<string, ManualChartOverride>;
  blacklistedKeys: string[];
}

export interface ChartWeekInfo {
  weekNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  label: string;
  dateRange: string;
  tracksCount: number;
  artistsCount: number;
  albumsCount: number;
  scrobbles?: Scrobble[];
}

export interface TrackChartItem {
  id: string;
  rank: number;
  previousRank?: number;
  lastRank?: number | null;
  moveDiff?: number;
  moveStatus: MoveStatus;
  title: string;
  artist: string;
  subtitle: string;
  album?: string;
  playCount: number;
  purePlays: number;
  points: number;
  sales?: number;
  totalSales?: number;
  radioPoints?: number;
  streamPoints?: number;
  coverArt: string;
  peakRank: number;
  weeksOnChart: number;
  changePct?: number | null;
  isHotShotDebut?: boolean;
  isGreatestGainer?: boolean;
  isLocked?: boolean;
  isManuallyEdited?: boolean;
  certification?: PlaqueMilestone | null;
  firstListened?: number;
  lastListened?: number;
  _key: string;
}

export interface ArtistChartItem {
  rank: number;
  previousRank?: number;
  lastRank?: number | null;
  moveDiff?: number;
  moveStatus: MoveStatus;
  artist: string;
  playCount: number;
  purePlays: number;
  points: number;
  sales?: number;
  totalSales?: number;
  trackCount: number;
  coverArt: string;
  peakRank: number;
  weeksOnChart: number;
  changePct?: number | null;
  isHotShotDebut?: boolean;
  isGreatestGainer?: boolean;
  isLocked?: boolean;
  isManuallyEdited?: boolean;
  topTracks?: { title: string; playCount: number }[];
  _key: string;
}

export interface AlbumChartItem {
  rank: number;
  previousRank?: number;
  lastRank?: number | null;
  moveDiff?: number;
  moveStatus: MoveStatus;
  title: string;
  artist: string;
  playCount: number;
  purePlays: number;
  points: number;
  sales?: number;
  totalSales?: number;
  coverArt: string;
  peakRank: number;
  weeksOnChart: number;
  changePct?: number | null;
  isHotShotDebut?: boolean;
  isGreatestGainer?: boolean;
  isLocked?: boolean;
  isManuallyEdited?: boolean;
  tracksCount?: number;
  _key: string;
}

export interface PlaqueCertification {
  id: string;
  subjectTitle: string;
  subjectSubtitle: string;
  subjectType: SubjectType;
  coverArt?: string;
  milestone: PlaqueMilestone;
  threshold: number;
  scrobblesEarned: number;
  awardedDate: string;
  frameStyle: PlaqueFrameStyle;
  customEngraving?: string;
  isCustom?: boolean;
}

export interface DuplicateCluster {
  id: string;
  canonicalTitle: string;
  artist: string;
  variants: {
    originalTitle: string;
    playCount: number;
    sampleScrobbleId?: string;
  }[];
  totalCombinedPlays: number;
  isMerged: boolean;
  similarityScore?: number; // e.g. 98.8%
  matchReason?: string;
  confidenceTier?: 'exact' | 'very-high' | 'high';
}

export interface ListeningStats {
  totalScrobbles: number;
  uniqueTracks: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  totalListeningHours: number;
  peakHour: number; // 0 - 23
  peakDay: string;
  currentStreakDays: number;
  longestStreakDays: number;
  obscurityScore: number; // 0 - 100
  topGenre: string;
}

export interface HourlyHeatmapData {
  hour: number; // 0 - 23
  label: string;
  scrobbles: number;
  intensity: number; // 0 - 1
}

export interface DayOfWeekData {
  dayName: string;
  shortName: string;
  scrobbles: number;
  hours: number[]; // 24 values
}

export interface AIProfilerResult {
  personaTitle: string;
  personaDescription: string;
  archetype: string;
  obscurityIndex: number; // 0 to 100
  moodBreakdown: { mood: string; percentage: number; color: string }[];
  topSubgenres: string[];
  sonicCharacteristics: { label: string; value: number }[];
  curatorNotes: string;
  recommendedDiscoveries: { title: string; artist: string; reason: string }[];
}

export type ThemePresetId =
  | 'obsidian'
  | 'emerald'
  | 'sunset'
  | 'sapphire'
  | 'cyberpunk'
  | 'ruby';

export interface ThemeConfig {
  id: ThemePresetId | string;
  name: string;
  bgClass: string;
  cardBg: string;
  cardBorder: string;
  accentPrimary: string;
  accentSecondary: string;
  accentGradient: string;
  textMuted: string;
}

export type WidgetType =
  | 'top-charts'
  | 'weekly-genre-charts'
  | 'plaque-wall'
  | 'track-combiner';

export interface WidgetConfig {
  id: WidgetType;
  title: string;
  enabled: boolean;
  width: 'full' | 'half';
}

export interface SyncProgressInfo {
  isSyncing: boolean;
  currentPage: number;
  totalPages: number;
  totalScrobbles: number;
  fetchedCount: number;
  percent: number;
  message: string;
}

export interface SamplePreset {
  id: string;
  name: string;
  username: string;
  tagline: string;
  avatar: string;
  tags: string[];
}
