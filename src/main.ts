import { WebGLRenderer } from 'three';
import { newState, respawn, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { createChaseCamera } from './camera';
import { onRespawnKey, readInput } from './input';
import { createScene } from './render/scene';
import { bakeTrack } from './track/bake';
import { CHECKPOINT_CPS, CPS, GAP_SEGMENTS, HALF_WIDTH } from './track/layout';

const T = bakeTrack(CPS, GAP_SEGMENTS, CHECKPOINT_CPS, HALF_WIDTH);
const st = newState(T);
const { scene, bike } = createScene(T);
const { camera, update: updateCamera } = createChaseCamera();
const msgEl = document.getElementById('msg')!, lapEl = document.getElementById('lap')!;
onRespawnKey(() => respawn(st, T, TUNING, 'Respawn'));

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
let acc = 0, last = performance.now(), snap = true, seenRespawns = 0;
// ponytail: Lap timer only; the full HUD is M3.
const fmt = (t: number | null) => (t === null ? '—' : t.toFixed(2));
renderer.setAnimationLoop(now => {
  const frame = Math.min(0.1, (now - last) / 1000); last = now; acc += frame;
  const inp = readInput();
  while (acc >= DT) { step(st, inp, TUNING, T, DT); acc -= DT; }
  if (st.respawns !== seenRespawns) { seenRespawns = st.respawns; snap = true; }
  msgEl.textContent = st.msgT > 0 ? st.msg : '';
  lapEl.textContent = `${fmt(st.lapTime)} · last ${fmt(st.lastLap)} · best ${fmt(st.best)}`;
  if (snap) shownQuat.copy(st.quat); else shownQuat.slerp(st.quat, 1 - Math.exp(-20 * frame));
  bike.position.copy(st.pos); bike.quaternion.copy(shownQuat);
  updateCamera(st, shownQuat, frame, snap);
  snap = false;
  renderer.render(scene, camera);
});
