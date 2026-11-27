// PROTOTYPE (throwaway, Track 4 and 5 palettes and Songs ticket #54): three candidate looks, picked with
// ?look=A|B|C. Each puts a Track 4 palette + Song on Overdrive's geometry and a Track 5 one on Hang Time's, listed
// first in Track select next to the real three. Never merged to main.
import type { Song } from '../../audio/songs';
import type { Palette } from '../../render/palette';
import type { TrackDef } from '.';

interface Look { name: string; palette: Palette; song: Song }
const V: Record<'A' | 'B' | 'C', { t4: Look; t5: Look }> = {
  A: {
    t4: { name: 'Electric blue / hot pink · Outrun cruise, F#m 108', palette: { primary: 0x2979ff, secondary: 0xff3ea5, sky: 0x00040f },
      song: { bpm: 108, echo: 0.3,
        bars: [['F#m', 42, [54, 57, 61]], ['D', 38, [54, 57, 62]], ['A', 45, [52, 57, 61]], ['E', 40, [52, 56, 59]]],
        bass: { pat: 'r.r.r.r.r.r.r.o.', wave: 'sawtooth', cutoff: 800, vol: 0.14, len: 1.5 },
        pad: { wave: 'sawtooth', cutoff: 1600, vol: 0.035, attack: 0.4 },
        arp: { pat: '0121012101210121', wave: 'sawtooth', cutoff: 2800, vol: 0.028, len: 0.8, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.xx..xx..xx..xx.', vol: 0.9 } } },
    t5: { name: 'Gold / indigo · Euphoric trance, Bb 136', palette: { primary: 0xffc400, secondary: 0x536dfe, sky: 0x0a0600 },
      song: { bpm: 136, echo: 0.45,
        bars: [['Bb', 46, [58, 62, 65]], ['F', 41, [57, 60, 65]], ['Gm', 43, [55, 58, 62]], ['Eb', 39, [55, 58, 63]]],
        bass: { pat: '.rrr.rrr.rrr.rrr', wave: 'sawtooth', cutoff: 900, vol: 0.13, len: 0.8 },
        pad: { wave: 'sawtooth', cutoff: 2800, vol: 0.04, attack: 0.3 },
        arp: { pat: '0120120120120120', wave: 'square', cutoff: 5000, vol: 0.028, len: 0.6, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', vol: 1 } } },
  },
  B: {
    t4: { name: 'Ultraviolet / mint · Dreamwave, Cmaj7 96', palette: { primary: 0xc400ff, secondary: 0x00ffa3, sky: 0x07000f },
      song: { bpm: 96, echo: 0.5,
        bars: [['Cmaj7', 36, [55, 59, 60, 64]], ['Am7', 45, [55, 57, 60, 64]], ['Fmaj7', 41, [53, 57, 60, 64]], ['G', 43, [55, 59, 62, 67]]],
        bass: { pat: 'r.......r...o...', wave: 'sawtooth', cutoff: 600, vol: 0.16, len: 3 },
        pad: { wave: 'sawtooth', cutoff: 1800, vol: 0.05, attack: 0.8 },
        arp: { pat: '0.1.2.3.2.1.0.1.', wave: 'triangle', cutoff: 3500, vol: 0.045, len: 1.5, oct: 12 },
        drums: { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', vol: 0.7 } } },
    t5: { name: 'Lime / rose · Anthemic half-time, Ab 140', palette: { primary: 0xc6ff00, secondary: 0xff3d7f, sky: 0x050a00 },
      song: { bpm: 140, echo: 0.5,
        bars: [['Ab', 44, [56, 60, 63]], ['Eb', 39, [55, 58, 63]], ['Fm', 41, [56, 60, 65]], ['Db', 37, [56, 61, 65]]],
        bass: { pat: 'r.......r.r.....', wave: 'sawtooth', cutoff: 1000, vol: 0.15, len: 4 },
        pad: { wave: 'sawtooth', cutoff: 3000, vol: 0.05, attack: 0.2 },
        arp: { pat: 'h.2.1.0.h.2.1.0.', wave: 'square', cutoff: 4500, vol: 0.03, len: 1, oct: 12 },
        drums: { kick: 'x.........x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.', vol: 1 } } },
  },
  C: {
    t4: { name: 'Mint / ultraviolet · Disco funk, Gm7 116', palette: { primary: 0x00ffa3, secondary: 0xc400ff, sky: 0x000a06 },
      song: { bpm: 116, echo: 0.15,
        bars: [['Gm7', 43, [53, 55, 58, 62]], ['C7', 36, [52, 55, 58, 60]], ['Fmaj7', 41, [53, 57, 60, 64]], ['Dm7', 38, [53, 57, 60, 62]]],
        bass: { pat: 'r..o.rf.r..o.ro.', wave: 'square', cutoff: 900, vol: 0.12, len: 0.9 },
        pad: { wave: 'sawtooth', cutoff: 1500, vol: 0.03, attack: 0.05 },
        arp: { pat: '0.20.31.0.20.31.', wave: 'square', cutoff: 3000, vol: 0.03, len: 0.5, oct: 12 },
        drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x', vol: 1 } } },
    t5: { name: 'Rose / gold · Bouncy electro, Cm 124', palette: { primary: 0xff3d7f, secondary: 0xffd000, sky: 0x12020a },
      song: { bpm: 124, echo: 0.25,
        bars: [['Cm', 36, [55, 60, 63]], ['Ab', 44, [56, 60, 63]], ['Eb', 39, [55, 58, 63]], ['Bb', 46, [58, 62, 65]]],
        bass: { pat: 'r..r..r...r..r..', wave: 'square', cutoff: 1200, vol: 0.12, len: 0.5 },
        pad: { wave: 'sawtooth', cutoff: 2000, vol: 0.035, attack: 0.1 },
        arp: { pat: '0..1..2..h..2..1', wave: 'sawtooth', cutoff: 3500, vol: 0.03, len: 0.7, oct: 12 },
        drums: { kick: 'x..x..x...x.....', snare: '....x.......x...', hat: 'xxx.xxx.xxx.xxx.', vol: 0.9 } } },
  },
};
type Key = keyof typeof V;
const KEYS = Object.keys(V) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('look');
const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

// The candidate Tracks, given the real Overdrive and Hang Time to borrow geometry from.
export function lookTracks(overdrive: TrackDef, hangTime: TrackDef): TrackDef[] {
  if (!key) return [];
  const { t4, t5 } = V[key];
  return [
    { ...overdrive, id: `prototype-look-4${key}`, name: `Track 4 ${key}`, kind: t4.name, palette: t4.palette, song: t4.song },
    { ...hangTime, id: `prototype-look-5${key}`, name: `Track 5 ${key}`, kind: t5.name, palette: t5.palette, song: t5.song },
  ];
}

if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008;max-width:96vw';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('look', KEYS[(KEYS.indexOf(key) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span');
  label.textContent = `PROTOTYPE look ${key} · T4: ${V[key].t4.name} · T5: ${V[key].t5.name}`;
  bar.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}
