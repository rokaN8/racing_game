// PROTOTYPE (throwaway, Helix piece ticket #75): headless checks for the three Helix variants.
import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { buildHelixVariant, VARIANTS, type Key } from '../src/track/tracks/prototype-helix';
import { cornerPull, newState, respawn } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { BOOSTED, createPilot } from '../src/pilot';

describe.each(Object.keys(VARIANTS) as Key[])('Helix %s', k => {
  const T = bakeTrack(buildHelixVariant(k));
  const { ride } = createPilot(T);

  it('bakes clean frames and wraps with no twist at the seam', () => {
    for (let i = 0; i < T.N; i++) expect(Math.abs(T.up[i].dot(T.tan[i]))).toBeLessThan(1e-6);
    const a = sampleAt(T, T.L - 1e-3), b = sampleAt(T, 0);
    expect(a.p.distanceTo(b.p)).toBeLessThan(0.01);
    expect(a.u.angleTo(b.u)).toBeLessThan(0.01);
  });

  it('never passes over or under itself (8 m headroom between coils)', () => {
    let tightest = Infinity;
    for (let i = 0; i < T.N; i++) for (let j = i + 1; j < T.N; j++) {
      if (Math.min(j - i, T.N - j + i) * T.ds < 40) continue;
      const a = T.pos[i], b = T.pos[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 2 * T.halfWidth) tightest = Math.min(tightest, Math.abs(a.y - b.y));
    }
    console.log(`Helix ${k}: L ${T.L.toFixed(0)} m, tightest headroom ${tightest.toFixed(1)} m`);
    expect(tightest).toBeGreaterThan(8);
  });

  it.each([['full throttle', {}, 0], ['Boost held all Lap', {}, 1e9], ['BOOSTED', BOOSTED, 0]] as const)('%s Lap is clean', (_, o, boostT) => {
    const st = newState(T); st.boostT = boostT;
    let peak = 0, t = 0;
    const ev = ride(st, o, s => {
      if (s.mode === 'track') peak = Math.max(peak, Math.abs(cornerPull(T, s.s, s.speed, TUNING)));
      return s.laps > 0;
    });
    t = st.lastLap ?? NaN;
    console.log(`Helix ${k} ${_}: ${t.toFixed(1)} s, peak pull ${peak.toFixed(0)} m/s² of 120`);
    expect(ev.filter(e => e.kind === 'respawn')).toEqual([]);
  });

  it.each(T.cpS.map((_, i) => i + 1))('a 20 m/s respawn at Checkpoint %i rides clean to the next one', i => {
    const st = newState(T); st.lastCP = i - 1;
    respawn(st, T, TUNING, 'test');
    const next = T.cpS[i], n = st.respawns;
    ride(st, { ...BOOSTED, brakes: true }, s => s.respawns > n || s.laps > 0 || (next !== undefined && s.s >= next));
    expect(st.respawns).toBe(n);
  });
});
