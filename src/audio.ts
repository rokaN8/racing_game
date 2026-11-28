// Synth sound, Web Audio only: no files. An engine hum that follows speed, plus one-shot sounds for events.
// Browsers keep audio off until the player interacts, so the AudioContext starts on the first key or click.
// Plus music: the current Song (see setMusic). M mutes everything; the choice is kept in localStorage when storage works.
import { sinceKick, stepEvents, type Note, type Song } from './audio/songs';

const MUTE_KEY = 'neon-racer.muted';
const VOLUME = 0.35; // master; leaves headroom for music later

let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked: start unmuted */ }

let ctx: AudioContext | null = null;
let master: GainNode, engGain: GainNode, engFilter: BiquadFilterNode, engine: OscillatorNode, noise: AudioBuffer;

function start() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try { ctx = new AudioContext(); } catch { return; } // no Web Audio: play silent
  master = ctx.createGain(); master.gain.value = muted ? 0 : VOLUME; master.connect(ctx.destination);

  engine = ctx.createOscillator(); engine.type = 'triangle';
  engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.Q.value = 4;
  engGain = ctx.createGain(); engGain.gain.value = 0;
  engine.connect(engFilter).connect(engGain).connect(master); engine.start();

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1 s of white noise, reused by every burst
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}

// Music (docs/game-spec.md → Songs): the current Song, sequenced live from its data. Under the master, so M mutes it.
// Each sounding Song is a player with its own bus and echo, so a change of Song crossfades: two overlap for a moment.
// The chain: player bus → muffle (low-pass) → music gain → master. Pause muffles: low-pass and half volume.
const MUSIC = 0.35, CROSSFADE = 1.5, MUFFLE_HZ = 700, OPEN_HZ = 20000;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
interface Player { song: Song; step: number; bus: GainNode; echo: GainNode; n: number; nextT: number; stopAt: number }
let music: GainNode, muffle: BiquadFilterNode, players: Player[] = [];
let wantSong: Song | null = null, wantMuffled = false; // what the game asked for, kept until the AudioContext starts

function startMusic() {
  if (!ctx) return;
  music = ctx.createGain(); music.gain.value = MUSIC; music.connect(master);
  muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = OPEN_HZ; muffle.connect(music);
  if (wantSong) play(wantSong, 0);
  setMuffle(wantMuffled);
  // ponytail: setInterval lookahead scheduler; a hidden tab throttles it, so a returning tab skips ahead rather than catch up.
  setInterval(schedule, 25);
}

function play(song: Song, fadeIn: number) {
  const c = ctx!, t = c.currentTime + 0.05, step = 60 / song.bpm / 4; // one 16th note
  const bus = c.createGain(), echo = c.createGain(), dl = c.createDelay(1), fb = c.createGain();
  bus.gain.setValueAtTime(fadeIn ? 0.0001 : 1, t);
  if (fadeIn) bus.gain.exponentialRampToValueAtTime(1, t + fadeIn);
  // Echo for the arp: a dotted-8th feedback delay, the 80s staple.
  dl.delayTime.value = step * 3; fb.gain.value = song.echo;
  echo.connect(dl).connect(fb).connect(dl); dl.connect(bus); echo.connect(bus); bus.connect(muffle);
  players.push({ song, step, bus, echo, n: 0, nextT: t, stopAt: Infinity });
}

function fadeOut(p: Player, secs: number) {
  const t = ctx!.currentTime, g = p.bus.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(Math.max(g.value, 0.0001), t); g.exponentialRampToValueAtTime(0.0001, t + secs);
  p.stopAt = t + secs;
}

function setMuffle(on: boolean) {
  const t = ctx!.currentTime;
  muffle.frequency.setTargetAtTime(on ? MUFFLE_HZ : OPEN_HZ, t, 0.03); // eases in about 0.1 s
  music.gain.setTargetAtTime(on ? MUSIC / 2 : MUSIC, t, 0.03);
}

function schedule() {
  if (!ctx) return;
  const now = ctx.currentTime;
  players = players.filter(p => { if (now < p.stopAt + 0.5) return true; p.bus.disconnect(); return false; });
  for (const p of players) {
    if (p.nextT < now) p.nextT = now + 0.05;
    while (p.nextT < now + 0.12 && p.nextT < p.stopAt) {
      for (const note of stepEvents(p.song, p.n)) sound(p, note, p.nextT);
      p.nextT += p.step; p.n++;
    }
  }
}

// Call every frame with what should be playing. A different Song crossfades in; the same one keeps going (so a Retry
// doesn't restart it).
export function setMusic(song: Song, muffled: boolean) {
  const songChanged = song !== wantSong, muffleChanged = muffled !== wantMuffled;
  wantSong = song; wantMuffled = muffled;
  if (!ctx || !music) return;
  if (songChanged) {
    const live = players.find(p => p.stopAt === Infinity);
    if (live) fadeOut(live, CROSSFADE);
    play(song, live ? CROSSFADE : 0);
  }
  if (muffleChanged) setMuffle(muffled);
}

// Seconds since the heard Song's last kick, for the beat-synced Track edges: the old Song's until a crossfade is
// halfway, then the new one's. Null before audio starts, while it's suspended or before the Song's first step. Off the
// audio clock and the scheduler, so it keeps time after a tab switch and when muted.
export function beat(): number | null {
  if (ctx?.state !== 'running') return null;
  const now = ctx.currentTime - (ctx.outputLatency || 0), p = players.find(p => now < p.stopAt - CROSSFADE / 2);
  return p ? sinceKick(p.song, p.n, p.nextT, now) : null;
}

// PROTOTYPE #84: 0..1 through the heard Song's current bar (16 steps), for the Rung ripple. Null as beat().
export function barPhase(): number | null {
  if (ctx?.state !== 'running') return null;
  const now = ctx.currentTime - (ctx.outputLatency || 0), p = players.find(p => now < p.stopAt - CROSSFADE / 2);
  if (!p) return null;
  const x = p.n - (p.nextT - now) / p.step; // steps elapsed, fractional
  return x < 0 ? null : (x % 16) / 16;
}

function sound(p: Player, note: Note, t: number) {
  const { song, step } = p, dv = song.drums.vol;
  switch (note.voice) {
    case 'bass': { const v = song.bass; return voice(hz(note.midi), t, step * v.len, v.wave, v.vol, v.cutoff, 0.005, p.bus); }
    case 'pad': { const v = song.pad; return voice(hz(note.midi), t, step * 16, v.wave, v.vol, v.cutoff, v.attack, p.bus); }
    case 'arp': { const v = song.arp; return voice(hz(note.midi), t, step * v.len, v.wave, v.vol, v.cutoff, 0.003, p.echo); }
    case 'kick': return kick(t, 0.6 * dv, p.bus);
    case 'snare': return hit(t, 0.18, 1500, 0.35 * dv, p.bus);
    case 'hat': return hit(t, 0.04, 7000, 0.12 * dv, p.bus);
  }
}

// A synth note: osc → low-pass → envelope (attack, then fade out by the end).
function voice(f: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack: number, dest: AudioNode) {
  const o = ctx!.createOscillator(), lp = ctx!.createBiquadFilter(), g = ctx!.createGain();
  o.type = type; o.frequency.value = f; lp.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(dest); o.start(t); o.stop(t + dur);
}

function kick(t: number, vol: number, dest: AudioNode) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.3);
}

// High-passed noise: snare and hi-hat.
function hit(t: number, dur: number, hpf: number, vol: number, dest: AudioNode) {
  const src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  src.buffer = noise; f.type = 'highpass'; f.frequency.value = hpf;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + dur);
}

// ponytail: a gamepad press doesn't count as a user gesture in Chrome, so a pad-only player stays silent until a key or click.
addEventListener('keydown', e => {
  start();
  if (e.code !== 'KeyM' || e.repeat) return;
  muted = !muted;
  if (ctx) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked: mute lasts this session */ }
});
addEventListener('pointerdown', start);

// Each frame. Glides with setTargetAtTime so the engine never clicks or zippers.
// A deep triangle hum: narrow pitch range (35-65 Hz) and a dark filter, so speed and Boost never make it whine.
export function updateEngine(speed: number, airborne: boolean) {
  if (!ctx) return;
  const t = ctx.currentTime, v = Math.min(1, Math.abs(speed) / 75); // 75 m/s ≈ top speed with Boost
  engine.frequency.setTargetAtTime(35 + 30 * v, t, 0.05);
  engFilter.frequency.setTargetAtTime(300 + 500 * v, t, 0.05);
  engGain.gain.setTargetAtTime(2 * 0.5 * (0.05 + 0.15 * v) * (airborne ? 0.5 : 1), t, 0.08); // 2: a triangle is quieter than a saw; 0.5: under the music
}

// A pitched blip: glides f0 → f1 and fades out over dur seconds, starting `at` seconds from now.
function blip(f0: number, f1: number, dur: number, at = 0, type: OscillatorType = 'square', vol = 0.15) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur);
}

// Filtered noise: the low-pass sweeps f0 → f1 while the burst swells in over `attack` and fades out by dur.
function burst(f0: number, f1: number, dur: number, attack: number, vol: number) {
  if (!ctx) return;
  const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noise; f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + dur);
}

export const sfx = {
  boost: () => burst(300, 5000, 0.6, 0.25, 0.35),
  pad: () => { blip(440, 1760, 0.22, 0, 'sawtooth', 0.12); blip(660, 2640, 0.22, 0.06, 'square', 0.08); }, // rising chime
  land: () => blip(140, 45, 0.18, 0, 'sine', 0.5),
  perfect: () => { blip(880, 1760, 0.14, 0.02, 'triangle', 0.22); blip(1320, 2640, 0.2, 0.1, 'triangle', 0.18); }, // bright rising chime
  sketchy: () => burst(2500, 300, 0.25, 0.01, 0.25), // a short scrape
  stall: () => { blip(70, 40, 0.12, 0, 'sawtooth', 0.3); blip(70, 40, 0.12, 0.15, 'sawtooth', 0.25); blip(60, 35, 0.18, 0.3, 'sawtooth', 0.2); }, // low sputter
  crash: () => burst(4000, 120, 0.7, 0.01, 0.6),
  checkpoint: () => { blip(880, 880, 0.09); blip(1320, 1320, 0.14, 0.09); },
  lap: () => [660, 880, 1320].forEach((f, i) => blip(f, f, 0.18, i * 0.1, 'triangle', 0.25)),
};
