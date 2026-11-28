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
| Flow | Boot → Menu (Play → Track select · Stats · Settings · Controls; High scores and Reset times live in Track select). Picking a Track → countdown → run → Finish (Retry · Track select · Menu). Pause (Esc / Start): Resume · Restart · Quit to Menu. Keyboard and gamepad everywhere. | [Wayfinder: Rounded-out game spec](https://github.com/rokaN8/racing_game/issues/33) |
| Runtime and storage | One `TrackDef` record per Track in an ordered `TRACKS` array. Every Track's scene is built at boot and swapped. One storage key per Track holds its top 5 and its Ghost. Today's best migrates to Overdrive. | [Multi-Track runtime and storage](https://github.com/rokaN8/racing_game/issues/34) |
| Screens | Side-rail overlay over the frozen game. Track select shows each Track's kind, top-down outline and top 5. Reset is press twice within 3 s. | [Menu, Pause and High scores screens](https://github.com/rokaN8/racing_game/issues/35) |
| Songs | Song as data, played by a pure step generator. Four Songs. Crossfade 1.5 s; Retry keeps the Song going; Pause muffles it. | [Four distinct synth Songs](https://github.com/rokaN8/racing_game/issues/36) |
| Switchback | 3 km figure-8 with an overpass, braking turns, a curving Wall-ride and no Gaps. 7 Checkpoints, ~54 s. | [Technical Track layout](https://github.com/rokaN8/racing_game/issues/37) |
| Hang Time | 3.2 km figure-8: lift hill, 5 Gaps onto Landing decks, two Loops. 7 Checkpoints, ~54 s. No handling change. | [Big air Track layout](https://github.com/rokaN8/racing_game/issues/38) |
| Slipstream | 3.4 km figure-8, no braking: Loop, Rollercoaster, a Corkscrew upside down over the start straight, curving Wall-ride, one Gap, two Boost pads. 6 Checkpoints, ~53 s. | [All-rounder Track 4 layout](https://github.com/rokaN8/racing_game/issues/55) |
| Afterglow | 3.3 km single loop, no braking: launch Gap, lift hill, a Corkscrew on the ridge straight into a drop Gap, step-up Gap, big drop, Loop, double. Two Boost pads. 7 Checkpoints, ~54 s. | [Big air Track 5 layout](https://github.com/rokaN8/racing_game/issues/56) |
| Vertigo | 3.2 km single loop, no braking: a Helix up a 150 m tower, a 108 m Gap off the top (50–76 m/s), a Helix back down. 5 Checkpoints, ~54 s. Bank is measured from level, so no Track carries frame drift. | [Vertigo layout](https://github.com/rokaN8/racing_game/issues/77) |
| Knot | 3.3 km pentagram (720° right), no braking: crosses itself 5 times, alternating over (14 m) and under (in a Tunnel), a Double Loop and a Corkscrew upside down over one crossing. 5 Checkpoints, ~54 s. | [Knot layout](https://github.com/rokaN8/racing_game/issues/79) |
| Rocket start | Throttle press begun in the last 0.25 s before GO launches at 15 m/s; held from earlier Stalls for 0.5 s. The Pilot always gets one. `TUNING` unchanged. | [Rocket start](https://github.com/rokaN8/racing_game/issues/81) |
| Landing grades | Perfect ≤5° / Clean ≤20° / Sketchy ≤35°, coloured. A Perfect landing from a Gap Boosts 0.5 s. `TUNING` unchanged. | [Perfect landing and Landing grades](https://github.com/rokaN8/racing_game/issues/80) |
| Grand tour | Every Track in order, one Lap each, one total: each leg a 1-Lap run (its Ghost, its top 5), a banner and the next countdown between legs. Its own top 5 in one key; Medals from the Pilot's 1-Lap times added up. | [Grand tour](https://github.com/rokaN8/racing_game/issues/91) |
| Settings | One Settings screen, from the Menu and Pause: Music and Sound volume, Reduce motion (Auto / On / Off), Field of view, Quality, FPS counter, Ghost line. Changes apply at once; one guarded key. M still mutes on top. | [Settings](https://github.com/rokaN8/racing_game/issues/89) |
| Palettes | Primary, secondary and sky per Track. Darks derived in sRGB. Bike, Ghost and HUD stay fixed. | [Per-Track palettes](https://github.com/rokaN8/racing_game/issues/39) |
| Track 1 name, milestones | Track 1 is **Overdrive**. Build order M9 → M13 below. | [Game spec hand-off](https://github.com/rokaN8/racing_game/issues/40) |

## Tracks

### The Track record

```ts
interface TrackDef {
  id: 'allround' | 'technical' | 'bigair' | 'flow' | 'flight' | 'climb' | 'crossings'; // stable: used in storage keys, never renamed
  name: string;                            // display name
  kind: string;                            // shown under the name: 'All-rounder', 'Technical', 'Big air', 'Flow', 'Flight', 'Climb', 'Crossings'
  cps: ControlPoint[]; gapSegments: number[]; checkpointCps: number[]; halfWidth: number;
  boostPads?: { cp: number; len: number }[]; // see Design rules → Boost pads
  tunnels?: { cp: number; len: number }[];   // see Design rules → Tunnels (looks only)
  palette: Palette;                        // see Palettes
  song: Song;                              // see Songs
  shards: Shard[];                         // see Data shards: 10, by hand, never reordered
}
export const TRACKS: TrackDef[] = [overdrive, switchback, hangTime, slipstream, afterglow, vertigo, knot]; // this order everywhere
```

One module per Track in `src/track/tracks/<id>.ts`. Physics already takes the baked Track as a parameter, so it doesn't change.

| | Overdrive | Switchback | Hang Time | Slipstream | Afterglow | Vertigo | Knot |
|---|---|---|---|---|---|---|---|
| id · kind | `allround` · All-rounder | `technical` · Technical | `bigair` · Big air | `flow` · Flow | `flight` · Flight | `climb` · Climb | `crossings` · Crossings |
| Length | 2,251 m | 3,022 m | 3,240 m | 3,388 m | 3,329 m | 3,160 m | 3,344 m |
| Clean Lap (pilot, Boost) | ~40 s | ~54 s | ~54 s | ~53 s | ~54 s | ~54 s | ~54 s |
| Checkpoints | 4 | 7 | 7 | 6 | 7 | 5 | 5 |
| Code | `src/track/tracks/allround.ts` (the POC's layout) | `src/track/tracks/technical.ts` | `src/track/tracks/bigair.ts` | `src/track/tracks/flow.ts` | `src/track/tracks/flight.ts` | `src/track/tracks/climb.ts` | `src/track/tracks/crossings.ts` |

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

**Knot** (a pentagram drawn in one stroke, 720° right, no braking: the tips hold even Boosted; [Knot layout](https://github.com/rokaN8/racing_game/issues/79)):
- five legs, each joined by a right **tip** (144° at R60, bank 30°); every leg crosses two others, so the Track crosses itself **five times**
- it alternates like a real knot: every leg goes **over** its first crossing (deck 14 m up, clearing a Tunnel's rings by 6 m), drops ~15 %, goes **under** its second crossing on the ground inside a 100 m **Tunnel**, then climbs ~5 % into the next tip
- start straight → **Double Loop** (back to back, R22) → tip → four legs (the second leg's over-pass is a 100 m **Corkscrew**, upside down right over the leg below) → the first leg's over-pass and Tunnel, out of the fifth Tunnel onto the start line

Checkpoints: start line (60 m before the Double Loop), then the start of each of the other four legs, just out of a tip and 78 m before its over-pass.

The exact pieces are in `src/track/tracks/technical.ts`, `src/track/tracks/bigair.ts`, `src/track/tracks/flow.ts`, `src/track/tracks/flight.ts`, `src/track/tracks/climb.ts` and `src/track/tracks/crossings.ts`.

### Building Tracks 2 and 3: the turtle builder

`src/track/turtle.ts` lays a Track out from a heading instead of hand-placed points, so turn radii are exact:
- **pieces:** straight (with a height change), arc (turn angle, radius, bank, height change; past 360° with a height change it is a Helix, [Helix piece](https://github.com/rokaN8/racing_game/issues/75)), Kicker, Gap, Loop, Corkscrew (length, roll direction, metres held upside down; [Corkscrew piece](https://github.com/rokaN8/racing_game/issues/52)), Boost pad (a strip length, starting where the next piece starts; [Boost pads](https://github.com/rokaN8/racing_game/issues/53)), and Tunnel (a length, starting where the next piece starts; [Tunnel and Double Loop pieces](https://github.com/rokaN8/racing_game/issues/78)). A Double Loop is two Loop pieces in a row, with no piece of its own
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

**Tunnels** ([Tunnel and Double Loop pieces](https://github.com/rokaN8/racing_game/issues/78)). `tunnel(len)` covers the next `len` m of Track. Looks only: physics never sees it, and `TUNING` is unchanged.
- **Strands:** 8 lines along an arch over the deck (radius 6.5 m, centred 1.5 m above it, a little flattened), in the primary at 60 %, so they glow softer than the edges.
- **Rings:** bright arches in the secondary colour, spread evenly about 24 m apart, the first at the mouth and the last at the exit, so nothing runs past the strands.
- **Built in the Track's frame**, so it banks and climbs with the straight it covers.
- Picked from four looks on the prototype branch [`prototype/tunnel-double-loop`](https://github.com/rokaN8/racing_game/tree/prototype/tunnel-double-loop) (`?tunnel=A|B|C|D`, D won).

**Double Loops** ([Tunnel and Double Loop pieces](https://github.com/rokaN8/racing_game/issues/78)). Two `loop()` pieces in a row, back to back or with a straight between; each drifts left by its own `drift`, so they never overlap. At full throttle accel beats slopeGravity, so both tops pass near top speed, and a 20 m/s respawn 60 m before the first still clears both. `TUNING` is unchanged.

**Boost pads.** A strip `len` m long, drawn as forward chevrons every 6 m in the secondary colour. `TUNING` is unchanged.
- **Riding onto one:** +`boostKick` speed, the rising pad chime plus the Boost whoosh, and a Boost sized as the strip's length at Boost top speed plus `BOOST_PAD_TAIL` (0.3 s), so the HUD meter drains across it.
- **On the strip** the Boost is held at least `BOOST_PAD_TAIL`, however the Bike got there (also a landing or respawn), so it ends about 0.3 s past the strip's end.
- **The Boost button** is left alone: still ready if it was, and pressing it on a strip never cuts the pad's Boost short.
- **Placing them:** the strip length is the layout's call, so a long straight gets a long strip. A pad isn't a Gap's way across: every Gap still clears without Boost.

**Checkpoints.** Each sits ≥60 m before the hazard that follows it, and a respawn at 20 m/s clears that hazard.

**Rocket start** ([Rocket start](https://github.com/rokaN8/racing_game/issues/81)). 🔒 A new rule on top of the locked handling: `TUNING` is unchanged, and the new values sit next to it in `bike/tuning.ts` (`ROCKET_WINDOW`, `ROCKET_SPEED`, `STALL_TIME`).
- **Judged at GO**, from how long the current throttle press has been held through the countdown (gamepad RT counts past halfway):
  - **began in the last 0.25 s before GO:** a **Rocket start**, launching at 15 m/s (saves ~0.5 s);
  - **held from earlier:** a **Stall**, with throttle dead for 0.5 s after GO (costs ~0.5 s; brake and steer still work);
  - **not held at GO:** a normal standing start, as is pressing after GO.
- **When:** one chance per run, and Retry and Restart give a fresh one. There's no hint in the countdown: the timing is the skill.
- **Where it lives:** the rule is the pure `launchAtGo(st, heldFor)` in `physics.ts`, which sets `speed` or `stallT` (physics ignores throttle while `stallT > 0`). `main.ts` only times the press.
- **Feedback:**

  | | Message | Sound | Rumble |
  |---|---|---|---|
  | Rocket start | `ROCKET START`, magenta, popping in like `PERFECT` | the Boost whoosh plus the Perfect chime | a strong short kick |
  | Stall | `STALLED`, amber | a low sputter | one dull thump |

- **The Pilot always gets a Rocket start**, so `pilotTimes` include it (they dropped 0.25–1.4 s), and so do the Medals.

**Landing grades** ([Perfect landing and Landing grades](https://github.com/rokaN8/racing_game/issues/80)). 🔒 New rules on top of the locked handling: `TUNING` is unchanged, and the new values sit next to it in `bike/tuning.ts` (`PERFECT_ANGLE`, `CLEAN_ANGLE`, `PERFECT_BOOST`).
- **Grades:** every landing is graded by its angle off the deck (the worse of nose and up, as today):
  - **Perfect:** ≤5°
  - **Clean:** ≤20°
  - **Sketchy:** up to `landingTolerance` (35°)
  - past that it is a crash, as before.
- **Perfect landing reward:** a Perfect landing from a **Gap flight** Boosts for 0.5 s (cap +`boostSpeed`, double accel, on the HUD meter), worth ~0.1 s. Like a Boost pad it leaves the Boost button and its cooldown alone, and it never cuts a longer Boost short. A Perfect landing after dropping off an edge or a ceiling is graded but earns nothing, so it can't be farmed. A plain speed kick was ruled out: above the cap it bleeds off at `overspeedDecay`, ~0.02 s.
- **The Pilot never lands Perfect:** it points its nose along the flight path, so it lands 15–28° off (Clean or Sketchy). The Pilot times and Medals don't move.
- **Message:**

  | Grade | Text | Colour |
  |---|---|---|
  | Perfect | `PERFECT` | magenta, larger, popping in |
  | Clean | `Clean · 12°` | green (`--ahead`) |
  | Sketchy | `Sketchy · 28°` | amber (`--sketchy`) |

  Crash messages are unchanged.
- **Sound and rumble:**

  | Grade | Sound | Rumble |
  |---|---|---|
  | Perfect | the landing thud plus a bright rising two-note chime | a crisp double tick |
  | Clean | the thud | scaled by the angle, as before |
  | Sketchy | the thud plus a short scrape | scaled by the angle, as before |

**Bake frames** ([Vertigo layout](https://github.com/rokaN8/racing_game/issues/77)). The bake carries a rotation-minimizing frame along the spline, then turns it so each sample's bank is measured from level (world up, square to the tangent). Without that, a climbing turn or a Loop that drifts sideways rolls the frame and the leftover was spread round the Lap: the five older Tracks leaned 6–10° off their banks on average, and their Pilot times moved by up to 2.2 s (5 Laps) when this was fixed. Near vertical (a Loop) level is undefined, so the correction is eased across that stretch, and each pass over a Loop's top flips which way level points. The start line must be level.

## Screens

An HTML overlay over the frozen game. While it's open the HUD is hidden and the run is frozen (countdown, physics and engine sound). Built in M10: `src/ui/menu.ts` draws the pure state machine in `src/ui/menuState.ts`.

- **Layout.** A left rail over a dark gradient on the left third: title, items, then key hints for that screen as key chips. The focused item is a slanted magenta bar with dark text. A detail panel on the right shows whatever the focused item is about; it shares the rail's top line, never runs under the rail, and scrolls inside itself rather than off screen. The game stays visible behind.
- **Menu.** Logo, then Play · Stats · Settings · Controls. Coming back to it restores the last focus.
- **Track select** (also where the High scores live).
  - **Rail:** the lap count under the title (`‹ 3 Laps ›`, set with ← →, stopping at 1 and 5; 3 at boot), then name, kind and palette swatch per Track, then **Grand tour** (its Medal tag; the lap count doesn't apply), then a smaller Reset times. Focus starts on the last-raced Track (or the Grand tour).
  - **Grand tour panel:** the seven legs in order with their swatches and your 1-Lap best on each, the Data shards found across them, the tour's top 5 (#1's leg times under it) and its four Medal targets.
  - **Rail Medal:** the Medal each Track's #1 earns at the current lap count, as a small tag before its swatch. A Track with every Data shard found also gets a magenta ◆ before it.
  - **Panel:** palette band, name, kind, a **top-down outline** of the whole Track (centred, scaled to the window height), the Data shards found ("Shards 7/10"), its top 5 at the current lap count, the Ideal time ("Ideal 1:58.40", while it isn't above #1), then the four Medal target times, the ones #1 has earned lit (Neon marked "beat the Pilot"). With no times yet: "No times yet. Beat the Pilot: your fastest run becomes your Ghost."
  - **Outline** (`ui/outline.ts`, shared with the HUD's minimap): drawn from the baked Track's x/z, with Gaps left open, the start line marked and a tick across each other Checkpoint, stroked in the palette gradient. +z points up the screen and the Bike's starting right is to the right.
- **Reset times.** Opened from Track select; back returns to it. The rail holds each Track, then Grand tour (its top 5 only; each Track keeps its own), then All Tracks (the tour's top 5 too); the panel shows the focused Track (or every Track's #1). The first press turns the item red with "Reset Overdrive? 3", a line under it saying what goes ("Deletes Overdrive's times and Ghosts at every lap count. Press again to confirm."), and the panel edge turns red. A second press within 3 s resets every lap count of that Track; "Overdrive cleared" shows for 2.5 s. A timeout or moving focus cancels.
- **Controls.** The Keyboard | Gamepad table sits in the rail.
- **Stats.** The Lifetime stats as a table in the rail (see Run stats). Esc / B back to the Menu. Not opened from Pause.
- **Settings.** From the Menu or Pause (the run stays frozen); Esc / B back to whichever opened it. See Settings.
- **Pause** (Esc / Start, or leaving the game mid-run: a hidden tab or the window losing focus during the countdown, a run or a crash, [#69](https://github.com/rokaN8/racing_game/issues/69); already on a screen, nothing changes). The rail shows the Track name, the Lap (past 1 Lap) and the run time so far (on a Grand tour: "Grand tour · Leg 3/7" and the tour's time so far), then Resume · Settings · Restart · Quit to Menu. Esc, Start or B resume. Quit to Menu resets the run.
- **Finish.**
  - **Rail head:** the Track and lap count in its palette colour, the run time, then the rank as a big numeral. A new #1 adds a slanted magenta NEW BEST tag that pops in, with the gain on the old best; otherwise the gap to the best. Outside the top 5 it says so instead of a rank. Under it, the Medal this run earned and the gap to the next one ("Gold · 0.41 to Neon", or "No Medal · 1.20 to Bronze"); a Medal better than the old #1's pops in like NEW BEST. Then Retry · Track select · Menu.
  - **Panel:** the Track's top 5 at this lap count with this run highlighted; outside the top 5, a dashed "You" row with the gap to #5. Then the Ideal time and how far #1 is off it ("Ideal 1:58.40 · best 1.10 off"), then each Lap's time, the first fastest tagged, then the run's Run stats (see Run stats). R / Y still retry.
  - **Lock:** a pick is ignored for 0.7 s after Finish opens, so a Boost tap (Space / A) at the line can't skip it.
- **Top 5 rows.** `#n · time · date`, with a **Ghost** tag on #1, and #1's Lap times under it for runs of more than 1 Lap.
- **Input.** Up/down (arrows, W/S, d-pad or left stick) move; left/right (arrows, A/D, d-pad or stick) set the lap count on Track select and move elsewhere. Enter/Space pick, Esc/Backspace back. Gamepad: A picks, B backs out, Start pauses and resumes. All edge-triggered.

## Input

The POC's controls, plus **gamepad rumble** ([#68](https://github.com/rokaN8/racing_game/issues/68), `rumble()` in `input.ts`, off the same state changes as the sound effects): a thump on landing that grows the further off the landing angle, a strong 0.4 s one on a crash, a light 0.2 s buzz on a Boost pad, a lighter 0.15 s one on Boost, a tick at each Checkpoint and a double tick on each Lap. Only during a run: Pause stops it, while the last Lap's double tick still plays as the Finish screen opens. A weaker rumble never cuts a stronger one short. M doesn't touch it; with no pad or no support (Firefox) it does nothing.

**Ghost line** ([Ghost line](https://github.com/rokaN8/racing_game/issues/82), `render/ghostLine.ts`). Your own Ghost's line, drawn as dots on the Track ahead of the Bike, to teach the racing line.
- **The look:** a dot every ~4 m for 120 m, the Ghost's white at most 13 % bright, fading out with distance. It's drawn additively, so the fade sinks into the Track and nothing reaches the bloom threshold.
- **Where it starts:** from where the Ghost first got as far round as you (`ghost.lineAhead(bike)`, from its 10 Hz run distances). It stops where the Ghost respawned.
- **When it shows:** only while racing with no screen open, and only for **your own Ghost**. The Pilot Ghost's line isn't shown.
- **Toggle:** **off by default**. **G** (gamepad: Select / Back) toggles it. The choice is kept in localStorage (`neon-racer.ghostLine`) when storage works, and it's listed in Controls.
- Picked from three looks (dots, a line, chevrons) on the prototype branch [`prototype/ghost-line`](https://github.com/rokaN8/racing_game/tree/prototype/ghost-line).

## Speed feel and Finish cam

Render and camera only, with no physics ([Speed feel and Finish cam](https://github.com/rokaN8/racing_game/issues/83)). Picked from three strengths on the prototype branch [`prototype/speed-feel`](https://github.com/rokaN8/racing_game/tree/prototype/speed-feel) (`?feel=A|B|C`): B's streaks and colour split, A's shake, A's orbit.

**Speed feel** (`render/speedFeel.ts`):
- **Streaks:** 120 cyan lines on a tube round the view axis (2.5–8.5 m out, 4–70 m ahead), rushing past at the Bike's speed, drawn additively. They ease in and out with Boost.
- **Shake:** 0.12 m on a Sketchy landing (×1.6 on a crash), decaying over 0.3 s.
- **Colour split:** an RGB shift pass after bloom, only while Boosting. It ramps from 0 at 60 m/s to 0.0025 at Boost top speed (75 m/s), and the pass is skipped while it's 0.
- **With bloom and the beat pulse:** the streaks stay dim (60 % at most) and sit apart from the Track edges the beat pulses, and the split runs after bloom.

**Finish cam** (`camera.ts`): after the line, while the Finish screen is up, the camera eases (smoothstep, 1.5 s) from where Chase was into an orbit of the stopped Bike, starting at Chase's angle round it.
- **The orbit:** radius 14 m, 4 m up, 0.15 rad/s (~40 s a turn), looking at the Bike.
- **Retry or Restart:** the first chase update ends it, and the camera snaps back to Chase for the countdown.

**Reduced motion** (the OS setting, as for the beat pulse):
- no shake and no colour split;
- the streaks at half brightness;
- the Finish cam holds Chase's view instead of orbiting.

Settings can force it on or off (see Settings).

## Trackside scenery and Rung ripple

Render only, with no physics ([Trackside scenery and Rung ripple](https://github.com/rokaN8/racing_game/issues/84), `render/scenery.ts`). Picked from three on the prototype branch [`prototype/scenery`](https://github.com/rokaN8/racing_game/tree/prototype/scenery) (`?scenery=A|B|C`): C, far and big, so the deck stays clear.

**Trackside scenery:** placed from the baked Track alone, so no `TrackDef` lists it. Outline only.
- **Light towers:** a lattice tower (corners plus a ring every 6 m, in the softer Tunnel colour) either side of every Loop and Corkscrew (each run of samples with up.y < −0.5), 16 m past the edge, 15 m above the Loop's top, with a 4 m mast in the secondary.
- **Beacon towers:** one off each Checkpoint but the start, 25 m out on its right, 25 m above the deck (40 m off the grid at least), with a 6 m mast.
- **Holo-board:** the Track's name in the primary, outlined with scanlines, additive, 40 × 10 m, 30 m left of the start straight and 18 m up, framed in the secondary on two legs, facing the oncoming Bike.
- **Clearance:** a tower or the board that would stand within 3 m (past its own size and the deck's half-width) of any part of the Track below its top is dropped, not moved. A test checks every Track.
- **Cost:** about four draw calls a Track (towers, masts, board, its frame).

**Rung ripple:** on top of the beat pulse, the rungs light towards the secondary in a stepped chase: each 16th of the Song's bar lights the next 10 m block ahead of the Bike (16 blocks, 160 m), each block fading over four steps and dimmer further out. Off the bar clock in `audio.ts` (`bar()`), so it keeps time when muted; off under reduced motion and before audio starts.

## Reactive music

The Song follows the ride ([Reactive music](https://github.com/rokaN8/racing_game/issues/87), `audio/react.ts`, applied in `audio.ts`). Picked from three on the prototype branch [`prototype/reactive-music`](https://github.com/rokaN8/racing_game/tree/prototype/reactive-music) (`?music=A|B|C`): C, Underwater. Only during a run (not the countdown, screens or Finish); the same for every Song, so no Song data changes.

- **Airborne:** the drums sink to 30 % (glide 0.1 s), and a low-pass on the whole Song drops to 600 Hz at take-off, then opens back to 20 kHz over 1.5 s of flight (exponential, even to the ear). Landing opens it at once (0.1 s glide).
- **Boost:** the arp's own filter opens ×3 (to 18 kHz at most), read as its notes are scheduled.
- **Final-Lap layer:** a sawtooth lead (0.035, 2.5 kHz low-pass, 0.4 s attack) holding each bar's chord root an octave up and the fifth above it. It fades in over ~2 s on the final Lap; in a 1-Lap run, once the last Checkpoint is passed (a Track with only the start line: never).
- **Gains:** each sounding Song has its own drums and layer gain under its bus, so a crossfade carries them; the Song's per-voice `vol` stays its own mix. Everything glides with `setTargetAtTime`, so nothing clicks.
- **The chain:** player bus → Pause muffle → react low-pass → music gain → master.

## Wind and Ghost whoosh

Sound only, synth only, no files ([Wind and Ghost whoosh](https://github.com/rokaN8/racing_game/issues/86), `audio.ts` with its rules in `audio/wind.ts`). Picked from three on the prototype branch [`prototype/wind`](https://github.com/rokaN8/racing_game/tree/prototype/wind) (`?sound=A|B|C`): C, Arcade, as heard there. Under the master, so M mutes it; silent outside a run (countdown, screens, Pause, Finish, a crash's explosion).

**Wind:** band-passed noise, gain 0.1 × v² (v = speed / 75 m/s), centre 600 + 900 × v Hz, both scaled by a slow **gust** (two slow sines multiplied, 0.4–1). Halved while Airborne.

**Air tone:** while Airborne, a 110 Hz triangle at 0.06 with a 6 Hz tremolo (0.6 ± 0.4), under the wind.

**Rumble strip:** the warning before the Track edge. High-passed noise (1.5 kHz) pulsed once per 4 m ridden (on for 35 % of each), from 2 m short of the edge, rising to 0.14 at it. On the Track only. Not the gamepad rumble.

**Ghost whoosh:** when the Ghost (yours or the Pilot's) crosses the camera's side-to-side line within 12 m, either way: you passing it or it passing you. A sawtooth swoops 1400 → 350 Hz over 0.5 s at 0.12, panning from 0.3 to 1.5 × the Ghost's side (its offset to the camera's right over its distance, clamped to ±1). A respawn or Retry starts the check over, so a jump never fires one.

## Grand tour

Every Track back to back, one Lap each, one total ([Grand tour](https://github.com/rokaN8/racing_game/issues/91), `src/tour.ts`, run by `main.ts`). A Time trial run across all the Tracks, not a new race mode.

- **A leg is a 1-Lap run** of its Track in `TRACKS` order, from its own 3-2-1 countdown (Rocket start included). It races that Track's 1-Lap Ghost (or the Pilot Ghost), and its time goes into that Track's 1-Lap top 5, so a leg can set your 1-Lap best and Ghost. Data shards are collected as on any run.
- **Between legs:** the clock stops, and a banner shows "Leg 2/7" with the leg's time, the total so far and the next Track for 2 s. Then a cut to the next Track's start line and its countdown; the Songs crossfade. Pause is not taken during the banner.
- **The HUD:** the run time is the tour's total so far; the Lap counter reads "Leg 3/7" ("Final leg" on the last). The final-Lap layer of Reactive music plays on leg 7 only.
- **Respawn, Pause, Retry, Quit:** respawns as on any run. Restart (Pause) and Retry (Finish, R / Y) start the whole tour again from leg 1. Quit to Menu or Track select throws the tour away: nothing goes to its top 5, while legs already finished stay in their Tracks' 1-Lap top 5.
- **Finish** (after leg 7 only): "Grand tour · 7 Tracks", the total, its rank in the tour's top 5 or NEW BEST, the Medal, then the seven leg times (each Track's swatch, the fastest tagged) and the Run stats for the whole tour. The tour counts as one run finished in the Lifetime stats.
- **Top 5 and Medals:** one localStorage key, `neon-racer.tour.v1`: `[{ time, date, legs }]`, fastest first, an equal time below. No tour Ghost: each leg already races its Track's. The Medals are set as a Track's (see Medals) from `P` = the Pilot's 1-Lap times added up (`tourPilotTime`). Guarded like every key: garbage, a score with another number of legs, or blocked storage reads as none.

## Settings

One screen of settings ([Settings](https://github.com/rokaN8/racing_game/issues/89), `src/settings.ts`), opened from the Menu (Play · Stats · Settings · Controls) or Pause (Resume · Settings · Restart · Quit to Menu). Back returns to whichever opened it.

| Row | Values | Default | Does |
|---|---|---|---|
| Music | 0–100 % in 10s | 100 % | the Songs' level (gain = (v/100)²) |
| Sound | 0–100 % in 10s | 100 % | everything else: engine, sound effects, Wind, Rumble strip, Ghost whoosh |
| Reduce motion | Auto / On / Off | Auto | Auto follows the OS; On or Off forces what reduced motion drives (beat pulse, Rung ripple, Speed feel's shake, split and streaks, the Finish cam's orbit) |
| Field of view | Narrow 90° / Normal 102° / Wide 110° | Normal | the camera's vertical FOV; Boost still widens it by 12° |
| Quality | High / Low | High | pixel ratio up to 2 (High) or 1 (Low) |
| FPS counter | Show / Hide | Hide | the HUD's frame rate |
| Ghost line | On / Off | Off | the same switch as G, with its own key |

- **Changing:** ↑↓ move, ←→ step (volumes stop at 0 and 100; the others wrap), Enter steps forward. Every change applies at once, no Apply. A volume change plays a short blip at the new level.
- **Reset to defaults:** the last row, pressed twice within 3 s like Reset times ("Settings reset" shows after). It resets every row, the Ghost line too.
- **Mute:** M mutes everything on top of both volumes without touching them; while muted, Music shows "· muted (M)".
- **Storage:** one localStorage key, `neon-racer.settings.v1`, a JSON object of the rows above but the Ghost line (it keeps `neon-racer.ghostLine`; mute keeps `neon-racer.muted`). Each field is checked on its own: missing or bad, it takes its default and the rest are kept. Blocked storage: the defaults, and changes last the session.

## Data shards

A collection, not a mode ([Data shards](https://github.com/rokaN8/racing_game/issues/88), `src/shards.ts`): glowing pickups on every Track, found across runs. Time trial stays the only race mode, and a pickup never touches physics, the Lap or the clock.

- **Placement:** by hand, 10 per Track in `TrackDef.shards` as `{ s, d, h }` (distance, side offset, height above the deck). About 6 on or near the racing line (|d| ≤ 1.5), 3 off it (hugging an edge, the high edge of a Wall-ride, near the edge at the top of a Loop), and 1 hard: the top of the Pilot's flight over the longest Gap, or the top of a Loop, or (Switchback, with neither) the high edge of its Wall-ride. A shard is identified by its index, so never reorder them.
- **Checks** (`test/shards.test.ts`, every Track): 10 shards at least 30 m apart; one on the deck is 1 m up, off any Gap, within 0.9 m of the edge; one in flight is within 1 m of the Pilot's path. The Pilot, riding the centre line, collects every shard with |d| ≤ 1.5 and every one in flight.
- **Pickup:** within 2.5 m of the Bike, checked every physics step, so only while racing. Not by the Ghost or the Pilot. It counts at once (a crash, Quit or Restart after it keeps it): saved on touch, with a bright three-note chime, a light rumble tick and "Shard 7/10" in the message line (cyan).
- **Look:** a spinning outline diamond (an octahedron 1.2 m across with a smaller one inside) in the Track's secondary colour, so it blooms; a found one stays, at 15 %. One draw call per Track.
- **Storage:** one localStorage key, `neon-racer.shards.v1`: `{ <trackId>: [found indices] }`. Guarded like every key: blocked, missing or garbage reads as nothing found, a bad entry is skipped, and with storage blocked shards stay found for the session. Reset times leaves them alone; there is no shard reset.

## Run stats

Counted, not ridden on: nothing here touches physics ([Run stats](https://github.com/rokaN8/racing_game/issues/85), `src/stats.ts`). A pure counter that `main.ts` feeds every physics step, off state changes between steps (as the sound effects are), so it only counts while racing with no screen open, and never the Pilot.

**Run stats**, on the Finish panel under the Laps, a 3 × 2 grid for the whole run (not per Lap):
- **Airtime:** seconds Airborne (one decimal).
- **Top speed:** the fastest the Bike went, in m/s as the HUD shows it (speed on the Track, velocity in the air).
- **Crashes:** respawns, a bad landing, falling off and the R key alike.
- **Boosts:** Boosts fired (a Boost pad or a Perfect landing's Boost isn't one).
- **Pad hits:** Boost pads ridden onto.
- **Perfect:** Perfect landings, from a Gap or not (a respawn is never one).

**Lifetime stats**, on the Stats screen, every Track and lap count together: distance (km, one decimal; along the Track, or flown when Airborne), Laps completed, time played (riding time: no countdown, Pause or screens), runs finished, Crashes.
- **What counts:** everything ridden, quit and restarted runs too. "Runs finished" counts only runs that reach the Finish.
- **When it's banked:** a run is added to the totals when it ends (Finish, Retry, Restart, Quit, a new Track) and on `pagehide`, then counts on from zero, so nothing is added twice.
- **No reset:** Reset times leaves them alone, and there is no reset of their own.
- **Storage:** one localStorage key, `neon-racer.stats.v1`, holding `{ dist, laps, time, runs, crashes }`, written only at those moments, never each frame. Guarded like every key: blocked, missing or garbage reads as zeros (a bad field alone as 0), and with storage blocked the totals last the session.

## Medals

Bronze, Silver, Gold and Neon target times per Track and lap count, set against the Pilot's run time `P` there ([#62](https://github.com/rokaN8/racing_game/issues/62)): **Neon** faster than `P` (you beat the Pilot), **Gold** ≤ `P` × 1.05, **Silver** ≤ `P` × 1.12, **Bronze** ≤ `P` × 1.25. A starting point, to tune by play-testing. Targets and times are compared to the hundredth, as they are shown: a time equal to Gold's, Silver's or Bronze's target earns it, while Neon takes beating `P`. `P` is baked into each `TrackDef` (`pilotTimes`), and a shared Track check holds it within 0.05 s of the live Pilot, so Track select never rides the Pilot. Your Medal is the one your #1 earns: nothing is stored, and Reset times clears it with the scores. `medalFor(time, P)` sits beside the menu state. The Grand tour's `P` is every Track's 1-Lap `P` added up.

## Pilot Ghost

Every Track has a rival from the first run ([#61](https://github.com/rokaN8/racing_game/issues/61)). With no Ghost of your own at a Track and lap count, the Pilot's run is the Ghost, with its Checkpoint splits, so the split line, the live gap and the Lap banner work against it. Your first finished run replaces it; Reset times brings it back. It never enters the High scores, and the HUD best stays your own.

- **The Pilot** (`src/pilot.ts`, physics-only imports) is the headless driver the Track tests ride. Each `TrackDef.pilot` holds the profile of its clean, fastest Lap: Overdrive Air control + Boost before the Gap; Switchback brakes + Boost on straights; Hang Time Air control + brakes + Boost on straights; Slipstream and Afterglow Air control + Boost on straights. A shared check rides it clean at every lap count. It always gets a Rocket start (see Design rules → Rocket start).
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
- **Lifetime stats:** `neon-racer.stats.v1`, see Run stats.
- **Data shards:** `neon-racer.shards.v1`, see Data shards.
- **Settings:** `neon-racer.settings.v1`, see Settings.
- **Grand tour:** `neon-racer.tour.v1`, see Grand tour.
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
  - Tunnel strands = primary × 0.60 (not a dark: they glow, softer than the edges)
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
| Knot | `#c6ff00` | `#ff3ea5` | `#050a00` |

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
| Knot (Acid knot) | 130 | Cm A♭ B♭ G | Tangled acid: a three-note sawtooth arp against the four-on-the-floor ([palettes and Songs](https://github.com/rokaN8/racing_game/issues/76)) |

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
  render/scenery.ts          # Trackside scenery placement and the Rung ripple's glow
  audio.ts                   # engine, Wind, sfx, sequencer playing a Song; crossfade, muffle
  audio/wind.ts              # Wind and Ghost whoosh rules: rumble strip, gust, what a pass is
  audio/react.ts             # Reactive music: the mix for the ride, when the final-Lap layer plays, its notes
  audio/songs.ts             # the Menu Song (Track Songs live on their TrackDef)
  ghost.ts                   # per Track: top 5 + Ghost + best Sectors in one key, migration; the Pilot Ghost's run
  stats.ts                   # Run stats counted per physics step; Lifetime stats, banked into one key
  shards.ts                  # Data shards: positions, the pickup check, found shards in one key
  settings.ts                # Settings: rows, stepping, their key
  tour.ts                    # Grand tour: its top 5, its key, the Pilot's tour time
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
- Audio files: Songs stay synth.
