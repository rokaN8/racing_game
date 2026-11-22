// Hang Time's own Lap checks (shared checks for every Track live in test/track.test.ts).
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../../src/track/bake';
import { hangTime } from '../../src/track/tracks/bigair';
import { newState, type BikeState } from '../../src/bike/physics';
import { TUNING } from '../../src/bike/tuning';
import { createPilot, type Pilot } from '../pilot';

const T = bakeTrack(hangTime);
const { gaps, ride } = createPilot(T);
const LINED_UP: Pilot = { airControl: true, brakes: true }; // a player lining up each landing

// Leave a Gap's lip at `speed` (Boosting, so speeds over topSpeed hold) and see how it ends.
const jump = (g: number, speed: number) => {
  const st = newState(T);
  Object.assign(st, { s: gaps[g][0] - 1, speed, boostT: speed > TUNING.topSpeed ? 99 : 0 });
  return ride(st, LINED_UP, s => s.respawns > 0 || (s.mode === 'track' && s.s > gaps[g][1] + 5)).at(-1)!;
};
// A full Lap, noting the longest flight.
const lap = (o: Pilot) => {
  const st = newState(T);
  let maxAir = 0;
  const events = ride(st, o, (s: BikeState) => { if (s.mode === 'air') maxAir = Math.max(maxAir, s.airT); return s.laps > 0; });
  return { st, events, maxAir };
};

describe('Hang Time', () => {
  it('has 5 Gaps, two Loops and 7 Checkpoints', () => {
    expect(gaps).toHaveLength(5);
    expect(T.cpS).toHaveLength(7);
    expect(T.up.filter((u, i) => u.y < -0.9 && (i === 0 || T.up[i - 1].y >= -0.9))).toHaveLength(2); // two upside-down tops
  });

  it.each([0, 1, 2, 3, 4])('Gap %i respawns at 35 m/s and lands at 45, 55, 65 and 75 m/s', g => {
    expect(jump(g, 35).kind).toBe('respawn');
    for (const v of [45, 55, 65, 75]) {
      const end = jump(g, v);
      expect(end.kind, `${v} m/s: ${end.msg}`).toBe('land');
    }
  });

  it('a full-throttle Lap with Boost at the Gaps is clean, takes about 54 s, and no flight lasts 4 s', () => {
    const { st, events, maxAir } = lap({ ...LINED_UP, boost: true });
    expect(events.filter(e => e.kind === 'respawn')).toEqual([]);
    expect(st.lastLap!).toBeGreaterThan(49);
    expect(st.lastLap!).toBeLessThan(59);
    expect(maxAir).toBeLessThan(4);
  });

  it('a full-throttle Lap with no Boost is clean too', () => {
    expect(lap(LINED_UP).events.filter(e => e.kind === 'respawn')).toEqual([]);
  });
});
