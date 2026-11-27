// Ported from prototypes/bike-handling.html.
import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import type { TrackDef } from './tracks';

// [x, y, z, bankDeg]. Closed centripetal Catmull-Rom. y is up; + bank tilts up toward the right.
export type ControlPoint = [x: number, y: number, z: number, bankDeg: number];

export interface Track {
  L: number; N: number; ds: number;
  pos: Vector3[]; tan: Vector3[]; up: Vector3[]; rgt: Vector3[];
  gap: boolean[]; cpS: number[]; // per-sample "no geometry here"; Checkpoint distances
  halfWidth: number; minY: number;
  pads: { s: number; len: number }[]; // Boost pads: strip start distance and length
}
export interface Frame { p: Vector3; t: Vector3; u: Vector3; r: Vector3; gap: boolean }

export function bakeTrack({ cps, gapSegments: gapSegs, checkpointCps: cpIdx, halfWidth, boostPads = [] }: Pick<TrackDef, 'cps' | 'gapSegments' | 'checkpointCps' | 'halfWidth' | 'boostPads'>): Track {
  const n = cps.length;
  const curve = new CatmullRomCurve3(cps.map(c => new Vector3(c[0], c[1], c[2])), true, 'centripetal');
  curve.arcLengthDivisions = 6000; curve.updateArcLengths();
  const L = curve.getLength(), N = Math.round(L), ds = L / N;
  const pos: Vector3[] = [], tan: Vector3[] = [], seg: number[] = [], frac: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = curve.getUtoTmapping(i / N, 0), k = t * n;
    pos.push(curve.getPoint(t)); tan.push(curve.getTangent(t).normalize());
    seg.push(Math.floor(k) % n); frac.push(k - Math.floor(k));
  }
  // Rotation-minimizing frame, double reflection (Wang et al. 2008)
  const reflect = (v: Vector3, nrm: Vector3, c: number) => v.clone().addScaledVector(nrm, -2 * nrm.dot(v) / c);
  const rmf = (i: number, j: number, r: Vector3) => {
    const v1 = pos[j].clone().sub(pos[i]), c1 = v1.dot(v1);
    const rL = reflect(r, v1, c1), tL = reflect(tan[i], v1, c1);
    const v2 = tan[j].clone().sub(tL), c2 = v2.dot(v2);
    return c2 < 1e-12 ? rL : reflect(rL, v2, c2);
  };
  const up = [new Vector3(0, 1, 0).addScaledVector(tan[0], -tan[0].y).normalize()];
  for (let i = 1; i < N; i++) up.push(rmf(i - 1, i, up[i - 1]));
  // closed Track: spread the frame's twist mismatch at the seam evenly along its length
  const end = rmf(N - 1, 0, up[N - 1]);
  const err = Math.atan2(new Vector3().crossVectors(end, up[0]).dot(tan[0]), end.dot(up[0]));
  const rgt: Vector3[] = [], gap: boolean[] = [];
  for (let i = 0; i < N; i++) {
    const a = seg[i], b = (a + 1) % n;
    // + bank tilts up toward the right. The step to the next point is wrapped to ±180°, so a Corkscrew ending at 360°
    // (or the Lap seam after one) carries on at 0° instead of unwinding. Any step between two points stays under 180°.
    const step = ((((cps[b][3] - cps[a][3]) % 360) + 540) % 360) - 180;
    const bank = MathUtils.degToRad(cps[a][3] + step * frac[i]);
    up[i].applyAxisAngle(tan[i], err * i / N + bank).normalize();
    rgt.push(new Vector3().crossVectors(tan[i], up[i]));
    gap.push(gapSegs.includes(a));
  }
  const cpS = cpIdx.map(k => seg.indexOf(k) * ds);
  const pads = boostPads.map(b => ({ s: seg.indexOf(b.cp) * ds, len: b.len }));
  const minY = Math.min(...pos.map(p => p.y));
  return { L, N, ds, pos, tan, up, rgt, gap, cpS, halfWidth, minY, pads };
}

export function sampleAt(T: Track, s: number): Frame {
  s = ((s % T.L) + T.L) % T.L;
  const x = s / T.ds, i = Math.floor(x) % T.N, j = (i + 1) % T.N, f = x - Math.floor(x);
  const p = T.pos[i].clone().lerp(T.pos[j], f);
  const t = T.tan[i].clone().lerp(T.tan[j], f).normalize();
  const u = T.up[i].clone().lerp(T.up[j], f); u.addScaledVector(t, -u.dot(t)).normalize();
  return { p, t, u, r: new Vector3().crossVectors(t, u), gap: T.gap[i] };
}
