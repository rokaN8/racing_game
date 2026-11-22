// Every Track in the game, in the order the Menu lists them (docs/game-spec.md → Tracks).
import type { ControlPoint } from '../bake';
import { overdrive } from './allround';

export interface TrackDef {
  id: string;      // stable: storage keys use it, so never rename one
  name: string;    // display name
  kind: string;    // shown under the name, e.g. 'All-rounder'
  cps: ControlPoint[];
  gapSegments: number[];   // segments (cp i → i+1) with no geometry
  checkpointCps: number[]; // control points that are Checkpoints; the first is the start line
  halfWidth: number;
}

export const TRACKS: TrackDef[] = [overdrive];

// Unknown or missing id → the first Track.
export const trackById = (id: string | null) => TRACKS.find(t => t.id === id) ?? TRACKS[0];
