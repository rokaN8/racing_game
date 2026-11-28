// Trackside scenery and the Rung ripple (docs/game-spec.md → Trackside scenery): placed from the baked Track, never
// in it; the ripple chases ahead of the Bike one block per step.
import { describe, expect, it } from 'vitest';
import { barPhase, MENU_SONG } from '../src/audio/songs';
import { boardAt, clear, placeTowers, rippleGlow } from '../src/render/scenery';
import { bakeTrack } from '../src/track/bake';
import { TRACKS } from '../src/track/tracks';

describe.each(TRACKS)('$name scenery', track => {
  const T = bakeTrack(track), towers = placeTowers(T);

  it('has towers, and every one stands clear of the Track', () => {
    expect(towers.length).toBeGreaterThan(0);
    for (const t of towers) expect(clear(T, t.x, t.z, t.r * Math.SQRT2, t.top + t.mast)).toBe(true);
  });

  it('stands the holo-board clear of the Track', () => expect(boardAt(T).ok).toBe(true));
});

describe('placeTowers', () => {
  it('puts a tower each side of a Loop', () => {
    const T = bakeTrack(TRACKS.find(t => t.id === 'bigair')!); // Hang Time: has Loops
    const inverted = T.up.filter(u => u.y < 0).length;
    expect(inverted).toBeGreaterThan(0);
    expect(placeTowers(T).filter(t => t.r === 1.5).length).toBeGreaterThanOrEqual(2);
  });
});

describe('rippleGlow', () => {
  it('lights the block of the current step brightest, and nothing past it', () => {
    expect(rippleGlow(35, 3 / 16)).toBeGreaterThan(0.8); // step 3 lights 30–40 m
    expect(rippleGlow(45, 3 / 16)).toBe(0);              // step 4's block, not yet
    expect(rippleGlow(5, 3 / 16)).toBeLessThan(rippleGlow(35, 3 / 16) + 1e-9); // older block, fading
    expect(rippleGlow(5, 5 / 16)).toBe(0);               // four steps old: gone
  });

  it('is dark behind the Bike and past 160 m', () => {
    expect(rippleGlow(-1, 0.5)).toBe(0);
    expect(rippleGlow(160, 0.99)).toBe(0);
  });
});

describe('barPhase', () => {
  const song = { ...MENU_SONG, bpm: 150 }; // one 16th = 0.1 s
  it('counts steps heard through the bar, wrapping each 16', () => {
    // 8 steps scheduled, the next due at 1.0 s: steps 0..7 at 0.2 … 0.9 s
    expect(barPhase(song, 8, 1.0, 0.55)).toBeCloseTo(3.5 / 16);
    expect(barPhase(song, 20, 2.0, 1.65)).toBeCloseTo(0.5 / 16); // step 16, the next bar
  });
  it('is null before the first step', () => {
    expect(barPhase(song, 8, 1.0, 0.1)).toBeNull();
    expect(barPhase(song, 0, 1.0, 0.99)).toBeNull();
  });
});
