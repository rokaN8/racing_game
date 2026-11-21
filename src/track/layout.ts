// The test Track (docs/poc-spec.md → Test Track layout, ticket #7). Fitted to the locked physics.
// Control points [x, y, z, bankDeg]. Closed centripetal Catmull-Rom. y is up; + bank tilts up toward the right.
// Lap: Loop → right turn → Gap A → left turn → Wall-ride → Gap B → right turn onto the home straight.
export type ControlPoint = [x: number, y: number, z: number, bankDeg: number];

const rad = (d: number) => (d * Math.PI) / 180;

// Radius-20 Loop based at z0, drifting 12 m sideways (+x) so entry and exit don't overlap.
const loop = (z0: number): ControlPoint[] => Array.from({ length: 7 }, (_, k) => {
  const th = rad(-45 + 45 * k); // -45°..225°
  return [1.5 * (k + 1), 20 + 20 * Math.sin(th), z0 + 20 * Math.cos(th), 0];
});

// Gaps have no geometry, but their control points still set the lip angle: the spline leaves a lip
// along the chord from the point before it to the point after it, so 23 and 41 sit on that 18°/8° line.

// Interior points of a flat turn: centre (cx, cz), radius r, angle a0 → a1 (deg; 0 = +x, 90 = +z).
const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n: number, bank: number): ControlPoint[] =>
  Array.from({ length: n }, (_, k) => {
    const a = rad(a0 + ((a1 - a0) * (k + 1)) / (n + 1));
    return [cx + r * Math.cos(a), 0, cz + r * Math.sin(a), bank];
  });

export const CPS: ControlPoint[] = [
  [0, 0, 0, 0], [0, 0, 60, 0], [0, 0, 100, 0],          // 0-2 home straight; 0 = start line (CP 1), 1 = CP 2
  [0, 0, 130, 0], ...loop(130), [12, 0, 130, 0],        // 3-11 Loop
  [12, 0, 170, 0],                                      // 12
  ...arc(-28, 170, 40, 0, 180, 4, 30),                  // 13-16 banked right turn
  [-68, 0, 170, 0], [-68, 0, 140, 0],                   // 17-18; 17 = CP 3
  [-68, 1.2, 110, 0], [-68, 4.7, 80, 0], [-68, 10.5, 51, 0], [-68, 18.8, 21, 0], // 19-22 ramp up to 18°, 22 = Gap A lip
  [-68, 33.3, -19, 0], [-68, 30.8, -59, 0], [-68, 26.2, -99, 0], // 23-25 Gap A: roughly the 55 m/s flight; 25 = landing start
  [-68, 15.5, -134, 0], [-68, 9.1, -151, 0], [-68, 2.8, -169, 0], [-68, 0, -195, 0], // 26-29 -20° landing, flattening
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

export const GAP_SEGMENTS = [22, 23, 24, 40, 41]; // segments (cp i → i+1) with no geometry: Gap A, Gap B
export const CHECKPOINT_CPS = [0, 1, 17, 37];
export const HALF_WIDTH = 4;
