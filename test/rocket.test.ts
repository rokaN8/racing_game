// Rocket start (docs/game-spec.md → Rocket start; ticket #81): judged at GO from how long the throttle has been held.
import { describe, expect, it } from 'vitest';
import { bakeTrack } from '../src/track/bake';
import { overdrive } from '../src/track/tracks/allround';
import { launchAtGo, newState, step } from '../src/bike/physics';
import { ROCKET_SPEED, ROCKET_WINDOW, STALL_TIME, TUNING } from '../src/bike/tuning';
import { DT, NONE } from '../src/pilot';

const T = bakeTrack(overdrive);
const FULL = { ...NONE, throttle: 1 };
// Hold full throttle from GO for `t` s; where is the Bike?
const after = (heldFor: number | null, t = 2) => {
  const st = newState(T), go = launchAtGo(st, heldFor);
  for (let i = 0; i < t / DT; i++) step(st, FULL, TUNING, T, DT);
  return { st, go };
};

describe('Rocket start', () => {
  it('a press that began in the last ROCKET_WINDOW s before GO launches at ROCKET_SPEED', () => {
    for (const held of [0, 0.1, ROCKET_WINDOW]) {
      const st = newState(T);
      expect(launchAtGo(st, held)).toBe('rocket');
      expect(st.speed).toBe(ROCKET_SPEED);
      expect([st.msg, st.msgKind]).toEqual(['ROCKET START', 'rocket']);
    }
  });

  it('a press held from earlier Stalls: throttle does nothing for STALL_TIME s', () => {
    const st = newState(T);
    expect(launchAtGo(st, ROCKET_WINDOW + 0.01)).toBe('stall');
    expect([st.msg, st.msgKind]).toEqual(['STALLED', 'stall']);
    for (let i = 0; i < (STALL_TIME - 0.05) / DT; i++) step(st, FULL, TUNING, T, DT);
    expect(st.speed).toBe(0);
    for (let i = 0; i < 0.2 / DT; i++) step(st, FULL, TUNING, T, DT);
    expect(st.speed).toBeGreaterThan(0);
  });

  it('no press at GO is a plain standing start', () => {
    const st = newState(T);
    expect(launchAtGo(st, null)).toBeNull();
    expect([st.speed, st.stallT, st.msg]).toEqual([0, 0, '']);
  });

  it('after 2 s at full throttle, a Rocket start is ~0.5 s ahead of a standing start and a Stall ~0.5 s behind', () => {
    const none = after(null).st.s, rocket = after(0.1).st.s, stall = after(1).st.s;
    expect((rocket - none) / TUNING.topSpeed).toBeGreaterThan(0.35);
    expect((none - stall) / TUNING.topSpeed).toBeGreaterThan(0.35);
  });
});
