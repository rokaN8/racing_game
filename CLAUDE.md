# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Browser neon/synthwave time trial: one Bike, one Lap of a closed Track, against the clock or a Ghost. Three.js + TypeScript + Vite; `three` is the only runtime dependency. Live at https://rokan8.github.io/racing_game/ (Vite `base` is `/racing_game/`).

## Commands

```sh
npm run dev                                   # dev server
npm test                                      # vitest run: headless physics/Track/Ghost/menu checks
npx vitest run test/tracks/technical.test.ts  # one file
npx vitest run -t "Switchback"                # by test name
npm run build                                 # tsc (type check, noEmit) + vite build → dist/
```

There is no separate lint step; `tsc` (strict unused-locals/params, `erasableSyntaxOnly`) runs as part of `build`. Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml`, which runs `npm test` and `npm run build` first.

## Specs and vocabulary

- `docs/poc-spec.md` and `docs/game-spec.md` hold the locked decisions (with ticket links), handling values, design rules, module layout and milestones. Code comments cite them as `docs/game-spec.md → <section>`; keep that up to date when behaviour changes.
- `GLOSSARY.md` defines the game's terms (Track, Lap, Gap, Kicker, Landing deck, Checkpoint, Airborne, Cornering pull, Ghost…). Code, comments, tests and UI use these capitalized terms; stick to them.
- `docs/feature-ideas.md` is the backlog of feature ideas (ids like A1, D2, each tagged with its issue once filed). Keep it current: a PR that builds an item ticks its box (`- [x]`) in that same PR, a newly filed issue gets its `[#n]` tag, and new or dropped ideas are recorded there.
- `TUNING` in `src/bike/tuning.ts` is the locked set of handling values from the POC spec. Don't retune it to make a Track work; fit the Track geometry to the physics instead.

## Architecture

**Data flow:** `TrackDef` → `bakeTrack` → `Track` (sampled arrays) → `physics.step` mutates `BikeState` → `main.ts` renders it.

- **Tracks** (`src/track/tracks/`): one `TrackDef` per Track (control points, Gap segments, Checkpoint indices, half-width, palette, Song), listed in `TRACKS` in Menu order. `id` keys localStorage, so never rename one. Overdrive (`allround.ts`) has hand-written control points; Switchback, Hang Time, Slipstream, Afterglow, Vertigo and Knot are built with the turtle builder (which also has Corkscrew, Boost pad and Tunnel pieces; a turn past 360° with a rise is a Helix, two Loops in a row a Double Loop).
- **Turtle builder** (`src/track/turtle.ts`): lays out pieces (straight, turn, kicker, gap, loop) from a heading. Two straights are marked `free` and their lengths are solved with a 2×2 linear system so the Lap closes; total turn must be a multiple of 360° (0° for a figure-8), and the Lap must end at the start height. Gap length and Landing deck span are computed from the flight physics; its `AIR_GRAVITY` constant must match `TUNING.airGravity`.
- **Bake** (`src/track/bake.ts`): closed centripetal Catmull-Rom → ~1 m arc-length samples with rotation-minimizing frames (double reflection), turned so the per-point bank is measured from level (eased through a Loop's vertical part). `sampleAt(T, s)` interpolates a frame at any distance `s`.
- **Physics** (`src/bike/physics.ts`): pure, with no DOM, rendering or input imports (a spec rule). On the Track the state is `s` (distance), `d` (side offset) and `speed`, with Track-relative gravity and Cornering pull. Airborne is world-space motion under weak gravity, with Air control rotating only the Bike; landing is a swept test against every solid sample. Leaving the Track or a bad landing respawns the Bike at the last Checkpoint with a time penalty.
- **main.ts**: builds every Track's scene and Ghost at boot and swaps between them. Physics runs at a fixed 120 Hz with an accumulator and only steps while racing with no screen open; rendering only smooths orientation. Sound effects fire on state diffs between frames.
- **Menu** (`src/ui/menuState.ts`): a pure state machine that returns `Effect`s; `ui/menu.ts` draws it and `main.ts` carries out the effects.
- **Runs and lap counts:** a run is 1, 3 or 5 Laps (`LAP_OPTIONS` in `ui/menuState.ts`, default 3). Physics only counts Laps (`st.laps`, `st.lapTime`); `main.ts` ends the run at the chosen count, and the Ghost module adds up the run time.
- **Ghost / High scores** (`src/ghost.ts`): one instance and one storage key per Track and lap count (`neon-racer.track.<id>.v1` for 1 Lap, `.<n>laps.v1` otherwise). Each localStorage key holds the top 5 run times (with lap splits) and the best Sector times; the Ghost's poses and run distances (Float32Array) live in IndexedDB (`src/ghostStore.ts`, same key), tagged with their #1's time and date, and load when a run on the Track starts. With no Ghost of your own the Pilot Ghost stands in: `pilotRun` rides `TrackDef.pilot` through the same `record()`, built a few ms a frame by `main.ts`. Medal targets come from `TrackDef.pilotTimes`, which a shared Track check keeps matching the live Pilot. Every storage access is try/catch-guarded, because the game must run with storage blocked, missing or holding garbage. Old pre-Track keys migrate to Overdrive.
- **Songs** (`src/audio/songs.ts`, `src/audio.ts`): each Song is data (16-step pattern strings) played by a pure step generator; Track Songs live on their `TrackDef`.

## Tests

The tests drive real physics headlessly through `src/pilot.ts` (in `src/` because the game rides it too, as the Pilot Ghost), a scripted player that steers to the centre line, optionally brakes for turns, boosts and uses Air control. `test/track.test.ts` runs the shared checks over every entry in `TRACKS`. `test/tracks/<id>.test.ts` holds each Track's Lap checks (clean Lap, lap time, expected failure modes, Checkpoint count). A new Track needs its own file there.

## Conventions

- `ponytail:` comments mark deliberate simplifications along with their known ceiling (e.g. the O(N) landing scan). Keep them when you touch that code.
- Work is tracked as GitHub issues. Branches are `feature/issue-<n>`, PRs say `Closes #<n>`, and they merge with merge commits.
