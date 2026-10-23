<!-- made by a script from src/App.jsx (the whole app is that one file): line numbers are as of the day it was made -->
# Screens (no URL routing: one page, the screen follows state)

| Screen | State | Where in src/App.jsx |
|---|---|---|
| Opening screen, login, select-account panel | `openPanel`, `gate` | AccountGate, opening markup |
| Selections panel / wallets panel / trading panel (3D objects on a stage) | `choice`, `pickFocus`, `marketFocus` | the `launch-veil` block in PnlCalendar's render |
| Finance: year | `view === "year"` | PnlCalendar render |
| Finance: month (hero, calendar, day panel, cards) | `view === "month"` | cells from line 12791; hero from 17325; calendar 17393; cards from 17643 |
| Trading (crypto / stocks / forex): year and month | `view === "trade"`, `market` | TradeTracker, lines 7703–18023 |

The finance month is the screen used most: a hero card (the month's PnL against the daily limit, a kept / spent bar, four tiles), a 7-column calendar of day tiles, the open day's panel, then cards (Weekly expenses, Money flow, Goals).
