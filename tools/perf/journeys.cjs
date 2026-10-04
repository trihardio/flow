/* Lag hunting (see run.cjs): the journeys. Every step is done twice where it can be ("-1", then "-2"), because the
   lag Rassam notices is the first time a thing is opened after a launch; the second time is the yardstick. */

// the month box of the current month, among the month boxes on screen
const monthBox = (c) => c.js(`(() => { const on = [...document.querySelectorAll('.ycell')].map((e, i) => [i, e.getBoundingClientRect()]).filter(([, r]) => r.top > 0 && r.bottom < innerHeight);
  return on.length ? on[Math.min(${new Date().getMonth()}, on.length - 1)][0] : -1; })()`);
const SPLASH_MS = 4200;      // the opening screen and its outro, with room to spare

// just the opening screen
const launch = async (c) => { await c.sleep(SPLASH_MS); };

// wallet ⇄ coin, the wallets, a card, into the app, a month, its cards, the chart, a day, the wrapped
const finance = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.step("coin-focus-1", () => c.press(".coin-unit"), 1000);
  await c.step("wallet-focus-1", () => c.press(".wallet-unit.active"), 1000);
  await c.step("coin-focus-2", () => c.press(".coin-unit"), 1000);
  await c.step("wallet-focus-2", () => c.press(".wallet-unit.active"), 1000);
  await c.step("wallets-1", () => c.press(".wallet-unit.active"), 1400);
  await c.step("wallets-back", async () => c.key("Escape"), 1200);
  await c.step("wallets-2", () => c.press(".wallet-unit.active"), 1400);
  await c.step("card-1", () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1400);     // the strip of the card that shows above the wallet
  await c.step("enter-1", () => c.press(".big-card"), 6500);
  await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("year-back", () => c.press(".month-btn"), 1800);
  await c.step("month-2", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("scroll-1", () => c.scroll(1400, 900), 1800);
  await c.step("scroll-1b", () => c.scroll(1600, 900), 1800);
  await c.step("scroll-up", () => c.scroll(-3200, 700), 1200);
  await c.step("scroll-2", () => c.scroll(3000, 1400), 1500);
  await c.step("scroll-up-2", () => c.scroll(-3200, 700), 1200);
  await c.step("chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close", async () => c.key("Escape"), 900);
  await c.step("chart-2", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close-2", async () => c.key("Escape"), 900);
  await c.step("day-1", () => c.press(".cell", 9), 1500);
  await c.step("day-2", () => c.press(".cell", 10), 1500);
  await c.step("wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close", async () => c.key("Escape"), 900);
  await c.step("wrapped-2", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close-2", async () => c.key("Escape"), 900);
  await c.step("end", async () => {}, 300);
};

// the finance month's cards: each comes into view while scrolling down, then Money flow is folded and opened with its arrow
const cards = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.step("month", async () => c.press(".ycell", await monthBox(c)), 3200);
  for (const n of [1, 2, 3, 4, 5, 6]) await c.step(`scroll-${n}`, () => c.scroll(450, 500), 1500);
  await c.js(`document.querySelectorAll('.flow-card')[1].scrollIntoView({ block: 'start' })`); await c.sleep(900);
  for (const n of [1, 2]) {
    await c.step(`flow-close-${n}`, () => c.press(".flow-card .chev", 1), 1200);
    await c.step(`flow-open-${n}`, () => c.press(".flow-card .chev", 1), 2200);
  }
  await c.step("end", async () => {}, 300);
};

// the trading selection, into a tracker (the coin, or the globe for stocks), a month, its cards, chart, currency, calculator, wrapped
const trading = (stocks) => async (c) => {
  const unit = stocks ? ".idx-unit" : ".coin-unit";
  await c.sleep(SPLASH_MS);
  await c.step("coin-focus-1", () => c.press(".coin-unit"), 1000);
  await c.step("markets-1", () => c.press(".coin-unit"), 1600);
  await c.step("markets-back", async () => c.key("Escape"), 1200);
  await c.step("markets-2", () => c.press(".coin-unit"), 1600);
  await c.step("globe-focus-1", () => c.press(".idx-unit"), 1100);
  await c.step("crypto-focus-1", () => c.press(".coin-unit"), 1100);
  await c.step("globe-focus-2", () => c.press(".idx-unit"), 1100);
  if (!stocks) await c.step("crypto-focus-2", () => c.press(".coin-unit"), 1100);
  await c.step("enter-1", () => c.press(unit), stocks ? 6000 : 4500);
  await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("year-back", () => c.press(".month-btn"), 1800);
  await c.step("month-2", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("scroll-1", () => c.scroll(1200, 900), 1800);
  await c.step("scroll-1b", () => c.scroll(1200, 900), 1800);
  await c.step("scroll-1c", () => c.scroll(1600, 900), 1800);
  await c.step("scroll-up", () => c.scroll(-4200, 700), 1200);
  await c.step("scroll-2", () => c.scroll(4000, 1600), 1500);
  await c.step("scroll-up-2", () => c.scroll(-4200, 700), 1200);
  await c.step("chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close", async () => c.key("Escape"), 900);
  await c.step("chart-2", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close-2", async () => c.key("Escape"), 900);
  if (!stocks) for (const n of [1, 2, 3, 4]) await c.step(`currency-${n}`, () => c.press(".cur-btn"), 1300);
  await c.step("day-1", () => c.press(".cell", 9), 1500);
  await c.step("day-2", () => c.press(".cell", 10), 1500);
  await c.step("calc-1", () => c.press(".calc-fab"), 1500);
  await c.step("calc-close", async () => c.key("Escape"), 900);
  await c.step("calc-2", () => c.press(".calc-fab"), 1500);
  await c.step("calc-close-2", async () => c.key("Escape"), 900);
  await c.step("wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close", async () => c.key("Escape"), 900);
  await c.step("wrapped-2", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close-2", async () => c.key("Escape"), 900);
  await c.step("end", async () => {}, 300);
};

module.exports = { launch, finance, cards, trade: trading(false), stocks: trading(true) };
