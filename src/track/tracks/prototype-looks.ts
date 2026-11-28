// PROTOTYPE (throwaway, Vertigo and Knot palettes and Songs ticket #76): three candidate looks, picked with
// ?look=A|B|C. Each puts a Vertigo palette + Song on Hang Time's geometry and a Knot one on Switchback's, listed
// first in Track select next to the real five. Never merged to main.
import type { Song } from '../../audio/songs';
import type { Palette } from '../../render/palette';
import type { TrackDef } from '.';

interface Look { name: string; palette: Palette; song: Song }
const V: Record<'A' | 'B' | 'C', { vertigo: Look; knot: Look }> = {
  A: {
    vertigo: { name: 'Electric blue / hot pink · Ascent, Dm 112', palette: { primary: 0x2979ff, secondary: 0xff3ea5, sky: 0x00040f },
      song: { bpm: 112, echo: 0.45,
        bars: [['Dm', 38, [57, 62, 65]], ['Bb', 46, [58, 62, 65]], ['F', 41, [57, 60, 65]], ['C', 36, [55, 60, 64]]],
        bass: { pat: 'r.r.o.r.r.r.o.r.', wave: 'sawtooth', cutoff: 800, vol: 0.14, len: 1.2 },
        pad: { wave: 'sawtooth', cutoff: 2000, vol: 0.04, attack: 0.4 },
        arp: { pat: '0.1.2.h.1.2.h.2.', wave: 'square', cutoff: 3800, vol: 0.03, len: 0.8, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x..x', hat: '..xx..xx..xx..xx', vol: 0.9 } } },
    knot: { name: 'Crimson / lime · Tangle techno, Fm 132', palette: { primary: 0xff1744, secondary: 0xc6ff00, sky: 0x0a0002 },
      song: { bpm: 132, echo: 0.2,
        bars: [['Fm', 41, [56, 60, 65]], ['Db', 37, [56, 61, 65]], ['Eb', 39, [55, 58, 63]], ['C', 36, [55, 60, 64]]],
        bass: { pat: 'rrorrrorrrorrror', wave: 'sawtooth', cutoff: 450, vol: 0.13, len: 0.7 },
        pad: { wave: 'sawtooth', cutoff: 900, vol: 0.025, attack: 0.05 },
        arp: { pat: '0.2.1.0.2..1.0.2', wave: 'square', cutoff: 3000, vol: 0.035, len: 0.4, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', vol: 0.9 } } },
  },
  B: {
    vertigo: { name: 'Periwinkle / lime · Thin air, Ebmaj7 88', palette: { primary: 0x7c6cff, secondary: 0xc6ff00, sky: 0x04020f },
      song: { bpm: 88, echo: 0.6,
        bars: [['Ebmaj7', 39, [55, 58, 62, 63]], ['Cm7', 36, [55, 58, 60, 63]], ['Abmaj7', 44, [56, 60, 63, 67]], ['Bb', 46, [53, 58, 62, 65]]],
        bass: { pat: 'r.........o.....', wave: 'sine', cutoff: 600, vol: 0.2, len: 6 },
        pad: { wave: 'triangle', cutoff: 2000, vol: 0.06, attack: 1.5 },
        arp: { pat: 'h.3.2.1.0.1.2.3.', wave: 'triangle', cutoff: 3500, vol: 0.045, len: 2, oct: 12 },
        drums: { kick: 'x.......x..x....', snare: '........x.......', hat: '..x...x...x...x.', vol: 0.6 } } },
    knot: { name: 'Royal blue / gold · Crossfire breakbeat, Gm 126', palette: { primary: 0x3d5afe, secondary: 0xffc400, sky: 0x00020f },
      song: { bpm: 126, echo: 0.3,
        bars: [['Gm', 43, [55, 58, 62]], ['Eb', 39, [55, 58, 63]], ['Bb', 46, [53, 58, 62]], ['F', 41, [53, 57, 60]]],
        bass: { pat: 'r..r..f.r..r..o.', wave: 'square', cutoff: 1000, vol: 0.12, len: 0.6 },
        pad: { wave: 'sawtooth', cutoff: 1600, vol: 0.03, attack: 0.1 },
        arp: { pat: '0.1h.2.1.0h.2.1.', wave: 'square', cutoff: 4000, vol: 0.03, len: 0.6, oct: 12 },
        drums: { kick: 'x.x.......x.....', snare: '....x..x.x..x...', hat: 'x.x.x.x.x.x.x.x.', vol: 0.9 } } },
  },
  C: {
    vertigo: { name: 'Red / sky blue · Summit anthem, C#m 124', palette: { primary: 0xff2a2a, secondary: 0x4d9fff, sky: 0x0a0000 },
      song: { bpm: 124, echo: 0.35,
        bars: [['C#m', 37, [56, 61, 64]], ['A', 45, [57, 61, 64]], ['E', 40, [56, 59, 64]], ['B', 47, [54, 59, 63]]],
        bass: { pat: 'r..r..r.r..r..o.', wave: 'sawtooth', cutoff: 900, vol: 0.14, len: 1 },
        pad: { wave: 'sawtooth', cutoff: 2600, vol: 0.045, attack: 0.3 },
        arp: { pat: 'h210h210h210h210', wave: 'sawtooth', cutoff: 4000, vol: 0.028, len: 0.6, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.xxx.xxx.xxx.xxx', vol: 0.9 } } },
    knot: { name: 'Lime / hot pink · Acid knot, Cm 130', palette: { primary: 0xc6ff00, secondary: 0xff3ea5, sky: 0x050a00 },
      song: { bpm: 130, echo: 0.25,
        bars: [['Cm', 36, [55, 60, 63]], ['Ab', 44, [56, 60, 63]], ['Bb', 46, [58, 62, 65]], ['G', 43, [55, 59, 62]]],
        bass: { pat: 'r..r..r..r..r.o.', wave: 'sawtooth', cutoff: 700, vol: 0.14, len: 1 },
        pad: { wave: 'sawtooth', cutoff: 1200, vol: 0.03, attack: 0.1 },
        arp: { pat: '0h20h20h20h20h20', wave: 'sawtooth', cutoff: 2200, vol: 0.035, len: 0.5, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', vol: 1 } } },
  },
};
type Key = keyof typeof V;
const KEYS = Object.keys(V) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('look');
const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

// The candidate Tracks, given the real Hang Time and Switchback to borrow geometry from.
export function lookTracks(hangTime: TrackDef, switchback: TrackDef): TrackDef[] {
  if (!key) return [];
  const { vertigo, knot } = V[key];
  return [
    { ...hangTime, id: `prototype-look-vertigo${key}`, name: `Vertigo ${key}`, kind: vertigo.name, palette: vertigo.palette, song: vertigo.song },
    { ...switchback, id: `prototype-look-knot${key}`, name: `Knot ${key}`, kind: knot.name, palette: knot.palette, song: knot.song },
  ];
}

if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008;max-width:96vw';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('look', KEYS[(KEYS.indexOf(key) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span');
  label.textContent = `PROTOTYPE look ${key} · Vertigo: ${V[key].vertigo.name} · Knot: ${V[key].knot.name}`;
  bar.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}
