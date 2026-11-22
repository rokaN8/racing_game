// High scores and Ghost for one Track (docs/game-spec.md → Storage). Keeps the Track's top 5 Lap times and the
// recording of the fastest one, the Ghost, together under one storage key, so they can never disagree.
// Records the Bike's pose every physics step and replays the Ghost sample by sample in step with the current run.
// Also keeps the Ghost's Checkpoint splits, so each Checkpoint can show the time against it. No rendering, no DOM.
import type { Quaternion, Vector3 } from 'three';

const KEY = (trackId: string) => `neon-racer.track.${trackId}.v1`;
const OLD_KEYS = ['neon-racer.ghost.v2', 'neon-racer.ghost.v1']; // before Tracks: one best Lap (v1 had no splits)
const MAX_SCORES = 5;
const STRIDE = 7; // pos xyz + quat xyzw per sample

interface BikePose { laps: number; lastLap: number | null; lastCP: number; lapTime: number; pos: Vector3; quat: Quaternion }
export interface Score { time: number; date: number | null } // date: epoch ms; null for a Lap migrated from before dates
// splits[i]: the Lap time at the first pass of Checkpoint i (Checkpoint 0 is the start line, so splits[0] = 0)
interface Recording { poses: Float32Array; splits: number[] }
interface Saved { scores: Score[]; ghost: { poses: string; splits: number[] } | null } // poses: base64 Float32Array

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Every storage call is guarded: the game must run with storage blocked, missing or holding garbage.
function read(storage: Storage | null, key: string): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function write(storage: Storage | null, key: string, value: string) {
  try { storage?.setItem(key, value); return !!storage; } catch { return false; } // blocked or full: memory only
}
function remove(storage: Storage | null, key: string) {
  try { storage?.removeItem(key); } catch { /* blocked: nothing to remove */ }
}

function decodePoses(b64: unknown): Float32Array | null {
  try {
    const bin = atob(b64 as string), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const poses = new Float32Array(bytes.buffer); // throws on a length that isn't whole floats
    return poses.length && !(poses.length % STRIDE) && poses.every(Number.isFinite) ? poses : null;
  } catch { return null; }
}
function encodePoses(poses: Float32Array) {
  const bytes = new Uint8Array(poses.buffer, poses.byteOffset, poses.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin); // ~180 KB for a 40 s Lap
}
const cleanSplits = (splits: unknown) => (Array.isArray(splits) && splits.every(finite) ? splits : []);

// A Track's saved record, or empty when missing or garbage. A Ghost that doesn't decode is dropped; its times stay.
function load(storage: Storage | null, trackId: string): { scores: Score[]; ghost: Recording | null } {
  try {
    const { scores, ghost } = JSON.parse(read(storage, KEY(trackId)) ?? 'null') as Saved;
    if (!Array.isArray(scores)) return { scores: [], ghost: null };
    const ok = scores.filter(s => finite(s?.time) && (s.date === null || finite(s.date)))
      .map(s => ({ time: s.time, date: s.date })).slice(0, MAX_SCORES);
    if (ok.length !== scores.length || ok.some((s, i) => i && s.time < ok[i - 1].time)) return { scores: [], ghost: null };
    const poses = ok.length ? decodePoses(ghost?.poses) : null;
    return { scores: ok, ghost: poses && { poses, splits: cleanSplits(ghost!.splits) } };
  } catch { return { scores: [], ghost: null }; }
}

// Once, at boot: the best Lap saved before there were Tracks becomes Overdrive's #1 (undated).
// The old keys go only after the new record is written, so a failed write leaves them for the next try.
export function migrateOldGhost(storage: Storage | null, trackId: string) {
  const old = OLD_KEYS.map(k => read(storage, k)).find(Boolean);
  if (!old || read(storage, KEY(trackId)) !== null) return;
  try {
    const { time, poses, splits } = JSON.parse(old) as { time: unknown; poses: unknown; splits?: unknown };
    if (!finite(time) || !decodePoses(poses)) return;
    const saved: Saved = { scores: [{ time, date: null }], ghost: { poses: poses as string, splits: cleanSplits(splits) } };
    if (write(storage, KEY(trackId), JSON.stringify(saved))) OLD_KEYS.forEach(k => remove(storage, k));
  } catch { /* garbage: leave it */ }
}

export function createGhost(storage: Storage | null, trackId: string, now = () => Date.now()) {
  let { scores, ghost } = load(storage, trackId);
  let ghostB64 = ghost && encodePoses(ghost.poses); // kept so a finish outside #1 doesn't re-encode the Ghost
  // ponytail: the recording grows until the line is crossed (~24 MB/hour of never finishing a Lap); cap it if that ever matters.
  let recording: number[] = [], splits = [0], seenLaps = 0;

  // A finished Lap: slot it into the top 5 (an equal time ranks below), a new #1 becomes the Ghost. One write.
  function finishLap(time: number) {
    let rank = scores.findIndex(s => time < s.time);
    if (rank < 0) rank = scores.length;
    if (rank >= MAX_SCORES) return;
    scores = [...scores.slice(0, rank), { time, date: now() }, ...scores.slice(rank)].slice(0, MAX_SCORES);
    if (rank === 0) { ghost = { poses: Float32Array.from(recording), splits }; ghostB64 = encodePoses(ghost.poses); }
    const saved: Saved = { scores, ghost: ghost && { poses: ghostB64!, splits: ghost.splits } };
    write(storage, KEY(trackId), JSON.stringify(saved));
  }

  return {
    // The Track's top 5, fastest first. The HUD's best is scores[0].
    get scores(): readonly Score[] { return scores; },
    get bestTime(): number | null { return scores[0]?.time ?? null; },

    // Call once per physics step, after step(). Crossing the line closes the recording and ranks the Lap.
    // Returns the time against the Ghost when this step first passes a Checkpoint (- = ahead), else null.
    record(bike: BikePose) {
      let split: number | null = null;
      if (bike.laps !== seenLaps) {
        if (bike.lastLap !== null && bike.laps > seenLaps) finishLap(bike.lastLap);
        recording = []; splits = [0]; seenLaps = bike.laps;
      }
      // A respawn goes back to lastCP, never past it, so it can't pass a Checkpoint twice.
      while (bike.lastCP >= splits.length) {
        const ref = ghost?.splits[splits.length];
        splits.push(bike.lapTime);
        split = ref === undefined ? null : bike.lapTime - ref;
      }
      recording.push(bike.pos.x, bike.pos.y, bike.pos.z, bike.quat.x, bike.quat.y, bike.quat.z, bike.quat.w);
      return split;
    },

    // Start a fresh run (a retry from the line): drops the run's recording without closing a Lap.
    restart() { recording = []; splits = [0]; seenLaps = 0; },

    // Reset this Track's High scores: its times and its Ghost, in memory and in storage.
    clear() { scores = []; ghost = null; ghostB64 = null; remove(storage, KEY(trackId)); },

    // The Ghost's pose at the current run's step. False when there is no Ghost or it has finished.
    pose(pos: Vector3, quat: Quaternion) {
      const i = recording.length - STRIDE;
      if (!ghost || i < 0 || i + STRIDE > ghost.poses.length) return false;
      const p = ghost.poses;
      pos.set(p[i], p[i + 1], p[i + 2]); quat.set(p[i + 3], p[i + 4], p[i + 5], p[i + 6]);
      return true;
    },
  };
}
