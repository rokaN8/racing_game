// Hang Time, the big air Track (docs/game-spec.md → Tracks; ticket #38). A 3.2 km figure-8: a lift hill, five Gaps
// onto Landing decks, two Loops. Every Gap clears at 40-76 m/s without Boost and fails below that; the handling is
// the locked one. Built with the turtle.
// Lap: start straight → Loop 1 → right turn → lift hill (to 60 m) → drop Gap → right turn → over-the-top Gap (flies
// over the home straight) → left turn → step-up Gap → left turn → big drop → Loop 2 → left turn → home straight
// under the over-the-top Gap → double (two Gaps back to back) → start line.
import { buildTrack, gap, kicker, loop, straight, turn } from '../turtle';
import type { TrackDef } from '.';

const SPEEDS = { vMin: 40, vMax: 76 }; // slowest that clears every Gap; fastest with Boost (+ a little)

const { cps, checkpointCps, gapSegments } = buildTrack([
  straight(100),
  loop(20, 12),                                                           // Loop 1
  straight(60),
  turn(180, 40, 25),
  straight(40),
  straight(170, { rise: 60 }),                                           // lift hill
  straight(60, { checkpoint: true }),                                    // before the drop Gap
  kicker(30, 8), gap(12, SPEEDS),                                        // drop Gap: deck 12 m lower
  straight(30, { rise: -3 }),
  turn(90, 45, 25),
  straight(60, { checkpoint: true }),                                    // before the over-the-top Gap
  kicker(30, 8), gap(8, SPEEDS),                                         // over-the-top Gap: flies over the home straight
  straight(70, { rise: -4 }),
  turn(-90, 45, -25),
  straight(70, { checkpoint: true }),                                    // before the step-up
  kicker(35, 14), gap(-3, SPEEDS),                                       // step-up Gap: deck 3 m higher
  straight(30, { rise: -3 }),
  turn(-90, 45, -25),
  straight(0, { free: 1, ground: true }),                                // big drop, back to the ground
  straight(60, { checkpoint: true }),                                    // before Loop 2
  loop(22, 12),                                                           // Loop 2
  straight(60),
  turn(-90, 45, -25),
  straight(0, { free: 2, checkpoint: true }),                            // home straight, before the double
  kicker(25, 8), gap(0, { ...SPEEDS, deckCheckpoint: true }),           // double: first Gap, a Checkpoint on its deck
  kicker(25, 8), gap(0, SPEEDS),                                         //         second Gap
  straight(20, { ground: true }),
]);

export const hangTime: TrackDef = {
  id: 'bigair', name: 'Hang Time', kind: 'Big air',
  cps, gapSegments, checkpointCps, halfWidth: 4,
  pilot: { airControl: true, brakes: true, boostStraights: true }, pilotTimes: { 1: 51.09, 3: 150.78, 5: 249.89 },
  palette: { primary: 0xff8a00, secondary: 0xa64dff, sky: 0x0d0418 }, // orange / violet
  // Bright and euphoric, D major I–V–vi–IV: four-on-the-floor, offbeat bass, rising arp.
  song: {
    bpm: 128, echo: 0.4,
    bars: [['D', 38, [54, 57, 62]], ['A', 45, [52, 57, 61]], ['Bm', 47, [54, 59, 62]], ['G', 43, [55, 59, 62]]],
    bass: { pat: '..r...r...r...r.', wave: 'sawtooth', cutoff: 900, vol: 0.15, len: 1.6 },
    pad: { wave: 'sawtooth', cutoff: 2500, vol: 0.04, attack: 0.3 },
    arp: { pat: '012h012h012h012h', wave: 'square', cutoff: 4000, vol: 0.03, len: 0.7, oct: 12 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', vol: 1 },
  },
};
