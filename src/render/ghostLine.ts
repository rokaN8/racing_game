// The Ghost line (docs/game-spec.md → Ghost line): your own Ghost's line, as dots on the Track ahead of the Bike, to
// teach the racing line. A dot every ~4 m for 120 m, the Ghost's white at most 13 %, fading out with distance; drawn
// additively, so the fade sinks into the Track and nothing reaches the bloom threshold. Off until G (or Select)
// switches it on; the choice is kept in localStorage when storage works.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial, Quaternion, Vector3, type Scene } from 'three';

const KEY = 'neon-racer.ghostLine', AHEAD = 120, EVERY = 4, PEAK = 0.13, MAX = AHEAD / EVERY + 2;
const STRIDE = 7, HOP = 3 * STRIDE; // ghost.ts pose layout; look at every 3rd pose (~1.4 m at top speed)

let on = false;
try { on = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: off */ }
export function toggleGhostLine() {
  on = !on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked: lasts this session */ }
}

export function createGhostLine() {
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3)); geo.setAttribute('color', new BufferAttribute(col, 3));
  const dots = new Points(geo, new PointsMaterial({ size: 0.35, vertexColors: true, blending: AdditiveBlending, depthWrite: false, transparent: true }));
  dots.frustumCulled = false;
  const a = new Vector3(), b = new Vector3(), up = new Vector3(), q = new Quaternion();
  return {
    // Each frame: the live Track's scene, and ghost.lineAhead(bike) (null hides it).
    update(scene: Scene, line: { poses: Float32Array; from: number } | null) {
      if (dots.parent !== scene) scene.add(dots);
      dots.visible = on && line !== null;
      if (!dots.visible || !line) return;
      const p = line.poses, at = (i: number, out: Vector3) => { // the pose's position, lifted just off the deck
        up.set(0, 1, 0).applyQuaternion(q.set(p[i + 3], p[i + 4], p[i + 5], p[i + 6]));
        return out.set(p[i], p[i + 1], p[i + 2]).addScaledVector(up, 0.06);
      };
      let n = 0, travelled = 0, next = 0;
      for (let i = line.from; i + HOP + STRIDE <= p.length && n < MAX; i += HOP) {
        at(i, a); at(i + HOP, b);
        const step = a.distanceTo(b);
        if (step > 30) break; // the Ghost respawned here: its line jumps
        if (travelled >= next) {
          const k = PEAK * Math.max(0, 1 - travelled / AHEAD) ** 1.5;
          pos.set([a.x, a.y, a.z], n * 3); col.set([k, k, k], n * 3); n++; next += EVERY;
        }
        travelled += step;
        if (travelled > AHEAD) break;
      }
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
  };
}
