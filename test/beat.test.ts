// The beat the Track edges pulse on (docs/game-spec.md → Songs): time since the kick that is sounding now.
import { describe, expect, it } from 'vitest';
import { MENU_SONG, sinceKick, type Song } from '../src/audio/songs';

// 150 BPM: one 16th note = 0.1 s. Kick on every beat (steps 0, 4, 8, 12).
const song = (kick: string): Song => ({ ...MENU_SONG, bpm: 150, drums: { ...MENU_SONG.drums, kick } });
const four = song('x...x...x...x...');

describe('sinceKick', () => {
  // 8 steps scheduled, the next due at 1.0 s: steps 0..7 play at 0.2, 0.3 … 0.9 s.
  it('counts from the last kick that has sounded, not the last one scheduled', () => {
    expect(sinceKick(four, 8, 1.0, 0.55)).toBeCloseTo(0.35); // step 3 sounding; kick at step 0 (0.2 s)
    expect(sinceKick(four, 8, 1.0, 0.65)).toBeCloseTo(0.05); // step 4's kick (0.6 s); step 7 is scheduled but not heard
  });

  it('is null before the Song has sounded a step', () => {
    expect(sinceKick(four, 8, 1.0, 0.1)).toBeNull();
    expect(sinceKick(four, 0, 1.0, 0.99)).toBeNull();
  });

  it('is null for a Song with no kick', () => {
    expect(sinceKick(song('................'), 8, 1.0, 0.55)).toBeNull();
  });

  it('finds a kick in the bar before, across the pattern loop', () => {
    // one kick a bar; 20 steps scheduled, next at 2.0 s: step 16 (bar 2's kick) at 1.6 s, step 17 sounding at 1.75 s
    expect(sinceKick(song('x...............'), 20, 2.0, 1.75)).toBeCloseTo(0.15);
    // step 15 sounding (1.5 s): the last kick is bar 1's, step 0 at 0.0 s
    expect(sinceKick(song('x...............'), 20, 2.0, 1.55)).toBeCloseTo(1.55);
  });
});
