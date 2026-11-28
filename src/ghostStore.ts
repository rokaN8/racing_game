// The Ghost store over IndexedDB (docs/game-spec.md → Storage): one database, `neon-racer`, with one object store,
// `ghosts`, keyed by the Track's storage key. Typed arrays are stored as they are (structured clone). The database is
// opened on first use, so a Track that's never raced costs nothing. Every failure ends as no Ghost (get undefined,
// put false), never a throw: IndexedDB missing or blocked (open() throws in Firefox and WebKit, fails later in Chrome),
// a transaction that aborts (QuotaExceededError at commit) or can't start.
import type { GhostStore, StoredGhost } from './ghost';

const DB = 'neon-racer', STORE = 'ghosts';

export function openGhostStore(idb: IDBFactory | null): GhostStore {
  let db: Promise<IDBDatabase | null> | null = null;
  // ponytail: no time-out. An open that never settles (an old WebKit hang, a newer tab mid-upgrade) leaves the Ghosts
  // in memory only for the session, which is all a time-out would do.
  const open = () => db ??= new Promise(resolve => {
    try {
      const req = idb!.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => { const d = req.result; d.onversionchange = () => d.close(); resolve(d); }; // never block a newer tab's upgrade
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  // One request in its own transaction: done(request) once the transaction completes (the write has landed), else fail.
  function run<T>(mode: IDBTransactionMode, ask: (s: IDBObjectStore) => IDBRequest, done: (r: IDBRequest) => T, fail: T): Promise<T> {
    return open().then(d => new Promise<T>(resolve => {
      try {
        if (!d) return resolve(fail);
        const tx = d.transaction(STORE, mode), req = ask(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(done(req));
        tx.onabort = tx.onerror = () => resolve(fail);
      } catch { resolve(fail); }
    }));
  }
  return {
    get: key => run('readonly', s => s.get(key), r => r.result as unknown, undefined),
    put: (key, ghost: StoredGhost) => run('readwrite', s => s.put(ghost, key), () => true, false),
    delete: key => void run('readwrite', s => s.delete(key), () => true, false),
  };
}
