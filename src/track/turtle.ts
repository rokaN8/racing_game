// Turtle builder (docs/game-spec.md → Building Tracks 2 and 3): lays a Track out as straights and arcs from a heading,
// so turn radii are exact, instead of hand-placed control points. Two straights are marked free; their lengths are
// solved so the Lap closes on the start line (the end position is linear in them). The Lap must turn a multiple of 360°
// in total (0° is a figure-8). Also Kickers, Gaps onto Landing decks, Loops and Corkscrews (docs/game-spec.md → Design rules).
// Output is the usual control points, Gap segments and Checkpoint indices for bakeTrack.
import type { ControlPoint } from './bake';

// + turn = right (bank +), − turn = left (bank −). rise = height change over the piece, in m. A turn past 360° with a
// rise is a Helix (docs/game-spec.md → Design rules → Helixes).
// checkpoint: a Checkpoint where the piece starts. free: this straight's length is solved (len is ignored).
// ground: this straight's rise brings the Track back to the start line's height.
export type Piece =
  | { kind: 'straight'; len: number; rise?: number; ground?: boolean; bank?: number; checkpoint?: boolean; free?: 1 | 2 }
  | { kind: 'turn'; deg: number; radius: number; bank: number; rise?: number; checkpoint?: boolean }
  | { kind: 'kicker'; len: number; deg: number; checkpoint?: boolean }
  | { kind: 'gap'; drop: number; vMin: number; vMax: number; checkpoint?: boolean; deckCheckpoint?: boolean }
  | { kind: 'loop'; radius: number; drift: number; checkpoint?: boolean }
  | { kind: 'corkscrew'; len: number; dir: 1 | -1; hold: number; checkpoint?: boolean }
  | { kind: 'boostPad'; len: number; checkpoint?: boolean };

export const straight = (len: number, o: Omit<Extract<Piece, { kind: 'straight' }>, 'kind' | 'len'> = {}): Piece => ({ kind: 'straight', len, ...o });
export const turn = (deg: number, radius: number, bank: number, o: { rise?: number; checkpoint?: boolean } = {}): Piece =>
  ({ kind: 'turn', deg, radius, bank, ...o });

// Kicker: ramps the grade from the current one up to `deg` over len (a parabola, so no kink at either end).
export const kicker = (len: number, deg: number, o: { checkpoint?: boolean } = {}): Piece => ({ kind: 'kicker', len, deg, ...o });
// Gap onto a flat Landing deck `drop` m below the lip (negative: a step-up). The Gap ends where a Bike leaving the lip
// at vMin comes down, and the deck runs 20 m past where one at vMax does, so every speed in between lands on flat deck.
export const gap = (drop: number, o: { vMin: number; vMax: number; checkpoint?: boolean; deckCheckpoint?: boolean }): Piece =>
  ({ kind: 'gap', drop, ...o });
// Loop of `radius`, drifting `drift` m to the left so its entry and exit don't overlap. Needs flat ground either side.
export const loop = (radius: number, drift: number, o: { checkpoint?: boolean } = {}): Piece => ({ kind: 'loop', radius, drift, ...o });
// Corkscrew: a flat straight `len` m long on which the Track rolls a full 360° around its centre line (dir 1 = right
// side down first, -1 = left). Eased in and out. hold: metres ridden upside down at 180° halfway through.
export const corkscrew = (len: number, o: { dir?: 1 | -1; hold?: number; checkpoint?: boolean } = {}): Piece =>
  ({ kind: 'corkscrew', len, dir: o.dir ?? 1, hold: o.hold ?? 0, checkpoint: o.checkpoint });
// Boost pad: a strip `len` m long starting where the next piece starts; riding onto it Boosts until the strip ends.
// Takes no Track itself, so put it before the piece(s) the strip lies on.
export const boostPad = (len: number): Piece => ({ kind: 'boostPad', len });

const rad = (d: number) => (d * Math.PI) / 180;
const AIR_GRAVITY = 12; // bike/tuning.ts airGravity: a Gap's reach depends on it
const dir = (h: number) => [-Math.sin(h), Math.cos(h)]; // heading 0 → +z; + heading turns right (towards −x)

// Walk the pieces from the origin heading +z, emitting control points. A straight puts a point every ≤50 m and ramps
// the bank to its own; an arc puts one every ≤12 m (closer on tight turns) at its bank.
function walk(pieces: Piece[], free: [number, number]) {
  let x = 0, z = 0, y = 0, h = 0, bank = 0, grade = 0; // grade: the Track's slope where the last piece ended
  const cps: ControlPoint[] = [[0, 0, 0, 0]], checkpointCps = [0], gapSegments: number[] = [], boostPads: { cp: number; len: number }[] = [];
  const ahead = (dist: number, left = 0) => { const [dx, dz] = dir(h); return [x + dx * dist + Math.cos(h) * left, z + dz * dist + Math.sin(h) * left]; };
  for (const p of pieces) {
    if (p.checkpoint) checkpointCps.push(cps.length - 1);
    if (p.kind === 'boostPad') { boostPads.push({ cp: cps.length - 1, len: p.len }); continue; }
    if (p.kind === 'kicker') {
      const g1 = Math.tan(rad(p.deg)), yAt = (d: number) => y + grade * d + ((g1 - grade) / (2 * p.len)) * d * d;
      for (const f of [0.5, 1]) { const [px, pz] = ahead(p.len * f); cps.push([px, yAt(p.len * f), pz, 0]); }
      [x, z] = ahead(p.len); y = yAt(p.len); grade = g1; bank = 0;
      continue;
    }
    if (p.kind === 'gap') {
      const th = Math.atan(grade), reach = (v: number) => { // how far a flight at v carries before it comes down to the deck
        const vx = v * Math.cos(th), vy = v * Math.sin(th);
        return (vx * (vy + Math.sqrt(vy * vy + 2 * AIR_GRAVITY * p.drop))) / AIR_GRAVITY;
      };
      const D = reach(p.vMin), deck = reach(p.vMax) - D + 20;
      if (!Number.isFinite(D)) throw new Error(`turtle: a ${p.vMin} m/s flight can't reach a deck ${-p.drop} m up`);
      gapSegments.push(cps.length - 1, cps.length); // lip → mid-Gap → deck start: no geometry
      const [mx, mz] = ahead(D / 2); cps.push([mx, y + (grade * D) / 2, mz, 0]); // on the lip line: it sets the lip angle
      [x, z] = ahead(D); y -= p.drop; grade = 0; bank = 0;
      cps.push([x, y, z, 0]);
      if (p.deckCheckpoint) checkpointCps.push(cps.length - 1);
      const n = Math.ceil(deck / 50);
      for (let k = 1; k <= n; k++) { const [px, pz] = ahead((deck * k) / n); cps.push([px, y, pz, 0]); }
      [x, z] = ahead(deck);
      continue;
    }
    if (p.kind === 'loop') { // a vertical circle from −45° to 225°, as on Overdrive, then back on the ground drifted left
      for (let k = 0; k < 7; k++) {
        const th = rad(-45 + 45 * k), [px, pz] = ahead(p.radius * Math.cos(th), (p.drift * (k + 1)) / 8);
        cps.push([px, y + p.radius + p.radius * Math.sin(th), pz, 0]);
      }
      [x, z] = ahead(0, p.drift); cps.push([x, y, z, 0]); grade = 0; bank = 0;
      continue;
    }
    if (p.kind === 'corkscrew') { // a point every ≤10 m (8+), so no step between two points nears 180° (bake wraps them)
      const ease = (f: number) => f * f * (3 - 2 * f), half = (p.len - p.hold) / 2;
      const roll = (d: number) => p.hold === 0 ? 360 * ease(d / p.len)
        : d < half ? 180 * ease(d / half) : d < half + p.hold ? 180 : 180 + 180 * ease((d - half - p.hold) / half);
      const n = Math.max(8, Math.ceil(p.len / 10));
      for (let k = 1; k <= n; k++) { const [px, pz] = ahead((p.len * k) / n); cps.push([px, y, pz, bank + p.dir * roll((p.len * k) / n)]); }
      [x, z] = ahead(p.len); grade = 0;
      continue;
    }
    const y0 = y, rise = p.kind === 'straight' && p.ground ? -y : p.rise ?? 0;
    if (p.kind === 'straight') {
      const len = p.free ? free[p.free - 1] : p.len, n = Math.max(1, Math.ceil(len / 50)), [dx, dz] = dir(h), b0 = bank;
      bank = p.bank ?? 0;
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        cps.push([x + dx * len * f, y0 + rise * f, z + dz * len * f, b0 + (bank - b0) * f]);
      }
      x += dx * len; z += dz * len;
      if (len > 0) grade = rise / len;
    } else {
      const total = rad(p.deg), sgn = Math.sign(total), R = p.radius;
      const n = Math.max(2, Math.ceil((Math.abs(total) * R) / Math.min(12, Math.max(4, R * 0.5))));
      const cx = x - Math.cos(h) * sgn * R, cz = z - Math.sin(h) * sgn * R; // the centre is on the turn's side
      for (let k = 1; k <= n; k++) {
        const hk = h + (total * k) / n;
        cps.push([cx + Math.cos(hk) * sgn * R, y0 + rise * (k / n), cz + Math.sin(hk) * sgn * R, p.bank]);
      }
      h += total; x = cx + Math.cos(h) * sgn * R; z = cz + Math.sin(h) * sgn * R; bank = p.bank;
      grade = rise / (Math.abs(total) * R);
    }
    y = y0 + rise;
  }
  return { cps, checkpointCps, gapSegments, boostPads, end: [x, z], y };
}

export function buildTrack(pieces: Piece[]) {
  const e0 = walk(pieces, [0, 0]).end, e1 = walk(pieces, [1, 0]).end, e2 = walk(pieces, [0, 1]).end;
  const a = [e1[0] - e0[0], e1[1] - e0[1]], b = [e2[0] - e0[0], e2[1] - e0[1]], det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-9) throw new Error('turtle: the two free straights are parallel, so the Lap cannot be closed');
  const free: [number, number] = [(-e0[0] * b[1] + e0[1] * b[0]) / det, (-a[0] * e0[1] + a[1] * e0[0]) / det];
  if (free.some(L => L < 0)) throw new Error(`turtle: a free straight came out negative (${free.map(L => L.toFixed(1))})`);
  const w = walk(pieces, free);
  if (Math.abs(w.y) > 1e-6) throw new Error(`turtle: the Lap ends ${w.y.toFixed(2)} m off the start line's height`);
  w.cps.pop(); // the last point is the start line again
  // the last point is the start line again, so a pad there starts at point 0
  const boostPads = w.boostPads.map(b => ({ ...b, cp: b.cp % w.cps.length }));
  return { cps: w.cps, checkpointCps: w.checkpointCps, gapSegments: w.gapSegments, boostPads, free };
}
