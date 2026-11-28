# Feature ideas

A brainstorm of new features and improvements. Nothing here is decided until it has an issue: cut, reorder and add notes freely. A picked item becomes a GitHub issue (`feature/issue-<n>`) and gets tagged with its number, e.g. `[#61]`; anything flagged 🔒 changes a locked decision or an Out of scope item in [`game-spec.md`](game-spec.md), so the spec changes first. Vocabulary: [`GLOSSARY.md`](../GLOSSARY.md).

**Keep it current.** The PR that builds an item ticks its box here (`- [x]`). A dropped idea gets struck through (`~~…~~`) with a one-line reason, and new ideas are added to the section they fit.

**Size:** S ≈ an evening · M ≈ a few sessions · L ≈ a milestone.

## Suggested first batch

Cheap, no 🔒, and each makes the five Tracks more worth replaying:

1. Pilot Ghost + Medal times (A1, A2): #61, #62
2. Live Ghost gap + Minimap (D1, D2): #63, #64
3. Ideal Lap (A5): #65
4. Synthwave horizon + beat-synced Track (C1, C2): #66, #67
5. Gamepad rumble + auto-Pause (F1, F2): #68, #69

## A. Racing and modes

- [x] **A1. Pilot Ghost** [#61] (S/M). Every Track has a rival from the first run. `test/pilot.ts` already rides a clean Lap headlessly; run it at boot (or bake it at build time), record its poses and race it when you have no Ghost of your own, or pick it on Track select. A Ghost, not an AI opponent, so it stays in scope. *Touches:* move `createPilot` into `src/`, `ghost.ts`, `main.ts`.
- [x] **A2. Medal times** [#62] (S). Bronze / Silver / Gold per Track and lap count, plus Neon for beating the Pilot Ghost. Shown on Track select next to the top 5 and on Finish ("Gold · 0.41 to Neon"). Derived from `scores[0]`, nothing new stored. A goal before you have a Ghost. *Touches:* `TrackDef` or the Pilot time, `ui/menu.ts`.
- [ ] **A3. Practice** (S). Endless Laps, no Finish, start at any Checkpoint, R goes back to it with no penalty. Best Lap shown, never saved to High scores. For drilling Hang Time's step-up or Switchback's hairpin. *Touches:* `menuState.ts`, `main.ts`.
- [ ] **A4. Checkpoint rush** (M). Arcade countdown: the clock starts at 20 s, each Checkpoint adds time, the run ends at zero. Score = distance ridden. Own High scores. *Touches:* `main.ts`, `ghost.ts`, `hud.ts`.
- [x] **A5. Ideal Lap** [#65] (S). The sum of your best time in each Checkpoint sector over all runs, on Track select and Finish ("Ideal 0:38.72 · 1.10 off"). Splits are already recorded at every Checkpoint; keep the best sector times per Track. Shows where the time is. *Touches:* `ghost.ts`, `ui/menu.ts`.
- [ ] **A6. Grand tour** (M). All five Tracks back to back, one Lap each, one total. Songs already crossfade. Own top 5. *Touches:* `main.ts` (swap world mid-run), `ghost.ts`, `menuState.ts`.
- [ ] **A7. Daily challenge** (S/M). A date-seeded Track, lap count and Mutator (B5); one best per day and a streak counter, on this device. *Touches:* `menuState.ts`, storage.
- [ ] **A8. Mirror Tracks** (M). Every Track flipped left ↔ right: five more Tracks for free. Negate x on the control points (turn and bank signs flip in the turtle builder); the existing frame tests check the handedness. Own score keys. *Touches:* `bake.ts` / `turtle.ts`, `tracks/index.ts`, Track tests run over mirrored Tracks too.
- [ ] **A9. Reverse Switchback** (S/M). Switchback has no Gaps, so it is the one Track that can be ridden backwards (Kickers only work one way). Needs its own test pass: the braking turns come at you differently. *Touches:* a new `TrackDef`, `test/tracks/`.
- [ ] **A10. Last-run Ghost** (S). Race your previous attempt instead of your best, for when the best is out of reach. Keep the last recording in memory; toggle "Ghost: Best | Last" on Track select and Finish. *Touches:* `ghost.ts`, `menuState.ts`.

## B. Bike and riding

`TUNING` stays as is; these add rules on top, each needing a spec entry.

- [ ] **B1. Air tricks** (M). Count full flips and spins done with Air control during a flight. Land one clean and it shows its name ("Backflip", "360") and makes Boost ready again. Style without slowing players who skip it. *Touches:* `physics.ts` (rotation while Airborne), `hud.ts`, sfx. 🔒
- [ ] **B2. Perfect landing** (S). Land within 5° for "Perfect" and a small speed kick. The landing already computes the angle (`Landed · n° off`). 🔒 new handling value.
- [ ] **B3. Rocket start** (S). Throttle in a short window right at GO gives a kick; throttle held too early stalls. Skill at the line. *Touches:* `main.ts` countdown. 🔒
- [ ] **B4. Rewind** (M). Hold a button to roll back ~3 s instead of respawning at a far-back Checkpoint. Snapshot `BikeState` every 0.1 s in a ring buffer. In a timed run it costs the same +3 s, so it is no exploit, just less tedious. *Touches:* `main.ts`, `input.ts`, `ghost.ts` (trim the recording).
- [ ] **B5. Mutators** (M). Opt-in modifiers with their own score keys: Moon (half airGravity), Glass Track (edges only), No brakes, Always Boost, Narrow (half width), Blackout (edges fade in only near the Bike). `step` already takes the tuning as a parameter, so a Mutator passes an override and `TUNING` itself never changes. 🔒

## C. Look and world

- [ ] **C1. Synthwave horizon** [#66] (S/M). A striped setting sun, a wireframe mountain range and stars far out, from each Track's palette. The sky stays solid; these are objects, kept under the bloom threshold except the sun's rim. *Touches:* `render/scene.ts`, `palette.ts`.
- [ ] **C2. Beat-synced Track** [#67] (S/M). Edges and Checkpoint lines pulse on the kick, rungs ripple forward each bar. The step generator already knows when each step plays; expose a beat clock from `audio.ts` (BPM alone when muted). *Touches:* `audio.ts`, `scene.ts`.
- [ ] **C3. Speed feel** (S). Streaks past the camera while Boosting, a short shake on hard landings, a slight colour split at Boost top speed. Render and camera only. *Touches:* `camera.ts`, a small particles module.
- [ ] **C4. Trackside scenery** (M). Neon pylons, arches over Checkpoints, holo-boards with the Track name, light towers by the Loops. Outline-only, so the look holds. *Touches:* `scene.ts`.
- [ ] **C5. Ghost line** (S). The Ghost's line drawn faintly on the Track ahead, from its recorded poses. Teaches the racing line. Toggle. *Touches:* `scene.ts`, `ghost.ts`.
- [ ] **C6. Finish cam** (S). After the line the camera swings into a slow orbit of the Bike behind the Finish screen. *Touches:* `camera.ts`, `main.ts`.
- [ ] **C7. Camera modes** (S). C cycles Chase (today, the default) / Close / High (the original isometric idea) / Cockpit. *Touches:* `camera.ts`, `input.ts`, Controls screen. 🔒 camera is locked; Chase stays the default.

## D. HUD and feedback

- [x] **D1. Live Ghost gap** [#63] (S/M). A running ± gap to the Ghost, not just at Checkpoints. Store the Ghost's distance at 10 Hz beside its poses (built as an optional `dist`, no new storage version; old Ghosts keep Checkpoint splits only), then gap = when the Ghost was where you are now. *Touches:* `ghost.ts`, `hud.ts`.
- [x] **D2. Minimap** [#64] (S). The top-down outline from Track select, small in a corner, with Bike and Ghost dots and Checkpoint ticks. *Touches:* outline code in `ui/menu.ts`, `hud.ts`.
- [ ] **D3. Progress bar** (S). Instead of D2: a thin bar along the top with Checkpoint ticks and Bike and Ghost markers. Pick one.
- [ ] **D4. Landing grades** (S). Perfect / Clean / Sketchy, coloured, instead of only `Landed · 12° off`. Pairs with B2. *Touches:* `physics.ts` message, `index.html` styles.
- [ ] **D5. Run stats** (S). On Finish: airtime, top speed, crashes, Boosts used, Boost pad hits. Lifetime totals (distance, Laps, time played) on a Stats screen. *Touches:* `main.ts` counters, `ui/menu.ts`, one storage key.
- [ ] **D6. Progress history** (M). Every finished run's time per Track, not just the top 5, as a sparkline on Track select: are you getting faster? *Touches:* storage, `ui/menu.ts`.
- [ ] **D7. Achievements** (M). Local badges such as "Every Gap within 5°", "Clean 5-Lap run", "Beat the Pilot Ghost", "Never drop off the Corkscrew". Shown on Track select; nothing is gated behind them. 🔒 near "Unlockables and progression".

## E. Audio

- [ ] **E1. Reactive music** (S/M). The Song follows the ride: drums drop out and a filter sweeps up while Airborne, the arp opens on Boost, an extra layer joins on the final Lap. Songs are already per-voice data; add a gain per voice. *Touches:* `audio.ts`.
- [ ] **E2. Ghost whoosh** (S). A panned Doppler swish when you pass the Ghost or it passes you. *Touches:* `audio.ts`, `main.ts`.
- [ ] **E3. Wind and grip** (S). Wind rising with speed, a hollow tone while Airborne, a hiss near the Track edge that warns before you go off. *Touches:* `audio.ts`.
- [ ] **E4. More Songs** (S each). A Finish sting, a Pause loop, a second Song per Track. Songs are 16-step data. *Touches:* `audio/songs.ts`, `TrackDef`.
- [ ] **E5. Gamepad-only audio** (S). A gamepad press doesn't unlock Web Audio in Chrome, so pad-only players stay silent (`ponytail:` in `audio.ts`). Show "Press any key or click for sound" once when a pad is the only input. *Touches:* `audio.ts`, `ui/menu.ts`.

## F. Quality of life and platform

- [ ] **F1. Gamepad rumble** [#68] (S). `vibrationActuator.playEffect('dual-rumble')` on landing (stronger the further off), crash, Boost pad and Checkpoint. Native API. *Touches:* `input.ts`, the sound-event diffs in `main.ts`.
- [ ] **F2. Auto-Pause** [#69] (S). Leaving the tab mid-run opens Pause. Today the run freezes but you come back unpaused, and the throttled music scheduler stutters. *Touches:* `main.ts` (`visibilitychange`).
- [ ] **F3. Settings** (M). Music and SFX volume, FOV, FPS counter, quality (pixel ratio, bloom), reduce flashing (explosion, beat pulse). 🔒 spec says no settings screen.
- [ ] **F4. Key remapping** (M). Needs F3. *Touches:* `input.ts`.
- [ ] **F5. Touch controls** (M). On-screen throttle, brake and Boost with thumb or tilt steering, so it plays on phones; tap targets on the Menu. *Touches:* `input.ts`, `ui/menu.ts`, CSS.
- [ ] **F6. Installable and offline** (S). A web app manifest and a small service worker caching the build: the game needs no network, so it runs from the home screen offline. Mind Vite's `/racing_game/` base.

## G. Sharing, without a server

- [ ] **G1. Input replays** (M). Record inputs (throttle, brake, steer, pitch, Boost per 120 Hz step, run-length encoded) alongside poses: a whole run in tens of KB at most. Physics is pure and fixed-step, so re-simulating the inputs replays the run. *Risk:* `Math.sin` and friends can differ in the last bits between browser engines, so a replay may drift on another browser. Keep poses as the local Ghost's truth; a headless test checks re-simulation matches.
- [ ] **G2. Challenge links** (S after G1). "Share" on Finish copies a URL with the run in the hash. Opening it races the sender's Ghost with their time as the target. Works on GitHub Pages. Online leaderboards stay out of scope.
- [ ] **G3. Replay and photo mode** (M). Watch a run back after Finish or from a link, with orbit, trackside and slow-mo cameras. Hide the HUD and save a PNG (`canvas.toBlob`).

## H. New Tracks and pieces

The turtle builder and the shared Track tests make a new Track mostly data (plus a palette, a Song and its own test file).

- [ ] **H1. Helix piece** (S). A turn past 360° with a steady rise: a spiral climb or descent (e.g. 540° at R40, +30 m). Mostly `turn` with a large `deg` and `rise`; the 8 m self-clearance rule applies.
- [ ] **H2. Tunnel** (S). Glowing rings around a straight, render only: a big rush of speed for free.
- [ ] **H3. Double Loop** (S). Two Loops back to back, offset sideways. Existing Loop piece and its `drift`.
- [ ] **H4. Jump pad** (M). A pad that throws the Bike up without a Kicker, onto a Landing deck ahead. 🔒 new physics rule.
- [ ] **H5. Split path** (L). Two routes, short and risky or long and safe. The Track is one closed curve and physics rides one `s`, so this is a big change.
- [ ] **H6. Track concepts** (L each):
  - **Vertigo** (Climb): a helix up a 150 m tower, a long Gap off the top, a spiral back down.
  - **Overclock** (Speed): a long, fast Track with three Boost pads chained, sweepers that hold flat out but not Boosted: Boost management.
  - **Knot**: crosses itself five times, with tunnels and a Corkscrew round its own straight.
  - **Sprint**: a 20 s Track for quick 5-Lap runs.
- [ ] **H7. Track editor** (L). A piece-list editor over the turtle builder with a live outline and a "Pilot test" button. 🔒 Out of scope.
- [ ] **H8. Seeded Tracks** (L). Build a turtle piece list from a seed, keep only seeds the Pilot rides clean, name it from the seed. Pairs with A7. 🔒 Out of scope (procedural Tracks).

## I. Wild ideas

- [ ] **I1. Derezz wave** (M). Survival: a wall of light rides the Track behind you, faster each Lap. It catches you, the run is over; score = Laps survived. Placed with `sampleAt`, so it follows you through the Loops.
- [ ] **I2. Data shards** (M). Glowing pickups along each Track, some in risky spots (top of the Wall-ride, high over a Gap's arc). A score-attack mode, or "12/15 found" per Track.
- [ ] **I3. Style score** (M). Points for airtime, tricks (B1), upside-down time, Wall-ride and riding within 0.5 m of the edge, chained into a combo a respawn breaks.
- [ ] **I4. Drafting** (S). Tuck in behind the Ghost for a small speed pull. Only in a mode, since it makes times depend on the Ghost.
- [ ] **I5. Light-cycle duel** (L). Light trails turn solid; touch one and you derezz. 🔒 POC says no solid Light trail.
- [ ] **I6. Local split-screen** (L). Two Bikes, keyboard and gamepad. Physics is pure, so two `BikeState`s just work; the cost is two renders and two bloom passes. 🔒 multiplayer is out of scope.
- [ ] **I7. Bike looks** (S/M). Trail colour and Bike tint picked on Track select; the Ghost stays white. 🔒 Bike colours are fixed by the palette spec.

## Tech debt worth doing alongside

From the `ponytail:` comments in `src/`:

- **Ghost size vs storage quota** (`ghost.ts`): a 5-Lap Ghost is ~1.2 MB of base64. Quantize to Int16 and record at 60 Hz (~4× smaller together), or move Ghosts to IndexedDB.
- **Recording grows** in a run that never finishes (`ghost.ts`): cap it.
- **Pixel ratio 2 with full-size bloom** (`main.ts`): half-size bloom if a dense screen misses 60 fps.
- **Hidden-tab music** (`audio.ts`): covered by F2.
- **Gamepad-only audio** (`audio.ts`): E5.
- **O(N) landing scan** (`physics.ts`): only if it shows in a profile.
