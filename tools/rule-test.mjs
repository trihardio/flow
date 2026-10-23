/* Checks the monthly spending rule's sums (15 October 2026), read out of App.jsx between its markers.
   usage: node tools/rule-test.mjs */
import fs from "node:fs";
const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const a = src.indexOf("/* ---------- the monthly spending rule (15 October"), b = src.indexOf("/* ---------- the monthly spending rule: end of the sums");
const R = new Function(`${src.slice(a, b)}; return { RULE_FAMS, ruleFrom, cleanRule, cleanRuleByMonth, ruleSpendPct, ruleStand, ruleDaily };`)();
let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; if (!ok) console.log("FAIL", name, "got", JSON.stringify(got), "want", JSON.stringify(want)); };
// every preset of every family adds up to 100 and comes back whole through cleanRule
for (const [fam, F] of Object.entries(R.RULE_FAMS)) for (const [name, p] of F.presets) {
  eq(`${name} adds to 100`, p.reduce((x, y) => x + y, 0), 100);
  const r = R.ruleFrom(fam, p); eq(`${name} name`, r.name, name); eq(`${name} survives cleanRule`, R.cleanRule(r), r);
}
// a rule that doesn't add up, or a stranger, is no rule
eq("total 90 refused", R.cleanRule(R.ruleFrom("ss", [60, 30])), null);
eq("unknown family", R.cleanRule({ fam: "x", parts: [] }), null);
eq("map to a save part refused", R.cleanRule({ ...R.ruleFrom("nws", [50, 30, 20]), map: { food: "save" } }).map.food, "needs");
eq("own split named", R.ruleFrom("ss", [65, 35]).name, "65/35");
eq("byMonth keeps false, drops broken", R.cleanRuleByMonth({ "2026-10": false, "2026-11": { fam: "ss", parts: [] }, bad: false }), { "2026-10": false });
// 50/30/20 on 10jt: needs 4jt (food 3jt + bills 1jt), wants 2,5jt, the rest 3,5jt saved
const r = R.ruleFrom("nws", [50, 30, 20]);
const items = [{ amount: 3e6, cat: "food" }, { amount: 1e6, cat: "bills" }, { amount: 2.5e6, cat: "shopping" }];
eq("50/30/20 stand", R.ruleStand(r, 10e6, items).map((p) => [p.k, p.got, p.target, p.state]),
   [["needs", 4e6, 5e6, "ok"], ["wants", 2.5e6, 3e6, "ok"], ["save", 3.5e6, 2e6, "ok"]]);
eq("near from 90%", R.ruleStand(r, 10e6, [{ amount: 2.8e6, cat: "shopping" }])[1].state, "near");
eq("over", R.ruleStand(r, 10e6, [{ amount: 6e6, cat: "food" }])[0].state, "over");
eq("save short", R.ruleStand(r, 10e6, [{ amount: 9e6, cat: "food" }])[2], { k: "save", label: "Save", kind: "save", pct: 20, target: 2e6, got: 1e6, state: "short" });
// a Savings-symbol expense is saved, not spent; a charity one is Social in 40/30/20/10
const idn = R.ruleFrom("idn", [40, 30, 20, 10]);
const st = R.ruleStand(idn, 10e6, [{ amount: 1e6, cat: "other", sym: "savings" }, { amount: 5e5, cat: "other", sym: "volunteer_activism" }, { amount: 2e6, cat: "bills" }, { amount: 3e6, cat: "food" }]);
eq("40/30/20/10 stand", st.map((p) => [p.k, p.got]), [["daily", 3e6], ["oblig", 2e6], ["save", 4.5e6], ["social", 5e5]]);
// the 60% Solution: what is left fills long-term first, retirement takes the rest
const six = R.ruleStand(R.ruleFrom("sixty", [60, 10, 10, 10, 10]), 10e6, [{ amount: 8.5e6, cat: "food" }]);
eq("60% saves in turn", six.filter((p) => p.kind === "save").map((p) => [p.k, p.got, p.state]), [["long", 1e6, "ok"], ["retire", 5e5, "short"]]);
// the daily limit: spend share over the days, in whole thousands; none without income or with the switch off
eq("70/30 on 5jt over 31 days", R.ruleDaily(R.ruleFrom("ss", [70, 30]), 5e6, 31), 113000);
eq("no income", R.ruleDaily(R.ruleFrom("ss", [70, 30]), 0, 31), null);
eq("limit off", R.ruleDaily(R.ruleFrom("ss", [70, 30], null, false), 5e6, 31), null);
eq("30/70 spend share", R.ruleSpendPct(R.ruleFrom("ss", [30, 70])), 30);
eq("40/30/20/10 spend share", R.ruleSpendPct(idn), 80);
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
