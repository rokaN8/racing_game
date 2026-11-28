// High scores and Ghost for one Track at one lap count (docs/game-spec.md → Storage). Keeps the top 5 run times (each
// with its lap splits) and best Sectors in localStorage, read at once, and the recording of the fastest run, the Ghost,
// in the Ghost store (IndexedDB), loaded when a run on the Track starts. The stored Ghost carries its #1's time and
// date, so the two can never disagree. Records the Bike's pose every physics step and replays the Ghost sample by sample in step with the
// current run. Also keeps the Ghost's Checkpoint splits over the whole run, so each Checkpoint can show the time
// against it. With no Ghost of your own, the Pilot Ghost stands in (docs/game-spec.md → Pilot Ghost). No rendering, no DOM.
import type { Quaternion, Vector3 } from 'three';
import { launchAtGo, newState, step } from './bike/physics';
import { ROCKET_WINDOW, TUNING } from './bike/tuning';
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
// The localStorage record. sectors: the best time ridden in each Sector (Checkpoint pass to the next, the last to the
// finish) by any finished run; missing on a record from before Sectors. ghost: only on a record from before the Ghost
// store (poses, dist as base64 Float32Array), moved to the store when its Track loads.
interface Inline { poses: string; splits: number[]; dist?: string }
interface Saved { scores: Score[]; ghost?: Inline | null; sectors?: number[] }

// Where Ghosts are kept (docs/game-spec.md → Storage): IndexedDB through ghostStore.ts, or a test's in-memory one. Each
// key holds the Ghost with its #1's time and date, so a Ghost that no longer belongs to the #1 is dropped on load.
// get() resolves undefined and put() false on any failure, and either may never settle (a blocked or hung database).
export interface StoredGhost extends Recording { time: number; date: number | null }
export interface GhostStore { get(key: string): Promise<unknown>; put(key: string, ghost: StoredGhost): Promise<boolean>; delete(key: string): void }

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// The running max of a Ghost's run distances (a respawn sends them back), so the live gap can binary search where it
// first got somewhere. Worked out once per Ghost.
const reaches = new WeakMap<Float32Array, Float32Array>();
function reach(dist: Float32Array) {
  let r = reaches.get(dist);
  if (!r) {
    r = new Float32Array(dist.length / 2);
    for (let k = 0, most = -Infinity; k < r.length; k++) r[k] = most = Math.max(most, dist[2 * k]);
    reaches.set(dist, r);
  }
  return r;
}

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

// Whole `stride`-float records, all finite, or null.
const floats = (v: unknown, stride: number) =>
  v instanceof Float32Array && v.length > 0 && v.length % stride === 0 && v.every(Number.isFinite) ? v : null;
// Base64 of whole `stride`-float records, or null.
function decode(b64: unknown, stride: number): Float32Array | null {
  try {
    const bin = atob(b64 as string), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return floats(new Float32Array(bytes.buffer), stride); // throws on a length that isn't whole floats
  } catch { return null; }
}
const cleanSplits = (splits: unknown) => (Array.isArray(splits) && splits.every(finite) ? splits : []);
// A Ghost store value, or null when it's garbage.
function fromStore(v: unknown): StoredGhost | null {
  const r = v as Partial<StoredGhost> | null | undefined, poses = floats(r?.poses, STRIDE);
  if (!r || !poses || !finite(r.time) || !(r.date === null || finite(r.date))) return null;
  return { time: r.time, date: r.date, poses, splits: cleanSplits(r.splits), dist: floats(r.dist, 2) };
}

// A Track's saved record, or empty when missing or garbage. A Ghost or Sectors that don't decode are dropped; the
// times stay. inline: the raw Ghost of a record from before the Ghost store, while it decodes.
function readRecord(storage: Storage | null, track: GhostTrack, laps: number): { scores: Score[]; ghost: Recording | null; inline: Inline | null; sectors: number[] } {
  const none = { scores: [], ghost: null, inline: null, sectors: [] };
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
      inline: poses && ghost!, sectors: sec.length === laps * track.cpS.length ? sec : [],
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

export function createGhost(storage: Storage | null, track: GhostTrack, laps = 1, now = () => Date.now(), store: GhostStore | null = null) {
  const key = KEY(track.id, laps);
  let { scores, ghost, inline, sectors } = readRecord(storage, track, laps);
  let loading: Promise<void> | null = null;
  let incoming: StoredGhost | null = null;          // the stored Ghost once load() has it, raced from the next run's start
  const isOurs = (g: StoredGhost) => g.time === scores[0]?.time && g.date === scores[0].date; // it belongs to the #1
  // The times, plus an inline Ghost until the Ghost store has it.
  const writeRecord = () => write(storage, key, JSON.stringify({ scores, sectors, ...(inline && { ghost: inline }) } satisfies Saved));
  let pilot: Recording | null = null;               // the Pilot Ghost: raced while there's no Ghost of your own
  const rival = () => ghost ?? pilot;
  // Recording stops at 5 min a Lap (the Pilot's give-up too), so a run that never finishes stops growing (~24 MB/hour);
  // a run that long still ranks but keeps no Ghost.
  const CAP = (laps * 300 / DT) * STRIDE;
  let recording: number[] = [], splits = [0], cpSeen = 1, lapTimes: number[] = [], seenLaps = 0;
  let dist: number[] = [], far = 0, was = [0, 0]; // distance samples; the furthest yet; last step's [distance, time]
  let lastRun: number[] | null = null; // the last finished run's lap times
  let lastRank: number | null = null;  // the last finished run's place in the top 5 (1-5), or null outside it
  const newRun = () => { recording = []; splits = [0]; cpSeen = 1; lapTimes = []; dist = []; far = 0; was = [0, 0]; };
  const sum = (xs: readonly number[], from = 0) => xs.reduce((a, b) => a + b, from);
  // Where the run is (call after this step's record()): [run distance, run time]
  const runAt = (bike: Pick<BikePose, 's' | 'lapTime'>) => [lapTimes.length * track.L + bike.s, sum(lapTimes, bike.lapTime)] as const;

  // A finished run: slot it into the top 5 (an equal time ranks below), a new #1 becomes the Ghost, and keep each
  // Sector's best (from the splits, so a respawn's penalty counts in its Sector). One write.
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
    if (rank === 0) {
      ghost = recording.length < CAP ? { poses: Float32Array.from(recording), splits, dist: Float32Array.from([...dist, laps * track.L, time]) } : null;
      inline = null;
    }
    // The times first, then the Ghost. A put that fails leaves the Ghost in memory for the session, and next load the
    // older stored one no longer matches the #1.
    writeRecord();
    if (rank === 0 && ghost) void store?.put(key, { ...ghost, time, date: scores[0].date });
  }

  return {
    // The top 5, fastest first. The HUD's best is scores[0].
    get scores(): readonly Score[] { return scores; },
    get bestTime(): number | null { return scores[0]?.time ?? null; },
    // Ideal time: the best Sectors added up. Null with none, or while above the #1 time (scores from before Sectors).
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

    // Fetch this Track and lap count's Ghost from the Ghost store, once (main.ts: when a run on the Track starts).
    // A record from before the Ghost store has its Ghost inline (raced straight away): move it to the store, and take
    // it out of localStorage once the store has it. Done again on the next load if that fails or the tab closes first.
    load() {
      return loading ??= (async () => {
        if (!inline) { incoming = fromStore(await store?.get(key)); return; }
        if (await store?.put(key, { ...ghost!, time: scores[0].time, date: scores[0].date }) && inline) { inline = null; writeRecord(); }
      })();
    },

    // Call once per physics step, after step(). Crossing the line closes a Lap; closing the last Lap ranks the run.
    // Returns the time against the Ghost when this step first passes a Checkpoint (- = ahead), else null.
    record(bike: BikePose) {
      let split: number | null = null;
      if (incoming && !recording.length) { if (isOurs(incoming)) ghost ??= incoming; incoming = null; } // only from a run's first step
      if (bike.laps < seenLaps) newRun();
      if (bike.laps > seenLaps && bike.lastLap !== null) {
        lapTimes = [...lapTimes, bike.lastLap]; cpSeen = 0; // the start line is this Lap's first Checkpoint pass
        if (lapTimes.length === laps) { finishRun(); newRun(); }
      }
      seenLaps = bike.laps;
      // A respawn goes back to lastCP, never past it, so it can't pass a Checkpoint twice.
      const [d, runTime] = runAt(bike);
      for (; bike.lastCP >= cpSeen; cpSeen++) {
        const ref = rival()?.splits[splits.length];
        splits.push(runTime);
        split = ref === undefined ? null : runTime - ref;
      }
      // The run distance every 12th step, plus the furthest point before it goes back (a respawn), which a 10 Hz
      // sample could miss: the live gap looks up where the Ghost first got.
      if (recording.length >= CAP) return split;
      if (d < was[0] && was[0] >= far) dist.push(...was);
      if (!((recording.length / STRIDE) % DIST_EVERY)) dist.push(d, runTime);
      far = Math.max(far, d); was = [d, runTime];
      recording.push(bike.pos.x, bike.pos.y, bike.pos.z, bike.quat.x, bike.quat.y, bike.quat.z, bike.quat.w);
      return split;
    },

    // The live gap: the run time now minus the Ghost's when it first got as far round as the Bike is (- = ahead).
    // Null with no Ghost, or one saved without distances. Call after record().
    liveGap(bike: Pick<BikePose, 's' | 'lapTime'>) {
      const D = rival()?.dist;
      if (!D) return null;
      const [x, now] = runAt(bike), reached = reach(D);
      let lo = 0, hi = reached.length; // the first sample as far round as x
      while (lo < hi) { const mid = (lo + hi) >> 1; if (reached[mid] >= x) hi = mid; else lo = mid + 1; }
      if (lo === reached.length) return null; // past where its record ends
      const j = 2 * lo, d0 = j ? D[j - 2] : 0, t0 = j ? D[j - 1] : 0; // the sample before is short of x: interpolate
      return now - (t0 + ((D[j + 1] - t0) * (x - d0)) / (D[j] - d0 || 1));
    },

    // Start a fresh run (a retry from the line): drops the run's recording without closing it.
    restart() { newRun(); seenLaps = 0; },

    // Reset these High scores: times and Ghost, in memory and in storage.
    // A failed delete is harmless: with no #1 a stored Ghost is never raced.
    clear() { scores = []; ghost = null; inline = null; sectors = []; remove(storage, key); store?.delete(key); },

    // PROTOTYPE (#82, Ghost line): the rival's poses and the pose index where it first got as far round as the Bike.
    // ponytail: dist index × DIST_EVERY ≈ pose index, off by a few steps after a respawn's extra sample.
    lineAhead(bike: Pick<BikePose, 's' | 'lapTime'>) {
      const r = rival(); if (!r?.dist) return null;
      const [x] = runAt(bike), reached = reach(r.dist);
      let lo = 0, hi = reached.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (reached[mid] >= x) hi = mid; else lo = mid + 1; }
      return lo === reached.length ? null : { poses: r.poses, from: Math.max(0, lo - 1) * DIST_EVERY * STRIDE };
    },

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
// time. A generator, so main.ts can spread a run's ~30,000 steps over frames: it pauses every 60 steps. A Pilot that
// hasn't finished in 5 minutes a Lap gives up with an empty run (no Ghost) rather than hang the game at GO; the
// shared Track checks keep every Pilot finishing clean.
export function* pilotRun(T: Track, profile: Pilot, laps: number): Generator<void, Recording> {
  const rec = createGhost(null, { id: 'pilot', L: T.L, cpS: T.cpS }, laps), st = newState(T), { pilot } = createPilot(T);
  launchAtGo(st, ROCKET_WINDOW / 2); // the Pilot always gets its Rocket start
  for (let i = 1; !rec.recording && i < (laps * 300) / DT; i++) {
    step(st, pilot(st, profile), TUNING, T, DT);
    rec.record(st);
    if (i % 60 === 0) yield;
  }
  return rec.recording ?? { poses: new Float32Array(), splits: [], dist: null };
}
