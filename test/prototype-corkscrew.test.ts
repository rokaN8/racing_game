// PROTOTYPE check for the Corkscrew variants (ticket #52). Throwaway.
import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { buildCorkscrewVariant } from '../src/track/tracks/prototype-corkscrew';
import { newState, respawn } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { createPilot, lapDone } from './pilot';
import { TRACKS } from '../src/track/tracks';

describe.each(['A', 'B', 'C'] as const)('Corkscrew %s', k => {
  const T = bakeTrack(buildCorkscrewVariant(k));
  const { ride } = createPilot(T);

  it('goes fully upside down and comes out upright with no seam twist', () => {
    let minUp = 1, worst = 0;
    for (let i = 0; i < T.N; i++) { minUp = Math.min(minUp, T.up[i].y); worst = Math.max(worst, T.up[i].angleTo(T.up[(i + 1) % T.N])); }
    expect(minUp).toBeLessThan(-0.99);
    expect(sampleAt(T, T.L - 1e-3).u.angleTo(sampleAt(T, 0).u)).toBeLessThan(0.01);
    console.log(k, `L=${T.L.toFixed(0)} worst roll step ${(worst * 180 / Math.PI).toFixed(1)}°/sample`);
  });

  it('full-throttle Lap is clean', () => {
    const st = newState(T);
    const ev = ride(st, {}, lapDone);
    expect(ev.filter(e => e.kind === 'respawn')).toEqual([]);
    console.log(k, `Lap ${st.lastLap!.toFixed(1)} s`);
  });

  it('respawn at 20 m/s before the Corkscrew rides it', () => {
    const st = newState(T); st.lastCP = 1; respawn(st, T, TUNING, 'test');
    const r = st.respawns;
    ride(st, {}, s => s.respawns > r || s.s > T.cpS[1] + 400);
    expect(st.respawns).toBe(r);
  });
});

it('existing Tracks unchanged in count', () => expect(TRACKS.length).toBe(3));
