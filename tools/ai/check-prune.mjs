/* Proves a pruned model (tools/ai/prune-vocab.mjs) gives what the full one gives (22 October 2026).
     node tools/ai/check-prune.mjs <full.gguf> <pruned.gguf>
   Every note in the training and test files, as the app asks (the heads' prefix, then the note), plus a set of odd
   ones (accents, emoji, symbols, scripts left out): each is cut into pieces by both models and the pieces compared
   (the pruned model's ids turned back into the full one's); then a sample is turned into numbers by both and the
   largest difference printed. A note of characters the pruned model keeps must come out the same piece for piece. */
import fs from "node:fs";
import path from "node:path";
import { getLlama } from "node-llama-cpp";
import { HERE, readList, norm } from "./lib.mjs";

const [, , fullPath, prunedPath] = process.argv;
const keep = JSON.parse(fs.readFileSync(prunedPath.replace(/\.gguf$/, "") + ".keep.json", "utf8"));
const PREFIX = "task: classification | query: ";
const notes = new Set();
for (const f of ["cats.txt", "cats2.txt", "goals.txt", "distilled.txt", "syms.txt"]) if (fs.existsSync(path.join(HERE, f))) for (const r of readList(f)) notes.add(r.text);
const walk = (v) => { if (typeof v === "string") notes.add(norm(v)); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
const tests = JSON.parse(fs.readFileSync(path.join(HERE, "tests.json"), "utf8")); delete tests._about; walk(tests);
const odd = ["café latte", "crème brûlée", "kopi ☕", "🍜 mie ayam", "gift 🎁 for mama", "rp 50.000 parkir", "€ 20 souvenir", "naïve résumé print", "ramen 東京", "شاورما", "ข้าวผัด", "netflix + spotify", "sewa kos — oktober", "50% off sepatu", "makan @ warteg #hemat"];
odd.forEach((t) => notes.add(norm(t)));
const list = [...notes];
console.log("notes:", list.length);

const llama = await getLlama({ build: "never", logLevel: "error" });
const run = async (p, sample) => {
  const model = await llama.loadModel({ modelPath: p });
  const toks = list.map((t) => Array.from(model.tokenize(PREFIX + t)));
  const ctx = await model.createEmbeddingContext();
  const vecs = [];
  for (const t of sample) vecs.push(Array.from((await ctx.getEmbeddingFor(PREFIX + t)).vector));
  await ctx.dispose(); await model.dispose();
  return { toks, vecs };
};
const sample = [...list.filter((_, i) => i % Math.max(1, Math.floor(list.length / 300)) === 0), ...odd.map(norm)];
const A = await run(fullPath, sample), B = await run(prunedPath, sample);
const ascii = (t) => [...t].every((ch) => { const cp = ch.codePointAt(0); return cp <= 0xff || (cp >= 0x2000 && cp <= 0x2bff) || cp === 0xfe0f || cp === 0x200d || (cp >= 0x1f000 && cp <= 0x1faff); });
let same = 0, differ = [], differKept = [];
list.forEach((t, i) => {
  const back = B.toks[i].map((id) => keep[id]);
  if (back.length === A.toks[i].length && back.every((id, k) => id === A.toks[i][k])) same++;
  else (ascii(t) ? differKept : differ).push(t);
});
console.log(`cut the same: ${same} of ${list.length}`);
console.log(`cut differently, characters the pruned model keeps: ${differKept.length}${differKept.length ? " · " + differKept.slice(0, 8).join(" | ") : ""}`);
console.log(`cut differently, characters it leaves out (expected): ${differ.length}${differ.length ? " · " + differ.slice(0, 8).join(" | ") : ""}`);
let worst = 0, worstKept = 0;
sample.forEach((t, i) => {
  let d = 0; for (let k = 0; k < A.vecs[i].length; k++) d = Math.max(d, Math.abs(A.vecs[i][k] - B.vecs[i][k]));
  worst = Math.max(worst, d); if (ascii(t)) worstKept = Math.max(worstKept, d);
});
console.log(`numbers compared on ${sample.length} notes: largest difference ${worstKept} on notes of kept characters, ${worst} on all`);
