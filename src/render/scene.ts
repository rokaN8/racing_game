// Track ribbon and thick neon edges, wireframe Bike, grid floor, Light trail, bloom.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, DoubleSide, EdgesGeometry, Float32BufferAttribute,
  GridHelper, Group, HalfFloatType, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Quaternion, Scene, Vector2, Vector3,
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

const NEON = 0xff2bd6, CYAN = 0x00ffff, YELLOW = 0xffe600;

export function createScene(T: Track) {
  const scene = new Scene();
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
  scene.add(new Mesh(g, new MeshBasicMaterial({ color: 0x0a0830, side: DoubleSide })));
  scene.add(new LineSegments(new BufferGeometry().setFromPoints(rungs), new LineBasicMaterial({ color: 0x0b5d6b })));
  const thick = (pts: Vector3[], color: number, px: number) => {
    const mat = new LineMaterial({ color, linewidth: px }); // linewidth in pixels
    lineMats.push(mat);
    scene.add(new LineSegments2(new LineSegmentsGeometry().setPositions(pts.flatMap(p => p.toArray())), mat));
  };
  thick(edge, NEON, 2); thick(cps, YELLOW, 4);

  const grid = new GridHelper(3000, 150, 0x331144, 0x1a0828);
  grid.position.y = T.minY - 2; scene.add(grid);

  const bike = new Group();
  const body = new LineSegments(new EdgesGeometry(new BoxGeometry(0.7, 0.5, 2.2)), new LineBasicMaterial({ color: CYAN }));
  body.position.y = 0.4;
  const nose = new Mesh(new ConeGeometry(0.3, 0.8, 4), new MeshBasicMaterial({ color: CYAN }));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.4, 1.5);
  bike.add(body, nose); scene.add(bike);

  // thick lines are sized in pixels, so they need the canvas size
  const resizeLines = (w: number, h: number) => { for (const m of lineMats) m.resolution.set(w, h); };
  return { scene, bike, trail: createTrail(scene), resizeLines };
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
    tail.set(0, 0.4, -1.1).applyQuaternion(q).add(p);
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
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(bloom); composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    resize(w: number, h: number) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    },
  };
}
