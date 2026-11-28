// Reactive music (docs/game-spec.md → Reactive music): the mix the Song glides to, and when the final-Lap layer plays.
import { describe, expect, it } from 'vitest';
import { AIR_DRUMS, AIR_HZ, BOOST_ARP, layerOn, leadNotes, mixFor, OPEN_HZ, type Ride } from '../src/audio/react';
import { MENU_SONG } from '../src/audio/songs';

const ride = (r: Partial<Ride> = {}): Ride => ({ racing: true, air: false, airT: 0, boost: false, layer: false, ...r });

describe('mixFor', () => {
  it('plays the Song as written on the Track and off a run', () => {
    for (const r of [ride(), ride({ racing: false, air: true, boost: true, layer: true })])
      expect(mixFor(r)).toMatchObject({ drums: 1, layer: 0, arpOpen: 1, hz: OPEN_HZ });
  });

  it('sinks the drums and muffles the mix at take-off, opening fully after 1.5 s of flight', () => {
    expect(mixFor(ride({ air: true, airT: 0 }))).toMatchObject({ drums: AIR_DRUMS, hz: AIR_HZ });
    const half = mixFor(ride({ air: true, airT: 0.75 })).hz;
    expect(half).toBeCloseTo(Math.sqrt(AIR_HZ * OPEN_HZ)); // halfway to the ear: the geometric mean
    expect(mixFor(ride({ air: true, airT: 3 })).hz).toBeCloseTo(OPEN_HZ);
  });

  it('opens the arp on Boost and brings in the layer', () => {
    expect(mixFor(ride({ boost: true })).arpOpen).toBe(BOOST_ARP);
    expect(mixFor(ride({ layer: true })).layer).toBe(1);
  });
});

describe('layerOn', () => {
  it('plays on the final Lap only', () => {
    expect([0, 1, 2].map(done => layerOn(3, done, 2, 5))).toEqual([false, false, true]);
  });

  it('joins a 1-Lap run once the last Checkpoint is passed', () => {
    expect([0, 3, 4].map(cp => layerOn(1, 0, cp, 5))).toEqual([false, false, true]);
    expect(layerOn(1, 0, 0, 1)).toBe(false); // a Track with only the start line: never
  });
});

describe('leadNotes', () => {
  it("holds each bar's root an octave up and the fifth above it, on the bar's first step", () => {
    const root = MENU_SONG.bars[1][2][0];
    expect(leadNotes(MENU_SONG, 16)).toEqual([root + 12, root + 19]);
    expect(leadNotes(MENU_SONG, 17)).toEqual([]);
  });
});
