# Neon racer POC spec

The hand-off spec for the neon racer proof of concept. Each section sums up a locked decision. The linked ticket holds the full detail and reasoning, so check it before changing anything. Charted on [Wayfinder: Neon racer POC spec](https://github.com/rokaN8/racing_game/issues/1). Vocabulary: [`GLOSSARY.md`](../GLOSSARY.md).

## What the POC is

A browser-based neon/TRON, 80s synthwave Time trial:

- one Bike on one closed Track;
- a run is one Lap, about 40 s;
- the Bike rides a Loop and a Wall-ride, and jumps two Gaps;
- it has Boost and Air control;
- you race the clock or a Ghost of your best Lap.

The look is neon wireframe on black with bloom. There are no art assets.

## Locked decisions

| Area | Decision | Ticket |
|---|---|---|
| Stack | Three.js + TypeScript + Vite, WebGL. Runtime dependency is `three` only. Bloom uses the built-in `UnrealBloomPass`. Dev dependencies: `vite`, `typescript`, `@types/three`, `vitest`. | [Browser 3D stack](https://github.com/rokaN8/racing_game/issues/2) |
| Physics | Custom spline-parameter kinematics, no physics library. On Track the Bike's state is distance along the Track, side offset and speed. Airborne is world-space motion under weak gravity. Landing is a swept test against the Track. Fixed 120 Hz step. | [Physics approach](https://github.com/rokaN8/racing_game/issues/3) |
| Track mesh | Centripetal Catmull-Rom spline with a bank angle per point. Baked to an arc-length table of rotation-minimizing frames (double reflection), with the closure twist spread along the Lap. Gaps are distance ranges with no geometry. | [Track meshes](https://github.com/rokaN8/racing_game/issues/4) |
| Handling | Tuning values, control mapping, and detachment and crash rules all locked. | [Bike handling feel](https://github.com/rokaN8/racing_game/issues/5) |
| Camera | "Hybrid" perspective chase camera: 9 m behind, 3 m up, 8 m look-ahead, FOV 102°, follow stiffness 8. It rolls with the Bike on the Track, levels to world up and follows the flight path when Airborne, and snaps on respawn. | [Chase camera](https://github.com/rokaN8/racing_game/issues/6) |
| Track | Lap order: Loop → right turn → Gap A (top speed) → left turn → Wall-ride → Gap B (needs Boost) → right turn. 4 Checkpoints, each at least 60 m before a hazard. Geometry is fitted to the physics. | [Test Track layout](https://github.com/rokaN8/racing_game/issues/7) |
| Scope | Boost is cooldown-based. Minimal HUD. Ghost of the best Lap, recorded as poses. | [First build slice and POC spec](https://github.com/rokaN8/racing_game/issues/8) |

### Handling values

| Area | Values |
|---|---|
| On Track | topSpeed 55 m/s, accel 25, brake 45, drag 0.04, overspeedDecay 12, slopeGravity 20, steerRate 12 m/s, steerResponse 10 |
| Track grip | stickSpeed 18: below this speed the Bike drops off when upside down (Track up.y below -0.3) |
| Airborne | airGravity 12 m/s², airControlRate 2.5 rad/s, landingTolerance 35°, maxAirTime 6 s |
| Boost | +20 m/s top speed, +10 m/s kick, 2× accel, 1.2 s duration, 3 s cooldown |
| Respawn | at the last Checkpoint, 20 m/s, +3 s penalty |

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

**Air control.** It rotates the Bike only. It doesn't change the Bike's velocity.

**Landing.**
- The Bike must be crossing down through the surface.
- Its nose and up must both be within 35° of the Track, or it is a crash and respawns.
- After landing, speed becomes the velocity along the Track tangent.

**Falling off.** Being Airborne longer than maxAirTime, or falling 30 m below the lowest Track point, respawns the Bike.

### HUD

Shows lap time (penalties included), speed, Boost ready/cooldown, and last and best Lap.

It's plain HTML over the canvas.

### Ghost

**Recording.** Record the Bike's position and orientation every physics step, about 4,800 samples per Lap.

**Storage.**
- Keep the best Lap's recording in memory and in `localStorage`.
- Wrap every storage read and write in try/catch. The game must work without storage.

**Playback.** Replay it as a translucent wireframe Bike, sample by sample in step with the run's own steps.

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
  render/scene.ts  # Track ribbon and edges, Bike mesh, grid, bloom, Light trail
  hud.ts
  ghost.ts         # record / store / replay
test/track.test.ts # headless acceptance check (Vitest)
```

**Port, don't rewrite.** `bakeTrack`, `sampleAt` and `step` come from the play-tested prototype ([`prototype/bike-handling`](https://github.com/rokaN8/racing_game/blob/prototype/bike-handling/prototypes/bike-handling.html)), ported to TypeScript as they are. The prototype's chase-camera block becomes `camera.ts`.

## Milestones

Each milestone ends in something you can play.

### M1: First slice: ride the Track

- Project setup: `npm create vite@latest -- --template vanilla-ts`, then `three`, `@types/three` and `vitest`.
- Bake the prototype Track (`CPS` in the prototype) into the Track table.
- On-Track riding with keyboard throttle, brake and steer, with the Hybrid chase camera.
- Plain coloured ribbon and lines. No Airborne, Gaps or Boost yet.

Accept when:
- `npm run dev` opens and you can ride laps;
- the Loop works: full throttle clears it, and coasting in at 38 m/s drops off the ceiling;
- `npm test` passes a frame check: every sample's up is perpendicular to its tangent, and the Track wraps with no twist at the seam.

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
- a full-throttle Lap with no Boost lands Gap A and fails Gap B;
- a full-throttle Lap with Boost at Gap B is clean and takes about 40 s (±5 s);
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

## Out of scope

- Audio.
- Opponents and multiplayer.
- A solid (collidable) Light trail.
- A Track editor or procedural Tracks.
- More than one Track.
- Polished art.
- Drift.
- A cornering challenge: turns are free under spline-follow.
- A Boost meter or Boost pickups.
- Split times.
- Deployment: the POC runs locally only.
