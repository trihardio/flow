# Flow

Flow is a private, personal macOS finance app for Rassam: a PnL-calendar spending tracker in IDR, with optional MYR. It is for personal use only, so trademark and branding concerns don't apply.

It was called Trace until 2 October 2026. Everything is named flow now, at his request: the project folder, the package `name` and `appId` (`com.rassam.flow`), `window.flowAI` / `window.flowFX`, `models/flow-ai.gguf`, the installer, and the data folder `~/Library/Application Support/flow`.
- One name must stay: the page address `app://trace`. What the page has saved is filed under that address inside the data folder, so changing it would hide all his data.
- The data folder was `trace`. `electron/main.cjs` moves an old `trace` folder across on launch if it still finds one (and goes on using it if the move fails); don't remove that. A copy from before the move is in `~/Library/Application Support/flow-backup-2026-10-02`.
- The save points were given the new `window.flowAI` / `window.flowFX` names too, so loading one still gets the AI helper and the live rates.

A second side is built on the same lines: a trading PnL tracker with three sections, crypto, Indonesian stocks (Rassam calls that one the IDX/IHSG panel) and, since 8 October 2026, forex. The way in is the selections panel, then a trading selection with, from left to right, the Bitcoin coin, the IDX globe and the forex die (three coins until 11 October 2026). All three open the same tracker (`TradeTracker`): the coin in USDT, the globe in rupiah, the die in US dollars. Since 20 October 2026 each opens on **Home**, a dashboard of widgets he can move, resize, add and remove, finance too (`notes/dashboard.md`); the yearly panel is one press away, and Settings' Start screen switches any side back to Classic.

A third, since 23 October 2026: **Health** (`HealthApp`; his words: "an app called health … tracks my fitness and everything, basically for my day to day life"), the activity rings standing on the selections panel between the wallet (finance) and the coin (trading), where he asked for it the same day ("in between finance and trading apps"; it was to the right of the coin for its first hours, out of sight until the coin was in the middle, and he could not find it). It goes straight in, with no panel between. See "Health" in the architecture notes.

## Project layout
- The whole app lives in one file: `src/App.jsx` (~1.3 MB, React). Keep it as a single file unless the user asks to split it.
- `src/main.jsx` mounts it and loads `src/fonts.css`. Vite is the dev server and bundler (`npm run dev`, `npm run build`).
- `src/fonts.css` + `src/fonts/`: Inter, Material Symbols Outlined, Ballet, Mrs Saint Delafield and Press Start 2P, stored locally. Never load fonts or anything else from the internet.
- `electron/` is the Mac app shell:
  - `main.cjs`: window, serves `dist/` from `app://trace`, blocks every internet request the page could make, runs and caches the AI helper.
    - It also reads one file for Health (`phoneRead`, `health:phone`, `window.flowHealth.phone()`; 23 October 2026): `flow-health.txt`, which a Shortcut on his iPhone saves in iCloud Drive every day, looked for in the Shortcuts folder (`~/Library/Mobile Documents/iCloud~is~workflow~my~workflows/Documents`), in iCloud Drive itself and in a Flow folder there; the newest wins. A file on the disk, not a request: iCloud does the syncing. See Health.
    - Two deliberate exceptions, both asked for by Rassam, both made by this process itself with Node's own `fetch` (`askJson`), never through the browser engine (the page itself still can't reach anything, and everything works offline with the last data). Add no other request.
      - `fetchRates`: the latest USDT → IDR / MYR rate (CoinGecko, then open.er-api.com as a fallback), when the crypto side asks.
      - `fetchQuote(market, symbol)`: the latest price of the coin or stock typed in a calculator (2 October 2026: "fetch data from the internet in real time"). Sources per market in `QUOTE_SOURCES`, best first: crypto is Bybit, Binance futures, Gate.io futures, Binance's public spot mirror, TradingView; stocks are TradingView, then Yahoo. A source that can't be reached rests ten minutes; the one that last knew a name is asked first.
      - His internet provider blocks Bybit, Binance, Coinbase, OKX and most big exchanges (they land on internetpositif.id), so on his line crypto prices come from Gate.io (the USDT perpetual, live, about 0.1s). They stay first in the list for when he is on another line. Don't work around the block.
      - **The engine itself is kept off the internet altogether** (6 October 2026): `host-resolver-rules` is `MAP * ~NOTFOUND`, so any name it is asked to find does not exist, and its own encrypted lookups are off (`configureHostResolver`). The page is served from the app's files and needs neither. It can therefore never open a connection, and never print that line again, whatever is added later. Leave both in.
      - Proof kept short: the shell of before, run hidden with its own lookup told Bybit's real address, printed his exact line; the new one under the same condition, with the engine also pointed straight at blocked exchanges, printed nothing and still got rates and prices.
      - When the Mac's own lookup happens to give a blocked exchange's real address, that exchange answers and its prices are used (it is first in the list). Nothing was added to get round the block; it is the system's ordinary lookup.
      - Why not through the engine: his provider answers for a blocked exchange with its own page, whose certificate is wrong, and the engine prints `handshake failed … net_error -200` in the terminal for every try that lands there (he asked what it was, twice). A look at the certificate first (`checkHost`, 2–6 October 2026) did not hold: the look and the engine find a name's address separately, and on 6 October the Mac's own lookup gave Bybit's real address (the look passed) while both name servers sent the engine to the block page. Asked by this process, a wrong certificate is an ordinary error: the source rests ten minutes and nothing is printed. Never route these through `net.fetch` or a session's `fetch` again.
      - The money exchanger's rates (20 October 2026: "live prices updated from the internet", "make sure the prices are accurate"), the same kind of request as `fetchRates`: `fetchFxTable` (every currency against the dollar, ExchangeRate-API's daily table, kept an hour) and `fetchFxLive(codes)` (the currencies on screen, live: TradingView's forex quotes, then Yahoo's for what TradingView doesn't give). See `notes/exchanger.md`.
      - Stock prices run about 10 minutes behind the exchange (TradingView's free IDX feed). Nothing free and without a login is fresher: Stockbit needs his account, idx.co.id refuses programs, Yahoo rate-limits. He has been told.
  - `preload.cjs`: exposes `window.flowAI.pick(kind, text, labels)`, `window.flowFX.rates()`, `window.flowFX.quote(market, symbol)`, `window.flowFX.table()` and `window.flowFX.live(codes)` (the money exchanger), `window.flowBackup.keep(name, text)` (see "A copy a day"), and `window.flowGfx` (`cold`, `settle()`, `primed()`: see "First launch" in the architecture notes).
  - `ai.mjs` + `ai-classify.mjs`: the on-device model process and the code that turns its output into a label.
  - `ai-head.json` (0.5 MB) + `ai-head.bin` (9.3 MB; one 12.9 MB JSON until 23 October 2026): what the classifier learned, three heads: `cat`, `goal` and `sym` (the symbol of an expense in Other); the stored example notes are raw bytes in the `.bin` (`loadHeads` / `saveHeads` in `ai-classify.mjs`). Generated by `npm run train-ai`; do not edit by hand.
- `models/flow-ai.gguf` (238 MB since 22 October 2026; EmbeddingGemma 300M Q8, its word table cut to the 155,101 pieces made of Latin-1, symbols and emoji by `tools/ai/prune-vocab.mjs`: any note in those characters gives exactly what the full model gave, proved by `tools/ai/check-prune.mjs` and by a retrained head coming out byte for byte the same) is the on-device model. The full one (329 MB) is kept in `tools/ai/models/flow-ai-full.gguf`, not shipped (see `notes/ai.md`). `build/icon.png` is the app icon.
- `tools/ai/` trains the classifier (not shipped in the app):
  - `cats.txt`, `cats2.txt`, `goals.txt`: hand-written labelled notes. `distilled.txt`: 5,182 more, written and labelled by a 2.5 GB teacher model (`distill.mjs`; the teacher is not kept in the project).
  - `syms.txt`: 1,779 hand-written notes for the symbols of Other, one `# symbol` header each (see "The symbols of Other"). `ONLY=sym npm run train-ai` trains that head alone and leaves the other two byte for byte as they are (about a minute; `EMBED_CACHE=<file>` makes a second run quick).
  - `tests.json`: held-out notes for scoring. `train.mjs` prints the held-out score, then writes `ai-head.json`.
  - To teach it something new: add notes to `cats.txt` or `goals.txt`, run `npm run train-ai`, then rebuild the app.
- `tools/perf/` hunts lag (not shipped in the app): it drives a build through a journey in the project's own Electron with no window on screen, on a copy of his entries, and reports per step how long the page was busy in one go, how long the graphics process was stuck, and how many graphics programs had to be built. Each step is done twice, because the lag he notices is the first time a thing is opened after a launch.
  - **Don't run a journey while he may be trying the app himself.** A hidden run draws at full size on the same graphics chip of an 8 GB Mac: on 8 October 2026 he tried the first-launch fix while two were running and found everything lagging. Say so when it can't be avoided, and keep the runs few.
  - The journeys themselves, their flags and what the numbers can and can't say are in `tools/perf/CLAUDE.md`. It is read by itself when a file in that folder is opened: read it before running a journey from the shell.
- `npm run app` builds and opens the Mac app from source. `npm run dmg` builds `release/Flow-<version>-arm64.dmg` (357 MB since 22 October 2026, bzip2 `UDBZ`; 549 MB installed as Finder counts; ad-hoc signed).
  - From a VS Code terminal, Electron needs `ELECTRON_RUN_AS_NODE` unset; the `app` script does that.
  - After `npm install`, run `node node_modules/electron/install.js` if `node_modules/electron/dist` is missing.
- `savepoints/` holds named snapshots of `App.jsx`:
  - What each save point holds is listed in `savepoints/CLAUDE.md`.
  - When the user says "load <name>", copy that file over `src/App.jsx`.
  - When they ask for a new save point, copy `src/App.jsx` to `savepoints/<name>.jsx`.
- `public/crocodile-logo.png` is the original logo cut-out. `public/warm-seed.json` (1.4 MB, 34 screens) is a set of screens made of test data, drawn on a first launch (see "First launch"); made by `tools/perf`, not by hand.
- `PRODUCT.md` (12 October 2026, made with `/impeccable init`): who the app is for, what it is for and the six rules no design work may break, as he confirmed them that day. New that day: **besides him, a few people he knows get the installer and an account of their own**, so a screen has to make sense to somebody who has never seen it. The design commands read it first; this file stays the authority for every decision, look and performance rule.

## How the user works
- He is very sensitive to lag and visual fidelity. Follow his references exactly and break nothing that already works.
- Keep replies short. Explain what changed in plain words, not code.
- Before any large edit, make a backup copy of `App.jsx` so the change can be reverted.

## Unfinished work
- `notes/handoff.md`: what a stopped session left half done (15 October 2026: the monthly spending rule, the model size). Read it first.

## Notes by area
Until 13 October 2026 everything was in this file, and every session read all of it. Each area of the app now has a file of its own, read only when that area is worked on.
- **Before changing an area, or answering a question about it, read its file, and every other file the change touches.** They hold what he asked for, what he rejected and what was measured. Skipping one repeats a mistake he has already corrected.
- **New notes go into the area's file, not into this one.** This file holds only what applies everywhere and stays under 40,000 characters. A new area gets a new file and a line in this list.
- A "see X" anywhere in these files names a section. This list says which file holds it.
- The areas:
  - `notes/design-backlog.md`: the 7 October design rework (what is done, **what is left and in which order**, what was tried and taken back: the week column, the blocks on the month boxes), the 13 October critique and its feature list, Superdesign.
  - `notes/accounts.md`: Accounts: the login, the select acc panel, the account button, Reset account and Restore my entries, the introduction, the Dev account, the names on the cards, profile pictures and what is behind them.
  - `notes/navigation-settings.md`: Navigation (the sidebar, the month header), the footer buttons, Settings.
  - `notes/finance-day.md`: logging on the finance side: Quick log (⌘N), Quick add, several items in one expense, the no-spend mark, a logged row dragged to another day, details under a name, one income over several months.
  - `notes/split-bill.md`: Split bill.
  - `notes/weekly-plans.md`: Planned expenses in the Weekly expenses card, the weekly chart stepped to other weeks, a day's note pressed open.
  - `notes/data-export-undo.md`: Export, Import, Undo after a delete, A copy a day.
  - `notes/ai.md`: AI helpers (the keyword lists and the on-device model), The symbols of Other.
  - `notes/dev-test-data.md`: Developer options, test data on the finance side, what test data fills on every side.
  - `notes/stage.md`: the panels before an app: Opening screen, Selections panel, the coin and its toss, the trading panel, the IDX globe, the card leaving the wallet, Side titles, the wallet following the year.
  - `notes/warmup-first-launch.md`: Warm-up, First launch (the preparation, the rehearsal of the stage, `warm-seed.json`).
  - `notes/dashboard.md`: Home, the dashboard of every side: the widgets, the board (snap on / off, moving, resizing), widget stacks, layouts, the Classic switch, how it is saved, live prices.
  - `notes/trading.md`: Trading tracker: data and sums, day tiles, the crypto journal, the IDX journal, pictures, deposits, PnL analysis, Performance, Coins / Stocks, the win / loss ring, Breakdown, test data, wrapped, currency and rates, the finance side's design on the trading sides.
  - `notes/calculators.md`: Position calculator, Stock calculator, live prices, how results arrive, undo / redo.
  - `notes/forex.md`: Forex: the MetaTrader journal, its calculator, the forex die, the trading panel as a row of three.
  - `notes/health.md`: Health, the third app (the rings on the selections panel, to-dos, the week, activity, body, diet, gym, the vision board, steps from the iPhone, a timetable read from a picture), and what the merge with the full app chose.
  - `notes/time-plan.md`: the time plan (⌘T, Home's Time plan widget): one typed line of steps and minutes, and when it ends.
  - `notes/exchanger.md`: the money exchanger (double click on the currency pill, ⌘E, Home's Exchange): its rows, its rates and where they come from, the list of currencies, its animations, and the calculator beside it.
  - `notes/charts.md`: Chart pop-up browsing and Compare, Scroll wheel steps, Charts (their look, the weekly chart's axis, income bars).
  - `notes/year-month-panels.md`: Yearly panel layout, the month boxes, `YEARS`, Month title flicker, the year and month headers, card order, cards opening when scrolled to.
  - `notes/money-flow-goals.md`: Money flow chart, Left over, the score and its information symbol, insights, Projection, Debts.
  - `notes/style.md`: the look that stands: a personality per area, colour roles, pixel figures, animation tempo, the look refresh (the hero, goal rings), liquid glass, the backdrop's glows, focus outlines.
  - `notes/light-mode.md`: Light mode: how a colour gets its light twin, the upside-down scheme switch, what stays dark, the day and night switch in Settings, every switch with choices sliding.
  - `notes/style-passes.md`: the passes of 12 and 13 October 2026: Audit fixes (colour tokens, reduced motion), Calmer day tiles, Developer-mode test and clean-up, the polish passes on the finance side and on the trading sides.
  - `tools/perf/CLAUDE.md` and `savepoints/CLAUDE.md` are read by themselves when a file in their folder is opened (see Project layout).
- This file as it was before the split: `savepoints/claude-md_before_split.md`.

## Never
Each of these is said in full in the file named. They are repeated here because those files are no longer read at every start.
- Never write to his data folder (`~/Library/Application Support/flow`), and never hand his entries or that folder to an outside service. When entries seem gone, look at what is saved first, on a copy (`notes/data-export-undo.md`, `notes/design-backlog.md`).
- Reset account and Restore my entries put entries aside and bring them back. Never turn either into something that erases what was put aside (`notes/accounts.md`).
- Changing account loads the page again. Never make it swap in place (`notes/accounts.md`).
- A hidden run must never make a real download or open a file box: either would come up on his screen (`tools/perf/CLAUDE.md`, `notes/trading.md`).
- Pictures on trades: never sweep without telling the sweep the side, and add every new place for pictures on a trade to `SHOT_KEYS`, or its pictures are swept away as belonging to no trade (`notes/trading.md`).
- The shell only ever removes a file in `exports/automatic backups` whose whole name fits `AUTO_NAME`. Keep it that way (`notes/data-export-undo.md`).

## Architecture notes
- **Whose entries are whose**: the list of accounts is under `flow-users` (`{ list: [{ id, first, last, pic }], last }`), nobody's data and in no backup. The first account (`main`) keeps the keys the app always had, so his entries were never moved; any other account's keys start with `u:<id>:`. `store` puts that in front of every key and **refuses to read or write until an account is chosen**, so an empty state can never be saved over somebody's entries: keep every read and write of entries going through `store`, never `localStorage` or `rawStore` directly. The pictures on trades are in a store per account as well (`flow-shots` for the first, `flow-shots-<id>`): each side sweeps away pictures none of its trades point to, and would have swept another account's. The finance entries are read when `user` is set, not at mount.
- **Every element goes through `flowEl`** (13 October 2026, light mode; the pragma lines at the very top of `App.jsx`): it rewrites the colours of inline styles and SVG attributes as `light-dark(dark, light)`, the light one worked out from the dark one. So: write a colour as the dark look's, as always; a pair by hand is `ld(dark, light)`; a drawing whose colours are its own gets `data-dk`; never name anything `flowEl`. The light look is `color-scheme: dark` on `body`, upside down on purpose. All of it is in `notes/light-mode.md`: read it before touching colours, the stylesheet's `<style>` line or the top of the file.
- **Storage:** the `store` adapter uses `window.storage` when present (the Claude sandbox), otherwise `localStorage`.
  - Keys: `pnl-calendar-idr` holds the data; `pnl-test-config` holds the test-data settings. Those are the first account's; another account's start with `u:<id>:` (see Accounts).
  - Data from the old Claude-hosted version does not carry over automatically. The user must Export there and Import here.
  - The Mac app keeps its own data (origin `app://trace`), separate from the browser version: Export there, Import in the app.
- **Saving:** writes go through a persist chain that merges into the `latestData` ref.
- **Loading:** `migrateSpending` and `migrateIncomes` sanitise what is loaded. `MAX_AMOUNT = 1e13`.
- **Logos:**
  - `CROC_LOGO`: colour, used in the footer (right side, 24px, still; pressing it goes back to the opening screen) and on the opening screen.
  - `CROC_ENGRAVED[variant]`: metal-tone versions on the cards.
- **Currency:** MYR always shows one decimal (11.49 → 11.5).
- **Money boxes keep the caret** (23 October 2026, his report: arrow keys "can't edit already written down text"): a box that puts its dots back at every key (6.600.000) threw the caret to the end. One listener for every text box, just above the `Pressable` comment near `sanitizeAmount`, puts it back after as many digits as stood before it, and in a rupiah box Backspace / Delete next to a dot takes the digit beyond. A new money box needs nothing; it only acts when the box shows the same digits in nothing but digits, dots, commas and a sign. Checked with the `rpcaret` journey.
- **Numbers while they count** (`liveText`, used by `fmtLive` on the finance side and `curLive` / `usdLive` on the trading side): at rest an amount drops its trailing zeros (1,2jt · 1,23jt · 800Rb), so written that way every frame its width jumped between one decimal and two all through a count. Rassam saw it under the bar when switching years and wants "no flickering whatsoever". Each unit now keeps one precision for the whole count:
  - both ends in the unit, the end with fewer or as many decimals (1,23 → 1,5): the start's all the way; it drops to the end's only when the count stops.
  - both ends in the unit, the end with more (1,2 → 1,57): the start's until its digits have arrived (1,2 1,3 1,4), then the end's (1,50 … 1,57). One change, never back.
  - only one end in the unit (1,23jt → 900,9Rb): that end's (1,23 … 1,00jt, then 999,9 … 900,9Rb). A unit only passed through gets none.
  - So a count shows "1,0jt" and "1,50jt" on the way; the trimmed form is only for a number at rest.

## Performance rules (learned the hard way)
- Define components at module level, or call them as plain functions. Never define them inside another component's render: that causes remounts and focus loss.
- No React state inside requestAnimationFrame loops. Write styles straight to DOM refs (see `writeTilt`, `placeBg`).
- Animate only `transform` and `opacity`. Never animate `filter`, `width` or blur.
- A `transition` or `color` in an inline style (the `S` table) silently beats the class's. That is how the day tiles' and month boxes' eased lift, the fold arrows' hover and the month label's hover were written and never played. Keep what a class hovers or eases out of the inline style.
- A gradient can't be transitioned; a registered number can. The tiles' sheen is worked out from `--lit` (`@property`, 0 → 1 under the pointer), which at 0 and 1 gives exactly the two gradients that used to be switched.
- Entrance animations use `animation-fill-mode: backwards` with an explicit end state, never `forwards` or `both`.
  - A held animation creates a backdrop root that breaks `backdrop-filter` blur on liquid-glass elements.
- Avoid nested or invisible `backdrop-filter`s.
- **Anything that changes the page's height must not redraw the page** (4 October 2026: he reported lag whenever Money flow was folded or opened; the graphics process was stuck 7–21ms on most frames of the fold, measured with the `cards` journey, and not once after these):
  - The backdrop is one picture of a fixed height (`PAGE_BG`, an SVG as a single `background` layer on `body`). With several background layers, or one sized from the box, the engine redraws the whole backdrop whenever the box's height changes. It matches the old six CSS gradients to within 1/255 (compared with the content hidden). Never go back to several layers or a height in %.
  - Every card (`.flow-card`) and what folds inside it (`.fold-in`) keeps `will-change: transform`: a surface of its own, so a fold only moves the cards below and cuts its own content off, without drawing either again.
  - A card's seen / open / replay state lives in the card (`FoldCard`), and a part's in `Reveal`, never in `PnlCalendar`: setting it there worked the whole panel out again (17ms) as each card came into view and on every press of an arrow.
- **A rule that can match anything (`> *`, ` *`) under a class that is put on and taken off makes the engine restyle everything inside** when the class changes. `.month-view.enter > *` did that 1.1s after every month opened (the class is taken off again then): 1558 elements, 17ms in one go. The month's parts now carry `data-mv` (`FoldCard` puts it on itself) and the rules say `> :where([data-mv])`, as strong as before: 101 elements, 5ms. **A new part of a month needs `data-mv`** or it does not come in with the others (`tools/perf` journey `parts` checks it).
- Chart tooltips are HTML `GlassTip` elements laid over the SVG, positioned in viewBox percentages.
- The Mac's display runs at 120Hz, so a frame has about 8ms. Measure in the real Electron app, not the browser.
- Fonts are loaded and unpacked before the opening screen's pieces come in (`warmFonts`), and two hidden spans at the top of the page get the rest ready in the very first layout: one `.msym` icon (the 4MB icon font takes about 55ms to unpack), and the characters Inter lacks, which the system supplies from its own fonts (30–50ms the first time it is asked; it used to land in the first month view and the first chart).
- First-time lag is the warm-up's job (see `notes/warmup-first-launch.md`). When something still lags only the first time, measure it with `tools/perf` before guessing: the page being busy, the graphics process being stuck and graphics programs being built are three different causes with three different cures.
- An element that gains or loses a `filter` (or anything else that gives it a surface of its own) has every layer under it drawn again. Give it the filter for good, at strength 0 (`blur(0px)`), and change only the strength.
- Work that can wait (filing a screen, saving something big) goes into an idle gap with room for it (`warmWhenIdle`), in pieces of a few ms: a 17ms piece once landed on the very frame of a click.
- `electron/main.cjs`: the `app` scheme has `codeCache: true` (compiled script kept between launches), and background throttling is left on so a hidden window costs nothing.
- The very first launch on a fresh profile stutters while the graphics pipelines are built and cached (`GraphiteDawnCache` in the app's data folder). Later launches reuse them: a program then takes about a millisecond to set up instead of a hundred or more. The same goes for the first launch after a screen is first filed for the warm-up.
  - The engine's own switch for this (`enable-skia-graphite-precompilation`) was tried: it builds a fixed list that doesn't cover what this app draws, and slowly. Don't retry.

## Style
- iOS 26-style "liquid glass" UI on a dark grey gradient, with smooth, premium animations.
- A highlighted box must be whole: the same round corners on every side. What folds away (cards, lists, the wrapped's detail) sits in `S.fold`, which cuts off top and bottom only (`overflow-y: clip`, `overflow-x: visible`). A plain `overflow: hidden` there sliced whatever reached a few px past the sides and left it square on one side: the "Last 7 D" tab, the rows of the win / loss ring. Rassam sent pictures of both that and the Income label of the money-flow chart, whose highlight is now only as wide as its text (as wide as its slot, it ran out past the card's edge).
- The grey gradient behind the yearly and monthly panels is the page's own background (`body`), so it scrolls with the UI: lighter graphite at the top, deepening on the way down, with soft glows placed in px along the page (`PAGE_BG`, see the performance rules). Rassam does not want a still, fixed backdrop.
  - It needs `!important`: `index.html` and the boot code give `body` a plain inline colour, which silently covered the old fixed `body::before` gradient.
