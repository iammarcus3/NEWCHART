import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  Scrobble,
  TrackChartItem,
  ArtistChartItem,
  AlbumChartItem,
  PlaqueCertification,
  DuplicateCluster,
  ListeningStats,
  TimeRangeFilter,
  AIProfilerResult,
  ZeroChartSettings,
  ChartWeekInfo,
  ManualChartOverride,
  SubjectType,
  SyncProgressInfo,
} from '../types/music';
import {
  SAMPLE_PRESETS,
  generateSampleScrobbles,
  INITIAL_DEFAULT_PLAQUES,
} from '../utils/sampleData';
import {
  filterScrobblesByTimeRange,
  computeTracksChart,
  computeArtistsChart,
  computeAlbumsChart,
  computeCircadianClockData,
  computeListeningStats,
  computeAIProfile,
} from '../utils/chartsEngine';
import {
  DEFAULT_ZERO_SETTINGS,
  buildWeekPartitions,
  getPrecedingFridayMidnight,
  computeWeeklyTrackChart,
  computeWeeklyArtistChart,
  computeWeeklyAlbumChart,
} from '../utils/weeklyChartEngine';
import { detectDuplicateClusters } from '../utils/trackCombiner';
import { mergeScrobbleBatches } from '../utils/mergeEngine';
import { parseTimestamp } from '../utils/scrobbleParser';
import { saveScrobblesToIndexedDB, loadScrobblesFromIndexedDB } from '../utils/localDb';
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageGetJSON,
  safeLocalStorageSetJSON,
  safeLocalStorageRemove,
} from '../utils/safeStorage';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';

export interface FetchLastfmOptions {
  customApiKey?: string;
  mode?: 'merge' | 'replace';
  onlyNewFriThuWeeks?: boolean;
  fromTimestamp?: number;
  toTimestamp?: number;
  maxPages?: number;
}

export interface CloudSyncProgressInfo {
  isSyncing: boolean;
  percent: number;
  stage: string;
  currentChunk?: number;
  totalChunks?: number;
  error?: string;
}

interface MusicContextType {
  allProcessedScrobbles: Scrobble[];
  filteredScrobbles: Scrobble[];
  timeRange: TimeRangeFilter;
  setTimeRange: (range: TimeRangeFilter) => void;
  activeUsername: string;
  lastfmUsername: string;
  setLastfmUsername: (username: string) => void;
  activePresetId: string;
  loadPreset: (presetId: string) => void;
  uploadScrobbles: (
    scrobbles: Scrobble[],
    mode: 'replace' | 'merge',
    onProgress?: (progress: { stage: string; percent: number; message: string }) => void
  ) => Promise<{ success: boolean; count: number; weeksCount: number; error?: string }>;
  isSyncingLastfm: boolean;
  syncProgress: SyncProgressInfo | null;
  cloudSyncProgress: CloudSyncProgressInfo | null;
  fetchLiveLastfm: (
    username: string,
    customApiKeyOrOptions?: string | FetchLastfmOptions,
    options?: FetchLastfmOptions
  ) => Promise<{ success: boolean; count?: number; added?: number; error?: string }>;
  tracksChart: TrackChartItem[];
  artistsChart: ArtistChartItem[];
  albumsChart: AlbumChartItem[];
  listeningStats: ListeningStats;
  duplicateClusters: DuplicateCluster[];
  mergedMap: Record<string, string>;
  mergeClusterVariants: (artist: string, canonicalTitle: string, variantTitles: string[]) => void;
  unmergeCluster: (artist: string, variantTitles: string[]) => void;
  mergeAllClusters: () => void;
  plaques: PlaqueCertification[];
  createCustomPlaque: (plaque: Omit<PlaqueCertification, 'id'>) => void;
  updatePlaque: (plaque: PlaqueCertification) => void;
  deletePlaque: (id: string) => void;
  aiProfile: AIProfilerResult;
  selectedDetailItem: { type: 'track' | 'artist' | 'album'; data: any } | null;
  setSelectedDetailItem: (item: { type: 'track' | 'artist' | 'album'; data: any } | null) => void;

  // ZeroCharts & Weekly Time-Machine Engine (Friday-to-Thursday cycles)
  zeroSettings: ZeroChartSettings;
  updateZeroSettings: (updates: Partial<ZeroChartSettings>) => void;
  resetZeroSettings: () => void;
  saveItemOverride: (override: ManualChartOverride) => void;
  removeItemOverride: (key: string) => void;
  toggleBlacklistKey: (key: string) => void;
  allWeeks: ChartWeekInfo[];
  selectedWeekNumber: number;
  setSelectedWeekNumber: (week: number) => void;
  stepWeek: (delta: number) => void;
  jumpToLatestWeek: () => void;
  currentWeekInfo: ChartWeekInfo | null;
  weeklyTracksChart: TrackChartItem[];
  weeklyArtistsChart: ArtistChartItem[];
  weeklyAlbumsChart: AlbumChartItem[];
  editingChartItem: { type: SubjectType; item: any } | null;
  setEditingChartItem: (item: { type: SubjectType; item: any } | null) => void;
  isChartSettingsOpen: boolean;
  setIsChartSettingsOpen: (open: boolean) => void;
  activeArtistProfile: string | null;
  setActiveArtistProfile: (artist: string | null) => void;
  openArtistProfile: (artist: string) => void;

  // Friday Auto-Sync & Cloud Account State
  autoSyncFridayWeeks: boolean;
  setAutoSyncFridayWeeks: (enabled: boolean) => void;
  lastWeeklyFridaySync: string | null;
  syncNewFridayWeeks: (usernameOverride?: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  isCloudSynced: boolean;
  isCloudSyncing: boolean;
  lastCloudSyncTime: string | null;
  manualCloudSync: () => Promise<{ success: boolean; error?: string }>;
  pullLatestFromCloud: () => Promise<{ success: boolean; count?: number; error?: string }>;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    return safeLocalStorageGet('yourhot100_active_preset') || 'lastfm';
  });

  const [lastfmUsername, setLastfmUsernameState] = useState<string>(() => {
    return safeLocalStorageGet('yourhot100_lastfm_username') || 'iammarcus3';
  });

  const [activeUsername, setActiveUsername] = useState<string>(() => {
    const savedLastfm = safeLocalStorageGet('yourhot100_lastfm_username');
    if (savedLastfm) return savedLastfm;
    return safeLocalStorageGet('yourhot100_active_username') || 'iammarcus3';
  });

  const setLastfmUsername = (username: string) => {
    const clean = username.trim().replace(/^@/, '');
    setLastfmUsernameState(clean);
    if (clean) {
      safeLocalStorageSet('yourhot100_lastfm_username', clean);
      setActiveUsername(clean);
      safeLocalStorageSet('yourhot100_active_username', clean);
    } else {
      safeLocalStorageRemove('yourhot100_lastfm_username');
    }
  };

  const [isSyncingLastfm, setIsSyncingLastfm] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressInfo | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [selectedDetailItem, setSelectedDetailItem] = useState<{
    type: 'track' | 'artist' | 'album';
    data: any;
  } | null>(null);

  // Cloud Sync State
  const [isCloudSynced, setIsCloudSynced] = useState(true);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncProgress, setCloudSyncProgress] = useState<CloudSyncProgressInfo | null>(null);
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);
  const isInitialCloudLoadRef = useRef(false);

  // Friday Weekly Auto-Sync State
  const [autoSyncFridayWeeks, setAutoSyncFridayWeeks] = useState<boolean>(() => {
    const saved = safeLocalStorageGet('yourhot100_auto_friday_sync');
    return saved !== null ? saved === 'true' : true;
  });

  const [lastWeeklyFridaySync, setLastWeeklyFridaySync] = useState<string | null>(() => {
    return safeLocalStorageGet('yourhot100_last_friday_sync');
  });

  // ZeroCharts Settings State
  const [zeroSettings, setZeroSettings] = useState<ZeroChartSettings>(() => {
    const saved =
      safeLocalStorageGetJSON<ZeroChartSettings>('yourhot100_zero_settings') ||
      safeLocalStorageGetJSON<ZeroChartSettings>('groovevault_zero_settings');
    if (saved && typeof saved === 'object') {
      return { ...DEFAULT_ZERO_SETTINGS, ...saved };
    }
    return DEFAULT_ZERO_SETTINGS;
  });

  const [editingChartItem, setEditingChartItem] = useState<{ type: SubjectType; item: any } | null>(null);
  const [isChartSettingsOpen, setIsChartSettingsOpen] = useState(false);
  const [activeArtistProfile, setActiveArtistProfile] = useState<string | null>(null);

  const openArtistProfile = (artist: string) => {
    if (artist && artist.trim().length > 0) {
      setActiveArtistProfile(artist.trim());
    }
  };

  // Scrobble collection (Clean default: never stored in localStorage to prevent 5MB browser quota crashes)
  const [scrobbles, setScrobbles] = useState<Scrobble[]>([]);

  // Track Merged Map for duplicates
  const [mergedMap, setMergedMap] = useState<Record<string, string>>(() => {
    return (
      safeLocalStorageGetJSON<Record<string, string>>('yourhot100_merged_map') ||
      safeLocalStorageGetJSON<Record<string, string>>('groovevault_merged_map') ||
      {}
    );
  });

  // Plaques (Clean default: empty until created or loaded)
  const [plaques, setPlaques] = useState<PlaqueCertification[]>(() => {
    const saved =
      safeLocalStorageGetJSON<PlaqueCertification[]>('yourhot100_plaques') ||
      safeLocalStorageGetJSON<PlaqueCertification[]>('groovevault_plaques');
    if (Array.isArray(saved)) return saved;
    return [];
  });

  // Weeks partitions (Strict Friday-to-Thursday tracking cycles)
  const allWeeks = useMemo(() => {
    return buildWeekPartitions(scrobbles);
  }, [scrobbles]);

  // Selected Week
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(() => {
    const saved =
      safeLocalStorageGet('yourhot100_selected_week') ||
      safeLocalStorageGet('groovevault_selected_week');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1) return parsed;
    }
    return 1;
  });

  // Keep selected week within bounds
  useEffect(() => {
    if (allWeeks.length > 0) {
      if (selectedWeekNumber > allWeeks.length || selectedWeekNumber < 1) {
        setSelectedWeekNumber(allWeeks.length);
      }
    }
  }, [allWeeks, selectedWeekNumber]);

  // Startup: Purge any legacy bulky scrobble strings from localStorage, then load from IndexedDB
  const isLoadedFromStorageRef = useRef(false);
  useEffect(() => {
    safeLocalStorageRemove('yourhot100_scrobbles');
    safeLocalStorageRemove('groovevault_scrobbles');

    loadScrobblesFromIndexedDB().then((indexedScrobbles) => {
      isLoadedFromStorageRef.current = true;
      if (indexedScrobbles && Array.isArray(indexedScrobbles) && indexedScrobbles.length > 0) {
        const isSample = indexedScrobbles.some((s: any) => s.id?.startsWith('cyberpunk_') || s.id?.startsWith('sample_'));
        if (!isSample) {
          setScrobbles(indexedScrobbles);
          const weeks = buildWeekPartitions(indexedScrobbles);
          if (weeks.length > 0) {
            setSelectedWeekNumber(weeks.length);
          }
          safeLocalStorageSet('yourhot100_library_synced', 'true');
        }
      }
    });
  }, []);

  // Save to IndexedDB (prevent saving empty array on startup before IndexedDB load completes)
  useEffect(() => {
    if (scrobbles.length > 0 || isLoadedFromStorageRef.current) {
      saveScrobblesToIndexedDB(scrobbles);
    }
  }, [scrobbles]);

  useEffect(() => {
    safeLocalStorageSet('yourhot100_active_preset', activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    safeLocalStorageSet('yourhot100_active_username', activeUsername);
  }, [activeUsername]);

  useEffect(() => {
    safeLocalStorageSetJSON('yourhot100_merged_map', mergedMap);
  }, [mergedMap]);

  useEffect(() => {
    safeLocalStorageSetJSON('yourhot100_plaques', plaques);
  }, [plaques]);

  useEffect(() => {
    safeLocalStorageSetJSON('yourhot100_zero_settings', zeroSettings);
  }, [zeroSettings]);

  useEffect(() => {
    safeLocalStorageSet('yourhot100_selected_week', String(selectedWeekNumber));
  }, [selectedWeekNumber]);

  useEffect(() => {
    safeLocalStorageSet('yourhot100_auto_friday_sync', String(autoSyncFridayWeeks));
  }, [autoSyncFridayWeeks]);

  useEffect(() => {
    if (lastWeeklyFridaySync) {
      safeLocalStorageSet('yourhot100_last_friday_sync', lastWeeklyFridaySync);
    }
  }, [lastWeeklyFridaySync]);

  // Cloud Database Synchronization with Firebase
  const isPerformingSaveRef = useRef<boolean>(false);
  const isApplyingCloudStateRef = useRef<boolean>(false);
  const lastCloudSyncTimeRef = useRef<string | null>(lastCloudSyncTime);
  const lastSavedFingerprintRef = useRef<string>('');
  const lastSavedScrobblesHashRef = useRef<string>('');

  useEffect(() => {
    lastCloudSyncTimeRef.current = lastCloudSyncTime;
  }, [lastCloudSyncTime]);

  /**
   * Deeply sanitizes any object or array so that no field contains `undefined`.
   * Firestore strictly rejects documents with `undefined` values (which causes "Unsupported field value: undefined").
   */
  const cleanForFirestore = (val: any): any => {
    if (val === undefined) {
      return null;
    }
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => cleanForFirestore(item));
    }
    const cleanObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        cleanObj[k] = cleanForFirestore(v);
      }
    }
    return cleanObj;
  };

  const getScrobblesHash = (list: Scrobble[]) => {
    if (!list || list.length === 0) return '0';
    return `${list.length}_${list[0]?.timestamp || 0}_${list[list.length - 1]?.timestamp || 0}`;
  };

  const computeStateFingerprint = (state: {
    activeUsername: string;
    lastfmUsername: string;
    activePresetId: string;
    zeroSettings: ZeroChartSettings;
    mergedMap: Record<string, string>;
    scrobbles: Scrobble[];
    plaques: PlaqueCertification[];
    autoSyncFridayWeeks: boolean;
    lastWeeklyFridaySync: string | null;
  }) => {
    const scrobbleHash = getScrobblesHash(state.scrobbles);
    return `${state.activeUsername}_${state.lastfmUsername}_${state.activePresetId}_${scrobbleHash}_${state.plaques.length}_${Object.keys(state.mergedMap).length}_${state.autoSyncFridayWeeks}_${state.lastWeeklyFridaySync || ''}`;
  };

  const retryOperation = async <T,>(
    fn: () => Promise<T>,
    maxRetries = 4,
    initialDelayMs = 300
  ): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, initialDelayMs * Math.pow(1.5, attempt)));
        }
      }
    }
    throw lastError;
  };

  // Lightweight update for master settings document without re-writing bulky scrobble chunks
  const saveSettingsOnlyToFirestore = async (
    uid: string,
    stateToPersist: {
      activeUsername: string;
      lastfmUsername: string;
      activePresetId: string;
      zeroSettings: ZeroChartSettings;
      mergedMap: Record<string, string>;
      scrobbles: Scrobble[];
      plaques: PlaqueCertification[];
      autoSyncFridayWeeks: boolean;
      lastWeeklyFridaySync: string | null;
    }
  ) => {
    const nowIso = new Date().toISOString();
    const masterDocRef = doc(db, 'users', uid, 'settings', 'data');
    const masterPayload = cleanForFirestore({
      userId: uid,
      activeUsername: stateToPersist.activeUsername || '',
      lastfmUsername: stateToPersist.lastfmUsername || '',
      activePresetId: stateToPersist.activePresetId || 'default',
      zeroSettings: stateToPersist.zeroSettings || DEFAULT_ZERO_SETTINGS,
      mergedMap: stateToPersist.mergedMap || {},
      plaques: stateToPersist.plaques || [],
      autoSyncFridayWeeks: Boolean(stateToPersist.autoSyncFridayWeeks),
      lastWeeklyFridaySync: stateToPersist.lastWeeklyFridaySync || null,
      totalScrobbles: stateToPersist.scrobbles.length,
      updatedAt: nowIso,
    });

    await retryOperation(() => setDoc(masterDocRef, masterPayload, { merge: true }));

    lastCloudSyncTimeRef.current = nowIso;
    lastSavedFingerprintRef.current = computeStateFingerprint(stateToPersist);
    return nowIso;
  };

  // Save full state snapshot to Firestore with high-performance concurrent chunking (2500 items per chunk)
  const saveStateToFirestore = async (
    uid: string,
    stateToPersist: {
      activeUsername: string;
      lastfmUsername: string;
      activePresetId: string;
      zeroSettings: ZeroChartSettings;
      mergedMap: Record<string, string>;
      scrobbles: Scrobble[];
      plaques: PlaqueCertification[];
      autoSyncFridayWeeks: boolean;
      lastWeeklyFridaySync: string | null;
    },
    onProgress?: (info: CloudSyncProgressInfo) => void
  ) => {
    isPerformingSaveRef.current = true;
    const CHUNK_SIZE = 2500;
    const totalScrobbles = stateToPersist.scrobbles.length;
    const numChunks = totalScrobbles > 0 ? Math.ceil(totalScrobbles / CHUNK_SIZE) : 0;
    const nowIso = new Date().toISOString();

    const reportProgress = (info: CloudSyncProgressInfo) => {
      setCloudSyncProgress(info);
      if (onProgress) onProgress(info);
    };

    reportProgress({
      isSyncing: true,
      percent: 5,
      stage: 'Preparing cloud vault snapshot...',
      currentChunk: 0,
      totalChunks: numChunks,
    });

    try {
      // 1. Write user profile document
      const userDocRef = doc(db, 'users', uid);
      const userProfilePayload = cleanForFirestore({
        userId: uid,
        email: user?.email || '',
        displayName: user?.displayName || '',
        photoURL: user?.photoURL || '',
        activeUsername: stateToPersist.activeUsername || '',
        activePresetId: stateToPersist.activePresetId || 'default',
        updatedAt: nowIso,
      });

      await retryOperation(() => setDoc(userDocRef, userProfilePayload, { merge: true }));

      // 2. Write scrobble chunks in parallel batches of 10 concurrent writes with retry
      if (numChunks > 0) {
        const BATCH_CONCURRENCY = 10;
        for (let i = 0; i < numChunks; i += BATCH_CONCURRENCY) {
          const batchEnd = Math.min(i + BATCH_CONCURRENCY, numChunks);
          const chunkWrites: Promise<any>[] = [];

          for (let j = i; j < batchEnd; j++) {
            const chunkItems = stateToPersist.scrobbles.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
            const chunkDocRef = doc(db, 'users', uid, 'scrobble_chunks', `chunk_${j}`);
            const cleanedItems = chunkItems.map((item, idx) => {
              const res: Record<string, any> = {
                id: item.id || `s_${item.timestamp || Math.floor(Date.now() / 1000)}_${idx}`,
                title: item.title || 'Untitled',
                artist: item.artist || 'Unknown Artist',
                timestamp: typeof item.timestamp === 'number' ? item.timestamp : Math.floor(Date.now() / 1000),
              };
              if (item.album) res.album = item.album;
              if (item.coverArt) res.coverArt = item.coverArt;
              return res;
            });

            chunkWrites.push(
              retryOperation(() =>
                setDoc(chunkDocRef, {
                  chunkIndex: j,
                  chunkCount: cleanedItems.length,
                  items: cleanedItems,
                  updatedAt: nowIso,
                })
              )
            );
          }

          await Promise.all(chunkWrites);

          const currentCompleted = Math.min(batchEnd, numChunks);
          const percent = Math.min(92, Math.round(10 + (currentCompleted / numChunks) * 82));
          reportProgress({
            isSyncing: true,
            percent,
            stage: `Writing cloud vault chunk ${currentCompleted} of ${numChunks} (${percent}%)...`,
            currentChunk: currentCompleted,
            totalChunks: numChunks,
          });

          // Brief delay between batches to keep networking smooth
          await new Promise((r) => setTimeout(r, 30));
        }
      }

      // 3. Write master configuration document (deeply sanitized)
      reportProgress({
        isSyncing: true,
        percent: 95,
        stage: 'Finalizing cloud vault index & settings...',
        currentChunk: numChunks,
        totalChunks: numChunks,
      });

      const masterDocRef = doc(db, 'users', uid, 'settings', 'data');
      const masterPayload = cleanForFirestore({
        userId: uid,
        activeUsername: stateToPersist.activeUsername || '',
        lastfmUsername: stateToPersist.lastfmUsername || '',
        activePresetId: stateToPersist.activePresetId || 'default',
        zeroSettings: stateToPersist.zeroSettings || DEFAULT_ZERO_SETTINGS,
        mergedMap: stateToPersist.mergedMap || {},
        plaques: stateToPersist.plaques || [],
        autoSyncFridayWeeks: Boolean(stateToPersist.autoSyncFridayWeeks),
        lastWeeklyFridaySync: stateToPersist.lastWeeklyFridaySync || null,
        totalScrobbles: totalScrobbles,
        totalChunks: numChunks,
        updatedAt: nowIso,
      });

      await retryOperation(() => setDoc(masterDocRef, masterPayload));

      lastCloudSyncTimeRef.current = nowIso;
      lastSavedFingerprintRef.current = computeStateFingerprint(stateToPersist);
      lastSavedScrobblesHashRef.current = getScrobblesHash(stateToPersist.scrobbles);

      reportProgress({
        isSyncing: false,
        percent: 100,
        stage: `Cloud Vault snapshot (${totalScrobbles.toLocaleString()} scrobbles) successfully synchronized!`,
        currentChunk: numChunks,
        totalChunks: numChunks,
      });

      return nowIso;
    } catch (err: any) {
      reportProgress({
        isSyncing: false,
        percent: 100,
        stage: 'Cloud sync encountered network warning (local cache safe)',
        error: err?.message || 'Sync warning',
      });
      throw err;
    } finally {
      isPerformingSaveRef.current = false;
    }
  };

  // High-performance state loader from Firestore with parallel chunk fetching and fallbacks
  const loadStateFromFirestore = async (
    uid: string,
    onProgress?: (info: CloudSyncProgressInfo) => void
  ): Promise<Record<string, any> | null> => {
    const reportProgress = (stage: string, percent: number, currentChunk?: number, totalChunks?: number) => {
      const pInfo: CloudSyncProgressInfo = {
        isSyncing: true,
        percent,
        stage,
        currentChunk,
        totalChunks,
      };
      setCloudSyncProgress(pInfo);
      if (onProgress) onProgress(pInfo);
    };

    reportProgress('Reading cloud master settings...', 15);

    const masterDocRef = doc(db, 'users', uid, 'settings', 'data');
    const docSnap = await retryOperation(() => getDoc(masterDocRef));

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as Record<string, any>;
    let loadedScrobbles: Scrobble[] = [];

    const totalChunks = typeof data.totalChunks === 'number' ? data.totalChunks : 0;

    if (totalChunks > 0) {
      reportProgress(`Fetching ${totalChunks} scrobble chunks concurrently...`, 25, 0, totalChunks);

      // Fast parallel fetch of chunks in batches of 15
      const BATCH_READ_SIZE = 15;
      for (let i = 0; i < totalChunks; i += BATCH_READ_SIZE) {
        const batchEnd = Math.min(i + BATCH_READ_SIZE, totalChunks);
        const chunkPromises: Promise<any>[] = [];
        for (let j = i; j < batchEnd; j++) {
          const chunkDocRef = doc(db, 'users', uid, 'scrobble_chunks', `chunk_${j}`);
          chunkPromises.push(retryOperation(() => getDoc(chunkDocRef)));
        }

        const chunkSnaps = await Promise.all(chunkPromises);

        for (let idx = 0; idx < chunkSnaps.length; idx++) {
          const snap = chunkSnaps[idx];
          if (snap.exists()) {
            const cdata = snap.data();
            if (Array.isArray(cdata.items)) {
              for (let k = 0; k < cdata.items.length; k++) {
                loadedScrobbles.push(cdata.items[k]);
              }
            }
          }
        }

        const currentCompleted = Math.min(batchEnd, totalChunks);
        const pct = Math.min(90, Math.round(25 + (currentCompleted / totalChunks) * 65));
        reportProgress(
          `Loading scrobble chunks (${currentCompleted} of ${totalChunks})...`,
          pct,
          currentCompleted,
          totalChunks
        );
      }
    }

    // Fallback 1: Legacy format where scrobbles array was saved directly in master document
    if (loadedScrobbles.length === 0 && Array.isArray(data.scrobbles) && data.scrobbles.length > 0) {
      loadedScrobbles = data.scrobbles;
    }

    // Fallback 2: If chunks count was missing or unrecorded, scan chunks collection directly
    if (loadedScrobbles.length === 0) {
      try {
        const chunksColRef = collection(db, 'users', uid, 'scrobble_chunks');
        const chunksSnapshot = await retryOperation(() => getDocs(chunksColRef));
        if (!chunksSnapshot.empty) {
          const sortedDocs = chunksSnapshot.docs
            .map((d) => d.data())
            .sort((a: any, b: any) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

          for (const cdata of sortedDocs) {
            if (Array.isArray(cdata.items)) {
              for (let k = 0; k < cdata.items.length; k++) {
                loadedScrobbles.push(cdata.items[k]);
              }
            }
          }
        }
      } catch (e) {
        // Optional scan fallback
      }
    }

    reportProgress('Assembling scrobbles and chart settings...', 95);

    return {
      ...data,
      scrobbles: loadedScrobbles,
    };
  };

  // Unified helper to apply cloud data directly into state and local storage with safety guards
  const applyCloudState = (cloudData: Record<string, any>) => {
    isApplyingCloudStateRef.current = true;
    try {
      if (cloudData.scrobbles && Array.isArray(cloudData.scrobbles) && cloudData.scrobbles.length > 0) {
        setScrobbles(cloudData.scrobbles);
        saveScrobblesToIndexedDB(cloudData.scrobbles);
        safeLocalStorageSet('yourhot100_library_synced', 'true');
        const weeks = buildWeekPartitions(cloudData.scrobbles);
        if (weeks.length > 0) {
          setSelectedWeekNumber(weeks.length);
        }
      }
      if (cloudData.plaques && Array.isArray(cloudData.plaques)) {
        setPlaques(cloudData.plaques);
      }
      if (cloudData.zeroSettings && typeof cloudData.zeroSettings === 'object') {
        setZeroSettings((prev) => ({ ...prev, ...cloudData.zeroSettings }));
      }
      if (cloudData.mergedMap && typeof cloudData.mergedMap === 'object') {
        setMergedMap(cloudData.mergedMap);
      }
      if (cloudData.lastfmUsername) {
        setLastfmUsername(cloudData.lastfmUsername);
      }
      if (cloudData.activeUsername) {
        setActiveUsername(cloudData.activeUsername);
      }
      if (cloudData.activePresetId) {
        setActivePresetId(cloudData.activePresetId);
      }
      if (cloudData.lastWeeklyFridaySync) {
        setLastWeeklyFridaySync(cloudData.lastWeeklyFridaySync);
      }
      if (typeof cloudData.autoSyncFridayWeeks === 'boolean') {
        setAutoSyncFridayWeeks(cloudData.autoSyncFridayWeeks);
      }
      const updateIso = cloudData.updatedAt || new Date().toISOString();
      lastCloudSyncTimeRef.current = updateIso;
      setLastCloudSyncTime(updateIso);
      setIsCloudSynced(true);

      const combinedState = {
        activeUsername: cloudData.activeUsername || activeUsername,
        lastfmUsername: cloudData.lastfmUsername || lastfmUsername,
        activePresetId: cloudData.activePresetId || activePresetId,
        zeroSettings: cloudData.zeroSettings || zeroSettings,
        mergedMap: cloudData.mergedMap || mergedMap,
        scrobbles: cloudData.scrobbles || scrobbles,
        plaques: cloudData.plaques || plaques,
        autoSyncFridayWeeks: typeof cloudData.autoSyncFridayWeeks === 'boolean' ? cloudData.autoSyncFridayWeeks : autoSyncFridayWeeks,
        lastWeeklyFridaySync: cloudData.lastWeeklyFridaySync || lastWeeklyFridaySync,
      };

      lastSavedFingerprintRef.current = computeStateFingerprint(combinedState);
      lastSavedScrobblesHashRef.current = getScrobblesHash(combinedState.scrobbles);
    } finally {
      setTimeout(() => {
        isApplyingCloudStateRef.current = false;
      }, 600);
    }
  };

  // Initial Load & Real-time Sync from Cloud on User Auth state change
  useEffect(() => {
    if (!user) {
      isInitialCloudLoadRef.current = false;
      return;
    }

    const settingsDocPath = `users/${user.uid}/settings/data`;
    let isCancelled = false;

    const initialLoad = async () => {
      setIsCloudSyncing(true);
      try {
        const cloudData = await loadStateFromFirestore(user.uid);

        if (!isCancelled) {
          if (cloudData && Array.isArray(cloudData.scrobbles) && cloudData.scrobbles.length > 0) {
            // If local dataset is larger (e.g. user just uploaded or synced history before sign-in), merge & backup
            if (scrobbles.length > cloudData.scrobbles.length) {
              const { merged } = mergeScrobbleBatches(cloudData.scrobbles, scrobbles);
              applyCloudState({
                ...cloudData,
                scrobbles: merged,
              });
              // Persist the combined dataset to Cloud Firestore
              const savedIso = await saveStateToFirestore(user.uid, {
                activeUsername: activeUsername || cloudData.activeUsername || 'custom_lastfm',
                lastfmUsername: lastfmUsername || cloudData.lastfmUsername || '',
                activePresetId: activePresetId || cloudData.activePresetId || 'custom_lastfm',
                zeroSettings: zeroSettings || cloudData.zeroSettings,
                mergedMap: { ...(cloudData.mergedMap || {}), ...(mergedMap || {}) },
                scrobbles: merged,
                plaques: plaques.length > 0 ? plaques : (cloudData.plaques || []),
                autoSyncFridayWeeks: typeof cloudData.autoSyncFridayWeeks === 'boolean' ? cloudData.autoSyncFridayWeeks : autoSyncFridayWeeks,
                lastWeeklyFridaySync: lastWeeklyFridaySync || cloudData.lastWeeklyFridaySync || null,
              });
              lastCloudSyncTimeRef.current = savedIso;
              setLastCloudSyncTime(savedIso);
              setIsCloudSynced(true);
            } else {
              applyCloudState(cloudData);
            }
          } else if (scrobbles.length > 0) {
            // Local data exists, cloud was empty: back up local data immediately to Cloud Firestore
            const savedIso = await saveStateToFirestore(user.uid, {
              activeUsername,
              lastfmUsername,
              activePresetId,
              zeroSettings,
              mergedMap,
              scrobbles,
              plaques,
              autoSyncFridayWeeks,
              lastWeeklyFridaySync,
            });
            lastCloudSyncTimeRef.current = savedIso;
            setLastCloudSyncTime(savedIso);
            setIsCloudSynced(true);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, settingsDocPath);
      } finally {
        if (!isCancelled) {
          setIsCloudSyncing(false);
          isInitialCloudLoadRef.current = true;
        }
      }
    };

    initialLoad();

    // Listen for Real-Time Changes across devices (e.g. updates from Device A detected on Device B)
    const masterDocRef = doc(db, 'users', user.uid, 'settings', 'data');
    const unsubscribe = onSnapshot(
      masterDocRef,
      { includeMetadataChanges: true },
      async (snapshot) => {
        // Ignore local pending writes or while current save/apply operation is in progress
        if (
          !snapshot.exists() ||
          snapshot.metadata.hasPendingWrites ||
          isPerformingSaveRef.current ||
          isApplyingCloudStateRef.current
        ) {
          return;
        }
        const sdata = snapshot.data();
        if (sdata && sdata.updatedAt && sdata.updatedAt !== lastCloudSyncTimeRef.current) {
          // Remote device made an update, reload fresh chunks
          try {
            const freshCloudData = await loadStateFromFirestore(user.uid);
            if (freshCloudData) {
              applyCloudState(freshCloudData);
            }
          } catch (e) {
            console.warn('Real-time multi-device sync update notice:', e);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, settingsDocPath);
      }
    );

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [user]);

  // Debounced auto-save to Cloud whenever user makes meaningful local modifications while signed in
  useEffect(() => {
    if (!user || !isInitialCloudLoadRef.current || isApplyingCloudStateRef.current || isPerformingSaveRef.current) {
      return;
    }

    const stateToPersist = {
      activeUsername,
      lastfmUsername,
      activePresetId,
      zeroSettings,
      mergedMap,
      scrobbles,
      plaques,
      autoSyncFridayWeeks,
      lastWeeklyFridaySync,
    };

    const currentFingerprint = computeStateFingerprint(stateToPersist);

    // Skip auto-save if state hasn't changed from what was loaded or previously saved
    if (currentFingerprint === lastSavedFingerprintRef.current) {
      return;
    }

    setIsCloudSynced(false);
    const timeoutId = setTimeout(async () => {
      if (isApplyingCloudStateRef.current || isPerformingSaveRef.current) return;
      setIsCloudSyncing(true);
      const settingsDocPath = `users/${user.uid}/settings/data`;
      try {
        const currentScrobblesHash = getScrobblesHash(scrobbles);
        const scrobblesChanged = currentScrobblesHash !== lastSavedScrobblesHashRef.current;

        let savedIso: string;
        if (scrobblesChanged) {
          savedIso = await saveStateToFirestore(user.uid, stateToPersist);
        } else {
          savedIso = await saveSettingsOnlyToFirestore(user.uid, stateToPersist);
        }

        setIsCloudSynced(true);
        setLastCloudSyncTime(savedIso);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, settingsDocPath);
      } finally {
        setIsCloudSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    user,
    scrobbles,
    plaques,
    zeroSettings,
    mergedMap,
    activeUsername,
    lastfmUsername,
    activePresetId,
    autoSyncFridayWeeks,
    lastWeeklyFridaySync,
  ]);

  // Manual Force Cloud Save
  const manualCloudSync = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Please sign in to save to your cloud account.' };
    }

    setIsCloudSyncing(true);
    const settingsDocPath = `users/${user.uid}/settings/data`;
    try {
      const savedIso = await saveStateToFirestore(user.uid, {
        activeUsername,
        lastfmUsername,
        activePresetId,
        zeroSettings,
        mergedMap,
        scrobbles,
        plaques,
        autoSyncFridayWeeks,
        lastWeeklyFridaySync,
      });
      setIsCloudSynced(true);
      setLastCloudSyncTime(savedIso);
      setIsCloudSyncing(false);
      return { success: true };
    } catch (error: any) {
      setIsCloudSyncing(false);
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn('Manual cloud sync notice:', errorMsg);
      handleFirestoreError(error, OperationType.WRITE, settingsDocPath);
      return { success: false, error: errorMsg || 'Sync failed' };
    }
  };

  // Pull Latest Snapshot directly from Cloud (for multi-device reload & fast restore)
  const pullLatestFromCloud = async (): Promise<{ success: boolean; count?: number; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Please sign in to pull from your cloud account.' };
    }

    setIsCloudSyncing(true);
    setCloudSyncProgress({
      isSyncing: true,
      percent: 15,
      stage: 'Connecting to Cloud Vault & retrieving snapshot...',
    });

    const settingsDocPath = `users/${user.uid}/settings/data`;
    try {
      const cloudData = await loadStateFromFirestore(user.uid, (p) => {
        setCloudSyncProgress(p);
      });

      if (!cloudData) {
        setIsCloudSyncing(false);
        setCloudSyncProgress(null);
        return { success: false, error: 'No existing cloud data found for this account.' };
      }

      setCloudSyncProgress({
        isSyncing: true,
        percent: 85,
        stage: `Restoring ${cloudData.scrobbles?.length || 0} scrobbles and chart settings...`,
      });

      applyCloudState(cloudData);

      setCloudSyncProgress({
        isSyncing: false,
        percent: 100,
        stage: 'Cloud Vault restored successfully!',
      });

      setIsCloudSyncing(false);
      return { success: true, count: cloudData.scrobbles?.length || 0 };
    } catch (error: any) {
      setIsCloudSyncing(false);
      setCloudSyncProgress(null);
      handleFirestoreError(error, OperationType.GET, settingsDocPath);
      return { success: false, error: error?.message || 'Restore failed' };
    }
  };

  // Load Sample Preset
  const loadPreset = (presetId: string) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setActivePresetId(presetId);
    setActiveUsername(preset.username);
    const newScrobbles = generateSampleScrobbles(presetId);
    setScrobbles(newScrobbles);
    saveScrobblesToIndexedDB(newScrobbles);
    setMergedMap({});
    const weeks = buildWeekPartitions(newScrobbles);
    setSelectedWeekNumber(weeks.length);
  };

  // Upload Scrobbles (via CSV / JSON file import) with async stages & immediate IndexedDB & Cloud write
  const uploadScrobbles = async (
    newItems: Scrobble[],
    mode: 'replace' | 'merge',
    onProgress?: (progress: { stage: string; percent: number; message: string }) => void
  ): Promise<{ success: boolean; count: number; weeksCount: number; error?: string }> => {
    try {
      if (onProgress) {
        onProgress({ stage: 'merging', percent: 20, message: 'Indexing & deduplicating history items...' });
      }
      await new Promise((r) => setTimeout(r, 10));

      let finalScrobbles: Scrobble[] = [];
      if (mode === 'replace') {
        finalScrobbles = newItems;
        setScrobbles(newItems);
        setActiveUsername('custom_import');
        setActivePresetId('custom');
        setMergedMap({});
      } else {
        const { merged } = mergeScrobbleBatches(scrobbles, newItems);
        finalScrobbles = merged;
        setScrobbles(merged);
      }

      if (onProgress) {
        onProgress({ stage: 'partitioning', percent: 45, message: 'Generating Friday-to-Thursday tracking cycles...' });
      }
      await new Promise((r) => setTimeout(r, 10));
      const weeks = buildWeekPartitions(finalScrobbles);
      setSelectedWeekNumber(weeks.length);

      if (onProgress) {
        onProgress({ stage: 'saving_local', percent: 70, message: 'Writing to persistent local vault cache...' });
      }
      await saveScrobblesToIndexedDB(finalScrobbles);

      // If user is authenticated, immediately persist to Firebase Cloud database with progress updates
      if (user) {
        if (onProgress) {
          onProgress({ stage: 'cloud_syncing', percent: 82, message: 'Backing up snapshot to Google Cloud Firestore...' });
        }
        setIsCloudSyncing(true);
        const settingsDocPath = `users/${user.uid}/settings/data`;
        try {
          const savedIso = await saveStateToFirestore(
            user.uid,
            {
              activeUsername: mode === 'replace' ? 'custom_import' : activeUsername,
              lastfmUsername,
              activePresetId: mode === 'replace' ? 'custom' : activePresetId,
              zeroSettings,
              mergedMap: mode === 'replace' ? {} : mergedMap,
              scrobbles: finalScrobbles,
              plaques,
              autoSyncFridayWeeks,
              lastWeeklyFridaySync,
            },
            (cloudInfo) => {
              if (onProgress) {
                onProgress({
                  stage: 'cloud_syncing',
                  percent: Math.min(98, 80 + Math.round((cloudInfo.percent / 100) * 18)),
                  message: cloudInfo.stage,
                });
              }
            }
          );
          setIsCloudSynced(true);
          setLastCloudSyncTime(savedIso);
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, settingsDocPath);
          console.warn('Cloud sync on upload notice:', err);
        } finally {
          setIsCloudSyncing(false);
        }
      }

      if (onProgress) {
        onProgress({ stage: 'completed', percent: 100, message: 'Import successfully completed!' });
      }
      return { success: true, count: finalScrobbles.length, weeksCount: weeks.length };
    } catch (e: any) {
      console.error('Failed to process upload scrobbles:', e);
      return { success: false, count: 0, weeksCount: 0, error: e?.message || 'Failed to process import.' };
    }
  };

  /**
   * Fetch Live Last.fm Scrobble Data with Fri-Thu Week Boundaries and Non-Overriding Merge Engine.
   */
  const fetchLiveLastfm = async (
    username: string,
    customApiKeyOrOptions?: string | FetchLastfmOptions,
    options?: FetchLastfmOptions
  ): Promise<{ success: boolean; count?: number; added?: number; error?: string }> => {
    setIsSyncingLastfm(true);

    const mergedOptions: FetchLastfmOptions =
      typeof customApiKeyOrOptions === 'object'
        ? { mode: 'merge', ...customApiKeyOrOptions }
        : { mode: 'merge', customApiKey: customApiKeyOrOptions, ...options };

    const API_KEY_POOL = Array.from(
      new Set([
        mergedOptions.customApiKey?.trim(),
        'ffea75249cb48c306c867ca176340e3f',
        '4a9f5581049ac2a4119a5505047b1553',
        'b25b959554ed76058ac220b7b2e0a026',
        'c0412ef176461a296b0266e74b34eb89',
      ])
    ).filter((k): k is string => Boolean(k && k.length > 5));

    // Calculate Friday-Thursday tracking week timestamps if requested
    let fromTs = mergedOptions.fromTimestamp;
    let toTs = mergedOptions.toTimestamp;

    if (mergedOptions.onlyNewFriThuWeeks) {
      const nowSec = Math.floor(Date.now() / 1000);
      const currentFriMidnight = getPrecedingFridayMidnight(nowSec);

      if (!fromTs) {
        if (scrobbles.length > 0) {
          let maxExistingTs = scrobbles[0].timestamp;
          for (let i = 1; i < scrobbles.length; i++) {
            if (scrobbles[i].timestamp > maxExistingTs) {
              maxExistingTs = scrobbles[i].timestamp;
            }
          }
          // Start from preceding Friday of highest scrobble
          fromTs = getPrecedingFridayMidnight(maxExistingTs);
        } else {
          // If no scrobbles, pull from previous Friday
          fromTs = currentFriMidnight - 7 * 86400;
        }
      }

      if (!toTs) {
        toTs = nowSec;
      }
    }

    const cleanUsername = username.trim().replace(/^@/, '');
    setLastfmUsername(cleanUsername);
    setActivePresetId('custom_lastfm');

    setSyncProgress({
      isSyncing: true,
      currentPage: 1,
      totalPages: 1,
      totalScrobbles: 0,
      fetchedCount: 0,
      percent: 0,
      message: `Connecting to Last.fm for @${cleanUsername}...`,
    });

    const parseRawTrack = (item: any, globalIdx: number): Scrobble | null => {
      const title = item.name;
      const artist = item.artist
        ? typeof item.artist === 'object'
          ? item.artist['#text'] || item.artist.name
          : item.artist
        : '';
      const album = item.album
        ? typeof item.album === 'object'
          ? item.album['#text'] || item.album.title
          : item.album
        : undefined;
      const image = Array.isArray(item.image)
        ? item.image.find((i: any) => i.size === 'extralarge' || i.size === 'large' || i.size === 'medium')?.['#text']
        : undefined;

      // Real recorded scrobbles on Last.fm have item.date.uts or parsed date string.
      // If a track is marked nowplaying without a recorded date, skip it so scrobble counts are 100% exact.
      let timestamp: number | null = null;
      if (item.date?.uts) {
        timestamp = parseInt(item.date.uts, 10);
      } else if (item.date?.['#text']) {
        timestamp = parseTimestamp(item.date['#text']);
      } else if (item.timestamp) {
        timestamp = parseTimestamp(item.timestamp);
      } else if (item['@attr']?.nowplaying) {
        // Ephemeral currently playing track is not a recorded scrobble yet
        return null;
      }

      if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
        return null;
      }

      if (fromTs && timestamp < fromTs) return null;
      if (toTs && timestamp > toTs) return null;

      if (title && artist) {
        return {
          id: `lastfm_live_${timestamp}_${globalIdx}`,
          title: String(title).trim(),
          artist: String(artist).trim(),
          album: album ? String(album).trim() : undefined,
          timestamp,
          coverArt: image && image.startsWith('http') ? image : undefined,
        };
      }
      return null;
    };

    const fetchPage = async (
      pageNum: number,
      keyOffset: number = 0
    ): Promise<{ rawTracks: any[]; totalPages: number; totalScrobbles: number } | null> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        for (let kIdx = 0; kIdx < API_KEY_POOL.length; kIdx++) {
          const key = API_KEY_POOL[(keyOffset + kIdx + attempt) % API_KEY_POOL.length];
          try {
            let apiUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
              cleanUsername
            )}&api_key=${key}&format=json&limit=200&page=${pageNum}`;

            if (fromTs) apiUrl += `&from=${fromTs}`;
            if (toTs) apiUrl += `&to=${toTs}`;

            const res = await fetch(apiUrl);
            const data = await res.json().catch(() => null);

            if (!res.ok || (data && data.error)) {
              continue;
            }

            const trackList = data?.recenttracks?.track;
            const totalPages = parseInt(data?.recenttracks?.['@attr']?.totalPages || '1', 10);
            const totalScrobbles = parseInt(data?.recenttracks?.['@attr']?.total || '0', 10);

            const rawTracks: any[] = [];
            if (Array.isArray(trackList)) {
              for (let k = 0; k < trackList.length; k++) {
                rawTracks.push(trackList[k]);
              }
            } else if (trackList && typeof trackList === 'object') {
              rawTracks.push(trackList);
            }

            return { rawTracks, totalPages, totalScrobbles };
          } catch {
            continue;
          }
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
      }
      return null;
    };

    try {
      // Step 1: Fetch Page 1 to ascertain totalPages and total scrobbles
      const page1Result = await fetchPage(1, 0);
      if (!page1Result || page1Result.rawTracks.length === 0) {
        setIsSyncingLastfm(false);
        setSyncProgress(null);
        return {
          success: false,
          error: `Could not retrieve scrobbles for Last.fm user "@${cleanUsername}". Please verify account spelling and ensure listening history is public.`,
        };
      }

      const totalPages = page1Result.totalPages;
      const totalScrobbles = page1Result.totalScrobbles;
      const maxPagesToFetch = mergedOptions.maxPages || totalPages;

      let trackIndex = 1;
      const accumulatedScrobbles: Scrobble[] = [];

      for (const item of page1Result.rawTracks) {
        const parsed = parseRawTrack(item, trackIndex++);
        if (parsed) accumulatedScrobbles.push(parsed);
      }

      // Progressive Live Update after Page 1
      if (mergedOptions.mode === 'replace') {
        setScrobbles([...accumulatedScrobbles]);
      } else {
        const { merged } = mergeScrobbleBatches(scrobbles, accumulatedScrobbles);
        setScrobbles(merged);
      }

      const initialWeeks = buildWeekPartitions(accumulatedScrobbles);
      setSyncProgress({
        isSyncing: true,
        currentPage: 1,
        totalPages: maxPagesToFetch,
        totalScrobbles: totalScrobbles || accumulatedScrobbles.length,
        fetchedCount: accumulatedScrobbles.length,
        percent: Math.min(100, Math.round((1 / maxPagesToFetch) * 100)),
        message: `Building chart history for @${cleanUsername} (Page 1 of ${maxPagesToFetch} • ${accumulatedScrobbles.length.toLocaleString()} tracks synced • ${initialWeeks.length} weeks)...`,
      });

      // Step 2: Fetch remaining pages in concurrent chunks with UI throttling and retry recovery
      if (maxPagesToFetch > 1) {
        const remainingPages: number[] = [];
        for (let p = 2; p <= maxPagesToFetch; p++) {
          remainingPages.push(p);
        }

        const CHUNK_SIZE = 5; // Balanced concurrency to prevent rate limits while maintaining high throughput
        let lastUiUpdate = Date.now();
        const failedPages: number[] = [];

        for (let i = 0; i < remainingPages.length; i += CHUNK_SIZE) {
          const chunk = remainingPages.slice(i, i + CHUNK_SIZE);
          const chunkResults = await Promise.all(
            chunk.map((p, idx) => fetchPage(p, (i + idx) % API_KEY_POOL.length))
          );

          let hasTracksInChunk = false;
          chunkResults.forEach((res, resIdx) => {
            const pageNum = chunk[resIdx];
            if (res && res.rawTracks && res.rawTracks.length > 0) {
              hasTracksInChunk = true;
              for (const item of res.rawTracks) {
                const parsed = parseRawTrack(item, trackIndex++);
                if (parsed) accumulatedScrobbles.push(parsed);
              }
            } else if (!res) {
              failedPages.push(pageNum);
            }
          });

          const currentMaxPage = chunk[chunk.length - 1];
          const currentPercent = Math.min(100, Math.round((currentMaxPage / maxPagesToFetch) * 100));

          // Throttle UI state updates to avoid freezing React rendering
          const now = Date.now();
          const isFinalChunk = i + CHUNK_SIZE >= remainingPages.length;
          if (now - lastUiUpdate > 1200 || isFinalChunk) {
            lastUiUpdate = now;
            setSyncProgress({
              isSyncing: true,
              currentPage: currentMaxPage,
              totalPages: maxPagesToFetch,
              totalScrobbles: totalScrobbles || accumulatedScrobbles.length,
              fetchedCount: accumulatedScrobbles.length,
              percent: currentPercent,
              message: `Syncing @${cleanUsername} (Page ${currentMaxPage} of ${maxPagesToFetch} • ${accumulatedScrobbles.length.toLocaleString()} tracks collected)...`,
            });
          }

          // Save checkpoint to IndexedDB periodically
          if (i % 25 === 0) {
            saveScrobblesToIndexedDB(accumulatedScrobbles);
          }

          // Gentle delay between concurrent chunks
          await new Promise((resolve) => setTimeout(resolve, 80));
        }

        // Retry any failed pages to guarantee 100% completeness
        if (failedPages.length > 0) {
          for (const failedPage of failedPages) {
            const retryRes = await fetchPage(failedPage, 2);
            if (retryRes && retryRes.rawTracks && retryRes.rawTracks.length > 0) {
              for (const item of retryRes.rawTracks) {
                const parsed = parseRawTrack(item, trackIndex++);
                if (parsed) accumulatedScrobbles.push(parsed);
              }
            }
          }
        }
      }

      // Step 3: Finalize all scrobbles and chronological sort
      let finalScrobbles: Scrobble[] = [];
      let totalAdded = 0;

      if (mergedOptions.mode === 'replace') {
        finalScrobbles = accumulatedScrobbles.sort((a, b) => b.timestamp - a.timestamp);
        setScrobbles(finalScrobbles);
        totalAdded = finalScrobbles.length;
      } else {
        const { merged, addedCount } = mergeScrobbleBatches(scrobbles, accumulatedScrobbles);
        finalScrobbles = merged;
        setScrobbles(merged);
        totalAdded = addedCount;
      }

      const weeks = buildWeekPartitions(finalScrobbles);
      setSelectedWeekNumber(weeks.length);

      // Save permanently to IndexedDB
      saveScrobblesToIndexedDB(finalScrobbles);

      const nowIso = new Date().toISOString();
      setLastWeeklyFridaySync(nowIso);

      // Instantly finish UI sync state so charts and tables render immediately
      setIsSyncingLastfm(false);
      setSyncProgress(null);

      // Asynchronously backup to Cloud Firestore without blocking the UI
      if (user) {
        setIsCloudSyncing(true);
        const settingsDocPath = `users/${user.uid}/settings/data`;
        saveStateToFirestore(user.uid, {
          activeUsername: cleanUsername,
          lastfmUsername: cleanUsername,
          activePresetId: 'custom_lastfm',
          zeroSettings,
          mergedMap,
          scrobbles: finalScrobbles,
          plaques,
          autoSyncFridayWeeks,
          lastWeeklyFridaySync: nowIso,
        })
          .then((savedIso) => {
            setIsCloudSynced(true);
            setLastCloudSyncTime(savedIso);
          })
          .catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, settingsDocPath);
          })
          .finally(() => {
            setIsCloudSyncing(false);
          });
      }

      return {
        success: true,
        count: accumulatedScrobbles.length,
        added: totalAdded,
      };
    } catch (err: any) {
      setIsSyncingLastfm(false);
      setSyncProgress(null);
      return {
        success: false,
        error: err.message || 'Error processing Last.fm scrobble data.',
      };
    }
  };

  /**
   * Pull New Friday-to-Thursday Tracking Week scrobbles and merge into existing dataset.
   */
  const syncNewFridayWeeks = async (
    usernameOverride?: string
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    const targetUser = usernameOverride || lastfmUsername || activeUsername;
    if (!targetUser || SAMPLE_PRESETS.some((p) => p.username === targetUser)) {
      return {
        success: false,
        error: 'Please connect a real Last.fm username to pull new Friday weeks.',
      };
    }

    return fetchLiveLastfm(targetUser, undefined, {
      mode: 'merge',
      onlyNewFriThuWeeks: true,
    });
  };

  /**
   * Automated Friday Week Sync Trigger:
   * Runs shortly after app initialization and periodically in the background (every 15 minutes)
   * to automatically harvest new completed Friday-to-Thursday tracking cycles.
   */
  useEffect(() => {
    if (!autoSyncFridayWeeks) return;
    const targetUser = lastfmUsername || activeUsername;
    if (!targetUser || SAMPLE_PRESETS.some((p) => p.username === targetUser)) return;

    const checkAndSyncFriday = async () => {
      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const currentFriMidnight = getPrecedingFridayMidnight(nowSec);

        let shouldSync = false;
        if (!lastWeeklyFridaySync) {
          shouldSync = true;
        } else {
          const lastSyncSec = Math.floor(new Date(lastWeeklyFridaySync).getTime() / 1000);
          if (lastSyncSec < currentFriMidnight || nowSec - lastSyncSec > 86400 * 3) {
            shouldSync = true;
          }
        }

        if (shouldSync) {
          console.log(`[yourhot100] Automatic Friday Week Sync running for @${targetUser}...`);
          await syncNewFridayWeeks(targetUser);
        }
      } catch (err) {
        console.warn('[yourhot100] Automatic Friday Sync background notice:', err);
      }
    };

    // Initial check 6 seconds after app startup
    const initialTimer = setTimeout(checkAndSyncFriday, 6000);
    // Check periodically in the background (every 15 minutes)
    const interval = setInterval(checkAndSyncFriday, 15 * 60 * 1000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [autoSyncFridayWeeks, activeUsername, lastfmUsername, lastWeeklyFridaySync]);

  // ZeroCharts Settings Actions
  const updateZeroSettings = (updates: Partial<ZeroChartSettings>) => {
    setZeroSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetZeroSettings = () => {
    setZeroSettings(DEFAULT_ZERO_SETTINGS);
  };

  const saveItemOverride = (override: ManualChartOverride) => {
    setZeroSettings((prev) => ({
      ...prev,
      manualOverrides: {
        ...prev.manualOverrides,
        [override.key]: override,
      },
    }));
  };

  const removeItemOverride = (key: string) => {
    setZeroSettings((prev) => {
      const updated = { ...prev.manualOverrides };
      delete updated[key];
      return { ...prev, manualOverrides: updated };
    });
  };

  const toggleBlacklistKey = (key: string) => {
    setZeroSettings((prev) => {
      const isBlocked = prev.blacklistedKeys.includes(key);
      return {
        ...prev,
        blacklistedKeys: isBlocked
          ? prev.blacklistedKeys.filter((k) => k !== key)
          : [...prev.blacklistedKeys, key],
      };
    });
  };

  // Step week navigation
  const stepWeek = (delta: number) => {
    if (allWeeks.length === 0) return;
    setSelectedWeekNumber((prev) => {
      const next = prev + delta;
      return Math.max(1, Math.min(allWeeks.length, next));
    });
  };

  const jumpToLatestWeek = () => {
    if (allWeeks.length > 0) {
      setSelectedWeekNumber(allWeeks.length);
    }
  };

  const currentWeekInfo = useMemo(() => {
    return allWeeks[selectedWeekNumber - 1] || allWeeks[allWeeks.length - 1] || null;
  }, [allWeeks, selectedWeekNumber]);

  // Derived Weekly Charts for the Selected Friday-to-Thursday Week
  const weeklyTracksChart = useMemo(() => {
    if (allWeeks.length === 0) return [];
    return computeWeeklyTrackChart(selectedWeekNumber, allWeeks, scrobbles, mergedMap, zeroSettings);
  }, [selectedWeekNumber, allWeeks, scrobbles, mergedMap, zeroSettings]);

  const weeklyArtistsChart = useMemo(() => {
    if (allWeeks.length === 0) return [];
    return computeWeeklyArtistChart(selectedWeekNumber, allWeeks, scrobbles, zeroSettings);
  }, [selectedWeekNumber, allWeeks, scrobbles, zeroSettings]);

  const weeklyAlbumsChart = useMemo(() => {
    if (allWeeks.length === 0) return [];
    return computeWeeklyAlbumChart(selectedWeekNumber, allWeeks, scrobbles, zeroSettings);
  }, [selectedWeekNumber, allWeeks, scrobbles, zeroSettings]);

  // Filtered Scrobbles for all-time / custom timeframe overview widgets
  const filteredScrobbles = useMemo(() => {
    return filterScrobblesByTimeRange(scrobbles, timeRange);
  }, [scrobbles, timeRange]);

  const tracksChart = useMemo(() => {
    return computeTracksChart(filteredScrobbles, mergedMap);
  }, [filteredScrobbles, mergedMap]);

  const artistsChart = useMemo(() => {
    return computeArtistsChart(filteredScrobbles);
  }, [filteredScrobbles]);

  const albumsChart = useMemo(() => {
    return computeAlbumsChart(filteredScrobbles, scrobbles);
  }, [filteredScrobbles, scrobbles]);

  const listeningStats = useMemo(() => {
    return computeListeningStats(filteredScrobbles);
  }, [filteredScrobbles]);

  const duplicateClusters = useMemo(() => {
    return detectDuplicateClusters(scrobbles, mergedMap);
  }, [scrobbles, mergedMap]);

  const aiProfile = useMemo(() => {
    return computeAIProfile(filteredScrobbles, artistsChart);
  }, [filteredScrobbles, artistsChart]);

  // Merge Cluster Variants
  const mergeClusterVariants = (artist: string, canonicalTitle: string, variantTitles: string[]) => {
    setMergedMap((prev) => {
      const updated = { ...prev };
      for (const vt of variantTitles) {
        updated[`${artist.toLowerCase()}:::${vt.toLowerCase()}`] = canonicalTitle;
      }
      return updated;
    });
  };

  const unmergeCluster = (artist: string, variantTitles: string[]) => {
    setMergedMap((prev) => {
      const updated = { ...prev };
      for (const vt of variantTitles) {
        delete updated[`${artist.toLowerCase()}:::${vt.toLowerCase()}`];
      }
      return updated;
    });
  };

  const mergeAllClusters = () => {
    setMergedMap((prev) => {
      const updated = { ...prev };
      for (const cluster of duplicateClusters) {
        for (const v of cluster.variants) {
          updated[`${cluster.artist.toLowerCase()}:::${v.originalTitle.toLowerCase()}`] = cluster.canonicalTitle;
        }
      }
      return updated;
    });
  };

  // Plaque CRUD
  const createCustomPlaque = (data: Omit<PlaqueCertification, 'id'>) => {
    const newPlaque: PlaqueCertification = {
      ...data,
      id: `plaque_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setPlaques((prev) => [newPlaque, ...prev]);
  };

  const updatePlaque = (updated: PlaqueCertification) => {
    setPlaques((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const deletePlaque = (id: string) => {
    setPlaques((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <MusicContext.Provider
      value={{
        allProcessedScrobbles: scrobbles,
        filteredScrobbles,
        timeRange,
        setTimeRange,
        activeUsername,
        lastfmUsername,
        setLastfmUsername,
        activePresetId,
        loadPreset,
        uploadScrobbles,
        isSyncingLastfm,
        syncProgress,
        cloudSyncProgress,
        fetchLiveLastfm,
        tracksChart,
        artistsChart,
        albumsChart,
        listeningStats,
        duplicateClusters,
        mergedMap,
        mergeClusterVariants,
        unmergeCluster,
        mergeAllClusters,
        plaques,
        createCustomPlaque,
        updatePlaque,
        deletePlaque,
        aiProfile,
        selectedDetailItem,
        setSelectedDetailItem,
        zeroSettings,
        updateZeroSettings,
        resetZeroSettings,
        saveItemOverride,
        removeItemOverride,
        toggleBlacklistKey,
        allWeeks,
        selectedWeekNumber,
        setSelectedWeekNumber,
        stepWeek,
        jumpToLatestWeek,
        currentWeekInfo,
        weeklyTracksChart,
        weeklyArtistsChart,
        weeklyAlbumsChart,
        editingChartItem,
        setEditingChartItem,
        isChartSettingsOpen,
        setIsChartSettingsOpen,
        activeArtistProfile,
        setActiveArtistProfile,
        openArtistProfile,
        autoSyncFridayWeeks,
        setAutoSyncFridayWeeks,
        lastWeeklyFridaySync,
        syncNewFridayWeeks,
        isCloudSynced,
        isCloudSyncing,
        lastCloudSyncTime,
        manualCloudSync,
        pullLatestFromCloud,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error('useMusic must be used within a MusicProvider');
  return context;
};
