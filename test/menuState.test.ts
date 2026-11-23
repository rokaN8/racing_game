import { describe, expect, it } from 'vitest';
import { ARM_TIME, initialMenu, reduce, type Action, type Effect, type MenuState } from '../src/ui/menuState';

const N = 3; // Tracks
// Run actions from a state; returns the end state and every effect, in order.
function run(s: MenuState, ...actions: Action[]) {
  const effects: Effect[] = [];
  for (const a of actions) { const [next, e] = reduce(s, a, N); s = next; if (e) effects.push(e); }
  return { s, effects };
}
const open = (screen: MenuState['screen'] & string): Action => ({ type: 'open', screen });
const down: Action = { type: 'move', dir: 1 }, up: Action = { type: 'move', dir: -1 };
const pick: Action = { type: 'pick' }, back: Action = { type: 'back' };
const tick = (dt: number): Action => ({ type: 'tick', dt });

describe('Menu state', () => {
  it('Menu → Play → Track select → a Track starts it and closes the overlay', () => {
    const { s, effects } = run(initialMenu(), open('menu'), pick, down, pick);
    expect(s.screen).toBeNull();
    expect(effects).toEqual([{ start: 1, laps: 3 }]);
    expect(s.track).toBe(1);
  });

  it('Track select starts on the last-raced Track; the Menu restores its focus', () => {
    let { s } = run(initialMenu(), open('menu'), pick, down, down, pick); // races Track 3
    ({ s } = run(s, open('finish'), down, pick));                        // Finish → Track select
    expect(s.screen).toBe('select');
    expect(s.focus).toBe(2);
    ({ s } = run(s, back, down, down, pick, back));                       // Menu → Controls → back
    expect(s.screen).toBe('menu');
    expect(s.focus).toBe(2);
  });

  it('focus wraps both ways', () => {
    expect(run(initialMenu(), open('menu'), up).s.focus).toBe(2);
    expect(run(initialMenu(), open('menu'), down, down, down).s.focus).toBe(0);
  });

  it('a reset needs two presses within 3 s', () => {
    const scores = run(initialMenu(), open('menu'), down, pick).s;
    expect(scores.screen).toBe('scores');
    expect(run(scores, pick).effects).toEqual([]);                                    // armed only
    expect(run(scores, pick, tick(ARM_TIME - 0.1), pick).effects).toEqual([{ reset: 0 }]);
    expect(run(scores, pick, tick(ARM_TIME), pick).effects).toEqual([]);              // timed out: re-armed instead
    expect(run(scores, pick, down, up, pick).effects).toEqual([]);                    // moving focus disarms
    expect(run(scores, up, up, pick, pick).effects).toEqual([{ reset: 'all' }]);      // the last reset resets all
    const done = run(scores, pick, pick).s;
    expect(done.armed).toBe(-1);
    expect(run(done, pick).effects).toEqual([]);                                      // and a third press starts over
  });

  it('Pause: Resume, Restart and Quit to Menu; Esc / B resumes', () => {
    const paused = run(initialMenu(), open('pause')).s;
    expect(run(paused, pick)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
    expect(run(paused, down, pick)).toMatchObject({ s: { screen: null }, effects: ['restart'] });
    expect(run(paused, up, pick)).toMatchObject({ s: { screen: 'menu' }, effects: ['endRun'] });
    expect(run(paused, back)).toMatchObject({ s: { screen: null }, effects: ['resume'] });
  });

  it('Finish: Retry, Track select and Menu; back does nothing', () => {
    const fin = run(initialMenu(), open('finish')).s;
    expect(run(fin, pick)).toMatchObject({ s: { screen: null }, effects: ['restart'] });
    expect(run(fin, down, pick)).toMatchObject({ s: { screen: 'select' }, effects: ['endRun'] });
    expect(run(fin, up, pick)).toMatchObject({ s: { screen: 'menu' }, effects: ['endRun'] });
    expect(run(fin, back)).toMatchObject({ s: { screen: 'finish' }, effects: [] });
  });

  it('back from Track select, High scores and Controls goes to the Menu; the Menu stays', () => {
    for (const k of [0, 1, 2]) {
      const start = run(initialMenu(), open('menu'), ...Array<Action>(k).fill(down), pick).s;
      expect(run(start, back).s.screen).toBe('menu');
    }
    expect(run(initialMenu(), open('menu'), back).s.screen).toBe('menu');
  });

  it('Laps (the last item) cycles 3 → 5 → 1 → 3; a Track starts with it and High scores shows it', () => {
    const select = run(initialMenu(), open('menu'), pick).s;
    expect(select.laps).toBe(3);
    expect([1, 2, 3].map(n => run(select, up, ...Array<Action>(n).fill(pick)).s.laps)).toEqual([5, 1, 3]);
    expect(run(select, up, pick)).toMatchObject({ s: { screen: 'select' }, effects: [] });
    expect(run(select, up, pick, down, pick).effects).toEqual([{ start: 0, laps: 5 }]);
    const scores = run(select, up, pick, back, down, pick).s;
    expect(scores).toMatchObject({ screen: 'scores', laps: 5 });
    expect(run(scores, up, pick)).toMatchObject({ s: { laps: 1 }, effects: [] });
  });
});
