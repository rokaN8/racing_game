// Every Track in the game, in the order the Menu lists them (docs/game-spec.md → Tracks).
import type { Song } from '../../audio/songs';
import type { Palette } from '../../render/palette';
import type { ControlPoint } from '../bake';
import { overdrive } from './allround';
import { hangTime } from './bigair';
import { slipstream } from './flow';
import { switchback } from './technical';

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
}

export const TRACKS: TrackDef[] = [overdrive, switchback, hangTime, slipstream];
