// Grand tour (docs/game-spec.md → Grand tour): every Track back to back, one Lap each, one total. Each leg is a 1-Lap
// run of its Track (its Ghost, its top 5); this module keeps only the tour's own top 5. Pure but for storage.

export interface TourScore { time: number; date: number | null; legs: number[] } // legs: each leg's time, in TRACKS order
export const TOUR_KEY = 'neon-racer.tour.v1', TOUR_MAX = 5;

const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

// The tour's top 5, fastest first. legCount: how many legs a tour has; a score with another count (a Track added
// since) or garbage is dropped. Blocked or missing storage: none.
export function loadTour(storage: Storage | null, legCount: number): TourScore[] {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(TOUR_KEY) ?? 'null');
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is TourScore => !!x && isTime(x.time) && (x.date === null || typeof x.date === 'number')
      && Array.isArray(x.legs) && x.legs.length === legCount && x.legs.every(isTime))
      .sort((a, b) => a.time - b.time).slice(0, TOUR_MAX);
  } catch { return []; }
}
export function saveTour(storage: Storage | null, scores: readonly TourScore[]) {
  try { if (scores.length) storage?.setItem(TOUR_KEY, JSON.stringify(scores)); else storage?.removeItem(TOUR_KEY); }
  catch { /* blocked or full: this session only */ }
}

// A finished tour slotted into the top 5: an equal time ranks below the one already there. rank: 1-5, or null outside.
export function rankTour(scores: readonly TourScore[], legs: number[], date: number) {
  const time = legs.reduce((a, b) => a + b, 0);
  let i = scores.findIndex(s => time < s.time);
  if (i < 0) i = scores.length;
  if (i >= TOUR_MAX) return { scores: [...scores], rank: null, time };
  return { scores: [...scores.slice(0, i), { time, date, legs }, ...scores.slice(i)].slice(0, TOUR_MAX), rank: i + 1, time };
}

// The Pilot's tour time, which the tour's Medals are set from: its 1-Lap times added up.
export const tourPilotTime = (tracks: readonly { pilotTimes: Record<1, number> }[]) =>
  Math.round(tracks.reduce((a, t) => a + t.pilotTimes[1], 0) * 100) / 100;
