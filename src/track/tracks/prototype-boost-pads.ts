// PROTOTYPE (throwaway, Boost pads ticket #53): three Boost pad variants on a scratch Track, picked with
// ?boostpad=A|B|C. Only exists when that param is set; never merged to main.
// Layout: a rectangle of R60 banked right turns. Three pads of different lengths: short on the start straight, long
// on the 600 m back straight, medium on the last side.
import { bakeTrack } from '../bake';
import { buildTrack, straight, turn } from '../turtle';
import type { BikeState } from '../../bike/physics';
import { TUNING } from '../../bike/tuning';
import type { TrackDef } from '.';

const VARIANTS = {
  A: 'Timed pad: chevrons; Boost lasts the pad\'s seconds (0.8 / 3 / 1.6 s); button cooldown untouched',
  B: 'Boost strip: glowing strip; Boost lasts until the strip ends (40 / 200 / 90 m); button cooldown untouched',
  C: 'Stacking gate: arch; adds the pad\'s seconds onto a running Boost; button ready again when it ends',
} as const;
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];
const SIZES = [{ secs: 0.8, m: 40 }, { secs: 3, m: 200 }, { secs: 1.6, m: 90 }];

const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('boostpad');
const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

export function buildPadVariant(k: Key): TrackDef {
  const { cps, checkpointCps } = buildTrack([
    straight(60), straight(240, { checkpoint: true }), straight(0, { free: 2 }), // pad 1
    turn(90, 60, 25), straight(0, { free: 1 }),
    turn(90, 60, 25), straight(100), straight(500, { checkpoint: true }),     // pad 2
    turn(90, 60, 25), straight(250, { checkpoint: true }),                     // pad 3
    turn(90, 60, 25),
  ]);
  const base = { cps, gapSegments: [], checkpointCps, halfWidth: 4 };
  const padS = bakeTrack(base).cpS.slice(1); // the "Checkpoints" above only mark where the pads go
  return {
    id: `prototype-boostpad-${k}`, name: `Boost pads ${k}`, kind: VARIANTS[k],
    ...base, checkpointCps: [0],
    boostPads: padS.map((s, i) => ({ s, ...SIZES[i] })), padMode: k,
    palette: { primary: 0x00e5ff, secondary: 0xffe600, sky: 0x020212 },
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

export const prototypeBoostPads: TrackDef | null = key && buildPadVariant(key);

// Floating switcher: ‹ › (or [ ]) cycles the variant and reloads; live readout of Boost state.
let readout: HTMLElement | null = null;
if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008;max-width:96vw';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('boostpad', KEYS[(KEYS.indexOf(key) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span'); label.textContent = `PROTOTYPE ${key}: ${VARIANTS[key]}`;
  readout = document.createElement('span'); readout.style.cssText = 'font-variant-numeric:tabular-nums;opacity:.7;min-width:250px';
  bar.append(btn('‹', -1), label, btn('›', 1), readout);
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}

export function boostPadTick(st: BikeState) {
  if (!readout) return;
  readout.textContent = `${st.speed.toFixed(0)} m/s · Boost ${Math.max(0, st.boostT).toFixed(1)} s · button ${st.boostCD > 0 ? `in ${st.boostCD.toFixed(1)} s` : 'ready'} · pads ${st.padHits} · cap ${TUNING.topSpeed}+${TUNING.boostSpeed}`;
}
