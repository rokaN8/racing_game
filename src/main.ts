import { WebGLRenderer } from 'three';
import { newState, respawn, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { sfx, updateEngine } from './audio';
import { createChaseCamera } from './camera';
import { createGhost } from './ghost';
import { delta, drawCenter, drawHud } from './hud';
import { onRespawn, readInput } from './input';
import { createBloom, createScene } from './render/scene';
import { bakeTrack } from './track/bake';
import { CHECKPOINT_CPS, CPS, GAP_SEGMENTS, HALF_WIDTH } from './track/layout';

const T = bakeTrack(CPS, GAP_SEGMENTS, CHECKPOINT_CPS, HALF_WIDTH);
const st = newState(T);
const { scene, bike, ghostBike, updateBike, trail, resizeLines } = createScene(T);
const { camera, update: updateCamera } = createChaseCamera();
const msgEl = document.getElementById('msg')!;
let storage: Storage | null = null;
try { storage = localStorage; } catch { /* blocked: the Ghost lives in memory only */ }
const ghost = createGhost(storage);
st.best = ghost.bestTime; // the HUD's best survives a reload with the Ghost

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

// A run: a 3-2-1 countdown at the line, one Lap, then the finish screen until R / Y retries.
// Physics only steps while racing, so the clock and the Ghost both start on GO.
const COUNTDOWN = 3;
let phase: 'countdown' | 'racing' | 'finished' = 'countdown', countT = COUNTDOWN, goT = 0;
let prevBest = st.best, finishHtml = '';
let split: number | null = null, splitT = 0;

function retry() {
  Object.assign(st, newState(T), { best: st.best });
  ghost.reset();
  trail.update(st.pos, st.quat, true);
  phase = 'countdown'; countT = COUNTDOWN; split = null; snap = true;
}
function finish() {
  phase = 'finished';
  const d = prevBest === null ? null : st.lastLap! - prevBest;
  finishHtml = `<div class="time">${st.lastLap!.toFixed(2)} s</div>`
    + `<div class="delta">${d === null ? 'NEW BEST' : `${delta(d)}${d < 0 ? ' · NEW BEST' : ''}`}</div>`
    + '<div class="hint">R / Y to retry</div>';
}
onRespawn(() => {
  if (phase === 'finished') retry();
  else if (phase === 'racing') respawn(st, T, TUNING, 'Respawn');
});

// Fixed 120 Hz physics; render smooths orientation only.
const DT = 1 / 120, shownQuat = st.quat.clone();
let trailRespawns = -1; // respawn count the trail last saw: -1 starts it fresh at the Bike
let acc = 0, last = performance.now(), snap = true, seenRespawns = 0;
// Last frame's state, to spot sound events.
let was = { mode: st.mode, respawns: st.respawns, lastCP: st.lastCP, laps: st.laps, boostT: st.boostT };
renderer.setAnimationLoop(now => {
  const frame = Math.min(0.1, (now - last) / 1000); last = now; acc += frame;
  const inp = readInput();
  if (phase === 'countdown' && (countT -= frame) <= 0) { phase = 'racing'; goT = 0.7; prevBest = st.best; }
  if (phase !== 'racing') acc = 0; // nothing piles up to catch up on at GO
  while (acc >= DT) {
    const laps = st.laps;
    step(st, inp, TUNING, T, DT); acc -= DT;
    const s = ghost.record(st);
    if (s !== null) { split = s; splitT = 2; }
    trail.update(st.pos, st.quat, st.respawns !== trailRespawns); // also catches an R-key respawn between steps
    trailRespawns = st.respawns;
    if (st.laps !== laps) { finish(); break; }
  }
  if (st.respawns !== seenRespawns) { seenRespawns = st.respawns; snap = true; }

  // Sound: one-shots when state changes ('>' so a retry's reset to zero is silent).
  if (st.respawns > was.respawns) sfx.crash();
  else if (was.mode === 'air' && st.mode === 'track') sfx.land();
  if (st.boostT > was.boostT) sfx.boost();
  if (st.lastCP > was.lastCP) sfx.checkpoint();
  if (st.laps > was.laps) sfx.lap();
  was = { mode: st.mode, respawns: st.respawns, lastCP: st.lastCP, laps: st.laps, boostT: st.boostT };
  updateEngine(phase === 'racing' ? (st.mode === 'track' ? st.speed : st.vel.length()) : 0, st.mode === 'air');

  msgEl.textContent = st.msgT > 0 ? st.msg : '';
  goT -= frame; splitT -= frame;
  drawCenter(phase === 'countdown' ? `<div class="count">${Math.ceil(countT)}</div>`
    : phase === 'finished' ? finishHtml : goT > 0 ? '<div class="count">GO</div>' : '');
  if (snap) shownQuat.copy(st.quat); else shownQuat.slerp(st.quat, 1 - Math.exp(-20 * frame));
  bike.position.copy(st.pos); bike.quaternion.copy(shownQuat); updateBike(st, frame);
  drawHud(st, shownQuat, splitT > 0 ? split : null);
  ghostBike.visible = phase !== 'countdown' && ghost.pose(ghostBike.position, ghostBike.quaternion);
  updateCamera(st, shownQuat, frame, snap);
  snap = false;
  bloom.render();
});
