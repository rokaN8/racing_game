import { describe, expect, it } from 'vitest';
import { MathUtils, type Vector3 } from 'three';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { CHECKPOINT_CPS, CPS, GAP_SEGMENTS, HALF_WIDTH } from '../src/track/layout';
import { cornerPull, newState, respawn, step, type BikeState, type Input } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';

const T = bakeTrack(CPS, GAP_SEGMENTS, CHECKPOINT_CPS, HALF_WIDTH);
const DT = 1 / 120;
const NONE: Input = { throttle: 0, brake: 0, steer: 0, pitch: 0, boost: false };

// The Gap as [start, end] distances (only Gap B is left).
const gaps: [number, number][] = [];
for (let i = 0; i < T.N; i++) if (T.gap[i] && !T.gap[i - 1]) {
  let j = i; while (T.gap[j]) j++;
  gaps.push([i * T.ds, j * T.ds]);
}
const [gapB] = gaps;
const cpBefore = (s: number) => T.cpS.findLastIndex(c => c <= s);
// Distance of the first Track sample matching `where`; throws rather than letting a test pass on a miss.
const sWhere = (where: (p: Vector3, s: number) => boolean) => {
  const i = T.pos.findIndex((p, i) => where(p, i * T.ds));
  if (i < 0) throw new Error('no Track sample matches');
  return i * T.ds;
};
const ON_GROUND = 0.1; // m: everything but the Loop, the Rollercoaster and Gap B sits at y = 0
const loopStart = sWhere(p => p.y > ON_GROUND);                          // the Lap's first climb is the Loop
const loopExit = sWhere((p, s) => s > loopStart + 60 && p.y < ON_GROUND); // back on the ground after it
const rcStart = sWhere((p, s) => s > loopExit && p.y > ON_GROUND);         // next climb: the Rollercoaster
const rcEnd = sWhere((p, s) => s > rcStart + 200 && p.y < ON_GROUND);     // back on the ground after both hills

// Steering autopilot: cancel the Cornering pull and steer back to the centre line.
const steerToCentre = (st: BikeState) => {
  const target = -st.d - cornerPull(T, st.s, st.speed, TUNING) / TUNING.steerResponse; // wanted latVel, minus the pull's share
  return MathUtils.clamp(target / (TUNING.steerRate * Math.max(0.1, Math.min(1, Math.abs(st.speed) / 10))), -1, 1);
};

// Headless driver standing in for the player: full throttle, steering to the centre line; Boost in the last 40 m before Gap B (if asked); in the air it pitches
// the nose onto the flight path (if asked), like a player lining up a landing, or holds a fixed pitch.
interface Pilot { boost?: boolean; airControl?: boolean; pitch?: number }
function pilot(st: BikeState, o: Pilot): Input {
  if (st.mode === 'air') {
    if (o.pitch !== undefined) return { ...NONE, pitch: o.pitch };
    if (!o.airControl) return NONE;
    const v = st.vel.clone().applyQuaternion(st.quat.clone().invert()).normalize(); // flight path, Bike-local
    return { ...NONE, pitch: MathUtils.clamp(-v.y * 10, -1, 1) };
  }
  return { ...NONE, throttle: 1, steer: steerToCentre(st), boost: !!o.boost && st.s > gapB[0] - 40 && st.s < gapB[0] };
}

// Ride until `done` (or 90 s), logging every launch, landing and respawn.
interface RideEvent { kind: 'launch' | 'land' | 'respawn'; s: number; msg: string; lapTimeJump: number }
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
const lapDone = (st: BikeState) => st.laps > 0;
const BOOSTED: Pilot = { airControl: true, boost: true };

describe('Track frames', () => {
  it("every sample's up is perpendicular to its tangent", () => {
    for (let i = 0; i < T.N; i++) expect(Math.abs(T.up[i].dot(T.tan[i]))).toBeLessThan(1e-6);
    for (let s = 0; s < T.L; s += T.ds / 3) {
      const f = sampleAt(T, s);
      expect(Math.abs(f.u.dot(f.t))).toBeLessThan(1e-6);
      expect(f.u.length()).toBeCloseTo(1, 6);
    }
  });

  it('wraps with no twist at the seam', () => {
    const a = sampleAt(T, T.L - 1e-3), b = sampleAt(T, 0);
    expect(a.p.distanceTo(b.p)).toBeLessThan(0.01);
    expect(a.u.angleTo(b.u)).toBeLessThan(0.01);
    // seam step must look like any other step: no frame jump bigger than the worst interior one
    let worst = 0;
    for (let i = 0; i < T.N - 1; i++) worst = Math.max(worst, T.up[i].angleTo(T.up[i + 1]));
    const seam = T.up[T.N - 1].angleTo(T.up[0]);
    expect(seam).toBeLessThanOrEqual(worst * 1.5);
    expect(seam).toBeLessThan(0.05); // ~3°, no visible kink
  });

  it('never passes over or under itself', () => {
    // solid samples more than 40 m apart along the Track, closer than a Track width sideways,
    // need 8 m of headroom between them (the Loop's 12 m drift and height pass this)
    for (let i = 0; i < T.N; i++) for (let j = i + 1; j < T.N; j++) {
      if (T.gap[i] || T.gap[j] || Math.min(j - i, T.N - j + i) * T.ds < 40) continue;
      const a = T.pos[i], b = T.pos[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 2 * T.halfWidth) expect(Math.abs(a.y - b.y)).toBeGreaterThan(8);
    }
  });
});

describe('Loop', () => {
  const loopEntry = loopStart - 20; // flat run-in, 20 m before it
  const rideLoop = (s: number, speed: number, throttle: number) => {
    const st = newState(T);
    Object.assign(st, { s, speed });
    for (let i = 0; i < 120 * 10 && st.mode === 'track' && st.s < loopExit; i++)
      step(st, { ...NONE, throttle }, TUNING, T, DT);
    return st;
  };

  it('full throttle from the start line clears it', () => {
    const st = rideLoop(0, 0, 1);
    expect(st.mode).toBe('track');
    expect(st.s).toBeGreaterThanOrEqual(loopExit);
  });

  it('coasting in at 38 m/s drops off the ceiling', () => {
    const st = rideLoop(loopEntry, 38, 0);
    expect(st.mode).toBe('air');
    expect(sampleAt(T, st.s).u.y).toBeLessThan(-0.3);
  });
});

describe('Test Track', () => {
  it('a full-throttle Lap with no Boost rides the Rollercoaster and lands Gap B', () => {
    const ev = ride(newState(T), { airControl: true }, st => st.respawns > 0 || lapDone(st));
    expect(ev.map(e => e.kind)).toEqual(['launch', 'land']);
    expect(ev[0].s).toBeCloseTo(gapB[0], 0);
    expect(ev[1].s).toBeGreaterThan(gapB[1]);
  });

  it('a full-throttle Lap with Boost at Gap B is clean and takes about 40 s', () => {
    const st = newState(T);
    const ev = ride(st, BOOSTED, lapDone);
    expect(ev.map(e => e.kind)).toEqual(['launch', 'land']);
    expect(st.lastLap!).toBeGreaterThan(35);
    expect(st.lastLap!).toBeLessThan(45);
  });

  it('Gap B fails at 35 m/s and clears at 55 and 65 m/s', () => {
    const jumpGapB = (speed: number) => {
      const st = newState(T);
      Object.assign(st, { s: gapB[0] - 1, speed, boostT: TUNING.boostDuration }); // as if just Boosted: 65 m/s holds
      return ride(st, { airControl: true }, st => st.respawns > 0 || (st.mode === 'track' && st.s > gapB[1]));
    };
    expect(jumpGapB(35).at(-1)!.kind).toBe('respawn');
    expect(jumpGapB(55).at(-1)!.kind).toBe('land');
    expect(jumpGapB(65).at(-1)!.kind).toBe('land');
  });

  // CP 1 and 2 lead into the Loop, CP 3 into the Rollercoaster, CP 4 into Gap B.
  it.each([1, 2, 3, 4])('a respawn at Checkpoint %i at 20 m/s clears the hazard that follows it', k => {
    const hazardEnd = [loopExit, loopExit, rcEnd, gapB[1]][k - 1] + 30;
    const st = newState(T);
    st.lastCP = k - 1;
    respawn(st, T, TUNING, 'test');
    expect(st.speed).toBe(20);
    const respawns = st.respawns;
    const ev = ride(st, BOOSTED, st => st.respawns > respawns || (st.mode === 'track' && st.s > hazardEnd));
    expect(st.respawns).toBe(respawns);
    expect(st.s).toBeGreaterThan(hazardEnd);
    expect(ev.map(e => e.kind)).toEqual(k === 4 ? ['launch', 'land'] : []);
  });

  it('each Checkpoint sits at least 60 m before the hazard that follows it', () => {
    expect(loopStart - T.cpS[0]).toBeGreaterThanOrEqual(60);
    expect(loopStart - T.cpS[1]).toBeGreaterThanOrEqual(60);
    expect(rcStart - T.cpS[2]).toBeGreaterThanOrEqual(60);
    expect(gapB[0] - T.cpS[3]).toBeGreaterThanOrEqual(60);
  });

  it('crashing respawns at the last Checkpoint with +3 s, and the Lap time counts it', () => {
    const clean = newState(T);
    ride(clean, BOOSTED, lapDone);
    const st = newState(T);
    const crash = ride(st, { pitch: 1 }, st => st.respawns > 0).at(-1)!; // nose held down through Gap B
    expect(crash.msg).toMatch(/^Crashed/);
    expect(crash.s).toBeCloseTo(T.cpS[cpBefore(gapB[0])], 6);
    expect(st.speed).toBe(20);
    expect(crash.lapTimeJump).toBeCloseTo(3 + DT, 9);
    ride(st, BOOSTED, lapDone);
    expect(st.lastLap!).toBeGreaterThan(clean.lastLap! + 3);
  });
});

describe('Cornering pull', () => {
  it('a full-throttle Lap with no steering goes off the edge in the first turn', () => {
    const st = newState(T);
    for (let i = 0; i < 120 * 60 && st.mode === 'track'; i++) step(st, { ...NONE, throttle: 1 }, TUNING, T, DT);
    expect(st.msg).toMatch(/^Off the edge/);
    expect(st.s).toBeLessThan(rcStart);
  });

  it('full steer can hold every turn at top speed', () => {
    let worst = 0;
    for (let s = 0; s < T.L; s++) worst = Math.max(worst, Math.abs(cornerPull(T, s, TUNING.topSpeed, TUNING)));
    expect(worst).toBeLessThan(TUNING.steerRate * TUNING.steerResponse);
  });

  it("doesn't pull on the Loop's walls and ceiling", () => {
    for (let s = loopStart; s < loopExit; s++)
      if (sampleAt(T, s).u.y <= 0) expect(cornerPull(T, s, TUNING.topSpeed, TUNING)).toBe(0);
  });
});

describe('Boost', () => {
  const go: Input = { ...NONE, throttle: 1 };
  const run = (st: BikeState, secs: number, boost = false) => {
    for (let i = 0; i < secs * 120; i++) step(st, { ...go, boost }, TUNING, T, DT);
  };
  const atTopSpeed = () => { // flat, long, no hazards
    const st = newState(T);
    Object.assign(st, { s: sWhere(p => p.z < -314 && p.x < -500), speed: 55 }); // return straight, z = -315
    return st;
  };

  it('kicks +10 m/s and raises the cap to 75 m/s while it lasts', () => {
    const st = atTopSpeed();
    step(st, { ...go, boost: true }, TUNING, T, DT);
    expect(st.speed).toBeGreaterThan(64);
    run(st, 1.1);
    expect(st.speed).toBeGreaterThan(65);
    run(st, 3); // Boost over: decays back to topSpeed
    expect(st.speed).toBeCloseTo(55, 0);
  });

  it('is ready again only 3 s after the Boost ends', () => {
    const st = atTopSpeed();
    step(st, { ...go, boost: true }, TUNING, T, DT);
    run(st, 3);                 // 1.2 s Boost + 1.8 s of cooldown
    const before = st.speed;
    step(st, { ...go, boost: true }, TUNING, T, DT);
    expect(st.speed).toBeLessThan(before + 1); // still cooling down: no kick
    run(st, 1.3);               // past 4.2 s
    const ready = st.speed;
    step(st, { ...go, boost: true }, TUNING, T, DT);
    expect(st.speed).toBeGreaterThan(ready + 9);
  });
});
