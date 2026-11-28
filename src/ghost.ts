// High scores and Ghost for one Track at one lap count (docs/game-spec.md → Storage). Keeps the top 5 run times (each
// with its lap splits) and the recording of the fastest run, the Ghost, together under one storage key, so they can
// never disagree. Records the Bike's pose every physics step and replays the Ghost sample by sample in step with the
// current run. Also keeps the Ghost's Checkpoint splits over the whole run, so each Checkpoint can show the time
// against it. With no Ghost of your own, the Pilot Ghost stands in (docs/game-spec.md → Pilot Ghost). No rendering, no DOM.
import type { Quaternion, Vector3 } from 'three';
import { newState, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { createPilot, DT, type Pilot } from './pilot';
import type { Track } from './track/bake';

// 1 lap keeps the key from before lap counts: those records are 1-lap runs.
const KEY = (trackId: string, laps: number) => `neon-racer.track.${trackId}${laps === 1 ? '' : `.${laps}laps`}.v1`;
const OLD_KEYS = ['neon-racer.ghost.v2', 'neon-racer.ghost.v1']; // before Tracks: one best Lap (v1 had no splits)
const MAX_SCORES = 5;
const STRIDE = 7; // pos xyz + quat xyzw per sample
const DIST_EVERY = 12; // physics steps per run-distance sample: 10 Hz

interface BikePose { laps: number; lastLap: number | null; lastCP: number; lapTime: number; s: number; pos: Vector3; quat: Quaternion }
// time: the run's total; lapTimes: each Lap's time; date: epoch ms, null for a Lap migrated from before dates
export interface Score { time: number; date: number | null; lapTimes: number[] }
// splits[k]: the run time at the run's k-th Checkpoint pass, each Lap's start line included (so splits[0] = 0).
// dist: [run distance, run time] pairs at 10 Hz, for the live gap; the time, since the run clock carries the penalties.
// Null for a Ghost saved before there were distances.
export interface Recording { poses: Float32Array; splits: number[]; dist: Float32Array | null }
// poses, dist: base64 Float32Array. sectors: the best time ridden in each sector (Checkpoint pass to the next, the
// last to the finish) by any finished run; missing on a record from before sectors.
interface Saved { scores: Score[]; ghost: { poses: string; splits: number[]; dist?: string } | null; sectors?: number[] }

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

// Base64 of whole `stride`-float records, or null.
function decode(b64: unknown, stride: number): Float32Array | null {
  try {
    const bin = atob(b64 as string), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const floats = new Float32Array(bytes.buffer); // throws on a length that isn't whole floats
    return floats.length && !(floats.length % stride) && floats.every(Number.isFinite) ? floats : null;
  } catch { return null; }
}
function encode(floats: Float32Array) {
  const bytes = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin); // ~180 KB for a 40 s Lap
}
const cleanSplits = (splits: unknown) => (Array.isArray(splits) && splits.every(finite) ? splits : []);

// A Track's saved record, or empty when missing or garbage. A Ghost or sectors that don't decode are dropped; the
// times stay.
function load(storage: Storage | null, track: GhostTrack, laps: number): { scores: Score[]; ghost: Recording | null; sectors: number[] } {
  const none = { scores: [], ghost: null, sectors: [] };
  try {
    const { scores, ghost, sectors } = JSON.parse(read(storage, KEY(track.id, laps)) ?? 'null') as Saved;
    if (!Array.isArray(scores)) return none;
    // a 1-lap score saved before lap splits is its own only split
    const ok = scores.map(s => ({ time: s?.time, date: s?.date, lapTimes: s?.lapTimes ?? (laps === 1 ? [s?.time] : null) }))
      .filter((s): s is Score => finite(s.time) && (s.date === null || finite(s.date))
        && Array.isArray(s.lapTimes) && s.lapTimes.length === laps && s.lapTimes.every(finite))
      .slice(0, MAX_SCORES);
    if (ok.length !== scores.length || ok.some((s, i) => i && s.time < ok[i - 1].time)) return none;
    const poses = ok.length ? decode(ghost?.poses, STRIDE) : null;
    const sec = cleanSplits(sectors);
    return {
      scores: ok, ghost: poses && { poses, splits: cleanSplits(ghost!.splits), dist: decode(ghost!.dist, 2) },
      sectors: sec.length === laps * track.cpS.length ? sec : [],
    };
  } catch { return none; }
}

// Once, at boot: the best Lap saved before there were Tracks becomes Overdrive's #1 (undated).
// The old keys go only after the new record is written, so a failed write leaves them for the next try.
export function migrateOldGhost(storage: Storage | null, trackId: string) {
  const old = OLD_KEYS.map(k => read(storage, k)).find(Boolean);
  if (!old || read(storage, KEY(trackId, 1)) !== null) return;
  try {
    const { time, poses, splits } = JSON.parse(old) as { time: unknown; poses: unknown; splits?: unknown };
    if (!finite(time) || !decode(poses, STRIDE)) return;
    const rec: Saved = { scores: [{ time, date: null, lapTimes: [time] }], ghost: { poses: poses as string, splits: cleanSplits(splits) } };
    if (write(storage, KEY(trackId, 1), JSON.stringify(rec))) OLD_KEYS.forEach(k => remove(storage, k));
  } catch { /* garbage: leave it */ }
}

// The Track as the Ghost needs it: its storage id, its length (for the run distance) and its Checkpoints.
export interface GhostTrack { id: string; L: number; cpS: readonly number[] }

export function createGhost(storage: Storage | null, track: GhostTrack, laps = 1, now = () => Date.now()) {
  const key = KEY(track.id, laps);
  let { scores, ghost, sectors } = load(storage, track, laps);
  const save = (r: Recording) => ({ poses: encode(r.poses), splits: r.splits, ...(r.dist && { dist: encode(r.dist) }) });
  let saved = ghost && save(ghost); // kept so a finish outside #1 doesn't re-encode the Ghost
  let pilot: Recording | null = null;               // the Pilot Ghost: raced while there's no Ghost of your own
  const rival = () => ghost ?? pilot;
  // ponytail: the recording grows until the run ends (~24 MB/hour of never finishing); cap it if that ever matters.
  let recording: number[] = [], splits = [0], cpSeen = 1, lapTimes: number[] = [], seenLaps = 0;
  let dist: number[] = [], far = 0, was = [0, 0]; // distance samples; the furthest yet; last step's [distance, time]
  let lastRun: number[] | null = null; // the last finished run's lap times
  let lastRank: number | null = null;  // the last finished run's place in the top 5 (1-5), or null outside it
  const newRun = () => { recording = []; splits = [0]; cpSeen = 1; lapTimes = []; dist = []; far = 0; was = [0, 0]; };
  const sum = (xs: readonly number[], from = 0) => xs.reduce((a, b) => a + b, from);

  // A finished run: slot it into the top 5 (an equal time ranks below), a new #1 becomes the Ghost, and keep each
  // sector's best (from the splits, so a respawn's penalty counts in its sector). One write.
  function finishRun() {
    const time = sum(lapTimes);
    lastRun = lapTimes;
    const ran = splits.map((t, k) => (splits[k + 1] ?? time) - t);
    const best = ran.length === sectors.length ? ran.map((t, k) => Math.min(t, sectors[k])) : ran;
    const faster = best.some((t, k) => t !== sectors[k]);
    sectors = best;
    let rank = scores.findIndex(s => time < s.time);
    if (rank < 0) rank = scores.length;
    lastRank = rank < MAX_SCORES ? rank + 1 : null;
    if (rank >= MAX_SCORES && !faster) return;
    if (rank < MAX_SCORES) scores = [...scores.slice(0, rank), { time, date: now(), lapTimes }, ...scores.slice(rank)].slice(0, MAX_SCORES);
    if (rank === 0) { ghost = { poses: Float32Array.from(recording), splits, dist: Float32Array.from([...dist, laps * track.L, time]) }; saved = storage && save(ghost); }
    if (!storage) return; // memory only (the Pilot's run): don't encode ~1 MB for nowhere
    // ponytail: a 5-lap Ghost is ~1.2 MB of base64 and every Track × lap count keeps one, which can pass the ~5 MB quota.
    // Then the times are saved without it and the Ghost lives in memory only. Record at 60 Hz if that bites.
    const rec: Saved = { scores, ghost: saved, sectors };
    if (!write(storage, key, JSON.stringify(rec)) && ghost) write(storage, key, JSON.stringify({ ...rec, ghost: null }));
  }

  return {
    // The top 5, fastest first. The HUD's best is scores[0].
    get scores(): readonly Score[] { return scores; },
    get bestTime(): number | null { return scores[0]?.time ?? null; },
    // Ideal time: the best sectors added up. Null with none, or while above the #1 time (scores from before sectors).
    get idealTime(): number | null {
      const ideal = sum(sectors);
      return sectors.length && scores.length && ideal <= scores[0].time + 1e-9 ? ideal : null;
    },
    get lastRank() { return lastRank; },
    get lastRun(): readonly number[] | null { return lastRun; },
    get run(): readonly number[] { return lapTimes; }, // the current run's finished Laps
    get recording(): Recording | null { return ghost; }, // your own Ghost's
    // The Pilot Ghost: kept for the session (it's never stored, nor ranked), raced whenever you have no Ghost.
    get needsPilot() { return !ghost && !pilot; },
    setPilot(run: Recording) { pilot = run; },

    // Call once per physics step, after step(). Crossing the line closes a Lap; closing the last Lap ranks the run.
    // Returns the time against the Ghost when this step first passes a Checkpoint (- = ahead), else null.
    record(bike: BikePose) {
      let split: number | null = null;
      if (bike.laps < seenLaps) newRun();
      if (bike.laps > seenLaps && bike.lastLap !== null) {
        lapTimes = [...lapTimes, bike.lastLap]; cpSeen = 0; // the start line is this Lap's first Checkpoint pass
        if (lapTimes.length === laps) { finishRun(); newRun(); }
      }
      seenLaps = bike.laps;
      // A respawn goes back to lastCP, never past it, so it can't pass a Checkpoint twice.
      const runTime = sum(lapTimes, bike.lapTime);
      for (; bike.lastCP >= cpSeen; cpSeen++) {
        const ref = rival()?.splits[splits.length];
        splits.push(runTime);
        split = ref === undefined ? null : runTime - ref;
      }
      // The run distance every 12th step, plus the furthest point before it goes back (a respawn), which a 10 Hz
      // sample could miss: the live gap looks up where the Ghost first got.
      const d = lapTimes.length * track.L + bike.s;
      if (d < was[0] && was[0] >= far) dist.push(...was);
      if (!((recording.length / STRIDE) % DIST_EVERY)) dist.push(d, runTime);
      far = Math.max(far, d); was = [d, runTime];
      recording.push(bike.pos.x, bike.pos.y, bike.pos.z, bike.quat.x, bike.quat.y, bike.quat.z, bike.quat.w);
      return split;
    },

    // The live gap: the run time now minus the Ghost's when it first got as far round as the Bike is (- = ahead).
    // Null with no Ghost, or one saved without distances. Call after record().
    gap(bike: Pick<BikePose, 's' | 'lapTime'>) {
      const D = rival()?.dist;
      if (!D) return null;
      const x = lapTimes.length * track.L + bike.s;
      // ponytail: a linear scan (~2,700 pairs for 5 Laps, read 10x a second); binary search a running max if it shows.
      for (let j = 0; j < D.length; j += 2) if (D[j] >= x) {
        const d0 = j ? D[j - 2] : 0, t0 = j ? D[j - 1] : 0; // the sample before is short of x: interpolate
        return sum(lapTimes, bike.lapTime) - (t0 + ((D[j + 1] - t0) * (x - d0)) / (D[j] - d0 || 1));
      }
      return null;
    },

    // Start a fresh run (a retry from the line): drops the run's recording without closing it.
    restart() { newRun(); seenLaps = 0; },

    // Reset these High scores: times and Ghost, in memory and in storage.
    clear() { scores = []; ghost = null; saved = null; sectors = []; remove(storage, key); },

    // The Ghost's pose at the current run's step. False when there is no Ghost or it has finished.
    pose(pos: Vector3, quat: Quaternion) {
      const i = recording.length - STRIDE, r = rival();
      if (!r || i < 0 || i + STRIDE > r.poses.length) return false;
      const p = r.poses;
      pos.set(p[i], p[i + 1], p[i + 2]); quat.set(p[i + 3], p[i + 4], p[i + 5], p[i + 6]);
      return true;
    },
  };
}

// The Pilot Ghost's run: the Pilot rides `laps` Laps of the Track its own way (TrackDef.pilot), recorded through
// record() like any run. It's computed, never stored: physics is pure and fixed-step, so it comes out the same every
// time. A generator, so main.ts can spread a run's ~30,000 steps over frames: it pauses every 60 steps.
export function* pilotRun(T: Track, profile: Pilot, laps: number): Generator<void, Recording> {
  const rec = createGhost(null, { id: 'pilot', L: T.L, cpS: T.cpS }, laps), st = newState(T), { pilot } = createPilot(T);
  for (let i = 1; !rec.recording; i++) {
    step(st, pilot(st, profile), TUNING, T, DT);
    rec.record(st);
    if (i % 60 === 0) yield;
  }
  return rec.recording;
}
