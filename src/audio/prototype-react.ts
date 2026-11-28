// PROTOTYPE (throwaway, Reactive music ticket #87): three variants, picked with ?music=A|B|C (none: the game as it
// is). The Song follows the ride: what drops out while Airborne, how the arp opens on Boost, and the extra layer on the
// final Lap. Never merged to main. Per-voice gains here are global reactions applied to every Song alike (each Song
// keeps its own per-voice vol in its data).
//   A Gentle: in the air the drums fade and a high-pass rises a little (300 Hz); Boost opens the arp ×2. Final Lap:
//     the arp doubled an octave up. 1-Lap runs: the layer plays from GO.
//   B Drop: in the air drums and bass cut at once and a high-pass riser climbs with airtime (200 Hz → 2 kHz); landing
//     slams it all back. Boost opens the arp ×4 and louder. Final Lap: 16th hats. 1-Lap runs: no layer.
//   C Underwater: in the air the drums sink to 30 % and the whole mix goes muffled (600 Hz), opening up over 1.5 s of
//     flight; Boost opens the arp ×3. Final Lap: a sawtooth lead holding the chord's root and fifth. 1-Lap runs: the
//     layer joins after the last Checkpoint.
import type { Song } from './songs';

export const VARIANTS = {
  A: 'Gentle: drums fade + slight high-pass in air; arp ×2 on Boost; octave arp on final Lap (1 Lap: from GO)',
  B: 'Drop: drums+bass cut + riser in air, slam on landing; arp ×4 on Boost; 16th hats (1 Lap: none)',
  C: 'Underwater: muffled mix opening in air; arp ×3 on Boost; saw lead (1 Lap: after last Checkpoint)',
} as const;
type Key = keyof typeof VARIANTS;
export const KEYS = Object.keys(VARIANTS) as Key[];
const param = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('music');
export const key: Key | null = param === null ? null : KEYS.includes(param as Key) ? (param as Key) : 'A';

export interface Ride { racing: boolean; air: boolean; airT: number; boost: boolean; layer: boolean }
// What the mix should be now. tau: how fast to get there (setTargetAtTime's time constant).
export interface Mix { drums: number; bass: number; arp: number; layer: number; arpOpen: number; filter: BiquadFilterType; hz: number; tau: number; hzTau: number }
const REST: Mix = { drums: 1, bass: 1, arp: 1, layer: 0, arpOpen: 1, filter: 'highpass', hz: 10, tau: 0.08, hzTau: 0.1 };

export function mixFor(r: Ride): Mix {
  if (!key || !r.racing) return { ...REST, filter: key === 'C' ? 'lowpass' : 'highpass', hz: key === 'C' ? 20000 : 10 };
  const layer = r.layer ? 1 : 0, boost = r.boost;
  if (key === 'A') return r.air
    ? { ...REST, drums: 0, layer, arpOpen: boost ? 2 : 1, arp: boost ? 1.3 : 1, hz: 300, tau: 0.15, hzTau: 0.3 }
    : { ...REST, layer, arpOpen: boost ? 2 : 1, arp: boost ? 1.3 : 1, tau: 0.05 };
  if (key === 'B') return r.air
    ? { ...REST, drums: 0, bass: 0, layer, arpOpen: boost ? 4 : 1, arp: boost ? 1.5 : 1, hz: Math.min(2000, 200 * 2 ** (r.airT * 1.5)), tau: 0.03, hzTau: 0.05 }
    : { ...REST, layer, arpOpen: boost ? 4 : 1, arp: boost ? 1.5 : 1, tau: 0.01, hzTau: 0.01 };
  const open = Math.min(1, r.airT / 1.5); // C: 600 Hz at take-off, fully open after 1.5 s
  return r.air
    ? { ...REST, drums: 0.3, layer, arpOpen: boost ? 3 : 1, filter: 'lowpass', hz: 600 * (20000 / 600) ** open, tau: 0.1, hzTau: 0.05 }
    : { ...REST, layer, arpOpen: boost ? 3 : 1, filter: 'lowpass', hz: 20000, tau: 0.1, hzTau: 0.1 };
}

// Whether the final-Lap layer plays. lapsDone: Laps closed this run.
export function layerOn(laps: number, lapsDone: number, lastCP: number, cpCount: number) {
  if (laps > 1) return lapsDone === laps - 1;
  if (key === 'A') return true;
  if (key === 'B') return false;
  return lastCP === cpCount - 1 && cpCount > 1;
}

// The layer's notes at step n: arp (A, an octave over the Song's arp), hat (B, every 16th), lead (C, held chord).
export type LayerNote = { kind: 'arp' | 'lead'; midi: number } | { kind: 'hat' };
export function layerEvents(song: Song, n: number): LayerNote[] {
  const [, , chord] = song.bars[Math.floor(n / 16) % song.bars.length], s = n % 16;
  if (key === 'A') { const a = song.arp.pat[s]; return a === '.' ? [] : [{ kind: 'arp', midi: (a === 'h' ? chord[0] + 12 : chord[+a]) + song.arp.oct + 12 }]; }
  if (key === 'B') return song.drums.hat[s] === 'x' ? [] : [{ kind: 'hat' }];
  return s === 0 ? [{ kind: 'lead', midi: chord[0] + 12 }, { kind: 'lead', midi: chord[0] + 19 }] : [];
}

export const debug = { ride: '' };
// The switcher: ‹ label ›, reloads with the next ?music=. Dev builds only.
export function mountSwitcher() {
  if (!import.meta.env.DEV) return;
  const all = [null, ...KEYS] as (Key | null)[], el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:99;background:#fff;color:#000;font:13px sans-serif;padding:6px 10px;border-radius:999px;box-shadow:0 2px 8px #0008;display:flex;gap:10px;align-items:center';
  const go = (d: number) => {
    const next = all[(all.indexOf(key) + d + all.length) % all.length], u = new URL(location.href);
    if (next) u.searchParams.set('music', next); else u.searchParams.delete('music');
    location.href = u.href;
  };
  const btn = (t: string, d: number) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => go(d); return b; };
  const label = document.createElement('span');
  const show = () => { label.textContent = key ? `${key} (${VARIANTS[key]}) · ${debug.ride}` : 'off (the game as it is)'; };
  show(); setInterval(show, 200);
  el.append(btn('‹', -1), label, btn('›', 1));
  document.body.append(el);
}
