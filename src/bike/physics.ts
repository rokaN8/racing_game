// Pure Bike kinematics, ported from prototypes/bike-handling.html. No DOM, no rendering.
import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { sampleAt, type Frame, type Track } from '../track/bake';
import { BOOST_PAD_TAIL, CEILING_UP_Y, landingGrade, PERFECT_BOOST, ROCKET_SPEED, ROCKET_WINDOW, STALL_TIME, type LandingGrade, type Tuning } from './tuning';

// throttle/brake 0..1, steer -1..1, pitch -1..1 (+ = nose down; Air control only)
export interface Input { throttle: number; brake: number; steer: number; pitch: number; boost: boolean }
export interface BikeState {
  mode: 'track' | 'air';
  s: number; d: number; latVel: number; speed: number;
  pos: Vector3; vel: Vector3; quat: Quaternion;
  airT: number; lastCP: number; respawns: number;
  landOff: number; // the last landing's angle off, in degrees (rumble)
  landGrade: LandingGrade | null; // the last landing's grade (HUD colour, sound, rumble)
  fromGap: boolean; // this flight left from a Gap's lip, so a Perfect landing earns its Boost
  boostT: number; boostCD: number; // Boost time left; time until Boost is ready again
  boostLen: number; padHits: number; // the running Boost's full length (HUD meter); Boost pads ridden onto (sound)
  lapTime: number; lastLap: number | null; laps: number;
  msg: string; msgT: number; msgKind: LandingGrade | Launch | ''; // msgKind: a landing grade or the launch colours the message
  stallT: number; // a Stall at GO: throttle does nothing until this runs out
}
export type Launch = 'rocket' | 'stall';

export const frameQuat = (f: Frame) => // Bike local: +z forward, +y up, +x left
  new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(f.u, f.t), f.u, f.t));

export function newState(T: Track): BikeState {
  const st: BikeState = { mode: 'track', s: 0, d: 0, latVel: 0, speed: 0,
    pos: new Vector3(), vel: new Vector3(), quat: new Quaternion(),
    airT: 0, lastCP: 0, respawns: 0, landOff: 0, landGrade: null, fromGap: false, boostT: 0, boostCD: 0, boostLen: 1, padHits: 0, lapTime: 0, lastLap: null, laps: 0, msg: '', msgT: 0, msgKind: '', stallT: 0 };
  placeOnTrack(st, T);
  return st;
}

function placeOnTrack(st: BikeState, T: Track) {
  const f = sampleAt(T, st.s);
  st.pos.copy(f.p).addScaledVector(f.r, st.d); st.quat.copy(frameQuat(f));
  return f;
}

// Cornering pull: sideways acceleration (+ = right) pushing the Bike to the outside of a turn.
// speed² × the Track's curvature within its own surface (geodesic), scaled by how far the Track faces
// up: so a Loop (curving up, walls and ceiling) and the straight Wall-ride don't pull, and a bank softens a turn.
// Measured over ±3 m to smooth out the spline's small wiggles.
export function cornerPull(T: Track, s: number, speed: number, P: Tuning) {
  const a = sampleAt(T, s - 3), b = sampleAt(T, s + 3), f = sampleAt(T, s);
  return -P.cornerPull * speed * speed * b.t.sub(a.t).dot(f.r) / 6 * Math.max(0, f.u.y);
}

const say = (st: BikeState, m: string, kind: BikeState['msgKind'] = '') => { st.msg = m; st.msgT = 1.5; st.msgKind = kind; };

// Rocket start (docs/game-spec.md → Rocket start), judged at GO from how long the current throttle press has been held
// (null: not held). Began in the last ROCKET_WINDOW s: launch at ROCKET_SPEED. Held from earlier: Stall. Else nothing.
export function launchAtGo(st: BikeState, heldFor: number | null): Launch | null {
  if (heldFor === null) return null;
  if (heldFor <= ROCKET_WINDOW) { st.speed = ROCKET_SPEED; say(st, 'ROCKET START', 'rocket'); return 'rocket'; }
  st.stallT = STALL_TIME; say(st, 'STALLED', 'stall'); return 'stall';
}

function launch(st: BikeState, f: Frame, why?: string) {
  st.mode = 'air'; st.airT = 0; st.fromGap = !why;
  st.vel.copy(f.t).multiplyScalar(st.speed).addScaledVector(f.r, st.latVel);
  if (why) say(st, why);
}

export function respawn(st: BikeState, T: Track, P: Tuning, why: string) {
  Object.assign(st, { mode: 'track', s: T.cpS[st.lastCP], d: 0, latVel: 0, speed: P.respawnSpeed, boostT: 0, boostCD: 0, airT: 0 }); // Boost ready again
  st.lapTime += P.penalty; st.respawns++;
  say(st, `${why} · +${P.penalty}s`);
  placeOnTrack(st, T);
}

export function step(st: BikeState, inp: Input, P: Tuning, T: Track, dt: number) {
  st.lapTime += dt; st.msgT -= dt; st.boostT -= dt; st.boostCD -= dt;
  if (st.stallT > 0) { st.stallT -= dt; inp = { ...inp, throttle: 0 }; } // Stalled at GO
  if (inp.boost && st.boostCD <= 0) {
    st.boostT = Math.max(st.boostT, P.boostDuration); st.boostCD = P.boostDuration + P.boostCooldown; // never cuts a Boost pad's short
    st.boostLen = st.boostT;
    if (st.mode === 'track') st.speed += P.boostKick;
  }
  const boosting = st.boostT > 0;

  if (st.mode === 'track') {
    let f = sampleAt(T, st.s);
    const cap = P.topSpeed + (boosting ? P.boostSpeed : 0);
    let a = -P.slopeGravity * f.t.y - P.drag * st.speed;
    if (st.speed < cap) a += inp.throttle * P.accel * (boosting ? P.boostAccelMul : 1);
    if (st.speed > 0) a -= inp.brake * P.brake;
    st.speed = Math.max(-10, st.speed + a * dt);
    if (st.speed > cap) st.speed = Math.max(cap, st.speed - P.overspeedDecay * dt);

    const target = inp.steer * P.steerRate * Math.min(1, Math.abs(st.speed) / 10);
    st.latVel += (target - st.latVel) * Math.min(1, P.steerResponse * dt) + cornerPull(T, st.s, st.speed, P) * dt;
    st.d += st.latVel * dt;

    const s0 = st.s;
    st.s += st.speed * dt;
    // Boost pad: riding onto one kicks and Boosts until the strip ends, plus a short tail, leaving the button alone.
    // The Boost is sized on entry as if ridden at Boost top speed (so the HUD meter drains across the strip) and held
    // while on the strip (however the Bike got there: also a landing or respawn on it), so it never ends early.
    for (const pad of T.pads) {
      if ((s0 < pad.s && st.s >= pad.s) || (s0 < pad.s + T.L && st.s >= pad.s + T.L)) {
        st.padHits++; st.speed += P.boostKick;
        st.boostT = Math.max(st.boostT, pad.len / (P.topSpeed + P.boostSpeed) + BOOST_PAD_TAIL); st.boostLen = st.boostT;
      }
      const into = (st.s - pad.s + T.L) % T.L;
      if (into < pad.len) st.boostT = Math.max(st.boostT, BOOST_PAD_TAIL);
    }
    if (st.s >= T.L) {
      st.s -= T.L; st.laps++; st.lastLap = st.lapTime; st.lapTime = 0;
    }
    if (st.s < 0) st.s += T.L;
    st.lastCP = T.cpS.findLastIndex(c => c <= st.s);

    f = placeOnTrack(st, T);
    if (f.gap) launch(st, f);
    else if (Math.abs(st.d) > T.halfWidth) launch(st, f, 'Off the edge');
    else if (f.u.y < CEILING_UP_Y && st.speed < P.stickSpeed) launch(st, f, 'Too slow — dropped off the ceiling');
    return;
  }

  // Airborne: weak world-down gravity, Air control rotates the Bike only (not its velocity)
  st.airT += dt;
  const prev = st.pos.clone();
  st.vel.y -= P.airGravity * dt; st.pos.addScaledVector(st.vel, dt);
  const r = P.airControlRate * dt;
  st.quat.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -inp.steer * r))
         .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), inp.pitch * r)).normalize();
  if (st.airT > P.maxAirTime || st.pos.y < T.minY - 30) return respawn(st, T, P, 'Fell off the Track');
  if (st.airT < 0.15) return; // grace so a launch can't re-land on its own lip

  // Landing: swept test (above surface last step, at/below now) against every solid sample.
  // ponytail: O(N) scan per step (~1000 samples), fine for one Bike; window it if it ever shows in a profile.
  const tmp = new Vector3();
  for (let i = 0; i < T.N; i++) {
    if (T.gap[i]) continue;
    tmp.subVectors(st.pos, T.pos[i]);
    const along = tmp.dot(T.tan[i]); if (Math.abs(along) > T.ds * 0.6) continue;
    const h = tmp.dot(T.up[i]); if (h > 0 || h < -4) continue;
    const d = tmp.dot(T.rgt[i]); if (Math.abs(d) > T.halfWidth) continue;
    if (tmp.subVectors(prev, T.pos[i]).dot(T.up[i]) < 0) continue;

    const aF = new Vector3(0, 0, 1).applyQuaternion(st.quat).dot(T.tan[i]);
    const aU = new Vector3(0, 1, 0).applyQuaternion(st.quat).dot(T.up[i]);
    const off = Math.round(MathUtils.radToDeg(Math.acos(MathUtils.clamp(Math.min(aF, aU), -1, 1))));
    st.landOff = off;
    if (Math.min(aF, aU) < Math.cos(MathUtils.degToRad(P.landingTolerance))) return respawn(st, T, P, `Crashed — landed ${off}° off`);
    // wrap s: a landing just behind the start line must not go negative (lastCP would be -1)
    Object.assign(st, { mode: 'track', s: (i * T.ds + along + T.L) % T.L, d, latVel: 0, speed: st.vel.dot(T.tan[i]) });
    st.lastCP = T.cpS.findLastIndex(c => c <= st.s);
    // Landing grade (game-spec → Landing grades): Perfect from a Gap flight Boosts like a short Boost pad
    const grade = st.landGrade = landingGrade(off);
    if (grade === 'perfect' && st.fromGap && st.boostT < PERFECT_BOOST) { st.boostT = st.boostLen = PERFECT_BOOST; }
    say(st, grade === 'perfect' ? 'PERFECT' : grade === 'clean' ? `Clean · ${off}°` : `Sketchy · ${off}°`, grade);
    placeOnTrack(st, T);
    return;
  }
}
