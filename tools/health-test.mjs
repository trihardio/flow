// Tests Health's maths and its Apple Health reader exactly as they stand in src/App.jsx (the blocks are read out of the
// file, not copied).   node tools/health-test.mjs [--quiet]
// 1 BMI, the Asian bands, the healthy weights, the burn at rest · 2 the diet plan worked out by hand (90 kg → 75 kg in
// 3 months, the three ways), what each day comes short always adding up, a gain, 2,000 random goals · 3 dates
// 4 to-dos: which days they are on, which time of their run, the streak · 5 what is read back is made safe · 6 an
// Apple Health export: steps of two sources on one day, pounds, records cut across the pieces it is read in, a zip
import fs from "node:fs";
import zlib from "node:zlib";
const src = fs.readFileSync(process.argv.slice(2).find((x) => !x.startsWith("--")) || new URL("../src/App.jsx", import.meta.url), "utf8");
const block = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1);
  if (a < 0 || b < a) throw new Error(`block not found: ${from}`);
  return src.slice(a, b);
};
const maths = block("/* ---------- health: the maths", "/* ---------- health: the maths end");
const rest = block("const HL_KEY = ", "/* ---------- Apple Health:");
const apple = block("/* ---------- Apple Health:", "/* ---------- health: what the page shows");
const shotIdOk = (id) => typeof id === "string" && /^(hl-|ph:)[\w-]{1,60}$/.test(id);
const H = new Function("shotIdOk", `${maths}\n${rest}\n${apple}\nreturn { hlBmi, hlBand, hlHealthy, hlBmr, hlStepKcal, hlStepKm, hlPlan, hlPlanAt, hlAddMonths, hlAddDays, hlDays, hlDow,
  hlOn, hlRun, hl1rm, hlVolume, cleanHealth, hlOwn, hlBlank, HL_EMPTY, hlAppleRead, HL_FLOOR, hlPhoneRead, hlNumText, hlPhoneDay, hlKey };`)(shotIdOk);

let fails = 0, checks = 0;
const quiet = process.argv.includes("--quiet");
const report = (ok, line) => { checks++; if (!ok) fails++; if (!ok || !quiet) console.log(`${ok ? "  ok " : "FAIL "} ${line}`); };
const near = (name, got, want, tol) => report(Math.abs(got - want) <= tol, `${name}: ${Math.round(got * 1000) / 1000} (want ${want} ± ${tol})`);
const is = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); report(ok, `${name}: ${JSON.stringify(got)}${ok ? "" : " (want " + JSON.stringify(want) + ")"}`); };

console.log("1. the body");
near("BMI of 90 kg at 168 cm", H.hlBmi(90, 168), 31.89, 0.01);
is("its band (Asian scale)", H.hlBand(H.hlBmi(90, 168))[1], "Obese II");
is("BMI 22.9 is healthy, 23 overweight", [H.hlBand(22.9)[1], H.hlBand(23)[1], H.hlBand(25)[1], H.hlBand(18.4)[1]], ["Healthy", "Overweight", "Obese I", "Underweight"]);
near("healthy from, at 168 cm", H.hlHealthy(168)[0], 52.21, 0.01);
near("healthy to, at 168 cm", H.hlHealthy(168)[1], 64.63, 0.01);
near("burn at rest, a man of 21, 90 kg, 168 cm (Mifflin)", H.hlBmr(90, 168, 21, "m"), 1850, 0.001);
near("the same as a woman", H.hlBmr(90, 168, 21, "f"), 1684, 0.001);
near("kcal a step at 90 kg", H.hlStepKcal(90), 0.05655, 0.0001);
near("km a step at 168 cm", H.hlStepKm(168) * 1000, 0.6972, 0.0001);
near("one-rep max of 80 kg × 5 (Epley)", H.hl1rm(80, 5), 93.33, 0.01);
is("a single is its own max", H.hl1rm(100, 1), 100);
is("volume of a session", H.hlVolume({ ex: [{ sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }] }, { sets: [{ kg: 0, reps: 12 }] }] }), 800);

console.log("2. the diet plan: 90 kg → 75 kg in 3 months, from 23 October 2026");
const me = { kg: 90, cm: 168, age: 21, sex: "m", act: 1.375, steps: 8000 };
const by = H.hlAddMonths("2026-10-23", 3);
is("3 months on", by, "2027-01-23");
const g = { target: 75, by };
const eat = H.hlPlan(me, g, "2026-10-23", "eat");
is("days", eat.days, 92);
near("each day short, kcal", eat.daily, 1255.43, 0.01);
near("burned in a day (TDEE)", eat.tdee, 2543.75, 0.001);
near("eat less: eating stops at the floor", eat.eat, 1500, 0.001);
near("eat less: the rest walked, kcal", eat.extra, 211.68, 0.01);
is("eat less: steps to add (to the hundred, up)", eat.extraSteps, 3800);
is("eat less: steps a day", eat.steps, 11800);
near("a week, kg", eat.perWeek, 1.141, 0.001);
near("a week, % of him", eat.pct, 1.268, 0.001);
is("faster than 1% a week", eat.fast, true);
is("at 1% a week instead", eat.safeBy, "2027-02-27");
const both = H.hlPlan(me, g, "2026-10-23", "both"), move = H.hlPlan(me, g, "2026-10-23", "move");
near("both: eat", both.eat, 1916.04, 0.01);
is("both: steps to add", both.extraSteps, 11200);
near("move more: eat what he burns", move.eat, 2543.75, 0.001);
is("move more: steps to add", move.extraSteps, 22300);
for (const p of [eat, both, move]) near(`what is eaten and walked comes to the day's shortfall (${p === eat ? "eat" : p === both ? "both" : "move"})`, p.tdee + p.extra - p.eat, p.daily, 0.001);
const gain = H.hlPlan({ ...me, kg: 60 }, { target: 65, by: H.hlAddMonths("2026-10-23", 6) }, "2026-10-23", "both");
is("a gain: nothing walked", [gain.lose, gain.extraSteps], [false, 0]);
near("a gain: eat over what is burned", gain.eat - gain.tdee, gain.daily, 0.001);
is("a gain of 5 kg in 6 months is not too fast (0.5% a week)", gain.fast, false);
is("already there", H.hlPlan(me, { target: 90, by }, "2026-10-23").done, true);
near("the plan's line, half way", H.hlPlanAt({ start: 90, target: 75, from: "2026-10-23", by: "2027-01-23" }, H.hlAddDays("2026-10-23", 46)), 82.5, 0.001);
near("the plan's line, before it began", H.hlPlanAt({ start: 90, target: 75, from: "2026-10-23", by: "2027-01-23" }, "2026-10-01"), 90, 0.001);
{
  let s = 7, bad = 0;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) {
    const p = { kg: 45 + rnd() * 120, cm: 145 + rnd() * 50, age: 15 + Math.floor(rnd() * 60), sex: rnd() < 0.5 ? "m" : "f", act: [1.2, 1.375, 1.55, 1.725, 1.9][Math.floor(rnd() * 5)], steps: 4000 + Math.floor(rnd() * 8) * 1000 };
    const goal = { target: Math.round(p.kg * (0.75 + rnd() * 0.35)), by: H.hlAddDays("2026-10-23", 7 + Math.floor(rnd() * 400)) };
    const plan = H.hlPlan(p, goal, "2026-10-23", ["eat", "both", "move"][i % 3]);
    const ok = Math.abs(plan.tdee + plan.extra - plan.eat - (plan.lose ? plan.daily : -plan.daily)) < 0.001 && (!plan.lose || plan.eat >= plan.floor - 1e-9)
      && plan.extraSteps >= 0 && plan.extraSteps % 100 === 0 && plan.extraSteps * H.hlStepKcal(p.kg) >= plan.extra - 1e-9 && Number.isFinite(plan.pct) && plan.safeBy >= "2026-10-23";
    if (!ok) bad++;
  }
  is("2,000 random goals: the sums hold, never under the floor, the steps cover the rest", bad, 0);
}

console.log("3. dates");
is("31 January + 1 month", H.hlAddMonths("2026-01-31", 1), "2026-02-28");
is("in a leap year", H.hlAddMonths("2028-01-31", 1), "2028-02-29");
is("across a year", H.hlAddMonths("2026-11-30", 3), "2027-02-28");
is("days between", H.hlDays("2026-10-23", "2027-01-23"), 92);
is("23 October 2026 is a Friday (Monday 0)", H.hlDow("2026-10-23"), 4);

console.log("4. to-dos");
const daily = { rep: "daily", from: "2026-10-17", len: 30, dows: [], done: {}, skip: {} };
is("every day for 30: on its first day, its 30th, not the 31st nor before it", ["2026-10-17", "2026-11-15", "2026-11-16", "2026-10-16"].map((k) => H.hlOn(daily, k)), [true, true, false, false]);
is("on 23 October it is day 7 of 30", (({ at, of }) => [at, of])(H.hlRun(daily, "2026-10-23")), [7, 30]);
const wk = { rep: "weekdays", from: "2026-10-19", len: 0, dows: [], done: {}, skip: {} };
is("weekdays: Friday yes, Saturday no, Monday yes", ["2026-10-23", "2026-10-24", "2026-10-26"].map((k) => H.hlOn(wk, k)), [true, false, true]);
const mwf = { rep: "days", from: "2026-10-01", len: 0, dows: [0, 2, 4], done: {}, skip: {} };
is("Mon · Wed · Fri", ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-23", "2026-10-25"].map((k) => H.hlOn(mwf, k)), [true, false, true, true, false]);
is("once: only its day", [H.hlOn({ rep: "once", from: "2026-10-23", done: {}, skip: {} }, "2026-10-23"), H.hlOn({ rep: "once", from: "2026-10-23", done: {}, skip: {} }, "2026-10-24")], [true, false]);
is("taken off one day only", ["2026-10-22", "2026-10-23"].map((k) => H.hlOn({ ...daily, skip: { "2026-10-22": 1 } }, k)), [false, true]);
const run = (done, k = "2026-10-23") => H.hlRun({ ...daily, done: Object.fromEntries(done.map((d) => [d, 1])) }, k).streak;
is("streak: three days before today, today not done yet", run(["2026-10-20", "2026-10-21", "2026-10-22"]), 3);
is("streak: and today done", run(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]), 4);
is("streak: a day missed", run(["2026-10-20", "2026-10-22"]), 1);
is("streak: Mon · Wed · Fri skips the days between", H.hlRun({ ...mwf, done: { "2026-10-19": 1, "2026-10-21": 1, "2026-10-23": 1 } }, "2026-10-23").streak, 3);

console.log("5. what is read back");
is("nothing, or rubbish: a blank start", [H.HL_EMPTY(H.cleanHealth(null)), H.HL_EMPTY(H.cleanHealth("x")), H.HL_EMPTY(H.cleanHealth({ steps: [1, 2] }))], [true, true, true]);
const read = H.cleanHealth({
  profile: { cm: 168, kg: 90, age: 999, sex: "x", act: 3, steps: 9000 },
  steps: { "2026-10-23": 9500, "nope": 4, "2026-10-22": -5 }, weights: { "2026-10-23": 90.2, "2026-10-22": 9000 },
  todos: [{ id: "a", text: "Stretch", from: "2026-10-01", rep: "weird", len: -3, done: { "2026-10-02": 1, bad: 1 } }, { id: "b", text: "  ", from: "2026-10-01" }],
  classes: [{ id: "c", name: "Calculus", dow: 0, from: "08:00", to: "09:40" }, { id: "d", name: "Backwards", dow: 1, from: "10:00", to: "09:00" }, { id: "e", name: "Sunday+", dow: 7, from: "08:00", to: "09:00" }],
  board: [{ id: "n", kind: "note", text: "hi", x: -40 }, { id: "p", kind: "pic", img: "../../etc" }, { id: "q", kind: "pic", img: "hl-123-abc" }],
  goal: { target: 75, by: "2027-01-23", from: "2027-02-01", start: 90 },
});
is("profile: age and sex and activity put right, the rest kept", read.profile, { cm: 168, kg: 90, age: 21, sex: "m", act: 1.375, steps: 9000, move: 500 });
is("steps and weights out of range are dropped", [read.steps, read.weights], [{ "2026-10-23": 9500 }, { "2026-10-23": 90.2 }]);
is("an empty to-do is dropped, a strange repeat is once", read.todos.map((t) => [t.id, t.rep, t.len, Object.keys(t.done)]), [["a", "once", 0, ["2026-10-02"]]]);
is("a class that ends before it starts, or on no day, is dropped", read.classes.map((c) => c.id), ["c"]);
is("a picture that is not Health's is dropped", read.board.map((c) => c.id), ["n", "q"]);
is("a goal that ends before it began is dropped", read.goal, null);
const own = H.hlOwn({ ...H.hlBlank(), steps: { "2026-10-22": 100, "2026-10-23": 200 }, todos: [{ id: "x", test: true }, { id: "y" }], goal: { target: 75, test: true },
  tests: { steps: { "2026-10-22": 1 }, weights: {}, profile: 1 }, profile: { ...H.hlBlank().profile, kg: 90 } });
is("a backup leaves the test entries behind", [own.steps, own.todos.map((t) => t.id), own.goal, own.profile.kg, own.tests], [{ "2026-10-23": 200 }, ["y"], null, 0, undefined]);

console.log("6. an Apple Health export");
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<HealthData locale="en_ID">\n` + [
  `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Rassam's iPhone" unit="count" startDate="2026-10-20 08:00:00 +0700" endDate="2026-10-20 08:10:00 +0700" value="1200"/>`,
  `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Rassam's iPhone" unit="count" startDate="2026-10-20 12:00:00 +0700" endDate="2026-10-20 12:10:00 +0700" value="3000"/>`,
  `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Rassam's Apple Watch" unit="count" startDate="2026-10-20 08:00:00 +0700" endDate="2026-10-20 08:10:00 +0700" value="4500"/>`,
  `<Record type="HKQuantityTypeIdentifierStepCount" sourceName="Rassam's iPhone" unit="count" startDate="2026-10-21 09:00:00 +0700" endDate="2026-10-21 09:30:00 +0700" value="6400"/>`,
  `<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Rassam's Apple Watch" unit="count/min" startDate="2026-10-21 09:00:00 +0700" endDate="2026-10-21 09:00:00 +0700" value="88"/>`,
  `<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Health" unit="kg" startDate="2026-10-20 07:00:00 +0700" endDate="2026-10-20 07:00:00 +0700" value="90.4"/>`,
  `<Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb" startDate="2026-10-21 07:00:00 +0700" endDate="2026-10-21 07:00:00 +0700" value="198.4"/>`,
].join("\n") + `\n</HealthData>\n`;
const want = { steps: { "2026-10-20": 4500, "2026-10-21": 6400 }, weights: { "2026-10-20": 90.4, "2026-10-21": 90 }, days: 2, from: "2026-10-20", to: "2026-10-21" };
// a file read a few bytes at a time, so every record is cut somewhere
const pieces = (text, n) => {
  const bytes = new TextEncoder().encode(text);
  return { name: "export.xml", type: "text/xml", size: bytes.length,
           stream: () => new ReadableStream({ start(ctl) { for (let i = 0; i < bytes.length; i += n) ctl.enqueue(bytes.slice(i, i + n)); ctl.close(); } }) };
};
for (const n of [7, 37, 4096]) is(`export.xml in pieces of ${n} bytes`, await H.hlAppleRead(pieces(xml, n)), want);
is("a file that is no export", await H.hlAppleRead(pieces("<html><body>hello</body></html>", 64)), null);
// the zip the Health app makes: a folder with export.xml and another file before it
const zip = (files) => {
  const loc = [], cen = [];
  let off = 0;
  for (const [name, text, deflate] of files) {
    const raw = Buffer.from(text), data = deflate ? zlib.deflateRawSync(raw) : raw, nm = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    loc.push(lh, nm, data); cen.push(ch, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new File([Buffer.concat([...loc, cd, end])], "export.zip", { type: "application/zip" });
};
is("export.zip, packed", await H.hlAppleRead(zip([["apple_health_export/export_cda.xml", "<ClinicalDocument/>", true], ["apple_health_export/export.xml", xml, true]])), want);
is("export.zip, stored", await H.hlAppleRead(zip([["apple_health_export/export.xml", xml, false]])), want);
is("a zip without export.xml", await H.hlAppleRead(zip([["notes.txt", "hello", true]])), null);

console.log("7. the file the iPhone's shortcut saves");
is("steps as a phone may write them", ["6240", "6.240", "6,240", "6 240", "6240.0", "6,240.5", "6.240,5", "12.345.678", "6240 steps"].map((x) => H.hlNumText(x, true)),
   [6240, 6240, 6240, 6240, 6240, 6240.5, 6240.5, 12345678, 6240]);
is("a weight as a phone may write it", ["90,2", "90.2", "90", "198.4", "1.234,5"].map((x) => H.hlNumText(x, false)), [90.2, 90.2, 90, 198.4, 1234.5]);
is("days: as written, or a moment with its zone on this Mac's calendar", ["2026-10-23", "  2026-10-23 ", "2026-02-30", "23/10/2026", "2026-10-22T23:30:00Z"].map(H.hlPhoneDay),
   ["2026-10-23", "2026-10-23", null, null, H.hlKey(new Date("2026-10-22T23:30:00Z"))]);
const file = ["flow-health", "2026-10-17;6240", "2026-10-18;9.120", "2026-10-19;11,034", "2026-10-20;0", "2026-10-21;7400", "2026-10-21;600", "rubbish", "2026-10-22;", "",
              "weight;2026-10-23;90,2;kg"].join("\n");
is("a week from the phone", H.hlPhoneRead(file),
   { steps: { "2026-10-17": 6240, "2026-10-18": 9120, "2026-10-19": 11034, "2026-10-20": 0, "2026-10-21": 8000 }, weights: { "2026-10-23": 90.2 }, days: 5, from: "2026-10-17", to: "2026-10-21" });
is("the weight in pounds, and in stone", [H.hlPhoneRead("weight;2026-10-23;198.4;lb").weights, H.hlPhoneRead("weight;2026-10-23;14.2;st").weights],
   [{ "2026-10-23": 90 }, { "2026-10-23": 90.2 }]);
is("written with Windows line ends", H.hlPhoneRead("flow-health\r\n2026-10-23;5000\r\n").steps, { "2026-10-23": 5000 });
is("no weight found that day: the line is passed over", H.hlPhoneRead("flow-health\n2026-10-23;5000\nweight;;;").weights, {});
is("nothing readable", [H.hlPhoneRead("flow-health\nweight;;;"), H.hlPhoneRead(""), H.hlPhoneRead(null), H.hlPhoneRead("23/10/2026;5000")], [null, null, null, null]);
is("a step count out of range is passed over", H.hlPhoneRead("2026-10-23;-5\n2026-10-22;900000\n2026-10-21;12").steps, { "2026-10-21": 12 });

console.log(`\n${checks - fails} of ${checks} checks pass${fails ? `, ${fails} FAIL` : ""}`);
process.exit(fails ? 1 : 0);
