import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { CPS, HALF_WIDTH } from '../src/track/layout';
import { newState, step } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';

const T = bakeTrack(CPS, HALF_WIDTH);

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
      step(st, { throttle, brake: 0, steer: 0 }, TUNING, T, 1 / 120);
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
