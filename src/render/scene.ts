// Track ribbon and thick neon edges, Bike and Ghost Bike (from bike.ts), grid floor, Light trail, bloom.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute,
  GridHelper, HalfFloatType, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion,
  Scene, Vector2, Vector3,
  WebGLRenderTarget,
  type Camera, type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Track } from '../track/bake';
import { createBikeModels, TRAIL_ANCHOR } from './bike';
import { color, css, derive, type Palette } from './palette';

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
  scene.add(new LineSegments(new BufferGeometry().setFromPoints(rungs), new LineBasicMaterial({ color: c.rungs })));
  const thick = (pts: Vector3[], color: number, px: number) => {
    const mat = new LineMaterial({ color, linewidth: px }); // linewidth in pixels
    lineMats.push(mat);
    scene.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pts.flatMap(p => p.toArray())), mat));
  };
  thick(edge, c.edge, 2); thick(cps, c.accent, 4);
  finishBanner(T, scene, thick, c.accent, c.fill);

  const grid = new GridHelper(3000, 150, c.gridMajor, c.gridMinor);
  grid.position.y = T.minY - 2; scene.add(grid);

  const bikeModels = createBikeModels(m => lineMats.push(m));
  const { bike, ghostBike } = bikeModels;
  ghostBike.visible = false; // hidden until there is a best Lap to replay
  scene.add(bike, ghostBike);

  // thick lines are sized in pixels, so they need the canvas size
  const resizeLines = (w: number, h: number) => { for (const m of lineMats) m.resolution.set(w, h); };
  return { scene, bike, ghostBike, updateBike: bikeModels.update, trail: createTrail(scene), resizeLines };
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
// One point per 120 Hz physics step, so its length is the same at any frame rate.
const TRAIL_N = 180, TRAIL_HALF_WIDTH = 0.25; // 1.5 s
function createTrail(scene: Scene) {
  const pos = new Float32Array(TRAIL_N * 6), col = new Float32Array(TRAIL_N * 6), idx: number[] = [];
  for (let i = 0; i < TRAIL_N; i++) {
    const f = 0.6 * (1 - i / (TRAIL_N - 1)) ** 2; // 0.6: peak brightness, keeps its bloom soft
    col.set([0, f, f, 0, f, f], i * 6); // cyan
    if (i < TRAIL_N - 1) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const g = new BufferGeometry();
  const posAttr = new BufferAttribute(pos, 3);
  g.setAttribute('position', posAttr); g.setAttribute('color', new BufferAttribute(col, 3)); g.setIndex(idx);
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
    // snap: start a fresh trail (respawn), so it doesn't streak across the map
    update(p: Vector3, q: Quaternion, snap: boolean) {
      const h = tailEdge(p, q);
      if (snap) for (let i = 0; i < TRAIL_N; i++) pos.set(h, i * 6);
      else { pos.copyWithin(6, 0, pos.length - 6); pos.set(h, 0); }
      posAttr.needsUpdate = true;
    },
  };
}

// ponytail: "selective" bloom by luminance threshold, not bloom layers: every non-neon surface is near-black
// (Track fill, rungs, grid sit below the threshold), so only the neon glows. Switch to layers if a bright non-glow object appears.
export function createBloom(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  // own MSAA target: the composer's default has none, which would undo the renderer's antialias
  const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType }));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.8, 0.4, 0.15); // strength, radius, threshold
  const scenePass = new RenderPass(scene, camera);
  composer.addPass(scenePass); composer.addPass(bloom); composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setScene(s: Scene) { scenePass.scene = s; }, // each Track has its own scene, built at boot
    resize(w: number, h: number) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
