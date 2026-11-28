// Track ribbon and thick neon edges, Bike and Ghost Bike (from bike.ts), grid floor, Light trail, bloom.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute,
  GridHelper, Group, HalfFloatType, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Points,
  PointsMaterial, Quaternion, Scene, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderTarget,
  type Camera, type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { sampleAt, type Track } from '../track/bake';
import { createBikeModels, TRAIL_ANCHOR } from './bike';
import { color, css, derive, type Palette } from './palette';

// Tunnel arch: radius, centre height over the deck, strand count (a ring clears the deck edges by ~1.5 m)
const TUNNEL_R = 6.5, TUNNEL_H = 1.5, TUNNEL_STRANDS = 8;

// Every colour comes from the Track's palette (render/palette.ts); the Bike, Ghost and Light trail stay fixed.
export function createScene(T: Track, palette: Palette) {
  const c = derive(palette);
  const scene = new Scene();
  scene.background = color(c.sky);
  const lineMats: LineMaterial[] = [];

  const verts: number[] = [], idx: number[] = [], edge: Vector3[] = [], rungs: Vector3[] = [], cps: Vector3[] = [];
  const lift = (v: Vector3, i: number) => v.clone().addScaledVector(T.up[i], 0.03);
  const L = (i: number) => T.pos[i].clone().addScaledVector(T.rgt[i], -T.halfWidth);
  const R = (i: number) => T.pos[i].clone().addScaledVector(T.rgt[i], T.halfWidth);
  for (let i = 0; i < T.N; i++) verts.push(...L(i).toArray(), ...R(i).toArray());
  for (let i = 0; i < T.N; i++) {
    if (T.gap[i]) continue;
    const j = (i + 1) % T.N;
    idx.push(2 * i, 2 * j, 2 * i + 1, 2 * i + 1, 2 * j, 2 * j + 1);
    edge.push(lift(L(i), i), lift(L(j), j), lift(R(i), i), lift(R(j), j));
    if (i % 4 === 0) rungs.push(lift(L(i), i), lift(R(i), i));
  }
  for (const s of T.cpS) { const i = Math.round(s / T.ds) % T.N; cps.push(lift(L(i), i), lift(R(i), i)); }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3)); g.setIndex(idx);
  scene.add(new Mesh(g, new MeshBasicMaterial({ color: c.fill, side: DoubleSide })));
  const rungLines = new LineSegments(new BufferGeometry().setFromPoints(rungs), new LineBasicMaterial({ color: c.rungs }));
  scene.add(rungLines); // PROTOTYPE #84: exposed so the Rung ripple can swap it
  const thick = (pts: Vector3[], color: number, px: number) => {
    const mat = new LineMaterial({ color, linewidth: px }); // linewidth in pixels
    lineMats.push(mat);
    scene.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pts.flatMap(p => p.toArray())), mat));
    return mat;
  };
  const edgeMat = thick(edge, c.edge, 2), cpMat = thick(cps, c.accent, 4);
  // The beat pulse (docs/game-spec.md → Songs): edges and Checkpoint lines at k × their brightness.
  const pulse = (k: number) => { edgeMat.color.setHex(c.edge).multiplyScalar(k); cpMat.color.setHex(c.accent).multiplyScalar(k); };
  // Boost pads: forward-pointing chevrons every 6 m along the strip, in the secondary colour
  const on = (s: number, side: number) => { const f = sampleAt(T, s); return f.p.addScaledVector(f.r, side * T.halfWidth).addScaledVector(f.u, 0.06); };
  const chevrons: Vector3[] = [];
  for (const pad of T.pads) for (let s = pad.s; s <= pad.s + pad.len - 2.5; s += 6) chevrons.push(on(s, -0.85), on(s + 2.5, 0), on(s + 2.5, 0), on(s, 0.85));
  if (chevrons.length) thick(chevrons, c.accent, 5);
  // Tunnels (docs/game-spec.md → Design rules → Tunnels): 8 strands along an arch over the deck at 60 % of the primary,
  // so they glow softer than the edges, and bright arches in the secondary colour ~24 m apart, the first at the
  // mouth and the last at the exit, so no ring sits past the strands. Built in the Track's frame, so they bank
  // and climb with it.
  const at = (s: number, x: number, y: number) => { const f = sampleAt(T, s); return f.p.addScaledVector(f.r, x).addScaledVector(f.u, y); };
  const strands: Vector3[] = [], rings: Vector3[] = [];
  for (const t of T.tunnels) {
    for (let k = 0; k < TUNNEL_STRANDS; k++) {
      const a = (Math.PI * (k + 0.5)) / TUNNEL_STRANDS, x = TUNNEL_R * Math.cos(a), y = TUNNEL_H + TUNNEL_R * 0.9 * Math.sin(a);
      for (let s = t.s; s < t.s + t.len; s += 4) strands.push(at(s, x, y), at(Math.min(s + 4, t.s + t.len), x, y));
    }
    const a0 = Math.asin(-TUNNEL_H / TUNNEL_R), arc = (s: number, f: number) => {
      const a = a0 + (Math.PI - 2 * a0) * f; return at(s, TUNNEL_R * Math.cos(a), TUNNEL_H + TUNNEL_R * Math.sin(a));
    };
    const n = Math.max(1, Math.round(t.len / 24)); // rings spread evenly, one at the mouth and one at the exit
    for (let r = 0; r <= n; r++) for (let k = 0; k < 24; k++) rings.push(arc(t.s + (t.len * r) / n, k / 24), arc(t.s + (t.len * r) / n, (k + 1) / 24));
  }
  if (strands.length) { thick(strands, c.tunnel, 2); thick(rings, c.accent, 3); }
  finishBanner(T, scene, thick, c.accent, c.fill);

  const grid = new GridHelper(3000, 150, c.gridMajor, c.gridMinor);
  grid.position.y = T.minY - 2; scene.add(grid);
  const horizon = createHorizon(c, Math.atan2(T.tan[0].x, T.tan[0].z));
  scene.add(horizon);

  const bikeModels = createBikeModels(m => lineMats.push(m));
  const { bike, ghostBike } = bikeModels;
  ghostBike.visible = false; // hidden until there is a best Lap to replay
  scene.add(bike, ghostBike);

  // thick lines are sized in pixels, so they need the canvas size
  const resizeLines = (w: number, h: number) => { for (const m of lineMats) m.resolution.set(w, h); };
  return { scene, bike, ghostBike, updateBike: bikeModels.update, trail: createTrail(scene), resizeLines, pulse, horizon, rungLines };
}

// Synthwave horizon (docs/game-spec.md → Palettes): a striped sun where the start straight looks (`heading`, about +y
// from +z), a ring of wireframe mountains and stars. Built around the origin; main.ts moves it to the camera each
// frame (position only), so it sits at infinity. Distances stay inside the camera's 3000 m far plane.
// ponytail: fixed radii, fine while every Track is under ~1.2 km across; a Track much past 2 km would poke through the
// mountains, then scale the radii (and the far plane) to the Track.
const MOUNTAIN_R = 2000, SUN_R = 2300, STAR_R = 2600, SUN_SIZE = 1200, STARS = 300;
function createHorizon(c: ReturnType<typeof derive>, heading: number) {
  const group = new Group();
  const at = (a: number, r: number, y: number) => new Vector3(r * Math.sin(a), y, r * Math.cos(a));

  // Mountains: columns of [skirt, foot, shoulder, ridge]. The skirt reaches far below eye level, fill only, so no sky
  // shows past the grid's edge from up high. The fill sits 1 % further out than the lines (same direction from the
  // camera), so they never z-fight.
  const COLS = 160, rows: Vector3[][] = [];
  for (let i = 0; i < COLS; i++) {
    const a = (i / COLS) * 2 * Math.PI, ridge = 30 + 150 * Math.abs(Math.sin(3 * a + 1) * Math.sin(7 * a)) + 40 * Math.random();
    rows.push([-0.6 * MOUNTAIN_R, -20, ridge * (0.35 + 0.2 * Math.random()), ridge].map(y => at(a, MOUNTAIN_R, y)));
  }
  const fill: number[] = [], lines: Vector3[] = [];
  for (let i = 0; i < COLS; i++) {
    const p = rows[i], q = rows[(i + 1) % COLS];
    for (let k = 0; k < 3; k++) fill.push(...[p[k], q[k], p[k + 1], p[k + 1], q[k], q[k + 1]].flatMap(v => v.toArray()));
    for (let k = 1; k < 4; k++) lines.push(p[k], q[k]);               // along: foot, shoulder, ridge
    lines.push(p[1], p[3], p[1], q[2], p[2], q[3]);                    // up, and the diagonals
  }
  const fillGeo = new BufferGeometry(); fillGeo.setAttribute('position', new Float32BufferAttribute(fill, 3));
  const fillMesh = new Mesh(fillGeo, new MeshBasicMaterial({ color: c.mountainFill, side: DoubleSide }));
  fillMesh.scale.setScalar(1.01);
  group.add(fillMesh, new LineSegments(new BufferGeometry().setFromPoints(lines), new LineBasicMaterial({ color: c.mountain })));

  // Stars: dim points on a dome, any that fall behind the mountains hidden by them.
  const starPos: number[] = [], starCol: number[] = [], tint = new Color();
  for (let i = 0; i < STARS; i++) {
    const el = Math.asin(0.05 + 0.9 * Math.random()), a = Math.random() * 2 * Math.PI;
    starPos.push(...at(a, STAR_R * Math.cos(el), STAR_R * Math.sin(el)).toArray());
    starCol.push(...tint.setHex(c.star).multiplyScalar(0.3 + 0.7 * Math.random()).toArray());
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3)); starGeo.setAttribute('color', new Float32BufferAttribute(starCol, 3));
  group.add(new Points(starGeo, new PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true })));

  // Sun: secondary at the top to primary at the bottom, cut by gaps that widen towards the bottom. Its foot sinks
  // behind the mountains.
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d')!, grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.1, css(c.sunTop)); grad.addColorStop(0.9, css(c.sunBottom));
  g.fillStyle = grad; g.beginPath(); g.arc(256, 256, 256, 0, 2 * Math.PI); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) g.fillRect(0, 512 * (0.52 + 0.068 * i), 512, 4 + 4 * i);
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace;
  const sun = new Mesh(new PlaneGeometry(SUN_SIZE, SUN_SIZE), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  sun.position.copy(at(heading, SUN_R, 0.45 * SUN_SIZE)); // ~15° in radius, its foot at eye level
  sun.lookAt(0, sun.position.y, 0); // upright, facing the camera
  group.add(sun);
  return group;
}

// FINISH arch over the start line (s = 0): two posts, a crossbar, and a text panel facing the oncoming Bike.
const ARCH_H = 6, BANNER_H = 1.6;
function finishBanner(T: Track, scene: Scene, thick: (pts: Vector3[], color: number, px: number) => void, text: number, bg: number) {
  const p = T.pos[0], u = T.up[0], r = T.rgt[0], w = T.halfWidth + 0.5;
  const at = (side: number, h: number) => p.clone().addScaledVector(r, side * w).addScaledVector(u, h);
  thick([at(-1, 0), at(-1, ARCH_H), at(1, 0), at(1, ARCH_H), at(-1, ARCH_H), at(1, ARCH_H),
    at(-1, ARCH_H - BANNER_H), at(1, ARCH_H - BANNER_H)], text, 4);

  const c = document.createElement('canvas'); c.width = 1024; c.height = 200;
  const g = c.getContext('2d')!;
  g.fillStyle = css(bg); g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = css(text); g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('FINISH', c.width / 2, c.height / 2 + 8);
  const panel = new Mesh(new PlaneGeometry(2 * w, BANNER_H),
    new MeshBasicMaterial({ map: new CanvasTexture(c), side: DoubleSide }));
  // face back down the Track (-t) so the text reads right to the oncoming Bike (local +x = Track right)
  panel.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(r, u, T.tan[0].clone().negate()));
  panel.position.copy(at(0, ARCH_H - BANNER_H / 2));
  scene.add(panel);
}

// Light trail: visual-only ribbon from the Bike's tail, newest point first, fading to black (additive, so black = gone).
// One point per 120 Hz physics step, so its length is the same at any frame rate. Cyan, red where it was laid
// while Boosting.
const TRAIL_N = 180, TRAIL_HALF_WIDTH = 0.25; // 1.5 s
const CYAN = [0, 1, 1], RED = [1, 0.1, 0.1]; // red: no Track palette uses it (#ff1a1a)
function createTrail(scene: Scene) {
  const pos = new Float32Array(TRAIL_N * 6), col = new Float32Array(TRAIL_N * 6), idx: number[] = [];
  const fade = new Float32Array(TRAIL_N), tint = new Float32Array(TRAIL_N * 3); // per point: brightness, colour
  for (let i = 0; i < TRAIL_N; i++) {
    fade[i] = 0.6 * (1 - i / (TRAIL_N - 1)) ** 2; // 0.6: peak brightness, keeps its bloom soft
    if (i < TRAIL_N - 1) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const g = new BufferGeometry();
  const posAttr = new BufferAttribute(pos, 3), colAttr = new BufferAttribute(col, 3);
  g.setAttribute('position', posAttr); g.setAttribute('color', colAttr); g.setIndex(idx);
  const mesh = new Mesh(g, new MeshBasicMaterial({
    vertexColors: true, blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide,
  }));
  mesh.frustumCulled = false; scene.add(mesh);

  const tail = new Vector3(), side = new Vector3();
  const tailEdge = (p: Vector3, q: Quaternion) => { // left and right corners of the ribbon at the Bike's tail
    tail.set(0, TRAIL_ANCHOR.y, TRAIL_ANCHOR.z).applyQuaternion(q).add(p);
    side.set(TRAIL_HALF_WIDTH, 0, 0).applyQuaternion(q);
    return [tail.x - side.x, tail.y - side.y, tail.z - side.z, tail.x + side.x, tail.y + side.y, tail.z + side.z];
  };
  return {
    // snap: start a fresh trail (respawn), so it doesn't streak across the map. boost: lay this point red.
    update(p: Vector3, q: Quaternion, snap: boolean, boost: boolean) {
      const h = tailEdge(p, q), c = boost ? RED : CYAN;
      if (snap) for (let i = 0; i < TRAIL_N; i++) { pos.set(h, i * 6); tint.set(c, i * 3); }
      else { pos.copyWithin(6, 0, pos.length - 6); pos.set(h, 0); tint.copyWithin(3, 0, tint.length - 3); tint.set(c, 0); }
      for (let i = 0; i < TRAIL_N; i++) for (let k = 0; k < 3; k++) col[i * 6 + k] = col[i * 6 + 3 + k] = tint[i * 3 + k] * fade[i];
      posAttr.needsUpdate = colAttr.needsUpdate = true;
    },
  };
}

// ponytail: "selective" bloom by luminance threshold, not bloom layers: every non-neon surface is near-black
// (Track fill, rungs, grid, the horizon's mountains and stars sit below the threshold), so only the neon glows, plus the
// horizon's sun, dimmed so it blooms only a little. Switch to layers if a bright non-glow object appears.
export function createBloom(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  // own MSAA target: the composer's default has none, which would undo the renderer's antialias
  const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType }));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.8, 0.4, 0.15); // strength, radius, threshold
  const scenePass = new RenderPass(scene, camera);
  const split = new ShaderPass(RGBShiftShader); split.enabled = false; // Speed feel's colour split, off until set
  composer.addPass(scenePass); composer.addPass(bloom); composer.addPass(split); composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSplit(k: number) { split.uniforms.amount.value = k; split.enabled = k > 0; }, // docs/game-spec.md → Speed feel
    setScene(s: Scene) { scenePass.scene = s; }, // each Track has its own scene, built at boot
    resize(w: number, h: number) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
