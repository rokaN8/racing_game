// Hybrid chase camera (prototype preset C): rolls with the Bike on the Track, levels to world up
// and follows the flight path when Airborne, snaps on respawn.
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { BikeState } from './bike/physics';

const DIST = 9, HEIGHT = 3, LOOK_AHEAD = 8, FOV = 102, STIFFNESS = 8;

export function createChaseCamera() {
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 3000);
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
  }

  return { camera, update };
}
