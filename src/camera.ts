// Hybrid chase camera (prototype preset C): rolls with the Bike on the Track, levels to world up
// and follows the flight path when Airborne, snaps on respawn. Widens its FOV while Boosting, for the rush of speed.
// After the line, the Finish cam: it eases from where Chase was into a slow orbit of the Bike (docs/game-spec.md →
// Finish cam).
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { BikeState } from './bike/physics';

const DIST = 9, HEIGHT = 3, LOOK_AHEAD = 8, FOV = 102, BOOST_FOV_ADD = 12, FOV_RATE = 5, STIFFNESS = 8;
export const ORBIT = { R: 14, H: 4, RATE: 0.15, BLEND: 1.5 }; // m, m up, rad/s (~40 s a turn), s to ease in

export function createChaseCamera() {
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 3000);
  let base = FOV; // Settings → Field of view
  const smUp = new Vector3(0, 1, 0);

  // shownQuat: the Bike's displayed (smoothed) orientation. snap: jump straight to the target.
  function update(st: BikeState, shownQuat: Quaternion, frame: number, snap: boolean) {
    const air = st.mode === 'air';
    const bup = new Vector3(0, 1, 0).applyQuaternion(shownQuat);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(shownQuat);
    if (air && st.vel.lengthSq() > 1) fwd.copy(st.vel).normalize();
    const camUp = air ? new Vector3(0, 1, 0) : bup;
    const want = st.pos.clone().addScaledVector(fwd, -DIST).addScaledVector(camUp, HEIGHT);
    const k = snap ? 1 : 1 - Math.exp(-STIFFNESS * frame);
    camera.position.lerp(want, k); smUp.lerp(camUp, k).normalize(); camera.up.copy(smUp);
    camera.lookAt(st.pos.clone().addScaledVector(fwd, LOOK_AHEAD).addScaledVector(camUp, 1));
    const fov = st.boostT > 0 ? base + BOOST_FOV_ADD : base;
    camera.fov = snap ? fov : camera.fov + (fov - camera.fov) * (1 - Math.exp(-FOV_RATE * frame));
    camera.updateProjectionMatrix();
  }

  // The Finish cam, each frame while the Finish screen is up: from Chase's last position into an orbit of the Bike,
  // starting at Chase's angle round it. still (reduced motion): hold Chase's view instead. Any chase update ends it.
  let orbitT = -1;
  const from = new Vector3(), at = new Vector3();
  function orbit(st: BikeState, frame: number, still: boolean) {
    if (orbitT < 0) { orbitT = 0; from.copy(camera.position); }
    if (still) return;
    orbitT += frame;
    const th = Math.atan2(from.x - st.pos.x, from.z - st.pos.z) + ORBIT.RATE * orbitT;
    at.set(st.pos.x + Math.sin(th) * ORBIT.R, st.pos.y + ORBIT.H, st.pos.z + Math.cos(th) * ORBIT.R);
    const k = Math.min(1, orbitT / ORBIT.BLEND);
    camera.position.lerpVectors(from, at, k * k * (3 - 2 * k)); // smoothstep: no jolt either end
    camera.up.set(0, 1, 0); camera.lookAt(st.pos);
  }
  const chase = (...a: Parameters<typeof update>) => { orbitT = -1; update(...a); };

  return { camera, update: chase, orbit, setFov: (deg: number) => { base = deg; } };
}
