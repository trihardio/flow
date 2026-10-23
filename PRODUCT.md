# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Rassam**, the owner and the main user. He logs his spending in rupiah every day and trades three markets: crypto perpetuals, Indonesian stocks (IDX) and forex. He works on one Mac (8 GB of memory, a 120Hz display) and is very sensitive to lag and to visual detail.
- **A few people he knows** (confirmed 12 October 2026). They get the installer and an account of their own. To them the app is new: it has to make sense to somebody who has never seen it and was not there when it was built.
- Nobody else. It is not a public product: no sign-up, no pricing, no marketing.

Not yet known, don't assume: whether those people trade or only track spending, which currency they think in, and whether they use his Mac or their own.

## Product Purpose

Flow is one Mac app for a person's own money and their own trading. It has two sides built on the same lines:

- **Finance**: a calendar where each day is judged against a daily spending limit, as a trader's day is judged by its result.
- **Trading**: the same calendar for closed trades, in three sections (crypto, IDX stocks, forex), with a position calculator and a trade journal in each.

It succeeds when it does all four of these (all confirmed as true, none ranked above another):

1. He stays under his daily limit.
2. He sees where the money goes and saves toward goals.
3. He sizes a trade fast, while the price is moving.
4. He journals trades and trades better for it.

## Positioning

Drawn from how the app is built, not from a sentence of his; correct it if it is off.

- Spending is read as a PnL. A day under the limit is a green day, a day over it a red one, and the month and the year add up the same way a trading account does. The finance side and the trading sides are one idea shown four times, so learning one teaches the others.
- It is built round one person's exact way of working: his rule for sizing a position, his exchange's boxes, his broker's fees, rupiah written as he writes it (Rb, jt).
- It is private. Everything is kept on the Mac, it works with no connection, and no account exists anywhere else.

## Operating Context

- A Mac app (Electron, Apple Silicon), installed from a DMG or run from the project with `npm run app`. One window. A plain browser version exists for development only.
- **Logging spending** happens many times a day and has to take seconds: the quick log (⌘N, the "+ Log" pill on the yearly and monthly panels, or a digit typed on the yearly panel), or the day's own panel.
- **Planning a trade** happens beside the exchange or the trading platform, with the calculator open and the levels changing as he types. What the calculator gives is typed into the exchange by hand, so its figures are the ones the exchange accepts.
- **Journaling a trade** happens after it is closed: the result, the levels, a setup note, a review note, pictures of the chart.
- Money: rupiah first, written 800Rb and 1,2jt; Malaysian ringgit as an optional view. Crypto is kept in USDT, forex in US dollars, stocks in rupiah and lots of 100 shares.
- Backups are files he exports and imports himself, one folder per side.
- His internet provider blocks most large crypto exchanges. The app does not work round that.

## Capabilities and Constraints

**What exists**

- Finance: yearly and monthly calendars, a day panel (expenses, incomes, several items in one expense, a no-spend mark, rows dragged to another day), quick log, weekly expenses with planned expenses, money flow with a score, a projection and insights, goals, debts, split bill, a wrapped for the month and the year.
- Trading, per market: yearly and monthly calendars, a trade journal with pictures, deposits, a calculator (position size, leverage and margin for crypto; lots and averaging down for stocks; lots for forex), PnL analysis, performance, a breakdown per name, a wrapped.
- Accounts without passwords, each with its own entries, a login on a first launch and a short introduction for somebody new.
- An on-device helper that puts a category on an expense and an icon on a goal when the word lists can't.

**Rules no design work may break** (confirmed 12 October 2026)

1. **Mac app only.** No phone, no other system, no public web version.
2. **Fully offline.** Fonts, icons and the helper are inside the app. Only two things come from the internet: exchange rates and the latest price of a coin or stock. Add no other request, and load nothing from a network.
3. **Nothing may lag, not even the first time** a thing is opened after a launch or after an install.
4. **Entries are never lost or erased.** Nothing is ever written to his data folder from outside the app, an account's entries never reach another account, and one side's trades never mix with another's.
5. **Rupiah first, MYR optional.**
6. **The whole app is one file**, `src/App.jsx`, unless he asks to split it.

**His names for things** (use them): the open app panel (the opening screen), the selections panel, the wallets panel, the trading panel, the IDX/IHSG panel, the select acc panel, the login, the wrapped, PnL.

**Where the rest is written.** `CLAUDE.md` holds every decision made so far, with its date and his words: what was tried and sent back, the look and motion he has made binding, the performance rules, and the list of the design rework still to do. It is the authority for all of that; this file does not repeat it.

**Not decided**

- What the few other users need that he does not (see Users).
- The rest of the 7 October 2026 design review. Several of its points undo things he asked for earlier; each is to be raised with him before it is changed.
- On the trading sides: goals, insights and a greeting on the way in are not built.

## Brand Commitments

- The name is **Flow** (it was Trace until 2 October 2026). The sides are called Finance and Trading.
- The crocodile is the app's mark: `public/crocodile-logo.png`, the icon `build/icon.png`. There is one drawing of it; it is not redrawn.
- Voice: short plain sentences that say what happened and what was or was not changed ("That backup is empty, nothing was changed"). English, with Indonesian money shorthand, and a quick log that also reads Indonesian words ("kemarin", "juta").
- It is for personal use only, so other companies' marks appear where he asked for them (the Bitcoin coin, the IDX globe).

## Evidence on Hand

- **Test data, not real data.** Every side has a generator for made-up entries, and `public/warm-seed.json` is made of them. His own entries are never used in anything that ships, in a still, or in an example.
- **Tests of the sums**: `tools/calc-test.mjs`, `tools/idx-calc-test.mjs`, `tools/fx-calc-test.mjs`, `tools/projection-test.mjs`, `tools/wheel-test.mjs`.
- **Measurement of lag and stills of any screen**: `tools/perf`, which drives a build with no window on screen. Not to be run while he may be trying the app himself.
- **Earlier states of the app**: `savepoints/`, one file per named state.
- **A design review** of the finance side (7 October 2026), kept as a list in `CLAUDE.md`.
- **Absent, never to be made up**: testimonials, user counts, press, pricing, the reference pictures he sent (not kept in the project), company names for tickers the app does not know, a pip size or contract size for a symbol it does not know. The Monument Extended font is not in the project.

## Product Principles

1. **Seconds to log.** The way from "I spent this" or "I closed this" to "it is written down" is as short as it can be made. A feature that adds a step to logging has to earn it.
2. **Speed is part of the product.** A screen that lags is broken, whatever it looks like. Measure before and after, in the real engine.
3. **His entries are sacred.** Anything that could remove or replace them puts them aside instead, says so in plain words, and can be taken back.
4. **Right, or it says no.** A sum the app can't get right is refused with the reason, never guessed. Nothing is invented to fill a gap.
5. **One shape, four times.** Every side reads and works the same way, so a change to one is mirrored on the others, and somebody new who has learned one has learned them all.

## Accessibility & Inclusion

No formal standard has been chosen. What is established:

- Text has to be readable on the dark surfaces: the faint greys used for text were raised to about 5 to 1 after the review, and new text should not go below that.
- The keyboard is a first-class way in: ⌘N, Enter to add, Esc to step back, arrows to step through periods, and in the calculators Tab walks the number boxes only.
- Still open from the review: the dots on the day tiles say nothing to somebody who can't tell their colours apart. (The kept / spent bar under the big figure has been labelled since 12 October 2026.)
