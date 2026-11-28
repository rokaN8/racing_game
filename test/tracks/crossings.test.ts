// Knot's own Lap checks (shared checks for every Track live in test/track.test.ts).
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../../src/track/bake';
import { knot } from '../../src/track/tracks/crossings';
import { newState } from '../../src/bike/physics';
import { createPilot, lapDone, type Pilot } from '../../src/pilot';

const T = bakeTrack(knot);
const { ride } = createPilot(T);

// Each crossing as [over, under] sample indices: two passes ≥60 m apart along the Track whose centre lines meet.
const crossings: [number, number][] = [];
for (let i = 0; i < T.N; i++) for (let j = i + 60; j < T.N; j++) {
  if (T.N - j + i < 60) continue;
  const a = T.pos[i], b = T.pos[j];
  if (Math.hypot(a.x - b.x, a.z - b.z) > 0.7 || crossings.some(([p, q]) => Math.min(Math.abs(p - i), Math.abs(q - i)) < 20)) continue;
  crossings.push(a.y > b.y ? [i, j] : [j, i]);
}
const cleanLap = (o: Pilot, hold = false) => {
  const st = newState(T);
  const events = ride(st, o, s => { if (hold) s.boostT = 99; return lapDone(s); });
  return { st, respawns: events.filter(e => e.kind === 'respawn') };
};

describe('Knot', () => {
  it('crosses itself 5 times, each over-pass ≥12 m above its under-pass', () => {
    expect(crossings).toHaveLength(5);
    for (const [o, u] of crossings) expect(T.pos[o].y - T.pos[u].y).toBeGreaterThan(12);
  });

  it('rides every under-pass inside a Tunnel, and the Corkscrew upside down over its crossing', () => {
    expect(T.tunnels).toHaveLength(5);
    for (const [, u] of crossings) expect(T.tunnels.some(t => u * T.ds > t.s + 10 && u * T.ds < t.s + t.len - 10), `under-pass at ${u}`).toBe(true);
    expect(crossings.filter(([o]) => T.up[o].y < -0.9)).toHaveLength(1);
  });

  it('has 5 Checkpoints and three upside-down tops (the Double Loop and the Corkscrew)', () => {
    expect(T.cpS).toHaveLength(5);
    expect(T.up.filter((u, i) => u.y < -0.9 && (i === 0 || T.up[i - 1].y >= -0.9))).toHaveLength(3);
  });

  it('a Lap with Boost on the straights is clean and takes about 54 s', () => {
    const { st, respawns } = cleanLap(knot.pilot);
    expect(respawns).toEqual([]);
    expect(st.lastLap!).toBeGreaterThan(49);
    expect(st.lastLap!).toBeLessThan(59);
  });

  it('Boost held all Lap is clean: nothing needs braking', () => {
    expect(cleanLap({}, true).respawns).toEqual([]);
  });

  it('a full-throttle Lap with no Boost is clean too', () => {
    expect(cleanLap({}).respawns).toEqual([]);
  });
});
