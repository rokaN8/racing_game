// PROTOTYPE (throwaway, Speed feel and Finish cam ticket #83): three variants, picked with ?feel=A|B|C. Render and
// camera only, no physics. Never merged to main. Each variant pairs a Speed feel strength with a Finish cam style:
// streaks past the camera while Boosting, a shake on hard (Sketchy) landings and crashes, a colour split near Boost
// top speed; after the line, the camera blends from Chase into an orbit of the Bike behind the Finish screen.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Vector3, type PerspectiveCamera, type Scene } from 'three';
import type { BikeState } from '../bike/physics';

export const VARIANTS = {
  A: { name: 'Subtle: few thin streaks, light shake, no colour split; wide slow orbit', streaks: 40, bright: 0.35, shake: 0.12, split: 0, orbit: { R: 14, H: 4, w: 0.15, blend: 1.5 } },
  B: { name: 'Bold: dense streaks, firm shake, slight colour split; low close orbit', streaks: 120, bright: 0.6, shake: 0.3, split: 0.0025, orbit: { R: 8, H: 2, w: 0.3, blend: 0.8 } },
  C: { name: 'Arcade: heavy streaks, big shake, strong colour split; high crane orbit', streaks: 220, bright: 0.9, shake: 0.55, split: 0.006, orbit: { R: 20, H: 9, w: 0.2, blend: 1.2 } },
} as const;
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('feel');
export const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';
const V = key ? VARIANTS[key] : null;

// Streaks: short lines in camera space on a tube round the view axis, rushing past while Boosting.
const N = V?.streaks ?? 0, LEN = 6, NEAR = 4, FAR = 70;
const pts = new Float32Array(N * 6), cols = new Float32Array(N * 6), seeds: { a: number; r: number; z: number }[] = [];
for (let i = 0; i < N; i++) seeds.push({ a: Math.random() * Math.PI * 2, r: 2.5 + Math.random() * 6, z: -NEAR - Math.random() * (FAR - NEAR) });
const geo = new BufferGeometry();
geo.setAttribute('position', new BufferAttribute(pts, 3)); geo.setAttribute('color', new BufferAttribute(cols, 3));
const streaks = new LineSegments(geo, new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending, depthWrite: false, transparent: true }));
streaks.frustumCulled = false;
const rig = new Group(); rig.add(streaks);
let attached: Scene | null = null, level = 0, shakeT = 0, shakeAmp = 0, finishT = -1;
const from = new Vector3(), off = new Vector3();

// Each frame, after the chase camera's update. hit: a Sketchy landing or a crash this frame, for the shake.
export function speedFeel(scene: Scene, camera: PerspectiveCamera, st: BikeState, frame: number, hit: 'sketchy' | 'crash' | null, setSplit: (k: number) => void) {
  if (!V) return;
  if (attached !== scene) { attached?.remove(rig); scene.add(rig); attached = scene; }
  rig.position.copy(camera.position); rig.quaternion.copy(camera.quaternion);
  const speed = st.mode === 'track' ? st.speed : st.vel.length();
  level += ((st.boostT > 0 ? 1 : 0) - level) * (1 - Math.exp(-6 * frame));
  for (let i = 0; i < N; i++) {
    const s = seeds[i];
    s.z += speed * frame * 1.5; if (s.z > -NEAR) s.z -= FAR - NEAR;
    const x = Math.cos(s.a) * s.r, y = Math.sin(s.a) * s.r, k = V.bright * level * (1 - (-s.z - NEAR) / (FAR - NEAR));
    pts.set([x, y, s.z, x, y, s.z - LEN], i * 6);
    cols.set([0, k, k, 0, k * 0.2, k * 0.2], i * 6); // cyan head fading to the tail
  }
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
  // Shake on a Sketchy landing or a crash, decaying over 0.3 s
  if (hit) { shakeT = 0.3; shakeAmp = V.shake * (hit === 'crash' ? 1.6 : 1); }
  if (shakeT > 0) {
    shakeT -= frame;
    const a = shakeAmp * Math.max(0, shakeT / 0.3);
    camera.position.add(off.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a));
  }
  // Colour split near Boost top speed (55 + 20): 0 below 60 m/s, full at 75
  setSplit(V.split * level * Math.min(1, Math.max(0, (speed - 60) / 15)));
}

// The Finish cam, while the Finish screen is up: blend from where the chase camera was into an orbit of the Bike.
export function finishCam(camera: PerspectiveCamera, st: BikeState, finished: boolean, frame: number) {
  if (!V) return false;
  if (!finished) { finishT = -1; return false; }
  const o = V.orbit;
  if (finishT < 0) { finishT = 0; from.copy(camera.position); }
  finishT += frame;
  const start = Math.atan2(from.x - st.pos.x, from.z - st.pos.z), th = start + o.w * finishT;
  const orbit = st.pos.clone().add(off.set(Math.sin(th) * o.R, o.H, Math.cos(th) * o.R));
  const k = Math.min(1, finishT / o.blend), e = k * k * (3 - 2 * k);
  camera.position.lerpVectors(from, orbit, e);
  camera.up.set(0, 1, 0); camera.lookAt(st.pos);
  return true;
}

// Floating switcher: ‹ › (or [ ]) cycles the variant and reloads.
if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('feel', KEYS[(KEYS.indexOf(key!) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const e = document.createElement('button'); e.textContent = t; e.onclick = () => go(d); return e; };
  const label = document.createElement('span'); label.textContent = `PROTOTYPE ${key} (${VARIANTS[key].name})`;
  bar.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); });
}
