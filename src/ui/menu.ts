// The side-rail overlay: Menu, Track select (with the High scores and Reset times), Controls, Stats, Pause and Finish
// (docs/game-spec.md → Screens). Draws menuState and feeds it keyboard and gamepad input; the game carries out the
// effects. Plain HTML over the canvas.
import type { Score } from '../ghost';
import { clock } from '../hud';
import type { SettingRow } from '../settings';
import type { RunStats, Totals } from '../stats';
import type { TourScore } from '../tour';
import { drawOutline, type Outline } from './outline';
import {
  LAP_OPTIONS, MEDALS, earns, initialMenu, itemsFor, medalFor, medalRank, medalTime, reduce, type Action, type Effect, type Item, type Medal,
  type Screen,
} from './menuState';

// colors: also the swatch and band
export interface MenuTrack extends Outline {
  name: string; kind: string;
  scores: (laps: number) => readonly Score[];
  ideal: (laps: number) => number | null; // the Ideal time, null while hidden
  pilotTimes: Record<number, number>;     // the Pilot's run time per lap count: the Medals' reference
  shards: () => { found: number; total: number }; // Data shards found on it, of how many
}
// raceTime, lap: the run so far (Pause). time, lapTimes, delta, rank, stats: the finished run (Finish). On a Grand tour
// lap is the leg and lapTimes the legs' times.
interface RunInfo { raceTime: number; lap: number; time: number; lapTimes: readonly number[]; delta: number | null; rank: number | null; stats: RunStats | null }
// The Grand tour: its top 5, and the Pilot's tour time, which its Medals are set from.
export interface MenuTour { scores: () => readonly TourScore[]; pilotTime: number }

const CONTROLS: [string, string, string][] = [
  ['Throttle · nose down', 'W  ↑', 'RT · stick up'], ['Brake · nose up', 'S  ↓', 'LT · stick down'],
  ['Steer · yaw', 'A D  ← →', 'Left stick'], ['Boost', 'Space  Shift', 'A'], ['Respawn', 'R', 'Y'],
  ['Pause', 'Esc', 'Start'], ['Ghost line', 'G', 'Select'], ['Mute', 'M', ''],
];
const TITLE: Partial<Record<Screen, string>> = { select: 'Track select', reset: 'Reset times', controls: 'Controls', stats: 'Stats', settings: 'Settings', pause: 'Paused' };
const fmt = (t: number) => clock(t);
const lapsText = (n: number) => `${n} Lap${n === 1 ? '' : 's'}`;
const date = (d: number | null) => (d === null ? '' : new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const signed = (d: number) => `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`;
// Time played: 1h 05m, or 4m 12s under an hour.
const played = (t: number) => {
  const m = Math.floor(t / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m ${String(Math.floor(t % 60)).padStart(2, '0')}s`;
};
const kbd = (k: string) => `<kbd>${k}</kbd>`;
const hintHtml = (h: [string[], string][]) => h.map(([keys, what]) => `<span>${keys.map(kbd).join('<i>/</i>')} ${what}</span>`).join('');
const palette = (t: MenuTrack) => `--a:${t.colors[0]};--b:${t.colors[1]}`;
const medalTag = (m: Medal | null, pop = false) => (m ? `<i class="medal ${m.toLowerCase()}${pop ? ' pop' : ''}">${m}</i>` : '');

const SETTING_NAME: Record<SettingRow, string> = {
  music: 'Music', sound: 'Sound', motion: 'Reduce motion', fov: 'Field of view', quality: 'Quality', fps: 'FPS counter', ghostLine: 'Ghost line',
};

// settingText: a Settings row's value as shown, e.g. '80 %' or 'Auto'.
export function createMenu(root: HTMLElement, tracks: MenuTrack[], onEffect: (e: Effect) => void, onPause: () => void, totals: () => Totals,
  settingText: (row: SettingRow) => string, tour: MenuTour) {
  let s = initialMenu(), info: RunInfo = { raceTime: 0, lap: 1, time: 0, lapTimes: [], delta: null, rank: null, stats: null };
  const n = tracks.length, onTour = () => s.track === n; // the last run was the Grand tour

  const dispatch = (a: Action) => {
    const [next, effect] = reduce(s, a, n);
    const changed = next !== s;
    s = next;
    if (effect) onEffect(effect); // may open another screen itself (e.g. endRun → nothing to redraw twice)
    if (changed || effect) render();
  };

  const swatch = (t: MenuTrack) => `<i class="sw" style="${palette(t)}"></i>`;
  // At the current lap count: a Track's #1 time (null with none) and the Pilot's run time, which the Medals are set from.
  const best = (t: MenuTrack) => t.scores(s.laps)[0]?.time ?? null, pilotTime = (t: MenuTrack) => t.pilotTimes[s.laps];
  // A Track's top 5 at the current lap count, `mark` highlighted; #1 carries the Ghost tag and, past 1 Lap, its splits.
  const top5 = (t: MenuTrack, mark: number | null = null) => {
    const sc = t.scores(s.laps);
    if (!sc.length) return '<p class="none">No times yet. Beat the Pilot: your fastest run becomes your Ghost.</p>';
    return `<ol class="top">${sc.map((x, k) =>
      `<li class="${k + 1 === mark ? 'me' : ''}"><span>#${k + 1}</span><b>${fmt(x.time)}</b><small>${date(x.date)}</small>${k === 0 ? '<em>Ghost</em>' : ''}</li>`
      + (k === 0 && s.laps > 1 ? `<li class="laps"><small>${x.lapTimes.map(fmt).join(' · ')}</small></li>` : '')).join('')}</ol>`;
  };
  // The Ideal time under the top 5 (with how far #1 is off it, on Finish), when there is one to show.
  const ideal = (t: MenuTrack, off = false) => {
    const x = t.ideal(s.laps);
    return x === null ? '' : `<p class="ideal"><span>Ideal</span> <b>${fmt(x)}</b>${off ? ` · best ${(t.scores(s.laps)[0].time - x).toFixed(2)} off` : ''}</p>`;
  };
  // The four target times at this lap count, the ones #1 has earned lit.
  const medals = (t: MenuTrack) => {
    const P = pilotTime(t);
    return `<h2 class="label">Medals</h2><ol class="top medals">${MEDALS.map(([m]) => `<li class="${earns(best(t), m, P) ? 'lit' : ''}">`
      + `${medalTag(m)}<b>${fmt(medalTime(m, P))}</b>${m === 'Neon' ? '<small>beat the Pilot</small>' : ''}</li>`).join('')}</ol>`;
  };
  // Data shards: "Shards 7/10" on the panel; a tag on the rail once all are found.
  const shardLine = (t: MenuTrack) => { const x = t.shards(); return `<p class="shards"><span>Shards</span> <b>${x.found}/${x.total}</b></p>`; };
  const shardTag = (t: MenuTrack) => { const x = t.shards(); return x.total && x.found === x.total ? '<i class="shardtag" title="Every Data shard found">◆</i>' : ''; };
  // The Grand tour: its top 5 (#1's legs under it), its Medals, and every leg with your 1-Lap best there.
  const tourBest = () => tour.scores()[0]?.time ?? null;
  const tourTop5 = (mark: number | null = null) => {
    const sc = tour.scores();
    if (!sc.length) return '<p class="none">No tours yet. Ride all seven Tracks back to back, one Lap each.</p>';
    return `<ol class="top">${sc.map((x, k) => `<li class="${k + 1 === mark ? 'me' : ''}"><span>#${k + 1}</span><b>${fmt(x.time)}</b><small>${date(x.date)}</small></li>`
      + (k === 0 ? `<li class="laps"><small>${x.legs.map(fmt).join(' · ')}</small></li>` : '')).join('')}</ol>`;
  };
  const tourMedals = () => `<h2 class="label">Medals</h2><ol class="top medals">${MEDALS.map(([m]) => `<li class="${earns(tourBest(), m, tour.pilotTime) ? 'lit' : ''}">`
    + `${medalTag(m)}<b>${fmt(medalTime(m, tour.pilotTime))}</b>${m === 'Neon' ? '<small>beat the Pilot</small>' : ''}</li>`).join('')}</ol>`;
  const tourPanel = (extra = '') => {
    const found = tracks.reduce((a, t) => a + t.shards().found, 0), total = tracks.reduce((a, t) => a + t.shards().total, 0);
    return `<div class="panel${extra}" style="${palette(tracks[0])}"><div class="band"></div><h1>Grand tour</h1><div class="sub">${n} Tracks · 1 Lap each</div>`
      + `<ol class="top">${tracks.map((t, i) => { const b = t.scores(1)[0]?.time; return `<li>${swatch(t)}<span class="name">${i + 1} · ${esc(t.name)}</span><b>${b ? fmt(b) : '—'}</b></li>`; }).join('')}</ol>`
      + `<p class="shards"><span>Shards</span> <b>${found}/${total}</b></p><h2 class="label">Best tours</h2>${tourTop5()}${tourMedals()}</div>`;
  };
  const trackPanel = (t: MenuTrack, extra = '') =>
    `<div class="panel${extra}" style="${palette(t)}"><div class="band"></div><h1>${esc(t.name)}</h1><div class="sub">${esc(t.kind)}</div>`
    + `<canvas class="outline" width="320" height="200"></canvas>${shardLine(t)}<h2 class="label">Best · ${lapsText(s.laps)}</h2>${top5(t)}${ideal(t)}${medals(t)}</div>`;

  const label = (it: Item, i: number) => {
    if (typeof it === 'object' && 'track' in it) { // with the Medal its #1 earns at this lap count
      const t = tracks[it.track], m = medalFor(best(t), pilotTime(t));
      return `<span>${esc(t.name)} <small>${esc(t.kind)}</small></span>${shardTag(t)}${medalTag(m)}${swatch(t)}`;
    }
    if (it === 'tour') return `<span>Grand tour <small>${n} Tracks</small></span>${medalTag(medalFor(tourBest(), tour.pilotTime))}`;
    if (typeof it === 'object' && 'setting' in it) return `<span>${SETTING_NAME[it.setting]}</span><b class="value">‹ ${esc(settingText(it.setting))} ›</b>`;
    if (it === 'resetSettings') return s.armed === i ? `<span>Reset settings?</span><b>${Math.ceil(s.armedT)}</b>` : '<span>Reset to defaults</span>';
    if (typeof it === 'object') {
      const name = it.reset === 'all' ? 'all Tracks' : it.reset === 'tour' ? 'the Grand tour' : esc(tracks[it.reset].name);
      if (s.armed === i) return `<span>Reset ${name}?</span><b>${Math.ceil(s.armedT)}</b>`;
      if (it.reset === 'tour') return '<span>Grand tour</span>';
      return it.reset === 'all' ? '<span>All Tracks</span>' : `<span>${name}</span>${swatch(tracks[it.reset])}`;
    }
    return { play: 'Play', stats: 'Stats', settings: 'Settings', controls: 'Controls', reset: 'Reset times', resume: 'Resume', restart: 'Restart', quit: 'Quit to Menu',
      retry: 'Retry', select: 'Track select', menu: 'Menu' }[it];
  };
  // Under the armed reset: what it deletes. After one: that it's done.
  const resetNote = (it: Item, i: number) => {
    if (s.armed === i && it === 'resetSettings') return '<p class="warn">Puts every setting back to its default, the Ghost line too. Press again to confirm.</p>';
    if (s.armed !== i || typeof it !== 'object' || !('reset' in it)) return '';
    if (it.reset === 'tour') return '<p class="warn">Deletes the Grand tour\'s times (each Track keeps its own). Press again to confirm.</p>';
    const whose = it.reset === 'all' ? "every Track's" : `${esc(tracks[it.reset].name)}'s`;
    return `<p class="warn">Deletes ${whose} times and Ghosts at every lap count${it.reset === 'all' ? ', and the Grand tour\'s times' : ''}. Press again to confirm.</p>`;
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
    if (screen === 'pause') sub = onTour() ? `<div class="sub">Grand tour · Leg ${info.lap}/${n} · ${fmt(info.raceTime)}</div>`
      : `<div class="sub">${esc(t.name)}${s.laps > 1 ? ` · Lap ${info.lap}/${s.laps}` : ''} · ${fmt(info.raceTime)}</div>`;
    return `<h2>${TITLE[screen]}</h2>${sub}`;
  }

  // Finish: where you raced, the time, then your place: a big rank, NEW BEST, or how far off the best you were. Then the
  // Medal this run earned (popping in if it's better than your old best's) and how far it was off the next one.
  function finishHead() {
    const t = tracks[onTour() ? 0 : s.track], newBest = info.rank === 1, P = onTour() ? tour.pilotTime : pilotTime(t);
    const got = medalFor(info.time, P), had = info.delta === null ? null : medalFor(info.time - info.delta, P), next = MEDALS[medalRank(got) - 1]?.[0];
    const medal = `<div class="medalline">${got ? medalTag(got, medalRank(got) < medalRank(had)) : '<span>No Medal</span>'}`
      + `${next ? `<span>· ${(info.time - medalTime(next, P)).toFixed(2)} to ${next}</span>` : ''}</div>`;
    const verdict = newBest ? `<span class="newbest">New best</span>${info.delta === null ? '' : `<span><span class="ahead">${signed(info.delta)}</span> on your old best</span>`}`
      : info.delta === null ? '' : `<span><span class="behind">${signed(info.delta)}</span> to your best</span>`;
    return `<div class="result" style="${palette(t)}"><div class="where">${onTour() ? `Grand tour · ${n} Tracks` : `${esc(t.name)} · ${lapsText(s.laps)}`}</div>`
      + `<div class="time">${fmt(info.time)}</div><div class="standing">`
      + (info.rank ? `<b class="rank">#${info.rank}</b>` : '')
      + `<div class="verdict">${info.rank ? '' : '<span>Outside the top 5</span>'}${verdict}</div></div>${medal}</div>`;
  }

  function panel(screen: Screen) {
    if (screen === 'select') {
      const i = s.focus < n + 1 ? s.focus : s.track; // on Reset times: the last-raced Track (or the Grand tour)
      return i === n ? tourPanel() : trackPanel(tracks[i]);
    }
    if (screen === 'reset') {
      const danger = s.armed >= 0 ? ' danger' : '';
      if (s.focus < n) return trackPanel(tracks[s.focus], danger);
      if (s.focus === n) return tourPanel(danger);
      return `<div class="panel${danger}"><h2 class="label">#1 · ${lapsText(s.laps)}</h2><ol class="top">${tracks.map(t => {
        const x = t.scores(s.laps)[0];
        return `<li>${swatch(t)}<span class="name">${esc(t.name)}</span><b>${x ? fmt(x.time) : '—'}</b></li>`; }).join('')}</ol></div>`;
    }
    if (screen === 'finish') {
      const t = tracks[onTour() ? 0 : s.track], sc = onTour() ? tour.scores() : t.scores(s.laps);
      const you = info.rank || sc.length < 5 ? ''
        : `<ol class="top"><li class="me you"><span>You</span><b>${fmt(info.time)}</b><small>${signed(info.time - sc[4].time)} to #5</small></li></ol>`;
      const fastest = info.lapTimes.indexOf(Math.min(...info.lapTimes));
      const laps = onTour() ? `<h2 class="label">Legs</h2><ol class="top">${info.lapTimes.map((x, i) =>
        `<li>${swatch(tracks[i])}<span class="name">${esc(tracks[i].name)}</span><b>${fmt(x)}</b>${i === fastest ? '<em>Fastest</em>' : ''}</li>`).join('')}</ol>`
        : info.lapTimes.length > 1 ? `<h2 class="label">Laps</h2><ol class="top">${info.lapTimes.map((x, i) =>
        `<li><span>${i + 1}</span><b>${fmt(x)}</b>${i === fastest ? '<em>Fastest</em>' : ''}</li>`).join('')}</ol>` : '';
      // the Run stats: a 3 × 2 grid under the Laps
      const r = info.stats, run = r ? `<h2 class="label">Run</h2><dl class="runstats">${([
        ['Airtime', `${r.air.toFixed(1)} s`], ['Top speed', `${Math.round(r.top)} m/s`], ['Crashes', r.crashes],
        ['Boosts', r.boosts], ['Pad hits', r.pads], ['Perfect', r.perfect]] as const).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '';
      if (onTour()) return `<div class="panel" style="${palette(t)}"><div class="band"></div><h2 class="label">Best tours</h2>${tourTop5(info.rank)}${you}${laps}${run}</div>`;
      return `<div class="panel" style="${palette(t)}"><div class="band"></div><h2 class="label">Top 5 · ${lapsText(s.laps)}</h2>`
        + `${top5(t, info.rank)}${you}${ideal(t, true)}${laps}${run}</div>`;
    }
    return '';
  }

  function hint(screen: Screen): [string[], string][] {
    const it = itemsFor(screen, n)[s.focus];
    switch (screen) {
      case 'menu': return [[['↑↓'], 'move'], [['Enter', 'A'], 'pick']];
      case 'select': return [[['↑↓'], 'track'], [['←→'], 'laps'], [['Enter', 'A'], it === 'reset' ? 'open' : 'race'], [['Esc', 'B'], 'back']];
      case 'reset': return [[['↑↓'], 'move'], [['Enter', 'A'], 'press twice'], [['Esc', 'B'], 'back']];
      case 'controls': case 'stats': return [[['Esc', 'B'], 'back']];
      case 'settings': return [[['↑↓'], 'move'], [['←→'], 'change'], [['Esc', 'B'], 'back']];
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
    } else if (screen === 'stats') { // Lifetime stats: every Track and lap count together
      const t = totals();
      body = `<table class="ctl">${([['Distance', `${(t.dist / 1000).toFixed(1)} km`], ['Laps', t.laps], ['Time played', played(t.time)],
        ['Runs finished', t.runs], ['Crashes', t.crashes]] as const).map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join('')}</table>`;
    } else {
      body = `<div class="list">${itemsFor(screen, n).map((it, i) =>
        `<div class="item${i === s.focus ? ' on' : ''}${s.armed === i ? ' armed' : ''}${it === 'reset' || it === 'resetSettings' ? ' minor' : ''}">${label(it, i)}</div>${resetNote(it, i)}`).join('')}</div>`;
      if (s.cleared !== null) body += `<p class="cleared">${s.cleared === 'settings' ? 'Settings reset'
        : `${s.cleared === 'all' ? 'All Tracks' : s.cleared === 'tour' ? 'Grand tour' : esc(tracks[s.cleared].name)} cleared`}</p>`;
    }
    root.innerHTML = `<div class="rail${screen === 'controls' ? ' wide' : ''}">${head(screen)}${body}<div class="hint">${hintHtml(hint(screen))}</div></div>${panel(screen)}`;
    const cv = root.querySelector<HTMLCanvasElement>('canvas.outline');
    if (cv) drawOutline(cv, tracks[s.focus] ?? tracks[s.track] ?? tracks[0]);
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
