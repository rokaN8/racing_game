// Run stats and Lifetime stats (docs/game-spec.md → Run stats): counted off state changes each physics step.
import { describe, expect, it } from 'vitest';
import { newState, respawn } from '../src/bike/physics';
import { TUNING } from '../src/bike/tuning';
import { BOOSTED, createPilot, DT, lapDone } from '../src/pilot';
import { bank, createRunStats, loadTotals, saveTotals, STATS_KEY, zeroTotals } from '../src/stats';
import { bakeTrack } from '../src/track/bake';
import { hangTime } from '../src/track/tracks/bigair';

const T = bakeTrack(hangTime);
const { ride } = createPilot(T);

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
};

describe('Run stats', () => {
  it("count a clean Boosted Lap of Hang Time: its distance, airtime, top speed and Boosts", () => {
    const st = newState(T), rs = createRunStats(st);
    let fired = 0, cd = 0;
    ride(st, BOOSTED, s => { rs.step(s, DT); if (s.boostCD > cd) fired++; cd = s.boostCD; return lapDone(s); });
    const r = rs.stats;
    expect(r.laps).toBe(1);
    expect(r.crashes).toBe(0);
    expect(r.dist).toBeGreaterThan(T.L * 0.95); // the Gaps fly a little straighter than the Track
    expect(r.dist).toBeLessThan(T.L * 1.1);
    expect(r.air).toBeGreaterThan(1);
    expect(r.top).toBeGreaterThan(TUNING.topSpeed);
    expect(r.boosts).toBe(fired);
    expect(r.boosts).toBeGreaterThan(0);
    expect(r.time).toBeCloseTo(st.lastLap!, 1); // lapTime starts over as the Lap closes
  });

  it('count a respawn made between steps (the R key) as a crash, and no Perfect landing for it', () => {
    const st = newState(T), rs = createRunStats(st);
    Object.assign(st, { mode: 'air', landGrade: 'perfect' });
    rs.step(st, DT);
    respawn(st, T, TUNING, 'Respawn');
    rs.step(st, DT);
    expect(rs.stats.crashes).toBe(1);
    expect(rs.stats.perfect).toBe(0);
  });

  it('count a Perfect landing', () => {
    const st = newState(T), rs = createRunStats(st);
    st.mode = 'air'; rs.step(st, DT);
    Object.assign(st, { mode: 'track', landGrade: 'perfect' }); rs.step(st, DT);
    expect(rs.stats.perfect).toBe(1);
  });

  it('start from zero on reset, counting from the state then', () => {
    const st = newState(T), rs = createRunStats(st);
    st.respawns = 3; rs.step(st, DT);
    rs.reset(st); rs.step(st, DT);
    expect(rs.stats.crashes).toBe(0);
    expect(rs.stats.time).toBeCloseTo(DT);
  });
});

describe('Lifetime stats', () => {
  it('bank a run into the totals; only a finished one counts as a run', () => {
    const st = newState(T), rs = createRunStats(st);
    rs.step(st, DT);
    const t = bank(bank(zeroTotals(), rs.stats, true), rs.stats, false);
    expect(t.runs).toBe(1);
    expect(t.time).toBeCloseTo(2 * DT);
  });

  it('round-trip through storage', () => {
    const s = memory(), t = { dist: 1234.5, laps: 7, time: 600, runs: 2, crashes: 3 };
    saveTotals(s, t);
    expect(loadTotals(s)).toEqual(t);
  });

  it('read zeros with storage blocked, missing or holding garbage, and 0 for a bad field alone', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(loadTotals(null)).toEqual(zeroTotals());
    expect(loadTotals(blocked)).toEqual(zeroTotals());
    expect(() => saveTotals(blocked, zeroTotals())).not.toThrow();
    expect(loadTotals(memory())).toEqual(zeroTotals());
    expect(loadTotals(memory({ [STATS_KEY]: '{not json' }))).toEqual(zeroTotals());
    expect(loadTotals(memory({ [STATS_KEY]: '42' }))).toEqual(zeroTotals());
    expect(loadTotals(memory({ [STATS_KEY]: '{"dist":-5,"laps":"x","time":60,"runs":null,"crashes":1e400}' })))
      .toEqual({ ...zeroTotals(), time: 60 });
  });
});
