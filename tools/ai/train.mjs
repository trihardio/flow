/* Trains the on-device categoriser that runs on top of the bundled embedding model.
   1. Scores it on the held-out notes in tests.json (those notes are left out of training for this step).
   2. Trains the final version on everything and writes electron/ai-head.json, which the app loads.
   usage: npm run train-ai
   ONLY=sym npm run train-ai trains the symbol picker alone and leaves the other two in ai-head.json as they are. */
import fs from "node:fs";
import path from "node:path";
import { getLlama } from "node-llama-cpp";
import { HERE, ROOT, norm, readList, appRules, trainHead, prep, SCALE } from "./lib.mjs";
import { classify, unpack, loadHeads, saveHeads } from "../../electron/ai-classify.mjs";

const PREFIX = "task: classification | query: ";       // the prompt format this embedding model was trained with
const KNN = { k: 5, weight: 0.5, sharp: 12 };           // how the similar-notes vote is blended in
const modelPath = process.argv[2] || path.join(ROOT, "models", "flow-ai.gguf");
const tests = JSON.parse(fs.readFileSync(path.join(HERE, "tests.json"), "utf8"));
const { inferCat, inferGoalIcon, inferSym } = appRules();
const file = process.env.OUT || path.join(ROOT, "electron", "ai-head.json");      // OUT: write the head elsewhere (to try another model without touching the app's)
const kept = process.env.ONLY === "sym" ? loadHeads(file) : null;
// the symbol of an expense in Other: an answer it is not sure enough of is none ("apps"): a wrong symbol is worse than
// the plain one. The floor is set from the held-out notes (FLOOR=0 SHOW=1 prints how sure it was of each answer)
const SYM_NONE = "apps", SYM_FLOOR = process.env.FLOOR ? +process.env.FLOOR : 0.55;

// hand-written lists win over teacher-written ones when both label the same note
const merge = (...lists) => { const m = new Map(); for (const l of lists) for (const r of l) if (!m.has(r.text)) m.set(r.text, r); return [...m.values()]; };
const optional = (file) => (fs.existsSync(path.join(HERE, file)) && !process.env.NO_DISTILLED ? readList(file) : []);
const catAll = merge(readList("cats.txt"), readList("cats2.txt"), optional("distilled.txt"));
const goalAll = readList("goals.txt");
const symAll = readList("syms.txt");

const catTests = {}, goalTests = {};
for (const set of ["catsA", "catsB"]) catTests[set] = Object.entries(tests[set]).flatMap(([label, list]) => list.map((text) => ({ text: norm(text), label, ok: [label] })));
for (const set of ["goalsA", "goalsB"]) goalTests[set] = Object.entries(tests[set]).map(([text, ok]) => ({ text: norm(text), ok: ok.split("|"), label: ok.split("|")[0] }));
const symTests = { symsA: Object.entries(tests.symsA).map(([text, ok]) => ({ text: norm(text), ok: ok.split("|"), label: ok.split("|")[0] })) };
const held = new Set([...Object.values(catTests), ...Object.values(goalTests), ...Object.values(symTests)].flat().map((r) => r.text));

const llama = await getLlama({ build: "never", logLevel: "error" });
const model = await llama.loadModel({ modelPath });
const ctx = await model.createEmbeddingContext();
const cacheFile = process.env.EMBED_CACHE || "";
const cache = cacheFile && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
const embed = async (text) => {
  if (!cache[text]) cache[text] = Array.from((await ctx.getEmbeddingFor(PREFIX + text)).vector, (v) => +v.toFixed(5));
  return cache[text];
};

// a head = linear classifier + the training notes themselves (as 8-bit vectors) for the similar-notes vote
const fit = async (rows, more) => {
  const labels = [...new Set(rows.map((r) => r.label))];
  const y = rows.map((r) => labels.indexOf(r.label));
  const X = [];
  for (const r of rows) X.push(prep(await embed(r.text)));
  const lin = trainHead(X, y, labels);
  const d = lin.d, bytes = new Int8Array(rows.length * d);
  let peak = 0;
  for (const x of X) for (let j = 0; j < d; j++) peak = Math.max(peak, Math.abs(x[j]));
  X.forEach((x, i) => { for (let j = 0; j < d; j++) bytes[i * d + j] = Math.round((x[j] / peak) * 127); });
  return {
    prefix: PREFIX, scale: SCALE, labels, d,
    W: lin.W.map((v) => +v.toFixed(5)), b: lin.b.map((v) => +v.toFixed(5)),
    knn: { ...KNN, ...more, y, vectors: Buffer.from(bytes.buffer).toString("base64") },
  };
};

console.log(`notes: ${catAll.length} expenses, ${goalAll.length} goals, ${symAll.length} symbols`);
// 1. held-out score, counting only notes the app's keyword rules don't already catch
const report = async (name, all, sets, caught, more) => {
  const head = unpack(await fit(all.filter((r) => !held.has(r.text)), more));
  let ok = 0, n = 0;
  for (const [set, rows] of Object.entries(sets)) {
    const ai = rows.filter((r) => !caught(r.text)), wrong = [], ruled = rows.filter((r) => caught(r.text));
    if (ruled.length) console.log(`${name} ${set}: the app's own words place ${ruled.length} more, ${ruled.filter((r) => r.ok.includes(caught(r.text))).length} right${process.env.SHOW ? `\n   wrong: ${ruled.filter((r) => !r.ok.includes(caught(r.text))).map((r) => `${r.text}>${caught(r.text)}`).join("; ")}` : ""}`);
    const sure = { right: [], wrong: [] }, info = {};
    for (const r of ai) { const p = classify(head, await embed(r.text), null, info); if (!r.ok.includes(p)) wrong.push(`${r.text}>${p}`); sure[r.ok.includes(p) ? "right" : "wrong"].push(info.score); }
    if (more) console.log(`${name} ${set}: of the ${wrong.length} not right, ${wrong.filter((w) => w.endsWith(`>${more.none}`)).length} were left plain and ${wrong.filter((w) => !w.endsWith(`>${more.none}`)).length} got a wrong one`);
    if (more && process.env.SHOW) for (const k of ["right", "wrong"]) console.log(`   how sure, ${k}: ${sure[k].sort((a, b) => a - b).map((v) => v.toFixed(2)).join(" ")}`);
    ok += ai.length - wrong.length; n += ai.length;
    console.log(`${name} ${set}: ${ai.length - wrong.length}/${ai.length} = ${(100 * (ai.length - wrong.length) / ai.length).toFixed(0)}%${process.env.SHOW ? `\n   wrong: ${wrong.join("; ")}` : ""}`);
  }
  console.log(`${name} total: ${ok}/${n} = ${(100 * ok / n).toFixed(1)}%`);
  return head;
};
if (!kept) {
  await report("expenses", catAll, catTests, inferCat);
  await report("goals", goalAll, goalTests, inferGoalIcon);
}
const symMore = { floor: SYM_FLOOR, none: SYM_NONE };
{
  // notes that name nothing in particular: they should be left with the plain symbol
  const head = await report("symbols", symAll, symTests, inferSym, symMore), none = [], info = {};
  for (const text of tests.symsNone.map(norm)) none.push([text, classify(head, await embed(text), null, info), info.score]);
  console.log(`symbols, notes that name nothing: ${none.filter((r) => r[1] === SYM_NONE).length}/${none.length} left plain${process.env.SHOW ? `\n   ${none.map((r) => `${r[0]}>${r[1]} ${r[2].toFixed(2)}`).join("; ")}` : ""}`);
}

// 2. final heads, trained on everything including the test notes
if (!process.env.DRY) {
  const cat = kept ? kept.cat : await fit(merge(catAll, Object.values(catTests).flat()));
  const goal = kept ? kept.goal : await fit(merge(goalAll, Object.values(goalTests).flat()));
  const sym = await fit(merge(symAll, Object.values(symTests).flat()), symMore);
  saveHeads(file, { cat, goal, sym });
  console.log(`wrote ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB) and its .bin (${(fs.statSync(file.replace(/\.json$/, "") + ".bin").size / 1e6).toFixed(1)} MB)`);
}
if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(cache));
process.exit(0);
