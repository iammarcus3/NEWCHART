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
import { saveScrobblesToIndexedDB, loadScrobblesFromIndexedDB } from '../utils/localDb';
import { useAuth } from './AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface FetchLastfmOptions {
  customApiKey?: string;
  mode?: 'merge' | 'replace';
  onlyNewFriThuWeeks?: boolean;
  fromTimestamp?: number;
  toTimestamp?: number;
  maxPages?: number;
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
  uploadScrobbles: (scrobbles: Scrobble[], mode: 'replace' | 'merge') => void;
  isSyncingLastfm: boolean;
  syncProgress: SyncProgressInfo | null;
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
  pullLatestFromCloud: () => Promise<{ success: boolean; error?: string }>;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    return localStorage.getItem('yourhot100_active_preset') || 'lastfm';
  });

  const [lastfmUsername, setLastfmUsernameState] = useState<string>(() => {
    return localStorage.getItem('yourhot100_lastfm_username') || 'iammarcus3';
  });

  const [activeUsername, setActiveUsername] = useState<string>(() => {
    const savedLastfm = localStorage.getItem('yourhot100_lastfm_username');
    if (savedLastfm) return savedLastfm;
    return localStorage.getItem('yourhot100_active_username') || 'iammarcus3';
  });

  const setLastfmUsername = (username: string) => {
    const clean = username.trim().replace(/^@/, '');
    setLastfmUsernameState(clean);
    if (clean) {
      localStorage.setItem('yourhot100_lastfm_username', clean);
      setActiveUsername(clean);
      localStorage.setItem('yourhot100_active_username', clean);
    } else {
      localStorage.removeItem('yourhot100_lastfm_username');
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
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);
  const isInitialCloudLoadRef = useRef(false);

  // Friday Weekly Auto-Sync State
  const [autoSyncFridayWeeks, setAutoSyncFridayWeeks] = useState<boolean>(() => {
    const saved = localStorage.getItem('yourhot100_auto_friday_sync');
    return saved !== null ? saved === 'true' : true;
  });

  const [lastWeeklyFridaySync, setLastWeeklyFridaySync] = useState<string | null>(() => {
    return localStorage.getItem('yourhot100_last_friday_sync') || null;
  });

  // ZeroCharts Settings State
  const [zeroSettings, setZeroSettings] = useState<ZeroChartSettings>(() => {
    const saved =
      localStorage.getItem('yourhot100_zero_settings') ||
      localStorage.getItem('groovevault_zero_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_ZERO_SETTINGS, ...parsed };
      } catch (e) {}
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

  // Scrobble collection (Clean default: no mock/sample data by default)
  const [scrobbles, setScrobbles] = useState<Scrobble[]>(() => {
    const saved =
      localStorage.getItem('yourhot100_scrobbles') ||
      localStorage.getItem('groovevault_scrobbles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isSample = parsed.some((s: any) => s.id?.startsWith('cyberpunk_') || s.id?.startsWith('sample_'));
          if (!isSample) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  // Track Merged Map for duplicates
  const [mergedMap, setMergedMap] = useState<Record<string, string>>(() => {
    const saved =
      localStorage.getItem('yourhot100_merged_map') ||
      localStorage.getItem('groovevault_merged_map');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Plaques (Clean default: empty until created or loaded)
  const [plaques, setPlaques] = useState<PlaqueCertification[]>(() => {
    const saved =
      localStorage.getItem('yourhot100_plaques') ||
      localStorage.getItem('groovevault_plaques');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // Weeks partitions (Strict Friday-to-Thursday tracking cycles)
  const allWeeks = useMemo(() => {
    return buildWeekPartitions(scrobbles);
  }, [scrobbles]);

  // Selected Week
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(() => {
    const saved =
      localStorage.getItem('yourhot100_selected_week') ||
      localStorage.getItem('groovevault_selected_week');
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

  // Startup: Load scrobbles from IndexedDB if available, and auto-sync/stream full Last.fm library
  const hasAutoSyncedRef = useRef(false);
  useEffect(() => {
    loadScrobblesFromIndexedDB().then((indexedScrobbles) => {
      if (indexedScrobbles && Array.isArray(indexedScrobbles) && indexedScrobbles.length > 0) {
        const isSample = indexedScrobbles.some((s: any) => s.id?.startsWith('cyberpunk_') || s.id?.startsWith('sample_'));
        if (!isSample) {
          setScrobbles(indexedScrobbles);
        }
      }
      // Automatically trigger live streaming sync for Last.fm user iammarcus3 to build complete history
      if (!hasAutoSyncedRef.current) {
        hasAutoSyncedRef.current = true;
        const targetUser = localStorage.getItem('yourhot100_lastfm_username') || 'iammarcus3';
        fetchLiveLastfm(targetUser, {
          customApiKey: 'ffea75249cb48c306c867ca176340e3f',
          mode: 'merge',
          onlyNewFriThuWeeks: false,
        });
      }
    });
  }, []);

  // Save to IndexedDB (and lightweight metadata to LocalStorage)
  useEffect(() => {
    saveScrobblesToIndexedDB(scrobbles);
  }, [scrobbles]);

  useEffect(() => {
    localStorage.setItem('yourhot100_active_preset', activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    localStorage.setItem('yourhot100_active_username', activeUsername);
  }, [activeUsername]);

  useEffect(() => {
    localStorage.setItem('yourhot100_merged_map', JSON.stringify(mergedMap));
  }, [mergedMap]);

  useEffect(() => {
    localStorage.setItem('yourhot100_plaques', JSON.stringify(plaques));
  }, [plaques]);

  useEffect(() => {
    localStorage.setItem('yourhot100_zero_settings', JSON.stringify(zeroSettings));
  }, [zeroSettings]);

  useEffect(() => {
    localStorage.setItem('yourhot100_selected_week', String(selectedWeekNumber));
  }, [selectedWeekNumber]);

  useEffect(() => {
    localStorage.setItem('yourhot100_auto_friday_sync', String(autoSyncFridayWeeks));
  }, [autoSyncFridayWeeks]);

  useEffect(() => {
    if (lastWeeklyFridaySync) {
      localStorage.setItem('yourhot100_last_friday_sync', lastWeeklyFridaySync);
    }
  }, [lastWeeklyFridaySync]);

  // Cloud Database Synchronization with Firebase
  const isPerformingSaveRef = useRef<boolean>(false);
  const lastCloudSyncTimeRef = useRef<string | null>(lastCloudSyncTime);

  useEffect(() => {
    lastCloudSyncTimeRef.current = lastCloudSyncTime;
  }, [lastCloudSyncTime]);

  const saveStateToFirestore = async (uid: string, stateToPersist: {
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
    isPerformingSaveRef.current = true;
    const CHUNK_SIZE = 300;
    const numChunks = Math.max(1, Math.ceil(stateToPersist.scrobbles.length / CHUNK_SIZE));
    const nowIso = new Date().toISOString();

    try {
      // 1. Write user profile document
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          userId: uid,
          email: user?.email || '',
          displayName: user?.displayName || '',
          photoURL: user?.photoURL || '',
          activeUsername: stateToPersist.activeUsername,
          activePresetId: stateToPersist.activePresetId,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      // 2. Write scrobble chunks
      const chunkPromises: Promise<any>[] = [];
      for (let i = 0; i < numChunks; i++) {
        const chunkItems = stateToPersist.scrobbles.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkDocRef = doc(db, 'users', uid, 'scrobble_chunks', `chunk_${i}`);
        chunkPromises.push(
          setDoc(chunkDocRef, {
            chunkIndex: i,
            chunkCount: chunkItems.length,
            items: chunkItems,
            updatedAt: nowIso,
          })
        );
      }
      await Promise.all(chunkPromises);

      // 3. Write master configuration document
      const masterDocRef = doc(db, 'users', uid, 'settings', 'data');
      await setDoc(masterDocRef, {
        userId: uid,
        activeUsername: stateToPersist.activeUsername,
        lastfmUsername: stateToPersist.lastfmUsername,
        activePresetId: stateToPersist.activePresetId,
        zeroSettings: stateToPersist.zeroSettings,
        mergedMap: stateToPersist.mergedMap,
        plaques: stateToPersist.plaques,
        autoSyncFridayWeeks: stateToPersist.autoSyncFridayWeeks,
        lastWeeklyFridaySync: stateToPersist.lastWeeklyFridaySync,
        totalScrobbles: stateToPersist.scrobbles.length,
        totalChunks: numChunks,
        updatedAt: nowIso,
      });

      lastCloudSyncTimeRef.current = nowIso;
      return nowIso;
    } finally {
      setTimeout(() => {
        isPerformingSaveRef.current = false;
      }, 500);
    }
  };

  const loadStateFromFirestore = async (uid: string): Promise<Record<string, any> | null> => {
    const masterDocRef = doc(db, 'users', uid, 'settings', 'data');
    const docSnap = await getDoc(masterDocRef);
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as Record<string, any>;
    let loadedScrobbles: Scrobble[] = [];

    const totalChunks = typeof data.totalChunks === 'number' ? data.totalChunks : 0;
    if (totalChunks > 0) {
      const chunkPromises: Promise<any>[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkDocRef = doc(db, 'users', uid, 'scrobble_chunks', `chunk_${i}`);
        chunkPromises.push(getDoc(chunkDocRef));
      }
      const chunkSnaps = await Promise.all(chunkPromises);
      for (const snap of chunkSnaps) {
        if (snap.exists()) {
          const cdata = snap.data();
          if (Array.isArray(cdata.items)) {
            loadedScrobbles.push(...cdata.items);
          }
        }
      }
    } else if (Array.isArray(data.scrobbles)) {
      loadedScrobbles = data.scrobbles;
    }

    return {
      ...data,
      scrobbles: loadedScrobbles,
    };
  };

  // Initial Load & Real-time Sync from Cloud on User Auth state change
  useEffect(() => {
    if (!user) {
      isInitialCloudLoadRef.current = false;
      return;
    }

    const settingsDocPath = `users/${user.uid}/settings/data`;
    let isCancelled = false;

    // Apply cloud data directly into state and local storage
    const applyCloudState = (cloudData: Record<string, any>) => {
      if (cloudData.scrobbles && Array.isArray(cloudData.scrobbles) && cloudData.scrobbles.length > 0) {
        setScrobbles(cloudData.scrobbles);
        saveScrobblesToIndexedDB(cloudData.scrobbles);
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
    };

    const initialLoad = async () => {
      setIsCloudSyncing(true);
      try {
        const cloudData = await loadStateFromFirestore(user.uid);

        if (!isCancelled && cloudData) {
          applyCloudState(cloudData);
        } else if (!isCancelled && !cloudData) {
          // Brand new cloud account without existing record: seed with current local state
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
      async (snapshot) => {
        if (!snapshot.exists() || isPerformingSaveRef.current) return;
        const sdata = snapshot.data();
        if (sdata && sdata.updatedAt && sdata.updatedAt !== lastCloudSyncTimeRef.current) {
          // Remote device made an update, reload fresh chunks
          try {
            const freshCloudData = await loadStateFromFirestore(user.uid);
            if (freshCloudData) {
              applyCloudState(freshCloudData);
            }
          } catch (e) {
            console.warn('Real-time multi-device sync update error:', e);
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

  // Debounced auto-save to Cloud whenever user makes local modifications while signed in
  useEffect(() => {
    if (!user || !isInitialCloudLoadRef.current) return;

    setIsCloudSynced(false);
    const timeoutId = setTimeout(async () => {
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
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, settingsDocPath);
      } finally {
        setIsCloudSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [user, scrobbles, plaques, zeroSettings, mergedMap, activeUsername, lastfmUsername, activePresetId, autoSyncFridayWeeks, lastWeeklyFridaySync]);

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
      handleFirestoreError(error, OperationType.WRITE, settingsDocPath);
      return { success: false, error: error?.message || 'Sync failed' };
    }
  };

  // Pull Latest Snapshot directly from Cloud (for multi-device reload)
  const pullLatestFromCloud = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Please sign in to pull from your cloud account.' };
    }

    setIsCloudSyncing(true);
    const settingsDocPath = `users/${user.uid}/settings/data`;
    try {
      const cloudData = await loadStateFromFirestore(user.uid);
      if (!cloudData) {
        setIsCloudSyncing(false);
        return { success: false, error: 'No existing cloud data found for this account.' };
      }

      if (cloudData.scrobbles && Array.isArray(cloudData.scrobbles)) {
        setScrobbles(cloudData.scrobbles);
        saveScrobblesToIndexedDB(cloudData.scrobbles);
      }
      if (cloudData.plaques && Array.isArray(cloudData.plaques)) {
        setPlaques(cloudData.plaques);
      }
      if (cloudData.zeroSettings && typeof cloudData.zeroSettings === 'object') {
        setZeroSettings(cloudData.zeroSettings);
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
      setLastCloudSyncTime(cloudData.updatedAt || new Date().toISOString());
      setIsCloudSynced(true);
      setIsCloudSyncing(false);
      return { success: true };
    } catch (error: any) {
      setIsCloudSyncing(false);
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

  // Upload Scrobbles (via CSV / JSON file import) with immediate IndexedDB & Cloud write
  const uploadScrobbles = async (newItems: Scrobble[], mode: 'replace' | 'merge') => {
    let finalScrobbles: Scrobble[] = [];
    if (mode === 'replace') {
      finalScrobbles = newItems;
      setScrobbles(newItems);
      setActiveUsername('custom_import');
      setActivePresetId('custom');
      setMergedMap({});
      const weeks = buildWeekPartitions(newItems);
      setSelectedWeekNumber(weeks.length);
    } else {
      const { merged } = mergeScrobbleBatches(scrobbles, newItems);
      finalScrobbles = merged;
      setScrobbles(merged);
      const weeks = buildWeekPartitions(merged);
      setSelectedWeekNumber(weeks.length);
    }

    // Persist immediately to IndexedDB
    saveScrobblesToIndexedDB(finalScrobbles);

    // If user is authenticated, immediately persist to Firebase Cloud database
    if (user) {
      setIsCloudSyncing(true);
      const settingsDocPath = `users/${user.uid}/settings/data`;
      try {
        const savedIso = await saveStateToFirestore(user.uid, {
          activeUsername: mode === 'replace' ? 'custom_import' : activeUsername,
          lastfmUsername,
          activePresetId: mode === 'replace' ? 'custom' : activePresetId,
          zeroSettings,
          mergedMap: mode === 'replace' ? {} : mergedMap,
          scrobbles: finalScrobbles,
          plaques,
          autoSyncFridayWeeks,
          lastWeeklyFridaySync,
        });
        setIsCloudSynced(true);
        setLastCloudSyncTime(savedIso);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, settingsDocPath);
      } finally {
        setIsCloudSyncing(false);
      }
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
          const maxExistingTs = Math.max(...scrobbles.map((s) => s.timestamp));
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

      let timestamp = Math.floor(Date.now() / 1000);
      if (item.date?.uts) {
        timestamp = parseInt(item.date.uts, 10);
      } else if (item['@attr']?.nowplaying) {
        if (mergedOptions.onlyNewFriThuWeeks) return null;
        timestamp = Math.floor(Date.now() / 1000);
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
      for (let attempt = 0; attempt < 2; attempt++) {
        for (let kIdx = 0; kIdx < API_KEY_POOL.length; kIdx++) {
          const key = API_KEY_POOL[(keyOffset + kIdx) % API_KEY_POOL.length];
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
              rawTracks.push(...trackList);
            } else if (trackList && typeof trackList === 'object') {
              rawTracks.push(trackList);
            }

            return { rawTracks, totalPages, totalScrobbles };
          } catch {
            continue;
          }
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 200));
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
      const isFullSync = !mergedOptions.onlyNewFriThuWeeks;
      const maxPagesToFetch = mergedOptions.maxPages || (isFullSync ? totalPages : Math.min(totalPages, 15));

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

      // Step 2: Fetch remaining pages in concurrent chunks (8 concurrent page requests)
      if (maxPagesToFetch > 1) {
        const remainingPages: number[] = [];
        for (let p = 2; p <= maxPagesToFetch; p++) {
          remainingPages.push(p);
        }

        const CHUNK_SIZE = 8;
        for (let i = 0; i < remainingPages.length; i += CHUNK_SIZE) {
          const chunk = remainingPages.slice(i, i + CHUNK_SIZE);
          const chunkResults = await Promise.all(
            chunk.map((p, idx) => fetchPage(p, (i + idx) % API_KEY_POOL.length))
          );

          let hasTracksInChunk = false;
          for (const res of chunkResults) {
            if (res && res.rawTracks.length > 0) {
              hasTracksInChunk = true;
              for (const item of res.rawTracks) {
                const parsed = parseRawTrack(item, trackIndex++);
                if (parsed) accumulatedScrobbles.push(parsed);
              }
            }
          }

          const currentMaxPage = chunk[chunk.length - 1];
          const currentPercent = Math.min(100, Math.round((currentMaxPage / maxPagesToFetch) * 100));

          // Progressive Live UI State update after each chunk
          let currentList: Scrobble[] = [];
          if (mergedOptions.mode === 'replace') {
            currentList = [...accumulatedScrobbles];
            setScrobbles(currentList);
          } else {
            const { merged } = mergeScrobbleBatches(scrobbles, accumulatedScrobbles);
            currentList = merged;
            setScrobbles(merged);
          }

          const currentWeeks = buildWeekPartitions(currentList);
          setSyncProgress({
            isSyncing: true,
            currentPage: currentMaxPage,
            totalPages: maxPagesToFetch,
            totalScrobbles: totalScrobbles || accumulatedScrobbles.length,
            fetchedCount: accumulatedScrobbles.length,
            percent: currentPercent,
            message: `Building chart history for @${cleanUsername} (Page ${currentMaxPage} of ${maxPagesToFetch} • ${accumulatedScrobbles.length.toLocaleString()} tracks synced • ${currentWeeks.length} weeks)...`,
          });

          // Save checkpoint to IndexedDB periodically
          if (i % 16 === 0) {
            saveScrobblesToIndexedDB(accumulatedScrobbles);
          }

          if (!hasTracksInChunk) {
            break; // reached end of scrobbles
          }

          // Gentle delay between concurrent chunks
          await new Promise((resolve) => setTimeout(resolve, 40));
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

      // Cloud sync if authenticated
      if (user) {
        setIsCloudSyncing(true);
        const settingsDocPath = `users/${user.uid}/settings/data`;
        try {
          const savedIso = await saveStateToFirestore(user.uid, {
            activeUsername: cleanUsername,
            lastfmUsername: cleanUsername,
            activePresetId: 'custom_lastfm',
            zeroSettings,
            mergedMap,
            scrobbles: finalScrobbles,
            plaques,
            autoSyncFridayWeeks,
            lastWeeklyFridaySync: nowIso,
          });
          setIsCloudSynced(true);
          setLastCloudSyncTime(savedIso);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, settingsDocPath);
        } finally {
          setIsCloudSyncing(false);
        }
      }

      setIsSyncingLastfm(false);
      setSyncProgress(null);
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
   * Checks every Friday whether new tracking week data needs to be pulled from Last.fm
   * and automatically adds newly recorded scrobbles to the existing cloud vault.
   */
  useEffect(() => {
    if (!autoSyncFridayWeeks) return;
    if (!activeUsername || SAMPLE_PRESETS.some((p) => p.username === activeUsername)) return;

    const checkAndSyncFriday = async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const currentFriMidnight = getPrecedingFridayMidnight(nowSec);

      // Check if last sync was before the current Friday midnight
      let shouldSync = false;
      if (!lastWeeklyFridaySync) {
        shouldSync = true;
      } else {
        const lastSyncSec = Math.floor(new Date(lastWeeklyFridaySync).getTime() / 1000);
        if (lastSyncSec < currentFriMidnight) {
          shouldSync = true;
        }
      }

      if (shouldSync) {
        console.log(`[yourhot100] Automatic Friday Week Sync running for @${activeUsername}...`);
        await syncNewFridayWeeks(activeUsername);
      }
    };

    // Run on initial load
    checkAndSyncFriday();

    // Check periodically (every 10 minutes)
    const interval = setInterval(checkAndSyncFriday, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoSyncFridayWeeks, activeUsername, lastWeeklyFridaySync]);

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
    return computeAlbumsChart(filteredScrobbles);
  }, [filteredScrobbles]);

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
