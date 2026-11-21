// Bike and Ghost Bike models (docs/poc-spec.md → M7: Bike look), wheel spin and Boost glow.
// Bike local: +z forward, +y up, +x left; Track surface at y = 0.
import {
  AdditiveBlending, BoxGeometry, Color, CylinderGeometry, DoubleSide, EdgesGeometry, ExtrudeGeometry, Group, Mesh,
  MeshBasicMaterial, PlaneGeometry, Shape, TorusGeometry, type BufferGeometry,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { BikeState } from '../bike/physics';
import { TUNING } from '../bike/tuning';

const CYAN = 0x00ffff, WHITE = 0xffffff, TAIL = 0xff4a10, TAIL_FLARE = 0xffc0a0, UNDER = 0xff7a00;
const FILL = 0x040a14; // below the bloom threshold: the body never glows, only its edges and cues
const WHEEL_R = 0.36, WHEEL_Z = 0.72;
const TOP_SPIN = 2 * Math.PI * 4; // rad/s shown at top speed; the true rolling rate (~24 turns/s) strobes at 60 fps
const BOOST_FADE = 0.3; // s

export const TRAIL_ANCHOR = { y: 0.4, z: -1.05 }; // Light trail start, Bike-local

// side profile in (z, y), extruded across the Bike's width
function profile(pts: [number, number][], width: number) {
  const s = new Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath();
  const g = new ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); // shape x -> Bike z, extrude -> Bike x
  return g;
}

function build(ghost: boolean, reg: (m: LineMaterial) => void) {
  const ghostMesh = new MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0.15, depthWrite: false });
  const glowMat = (color: number) => (ghost ? ghostMesh : new MeshBasicMaterial({ color }));
  const fill = ghost ? ghostMesh
    : new MeshBasicMaterial({ color: FILL, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edges = new LineMaterial(ghost ? { color: WHITE, linewidth: 2, transparent: true, opacity: 0.35, depthWrite: false }
    : { color: CYAN, linewidth: 2 }); // linewidth in pixels
  reg(edges);
  const rings = glowMat(CYAN), tailMat = glowMat(TAIL);

  // solid dark body with thick neon edges, so hidden lines stay hidden
  const solid = (geo: BufferGeometry) => {
    const g = new Group();
    g.add(new Mesh(geo, fill), new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(new EdgesGeometry(geo, 25)), edges));
    return g;
  };
  const glow = (geo: BufferGeometry, mat: MeshBasicMaterial, x: number, y: number, z: number) => {
    const m = new Mesh(geo, mat); m.position.set(x, y, z); return m;
  };

  const root = new Group(), spinners: Group[] = [];
  for (const z of [WHEEL_Z, -WHEEL_Z]) {
    const spin = new Group(); spin.position.set(0, WHEEL_R, z);
    const ring = new Mesh(new TorusGeometry(WHEEL_R, 0.045, 8, 48), rings); ring.rotation.y = Math.PI / 2;
    const hub = solid(new CylinderGeometry(WHEEL_R * 0.55, WHEEL_R * 0.55, 0.12, 20)); hub.rotation.z = Math.PI / 2;
    spin.add(ring, hub);
    for (let k = 0; k < 3; k++) for (const x of [0.065, -0.065]) { // 3 dashes per hub side, so the spin shows
      const a = (k * 2 * Math.PI) / 3, rr = WHEEL_R * 0.35;
      const d = glow(new BoxGeometry(0.01, 0.1, 0.03), glowMat(WHITE), x, Math.cos(a) * rr, Math.sin(a) * rr);
      d.rotation.x = a; spin.add(d); // long axis radial
    }
    root.add(spin); spinners.push(spin);
  }
  root.add(solid(profile([[-1.0, 0.28], [-0.9, 0.55], [0.9, 0.5], [1.05, 0.35], [0.6, 0.22], [-0.6, 0.22]], 0.4)));
  root.add(solid(profile([[-0.85, 0.55], [-0.75, 1.0], [-0.1, 0.52]], 0.04))); // dorsal fin: up / roll

  const chev = new Shape(); // deck chevron, tip forward: heading
  chev.moveTo(0, 0.25); chev.lineTo(0.15, 0); chev.lineTo(0.07, 0); chev.lineTo(0, 0.12); chev.lineTo(-0.07, 0); chev.lineTo(-0.15, 0);
  chev.closePath();
  const ch = new Mesh(new ExtrudeGeometry(chev, { depth: 0.01, bevelEnabled: false }), glowMat(WHITE));
  ch.rotation.x = -Math.PI / 2; ch.position.set(0, 0.53, 0.45);
  const under = new Mesh(new PlaneGeometry(0.45, 1.6), ghost ? ghostMesh : new MeshBasicMaterial({ // underglow: seen only from below
    color: UNDER, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = 0.2;
  const tail = glow(new BoxGeometry(0.3, 0.08, 0.05), tailMat, 0, 0.48, -1.02);
  root.add(ch, under, glow(new BoxGeometry(0.25, 0.08, 0.05), glowMat(WHITE), 0, 0.43, 1.06), tail);

  return { root, spinners, edges, rings, tail, tailMat };
}

export function createBikeModels(reg: (m: LineMaterial) => void) {
  const b = build(false, reg), ghost = build(true, reg);
  let spinRate = 0, angle = 0;
  const cyan = new Color(CYAN), white = new Color(WHITE), tailC = new Color(TAIL), flareC = new Color(TAIL_FLARE);

  return {
    bike: b.root,
    ghostBike: ghost.root, // static: no spin, no Boost glow
    update(st: BikeState, frame: number) {
      if (st.mode === 'track') spinRate = (TOP_SPIN * st.speed) / TUNING.topSpeed; // Airborne: keep take-off spin
      angle = (angle + spinRate * frame) % (2 * Math.PI);
      for (const s of b.spinners) s.rotation.x = angle; // +x rotation rolls the top of the wheel forward

      const k = st.boostT > 0 ? Math.min(1, st.boostT / BOOST_FADE) : 0; // fades over Boost's last 0.3 s
      b.edges.color.lerpColors(cyan, white, k * 0.8); b.rings.color.lerpColors(cyan, white, k * 0.8);
      b.tailMat.color.lerpColors(tailC, flareC, k); b.tail.scale.setScalar(1 + k);
    },
  };
}
