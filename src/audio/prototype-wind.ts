// PROTOTYPE (throwaway, Wind and Ghost whoosh ticket #86): three variants, picked with ?sound=A|B|C (none: the game
// as it is). Synth only, off audio.ts's context, master and noise buffer. Never merged to main.
//   A Subtle: soft wind, a faint hollow tone in the air, a thin hiss in the last 1.5 m to the edge; a short panned
//     noise swish at the moment of a pass.
//   B Present: wind that brightens with speed, a resonant howl in the air, a hiss from 3 m out that rises in pitch;
//     a continuous Doppler: the Ghost hisses as it nears, panned live, its pitch dropping as it goes past.
//   C Arcade: gusty wind, a tremolo tone in the air, rumble-strip pulses from 2 m out (one per 4 m ridden); a tonal
//     swoop on a pass.
import { audioNodes } from '../audio';

export const VARIANTS = {
  A: 'Subtle: soft wind, faint air tone, thin edge hiss (1.5 m); swish on pass',
  B: 'Present: bright wind, air howl, rising hiss (3 m); live Doppler Ghost',
  C: 'Arcade: gusty wind, tremolo air tone, rumble pulses (2 m); swoop on pass',
} as const;
type Key = keyof typeof VARIANTS;
export const KEYS = Object.keys(VARIANTS) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('sound');
export const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

// What the prototype hears each frame. edge: metres to the Track edge (null in the air). ghost: the Ghost relative
// to the camera: ahead (+) or behind, side (−1 left … +1 right), distance.
export interface Feel { dt: number; racing: boolean; speed: number; air: boolean; edge: number | null; ghost: { ahead: number; side: number; dist: number } | null }

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const debug = { edge: '', ghost: '', pass: '' };

type Nodes = NonNullable<ReturnType<typeof audioNodes>>;
function build({ ctx, master, noise }: Nodes) {
  const loop = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };
  const chain = (type: BiquadFilterType, f: number, q = 1) => {
    const flt = ctx.createBiquadFilter(), g = ctx.createGain();
    flt.type = type; flt.frequency.value = f; flt.Q.value = q; g.gain.value = 0;
    loop().connect(flt).connect(g).connect(master);
    return { flt, g };
  };
  const wind = chain('bandpass', 500, 0.7), hollow = chain('bandpass', key === 'A' ? 380 : 600, key === 'A' ? 12 : 25), hiss = chain('highpass', 5000);
  const tone = ctx.createOscillator(), toneG = ctx.createGain(); // C's air tone
  tone.type = 'triangle'; tone.frequency.value = 110; toneG.gain.value = 0; tone.connect(toneG).connect(master); tone.start();
  // B's live Ghost: noise → band-pass → panner → gain
  const gf = ctx.createBiquadFilter(), gp = ctx.createStereoPanner(), gg = ctx.createGain();
  gf.type = 'bandpass'; gf.Q.value = 2; gg.gain.value = 0; loop().connect(gf).connect(gp).connect(gg).connect(master);

  const set = (p: AudioParam, v: number, tau = 0.05) => p.setTargetAtTime(v, ctx.currentTime, tau);
  // a one-shot pass sound, panned to `side`
  const swish = (side: number) => {
    const t = ctx.currentTime, pan = ctx.createStereoPanner(), g = ctx.createGain();
    pan.connect(g).connect(master);
    if (key === 'A') {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      s.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.4);
      pan.pan.value = clamp(side * 1.5, -1, 1);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      s.connect(f).connect(pan); s.start(t, Math.random() * 0.5); s.stop(t + 0.4);
    } else {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(350, t + 0.5);
      pan.pan.setValueAtTime(clamp(side * 0.3, -1, 1), t); pan.pan.linearRampToValueAtTime(clamp(side * 1.5, -1, 1), t + 0.5);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(pan); o.start(t); o.stop(t + 0.5);
    }
  };

  let lastAhead: number | null = null, ridden = 0;
  return (f: Feel) => {
    const v = clamp(f.speed / 75), t = ctx.currentTime, on = f.racing ? 1 : 0;
    const near = (start: number) => (f.edge === null ? 0 : clamp(1 - f.edge / start)); // 0 far … 1 at the edge
    ridden += f.speed * f.dt;
    if (key === 'A') {
      set(wind.g.gain, on * 0.08 * v * v * (f.air ? 0.4 : 1)); set(wind.flt.frequency, 500 + 500 * v);
      set(hollow.g.gain, on * (f.air ? 0.6 : 0));
      set(hiss.g.gain, on * 0.05 * near(1.5) ** 2);
    } else if (key === 'B') {
      set(wind.g.gain, on * 0.15 * v * v * (f.air ? 0.3 : 1)); set(wind.flt.frequency, 400 + 1600 * v);
      set(hollow.g.gain, on * (f.air ? 1.2 * (0.3 + 0.7 * v) : 0)); set(hollow.flt.frequency, 500 + 300 * v);
      const k = near(3); set(hiss.g.gain, on * 0.12 * k ** 1.5); set(hiss.flt.frequency, 3000 + 4000 * k);
    } else {
      const gust = 0.7 + 0.3 * Math.sin(t * 1.3) * Math.sin(t * 0.37);
      set(wind.g.gain, on * 0.1 * v * v * gust * (f.air ? 0.5 : 1)); set(wind.flt.frequency, 600 + 900 * v * gust);
      set(toneG.gain, on * (f.air ? 0.06 * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 6)) : 0), 0.01);
      const pulse = (ridden / 4) % 1 < 0.35 ? 1 : 0; // a rumble strip: one pulse per 4 m
      set(hiss.g.gain, on * 0.14 * near(2) * pulse, 0.005); set(hiss.flt.frequency, 1500);
    }

    // The Ghost: a pass is the Ghost crossing the camera's side-to-side line within 12 m
    const g = f.racing ? f.ghost : null;
    if (key === 'B') {
      const prox = g ? clamp(1 - g.dist / 20) : 0, closing = g && lastAhead !== null ? -(g.ahead - lastAhead) / Math.max(f.dt, 1e-3) : 0;
      set(gg.gain, 0.3 * prox * prox); if (g) set(gp.pan, clamp(g.side * 1.5, -1, 1));
      set(gf.frequency, 1100 * (1 + clamp(Math.sign(g?.ahead ?? 0) * closing / 40, -0.5, 0.5)), 0.08);
    }
    if (g && lastAhead !== null && g.dist < 12 && Math.sign(g.ahead) !== Math.sign(lastAhead) && g.ahead !== 0) {
      debug.pass = `${g.ahead < 0 ? 'you passed it' : 'it passed you'} (${g.side < 0 ? 'left' : 'right'})`;
      if (key !== 'B') swish(g.side);
    }
    lastAhead = g ? g.ahead : null;
    debug.edge = f.edge === null ? 'air' : `${f.edge.toFixed(1)} m`;
    debug.ghost = g ? `${g.ahead.toFixed(0)} m ahead, side ${g.side.toFixed(2)}` : '—';
  };
}

let update: ((f: Feel) => void) | null = null;
export function windProto(f: Feel) {
  if (!key) return;
  const a = audioNodes();
  if (!a) return;
  (update ??= build(a))(f);
}

// The switcher: ‹ label ›, reloads with the next ?sound=. Dev builds only.
export function mountSwitcher() {
  if (!import.meta.env.DEV) return;
  const all = [null, ...KEYS] as (Key | null)[], el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:99;background:#fff;color:#000;font:13px sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px #0008;display:flex;gap:10px;align-items:center';
  const go = (d: number) => {
    const next = all[(all.indexOf(key) + d + all.length) % all.length], u = new URL(location.href);
    if (next) u.searchParams.set('sound', next); else u.searchParams.delete('sound');
    location.href = u.href;
  };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span');
  const show = () => { label.textContent = key ? `${key} (${VARIANTS[key]}) · edge ${debug.edge} · Ghost ${debug.ghost} · last pass: ${debug.pass || '—'}` : 'off (the game as it is)'; };
  show(); setInterval(show, 200);
  el.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(el);
}
