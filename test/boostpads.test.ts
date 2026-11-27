// Boost pads (docs/game-spec.md → Design rules → Boost pads): turtle placement, bake, and how the Boost they give
// behaves with the Boost button.
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../src/track/bake';
import { boostPad, buildTrack, straight, turn } from '../src/track/turtle';
import { newState, step } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { createPilot, DT, lapDone, NONE } from './pilot';

// a rectangle of R60 banked turns with a 200 m Boost pad starting 150 m after the line
const { cps, checkpointCps, boostPads } = buildTrack([
  straight(150), boostPad(200), straight(350), turn(90, 60, 25), straight(0, { free: 1 }), turn(90, 60, 25),
  straight(0, { free: 2 }), turn(90, 60, 25), straight(300), turn(90, 60, 25),
]);
const def = { cps, checkpointCps, gapSegments: [], halfWidth: 4, boostPads };
const T = bakeTrack(def), bare = bakeTrack({ ...def, boostPads: [] });
const full = { ...NONE, throttle: 1 };

describe('Boost pads', () => {
  it('start where the piece after them starts', () => {
    expect(T.pads).toHaveLength(1);
    expect(T.pads[0].s).toBeCloseTo(150, -1);
    expect(T.pads[0].len).toBe(200);
  });

  it('kick and Boost until about the end of the strip, without touching the button', () => {
    const st = newState(T);
    while (st.s < T.pads[0].s) step(st, full, TUNING, T, DT);
    expect(st.padHits).toBe(1);
    expect(st.boostT).toBeGreaterThan(0);
    expect(st.boostCD).toBeLessThanOrEqual(0); // the button is still ready
    while (st.boostT > 0) step(st, full, TUNING, T, DT);
    const end = T.pads[0].s + T.pads[0].len;
    expect(st.s).toBeGreaterThan(end);
    expect(st.s).toBeLessThan(end + 0.4 * (TUNING.topSpeed + TUNING.boostSpeed)); // about the tail past it
  });

  it("the Boost button never cuts a pad's Boost short", () => {
    const st = newState(T);
    while (st.s < T.pads[0].s + 20) step(st, full, TUNING, T, DT);
    const left = st.boostT;
    step(st, { ...full, boost: true }, TUNING, T, DT);
    expect(st.boostT).toBeCloseTo(left - DT, 6);
    expect(st.boostCD).toBeGreaterThan(0); // but it was used
  });

  it('make a full-throttle Lap faster', () => {
    const a = newState(T), b = newState(bare);
    createPilot(T).ride(a, {}, lapDone); createPilot(bare).ride(b, {}, lapDone);
    expect(a.respawns).toBe(0);
    expect(a.lastLap!).toBeLessThan(b.lastLap! - 0.5);
  });
});
