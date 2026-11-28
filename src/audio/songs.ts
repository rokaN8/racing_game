// Songs as data (docs/game-spec.md → Songs) and the pure step generator that turns one into notes.
// Each Track's Song lives on its TrackDef; the Menu's is here. No Web Audio in this file.

// Patterns are 16 characters, one per 16th note; '.' is a rest.
//   bass:  r = root, o = root an octave up, f = the fifth
//   arp:   0-3 = that chord tone, h = the lowest chord tone an octave up
//   drums: x = hit
export interface Song {
  bpm: number;
  echo: number; // feedback of the dotted-8th delay on the arp
  bars: [chord: string, bassRoot: number, tones: number[]][]; // MIDI notes; one bar of 16 steps each, looped
  bass: { pat: string; wave: OscillatorType; cutoff: number; vol: number; len: number }; // len in steps
  pad: { wave: OscillatorType; cutoff: number; vol: number; attack: number };          // the chord, once per bar
  arp: { pat: string; wave: OscillatorType; cutoff: number; vol: number; len: number; oct: number };
  drums: { kick: string; snare: string; hat: string; vol: number };
}

export type Note =
  | { voice: 'bass' | 'pad' | 'arp'; midi: number }
  | { voice: 'kick' | 'snare' | 'hat' };

// The notes a Song plays at step n (counted from the Song's start). Pure: same input, same notes.
export function stepEvents(song: Song, n: number): Note[] {
  const [, root, chord] = song.bars[Math.floor(n / 16) % song.bars.length], s = n % 16, notes: Note[] = [];
  const b = song.bass.pat[s];
  if (b !== '.') notes.push({ voice: 'bass', midi: root + ({ r: 0, o: 12, f: 7 } as Record<string, number>)[b] });
  if (s === 0) for (const midi of chord) notes.push({ voice: 'pad', midi });
  const a = song.arp.pat[s];
  if (a !== '.') notes.push({ voice: 'arp', midi: (a === 'h' ? chord[0] + 12 : chord[+a]) + song.arp.oct });
  for (const voice of ['kick', 'snare', 'hat'] as const) if (song.drums[voice][s] === 'x') notes.push({ voice });
  return notes;
}

// Seconds since the last kick heard at `now`, for a player that has scheduled steps 0..n-1 with step n due at nextT
// (docs/game-spec.md → Songs). Notes are scheduled ahead, so this counts from the step that is sounding, not the
// last one scheduled. Null before the first step sounds, or with no kick in the bar before. Pure.
export function sinceKick(song: Song, n: number, nextT: number, now: number): number | null {
  const step = 60 / song.bpm / 4, at = (k: number) => nextT - (n - k) * step;
  const sounding = Math.min(n - 1, Math.floor(n - (nextT - now) / step));
  for (let k = sounding; k >= 0 && k > sounding - 16; k--) if (song.drums.kick[k % 16] === 'x') return now - at(k);
  return null;
}

// Slow and dreamy: soft pads, a lazy echoing arp, almost no drums.
export const MENU_SONG: Song = {
  bpm: 84, echo: 0.5,
  bars: [['Fmaj7', 41, [53, 57, 60, 64]], ['Em7', 40, [52, 55, 59, 62]], ['Dm7', 38, [50, 53, 57, 60]], ['Cmaj7', 36, [48, 52, 55, 59]]],
  bass: { pat: 'r.......o.......', wave: 'sine', cutoff: 600, vol: 0.2, len: 6 },
  pad: { wave: 'triangle', cutoff: 1800, vol: 0.06, attack: 1.2 },
  arp: { pat: '0..2..1..3..2..1', wave: 'triangle', cutoff: 3000, vol: 0.05, len: 2, oct: 12 },
  drums: { kick: 'x...............', snare: '................', hat: '....x.......x...', vol: 0.6 },
};
