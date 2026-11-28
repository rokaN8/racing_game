// PROTOTYPE (#78): the scratch Track closes, rides clean, and every Loop top holds above stickSpeed.
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../src/track/bake';
import { buildTunnelVariant, TUNNELS } from '../src/track/tracks/prototype-tunnel';
import { newState, respawn } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { createPilot, lapDone } from '../src/pilot';

const T = bakeTrack(buildTunnelVariant('A'));
const { ride } = createPilot(T);

describe('prototype Tunnel / Double Loop Track', () => {
  it('has two 200 m Tunnels and four Loops', () => {
    expect(TUNNELS.map(t => t.len)).toEqual([200, 200]);
    expect(T.up.filter((u, i) => u.y < -0.9 && (i === 0 || T.up[i - 1].y >= -0.9))).toHaveLength(4);
  });

  it.each([{}, { boostStraights: true }, { boost: true }])('a Lap rides clean (%o), each Loop top stays over 18 m/s', o => {
    const st = newState(T), tops: number[] = [];
    let up = false;
    const ev = ride(st, o, s => {
      const u = T.up[Math.floor(s.s / T.ds) % T.N].y < 0;
      if (s.mode === 'track' && u) { if (!up) tops.push(99); tops[tops.length - 1] = Math.min(tops.at(-1)!, s.speed); }
      up = s.mode === 'track' && u; return lapDone(s);
    });
    console.log(JSON.stringify(o), 'lap', st.lastLap?.toFixed(2), 'L', T.L.toFixed(0), 'Loop tops', tops.map(v => v.toFixed(1)).join(' '));
    expect(ev.filter(e => e.kind === 'respawn')).toEqual([]);
    expect(tops).toHaveLength(4);
    for (const v of tops) expect(v).toBeGreaterThan(TUNING.stickSpeed);
  });

  it.each([3, 4])('a 20 m/s respawn at Checkpoint %i clears its Double Loop', k => {
    const st = newState(T); st.lastCP = k; respawn(st, T, TUNING, 'test');
    const tops: number[] = []; let up = false;
    ride(st, {}, s => {
      const u = T.up[Math.floor(s.s / T.ds) % T.N].y < 0;
      if (s.mode === 'track' && u) { if (!up) tops.push(99); tops[tops.length - 1] = Math.min(tops.at(-1)!, s.speed); }
      up = s.mode === 'track' && u; return s.respawns > 1 || s.s > T.cpS[k] + 400;
    });
    console.log('respawn cp', k, 'tops', tops.map(v => v.toFixed(1)).join(' '));
    expect(st.respawns).toBe(1);
  });
});
