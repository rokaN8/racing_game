// Locked handling values (docs/poc-spec.md → Handling values). Boost values arrive with M3.
export const TUNING = {
  topSpeed: 55, accel: 25, brake: 45, drag: 0.04, overspeedDecay: 12, slopeGravity: 20,
  steerRate: 12, steerResponse: 10, stickSpeed: 18,
  airGravity: 12, airControlRate: 2.5, landingTolerance: 35, maxAirTime: 6,
  respawnSpeed: 20, penalty: 3,
};
export type Tuning = typeof TUNING;

export const CEILING_UP_Y = -0.3; // "upside down" = Track up points this far below horizontal
