// Knot, the crossings Track (docs/game-spec.md → Tracks; ticket #79). A pentagram drawn in one stroke: five legs and
// five right-hand 144° tips (720° in all), so it crosses itself five times. Like a real knot it alternates: every leg
// goes over its first crossing (deck 14 m up) and under its second (on the ground, in a Tunnel). No braking: the tips
// hold even Boosted. Built with the turtle.
// Lap (starts on the ground just past an under-pass): start straight → Double Loop → tip → four legs (over-pass,
// descent, Tunnel under-pass, climb into the tip; a Corkscrew on the second leg's over-pass) → the first leg's
// over-pass, descent and Tunnel back to the line.
import { buildTrack, corkscrew, loop, straight, tunnel, turn, type Piece } from '../turtle';
import type { TrackDef } from '.';

const H = 14;                         // over-pass deck height: clears a Tunnel's rings (8 m) with room
const TIP = { deg: 144, R: 60, bank: 30 };
const CLIMB = 80 / (80 + (Math.PI * TIP.deg / 180) * TIP.R); // share of the climb ridden before the tip
const tip = () => turn(TIP.deg, TIP.R, TIP.bank, { rise: H * (1 - CLIMB) });

// From the over-pass to the under-pass of one leg. `over`: the over-pass piece (a flat straight or the Corkscrew).
const overToUnder = (over: Piece): Piece[] => [
  over,                                              // over-pass, 14 m up
  straight(92, { rise: -H }),                        // descent
  tunnel(100), straight(100),                        // under-pass, in a Tunnel
];
// A full leg: out of a tip at H, over, down, under, then climbing into the next tip.
const leg = (first: Piece, over: Piece = straight(100)): Piece[] => [
  first, ...overToUnder(over), straight(80, { rise: H * CLIMB }), tip(),
];

const { cps, checkpointCps, gapSegments, tunnels } = buildTrack([
  straight(60),                                      // start straight
  loop(22, 12), loop(22, 12),                        // Double Loop
  straight(40), turn(TIP.deg, TIP.R, TIP.bank, { rise: H }),
  ...leg(straight(0, { free: 1, checkpoint: true })),
  ...leg(straight(78, { checkpoint: true }), corkscrew(100, { dir: 1 })), // the Corkscrew, over the leg below
  ...leg(straight(0, { free: 2, checkpoint: true })),
  ...leg(straight(78, { checkpoint: true })),
  straight(78), ...overToUnder(straight(100)),       // the first leg's over-pass and Tunnel, back to the line
]);

export const knot: TrackDef = {
  id: 'crossings', name: 'Knot', kind: 'Crossings',
  cps, gapSegments, checkpointCps, tunnels, halfWidth: 4,
  pilot: { boostStraights: true }, pilotTimes: { 1: 53.48, 3: 160.03, 5: 266.6 },
  // Data shards (docs/game-spec.md → Data shards): 6 on the line, 3 off it, 1 hard. Never reorder: found
  // shards are stored by index.
  shards: [
    { s: 69.0, d: 1.5, h: 1.0 },
    { s: 129.0, d: 0.0, h: 1.0 }, // hard: top of the Loop
    { s: 267.0, d: 2.5, h: 1.0 }, // off the line: top of a Loop, near its edge
    { s: 366.0, d: 0.0, h: 1.0 },
    { s: 966.0, d: 1.5, h: 1.0 },
    { s: 1286.0, d: -2.5, h: 1.0 }, // off the line: top of a Loop, near its edge
    { s: 1567.0, d: -1.5, h: 1.0 },
    { s: 1672.0, d: 3.0, h: 1.0 }, // off the line: hugging the edge
    { s: 2168.0, d: 0.0, h: 1.0 },
    { s: 2769.0, d: -1.5, h: 1.0 },
  ],
  palette: { primary: 0xc6ff00, secondary: 0xff3ea5, sky: 0x050a00 }, // lime / hot pink
  // Tangled acid, C minor i–VI–VII–V: a three-note sawtooth arp against the four-on-the-floor.
  song: {
    bpm: 130, echo: 0.25,
    bars: [['Cm', 36, [55, 60, 63]], ['Ab', 44, [56, 60, 63]], ['Bb', 46, [58, 62, 65]], ['G', 43, [55, 59, 62]]],
    bass: { pat: 'r..r..r..r..r.o.', wave: 'sawtooth', cutoff: 700, vol: 0.14, len: 1 },
    pad: { wave: 'sawtooth', cutoff: 1200, vol: 0.03, attack: 0.1 },
    arp: { pat: '0h20h20h20h20h20', wave: 'sawtooth', cutoff: 2200, vol: 0.035, len: 0.5, oct: 12 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', vol: 1 },
  },
};
