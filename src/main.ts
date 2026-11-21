import { WebGLRenderer } from 'three';
import { newState, respawn, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { createChaseCamera } from './camera';
import { drawHud } from './hud';
import { onRespawn, readInput } from './input';
import { createBloom, createScene } from './render/scene';
import { bakeTrack } from './track/bake';
import { CHECKPOINT_CPS, CPS, GAP_SEGMENTS, HALF_WIDTH } from './track/layout';

const T = bakeTrack(CPS, GAP_SEGMENTS, CHECKPOINT_CPS, HALF_WIDTH);
const st = newState(T);
const { scene, bike, trail, resizeLines } = createScene(T);
const { camera, update: updateCamera } = createChaseCamera();
const msgEl = document.getElementById('msg')!;
onRespawn(() => respawn(st, T, TUNING, 'Respawn'));

const renderer = new WebGLRenderer({ antialias: true });
// ponytail: pixel ratio capped at 2 since bloom runs at full resolution; drop to 1 or render bloom at half size if a dense screen misses 60 fps.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const bloom = createBloom(renderer, scene, camera);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  bloom.resize(innerWidth, innerHeight);
  resizeLines(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// Fixed 120 Hz physics; render smooths orientation only.
const DT = 1 / 120, shownQuat = st.quat.clone();
let trailRespawns = -1; // respawn count the trail last saw: -1 starts it fresh at the Bike
let acc = 0, last = performance.now(), snap = true, seenRespawns = 0;
renderer.setAnimationLoop(now => {
  const frame = Math.min(0.1, (now - last) / 1000); last = now; acc += frame;
  const inp = readInput();
  while (acc >= DT) {
    step(st, inp, TUNING, T, DT); acc -= DT;
    trail.update(st.pos, st.quat, st.respawns !== trailRespawns); // also catches an R-key respawn between steps
    trailRespawns = st.respawns;
  }
  if (st.respawns !== seenRespawns) { seenRespawns = st.respawns; snap = true; }
  msgEl.textContent = st.msgT > 0 ? st.msg : '';
  drawHud(st);
  if (snap) shownQuat.copy(st.quat); else shownQuat.slerp(st.quat, 1 - Math.exp(-20 * frame));
  bike.position.copy(st.pos); bike.quaternion.copy(shownQuat);
  updateCamera(st, shownQuat, frame, snap);
  snap = false;
  bloom.render();
});
