/* On-device AI helper. Runs in its own process, loads the bundled model only when first asked,
   and quits after a few idle minutes so its memory goes back to the Mac. Never touches the internet.
   The model turns a note into numbers (an embedding); ai-head.json (built by tools/ai/train.mjs)
   holds what was learned from thousands of labelled notes and turns those numbers into a category
   or a goal icon. */
import fs from "node:fs";
import { getLlama } from "node-llama-cpp";
import { classify, unpack, norm, loadHeads } from "./ai-classify.mjs";

const [MODEL_PATH, HEAD_PATH] = process.argv.slice(2);
const IDLE_MS = 5 * 60 * 1000;
const heads = loadHeads(HEAD_PATH);
for (const head of Object.values(heads)) unpack(head);

let engine = null;                 // promise of the embedding context
const load = () => {
  if (!engine) {
    engine = (async () => {
      const llama = await getLlama({ build: "never", logLevel: "error" });
      const model = await llama.loadModel({ modelPath: MODEL_PATH });
      return model.createEmbeddingContext();
    })();
    engine.catch(() => { engine = null; });   // a failed load is tried again on the next question, not kept failed
  }
  return engine;
};

const answer = async ({ kind, text, labels }) => {
  if (kind === "warm") { await load(); return "ok"; }       // first launch: get the slow one-time setup out of the way
  const head = heads[kind];
  if (!head) return null;
  const ctx = await load();
  const { vector } = await ctx.getEmbeddingFor(head.prefix + norm(text));
  return classify(head, vector, labels);
};

let idle = null;
const restIdle = () => { clearTimeout(idle); idle = setTimeout(() => process.exit(0), IDLE_MS); };

// one question at a time: they share a single model context
let chain = Promise.resolve();
process.parentPort.on("message", (e) => {
  const req = e.data;
  restIdle();
  chain = chain.then(async () => {
    let result = null;
    try { result = await answer(req); } catch (err) { result = null; }
    process.parentPort.postMessage({ id: req.id, result });
    restIdle();
  });
});
restIdle();
