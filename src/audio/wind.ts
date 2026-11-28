// Wind and the Ghost whoosh (docs/game-spec.md → Wind and Ghost whoosh): the pure rules. audio.ts plays them.

export const RUMBLE_START = 2, RUMBLE_EVERY = 4, RUMBLE_DUTY = 0.35; // rumble strip: from 2 m out, a pulse per 4 m
export const PASS_RANGE = 12;                                        // a Ghost pass only counts this close

// 0 at RUMBLE_START metres or more from the Track edge, 1 at the edge. null (Airborne) is 0.
export const edgeNear = (edge: number | null) => (edge === null ? 0 : Math.min(1, Math.max(0, 1 - edge / RUMBLE_START)));

// Whether the rumble strip is in a pulse, `ridden` metres into the run.
export const rumbleOn = (ridden: number) => (((ridden / RUMBLE_EVERY) % 1) + 1) % 1 < RUMBLE_DUTY;

// The wind's slow gusting, 0.4…1, from the audio clock: two slow sines multiplied, so it never repeats evenly.
export const gust = (t: number) => 0.7 + 0.3 * Math.sin(t * 1.3) * Math.sin(t * 0.37);

// A pass: the Ghost crossing the camera's side-to-side line within PASS_RANGE. ahead: metres ahead of the camera (+)
// or behind (−), last frame and now. 'passed': you went past it; 'passedBy': it went past you.
export function ghostPass(lastAhead: number | null, ahead: number, dist: number): 'passed' | 'passedBy' | null {
  if (lastAhead === null || dist >= PASS_RANGE || ahead === 0 || Math.sign(ahead) === Math.sign(lastAhead)) return null;
  return ahead < 0 ? 'passed' : 'passedBy';
}
