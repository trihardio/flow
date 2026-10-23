---
target: yearly panel
total_score: 22
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 1
target_identity: "file:/Users/affan/Documents/misc/react app/Financial Tracker/flow/src/App.jsx#yearly-panel"
timestamp: 2026-10-12T19-21-42Z
slug: src-app-jsx-yearly-panel
---
⚠️ DEGRADED: single-context (this session only spawns sub-agents when asked; design review first, then the detector)

Target: the finance yearly panel (PnlCalendar, view === "year", in src/App.jsx). Evidence: two stills from 12 October 2026 evening (the owner's real 2026; a full year of test data), a still of a month box under the pointer, and the source. Detector results reused from the whole-app run (file unchanged, sha256 4f1632f2…). Not looked at: the trading sides' yearly panel; the two glows added behind the lower half.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Today's month is ringed; a quick add counts into its box |
| 2 | Match with the real world | 2 | Two unlabelled figures per box; spending written with a minus |
| 3 | User control and freedom | 3 | Wheel, keys and arrows step years; no undo here after a quick add |
| 4 | Consistency and standards | 2 | Box colour answers a different question from the month it opens |
| 5 | Error prevention | 3 | Quick add is hard to get wrong |
| 6 | Recognition rather than recall | 2 | Nothing says what the numbers or the line are |
| 7 | Flexibility and efficiency | 3 | Type a digit anywhere and you are logging; boxes need the pointer |
| 8 | Aesthetic and minimalist design | 3 | Strong poster; a thin year is a screen of dots |
| 9 | Error recovery | n/a | The panel has no error states of its own |
| 10 | Help and documentation | 1 | No info note here, unlike the month |
| **Total** | | **22/36** | **Acceptable (61%)** |

## Design Specificity Verdict

LLM assessment: the poster header is authored (pixel year, one huge figure, in and out beside it). The grid is weaker: twelve boxes with two bare numbers and a faint line could be any dashboard, and a newcomer has to decode them.

Deterministic scan: of 22 findings in src/App.jsx, one is on this panel (bounce-easing on the chart button's hover, line 15842) plus Inter as the text face. Both are the owner's choices.

Visual overlays: none (no browser automation in the session).

## Overall Impression

The top third is the best header in the app. The grid tells less than it looks like it does. Biggest opportunity: each box says plainly what it holds.

## What's Working

- The poster: "2,71jt · net gain this year · 10,75jt in · 8,03jt out" is read in a second.
- A typed digit lands in the amount box; Enter adds; the month box counts to its new figure.
- The next year peeking in below shows that years scroll.

## Priority Issues

- [P1] Nothing says what a box's numbers are. Top figure: income minus spending. Small figure: spending, written with a minus. Line: spending per day. No label, no hover note; and the box is coloured by income against spending while the month it opens is scored against the daily limit. Fix: "left" and "spent" as words, no minus on the spent figure, a hover note like the day tiles'. Command: /impeccable clarify
- [P2] The lines cannot be compared: each month's line is scaled to its own tallest day (yearSparks: t / top), so October (270Rb) peaks as high as August (4,42jt). Fix: one scale for the whole year; the lines stay. Command: /impeccable clarify
- [P2] A thin year is a screen of dots, and the future looks like the past (nine of twelve boxes a grey "·" on the real 2026; Nov and Dec look like Jan to July). Fix: an empty box is its name alone; months still to come a step fainter. Command: /impeccable distill
- [P2] Two ways to log on one screen, and the visible one whispers: the quick-add row's hint measures 2.4 to 1 and its add button is a minus sign; the month has a "Log ⌘N" capsule instead. Fix: make the row readable, or replace it with the capsule (the row was the owner's ask on 4 October: needs his word). Command: /impeccable distill
- [P3] Two giants in the header: "2026" and the figure are the same height on one line; a press on "2026" opens the wrapped with no sign that it does. Fix: the year a step quieter than the figure (both were his asks: only on his word). Command: /impeccable typeset

## Persona Red Flags

- Alex (power user): a month cannot be opened from the keyboard (arrows only step years); no undo on this screen after a quick add.
- Jordan (a friend, first time): an empty account shows twelve dots and a zero, with no mention of the daily limit; the only coloured control in the footer is the yellow test-data flask.
- Sam (keyboard, low vision): boxes take no Tab or Enter; the spent figure is 11px grey; the intro and the digit flicker ignore Reduce motion.

## Minor Observations

- The year's bar has no "% kept" words; the month's has.
- The year arrows sit in the bottom-right corner, far from the year they change.
- The chart button and the footer's five buttons are symbols only (with notes on hover).

## Questions to Consider

- If a box could say only one thing about its month, what should it be?
- Does the year need its own way to log, or the same one as the month?
- What should a month that has not happened yet look like?
