// Every Track in the game, in the order the Menu lists them (docs/game-spec.md → Tracks).
import type { Song } from '../../audio/songs';
import type { Pilot } from '../../pilot';
import type { Palette } from '../../render/palette';
import type { ControlPoint } from '../bake';
import { overdrive } from './allround';
import { hangTime } from './bigair';
import { afterglow } from './flight';
import { slipstream } from './flow';
import { switchback } from './technical';
import { vertigo } from './climb';
import { knot } from './crossings';

export interface TrackDef {
  id: string;      // stable: storage keys use it, so never rename one
  name: string;    // display name
  kind: string;    // shown under the name, e.g. 'All-rounder'
  cps: ControlPoint[];
  gapSegments: number[];   // segments (cp i → i+1) with no geometry
  checkpointCps: number[]; // control points that are Checkpoints; the first is the start line
  halfWidth: number;
  palette: Palette;
  song: Song;
  boostPads?: { cp: number; len: number }[]; // Boost pads: a strip len m long from control point cp
  tunnels?: { cp: number; len: number }[];   // Tunnels: len m long from control point cp; looks only
  pilot: Pilot;    // how the Pilot rides its fastest clean run: the Pilot Ghost
  pilotTimes: Record<1 | 3 | 5, number>; // the Pilot's run time at each of LAP_OPTIONS, which the Medals are set from (test/track.test.ts checks them)
}

export const TRACKS: TrackDef[] = [overdrive, switchback, hangTime, slipstream, afterglow, vertigo, knot];
