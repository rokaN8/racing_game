// Switchback's own Lap checks (shared checks for every Track live in test/track.test.ts).
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../../src/track/bake';
import { switchback } from '../../src/track/tracks/technical';
import { newState } from '../../src/bike/physics';
import { createPilot, gapsOf, lapDone } from '../pilot';

const T = bakeTrack(switchback);
const { ride } = createPilot(T);

describe('Switchback', () => {
  it('has 7 Checkpoints and no Gaps', () => {
    expect(T.cpS).toHaveLength(7);
    expect(gapsOf(T)).toEqual([]);
  });

  it('a braking Lap with Boost on the straights is clean and takes about 54 s', () => {
    const st = newState(T);
    expect(ride(st, { brakes: true, boostStraights: true }, lapDone)).toEqual([]);
    expect(st.lastLap!).toBeGreaterThan(49);
    expect(st.lastLap!).toBeLessThan(59);
  });

  it('a full-throttle Lap with no braking goes off the edge at the hairpin', () => {
    const st = newState(T);
    const [first] = ride(st, {}, s => s.respawns > 0);
    expect(first.msg).toMatch(/^Off the edge/);
    expect(st.lastCP).toBe(1); // between the Checkpoint before the hairpin and the one after it
  });

  it('crosses itself once, on an overpass at least 8 m clear', () => {
    let crossings = 0;
    for (let i = 0; i < T.N; i += 2) for (let j = i + 40; j < T.N; j += 2) {
      const a = T.pos[i], b = T.pos[j];
      if (Math.min(j - i, T.N - j + i) * T.ds > 40 && Math.hypot(a.x - b.x, a.z - b.z) < 2 * T.halfWidth) {
        crossings++;
        expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(8);
      }
    }
    expect(crossings).toBeGreaterThan(0);
  });
});
