import { WebGLRenderer } from 'three';
import { newState, respawn, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { createChaseCamera } from './camera';
import { readInput } from './input';
import { createScene } from './render/scene';
import { bakeTrack } from './track/bake';
import { CPS, HALF_WIDTH } from './track/layout';

const T = bakeTrack(CPS, HALF_WIDTH);
const st = newState(T);
const { scene, bike } = createScene(T);
const { camera, update: updateCamera } = createChaseCamera();
const msgEl = document.getElementById('msg')!;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
document.body.prepend(renderer.domElement);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// Fixed 120 Hz physics; render smooths orientation only.
const DT = 1 / 120, shownQuat = st.quat.clone();
let acc = 0, last = performance.now(), snap = true, msgT = 0;
renderer.setAnimationLoop(now => {
  const frame = Math.min(0.1, (now - last) / 1000); last = now; acc += frame;
  const inp = readInput();
  while (acc >= DT) { step(st, inp, TUNING, T, DT); acc -= DT; }
  // ponytail: no Airborne in M1, so detaching drops the Bike back at the start line.
  if (st.mode === 'air') { msgEl.textContent = st.msg; msgT = 1.5; respawn(st, T); snap = true; }
  if ((msgT -= frame) <= 0) msgEl.textContent = '';
  if (snap) shownQuat.copy(st.quat); else shownQuat.slerp(st.quat, 1 - Math.exp(-20 * frame));
  bike.position.copy(st.pos); bike.quaternion.copy(shownQuat);
  updateCamera(st, shownQuat, frame, snap);
  snap = false;
  renderer.render(scene, camera);
});
