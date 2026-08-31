import { Scrobble } from '../types/music';

const DB_NAME = 'YourHot100DB';
const DB_VERSION = 1;
const STORE_NAME = 'scrobbles_store';
const KEY_NAME = 'all_scrobbles';

let cachedDb: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

// In-memory fallback cache in case IndexedDB is temporarily unavailable or in private/sandboxed mode
let memoryScrobblesCache: Scrobble[] | null = null;

/**
 * Resets cached database references if connection is terminated.
 */
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
 * Safely open or reuse an active IndexedDB connection with automatic recovery.
 */
function getDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  // If we have a healthy cached connection, verify and return it
  if (cachedDb) {
    try {
      if (cachedDb.objectStoreNames.contains(STORE_NAME)) {
        return Promise.resolve(cachedDb);
      }
    } catch {
      resetCachedDb();
    }
  }

  // If already opening, wait for in-flight request
  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  dbOpenPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        try {
          const db = event.target?.result;
          if (db && !db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch {
          // Ignore
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

// Queue writes to ensure sequential execution and avoid transaction collisions
let saveQueuePromise: Promise<boolean> = Promise.resolve(true);

/**
 * Save scrobbles array into IndexedDB with queueing, retry logic, and memory cache backup.
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
    if (!db) return true; // Memory cache updated, treated as safe

    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(scrobbles, KEY_NAME);

        req.onsuccess = () => resolve(true);

        req.onerror = (e) => {
          e.preventDefault?.();
          resolve(true);
        };

        tx.onabort = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => {
              executeSave(scrobbles, retryCount + 1).then(resolve);
            }, 60);
          } else {
            resolve(true);
          }
        };

        tx.onerror = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => {
              executeSave(scrobbles, retryCount + 1).then(resolve);
            }, 60);
          } else {
            resolve(true);
          }
        };
      } catch {
        // Catches InvalidStateError: e.g. "Database is closing or hidden"
        resetCachedDb();
        if (retryCount < 2) {
          setTimeout(() => {
            executeSave(scrobbles, retryCount + 1).then(resolve);
          }, 80);
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

        req.onerror = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          resolve(memoryScrobblesCache);
        };

        tx.onabort = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => {
              loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
            }, 60);
          } else {
            resolve(memoryScrobblesCache);
          }
        };

        tx.onerror = (e) => {
          e.preventDefault?.();
          resetCachedDb();
          if (retryCount < 2) {
            setTimeout(() => {
              loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
            }, 60);
          } else {
            resolve(memoryScrobblesCache);
          }
        };
      } catch {
        resetCachedDb();
        if (retryCount < 2) {
          setTimeout(() => {
            loadScrobblesFromIndexedDB(retryCount + 1).then(resolve);
          }, 80);
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
        req.onerror = (e) => {
          e.preventDefault?.();
          resolve(true);
        };
        tx.onerror = (e) => {
          e.preventDefault?.();
          resolve(true);
        };
        tx.onabort = (e) => {
          e.preventDefault?.();
          resolve(true);
        };
      } catch {
        resetCachedDb();
        resolve(true);
      }
    });
  } catch {
    resetCachedDb();
    return true;
  }
}
