// The prototype Track (`CPS` in prototypes/bike-handling.html). M4 replaces it with the real test Track.
// Control points [x, y, z, bankDeg]. Closed centripetal Catmull-Rom. y is up.
export type ControlPoint = [x: number, y: number, z: number, bankDeg: number];

const rad = (d: number) => (d * Math.PI) / 180;

const LOOP: ControlPoint[] = Array.from({ length: 7 }, (_, k) => {
  const th = rad(-45 + 45 * k); // -45°..225° round a radius-20 circle
  return [1.5 * (k + 1), 20 + 20 * Math.sin(th), 120 + 20 * Math.cos(th), 0];
});

export const CPS: ControlPoint[] = [
  [0, 0, -10, 0], [0, 0, 40, 0], [0, 0, 80, 0],      // 0-2 start straight
  [0, 0, 120, 0], ...LOOP, [12, 0, 120, 0],          // 3-11 Loop, drifts 12 m sideways so entry/exit don't overlap
  [12, 0, 170, 0], [12, 2, 200, 0], [12, 7, 222, 0], // 12-14 ramp, 14 = lip
  [12, 8, 242, 0],                                   // 15 in the Gap (solid until M2)
  [12, 4, 262, 0], [12, 1, 285, 0], [12, 0, 310, 0], // 16-18 landing
  [5, 0, 338, 30], [-20, 0, 355, 30], [-50, 0, 355, 30], [-75, 0, 335, 30], [-85, 0, 305, 15], // 19-23 banked right turn
  [-85, 0, 200, 0], [-85, 0, 100, 0], [-85, 0, 20, 15],                                        // 24-26 back straight
  [-75, 0, -30, 30], [-50, 0, -50, 30], [-20, 0, -45, 20],                                     // 27-29 banked right turn
];

export const HALF_WIDTH = 4;
