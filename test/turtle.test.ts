import { describe, expect, it } from 'vitest';
import { buildTrack, straight, turn } from '../src/track/turtle';

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
  });
});
