# Neon racer game spec

The hand-off spec that rounds the neon racer POC out into a game. Each section sums up a locked decision. The linked ticket holds the full detail and reasoning, so check it before changing anything. Charted on [Wayfinder: Rounded-out game spec](https://github.com/rokaN8/racing_game/issues/33). Vocabulary: [`GLOSSARY.md`](../GLOSSARY.md).

**Builds on [`poc-spec.md`](poc-spec.md).** Physics, handling values, rules, camera, Bike look, Cornering, HUD and the Ghost's recording all stay as locked there unless a section below says otherwise.

## What the game is

The POC's Time trial, rounded out:

- **five Tracks**, all open from the start, one Lap per run:
  - **Overdrive**: the all-rounder, today's Track
  - **Switchback**: technical, with braking turns
  - **Hang Time**: big air, with Gaps and drops
  - **Slipstream**: flow, no braking, with a Corkscrew and Boost pads ([Wayfinder: Tracks 4 and 5](https://github.com/rokaN8/racing_game/issues/51))
  - **Afterglow**: flight, no braking, with five Gaps, a Corkscrew into a Gap and Boost pads
- a **Menu** with Track select (High scores included) and Controls; **Pause** mid-run; a **Finish screen** after each Lap;
- **High scores**: the top 5 Lap times per Track, on this device only. #1 is that Track's Ghost;
- a neon **palette** and a synth **Song** per Track, plus a Menu Song.

Still no art or audio files: everything is drawn and synthesised in code.

## Locked decisions

| Area | Decision | Ticket |
|---|---|---|
| Flow | Boot → Menu (Play → Track select · Controls; High scores and Reset times live in Track select). Picking a Track → countdown → run → Finish (Retry · Track select · Menu). Pause (Esc / Start): Resume · Restart · Quit to Menu. Keyboard and gamepad everywhere. | [Wayfinder: Rounded-out game spec](https://github.com/rokaN8/racing_game/issues/33) |
| Runtime and storage | One `TrackDef` record per Track in an ordered `TRACKS` array. Every Track's scene is built at boot and swapped. One storage key per Track holds its top 5 and its Ghost. Today's best migrates to Overdrive. | [Multi-Track runtime and storage](https://github.com/rokaN8/racing_game/issues/34) |
| Screens | Side-rail overlay over the frozen game. Track select shows each Track's kind, top-down outline and top 5. Reset is press twice within 3 s. | [Menu, Pause and High scores screens](https://github.com/rokaN8/racing_game/issues/35) |
| Songs | Song as data, played by a pure step generator. Four Songs. Crossfade 1.5 s; Retry keeps the Song going; Pause muffles it. | [Four distinct synth Songs](https://github.com/rokaN8/racing_game/issues/36) |
| Switchback | 3 km figure-8 with an overpass, braking turns, a curving Wall-ride and no Gaps. 7 Checkpoints, ~54 s. | [Technical Track layout](https://github.com/rokaN8/racing_game/issues/37) |
| Hang Time | 3.2 km figure-8: lift hill, 5 Gaps onto Landing decks, two Loops. 7 Checkpoints, ~54 s. No handling change. | [Big air Track layout](https://github.com/rokaN8/racing_game/issues/38) |
| Slipstream | 3.4 km figure-8, no braking: Loop, Rollercoaster, a Corkscrew upside down over the start straight, curving Wall-ride, one Gap, two Boost pads. 6 Checkpoints, ~53 s. | [All-rounder Track 4 layout](https://github.com/rokaN8/racing_game/issues/55) |
| Afterglow | 3.3 km single loop, no braking: launch Gap, lift hill, a Corkscrew on the ridge straight into a drop Gap, step-up Gap, big drop, Loop, double. Two Boost pads. 7 Checkpoints, ~54 s. | [Big air Track 5 layout](https://github.com/rokaN8/racing_game/issues/56) |
| Vertigo | 3.2 km single loop, no braking: a Helix up a 150 m tower, a 108 m Gap off the top (50–76 m/s), a Helix back down. 5 Checkpoints, ~54 s. Bank is measured from level, so no Track carries frame drift. | [Vertigo layout](https://github.com/rokaN8/racing_game/issues/77) |
| Palettes | Primary, secondary and sky per Track. Darks derived in sRGB. Bike, Ghost and HUD stay fixed. | [Per-Track palettes](https://github.com/rokaN8/racing_game/issues/39) |
| Track 1 name, milestones | Track 1 is **Overdrive**. Build order M9 → M13 below. | [Game spec hand-off](https://github.com/rokaN8/racing_game/issues/40) |

## Tracks

### The Track record

```ts
interface TrackDef {
  id: 'allround' | 'technical' | 'bigair' | 'flow' | 'flight' | 'climb'; // stable: used in storage keys, never renamed
  name: string;                            // display name
  kind: string;                            // shown under the name: 'All-rounder', 'Technical', 'Big air', 'Flow', 'Flight', 'Climb'
  cps: ControlPoint[]; gapSegments: number[]; checkpointCps: number[]; halfWidth: number;
  boostPads?: { cp: number; len: number }[]; // see Design rules → Boost pads
  palette: Palette;                        // see Palettes
  song: Song;                              // see Songs
}
export const TRACKS: TrackDef[] = [overdrive, switchback, hangTime, slipstream, afterglow, vertigo]; // this order everywhere
```

One module per Track in `src/track/tracks/<id>.ts`. Physics already takes the baked Track as a parameter, so it doesn't change.

| | Overdrive | Switchback | Hang Time | Slipstream | Afterglow | Vertigo |
|---|---|---|---|---|---|---|
| id · kind | `allround` · All-rounder | `technical` · Technical | `bigair` · Big air | `flow` · Flow | `flight` · Flight | `climb` · Climb |
| Length | 2,251 m | 3,022 m | 3,240 m | 3,388 m | 3,329 m | 3,160 m |
| Clean Lap (pilot, Boost) | ~40 s | ~54 s | ~54 s | ~53 s | ~54 s | ~54 s |
| Checkpoints | 4 | 7 | 7 | 6 | 7 | 5 |
| Code | `src/track/tracks/allround.ts` (the POC's layout) | `src/track/tracks/technical.ts` | `src/track/tracks/bigair.ts` | `src/track/tracks/flow.ts` | `src/track/tracks/flight.ts` | `src/track/tracks/climb.ts` |

**Overdrive.** Today's Track as it is: Loop → right turn → Rollercoaster → left turn → Wall-ride → Gap B → right turn.

**Switchback** (figure-8, no Gaps):
- start straight → **hairpin** (right, R11, 10° bank) → **chicane** (R22)
- → left 90 → **switchback** (left, then right hairpin, R13) → climb +12 m → sweeper (right, R50)
- → **overpass**: a long bridge straight with a tight **bridge chicane** (R14)
- → **curving Wall-ride** (left, 150° at R90, 90° bank, descending) → **esses** (four turns, R30)
- → **double-apex** (left, 2 × 45° at R15) → **final chicane** (R16) under the overpass → home straight

Checkpoints: start line, before the hairpin, before the chicane, before the switchback, on the bridge before the bridge chicane, before the Wall-ride, before the double-apex.

**Hang Time** (figure-8):
- start straight → **Loop 1** (R20) → right turn → **lift hill** (up to 60 m)
- → **drop Gap** (deck 12 m lower) → right turn → **over-the-top Gap**, which flies over the home straight
- → left turn → **step-up Gap** (14° Kicker, deck 3 m higher) → left turn
- → **big drop** (~50 m) → **Loop 2** (R22)
- → left turn → home straight → **double** (two Gaps back to back) → start line

Checkpoints: start line, before the drop Gap, before the over-the-top Gap, before the step-up, before Loop 2, on the home straight before the double, on the first double deck.

**Slipstream** (figure-8, no braking: every turn holds at full throttle, even Boosted):
- start straight → **Boost pad** (60 m) → **Loop** (R22) → right sweeper (R60) → **Rollercoaster** (two rolling hills)
- → right sweeper → climbing right turn (+14 m) onto the **bridge**
- → **Corkscrew** (200 m, rolling right, 40 m held upside down), upside down right over the start straight, 14 m below
- → **curving Wall-ride** (left, 90° at R90, descending) → **Gap** (8° Kicker, deck level with the lip)
- → **Boost pad** (150 m) down the deck run-out → two left sweepers → home straight, on under the bridge

Checkpoints: start line, before the Loop, before the climb, on the bridge before the Corkscrew, before the Wall-ride, before the Gap.

**Afterglow** (single loop, 360° right, no crossings, no braking):
- start straight → **launch Gap** (deck 6 m lower) → right sweeper → **lift hill** (+40 m) with a **Boost pad** (140 m) up most of it
- → ridge → **Corkscrew** (100 m, rolling left, no hold) straight into the **drop Gap** (deck 10 m lower)
- → descending left sweeper → **step-up Gap** (14° Kicker, deck 3 m higher) → 180° right sweeper
- → **big drop** back to the ground → **Loop** (R22) → **Boost pad** (150 m) down the back straight
- → right sweeper → **double** (two Gaps back to back) → run-out → right sweeper → home straight

Every Boost pad ends ≥200 m before the next Kicker, so every lip is back under 76 m/s and the Landing decks hold.

Checkpoints: start line, at the foot of the lift hill, on the ridge before the Corkscrew, at the start of the left sweeper before the step-up, before the Loop, before the double, on the first double deck.

**Vertigo** (single loop, 360° right, no braking: both Helixes hold even Boosted; [Vertigo layout](https://github.com/rokaN8/racing_game/issues/77)):
- start straight → right sweeper → **climb Helix** (right, 1080° at R40, bank 35°, +150 m, ~20 % grade)
- → top straight → **the Gap off the top** (8° Kicker, deck 12 m lower, 108 m across, 50–76 m/s)
- → **descent Helix** (left, 1080° at R40, bank 35°, −138 m) → run-out → three right sweepers → home straight

Its Gap's window starts at 50 m/s, not 40 (see Design rules → Gaps). Checkpoints: start line, the foot of the climb, halfway up, the top (80 m before the Kicker), halfway down.

The exact pieces are in `src/track/tracks/technical.ts`, `src/track/tracks/bigair.ts`, `src/track/tracks/flow.ts`, `src/track/tracks/flight.ts` and `src/track/tracks/climb.ts`.

### Building Tracks 2 and 3: the turtle builder

`src/track/turtle.ts` lays a Track out from a heading instead of hand-placed points, so turn radii are exact:
- **pieces:** straight (with a height change), arc (turn angle, radius, bank, height change; past 360° with a height change it is a Helix, [Helix piece](https://github.com/rokaN8/racing_game/issues/75)), Kicker, Gap, Loop, Corkscrew (length, roll direction, metres held upside down; [Corkscrew piece](https://github.com/rokaN8/racing_game/issues/52)), and Boost pad (a strip length, starting where the next piece starts; [Boost pads](https://github.com/rokaN8/racing_game/issues/53))
- **closing:** two straights are marked *free*. Their lengths are solved (a 2×2 linear solve) so the Lap closes on the start line. Only the position is solved, so the Lap's total turn must be a multiple of 360°: 0° for a figure-8, ±360° for a single loop, and a Helix adds whole turns. The shared seam check catches a heading that doesn't close.
- **output:** the usual `ControlPoint[]` plus Gap segments and Checkpoint indices, for `bakeTrack`

Overdrive keeps its hand-written control points.

### Design rules

**Turns.** Full steer cancels at most 120 m/s² of Cornering pull (steerRate × steerResponse). A turn holds at speed v while v² × curvature × cos²(bank) ≤ 120. A turn tighter than that at top speed needs braking. That is Switchback's skill, and Overdrive never asks for it.

**Gaps.** Every Gap is **Kicker → Gap → Landing deck**:
- **Kicker:** a parabola from the current grade up to the lip angle (8°; 14° for a step-up).
- **Landing deck:** flat, `d` m below the lip (negative for a step-up).
- **Deck span:** it starts where a 40 m/s flight comes down and runs 20 m past where a 76 m/s flight does. On a flat deck the landing angle stays near the lip angle at every speed.
- **Speed window:** 40–76 m/s. A Gap may raise its 40 to buy a longer Gap off a small drop (Vertigo's is 50, under top speed). The drop limits it: the slowest flight lands steepest, and a 30 m drop comes down 32–37° at 40–50 m/s against the 35° tolerance, so keep the slowest landing under ~25°.
- **Why flat:** decks sloping downhill made fast Bikes fly for 3–5 s and overshoot (airGravity is only 12).
- **Drops:** big drops go on the Track between jumps.
- **Boost:** no Gap needs Boost.

**Corkscrews.** A flat straight that rolls 360° around its centre line, eased in and out. The bake steps bank the short way between control points, so a roll ending at 360° carries on at 0° instead of unwinding (any step between two points stays under 180°). Riding upside down needs no handling change: below `stickSpeed` (18 m/s) the Bike drops off, as on a Loop, so a respawn at 20 m/s must still clear it.

**Helixes.** A plain arc past 360° with a height change, at a steady grade (the spline softens the step at its foot and top). `TUNING` is unchanged.
- **Climbing is free:** at full throttle accel (25) beats slopeGravity (20) plus drag on any grade, so a Helix doesn't slow the Bike. Its radius, bank and headroom are the limits.
- **Holding it:** the Turns rule above. Vertigo's 3 turns at R40, bank 35°, hold Boosted too (pull ~94 m/s²). The Tight tower shape (900° at R30, bank 35°, +60 m) holds at top speed but not at Boost top speed (pull ~126 m/s²), so Boosting in it slides the Bike off. A layout that wants Boost through its Helix opens the radius or the bank.
- **Headroom:** coils stack, so they need the 8 m of the self-crossing check; 24 m a turn leaves 18 m.
- **Checkpoints:** split a Helix into two arcs to put a Checkpoint inside it. A 20 m/s respawn there rides clean.
- **Bank stays true:** the bake measures bank from level, not from its rotation-minimizing frame, which drifts on a climbing turn (~95° a turn on Vertigo's 20 % grade; it rolled the tower top upside down). See Design rules → Bake frames.

**Boost pads.** A strip `len` m long, drawn as forward chevrons every 6 m in the secondary colour. `TUNING` is unchanged.
- **Riding onto one:** +`boostKick` speed, the rising pad chime plus the Boost whoosh, and a Boost sized as the strip's length at Boost top speed plus `BOOST_PAD_TAIL` (0.3 s), so the HUD meter drains across it.
- **On the strip** the Boost is held at least `BOOST_PAD_TAIL`, however the Bike got there (also a landing or respawn), so it ends about 0.3 s past the strip's end.
- **The Boost button** is left alone: still ready if it was, and pressing it on a strip never cuts the pad's Boost short.
- **Placing them:** the strip length is the layout's call, so a long straight gets a long strip. A pad isn't a Gap's way across: every Gap still clears without Boost.

**Checkpoints.** Each sits ≥60 m before the hazard that follows it, and a respawn at 20 m/s clears that hazard.

**Bake frames** ([Vertigo layout](https://github.com/rokaN8/racing_game/issues/77)). The bake carries a rotation-minimizing frame along the spline, then turns it so each sample's bank is measured from level (world up, square to the tangent). Without that, a climbing turn or a Loop that drifts sideways rolls the frame and the leftover was spread round the Lap: the five older Tracks leaned 6–10° off their banks on average, and their Pilot times moved by up to 2.2 s (5 Laps) when this was fixed. Near vertical (a Loop) level is undefined, so the correction is eased across that stretch, and each pass over a Loop's top flips which way level points. The start line must be level.

## Screens

An HTML overlay over the frozen game. While it's open the HUD is hidden and the run is frozen (countdown, physics and engine sound). Built in M10: `src/ui/menu.ts` draws the pure state machine in `src/ui/menuState.ts`.

- **Layout.** A left rail over a dark gradient on the left third: title, items, then key hints for that screen as key chips. The focused item is a slanted magenta bar with dark text. A detail panel on the right shows whatever the focused item is about; it shares the rail's top line, never runs under the rail, and scrolls inside itself rather than off screen. The game stays visible behind.
- **Menu.** Logo, then Play · Controls. Coming back to it restores the last focus.
- **Track select** (also where the High scores live).
  - **Rail:** the lap count under the title (`‹ 3 Laps ›`, set with ← →, stopping at 1 and 5; 3 at boot), then name, kind and palette swatch per Track, then a smaller Reset times. Focus starts on the last-raced Track.
  - **Rail Medal:** the Medal each Track's #1 earns at the current lap count, as a small tag before its swatch.
  - **Panel:** palette band, name, kind, a **top-down outline** of the whole Track (centred, scaled to the window height), its top 5 at the current lap count, the Ideal time ("Ideal 1:58.40", while it isn't above #1), then the four Medal target times, the ones #1 has earned lit (Neon marked "beat the Pilot"). With no times yet: "No times yet. Beat the Pilot: your fastest run becomes your Ghost."
  - **Outline** (`ui/outline.ts`, shared with the HUD's minimap): drawn from the baked Track's x/z, with Gaps left open, the start line marked and a tick across each other Checkpoint, stroked in the palette gradient. +z points up the screen and the Bike's starting right is to the right.
- **Reset times.** Opened from Track select; back returns to it. The rail holds each Track, then All Tracks; the panel shows the focused Track (or every Track's #1). The first press turns the item red with "Reset Overdrive? 3", a line under it saying what goes ("Deletes Overdrive's times and Ghosts at every lap count. Press again to confirm."), and the panel edge turns red. A second press within 3 s resets every lap count of that Track; "Overdrive cleared" shows for 2.5 s. A timeout or moving focus cancels.
- **Controls.** The Keyboard | Gamepad table sits in the rail.
- **Pause** (Esc / Start, or leaving the game mid-run: a hidden tab or the window losing focus during the countdown, a run or a crash, [#69](https://github.com/rokaN8/racing_game/issues/69); already on a screen, nothing changes). The rail shows the Track name, the Lap (past 1 Lap) and the run time so far, then Resume · Restart · Quit to Menu. Esc, Start or B resume. Quit to Menu resets the run.
- **Finish.**
  - **Rail head:** the Track and lap count in its palette colour, the run time, then the rank as a big numeral. A new #1 adds a slanted magenta NEW BEST tag that pops in, with the gain on the old best; otherwise the gap to the best. Outside the top 5 it says so instead of a rank. Under it, the Medal this run earned and the gap to the next one ("Gold · 0.41 to Neon", or "No Medal · 1.20 to Bronze"); a Medal better than the old #1's pops in like NEW BEST. Then Retry · Track select · Menu.
  - **Panel:** the Track's top 5 at this lap count with this run highlighted; outside the top 5, a dashed "You" row with the gap to #5. Then the Ideal time and how far #1 is off it ("Ideal 1:58.40 · best 1.10 off"), then each Lap's time, the first fastest tagged. R / Y still retry.
  - **Lock:** a pick is ignored for 0.7 s after Finish opens, so a Boost tap (Space / A) at the line can't skip it.
- **Top 5 rows.** `#n · time · date`, with a **Ghost** tag on #1, and #1's Lap times under it for runs of more than 1 Lap.
- **Input.** Up/down (arrows, W/S, d-pad or left stick) move; left/right (arrows, A/D, d-pad or stick) set the lap count on Track select and move elsewhere. Enter/Space pick, Esc/Backspace back. Gamepad: A picks, B backs out, Start pauses and resumes. All edge-triggered.

## Input

The POC's controls, plus **gamepad rumble** ([#68](https://github.com/rokaN8/racing_game/issues/68), `rumble()` in `input.ts`, off the same state changes as the sound effects): a thump on landing that grows the further off the landing angle, a strong 0.4 s one on a crash, a light 0.2 s buzz on a Boost pad, a lighter 0.15 s one on Boost, a tick at each Checkpoint and a double tick on each Lap. Only during a run: Pause stops it, while the last Lap's double tick still plays as the Finish screen opens. A weaker rumble never cuts a stronger one short. M doesn't touch it; with no pad or no support (Firefox) it does nothing.

## Medals

Bronze, Silver, Gold and Neon target times per Track and lap count, set against the Pilot's run time `P` there ([#62](https://github.com/rokaN8/racing_game/issues/62)): **Neon** faster than `P` (you beat the Pilot), **Gold** ≤ `P` × 1.05, **Silver** ≤ `P` × 1.12, **Bronze** ≤ `P` × 1.25. A starting point, to tune by play-testing. Targets and times are compared to the hundredth, as they are shown: a time equal to Gold's, Silver's or Bronze's target earns it, while Neon takes beating `P`. `P` is baked into each `TrackDef` (`pilotTimes`), and a shared Track check holds it within 0.05 s of the live Pilot, so Track select never rides the Pilot. Your Medal is the one your #1 earns: nothing is stored, and Reset times clears it with the scores. `medalFor(time, P)` sits beside the menu state.

## Pilot Ghost

Every Track has a rival from the first run ([#61](https://github.com/rokaN8/racing_game/issues/61)). With no Ghost of your own at a Track and lap count, the Pilot's run is the Ghost, with its Checkpoint splits, so the split line, the live gap and the Lap banner work against it. Your first finished run replaces it; Reset times brings it back. It never enters the High scores, and the HUD best stays your own.

- **The Pilot** (`src/pilot.ts`, physics-only imports) is the headless driver the Track tests ride. Each `TrackDef.pilot` holds the profile of its clean, fastest Lap: Overdrive Air control + Boost before the Gap; Switchback brakes + Boost on straights; Hang Time Air control + brakes + Boost on straights; Slipstream and Afterglow Air control + Boost on straights. A shared check rides it clean at every lap count.
- **Computed, never stored.** Physics is pure and fixed-step, so the run comes out the same every time. `pilotRun` records it through the Ghost's own `record()`, so its poses, splits and distances are in the format the Ghost plays. It is built lazily, from the countdown of the first run with no Ghost, a few ms a frame while no screen is open (a 5-Lap Hang Time run is ~30,000 steps, ~0.6 s of the countdown at 120 fps) and finished outright at GO if it isn't done. The Pilot's turn look-ahead is cached per Track sample, which made that affordable.

## Storage

- **One key per Track and lap count:** `neon-racer.track.<id>.v1` (1 Lap: the key from before lap counts) or `neon-racer.track.<id>.<n>laps.v1`. In localStorage it holds `{ scores: [{ time, date, lapTimes }], sectors? }`, read at boot, so Track select, the HUD best and the Medals never wait. The same key holds the Ghost in the Ghost store ([Ghost storage on IndexedDB](https://github.com/rokaN8/racing_game/issues/74)).
  - `scores` holds at most 5, fastest first. `time` is the run total, `lapTimes` each Lap's time (a 1-Lap score saved without it reads as `[time]`). `date` is epoch ms, shown in the local format.
  - `sectors` ([#65](https://github.com/rokaN8/racing_game/issues/65)): the best time ever ridden in each Sector, a Checkpoint pass to the next (each Lap's start line counts; the last ends at the finish), from every finished run, top 5 or not. Penalties count in their Sector. Garbage or a length other than Laps × Checkpoints loads as empty; the scores stay. Records from before have none, so the Ideal time counts runs from then on.
- **Ghost store** (`src/ghostStore.ts`): IndexedDB database `neon-racer`, version 1, object store `ghosts`, keyed as above. Each value is `{ time, date, poses, splits, dist }`: the Ghost and the `time` and `date` of the #1 it belongs to. A stored Ghost that doesn't match `scores[0]` (or is garbage) is dropped, and the Pilot Ghost stands in, so scores and Ghost can't disagree. Opened on first use; a connection closes on `versionchange`, so it never blocks a newer tab's upgrade. `navigator.storage.persist()` isn't called (eviction is the same as localStorage's). Facts behind it: [IndexedDB for Ghost storage](https://github.com/rokaN8/racing_game/issues/73).
  - `poses`: Float32Array, 7 floats (position, quaternion) per physics step: the whole run, stored as is. `splits`: the run time at every Checkpoint pass of every Lap.
  - `dist` ([#63](https://github.com/rokaN8/racing_game/issues/63)): Float32Array of `[run distance, run time]` pairs at 10 Hz (every 12th step), plus the furthest point before each respawn sends the distance back, and the finish. Run distance = Laps done × Track length + `s`. The run time is kept because the run clock carries the penalties. ~2.4 % of a 5-Lap Ghost. A Ghost without it (or with garbage) plays and splits as before, with no live gap.
  - **Loading:** a Track's Ghosts (every lap count) load when a run on it first starts, and stay for the session. The countdown covers the read. A Ghost that arrives after a run's first step waits for the next run; it never swaps in mid-run. Until it arrives the Pilot Ghost builds as usual.
  - **Recording cap:** a run records at most 5 min a Lap (the Pilot's give-up too). A run past it still ranks, but keeps no Ghost.
- **Ranking.** A finished run is inserted into the top 5. An equal time ranks below the existing one. A new #1 replaces the Ghost: the scores are written first, then the Ghost is put into the Ghost store. If that put fails, the Ghost lives in memory for the session.
- **Reset.** Reset a Track = `removeItem` on its keys at every lap count, and a delete of their Ghosts (best effort: with no #1 a stored Ghost is never raced). Reset all = loop over `TRACKS`.
- **Migration.**
  - From before Tracks (once, at boot): if `neon-racer.ghost.v2` (or v1) exists and the Overdrive key doesn't, write Overdrive = `{ scores: [{ time, date: null }], ghost }`. Remove the old keys only after that write succeeds.
  - From before the Ghost store: a localStorage record may still hold its Ghost inline (`ghost: { poses, splits, dist? }`, base64 Float32Array). It is raced straight away. When its Track loads, it is put into the Ghost store, and once that transaction completes the record is rewritten without it. Until then every rewrite keeps it, so a failed put loses nothing; the next load tries again.
- **Guarding.** Every read and write is guarded. Garbage loads as empty, and the game runs with storage blocked: blocked or missing localStorage keeps the times in memory, and a blocked, missing, failing or hung IndexedDB (it fails in several ways, by browser) keeps the Ghosts in memory.
- **Ghost module.** `createGhost(storage, { id, L, cpS }, laps, now, ghostStore)`, one instance per Track and lap count, built at boot. It exposes `scores` (the HUD best is `scores[0].time`), `load()` to fetch its Ghost (once), `clear()` for resets, `restart()`, which is today's `reset()` (retry) renamed, `liveGap(bike)` for the live gap (a binary search over the running max of the Ghost's distances), `idealTime` (the best Sectors added up; null with none, or while above #1), and `needsPilot` / `setPilot()` for the Pilot Ghost.

## Palettes

Built in M11: `src/render/palette.ts`.

- **Shape.** A `Palette` is `{ primary, secondary, sky }`, as sRGB hex.
  - **primary:** Track edges, and the Menu swatch, band and outline start.
  - **secondary:** Checkpoint lines, the FINISH arch and banner text, and the Menu's second colour.
  - **sky:** a solid, very dark background. No gradient, no fog. The horizon is objects in front of it.
- **Derived darks**, mixed byte-wise in **sRGB**, not linear:
  - Track fill = mix(sky, primary, 0.06)
  - rungs = primary × 0.30
  - grid = primary × 0.22 (major lines) and × 0.10 (minor lines)
  - banner background = the fill

  They all stay below the bloom threshold, so only the neon glows.
- **Horizon** ([#66](https://github.com/rokaN8/racing_game/issues/66)): a striped sun where the start straight looks, a ring of wireframe mountains and a few hundred stars, built per Track in `render/scene.ts` and moved with the camera's position (not its rotation), so it sits at infinity. Out past every Track (mountains 2 km, sun 2.3 km, stars 2.6 km; the camera sees 3 km).
  - sun: a gradient from mix(sky, secondary, 0.6) at the top to mix(sky, primary, 0.6) at the bottom, cut by gaps that widen towards the bottom, its foot behind the mountains. The only part that blooms, a little.
  - mountains: primary × 0.35 lines over a mix(sky, primary, 0.03) fill that hides the grid behind them and reaches below eye level.
  - stars: mix(sky, white, 0.4), dimmed at random.
- **Fixed on every Track:** Bike and Light trail cyan, Ghost white, HUD cyan. The Menu keeps today's cyan and magenta.

| Track | primary | secondary | sky |
|---|---|---|---|
| Overdrive | `#ff2bd6` | `#ffe600` | `#000000` |
| Switchback | `#39ff14` | `#ffb000` | `#010a04` |
| Hang Time | `#ff8a00` | `#a64dff` | `#0d0418` |
| Slipstream | `#00ffa3` | `#c400ff` | `#000a06` |
| Afterglow | `#ff3d7f` | `#ffd000` | `#12020a` |
| Vertigo | `#2979ff` | `#ff3ea5` | `#00040f` |

## Songs

Built in M11: `src/audio/songs.ts` (shape, step generator, Menu Song); each Track's Song is on its `TrackDef`.

**Shape.**

```ts
interface Song {
  bpm: number; echo: number;                    // echo = feedback of the dotted-8th delay on the arp
  bars: [chord: string, bassRoot: number, tones: number[]][]; // MIDI; one bar of 16 steps each, looped
  bass:  { pat: string; wave: OscillatorType; cutoff: number; vol: number; len: number }; // r root, o octave up, f fifth, . rest
  pad:   { wave: OscillatorType; cutoff: number; vol: number; attack: number };          // chord once per bar
  arp:   { pat: string; wave: OscillatorType; cutoff: number; vol: number; len: number; oct: number }; // 0-3 chord tone, h lowest +12
  drums: { kick: string; snare: string; hat: string; vol: number };                     // x = hit
}
```

Patterns are 16 characters, one per 16th note. A pure `stepEvents(song, n)` turns a Song and a step number into notes. The Web Audio code only plays them.

**The Songs.** Overdrive's Song is today's hard-coded one, unchanged.

| Song | BPM | Chords | Character |
|---|---|---|---|
| Menu | 84 | Fmaj7 Em7 Dm7 Cmaj7 | Dreamy pads, lazy echoing arp, almost no drums |
| Overdrive | 100 | Am F C G | Today's Song |
| Switchback | 118 | Em F Em D | Dark: driving 16th bass, choppy arp, syncopated kick |
| Hang Time | 128 | D A Bm G | Bright: four-on-the-floor, offbeat bass, rising arp |
| Slipstream | 96 | Cmaj7 Am7 Fmaj7 G | Dreamwave: half-time beat, slow wide pads, echoing triangle arp ([palettes and Songs](https://github.com/rokaN8/racing_game/issues/54)) |
| Afterglow | 140 | A♭ E♭ Fm D♭ | Anthemic: half-time drums, long bass notes, big echoing arp |
| Vertigo (Ascent) | 112 | Dm B♭ F C | Climbing: four-on-the-floor, a staircase arp that climbs each bar ([palettes and Songs](https://github.com/rokaN8/racing_game/issues/76)) |

**When each plays.** The Menu Song covers the Menu, Track select, Reset times and Controls. A Track's Song covers its countdown, race, Pause and Finish.

**Switching.**
- A change of Song **crossfades over 1.5 s**. Each sounding Song has its own bus and echo.
- **Retry and Restart keep the Song going.**
- **Pause muffles:** a low-pass to ~700 Hz at half volume, eased over ~0.1 s.
- M still mutes everything.

**Beat pulse** ([#67](https://github.com/rokaN8/racing_game/issues/67)). Each kick of the live Song brightens the Track edges and Checkpoint lines to 1.3×, fading back over 0.15 s: the Menu Song behind the Menu screens, the Track's Song in a run, handed over halfway through a crossfade, when the new Song becomes the louder. Timed off the audio clock (`beat()` in `audio.ts`, the pure `sinceKick` in `audio/songs.ts`), from the step that is sounding rather than the last one scheduled, so it pulses when muted too. None before audio starts, while it's suspended, or with `prefers-reduced-motion`.

## Module layout

Changes to the POC layout only. Physics still never imports from rendering, the DOM or input.

```
src/
  track/tracks/allround.ts   # Overdrive: today's layout.ts, moved, plus name/kind/palette/song
  track/tracks/technical.ts  # Switchback (turtle pieces)
  track/tracks/bigair.ts     # Hang Time (turtle pieces)
  track/tracks/flow.ts       # Slipstream (turtle pieces)
  track/tracks/flight.ts     # Afterglow (turtle pieces)
  track/tracks/index.ts      # TrackDef, TRACKS
  track/turtle.ts            # turtle builder: straights, arcs, Kickers, Gaps, Loops, free-straight closing
  render/palette.ts          # Palette, derive()
  audio.ts                   # engine, sfx, sequencer playing a Song; crossfade, muffle
  audio/songs.ts             # the Menu Song (Track Songs live on their TrackDef)
  ghost.ts                   # per Track: top 5 + Ghost + best Sectors in one key, migration; the Pilot Ghost's run
  pilot.ts                   # headless pilots: steer to centre, brake for turns, Air control onto the flight path
  ui/menu.ts                 # the side-rail overlay: Menu, Track select (+ High scores, Reset times), Controls, Pause, Finish
  ui/outline.ts              # the top-down Track outline, for Track select and the minimap
test/
  track.test.ts              # shared checks, looped over TRACKS (+ the Pilot clean at every lap count)
  tracks/<id>.test.ts        # each Track's Lap checks
  ghost.test.ts              # + top 5, ties, reset, migration, Pilot Ghost, live gap, Ideal time
```

## Milestones

Each milestone ends in something you can play. They continue the POC's M1–M8.

### M9: Multi-Track runtime

- `TrackDef`, `TRACKS` (Overdrive only), `track/tracks/allround.ts` from `layout.ts`. A dev-only `?track=<id>` picks the Track.
- Per-Track storage and the Ghost module, as in Storage.
- `test/pilot.ts` and the shared Track checks, looped over `TRACKS`.

Accept when:
- the game plays exactly as today;
- an old `neon-racer.ghost.v2` best appears as Overdrive's #1 (undated), and the old keys are gone;
- tests cover top-5 insertion, ties ranking below, cap at 5, `clear()`, migration, and garbage or blocked storage;
- all existing Track tests pass through the loop.

### M10: Screens

- `ui/menu.ts`: the full side-rail overlay as in Screens, with Overdrive as the only Track.
- Boot into the Menu, and remove the old centre Finish text.

Accept when:
- every screen and transition works with keyboard alone and with gamepad alone;
- Pause freezes countdown, physics and engine sound, and Quit to Menu resets the run;
- reset needs two presses within 3 s and clears both the times and the Ghost;
- Track select shows Overdrive's outline and top 5.

### M11: Track identity

- `render/palette.ts`: each scene is painted from its Track's palette, and the Menu uses it for swatches, band and outline.
- Song as data, the Menu Song, crossfade, Pause muffle. Overdrive's Song is today's.

Accept when:
- Overdrive looks as in the palettes prototype (`?set=A&track=1`): only the neon glows;
- the Menu and race Songs crossfade, Retry keeps the Song going, Pause muffles it, and M mutes all;
- it holds 60 fps at 1080p on the dev machine.

### M12: Switchback

- `track/turtle.ts`, `track/tracks/technical.ts` with its palette and Song, and `test/tracks/technical.test.ts`.

Accept when:
- a braking pilot's Lap with Boost on the straights is clean and takes about 54 s (±5 s);
- a full-throttle Lap with no braking goes off the edge at the hairpin;
- a 20 m/s respawn at each Checkpoint rides clean to the next one;
- the overpass clears the Track below by ≥8 m (12 m in the draft);
- Switchback appears in Track select, High scores and Pause.

### M13: Hang Time

- Kicker, Gap and Loop pieces in `turtle.ts`, with the Landing deck rule. `track/tracks/bigair.ts` with its palette and Song, and `test/tracks/bigair.test.ts`.

Accept when:
- each of the 5 Gaps respawns at 35 m/s and lands at 45, 55, 65 and 75 m/s with Air control;
- a full-throttle Lap is clean with and without Boost, takes about 54 s (±5 s) with Boost, and no flight lasts 4 s;
- a 20 m/s respawn at each Checkpoint rides clean to the next one;
- the solid Track never passes over itself closer than 8 m;
- the handling values are unchanged.

## Out of scope

- Online or global leaderboards, player names, accounts.
- A Track editor or procedural Tracks.
- Multiplayer, AI opponents.
- Unlockables and progression.
- New Bike types.
- A settings screen (M still mutes). Audio files: Songs stay synth.
