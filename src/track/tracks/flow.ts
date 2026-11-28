// Slipstream, the flow Track (docs/game-spec.md → Tracks; ticket #55). A figure-8 with no braking anywhere: every turn
// holds at full throttle, even Boosted. Built with the turtle.
// Lap: start straight → Boost pad → Loop → right sweeper → Rollercoaster → right sweeper → climbing right onto the
// bridge → Corkscrew over the start straight → curving Wall-ride (left, descending) → Gap → Boost pad down the deck
// run-out → two left sweepers → home straight, under the bridge.
import { boostPad, buildTrack, corkscrew, gap, kicker, loop, straight, turn } from '../turtle';
import type { TrackDef } from '.';

const SPEEDS = { vMin: 40, vMax: 76 }; // the Gap clears from 40 m/s; fastest with Boost (+ a little)

const { cps, checkpointCps, gapSegments, boostPads } = buildTrack([
  straight(100),
  straight(80, { checkpoint: true }),                                    // before the Loop
  boostPad(60), straight(60), straight(60),
  loop(22, 12),                                                           // Loop
  straight(60),
  turn(90, 60, 30),                                                       // right sweeper
  straight(40),
  straight(60, { rise: 12 }), straight(30), straight(60, { rise: -12 }), // Rollercoaster: two rolling hills
  straight(30), straight(50, { rise: 9 }), straight(50, { rise: -9 }),
  straight(40),
  turn(90, 60, 30),                                                       // right sweeper
  straight(150, { checkpoint: true }),                                   // before the climb
  turn(90, 60, 25, { rise: 14 }),                                         // climbing right onto the bridge
  straight(60), straight(167),                                          // 167: centres the upside-down hold over the start straight
  straight(80, { checkpoint: true }),                                    // the bridge, before the Corkscrew
  corkscrew(200, { dir: 1, hold: 40 }),                                   // Corkscrew, over the start straight
  straight(60),
  straight(80, { checkpoint: true }),                                    // before the Wall-ride
  straight(40, { bank: -90 }), turn(-90, 90, -90, { rise: -8 }), straight(40, { bank: 0, rise: -2 }), // curving Wall-ride
  straight(70, { checkpoint: true, rise: -4 }),                          // before the Gap
  kicker(30, 8), gap(0, SPEEDS),                                         // Gap, deck level with the lip
  boostPad(150), straight(150, { ground: true }),                        // Boost pad down the run-out
  turn(-90, 60, -25),                                                     // left sweeper
  straight(0, { free: 1 }),
  turn(-90, 60, -25),                                                     // left sweeper onto the home straight
  straight(0, { free: 2 }),                                              // home straight, on under the bridge
]);

export const slipstream: TrackDef = {
  id: 'flow', name: 'Slipstream', kind: 'Flow',
  cps, gapSegments, checkpointCps, boostPads, halfWidth: 4,
  pilot: { airControl: true, boostStraights: true }, pilotTimes: { 1: 52.14, 3: 157.38, 5: 262.72 },
  palette: { primary: 0x00ffa3, secondary: 0xc400ff, sky: 0x000a06 }, // mint / ultraviolet
  // Dreamy and wide, C major I–vi–IV–V with sevenths: half-time beat, slow pads, echoing arp.
  song: {
    bpm: 96, echo: 0.5,
    bars: [['Cmaj7', 36, [55, 59, 60, 64]], ['Am7', 45, [55, 57, 60, 64]], ['Fmaj7', 41, [53, 57, 60, 64]], ['G', 43, [55, 59, 62, 67]]],
    bass: { pat: 'r.......r...o...', wave: 'sawtooth', cutoff: 600, vol: 0.16, len: 3 },
    pad: { wave: 'sawtooth', cutoff: 1800, vol: 0.05, attack: 0.8 },
    arp: { pat: '0.1.2.3.2.1.0.1.', wave: 'triangle', cutoff: 3500, vol: 0.045, len: 1.5, oct: 12 },
    drums: { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', vol: 0.7 },
  },
};
