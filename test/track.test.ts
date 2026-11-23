// Checks every Track must pass (docs/game-spec.md → Tracks). Each Track's own Lap checks live in test/tracks/<id>.test.ts.
import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { TRACKS } from '../src/track/tracks';
import { newState, respawn, step } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { BOOSTED, createPilot } from './pilot';

describe.each(TRACKS)('$name', track => {
  const T = bakeTrack(track);
  const { ride } = createPilot(T);

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
    // need 8 m of headroom between them (a Loop's drift and height pass this)
    for (let i = 0; i < T.N; i++) for (let j = i + 1; j < T.N; j++) {
      if (T.gap[i] || T.gap[j] || Math.min(j - i, T.N - j + i) * T.ds < 40) continue;
      const a = T.pos[i], b = T.pos[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 2 * T.halfWidth) expect(Math.abs(a.y - b.y)).toBeGreaterThan(8);
    }
  });

  it.each(T.cpS.map((_, k) => k + 1))('a respawn at Checkpoint %i at 20 m/s rides clean to the next one', k => {
    const st = newState(T);
    st.lastCP = k - 1;
    respawn(st, T, TUNING, 'test');
    const next = T.cpS[k], respawns = st.respawns; // undefined after the last: ride to the line
    ride(st, { ...BOOSTED, brakes: true }, st => st.respawns > respawns || st.laps > 0 || (next !== undefined && st.mode === 'track' && st.s >= next));
    expect(st.respawns).toBe(respawns);
  });
});

it('Boost is ready again straight after a respawn', () => {
  const T = bakeTrack(TRACKS[0]), st = newState(T), boost = { throttle: 1, brake: 0, steer: 0, pitch: 0, boost: true };
  step(st, boost, TUNING, T, 1 / 120);
  expect(st.boostCD).toBeGreaterThan(0);
  respawn(st, T, TUNING, 'test');
  expect(st.boostCD).toBeLessThanOrEqual(0);
  step(st, boost, TUNING, T, 1 / 120);
  expect(st.boostT).toBeGreaterThan(0);
});
