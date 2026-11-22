// The side-rail overlay: Menu, Track select, High scores, Controls, Pause and Finish (docs/game-spec.md → Screens).
// Draws menuState and feeds it keyboard and gamepad input; the game carries out the effects. Plain HTML over the canvas.
import type { Score } from '../ghost';
import { initialMenu, itemsFor, reduce, type Action, type Effect, type Item, type Screen } from './menuState';

export interface MenuTrack {
  name: string; kind: string;
  colors: [string, string];                          // swatch, band and outline gradient
  outline: { x: number; z: number; gap: boolean }[]; // the baked Track's samples, for the top-down outline
  scores: () => readonly Score[];
}
interface RunInfo { lapTime: number; time: number; delta: number | null; rank: number | null }

const CONTROLS: [string, string, string][] = [
  ['Throttle · nose down', 'W  ↑', 'RT · stick up'], ['Brake · nose up', 'S  ↓', 'LT · stick down'],
  ['Steer · yaw', 'A D  ← →', 'Left stick'], ['Boost', 'Space  Shift', 'A'], ['Respawn', 'R', 'Y'],
  ['Pause', 'Esc', 'Start'], ['Mute', 'M', '—'],
];
const TITLE: Record<Screen, string> = { menu: '', select: 'Track select', scores: 'High scores', controls: 'Controls', pause: 'Paused', finish: '' };
const fmt = (t: number) => t.toFixed(2);
const date = (d: number | null) => (d === null ? '—' : new Date(d).toLocaleDateString());
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const deltaHtml = (d: number | null) => d === null ? 'NEW BEST'
  : `<span class="${d < 0 ? 'ahead' : 'behind'}">${d < 0 ? '−' : '+'}${fmt(Math.abs(d))}</span>${d < 0 ? ' · NEW BEST' : ''}`;

export function createMenu(root: HTMLElement, tracks: MenuTrack[], onEffect: (e: Effect) => void, onPause: () => void) {
  let s = initialMenu(), info: RunInfo = { lapTime: 0, time: 0, delta: null, rank: null }, shownArm = -1;

  const dispatch = (a: Action) => {
    const [next, effect] = reduce(s, a, tracks.length);
    const changed = next !== s;
    s = next;
    if (effect) onEffect(effect); // may open another screen itself (e.g. endRun → nothing to redraw twice)
    if (changed || effect) render();
  };

  const swatch = (t: MenuTrack) => `<i class="sw" style="--a:${t.colors[0]};--b:${t.colors[1]}"></i>`;
  const top5 = (t: MenuTrack, mark: number | null = null) => {
    const sc = t.scores();
    return `<ol class="top">${[0, 1, 2, 3, 4].map(k => sc[k]
      ? `<li class="${k + 1 === mark ? 'me' : ''}"><span>#${k + 1}</span><b>${fmt(sc[k].time)}</b><small>${date(sc[k].date)}</small>${k === 0 ? '<em>Ghost</em>' : ''}</li>`
      : `<li class="empty"><span>#${k + 1}</span><b>—</b></li>`).join('')}</ol>`;
  };
  const label = (it: Item, i: number) => {
    if (typeof it === 'object' && 'track' in it) { const t = tracks[it.track]; return `<span>${esc(t.name)} <small>${esc(t.kind)}</small></span>${swatch(t)}`; }
    if (typeof it === 'object') {
      if (s.armed === i) return `Press again · ${Math.ceil(s.armedT)}`;
      return it.reset === 'all' ? 'Reset all' : `Reset ${esc(tracks[it.reset].name)}`;
    }
    return { play: 'Play', scores: 'High scores', controls: 'Controls', resume: 'Resume', restart: 'Restart', quit: 'Quit to Menu',
      retry: 'Retry', select: 'Track select', menu: 'Menu' }[it];
  };

  function panel(screen: Screen) {
    if (screen === 'select') {
      const t = tracks[s.focus];
      return `<div class="panel" style="--a:${t.colors[0]};--b:${t.colors[1]}"><div class="band"></div><h1>${esc(t.name)}</h1>`
        + `<div class="sub">${esc(t.kind)}</div><canvas class="outline" width="320" height="200"></canvas><h3>Best Laps</h3>${top5(t)}</div>`;
    }
    if (screen === 'scores') {
      return `<div class="panel"><table class="grid"><tr><th></th>${tracks.map(t => `<th>${swatch(t)}${esc(t.name)}</th>`).join('')}</tr>`
        + [0, 1, 2, 3, 4].map(k => `<tr><td>#${k + 1}</td>${tracks.map(t => { const x = t.scores()[k];
          return `<td>${x ? `<b>${fmt(x.time)}</b><small>${date(x.date)}</small>` : '—'}</td>`; }).join('')}</tr>`).join('')
        + `</table>${s.armed >= 0 ? '<p class="warn">Deletes Lap times and Ghost</p>' : ''}</div>`;
    }
    if (screen === 'controls') {
      return `<div class="panel"><table class="ctl"><tr><th></th><th>Keyboard</th><th>Gamepad</th></tr>`
        + CONTROLS.map(([a, k, g]) => `<tr><td>${a}</td><td><kbd>${k}</kbd></td><td><kbd>${g}</kbd></td></tr>`).join('')
        + '</table><p class="sub">In the air, throttle/brake pitch the nose and steer yaws.</p></div>';
    }
    if (screen === 'finish') {
      const t = tracks[s.track];
      return `<div class="panel"><h3>${esc(t.name)} · ${info.rank ? `#${info.rank}` : 'not in the top 5'}</h3>${top5(t, info.rank)}</div>`;
    }
    return '';
  }

  function render() {
    document.body.classList.toggle('ui-open', s.screen !== null);
    shownArm = s.armed >= 0 ? Math.ceil(s.armedT) : -1;
    if (!s.screen) { root.innerHTML = ''; return; }
    const screen = s.screen, t = tracks[s.track];
    const head = screen === 'menu' ? '<h1 class="logo">NEON<br>RACER</h1>'
      : screen === 'finish' ? `<div class="time">${fmt(info.time)}</div><div class="delta">${deltaHtml(info.delta)}</div>`
      : `<h2>${TITLE[screen]}</h2>${screen === 'pause' ? `<div class="sub">${esc(t.name)} · ${fmt(info.lapTime)} s</div>` : ''}`;
    const items = itemsFor(screen, tracks.length).map((it, i) =>
      `<div class="item${i === s.focus ? ' on' : ''}${s.armed === i ? ' armed' : ''}">${label(it, i)}</div>`).join('');
    const hint = screen === 'finish' ? 'Enter / A pick · R / Y retry'
      : `${screen === 'menu' ? '' : 'Esc / B back · '}Enter / A pick`;
    root.innerHTML = `<div class="rail">${head}<div class="list">${items}</div><div class="hint">${hint}</div></div>${panel(screen)}`;
    const cv = root.querySelector<HTMLCanvasElement>('canvas.outline');
    if (cv) drawOutline(cv, tracks[s.focus]);
  }

  // Keyboard: only while the overlay is open, except Esc, which asks to pause.
  addEventListener('keydown', e => {
    if (!s.screen) { if (e.code === 'Escape' && !e.repeat) onPause(); return; }
    const c = e.code;
    if (c === 'Enter' || c === 'Space') { if (!e.repeat) dispatch({ type: 'pick' }); }
    else if (c === 'Escape' || c === 'Backspace') { if (!e.repeat) dispatch({ type: 'back' }); }
    else if (c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowLeft' || c === 'KeyA') dispatch({ type: 'move', dir: -1 });
    else if (c === 'ArrowDown' || c === 'KeyS' || c === 'ArrowRight' || c === 'KeyD') dispatch({ type: 'move', dir: 1 });
    else return;
    e.preventDefault();
  });

  // Gamepad (first connected, standard mapping): d-pad or left stick move, A pick, B back, Start pause / resume. Edge-triggered.
  let padWas: boolean[] = [];
  function pollPad() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed, ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
    const now = [b(12) || b(14) || ay < -0.6 || ax < -0.6, b(13) || b(15) || ay > 0.6 || ax > 0.6, b(0), b(1), b(9)];
    const edge = (i: number) => now[i] && !padWas[i];
    padWas = now;
    if (!s.screen) { if (edge(4)) onPause(); return; }
    if (edge(0)) dispatch({ type: 'move', dir: -1 });
    if (edge(1)) dispatch({ type: 'move', dir: 1 });
    if (edge(2)) dispatch({ type: 'pick' });
    if (edge(3) || (edge(4) && s.screen === 'pause')) dispatch({ type: 'back' });
  }

  return {
    get screen() { return s.screen; },
    get track() { return s.track; },
    open(screen: Screen, run?: Partial<RunInfo>) { info = { ...info, ...run }; dispatch({ type: 'open', screen }); },
    // Each frame: gamepad input and the reset countdown.
    tick(dt: number) {
      pollPad();
      if (s.armed >= 0) { dispatch({ type: 'tick', dt }); if (s.armed >= 0 && Math.ceil(s.armedT) !== shownArm) render(); }
    },
    close() { if (s.screen) { s = { ...s, screen: null, armed: -1 }; render(); } },
  };
}

// Top-down outline of the whole Track: Gaps left open, start line marked. +z up the screen; the Bike's starting
// right (−x) to the right, so it reads the way the Lap is ridden.
function drawOutline(cv: HTMLCanvasElement, t: MenuTrack) {
  const g = cv.getContext('2d'), pts = t.outline;
  if (!g || !pts.length) return;
  const xs = pts.map(p => -p.x), zs = pts.map(p => -p.z), pad = 12;
  const x0 = Math.min(...xs), z0 = Math.min(...zs);
  const k = Math.min((cv.width - 2 * pad) / (Math.max(...xs) - x0 || 1), (cv.height - 2 * pad) / (Math.max(...zs) - z0 || 1));
  const P = (i: number) => [pad + (xs[i] - x0) * k, pad + (zs[i] - z0) * k] as const;
  const grad = g.createLinearGradient(0, 0, cv.width, 0);
  grad.addColorStop(0, t.colors[0]); grad.addColorStop(1, t.colors[1]);
  g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = grad; g.shadowColor = t.colors[0]; g.shadowBlur = 8;
  g.beginPath();
  pts.forEach((p, i) => { if (p.gap) return; g.moveTo(...P(i)); g.lineTo(...P((i + 1) % pts.length)); });
  g.stroke();
  g.shadowBlur = 0; g.fillStyle = '#fff';
  const [sx, sy] = P(0); g.fillRect(sx - 6, sy - 1.5, 12, 3);
}
