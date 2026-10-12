// Tests the forex calculator's maths exactly as it stands in src/App.jsx (the blocks are read out of the file, not copied).
//   node tools/fx-calc-test.mjs
// 1 what a symbol is · 2 positions worked out by hand · 3 a backtest against an independent "broker" · 4 what is refused
// 5 30,000 random positions: never over the risk, never a hundredth of a lot too small
import fs from "node:fs";
const src = fs.readFileSync(process.argv.slice(2).find((x) => !x.startsWith("--")) || new URL("../src/App.jsx", import.meta.url), "utf8");
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < a) throw new Error(`block not found: ${from}`); return src.slice(a, b); };
const code = cut("const FX_CCY = ", "// how many pips a trade made") + cut("const NF2 = ", "\n") + "\n"
  + cut("/* ---------- position calculator: the maths ----------", "/* ---------- position calculator: the pop-up ----------");
const { calcForex, fxSpec } = new Function(code + "\nreturn { calcForex, fxSpec };")();

let fails = 0, checks = 0;
const quiet = process.argv.includes("--quiet");
const report = (ok, line) => { checks++; if (!ok) fails++; if (!ok || !quiet) console.log(`${ok ? "  ok " : "FAIL "} ${line}`); };
const near = (name, got, want, tol = 0.005) => report(Math.abs(got - want) <= tol, `${name}: ${got} (want ${want} ± ${tol})`);
const is = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); report(ok, `${name}: ${JSON.stringify(got)}${ok ? "" : " (want " + JSON.stringify(want) + ")"}`); };
const tp = (price, close) => ({ price, close, text: String(price) });
const calc = (o) => calcForex({ tps: [], fullTp: 0, rate: 0, contract: 0, lev: 0, ...o, fullText: String(o.fullTp || "") });
const fields = (r) => [...new Set(r.errors.flatMap((e) => e.fields))].sort();

console.log("1. what a symbol is");
const spec = (s) => { const x = fxSpec(s); return [x.known, x.lot, x.kind, x.via, x.pip]; };
is("EURUSD", spec("EURUSD"), [true, 100000, "usd", "", 0.0001]);
is("USDJPY", spec("USDJPY"), [true, 100000, "inv", "", 0.01]);
is("EURJPY", spec("EURJPY"), [true, 100000, "cross", "USDJPY", 0.01]);
is("EURGBP", spec("EURGBP"), [true, 100000, "cross", "GBPUSD", 0.0001]);
is("AUDNZD", spec("AUDNZD"), [true, 100000, "cross", "NZDUSD", 0.0001]);
is("GBPCHF", spec("GBPCHF"), [true, 100000, "cross", "USDCHF", 0.0001]);
is("EURUSDM (a broker's suffix)", spec("EURUSDM"), [true, 100000, "usd", "", 0.0001]);
is("XAUUSD", spec("XAUUSD"), [true, 100, "usd", "", 0]);
is("XAGUSD", spec("XAGUSD"), [true, 5000, "usd", "", 0]);
is("XAUEUR", spec("XAUEUR"), [true, 100, "cross", "EURUSD", 0]);
is("US30", spec("US30"), [false, 0, "usd", "", 0]);
is("BTCUSD", spec("BTCUSD"), [false, 0, "usd", "", 0]);
is("nothing typed", spec(""), [false, 0, "usd", "", 0]);

console.log("2. positions worked out by hand");
{ // EURUSD buy, 30 pips of stop: a lot loses 100,000 × 0.0030 = $300, so $50 buys 0.16 lot, which loses $48
  const r = calc({ pair: "EURUSD", entry: 1.085, sl: 1.082, risk: 50, lev: 100, fullTp: 1.094 });
  is("EURUSD errors", r.errors, []); is("EURUSD side", r.long, true);
  near("EURUSD lots", r.lots, 0.16, 1e-9); near("EURUSD loss at the stop", r.risk, 48);
  near("EURUSD per pip", r.pipVal, 1.6); near("EURUSD position size", r.size, 17360); near("EURUSD margin at 1:100", r.margin, 173.6);
  near("EURUSD full TP (90 pips × $1.60)", r.targets[0].full, 144); near("EURUSD pips to the TP", r.targets[0].pips, 90, 1e-6);
  near("EURUSD pips to the stop", r.slPips, -30, 1e-6); near("EURUSD RR", r.rr[0].ratio, 3, 1e-9);
}
{ // USDJPY sell, stop 0.5 above: a lot loses 100,000 × 0.5 = ¥50,000, at 150.50 that is $332.23; $50 → 0.15 lot → $49.83
  const r = calc({ pair: "USDJPY", entry: 150, sl: 150.5, risk: 50, lev: 500, fullTp: 148.5 });
  is("USDJPY side", r.long, false); near("USDJPY lots", r.lots, 0.15, 1e-9); near("USDJPY loss at the stop", r.risk, 49.83);
  near("USDJPY position size (15,000 dollars)", r.size, 15000); near("USDJPY margin at 1:500", r.margin, 30);
  near("USDJPY full TP (15,000 × 1.5 ÷ 148.5)", r.targets[0].full, 151.52);
}
{ // EURJPY buy, stop 0.6 below, dollar at 150 yen: a lot loses ¥60,000 = $400; $50 → 0.12 lot → $48
  const r = calc({ pair: "EURJPY", entry: 162, sl: 161.4, risk: 50, rate: 150, fullTp: 163.8 });
  near("EURJPY lots", r.lots, 0.12, 1e-9); near("EURJPY loss at the stop", r.risk, 48); near("EURJPY full TP", r.targets[0].full, 144);
  near("EURJPY position size (12,000 euros in yen, in dollars)", r.size, (12000 * 162) / 150); is("EURJPY no leverage, no margin", r.margin, null);
}
{ // EURGBP sell, stop 20 pips above, pound at 1.27: a lot loses £200 = $254; $100 → 0.39 lot → $99.06
  const r = calc({ pair: "EURGBP", entry: 0.85, sl: 0.852, risk: 100, rate: 1.27, fullTp: 0.844 });
  near("EURGBP lots", r.lots, 0.39, 1e-9); near("EURGBP loss at the stop", r.risk, 99.06); near("EURGBP full TP (60 pips)", r.targets[0].full, 297.18);
}
{ // gold buy, $10 of stop: a lot is 100 ounces and loses $1,000; $50 → 0.05 lot → $50
  const r = calc({ pair: "XAUUSD", entry: 2650, sl: 2640, risk: 50, lev: 100, fullTp: 2680 });
  near("XAUUSD lots", r.lots, 0.05, 1e-9); near("XAUUSD loss at the stop", r.risk, 50); near("XAUUSD full TP", r.targets[0].full, 150);
  near("XAUUSD margin", r.margin, 132.5); is("XAUUSD has no pip", [r.pipVal, r.slPips], [null, null]);
}
{ // an index with a lot of 1: 40 points of stop lose $40 a lot; $100 → 2.5 lots
  const r = calc({ pair: "US30", entry: 42000, sl: 41960, risk: 100, contract: 1, fullTp: 42120 });
  near("US30 lots", r.lots, 2.5, 1e-9); near("US30 loss at the stop", r.risk, 100); near("US30 full TP", r.targets[0].full, 300);
}
{ // partial targets close whole hundredths of a lot: 0.16 lot, 25% then 30% → 0.04, 0.04 (0.048 cut down), and 0.08 left for the full TP
  const r = calc({ pair: "EURUSD", entry: 1.085, sl: 1.082, risk: 50, tps: [tp(1.088, 25), tp(1.091, 30)], fullTp: 1.094 });
  is("partial volumes", r.targets.map((t) => t.vol), [0.04, 0.04, 0.08]);
  near("TP1 (0.04 lot × 30 pips)", r.targets[0].pnl, 12); near("TP2 (0.04 × 60)", r.targets[1].pnl, 24); near("full TP (0.08 × 90)", r.targets[2].pnl, 72);
  near("total", r.total, 108); is("what is left open", r.targets.map((t) => +t.open.toFixed(4)), [75, 50, 0]);
}
{ // a partial too small to close on its own is left out, and said so
  const r = calc({ pair: "EURUSD", entry: 1.085, sl: 1.055, risk: 60, tps: [tp(1.09, 25), tp(1.1, 30)], fullTp: 1.12 });
  is("0.02 lot: the partials close nothing", r.targets.map((t) => t.vol), [0, 0, 0.02]); is("two notes", r.notes.length, 2);
}

console.log("3. a backtest against an independent broker");
/* A broker, done the plain way: profit = volume × contract × (close − open) in the quote currency, turned into
   dollars. Nothing here is taken from the calculator but the volumes it gives. */
const broker = (pair, vol, open, close, dir, rate, contract) => {
  const base = pair.slice(0, 3), quote = pair.slice(3, 6);
  const units = vol * (contract || (base === "XAU" ? 100 : base === "XAG" ? 5000 : 100000));
  const inQuote = units * (close - open) * dir;
  if (contract || quote === "USD") return inQuote;
  if (base === "USD") return inQuote / close;
  return ["EUR", "GBP", "AUD", "NZD"].includes(quote) ? inQuote * rate : inQuote / rate;
};
const BOOK = [["EURUSD", 1.085, 0], ["GBPUSD", 1.27, 0], ["AUDUSD", 0.66, 0], ["NZDUSD", 0.6, 0], ["USDJPY", 150, 0], ["USDCHF", 0.88, 0], ["USDCAD", 1.36, 0],
              ["EURJPY", 162, 150], ["GBPJPY", 190, 150], ["EURGBP", 0.85, 1.27], ["AUDNZD", 1.1, 0.6], ["EURCHF", 0.95, 0.88], ["XAUUSD", 2650, 0], ["XAGUSD", 31, 0]];
let seed = 12345;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const agrees = (r, inp) => {
  const dir = r.long ? 1 : -1, tol = 1e-6 * Math.max(1, r.size);
  const stop = -broker(inp.pair, r.lots, inp.entry, inp.sl, dir, inp.rate, inp.contract);
  const fills = r.targets.map((t) => broker(inp.pair, t.vol, inp.entry, t.price, dir, inp.rate, inp.contract));
  const vols = r.targets.reduce((s, t) => s + Math.round(t.vol * 100), 0);
  return Math.abs(stop - r.risk) <= tol && fills.every((p, i) => Math.abs(p - r.targets[i].pnl) <= tol) && vols === Math.round(r.lots * 100)
    && r.targets.every((t) => Math.abs(t.vol * 100 - Math.round(t.vol * 100)) < 1e-6) && Math.abs(fills.reduce((s, p) => s + p, 0) - r.total) <= tol * 4;
};
const position = () => {
  const [pair, px, rate] = BOOK[Math.floor(rnd() * BOOK.length)], dir = rnd() < 0.5 ? 1 : -1;
  const entry = px * (0.9 + rnd() * 0.2), stop = 0.0005 + rnd() * 0.02, at = (m) => entry * (1 + dir * m);
  const n = Math.floor(rnd() * 4);
  return { pair, entry, sl: at(-stop), risk: 5 + rnd() * 2000, rate: rate ? rate * (0.9 + rnd() * 0.2) : 0, lev: rnd() < 0.5 ? 0 : 30 + Math.floor(rnd() * 970),
           tps: Array.from({ length: n }, (_, i) => tp(at(stop * (i + 1) * (0.5 + rnd())), 5 + Math.floor(rnd() * 25))), fullTp: at(stop * (5 + rnd() * 3)), dir };
};
{
  let ok = 0, made = 0;
  for (let i = 0; i < 400; i++) {
    const inp = position(), r = calc(inp);
    if (r.errors.length) continue;                        // a risk too small for its stop: nothing to check
    made++;
    if (r.long === inp.dir > 0 && agrees(r, inp)) ok++; else if (made - ok <= 3) console.log("     ", JSON.stringify(inp), JSON.stringify(r.targets.map((t) => [t.vol, t.pnl])));
  }
  report(ok === made && made > 300, `${ok} of ${made} positions agree with the broker to the cent`);
}

console.log("4. what is refused");
is("a cross without its dollar rate", fields(calc({ pair: "EURJPY", entry: 162, sl: 161.4, risk: 50 })), ["rate"]);
is("a symbol it doesn't know without a contract size", fields(calc({ pair: "US30", entry: 42000, sl: 41960, risk: 100 })), ["contract"]);
is("a risk too small for the stop", fields(calc({ pair: "EURUSD", entry: 1.085, sl: 1.05, risk: 3 })), ["risk"]);
is("a leverage over 1:5000", fields(calc({ pair: "EURUSD", entry: 1.085, sl: 1.082, risk: 50, lev: 6000 })), ["maxLev"]);
is("no leverage is not an error", fields(calc({ pair: "EURUSD", entry: 1.085, sl: 1.082, risk: 50 })), []);
is("a stop on the wrong side of a locked buy", fields(calc({ pair: "EURUSD", entry: 1.085, sl: 1.09, risk: 50, side: "long" })), ["sl"]);
is("a target on the wrong side of a locked buy", fields(calc({ pair: "EURUSD", entry: 1.085, sl: 1.082, risk: 50, fullTp: 1.08, side: "long" })), ["full"]);
is("nothing typed", fields(calc({ pair: "", entry: 0, sl: 0, risk: 0 })), ["contract", "entry", "risk", "sl"]);

console.log("5. 30,000 random positions");
{
  let bad = 0, made = 0, first = null;
  for (let i = 0; i < 30000; i++) {
    const inp = position(), r = calc(inp);
    if (r.errors.length) { if (fields(r).join() !== "risk") { bad++; first ||= [inp, r.errors]; } continue; }
    made++;
    const dir = r.long ? 1 : -1, one = -broker(inp.pair, 0.01, inp.entry, inp.sl, dir, inp.rate, 0);
    // never over the risk, and one more hundredth of a lot would be; whole hundredths; every target a profit
    const fine = r.risk <= inp.risk + 1e-7 && r.risk + one > inp.risk - 1e-7 && r.lots >= 0.01 - 1e-9 && Math.abs(r.lots * 100 - Math.round(r.lots * 100)) < 1e-6
      && r.targets.every((t) => t.pnl >= -1e-9 && t.full > 0) && agrees(r, inp) && (inp.lev ? Math.abs(r.margin - r.size / inp.lev) < 1e-6 : r.margin === null);
    if (!fine) { bad++; first ||= [inp, r]; }
  }
  report(bad === 0 && made > 25000, `${made} sized, ${bad} wrong${first ? " · first: " + JSON.stringify(first).slice(0, 600) : ""}`);
}

console.log(fails ? `\n${fails} of ${checks} checks FAILED` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
