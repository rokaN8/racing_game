// Grand tour (docs/game-spec.md → Grand tour): the tour's own top 5, its key, and the Pilot's tour time.
import { describe, expect, it } from 'vitest';
import { loadTour, rankTour, saveTour, TOUR_KEY, tourPilotTime, type TourScore } from '../src/tour';
import { TRACKS } from '../src/track/tracks';

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as Storage;
};
const legs = (t: number) => [t - 6, 1, 1, 1, 1, 1, 1]; // sums to t exactly
const score = (t: number): TourScore => ({ time: t, date: 1, legs: legs(t) });

describe('rankTour', () => {
  it('slots a tour in by its total, an equal time below the one already there', () => {
    const top = [score(350), score(360)];
    expect(rankTour(top, legs(355), 9)).toMatchObject({ rank: 2, time: 355 });
    expect(rankTour(top, legs(350), 9).rank).toBe(2);
    expect(rankTour(top, legs(340), 9).scores[0]).toMatchObject({ time: 340, date: 9 });
  });

  it('keeps 5, and a slower tour is outside them', () => {
    const top = [350, 351, 352, 353, 354].map(score);
    const r = rankTour(top, legs(400), 9);
    expect(r.rank).toBeNull();
    expect(r.scores).toHaveLength(5);
    expect(rankTour(top, legs(349), 9).scores.map(s => s.time)).toEqual([349, 350, 351, 352, 353]);
  });
});

describe('the tour key', () => {
  it('round-trips, and an empty top 5 removes the key', () => {
    const s = memory();
    saveTour(s, [score(350)]);
    expect(loadTour(s, 7)).toEqual([score(350)]);
    saveTour(s, []);
    expect(s.getItem(TOUR_KEY)).toBeNull();
  });

  it('reads none with storage blocked, missing or holding garbage, and drops bad scores', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(loadTour(null, 7)).toEqual([]);
    expect(loadTour(blocked, 7)).toEqual([]);
    expect(() => saveTour(blocked, [score(1)])).not.toThrow();
    expect(loadTour(memory({ [TOUR_KEY]: '{x' }), 7)).toEqual([]);
    const mixed = [score(360), { time: -1, date: 1, legs: legs(7) }, { ...score(300), legs: [1, 2] }, 'junk', score(350)];
    expect(loadTour(memory({ [TOUR_KEY]: JSON.stringify(mixed) }), 7).map(s => s.time)).toEqual([350, 360]); // re-sorted
  });
});

describe('tourPilotTime', () => {
  it("adds up every Track's 1-Lap Pilot time", () => {
    const sum = TRACKS.reduce((a, t) => a + t.pilotTimes[1], 0);
    expect(tourPilotTime(TRACKS)).toBeCloseTo(sum, 2);
    expect(tourPilotTime(TRACKS)).toBeGreaterThan(300);
  });
});
