// Data shards (docs/game-spec.md → Data shards): glowing pickups placed by hand on each Track, collected across runs
// ("7/10 found"). Pure except for the guarded storage calls: a pickup never touches physics, the Lap or the clock.
import type { Vector3 } from 'three';
import { sampleAt, type Track } from './track/bake';

// s: distance along the Track; d: side offset (+ = the Track's right); h: height above the deck. Identified by index
// in the TrackDef's list, so never reorder them.
export interface Shard { s: number; d: number; h: number }
export const SHARD_RADIUS = 2.5, SHARDS_KEY = 'neon-racer.shards.v1';

export const shardPositions = (T: Track, shards: readonly Shard[]): Vector3[] =>
  shards.map(({ s, d, h }) => { const f = sampleAt(T, s); return f.p.addScaledVector(f.r, d).addScaledVector(f.u, h); });

// The first shard not yet found within SHARD_RADIUS of the Bike, or null.
export function touchedShard(bike: Vector3, at: readonly Vector3[], found: ReadonlySet<number>) {
  for (let i = 0; i < at.length; i++) if (!found.has(i) && at[i].distanceTo(bike) < SHARD_RADIUS) return i;
  return null;
}

// Found shards per Track id. Blocked, missing or garbage storage reads as nothing found; a bad entry alone is skipped.
export type Found = Record<string, Set<number>>;
export function loadFound(storage: Storage | null): Found {
  const out: Found = {};
  try {
    const raw: unknown = JSON.parse(storage?.getItem(SHARDS_KEY) ?? 'null');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [id, v] of Object.entries(raw)) {
      if (Array.isArray(v)) out[id] = new Set(v.filter((i): i is number => Number.isInteger(i) && i >= 0));
    }
  } catch { /* blocked or garbage: nothing found */ }
  return out;
}
export function saveFound(storage: Storage | null, found: Found) {
  try { storage?.setItem(SHARDS_KEY, JSON.stringify(Object.fromEntries(Object.entries(found).map(([id, s]) => [id, [...s].sort((a, b) => a - b)])))); }
  catch { /* blocked or full: found this session only */ }
}
