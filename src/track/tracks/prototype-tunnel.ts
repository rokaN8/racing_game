// PROTOTYPE (throwaway, Tunnel and Double Loop pieces ticket #78): three Tunnel looks on a scratch Track, picked with
// ?tunnel=A|B|C. Only exists when that param is set; never merged to main.
// Layout (a single loop, 360° right): start → Tunnel on a flat straight → right turn → Tunnel on a banked, rising
// straight → right turn → Double Loop back to back (two loop() calls) → right turn → Double Loop with 40 m between
// → right turn → line. Every Lap rides both Tunnels and both Double Loops; the readout shows the speed over each top.
import { Group, LineBasicMaterial, LineSegments, BufferGeometry, Vector3, type Scene } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { boostPad, buildTrack, loop, straight, turn, type Piece } from '../turtle';
import { bakeTrack, sampleAt, type Track } from '../bake';
import type { BikeState } from '../../bike/physics';
import type { TrackDef } from '.';

export const VARIANTS = {
  A: 'Rings: dense dim arcs every 6 m (below bloom), a bright secondary ring every 24 m',
  B: 'Frames: square portals every 20 m, bright secondary, follow the bank',
  C: 'Light tube: 8 bright primary strands along an arch, no rings',
  D: 'Picked: C strands at 60 % (a softer glow), plus A bright secondary ring every 24 m',
} as const;
export type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];

const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('tunnel');
const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

// `tunnel` marks where a Tunnel starts (a Boost pad marker in a throwaway build, so its control point index is known)
const T1 = 200, T2 = 200;
const pieces = (tunnel: (len: number) => Piece[]): Piece[] => [
  straight(60),
  ...tunnel(T1), straight(T1, { checkpoint: true }),                     // Tunnel 1: flat straight
  straight(40),
  turn(90, 60, 25),
  straight(40, { bank: 15 }),
  ...tunnel(T2), straight(T2, { rise: 20, bank: 15, checkpoint: true }),  // Tunnel 2: banked 15°, rising 20 m
  straight(40),
  turn(90, 60, 25, { rise: -20 }),
  straight(60, { checkpoint: true }),                                     // before the back-to-back Double Loop
  loop(22, 12), loop(22, 12),                                             // Double Loop: two loop() calls in a row
  straight(80), straight(0, { free: 2 }),
  turn(90, 60, 25),
  straight(0, { free: 1, checkpoint: true }),                             // before the spaced Double Loop
  loop(22, 12), straight(40), loop(22, 12),                               // Double Loop with 40 m between
  straight(60),
  turn(90, 60, 25),
  straight(60),
];
export const built = buildTrack(pieces(() => []));
const marked = bakeTrack({ ...buildTrack(pieces(len => [boostPad(len)])), gapSegments: [], halfWidth: 4 });
export const TUNNELS = marked.pads.map(p => ({ s: p.s, len: p.len })); // Tunnel start distances and lengths

export function buildTunnelVariant(k: Key): TrackDef {
  return {
    id: `prototype-tunnel-${k}`, name: `Tunnel ${k}`, kind: VARIANTS[k].split(':')[0],
    cps: built.cps, gapSegments: [], checkpointCps: built.checkpointCps, halfWidth: 4,
    pilot: { boostStraights: true }, pilotTimes: { 1: 0, 3: 0, 5: 0 },
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

export const prototypeTunnel: TrackDef | null = key && buildTunnelVariant(key);

// The Tunnel geometry for this variant, added to the prototype Track's scene. Built in the Track's frame at each s,
// so it banks and climbs with the straight.
const mixHex = (a: number, k: number) => [16, 8, 0].reduce((o, sh) => o | (Math.round(((a >> sh) & 255) * k) << sh), 0);
export function addTunnels(scene: Scene, T: Track) {
  if (!key) return;
  const primary = 0x00e5ff, secondary = 0xff2bd6, group = new Group(), mats: LineMaterial[] = [];
  const thick = (pts: Vector3[], color: number, px: number) => {
    const mat = new LineMaterial({ color, linewidth: px }); mat.resolution.set(innerWidth, innerHeight); mats.push(mat);
    group.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pts.flatMap(p => p.toArray())), mat));
  };
  const thin = (pts: Vector3[], color: number) => group.add(new LineSegments(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color })));
  const at = (s: number, x: number, y: number) => { const f = sampleAt(T, s); return f.p.addScaledVector(f.r, x).addScaledVector(f.u, y); };
  // an arch over the deck: radius r centred h m above it, from deck edge round to deck edge
  const arch = (s: number, r: number, h: number, segs = 24) => {
    const a0 = Math.asin(-h / r), pts: Vector3[] = [];
    for (let k = 0; k < segs; k++) {
      const p = (f: number) => { const a = a0 + (Math.PI - 2 * a0) * f; return at(s, r * Math.cos(a), h + r * Math.sin(a)); };
      pts.push(p(k / segs), p((k + 1) / segs));
    }
    return pts;
  };
  for (const t of TUNNELS) {
    if (key === 'A') {
      const dim: Vector3[] = [], bright: Vector3[] = [];
      for (let s = t.s; s <= t.s + t.len; s += 6) ((s - t.s) % 24 === 0 ? bright : dim).push(...arch(s, 6.5, 1.5));
      thin(dim, mixHex(primary, 0.3)); thick(bright, secondary, 3);
    } else if (key === 'B') {
      const pts: Vector3[] = [];
      for (let s = t.s; s <= t.s + t.len; s += 20) {
        const a = at(s, -5.5, 0), b = at(s, -5.5, 7), c = at(s, 5.5, 7), d = at(s, 5.5, 0);
        pts.push(a, b, b, c, c, d);
      }
      thick(pts, secondary, 4);
    } else if (key === 'D') {
      const pts: Vector3[] = [], rings: Vector3[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * (k + 0.5)) / 8, x = 6.5 * Math.cos(a), y = 1.5 + 6.5 * Math.sin(a) * 0.9;
        for (let s = t.s; s < t.s + t.len; s += 4) pts.push(at(s, x, y), at(Math.min(s + 4, t.s + t.len), x, y));
      }
      thick(pts, mixHex(primary, 0.6), 2);
      const n = Math.max(1, Math.round(t.len / 24));
      for (let r = 0; r <= n; r++) rings.push(...arch(t.s + (t.len * r) / n, 6.5, 1.5));
      thick(rings, secondary, 3);
    } else {
      const pts: Vector3[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * (k + 0.5)) / 8, x = 6.5 * Math.cos(a), y = 1.5 + 6.5 * Math.sin(a) * 0.9;
        for (let s = t.s; s < t.s + t.len; s += 4) pts.push(at(s, x, y), at(Math.min(s + 4, t.s + t.len), x, y));
      }
      thick(pts, primary, 2);
      thin([...arch(t.s, 6.5, 1.5), ...arch(t.s + t.len, 6.5, 1.5)], mixHex(primary, 0.3)); // mouth and exit outlines
    }
  }
  addEventListener('resize', () => { for (const m of mats) m.resolution.set(innerWidth, innerHeight); });
  scene.add(group);
}

// Floating switcher: ‹ › (or [ ]) cycles the variant and reloads; live readout under it.
let readout: HTMLElement | null = null;
if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('tunnel', KEYS[(KEYS.indexOf(key) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span'); label.textContent = `PROTOTYPE ${key} (${VARIANTS[key]})`;
  readout = document.createElement('span'); readout.style.cssText = 'font-variant-numeric:tabular-nums;opacity:.7;min-width:260px';
  bar.append(btn('‹', -1), label, btn('›', 1), readout);
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}

// Speed now, and the slowest speed over each Loop top this Lap (stickSpeed is 18).
const tops: number[] = [];
let upside = false;
export function tunnelTick(st: BikeState, T: Track) {
  if (!readout) return;
  if (st.mode !== 'track') { readout.textContent = `air · ${st.vel.length().toFixed(0)} m/s`; return; }
  const u = sampleAt(T, st.s).u.y;
  if (u < 0 && !upside) tops.push(st.speed);
  if (u < 0) tops[tops.length - 1] = Math.min(tops[tops.length - 1], st.speed);
  upside = u < 0;
  if (tops.length > 4) tops.splice(0, tops.length - 4);
  readout.textContent = `${st.speed.toFixed(0)} m/s · Loop tops ${tops.map(v => v.toFixed(0)).join(' / ') || '–'}`;
}
