// Tests the month-end projection exactly as it stands in src/App.jsx (the block is read out of the file, not copied).
//   node tools/projection-test.mjs
// 1 a month worked out by hand · 2 monthly bills and pay · 3 gaps in the logging, and days already written ahead
// 4 a backtest: months made the way the app's own test data makes them, and months made like real life, cut off on
//   the 5th, 10th, 15th, 20th and 25th and compared with how the month really ended, against the plain
//   "spent so far ÷ days so far × days in the month" · 5 random data never breaks it
import fs from "node:fs";
const src = fs.readFileSync(process.argv.slice(2).find((x) => !x.startsWith("--")) || new URL("../src/App.jsx", import.meta.url), "utf8");
const a = src.indexOf("/* ---------- month-end projection: the maths ----------");
const b = src.indexOf("/* ---------- month-end projection: end of the maths ----------");
if (a < 0 || b < a) throw new Error("maths block not found");
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKeyOf = (y, m) => `${y}-${pad(m + 1)}`;
const canonKey = (raw) => (raw || "").toLowerCase().trim().replace(/\s+/g, " ") || "__none__";
const DEFAULT_LIMIT = 50_000;
const { projectMonth } = new Function("keyOf", "monthKeyOf", "canonKey", "DEFAULT_LIMIT", src.slice(a, b) + "\nreturn { projectMonth };")(keyOf, monthKeyOf, canonKey, DEFAULT_LIMIT);
// the app's own test-data generator, read out of the file the same way
const ga = src.indexOf("/* ---------- test data: the generator ----------"), gb = src.indexOf("/* ---------- test data: end of the generator ----------");
if (ga < 0 || gb < ga) throw new Error("generator block not found");
const { SPEND_STYLES, SPEND_PATTERNS, DEFAULT_TEST_CFG, testMonth } = new Function(src.slice(ga, gb) + "\nreturn { SPEND_STYLES, SPEND_PATTERNS, DEFAULT_TEST_CFG, testMonth };")();

let fails = 0, checks = 0;
const quiet = process.argv.includes("--quiet");
const report = (ok, line) => { checks++; if (!ok) fails++; if (!ok || !quiet) console.log(`${ok ? "  ok " : "FAIL "} ${line}`); };
const near = (name, got, want, tol) => report(Math.abs(got - want) <= tol, `${name}: ${Math.round(got * 100) / 100} (want ${want} ± ${tol})`);
const is = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); report(ok, `${name}: ${JSON.stringify(got)}${ok ? "" : " (want " + JSON.stringify(want) + ")"}`); };
const BILL_WORDS = ["rent", "internet", "electric", "water", "pulsa", "netflix", "spotify"];
const catOf = (it) => it.cat || (BILL_WORDS.some((w) => (it.desc || "").toLowerCase().includes(w)) ? "bills" : "other");
// hour 24: the day is over, nothing more is expected of it
const run = (data, y, m, d, hour = 24) => projectMonth({ spending: data.spending, incomes: data.incomes, limits: data.limits || {}, y, m, d, hour, catOf });
let uidN = 0;
const item = (amount, desc, more) => ({ id: "t" + uidN++, amount, desc, ...more });
const put = (sp, y, m, d, it) => { const k = keyOf(y, m, d); (sp[k] = sp[k] || []).push(it); };
// a seeded random source, so every run tests the same months
const rng = (seed) => { let s = seed % 2147483647 || 1; return () => (s = (s * 48271) % 2147483647) / 2147483647; };
// the data as it stood on the evening of (y, m, d): nothing later is known
const cut = (data, y, m, d) => {
  const last = keyOf(y, m, d), spending = {}, incomes = {};
  Object.keys(data.spending).forEach((k) => { if (k <= last) spending[k] = data.spending[k]; });
  Object.keys(data.incomes).forEach((k) => {
    if (k < monthKeyOf(y, m)) incomes[k] = data.incomes[k];
    else if (k === monthKeyOf(y, m)) incomes[k] = data.incomes[k].filter((it) => (it.day || 1) <= d);
  });
  return { spending, incomes, limits: data.limits };
};
const monthSpent = (data, y, m) => { let t = 0; for (let d = 1; d <= 31; d++) (data.spending[keyOf(y, m, d)] || []).forEach((it) => { t += it.amount; }); return t; };
const monthIncome = (data, y, m) => (data.incomes[monthKeyOf(y, m)] || []).reduce((s, it) => s + it.amount, 0);

/* ------------------------------------------------------------------------------------------------------------- */
console.log("1. by hand: 40.000 every weekday and 100.000 every Saturday and Sunday since 1 July, today Wed 14 Oct 2026");
{
  const sp = {};
  for (let dt = new Date(2026, 6, 1); dt <= new Date(2026, 9, 14); dt.setDate(dt.getDate() + 1)) {
    const we = dt.getDay() === 0 || dt.getDay() === 6;
    put(sp, dt.getFullYear(), dt.getMonth(), dt.getDate(), item(we ? 100_000 : 40_000, we ? "brunch" : "lunch"));
  }
  const data = { spending: sp, incomes: { "2026-10": [item(5_000_000, "Salary", { day: 1 })] } };
  const r = run(data, 2026, 9, 14);
  // October 2026: 1st is a Thursday. Days 1–14 hold 10 weekdays and 4 weekend days: 10 × 40 + 4 × 100 = 800.000
  near("spent so far", r.spent, 800_000, 0);
  // days 15–31: weekend days are 17, 18, 24, 25, 31 = 5, weekdays = 12. Today already has its 40.000.
  is("days still to come (weekdays, weekend days)", [r.nWd, r.nWe], [12, 5]);
  near("a weekday costs", r.weekday, 40_000, 1e-6);
  near("a weekend day costs", r.weekend, 100_000, 1e-6);
  near("nothing more today", r.todayMore, 0, 1e-6);
  near("still to come: 12 × 40.000 + 5 × 100.000", r.toCome, 980_000, 1e-6);
  near("spent by the 31st", r.endSpend, 1_780_000, 1e-6);
  near("left on the 31st", r.endLeft, 3_220_000, 1e-6);
  near("no spread when every day is the same", r.sd, 0, 1e-6);
  is("the running total: a figure for every day, today's what is spent, the last the month's end", [r.path.length, r.path[0], r.path[14], Math.round(r.path[31])], [32, 0, 800_000, 1_780_000]);
  near("… Thursday the 15th adds a weekday, Saturday the 17th a weekend day", r.path[17] - r.path[14], 40_000 + 40_000 + 100_000, 1e-6);
  is("no bills, no big buys", [r.billsDue.length, r.bigN], [0, 0]);
  // the same morning, before anything is logged today: today's 40.000 is still to come
  const morning = { ...data, spending: { ...sp } };
  delete morning.spending["2026-10-14"];
  const r2 = run(morning, 2026, 9, 14, 9);
  near("at 9 in the morning, before today's lunch: today's 40.000 still to come", r2.toCome, 1_020_000, 1e-6);
  near("… and the month ends the same", r2.endSpend, 1_780_000, 1e-6);
  near("at 6 in the evening with nothing logged, half of it is still expected", run(morning, 2026, 9, 14, 18).todayMore, 20_000, 1e-6);
  // the naive pace would say 800.000 / 14 × 31
  console.log(`      (the plain pace says ${Math.round(800_000 / 14 * 31).toLocaleString("id-ID")}; the month really ends on 1.780.000)`);
}

console.log("2. monthly bills and pay");
{
  const sp = {}, inc = {};
  for (let dt = new Date(2026, 6, 1); dt <= new Date(2026, 9, 10); dt.setDate(dt.getDate() + 1)) put(sp, dt.getFullYear(), dt.getMonth(), dt.getDate(), item(30_000, "lunch"));
  [6, 7, 8].forEach((m) => {
    put(sp, 2026, m, 3, item(1_500_000, "Rent"));
    put(sp, 2026, m, 20 + (m - 6), item(250_000 + (m - 6) * 30_000, "Electricity"));     // 250, 280, 310 on the 20th–22nd
    put(sp, 2026, m, 12, item(350_000, "Gym"));
    put(sp, 2026, m, 5 + (m - 6) * 9, item(400_000 + (m - 6) * 90_000, "Shoes"));        // not a bill: the amount and the day wander
    inc[monthKeyOf(2026, m)] = [item(9_000_000, "Salary", { day: 25 })];
  });
  put(sp, 2026, 9, 3, item(1_500_000, "Rent"));
  const r = run({ spending: sp, incomes: inc }, 2026, 9, 10);
  is("due: gym on the 12th, electricity around the 21st (rent is paid, shoes are not a bill)", r.billsDue.map((x) => [x.key, x.amount, x.day]), [["gym", 350_000, 12], ["electricity", 280_000, 21]]);
  is("pay expected: salary on the 25th", r.payDue.map((x) => [x.key, x.amount, x.day]), [["salary", 9_000_000, 25]]);
  near("a day costs 30.000 (bills are not part of the everyday figure)", r.weekday, 30_000, 1e-6);
  is("the shoes of July, August and September are big one-off buys (they are counted over the whole year behind)", r.bigN, 3);
  is("three months behind are too few to count by the month: so many a day, by chance", r.bigMonths, 3);
  // 21 days × 30.000 + bills 630.000 + big buys: 400.000 + 490.000 + 580.000 over the 101 days in use, × 21 days to come
  near("still to come", r.toCome, 21 * 30_000 + 630_000 + (1_470_000 / 101) * 21, 1e-6);
  near("left on the 31st", r.endLeft, 9_000_000 - r.endSpend, 1e-6);
  // a week after its day a bill is no longer expected
  const late = run({ spending: sp, incomes: inc }, 2026, 9, 20);
  is("on the 20th the gym (12th) is no longer waited for", late.billsDue.map((x) => x.key), ["electricity"]);
  // paying it takes it off the list
  put(sp, 2026, 9, 9, item(350_000, "gym"));
  is("paid on the 9th: off the list", run({ spending: sp, incomes: inc }, 2026, 9, 10).billsDue.map((x) => x.key), ["electricity"]);
}

console.log("2b. big buys that come in a steady number");
{
  // 20.000 a day since 1 March; two big buys of 600.000 every month, on the 6th and the 18th
  const sp = {};
  for (let dt = new Date(2026, 2, 1); dt <= new Date(2026, 9, 20); dt.setDate(dt.getDate() + 1)) {
    put(sp, dt.getFullYear(), dt.getMonth(), dt.getDate(), item(20_000, "lunch"));
    if (dt.getDate() === 6 || dt.getDate() === 18) put(sp, dt.getFullYear(), dt.getMonth(), dt.getDate(), item(600_000, ["sofa", "bike", "phone", "trip", "tv"][(dt.getMonth() + dt.getDate()) % 5]));
  }
  const r = run({ spending: sp, incomes: {} }, 2026, 9, 20);
  is("seven months behind, two made this month", [r.bigMonths, r.bigNow], [7, 2]);
  report(r.bigMore < 0.25, `both of this month's are made: next to none more expected (${r.bigMore.toFixed(3)} of one; by chance alone it would be ${(r.bigPerMonth / 30 * 11).toFixed(2)})`);
  near("… so the 11 days left cost little more than 11 × 20.000", r.toCome, 220_000, 0.25 * 600_000);
  const r10 = run(cut({ spending: sp, incomes: {} }, 2026, 9, 10), 2026, 9, 10);
  report(r10.bigNow === 1 && r10.bigMore > 0.85 && r10.bigMore < 1.15, `on the 10th, with one made, about one more is expected: ${r10.bigMore.toFixed(3)}`);
  const r4 = run(cut({ spending: sp, incomes: {} }, 2026, 9, 4), 2026, 9, 4);
  report(r4.bigNow === 0 && r4.bigMore > 1.8 && r4.bigMore < 2.2, `on the 4th, with none made, about two: ${r4.bigMore.toFixed(3)}`);
}

console.log("3. gaps in the logging, and later days that are already written");
{
  const sp = {};
  // August in use, September not opened at all, October in use again
  for (let dt = new Date(2026, 7, 1); dt <= new Date(2026, 7, 31); dt.setDate(dt.getDate() + 1)) put(sp, 2026, 7, dt.getDate(), item(50_000, "food"));
  for (let d = 1; d <= 14; d++) put(sp, 2026, 9, d, item(50_000, "food"));
  let r = run({ spending: sp, incomes: {} }, 2026, 9, 15);
  near("a month away from the app is not read as a month without spending", r.weekday, 50_000, 1e-6);
  // a few days he didn't log count as days without spending
  delete sp["2026-10-05"]; delete sp["2026-10-06"];
  r = run({ spending: sp, incomes: {} }, 2026, 9, 15);
  report(r.weekday < 50_000 && r.weekday > 35_000, `two unlogged days pull the weekday figure down a little: ${Math.round(r.weekday)}`);
  // what is already written on a later day is taken as written: that day is not projected on top
  const r0 = run({ spending: sp, incomes: {} }, 2026, 9, 15);
  put(sp, 2026, 9, 29, item(900_000, "Flight"));
  const r1 = run({ spending: sp, incomes: {} }, 2026, 9, 15);
  near("a flight written on Thu the 29th replaces that day's everyday figure", r1.endSpend, r0.endSpend + 900_000 - r0.byDow[4], 1e-6);
  is("… and one day fewer is projected", [r0.openDays, r1.openDays], [16, 15]);
  put(sp, 2026, 9, 30, item(0, "No spend day", { zero: true }));
  near("a no-spend mark on Fri the 30th takes that day out", run({ spending: sp, incomes: {} }, 2026, 9, 15).endSpend, r1.endSpend - r1.byDow[5], 1e-6);
  // a month already filled to its end (generated test data): the projection is what is written
  const full = { ...sp };
  for (let d = 16; d <= 31; d++) full[keyOf(2026, 9, d)] = [item(20_000, "food")];
  const rf = run({ spending: full, incomes: { "2026-10": [item(1_000_000, "pay", { day: 28 })] } }, 2026, 9, 15);
  near("a month filled to its end ends on what is written", rf.endSpend, rf.spent + 16 * 20_000, 1e-6);
  near("… with nothing left to guess", rf.sd, 0, 1e-6);
  near("… and income on a later day counts", rf.endLeft, 1_000_000 - rf.endSpend, 1e-6);
  is("too little to read (4 days): no projection", run({ spending: { "2026-10-01": [item(1, "a")], "2026-10-02": [item(1, "a")], "2026-10-03": [item(1, "a")], "2026-10-04": [item(1, "a")] }, incomes: {} }, 2026, 9, 5), null);
}

/* ------------------------------------------------------------------------------------------------------------- */
// a year made the way the app's "Add test data" makes it: a style's figures, pay on the 2nd, and optionally monthly bills
const appYear = (style, R, more) => {
  const cfg = { ...DEFAULT_TEST_CFG, ...SPEND_STYLES[style], incMin: 6, incMax: 9, incDays: [2], ...more };
  const spending = {}, incomes = {};
  for (let m = 0; m < 12; m++) {
    const g = testMonth(cfg, 2026, m, R);
    incomes[monthKeyOf(2026, m)] = g.incomes.map((it) => item(it.amount, it.desc, { day: it.day }));
    Object.entries(g.days).forEach(([d, items]) => { spending[keyOf(2026, m, +d)] = items.map((it) => item(it.amount, it.desc, { cat: it.cat })); });
    g.zeros.forEach((d) => { spending[keyOf(2026, m, d)] = [item(0, "No spend day", { zero: true })]; });
  }
  return { spending, incomes };
};
// a year made like real life: weekdays and weekends differ, rent and other bills on their days, pay late in the month,
// a couple of big buys, a holiday month now and then, and some days he forgets to log
const lifeYear = (R) => {
  const rnd = (lo, hi) => lo + R() * (hi - lo), spending = {}, incomes = {};
  const wd = rnd(25, 70), we = wd * rnd(1.2, 3), rent = Math.round(rnd(8, 30)) * 100_000, forget = rnd(0, 0.12);
  for (let m = 0; m < 12; m++) {
    const dim = new Date(2026, m + 1, 0).getDate(), mood = rnd(0.85, 1.2);
    incomes[monthKeyOf(2026, m)] = [item(Math.round(rnd(60, 61)) * 100_000, "Salary", { day: 25 + Math.floor(R() * 3) })];
    for (let d = 1; d <= dim; d++) {
      const dow = new Date(2026, m, d).getDay(), wkend = dow === 0 || dow === 6, add = [];
      const n = (wkend ? 2 : 1) + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) if (R() < 0.8) add.push(item(Math.round((wkend ? we : wd) * mood * rnd(0.2, 1.1) / n * 2) * 1000, ["lunch", "coffee", "grab", "dinner", "indomaret", "parkir"][Math.floor(R() * 6)]));
      if (dow === 5 && R() < 0.7) add.push(item(Math.round(wd * rnd(0.8, 1.6)) * 1000, "friday dinner"));
      if (d === 3) add.push(item(rent, "Rent"));
      if (d === 5 + Math.floor(R() * 2)) add.push(item(350_000, "Internet"));
      if (d === 19 + Math.floor(R() * 3)) add.push(item(Math.round(rnd(200, 300)) * 1000, "Electricity"));
      if (d === 12) add.push(item(54_990, "Netflix"));
      if (R() < 0.06) add.push(item(Math.round(rnd(200, 900)) * 1000, ["shoes", "tokopedia", "gift", "service motor", "dokter"][Math.floor(R() * 5)]));
      if (R() < forget) continue;
      if (add.length) spending[keyOf(2026, m, d)] = add;
    }
  }
  return { spending, incomes };
};

console.log("4. backtest: the 5th, 10th, 15th, 20th and 25th of May to November, against how each month really ended");
const CUTS = [5, 10, 15, 20, 25];
const backtest = (name, make, seeds) => {
  const errM = {}, errN = {}; let inBand = 0, n = 0, leftErr = 0;
  CUTS.forEach((c) => { errM[c] = []; errN[c] = []; });
  for (let seed = 1; seed <= seeds; seed++) {
    const data = make(rng(seed * 7919));
    for (let m = 4; m <= 10; m++) {
      const dim = new Date(2026, m + 1, 0).getDate(), actual = monthSpent(data, 2026, m), actualLeft = monthIncome(data, 2026, m) - actual;
      CUTS.forEach((c) => {
        const seen = cut(data, 2026, m, c), r = run(seen, 2026, m, c);
        if (!r || !actual) return;
        const naive = (monthSpent(seen, 2026, m) / c) * dim;
        errM[c].push(Math.abs(r.endSpend - actual) / actual); errN[c].push(Math.abs(naive - actual) / actual);
        leftErr += Math.abs(r.endLeft - actualLeft); n++;
        if (Math.abs(r.endSpend - actual) <= 1.28 * r.sd) inBand++;
      });
    }
  }
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const pct = (v) => (v * 100).toFixed(1).padStart(5) + "%";
  const allM = mean(CUTS.flatMap((c) => errM[c])), allN = mean(CUTS.flatMap((c) => errN[c]));
  console.log(`   ${name.padEnd(18)} off by, on average   ${CUTS.map((c) => `day ${String(c).padStart(2)}: ${pct(mean(errM[c]))} (pace ${pct(mean(errN[c]))})`).join("   ")}`);
  report(allM < allN, `${name}: off by ${pct(allM)} of the month's spending on average, the plain pace by ${pct(allN)}; the range holds the real end ${Math.round((inBand / n) * 100)}% of the time; left-over off by ${Math.round(leftErr / n).toLocaleString("id-ID")} on average`);
  return { allM, allN, band: inBand / n };
};
const results = {};
Object.keys(SPEND_STYLES).forEach((k) => { results[k] = backtest(`test data: ${k}`, (R) => appYear(k, R), 120); });
// the spreads (20 October 2026: their own choice now, laid over an amount), each over the middle amount
Object.keys(SPEND_PATTERNS).filter((k) => k !== "steady").forEach((k) => { results[k] = backtest(`test data: balanced, ${k}`, (R) => appYear("balanced", R, SPEND_PATTERNS[k]), 120); });
results.bills = backtest("balanced + bills", (R) => appYear("balanced", R, { bills: 2.5 }), 120);
results.weekdays = backtest("weekdays only", (R) => appYear("balanced", R, { dows: [true, true, true, true, true, false, false] }), 120);
results.life = backtest("real-life months", lifeYear, 300);
report(results.life.allM < 0.6 * results.life.allN, `real-life months: at least 40% closer than the plain pace (${(results.life.allM * 100).toFixed(1)}% against ${(results.life.allN * 100).toFixed(1)}%)`);
report(results.life.band > 0.7 && results.life.band < 0.95, `real-life months: the likely range is honest (holds the real end ${Math.round(results.life.band * 100)}% of the time; aim 80%)`);

console.log("5. random data never breaks it");
{
  const R = rng(4242); let bad = 0, runs = 0;
  for (let t = 0; t < 4000; t++) {
    const sp = {}, inc = {}, y = 2026, m = Math.floor(R() * 12), dim = new Date(y, m + 1, 0).getDate(), d = 1 + Math.floor(R() * dim);
    const days = Math.floor(R() * 140);
    for (let k = 0; k < days; k++) {
      const dt = new Date(y, m, d - Math.floor(R() * 120) + Math.floor(R() * 25));
      const big = R() < 0.05;
      put(sp, dt.getFullYear(), dt.getMonth(), dt.getDate(), R() < 0.1 ? item(0, "No spend day", { zero: true }) : item(Math.floor(R() * (big ? 1e9 : 3e5)), R() < 0.2 ? "" : ["a", "b", "rent", "wifi"][Math.floor(R() * 4)], R() < 0.3 ? { test: true } : {}));
    }
    for (let k = 0; k < 4; k++) if (R() < 0.6) { const p = new Date(y, m - k, 1), mk = monthKeyOf(p.getFullYear(), p.getMonth()); (inc[mk] = inc[mk] || []).push(item(Math.floor(R() * 2e7), R() < 0.5 ? "Salary" : "", { day: R() < 0.1 ? null : 1 + Math.floor(R() * 28) })); }
    const r = run({ spending: sp, incomes: inc }, y, m, d);
    if (!r) continue;
    runs++;
    const nums = [r.spent, r.income, r.toCome, r.endSpend, r.endIncome, r.endLeft, r.sd, r.everyday, r.todayMore, r.big, r.planned, r.billSum, r.paySum, r.weekday, r.weekend];
    const ok = nums.every(Number.isFinite) && r.toCome >= 0 && r.endSpend >= r.spent - 1e-6 && r.sd >= 0 && r.weekday >= 0 && r.weekend >= 0
      && r.nWd + r.nWe === r.daysLeft && r.openDays <= r.daysLeft && Math.abs(r.endLeft - (r.endIncome - r.endSpend)) < 1e-3
      && Math.abs(r.toCome - (r.everyday + r.big + r.billSum + r.planned)) < 1e-3 && (r.daysLeft > 0 || Math.abs(r.toCome - r.billSum) < 1e-6)
      && r.path.length === r.dim + 1 && r.path.every((v, i) => Number.isFinite(v) && (!i || v >= r.path[i - 1] - 1e-6)) && (r.daysLeft === 0 || Math.abs(r.path[r.dim] - r.endSpend) < 1e-3 * Math.max(1, r.endSpend));
    if (!ok) { bad++; if (bad < 4) console.log("      bad:", JSON.stringify({ y, m, d, r }).slice(0, 400)); }
  }
  report(bad === 0 && runs > 1000, `${runs} random months: every figure a real number, nothing negative, the parts add up`);
}

console.log("6. planned expenses: what he says he will spend on a day to come");
const runP = (data, y, m, d, plans, hour = 24) => projectMonth({ spending: data.spending, incomes: data.incomes, limits: data.limits || {}, y, m, d, hour, catOf, plans });
{
  // by hand: 40.000 every day since 1 July, today 14 Oct 2026, the day over
  const sp = {};
  for (let t0 = new Date(2026, 6, 1); t0 <= new Date(2026, 9, 14); t0.setDate(t0.getDate() + 1)) put(sp, t0.getFullYear(), t0.getMonth(), t0.getDate(), item(40000, "food"));
  const data = { spending: sp, incomes: {} }, r0 = run(data, 2026, 9, 14);
  const r1 = runP(data, 2026, 9, 14, [{ date: "2026-10-17", amount: 60000, desc: "haircut" }, { date: "2026-10-14", amount: 25000, desc: "dinner out" },
    { date: "2026-10-13", amount: 99000, desc: "yesterday" }, { date: "2026-11-02", amount: 99000, desc: "next month" }, { date: "2026-10-20", amount: 0, desc: "nothing" }]);
  near("no plans: the month ends on 31 × 40.000", r0.endSpend, 1240000, 1);
  near("a plan in three days and one today add exactly what they are (85.000); yesterday's, next month's and an empty one add nothing", r1.endSpend - r0.endSpend, 85000, 0.001);
  is("what is planned, in the order of its days", r1.planDue.map((x) => `${x.day} ${x.desc} ${x.amount}`), ["14 dinner out 25000", "17 haircut 60000"]);
  near("the path ends where the figure does", r1.path[r1.dim], r1.endSpend, 0.001);
  near("the path on the 16th is as without plans but for today's 25.000", r1.path[16] - r0.path[16], 25000, 0.001);
  near("and from the 17th on it holds the haircut too", r1.path[17] - r0.path[17], 85000, 0.001);
  near("the range is no wider for it", r1.sd, r0.sd, 0.001);
  is("with no plans, an empty list or none at all, every figure is the same", JSON.stringify(runP(data, 2026, 9, 14, [])) === JSON.stringify(run(data, 2026, 9, 14)), true);
  // a plan named as a bill that is due stands in for it
  const sb = {};
  for (let t0 = new Date(2026, 5, 1); t0 <= new Date(2026, 9, 14); t0.setDate(t0.getDate() + 1)) put(sb, t0.getFullYear(), t0.getMonth(), t0.getDate(), item(40000, "food"));
  [6, 7, 8].forEach((mm) => put(sb, 2026, mm, 25, item(900000, "rent")));
  const db = { spending: sb, incomes: {} }, b0 = run(db, 2026, 9, 14), b1 = runP(db, 2026, 9, 14, [{ date: "2026-10-25", amount: 950000, desc: "Rent" }]);
  is("the rent is due on the 25th", b0.billsDue.map((x) => `${x.key} ${x.amount}`), ["rent 900000"]);
  near("planned by name at 950.000, it is counted once, at what was planned", b1.endSpend - b0.endSpend, 50000, 0.001);
}
// The backtest again on four kinds of months, with half of the big one-off buys that really came later in the month
// given as plans (as he would enter a purchase he knows is coming), against the same projection without them
const planTest = (name, make, seeds) => {
  let e0 = 0, e1 = 0, n = 0, inBand = 0, given = 0, hit0 = 0, hit1 = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const data = make(rng(seed * 7919)), pick = rng(seed * 104729 + 13);
    for (let m = 4; m <= 10; m++) {
      const dim = new Date(2026, m + 1, 0).getDate(), actual = monthSpent(data, 2026, m);
      CUTS.forEach((c) => {
        const seen = cut(data, 2026, m, c), r0 = run(seen, 2026, m, c);
        if (!r0 || !actual) return;
        const plans = [];
        for (let dd = c + 1; dd <= dim; dd++) (data.spending[keyOf(2026, m, dd)] || []).forEach((it) => { if (it.amount >= r0.bigFrom && catOf(it) !== "bills" && pick() < 0.5) plans.push({ date: keyOf(2026, m, dd), amount: it.amount, desc: it.desc }); });
        const r1 = runP(seen, 2026, m, c, plans);
        const a0 = Math.abs(r0.endSpend - actual) / actual, a1 = Math.abs(r1.endSpend - actual) / actual;
        e0 += a0; e1 += a1; n++; given += plans.length;
        if (a0 <= 0.1) hit0++;
        if (a1 <= 0.1) hit1++;
        if (Math.abs(r1.endSpend - actual) <= 1.28 * r1.sd) inBand++;
      });
    }
  }
  const pct = (v) => (v * 100).toFixed(1) + "%";
  // big buys that come by chance are no easier to count for knowing some of them (the rest are as uncertain as before),
  // so the claim is only that plans never make it worse by more than a quarter of a point; real-life months must gain
  report(e1 / n <= e0 / n + 0.0025, `${name}: off by ${pct(e1 / n)} with half of the big buys planned, ${pct(e0 / n)} without (${given} plans over ${n} projections); within 10% of the real end ${Math.round((hit1 / n) * 100)}% of the time, ${Math.round((hit0 / n) * 100)}% without; the range holds the real end ${Math.round((inBand / n) * 100)}% of the time`);
  return { with: e1 / n, without: e0 / n, band: inBand / n };
};
const planned = {};
["balanced", "big"].forEach((k) => { planned[k] = planTest(`test data: ${k}`, (R) => appYear(k, R), 60); });
planned.erratic = planTest("test data: balanced, erratic", (R) => appYear("balanced", R, SPEND_PATTERNS.erratic), 60);
planned.life = planTest("real-life months", lifeYear, 150);
report(planned.life.with < planned.life.without, `real-life months are closer with plans than without (${(planned.life.with * 100).toFixed(1)}% against ${(planned.life.without * 100).toFixed(1)}%)`);
report(Object.values(planned).every((r) => r.band > 0.65 && r.band < 0.97), `with plans the likely range stays honest on all ${Object.keys(planned).length} (${Object.values(planned).map((r) => Math.round(r.band * 100) + "%").join(", ")}; aim 80%)`);

console.log(fails ? `\n${fails} of ${checks} checks FAILED` : `\nall ${checks} checks passed`);
process.exit(fails ? 1 : 0);
