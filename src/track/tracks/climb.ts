// Vertigo, the climb Track (docs/game-spec.md → Tracks; ticket #77). A single loop (360° right) up a 150 m tower,
// a long Gap off the top and a second tower back down. Both Helixes are 3 turns at R40, bank 35°, which hold even
// Boosted, so nothing brakes. The Gap clears at 50-76 m/s without Boost (top speed is 55). Built with the turtle.
// Lap: start straight → right sweeper → climb Helix (right, +150 m) → top straight → Gap (deck 12 m lower)
// → descent Helix (left, −138 m) → run-out → three right sweepers → home straight.
import { buildTrack, gap, kicker, straight, turn } from '../turtle';
import type { TrackDef } from '.';

const SPEEDS = { vMin: 50, vMax: 76 }; // 50: a 108 m Gap; any slower comes down too steep for a 12 m drop. 76: Boost (+ a little)

const { cps, checkpointCps, gapSegments } = buildTrack([
  straight(100),
  turn(90, 60, 25),                                                       // right sweeper
  straight(60, { checkpoint: true }),                                    // the foot of the climb
  turn(540, 40, 35, { rise: 75 }),                                       // climb Helix, first half
  turn(540, 40, 35, { rise: 75, checkpoint: true }),                     //              second half
  straight(80, { checkpoint: true }),                                    // the top, before the Gap
  kicker(30, 8), gap(12, SPEEDS),                                        // the Gap off the top: deck 12 m lower
  turn(-540, 40, -35, { rise: -69 }),                                    // descent Helix, first half
  turn(-540, 40, -35, { rise: -69, checkpoint: true }),                  //                second half
  straight(80, { ground: true }),                                        // run-out, back to the ground
  turn(90, 60, 25),                                                       // right sweeper
  straight(0, { free: 2 }),
  turn(90, 60, 25),                                                       // right sweeper
  straight(0, { free: 1 }),                                              // back straight, past the towers
  turn(90, 60, 25),                                                       // right sweeper onto the home straight
  straight(60),                                                          // home straight
]);

export const vertigo: TrackDef = {
  id: 'climb', name: 'Vertigo', kind: 'Climb',
  cps, gapSegments, checkpointCps, halfWidth: 4,
  pilot: { airControl: true, boostStraights: true }, pilotTimes: { 1: 53.15, 3: 158.55, 5: 263.96 },
  palette: { primary: 0x2979ff, secondary: 0xff3ea5, sky: 0x00040f }, // electric blue / hot pink
  // Climbing, D minor i–VI–III–VII: four-on-the-floor, a staircase arp that climbs each bar.
  song: {
    bpm: 112, echo: 0.45,
    bars: [['Dm', 38, [57, 62, 65]], ['Bb', 46, [58, 62, 65]], ['F', 41, [57, 60, 65]], ['C', 36, [55, 60, 64]]],
    bass: { pat: 'r.r.o.r.r.r.o.r.', wave: 'sawtooth', cutoff: 800, vol: 0.14, len: 1.2 },
    pad: { wave: 'sawtooth', cutoff: 2000, vol: 0.04, attack: 0.4 },
    arp: { pat: '0.1.2.h.1.2.h.2.', wave: 'square', cutoff: 3800, vol: 0.03, len: 0.8, oct: 12 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..xx..xx..xx..xx', vol: 0.9 },
  },
};
