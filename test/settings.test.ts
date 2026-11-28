// Settings (docs/game-spec.md → Settings): stepping the rows, and their one guarded key.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, gainOf, loadSettings, motionReduced, saveSettings, SETTINGS_KEY, stepSetting, type Settings } from '../src/settings';

const d: Settings = { ...DEFAULT_SETTINGS };
const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
};

describe('stepSetting', () => {
  it('steps volumes by 10, stopping at 0 and 100', () => {
    expect(stepSetting(d, 'music', -1).music).toBe(90);
    expect(stepSetting(d, 'music', 1).music).toBe(100);
    expect(stepSetting({ ...d, sound: 0 }, 'sound', -1).sound).toBe(0);
  });

  it('wraps the choices and flips the switches both ways', () => {
    expect(stepSetting(d, 'motion', 1).motion).toBe('on');
    expect(stepSetting(d, 'motion', -1).motion).toBe('off');
    expect(stepSetting(d, 'fov', 1).fov).toBe('wide');
    expect(stepSetting(stepSetting(d, 'fov', 1), 'fov', 1).fov).toBe('narrow');
    expect(stepSetting(d, 'quality', -1).quality).toBe('low');
    expect(stepSetting(d, 'fps', -1).fps).toBe(true);
  });

  it('leaves the other rows alone', () => {
    expect(stepSetting(d, 'fov', 1)).toEqual({ ...d, fov: 'wide' });
  });
});

describe('what the settings drive', () => {
  it('squares the volume, so the steps sound even', () => {
    expect([0, 50, 100].map(gainOf)).toEqual([0, 0.25, 1]);
  });
  it('follows the OS for Reduce motion on Auto, and forces it otherwise', () => {
    expect(motionReduced(d, true)).toBe(true);
    expect(motionReduced(d, false)).toBe(false);
    expect(motionReduced({ ...d, motion: 'on' }, false)).toBe(true);
    expect(motionReduced({ ...d, motion: 'off' }, true)).toBe(false);
  });
});

describe('the settings key', () => {
  it('round-trips', () => {
    const s = memory(), x: Settings = { music: 40, sound: 70, motion: 'on', fov: 'narrow', quality: 'low', fps: true };
    saveSettings(s, x);
    expect(loadSettings(s)).toEqual(x);
  });

  it('reads the defaults with storage blocked, missing or holding garbage', () => {
    const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(loadSettings(null)).toEqual(d);
    expect(loadSettings(blocked)).toEqual(d);
    expect(() => saveSettings(blocked, d)).not.toThrow();
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{nope' }))).toEqual(d);
    expect(loadSettings(memory({ [SETTINGS_KEY]: '7' }))).toEqual(d);
  });

  it('keeps the good fields and defaults each bad one', () => {
    const raw = JSON.stringify({ music: 45, sound: 30, motion: 'sideways', fov: 'wide', quality: 3, fps: 'yes' });
    expect(loadSettings(memory({ [SETTINGS_KEY]: raw }))).toEqual({ ...d, sound: 30, fov: 'wide' });
  });
});
