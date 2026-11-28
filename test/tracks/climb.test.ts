// Vertigo's own Lap checks (shared checks for every Track live in test/track.test.ts).
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../../src/track/bake';
import { vertigo } from '../../src/track/tracks/climb';
import { newState, type BikeState } from '../../src/bike/physics';
import { TUNING } from '../../src/bike/tuning';
import { createPilot, type Pilot } from '../../src/pilot';

const T = bakeTrack(vertigo);
const { gaps, ride } = createPilot(T);
const LINED_UP: Pilot = { airControl: true }; // a player lining up the landing

// Leave the Gap's lip at `speed` (Boosting, so speeds over topSpeed hold) and see how it ends.
const jump = (speed: number) => {
  const st = newState(T);
  Object.assign(st, { s: gaps[0][0] - 1, speed, boostT: speed > TUNING.topSpeed ? 99 : 0 });
  return ride(st, LINED_UP, s => s.respawns > 0 || (s.mode === 'track' && s.s > gaps[0][1] + 5)).at(-1)!;
};
const lap = (o: Pilot) => {
  const st = newState(T);
  let maxAir = 0;
  const events = ride(st, o, (s: BikeState) => { if (s.mode === 'air') maxAir = Math.max(maxAir, s.airT); return s.laps > 0; });
  return { st, events, maxAir };
};

describe('Vertigo', () => {
  it('has one Gap, 5 Checkpoints and climbs to 150 m', () => {
    expect(gaps).toHaveLength(1);
    expect(T.cpS).toHaveLength(5);
    expect(Math.max(...T.pos.filter((_, i) => !T.gap[i]).map(p => p.y))).toBeCloseTo(152, 0); // the Kicker adds 2 m
  });

  it('the Gap respawns at 45 m/s and lands at 50, 55, 65 and 75 m/s', () => {
    expect(jump(45).kind).toBe('respawn');
    for (const v of [50, 55, 65, 75]) {
      const end = jump(v);
      expect(end.kind, `${v} m/s: ${end.msg}`).toBe('land');
    }
  });

  it('the Track is level on the Kicker and the deck (the Helixes leave no roll)', () => {
    const [lip, deckStart] = gaps[0];
    for (const s of [lip - 25, lip - 5, deckStart + 10, deckStart + 60]) { // on the Kicker and the deck
      const i = Math.round(s / T.ds), t = T.tan[i];
      const level = new Vector3(0, 1, 0).addScaledVector(t, -t.y).normalize(); // world up, square to the Track
      expect(T.up[i].angleTo(level) * (180 / Math.PI), `roll at ${s.toFixed(0)} m`).toBeLessThan(1);
    }
  });

  it('a Lap with Boost on the straights is clean, takes about 54 s, and no flight lasts 4 s', () => {
    const { st, events, maxAir } = lap(vertigo.pilot);
    expect(events.filter(e => e.kind === 'respawn')).toEqual([]);
    expect(st.lastLap!).toBeGreaterThan(49);
    expect(st.lastLap!).toBeLessThan(59);
    expect(maxAir).toBeLessThan(4);
  });

  it('Boost held through both Helixes stays on the Track', () => {
    const st = newState(T);
    const events = ride(st, LINED_UP, s => { s.boostT = 99; return s.laps > 0; });
    expect(events.filter(e => e.kind === 'respawn')).toEqual([]);
  });

  it('a full-throttle Lap with no Boost is clean too', () => {
    expect(lap(LINED_UP).events.filter(e => e.kind === 'respawn')).toEqual([]);
  });
});
