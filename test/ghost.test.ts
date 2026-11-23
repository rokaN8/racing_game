import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createGhost, migrateOldGhost } from '../src/ghost';

// Stand-in for the Bike's state: only what the Ghost reads.
const ID = 'allround', KEY = 'neon-racer.track.allround.v1';
const bikeAt = () => ({ laps: 0, lastLap: null as number | null, lastCP: 0, lapTime: 0, pos: new Vector3(), quat: new Quaternion() });
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
    const ghost = createGhost(memoryStorage(), ID), b = bikeAt();
    poseAt(b, 0, 1); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('after a Lap, the next run traces that Lap step by step', () => {
    const ghost = createGhost(memoryStorage(), ID), b = bikeAt();
    const first = lap(ghost, b, 300, 40, 1);
    expectTraces(ghost, b, first);
  });

  it('keeps the best Lap: a slower Lap does not replace it, a faster one does', () => {
    const ghost = createGhost(memoryStorage(), ID), b = bikeAt();
    const first = lap(ghost, b, 300, 40, 1);
    lap(ghost, b, 320, 42, 2);                 // slower
    expectTraces(ghost, b, first);
    expect(ghost.bestTime).toBe(40);
    const g2 = createGhost(memoryStorage(), ID), b2 = bikeAt();
    lap(g2, b2, 300, 40, 1);
    const faster = lap(g2, b2, 280, 38, 3);
    expectTraces(g2, b2, faster);
    expect(g2.bestTime).toBe(38);
  });

  it('ends when the best Lap runs out', () => {
    const ghost = createGhost(memoryStorage(), ID), b = bikeAt();
    lap(ghost, b, 10, 40, 1);
    for (let k = 0; k < 10; k++) { poseAt(b, k, 9); ghost.record(b); expect(ghost.pose(new Vector3(), new Quaternion())).toBe(true); }
    poseAt(b, 10, 9); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('ignores a corrupt saved record', () => {
    const ghostIn = (v: string) => { const s = memoryStorage(); s.setItem(KEY, v); return createGhost(s, ID); };
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

  it('survives a page reload', () => {
    const storage = memoryStorage(), b = bikeAt();
    const ghost = createGhost(storage, ID);
    const first = lap(ghost, b, 4800, 40, 1); // a full 40 s Lap of 120 Hz samples
    ghost.record(b);                            // first step past the line saves it
    const reloaded = createGhost(storage, ID);
    expect(reloaded.bestTime).toBe(40);
    expectTraces(reloaded, bikeAt(), first);
  });

  it('keeps the top 5, fastest first, dated; an equal time ranks below; the Ghost is #1', () => {
    let t = 1000;
    const storage = memoryStorage(), ghost = createGhost(storage, ID, 1, () => t++), b = bikeAt();
    lap(ghost, b, 100, 45, 1);
    for (const time of [47, 44, 46, 45, 50, 43.5]) lap(ghost, b, 100, time, 2); // 44 takes the Ghost, 43.5 takes it again
    const fastest = lap(ghost, b, 100, 43, 3);
    lap(ghost, b, 100, 60, 4);                                 // too slow for the top 5: nothing changes
    expectTraces(ghost, b, fastest);                           // its first step closes the 60 s Lap
    expect(ghost.lastRank).toBeNull();                          // the 60 s Lap missed the top 5
    expect(ghost.scores.map(s => s.time)).toEqual([43, 43.5, 44, 45, 45]);
    expect(ghost.scores[3].date).toBeLessThan(ghost.scores[4].date!); // the first 45 stays above the later, equal one
    const reloaded = createGhost(storage, ID);                 // survives a reload: times, dates and Ghost
    expect(reloaded.scores).toEqual(ghost.scores);
    expectTraces(reloaded, bikeAt(), fastest);
  });

  it('a Lap outside #1 joins the top 5 without replacing the Ghost', () => {
    const storage = memoryStorage(), ghost = createGhost(storage, ID), b = bikeAt();
    const first = lap(ghost, b, 200, 40, 1);
    lap(ghost, b, 220, 42, 2);
    ghost.record(b);
    expect(ghost.scores.map(s => s.time)).toEqual([40, 42]);
    expect(ghost.lastRank).toBe(2);
    expectTraces(createGhost(storage, ID), bikeAt(), first);
  });

  it('clear() resets the Track: times and Ghost gone, in memory and storage', () => {
    const storage = memoryStorage(), ghost = createGhost(storage, ID), b = bikeAt();
    lap(ghost, b, 100, 40, 1); ghost.record(b);
    ghost.clear();
    expect(ghost.scores).toEqual([]);
    expect(ghost.bestTime).toBeNull();
    expect(storage.getItem(KEY)).toBeNull();
    expect(createGhost(storage, ID).scores).toEqual([]);
    ghost.restart(); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('keeps each Track separate', () => {
    const storage = memoryStorage(), a = createGhost(storage, 'a'), b = bikeAt();
    lap(a, b, 100, 40, 1); a.record(b);
    expect(createGhost(storage, 'b').scores).toEqual([]);
    expect(createGhost(storage, 'a').bestTime).toBe(40);
  });

  describe('runs of several Laps', () => {
    it('ranks the run total once its last Lap closes, with each Lap time; the Ghost is the whole run', () => {
      const storage = memoryStorage(), ghost = createGhost(storage, ID, 3), b = bikeAt();
      const poses = [...lap(ghost, b, 100, 20, 1), ...lap(ghost, b, 100, 19, 1), ...lap(ghost, b, 100, 18, 1)];
      expect(ghost.run).toEqual([20, 19]); // the last Lap closes on the next step
      expect(ghost.scores).toEqual([]);
      expectTraces(ghost, b, poses);
      expect(ghost.lastRun).toEqual([20, 19, 18]);
      expect(ghost.scores).toEqual([{ time: 57, date: expect.any(Number), lapTimes: [20, 19, 18] }]);
      const reloaded = createGhost(storage, ID, 3);
      expect(reloaded.scores).toEqual(ghost.scores);
      expectTraces(reloaded, bikeAt(), poses);
    });

    it('keeps each lap count separate; records from before lap counts are 1-Lap runs', () => {
      const storage = memoryStorage(), b = bikeAt();
      storage.setItem(KEY, JSON.stringify({ scores: [{ time: 40, date: 1 }], ghost: null }));
      const three = createGhost(storage, ID, 3);
      lap(three, b, 10, 20, 1); lap(three, b, 10, 20, 1); lap(three, b, 10, 20, 1); three.record(b);
      expect(createGhost(storage, ID, 1).scores).toEqual([{ time: 40, date: 1, lapTimes: [40] }]);
      expect(createGhost(storage, ID, 3).bestTime).toBe(60);
      expect(createGhost(storage, ID, 5).scores).toEqual([]);
    });

    it('drops a score whose lap splits do not match the lap count', () => {
      const storage = memoryStorage();
      storage.setItem('neon-racer.track.allround.3laps.v1', JSON.stringify({ scores: [{ time: 40, date: 1, lapTimes: [40] }], ghost: null }));
      expect(createGhost(storage, ID, 3).scores).toEqual([]);
    });

    it('Checkpoint splits run on across Laps: each Lap start is timed against the Ghost', () => {
      const ghost = createGhost(memoryStorage(), ID, 2), b = bikeAt();
      lap(ghost, b, 10, 20, 1); lap(ghost, b, 10, 20, 1); // the Ghost: 20 + 20
      lap(ghost, b, 10, 19, 2);                           // its first step closes the Ghost's run
      expect(ghost.record(b)).toBeCloseTo(-1);            // onto Lap 2 at 19 s, against the Ghost's 20 s
    });

    it('saves the times without the Ghost when the Ghost would overflow storage', () => {
      const storage = memoryStorage(), tight = { ...storage, getItem: storage.getItem, removeItem: storage.removeItem,
        setItem: (k: string, v: string) => { if (v.length > 1000) throw new Error('QuotaExceededError'); storage.setItem(k, v); } } as Storage;
      const ghost = createGhost(tight, ID, 3), b = bikeAt();
      lap(ghost, b, 100, 20, 1); lap(ghost, b, 100, 20, 1); lap(ghost, b, 100, 20, 1); ghost.record(b);
      const reloaded = createGhost(tight, ID, 3);
      expect(reloaded.bestTime).toBe(60);
      reloaded.record(bikeAt());
      expect(reloaded.pose(new Vector3(), new Quaternion())).toBe(false);
      expect(ghost.pose(new Vector3(), new Quaternion())).toBe(true); // still raced against this session
    });
  });

  describe('migration from before Tracks', () => {
    // A best Lap saved by the POC: v2 has splits, v1 doesn't.
    const oldLap = (time: number) => {
      const g = createGhost(memoryStorage(), 'tmp'), b = bikeAt();
      const poses = lap(g, b, 50, time, 1); g.record(b);
      return { poses, saved: { time, poses: btoa(String.fromCharCode(...new Uint8Array(Float32Array.from(poses.flat()).buffer))), splits: [0] } };
    };

    it('moves the old best Lap to the Track as its undated #1, then removes the old keys', () => {
      for (const oldKey of ['neon-racer.ghost.v2', 'neon-racer.ghost.v1']) {
        const storage = memoryStorage(), { poses, saved } = oldLap(39);
        storage.setItem(oldKey, JSON.stringify(saved));
        migrateOldGhost(storage, ID);
        expect(storage.getItem(oldKey)).toBeNull();
        const ghost = createGhost(storage, ID);
        expect(ghost.scores).toEqual([{ time: 39, date: null, lapTimes: [39] }]);
        expectTraces(ghost, bikeAt(), poses);
      }
    });

    it("doesn't overwrite a Track that already has a record", () => {
      const storage = memoryStorage(), ghost = createGhost(storage, ID), b = bikeAt();
      lap(ghost, b, 100, 41, 1); ghost.record(b);
      storage.setItem('neon-racer.ghost.v2', JSON.stringify(oldLap(39).saved));
      migrateOldGhost(storage, ID);
      expect(createGhost(storage, ID).bestTime).toBe(41);
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

  it('still works with storage blocked or missing', () => {
    for (const storage of [blocked, null]) {
      const ghost = createGhost(storage, ID), b = bikeAt();
      const first = lap(ghost, b, 300, 40, 1);
      expectTraces(ghost, b, first);
    }
  });
});
