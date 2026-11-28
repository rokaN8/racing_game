// Switchback, the technical Track (docs/game-spec.md → Tracks; ticket #37). A 3 km figure-8 with no Gaps: turns too
// tight to hold at top speed, so the player has to brake or lift. Built with the turtle (straights and arcs).
// Lap: start straight → hairpin (R) → chicane → left 90 → switchback (L, R) → climb → sweeper (R) → overpass with the
// bridge chicane → curving Wall-ride (L, descending) → esses → double-apex (L) → final chicane under the overpass → home.
import { buildTrack, straight, turn } from '../turtle';
import type { TrackDef } from '.';

const { cps, checkpointCps } = buildTrack([
  straight(130),
  straight(170, { checkpoint: true }),                                   // before the hairpin
  turn(180, 11, 10),                                                      // hairpin
  straight(110, { checkpoint: true }),                                   // before the chicane
  turn(-45, 22, 0), turn(90, 22, 0), turn(-45, 22, 0),                   // chicane
  straight(60),
  turn(-90, 30, -15),                                                     // left 90
  straight(200, { checkpoint: true }),                                   // before the switchback
  turn(-180, 13, -10), straight(110), turn(180, 13, 10),                 // switchback
  straight(120, { rise: 12 }),                                           // climb to the overpass
  turn(150, 50, 15),                                                      // sweeper
  straight(0, { free: 1, checkpoint: true }),                            // the bridge, before the bridge chicane
  turn(50, 14, 0), turn(-100, 14, 0), turn(50, 14, 0),                   // bridge chicane
  straight(60, { rise: -2 }),
  straight(80, { checkpoint: true }),                                    // before the Wall-ride
  straight(40, { bank: -90 }), turn(-150, 90, -90, { rise: -6 }), straight(40, { bank: 0, rise: -2 }), // curving Wall-ride
  turn(-40, 30, -18, { rise: -1 }), turn(80, 30, 18, { rise: -1 }), turn(-80, 30, -18), turn(40, 30, 18), // esses
  straight(100, { checkpoint: true }),                                   // before the double-apex
  turn(-45, 15, -10), straight(25, { bank: -10 }), turn(-45, 15, -10),   // double-apex
  straight(0, { free: 2 }),                                              // under the overpass
  turn(-40, 16, 0), turn(80, 16, 0), turn(-40, 16, 0),                   // final chicane
  straight(70),
]);

export const switchback: TrackDef = {
  id: 'technical', name: 'Switchback', kind: 'Technical',
  cps, gapSegments: [], checkpointCps, halfWidth: 4,
  pilot: { brakes: true, boostStraights: true }, pilotTimes: { 1: 54.15, 3: 161.52, 5: 268.93 },
  palette: { primary: 0x39ff14, secondary: 0xffb000, sky: 0x010a04 }, // acid green / amber
  // Dark and driving, E Phrygian: 16th bass, choppy arp, syncopated kick.
  song: {
    bpm: 118, echo: 0.2,
    bars: [['Em', 40, [52, 55, 59]], ['F', 41, [53, 57, 60]], ['Em', 40, [52, 55, 59]], ['D', 38, [50, 54, 57]]],
    bass: { pat: 'rrrrrrrorrrrrrro', wave: 'sawtooth', cutoff: 500, vol: 0.12, len: 0.8 },
    pad: { wave: 'sawtooth', cutoff: 900, vol: 0.025, attack: 0.05 },
    arp: { pat: '0.0.1.0.2.0.1.0.', wave: 'square', cutoff: 3500, vol: 0.035, len: 0.4, oct: 12 },
    drums: { kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', vol: 0.8 },
  },
};
