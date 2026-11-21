// Locked handling values (docs/poc-spec.md → Handling values). Airborne and Boost values arrive with M2/M3.
export const TUNING = {
  topSpeed: 55, accel: 25, brake: 45, drag: 0.04, overspeedDecay: 12, slopeGravity: 20,
  steerRate: 12, steerResponse: 10, stickSpeed: 18,
};
export type Tuning = typeof TUNING;

export const CEILING_UP_Y = -0.3; // "upside down" = Track up points this far below horizontal
