import { WebGLRenderer } from 'three';
import { newState, respawn, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { setMusic, sfx, updateEngine } from './audio';
import { MENU_SONG } from './audio/songs';
import { createChaseCamera } from './camera';
import { createGhost, migrateOldGhost } from './ghost';
import { drawCenter, drawHud, lapBanner } from './hud';
import { onRespawn, readInput } from './input';
import { css } from './render/palette';
import { createBloom, createScene } from './render/scene';
import { bakeTrack } from './track/bake';
import { TRACKS } from './track/tracks';
import { createMenu } from './ui/menu';
import { DEFAULT_LAPS, LAP_OPTIONS } from './ui/menuState';

let storage: Storage | null = null;
try { storage = localStorage; } catch { /* blocked: High scores and Ghosts live in memory only */ }
migrateOldGhost(storage, TRACKS[0].id); // the best Lap from before Tracks belongs to Overdrive

// Every Track's world is built at boot, with High scores and a Ghost per lap count; picking a Track swaps which one
// is drawn and ridden.
const worlds = TRACKS.map(track => {
  const T = bakeTrack(track);
  const ghosts = Object.fromEntries(LAP_OPTIONS.map(n => [n, createGhost(storage, track.id, n)]));
  return { track, T, ...createScene(T, track.palette), ghosts };
});
let w = worlds[0], laps = DEFAULT_LAPS;
const ghost = () => w.ghosts[laps];
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const st = newState(w.T);
const { camera, update: updateCamera } = createChaseCamera();
const msgEl = document.getElementById('msg')!;

const renderer = new WebGLRenderer({ antialias: true });
// ponytail: pixel ratio capped at 2 since bloom runs at full resolution; drop to 1 or render bloom at half size if a dense screen misses 60 fps.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const bloom = createBloom(renderer, w.scene, camera);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  bloom.resize(innerWidth, innerHeight);
  for (const x of worlds) x.resizeLines(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// A run: a 3-2-1 countdown at the line, `laps` Laps, then the Finish screen. Physics only steps while racing and no
// screen is open, so the clock and the Ghost both start on GO, and Pause freezes everything.
const COUNTDOWN = 3;
let phase: 'countdown' | 'racing' | 'finished' = 'countdown', countT = COUNTDOWN, goT = 0;
let prevBest = ghost().bestTime;
let split: number | null = null, splitT = 0;
let banner = '', bannerT = 0, lapsShown = 0; // the Lap banner, and how many of the run's Laps it has announced

function retry() {
  Object.assign(st, newState(w.T));
  ghost().restart();
  w.trail.update(st.pos, st.quat, true, false);
  phase = 'countdown'; countT = COUNTDOWN; split = null; bannerT = 0; lapsShown = 0; snap = true;
}
function selectTrack(i: number, n: number) {
  w = worlds[i]; laps = n;
  bloom.setScene(w.scene);
  retry();
}
function finish() {
  phase = 'finished';
  const lapTimes = ghost().lastRun!, time = sum(lapTimes);
  menu.open('finish', { time, lapTimes, delta: prevBest === null ? null : time - prevBest, rank: ghost().lastRank });
}

const menu = createMenu(document.getElementById('ui')!, worlds.map(x => ({
  name: x.track.name, kind: x.track.kind,
  colors: [css(x.track.palette.primary), css(x.track.palette.secondary)],
  outline: x.T.pos.map((p, i) => ({ x: p.x, z: p.z, gap: x.T.gap[i] })),
  scores: n => x.ghosts[n].scores,
})), effect => {
  if (effect === 'resume') return;
  if (effect === 'restart' || effect === 'endRun') return retry();
  if ('start' in effect) return selectTrack(effect.start, effect.laps);
  for (const x of effect.reset === 'all' ? worlds : [worlds[effect.reset]]) for (const g of Object.values(x.ghosts)) g.clear();
}, () => { if (phase !== 'finished') menu.open('pause', { raceTime: sum(ghost().run) + st.lapTime, lap: ghost().run.length + 1 }); });
menu.open('menu');

onRespawn(() => {
  if (menu.screen === 'finish') { retry(); menu.close(); }
  else if (!menu.screen && phase === 'racing') respawn(st, w.T, TUNING, 'Respawn');
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
  menu.tick(frame);
  const frozen = menu.screen !== null;
  if (phase === 'countdown' && !frozen && (countT -= frame) <= 0) { phase = 'racing'; goT = 0.7; prevBest = ghost().bestTime; }
  if (phase !== 'racing' || frozen) acc = 0; // nothing piles up to catch up on at GO or on Resume
  while (acc >= DT) {
    step(st, inp, TUNING, w.T, DT); acc -= DT;
    const s = ghost().record(st);
    if (s !== null) { split = s; splitT = 2; }
    const done = ghost().run.length; // a closed Lap that isn't the last: announce the next one
    if (done > lapsShown && done < laps) { banner = lapBanner(done + 1, laps, st.lastLap!, s); bannerT = 2.4; }
    lapsShown = done;
    w.trail.update(st.pos, st.quat, st.respawns !== trailRespawns, st.boostT > 0); // also catches an R-key respawn between steps
    trailRespawns = st.respawns;
    if (st.laps === laps) { finish(); break; }
  }
  if (st.respawns !== seenRespawns) { seenRespawns = st.respawns; snap = true; }

  // Sound: one-shots when state changes ('>' so a retry's reset to zero is silent).
  if (st.respawns > was.respawns) sfx.crash();
  else if (was.mode === 'air' && st.mode === 'track') sfx.land();
  if (st.boostT > was.boostT) sfx.boost();
  if (st.lastCP > was.lastCP) sfx.checkpoint();
  if (st.laps > was.laps) sfx.lap();
  was = { mode: st.mode, respawns: st.respawns, lastCP: st.lastCP, laps: st.laps, boostT: st.boostT };
  // The Menu Song covers the Menu screens; the Track's Song its countdown, race, Pause and Finish. Pause muffles it.
  const inMenu = menu.screen !== null && menu.screen !== 'pause' && menu.screen !== 'finish';
  setMusic(inMenu ? MENU_SONG : w.track.song, menu.screen === 'pause');
  updateEngine(phase === 'racing' && !frozen ? (st.mode === 'track' ? st.speed : st.vel.length()) : 0, st.mode === 'air');

  msgEl.textContent = st.msgT > 0 ? st.msg : '';
  goT -= frame; splitT -= frame; if (!frozen) bannerT -= frame;
  drawCenter(phase === 'countdown' ? `<div class="count">${Math.ceil(countT)}</div>` : goT > 0 ? '<div class="count">GO</div>'
    : bannerT > 0 ? banner : '');
  if (snap) shownQuat.copy(st.quat); else shownQuat.slerp(st.quat, 1 - Math.exp(-20 * frame));
  w.bike.position.copy(st.pos); w.bike.quaternion.copy(shownQuat); w.updateBike(st, frame);
  const run = ghost().run;
  drawHud(st, shownQuat, splitT > 0 ? split : null, { time: sum(run) + st.lapTime, lap: run.length + 1, laps, best: ghost().bestTime });
  w.ghostBike.visible = phase !== 'countdown' && ghost().pose(w.ghostBike.position, w.ghostBike.quaternion);
  updateCamera(st, shownQuat, frame, snap);
  snap = false;
  bloom.render();
});
