// Headless driver standing in for the player, for any Track: full throttle, steering to the centre line; braking for
// turns too tight to hold (if asked); Boost in the last 40 m before each Gap, or on straights (if asked); in the air it
// pitches the nose onto the flight path (if asked), like a player lining up a landing, or holds a fixed pitch.
import { MathUtils } from 'three';
import type { Track } from './track/bake';
import { cornerPull, step, type BikeState, type Input } from './bike/physics';
import { TUNING } from './bike/tuning';

export const DT = 1 / 120;
export const NONE: Input = { throttle: 0, brake: 0, steer: 0, pitch: 0, boost: false };
export interface Pilot { boost?: boolean; boostStraights?: boolean; brakes?: boolean; airControl?: boolean; pitch?: number }
export const BOOSTED: Pilot = { airControl: true, boost: true };
export interface RideEvent { kind: 'launch' | 'land' | 'respawn'; s: number; msg: string; lapTimeJump: number }
export const lapDone = (st: BikeState) => st.laps > 0;

// Each Gap as [start, end] distances along the Track.
export function gapsOf(T: Track) {
  const gaps: [number, number][] = [];
  for (let i = 0; i < T.N; i++) if (T.gap[i] && !T.gap[i - 1]) {
    let j = i; while (T.gap[j]) j++;
    gaps.push([i * T.ds, j * T.ds]);
  }
  return gaps;
}

export function createPilot(T: Track) {
  const gaps = gapsOf(T);

  // Cancel the Cornering pull and steer back to the centre line.
  const steerToCentre = (st: BikeState) => {
    const target = -st.d - cornerPull(T, st.s, st.speed, TUNING) / TUNING.steerResponse; // wanted latVel, minus the pull's share
    return MathUtils.clamp(target / (TUNING.steerRate * Math.max(0.1, Math.min(1, Math.abs(st.speed) / 10))), -1, 1);
  };

  // The fastest the Bike may go here: every turn in the next 200 m stays reachable, braking at 85% of brake, and is
  // taken at 85% of the speed full steer can hold (speed² × pull per speed² ≤ steerRate × steerResponse).
  // ponytail: cached per sample, read at the sample just ahead (the turns up to a sample closer, so on the safe side):
  // the 200 m scan every step made a 5-Lap run cost over a second, too slow to build the Pilot Ghost in the game.
  const HOLD = TUNING.steerRate * TUNING.steerResponse, safe: number[] = [];
  function safeSpeed(s: number) {
    const i = Math.ceil(s / T.ds) % T.N;
    if (safe[i] !== undefined) return safe[i];
    let v = Infinity;
    for (let ds = 0; ds < 200; ds += 2) {
      const k = Math.abs(cornerPull(T, i * T.ds + ds, 1, TUNING));
      if (k < 1e-5) continue;
      const vt = 0.85 * Math.sqrt(HOLD / k);
      v = Math.min(v, Math.sqrt(vt * vt + 2 * 0.85 * TUNING.brake * ds));
    }
    return (safe[i] = v);
  }

  function pilot(st: BikeState, o: Pilot): Input {
    if (st.mode === 'air') {
      if (o.pitch !== undefined) return { ...NONE, pitch: o.pitch };
      if (!o.airControl) return NONE;
      const v = st.vel.clone().applyQuaternion(st.quat.clone().invert()).normalize(); // flight path, Bike-local
      return { ...NONE, pitch: MathUtils.clamp(-v.y * 10, -1, 1) };
    }
    const safe = o.brakes || o.boostStraights ? safeSpeed(st.s) : Infinity, over = !!o.brakes && st.speed > safe;
    const boost = (!!o.boost && gaps.some(([a]) => st.s > a - 40 && st.s < a)) || (!!o.boostStraights && safe > 90);
    return { ...NONE, throttle: over ? 0 : 1, brake: over ? 1 : 0, steer: steerToCentre(st), boost };
  }

  // Ride until `done` (or 90 s), logging every launch, landing and respawn.
  function ride(st: BikeState, o: Pilot, done: (st: BikeState) => boolean) {
    const events: RideEvent[] = [];
    for (let i = 0; i < 120 * 90 && !done(st); i++) {
      const mode = st.mode, respawns = st.respawns, lapTime = st.lapTime;
      step(st, pilot(st, o), TUNING, T, DT);
      const e = { s: st.s, msg: st.msg, lapTimeJump: st.lapTime - lapTime };
      if (st.respawns > respawns) events.push({ kind: 'respawn', ...e });
      else if (st.mode !== mode) events.push({ kind: st.mode === 'air' ? 'launch' : 'land', ...e });
    }
    return events;
  }

  return { gaps, steerToCentre, pilot, ride };
}
