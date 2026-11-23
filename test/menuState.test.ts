import { describe, expect, it } from 'vitest';
import { ARM_TIME, CLEARED_TIME, FINISH_LOCK, initialMenu, reduce, type Action, type Effect, type MenuState } from '../src/ui/menuState';

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
  it('Menu has Play and Controls; Play → Track select → a Track starts it and closes the overlay', () => {
    const { s, effects } = run(initialMenu(), open('menu'), pick, down, pick);
    expect(s.screen).toBeNull();
    expect(effects).toEqual([{ start: 1, laps: 3 }]);
    expect(s.track).toBe(1);
    expect(run(initialMenu(), open('menu'), down, pick).s.screen).toBe('controls');
  });

  it('Track select starts on the last-raced Track; the Menu restores its focus', () => {
    let { s } = run(initialMenu(), open('menu'), pick, down, down, pick); // races Track 3
    ({ s } = run(s, open('finish'), tick(FINISH_LOCK), down, pick));      // Finish → Track select
    expect(s.screen).toBe('select');
    expect(s.focus).toBe(2);
    ({ s } = run(s, back, down, pick, back));                              // Menu → Controls → back
    expect(s.screen).toBe('menu');
    expect(s.focus).toBe(1);
  });

  it('focus wraps both ways', () => {
    expect(run(initialMenu(), open('menu'), up).s.focus).toBe(1);
    expect(run(initialMenu(), open('menu'), down, down).s.focus).toBe(0);
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
    expect(run(initialMenu(), open('pause'), left).s.focus).toBe(2);
  });

  it('Reset times sits under the Tracks; back returns to it', () => {
    const r = run(select(), up, pick).s; // the last item
    expect(r.screen).toBe('reset');
    const b = run(r, back).s;
    expect(b).toMatchObject({ screen: 'select', focus: N });
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

  it('Pause: Resume, Restart and Quit to Menu; Esc / B resumes', () => {
    const paused = run(initialMenu(), open('pause')).s;
    expect(run(paused, pick)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
    expect(run(paused, down, pick)).toMatchObject({ s: { screen: null }, effects: ['restart'] });
    expect(run(paused, up, pick)).toMatchObject({ s: { screen: 'menu' }, effects: ['endRun'] });
    expect(run(paused, back)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
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
