// PROTOTYPE (throwaway, Helix piece ticket #75): three Helix variants on a scratch Track, picked with ?helix=A|B|C.
// Only exists when that param is set; never merged to main. Each Helix is a plain `turn` past 360° with a `rise`,
// split in two halves so a Checkpoint sits halfway up it (a 20 m/s respawn inside the Helix).
// Layout: start line → lead-in → Helix (540° or 900° right, so it leaves heading back) → free straight down to the
// ground → two R25 return turns banked 50° (they hold at Boost top speed) → the line. Total turn 720°.
import { buildTrack, straight, turn, type Piece } from '../turtle';
import type { Track } from '../bake';
import { cornerPull, type BikeState } from '../../bike/physics';
import { TUNING } from '../../bike/tuning';
import type { TrackDef } from '.';

const helix = (deg: number, radius: number, bank: number, rise: number): Piece[] => [
  turn(deg / 2, radius, bank, { rise: rise / 2 }), turn(deg / 2, radius, bank, { rise: rise / 2, checkpoint: true }),
];

export const VARIANTS = {
  A: { name: 'Spiral climb: 540° R40, +30 m, bank 25', lift: 0, pieces: helix(540, 40, 25, 30) },
  B: { name: 'Tight tower: 900° R30, +60 m, bank 35', lift: 0, pieces: helix(900, 30, 35, 60) },
  C: { name: 'Spiral drop: 540° R60, −40 m, bank 20', lift: 40, pieces: helix(540, 60, 20, -40) },
} as const;
export type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];

const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('helix');
const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

export function buildHelixVariant(k: Key): TrackDef {
  const v = VARIANTS[k];
  const { cps, checkpointCps } = buildTrack([
    straight(100),
    v.lift ? straight(250, { rise: v.lift, checkpoint: true }) : straight(150, { checkpoint: true }), // C: lift hill up to the top
    straight(80, { checkpoint: true }),     // 80 m before the Helix
    ...v.pieces,
    straight(0, { free: 1, ground: true }), // back down to the ground
    turn(90, 25, 50), straight(0, { free: 2 }), turn(90, 25, 50),
  ]);
  return {
    id: `prototype-helix-${k}`, name: `Helix ${k}`, kind: v.name,
    cps, gapSegments: [], checkpointCps, halfWidth: 4,
    pilot: {}, pilotTimes: { 1: 0, 3: 0, 5: 0 },
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

export const prototypeHelix: TrackDef | null = key && buildHelixVariant(key);

// Floating switcher: ‹ › (or [ ]) cycles the variant and reloads; live readout under it.
let readout: HTMLElement | null = null;
if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('helix', KEYS[(KEYS.indexOf(key) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span'); label.textContent = `PROTOTYPE ${key} (${VARIANTS[key].name})`;
  readout = document.createElement('span'); readout.style.cssText = 'font-variant-numeric:tabular-nums;opacity:.7;min-width:330px';
  bar.append(btn('‹', -1), label, btn('›', 1), readout);
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}

// Height, grade, speed and the Cornering pull as a share of what full steer can hold (120 m/s²).
const HOLD = TUNING.steerRate * TUNING.steerResponse;
export function helixTick(st: BikeState, T: Track) {
  if (!readout) return;
  if (st.mode !== 'track') { readout.textContent = `air · ${st.vel.length().toFixed(0)} m/s`; return; }
  const i = Math.floor(st.s / T.ds) % T.N, grade = T.tan[i].y * 100;
  const pull = Math.abs(cornerPull(T, st.s, st.speed, TUNING)) / HOLD * 100;
  readout.textContent = `y ${T.pos[i].y.toFixed(0)} m · grade ${grade.toFixed(0)}% · ${st.speed.toFixed(0)} m/s · pull ${pull.toFixed(0)}% of full steer${pull > 100 ? ' · SLIDING OUT' : ''}`;
}
