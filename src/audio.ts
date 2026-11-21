// Synth sound, Web Audio only: no files. An engine hum that follows speed, plus one-shot sounds for events.
// Browsers keep audio off until the player interacts, so the AudioContext starts on the first key or click.
// Plus a looping synthwave backing track. M mutes everything; the choice is kept in localStorage when storage works.

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

  engine = ctx.createOscillator(); engine.type = 'sawtooth';
  engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.Q.value = 4;
  engGain = ctx.createGain(); engGain.gain.value = 0;
  engine.connect(engFilter).connect(engGain).connect(master); engine.start();

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1 s of white noise, reused by every burst
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}

// Background music: a looping synthwave bar pattern, sequenced live. Under the master, so M mutes it too.
// A minor, i–VI–III–VII (Am F C G), one bar each: bass root (MIDI) + chord tones for the pad and arp.
const BPM = 100, STEP = 60 / BPM / 4; // one 16th note
const BARS: [number, number[]][] = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
let music: GainNode, echo: GainNode, nextT = 0, stepN = 0;

function startMusic() {
  if (!ctx) return;
  music = ctx.createGain(); music.gain.value = 0.35; music.connect(master);
  // Echo for the arp: a dotted-8th feedback delay, the 80s staple.
  echo = ctx.createGain();
  const dl = ctx.createDelay(1), fb = ctx.createGain();
  dl.delayTime.value = STEP * 3; fb.gain.value = 0.35;
  echo.connect(dl).connect(fb).connect(dl); dl.connect(music); echo.connect(music);
  nextT = ctx.currentTime + 0.1;
  // ponytail: setInterval lookahead scheduler; a hidden tab throttles it, so a returning tab skips ahead rather than catch up.
  setInterval(() => {
    if (!ctx) return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.12) { playStep(stepN, nextT); nextT += STEP; stepN = (stepN + 1) % 64; }
  }, 25);
}

function playStep(n: number, t: number) {
  const [root, chord] = BARS[n >> 4], s = n % 16;
  if (s % 2 === 0) voice(hz(root + (s % 4 ? 12 : 0)), t, STEP * 1.8, 'sawtooth', 0.14, 700, 0.005, music); // octave bass
  if (s === 0) chord.forEach(m => voice(hz(m), t, STEP * 16, 'sawtooth', 0.035, 1400, 0.5, music));         // pad
  voice(hz(chord[s % 3] + 12), t, STEP * 0.8, 'square', 0.03, 2500, 0.003, echo);                         // arp
  if (s % 8 === 0) kick(t);
  if (s % 8 === 4) hit(t, 0.18, 1500, 0.35); // snare
  if (s % 2 === 1) hit(t, 0.04, 7000, 0.12); // hi-hat
}

// A synth note: osc → low-pass → envelope (attack, then fade out by the end).
function voice(f: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack: number, dest: AudioNode) {
  const o = ctx!.createOscillator(), lp = ctx!.createBiquadFilter(), g = ctx!.createGain();
  o.type = type; o.frequency.value = f; lp.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp).connect(g).connect(dest); o.start(t); o.stop(t + dur);
}

function kick(t: number) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(music); o.start(t); o.stop(t + 0.3);
}

// High-passed noise: snare and hi-hat.
function hit(t: number, dur: number, hpf: number, vol: number) {
  const src = ctx!.createBufferSource(), f = ctx!.createBiquadFilter(), g = ctx!.createGain();
  src.buffer = noise; f.type = 'highpass'; f.frequency.value = hpf;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(music); src.start(t, Math.random() * 0.5); src.stop(t + dur);
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
export function updateEngine(speed: number, airborne: boolean) {
  if (!ctx) return;
  const t = ctx.currentTime, v = Math.min(1, Math.abs(speed) / 75); // 75 m/s ≈ top speed with Boost
  engine.frequency.setTargetAtTime(40 + 140 * v, t, 0.05);
  engFilter.frequency.setTargetAtTime(250 + 2200 * v, t, 0.05);
  engGain.gain.setTargetAtTime(0.5 * (0.05 + 0.15 * v) * (airborne ? 0.5 : 1), t, 0.08); // 0.5: engine sits under the music
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
  land: () => blip(140, 45, 0.18, 0, 'sine', 0.5),
  crash: () => burst(4000, 120, 0.7, 0.01, 0.6),
  checkpoint: () => { blip(880, 880, 0.09); blip(1320, 1320, 0.14, 0.09); },
  lap: () => [660, 880, 1320].forEach((f, i) => blip(f, f, 0.18, i * 0.1, 'triangle', 0.25)),
};
