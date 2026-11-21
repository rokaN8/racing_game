import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createGhost } from '../src/ghost';

// Stand-in for the Bike's state: only what the Ghost reads.
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
    const ghost = createGhost(memoryStorage()), b = bikeAt();
    poseAt(b, 0, 1); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('after a Lap, the next run traces that Lap step by step', () => {
    const ghost = createGhost(memoryStorage()), b = bikeAt();
    const first = lap(ghost, b, 300, 40, 1);
    expectTraces(ghost, b, first);
  });

  it('keeps the best Lap: a slower Lap does not replace it, a faster one does', () => {
    const ghost = createGhost(memoryStorage()), b = bikeAt();
    const first = lap(ghost, b, 300, 40, 1);
    lap(ghost, b, 320, 42, 2);                 // slower
    expectTraces(ghost, b, first);
    expect(ghost.bestTime).toBe(40);
    const g2 = createGhost(memoryStorage()), b2 = bikeAt();
    lap(g2, b2, 300, 40, 1);
    const faster = lap(g2, b2, 280, 38, 3);
    expectTraces(g2, b2, faster);
    expect(g2.bestTime).toBe(38);
  });

  it('ends when the best Lap runs out', () => {
    const ghost = createGhost(memoryStorage()), b = bikeAt();
    lap(ghost, b, 10, 40, 1);
    for (let k = 0; k < 10; k++) { poseAt(b, k, 9); ghost.record(b); expect(ghost.pose(new Vector3(), new Quaternion())).toBe(true); }
    poseAt(b, 10, 9); ghost.record(b);
    expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
  });

  it('ignores a corrupt saved Ghost', () => {
    const ghostIn = (v: string) => { const s = memoryStorage(); s.setItem('neon-racer.ghost.v1', v); return createGhost(s); };
    const corrupt = [
      'not json', '{}',
      JSON.stringify({ time: 'x', poses: btoa('abcd') }), // time not a number
      JSON.stringify({ time: 40, poses: btoa('abc') }),   // not whole floats
      JSON.stringify({ time: 40, poses: btoa('abcd') }),  // one float, not a whole pose
    ];
    for (const v of corrupt) {
      const ghost = ghostIn(v), b = bikeAt();
      expect(ghost.bestTime).toBeNull();
      poseAt(b, 0, 1); ghost.record(b);
      expect(ghost.pose(new Vector3(), new Quaternion())).toBe(false);
    }
  });

  it('survives a page reload', () => {
    const storage = memoryStorage(), b = bikeAt();
    const ghost = createGhost(storage);
    const first = lap(ghost, b, 4800, 40, 1); // a full 40 s Lap of 120 Hz samples
    ghost.record(b);                            // first step past the line saves it
    const reloaded = createGhost(storage);
    expect(reloaded.bestTime).toBe(40);
    expectTraces(reloaded, bikeAt(), first);
  });

  it('still works with storage blocked or missing', () => {
    for (const storage of [blocked, null]) {
      const ghost = createGhost(storage), b = bikeAt();
      const first = lap(ghost, b, 300, 40, 1);
      expectTraces(ghost, b, first);
    }
  });
});
