// PROTOTYPE (throwaway, Corkscrew piece ticket #52): three Corkscrew variants on a scratch Track, picked with
// ?corkscrew=A|B|C. Only exists when that param is set; never merged to main.
// Layout: a rectangle, start line → 100 m → Corkscrew → run-out → four R50 banked right turns back to the line.
import { Vector3 } from 'three';
import { buildTrack, corkscrew, straight, turn } from '../turtle';
import type { Track } from '../bake';
import type { BikeState } from '../../bike/physics';
import { CEILING_UP_Y, TUNING } from '../../bike/tuning';
import type { TrackDef } from '.';

const VARIANTS = {
  A: { name: 'Quick flick: 100 m, right', piece: corkscrew(100, { dir: 1 }) },
  B: { name: 'Slow barrel: 260 m, left', piece: corkscrew(260, { dir: -1 }) },
  C: { name: 'Inverted hang: 60 m roll, 100 m upside down, 60 m roll', piece: corkscrew(220, { dir: 1, hold: 100 }) },
} as const;
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];

const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('corkscrew');
const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

function build(k: Key): TrackDef {
  const { cps, checkpointCps } = buildTrack([
    straight(100),
    straight(100, { checkpoint: true }),   // 100 m before the Corkscrew
    VARIANTS[k].piece,
    straight(0, { free: 1 }),               // run-out
    turn(90, 50, 25), straight(0, { free: 2 }),
    turn(90, 50, 25), straight(700),
    turn(90, 50, 25), straight(200),
    turn(90, 50, 25),
  ]);
  return {
    id: `prototype-corkscrew-${k}`, name: `Corkscrew ${k}`, kind: VARIANTS[k].name,
    cps, gapSegments: [], checkpointCps, halfWidth: 4,
    palette: { primary: 0x00e5ff, secondary: 0xff2bd6, sky: 0x020212 },
    song: { // Overdrive's Song, so audio isn't the variable
      bpm: 100, echo: 0.35,
      bars: [['Am', 45, [57, 60, 64]], ['F', 41, [57, 60, 65]], ['C', 48, [55, 60, 64]], ['G', 43, [55, 59, 62]]],
      bass: { pat: 'r.o.r.o.r.o.r.o.', wave: 'sawtooth', cutoff: 700, vol: 0.14, len: 1.8 },
      pad: { wave: 'sawtooth', cutoff: 1400, vol: 0.035, attack: 0.5 },
      arp: { pat: '0120120120120120', wave: 'square', cutoff: 2500, vol: 0.03, len: 0.8, oct: 12 },
      drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: '.x.x.x.x.x.x.x.x', vol: 1 },
    },
  };
}

export const prototypeCorkscrew: TrackDef | null = key && build(key);
export const buildCorkscrewVariant = build; // for the headless check

// Floating switcher: ‹ › (or [ ]) cycles the variant and reloads; live readout of roll and speed under the Bike.
let readout: HTMLElement | null = null;
if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('corkscrew', KEYS[(KEYS.indexOf(key) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span'); label.textContent = `PROTOTYPE ${key} (${VARIANTS[key].name})`;
  readout = document.createElement('span'); readout.style.cssText = 'font-variant-numeric:tabular-nums;opacity:.7;min-width:230px';
  bar.append(btn('‹', -1), label, btn('›', 1), readout);
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}

export function corkscrewTick(st: BikeState, T: Track) {
  if (!readout) return;
  const i = Math.floor(st.s / T.ds) % T.N, up = T.up[i], side = new Vector3(T.tan[i].z, 0, -T.tan[i].x).normalize();
  const roll = Math.round((Math.atan2(up.dot(side), up.y) * 180) / Math.PI);
  const inv = up.y < CEILING_UP_Y;
  readout.textContent = `${st.mode} · roll ${roll}° · ${st.speed.toFixed(0)} m/s${inv ? (st.speed < TUNING.stickSpeed ? ' · FALLING' : ' · inverted') : ''}`;
}
