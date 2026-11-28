// Overdrive, the all-rounder: the POC's test Track (docs/poc-spec.md → Test Track layout, ticket #7). Fitted to the locked physics.
// Lap: Loop → right turn → Rollercoaster (two steep hills) → left turn → Wall-ride → Gap B → right turn onto the home straight.
import type { ControlPoint } from '../bake';
import type { TrackDef } from '.';

const rad = (d: number) => (d * Math.PI) / 180;

// Radius-20 Loop based at z0, drifting 12 m sideways (+x) so entry and exit don't overlap.
const loop = (z0: number): ControlPoint[] => Array.from({ length: 7 }, (_, k) => {
  const th = rad(-45 + 45 * k); // -45°..225°
  return [1.5 * (k + 1), 20 + 20 * Math.sin(th), z0 + 20 * Math.cos(th), 0];
});

// Gaps have no geometry, but their control points still set the lip angle: the spline leaves a lip
// along the chord from the point before it to the point after it, so 41 sits on that 8° line.

// Interior points of a flat turn: centre (cx, cz), radius r, angle a0 → a1 (deg; 0 = +x, 90 = +z).
const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n: number, bank: number): ControlPoint[] =>
  Array.from({ length: n }, (_, k) => {
    const a = rad(a0 + ((a1 - a0) * (k + 1)) / (n + 1));
    return [cx + r * Math.cos(a), 0, cz + r * Math.sin(a), bank];
  });

const CPS: ControlPoint[] = [
  [0, 0, 0, 0], [0, 0, 60, 0], [0, 0, 100, 0],          // 0-2 home straight; 0 = start line (CP 1), 1 = CP 2
  [0, 0, 130, 0], ...loop(130), [12, 0, 130, 0],        // 3-11 Loop
  [12, 0, 170, 0],                                      // 12
  ...arc(-28, 170, 40, 0, 180, 4, 30),                  // 13-16 banked right turn
  [-68, 0, 170, 0], [-68, 0, 140, 0],                   // 17-18; 17 = CP 3
  [-68, 0, 100, 0], [-68, 12, 84, 0], [-68, 24, 66, 0], [-68, 24, 50, 0], [-68, 1, 22, 0], // 19-23 Rollercoaster hill 1: ~35° up and down, rounded crest
  [-68, 1, 0, 0],                                       // 24 valley
  [-68, 16, -25, 0], [-68, 24, -45, 0], [-68, 14, -65, 0], [-68, 0.5, -165, 0], // 25-28 hill 2, run-out into the turn
  [-68, 0, -195, 0],                                    // 29
  ...arc(-108, -195, 40, 0, -90, 3, -30),               // 30-32 banked left turn
  [-108, 0, -235, 0], [-130, 0, -235, 0],               // 33-34
  [-170, 0, -235, 90], [-250, 0, -235, 90],             // 35-36 Wall-ride: 0→90° over 40 m, hold 80 m
  [-290, 0, -235, 0],                                   // 37 back to 0° over 40 m; CP 4
  [-330, 0, -235, 0], [-342.5, 0.44, -235, 0], [-355, 1.74, -235, 0], // 38-40 ramp up to 8°, 40 = Gap B lip
  [-379, 5.6, -235, 0], [-403, 3.8, -235, 0],           // 41-42 Gap B: 41 on the 8° lip line, 42 = landing start on the 55 m/s flight
  [-437, 1.74, -235, 0], [-470, 1.74, -235, 0], [-500, 1.74, -235, 0], [-520, 0.5, -235, 0], // 43-46 landing
  ...arc(-530, -275, 40, 90, 270, 4, 30),               // 47-50 banked right turn
  [-530, 0, -315, 0], [-40, 0, -315, 0],                // 51-52 return straight
  ...arc(-40, -275, 40, -90, 0, 3, 30),                 // 53-55 banked right turn onto the home straight
  [0, 0, -275, 0], [0, 0, -180, 0], [0, 0, -90, 0],     // 56-58
];

export const overdrive: TrackDef = {
  id: 'allround', name: 'Overdrive', kind: 'All-rounder',
  cps: CPS,
  gapSegments: [40, 41], // segments (cp i → i+1) with no geometry: Gap B
  checkpointCps: [0, 1, 17, 37],
  halfWidth: 4,
  pilot: { airControl: true, boost: true }, pilotTimes: { 1: 40.45, 3: 120.12, 5: 199.82 },
  // Data shards (docs/game-spec.md → Data shards): 6 on the line, 3 off it, 1 hard. Never reorder: found
  // shards are stored by index.
  shards: [
    { s: 47.0, d: 1.5, h: 1.0 },
    { s: 193.0, d: 2.5, h: 1.0 }, // off the line: top of a Loop, near its edge
    { s: 246.0, d: 0.0, h: 1.0 },
    { s: 651.1, d: 1.5, h: 1.0 },
    { s: 977.1, d: -3.0, h: 1.0 }, // off the line: high edge of the Wall-ride
    { s: 1055.1, d: -1.5, h: 1.0 },
    { s: 1192.2, d: 0.0, h: 4.7 }, // hard: the top of the Pilot's flight over the Gap
    { s: 1243.2, d: 3.0, h: 1.0 }, // off the line: hugging the edge
    { s: 1459.2, d: 0.0, h: 1.0 },
    { s: 1864.2, d: -1.5, h: 1.0 },
  ],
  palette: { primary: 0xff2bd6, secondary: 0xffe600, sky: 0x000000 }, // magenta / yellow
  // Mid-tempo synthwave in A minor, i–VI–III–VII: octave bass, rolling arp.
  song: {
    bpm: 100, echo: 0.35,
    bars: [['Am', 45, [57, 60, 64]], ['F', 41, [57, 60, 65]], ['C', 48, [55, 60, 64]], ['G', 43, [55, 59, 62]]],
    bass: { pat: 'r.o.r.o.r.o.r.o.', wave: 'sawtooth', cutoff: 700, vol: 0.14, len: 1.8 },
    pad: { wave: 'sawtooth', cutoff: 1400, vol: 0.035, attack: 0.5 },
    arp: { pat: '0120120120120120', wave: 'square', cutoff: 2500, vol: 0.03, len: 0.8, oct: 12 },
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x', vol: 1 },
  },
};
