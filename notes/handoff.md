# Handoff: what is still open

Back to [[HOME]] · [[notes/inbox]] · Checked against the code and git on 9 November 2026: what was done since is gone from here (the 23 October stash work merged, the timetable reader, the monthly spending rule, Electron's language packs cut). Read this first next session; take each item off when it is done, and put a new one in when a session stops half way.

## Release
- **1.2.1 is built but not on GitHub** (`release/Flow-1.2.1-arm64.dmg` and `Flow-Setup-1.2.1.exe`, 6 November 2026; the last commit is `a0ba633` "Flow 1.2.0"). Since then, uncommitted: the projection made plain, the widgets' review, the glass's tint, this vault pass. His "release to github" runs the `release-github` skill, which makes a new version anyway. See [[notes/installer]].

## Fewer buttons: passes left (4 November 2026)
He chose "whole app, in passes", keep the look ([[notes/navigation-settings]] "Fewer buttons"). Done: the command bar, the right-click menu, Home (every side), Health's week / to-dos / assignments, finance and trading day rows, the journal's trades. Left, in this order, each checked with a journey before the next:
1. Finance goals and debts rows (+, pencil, bin): a menu; the bin waits for the pointer and never leaves a hole ([[notes/navigation-settings]] "Bins"). Weekly plans' rows, subscriptions. **Ask him first**: [[notes/navigation-settings]] "Bins" says goals, debts, subscriptions and plans keep their bins in sight at his request of 30 October (left alone on 10 November 2026 for that reason).
2. Health: gym sessions, shopping lists and items, the vision board's Note / Picture, class notes' and lessons' items.
3. Trading: the month header and the calculator (gear, test levels), deposits rows, PnL analysis chips.
4. The finance month header and footer (Log, ⇄, currency, chart, wrapped): what ⌘P now covers.
5. Commands from more screens (`useCmds`): finance month (chart, wrapped, export / import), trading (calculator, deposits), Health cards (log steps on a day, sleep, gym).
Never cut what he designed by hand without asking: Home's toolbar and its morph, the Shortcuts widget, the stage, the pixel titles.

## Health animations "1:1 from finance" (asked 23 October 2026): partly done
- Done since: `.hl-cls:hover` no longer uses `filter: brightness`; the hero's rings are no longer remounted on a new day.
- Done 10 November 2026: the title has finance's pixel flicker on opening and the letter swap on another day (`titleFlick`, `.hl-title.month-big`).
- Left: the hero's tiles counting (`CountNum`); to-dos and classes folding away when removed, as finance's rows do. See [[notes/health]].

## Monthly spending rule: left to check
Done ([[notes/money-flow-goals]]), in the test data ([[notes/dev-test-data]]). Not yet seen: the light look, MYR, a backup round trip in the app.

## App size: the model (22 October 2026)
The word table was cut losslessly ([[notes/ai]]). Cutting bits is not done: every smaller build tried scored worse on the held-out notes (each with its own retrained head, `OUT=` in `tools/ai/train.mjs`):

| build | MB | expenses | goals | symbols | none | probe |
|---|---|---|---|---|---|---|
| Q8_0 (shipped) | 329 | 217/227 | 38/40 | 93/129 | 15/16 | 220/221 |
| Q6_K | 260 | 215 | 38 | 90 | 14 | 220 |
| Q5_K_M | 247 | 215 | 38 | 90 | 14 | 220 |
| Q4_K_M | 236 | 213 | 38 | 86 | - | 220 |

Not tried, the likely loss-free saving: only the word table to 6 bits, the layers kept at 8 (about -50 MB). Needs `llama-quantize` (no build found on this Mac) or a gguf-py script. Measure it the same way before shipping.

## Kept, never delete
- Branch `backup/full-app-2026-10-23`; the stashes "my local changes before health" and "main folder just before landing the merge" (both merged into `merge/full-plus-health` on 23 October 2026; kept as the record). `claude/task-mpmwih`, `claude/task-wr0r33`, `mac-timetable-scan` as they were. See [[notes/claude-memory/full-app-health-split]].
