// Data shards (docs/game-spec.md → Data shards): placed by hand per Track, each one reachable.
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { newState } from '../src/bike/physics';
import { createPilot, lapDone } from '../src/pilot';
import { loadFound, saveFound, SHARD_RADIUS, shardPositions, SHARDS_KEY, touchedShard } from '../src/shards';
import { bakeTrack } from '../src/track/bake';
import { TRACKS } from '../src/track/tracks';

describe.each(TRACKS)('$name Data shards', track => {
  const T = bakeTrack(track), at = shardPositions(T, track.shards), sample = (s: number) => Math.round(s / T.ds) % T.N;
  // the Pilot's clean Lap: every point it rode, and which shards it touched on the way
  const st = newState(T), path: Vector3[] = [], touched = new Set<number>();
  createPilot(T).ride(st, track.pilot, s => {
    path.push(s.pos.clone());
    for (let i; (i = touchedShard(s.pos, at, touched)) !== null;) touched.add(i);
    return lapDone(s);
  });

  it('has 10, spread out along the Lap', () => {
    expect(track.shards).toHaveLength(10);
    const s = track.shards.map(x => x.s).sort((a, b) => a - b);
    s.forEach((x, i) => expect((s[(i + 1) % 10] - x + T.L) % T.L).toBeGreaterThanOrEqual(30));
  });

  it('puts each one on the deck within the edges (1 m up), or on the Pilot’s flight over a Gap', () => {
    for (const [i, x] of track.shards.entries()) {
      if (x.h !== 1) expect(Math.min(...path.map(p => p.distanceTo(at[i]))), `shard ${i}`).toBeLessThan(1); // in flight
      else { expect(T.gap[sample(x.s)], `shard ${i}`).toBe(false); expect(Math.abs(x.d), `shard ${i}`).toBeLessThanOrEqual(T.halfWidth - 0.9); }
    }
  });

  it('lets the Pilot, keeping to the centre line, collect every shard on its line and in its flight', () => {
    expect(st.respawns).toBe(0);
    for (const [i, x] of track.shards.entries()) if (Math.abs(x.d) <= 1.5 || x.h !== 1) expect(touched.has(i), `shard ${i}`).toBe(true);
  });
});

describe('touchedShard', () => {
  const at = [new Vector3(0, 1, 0), new Vector3(0, 1, 10)];
  it('finds the first unfound shard within reach', () => {
    expect(touchedShard(new Vector3(0, 0, 0), at, new Set())).toBe(0);
    expect(touchedShard(new Vector3(0, 0, 0), at, new Set([0]))).toBeNull();
    expect(touchedShard(new Vector3(0, 1, 10 - SHARD_RADIUS + 0.1), at, new Set())).toBe(1);
    expect(touchedShard(new Vector3(0, 1, 5), at, new Set())).toBeNull();
  });
});

describe('found storage', () => {
  const memory = (init: Record<string, string> = {}) => {
    const m = new Map(Object.entries(init));
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
  };
  it('round-trips the found shards per Track', () => {
    const s = memory();
    saveFound(s, { allround: new Set([3, 0]), climb: new Set() });
    expect(JSON.parse(s.getItem(SHARDS_KEY)!)).toEqual({ allround: [0, 3], climb: [] });
    expect(loadFound(s).allround).toEqual(new Set([0, 3]));
  });
  it('reads nothing found with storage blocked, missing or holding garbage; skips bad entries', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(loadFound(null)).toEqual({});
    expect(loadFound(blocked)).toEqual({});
    expect(() => saveFound(blocked, {})).not.toThrow();
    expect(loadFound(memory({ [SHARDS_KEY]: '{oops' }))).toEqual({});
    expect(loadFound(memory({ [SHARDS_KEY]: '[1,2]' }))).toEqual({});
    expect(loadFound(memory({ [SHARDS_KEY]: '{"a":[1,-1,2.5,"x",4],"b":"no"}' }))).toEqual({ a: new Set([1, 4]) });
  });
});
