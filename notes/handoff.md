# Handoff: unfinished work

## 0. READ FIRST (23 October 2026, 14:50): most of this day's work is in a git stash, not in the app
- At 14:47 a commit was made on this Mac, `ef89d11` "Timetable read from a picture (made on the Mac)", on top of the cloud's Health commits (`1314e73`, `8812375`, `89e5e4b`). Before it, the local changes were put aside as **`stash@{0}` "my local changes before health"** (17 files, App.jsx +9,299 lines). So `src/App.jsx`, `electron/main.cjs`, `electron/preload.cjs` and `tools/perf/journeys.cjs` as they stand have Health and the timetable reader, but **not** what was built locally before that: the money exchanger and ⌘E, details under a name, the income over several months / split bar (and its redesign and the dots as typed), the caret kept in money boxes, the liquid glass range, widget stacks and the stack layouts, Shortcuts filling their box and the size caps, the declutter pass (empty states on Home, round chart axes, wording, no dots on trading tiles), "pack" as Other, the model's pruned word table loader (ai-head .bin), the exchanger's journeys. The notes in `notes/` (untracked) still describe all of it. The last DMG with it is `release/Flow-1.0.0-arm64.dmg` of 12:37.
- **Never drop that stash.** To bring it back: `git stash show -p stash@{0}` and apply it onto the current tree by hand (App.jsx, main.cjs, preload.cjs, journeys.cjs will conflict: both sides changed them), keeping Health and the timetable reader. Ask him first whether the stash was meant to be put back.

## 1. Timetable read off a picture (23 October 2026, his words: "an ai that i can just input an image and it will automatically assign it on the timetable"; he chose the Mac's own text reading): done, in `ef89d11`
- `electron/main.cjs`: `ocrRead` (the picture into a temporary folder, read by `/usr/bin/osascript -l JavaScript` with Vision, `OCR_JS`, removed after), `ocrStraight` / `ocrSkew` / `ocrSkewLong` (a slanted photo read again turned straight, up to twice), IPC `health:ocr`; `preload.cjs` `flowHealth.ocr(bytes, ext)`. No request leaves the Mac.
- `src/App.jsx`: the reader `hlReadTimetable` and its parts (`hlOcr*`, between "health: reading a timetable off a picture" and "… end"): grids (days across or down, times from words or from where a block stands), portal tables, merged day cells, day-heading lists; English, Indonesian and Malay days; rooms, teachers and codes told apart. `HlScanSheet` (check, change or leave out each class, "Add N to the week") and the Week card's "From a picture" button, a picture dropped or pasted on the week (`HlWeek`), `api.saveClsMany` (one colour per name).
- Tested: `tools/ocr/make.cjs` draws six timetables (grid, plain grid, portal, list, turned grid, merged cells), `tools/ocr/test.mjs` reads them as the app does: 25 of 25 straight (rooms 25/25), 25 of 25 at 60% size, 24 of 25 tilted 4° (one start read off position a quarter hour late). A block with no times written gets the usual 100 minutes as its end, to be checked in the sheet.
- **Left**: the in-app check (journey `ttscan` was written but not added: `journeys.cjs` had changed under it; the harness's `flowHealth.ocr` stand-in IS in `tools/perf/preload.cjs`, uncommitted). The feature's note in the project `CLAUDE.md` Health section. A DMG.

## 2. Health animations "1:1 from finance" (asked the same day): not started. Found to port
- The title: finance's pixel flicker on opening and letter swap on a change (`monthFlick` in `PnlCalendar`, `monthTwinShift`, `.month-big .yb-cell`), in place of `.hl-title`'s fade (`HealthApp`, keyed on the day's word).
- The hero's tiles and ring list counting (`CountNum`) as finance's tiles do; the rings easing to the new day (drop `key={day}` on `.hl-hero-rings`: `.hl-arc` has the transition already).
- `.hl-cls:hover` uses `filter: brightness` (against the performance rules): finance's tile lift and `--lit` sheen instead. To-dos and classes folding away when removed, as finance's rows do.


Read this first next session, then delete each item as it is done.

## 0. The full app and Health: merged (23 October 2026, 18:00)
- The main folder is on branch **`merge/full-plus-health`**: the full app (`17ecea7`, from the stash) with Health and the timetable merged in (`839efbd`), and on top, uncommitted, session flow-f7's stack button shown only on hover. What the merge chose is in `notes/health.md`. Checked with the `mergesmoke` journey: finance, crypto and Health open with no page errors.
- Kept, never delete: branch `backup/full-app-2026-10-23`, and the stashes "my local changes before health" and "main folder just before landing the merge". `claude/task-mpmwih`, `claude/task-wr0r33`, `mac-timetable-scan` are as they were.
- **Still waiting** (his request of 23 October 2026): Home's Edit widgets button: "the circle to scale bigger horizontally", the other buttons "scale down horizontally then turn to circles (oval), go behind the main edit widget button, then disappear; then the new buttons appear the same way in reverse, sliding out from behind the main button". Plan: the main button (pencil ↔ Done) one persistent element that grows by clip-path from the circle at its right end; the others collapse by clip-path to a circle, slide behind it (`z-index`), fade; the new set comes out from behind it (WAAPI, FLIP from measured rects, staggered nearest first); Done reverses it. The two-beat version (`toolsOut`, `dgToolOut`) is in the app, see `notes/dashboard.md`. `.dg-btn` is in `PRESS_OWN` (pressKit leaves it alone), so its press is the CSS one.

## 1. Monthly spending rule: done (see `notes/money-flow-goals.md`); in the test data since 18 October 2026 (`notes/dev-test-data.md`). Left to check: the light look, MYR, a backup round trip in the app.
## 2. App size: what was measured (22 October 2026: the word table was cut instead, losslessly, see `notes/ai.md`; what follows is about cutting bits, still not done)
- `package.json` `build.electronLanguages: ["en"]`: drops 48 MB of Electron language packs (not yet built into a DMG).
- The model (`models/flow-ai.gguf`, unsloth EmbeddingGemma 300M Q8_0, 329 MB) stays: 201M of its 303M numbers are the word table (8-bit, ~214 MB). Every smaller build tried scored worse on the held-out notes (each with its own retrained head, `OUT=` in `tools/ai/train.mjs`):
  | build | MB | expenses | goals | symbols | none | probe |
  |---|---|---|---|---|---|---|
  | Q8_0 (shipped) | 329 | 217/227 | 38/40 | 93/129 | 15/16 | 220/221 |
  | Q6_K | 260 | 215 | 38 | 90 | 14 | 220 |
  | Q5_K_M | 247 | 215 | 38 | 90 | 14 | 220 |
  | Q4_K_M | 236 | 213 | 38 | 86 | - | 220 |
- Not tried, the likely loss-free saving: only the word table to 6 bits, the layers kept at 8 (about -50 MB). Needs `llama-quantize` (no build found on this Mac; GitHub's API was rate-limited) or a gguf-py script. Measure it the same way before shipping.
