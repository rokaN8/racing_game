// Crash explosion: a short burst of square glowing pixels thrown off the Bike, stepped at a low frame rate for a
// retro pixel look. One instance, moved into whichever Track scene is drawn.
import { BufferAttribute, BufferGeometry, Color, Points, PointsMaterial, Quaternion, Vector3 } from 'three';

export const EXPLOSION_T = 0.8; // s
const N = 120, FPS = 12, GRAV = 9, SIZE = 0.3; // pixels, stepped frame rate, m/s² pull-down, pixel size in m
const COLORS = [0x00ffff, 0x00ffff, 0xffffff, 0xff4a10, 0xff7a00].map(c => new Color(c)); // the Bike's own neon

export function createExplosion() {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), p0 = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3)); geo.setAttribute('color', new BufferAttribute(col, 3));
  // PointsMaterial draws squares: the pixels
  const mat = new PointsMaterial({ size: SIZE, vertexColors: true, transparent: true, depthWrite: false });
  const points = new Points(geo, mat); points.frustumCulled = false; points.visible = false;
  const o = new Vector3(), d = new Vector3();
  let t = EXPLOSION_T;

  function update(dt: number) {
    t += dt;
    if (t >= EXPLOSION_T) { points.visible = false; return; }
    const ts = Math.floor(t * FPS) / FPS; // stepped, not smooth
    for (let i = 0; i < N * 3; i += 3) {
      pos[i] = p0[i] + vel[i] * ts;
      pos[i + 1] = p0[i + 1] + vel[i + 1] * ts - (GRAV / 2) * ts * ts;
      pos[i + 2] = p0[i + 2] + vel[i + 2] * ts;
    }
    geo.attributes.position.needsUpdate = true;
    const k = ts / EXPLOSION_T;
    mat.opacity = 1 - k; mat.size = ts === 0 ? SIZE * 1.8 : SIZE * (1 - 0.5 * k); // big pop on the first step, then shrink
  }

  return {
    points,
    update: (dt: number) => { if (points.visible) update(dt); },
    start(at: Vector3, q: Quaternion) {
      for (let i = 0; i < N; i++) {
        o.set((Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.6, (Math.random() - 0.5) * 2.2).applyQuaternion(q).add(at); // off the Bike's body
        d.randomDirection(); d.y = Math.abs(d.y) * 0.8 + 0.2; d.multiplyScalar(3 + Math.random() * 9); // mostly up and out
        o.toArray(p0, i * 3); d.toArray(vel, i * 3); COLORS[i % COLORS.length].toArray(col, i * 3);
      }
      geo.attributes.color.needsUpdate = true;
      points.visible = true; t = 0; update(0);
    },
  };
}
