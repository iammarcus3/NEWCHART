import { Scrobble } from '../types/music';

const DB_NAME = 'YourHot100DB';
const DB_VERSION = 1;
const STORE_NAME = 'scrobbles_store';
const KEY_NAME = 'all_scrobbles';

let cachedDb: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

// In-memory fallback cache in case IndexedDB is temporarily unavailable, hidden, or closing
let memoryScrobblesCache: Scrobble[] | null = null;

/**
 * Cleanly close active IndexedDB connection on backgrounding/hiding or unloading.
 */
function closeDbSafely(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      // ignore
    }
    cachedDb = null;
  }
  dbOpenPromise = null;
}

// Attach lifecycle listeners to gracefully release IndexedDB connection before browser suspends or closes it
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', closeDbSafely);
  window.addEventListener('beforeunload', closeDbSafely);
  window.addEventListener('visibilitychange', () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      closeDbSafely();
    }
  });
}

/**
 * Safely open or reuse an active IndexedDB connection with automatic reconnection
 * on connection closing, version changes, or tab visibility changes.
 */
function getDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  // If document is currently hidden or closing, avoid opening a new connection that will immediately fail
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    if (cachedDb) {
      try {
        if (cachedDb.objectStoreNames.contains(STORE_NAME)) {
          return Promise.resolve(cachedDb);
        }
      } catch {
        cachedDb = null;
      }
    }
    return Promise.resolve(null);
  }

  if (cachedDb) {
    try {
      // Test if connection is still usable and not closing
      if (!cachedDb.objectStoreNames.contains(STORE_NAME)) {
        closeDbSafely();
      } else {
        return Promise.resolve(cachedDb);
      }
    } catch {
      closeDbSafely();
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
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch {
          // ignore upgrade error in transient envs
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        cachedDb = db;
        dbOpenPromise = null;

        db.onversionchange = () => {
          closeDbSafely();
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

// Queue writes to ensure sequential execution and avoid transaction collisions when state updates rapidly
let saveQueuePromise: Promise<boolean> = Promise.resolve(true);

/**
 * Save scrobbles array into IndexedDB with queueing, retry logic, and closing/hidden recovery.
 */
export async function saveScrobblesToIndexedDB(scrobbles: Scrobble[]): Promise<boolean> {
  if (!scrobbles) return false;
  memoryScrobblesCache = scrobbles;

  // Queue write operation behind any currently in-flight writes
  const currentSave = saveQueuePromise.then(() => executeSave(scrobbles, 0));
  saveQueuePromise = currentSave.catch(() => false);
  return currentSave;
}

async function executeSave(scrobbles: Scrobble[], retryCount = 0): Promise<boolean> {
  // If page is hidden, rely on memory cache and avoid throwing invalid state errors
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return true;
  }

  try {
    const db = await getDatabase();
    if (!db) return true; // Memory cache updated, treated as successful

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(scrobbles, KEY_NAME);

        req.onsuccess = () => resolve(true);

        req.onerror = () => {
          resolve(true);
        };

        tx.onabort = () => {
          closeDbSafely();
          if (retryCount < 1 && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
            executeSave(scrobbles, retryCount + 1).then(resolve);
          } else {
            resolve(true);
          }
        };

        tx.onerror = () => {
          closeDbSafely();
          if (retryCount < 1 && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
            executeSave(scrobbles, retryCount + 1).then(resolve);
          } else {
            resolve(true);
          }
        };
      } catch (syncErr: any) {
        // Catches InvalidStateError: "A mutation operation was attempted on a database that is closing or hidden"
        closeDbSafely();
        if (retryCount < 1 && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
          setTimeout(() => {
            executeSave(scrobbles, retryCount + 1).then(resolve);
          }, 80);
        } else {
          resolve(true);
        }
      }
    });
  } catch {
    closeDbSafely();
    return true;
  }
}

/**
 * Load scrobbles array from IndexedDB with fallback to memory cache.
 */
export async function loadScrobblesFromIndexedDB(retryCount = 0): Promise<Scrobble[] | null> {
  try {
    const db = await getDatabase();
    if (!db) {
      return memoryScrobblesCache;
    }

    return await new Promise<Scrobble[] | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(KEY_NAME);

        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result)) {
            memoryScrobblesCache = req.result;
            resolve(req.result);
          } else {
            resolve(memoryScrobblesCache);
          }
        };

        req.onerror = () => {
          closeDbSafely();
          resolve(memoryScrobblesCache);
        };

        tx.onabort = () => {
          closeDbSafely();
          if (retryCount < 1 && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          } else {
            resolve(memoryScrobblesCache);
          }
        };

        tx.onerror = () => {
          closeDbSafely();
          if (retryCount < 1 && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          } else {
            resolve(memoryScrobblesCache);
          }
        };
      } catch {
        closeDbSafely();
        if (retryCount < 1 && typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
          setTimeout(() => {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          }, 80);
        } else {
          resolve(memoryScrobblesCache);
        }
      }
    });
  } catch {
    closeDbSafely();
    return memoryScrobblesCache;
  }
}

/**
 * Clear scrobbles from IndexedDB
 */
export async function clearScrobblesFromIndexedDB(): Promise<boolean> {
  memoryScrobblesCache = null;
  try {
    const db = await getDatabase();
    if (!db) return true;

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(KEY_NAME);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(true);
        tx.onerror = () => resolve(true);
        tx.onabort = () => resolve(true);
      } catch {
        closeDbSafely();
        resolve(true);
      }
    });
  } catch {
    closeDbSafely();
    return true;
  }
}
