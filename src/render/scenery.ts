// Trackside scenery and the Rung ripple (docs/game-spec.md → Trackside scenery). Placed from the baked Track alone,
// so a TrackDef never lists it: lattice light towers either side of every Loop and Corkscrew, a beacon tower off each
// Checkpoint, one giant holo-board with the Track's name by the start. Outline only, far and big, so the deck stays
// clear. Placement is pure (tested headlessly); buildScenery draws it.
import { AdditiveBlending, CanvasTexture, DoubleSide, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Scene } from 'three';
import { sampleAt, type Track } from '../track/bake';
import { css } from './palette';

const LOOP_OUT = 16, LOOP_UP = 15, LOOP_R = 1.5;      // Loop towers: past the edge, above the Loop's top, half-width
const CP_OUT = 25, CP_UP = 25, CP_MIN = 40, CP_R = 1; // Checkpoint towers: past the edge, above the deck, at least this tall
const LOOP_BEACON = 4, CP_BEACON = 6;                 // the bright mast on top
const INVERTED = -0.5;                                // up.y below this: upside down
const CLEAR = 3;                                      // a tower's gap to any part of the Track, past its own half-width
export const BOARD = { s: 12, out: 30, up: 18, w: 40, h: 10 }; // the holo-board: left of the start straight, facing it
const RUNG_BLOCK = 10, RIPPLE_STEPS = 16;             // Rung ripple: 16 blocks of 10 m, one per step of the bar

export interface Tower { x: number; z: number; top: number; r: number; mast: number }

// Every tower for a Track. A tower that would stand in or over another part of the Track (a Helix stack, a crossing)
// is dropped rather than moved, so the rule stays one line.
export function placeTowers(T: Track): Tower[] {
  const towers: Tower[] = [], hw = T.halfWidth, groundY = T.minY - 2;
  // each run of upside-down samples is a Loop or a Corkscrew: a tower each side of its middle. -0.5, not 0, so a
  // steep bank hovering round vertical isn't one.
  const inv = (i: number) => T.up[i % T.N].y < INVERTED;
  for (let i = 0; i < T.N; i++) {
    if (!inv(i) || inv(i + T.N - 1)) continue;
    let j = i; while (inv(j + 1)) j++;
    const m = Math.floor((i + j) / 2) % T.N, top = T.pos[m].y + LOOP_UP;
    for (const side of [-1, 1]) {
      const p = T.pos[m].clone().addScaledVector(T.rgt[m], side * (hw + LOOP_OUT));
      towers.push({ x: p.x, z: p.z, top, r: LOOP_R, mast: LOOP_BEACON });
    }
  }
  for (const s of T.cpS) {
    if (s < 1) continue; // the start has the FINISH arch
    const f = sampleAt(T, s), p = f.p.clone().addScaledVector(new Vector3(f.r.x, 0, f.r.z).normalize(), hw + CP_OUT);
    towers.push({ x: p.x, z: p.z, top: Math.max(f.p.y + CP_UP, groundY + CP_MIN), r: CP_R, mast: CP_BEACON });
  }
  return towers.filter(t => clear(T, t.x, t.z, t.r * Math.SQRT2, t.top + t.mast));
}

// Nothing of the Track below `top` within `r` (plus the deck's half-width and CLEAR) of (x, z).
export function clear(T: Track, x: number, z: number, r: number, top: number) {
  const reach = r + T.halfWidth + CLEAR;
  return T.pos.every(p => p.y > top || Math.hypot(p.x - x, p.z - z) > reach);
}

// The holo-board's centre, beside the start straight on its left, and whether it stands clear of the Track.
export function boardAt(T: Track) {
  const f = sampleAt(T, BOARD.s), p = f.p.clone().addScaledVector(new Vector3(f.r.x, 0, f.r.z).normalize(), -(T.halfWidth + BOARD.out));
  p.y += BOARD.up;
  return { p, t: f.t, ok: clear(T, p.x, p.z, BOARD.w / 2, p.y + BOARD.h / 2) };
}

// Rung ripple: 0..1 brightness of a rung `ahead` metres in front of the Bike, `bar` (0..1) through the Song's bar. A
// stepped chase: each 16th lights the next 10 m block, and a lit block fades over four steps.
export function rippleGlow(ahead: number, bar: number) {
  const range = RUNG_BLOCK * RIPPLE_STEPS;
  if (ahead < 0 || ahead >= range) return 0;
  const age = Math.floor(bar * RIPPLE_STEPS) - Math.floor(ahead / RUNG_BLOCK);
  return age < 0 ? 0 : Math.max(0, 1 - age / 4) * (1 - 0.5 * ahead / range);
}

type Thick = (pts: Vector3[], color: number, px: number) => void;
// Draws the scenery: towers in one draw call, masts in another, the board and its frame in two more.
export function buildScenery(T: Track, scene: Scene, thick: Thick, name: string, c: { edge: number; accent: number; tunnel: number }) {
  const groundY = T.minY - 2, lattice: Vector3[] = [], masts: Vector3[] = [];
  for (const t of placeTowers(T)) { // four corners, a ring every 6 m, a mast on top
    const k = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [t.x + a * t.r, t.z + b * t.r]);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = k[i], [bx, bz] = k[(i + 1) % 4];
      lattice.push(new Vector3(ax, groundY, az), new Vector3(ax, t.top, az));
      for (let y = groundY + 6; y <= t.top; y += 6) lattice.push(new Vector3(ax, y, az), new Vector3(bx, y, bz));
    }
    masts.push(new Vector3(t.x, t.top, t.z), new Vector3(t.x, t.top + t.mast, t.z));
  }
  if (lattice.length) { thick(lattice, c.tunnel, 2); thick(masts, c.accent, 6); }

  const b = boardAt(T);
  if (!b.ok) return;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d')!;
  g.strokeStyle = g.fillStyle = css(c.edge); g.lineWidth = 6; g.font = 'bold 170px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeText(name.toUpperCase(), 512, 136);
  g.globalAlpha = 0.25; for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 1024, 2); // scanlines
  const panel = new Mesh(new PlaneGeometry(BOARD.w, BOARD.h),
    new MeshBasicMaterial({ map: new CanvasTexture(cv), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  const Z = new Vector3(-b.t.x, 0, -b.t.z).normalize(), Y = new Vector3(0, 1, 0), X = Y.clone().cross(Z); // upright, facing back down the Track
  panel.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(X, Y, Z));
  panel.position.copy(b.p); scene.add(panel);
  const q = (dx: number, dy: number) => b.p.clone().addScaledVector(X, dx * BOARD.w / 2).addScaledVector(Y, dy * BOARD.h / 2);
  const leg = (dx: number) => { const top = q(dx, -1); return [top, new Vector3(top.x, groundY, top.z)]; };
  thick([q(-1, -1), q(1, -1), q(1, -1), q(1, 1), q(1, 1), q(-1, 1), q(-1, 1), q(-1, -1), ...leg(-0.6), ...leg(0.6)], c.accent, 3);
}
