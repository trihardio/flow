/* Checks the split bill's sum exactly as it stands in src/App.jsx (splitBill is read out of the file).
   usage: node tools/bill-test.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "App.jsx"), "utf8");
const a = src.indexOf("const splitBill = "), b = src.indexOf("const BILL_MAX", a);
const splitBill = new Function(`${src.slice(a, b)}; return splitBill;`)();

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; if (!ok) console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); };
const sum = (l) => l.reduce((x, y) => x + y, 0);
const pct = (svc, tax) => ({ svc: { pct: svc }, tax: { pct: tax } });

/* ---- 1. worked out by hand ---- */
// the figures checked on 11 October 2026 (service 5%, tax 10%: × 1.155)
let r = splitBill({ bill: 100000, own: [40000, 0, 0], ...pct(5, 10) });
eq("three, one had 40.000", [r.total, r.shares], [115500, [69300, 23100, 23100]]);
r = splitBill({ own: [35000, 40000], ...pct(5, 10) });
eq("no bill: each what they had", [r.total, r.shares], [86625, [40425, 46200]]);
// 54.862,5 and 60.637,5: rounded one by one they came to 115.501. Now they add up
r = splitBill({ bill: 100000, own: [35000, 40000], ...pct(5, 10) });
eq("with a bill of 100.000", [r.total, r.shares, sum(r.shares)], [115500, [54863, 60637], 115500]);
// 100.000 between three: 33.334 + 33.333 + 33.333
r = splitBill({ bill: 100000, own: [0, 0, 0] });
eq("100.000 between three", r.shares, [33334, 33333, 33333]);

// his example: a 400.000 pizza, one box
r = splitBill({ own: [0, 0, 0, 0], shared: [{ amount: 400000, who: [0, 1, 2, 3] }] });
eq("pizza, all four", r.shares, [100000, 100000, 100000, 100000]);
r = splitBill({ own: [0, 0, 0, 0], shared: [{ amount: 400000, who: [0, 1, 2] }] });
eq("pizza, three of the four ate it", [r.total, r.shares], [400000, [133334, 133333, 133333, 0]]);
r = splitBill({ own: [0, 0, 0], shared: [{ amount: 400000, who: [0, 1, 2], by: { 0: 200000 } }] });
eq("pizza by hand: one pays 200.000, the other two share the rest", r.shares, [200000, 100000, 100000]);
r = splitBill({ own: [0, 0, 0], shared: [{ amount: 400000, who: [0, 1, 2], by: { 0: 200000, 1: 150000, 2: 50000 } }] });
eq("pizza by hand: all three typed", r.shares, [200000, 150000, 50000]);
eq("by hand, too much", splitBill({ own: [0, 0], shared: [{ amount: 400000, who: [0, 1], by: { 0: 300000, 1: 150000 } }] }), { item: 0, err: "over", by: 50000 });
eq("by hand, not all of it", splitBill({ own: [0, 0], shared: [{ amount: 400000, who: [0, 1], by: { 0: 100000, 1: 150000 } }] }), { item: 0, err: "under", by: 150000 });
eq("nobody had it", splitBill({ own: [0, 0], shared: [{ amount: 400000, who: [] }] }), { item: 0, err: "nobody" });
// somebody who did not have it types nothing into it: a figure of theirs is not read
r = splitBill({ own: [0, 0, 0], shared: [{ amount: 300000, who: [0, 1], by: { 2: 999 } }] });
eq("a figure of somebody who did not have it", r.shares, [150000, 150000, 0]);

// a dinner: pizza 400.000 for three of four, drinks of their own, a bill of 700.000, service 5%, tax 11%
// before service and tax: pizza 133.333,33 each for three; own 30.000 / 25.000 / 0 / 45.000; the rest 700.000 − 500.000 = 200.000, 50.000 each
// × 1,05 × 1,11 = 1,1655: 248.640,00 · 242.812,50 · 213.675,00 · 110.722,50 = 815.850
r = splitBill({ bill: 700000, own: [30000, 25000, 0, 45000], shared: [{ amount: 400000, who: [0, 1, 2] }], ...pct(5, 11) });
eq("a dinner", [r.total, r.shares, sum(r.shares)], [815850, [248640, 242813, 213675, 110722], 815850]);

// service as an amount: 20.000 on a bill of 200.000 is 10%, so it is put on each part by its size
r = splitBill({ bill: 200000, own: [100000, 0], svc: { amt: 20000 }, tax: { pct: 0 } });
eq("service as an amount", [r.total, r.shares], [220000, [165000, 55000]]);
eq("the same as 10%", splitBill({ bill: 200000, own: [100000, 0], ...pct(10, 0) }).shares, r.shares);
// tax as an amount on top of a service in %: 200.000 + 5% = 210.000, + 21.000
r = splitBill({ bill: 200000, own: [0, 0], svc: { pct: 5 }, tax: { amt: 21000 } });
eq("tax as an amount", [r.total, r.shares], [231000, [115500, 115500]]);
eq("the same as 10% tax", splitBill({ bill: 200000, own: [0, 0], ...pct(5, 10) }).shares, r.shares);
// both as amounts
r = splitBill({ bill: 90000, own: [0, 0, 0], svc: { amt: 5000 }, tax: { amt: 5000 } });
eq("both as amounts", [r.total, r.shares], [100000, [33334, 33333, 33333]]);

// ringgit: a sen is 44 rupiah (unit). RM 100,00 between three: 33,34 + 33,33 + 33,33
r = splitBill({ bill: 440000, own: [0, 0, 0], unit: 44 });
eq("ringgit, whole sen", [r.total, r.shares.map((v) => v / 44)], [440000, [3334, 3333, 3333]]);

eq("nothing typed", splitBill({ own: [0, 0] }), null);
eq("more than the bill", splitBill({ bill: 50000, own: [40000, 20000] }), { over: 10000 });
eq("more than the bill, with a shared thing", splitBill({ bill: 50000, own: [0, 0], shared: [{ amount: 60000, who: [0, 1] }] }), { over: 10000 });

/* ---- 2. made-up bills: what people pay adds up to the total, nobody pays less than nothing, and an independent sum agrees ---- */
let seed = 20261013;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
let runs = 0, bad = 0, worst = 0;
for (let t = 0; t < 40000; t++) {
  const n = int(2, 8), unit = rnd() < 0.2 ? 44 : 1, step = unit === 44 ? 44 : rnd() < 0.5 ? 500 : 1;
  const own = Array.from({ length: n }, () => (rnd() < 0.5 ? 0 : int(1, 300) * step));
  const shared = Array.from({ length: int(0, 3) }, () => {
    const who = Array.from({ length: n }, (_, i) => i).filter(() => rnd() < 0.7), amount = int(1, 900) * step;
    if (!who.length) who.push(int(0, n - 1));
    const by = rnd() < 0.4 ? {} : null;
    // by hand: some of them typed a part, never more than the thing costs together, and one is left empty
    if (by) { let room = amount; for (const i of who.slice(1)) if (rnd() < 0.5 && room > step) { by[i] = int(1, Math.floor(room / step / 2) || 1) * step; room -= by[i]; } }
    return { amount, who, by };
  });
  const alone = sum(own) + sum(shared.map((s) => s.amount)), bill = rnd() < 0.5 ? 0 : alone + int(0, 400) * step;
  const svc = rnd() < 0.5 ? { pct: int(0, 15) } : { amt: int(0, 60) * step }, tax = rnd() < 0.5 ? { pct: int(0, 12) } : { amt: int(0, 60) * step };
  const res = splitBill({ bill, own, shared, svc, tax, unit });
  if (!res) { if (alone || bill) bad++; continue; }
  if (res.err || res.over) { bad++; continue; }
  runs++;
  // an independent sum: everybody's part before service and tax, each scaled by the same factor
  const base = bill || alone, sub = own.slice();
  for (const s of shared) { const fixed = sum(s.who.map((i) => (s.by && s.by[i]) || 0)), free = s.who.filter((i) => !(s.by && s.by[i])).length; for (const i of s.who) sub[i] += (s.by && s.by[i]) || (s.amount - fixed) / free; }
  const sv = svc.amt != null ? svc.amt : base * svc.pct / 100, tx = tax.amt != null ? tax.amt : (base + sv) * tax.pct / 100, all = base + sv + tx;
  const want = sub.map((v) => (v + (base - alone) / n) * all / base);
  const off = Math.max(...res.shares.map((v, i) => Math.abs(v - want[i])));
  worst = Math.max(worst, off / unit);
  if (sum(res.shares) !== res.total || Math.abs(res.total - all) > unit / 2 + 1e-6 || res.shares.some((v) => v < 0) || off >= unit + 1e-6 || res.shares.some((v) => Math.abs(v / unit - Math.round(v / unit)) > 1e-9)) bad++;
}
eq(`made-up bills (${runs} worked out): none wrong`, bad, 0);
console.log(`the furthest any part is from its exact figure: ${worst.toFixed(3)} of a rupiah (or sen)`);
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
