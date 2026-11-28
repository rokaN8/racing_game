import { describe, expect, it } from 'vitest';
import { ARM_TIME, CLEARED_TIME, FINISH_LOCK, initialMenu, medalFor, medalTime, reduce, type Action, type Effect, type MenuState } from '../src/ui/menuState';

const N = 3; // Tracks
// Run actions from a state; returns the end state and every effect, in order.
function run(s: MenuState, ...actions: Action[]) {
  const effects: Effect[] = [];
  for (const a of actions) { const [next, e] = reduce(s, a, N); s = next; if (e) effects.push(e); }
  return { s, effects };
}
const open = (screen: MenuState['screen'] & string): Action => ({ type: 'open', screen });
const down: Action = { type: 'move', dir: 1 }, up: Action = { type: 'move', dir: -1 };
const left: Action = { type: 'adjust', dir: -1 }, right: Action = { type: 'adjust', dir: 1 };
const pick: Action = { type: 'pick' }, back: Action = { type: 'back' };
const tick = (dt: number): Action => ({ type: 'tick', dt });
const select = () => run(initialMenu(), open('menu'), pick).s; // Menu → Play → Track select

describe('Menu state', () => {
  it('Menu has Play, Stats, Settings and Controls; Play → Track select → a Track starts it and closes the overlay', () => {
    const { s, effects } = run(initialMenu(), open('menu'), pick, down, pick);
    expect(s.screen).toBeNull();
    expect(effects).toEqual([{ start: 1, laps: 3 }]);
    expect(s.track).toBe(1);
    expect(run(initialMenu(), open('menu'), down, pick).s.screen).toBe('stats');
    expect(run(initialMenu(), open('menu'), down, down, pick).s.screen).toBe('settings');
    expect(run(initialMenu(), open('menu'), down, down, down, pick).s.screen).toBe('controls');
    expect(run(initialMenu(), open('menu'), down, pick, back).s.screen).toBe('menu');
  });

  it('Track select starts on the last-raced Track; the Menu restores its focus', () => {
    let { s } = run(initialMenu(), open('menu'), pick, down, down, pick); // races Track 3
    ({ s } = run(s, open('finish'), tick(FINISH_LOCK), down, pick));      // Finish → Track select
    expect(s.screen).toBe('select');
    expect(s.focus).toBe(2);
    ({ s } = run(s, back, down, pick, back));                              // Menu → Stats → back
    expect(s.screen).toBe('menu');
    expect(s.focus).toBe(1);
  });

  it('focus wraps both ways', () => {
    expect(run(initialMenu(), open('menu'), up).s.focus).toBe(3);
    expect(run(initialMenu(), open('menu'), down, down, down, down).s.focus).toBe(0);
  });

  it('← → set the lap count on Track select, stopping at 1 and 5, and a Track starts with it', () => {
    const s = select();
    expect(s.laps).toBe(3);
    expect(run(s, right).s.laps).toBe(5);
    expect(run(s, right, right).s.laps).toBe(5);
    expect(run(s, left).s.laps).toBe(1);
    expect(run(s, left, left, right).s.laps).toBe(3);
    expect(run(s, right).s.focus).toBe(s.focus); // focus stays on the Track
    expect(run(s, left, pick).effects).toEqual([{ start: 0, laps: 1 }]);
  });

  it('elsewhere ← → move like ↑ ↓', () => {
    expect(run(initialMenu(), open('menu'), right).s.focus).toBe(1);
    expect(run(initialMenu(), open('pause'), left).s.focus).toBe(3);
  });

  it('Reset times sits under the Tracks and the Grand tour; back returns to it', () => {
    const r = run(select(), up, pick).s; // the last item
    expect(r.screen).toBe('reset');
    const b = run(r, back).s;
    expect(b).toMatchObject({ screen: 'select', focus: N + 1 });
  });

  it('the Grand tour sits after the Tracks: it starts a 1-Lap tour, and Track select comes back to it', () => {
    const at = run(select(), up, up).s; // Reset times, then the Grand tour above it
    const { s, effects } = run(at, right, pick); // the lap count doesn't apply
    expect(effects).toEqual([{ start: 'tour', laps: 1 }]);
    expect(s).toMatchObject({ screen: null, track: N });
    expect(run(s, open('select')).s.focus).toBe(N);
  });

  it('Reset times has a Grand tour row; All Tracks comes last', () => {
    const r = run(select(), up, pick).s;
    expect(run(r, { type: 'move', dir: -1 }, pick, pick).effects).toEqual([{ reset: 'all' }]); // up from Track 1 wraps to All Tracks
    expect(run({ ...r, focus: N }, pick, pick).effects).toEqual([{ reset: 'tour' }]);
  });

  it('a reset needs two presses within 3 s, then says it is done', () => {
    const r = run(select(), up, pick).s;
    expect(run(r, pick).effects).toEqual([]);                                     // armed only
    expect(run(r, pick, tick(ARM_TIME - 0.1), pick).effects).toEqual([{ reset: 0 }]);
    expect(run(r, pick, tick(ARM_TIME), pick).effects).toEqual([]);               // timed out: re-armed instead
    expect(run(r, pick, down, up, pick).effects).toEqual([]);                     // moving focus disarms
    expect(run(r, up, pick, pick).effects).toEqual([{ reset: 'all' }]);           // the last item resets all
    const done = run(r, pick, pick).s;
    expect(done).toMatchObject({ armed: -1, cleared: 0 });
    expect(run(done, tick(CLEARED_TIME)).s.cleared).toBeNull();
    expect(run(done, pick).effects).toEqual([]);                                  // and a third press starts over
  });

  it('Pause: Resume, Settings, Restart and Quit to Menu; Esc / B resumes', () => {
    const paused = run(initialMenu(), open('pause')).s;
    expect(run(paused, pick)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
    expect(run(paused, down, pick)).toMatchObject({ s: { screen: 'settings' }, effects: [] });
    expect(run(paused, down, down, pick)).toMatchObject({ s: { screen: null }, effects: ['restart'] });
    expect(run(paused, up, pick)).toMatchObject({ s: { screen: 'menu' }, effects: ['endRun'] });
    expect(run(paused, back)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
  });

  it('Settings: back returns to whichever opened it, Menu or Pause', () => {
    expect(run(initialMenu(), open('menu'), down, down, pick, back).s).toMatchObject({ screen: 'menu', focus: 2 });
    expect(run(initialMenu(), open('pause'), down, pick, back).s.screen).toBe('pause');
    expect(run(initialMenu(), open('pause'), down, pick, back, back)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
  });

  it('Settings: ← → step the focused row, Enter steps it forward', () => {
    const set = run(initialMenu(), open('settings')).s; // Music first
    expect(run(set, left).effects).toEqual([{ setting: 'music', dir: -1 }]);
    expect(run(set, down, right, pick).effects).toEqual([{ setting: 'sound', dir: 1 }, { setting: 'sound', dir: 1 }]);
    expect(run(set, down, right).s.focus).toBe(1); // focus stays on the row
  });

  it('Settings: Reset to defaults needs two presses within 3 s', () => {
    const last = run(initialMenu(), open('settings'), up).s;
    expect(run(last, pick)).toMatchObject({ s: { armed: last.focus }, effects: [] });
    expect(run(last, pick, pick)).toMatchObject({ s: { armed: -1, cleared: 'settings' }, effects: ['resetSettings'] });
    expect(run(last, pick, tick(ARM_TIME + 0.1), pick).effects).toEqual([]);
  });

  it('Finish: Retry, Track select and Menu; back does nothing', () => {
    const fin = run(initialMenu(), open('finish'), tick(FINISH_LOCK)).s;
    expect(run(fin, pick)).toMatchObject({ s: { screen: null }, effects: ['restart'] });
    expect(run(fin, down, pick)).toMatchObject({ s: { screen: 'select' }, effects: ['endRun'] });
    expect(run(fin, up, pick)).toMatchObject({ s: { screen: 'menu' }, effects: ['endRun'] });
    expect(run(fin, back)).toMatchObject({ s: { screen: 'finish' }, effects: [] });
  });

  it('Finish ignores a pick for its first moments, so a Boost tap at the line cannot skip it', () => {
    const fin = run(initialMenu(), open('finish')).s;
    expect(run(fin, pick)).toMatchObject({ s: { screen: 'finish' }, effects: [] });
    expect(run(fin, tick(FINISH_LOCK / 2), pick).effects).toEqual([]);
    expect(run(fin, tick(FINISH_LOCK), pick).effects).toEqual(['restart']);
  });

  it('back from Track select and Controls goes to the Menu; the Menu stays', () => {
    for (const k of [0, 1]) {
      const start = run(initialMenu(), open('menu'), ...Array<Action>(k).fill(down), pick).s;
      expect(run(start, back).s.screen).toBe('menu');
    }
    expect(run(initialMenu(), open('menu'), back).s.screen).toBe('menu');
  });
});

describe('Medals', () => {
  it('are set against the Pilot time: Neon for beating it, Gold at or under +5 %, Silver +12 %, Bronze +25 %', () => {
    const at: [number, string | null][] = [[90, 'Neon'], [99.99, 'Neon'], [100, 'Gold'], [105, 'Gold'], [105.01, 'Silver'],
      [112, 'Silver'], [112.01, 'Bronze'], [125, 'Bronze'], [125.01, null]];
    for (const [time, medal] of at) expect(medalFor(time, 100), `${time}`).toBe(medal);
    expect(medalFor(null, 100)).toBeNull(); // no times yet
  });

  it('compare to the hundredth, as the times are shown', () => {
    expect(medalTime('Gold', 52.93)).toBe(55.58); // 55.5765
    expect(medalFor(55.58, 52.93)).toBe('Gold');
    expect(medalFor(55.584, 52.93)).toBe('Gold'); // shows as 0:55.58 too
    expect(medalFor(55.59, 52.93)).toBe('Silver');
  });
});
