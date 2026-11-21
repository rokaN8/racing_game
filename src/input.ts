// Keyboard → physics Input. Gamepad and Boost arrive in M3.
import type { Input } from './bike/physics';

const keys = new Set<string>();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

const k = (...codes: string[]) => (codes.some(c => keys.has(c)) ? 1 : 0);

export const onRespawnKey = (fn: () => void) =>
  addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat) fn(); });

export const readInput = (): Input => ({
  throttle: k('KeyW', 'ArrowUp'),
  brake: k('KeyS', 'ArrowDown'),
  steer: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'),
  pitch: k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), // Airborne: W nose down, S nose up
});
