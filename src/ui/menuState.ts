// The Menu, Pause and Finish screens as a pure state machine (docs/game-spec.md → Screens). No DOM: ui/menu.ts draws it
// and feeds it input; main.ts carries out the effects it returns.

export type Screen = 'menu' | 'select' | 'scores' | 'controls' | 'pause' | 'finish';
export type Item =
  | 'play' | 'scores' | 'controls'                         // Menu
  | { track: number }                                      // Track select
  | 'laps'                                                 // Track select, High scores: cycles the lap count
  | { reset: number | 'all' }                              // High scores
  | 'resume' | 'restart' | 'quit'                          // Pause
  | 'retry' | 'select' | 'menu';                           // Finish
// What the game must do. 'endRun' resets the run before another screen shows; the others close the overlay.
export type Effect = { start: number; laps: number } | 'restart' | 'resume' | 'endRun' | { reset: number | 'all' };
export type Action = { type: 'open'; screen: Screen } | { type: 'move'; dir: -1 | 1 } | { type: 'pick' } | { type: 'back' } | { type: 'tick'; dt: number };

export interface MenuState {
  screen: Screen | null;  // null: closed, the run is showing
  focus: number;
  lastFocus: Partial<Record<Screen, number>>; // so coming back to a screen restores its focus
  track: number;          // the last-raced Track: Track select starts on it
  laps: number;           // Laps per run, picked on Track select; High scores shows this lap count's tables
  armed: number;          // High scores: the reset item waiting for its second press, or -1
  armedT: number;         // seconds left to press it again
}

export const ARM_TIME = 3;
export const LAP_OPTIONS = [1, 3, 5], DEFAULT_LAPS = 3;
export const initialMenu = (): MenuState => ({ screen: null, focus: 0, lastFocus: {}, track: 0, laps: DEFAULT_LAPS, armed: -1, armedT: 0 });

export function itemsFor(screen: Screen | null, trackCount: number): Item[] {
  const tracks = Array.from({ length: trackCount }, (_, i) => i);
  switch (screen) {
    case 'menu': return ['play', 'scores', 'controls'];
    case 'select': return [...tracks.map(track => ({ track })), 'laps'];
    case 'scores': return [...tracks.map(reset => ({ reset })), { reset: 'all' }, 'laps'];
    case 'pause': return ['resume', 'restart', 'quit'];
    case 'finish': return ['retry', 'select', 'menu'];
    default: return []; // Controls has nothing to pick
  }
}

function open(s: MenuState, screen: Screen): MenuState {
  const lastFocus = s.screen ? { ...s.lastFocus, [s.screen]: s.focus } : s.lastFocus;
  const focus = screen === 'select' ? s.track : screen === 'menu' ? lastFocus.menu ?? 0 : 0;
  return { ...s, screen, focus, lastFocus, armed: -1 };
}
const close = (s: MenuState): MenuState => ({ ...s, screen: null, armed: -1 });

export function reduce(s: MenuState, a: Action, trackCount: number): [MenuState, Effect | null] {
  switch (a.type) {
    case 'open': return [open(s, a.screen), null];
    case 'tick':
      if (s.armed < 0) return [s, null];
      return [s.armedT - a.dt > 0 ? { ...s, armedT: s.armedT - a.dt } : { ...s, armed: -1, armedT: 0 }, null];
    case 'move': {
      const n = itemsFor(s.screen, trackCount).length;
      return [n ? { ...s, focus: (s.focus + a.dir + n) % n, armed: -1 } : s, null];
    }
    case 'back':
      if (s.screen === 'pause') return [close(s), 'resume'];
      if (s.screen === 'select' || s.screen === 'scores' || s.screen === 'controls') return [open(s, 'menu'), null];
      return [s, null]; // Menu and Finish have nowhere to go back to
    case 'pick': {
      const it = itemsFor(s.screen, trackCount)[s.focus];
      if (it === undefined) return [s, null];
      if (typeof it === 'object' && 'track' in it) return [{ ...close(s), track: it.track }, { start: it.track, laps: s.laps }];
      if (typeof it === 'object') { // a reset: the first press arms it, a second within ARM_TIME carries it out
        if (s.armed !== s.focus) return [{ ...s, armed: s.focus, armedT: ARM_TIME }, null];
        return [{ ...s, armed: -1, armedT: 0 }, { reset: it.reset }];
      }
      switch (it) {
        case 'laps': return [{ ...s, laps: LAP_OPTIONS[(LAP_OPTIONS.indexOf(s.laps) + 1) % LAP_OPTIONS.length], armed: -1 }, null];
        case 'play': return [open(s, 'select'), null];
        case 'scores': case 'controls': return [open(s, it), null];
        case 'resume': return [close(s), 'resume'];
        case 'restart': case 'retry': return [close(s), 'restart'];
        case 'quit': case 'menu': return [open(s, 'menu'), 'endRun'];
        case 'select': return [open(s, 'select'), 'endRun'];
      }
    }
  }
}
