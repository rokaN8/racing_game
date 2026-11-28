// Wind and Ghost whoosh (docs/game-spec.md → Wind and Ghost whoosh): the rules audio.ts plays.
import { describe, expect, it } from 'vitest';
import { edgeNear, ghostPass, gust, PASS_RANGE, RUMBLE_START, rumbleOn } from '../src/audio/wind';

describe('rumble strip', () => {
  it('starts 2 m short of the edge and is full at it; silent in the air', () => {
    expect(edgeNear(RUMBLE_START)).toBe(0);
    expect(edgeNear(5)).toBe(0);
    expect(edgeNear(1)).toBeCloseTo(0.5);
    expect(edgeNear(0)).toBe(1);
    expect(edgeNear(-0.5)).toBe(1); // past the edge, before the fall
    expect(edgeNear(null)).toBe(0);
  });

  it('pulses once every 4 m ridden, on for the first 35 % of each', () => {
    expect([0, 1, 1.5, 3, 4, 5.3].map(rumbleOn)).toEqual([true, true, false, false, true, true]);
  });
});

describe('gust', () => {
  it('stays between 0.4 and 1', () => {
    for (let t = 0; t < 600; t += 0.37) { expect(gust(t)).toBeGreaterThanOrEqual(0.4); expect(gust(t)).toBeLessThanOrEqual(1); }
  });
});

describe('ghostPass', () => {
  it("is you passing the Ghost when it goes from ahead to behind, and it passing you the other way", () => {
    expect(ghostPass(2, -1, 3)).toBe('passed');
    expect(ghostPass(-2, 1, 3)).toBe('passedBy');
  });

  it('needs a crossing, within 12 m, with a frame before', () => {
    expect(ghostPass(5, 3, 4)).toBeNull();
    expect(ghostPass(2, -1, PASS_RANGE)).toBeNull(); // far off to the side, as on a parallel stretch
    expect(ghostPass(null, -1, 3)).toBeNull();       // first frame, or just after a respawn
    expect(ghostPass(1, 0, 3)).toBeNull();           // level with the camera: wait for it to cross
  });
});
