// Settings (docs/game-spec.md → Settings): the rows, stepping them, and their one guarded key. Pure but for storage.

export type Motion = 'auto' | 'on' | 'off';
export type Fov = 'narrow' | 'normal' | 'wide';
export type Quality = 'high' | 'low';
export interface Settings { music: number; sound: number; motion: Motion; fov: Fov; quality: Quality; fps: boolean }
export type SettingRow = keyof Settings | 'ghostLine'; // the Ghost line keeps its own key (render/ghostLine.ts)

export const SETTINGS_KEY = 'neon-racer.settings.v1';
export const DEFAULT_SETTINGS: Readonly<Settings> = { music: 100, sound: 100, motion: 'auto', fov: 'normal', quality: 'high', fps: false };
export const SETTING_ROWS: readonly SettingRow[] = ['music', 'sound', 'motion', 'fov', 'quality', 'fps', 'ghostLine'];
export const FOV_DEG: Record<Fov, number> = { narrow: 90, normal: 102, wide: 110 };

const CHOICES = { motion: ['auto', 'on', 'off'], fov: ['narrow', 'normal', 'wide'], quality: ['high', 'low'] } as const;
const isVolume = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100 && v % 10 === 0;

// One step of a row: volumes by 10, stopping at 0 and 100; the choices and switches wrap.
export function stepSetting(s: Settings, row: keyof Settings, dir: -1 | 1): Settings {
  if (row === 'music' || row === 'sound') return { ...s, [row]: Math.min(100, Math.max(0, s[row] + 10 * dir)) };
  if (row === 'fps') return { ...s, fps: !s.fps };
  const list: readonly string[] = CHOICES[row], i = list.indexOf(s[row]);
  return { ...s, [row]: list[(i + dir + list.length) % list.length] };
}

// The volume a setting gives a gain: squared, so the steps sound even.
export const gainOf = (v: number) => (v / 100) ** 2;
// Whether motion is reduced: Auto follows the OS.
export const motionReduced = (s: Settings, os: boolean) => (s.motion === 'auto' ? os : s.motion === 'on');

// Missing, bad or blocked: the defaults, field by field.
export function loadSettings(storage: Storage | null): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw: unknown = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return s;
    const r = raw as Record<string, unknown>;
    if (isVolume(r.music)) s.music = r.music;
    if (isVolume(r.sound)) s.sound = r.sound;
    if (typeof r.fps === 'boolean') s.fps = r.fps;
    for (const k of ['motion', 'fov', 'quality'] as const) if ((CHOICES[k] as readonly unknown[]).includes(r[k])) (s as unknown as Record<string, unknown>)[k] = r[k];
  } catch { /* blocked or garbage: defaults */ }
  return s;
}
export function saveSettings(storage: Storage | null, s: Settings) {
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* blocked or full: this session only */ }
}
