# Neon racer game spec

The hand-off spec that rounds the neon racer POC out into a game. Each section sums up a locked decision. The linked ticket holds the full detail and reasoning, so check it before changing anything. Charted on [Wayfinder: Rounded-out game spec](https://github.com/rokaN8/racing_game/issues/33). Vocabulary: [`GLOSSARY.md`](../GLOSSARY.md).

**Builds on [`poc-spec.md`](poc-spec.md).** Physics, handling values, rules, camera, Bike look, Cornering, HUD and the Ghost's recording all stay as locked there unless a section below says otherwise.

## What the game is

The POC's Time trial, rounded out:

- **three Tracks**, all open from the start, one Lap per run:
  - **Overdrive**: the all-rounder, today's Track
  - **Switchback**: technical, with braking turns
  - **Hang Time**: big air, with Gaps and drops
- a **Menu** with Track select, High scores and Controls; **Pause** mid-run; a **Finish screen** after each Lap;
- **High scores**: the top 5 Lap times per Track, on this device only. #1 is that Track's Ghost;
- a neon **palette** and a synth **Song** per Track, plus a Menu Song.

Still no art or audio files: everything is drawn and synthesised in code.

## Locked decisions

| Area | Decision | Ticket |
|---|---|---|
| Flow | Boot → Menu (Play → Track select · High scores · Controls). Picking a Track → countdown → run → Finish (Retry · Track select · Menu). Pause (Esc / Start): Resume · Restart · Quit to Menu. Keyboard and gamepad everywhere. | [Wayfinder: Rounded-out game spec](https://github.com/rokaN8/racing_game/issues/33) |
| Runtime and storage | One `TrackDef` record per Track in an ordered `TRACKS` array. Every Track's scene is built at boot and swapped. One storage key per Track holds its top 5 and its Ghost. Today's best migrates to Overdrive. | [Multi-Track runtime and storage](https://github.com/rokaN8/racing_game/issues/34) |
| Screens | Side-rail overlay over the frozen game. Track select shows each Track's kind, top-down outline and top 5. Reset is press twice within 3 s. | [Menu, Pause and High scores screens](https://github.com/rokaN8/racing_game/issues/35) |
| Songs | Song as data, played by a pure step generator. Four Songs. Crossfade 1.5 s; Retry keeps the Song going; Pause muffles it. | [Four distinct synth Songs](https://github.com/rokaN8/racing_game/issues/36) |
| Switchback | 3 km figure-8 with an overpass, braking turns, a curving Wall-ride and no Gaps. 7 Checkpoints, ~54 s. | [Technical Track layout](https://github.com/rokaN8/racing_game/issues/37) |
| Hang Time | 3.2 km figure-8: lift hill, 5 Gaps onto Landing decks, two Loops. 7 Checkpoints, ~54 s. No handling change. | [Big air Track layout](https://github.com/rokaN8/racing_game/issues/38) |
| Palettes | Primary, secondary and sky per Track. Darks derived in sRGB. Bike, Ghost and HUD stay fixed. | [Per-Track palettes](https://github.com/rokaN8/racing_game/issues/39) |
| Track 1 name, milestones | Track 1 is **Overdrive**. Build order M9 → M13 below. | [Game spec hand-off](https://github.com/rokaN8/racing_game/issues/40) |

## Tracks

### The Track record

```ts
interface TrackDef {
  id: 'allround' | 'technical' | 'bigair'; // stable: used in storage keys, never renamed
  name: string;                            // display name
  kind: string;                            // shown under the name: 'All-rounder', 'Technical', 'Big air'
  cps: ControlPoint[]; gapSegments: number[]; checkpointCps: number[]; halfWidth: number;
  palette: Palette;                        // see Palettes
  song: Song;                              // see Songs
}
export const TRACKS: TrackDef[] = [overdrive, switchback, hangTime]; // this order everywhere
```

One module per Track in `src/track/tracks/<id>.ts`. Physics already takes the baked Track as a parameter, so it doesn't change.

| | Overdrive | Switchback | Hang Time |
|---|---|---|---|
| id · kind | `allround` · All-rounder | `technical` · Technical | `bigair` · Big air |
| Length | 2,251 m | 3,022 m | 3,240 m |
| Clean Lap (pilot, Boost) | ~40 s | ~54 s | ~54 s |
| Checkpoints | 4 | 7 | 7 |
| Source | today's `track/layout.ts`, unchanged | [`prototype/technical-track`](https://github.com/rokaN8/racing_game/tree/prototype/technical-track) | [`prototype/bigair-track`](https://github.com/rokaN8/racing_game/tree/prototype/bigair-track) |

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

The exact pieces are in each prototype branch's draft (`src/track/technical.draft.ts`, `src/track/bigair.draft.ts`). Port the pieces, rewrite the code.

### Building Tracks 2 and 3: the turtle builder

`src/track/turtle.ts` lays a Track out from a heading instead of hand-placed points, so turn radii are exact:
- **pieces:** straight (with a height change), arc (turn angle, radius, bank, height change), Kicker, Gap, and Loop
- **closing:** two straights are marked *free*. Their lengths are solved (a 2×2 linear solve) so the Lap closes on the start line. A figure-8 turns 0° in total.
- **output:** the usual `ControlPoint[]` plus Gap segments and Checkpoint indices, for `bakeTrack`

Overdrive keeps its hand-written control points.

### Design rules

**Turns.** Full steer cancels at most 120 m/s² of Cornering pull (steerRate × steerResponse). A turn holds at speed v while v² × curvature × cos²(bank) ≤ 120. A turn tighter than that at top speed needs braking. That is Switchback's skill, and Overdrive never asks for it.

**Gaps.** Every Gap is **Kicker → Gap → Landing deck**:
- **Kicker:** a parabola from the current grade up to the lip angle (8°; 14° for a step-up).
- **Landing deck:** flat, `d` m below the lip (negative for a step-up).
- **Deck span:** it starts where a 40 m/s flight comes down and runs 20 m past where a 76 m/s flight does. On a flat deck the landing angle stays near the lip angle at every speed.
- **Why flat:** decks sloping downhill made fast Bikes fly for 3–5 s and overshoot (airGravity is only 12).
- **Drops:** big drops go on the Track between jumps.
- **Boost:** no Gap needs Boost.

**Checkpoints.** Each sits ≥60 m before the hazard that follows it, and a respawn at 20 m/s clears that hazard.

## Screens

An HTML overlay over the frozen game. While it's open the HUD is hidden and the run is frozen (countdown, physics and engine sound). Source: [`prototype/menu-screens`](https://github.com/rokaN8/racing_game/tree/prototype/menu-screens), variant B. Port the decision, rewrite the code.

- **Layout.** A left rail of items over a dark gradient on the left third. The focused item is solid magenta with dark text. A detail panel on the right shows whatever the focused item is about. The game stays visible behind.
- **Menu.** Logo, then Play · High scores · Controls. Coming back to it restores the last focus.
- **Track select.**
  - **Rail:** name, kind and palette swatch per Track. Focus starts on the last-raced Track.
  - **Panel:** palette band, name, kind, a **top-down outline** of the whole Track, and its top 5.
  - **Outline:** drawn from the baked Track's x/z, with Gaps left open and the start line marked, stroked in the palette gradient. +z points up the screen and the Bike's starting right is to the right.
- **High scores.** The rail holds Reset Overdrive · Reset Switchback · Reset Hang Time · Reset all. The panel is one table: ranks #1–5 down, Tracks across, each cell showing time and date ("—" when empty or undated).
- **Reset confirm.** The first press turns the item red with "Press again · 3…" and shows "Deletes Lap times and Ghost". A second press within 3 s resets. A timeout or moving focus cancels.
- **Controls.** A Keyboard | Gamepad table.
- **Pause** (Esc / Start). The rail shows the Track name and the current Lap time, then Resume · Restart · Quit to Menu. Esc, Start or B resume. Quit to Menu resets the run.
- **Finish.**
  - **Rail head:** the Lap time and the delta against the best (or NEW BEST), then Retry · Track select · Menu.
  - **Panel:** the Track's top 5 with this Lap highlighted and its rank, or "not in top 5". R / Y still retry.
- **Top 5 rows.** `#n · time · date`, with a **Ghost** tag on #1.
- **Input.** Arrows/WASD move, Enter/Space pick, Esc/Backspace back. Gamepad: d-pad or left stick move, A picks, B backs out, Start pauses and resumes. All edge-triggered.

## Storage

- **One key per Track:** `neon-racer.track.<id>.v1` = `{ scores: [{ time, date }], ghost: { poses, splits } | null }`.
  - `scores` holds at most 5, fastest first. `date` is epoch ms, shown in the local format.
  - `ghost` always belongs to `scores[0]`. One write per finish, so scores and Ghost can't disagree.
- **Ranking.** A finished Lap is inserted into the top 5. An equal time ranks below the existing one. A new #1 replaces the Ghost.
- **Reset.** Reset a Track = `removeItem` on its key. Reset all = loop over `TRACKS`.
- **Migration** (once, at boot). If `neon-racer.ghost.v2` (or v1) exists and the Overdrive key doesn't, write Overdrive = `{ scores: [{ time, date: null }], ghost }`. Remove the old keys only after that write succeeds.
- **Guarding.** Every read and write is guarded as today. Garbage loads as empty, and the game runs with storage blocked.
- **Ghost module.** `createGhost(storage, trackId)`, one instance per Track, built at boot. It exposes `scores` (the HUD best is `scores[0].time`), `clear()` for resets, and `restart()`, which is today's `reset()` (retry) renamed.

## Palettes

Source: [`prototype/palettes`](https://github.com/rokaN8/racing_game/tree/prototype/palettes).

- **Shape.** A `Palette` is `{ primary, secondary, sky }`, as sRGB hex.
  - **primary:** Track edges, and the Menu swatch, band and outline start.
  - **secondary:** Checkpoint lines, the FINISH arch and banner text, and the Menu's second colour.
  - **sky:** a solid, very dark background. No gradient, no fog.
- **Derived darks**, mixed byte-wise in **sRGB**, not linear:
  - Track fill = mix(sky, primary, 0.06)
  - rungs = primary × 0.30
  - grid = primary × 0.22 (major lines) and × 0.10 (minor lines)
  - banner background = the fill

  They all stay below the bloom threshold, so only the neon glows.
- **Fixed on every Track:** Bike and Light trail cyan, Ghost white, HUD cyan. The Menu keeps today's cyan and magenta.

| Track | primary | secondary | sky |
|---|---|---|---|
| Overdrive | `#ff2bd6` | `#ffe600` | `#000000` |
| Switchback | `#39ff14` | `#ffb000` | `#010a04` |
| Hang Time | `#ff8a00` | `#a64dff` | `#0d0418` |

## Songs

Source: [`prototype/songs`](https://github.com/rokaN8/racing_game/tree/prototype/songs) (`prototypes/songs.prototype.html`), which holds the exact data for all four.

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

**The four Songs.** Overdrive's Song is today's hard-coded one, unchanged.

| Song | BPM | Chords | Character |
|---|---|---|---|
| Menu | 84 | Fmaj7 Em7 Dm7 Cmaj7 | Dreamy pads, lazy echoing arp, almost no drums |
| Overdrive | 100 | Am F C G | Today's Song |
| Switchback | 118 | Em F Em D | Dark: driving 16th bass, choppy arp, syncopated kick |
| Hang Time | 128 | D A Bm G | Bright: four-on-the-floor, offbeat bass, rising arp |

**When each plays.** The Menu Song covers the Menu, Track select, High scores and Controls. A Track's Song covers its countdown, race, Pause and Finish.

**Switching.**
- A change of Song **crossfades over 1.5 s**. Each sounding Song has its own bus and echo.
- **Retry and Restart keep the Song going.**
- **Pause muffles:** a low-pass to ~700 Hz at half volume, eased over ~0.1 s.
- M still mutes everything.

## Module layout

Changes to the POC layout only. Physics still never imports from rendering, the DOM or input.

```
src/
  track/tracks/allround.ts   # Overdrive: today's layout.ts, moved, plus name/kind/palette/song
  track/tracks/technical.ts  # Switchback (turtle pieces)
  track/tracks/bigair.ts     # Hang Time (turtle pieces)
  track/tracks/index.ts      # TrackDef, TRACKS
  track/turtle.ts            # turtle builder: straights, arcs, Kickers, Gaps, Loops, free-straight closing
  render/palette.ts          # Palette, derive()
  audio.ts                   # engine, sfx, sequencer playing a Song; crossfade, muffle
  audio/songs.ts             # the Menu Song (Track Songs live on their TrackDef)
  ghost.ts                   # per Track: top 5 + Ghost in one key, migration
  ui/menu.ts                 # the side-rail overlay: Menu, Track select, High scores, Controls, Pause, Finish
test/
  pilot.ts                   # headless pilots: steer to centre, brake for turns, Air control onto the flight path
  track.test.ts              # shared checks, looped over TRACKS
  tracks/<id>.test.ts        # each Track's Lap checks
  ghost.test.ts              # + top 5, ties, reset, migration
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
