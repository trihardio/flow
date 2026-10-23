# The time plan

One area of Flow. What applies everywhere, and the list of the other areas, is in the project's `CLAUDE.md`.

Asked for on 22 October 2026: "i also want to make a time prediction, so for example right now is 15.23, i watch one eps of south park for 20 mins then shower for 10 mins then walk 15 mins, then i arrive at campus at _ time". Asked before it was built, he chose **a pop-up with a shortcut plus a Home widget** (as the money exchanger has) and **the plan typed as one line** (not rows). Save point from before it: `savepoints/before_time_plan.jsx`.

## Ways in
- ⌘T anywhere in an app (finance in `PnlCalendar`, a trading side in `TradeTracker`, in the same key handler as ⌘E). ⌘T again or Esc closes it. While it is open every key is its own, as in the exchanger.
- Home's Time plan widget (`plan` on the trading sides, `fplan` on finance; Edit → Add widget; Small, Medium, Large), its ↗.

## The line (`tpParse`, `tpStep`, `tpWork`, in `src/App.jsx` just above `DG_BODY`)
- Steps part at commas (not one between two digits: "1,5 jam" is one and a half hours), ";", "+", "→", "then", "terus", "lalu".
- A step's time is its numbers with a unit, added up (20m, 20 min, 1h, 1.5 jam, 90 menit, 30s); a bare number straight after an hour is its minutes ("1h30", "1 jam 30"); "1:30" in a step is an hour and a half; with no unit at all, its last number in minutes ("watch 2 eps 40" is 40 minutes of "Watch 2 eps").
- The name is what is left, with "for", "about", "selama" and the like, and a leading "i" / "aku", taken out.
- **A last piece with no number is where it ends** ("campus"; "then i arrive at campus at _ time" is read as Campus). Only when there are steps before it: a single piece with no number is a step still waiting for its time.
- **It starts now** and moves on with the clock (each subscriber is woken just after the minute turns), **or at a time written first**: "15.23 …", "15:23 …", "right now is 15.23, …", "from 15:23 …", "jam 15.23 …". "1.30h" at the start is a duration, not a time.
- **A step with no time yet is said** ("“Shower” has no time yet: add its minutes", gold) and no arrival is given until it has one (Right, or it says no).
- Past midnight the arrival says "tomorrow".
- Checked on his sentence and six others in node (the parser alone): his gives Watch one eps of south park 20, Shower 10, Walk 15, Campus, from 15:23, **16:08**.

## Kept
- The line under `TP_KEY` ("flow-timeplan", through `store`: per account; deleted with the account in `userErase`). One store for the pop-up and the widget (`tpMem`, `tpPut`, `useTp`): what is typed in one shows in the other at once. Saved 0.4s after the last key.

## Look and motion
- The exchanger's sheet (`.tp-sheet`, the same frame, title in the pixel type, the status line "Starts now · 15:36" / "Starts at 15:23" with a green dot while it follows the clock).
- The line is a recessed box with a clock symbol, white edge while typing. The arrival in the pixel type (40px in the sheet; on Home `dgPxSize`), counting to a new time from where it stands (`CountNum` with `still`: it never counts up from 00:00 on opening). "Arrive at **Campus**" above it, "45 min in all · 3 steps" (or "in 45 min" when it starts now) under it.
- The steps as a line of times: start, a dot on a thread, name, minutes; the end as a white square with the place. A row comes in once, when it first appears (rises 8px, 35ms apart); what changes in it after that is written in place. The sheet eases to its new height as rows come and go (`useEaseHeight`, the calculators' own).
- Reduce motion: fades only.

## Checking it
- `tools/perf` journey `timeplan` (`--shots`, the usual profile: `--profile=dash` no longer reaches crypto's Home): ⌘T on crypto's Home, his sentence typed in, what the sheet says and its rows, ⌘T closes it, then the widget in Add widget at Small, Medium and Large with stills. 22 October 2026: all as above; nothing cut off in the stills. Not checked: finance's ⌘T and widget (the same components), the light look, his 120Hz display.
