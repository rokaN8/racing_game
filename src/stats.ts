// Run stats and Lifetime stats (docs/game-spec.md → Run stats). Pure, no DOM: main.ts feeds the run's counter every
// physics step and banks it into the totals when a run ends. Everything counts off state changes between steps, so
// a respawn from the R key (outside a step) is caught on the next one.
import type { BikeState } from './bike/physics';

export interface RunStats {
  air: number; top: number; crashes: number; boosts: number; pads: number; perfect: number; // shown on Finish
  dist: number; laps: number; time: number;                                                // for the totals
}
export interface Totals { dist: number; laps: number; time: number; runs: number; crashes: number }
export const STATS_KEY = 'neon-racer.stats.v1';

const zeroRun = (): RunStats => ({ air: 0, top: 0, crashes: 0, boosts: 0, pads: 0, perfect: 0, dist: 0, laps: 0, time: 0 });
export const zeroTotals = (): Totals => ({ dist: 0, laps: 0, time: 0, runs: 0, crashes: 0 });
type Seen = Pick<BikeState, 'mode' | 'boostCD' | 'respawns' | 'padHits' | 'laps'>;
const seen = (st: BikeState): Seen => ({ mode: st.mode, boostCD: st.boostCD, respawns: st.respawns, padHits: st.padHits, laps: st.laps });

export function createRunStats(st: BikeState) {
  let r = zeroRun(), was = seen(st);
  return {
    get stats(): Readonly<RunStats> { return r; },
    // A fresh run (or the rest of one, once banked): zeros, counting from the Bike's state now.
    reset(now: BikeState) { r = zeroRun(); was = seen(now); },
    step(now: BikeState, dt: number) {
      const speed = now.mode === 'track' ? Math.abs(now.speed) : now.vel.length(), crashed = now.respawns > was.respawns;
      r.time += dt; r.dist += speed * dt; r.top = Math.max(r.top, speed);
      if (now.mode === 'air') r.air += dt;
      r.crashes += Math.max(0, now.respawns - was.respawns);
      r.pads += Math.max(0, now.padHits - was.padHits);
      r.laps += Math.max(0, now.laps - was.laps);
      if (now.boostCD > was.boostCD) r.boosts++; // only a fired Boost starts the cooldown; pads and Perfect landings don't
      if (was.mode === 'air' && now.mode === 'track' && !crashed && now.landGrade === 'perfect') r.perfect++;
      was = seen(now);
    },
  };
}

// The run added to the totals; `finished` counts it as a run finished.
export const bank = (t: Totals, r: RunStats, finished: boolean): Totals => ({
  dist: t.dist + r.dist, laps: t.laps + r.laps, time: t.time + r.time, runs: t.runs + (finished ? 1 : 0), crashes: t.crashes + r.crashes,
});

// Zeros when storage is blocked, the key is missing or it holds garbage; a bad field alone reads as 0.
export function loadTotals(storage: Storage | null): Totals {
  const t = zeroTotals();
  try {
    const raw: unknown = JSON.parse(storage?.getItem(STATS_KEY) ?? 'null');
    if (raw && typeof raw === 'object') for (const k of Object.keys(t) as (keyof Totals)[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) t[k] = v;
    }
  } catch { /* blocked or garbage: zeros */ }
  return t;
}
export function saveTotals(storage: Storage | null, t: Totals) {
  try { storage?.setItem(STATS_KEY, JSON.stringify(t)); } catch { /* blocked or full: the totals last this session */ }
}
