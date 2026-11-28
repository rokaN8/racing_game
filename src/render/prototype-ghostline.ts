// PROTOTYPE (throwaway, Ghost line ticket #82): three looks for the Ghost's line drawn on the Track ahead of the Bike,
// picked with ?ghostline=A|B|C (on every Track; the Pilot Ghost's line too). Never merged to main.
// The line is the rival's recorded poses from where it first got as far round as the Bike, lifted just off the deck.
// Colours fade to black under AdditiveBlending, so they vanish into the Track; the brightest stays below the bloom.
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Points, PointsMaterial, Vector3, type Scene } from 'three';

export const VARIANTS = {
  A: 'Dots: a dot every ~4 m for 120 m, fading out',
  B: 'Line: a thin continuous line on the deck for 200 m, fading out',
  C: 'Chevrons: a chevron every 10 m for 80 m, pointing along the Ghost\'s heading',
} as const;
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('ghostline');
export const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';
const AHEAD = { A: 120, B: 200, C: 80 }, MAX = 600, PEAK = 0.13; // PEAK: the line's brightest, as a share of white

const STRIDE = 7;
const pos = new Float32Array(MAX * 3 * 2), col = new Float32Array(MAX * 3 * 2);
const geo = new BufferGeometry();
geo.setAttribute('position', new BufferAttribute(pos, 3)); geo.setAttribute('color', new BufferAttribute(col, 3));
const obj = key === 'A'
  ? new Points(geo, new PointsMaterial({ size: 0.35, vertexColors: true, blending: AdditiveBlending, depthWrite: false, transparent: true }))
  : new LineSegments(geo, new LineBasicMaterial({ vertexColors: true, blending: AdditiveBlending, depthWrite: false, transparent: true }));
obj.frustumCulled = false;
let attached: Scene | null = null;

const up = new Vector3(), fwd = new Vector3(), side = new Vector3(), a = new Vector3(), b = new Vector3();
// `line`: from ghost.lineAhead(bike); `scene`: the live Track's scene.
export function updateGhostLine(scene: Scene, line: { poses: Float32Array; from: number } | null, visible: boolean) {
  if (!key) return;
  if (attached !== scene) { attached?.remove(obj); scene.add(obj); attached = scene; }
  obj.visible = visible && line !== null;
  if (!obj.visible || !line) return;
  const p = line.poses, ahead = AHEAD[key];
  let n = 0, travelled = 0, lastMark = -Infinity;
  const at = (i: number, out: Vector3) => {
    up.set(0, 1, 0).applyQuaternion({ x: p[i + 3], y: p[i + 4], z: p[i + 5], w: p[i + 6] } as never);
    return out.set(p[i], p[i + 1], p[i + 2]).addScaledVector(up, 0.06);
  };
  const put = (v: Vector3, k: number) => { pos.set([v.x, v.y, v.z], n * 3); col.set([k, k, k], n * 3); n++; };
  for (let i = line.from; i + 2 * STRIDE <= p.length && n < MAX * 2 - 6; i += STRIDE * 3) {
    at(i, a); at(i + STRIDE * 3 < p.length ? i + STRIDE * 3 : i, b);
    const step = a.distanceTo(b);
    if (step > 30) break; // a respawn jump
    const fade = PEAK * Math.max(0, 1 - travelled / ahead) ** 1.5;
    if (key === 'B') { put(a, fade); put(b, PEAK * Math.max(0, 1 - (travelled + step) / ahead) ** 1.5); }
    else if (travelled - lastMark >= (key === 'A' ? 4 : 10)) {
      lastMark = travelled;
      if (key === 'A') put(a, fade);
      else { // a chevron: two arms back from the tip at a
        fwd.subVectors(b, a).normalize(); side.crossVectors(fwd, up).normalize();
        const tail = a.clone().addScaledVector(fwd, -1.6);
        put(a, fade); put(tail.clone().addScaledVector(side, 1.2), fade);
        put(a, fade); put(tail.clone().addScaledVector(side, -1.2), fade);
      }
    }
    travelled += step;
    if (travelled > ahead) break;
  }
  geo.setDrawRange(0, n);
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = true;
}

// Floating switcher: ‹ › (or [ ]) cycles the variant and reloads; G toggles the line.
export let shown = true;
if (key && typeof document !== 'undefined') {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;'
    + 'padding:6px 14px;border-radius:999px;background:#fff;color:#000;font:600 13px system-ui;box-shadow:0 2px 12px #0008';
  const go = (d: number) => { const u = new URL(location.href); u.searchParams.set('ghostline', KEYS[(KEYS.indexOf(key!) + d + KEYS.length) % KEYS.length]); location.href = u.href; };
  const btn = (t: string, d: number) => { const e = document.createElement('button'); e.textContent = t; e.onclick = () => go(d); return e; };
  const label = document.createElement('span'); label.textContent = `PROTOTYPE ${key} (${VARIANTS[key]}) · G toggles`;
  bar.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(bar);
  addEventListener('keydown', e => { if (e.key === '[') go(-1); if (e.key === ']') go(1); if (e.key === 'g' || e.key === 'G') shown = !shown; });
}
