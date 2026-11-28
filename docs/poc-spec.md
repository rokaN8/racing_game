# Neon racer POC spec

The hand-off spec for the neon racer proof of concept. Each section sums up a locked decision. The linked ticket holds the full detail and reasoning, so check it before changing anything. Charted on [Wayfinder: Neon racer POC spec](https://github.com/rokaN8/racing_game/issues/1). Vocabulary: [`GLOSSARY.md`](../GLOSSARY.md).

## What the POC is

A browser-based neon/TRON, 80s synthwave Time trial:

- one Bike on one closed Track;
- a run is one Lap, about 40 s;
- the Bike rides a Loop and a Wall-ride, and jumps two Gaps;
- it has Boost and Air control;
- you race the clock or a Ghost of your best Lap.

The look is neon on black with bloom: solid dark shapes with glowing edges. There are no art assets.

## Locked decisions

| Area | Decision | Ticket |
|---|---|---|
| Stack | Three.js + TypeScript + Vite, WebGL. Runtime dependency is `three` only. Bloom uses the built-in `UnrealBloomPass`. Dev dependencies: `vite`, `typescript`, `@types/three`, `vitest`. | [Browser 3D stack](https://github.com/rokaN8/racing_game/issues/2) |
| Physics | Custom spline-parameter kinematics, no physics library. On Track the Bike's state is distance along the Track, side offset and speed. Airborne is world-space motion under weak gravity. Landing is a swept test against the Track. Fixed 120 Hz step. | [Physics approach](https://github.com/rokaN8/racing_game/issues/3) |
| Track mesh | Centripetal Catmull-Rom spline with a bank angle per point. Baked to an arc-length table of rotation-minimizing frames (double reflection), turned so bank is measured from level (was: the closure twist spread along the Lap; changed in [Vertigo layout](https://github.com/rokaN8/racing_game/issues/77), see game-spec → Design rules → Bake frames). Gaps are distance ranges with no geometry. | [Track meshes](https://github.com/rokaN8/racing_game/issues/4) |
| Handling | Tuning values, control mapping, and detachment and crash rules all locked. | [Bike handling feel](https://github.com/rokaN8/racing_game/issues/5) |
| Camera | "Hybrid" perspective chase camera: 9 m behind, 3 m up, 8 m look-ahead, FOV 102°, follow stiffness 8. It rolls with the Bike on the Track, levels to world up and follows the flight path when Airborne, and snaps on respawn. | [Chase camera](https://github.com/rokaN8/racing_game/issues/6) |
| Track | Lap order: Loop → right turn → Rollercoaster (two steep hills) → left turn → Wall-ride → Gap B (top speed) → right turn. 4 Checkpoints, each at least 60 m before a hazard. Geometry is fitted to the physics. | [Test Track layout](https://github.com/rokaN8/racing_game/issues/7) |
| Bike look | Light-cycle model with ring wheels and orientation cues (fin, deck chevron, white front, orange tail, orange underglow). Attitude indicator on the HUD while Airborne. See M7. | [Wayfinder: Bike look](https://github.com/rokaN8/racing_game/issues/22) |
| Cornering | Turns push the Bike towards the outside edge (Cornering pull); the player must steer to stay on. See M8. | — |
| Scope | Boost is cooldown-based. Minimal HUD. Ghost of the best Lap, recorded as poses. | [First build slice and POC spec](https://github.com/rokaN8/racing_game/issues/8) |

### Handling values

| Area | Values |
|---|---|
| On Track | topSpeed 55 m/s, accel 25, brake 45, drag 0.04, overspeedDecay 12, slopeGravity 20, steerRate 12 m/s, steerResponse 10, cornerPull 1 (see M8) |
| Track grip | stickSpeed 18: below this speed the Bike drops off when upside down (Track up.y below -0.3) |
| Airborne | airGravity 12 m/s², airControlRate 2.5 rad/s, landingTolerance 35°, maxAirTime 6 s |
| Boost | +20 m/s top speed, +10 m/s kick, 2× accel, 1.2 s duration, 3 s cooldown |
| Respawn | at the last Checkpoint, 20 m/s, +3 s penalty, Boost ready again (also when the player respawns by hand). First a 0.8 s pixel explosion plays where the Bike was, with the Bike hidden, the camera held and physics paused, so it costs no race time (render-only, `render/explosion.ts`) |

### Controls

**Keyboard**

| Action | Keys |
|---|---|
| Throttle | W or ↑ |
| Brake | S or ↓ |
| Steer | A/D or ←/→ |
| Boost | Space or Shift |
| Respawn | R |

While Airborne, W/S pitch nose down/up and A/D yaw.

**Gamepad (standard mapping)**

| Action | Control |
|---|---|
| Throttle | RT |
| Brake | LT |
| Steer | left stick (deadzone 0.15) |
| Boost | A |
| Respawn | Y |

While Airborne, the left stick does Air control: forward is nose down.

### Rules

**When the Bike detaches from the Track.** It becomes Airborne when any of these happens:
- it enters a Gap;
- its side offset goes past the Track edge;
- it is upside down below stickSpeed.

**Cornering pull.** On the Track, turns push the Bike sideways towards the outside edge, and the player steers against it. Going past the edge is the existing "Off the edge" detachment. See M8.

**Air control.** It rotates the Bike only. It doesn't change the Bike's velocity.

**Landing.**
- The Bike must be crossing down through the surface.
- Its nose and up must both be within 35° of the Track, or it is a crash and respawns.
- After landing, speed becomes the velocity along the Track tangent.

**Falling off.** Being Airborne longer than maxAirTime, or falling 30 m below the lowest Track point, respawns the Bike.

### HUD

Top left: the run clock (penalties included, `m:ss.cc`), the gap to the Ghost, the current Lap time and the best run. The gap line shows the live gap ([#63](https://github.com/rokaN8/racing_game/issues/63)): your run time now minus the Ghost's when it first got as far round as you are, `−0.42` green ahead, `+1.10` red behind, read about 10× a second so it doesn't flicker, and held while Airborne (the distance doesn't move). Passing a Checkpoint pops the Checkpoint split there for 2 s. A Ghost saved before live gaps shows Checkpoint splits only. Top right: the Lap counter, tagged on the final Lap (hidden for 1-Lap runs), then a 160 × 110 minimap ([#64](https://github.com/rokaN8/racing_game/issues/64)): the Track select outline, fixed north-up, with a cyan Bike dot and a white Ghost dot while the Ghost shows. Bottom left: speed and a segmented Boost meter that drains red while Boosting and refills over the cooldown. Crossing the line onto a new Lap shows a centre banner ("Lap 2/3" or "Final lap") with the Lap just finished and the split. Lettering is Oxanium, self-hosted from `public/fonts/`.

While Airborne it also shows the Attitude indicator (see M7).

It's plain HTML over the canvas.

### Ghost

**Recording.** Record the Bike's position and orientation every physics step, about 4,800 samples per Lap.

**Storage.**
- Keep the best Lap's recording in memory and in `localStorage`.
- Wrap every storage read and write in try/catch. The game must work without storage.

**Playback.** Replay it as a translucent white Bike, sample by sample in step with the run's own steps.

## Module layout

The physics never imports from rendering, the DOM or input, so the headless test can run it.

```
src/
  main.ts          # boot, fixed 120 Hz accumulator loop, wiring
  track/bake.ts    # control points → Track table; sampleAt(s)
  track/layout.ts  # the test Track: control points, Gap segments, Checkpoints
  bike/physics.ts  # state, step(), launch, landing, respawn (pure)
  bike/tuning.ts   # locked handling values
  input.ts         # keyboard + gamepad → { throttle, brake, steer, pitch, boost }
  camera.ts        # Hybrid chase camera
  render/scene.ts  # Track ribbon and edges, grid, bloom, Light trail
  render/bike.ts   # Bike and Ghost Bike models, wheel spin, Boost glow
  hud.ts           # HUD text + Attitude indicator
  ghost.ts         # record / store / replay
test/track.test.ts # headless acceptance check (Vitest)
```

**Port, don't rewrite.** `bakeTrack`, `sampleAt` and `step` come from the play-tested prototype (`prototype/bike-handling`, deleted once ported), ported to TypeScript as they are. The prototype's chase-camera block becomes `camera.ts`.

## Milestones

Each milestone ends in something you can play.

### M1: First slice: ride the Track

- Project setup: `npm create vite@latest -- --template vanilla-ts`, then `three`, `@types/three` and `vitest`.
- Bake the prototype Track (`CPS` in the prototype) into the Track table.
- On-Track riding with keyboard throttle, brake and steer, with the Hybrid chase camera.
- Plain coloured ribbon and lines. No Airborne, Gaps or Boost yet.
- GitHub Pages deploy: set `base: '/racing_game/'` in `vite.config.ts`, plus a GitHub Actions workflow that builds and publishes on every push to `main`.

Accept when:
- `npm run dev` opens and you can ride laps;
- the Loop works: full throttle clears it, and coasting in at 38 m/s drops off the ceiling;
- `npm test` passes a frame check: every sample's up is perpendicular to its tangent, and the Track wraps with no twist at the seam;
- the build is live at `https://rokan8.github.io/racing_game/` after a push to `main`.

### M2: Airborne, Gaps, Checkpoints

- Gaps, Airborne motion, Air control, the swept landing test, crashes, falling off.
- Checkpoints, respawn with penalty, Lap timer.

Accept when, on the prototype Track:
- a full-throttle Lap jumps the Gap and lands;
- over-rotating in the air crashes and respawns at the last Checkpoint with +3 s;
- the Lap time counts penalties;
- a headless test covers both cases.

### M3: Boost, gamepad, HUD

- Cooldown Boost.
- Gamepad mapping.
- The HUD described above.

Accept when:
- every control in the mapping works on keyboard and on a standard gamepad;
- the HUD shows its five values live.

### M4: Test Track

- Write the real Track's control points in `track/layout.ts`, following "Test Track layout".
- It replaces the prototype Track.

Accept when the headless check passes:
- a full-throttle Lap with no Boost rides the Rollercoaster and lands Gap B (Gap A replaced by the Rollercoaster; Gap B shortened, no longer needs Boost);
- a full-throttle Lap with Boost at Gap B is also clean and takes about 40 s (±5 s);
- a respawn at each Checkpoint at 20 m/s clears the hazard that follows it.

### M5: Look

- Selective bloom.
- Thick neon Track edges with `Line2`.
- Light trail ribbon, visual only.
- Grid floor.

Accept when:
- it holds 60 fps on the dev machine at 1080p;
- the gameplay values are unchanged, so M4's test still passes.

### M6: Ghost

- Record, store and replay the best Lap, as described above.

Accept when:
- after a Lap, the next run shows the Ghost tracing the previous best Lap exactly;
- the Ghost survives a page reload;
- the game still runs with storage blocked.

### M7: Bike look

Replaces the wireframe box with a light-cycle model whose orientation reads at a glance, plus an Attitude indicator while Airborne. Source: `prototype/bike-look` (variant C and the Attitude indicator block; deleted once built).

**Model** (Bike local: +z forward, +y up, +x left; Track surface at y = 0; about 0.56 × 2.5 m, under 1 m tall; light-cycle redesign in [#49](https://github.com/rokaN8/racing_game/issues/49)):
- Two hubless wheels, radius 0.4 m, centred at z = ±0.8: a wide glowing cyan tyre band and a thin inner ring.
- One bevelled shell, 0.46 m wide (plus bevel), that wraps each wheel's centre inside its rim. It has a low belly between the wheels and a spine that dips at the cockpit and humps over the rear, so it reads as a narrow teardrop from the chase camera.
- Every body part is solid near-black (`0x040a14`) with thick dim-teal `Line2` edges (`0x1a5a66`), both below the bloom threshold, so hidden lines stay hidden and only the wheels and lights glow.

**Orientation cues:**
- **Up / roll:** a tall white dorsal fin over the rear half.
- **Heading:** a flat white chevron on the deck, tip forward.
- **Front / back:** a white headlight at the nose; an orange-red tail stripe (`0xff4a10`) across the full width of the shell's back slope.
- **Underside:** an orange underglow (`0xff7a00`, additive), seen only from below.
- No cue uses the Track's magenta or the Checkpoints' yellow.

**Wheel spin:** each wheel carries 3 short white dashes between the inner ring and the rim. The spin is scaled down from the true rolling rate, so that it shows about 4 turns a second at top speed (55 m/s) and rises linearly with speed. While Airborne, the wheels keep the spin they had at take-off.

**Boost glow:** while Boost is active, the body's edges light up to cyan, the rings brighten towards white (bigger bloom) and the tail light flares. Both fade back over the last 0.3 s of Boost. The Light trail is unchanged.

**Lean:** on the Track the Bike leans into its sideways acceleration (yaw rate × speed plus the change in sideways speed), up to 25° at 30 m/s², smoothed. It rolls about the contact line and levels out while Airborne. This is render-only: physics and the camera ignore it.

**Ghost Bike:** the same model with every part translucent white (fin, chevron and underglow included). It has no wheel spin, no lean and no Boost glow. The recording format is unchanged.

**Light trail:** starts at the tail, (0, 0.5, −1.08) in Bike-local coordinates. Its style is unchanged from M5.

**Attitude indicator** (in `hud.ts`):
- An artificial horizon about 140 px across, bottom-right, shown only while Airborne.
- The horizon line (cyan) rotates with the Bike's roll and shifts with its pitch, against world up.
- The sky half is near-black; the ground half is dark orange-brown, matching the underglow.
- A fixed white Bike symbol sits in the centre.

Accept when:
- it holds 60 fps on the dev machine at 1080p;
- the gameplay values are unchanged, so M4's test still passes;
- Ghost playback still traces the best Lap exactly;
- the Attitude indicator shows only while Airborne and tracks pitch and roll;
- wheel spin rises with speed with no visible strobing;
- Boost visibly brightens the Bike and its tail light, and the effect fades as Boost ends.

### M8: Cornering

Turns are no longer free: each turn pushes the Bike towards its outside edge, so the player has to steer through it.

**Cornering pull** (in `bike/physics.ts`, `cornerPull`):
- Sideways acceleration on `latVel` = −cornerPull × speed² × the Track's curvature within its own surface (tangent change along the Track's right, measured over ±3 m) × max(0, Track up.y).
- It is added on top of the existing steer response. Steering against it is the only counter; nothing else changes on the Track.
- Because it uses curvature *within* the surface and scales by up.y, the Loop's walls and ceiling and the straight Wall-ride don't pull, and a bank softens a turn.
- cornerPull is a tuning value (1 = physical), set by play-testing.

**Difficulty:** at top speed (55 m/s), full steer can hold every turn (peak pull below steerRate × steerResponse = 120 m/s²). Not steering, or steering late, goes off the edge and respawns with +3 s. Boost speed through a tight turn can't be held.

**Headless pilot:** steers to the centre line, cancelling the pull (feed-forward) plus a pull towards d = 0.

Accept when:
- a full-throttle Lap with no steering goes off the edge in the first turn;
- full steer holds every turn at top speed;
- the Loop's walls and ceiling don't pull;
- with the steering pilot, M4's Lap checks still pass (about 40 s with Boost).

## Out of scope

- Audio.
- Opponents and multiplayer.
- A solid (collidable) Light trail.
- A Track editor or procedural Tracks.
- More than one Track.
- Polished art.
- Suspension squash on landing.
- Drift.
- A Boost meter or Boost pickups.
- Split times.
- Any hosting other than GitHub Pages.
