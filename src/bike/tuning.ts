// Locked handling values (docs/poc-spec.md → Handling values).
export const TUNING = {
  topSpeed: 55, accel: 25, brake: 45, drag: 0.04, overspeedDecay: 12, slopeGravity: 20,
  steerRate: 12, steerResponse: 10, cornerPull: 1, stickSpeed: 18,
  airGravity: 12, airControlRate: 2.5, landingTolerance: 35, maxAirTime: 6,
  boostSpeed: 20, boostKick: 10, boostAccelMul: 2, boostDuration: 1.2, boostCooldown: 3,
  respawnSpeed: 20, penalty: 3,
};
export type Tuning = typeof TUNING;

export const BOOST_PAD_TAIL = 0.3; // s of Boost past a Boost pad's end at the speed it was ridden onto (game-spec → Boost pads)
// Landing grades (game-spec → Landing grades; ticket #80), on top of the locked values: within PERFECT_ANGLE° of the
// deck is Perfect, within CLEAN_ANGLE° Clean, up to landingTolerance Sketchy. A Perfect landing from a Gap flight
// Boosts for PERFECT_BOOST s (the player's own Boost is left alone).
export const PERFECT_ANGLE = 5, CLEAN_ANGLE = 20, PERFECT_BOOST = 0.5;
export type LandingGrade = 'perfect' | 'clean' | 'sketchy';
export const landingGrade = (off: number): LandingGrade => off <= PERFECT_ANGLE ? 'perfect' : off <= CLEAN_ANGLE ? 'clean' : 'sketchy';
export const CEILING_UP_Y = -0.3; // "upside down" = Track up points this far below horizontal
