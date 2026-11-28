import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createGhost, migrateOldGhost, pilotRun } from '../src/ghost';
import { launchAtGo, newState, step } from '../src/bike/physics';
import { ROCKET_WINDOW, TUNING } from '../src/bike/tuning';
import { createPilot, DT, type Pilot } from '../src/pilot';
import { bakeTrack } from '../src/track/bake';
import { overdrive } from '../src/track/tracks/allround';

// Stand-in for the Bike's state: only what the Ghost reads.
const ID = 'allround', KEY = 'neon-racer.track.allround.v1';
const TRACK = { id: ID, L: 100, cpS: [0] }, track = (id: string) => ({ ...TRACK, id }); // one Checkpoint: the start line
const bikeAt = () => ({ laps: 0, lastLap: null as number | null, lastCP: 0, lapTime: 0, s: 0, pos: new Vector3(), quat: new Quaternion() });
type Bike = ReturnType<typeof bikeAt>;

// One physics step's pose for sample k of a Lap; `wobble` makes different Laps trace different paths.
const poseAt = (b: Bike, k: number, wobble: number) => {
  b.pos.set(k * 0.5, Math.sin(k * wobble), k * 0.01);
  b.quat.setFromAxisAngle(new Vector3(0, 1, 0), k * wobble * 0.01);
};

// Ride `steps` physics steps of a Lap, then cross the line with the given Lap time.
// Like physics, crossing only bumps `laps`: the Ghost closes the Lap on the next record().
function lap(ghost: ReturnType<typeof createGhost>, b: Bike, steps: number, time: number, wobble: number) {
  const poses: number[][] = [];
  for (let k = 0; k < steps; k++) {
    poseAt(b, k, wobble);
    ghost.record(b);
    poses.push([...b.pos.toArray(), ...b.quat.toArray()]);
  }
  b.laps++; b.lastLap = time;
  return poses;
}

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k),
    clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}

const blocked = new Proxy({} as Storage, { get() { throw new Error('SecurityError: storage is blocked'); } });

// An in-memory Ghost store, the shape openGhostStore gives over IndexedDB.
function memoryGhostStore() {
  const m = new Map<string, unknown>();
  return { m, get: async (k: string) => m.get(k), put: async (k: string, v: unknown) => { m.set(k, v); return true; }, delete: (k: string) => void m.delete(k) };
}
type Store = ReturnType<typeof memoryGhostStore>;
// A page reload: the times straight from storage, the Ghost once the Track has loaded.
async function reload(storage: Storage, store: Store, track = TRACK, laps = 1) {
  const g = createGhost(storage, track, laps, Date.now, store);
  await g.load();
  return g;
}

// Every step of the next run, the Ghost's pose must be the best Lap's pose at the same step.
function expectTraces(ghost: ReturnType<typeof createGhost>, b: Bike, best: number[][]) {
  const p = new Vector3(), q = new Quaternion();
  for (let k = 0; k < best.length; k++) {
    poseAt(b, k, 9); // the new run goes its own way
    ghost.record(b);
    expect(ghost.pose(p, q)).toBe(true);
    [...p.toArray(), ...q.toArray()].forEach((v, j) => expect(v).toBeCloseTo(best[k][j], 5));
  }
}

describe('Ghost', () => {
  it('shows nothing before the first Lap', () => {
    const ghost = createGhost(memoryStorage(), TRACK), b = bikeAt();
    poseAt(b, 0, 1); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('after a Lap, the next run traces that Lap step by step', () => {
    const ghost = createGhost(memoryStorage(), TRACK), b = bikeAt();
    const first = lap(ghost, b, 300, 40, 1);
    expectTraces(ghost, b, first);
  });

  it('keeps the best Lap: a slower Lap does not replace it, a faster one does', () => {
    const ghost = createGhost(memoryStorage(), TRACK), b = bikeAt();
    const first = lap(ghost, b, 300, 40, 1);
    lap(ghost, b, 320, 42, 2);                 // slower
    expectTraces(ghost, b, first);
    expect(ghost.bestTime).toBe(40);
    const g2 = createGhost(memoryStorage(), TRACK), b2 = bikeAt();
    lap(g2, b2, 300, 40, 1);
    const faster = lap(g2, b2, 280, 38, 3);
    expectTraces(g2, b2, faster);
    expect(g2.bestTime).toBe(38);
  });

  it('ends when the best Lap runs out', () => {
    const ghost = createGhost(memoryStorage(), TRACK), b = bikeAt();
    lap(ghost, b, 10, 40, 1);
    for (let k = 0; k < 10; k++) { poseAt(b, k, 9); ghost.record(b); expect(ghost.pose(new Vector3(), new Quaternion())).toBe(true); }
    poseAt(b, 10, 9); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('ignores a corrupt saved record', () => {
    const ghostIn = (v: string) => { const s = memoryStorage(); s.setItem(KEY, v); return createGhost(s, TRACK); };
    const corrupt = [
      'not json', '{}', 'null',
      JSON.stringify({ scores: [{ time: 'x', date: 1 }], ghost: null }),               // time not a number
      JSON.stringify({ scores: [{ time: 41, date: 1 }, { time: 40, date: 1 }], ghost: null }), // not fastest first
    ];
    for (const v of corrupt) {
      const ghost = ghostIn(v), b = bikeAt();
      expect(ghost.bestTime).toBeNull();
      expect(ghost.scores).toEqual([]);
      poseAt(b, 0, 1); ghost.record(b);
      expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
    }
    // a Ghost that doesn't decode is dropped, its times kept
    for (const poses of [btoa('abc'), btoa('abcd'), 42]) { // not whole floats; one float, not a whole pose; not a string
      const ghost = ghostIn(JSON.stringify({ scores: [{ time: 40, date: 1 }], ghost: { poses, splits: [0] } }));
      expect(ghost.bestTime).toBe(40);
      poseAt(bikeAt(), 0, 1); ghost.record(bikeAt());
      expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
    }
  });

  it('survives a page reload: the times in storage, the Ghost in the Ghost store once the Track loads', async () => {
    const storage = memoryStorage(), store = memoryGhostStore(), b = bikeAt();
    const ghost = createGhost(storage, TRACK, 1, Date.now, store);
    const first = lap(ghost, b, 4800, 40, 1); // a full 40 s Lap of 120 Hz samples
    ghost.record(b);                            // first step past the line saves it
    expect(JSON.parse(storage.getItem(KEY)!).ghost).toBeUndefined(); // the times only: no Ghost in localStorage
    const reloaded = createGhost(storage, TRACK, 1, Date.now, store);
    expect(reloaded.bestTime).toBe(40);         // the times straight away
    await reloaded.load();
    expectTraces(reloaded, bikeAt(), first);
  });

  it('keeps the top 5, fastest first, dated; an equal time ranks below; the Ghost is #1', async () => {
    let t = 1000;
    const storage = memoryStorage(), store = memoryGhostStore(), ghost = createGhost(storage, TRACK, 1, () => t++, store), b = bikeAt();
    lap(ghost, b, 100, 45, 1);
    for (const time of [47, 44, 46, 45, 50, 43.5]) lap(ghost, b, 100, time, 2); // 44 takes the Ghost, 43.5 takes it again
    const fastest = lap(ghost, b, 100, 43, 3);
    lap(ghost, b, 100, 60, 4);                                 // too slow for the top 5: nothing changes
    expectTraces(ghost, b, fastest);                           // its first step closes the 60 s Lap
    expect(ghost.lastRank).toBeNull();                          // the 60 s Lap missed the top 5
    expect(ghost.scores.map(s => s.time)).toEqual([43, 43.5, 44, 45, 45]);
    expect(ghost.scores[3].date).toBeLessThan(ghost.scores[4].date!); // the first 45 stays above the later, equal one
    const reloaded = await reload(storage, store);               // survives a reload: times, dates and Ghost
    expect(reloaded.scores).toEqual(ghost.scores);
    expectTraces(reloaded, bikeAt(), fastest);
  });

  it('a Lap outside #1 joins the top 5 without replacing the Ghost', async () => {
    const storage = memoryStorage(), store = memoryGhostStore(), ghost = createGhost(storage, TRACK, 1, Date.now, store), b = bikeAt();
    const first = lap(ghost, b, 200, 40, 1);
    lap(ghost, b, 220, 42, 2);
    ghost.record(b);
    expect(ghost.scores.map(s => s.time)).toEqual([40, 42]);
    expect(ghost.lastRank).toBe(2);
    expectTraces(await reload(storage, store), bikeAt(), first);
  });

  it('a Ghost that arrives after the run has started waits for the next run', async () => {
    const storage = memoryStorage(), store = memoryGhostStore(), b = bikeAt();
    const g0 = createGhost(storage, TRACK, 1, Date.now, store), first = lap(g0, b, 100, 40, 1);
    g0.record(b);                                                // closes the Lap: the stored Ghost
    let release = () => {};
    const slow = { ...store, get: (k: string) => new Promise<unknown>(r => { release = () => r(store.m.get(k)); }) };
    const g = createGhost(storage, TRACK, 1, Date.now, slow), r = bikeAt(), loaded = g.load();
    poseAt(r, 0, 9); g.record(r);                               // the run is under way, no Ghost yet
    release(); await loaded;
    poseAt(r, 1, 9); g.record(r);
    expect(g.pose(new Vector3(), new Quaternion())).toBe(false); // never swaps in mid-run
    g.restart();
    expectTraces(g, bikeAt(), first);                           // the next run races it
  });

  it("drops a stored Ghost that isn't the #1's (another time or date): the Pilot stands in", async () => {
    const storage = memoryStorage(), store = memoryGhostStore(), b = bikeAt();
    const ghost = createGhost(storage, TRACK, 1, () => 7, store);
    lap(ghost, b, 100, 40, 1); ghost.record(b);
    const stored = store.m.get(KEY) as object;
    for (const other of [{ time: 41 }, { date: 8 }, { date: null }]) {
      store.m.set(KEY, { ...stored, ...other });
      const reloaded = await reload(storage, store);
      reloaded.record(bikeAt());
      expect(reloaded.pose(new Vector3(), new Quaternion())).toBe(false);
      expect(reloaded.needsPilot).toBe(true);
    }
  });

  it('stops recording at 5 min a Lap: a run past it still ranks, but keeps no Ghost', () => {
    const storage = memoryStorage(), store = memoryGhostStore(), ghost = createGhost(storage, TRACK, 1, Date.now, store), b = bikeAt();
    lap(ghost, b, 5 * 60 * 120 + 10, 300.1, 1); ghost.record(b); // a 5 min Lap and a bit
    expect(ghost.scores.map(s => s.time)).toEqual([300.1]);
    expect(ghost.recording).toBeNull();
    expect(ghost.needsPilot).toBe(true);                          // the Pilot stands in
    expect(store.m.has(KEY)).toBe(false);
  });

  it('clear() resets the Track: times and Ghost gone, in memory, storage and the Ghost store', () => {
    const storage = memoryStorage(), store = memoryGhostStore(), ghost = createGhost(storage, TRACK, 1, Date.now, store), b = bikeAt();
    lap(ghost, b, 100, 40, 1); ghost.record(b);
    ghost.clear();
    expect(ghost.scores).toEqual([]);
    expect(ghost.bestTime).toBeNull();
    expect(storage.getItem(KEY)).toBeNull();
    expect(store.m.has(KEY)).toBe(false);
    expect(createGhost(storage, TRACK).scores).toEqual([]);
    ghost.restart(); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('keeps each Track separate', () => {
    const storage = memoryStorage(), a = createGhost(storage, track('a')), b = bikeAt();
    lap(a, b, 100, 40, 1); a.record(b);
    expect(createGhost(storage, track('b')).scores).toEqual([]);
    expect(createGhost(storage, track('a')).bestTime).toBe(40);
  });

  describe('runs of several Laps', () => {
    it('ranks the run total once its last Lap closes, with each Lap time; the Ghost is the whole run', async () => {
      const storage = memoryStorage(), store = memoryGhostStore(), ghost = createGhost(storage, TRACK, 3, Date.now, store), b = bikeAt();
      const poses = [...lap(ghost, b, 100, 20, 1), ...lap(ghost, b, 100, 19, 1), ...lap(ghost, b, 100, 18, 1)];
      expect(ghost.run).toEqual([20, 19]); // the last Lap closes on the next step
      expect(ghost.scores).toEqual([]);
      expectTraces(ghost, b, poses);
      expect(ghost.lastRun).toEqual([20, 19, 18]);
      expect(ghost.scores).toEqual([{ time: 57, date: expect.any(Number), lapTimes: [20, 19, 18] }]);
      const reloaded = await reload(storage, store, TRACK, 3);
      expect(reloaded.scores).toEqual(ghost.scores);
      expectTraces(reloaded, bikeAt(), poses);
    });

    it('keeps each lap count separate; records from before lap counts are 1-Lap runs', () => {
      const storage = memoryStorage(), b = bikeAt();
      storage.setItem(KEY, JSON.stringify({ scores: [{ time: 40, date: 1 }], ghost: null }));
      const three = createGhost(storage, TRACK, 3);
      lap(three, b, 10, 20, 1); lap(three, b, 10, 20, 1); lap(three, b, 10, 20, 1); three.record(b);
      expect(createGhost(storage, TRACK, 1).scores).toEqual([{ time: 40, date: 1, lapTimes: [40] }]);
      expect(createGhost(storage, TRACK, 3).bestTime).toBe(60);
      expect(createGhost(storage, TRACK, 5).scores).toEqual([]);
    });

    it('drops a score whose lap splits do not match the lap count', () => {
      const storage = memoryStorage();
      storage.setItem('neon-racer.track.allround.3laps.v1', JSON.stringify({ scores: [{ time: 40, date: 1, lapTimes: [40] }], ghost: null }));
      expect(createGhost(storage, TRACK, 3).scores).toEqual([]);
    });

    it('Checkpoint splits run on across Laps: each Lap start is timed against the Ghost', () => {
      const ghost = createGhost(memoryStorage(), TRACK, 2), b = bikeAt();
      lap(ghost, b, 10, 20, 1); lap(ghost, b, 10, 20, 1); // the Ghost: 20 + 20
      lap(ghost, b, 10, 19, 2);                           // its first step closes the Ghost's run
      expect(ghost.record(b)).toBeCloseTo(-1);            // onto Lap 2 at 19 s, against the Ghost's 20 s
    });

    it("saves the times when the Ghost store can't keep the Ghost, which is still raced this session", async () => {
      const storage = memoryStorage(), full = { ...memoryGhostStore(), put: async () => false }; // e.g. a QuotaExceededError abort
      const ghost = createGhost(storage, TRACK, 3, Date.now, full), b = bikeAt();
      lap(ghost, b, 100, 20, 1); lap(ghost, b, 100, 20, 1); lap(ghost, b, 100, 20, 1); ghost.record(b);
      const reloaded = await reload(storage, full, TRACK, 3);
      expect(reloaded.bestTime).toBe(60);
      reloaded.record(bikeAt());
      expect(reloaded.pose(new Vector3(), new Quaternion())).toBe(false);
      expect(ghost.pose(new Vector3(), new Quaternion())).toBe(true); // still raced against this session
    });
  });

  describe('migration from before the Ghost store', () => {
    // A record as saved before: the Ghost inline, as base64.
    const b64 = (xs: number[]) => btoa(String.fromCharCode(...new Uint8Array(Float32Array.from(xs).buffer)));
    const inlineRecord = (storage: Storage) => {
      const g = createGhost(memoryStorage(), track('tmp')), b = bikeAt(), poses = lap(g, b, 50, 40, 1);
      storage.setItem(KEY, JSON.stringify({ scores: [{ time: 40, date: 1, lapTimes: [40] }], ghost: { poses: b64(poses.flat()), splits: [0] } }));
      return poses;
    };

    it('races the inline Ghost straight away, and the Track load moves it to the Ghost store', async () => {
      const storage = memoryStorage(), store = memoryGhostStore(), poses = inlineRecord(storage);
      const g = createGhost(storage, TRACK, 1, Date.now, store);
      await g.load();
      expect(store.m.get(KEY)).toMatchObject({ time: 40, date: 1, splits: [0] });
      const saved = JSON.parse(storage.getItem(KEY)!);
      expect(saved.ghost).toBeUndefined();                    // out of localStorage
      expect(saved.scores).toEqual([{ time: 40, date: 1, lapTimes: [40] }]);
      expectTraces(g, bikeAt(), poses);
      expectTraces(await reload(storage, store), bikeAt(), poses);
    });

    it("keeps the inline Ghost when the Ghost store can't take it, also through a slower finish", async () => {
      const storage = memoryStorage(), full = { ...memoryGhostStore(), put: async () => false }, poses = inlineRecord(storage);
      const g = createGhost(storage, TRACK, 1, Date.now, full), b = bikeAt();
      await g.load();
      lap(g, b, 60, 45, 2); g.record(b);                     // a #2: rewrites the record
      expect(g.scores.map(s => s.time)).toEqual([40, 45]);
      expectTraces(createGhost(storage, TRACK), bikeAt(), poses);
    });
  });

  describe('migration from before Tracks', () => {
    // A best Lap saved by the POC: v2 has splits, v1 doesn't.
    const oldLap = (time: number) => {
      const g = createGhost(memoryStorage(), track('tmp')), b = bikeAt();
      const poses = lap(g, b, 50, time, 1); g.record(b);
      return { poses, saved: { time, poses: btoa(String.fromCharCode(...new Uint8Array(Float32Array.from(poses.flat()).buffer))), splits: [0] } };
    };

    it('moves the old best Lap to the Track as its undated #1, then removes the old keys', () => {
      for (const oldKey of ['neon-racer.ghost.v2', 'neon-racer.ghost.v1']) {
        const storage = memoryStorage(), { poses, saved } = oldLap(39);
        storage.setItem(oldKey, JSON.stringify(saved));
        migrateOldGhost(storage, ID);
        expect(storage.getItem(oldKey)).toBeNull();
        const ghost = createGhost(storage, TRACK);
        expect(ghost.scores).toEqual([{ time: 39, date: null, lapTimes: [39] }]);
        expectTraces(ghost, bikeAt(), poses);
      }
    });

    it("doesn't overwrite a Track that already has a record", () => {
      const storage = memoryStorage(), ghost = createGhost(storage, TRACK), b = bikeAt();
      lap(ghost, b, 100, 41, 1); ghost.record(b);
      storage.setItem('neon-racer.ghost.v2', JSON.stringify(oldLap(39).saved));
      migrateOldGhost(storage, ID);
      expect(createGhost(storage, TRACK).bestTime).toBe(41);
    });

    it('keeps the old key when the new record cannot be written', () => {
      const storage = memoryStorage(), old = JSON.stringify(oldLap(39).saved);
      storage.setItem('neon-racer.ghost.v2', old);
      const full = { ...storage, getItem: storage.getItem, removeItem: storage.removeItem,
        setItem: () => { throw new Error('QuotaExceededError'); } } as Storage;
      migrateOldGhost(full, ID);
      expect(storage.getItem('neon-racer.ghost.v2')).toBe(old);
    });

    it('ignores a garbage old key and blocked storage', () => {
      const storage = memoryStorage();
      storage.setItem('neon-racer.ghost.v2', 'not json');
      migrateOldGhost(storage, ID);
      expect(storage.getItem(KEY)).toBeNull();
      expect(() => migrateOldGhost(blocked, ID)).not.toThrow();
      expect(() => migrateOldGhost(null, ID)).not.toThrow();
    });
  });

  describe('Pilot Ghost', () => {
    const T = bakeTrack(overdrive), OVERDRIVE = { id: overdrive.id, L: T.L, cpS: T.cpS };
    const FAST: Pilot = { airControl: true, boostStraights: true }; // quicker than the Pilot at every Checkpoint
    const drain = (laps: number) => { const run = pilotRun(T, overdrive.pilot, laps); for (;;) { const r = run.next(); if (r.done) return r.value; } };
    // Ride one real Lap with `o` against the Ghost: the splits it shows, and how far the Ghost is from the Bike each step.
    function race(ghost: ReturnType<typeof createGhost>, o: Pilot) {
      const st = newState(T), { pilot } = createPilot(T), p = new Vector3(), q = new Quaternion(), splits: number[] = [], apart: number[] = [];
      launchAtGo(st, ROCKET_WINDOW / 2); // a Rocket start, as the Pilot gets
      ghost.restart();
      while (st.laps < 1) {
        step(st, pilot(st, o), TUNING, T, DT);
        const s = ghost.record(st);
        if (s !== null) splits.push(s);
        if (st.laps < 1) apart.push(ghost.pose(p, q) ? p.distanceTo(st.pos) : NaN);
      }
      return { splits, apart };
    }

    it('with no Ghost of your own, the Pilot is the Ghost, with Checkpoint splits, and stays out of the High scores', () => {
      const ghost = createGhost(memoryStorage(), OVERDRIVE);
      expect(ghost.needsPilot).toBe(true);
      ghost.setPilot(drain(1));
      expect(ghost.needsPilot).toBe(false);
      expect(ghost.bestTime).toBeNull();
      const { splits, apart } = race(ghost, overdrive.pilot); // ride the Pilot's own line: dead level all the way
      expect(splits).toEqual(T.cpS.slice(1).map(() => 0));
      expect(Math.max(...apart)).toBeLessThan(1e-3); // poses are stored as 32-bit floats
      expect(ghost.scores).toHaveLength(1); // only your run
    });

    it('your first run replaces it; Reset times brings it back', () => {
      const ghost = createGhost(memoryStorage(), OVERDRIVE);
      ghost.setPilot(drain(1));
      const vsPilot = race(ghost, FAST).splits;
      expect(vsPilot.every(s => s < 0)).toBe(true);
      expect(ghost.needsPilot).toBe(false);
      expect(race(ghost, FAST).splits.every(s => s === 0)).toBe(true); // against your own Ghost now
      ghost.clear();
      expect(ghost.needsPilot).toBe(false); // the Pilot's run is kept
      expect(race(ghost, FAST).splits).toEqual(vsPilot);
    });

    it("splits every Checkpoint pass of a several-Lap run, as a player's run does", () => {
      expect(drain(3).splits).toHaveLength(3 * T.cpS.length);
    });
  });

  const TWO_CPS = { id: ID, L: 100, cpS: [0, 50] }; // a 100 m Track with a Checkpoint halfway

  describe('live gap', () => {
    // One Lap of TWO_CPS at 0.5 m a step (60 m/s), crashing at `crashAt` m: a respawn at the last Checkpoint, +3 s.
    // `at` sees the Bike and the split record() returned after every step but the last.
    function ride(ghost: ReturnType<typeof createGhost>, crashAt = Infinity, at: (b: Bike, split: number | null) => void = () => {}) {
      const b = bikeAt();
      for (let crashed = false; b.laps === 0;) {
        b.lapTime += DT; b.s += 0.5;
        if (!crashed && b.s >= crashAt) { crashed = true; b.s = T_CP[b.lastCP]; b.lapTime += 3; }
        if (b.s >= 100) { b.s -= 100; b.laps = 1; b.lastLap = b.lapTime; b.lapTime = 0; }
        b.lastCP = b.s >= 50 ? 1 : 0;
        const split = ghost.record(b);
        if (b.laps === 0) at(b, split);
      }
    }
    const T_CP = TWO_CPS.cpS;
    const time = (m: number) => (m / 0.5) * DT; // a clean ride's time over m metres
    const crash = (m: number) => 3 + time(m); // a crash m metres past the last Checkpoint costs this

    it('is the time against the Ghost where you are, all the way round, matching the Checkpoint split', () => {
      const ghost = createGhost(memoryStorage(), TWO_CPS);
      expect(ghost.liveGap(bikeAt())).toBeNull(); // no Ghost yet
      ride(ghost);
      const gaps: number[] = [];
      ride(ghost, Infinity, b => gaps.push(ghost.liveGap(b)!));
      expect(gaps).toHaveLength(199);
      for (const g of gaps) expect(g).toBeCloseTo(0, 6);
      let atCP: [number, number] | null = null;
      ride(ghost, 30, (b, split) => { if (split !== null) atCP = [split, ghost.liveGap(b)!]; }); // behind by a crash at the Checkpoint
      expect(atCP![0]).toBeCloseTo(crash(30), 6);
      expect(atCP![1]).toBeCloseTo(atCP![0], 2);
    });

    it('a respawn costs the penalty plus the lost ground; against a Ghost that respawned, its first pass counts', () => {
      const clean = createGhost(memoryStorage(), TWO_CPS);
      ride(clean);
      const first: Record<string, number> = {}, last: Record<string, number> = {};
      ride(clean, 60, b => { const g = clean.liveGap(b)!; first[b.s] ??= g; last[b.s] = g; });
      expect(first[59.5]).toBeCloseTo(0, 6);      // just before the crash
      expect(last[50]).toBeCloseTo(crash(10), 6); // just after it: back 10 m, +3 s
      const crashed = createGhost(memoryStorage(), TWO_CPS);
      ride(crashed, 60);                        // the Ghost: to 60 m, back to 50 m with +3 s, on to the line
      const vs: Record<string, number> = {};
      ride(crashed, Infinity, b => { vs[b.s] = crashed.liveGap(b)!; });
      expect(vs[55]).toBeCloseTo(0, 6);         // the Ghost first got here before its crash
      expect(vs[59.5]).toBeCloseTo(0, 6);
      expect(vs[80]).toBeCloseTo(-crash(10), 6); // and here only after it
    });

    it('a Ghost saved without distances still plays and splits, with no live gap; a garbage one is dropped alone', async () => {
      const storage = memoryStorage(), store = memoryGhostStore(), ghost = createGhost(storage, TWO_CPS, 1, Date.now, store);
      ride(ghost);
      const saved = store.m.get(KEY) as object;
      for (const dist of [null, undefined, 'x', 42, new Float32Array(3)]) { // none; missing; not floats; an odd count
        store.m.set(KEY, { ...saved, dist });
        const old = await reload(storage, store, TWO_CPS), splits: number[] = [];
        let posed = true, gaps = 0;
        ride(old, Infinity, (b, split) => {
          if (split !== null) splits.push(split);
          posed &&= old.pose(new Vector3(), new Quaternion());
          if (old.liveGap(b) !== null) gaps++;
        });
        expect(posed).toBe(true);
        expect(splits).toEqual([expect.closeTo(0, 6)]);
        expect(gaps).toBe(0);
      }
    });

    it("adds under 5 % to a 5-Lap Ghost's stored size", () => {
      const store = memoryGhostStore(), ghost = createGhost(memoryStorage(), TRACK, 5, Date.now, store), b = bikeAt();
      for (let k = 0; k < 5; k++) lap(ghost, b, 4800, 40, 1);
      ghost.record(b);
      const { poses, dist } = store.m.get('neon-racer.track.allround.5laps.v1') as { poses: Float32Array; dist: Float32Array };
      expect(dist.byteLength / poses.byteLength).toBeLessThan(0.05);
    });
  });

  describe('Ideal time', () => {
    // A 1-Lap run on TWO_CPS whose two Sectors take a and b steps; `penalty` s lands in Sector `inSector`.
    function run(ghost: ReturnType<typeof createGhost>, a: number, b: number, penalty = 0, inSector = 1) {
      const bike = bikeAt();
      for (let i = 1; i <= a + b; i++) {
        bike.lapTime += DT;
        if (i === (inSector === 1 ? 1 : a + 1)) bike.lapTime += penalty;
        bike.lastCP = i >= a ? 1 : 0;
        if (i === a + b) { bike.laps = 1; bike.lastLap = bike.lapTime; bike.lapTime = 0; }
        ghost.record(bike);
      }
    }

    it('is the sum of the best time ridden in each Sector, penalties included', () => {
      const ghost = createGhost(memoryStorage(), TWO_CPS);
      expect(ghost.idealTime).toBeNull();
      run(ghost, 100, 100);
      expect(ghost.idealTime).toBeCloseTo(200 * DT, 9);  // one run: its own time
      run(ghost, 80, 140);                               // slower, but quicker to the Checkpoint
      expect(ghost.idealTime).toBeCloseTo(180 * DT, 9);  // below both runs
      run(ghost, 70, 100, 3, 1);                         // quicker still to the Checkpoint, but +3 s there
      expect(ghost.idealTime).toBeCloseTo(180 * DT, 9);
      run(ghost, 70, 100, 3, 2);                         // the +3 s after it this time
      expect(ghost.idealTime).toBeCloseTo(170 * DT, 9);
    });

    it('keeps a best Sector from a run outside the top 5, and survives a reload', () => {
      const storage = memoryStorage(), ghost = createGhost(storage, TWO_CPS);
      for (let k = 0; k < 5; k++) run(ghost, 100, 100);
      run(ghost, 50, 400); // 6th: outside the top 5
      expect(ghost.lastRank).toBeNull();
      expect(ghost.idealTime).toBeCloseTo(150 * DT, 9);
      expect(createGhost(storage, TWO_CPS).idealTime).toBeCloseTo(150 * DT, 9);
    });

    it('is hidden while above the #1 time: scores from before sectors', () => {
      const storage = memoryStorage();
      storage.setItem(KEY, JSON.stringify({ scores: [{ time: 1, date: 1, lapTimes: [1] }], ghost: null }));
      const ghost = createGhost(storage, TWO_CPS);
      run(ghost, 200, 200); // 3.33 s: the only sectors, so the ideal is above the 1 s #1
      expect(ghost.idealTime).toBeNull();
    });

    it('Reset times clears it; garbage or the wrong length loads as empty, the scores kept', () => {
      const storage = memoryStorage(), ghost = createGhost(storage, TWO_CPS);
      run(ghost, 100, 100);
      ghost.clear();
      expect(ghost.idealTime).toBeNull();
      run(ghost, 100, 100);
      const saved = JSON.parse(storage.getItem(KEY)!);
      for (const sectors of ['x', [1, 'a'], [1], [1, 1, 1], { 0: 1, 1: 1 }, [1, Infinity]]) {
        storage.setItem(KEY, JSON.stringify({ ...saved, sectors }));
        const reloaded = createGhost(storage, TWO_CPS);
        expect(reloaded.idealTime).toBeNull();
        expect(reloaded.scores).toEqual(saved.scores);
      }
    });
  });

  it('still works with storage blocked or missing', () => {
    for (const storage of [blocked, null]) {
      const ghost = createGhost(storage, TRACK), b = bikeAt();
      const first = lap(ghost, b, 300, 40, 1);
      expectTraces(ghost, b, first);
    }
  });
});
