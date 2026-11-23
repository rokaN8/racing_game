// Minimal HUD, plain HTML over the canvas: run time (penalties included), Checkpoint split, Lap count and Lap time,
// speed, Boost, last Lap and best run, plus the Attitude indicator while Airborne and the centre banner (countdown, finish).
import { Vector3, type Quaternion } from 'three';
import type { BikeState } from './bike/physics';

const el = document.getElementById('hud')!;
const center = document.getElementById('center')!;
const att = document.getElementById('attitude') as HTMLCanvasElement;
const ctx = att.getContext('2d')!;
const fmt = (t: number | null) => (t === null ? '—' : t.toFixed(2));
// A time against the best: green when ahead, red when behind.
export const delta = (d: number) => `<span class="${d < 0 ? 'ahead' : 'behind'}">${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}</span>`;
const fwd = new Vector3(), up = new Vector3(), left = new Vector3();

export interface RunHud { time: number; lap: number; laps: number; best: number | null }
export function drawHud(st: BikeState, q: Quaternion, split: number | null, run: RunHud) {
  const speed = st.mode === 'track' ? Math.abs(st.speed) : st.vel.length();
  const boost = st.boostT > 0 ? 'BOOST' : st.boostCD > 0 ? `cooldown ${st.boostCD.toFixed(1)} s` : 'ready';
  // ponytail: rebuilds the HUD markup every frame; split into spans + textContent if it ever shows in a profile.
  el.innerHTML = `<b>${fmt(run.time)}</b> s<br>${split === null ? '' : `${delta(split)}<br>`}`
    + `${run.laps > 1 ? `Lap ${run.lap}/${run.laps} · ${fmt(st.lapTime)}<br>` : ''}${Math.round(speed)} m/s<br>Boost ${boost}<br>`
    + `last ${fmt(st.lastLap)} · best ${fmt(run.best)}`;

  att.hidden = st.mode !== 'air';
  if (!att.hidden) drawAttitude(q);
}

// Big centred text: the countdown, GO, the finish panel. Empty hides it.
let shown = '';
export function drawCenter(html: string) { if (html !== shown) center.innerHTML = shown = html; }

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
