// Minimal HUD, plain HTML over the canvas: lap time (penalties included), speed, Boost, last and best Lap.
import type { BikeState } from './bike/physics';

const el = document.getElementById('hud')!;
const fmt = (t: number | null) => (t === null ? '—' : t.toFixed(2));

export function drawHud(st: BikeState) {
  const speed = st.mode === 'track' ? Math.abs(st.speed) : st.vel.length();
  const boost = st.boostT > 0 ? 'BOOST' : st.boostCD > 0 ? `cooldown ${st.boostCD.toFixed(1)} s` : 'ready';
  // ponytail: rebuilds the HUD markup every frame; split into spans + textContent if it ever shows in a profile.
  el.innerHTML = `<b>${fmt(st.lapTime)}</b> s<br>${Math.round(speed)} m/s<br>Boost ${boost}<br>`
    + `last ${fmt(st.lastLap)} · best ${fmt(st.best)}`;
}
