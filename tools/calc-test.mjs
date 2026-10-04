// Tests the position calculator's maths exactly as it stands in src/App.jsx (the block is read out of the file, not copied).
//   node tools/calc-test.mjs
// 1 the reference screenshots · 2 no full TP · 3 a backtest against an independent "exchange" · 4 targets out of order
// 5 long / short, automatic and locked · 6 levels that can't be right · 7 what gets typed or pasted into a box
// 8 extreme but real inputs · 9 60,000 random positions · 10 30,000 random mistakes
import fs from "node:fs";
const src = fs.readFileSync(process.argv.slice(2).find((x) => !x.startsWith("--")) || new URL("../src/App.jsx", import.meta.url), "utf8");
const a = src.indexOf("/* ---------- position calculator: the maths ----------");
const b = src.indexOf("/* ---------- position calculator: the pop-up ----------");
if (a < 0 || b < a) throw new Error("maths block not found");
const { calcPosition, arrangeTargets, numIn, numOf } = new Function(src.slice(a, b) + "\nreturn { calcPosition, arrangeTargets, numIn, numOf };")();

let fails = 0, checks = 0;
const quiet = process.argv.includes("--quiet");
const report = (ok, line) => { checks++; if (!ok) fails++; if (!ok || !quiet) console.log(`${ok ? "  ok " : "FAIL "} ${line}`); };
const near = (name, got, want, tol) => report(Math.abs(got - want) <= tol, `${name}: ${got} (want ${want} ± ${tol})`);
const is = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); report(ok, `${name}: ${JSON.stringify(got)}${ok ? "" : " (want " + JSON.stringify(want) + ")"}`); };
const tp = (price, close) => ({ price, close, text: String(price) });
const calc = (o) => calcPosition({ tps: [], fullTp: 0, ...o, fullText: String(o.fullTp || "") });
const fields = (r) => [...new Set(r.errors.flatMap((e) => e.fields))].sort();

/* An exchange, done the plain way: buy a quantity with margin × leverage, then sell shares of that quantity at each
   target, or all of it at the stop. Nothing here is taken from the calculator but the leverage and the margin. */
const exchange = (r, inp) => {
  const dir = r.long ? 1 : -1;
  const qty = (r.im * r.lev) / inp.entry;
  const atStop = qty * (inp.sl - inp.entry) * dir;
  let open = qty, banked = 0;
  const fills = r.targets.map((t) => {
    const sold = Math.min(open, (qty * t.close) / 100);
    open -= sold;
    const pnl = sold * (t.price - inp.entry) * dir;
    banked += pnl;
    return pnl;
  });
  return { qty, atStop, fills, banked, left: open };
};
const agrees = (r, inp) => {
  const x = exchange(r, inp);
  const tol = 1e-9 * Math.max(1, r.size);
  return Math.abs(x.atStop + r.risk) <= tol && Math.abs(x.banked - r.total) <= tol && x.fills.every((p, i) => Math.abs(p - r.targets[i].pnl) <= tol)
    && Math.abs(x.qty - r.qty) <= 1e-9 * Math.max(1, x.qty) && (r.targets.length === 0 || x.left <= 1e-9 * x.qty);
};

console.log("1. the screenshots: AVAX long, entry 11.088, SL 10.639, risk $3.29, max 75x, TPs 12.000 (25%) 12.442 (30%), full 12.910");
let r = calc({ entry: 11.088, sl: 10.639, risk: 3.29, maxLev: 75, tps: [tp(12.0, 25), tp(12.442, 30)], fullTp: 12.91 });
is("no errors", r.errors, []);
is("long, read automatically", [r.long, r.auto], [true, true]);
near("SL distance %", r.slMove * 100, -4.05, 0.005);
is("leverage", r.lev, 75);
near("IM (shown $1.08)", r.im, 1.083, 1e-9);
near("position size (shown $81.25)", r.size, 81.25, 0.03);
near("quantity (shown ≈ 7.33)", r.qty, 7.33, 0.005);
near("risk at SL (shown -$3.29)", r.risk, 3.29, 0.005);
is("labels", r.targets.map((t) => t.label), ["TP1", "TP2", "Full TP"]);
is("moves %", r.targets.map((t) => +(t.move * 100).toFixed(2)), [8.23, 12.21, 16.43]);
is("full-position PnL (shown 6.68 / 9.92 / 13.35)", r.targets.map((t) => +t.full.toFixed(2)), [6.68, 9.92, 13.35]);
is("close / remaining", r.targets.map((t) => [t.close, t.open]), [[25, 75], [30, 45], [45, 0]]);
is("realised (shown 1.67 / 2.98 / 6.01)", r.targets.map((t) => +t.pnl.toFixed(2)), [1.67, 2.98, 6.01]);
near("total (shown +$10.65)", r.total, 10.65, 0.01);
is("plan title", r.split, "25% / 30% / 45%");
is("RR (shown 1 : 3.24 and 1 : 4.06)", r.rr.map((x) => [x.label, +x.ratio.toFixed(2)]), [["25/30/45 partials", 3.24], ["100% → Full TP", 4.06]]);

console.log("2. no full TP: the last partial target stands in for it and closes what is left");
r = calc({ entry: 64250, sl: 64890.5, risk: 2, maxLev: 100, tps: [tp(0, 25), tp(63000, 40), tp(62000, 35)] });
is("labels", r.targets.map((t) => t.label), ["TP1", "Full TP"]);
is("close / remaining", r.targets.map((t) => [t.close, t.open]), [[40, 60], [60, 0]]);
is("RR labels", r.rr.map((x) => x.label), ["40/60 partials", "100% → Full TP"]);
r = calc({ entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(110, 25)] });
is("one partial alone is the full TP, 100%", r.targets.map((t) => [t.label, t.close]), [["Full TP", 100]]);
is("no plan table, one RR line", [r.partials, r.rr.length], [0, 1]);
r = calc({ entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(110, 25), tp(120, 0)] });
is("the stand-in's own % is not needed (it is 0 here)", [r.errors.length, r.targets.map((t) => t.close)], [0, [25, 75]]);
r = calc({ entry: 100, sl: 95, risk: 5, maxLev: 10 });
is("no targets at all: still leverage, IM and size", [r.errors.length, r.targets.length, r.rr.length, r.lev, r.im], [0, 0, 0, 10, 10]);

console.log("3. backtest: the calculator against the exchange, on real-looking trades");
const book = [
  ["BTC long, tight stop",        { entry: 118432.5, sl: 117850, risk: 25, maxLev: 100, tps: [tp(119200, 30), tp(120000, 30)], fullTp: 121500 }],
  ["BTC short, 4 partials",       { entry: 118432.5, sl: 119310.2, risk: 40, maxLev: 100, tps: [tp(117800, 20), tp(117100, 20), tp(116400, 20), tp(115500, 20)], fullTp: 114000 }],
  ["ETH long",                    { entry: 4321.87, sl: 4250.4, risk: 10, maxLev: 100, tps: [tp(4400, 25), tp(4480, 30)], fullTp: 4600 }],
  ["SOL short, wide stop",        { entry: 182.45, sl: 196.3, risk: 15, maxLev: 75, tps: [tp(170, 50)], fullTp: 150 }],
  ["AVAX long (the screenshots)", { entry: 11.088, sl: 10.639, risk: 3.29, maxLev: 75, tps: [tp(12, 25), tp(12.442, 30)], fullTp: 12.91 }],
  ["DOGE long, 8 partials",       { entry: 0.24135, sl: 0.2298, risk: 5, maxLev: 75, tps: [0.25, 0.26, 0.27, 0.28, 0.29, 0.3, 0.32, 0.34].map((p) => tp(p, 10)), fullTp: 0.4 }],
  ["PEPE long, tiny price",       { entry: 0.00001234, sl: 0.0000118, risk: 4, maxLev: 50, tps: [tp(0.0000131, 33.33), tp(0.0000139, 33.33)], fullTp: 0.000015 }],
  ["1000SATS short, tinier",      { entry: 0.0000002345, sl: 0.0000002502, risk: 1.5, maxLev: 25, tps: [tp(0.00000022, 50)], fullTp: 0.0000002 }],
  ["XRP scalp, 0.15% stop",       { entry: 2.8431, sl: 2.8388, risk: 8, maxLev: 75, fullTp: 2.86 }],
  ["BNB long, no leverage",       { entry: 1042.6, sl: 990, risk: 50, maxLev: 1, tps: [tp(1100, 50)], fullTp: 1200 }],
  ["HYPE short, max 20x",         { entry: 48.215, sl: 49.9, risk: 6, maxLev: 20, tps: [tp(46.5, 40), tp(45, 30)], fullTp: 42 }],
  ["LINK long, $0.50 risk",       { entry: 21.774, sl: 21.1, risk: 0.5, maxLev: 50, tps: [tp(22.4, 60)], fullTp: 23.5 }],
  ["BTC long, $1,000 risk",       { entry: 118432.5, sl: 116000, risk: 1000, maxLev: 125, tps: [tp(121000, 25), tp(124000, 25)], fullTp: 130000 }],
  ["SUI long, 45% stop",          { entry: 3.512, sl: 1.93, risk: 20, maxLev: 50, tps: [tp(5, 50)], fullTp: 7.5 }],
  ["ETH short, stop far above",   { entry: 4321.87, sl: 9000, risk: 30, maxLev: 100, fullTp: 2500 }],
];
for (const [name, inp] of book) {
  const x = calc(inp);
  const okAll = x.errors.length === 0 && agrees(x, inp) && Math.abs(x.risk - inp.risk) / inp.risk <= 0.0006;
  report(okAll, `${name.padEnd(28)} ${String(+x.lev.toFixed(2)).padStart(6)}x  IM $${x.im.toFixed(3).padStart(9)}  size $${x.size.toFixed(2).padStart(11)}  stop -$${x.risk.toFixed(4)} (asked ${inp.risk})  targets +$${x.total.toFixed(2)}  RR 1:${(x.rr[0] ? x.rr[0].ratio : 0).toFixed(2)}`);
}

console.log("4. targets typed out of order are taken in the order the price reaches them");
r = calc({ entry: 11.088, sl: 10.639, risk: 3.29, maxLev: 75, tps: [tp(12.442, 25), tp(12.0, 30)], fullTp: 12.91 });
is("long: prices ascending, % stay with their place", r.targets.map((t) => [t.label, t.price, t.close]), [["TP1", 12, 25], ["TP2", 12.442, 30], ["Full TP", 12.91, 45]]);
r = calc({ entry: 11.088, sl: 10.639, risk: 3.29, maxLev: 75, tps: [tp(12.91, 25), tp(12.442, 30)], fullTp: 12.0 });
is("a partial beyond the full TP: the furthest becomes the full TP", r.targets.map((t) => [t.label, t.price, t.close]), [["TP1", 12, 25], ["TP2", 12.442, 30], ["Full TP", 12.91, 45]]);
r = calc({ entry: 64250, sl: 64890.5, risk: 2, maxLev: 100, tps: [tp(62000, 40), tp(0, 10), tp(63000, 35)], fullTp: 61000 });
is("short: prices descending, the blank box skipped", r.targets.map((t) => [t.label, t.price, t.close]), [["TP1", 63000, 40], ["TP2", 62000, 35], ["Full TP", 61000, 25]]);
const F = (o) => ({ coin: "X", side: "", entry: "", sl: "", risk: "1", maxLev: "10", tps: [], full: "", ...o });
is("the boxes after Enter, long", (({ tps, full }) => [tps, full])(arrangeTargets(F({ entry: "11.088", tps: [{ price: "12.442", close: "25" }, { price: "12.000", close: "30" }], full: "12.910" }))),
  [[{ price: "12.000", close: "25" }, { price: "12.442", close: "30" }], "12.910"]);
is("the boxes after Enter, full TP nearer than a partial", (({ tps, full }) => [tps.map((t) => t.price), full])(arrangeTargets(F({ entry: "100", tps: [{ price: "130", close: "25" }, { price: "110", close: "30" }], full: "120" }))),
  [["110", "120"], "130"]);
is("the boxes after Enter, short with a blank box and no full TP", (({ tps, full }) => [tps.map((t) => t.price), full])(arrangeTargets(F({ entry: "64250", tps: [{ price: "", close: "25" }, { price: "62000", close: "40" }, { price: "63000", close: "35" }] }))),
  [["", "63000", "62000"], ""]);
is("already in order: nothing moves", (({ tps, full }) => [tps.map((t) => t.price), full])(arrangeTargets(F({ entry: "100", tps: [{ price: "110", close: "25" }, { price: "120", close: "30" }], full: "130" }))), [["110", "120"], "130"]);

console.log("5. long or short: read from the levels, or locked by hand");
is("no targets: the stop's side decides (below = long)", calc({ entry: 100, sl: 95, risk: 1, maxLev: 10 }).long, true);
is("no targets: stop above = short", calc({ entry: 100, sl: 105, risk: 1, maxLev: 10 }).long, false);
r = calc({ entry: 100, sl: 105, risk: 1, maxLev: 10, fullTp: 120 });
is("target above, stop above: read as a long, the stop is the error", [r.long, fields(r)], [true, ["sl"]]);
r = calc({ entry: 100, sl: 95, risk: 1, maxLev: 10, tps: [tp(110, 25), tp(90, 30)], fullTp: 130 });
is("one target of three on the wrong side: that one is the error", [r.long, fields(r)], [true, ["tp1"]]);
r = calc({ entry: 100, sl: 105, risk: 1, maxLev: 10, fullTp: 120, side: "short" });
is("locked short with a target above: the target is the error", [r.long, r.auto, fields(r)], [false, false, ["full"]]);
r = calc({ entry: 100, sl: 95, risk: 1, maxLev: 10, fullTp: 120, side: "short" });
is("locked short on a long's levels: stop and target both errors", fields(r), ["full", "sl"]);
r = calc({ entry: 100, sl: 95, risk: 1, maxLev: 10, fullTp: 120, side: "long" });
is("locked long on a long's levels: fine", [r.errors.length, r.long, r.auto], [0, true, false]);

console.log("6. levels that can't be right come back as errors that name the box, never as numbers");
const E = (name, inp, want) => { const x = calc(inp); report(JSON.stringify(fields(x)) === JSON.stringify(want) && x.lev === undefined, `${name}: ${JSON.stringify(fields(x))} — ${x.errors.map((e) => e.msg).join(" | ")}`); };
E("everything empty", { entry: 0, sl: 0, risk: 0, maxLev: 0 }, ["entry", "maxLev", "risk", "sl"]);
E("no stop", { entry: 100, sl: 0, risk: 5, maxLev: 10 }, ["sl"]);
E("stop on the entry", { entry: 100, sl: 100, risk: 5, maxLev: 10 }, ["sl"]);
E("no risk", { entry: 100, sl: 95, risk: 0, maxLev: 10 }, ["risk"]);
E("no max leverage", { entry: 100, sl: 95, risk: 5, maxLev: 0 }, ["maxLev"]);
E("max leverage under 1x", { entry: 100, sl: 95, risk: 5, maxLev: 0.5 }, ["maxLev"]);
E("max leverage 7500x (meant 75)", { entry: 100, sl: 95, risk: 5, maxLev: 7500 }, ["maxLev"]);
E("stop above the entry, targets above", { entry: 11.088, sl: 11.639, risk: 3.29, maxLev: 75, tps: [tp(12, 25), tp(12.442, 30)], fullTp: 12.91 }, ["sl"]);
E("stop below the entry, targets below", { entry: 64250, sl: 63890, risk: 2, maxLev: 100, tps: [tp(63000, 40)], fullTp: 62000 }, ["sl"]);
E("TP2 a digit short (1.2442 for 12.442)", { entry: 11.088, sl: 10.639, risk: 3.29, maxLev: 75, tps: [tp(12, 25), tp(1.2442, 30)], fullTp: 12.91 }, ["tp1"]);
E("full TP on the entry", { entry: 100, sl: 95, risk: 5, maxLev: 10, fullTp: 100 }, ["full"]);
E("TP1 on the entry", { entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(100, 25)], fullTp: 120 }, ["tp0"]);
E("TP1 closes 0%", { entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(110, 0)], fullTp: 120 }, ["close0"]);
E("TP2 closes 250%", { entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(110, 25), tp(115, 250)], fullTp: 120 }, ["close1"]);
E("partials close 60% + 70%", { entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(110, 60), tp(115, 70)], fullTp: 120 }, ["close0", "close1"]);
E("a risk of nothing ($0.0000001 on a 50% stop)", { entry: 100, sl: 50, risk: 0.0000001, maxLev: 10 }, ["risk"]);
r = calc({ entry: 100, sl: 95, risk: 5, maxLev: 10, tps: [tp(110, 50), tp(115, 50)], fullTp: 120 });
is("partials close exactly 100%: allowed, the full TP closes 0%", [r.errors.length, r.targets.map((t) => t.close)], [0, [50, 50, 0]]);

console.log("7. what gets typed or pasted into a number box");
const T = (raw, want, pasted, dp = 12) => is(`${pasted ? "pasted" : "typed "} ${JSON.stringify(raw)}`, numIn(raw, dp, pasted), want);
T("11.088", "11.088"); T("11,088", "11.088"); T("1.2.3", "1.23"); T("abc12.5x", "12.5"); T("-5", "5"); T(" 64250 ", "64250"); T(".5", ".5");
T("0.000000001234", "0.000000001234"); T("0.1234567890123456", "0.123456789012"); T("12.345", "12.34", false, 2); T("", ""); T("..", "."); T("1e5", "15");
T("$64,250.50", "64250.50", true); T("1,234,567", "1234567", true); T("1.234,56", "1234.56", true); T("64,250", "64250", true); T("11,08", "11.08", true);
T("0,5", "0.5", true); T("12 345.6 USDT", "12345.6", true); T("118,432.5", "118432.5", true); T("0.00001234", "0.00001234", true);
is("a lone dot counts as empty", numOf("."), 0);
is("a trailing dot is fine", numOf("11."), 11);

console.log("8. extreme but real inputs keep their precision");
r = calc({ entry: 0.0000002345, sl: 0.0000002298, risk: 0.5, maxLev: 25, fullTp: 0.00000025 });
near("1000SATS: stop loses the risk", r.risk, 0.5, 0.5 * 0.0006); report(Number.isFinite(r.qty) && r.qty > 1e6, `     quantity is a plain big number: ${Math.round(r.qty)}`);
r = calc({ entry: 118432.5, sl: 118420.7, risk: 100, maxLev: 125, fullTp: 118500 });
is("BTC, a 0.01% stop: capped at 125x", r.lev, 125); near("     IM carries it (100 × 118432.5 / 11.8 / 125)", r.im, 8029.322, 1e-9); near("     stop loses the risk", r.risk, 100, 100 * 0.0006);
r = calc({ entry: 118432.5, sl: 1, risk: 100000, maxLev: 1000, fullTp: 1000000 });
is("BTC, stop at $1, $100,000 risk, 1000x allowed: 1000x and a $100 margin", [r.lev, r.im], [1000, 100.001]); near("     stop loses the risk", r.risk, 100000, 100000 * 0.0006);
r = calc({ entry: 100, sl: 99.999, risk: 50, maxLev: 1000, fullTp: 100.01 });
is("a stop 0.001% away with 1000x", r.lev, 1000); near("     stop loses the risk", r.risk, 50, 50 * 0.0006);
r = calc({ entry: 2.5, sl: 2.45, risk: 0.01, maxLev: 100, fullTp: 3 });
is("a one-cent risk: 1x and a half-dollar margin", [r.lev, r.im], [1, 0.5]); near("     stop loses the risk", r.risk, 0.01, 1e-9);
r = calc({ entry: 100, sl: 95, risk: 5, maxLev: 12.35, tps: [tp(101, 0.01), tp(102, 99.98)], fullTp: 103 });
is("closes of 0.01% / 99.98% / the rest", r.targets.map((t) => t.close), [0.01, 99.98, 0.01]);

console.log("9. 60,000 random positions: every one must agree with the exchange and keep every rule");
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sig = (v, n = 7) => +v.toPrecision(n);
let broke = 0, worst = 0, worstCase = null, shown = 0;
const breakIt = (why, inp, x) => { broke++; if (shown++ < 5) console.log("  broke:", why, JSON.stringify(inp), x && JSON.stringify({ lev: x.lev, im: x.im, errors: x.errors })); };
const randomTrade = () => {
  const entry = sig(10 ** rnd(-8, 5.3));
  const long = Math.random() < 0.5;
  const dist = 10 ** rnd(-4, Math.log10(long ? 0.95 : 3));                       // the stop 0.01% to 95% away (a short's can be further)
  const sl = sig(entry * (long ? 1 - dist : 1 + dist));
  const risk = +(10 ** rnd(-2, 4)).toFixed(2);
  const maxLev = pick([1, 2, 3, 5, 10, 12.5, 20, 25, 33.33, 50, 75, 100, 125, 200, 500, 1000]);
  const n = pick([0, 0, 1, 1, 2, 2, 2, 3, 4, 8]);
  const far = long ? rnd(0.02, 4) : rnd(0.02, 0.9);                              // the furthest target, as a move from the entry
  const steps = Array.from({ length: n + 1 }, () => Math.random()).sort((p, q) => p - q).map((u) => sig(entry * (long ? 1 + far * (0.05 + 0.95 * u) : 1 - far * (0.05 + 0.95 * u))));
  const share = +(100 / (n + 1)).toFixed(2);
  let tps = steps.slice(0, n).map((p) => tp(p, Math.random() < 0.3 ? share : +rnd(0.5, 100 / Math.max(n, 1)).toFixed(2)));
  if (Math.random() < 0.5) tps = tps.sort(() => Math.random() - 0.5).map((t, i, all) => ({ ...t, close: all[i].close }));   // typed in any order
  if (Math.random() < 0.3) tps.splice(Math.floor(Math.random() * (tps.length + 1)), 0, tp(0, 25));                               // a blank box somewhere
  const fullTp = Math.random() < 0.75 ? steps[n] : 0;
  const side = pick(["", "", long ? "long" : "short"]);
  return { entry, sl, risk, maxLev, tps, fullTp, side, long };
};
for (let i = 0; i < 60000; i++) {
  const inp = randomTrade();
  if (inp.sl === inp.entry || inp.tps.some((t) => t.price === inp.entry) || inp.fullTp === inp.entry) continue;
  let x;
  try { x = calc(inp); } catch (e) { breakIt("threw " + e.message, inp); continue; }
  if (x.errors.length) {
    // the only honest errors here: partial closes that add up to more than 100%, or a risk too small to be a position
    const f = fields(x);
    if (!f.every((k) => k.startsWith("close") || k === "risk")) breakIt("unexpected error", inp, x);
    continue;
  }
  const nums = [x.lev, x.im, x.size, x.qty, x.risk, x.total, x.slMove, ...x.targets.flatMap((t) => [t.move, t.full, t.pnl, t.close, t.open]), ...x.rr.map((q) => q.ratio)];
  if (!nums.every(Number.isFinite)) { breakIt("a number that is not a number", inp, x); continue; }
  if (x.long !== inp.long) { breakIt("wrong side", inp, x); continue; }
  if (!(x.lev >= 1 && x.lev <= inp.maxLev) || Math.abs(x.lev * 100 - Math.round(x.lev * 100)) > 1e-6) { breakIt("leverage out of bounds or not 2 decimals", inp, x); continue; }
  if (Math.abs(x.im * 1000 - Math.round(x.im * 1000)) > 1e-5 * Math.max(1, x.im)) { breakIt("IM not 3 decimals", inp, x); continue; }
  if (x.lev !== 1 && x.lev !== inp.maxLev && Math.abs(x.im - 1) > 0.005 / x.lev + 0.0006) { breakIt("IM is not $1 where it could be", inp, x); continue; }
  if (!agrees(x, inp)) { breakIt("disagrees with the exchange", inp, x); continue; }
  const order = x.targets.map((t) => Math.abs(t.price - inp.entry));
  if (order.some((d, k) => k && d < order[k - 1])) { breakIt("targets not in the order the price reaches them", inp, x); continue; }
  if (x.targets.length && (x.targets[x.targets.length - 1].label !== "Full TP" || Math.abs(x.targets.reduce((s, t) => s + t.close, 0) - 100) > 1e-6
      || x.targets.some((t, k) => k < x.targets.length - 1 && t.label !== `TP${k + 1}`) || x.targets.some((t) => t.move <= 0 || t.close < 0))) { breakIt("targets mislabelled or not closing 100%", inp, x); continue; }
  // the stop's real loss against the risk typed: only the rounding of the IM to $0.001 can move it
  const drift = Math.abs(x.risk - inp.risk);
  if (drift > 0.0005 * x.lev * Math.abs(x.slMove) + 1e-9 + 1e-12 * inp.risk) { breakIt("stop loss further from the risk than rounding allows", inp, x); continue; }
  if (x.im >= 0.5 && drift / inp.risk > worst) { worst = drift / inp.risk; worstCase = { entry: inp.entry, sl: inp.sl, risk: inp.risk, lev: x.lev, im: x.im, loss: +x.risk.toFixed(5) }; }
}
is("random positions that broke a rule", broke, 0);
console.log(`     furthest the stop's real loss is from the risk typed (margin $0.50 and up): ${(worst * 100).toFixed(3)}%  ${JSON.stringify(worstCase)}`);
report(worst <= 0.0011, "     that stays within 0.11% (0.05% once the margin is $1 or more)");

console.log("10. 30,000 random mistakes: each must be refused, and the box at fault named");
let missed = 0; shown = 0;
const miss = (why, inp, x) => { missed++; if (shown++ < 5) console.log("  missed:", why, JSON.stringify(inp), JSON.stringify(x.errors)); };
for (let i = 0; i < 30000; i++) {
  const g = randomTrade();
  if (g.sl === g.entry || g.tps.some((t) => t.price === g.entry) || g.fullTp === g.entry) continue;
  const base = calc(g);
  if (base.errors.length) continue;
  const inp = { ...g, tps: g.tps.map((t) => ({ ...t })) };
  const live = inp.tps.map((t, k) => k).filter((k) => inp.tps[k].price > 0);
  const kind = pick(["sl-side", "sl-side", "tp-side", "tp-entry", "close-0", "close-sum", "no-entry", "no-risk", "lev-0", "lev-low", "lev-high", "sl-entry", "locked-wrong"]);
  let want;
  if (kind === "sl-side") { if (!live.length && !inp.fullTp && !inp.side) continue; inp.sl = sig(inp.entry * (g.long ? 1.03 : 0.97)); want = "sl"; if (!inp.side && live.length + (inp.fullTp ? 1 : 0) < 1) continue; }
  else if (kind === "tp-side") { if (live.length + (inp.fullTp ? 1 : 0) < 3 && !inp.side) continue; if (!live.length) continue; const k = pick(live); inp.tps[k].price = sig(inp.entry * (g.long ? 0.9 : 1.1)); inp.tps[k].text = String(inp.tps[k].price); want = `tp${k}`; }
  else if (kind === "tp-entry") { if (!inp.fullTp) continue; inp.fullTp = inp.entry; want = "full"; }
  else if (kind === "close-0") { const usable = inp.fullTp ? live : live.slice(0, -1); if (!usable.length) continue; const k = pick(usable); inp.tps[k].close = 0; want = `close${k}`; }
  else if (kind === "close-sum") { const usable = inp.fullTp ? live : live.slice(0, -1); if (usable.length < 2) continue; usable.forEach((k) => { inp.tps[k].close = 60; }); want = `close${usable[0]}`; }
  else if (kind === "no-entry") { inp.entry = 0; want = "entry"; }
  else if (kind === "no-risk") { inp.risk = 0; want = "risk"; }
  else if (kind === "lev-0") { inp.maxLev = 0; want = "maxLev"; }
  else if (kind === "lev-low") { inp.maxLev = 0.75; want = "maxLev"; }
  else if (kind === "lev-high") { inp.maxLev = 7500; want = "maxLev"; }
  else if (kind === "sl-entry") { inp.sl = inp.entry; want = "sl"; }
  else { inp.side = g.long ? "short" : "long"; want = "sl"; }
  let x;
  try { x = calc(inp); } catch (e) { missed++; console.log("  threw:", kind, e.message); continue; }
  if (!x.errors.length || x.lev !== undefined) miss(`${kind}: gave numbers`, inp, x);
  else if (!fields(x).includes(want)) miss(`${kind}: did not name ${want}`, inp, x);
  else if (x.errors.some((e) => !e.msg || !e.fields.length)) miss(`${kind}: an error without words or a box`, inp, x);
}
is("mistakes let through, or blamed on the wrong box", missed, 0);

console.log(fails ? `\n${fails} of ${checks} FAILED` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
