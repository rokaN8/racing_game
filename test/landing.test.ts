// Landing grades and the Perfect landing's Boost (docs/game-spec.md → Landing grades; ticket #80).
import { describe, expect, it } from 'vitest';
import { bakeTrack, sampleAt } from '../src/track/bake';
import { hangTime } from '../src/track/tracks/bigair';
import { frameQuat, newState, type BikeState } from '../src/bike/physics';
import { landingGrade, PERFECT_BOOST, TUNING } from '../src/bike/tuning';
import { createPilot } from '../src/pilot';

const T = bakeTrack(hangTime);
const { gaps, ride } = createPilot(T);
const deck = sampleAt(T, gaps[0][1] + 20); // Hang Time's drop Gap: its flat Landing deck

// Leave the drop Gap's lip at 55 m/s and land. level: hold the Bike square to the deck all flight (a Perfect
// landing). edge: pretend the flight didn't start at a Gap (an edge or ceiling drop).
function jump({ level = false, edge = false } = {}) {
  const st = newState(T);
  Object.assign(st, { s: gaps[0][0] - 1, speed: 55 });
  let landed: BikeState | null = null;
  ride(st, { airControl: !level }, s => {
    if (s.mode === 'air') { if (level) s.quat.copy(frameQuat(deck)); if (edge) s.fromGap = false; }
    if (s.mode === 'track' && s.s > gaps[0][1] && !landed) landed = { ...s };
    return landed !== null || s.respawns > 0;
  });
  return landed! as BikeState;
}

describe('Landing grades', () => {
  it('bands: Perfect ≤5°, Clean ≤20°, Sketchy up to the bad-landing limit', () => {
    expect([0, 5, 6, 20, 21, TUNING.landingTolerance].map(landingGrade)).toEqual(['perfect', 'perfect', 'clean', 'clean', 'sketchy', 'sketchy']);
  });

  it('a Perfect landing from a Gap says PERFECT and Boosts for PERFECT_BOOST, leaving the Boost button alone', () => {
    const st = jump({ level: true });
    expect(st.landGrade).toBe('perfect');
    expect(st.msg).toBe('PERFECT');
    expect(st.msgKind).toBe('perfect');
    expect(st.boostT).toBeGreaterThan(PERFECT_BOOST - 0.02);
    expect(st.boostLen).toBe(PERFECT_BOOST);
    expect(st.boostCD).toBeLessThanOrEqual(0); // the Boost button is still ready
  });

  it('a Perfect landing from an edge or ceiling drop is graded but earns no Boost', () => {
    const st = jump({ level: true, edge: true });
    expect(st.landGrade).toBe('perfect');
    expect(st.boostT).toBeLessThanOrEqual(0); // no Boost running
  });

  it('lining up on the flight path (the Pilot) lands Clean or Sketchy, with no Boost', () => {
    const st = jump();
    expect(['clean', 'sketchy']).toContain(st.landGrade);
    expect(st.msg).toMatch(/^(Clean|Sketchy) · \d+°$/);
    expect(st.boostT).toBeLessThanOrEqual(0); // no Boost running
  });
});
