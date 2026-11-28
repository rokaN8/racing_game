// Keyboard + first connected gamepad (standard mapping) → physics Input.
import type { Input } from './bike/physics';

const keys = new Set<string>();
let respawnFn = () => {}, ghostLineFn = () => {};
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR' && !e.repeat) respawnFn();
  if (e.code === 'KeyG' && !e.repeat) ghostLineFn();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const k = (...codes: string[]) => (codes.some(c => keys.has(c)) ? 1 : 0);
const dz = (v = 0) => (Math.abs(v) < 0.15 ? 0 : v);
const firstPad = () => [...(navigator.getGamepads?.() ?? [])].find(Boolean);
let padYWas = false, padSelectWas = false;

export const onRespawn = (fn: () => void) => { respawnFn = fn; };
export const onGhostLine = (fn: () => void) => { ghostLineFn = fn; };

// Gamepad rumble (docs/game-spec.md → Input), on the pad readInput reads. Magnitudes 0..1. Silent with no pad or no
// vibrationActuator (Firefox). A new effect replaces the one playing, so a weaker one is dropped while a stronger one
// plays, and a delayed one waits on a timer, not startDelay.
let delayed = 0, busyUntil = 0, busyMag = 0;
export function rumble(strong: number, weak: number, ms: number, delay = 0) {
  if (delay) { clearTimeout(delayed); delayed = setTimeout(rumble, delay, strong, weak, ms); return; }
  const now = performance.now(), mag = Math.max(strong, weak);
  if (now < busyUntil && mag < busyMag) return;
  clearTimeout(delayed); busyUntil = now + ms; busyMag = mag;
  try {
    firstPad()?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  } catch { /* unsupported: no rumble */ }
}
export function stopRumble() {
  clearTimeout(delayed); busyUntil = 0;
  try { firstPad()?.vibrationActuator?.reset().catch(() => {}); } catch { /* unsupported: nothing playing */ }
}

export function readInput(): Input {
  const up = k('KeyW', 'ArrowUp'), down = k('KeyS', 'ArrowDown');
  const inp: Input = {
    throttle: up, brake: down,
    steer: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'),
    pitch: up - down, // Airborne: W nose down, S nose up
    boost: !!k('Space', 'ShiftLeft', 'ShiftRight'),
  };
  const pad = firstPad();
  if (pad) {
    const sx = dz(pad.axes[0]), sy = dz(pad.axes[1]);
    if (sx) inp.steer = sx;
    if (sy) inp.pitch = -sy; // stick forward = nose down
    inp.throttle = Math.max(inp.throttle, pad.buttons[7]?.value ?? 0); // RT
    inp.brake = Math.max(inp.brake, pad.buttons[6]?.value ?? 0);       // LT
    inp.boost ||= !!pad.buttons[0]?.pressed;                           // A
    const y = !!pad.buttons[3]?.pressed;                               // Y
    if (y && !padYWas) respawnFn();
    padYWas = y;
    const sel = !!pad.buttons[8]?.pressed;                             // Select / Back
    if (sel && !padSelectWas) ghostLineFn();
    padSelectWas = sel;
  }
  return inp;
}
