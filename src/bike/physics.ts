// Pure Bike kinematics, ported from prototypes/bike-handling.html. No DOM, no rendering.
// M1: on-Track riding only. Detaching sets mode 'air'; Airborne motion, Gaps and Boost arrive in M2/M3.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { sampleAt, type Frame, type Track } from '../track/bake';
import { CEILING_UP_Y, type Tuning } from './tuning';

export interface Input { throttle: number; brake: number; steer: number } // throttle/brake 0..1, steer -1..1
export interface BikeState {
  mode: 'track' | 'air';
  s: number; d: number; latVel: number; speed: number;
  pos: Vector3; vel: Vector3; quat: Quaternion;
  laps: number; msg: string;
}

export const frameQuat = (f: Frame) => // Bike local: +z forward, +y up, +x left
  new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(f.u, f.t), f.u, f.t));

export function newState(T: Track): BikeState {
  const st: BikeState = { mode: 'track', s: 0, d: 0, latVel: 0, speed: 0,
    pos: new Vector3(), vel: new Vector3(), quat: new Quaternion(), laps: 0, msg: '' };
  placeOnTrack(st, T);
  return st;
}

function placeOnTrack(st: BikeState, T: Track) {
  const f = sampleAt(T, st.s);
  st.pos.copy(f.p).addScaledVector(f.r, st.d); st.quat.copy(frameQuat(f));
  return f;
}

function launch(st: BikeState, f: Frame, why: string) {
  st.mode = 'air'; st.msg = why;
  st.vel.copy(f.t).multiplyScalar(st.speed).addScaledVector(f.r, st.latVel);
}

// ponytail: M1 respawns at the start line; M2 moves this to the last Checkpoint with a penalty.
export function respawn(st: BikeState, T: Track) {
  Object.assign(st, { mode: 'track', s: 0, d: 0, latVel: 0, speed: 0 });
  placeOnTrack(st, T);
}

export function step(st: BikeState, inp: Input, P: Tuning, T: Track, dt: number) {
  if (st.mode !== 'track') return;
  let f = sampleAt(T, st.s);
  const cap = P.topSpeed;
  let a = -P.slopeGravity * f.t.y - P.drag * st.speed;
  if (st.speed < cap) a += inp.throttle * P.accel;
  if (st.speed > 0) a -= inp.brake * P.brake;
  st.speed = Math.max(-10, st.speed + a * dt);
  if (st.speed > cap) st.speed = Math.max(cap, st.speed - P.overspeedDecay * dt);

  const target = inp.steer * P.steerRate * Math.min(1, Math.abs(st.speed) / 10);
  st.latVel += (target - st.latVel) * Math.min(1, P.steerResponse * dt);
  st.d += st.latVel * dt;

  st.s += st.speed * dt;
  if (st.s >= T.L) { st.s -= T.L; st.laps++; }
  if (st.s < 0) st.s += T.L;

  f = placeOnTrack(st, T);
  if (Math.abs(st.d) > T.halfWidth) launch(st, f, 'Off the edge');
  else if (f.u.y < CEILING_UP_Y && st.speed < P.stickSpeed) launch(st, f, 'Too slow — dropped off the ceiling');
}
