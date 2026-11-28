// Track identity: Songs and palettes (docs/game-spec.md → Songs, Palettes).
import { describe, expect, it } from 'vitest';
import { MENU_SONG, stepEvents, type Song } from '../src/audio/songs';
import { derive } from '../src/render/palette';
import { TRACKS } from '../src/track/tracks';
import { overdrive } from '../src/track/tracks/allround';

const SONGS: [string, Song][] = [['Menu', MENU_SONG], ...TRACKS.map(t => [t.name, t.song] as [string, Song])];

describe('Songs', () => {
  it("Overdrive's Song plays exactly the notes the POC's hard-coded backing track did", () => {
    // The POC's playStep, as it was: Am F C G, octave bass on even steps, pad on the bar, arp every step, 4/4 drums.
    const BARS: [number, number[]][] = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
    for (let n = 0; n < 128; n++) {
      const [root, chord] = BARS[(n >> 4) % 4], s = n % 16, old: unknown[] = [];
      if (s % 2 === 0) old.push({ voice: 'bass', midi: root + (s % 4 ? 12 : 0) });
      if (s === 0) chord.forEach(midi => old.push({ voice: 'pad', midi }));
      old.push({ voice: 'arp', midi: chord[s % 3] + 12 });
      if (s % 8 === 0) old.push({ voice: 'kick' });
      if (s % 8 === 4) old.push({ voice: 'snare' });
      if (s % 2 === 1) old.push({ voice: 'hat' });
      expect(stepEvents(overdrive.song, n), `step ${n}`).toEqual(old);
    }
  });

  it.each(SONGS)('%s: every pattern is 16 valid steps and every note exists', (_, song) => {
    const valid = { bass: /^[rof.]{16}$/, arp: /^[0-3h.]{16}$/, drum: /^[x.]{16}$/ };
    expect(song.bass.pat).toMatch(valid.bass);
    expect(song.arp.pat).toMatch(valid.arp);
    for (const d of [song.drums.kick, song.drums.snare, song.drums.hat]) expect(d).toMatch(valid.drum);
    for (let n = 0; n < 16 * song.bars.length; n++)
      for (const note of stepEvents(song, n)) if ('midi' in note) expect(Number.isFinite(note.midi), `step ${n} ${note.voice}`).toBe(true);
  });
});

describe('Palettes', () => {
  // Relative luminance of an sRGB hex, the way the bloom pass sees it (linear light).
  const lum = (hex: number) => {
    const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
  };
  const BLOOM_THRESHOLD = 0.15; // render/scene.ts → UnrealBloomPass

  it("derives Overdrive's darks in sRGB", () => {
    expect(derive(overdrive.palette)).toEqual({
      edge: 0xff2bd6, accent: 0xffe600, sky: 0x000000,
      fill: 0x0f030d, rungs: 0x4d0d40, tunnel: 0x991a80, gridMajor: 0x38092f, gridMinor: 0x1a0415,
      sunTop: 0x998a00, sunBottom: 0x991a80, mountain: 0x590f4b, mountainFill: 0x080106, star: 0x666666,
    });
  });

  it.each(TRACKS)('$name: only the neon glows (sky, fill, rungs, grid and the horizon mountains and stars sit below the bloom threshold)', t => {
    const c = derive(t.palette);
    for (const k of ['sky', 'fill', 'rungs', 'gridMajor', 'gridMinor'] as const) expect(lum(c[k]), k).toBeLessThan(BLOOM_THRESHOLD / 2);
    // the horizon: small and far off, so it only has to stay under the threshold, not the Track's half-margin
    for (const k of ['mountain', 'mountainFill', 'star'] as const) expect(lum(c[k]), k).toBeLessThan(BLOOM_THRESHOLD);
    for (const k of ['edge', 'accent'] as const) expect(lum(c[k]), k).toBeGreaterThan(BLOOM_THRESHOLD);
  });
});
