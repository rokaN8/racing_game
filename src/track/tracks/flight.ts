// Afterglow, the flight Track (docs/game-spec.md → Tracks; ticket #56). A single big loop (360° right), no crossings and
// no braking: every turn holds at full throttle, even Boosted. Five Gaps clear at 40-76 m/s without Boost; each Boost
// pad ends ≥200 m before the next Kicker, so every lip is back under 76 m/s. Built with the turtle.
// Lap: start straight → launch Gap → right sweeper → lift hill with a Boost pad → Corkscrew along the ridge, straight
// into the drop Gap → descending left sweeper → step-up Gap → 180° right sweeper → big drop → Loop → Boost pad
// down the back straight → right sweeper → double (two Gaps back to back) → right sweeper → home straight.
import { boostPad, buildTrack, corkscrew, gap, kicker, loop, straight, turn } from '../turtle';
import type { TrackDef } from '.';

const SPEEDS = { vMin: 40, vMax: 76 }; // slowest that clears every Gap; fastest with Boost (+ a little)

const { cps, checkpointCps, gapSegments, boostPads } = buildTrack([
  straight(80),                                                          // a standing start makes 40 m/s in ~32 m
  kicker(30, 8), gap(6, SPEEDS),                                         // launch Gap: deck 6 m lower
  turn(90, 60, 25),                                                       // right sweeper
  boostPad(140), straight(160, { rise: 40, checkpoint: true }),         // lift hill, a Boost pad up most of it (ends 200 m before the drop Gap's Kicker)
  straight(80, { checkpoint: true }),                                    // the ridge, before the Corkscrew
  corkscrew(100, { dir: -1 }),                                            // Corkscrew, straight into the drop Gap
  kicker(30, 8), gap(10, SPEEDS),                                        // drop Gap: deck 10 m lower
  turn(-90, 60, -25, { rise: -10, checkpoint: true }),                    // descending left sweeper, before the step-up
  kicker(35, 14), gap(-3, SPEEDS),                                       // step-up Gap: deck 3 m higher
  turn(180, 60, 25),                                                      // right sweeper
  straight(200, { ground: true }),                                       // big drop, back to the ground
  straight(60, { checkpoint: true }),                                    // before the Loop
  loop(22, 12),                                                           // Loop
  straight(40),
  boostPad(150), straight(150), straight(0, { free: 2 }),               // Boost pad down the back straight
  turn(90, 60, 25),                                                       // right sweeper
  straight(60, { checkpoint: true }),                                    // before the double
  kicker(25, 8), gap(0, { ...SPEEDS, deckCheckpoint: true }),           // double: first Gap, a Checkpoint on its deck
  kicker(25, 8), gap(0, SPEEDS),                                         //         second Gap
  straight(0, { free: 1, ground: true }),                                // run-out, down off the double decks
  turn(90, 60, 25),                                                       // right sweeper onto the home straight
  straight(40),                                                          // home straight
]);

export const afterglow: TrackDef = {
  id: 'flight', name: 'Afterglow', kind: 'Flight',
  cps, gapSegments, checkpointCps, boostPads, halfWidth: 4,
  palette: { primary: 0xff3d7f, secondary: 0xffd000, sky: 0x12020a }, // rose / gold
  // Big and anthemic, A♭ major I–V–vi–IV: half-time drums, long bass, echoing arp.
  song: {
    bpm: 140, echo: 0.5,
    bars: [['Ab', 44, [56, 60, 63]], ['Eb', 39, [55, 58, 63]], ['Fm', 41, [56, 60, 65]], ['Db', 37, [56, 61, 65]]],
    bass: { pat: 'r.......r.r.....', wave: 'sawtooth', cutoff: 1000, vol: 0.15, len: 4 },
    pad: { wave: 'sawtooth', cutoff: 3000, vol: 0.05, attack: 0.2 },
    arp: { pat: 'h.2.1.0.h.2.1.0.', wave: 'square', cutoff: 4500, vol: 0.03, len: 1, oct: 12 },
    drums: { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', vol: 1 },
  },
};
