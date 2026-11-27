// PROTOTYPE check for the Boost pad variants (ticket #53). Throwaway.
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../src/track/bake';
import { buildPadVariant } from '../src/track/tracks/prototype-boost-pads';
import { newState } from '../src/bike/physics';
import { createPilot, lapDone } from './pilot';

describe.each(['A', 'B', 'C'] as const)('Boost pads %s', k => {
  const T = bakeTrack(buildPadVariant(k)), none = bakeTrack({ ...buildPadVariant(k), boostPads: [] });
  it('hits all three pads and laps clean, faster than without pads', () => {
    const st = newState(T), ev = createPilot(T).ride(st, {}, lapDone);
    const st0 = newState(none); createPilot(none).ride(st0, {}, lapDone);
    expect(ev.filter(e => e.kind === 'respawn')).toEqual([]);
    expect(st.padHits).toBe(3);
    console.log(k, `pads at ${T.pads.map(p => p.s.toFixed(0))} · Lap ${st.lastLap!.toFixed(2)} s vs ${st0.lastLap!.toFixed(2)} s without`);
    expect(st.lastLap!).toBeLessThan(st0.lastLap!);
  });
});
