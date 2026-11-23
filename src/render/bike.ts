// Bike and Ghost Bike models (docs/poc-spec.md → M7: Bike look), wheel spin, lean and Boost glow.
// Bike local: +z forward, +y up, +x left; Track surface at y = 0.
import {
  AdditiveBlending, BoxGeometry, Color, DoubleSide, EdgesGeometry, ExtrudeGeometry, Group, Mesh,
  MeshBasicMaterial, PlaneGeometry, Shape, TorusGeometry, Vector3, type BufferGeometry,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { BikeState } from '../bike/physics';
import { TUNING } from '../bike/tuning';

const CYAN = 0x00ffff, WHITE = 0xffffff, TAIL = 0xff4a10, TAIL_FLARE = 0xffc0a0, UNDER = 0xff7a00;
const FILL = 0x040a14, EDGE = 0x1a5a66; // both below the bloom threshold: the body stays dark so the wheels and lights stand out
const WHEEL_R = 0.4, WHEEL_Z = 0.8, RIM_TUBE = 0.055, RIM_W = 1.6, INNER_R = 0.3; // RIM_W: tyre width as a multiple of the tube, a wide band
const SHELL_R = 0.22, SHELL_W = 0.46, BEVEL = 0.05; // shell arcs sit inside the rims: SHELL_R + BEVEL < WHEEL_R - RIM_TUBE
const TOP_SPIN = 2 * Math.PI * 4; // rad/s shown at top speed; the true rolling rate (~24 turns/s) strobes at 60 fps
const BOOST_FADE = 0.3; // s
const MAX_LEAN = (25 * Math.PI) / 180, LEAN_ACC = 30, LEAN_RATE = 8; // full lean at 30 m/s² sideways

export const TRAIL_ANCHOR = { y: 0.5, z: -1.08 }; // Light trail start, Bike-local

// side profile in (z, y), extruded across the Bike's width
function profile(pts: [number, number][], width: number, bevel = 0) {
  const s = new Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const g = new ExtrudeGeometry(s, bevel
    ? { depth: width, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 }
    : { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); // shape x -> Bike z, extrude -> Bike x
  return g;
}

// arc of the shell around a wheel centre, angles in degrees from +z towards +y
const arc = (cz: number, from: number, to: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let a = from; a <= to; a += 15) pts.push([cz + SHELL_R * Math.cos((a * Math.PI) / 180), WHEEL_R + SHELL_R * Math.sin((a * Math.PI) / 180)]);
  return pts;
};

function build(ghost: boolean, reg: (m: LineMaterial) => void) {
  const ghostMesh = new MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.15, depthWrite: false });
  const glowMat = (color: number) => (ghost ? ghostMesh : new MeshBasicMaterial({ color }));
  const fill = ghost ? ghostMesh
    : new MeshBasicMaterial({ color: FILL, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edges = new LineMaterial(ghost ? { color: WHITE, linewidth: 2, transparent: true, opacity: 0.35, depthWrite: false }
    : { color: EDGE, linewidth: 2 }); // linewidth in pixels
  reg(edges);
  const rings = glowMat(CYAN), tailMat = glowMat(TAIL);

  // solid dark body with dim edges, so hidden lines stay hidden
  const solid = (geo: BufferGeometry) => {
    const g = new Group();
    g.add(new Mesh(geo, fill), new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new EdgesGeometry(geo, 25)), edges));
    return g;
  };
  const glow = (geo: BufferGeometry, mat: MeshBasicMaterial, x: number, y: number, z: number) => {
    const m = new Mesh(geo, mat); m.position.set(x, y, z); return m;
  };

  // root -> lean (rolls about the contact line, y = 0) -> model
  const root = new Group(), lean = new Group(), spinners: Group[] = [];
  root.add(lean);
  for (const z of [WHEEL_Z, -WHEEL_Z]) { // hubless wheels: a wide glowing tyre band and a thin inner ring
    const spin = new Group(); spin.position.set(0, WHEEL_R, z);
    const rim = new Mesh(new TorusGeometry(WHEEL_R, RIM_TUBE, 10, 64), rings); rim.rotation.y = Math.PI / 2; rim.scale.z = RIM_W;
    const inner = new Mesh(new TorusGeometry(INNER_R, 0.015, 6, 48), rings); inner.rotation.y = Math.PI / 2;
    spin.add(rim, inner);
    for (let k = 0; k < 3; k++) { // 3 white dashes bridging inner ring and rim, so the spin shows
      const a = (k * 2 * Math.PI) / 3, rr = (INNER_R + WHEEL_R - RIM_TUBE) / 2;
      const d = glow(new BoxGeometry(0.2, 0.08, 0.03), glowMat(WHITE), 0, Math.cos(a) * rr, Math.sin(a) * rr);
      d.rotation.x = a; spin.add(d); // long axis radial
    }
    lean.add(spin); spinners.push(spin);
  }
  // shell: wraps each wheel's centre, low belly between them, spine dips at the cockpit and humps over the rear
  lean.add(solid(profile([
    ...arc(WHEEL_Z, -70, 110), [0.35, 0.55], [-0.1, 0.6], [-0.4, 0.68], ...arc(-WHEEL_Z, 70, 250),
  ], SHELL_W, BEVEL)));
  lean.add(solid(profile([[-0.15, 0.62], [-0.6, 0.95], [-0.62, 0.66]], 0.06))); // dorsal fin: up / roll

  const chev = new Shape(); // deck chevron, tip forward: heading
  chev.moveTo(0, 0.25); chev.lineTo(0.15, 0); chev.lineTo(0.07, 0); chev.lineTo(0, 0.12); chev.lineTo(-0.07, 0); chev.lineTo(-0.15, 0);
  chev.closePath();
  const ch = new Mesh(new ExtrudeGeometry(chev, { depth: 0.01, bevelEnabled: false }), glowMat(WHITE));
  ch.rotation.x = -Math.PI / 2; ch.position.set(0, 0.66, 0.35);
  const under = new Mesh(new PlaneGeometry(0.45, 1.8), ghost ? ghostMesh : new MeshBasicMaterial({ // underglow: seen only from below
    color: UNDER, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = 0.12;
  // full-width tail stripe on the shell's back slope, tilted to face back and up at the chase camera
  const tail = glow(new BoxGeometry(SHELL_W + 2 * BEVEL, 0.06, 0.03), tailMat, 0, 0.535, -1.05);
  tail.rotation.x = Math.PI / 6;
  lean.add(ch, under, glow(new BoxGeometry(0.4, 0.08, 0.05), glowMat(WHITE), 0, 0.4, 1.08), tail);

  return { root, lean, spinners, edges, rings, tail, tailMat };
}

export function createBikeModels(reg: (m: LineMaterial) => void) {
  const b = build(false, reg), ghost = build(true, reg);
  let spinRate = 0, angle = 0, prevLat = 0;
  const edgeC = new Color(EDGE), cyan = new Color(CYAN), white = new Color(WHITE), tailC = new Color(TAIL), flareC = new Color(TAIL_FLARE);
  const prevFwd = new Vector3(0, 0, 1), fwd = new Vector3(), up = new Vector3();

  return {
    bike: b.root,
    ghostBike: ghost.root, // static: no spin, no lean, no Boost glow
    update(st: BikeState, frame: number) {
      if (st.mode === 'track') spinRate = (TOP_SPIN * st.speed) / TUNING.topSpeed; // Airborne: keep take-off spin
      angle = (angle + spinRate * frame) % (2 * Math.PI);
      for (const s of b.spinners) s.rotation.x = angle; // +x rotation rolls the top of the wheel forward

      // lean into the sideways acceleration (to the right is +): yaw rate × speed plus the change in sideways speed.
      // ponytail: render-only estimate from frame-to-frame diffs; the smoothing hides frames with no physics step
      fwd.set(0, 0, 1).applyQuaternion(st.quat); up.set(0, 1, 0).applyQuaternion(st.quat);
      const turnRight = frame > 0 ? -prevFwd.cross(fwd).dot(up) / frame : 0;
      const aRight = st.speed * turnRight + (frame > 0 ? (st.latVel - prevLat) / frame : 0);
      prevFwd.copy(fwd); prevLat = st.latVel;
      const want = st.mode === 'track' ? Math.max(-1, Math.min(1, aRight / LEAN_ACC)) * MAX_LEAN : 0;
      b.lean.rotation.z += (want - b.lean.rotation.z) * (1 - Math.exp(-LEAN_RATE * frame)); // +z roll tips the top to the right (-x)

      const k = st.boostT > 0 ? Math.min(1, st.boostT / BOOST_FADE) : 0; // fades over Boost's last 0.3 s
      b.edges.color.lerpColors(edgeC, cyan, k); b.rings.color.lerpColors(cyan, white, k * 0.8); // Boost lights the body up
      b.tailMat.color.lerpColors(tailC, flareC, k); b.tail.scale.setScalar(1 + k);
    },
  };
}
