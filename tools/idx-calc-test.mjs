// Tests the stock calculator's maths (IDX/IHSG) exactly as it stands in src/App.jsx (the blocks are read out of the file).
//   node tools/idx-calc-test.mjs
// 1 a position worked out by hand · 2 lots into rupiah, small positions, price steps · 3 inputs that can't be right
// 4 a backtest against an independent "broker" · 5 40,000 random positions · 6 averaging down by hand
// 7 20,000 random averagings · 8 what gets typed into a rupiah box
import fs from "node:fs";
const src = fs.readFileSync(process.argv.slice(2).find((x) => !x.startsWith("--")) || new URL("../src/App.jsx", import.meta.url), "utf8");
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to); if (a < 0 || b < a) throw new Error("block not found: " + from); return src.slice(a, b); };
const code = cut("/* ---------- position calculator: the maths ----------", "/* ---------- position calculator: the pop-up ----------")
  + cut("/* ---------- stock calculator (IDX/IHSG): the maths ----------", "/* ---------- stock calculator (IDX/IHSG): the pop-up ----------");
const { calcStock, calcAverage, idxTick, idrIn, idrOf, IDX_LOT } = new Function(code + "\nreturn { calcStock, calcAverage, idxTick, idrIn, idrOf, IDX_LOT };")();

let fails = 0, checks = 0;
const quiet = process.argv.includes("--quiet");
const report = (ok, line) => { checks++; if (!ok) fails++; if (!ok || !quiet) console.log(`${ok ? "  ok " : "FAIL "} ${line}`); };
const near = (name, got, want, tol) => report(Math.abs(got - want) <= tol, `${name}: ${got} (want ${want} ± ${tol})`);
const is = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); report(ok, `${name}: ${JSON.stringify(got)}${ok ? "" : " (want " + JSON.stringify(want) + ")"}`); };
const tp = (price, close) => ({ price, close, text: String(price) });
const stock = (o) => calcStock({ tps: [], fullTp: 0, feeBuy: 0.15, feeSell: 0.25, ...o, fullText: String(o.fullTp || "") });
const fields = (r) => [...new Set(r.errors.flatMap((e) => e.fields))].sort();

/* A broker, done the plain way: cash goes out for the shares and the buy fee, cash comes back for each sale less the
   sell fee. Nothing is taken from the calculator but the number of lots. */
const broker = (r, inp, fb = 0.0015, fs = 0.0025) => {
  const shares = r.lots * 100;
  const out = shares * inp.entry * (1 + fb);
  const atStop = shares * inp.sl * (1 - fs) - out;
  let held = shares, back = 0;
  const sales = r.targets.map((t) => { const n = t.lots * 100; held -= n; const cash = n * t.price * (1 - fs); back += cash; return cash - n * inp.entry * (1 + fb); });
  return { out, atStop, sales, banked: back - out + held * inp.entry * (1 + fb), held };
};

console.log("1. BBCA, entry 8,650, stop 8,400, 17 lots, fees 0.15% / 0.25%, TPs 9,000 (25%) 9,300 (30%), full 9,800");
let inp = { entry: 8650, sl: 8400, lots: 17, tps: [tp(9000, 25), tp(9300, 30)], fullTp: 9800 };
let r = stock(inp);
is("no errors", r.errors, []);
near("one lot loses at the stop: 100 × (8650 × 1.0015 − 8400 × 0.9975)", r.lossLot, 28397.5, 1e-6);
is("lots, as typed", r.lots, 17);
is("shares", r.shares, 1700);
near("buy value", r.value, 14705000, 1e-6);
near("with the buy fee", r.paid, 14727057.5, 1e-6);
near("loss at the stop: 17 × 28,397.5", r.risk, 482757.5, 1e-6);
near("break-even price: 8650 × 1.0015 / 0.9975", r.breakEven, 8684.6867, 0.0001);
near("stop move %", r.slMove * 100, -2.8902, 0.0001);
is("lots sold: 25% and 30% of 17, rounded to the lot, the full TP the rest", r.targets.map((t) => [t.label, t.lots, t.held]), [["TP1", 4, 13], ["TP2", 5, 8], ["Full TP", 8, 0]]);
near("TP1 profit: 4 lots × 100 × (9000 × 0.9975 − 8662.975)", r.targets[0].pnl, 125810, 1e-6);
near("TP2 profit: 5 lots × 100 × (9300 × 0.9975 − 8662.975)", r.targets[1].pnl, 306887.5, 1e-6);
near("full TP profit: 8 lots × 100 × (9800 × 0.9975 − 8662.975)", r.targets[2].pnl, 890020, 1e-6);
near("total", r.total, 1322717.5, 1e-6);
near("whole position at 9,800", r.targets[2].full, 1891292.5, 1e-6);
is("RR", r.rr.map((x) => [x.label, +x.ratio.toFixed(2)]), [["4/5/8 lots", 2.74], ["All → Full TP", 3.92]]);
is("no notes (every price is on its step)", r.notes, []);

console.log("2. lots into rupiah, small positions, price steps");
r = stock({ entry: 3880, sl: 3800, lots: 2 });
is("2 lots of BBRI at 3,880: 200 shares, Rp776,000", [r.shares, r.value], [200, 776000]);
near("     with the buy fee: 776,000 × 1.0015", r.paid, 777164, 1e-6);
near("     loss at 3,800: 200 × (3880 × 1.0015 − 3800 × 0.9975)", r.risk, 19064, 1e-6);
r = stock({ entry: 8650, sl: 8400, lots: 1, tps: [tp(9000, 25)], fullTp: 9800 });
is("one lot: TP1's 25% rounds to no lot, the full TP sells it", [r.lots, r.targets.map((t) => t.lots)], [1, [0, 1]]);
report(r.notes.some((n) => n.includes("sells no lots")), "     and says so: " + r.notes.join(" | "));
r = stock({ entry: 8660, sl: 8400, lots: 10 });
report(r.errors.length === 0 && r.notes.some((n) => n.includes("Entry 8.660") && n.includes("Rp25")), "entry 8,660 is off the Rp25 step: a note, not an error: " + r.notes.join(" | "));
is("price steps", [50, 199, 200, 498, 500, 1995, 2000, 4990, 5000, 30000].map(idxTick), [1, 1, 2, 2, 5, 5, 10, 10, 25, 25]);
r = stock({ entry: 62, sl: 58, lots: 500, fullTp: 80 });
near("GOTO at 62, stop 58, 500 lots: loss at the stop", r.risk, 500 * 100 * (62 * 1.0015 - 58 * 0.9975), 1e-6);
r = stock({ entry: 1000, sl: 950, lots: 200, feeBuy: 0, feeSell: 0, fullTp: 1200 });
is("no fees: 200 lots lose 200 × 100 × 50 = 1,000,000 at the stop, RR 4", [r.lots, r.risk, r.rr[0].ratio], [200, 1000000, 4]);

console.log("3. inputs that can't be right");
const E = (name, o, want) => { const x = stock(o); report(JSON.stringify(fields(x)) === JSON.stringify(want) && x.lots === undefined, `${name}: ${JSON.stringify(fields(x))} — ${x.errors.map((e) => e.msg).join(" | ")}`); };
E("everything empty", { entry: 0, sl: 0, lots: 0 }, ["entry", "lots", "sl"]);
E("no lots", { entry: 8650, sl: 8400, lots: 0 }, ["lots"]);
E("half a lot", { entry: 8650, sl: 8400, lots: 2.5 }, ["lots"]);
E("stop above the entry", { entry: 8650, sl: 8900, lots: 17 }, ["sl"]);
E("stop on the entry", { entry: 8650, sl: 8650, lots: 17 }, ["sl"]);
E("a target below the entry", { entry: 8650, sl: 8400, lots: 17, tps: [tp(9000, 25), tp(8500, 30)], fullTp: 9800 }, ["tp1"]);
E("full TP on the entry", { entry: 8650, sl: 8400, lots: 17, fullTp: 8650 }, ["full"]);
E("TP1 sells 0%", { entry: 8650, sl: 8400, lots: 17, tps: [tp(9000, 0)], fullTp: 9800 }, ["close0"]);
E("partials sell 60% + 70%", { entry: 8650, sl: 8400, lots: 17, tps: [tp(9000, 60), tp(9300, 70)], fullTp: 9800 }, ["close0", "close1"]);
r = stock({ entry: 8650, sl: 8400, lots: 17, tps: [tp(9300, 25), tp(9000, 30)] });
is("targets out of order, no full TP: nearest first, the furthest sells the rest", r.targets.map((t) => [t.label, t.price, t.lots]), [["TP1", 9000, 4], ["Full TP", 9300, 13]]);

console.log("4. backtest: the calculator against the broker");
const book = [
  ["BBCA swing",              { entry: 8650, sl: 8400, lots: 17, tps: [tp(9000, 25), tp(9300, 30)], fullTp: 9800 }],
  ["BBRI, tight stop",        { entry: 3920, sl: 3860, lots: 33, tps: [tp(4000, 50)], fullTp: 4150 }],
  ["TLKM, one target",        { entry: 3080, sl: 2950, lots: 72, fullTp: 3400 }],
  ["GOTO, 1-rupiah steps",    { entry: 63, sl: 58, lots: 569, tps: [tp(70, 30), tp(76, 30)], fullTp: 90 }],
  ["ADRO, 4 partials",        { entry: 1865, sl: 1790, lots: 91, tps: [tp(1920, 20), tp(1975, 20), tp(2040, 20), tp(2120, 20)], fullTp: 2250 }],
  ["BREN, 25 lots",           { entry: 7850, sl: 7500, lots: 25, tps: [tp(8300, 40)], fullTp: 9000 }],
  ["ANTM, 3 lots",            { entry: 3240, sl: 3100, lots: 3, tps: [tp(3400, 25), tp(3500, 25)], fullTp: 3700 }],
  ["UNVR, deep stop",         { entry: 1640, sl: 1200, lots: 44, fullTp: 2400 }],
  ["BMRI, 1,890 lots",        { entry: 4810, sl: 4700, lots: 1890, tps: [tp(4950, 33.33), tp(5100, 33.33)], fullTp: 5400 }],
];
for (const [name, o] of book) {
  const x = stock(o), b = broker(x, o);
  const okAll = x.errors.length === 0 && Math.abs(b.atStop + x.risk) < 1e-6 && Math.abs(b.banked - x.total) < 1e-6 && b.sales.every((p, i) => Math.abs(p - x.targets[i].pnl) < 1e-6)
    && b.held === 0 && x.lots === o.lots && Math.abs(b.out - x.paid) < 1e-6;
  report(okAll, `${name.padEnd(24)} ${String(x.lots).padStart(5)} lots  buy Rp${Math.round(x.value).toLocaleString("id-ID").padStart(13)}  stop -Rp${Math.round(x.risk).toLocaleString("id-ID").padStart(10)}  targets +Rp${Math.round(x.total).toLocaleString("id-ID")}  RR 1:${x.rr[0].ratio.toFixed(2)}`);
}

console.log("5. 40,000 random positions: the lots as typed, the rupiah they come to, the broker agrees");
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const snap = (p) => { const t = idxTick(p); return Math.max(t, Math.round(p / t) * t); };
let broke = 0, shown = 0;
const breakIt = (why, o, x) => { broke++; if (shown++ < 5) console.log("  broke:", why, JSON.stringify(o), x && JSON.stringify({ lots: x.lots, risk: x.risk, errors: x.errors })); };
for (let i = 0; i < 40000; i++) {
  const entry = snap(10 ** rnd(1.7, 4.6));
  const sl = snap(entry * (1 - rnd(0.01, 0.35)));
  if (sl >= entry) continue;
  const lots = Math.max(1, Math.round(10 ** rnd(0, 4.7)));
  const n = pick([0, 0, 1, 1, 2, 2, 3, 5]);
  const far = rnd(0.03, 1.5);
  const steps = [...new Set(Array.from({ length: n + 1 }, () => Math.random()).sort((p, q) => p - q).map((u) => snap(entry * (1 + far * (0.05 + 0.95 * u)))))].filter((p) => p > entry);
  if (steps.length < n + 1) continue;
  let tps = steps.slice(0, n).map((p) => tp(p, +rnd(1, 100 / Math.max(n, 1)).toFixed(2)));
  if (Math.random() < 0.4) tps = tps.sort(() => Math.random() - 0.5).map((t, k, all) => ({ ...t, close: all[k].close }));
  const o = { entry, sl, lots, tps, fullTp: Math.random() < 0.75 ? steps[n] : 0,
              feeBuy: pick([0, 0.1, 0.15, 0.19]), feeSell: pick([0, 0.2, 0.25, 0.29]) };
  let x;
  try { x = stock(o); } catch (e) { breakIt("threw " + e.message, o); continue; }
  const fb = o.feeBuy / 100, fs = o.feeSell / 100;
  const lossLot = (entry * (1 + fb) - sl * (1 - fs)) * 100, lotCost = entry * (1 + fb) * 100;
  if (x.errors.length) {
    const f = fields(x);
    if (!f.every((k) => k.startsWith("close"))) breakIt("unexpected error", o, x);
    continue;
  }
  if (x.lots !== lots || x.shares !== lots * 100) { breakIt("not the lots typed", o, x); continue; }
  const tol = 1e-9 * lots * lotCost;
  if (Math.abs(x.value - lots * 100 * entry) > tol || Math.abs(x.paid - lots * lotCost) > tol) { breakIt("the rupiah going in is wrong", o, x); continue; }
  if (Math.abs(x.risk - lots * lossLot) > tol) { breakIt("the loss at the stop is wrong", o, x); continue; }
  const b = broker(x, o, fb, fs);
  const btol = Math.max(1e-5, tol);
  if (Math.abs(b.atStop + x.risk) > btol || Math.abs(b.banked - x.total) > btol || b.sales.some((p, k) => Math.abs(p - x.targets[k].pnl) > btol) || (x.targets.length && b.held !== 0)) { breakIt("disagrees with the broker", o, x); continue; }
  if (x.targets.some((t, k) => !Number.isInteger(t.lots) || t.lots < 0 || (k && t.price < x.targets[k - 1].price)) || (x.targets.length && x.targets.reduce((s2, t) => s2 + t.lots, 0) !== x.lots)) { breakIt("targets: lots or order wrong", o, x); continue; }
}
is("random positions that broke a rule", broke, 0);

console.log("6. averaging down, by hand");
const avgd = (o) => calcAverage({ buys: [], feeBuy: 0.15, feeSell: 0.25, ...o });
r = avgd({ avg: 1000, held: 10, buys: [{ price: 800, lots: 10 }, { price: 600, lots: 20 }] });
is("no errors", r.errors, []);
is("1,000 × 10 lots, +10 lots at 800, +20 lots at 600: the average after each step", r.steps.map((x) => x.avg), [1000, 900, 750]);
is("lots and shares", [r.lots, r.shares], [40, 4000]);
near("money in the stock", r.invested, 3000000, 1e-6);
near("change in the average %", r.change * 100, -25, 1e-9);
near("break-even before: 1000 × 1.0015 / 0.9975", r.evenBefore, 1004.01, 0.001);
near("break-even after: 750 × 1.0015 / 0.9975", r.even, 753.0075, 0.0001);
near("rise needed from 600, before %", r.riseBefore * 100, 67.335, 0.001);
near("rise needed from 600, after %", r.rise * 100, 25.501, 0.001);
near("floating PnL at 600: (600 − 750) × 4000", r.floating, -600000, 1e-6);
near("cost of the two buys with the fee: (800,000 + 1,200,000) × 1.0015", r.spent, 2003000, 1e-6);
r = avgd({ avg: 1000, held: 10, target: 900, at: 700 });
is("to reach 900 buying at 700: 10 × 100 / 200 = 5 lots, average exactly 900", [r.aim.lots, r.aim.avg, r.aim.total], [5, 900, 15]);
r = avgd({ avg: 1000, held: 10, target: 880, at: 700 });
is("to reach 880 buying at 700: 6.67 → 7 lots", r.aim.lots, 7); near("     average ends at or under the aim", r.aim.avg, 14900 / 17, 1e-9);
r = avgd({ avg: 1000, held: 10, buys: [{ price: 800, lots: 10 }], target: 850, at: 700 });
is("an aim on top of a buy starts from the new average (900): 20 × 50 / 150 = 6.67 → 7 lots", [r.avg, r.aim.lots], [900, 7]);
r = avgd({ avg: 1234.56, held: 3, buys: [{ price: 1100, lots: 2 }] });
near("an average with decimals: (3 × 1234.56 + 2 × 1100) / 5", r.avg, 1180.736, 1e-9);
r = avgd({ avg: 1000, held: 10, buys: [{ price: 1200, lots: 10 }] });
is("a buy above the average raises it, and is marked", [r.avg, r.steps[1].up], [1100, true]);
const EA = (name, o, want) => { const x = avgd(o); report(JSON.stringify(fields(x)) === JSON.stringify(want) && x.avg === undefined, `${name}: ${JSON.stringify(fields(x))} — ${x.errors.map((e) => e.msg).join(" | ")}`); };
EA("everything empty", { avg: 0, held: 0 }, ["avg", "bp0", "held"]);
EA("no buy and no aim", { avg: 1000, held: 10 }, ["bp0"]);
EA("a buy with lots but no price", { avg: 1000, held: 10, buys: [{ price: 0, lots: 5 }] }, ["bp0"]);
EA("a buy with a price but no lots", { avg: 1000, held: 10, buys: [{ price: 800, lots: 0 }] }, ["bl0"]);
EA("aim above the average", { avg: 1000, held: 10, target: 1100, at: 700 }, ["target"]);
EA("buying at the aim or above it", { avg: 1000, held: 10, target: 900, at: 900 }, ["at"]);
EA("an aim with no price to buy at", { avg: 1000, held: 10, target: 900 }, ["at"]);

console.log("7. 20,000 random averagings against share-by-share bookkeeping");
broke = 0; shown = 0;
for (let i = 0; i < 20000; i++) {
  const avg = +(10 ** rnd(1.8, 4.5)).toFixed(2), held = 1 + Math.floor(rnd(0, 500));
  const buys = Array.from({ length: pick([1, 1, 2, 3, 5]) }, () => ({ price: snap(avg * rnd(0.4, 1.05)), lots: 1 + Math.floor(rnd(0, 300)) }));
  const x = avgd({ avg, held, buys });
  if (x.errors.length) { breakIt("unexpected error", { avg, held, buys }, x); continue; }
  let shares = held * 100, cost = shares * avg;
  for (const b of buys) { shares += b.lots * 100; cost += b.lots * 100 * b.price; }
  if (Math.abs(x.avg - cost / shares) > 1e-9 * avg || x.shares !== shares || Math.abs(x.invested - cost) > 1e-6 * cost) { breakIt("average, shares or cost wrong", { avg, held, buys }, x); continue; }
  const lo = Math.min(avg, ...buys.map((b) => b.price)), hi = Math.max(avg, ...buys.map((b) => b.price));
  if (x.avg < lo - 1e-9 || x.avg > hi + 1e-9) { breakIt("average outside the prices paid", { avg, held, buys }, x); continue; }
  // selling everything at the break-even price gives back exactly what was paid, fees and all
  const back = shares * x.even * (1 - 0.0025) - cost * (1 + 0.0015);
  if (Math.abs(back) > 1e-6 * cost) { breakIt("break-even price does not break even", { avg, held, buys }, x); continue; }
  // an aim: the lots found are enough, and one fewer is not
  const at = snap(x.avg * rnd(0.5, 0.9)), target = +(at + (x.avg - at) * rnd(0.1, 0.9)).toFixed(2);
  if (!(at < target && target < x.avg)) continue;
  const y = avgd({ avg, held, buys, target, at });
  if (y.errors.length) { breakIt("aim refused", { avg, held, buys, target, at }, y); continue; }
  const after = (n) => (cost + n * 100 * at) / (shares + n * 100);
  if (after(y.aim.lots) > target + 1e-9 || (y.aim.lots > 0 && after(y.aim.lots - 1) <= target - 1e-9) || Math.abs(y.aim.avg - after(y.aim.lots)) > 1e-9 * avg) breakIt("aim: not the fewest lots that reach it", { avg, held, buys, target, at }, y);
}
is("random averagings that broke a rule", broke, 0);

console.log("8. what gets typed into a rupiah box");
const T = (raw, want, dp = 0, pasted) => is(`${pasted ? "pasted" : "typed "} ${JSON.stringify(raw)}`, idrIn(raw, dp, pasted), want);
T("1250000", "1.250.000"); T("1.250.000", "1.250.000"); T("8650", "8.650"); T("63", "63"); T("abc", ""); T("0085", "85"); T("0", "0"); T("12a3", "123");
T("1234,567", "1.234,56", 2); T("1234,", "1.234,", 2); T(",5", "0,5", 2); T("1234,5", "1.234", 0);
T("8,650", "8.650", 0, true); T("Rp 14.705.000", "14.705.000", 0, true); T("1,234,567", "1.234.567", 0, true);
is("read back", ["1.250.000", "1.234,56", "", "8.650", "0,5"].map(idrOf), [1250000, 1234.56, 0, 8650, 0.5]);
is("a lot", IDX_LOT, 100);

console.log(fails ? `\n${fails} of ${checks} FAILED` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
