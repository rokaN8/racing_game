import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { CHECKPOINT_CPS, CPS, GAP_SEGMENTS, HALF_WIDTH } from '../src/track/layout';
import { newState, step } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';

const T = bakeTrack(CPS, GAP_SEGMENTS, CHECKPOINT_CPS, HALF_WIDTH);

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
});

describe('Loop', () => {
  const loopEntry = T.pos.findIndex(p => p.z >= 100) * T.ds; // flat run-in, 20 m before the Loop
  const loopExit = T.pos.findIndex(p => p.x > 11 && p.z >= 140) * T.ds; // back on the ground, past the Loop
  const ride = (s: number, speed: number, throttle: number) => {
    const st = newState(T);
    Object.assign(st, { s, speed });
    for (let i = 0; i < 120 * 10 && st.mode === 'track' && st.s < loopExit; i++)
      step(st, { throttle, brake: 0, steer: 0, pitch: 0, boost: false }, TUNING, T, 1 / 120);
    return st;
  };

  it('full throttle from the start line clears it', () => {
    const st = ride(0, 0, 1);
    expect(st.mode).toBe('track');
    expect(st.s).toBeGreaterThanOrEqual(loopExit);
  });

  it('coasting in at 38 m/s drops off the ceiling', () => {
    const st = ride(loopEntry, 38, 0);
    expect(st.mode).toBe('air');
    expect(sampleAt(T, st.s).u.y).toBeLessThan(-0.3);
  });
});

describe('Gap', () => {
  const NONE = { throttle: 0, brake: 0, steer: 0, pitch: 0, boost: false };
  const lapFullThrottle = (air: typeof NONE) => {
    const st = newState(T);
    let flew = false;
    for (let i = 0; i < 120 * 60 && st.laps === 0; i++) {
      step(st, st.mode === 'air' ? air : { ...NONE, throttle: 1 }, TUNING, T, 1 / 120);
      flew ||= st.mode === 'air';
    }
    return { st, flew };
  };

  it('a full-throttle Lap jumps it and lands', () => {
    const { st, flew } = lapFullThrottle(NONE);
    expect(flew).toBe(true);
    expect(st.laps).toBe(1);
    expect(st.respawns).toBe(0);
    expect(st.lastLap).toBeGreaterThan(5);
  });

  it('over-rotating in the air crashes, respawns at the last Checkpoint with +3 s, and the Lap time counts it', () => {
    const clean = lapFullThrottle(NONE).st.lastLap!;
    const gapCP = T.cpS.findLastIndex(c => c <= T.gap.indexOf(true) * T.ds);
    // hold nose-down through the whole flight: well past the 35Â° landing tolerance
    const st = newState(T);
    let crash: { s: number; mode: string; jump: number } | null = null;
    for (let i = 0; i < 120 * 60 && !crash; i++) {
      const before = st.lapTime, respawns = st.respawns;
      step(st, st.mode === 'air' ? { ...NONE, pitch: 1 } : { ...NONE, throttle: 1 }, TUNING, T, 1 / 120);
      if (st.respawns > respawns) crash = { s: st.s, mode: st.mode, jump: st.lapTime - before };
    }
    expect(st.msg).toMatch(/^Crashed/);
    expect(crash!.mode).toBe('track');
    expect(crash!.s).toBeCloseTo(T.cpS[gapCP], 6);
    expect(st.speed).toBe(20);
    expect(crash!.jump).toBeCloseTo(3 + 1 / 120, 9);

    // finish the Lap without touching the controls in the air again: the penalty shows in the Lap time
    for (let i = 0; i < 120 * 60 && st.laps === 0; i++)
      step(st, st.mode === 'air' ? NONE : { ...NONE, throttle: 1 }, TUNING, T, 1 / 120);
    expect(st.laps).toBe(1);
    expect(st.lastLap!).toBeGreaterThan(clean + 3);
  });
});

describe('Boost', () => {
  const DT = 1 / 120, go = { throttle: 1, brake: 0, steer: 0, pitch: 0, boost: false };
  const run = (st: ReturnType<typeof newState>, secs: number, boost = false) => {
    for (let i = 0; i < secs * 120; i++) step(st, { ...go, boost }, TUNING, T, DT);
  };
  const atTopSpeed = () => { // back straight: flat, long, no hazards
    const st = newState(T);
    Object.assign(st, { s: T.cpS[4], speed: 55 });
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
