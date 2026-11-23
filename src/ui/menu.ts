// The side-rail overlay: Menu, Track select (with the High scores and Reset times), Controls, Pause and Finish
// (docs/game-spec.md → Screens). Draws menuState and feeds it keyboard and gamepad input; the game carries out the
// effects. Plain HTML over the canvas.
import type { Score } from '../ghost';
import { clock } from '../hud';
import { LAP_OPTIONS, initialMenu, itemsFor, reduce, type Action, type Effect, type Item, type Screen } from './menuState';

export interface MenuTrack {
  name: string; kind: string;
  colors: [string, string];                          // swatch, band and outline gradient
  outline: { x: number; z: number; gap: boolean }[]; // the baked Track's samples, for the top-down outline
  scores: (laps: number) => readonly Score[];
}
// raceTime, lap: the run so far (Pause). time, lapTimes, delta, rank: the finished run (Finish).
interface RunInfo { raceTime: number; lap: number; time: number; lapTimes: readonly number[]; delta: number | null; rank: number | null }

const CONTROLS: [string, string, string][] = [
  ['Throttle · nose down', 'W  ↑', 'RT · stick up'], ['Brake · nose up', 'S  ↓', 'LT · stick down'],
  ['Steer · yaw', 'A D  ← →', 'Left stick'], ['Boost', 'Space  Shift', 'A'], ['Respawn', 'R', 'Y'],
  ['Pause', 'Esc', 'Start'], ['Mute', 'M', ''],
];
const TITLE: Partial<Record<Screen, string>> = { select: 'Track select', reset: 'Reset times', controls: 'Controls', pause: 'Paused' };
const fmt = (t: number) => clock(t);
const lapsText = (n: number) => `${n} Lap${n === 1 ? '' : 's'}`;
const date = (d: number | null) => (d === null ? '' : new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const signed = (d: number) => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`;
const kbd = (k: string) => `<kbd>${k}</kbd>`;
const hintHtml = (h: [string[], string][]) => h.map(([keys, what]) => `<span>${keys.map(kbd).join('<i>/</i>')} ${what}</span>`).join('');
const palette = (t: MenuTrack) => `--a:${t.colors[0]};--b:${t.colors[1]}`;

export function createMenu(root: HTMLElement, tracks: MenuTrack[], onEffect: (e: Effect) => void, onPause: () => void) {
  let s = initialMenu(), info: RunInfo = { raceTime: 0, lap: 1, time: 0, lapTimes: [], delta: null, rank: null };
  const n = tracks.length;

  const dispatch = (a: Action) => {
    const [next, effect] = reduce(s, a, n);
    const changed = next !== s;
    s = next;
    if (effect) onEffect(effect); // may open another screen itself (e.g. endRun → nothing to redraw twice)
    if (changed || effect) render();
  };

  const swatch = (t: MenuTrack) => `<i class="sw" style="${palette(t)}"></i>`;
  // A Track's top 5 at the current lap count, `mark` highlighted; #1 carries the Ghost tag and, past 1 Lap, its splits.
  const top5 = (t: MenuTrack, mark: number | null = null) => {
    const sc = t.scores(s.laps);
    if (!sc.length) return '<p class="none">No times yet. Your fastest run becomes your Ghost.</p>';
    return `<ol class="top">${sc.map((x, k) =>
      `<li class="${k + 1 === mark ? 'me' : ''}"><span>#${k + 1}</span><b>${fmt(x.time)}</b><small>${date(x.date)}</small>${k === 0 ? '<em>Ghost</em>' : ''}</li>`
      + (k === 0 && s.laps > 1 ? `<li class="laps"><small>${x.lapTimes.map(fmt).join(' · ')}</small></li>` : '')).join('')}</ol>`;
  };
  const trackPanel = (t: MenuTrack, extra = '') =>
    `<div class="panel${extra}" style="${palette(t)}"><div class="band"></div><h1>${esc(t.name)}</h1><div class="sub">${esc(t.kind)}</div>`
    + `<canvas class="outline" width="320" height="200"></canvas><h2 class="label">Best · ${lapsText(s.laps)}</h2>${top5(t)}</div>`;

  const label = (it: Item, i: number) => {
    if (typeof it === 'object' && 'track' in it) { const t = tracks[it.track]; return `<span>${esc(t.name)} <small>${esc(t.kind)}</small></span>${swatch(t)}`; }
    if (typeof it === 'object') {
      const name = it.reset === 'all' ? 'all Tracks' : esc(tracks[it.reset].name);
      if (s.armed === i) return `<span>Reset ${name}?</span><b>${Math.ceil(s.armedT)}</b>`;
      return it.reset === 'all' ? '<span>All Tracks</span>' : `<span>${name}</span>${swatch(tracks[it.reset])}`;
    }
    return { play: 'Play', controls: 'Controls', reset: 'Reset times', resume: 'Resume', restart: 'Restart', quit: 'Quit to Menu',
      retry: 'Retry', select: 'Track select', menu: 'Menu' }[it];
  };
  // Under the armed reset: what it deletes. After one: that it's done.
  const resetNote = (it: Item, i: number) => {
    if (s.armed !== i || typeof it !== 'object' || !('reset' in it)) return '';
    const whose = it.reset === 'all' ? "every Track's" : `${esc(tracks[it.reset].name)}'s`;
    return `<p class="warn">Deletes ${whose} times and Ghosts at every lap count. Press again to confirm.</p>`;
  };

  function head(screen: Screen) {
    if (screen === 'menu') return '<h1 class="logo">NEON<br>RACER</h1>';
    if (screen === 'finish') return finishHead();
    const t = tracks[s.track];
    let sub = '';
    if (screen === 'select') {
      const at = LAP_OPTIONS.indexOf(s.laps);
      sub = `<div class="stepper"><span class="${at === 0 ? 'end' : ''}">‹</span><b>${s.laps}</b><span>${s.laps === 1 ? 'Lap' : 'Laps'}</span>`
        + `<span class="${at === LAP_OPTIONS.length - 1 ? 'end' : ''}">›</span></div>`;
    }
    if (screen === 'reset') sub = '<div class="sub">Pick a Track, then press again to confirm.</div>';
    if (screen === 'pause') sub = `<div class="sub">${esc(t.name)}${s.laps > 1 ? ` · Lap ${info.lap}/${s.laps}` : ''} · ${fmt(info.raceTime)}</div>`;
    return `<h2>${TITLE[screen]}</h2>${sub}`;
  }

  // Finish: where you raced, the time, then your place: a big rank, NEW BEST, or how far off the best you were.
  function finishHead() {
    const t = tracks[s.track], best = info.rank === 1;
    const verdict = best ? `<span class="newbest">New best</span>${info.delta === null ? '' : `<span><span class="ahead">${signed(info.delta)}</span> on your old best</span>`}`
      : info.delta === null ? '' : `<span><span class="behind">${signed(info.delta)}</span> to your best</span>`;
    return `<div class="result" style="${palette(t)}"><div class="where">${esc(t.name)} · ${lapsText(s.laps)}</div>`
      + `<div class="time">${fmt(info.time)}</div><div class="standing">`
      + (info.rank ? `<b class="rank">#${info.rank}</b>` : '')
      + `<div class="verdict">${info.rank ? '' : '<span>Outside the top 5</span>'}${verdict}</div></div></div>`;
  }

  function panel(screen: Screen) {
    if (screen === 'select') return trackPanel(tracks[s.focus] ?? tracks[s.track]); // on Reset times: the last-raced Track
    if (screen === 'reset') {
      const danger = s.armed >= 0 ? ' danger' : '';
      if (s.focus < n) return trackPanel(tracks[s.focus], danger);
      return `<div class="panel${danger}"><h2 class="label">#1 · ${lapsText(s.laps)}</h2><ol class="top">${tracks.map(t => {
        const x = t.scores(s.laps)[0];
        return `<li>${swatch(t)}<span class="name">${esc(t.name)}</span><b>${x ? fmt(x.time) : '—'}</b></li>`; }).join('')}</ol></div>`;
    }
    if (screen === 'finish') {
      const t = tracks[s.track], sc = t.scores(s.laps);
      const you = info.rank || sc.length < 5 ? ''
        : `<ol class="top"><li class="me you"><span>You</span><b>${fmt(info.time)}</b><small>${signed(info.time - sc[4].time)} to #5</small></li></ol>`;
      const fastest = info.lapTimes.indexOf(Math.min(...info.lapTimes));
      const laps = info.lapTimes.length > 1 ? `<h2 class="label">Laps</h2><ol class="top">${info.lapTimes.map((x, i) =>
        `<li><span>${i + 1}</span><b>${fmt(x)}</b>${i === fastest ? '<em>Fastest</em>' : ''}</li>`).join('')}</ol>` : '';
      return `<div class="panel" style="${palette(t)}"><div class="band"></div><h2 class="label">Top 5 · ${lapsText(s.laps)}</h2>`
        + `${top5(t, info.rank)}${you}${laps}</div>`;
    }
    return '';
  }

  function hint(screen: Screen): [string[], string][] {
    const it = itemsFor(screen, n)[s.focus];
    switch (screen) {
      case 'menu': return [[['↑↓'], 'move'], [['Enter', 'A'], 'pick']];
      case 'select': return [[['↑↓'], 'track'], [['←→'], 'laps'], [['Enter', 'A'], it === 'reset' ? 'open' : 'race'], [['Esc', 'B'], 'back']];
      case 'reset': return [[['↑↓'], 'move'], [['Enter', 'A'], 'press twice'], [['Esc', 'B'], 'back']];
      case 'controls': return [[['Esc', 'B'], 'back']];
      case 'pause': return [[['↑↓'], 'move'], [['Enter', 'A'], 'pick'], [['Esc', 'B'], 'resume']];
      case 'finish': return [[['↑↓'], 'move'], [['Enter', 'A'], 'pick'], [['R', 'Y'], 'retry']];
    }
  }

  function render() {
    document.body.classList.toggle('ui-open', s.screen !== null);
    if (!s.screen) { root.innerHTML = ''; return; }
    const screen = s.screen;
    let body = '';
    if (screen === 'controls') {
      body = `<table class="ctl"><tr><th></th><th>Keyboard</th><th>Gamepad</th></tr>`
        + CONTROLS.map(([a, k, g]) => `<tr><td>${a}</td><td>${kbd(k)}</td><td>${g ? kbd(g) : ''}</td></tr>`).join('')
        + '</table><p class="sub note">In the air, throttle and brake pitch the nose; steer yaws.</p>';
    } else {
      body = `<div class="list">${itemsFor(screen, n).map((it, i) =>
        `<div class="item${i === s.focus ? ' on' : ''}${s.armed === i ? ' armed' : ''}${it === 'reset' ? ' minor' : ''}">${label(it, i)}</div>${resetNote(it, i)}`).join('')}</div>`;
      if (s.cleared !== null) body += `<p class="cleared">${s.cleared === 'all' ? 'All Tracks' : esc(tracks[s.cleared].name)} cleared</p>`;
    }
    root.innerHTML = `<div class="rail${screen === 'controls' ? ' wide' : ''}">${head(screen)}${body}<div class="hint">${hintHtml(hint(screen))}</div></div>${panel(screen)}`;
    const cv = root.querySelector<HTMLCanvasElement>('canvas.outline');
    if (cv) drawOutline(cv, tracks[s.focus] ?? tracks[s.track]);
  }

  // Keyboard: only while the overlay is open, except Esc, which asks to pause.
  addEventListener('keydown', e => {
    if (!s.screen) { if (e.code === 'Escape' && !e.repeat) onPause(); return; }
    const c = e.code;
    if (c === 'Enter' || c === 'Space') { if (!e.repeat) dispatch({ type: 'pick' }); }
    else if (c === 'Escape' || c === 'Backspace') { if (!e.repeat) dispatch({ type: 'back' }); }
    else if (c === 'ArrowUp' || c === 'KeyW') dispatch({ type: 'move', dir: -1 });
    else if (c === 'ArrowDown' || c === 'KeyS') dispatch({ type: 'move', dir: 1 });
    else if (c === 'ArrowLeft' || c === 'KeyA') dispatch({ type: 'adjust', dir: -1 });
    else if (c === 'ArrowRight' || c === 'KeyD') dispatch({ type: 'adjust', dir: 1 });
    else return;
    e.preventDefault();
  });

  // Gamepad (first connected, standard mapping): d-pad or left stick up/down move and left/right adjust, A pick,
  // B back, Start pause / resume. Edge-triggered.
  let padWas: boolean[] = [];
  function pollPad() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed, ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const now = [b(12) || ay < -0.6, b(13) || ay > 0.6, b(0), b(1), b(9), b(14) || ax < -0.6, b(15) || ax > 0.6];
    const edge = (i: number) => now[i] && !padWas[i];
    padWas = now;
    if (!s.screen) { if (edge(4)) onPause(); return; }
    if (edge(0)) dispatch({ type: 'move', dir: -1 });
    if (edge(1)) dispatch({ type: 'move', dir: 1 });
    if (edge(5)) dispatch({ type: 'adjust', dir: -1 });
    if (edge(6)) dispatch({ type: 'adjust', dir: 1 });
    if (edge(2)) dispatch({ type: 'pick' });
    if (edge(3) || (edge(4) && s.screen === 'pause')) dispatch({ type: 'back' });
  }

  return {
    get screen() { return s.screen; },
    get track() { return s.track; },
    open(screen: Screen, run?: Partial<RunInfo>) { info = { ...info, ...run }; dispatch({ type: 'open', screen }); },
    // Each frame: gamepad input and the timers (reset countdown, "cleared", the Finish pick lock). Redraws only when
    // something shown changes, so entrance animations don't restart every frame.
    tick(dt: number) {
      pollPad();
      const [next] = reduce(s, { type: 'tick', dt }, n);
      if (next === s) return;
      const redraw = next.armed !== s.armed || next.cleared !== s.cleared || Math.ceil(next.armedT) !== Math.ceil(s.armedT);
      s = next;
      if (redraw) render();
    },
    close() { if (s.screen) { s = { ...s, screen: null, armed: -1 }; render(); } },
  };
}

// Top-down outline of the whole Track, centred in its canvas: Gaps left open, start line marked. +z up the screen; the
// Bike's starting right (−x) to the right, so it reads the way the Lap is ridden.
function drawOutline(cv: HTMLCanvasElement, t: MenuTrack) {
  const g = cv.getContext('2d'), pts = t.outline;
  if (!g || !pts.length) return;
  const xs = pts.map(p => -p.x), zs = pts.map(p => -p.z), pad = 12;
  const x0 = Math.min(...xs), z0 = Math.min(...zs), w = Math.max(...xs) - x0 || 1, h = Math.max(...zs) - z0 || 1;
  const k = Math.min((cv.width - 2 * pad) / w, (cv.height - 2 * pad) / h);
  const ox = (cv.width - w * k) / 2, oz = (cv.height - h * k) / 2;
  const P = (i: number) => [ox + (xs[i] - x0) * k, oz + (zs[i] - z0) * k] as const;
  const grad = g.createLinearGradient(0, 0, cv.width, 0);
  grad.addColorStop(0, t.colors[0]); grad.addColorStop(1, t.colors[1]);
  g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = grad; g.shadowColor = t.colors[0]; g.shadowBlur = 8;
  g.beginPath();
  pts.forEach((p, i) => { if (p.gap) return; g.moveTo(...P(i)); g.lineTo(...P((i + 1) % pts.length)); });
  g.stroke();
  g.shadowBlur = 0; g.fillStyle = '#fff';
  const [sx, sy] = P(0); g.fillRect(sx - 6, sy - 1.5, 12, 3);
}
