# Flow: the second brain

The map of everything written about the app. Open it first. Every area note links back here and to the areas next to it (its "Related" line), and to its part of the [[notes/code-map|code map]].

## Start here
- [[CLAUDE]]: the shared rules that hold everywhere (performance, style, what never to do) and the list of areas. Claude and Codex both follow them.
- [[AGENTS]]: Codex's entry point into the same instructions, notes and Claude memory.
- [[PRODUCT]]: who Flow is for and the six rules no design work may break.
- [[notes/handoff]]: what is still open across sessions. Read it first.
- [[notes/inbox]]: drop ideas, bugs and requests here; Claude or Codex files them away.
- `notes/log/`: one note a day of what changed (Daily notes: the calendar icon on the left, or ⌘P → "Open today's daily note").
- [[notes/code-map]]: every component of `App.jsx` and function of the Mac shell with its line, by area. Made on every `npm run check`.
- [[notes/claude-memory/MEMORY|What Claude remembers]]: its memory of you and the project (Claude Code's own memory folder). Below, the main ones.

## Finance
- [[notes/finance-day]]: logging: Quick log (⌘N), Quick add, several items in one expense, the no-spend mark, a row dragged to another day, details under a name, one income over several months.
- [[notes/year-month-panels]]: the yearly and monthly panels, the month boxes, `YEARS`, the headers, card order, cards opening when scrolled to.
- [[notes/weekly-plans]]: planned expenses in Weekly expenses, the weekly chart stepped to other weeks, a day's note.
- [[notes/money-flow-goals]]: Money flow, Left over, the score, insights, Projection, the spending rule, goals, Debts.
- [[notes/charts]]: the chart pop-up, Compare, scroll wheel steps, the charts' look.
- [[notes/split-bill]]: Split bill.
- [[notes/worth-it]]: Worth it? (⌘B): is a purchase worth it.
- [[notes/ai]]: the AI helpers: keyword lists, the on-device model, the symbols of Other.

## Trading (crypto, IDX, forex)
- [[notes/trading]]: the tracker: data and sums, day tiles, the journals, pictures, deposits, PnL analysis, Performance, Coins / Stocks, wrapped, rates.
- [[notes/calculators]]: the position and stock calculators, live prices, undo / redo.
- [[notes/forex]]: the MetaTrader journal, its calculator, the forex die.
- [[notes/exchanger]]: the money exchanger (⌘E), its rates and where they come from.

## Health
- [[notes/health]]: the third app: the rings, to-dos, the week and classes, assignments and deadlines, activity, body, diet, gym, the vision board, steps from the iPhone, timetables and assignments read from a picture.

## Every side
- [[notes/dashboard]]: Home, the board of widgets on every side: the widgets, moving and resizing, stacks, layouts, the Classic switch, the widgets' review.
- [[notes/navigation-settings]]: the sidebar, the month header, the footer, Settings, the command bar (⌘P), right-click menus, fewer buttons, bins.
- [[notes/time-plan]]: the time plan (⌘T).
- [[notes/accounts]]: the login, the select acc panel, Reset account and Restore my entries, the Dev account, profile pictures.
- [[notes/data-export-undo]]: Export, Import, Undo, a copy a day, old exports cleaned.
- [[notes/dev-test-data]]: Developer options and the test data of every side.

## The look
- [[notes/style]]: the look that stands: colour roles, pixel figures, animation tempo, liquid glass and its tint, the backdrop's glows.
- [[notes/light-mode]]: Light mode, how a colour gets its light twin, every switch with choices sliding.
- [[notes/style-passes]]: the passes of 12 and 13 October 2026.
- [[notes/design-backlog]]: the design rework still to do, and what was tried and taken back.

## Before an app, and the Mac
- [[notes/stage]]: the opening screen, the selections panel, the coin and its toss, the trading panel, the wallets.
- [[notes/warmup-first-launch]]: the warm-up and the first launch.
- [[notes/shell]]: the Mac shell (`electron/`): what it does for the page, the only requests that leave the Mac.
- [[notes/installer]]: the installer (DMG) and its pixel-art swamp; the Windows installer.

## How the work is done
- **Check**: `npm run check` before anything is called done (build, lint, the picture readers, the code map). It runs by itself when a turn ends.
- **A line in today's log**: `node tools/vault/log.mjs "what changed [[notes/area]]"`.
- **Lag and stills**: [[tools/perf/CLAUDE]], the hidden-app journeys. Never while he is using the app.
- **Save points**: [[savepoints/CLAUDE]], what each one holds. "load <name>" copies one over `src/App.jsx`.
- **Release**: "release to github" runs the `release-github` skill ([[notes/installer]]).

## What Claude remembers (the main ones)
- How he works: [[notes/claude-memory/user-rassam|who he is]] · [[notes/claude-memory/standing-work-rules|standing rules]] · [[notes/claude-memory/use-skills-plugins-web|skills, plugins, web]] · [[notes/claude-memory/ease-out-means-slow-to-fast|"ease out"]] · [[notes/claude-memory/release-to-github|release to github]]
- The look: [[notes/claude-memory/choices-slide-figures-count|choices slide, figures count]] · [[notes/claude-memory/bins-always-visible|bins]] · [[notes/claude-memory/keep-his-pixel-font-designs|his pixel designs]] · [[notes/claude-memory/simple-objects-over-detail|simple objects]] · [[notes/claude-memory/presets-include-stacks|presets]]
- Testing and lag: [[notes/claude-memory/first-time-lag-causes|first-time lag]] · [[notes/claude-memory/check-the-screen-not-the-page|check the screen]] · [[notes/claude-memory/offscreen-electron-check|off-screen check]] · [[notes/claude-memory/hidden-runs-disturb-his-testing|hidden runs]]
- The project: [[notes/claude-memory/vault-map|where things are]] · [[notes/claude-memory/parallel-sessions-edit-app-jsx|parallel sessions]] · [[notes/claude-memory/full-app-health-split|full app and Health]] · [[notes/claude-memory/savepoint-name-free|save point names]] · [[notes/claude-memory/isp-blocks-crypto-exchanges|his provider's block]]
