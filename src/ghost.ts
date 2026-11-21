// Ghost of the best Lap: records the Bike's pose every physics step, keeps the best Lap in memory and
// in localStorage, and replays it sample by sample in step with the current run. No rendering, no DOM.
import type { Quaternion, Vector3 } from 'three';

const KEY = 'neon-racer.ghost.v1';
const STRIDE = 7; // pos xyz + quat xyzw per sample

interface BikePose { laps: number; lastLap: number | null; pos: Vector3; quat: Quaternion }
interface Lap { time: number; poses: Float32Array }

// Every storage call is guarded: the game must run with storage blocked, missing or holding garbage.
function load(storage: Storage | null): Lap | null {
  try {
    const saved = storage?.getItem(KEY);
    if (!saved) return null;
    const { time, poses } = JSON.parse(saved) as { time: unknown; poses: string };
    const bin = atob(poses), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const lap = { time, poses: new Float32Array(bytes.buffer) }; // throws on a length that isn't whole floats
    if (typeof time !== 'number' || !Number.isFinite(time) || lap.poses.length % STRIDE || lap.poses.some(v => !Number.isFinite(v))) return null;
    return lap as Lap;
  } catch { return null; }
}

function save(storage: Storage | null, lap: Lap) {
  try {
    const bytes = new Uint8Array(lap.poses.buffer, lap.poses.byteOffset, lap.poses.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    storage?.setItem(KEY, JSON.stringify({ time: lap.time, poses: btoa(bin) })); // ~180 KB for a 40 s Lap
  } catch { /* storage blocked or full: keep the Ghost in memory only */ }
}

export function createGhost(storage: Storage | null) {
  let best = load(storage);
  // ponytail: the recording grows until the line is crossed (~24 MB/hour of never finishing a Lap); cap it if that ever matters.
  let recording: number[] = [], seenLaps = 0;

  return {
    // The stored best Lap's time, so the HUD's best survives a reload too.
    get bestTime() { return best?.time ?? null; },

    // Call once per physics step, after step(). Crossing the line closes the recording; a faster Lap becomes the Ghost.
    record(bike: BikePose) {
      if (bike.laps !== seenLaps) {
        if (bike.lastLap !== null && bike.laps > seenLaps && (!best || bike.lastLap < best.time)) {
          best = { time: bike.lastLap, poses: Float32Array.from(recording) };
          save(storage, best);
        }
        recording = []; seenLaps = bike.laps;
      }
      recording.push(bike.pos.x, bike.pos.y, bike.pos.z, bike.quat.x, bike.quat.y, bike.quat.z, bike.quat.w);
    },

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
