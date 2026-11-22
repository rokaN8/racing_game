// Turtle builder (docs/game-spec.md → Building Tracks 2 and 3): lays a Track out as straights and arcs from a heading,
// so turn radii are exact, instead of hand-placed control points. Two straights are marked free; their lengths are
// solved so the Lap closes on the start line (the end position is linear in them). The Lap must turn 0° (a figure-8)
// or ±360° in total. Output is the usual control points and Checkpoint indices for bakeTrack.
import type { ControlPoint } from './bake';

// + turn = right (bank +), − turn = left (bank −). rise = height change over the piece, in m.
// checkpoint: a Checkpoint where the piece starts. free: this straight's length is solved (len is ignored).
export type Piece =
  | { kind: 'straight'; len: number; rise?: number; bank?: number; checkpoint?: boolean; free?: 1 | 2 }
  | { kind: 'turn'; deg: number; radius: number; bank: number; rise?: number; checkpoint?: boolean };

export const straight = (len: number, o: Omit<Extract<Piece, { kind: 'straight' }>, 'kind' | 'len'> = {}): Piece => ({ kind: 'straight', len, ...o });
export const turn = (deg: number, radius: number, bank: number, o: { rise?: number; checkpoint?: boolean } = {}): Piece =>
  ({ kind: 'turn', deg, radius, bank, ...o });

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (h: number) => [-Math.sin(h), Math.cos(h)]; // heading 0 → +z; + heading turns right (towards −x)

// Walk the pieces from the origin heading +z, emitting control points. A straight puts a point every ≤50 m and ramps
// the bank to its own; an arc puts one every ≤12 m (closer on tight turns) at its bank.
function walk(pieces: Piece[], free: [number, number]) {
  let x = 0, z = 0, y = 0, h = 0, bank = 0;
  const cps: ControlPoint[] = [[0, 0, 0, 0]], checkpointCps = [0];
  for (const p of pieces) {
    if (p.checkpoint) checkpointCps.push(cps.length - 1);
    const y0 = y, rise = p.rise ?? 0;
    if (p.kind === 'straight') {
      const len = p.free ? free[p.free - 1] : p.len, n = Math.max(1, Math.ceil(len / 50)), [dx, dz] = dir(h), b0 = bank;
      bank = p.bank ?? 0;
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        cps.push([x + dx * len * f, y0 + rise * f, z + dz * len * f, b0 + (bank - b0) * f]);
      }
      x += dx * len; z += dz * len;
    } else {
      const total = rad(p.deg), sgn = Math.sign(total), R = p.radius;
      const n = Math.max(2, Math.ceil((Math.abs(total) * R) / Math.min(12, Math.max(4, R * 0.5))));
      const cx = x - Math.cos(h) * sgn * R, cz = z - Math.sin(h) * sgn * R; // the centre is on the turn's side
      for (let k = 1; k <= n; k++) {
        const hk = h + (total * k) / n;
        cps.push([cx + Math.cos(hk) * sgn * R, y0 + rise * (k / n), cz + Math.sin(hk) * sgn * R, p.bank]);
      }
      h += total; x = cx + Math.cos(h) * sgn * R; z = cz + Math.sin(h) * sgn * R; bank = p.bank;
    }
    y = y0 + rise;
  }
  return { cps, checkpointCps, end: [x, z], y };
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
  return { cps: w.cps, checkpointCps: w.checkpointCps, free };
}
