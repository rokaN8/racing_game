// Headless driver standing in for the player, for any Track: full throttle, steering to the centre line;
// Boost in the last 40 m before each Gap (if asked); in the air it pitches the nose onto the flight path (if asked),
// like a player lining up a landing, or holds a fixed pitch.
import { MathUtils } from 'three';
import type { Track } from '../src/track/bake';
import { cornerPull, step, type BikeState, type Input } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';

export const DT = 1 / 120;
export const NONE: Input = { throttle: 0, brake: 0, steer: 0, pitch: 0, boost: false };
export interface Pilot { boost?: boolean; airControl?: boolean; pitch?: number }
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

  function pilot(st: BikeState, o: Pilot): Input {
    if (st.mode === 'air') {
      if (o.pitch !== undefined) return { ...NONE, pitch: o.pitch };
      if (!o.airControl) return NONE;
      const v = st.vel.clone().applyQuaternion(st.quat.clone().invert()).normalize(); // flight path, Bike-local
      return { ...NONE, pitch: MathUtils.clamp(-v.y * 10, -1, 1) };
    }
    const boost = !!o.boost && gaps.some(([a]) => st.s > a - 40 && st.s < a);
    return { ...NONE, throttle: 1, steer: steerToCentre(st), boost };
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
