// Reactive music (docs/game-spec.md → Reactive music): how the Song follows the ride. Pure; audio.ts applies it.
// Airborne: the drums sink to 30 % and the whole mix goes muffled, opening up over 1.5 s of flight. Boost: the arp's
// filter opens ×3. Final Lap: a sawtooth lead joins, holding each chord's root and fifth.
import type { Song } from './songs';

export const AIR_DRUMS = 0.3, AIR_HZ = 600, OPEN_HZ = 20000, AIR_OPEN_T = 1.5, BOOST_ARP = 3;
export interface Ride { racing: boolean; air: boolean; airT: number; boost: boolean; layer: boolean }
// The mix to glide to. hz: the music's low-pass; hzTau: how fast it glides (setTargetAtTime's time constant).
export interface Mix { drums: number; layer: number; arpOpen: number; hz: number; hzTau: number }

// Off a run (countdown, screens, Finish), the Song plays as written.
export function mixFor(r: Ride): Mix {
  if (!r.racing) return { drums: 1, layer: 0, arpOpen: 1, hz: OPEN_HZ, hzTau: 0.1 };
  const open = Math.min(1, r.airT / AIR_OPEN_T);
  return {
    drums: r.air ? AIR_DRUMS : 1, layer: r.layer ? 1 : 0, arpOpen: r.boost ? BOOST_ARP : 1,
    hz: r.air ? AIR_HZ * (OPEN_HZ / AIR_HZ) ** open : OPEN_HZ, hzTau: r.air ? 0.05 : 0.1, // exponential: even to the ear
  };
}

// Whether the final-Lap layer plays: on the last Lap; in a 1-Lap run, once the last Checkpoint is passed.
// lapsDone: Laps closed this run. lastCP: the last Checkpoint passed (0 = the start). cpCount: Checkpoints a Lap.
export function layerOn(laps: number, lapsDone: number, lastCP: number, cpCount: number) {
  return laps > 1 ? lapsDone === laps - 1 : cpCount > 1 && lastCP === cpCount - 1;
}

// The layer's notes at step n: on each bar's first step, the chord's root an octave up and the fifth above that.
export const leadNotes = (song: Song, n: number): number[] => {
  if (n % 16) return [];
  const root = song.bars[Math.floor(n / 16) % song.bars.length][2][0];
  return [root + 12, root + 19];
};
