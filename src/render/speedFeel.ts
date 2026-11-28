// Speed feel (docs/game-spec.md → Speed feel): render and camera only, no physics. Streaks rush past the camera while
// Boosting; the camera shakes on a Sketchy landing or a crash; the picture splits its colours near Boost top speed.
// Reduced motion (the OS setting): no shake, no colour split, streaks at half brightness.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, type PerspectiveCamera, type Scene } from 'three';
import type { BikeState } from '../bike/physics';
import { TUNING } from '../bike/tuning';

const STREAKS = 120, BRIGHT = 0.6, LEN = 6, NEAR = 4, FAR = 70; // a tube of cyan lines round the view axis, 2.5-8.5 m out
const SHAKE = 0.12, SHAKE_T = 0.3, CRASH_SHAKE = 1.6;          // m, s; a crash shakes 1.6× as hard
const SPLIT = 0.0025, SPLIT_FROM = 60;                          // the colour split, full at Boost top speed (75 m/s)

export type Hit = 'sketchy' | 'crash';

export function createSpeedFeel() {
  const pts = new Float32Array(STREAKS * 6), cols = new Float32Array(STREAKS * 6);
  const seeds = Array.from({ length: STREAKS }, () => ({ a: Math.random() * Math.PI * 2, r: 2.5 + Math.random() * 6, z: -NEAR - Math.random() * (FAR - NEAR) }));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pts, 3)); geo.setAttribute('color', new BufferAttribute(cols, 3));
  const lines = new LineSegments(geo, new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending, depthWrite: false, transparent: true }));
  lines.frustumCulled = false;
  const rig = new Group(); rig.add(lines); // follows the camera
  let level = 0, shakeT = 0, shakeAmp = 0;

  // Each frame, after the chase camera's update. hit: a Sketchy landing or a crash this frame. Returns the colour split.
  function update(scene: Scene, camera: PerspectiveCamera, st: BikeState, frame: number, hit: Hit | null, reduced: boolean) {
    if (rig.parent !== scene) scene.add(rig);
    rig.position.copy(camera.position); rig.quaternion.copy(camera.quaternion);
    const speed = st.mode === 'track' ? st.speed : st.vel.length();
    level += ((st.boostT > 0 ? 1 : 0) - level) * (1 - Math.exp(-6 * frame)); // eases in and out with Boost
    const bright = BRIGHT * level * (reduced ? 0.5 : 1);
    for (let i = 0; i < STREAKS; i++) {
      const s = seeds[i];
      s.z += speed * frame * 1.5; if (s.z > -NEAR) s.z -= FAR - NEAR;
      const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, k = bright * (1 - (-s.z - NEAR) / (FAR - NEAR));
      pts.set([x, y, s.z, x, y, s.z - LEN], i * 6);
      cols.set([0, k, k, 0, k * 0.2, k * 0.2], i * 6); // cyan head fading to the tail
    }
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    rig.visible = level > 0.01;
    if (reduced) return 0;
    if (hit) { shakeT = SHAKE_T; shakeAmp = SHAKE * (hit === 'crash' ? CRASH_SHAKE : 1); }
    if (shakeT > 0) {
      shakeT -= frame;
      const a = shakeAmp * Math.max(0, shakeT / SHAKE_T);
      camera.position.x += (Math.random() - 0.5) * a; camera.position.y += (Math.random() - 0.5) * a; camera.position.z += (Math.random() - 0.5) * a;
    }
    return SPLIT * level * Math.min(1, Math.max(0, (speed - SPLIT_FROM) / (TUNING.topSpeed + TUNING.boostSpeed - SPLIT_FROM)));
  }
  return { update };
}
