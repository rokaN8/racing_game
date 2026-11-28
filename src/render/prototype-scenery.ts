// PROTOTYPE (throwaway, Trackside scenery and Rung ripple ticket #84): three variants, picked with ?scenery=A|B|C
// (none: the game as it is). Render only, no physics. Never merged to main. Everything is generated from the baked
// Track, so no TrackDef changes; each variant is a different idea of where scenery goes, plus its own Rung ripple.
//   A Markers: near the deck. Arches over Checkpoints, short pylons along both edges. Ripple: one crest per bar.
//   B Supports: under and beside. Pillars down to the grid, holo-boards with the Track name at Checkpoints. Ripple: a
//     train of soft waves, one wavelength per bar.
//   C Skyline: far and big. Light towers by every Loop / Corkscrew, beacon towers off each Checkpoint, one giant
//     holo-board by the start. Ripple: a stepped chase, one block per step.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Scene,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { sampleAt, type Track } from '../track/bake';
import { css, derive, type Palette } from './palette';

export const VARIANTS = { A: 'Markers: Checkpoint arches + edge pylons; single crest', B: 'Supports: pillars + holo-boards; wave train', C: 'Skyline: Loop towers + beacons + giant board; stepped chase' } as const;
type Key = keyof typeof VARIANTS;
export const KEYS = Object.keys(VARIANTS) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scenery');
export const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

const mats: LineMaterial[] = [];
export const resizeScenery = (w: number, h: number) => { for (const m of mats) m.resolution.set(w, h); };

export function createScenery(T: Track, palette: Palette, name: string, scene: Scene, rungs: LineSegments) {
  if (!key) return { ripple: (_s: number, _bar: number | null) => {}, stats: '' };
  const c = derive(palette), hw = T.halfWidth, groundY = T.minY - 2;
  let calls = 0, segs = 0;
  const at = (s: number, x: number, y: number) => { const f = sampleAt(T, s); return f.p.addScaledVector(f.r, x).addScaledVector(f.u, y); };
  const thick = (pts: Vector3[], color: number, px: number) => {
    if (!pts.length) return;
    const m = new LineMaterial({ color, linewidth: px }); mats.push(m);
    scene.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pts.flatMap(p => p.toArray())), m));
    calls++; segs += pts.length / 2;
  };
  const idx = (s: number) => Math.round(s / T.ds) % T.N;
  const solid = (s: number) => !T.gap[idx(s)];
  const level = (s: number) => T.up[idx(s)].y > 0.8; // upright stretch: no Loop, Corkscrew or steep bank
  const cps = T.cpS.filter(s => s > 1); // s = 0 already has the FINISH arch

  // a lattice tower from the grid to `top`: four corners, a ring every 6 m
  const tower = (base: Vector3, top: number, r: number, out: Vector3[]) => {
    const k = [[r, r], [-r, r], [-r, -r], [r, -r]].map(([x, z]) => new Vector3(base.x + x, 0, base.z + z));
    for (let i = 0; i < 4; i++) {
      const a = k[i], b = k[(i + 1) % 4];
      out.push(new Vector3(a.x, groundY, a.z), new Vector3(a.x, top, a.z));
      for (let y = groundY + 6; y <= top; y += 6) out.push(new Vector3(a.x, y, a.z), new Vector3(b.x, y, b.z));
    }
  };
  // a holo-board: the name in the primary colour on a clear ground, framed in the secondary, facing back down the Track
  const board = (s: number, x: number, y: number, w: number, h: number) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    const g = cv.getContext('2d')!;
    g.strokeStyle = css(c.edge); g.lineWidth = 6; g.font = 'bold 170px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText(name.toUpperCase(), 512, 136);
    g.globalAlpha = 0.25; g.fillStyle = css(c.edge); for (let yy = 0; yy < 256; yy += 8) g.fillRect(0, yy, 1024, 2); // scanlines
    const f = sampleAt(T, s), mesh = new Mesh(new PlaneGeometry(w, h),
      new MeshBasicMaterial({ map: new CanvasTexture(cv), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    const Z = new Vector3(-f.t.x, 0, -f.t.z).normalize(), Y = new Vector3(0, 1, 0), X = Y.clone().cross(Z); // faces -t
    mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(X, Y, Z));
    const p = f.p.clone().addScaledVector(new Vector3(f.r.x, 0, f.r.z).normalize(), x); p.y += y;
    mesh.position.copy(p); scene.add(mesh); calls++;
    const q = (dx: number, dy: number) => p.clone().addScaledVector(X, dx * w / 2).addScaledVector(Y, dy * h / 2);
    thick([q(-1, -1), q(1, -1), q(1, -1), q(1, 1), q(1, 1), q(-1, 1), q(-1, 1), q(-1, -1),
      q(-0.6, -1), new Vector3(q(-0.6, -1).x, groundY, q(-0.6, -1).z), q(0.6, -1), new Vector3(q(0.6, -1).x, groundY, q(0.6, -1).z)], c.accent, 3);
  };

  if (key === 'A') {
    const arches: Vector3[] = [], pylons: Vector3[] = [];
    for (const s of cps) for (const x of [-hw - 0.5, hw + 0.5]) arches.push(at(s, x, 0), at(s, x, 6));
    for (const s of cps) arches.push(at(s, -hw - 0.5, 6), at(s, hw + 0.5, 6), at(s, -hw - 0.5, 5.2), at(s, hw + 0.5, 5.2));
    for (let s = 20; s < T.L; s += 40) {
      if (!solid(s)) continue;
      for (const side of [-1, 1]) { // a 3 m outline spike just past the edge: square foot, four lines to the tip
        const x = side * (hw + 1.2), tip = at(s, x, 3), foot = [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]].map(([dx, ds]) => at(s + ds, x + dx, 0));
        for (let i = 0; i < 4; i++) pylons.push(foot[i], foot[(i + 1) % 4], foot[i], tip);
      }
    }
    thick(arches, c.accent, 4); thick(pylons, c.edge, 2);
  } else if (key === 'B') {
    const pillars: Vector3[] = [];
    for (let s = 15; s < T.L; s += 30) {
      if (!solid(s) || !level(s) || T.pos[idx(s)].y - groundY < 4) continue;
      const l = at(s, -hw, -0.2), r = at(s, hw, -0.2);
      pillars.push(l, new Vector3(l.x, groundY, l.z), r, new Vector3(r.x, groundY, r.z), l, r);
      pillars.push(l, new Vector3(r.x, (r.y + groundY) / 2, r.z), r, new Vector3(l.x, (l.y + groundY) / 2, l.z)); // X brace
    }
    thick(pillars, c.tunnel, 2);
    cps.forEach((s, i) => board(s, (i % 2 ? -1 : 1) * (hw + 6), 5, 12, 3));
  } else {
    const towers: Vector3[] = [], beacons: Vector3[] = [];
    for (let i = 0; i < T.N; i++) { // Loops and Corkscrews: each run of upside-down samples gets a tower each side
      if (T.up[i].y >= 0 || T.up[(i + T.N - 1) % T.N].y < 0) continue;
      let j = i; while (T.up[(j + 1) % T.N].y < 0) j++;
      const m = Math.floor((i + j) / 2) % T.N, top = T.pos[m].y + 15;
      for (const side of [-1, 1]) {
        const base = T.pos[m].clone().addScaledVector(T.rgt[m], side * (hw + 16));
        tower(base, top, 1.5, towers); beacons.push(new Vector3(base.x, top, base.z), new Vector3(base.x, top + 4, base.z));
      }
    }
    for (const s of cps) {
      const f = sampleAt(T, s), base = f.p.clone().addScaledVector(new Vector3(f.r.x, 0, f.r.z).normalize(), hw + 25), top = Math.max(f.p.y + 25, groundY + 40);
      tower(base, top, 1, towers); beacons.push(new Vector3(base.x, top, base.z), new Vector3(base.x, top + 6, base.z));
    }
    thick(towers, c.tunnel, 2); thick(beacons, c.accent, 6);
    board(12, -(hw + 30), 18, 40, 10);
  }

  // Rung ripple: our own rungs with per-vertex colour, in place of the plain ones
  rungs.visible = false;
  const rs: number[] = [], rp: number[] = [];
  for (let i = 0; i < T.N; i += 4) if (!T.gap[i]) {
    for (const side of [-1, 1]) rp.push(...T.pos[i].clone().addScaledVector(T.rgt[i], side * hw).addScaledVector(T.up[i], 0.03).toArray());
    rs.push(i * T.ds);
  }
  const col = new Float32Array(rp.length), geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(rp), 3)); geo.setAttribute('color', new BufferAttribute(col, 3));
  scene.add(new LineSegments(geo, new LineBasicMaterial({ vertexColors: true }))); calls++;
  const base = new Color(c.rungs), lit = new Color(c.accent), tmp = new Color();
  const RANGE = 160;
  const glow = (ahead: number, bar: number) => { // 0..1 brightness of a rung `ahead` metres in front of the Bike
    if (ahead > RANGE) return 0;
    const fade = 1 - ahead / RANGE;
    if (key === 'A') { const crest = 8 + bar * (RANGE - 8); return Math.max(0, 1 - Math.abs(ahead - crest) / 4) * (0.4 + 0.6 * fade); }
    if (key === 'B') return Math.max(0, Math.cos((2 * Math.PI * (ahead - bar * 40)) / 40)) ** 6 * fade;
    const block = Math.floor(ahead / 10), step = Math.floor(bar * 16), age = step - block; // stepped chase, 10 m blocks
    return age < 0 ? 0 : Math.max(0, 1 - age / 4) * (0.5 + 0.5 * fade);
  };
  return {
    stats: `+${calls} draw calls, ${segs} line segments`,
    ripple(bikeS: number, bar: number | null) {
      for (let k = 0; k < rs.length; k++) {
        const ahead = (((rs[k] - bikeS) % T.L) + T.L) % T.L;
        tmp.copy(base).lerp(lit, bar === null ? 0 : glow(ahead, bar));
        tmp.toArray(col, 6 * k); tmp.toArray(col, 6 * k + 3);
      }
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// The switcher: ‹ label ›, reloads with the next ?scenery= (scenes are built at boot). Dev builds only.
export function mountSwitcher(stats: () => string) {
  if (!import.meta.env.DEV) return;
  const all = [null, ...KEYS] as (Key | null)[], el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:99;background:#fff;color:#000;font:13px sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px #0008;display:flex;gap:10px;align-items:center';
  const go = (d: number) => {
    const next = all[(all.indexOf(key) + d + all.length) % all.length], u = new URL(location.href);
    if (next) u.searchParams.set('scenery', next); else u.searchParams.delete('scenery');
    location.href = u.href;
  };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span');
  const show = () => { label.textContent = key ? `${key} (${VARIANTS[key]}) · this Track: ${stats()}` : "off (the game as it is)"; };
  show(); setInterval(show, 500);
  el.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(el);
}
