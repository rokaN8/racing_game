import { describe, expect, it } from 'vitest';
import { buildTrack, gap, kicker, straight, turn } from '../src/track/turtle';

describe('turtle', () => {
  it('solves the two free straights so a Lap closes, and keeps turn radii exact', () => {
    // a rounded rectangle: 4 right turns of radius 20; one side and the return straight are free
    const { cps, free } = buildTrack([
      straight(100), turn(90, 20, 0), straight(0, { free: 1 }), turn(90, 20, 0),
      straight(0, { free: 2 }), turn(90, 20, 0), straight(30), turn(90, 20, 0),
    ]);
    expect(free[0]).toBeCloseTo(30, 6);   // matches the opposite side
    expect(free[1]).toBeCloseTo(100, 6);  // matches the first straight
    const arc = cps.slice(3, 7);          // first turn: centre at (-20, 100)
    for (const [x, , z] of arc) expect(Math.hypot(x + 20, z - 100)).toBeCloseTo(20, 6);
  });

  it('refuses a Lap it cannot close', () => {
    expect(() => buildTrack([straight(0, { free: 1 }), straight(0, { free: 2 }), turn(180, 10, 0)])).toThrow(/parallel/);
    expect(() => buildTrack([straight(100, { rise: 5 }), turn(90, 20, 0), straight(0, { free: 1 }), turn(90, 20, 0),
      straight(0, { free: 2 }), turn(180, 20, 0)])).toThrow(/height/);
    // a step-up deck 10 m above an 8° lip is out of a 40 m/s Bike's reach
    expect(() => buildTrack([kicker(30, 8), gap(-10, { vMin: 40, vMax: 76 })])).toThrow(/reach/);
  });

  it("marks a Gap's two segments as having no geometry and puts its deck at the right height", () => {
    const { cps, gapSegments } = buildTrack([
      straight(50), kicker(30, 8), gap(5, { vMin: 40, vMax: 76 }),
      turn(90, 40, 0), straight(0, { free: 1, ground: true }), turn(90, 40, 0), straight(0, { free: 2 }),
      turn(90, 40, 0), straight(30), turn(90, 40, 0),
    ]);
    const [lip, mid] = gapSegments;
    expect(mid).toBe(lip + 1);
    expect(cps[lip + 2][1]).toBeCloseTo(cps[lip][1] - 5, 6); // the deck starts 5 m below the lip
  });
});
