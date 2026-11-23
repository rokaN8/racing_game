// In-race HUD, plain HTML over the canvas (markup and styles in index.html). Top left: the run clock (penalties
// included), the Checkpoint split under it, then the current Lap time and the best run. Top right: the Lap counter,
// flagged on the final Lap. Bottom left: speed and the Boost meter. Bottom right: the Attitude indicator while
// Airborne. Centre: the countdown, GO and the Lap banner. Each field is written only when its text changes.
import { Vector3, type Quaternion } from 'three';
import type { BikeState } from './bike/physics';
import { TUNING } from './bike/tuning';

// m:ss.cc: the race clock's format everywhere times are shown (HUD, Finish, High scores).
export function clock(t: number) {
  const cs = Math.round(t * 100), r = cs % 6000;
  return `${Math.floor(cs / 6000)}:${String(Math.floor(r / 100)).padStart(2, '0')}.${String(r % 100).padStart(2, '0')}`;
}
// A time against the best: green when ahead, red when behind.
const delta = (d: number) => `<span class="${d < 0 ? 'ahead' : 'behind'}">${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}</span>`;

const $ = (id: string) => document.getElementById(id)!;
const hud = $('hud'), center = $('center');
const f = {
  time: $('h-time'), split: $('h-split'), lapTime: $('h-laptime'), best: $('h-best'),
  lap: $('h-lap'), laps: $('h-laps'), speed: $('h-speed'), meter: $('h-meter'), boost: $('h-boost'),
};
const shown = new Map<HTMLElement, string>();
const put = (el: HTMLElement, text: string, html = false) => {
  if (shown.get(el) === text) return;
  shown.set(el, text);
  if (html) el.innerHTML = text; else el.textContent = text;
};
const flag = (name: string, value: string) => { if (hud.dataset[name] !== value) hud.dataset[name] = value; };

const att = $('attitude') as HTMLCanvasElement;
const ctx = att.getContext('2d')!;
const fwd = new Vector3(), up = new Vector3(), left = new Vector3();

export interface RunHud { time: number; lap: number; laps: number; best: number | null }
export function drawHud(st: BikeState, q: Quaternion, split: number | null, run: RunHud) {
  flag('laps', run.laps > 1 ? 'multi' : 'single');
  flag('final', run.laps > 1 && run.lap >= run.laps ? '1' : '');
  put(f.time, clock(run.time));
  put(f.split, split === null ? '' : delta(split), true); // a new split inserts a fresh span, so it pops in
  put(f.lapTime, clock(st.lapTime));
  put(f.best, run.best === null ? '—' : clock(run.best));
  put(f.lap, String(Math.min(run.lap, run.laps)));
  put(f.laps, `/${run.laps}`);
  put(f.speed, String(Math.round(st.mode === 'track' ? Math.abs(st.speed) : st.vel.length())));

  // Boost meter: drains while Boosting, refills over the cooldown, full when ready.
  const { boostDuration: D, boostCooldown: C } = TUNING;
  const [state, fill] = st.boostT > 0 ? ['on', st.boostT / D] : st.boostCD > 0 ? ['charging', 1 - st.boostCD / C] : ['ready', 1];
  flag('boost', state as string);
  f.meter.style.setProperty('--fill', Math.min(1, Math.max(0, fill as number)).toFixed(3));
  put(f.boost, state === 'on' ? 'active' : state as string);

  att.hidden = st.mode !== 'air';
  if (!att.hidden) drawAttitude(q);
}

// The centre stage: the countdown, GO and the Lap banner. Empty hides it. New markup replays its entrance.
let shownCenter = '';
export function drawCenter(html: string) { if (html !== shownCenter) center.innerHTML = shownCenter = html; }

// Crossing the line onto `lap` of `laps`: the Lap just finished and the run's time against the Ghost there.
export const lapBanner = (lap: number, laps: number, lapTime: number, split: number | null) =>
  `<div class="banner${lap === laps ? ' final' : ''}"><div class="title">${lap === laps ? 'Final lap' : `Lap ${lap}<span>/${laps}</span>`}</div>`
  + `<div class="sub">${clock(lapTime)}${split === null ? '' : ` ${delta(split)}`}</div></div>`;

// Artificial horizon against world up: the horizon rotates with roll and shifts with pitch; the Bike symbol is fixed.
function drawAttitude(q: Quaternion) {
  fwd.set(0, 0, 1).applyQuaternion(q); up.set(0, 1, 0).applyQuaternion(q); left.set(1, 0, 0).applyQuaternion(q);
  const pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y))), roll = Math.atan2(left.y, up.y);
  const S = att.width, c = S / 2, R = c - 6;
  ctx.clearRect(0, 0, S, S);
  ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, 2 * Math.PI); ctx.clip();
  ctx.fillStyle = '#05051a'; ctx.fillRect(0, 0, S, S); // sky
  ctx.translate(c, c); ctx.rotate(-roll); ctx.translate(0, pitch * R * 1.2);
  ctx.fillStyle = '#3a1a00'; ctx.fillRect(-2 * S, 0, 4 * S, 4 * S); // ground: matches the Bike's underglow
  ctx.strokeStyle = '#0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2 * S, 0); ctx.lineTo(2 * S, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); // Bike symbol
  ctx.moveTo(c - 30, c); ctx.lineTo(c - 10, c); ctx.lineTo(c, c + 8); ctx.lineTo(c + 10, c); ctx.lineTo(c + 30, c); ctx.stroke();
  ctx.strokeStyle = '#0ff8'; ctx.beginPath(); ctx.arc(c, c, R, 0, 2 * Math.PI); ctx.stroke();
}
