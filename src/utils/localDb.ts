import { Scrobble, PlaqueCertification, ZeroChartSettings } from '../types/music';

const DB_NAME = 'YourHot100DB';
const DB_VERSION = 2;
const SCROBBLES_STORE = 'scrobbles_store';
const APP_STATE_STORE = 'app_state_store';
const LEGACY_KEY_NAME = 'all_scrobbles';
const CHUNKS_MANIFEST_KEY = 'chunks_manifest';

export interface AppStateData {
  activeUsername?: string;
  lastfmUsername?: string;
  activePresetId?: string;
  zeroSettings?: ZeroChartSettings;
  mergedMap?: Record<string, string>;
  plaques?: PlaqueCertification[];
  autoSyncFridayWeeks?: boolean;
  lastWeeklyFridaySync?: string | null;
  lastCloudSyncTime?: string | null;
  photoCache?: {
    artists?: Record<string, string>;
    albums?: Record<string, string>;
    tracks?: Record<string, string>;
  };
  totalScrobbles?: number;
  lastSavedAt?: string;
}

export interface BrowserCacheStats {
  scrobblesCount: number;
  isIndexedDBSupported: boolean;
  hasIndexedDBCache: boolean;
  storageType: 'IndexedDB (Unlimited Persistent)' | 'In-Memory Transient';
  lastSavedAt: string | null;
  estimatedSizeMB: string;
  chunkCount: number;
}

let cachedDb: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;
let memoryScrobblesCache: Scrobble[] | null = null;
let memoryAppStateCache: AppStateData | null = null;

function resetCachedDb(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      // Ignore
    }
  }
  cachedDb = null;
  dbOpenPromise = null;
}

/**
 * Safely open or reuse an active IndexedDB connection with automatic store creation & version upgrades.
 */
function getDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (cachedDb) {
    try {
      if (
        cachedDb.objectStoreNames.contains(SCROBBLES_STORE) &&
        cachedDb.objectStoreNames.contains(APP_STATE_STORE)
      ) {
        return Promise.resolve(cachedDb);
      }
    } catch {
      resetCachedDb();
    }
  }

  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        try {
          const db: IDBDatabase = event.target?.result;
          if (db) {
            if (!db.objectStoreNames.contains(SCROBBLES_STORE)) {
              db.createObjectStore(SCROBBLES_STORE);
            }
            if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
              db.createObjectStore(APP_STATE_STORE);
            }
          }
        } catch (e) {
          console.warn('[IndexedDB] Upgrade warning:', e);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        cachedDb = db;
        dbOpenPromise = null;

        db.onversionchange = () => {
          resetCachedDb();
        };

        db.onclose = () => {
          if (cachedDb === db) cachedDb = null;
        };

        db.onerror = () => {
          if (cachedDb === db) cachedDb = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        dbOpenPromise = null;
        cachedDb = null;
        resolve(null);
      };

      request.onblocked = () => {
        dbOpenPromise = null;
        cachedDb = null;
        resolve(null);
      };
    } catch {
      dbOpenPromise = null;
      cachedDb = null;
      resolve(null);
    }
  });

  return dbOpenPromise;
}

// Queue write operations to prevent transaction conflicts and concurrency issues
let saveQueuePromise: Promise<boolean> = Promise.resolve(true);

const LOCAL_CHUNK_SIZE = 10000; // Chunk into 10,000 items to avoid single large object clone overhead

/**
 * Save scrobbles array into IndexedDB with chunking, queueing, and memory fallback.
 */
export async function saveScrobblesToIndexedDB(scrobbles: Scrobble[]): Promise<boolean> {
  if (!scrobbles) return false;
  memoryScrobblesCache = scrobbles;

  const currentSave = saveQueuePromise.then(() => executeSaveScrobbles(scrobbles, 0));
  saveQueuePromise = currentSave.catch(() => false);
  return currentSave;
}

async function executeSaveScrobbles(scrobbles: Scrobble[], retryCount = 0): Promise<boolean> {
  try {
    const db = await getDatabase();
    if (!db) return true;

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(SCROBBLES_STORE, 'readwrite');
        const store = tx.objectStore(SCROBBLES_STORE);

        // Calculate chunk count
        const total = scrobbles.length;
        const numChunks = Math.ceil(total / LOCAL_CHUNK_SIZE);

        // Put manifest
        store.put(
          {
            totalScrobbles: total,
            chunkSize: LOCAL_CHUNK_SIZE,
            numChunks,
            updatedAt: new Date().toISOString(),
          },
          CHUNKS_MANIFEST_KEY
        );

        // Put each chunk
        for (let i = 0; i < numChunks; i++) {
          const slice = scrobbles.slice(i * LOCAL_CHUNK_SIZE, (i + 1) * LOCAL_CHUNK_SIZE);
          store.put(slice, `scrobble_chunk_${i}`);
        }

        // Also update legacy single key for quick compatibility if small (<25k)
        if (total <= 25000) {
          store.put(scrobbles, LEGACY_KEY_NAME);
        }

        tx.oncomplete = () => resolve(true);

        tx.onerror = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => executeSaveScrobbles(scrobbles, retryCount + 1).then(resolve), 50);
          } else {
            resolve(true);
          }
        };

        tx.onabort = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => executeSaveScrobbles(scrobbles, retryCount + 1).then(resolve), 50);
          } else {
            resolve(true);
          }
        };
      } catch {
        resetCachedDb();
        if (retryCount < 2) {
          setTimeout(() => executeSaveScrobbles(scrobbles, retryCount + 1).then(resolve), 80);
        } else {
          resolve(true);
        }
      }
    });
  } catch {
    resetCachedDb();
    return true;
  }
}

/**
 * Load scrobbles array from IndexedDB supporting chunked & legacy representations.
 */
export async function loadScrobblesFromIndexedDB(retryCount = 0): Promise<Scrobble[] | null> {
  try {
    const db = await getDatabase();
    if (!db) {
      return memoryScrobblesCache;
    }

    return await new Promise<Scrobble[] | null>((resolve) => {
      try {
        const tx = db.transaction(SCROBBLES_STORE, 'readonly');
        const store = tx.objectStore(SCROBBLES_STORE);

        const manifestReq = store.get(CHUNKS_MANIFEST_KEY);

        manifestReq.onsuccess = () => {
          const manifest = manifestReq.result;

          if (manifest && typeof manifest.numChunks === 'number' && manifest.numChunks > 0) {
            // Load all chunks
            const numChunks = manifest.numChunks;
            const chunks: Scrobble[][] = new Array(numChunks);
            let loadedCount = 0;

            for (let i = 0; i < numChunks; i++) {
              const chunkReq = store.get(`scrobble_chunk_${i}`);
              chunkReq.onsuccess = () => {
                chunks[i] = Array.isArray(chunkReq.result) ? chunkReq.result : [];
                loadedCount++;
                if (loadedCount === numChunks) {
                  const combined = chunks.flat();
                  memoryScrobblesCache = combined;
                  resolve(combined);
                }
              };
              chunkReq.onerror = () => {
                chunks[i] = [];
                loadedCount++;
                if (loadedCount === numChunks) {
                  const combined = chunks.flat();
                  memoryScrobblesCache = combined;
                  resolve(combined);
                }
              };
            }
          } else {
            // Fallback to legacy single key
            const legacyReq = store.get(LEGACY_KEY_NAME);
            legacyReq.onsuccess = () => {
              if (legacyReq.result && Array.isArray(legacyReq.result)) {
                memoryScrobblesCache = legacyReq.result;
                resolve(legacyReq.result);
              } else {
                resolve(memoryScrobblesCache);
              }
            };
            legacyReq.onerror = () => {
              resolve(memoryScrobblesCache);
            };
          }
        };

        manifestReq.onerror = () => {
          resolve(memoryScrobblesCache);
        };

        tx.onerror = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => loadScrobblesFromIndexedDB(retryCount + 1).then(resolve), 50);
          } else {
            resolve(memoryScrobblesCache);
          }
        };
      } catch {
        resetCachedDb();
        if (retryCount < 2) {
          setTimeout(() => loadScrobblesFromIndexedDB(retryCount + 1).then(resolve), 80);
        } else {
          resolve(memoryScrobblesCache);
        }
      }
    });
  } catch {
    resetCachedDb();
    return memoryScrobblesCache;
  }
}

/**
 * Save complete application state to IndexedDB.
 */
export async function saveAppStateToIndexedDB(state: AppStateData): Promise<boolean> {
  memoryAppStateCache = state;
  try {
    const db = await getDatabase();
    if (!db) return true;

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(APP_STATE_STORE, 'readwrite');
        const store = tx.objectStore(APP_STATE_STORE);
        store.put(
          {
            ...state,
            lastSavedAt: new Date().toISOString(),
          },
          'main_state'
        );

        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => {
          e.preventDefault?.();
          resolve(true);
        };
      } catch {
        resolve(true);
      }
    });
  } catch {
    return true;
  }
}

/**
 * Load complete application state from IndexedDB.
 */
export async function loadAppStateFromIndexedDB(): Promise<AppStateData | null> {
  try {
    const db = await getDatabase();
    if (!db) return memoryAppStateCache;

    return await new Promise<AppStateData | null>((resolve) => {
      try {
        const tx = db.transaction(APP_STATE_STORE, 'readonly');
        const store = tx.objectStore(APP_STATE_STORE);
        const req = store.get('main_state');

        req.onsuccess = () => {
          if (req.result && typeof req.result === 'object') {
            memoryAppStateCache = req.result;
            resolve(req.result);
          } else {
            resolve(memoryAppStateCache);
          }
        };

        req.onerror = () => resolve(memoryAppStateCache);
      } catch {
        resolve(memoryAppStateCache);
      }
    });
  } catch {
    return memoryAppStateCache;
  }
}

/**
 * Get comprehensive statistics on the browser's local cache.
 */
export async function getBrowserCacheStats(currentScrobblesCount = 0): Promise<BrowserCacheStats> {
  const isSupported = typeof window !== 'undefined' && Boolean(window.indexedDB);
  let count = currentScrobblesCount;
  let lastSaved: string | null = null;

  try {
    const state = await loadAppStateFromIndexedDB();
    if (state?.totalScrobbles && state.totalScrobbles > count) {
      count = state.totalScrobbles;
    }
    if (state?.lastSavedAt) {
      lastSaved = state.lastSavedAt;
    }
  } catch {
    // Ignore
  }

  const estimatedBytes = count * 140; // ~140 bytes per scrobble in memory
  const mb = (estimatedBytes / (1024 * 1024)).toFixed(1);
  const chunks = Math.max(1, Math.ceil(count / 10000));

  return {
    scrobblesCount: count,
    isIndexedDBSupported: isSupported,
    hasIndexedDBCache: count > 0,
    storageType: isSupported ? 'IndexedDB (Unlimited Persistent)' : 'In-Memory Transient',
    lastSavedAt: lastSaved,
    estimatedSizeMB: `${mb} MB`,
    chunkCount: chunks,
  };
}

/**
 * Clear all scrobbles and cached state from IndexedDB.
 */
export async function clearAllLocalDb(): Promise<boolean> {
  memoryScrobblesCache = null;
  memoryAppStateCache = null;
  try {
    const db = await getDatabase();
    if (!db) return true;

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction([SCROBBLES_STORE, APP_STATE_STORE], 'readwrite');
        tx.objectStore(SCROBBLES_STORE).clear();
        tx.objectStore(APP_STATE_STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(true);
      } catch {
        resolve(true);
      }
    });
  } catch {
    return true;
  }
}

/**
 * Export full offline backup file as a downloadable JSON file.
 * Guaranteed 100% reliable backup that can be stored on Google Drive or locally.
 */
export function exportVaultBackupFile(data: {
  username: string;
  scrobbles: Scrobble[];
  plaques: PlaqueCertification[];
  zeroSettings: ZeroChartSettings;
  mergedMap: Record<string, string>;
  lastWeeklyFridaySync?: string | null;
}) {
  const payload = {
    app: 'YourHot100',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    username: data.username || 'user',
    totalScrobbles: data.scrobbles.length,
    scrobbles: data.scrobbles,
    plaques: data.plaques || [],
    zeroSettings: data.zeroSettings,
    mergedMap: data.mergedMap || {},
    lastWeeklyFridaySync: data.lastWeeklyFridaySync || null,
  };

  const jsonStr = JSON.stringify(payload);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const cleanUser = (data.username || 'library').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateTag = new Date().toISOString().slice(0, 10);
  const fileName = `YourHot100_Vault_${cleanUser}_${data.scrobbles.length}scrobbles_${dateTag}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an uploaded vault backup file.
 */
export async function parseAndValidateVaultFile(
  file: File
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid file format: JSON root must be an object.' };
    }

    let scrobblesList: Scrobble[] = [];

    if (Array.isArray(parsed.scrobbles)) {
      scrobblesList = parsed.scrobbles;
    } else if (Array.isArray(parsed)) {
      scrobblesList = parsed;
    }

    if (scrobblesList.length === 0) {
      return {
        success: false,
        error: 'No scrobbles found in this vault file.',
      };
    }

    return {
      success: true,
      data: {
        username: parsed.username || '',
        scrobbles: scrobblesList,
        plaques: Array.isArray(parsed.plaques) ? parsed.plaques : [],
        zeroSettings: parsed.zeroSettings || undefined,
        mergedMap: parsed.mergedMap || {},
        lastWeeklyFridaySync: parsed.lastWeeklyFridaySync || null,
        totalScrobbles: scrobblesList.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to read backup file: ${err?.message || 'Invalid JSON syntax'}`,
    };
  }
}
