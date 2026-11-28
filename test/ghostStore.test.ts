// The Ghost store over IndexedDB (docs/game-spec.md → Storage), on fake-indexeddb, plus hand-made fakes for the ways a
// blocked or broken IndexedDB fails: each must end as "no Ghost" (get undefined, put false) and never throw.
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openGhostStore } from '../src/ghostStore';

const GHOST = { time: 40, date: 1, poses: Float32Array.from([1, 2, 3, 4, 5, 6, 7]), splits: [0], dist: Float32Array.from([0, 0, 100, 40]) };

describe('Ghost store', () => {
  it('keeps a Ghost per key, typed arrays and all, until it is deleted', async () => {
    const store = openGhostStore(new IDBFactory());
    expect(await store.put('neon-racer.track.a.v1', GHOST)).toBe(true);
    const back = await store.get('neon-racer.track.a.v1') as typeof GHOST;
    expect(back.poses).toBeInstanceOf(Float32Array);
    expect([...back.poses]).toEqual([...GHOST.poses]);
    expect([...back.dist]).toEqual([...GHOST.dist]);
    expect(back).toMatchObject({ time: 40, date: 1, splits: [0] });
    expect(await store.get('neon-racer.track.b.v1')).toBeUndefined();
    store.delete('neon-racer.track.a.v1');
    expect(await store.get('neon-racer.track.a.v1')).toBeUndefined();
  });

  it('opens nothing until it is first used', () => {
    let opened = 0;
    const idb = new IDBFactory(), open = idb.open.bind(idb);
    idb.open = (...a: Parameters<IDBFactory['open']>) => { opened++; return open(...a); };
    const store = openGhostStore(idb);
    expect(opened).toBe(0);
    void store.get('k');
    expect(opened).toBe(1);
  });

  describe('ends as no Ghost, never throwing, when IndexedDB', () => {
    // An open request that succeeds with `db`, a stand-in database.
    const opening = (db: object) => ({ open() { const req: Record<string, unknown> = { result: db }; setTimeout(() => (req.onsuccess as () => void)?.()); return req; } });
    // A database whose transactions all end by `how`: an abort (e.g. QuotaExceededError at commit) or a throw (closing).
    const failing = (how: 'abort' | 'throw') => ({
      transaction() {
        if (how === 'throw') throw new DOMException('The database connection is closing.', 'InvalidStateError');
        const tx: Record<string, unknown> = { objectStore: () => ({ get: () => ({}), put: () => ({}), delete: () => ({}) }) };
        setTimeout(() => (tx.onabort as () => void)?.());
        return tx;
      },
    });
    const cases: [string, unknown][] = [
      ['is missing', null],
      ['open() throws (Firefox 127+, WebKit: SecurityError)', { open() { throw new DOMException('denied', 'SecurityError'); } }],
      ['open() fails later (Chrome: UnknownError)', { open() {
        const req: Record<string, unknown> = {};
        setTimeout(() => { req.error = new DOMException('denied', 'UnknownError'); (req.onerror as () => void)?.(); });
        return req;
      } }],
      ['a transaction aborts', opening(failing('abort'))],
      ['a transaction cannot start', opening(failing('throw'))],
    ];
    it.each(cases)('%s', async (_, idb) => {
      const store = openGhostStore(idb as IDBFactory);
      expect(await store.get('k')).toBeUndefined();
      expect(await store.put('k', GHOST)).toBe(false);
      expect(() => store.delete('k')).not.toThrow();
    });

    it('open() never settles: get and put stay pending, without throwing', async () => {
      const store = openGhostStore({ open: () => ({}) } as unknown as IDBFactory);
      let settled = false;
      void store.get('k').then(() => { settled = true; });
      void store.put('k', GHOST).then(() => { settled = true; });
      await new Promise(r => setTimeout(r, 20));
      expect(settled).toBe(false);
    });
  });

  it("closes when another tab upgrades the database, so that upgrade isn't blocked", async () => {
    const idb = new IDBFactory(), store = openGhostStore(idb);
    await store.put('k', GHOST);
    const upgraded = await new Promise<string>(resolve => {
      const req = idb.open('neon-racer', 2);
      req.onsuccess = () => { req.result.close(); resolve('opened'); };
      req.onblocked = () => resolve('blocked');
    });
    expect(upgraded).toBe('opened');
  });
});
