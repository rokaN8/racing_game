// Slipstream's own Lap checks (shared checks for every Track live in test/track.test.ts).
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../../src/track/bake';
import { slipstream } from '../../src/track/tracks/flow';
import { newState, step } from '../../src/bike/physics';
import { CEILING_UP_Y, TUNING } from '../../src/bike/tuning';
import { createPilot, DT, lapDone, NONE, type Pilot } from '../../src/pilot';

const T = bakeTrack(slipstream);
const { gaps, ride } = createPilot(T);
const LINED_UP: Pilot = { airControl: true };
const CORKSCREW = T.cpS[3]; // the Checkpoint on the bridge, 80 m before the Corkscrew

describe('Slipstream', () => {
  it('has 6 Checkpoints, one Gap, two Boost pads, a Loop and a Corkscrew', () => {
    expect(T.cpS).toHaveLength(6);
    expect(gaps).toHaveLength(1);
    expect(T.pads).toHaveLength(2);
    expect(T.up.filter((u, i) => u.y < -0.9 && (i === 0 || T.up[i - 1].y >= -0.9))).toHaveLength(2); // two upside-down stretches
  });

  it('a full-throttle Lap with Boost on the straights is clean, takes about 54 s, and never brakes', () => {
    const st = newState(T);
    expect(ride(st, { ...LINED_UP, boostStraights: true }, lapDone).filter(e => e.kind === 'respawn')).toEqual([]);
    expect(st.lastLap!).toBeGreaterThan(49);
    expect(st.lastLap!).toBeLessThan(59);
  });

  it('a full-throttle Lap with no Boost is clean too', () => {
    const st = newState(T);
    expect(ride(st, LINED_UP, lapDone).filter(e => e.kind === 'respawn')).toEqual([]);
  });

  it('coasting into the Corkscrew below stickSpeed drops off the ceiling', () => {
    const st = newState(T), { steerToCentre } = createPilot(T);
    Object.assign(st, { s: CORKSCREW, speed: TUNING.stickSpeed - 3 });
    while (st.mode === 'track' && st.s < CORKSCREW + 400) step(st, { ...NONE, steer: steerToCentre(st) }, TUNING, T, DT);
    expect(st.msg).toMatch(/^Too slow/);
  });

  it('the Gap respawns below 40 m/s and lands from 45 to 75 m/s', () => {
    const jump = (speed: number) => {
      const st = newState(T);
      Object.assign(st, { s: gaps[0][0] - 1, speed, boostT: speed > TUNING.topSpeed ? 99 : 0 });
      return ride(st, LINED_UP, s => s.respawns > 0 || (s.mode === 'track' && s.s > gaps[0][1] + 5)).at(-1)!;
    };
    expect(jump(35).kind).toBe('respawn');
    for (const v of [45, 55, 65, 75]) expect(jump(v).kind, `${v} m/s`).toBe('land');
  });

  it('the bridge crosses the start straight with the Corkscrew upside down over it, at least 8 m clear', () => {
    let crossings = 0;
    const bridge = (j: number) => j * T.ds > CORKSCREW && j * T.ds < T.cpS[4]; // the Loop also passes over itself: not this
    for (let i = 0; i < T.N; i += 2) for (let j = i + 40; j < T.N; j += 2) {
      const a = T.pos[i], b = T.pos[j];
      if (bridge(j) && Math.hypot(a.x - b.x, a.z - b.z) < 2 * T.halfWidth) {
        crossings++;
        expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(8);
        expect(T.up[j].y).toBeLessThan(CEILING_UP_Y); // the upper one is the Corkscrew, upside down
      }
    }
    expect(crossings).toBeGreaterThan(0);
  });
});
