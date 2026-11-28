import { WebGLRenderer } from 'three';
import { launchAtGo, newState, respawn, step } from './bike/physics';
import { TUNING } from './bike/tuning';
import { beat, setMusic, sfx, updateEngine } from './audio';
import { MENU_SONG } from './audio/songs';
import { createChaseCamera } from './camera';
import { createGhost, migrateOldGhost, pilotRun, type Recording } from './ghost';
import { openGhostStore } from './ghostStore';
import { drawCenter, drawHud, drawMap, lapBanner } from './hud';
import { onGhostLine, onRespawn, readInput, rumble, stopRumble } from './input';
import { createGhostLine, toggleGhostLine } from './render/ghostLine';
import { css } from './render/palette';
import { createExplosion, EXPLOSION_T } from './render/explosion';
import { createBloom, createScene } from './render/scene';
import { createSpeedFeel, type Hit } from './render/speedFeel';
import { bakeTrack } from './track/bake';
import { TRACKS } from './track/tracks';
import { createMenu } from './ui/menu';
import { DEFAULT_LAPS, LAP_OPTIONS } from './ui/menuState';

let storage: Storage | null = null, idb: IDBFactory | null = null;
try { storage = localStorage; } catch { /* blocked: High scores live in memory only */ }
try { idb = indexedDB; } catch { /* Firefox before 127 throws here when blocked: Ghosts live in memory only */ }
const ghostStore = openGhostStore(idb);
migrateOldGhost(storage, TRACKS[0].id); // the best Lap from before Tracks belongs to Overdrive

// Every Track's world is built at boot, with High scores and a Ghost per lap count; picking a Track swaps which one
// is drawn and ridden. Its Ghosts load from the Ghost store when a run on it first starts (selectTrack). The Pilot
// Ghost's runs are only built once a run needs one (pilots, per lap count).
const worlds = TRACKS.map(track => {
  const T = bakeTrack(track);
  const ghosts = Object.fromEntries(LAP_OPTIONS.map(n => [n, createGhost(storage, { id: track.id, L: T.L, cpS: T.cpS }, n, Date.now, ghostStore)]));
  const outline = { // the top-down outline, for Track select and the minimap
    colors: [css(track.palette.primary), css(track.palette.secondary)] as [string, string],
    outline: T.pos.map((p, i) => ({ x: p.x, z: p.z, gap: T.gap[i] })), checkpoints: T.cpS.map(s => Math.round(s / T.ds)),
  };
  return { track, T, ...createScene(T, track.palette), ghosts, outline, pilots: {} as Record<number, Generator<void, Recording>> };
});
let w = worlds[0], laps = DEFAULT_LAPS;
const ghost = () => w.ghosts[laps];
const ghostLine = createGhostLine(); // docs/game-spec.md → Ghost line
onGhostLine(toggleGhostLine);
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const st = newState(w.T);
const { camera, update: updateCamera, orbit: finishCam } = createChaseCamera();
const speedFeel = createSpeedFeel();
let hit: Hit | null = null; // this frame's Sketchy landing or crash, for the shake
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
let heldFor: number | null = null; // how long the current throttle press has been held in the countdown (Rocket start)
let prevBest = ghost().bestTime;
let split: number | null = null, splitT = 0;
let liveGap: number | null = null, liveGapT = 0; // the live gap to the Ghost, read 10x a second
let banner = '', bannerT = 0, lapsShown = 0; // the Lap banner, and how many of the run's Laps it has announced

function retry() {
  Object.assign(st, newState(w.T));
  ghost().restart();
  w.trail.update(st.pos, st.quat, true, false);
  phase = 'countdown'; countT = COUNTDOWN; heldFor = null; split = null; liveGap = null; liveGapT = 0; bannerT = 0; lapsShown = 0; snap = true; wreckT = 0;
}
// The Pilot Ghost, while there's no Ghost of your own at this Track and lap count. Its run is built from the first run
// that needs it, from its countdown, `ms` a frame (a 5-Lap run is ~30,000 physics steps), so it never drops a frame.
function buildPilot(ms: number) {
  if (!ghost().needsPilot) return;
  const run = (w.pilots[laps] ??= pilotRun(w.T, w.track.pilot, laps));
  for (const end = performance.now() + ms; ;) {
    const r = run.next();
    if (r.done) return ghost().setPilot(r.value);
    if (performance.now() >= end) return;
  }
}
function selectTrack(i: number, n: number) {
  w = worlds[i]; laps = n;
  for (const g of Object.values(w.ghosts)) void g.load(); // once a session; the countdown covers the read
  bloom.setScene(w.scene);
  retry();
}
function finish() {
  phase = 'finished';
  const lapTimes = ghost().lastRun!, time = sum(lapTimes);
  menu.open('finish', { time, lapTimes, delta: prevBest === null ? null : time - prevBest, rank: ghost().lastRank });
}

const menu = createMenu(document.getElementById('ui')!, worlds.map(x => ({
  name: x.track.name, kind: x.track.kind, ...x.outline, pilotTimes: x.track.pilotTimes,
  scores: n => x.ghosts[n].scores, ideal: n => x.ghosts[n].idealTime,
})), effect => {
  if (effect === 'resume') return;
  if (effect === 'restart' || effect === 'endRun') return retry();
  if ('start' in effect) return selectTrack(effect.start, effect.laps);
  for (const x of effect.reset === 'all' ? worlds : [worlds[effect.reset]]) for (const g of Object.values(x.ghosts)) g.clear();
}, pause);
menu.open('menu');
// Pause (Esc / Start), and leaving the game mid-run: a hidden tab or the window losing focus (docs/game-spec.md →
// Screens). Already on a screen, nothing changes. Stops any rumble, as no frame may come to do it while hidden.
function pause() {
  if (menu.screen || phase === 'finished') return;
  menu.open('pause', { raceTime: sum(ghost().run) + st.lapTime, lap: ghost().run.length + 1 });
  stopRumble();
}
addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('blur', pause);

onRespawn(() => {
  if (menu.screen === 'finish') { retry(); menu.close(); }
  else if (!menu.screen && phase === 'racing') respawn(st, w.T, TUNING, 'Respawn');
});

// Fixed 120 Hz physics; render smooths orientation only.
const DT = 1 / 120, shownQuat = st.quat.clone();
let trailRespawns = -1; // respawn count the trail last saw: -1 starts it fresh at the Bike
let acc = 0, last = performance.now(), snap = true, seenRespawns = 0;
// A crash plays the explosion where the Bike was, with the Bike hidden, the camera held and physics paused (so it
// costs no race time); then the camera snaps to the respawn as before.
const boom = createExplosion();
let wreckT = 0;
// Last frame's state, to spot sound and rumble events.
let was = { mode: st.mode, respawns: st.respawns, lastCP: st.lastCP, laps: st.laps, boostT: st.boostT, padHits: st.padHits };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
renderer.setAnimationLoop(now => {
  const frame = Math.min(0.1, (now - last) / 1000); last = now; acc += frame;
  const inp = readInput();
  menu.tick(frame);
  const frozen = menu.screen !== null;
  // Rocket start (docs/game-spec.md → Rocket start): time the current throttle press through the countdown, judge it at GO
  if (phase === 'countdown' && !frozen) heldFor = inp.throttle > 0.5 ? (heldFor ?? 0) + frame : null;
  if (phase === 'countdown' && !frozen && (countT -= frame) <= 0) {
    phase = 'racing'; goT = 0.7; prevBest = ghost().bestTime;
    const go = launchAtGo(st, heldFor);
    if (go === 'rocket') { sfx.boost(); sfx.perfect(); rumble(1, 1, 120); }
    if (go === 'stall') { sfx.stall(); rumble(0.6, 0, 200); }
    if (go) { msgEl.classList.remove('pop'); void msgEl.offsetWidth; msgEl.classList.add('pop'); }
  }
  if (!frozen) buildPilot(phase === 'racing' ? Infinity : 4); // done by GO on any sane machine; if not, finished outright
  if (phase !== 'racing' || frozen || wreckT > 0) acc = 0; // nothing piles up to catch up on at GO, on Resume or after a crash
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
  // The live gap holds while Airborne (the distance doesn't move) and is read on the Track 10x a second, so it doesn't flicker.
  if (phase === 'racing' && st.mode === 'track' && (liveGapT -= frame) <= 0) { liveGap = ghost().liveGap(st); liveGapT = 0.1; }
  if (st.respawns !== seenRespawns) {
    if (st.respawns > seenRespawns) { // a crash, not a retry: the Bike still shows last frame's pose, the crash spot
      w.scene.add(boom.points); boom.start(w.bike.position, w.bike.quaternion); wreckT = EXPLOSION_T;
    }
    seenRespawns = st.respawns; snap = true;
  }
  if (!frozen) { wreckT -= frame; boom.update(frame); }
  const wrecked = wreckT > 0;

  // Sound and rumble: one-shots when state changes ('>' so a retry's reset to zero is silent). Rumble only during a
  // run (the last Lap's still plays as Finish opens; Pause stops it), and a new one replaces the one playing, so these
  // go in rising order of importance.
  const buzz: typeof rumble = (...a) => { if (!frozen) rumble(...a); };
  if (st.lastCP > was.lastCP) { sfx.checkpoint(); buzz(0, 0.3, 40); }
  if (st.laps > was.laps) { sfx.lap(); buzz(0, 0.4, 50); buzz(0, 0.4, 50, 120); }
  if (st.boostT > was.boostT) { sfx.boost(); buzz(0.15, 0.3, 150); }
  if (st.padHits > was.padHits) { sfx.pad(); buzz(0, 0.5, 200); }
  if (st.respawns > was.respawns) { sfx.crash(); buzz(1, 1, 400); hit = 'crash'; }
  else if (was.mode === 'air' && st.mode === 'track') { // landing grades (docs/game-spec.md → Landing grades)
    sfx.land();
    if (st.landGrade === 'perfect') { sfx.perfect(); buzz(0, 0.6, 40); buzz(0, 0.6, 40, 90); }
    else { if (st.landGrade === 'sketchy') { sfx.sketchy(); hit = 'sketchy'; } buzz(0.25 + 0.75 * Math.min(1, st.landOff / TUNING.landingTolerance), 0.3, 120); }
    msgEl.classList.remove('pop'); void msgEl.offsetWidth; msgEl.classList.add('pop'); // replay the pop
  }
  was = { mode: st.mode, respawns: st.respawns, lastCP: st.lastCP, laps: st.laps, boostT: st.boostT, padHits: st.padHits };
  // The Menu Song covers the Menu screens; the Track's Song its countdown, race, Pause and Finish. Pause muffles it.
  const inMenu = menu.screen !== null && menu.screen !== 'pause' && menu.screen !== 'finish';
  setMusic(inMenu ? MENU_SONG : w.track.song, menu.screen === 'pause');
  updateEngine(phase === 'racing' && !frozen && !wrecked ? (st.mode === 'track' ? st.speed : st.vel.length()) : 0, st.mode === 'air');
  // Track edges pulse on the live Song's kick: up to 1.3× brightness, gone in 0.15 s.
  const sinceKick = reducedMotion.matches ? null : beat();
  w.pulse(sinceKick === null ? 1 : 1 + 0.3 * Math.max(0, 1 - sinceKick / 0.15));

  msgEl.textContent = st.msgT > 0 ? st.msg : '';
  msgEl.dataset.grade = st.msgKind;
  goT -= frame; splitT -= frame; if (!frozen) bannerT -= frame;
  drawCenter(phase === 'countdown' ? `<div class="count">${Math.ceil(countT)}</div>` : goT > 0 ? '<div class="count">GO</div>'
    : bannerT > 0 ? banner : '');
  ghostLine.update(w.scene, phase === 'racing' && !frozen ? ghost().lineAhead(st) : null);
  w.bike.visible = !wrecked;
  if (!wrecked) {
    if (snap) shownQuat.copy(st.quat); else shownQuat.slerp(st.quat, 1 - Math.exp(-20 * frame));
    w.bike.position.copy(st.pos); w.bike.quaternion.copy(shownQuat); w.updateBike(st, frame);
  }
  const run = ghost().run;
  drawHud(st, shownQuat, splitT > 0 ? split : null, { time: sum(run) + st.lapTime, lap: run.length + 1, laps, best: ghost().bestTime, liveGap });
  w.ghostBike.visible = phase !== 'countdown' && ghost().pose(w.ghostBike.position, w.ghostBike.quaternion);
  if (!frozen) drawMap(w.outline, st.pos, w.ghostBike.visible ? w.ghostBike.position : null);
  if (phase === 'finished') finishCam(st, frame, reducedMotion.matches); // docs/game-spec.md → Finish cam
  else {
    if (!wrecked) { updateCamera(st, shownQuat, frame, snap); snap = false; } // held at the crash; snaps once it's over
    bloom.setSplit(speedFeel.update(w.scene, camera, st, frame, hit, reducedMotion.matches));
  }
  hit = null;
  w.horizon.position.copy(camera.position); // at infinity: it moves with the camera, never nearer
  bloom.render();
});
