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
 * Safely open or reuse an active IndexedDB connection with automatic reconnection
 * on connection closing, version changes, or tab visibility changes.
 */
function getDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (cachedDb) {
    try {
      // Test if connection is still usable and not closing
      if (!cachedDb.objectStoreNames.contains(STORE_NAME)) {
        cachedDb.close();
        cachedDb = null;
      } else {
        return Promise.resolve(cachedDb);
      }
    } catch {
      cachedDb = null;
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
        } catch (e) {
          console.warn('IndexedDB upgrade error:', e);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        cachedDb = db;
        dbOpenPromise = null;

        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            // ignore
          }
          if (cachedDb === db) cachedDb = null;
        };

        db.onclose = () => {
          if (cachedDb === db) cachedDb = null;
        };

        db.onerror = () => {
          if (cachedDb === db) cachedDb = null;
        };

        resolve(db);
      };

      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e);
        dbOpenPromise = null;
        cachedDb = null;
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked by another tab/process');
        dbOpenPromise = null;
        cachedDb = null;
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
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
  try {
    const db = await getDatabase();
    if (!db) return false;

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(scrobbles, KEY_NAME);

        req.onsuccess = () => resolve(true);

        req.onerror = (e) => {
          console.warn('IndexedDB store.put request error:', e);
          resolve(false);
        };

        tx.onabort = () => {
          cachedDb = null;
          if (retryCount < 1) {
            // Retry once with a freshly opened connection
            executeSave(scrobbles, retryCount + 1).then(resolve);
          } else {
            resolve(false);
          }
        };

        tx.onerror = () => {
          cachedDb = null;
          if (retryCount < 1) {
            executeSave(scrobbles, retryCount + 1).then(resolve);
          } else {
            resolve(false);
          }
        };
      } catch (syncErr: any) {
        // Catches InvalidStateError: "A mutation operation was attempted on a database that is closing or hidden"
        console.warn('IndexedDB transaction sync error (database closing or hidden):', syncErr);
        cachedDb = null;
        if (retryCount < 1) {
          // Delay briefly and retry with refreshed connection
          setTimeout(() => {
            executeSave(scrobbles, retryCount + 1).then(resolve);
          }, 100);
        } else {
          resolve(false);
        }
      }
    });
  } catch (err) {
    console.warn('IndexedDB save execution error:', err);
    cachedDb = null;
    return false;
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
          cachedDb = null;
          resolve(memoryScrobblesCache);
        };

        tx.onabort = () => {
          cachedDb = null;
          if (retryCount < 1) {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          } else {
            resolve(memoryScrobblesCache);
          }
        };

        tx.onerror = () => {
          cachedDb = null;
          if (retryCount < 1) {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          } else {
            resolve(memoryScrobblesCache);
          }
        };
      } catch (syncErr) {
        console.warn('IndexedDB load sync error (database closing or hidden):', syncErr);
        cachedDb = null;
        if (retryCount < 1) {
          setTimeout(() => {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          }, 100);
        } else {
          resolve(memoryScrobblesCache);
        }
      }
    });
  } catch (err) {
    console.warn('IndexedDB load error:', err);
    cachedDb = null;
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
        req.onerror = () => resolve(false);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        console.warn('IndexedDB clear sync error:', err);
        cachedDb = null;
        resolve(false);
      }
    });
  } catch (err) {
    console.warn('IndexedDB clear error:', err);
    cachedDb = null;
    return false;
  }
}
