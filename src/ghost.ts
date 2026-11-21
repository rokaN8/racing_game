// Ghost of the best Lap: records the Bike's pose every physics step, keeps the best Lap in memory and
// in localStorage, and replays it sample by sample in step with the current run. Also keeps the best Lap's
// Checkpoint splits, so each Checkpoint can show the time against it. No rendering, no DOM.
import type { Quaternion, Vector3 } from 'three';

const KEY = 'neon-racer.ghost.v2', OLD_KEY = 'neon-racer.ghost.v1'; // v1: same, with no splits
const STRIDE = 7; // pos xyz + quat xyzw per sample

interface BikePose { laps: number; lastLap: number | null; lastCP: number; lapTime: number; pos: Vector3; quat: Quaternion }
// splits[i]: the Lap time at the first pass of Checkpoint i (Checkpoint 0 is the start line, so splits[0] = 0)
interface Lap { time: number; poses: Float32Array; splits: number[] }

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Every storage call is guarded: the game must run with storage blocked, missing or holding garbage.
function load(storage: Storage | null): Lap | null {
  try {
    const saved = storage?.getItem(KEY) ?? storage?.getItem(OLD_KEY);
    if (!saved) return null;
    const { time, poses, splits = [] } = JSON.parse(saved) as { time: unknown; poses: string; splits?: unknown[] };
    const bin = atob(poses), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const lap = { time, poses: new Float32Array(bytes.buffer), splits }; // throws on a length that isn't whole floats
    if (!finite(time) || lap.poses.length % STRIDE || lap.poses.some(v => !Number.isFinite(v))) return null;
    if (!Array.isArray(splits) || !splits.every(finite)) lap.splits = [];
    return lap as Lap;
  } catch { return null; }
}

function save(storage: Storage | null, lap: Lap) {
  try {
    const bytes = new Uint8Array(lap.poses.buffer, lap.poses.byteOffset, lap.poses.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    storage?.setItem(KEY, JSON.stringify({ time: lap.time, poses: btoa(bin), splits: lap.splits })); // ~180 KB for a 40 s Lap
  } catch { /* storage blocked or full: keep the Ghost in memory only */ }
}

export function createGhost(storage: Storage | null) {
  let best = load(storage);
  // ponytail: the recording grows until the line is crossed (~24 MB/hour of never finishing a Lap); cap it if that ever matters.
  let recording: number[] = [], splits = [0], seenLaps = 0;

  return {
    // The stored best Lap's time, so the HUD's best survives a reload too.
    get bestTime() { return best?.time ?? null; },

    // Call once per physics step, after step(). Crossing the line closes the recording; a faster Lap becomes the Ghost.
    // Returns the time against the best Lap when this step first passes a Checkpoint (- = ahead), else null.
    record(bike: BikePose) {
      let split: number | null = null;
      if (bike.laps !== seenLaps) {
        if (bike.lastLap !== null && bike.laps > seenLaps && (!best || bike.lastLap < best.time)) {
          best = { time: bike.lastLap, poses: Float32Array.from(recording), splits };
          save(storage, best);
        }
        recording = []; splits = [0]; seenLaps = bike.laps;
      }
      // A respawn goes back to lastCP, never past it, so it can't pass a Checkpoint twice.
      while (bike.lastCP >= splits.length) {
        const ref = best?.splits[splits.length];
        splits.push(bike.lapTime);
        split = ref === undefined ? null : bike.lapTime - ref;
      }
      recording.push(bike.pos.x, bike.pos.y, bike.pos.z, bike.quat.x, bike.quat.y, bike.quat.z, bike.quat.w);
      return split;
    },

    // Start a fresh run (a retry from the line): drops the run's recording without closing a Lap.
    reset() { recording = []; splits = [0]; seenLaps = 0; },

    // The best Lap's pose at the current run's step. False when there is no Ghost or it has finished.
    pose(pos: Vector3, quat: Quaternion) {
      const i = recording.length - STRIDE;
      if (!best || i < 0 || i + STRIDE > best.poses.length) return false;
      const p = best.poses;
      pos.set(p[i], p[i + 1], p[i + 2]); quat.set(p[i + 3], p[i + 4], p[i + 5], p[i + 6]);
      return true;
    },
  };
}
