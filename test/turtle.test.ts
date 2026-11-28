import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { buildTrack, corkscrew, gap, kicker, straight, turn, type Piece } from '../src/track/turtle';
import { newState, respawn } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { createPilot, lapDone } from '../src/pilot';

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

  it.each([[1, 0], [-1, 0], [1, 80]] as const)('a Corkscrew (dir %i, hold %i m) turns the Bike upside down and leaves no twist behind', (dir, hold) => {
    // the same rectangle with and without a 200 m Corkscrew on its first side
    const lap = (first: Piece[]) => bakeTrack({ ...buildTrack([
      ...first, turn(90, 40, 20), straight(0, { free: 1 }), turn(90, 40, 20),
      straight(0, { free: 2 }), turn(90, 40, 20), straight(300), turn(90, 40, 20),
    ]), gapSegments: [], halfWidth: 4 });
    const T = lap([straight(50), corkscrew(200, { dir, hold }), straight(50)]), flat = lap([straight(300)]);
    expect(T.L).toBeCloseTo(flat.L, 0);
    expect(sampleAt(T, 150).u.y).toBeLessThan(-0.99); // halfway through: upside down
    if (hold) expect(sampleAt(T, 150 - hold / 2 + 5).u.y).toBeLessThan(-0.99); // held inverted
    expect(sampleAt(T, 120).u.x * dir).toBeLessThan(0); // rolls the chosen way: dir 1 leans up towards the right (−x here)
    for (const s of [260, 400, 900, T.L - 1]) expect(sampleAt(T, s).u.angleTo(sampleAt(flat, s).u)).toBeLessThan(0.01); // no unwinding after it or at the seam
  });

  it('a Helix (a turn past 360° with a rise) stacks its coils with headroom, closes at 1080° and rides clean', () => {
    // Tight tower, the shape picked for the Helix piece (#75): 900° at R30, bank 35, +60 m, split in two halves so a
    // Checkpoint sits halfway up it; then down to the ground and two return turns, 1080° in all
    const T = bakeTrack({ ...buildTrack([
      straight(250), straight(80, { checkpoint: true }),
      turn(450, 30, 35, { rise: 30 }), turn(450, 30, 35, { rise: 30, checkpoint: true }),
      straight(0, { free: 1, ground: true }), turn(90, 25, 50), straight(0, { free: 2 }), turn(90, 25, 50),
    ]), gapSegments: [], halfWidth: 4 });
    const top = Math.max(...T.pos.map(p => p.y));
    expect(top).toBeCloseTo(60, 0);
    // coils 24 m apart: every pass within a Track width of another, 40 m+ along the Track, has 8 m of headroom
    let headroom = Infinity;
    for (let i = 0; i < T.N; i++) for (let j = i + 1; j < T.N; j++) {
      if (Math.min(j - i, T.N - j + i) * T.ds < 40) continue;
      const a = T.pos[i], b = T.pos[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 2 * T.halfWidth) headroom = Math.min(headroom, Math.abs(a.y - b.y));
    }
    expect(headroom).toBeGreaterThan(16);
    expect(sampleAt(T, T.L - 1e-3).u.angleTo(sampleAt(T, 0).u)).toBeLessThan(0.01); // three whole turns close with no twist
    // full throttle holds it, and a 20 m/s respawn halfway up rides clean to the top
    const { ride } = createPilot(T), st = newState(T);
    expect(ride(st, {}, lapDone).filter(e => e.kind === 'respawn')).toEqual([]);
    st.lastCP = 2; respawn(st, T, TUNING, 'test');
    ride(st, { brakes: true }, s => s.respawns > 1 || s.s > T.cpS[2] + 300);
    expect(st.respawns).toBe(1);
  });
});
