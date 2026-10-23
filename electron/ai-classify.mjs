import fs from "node:fs";
/* Turns a note's embedding into a label. Shared by the app (ai.mjs) and the trainer (tools/ai/train.mjs)
   so the accuracy measured at training time is exactly what the app does.
   Two opinions are averaged: a trained linear classifier, and the labels of the most similar known notes. */

export const norm = (t) => String(t).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

/* ai-head.json holds the heads; their stored example notes (8-bit vectors, most of the size) are raw bytes in
   ai-head.bin beside it (23 October 2026, making the app smaller: as base64 text inside the JSON they took a third
   more room and had to be decoded at every start). Each head's knn.bin says where its bytes are. A head with its
   vectors still in base64 (an older file, or one just trained) is read as before. */
const binOf = (jsonPath) => jsonPath.replace(/\.json$/, "") + ".bin";
export const loadHeads = (jsonPath) => {
  const heads = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const parts = Object.values(heads).filter((h) => h && h.knn && h.knn.bin);
  if (parts.length) {
    const all = fs.readFileSync(binOf(jsonPath));
    for (const h of parts) { h.knn.vectors = all.subarray(h.knn.bin[0], h.knn.bin[0] + h.knn.bin[1]); delete h.knn.bin; }
  }
  return heads;
};
export const saveHeads = (jsonPath, heads) => {
  const chunks = [], out = {};
  let at = 0;
  for (const [k, h] of Object.entries(heads)) {
    const v = h.knn.vectors, bytes = Buffer.isBuffer(v) ? v : Buffer.from(v, "base64");
    chunks.push(bytes);
    out[k] = { ...h, knn: { ...h.knn, vectors: undefined, bin: [at, bytes.length] } };
    at += bytes.length;
  }
  fs.writeFileSync(binOf(jsonPath), Buffer.concat(chunks));
  fs.writeFileSync(jsonPath, JSON.stringify(out));
};

// call once after loading the heads: unpacks the stored example notes
export const unpack = (head) => {
  const bytes = Buffer.isBuffer(head.knn.vectors) ? head.knn.vectors : Buffer.from(head.knn.vectors, "base64");
  head.V = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length);
  head.Vlen = new Float64Array(head.knn.y.length);
  for (let i = 0; i < head.Vlen.length; i++) {
    let s = 0;
    const o = i * head.d;
    for (let j = 0; j < head.d; j++) s += head.V[o + j] * head.V[o + j];
    head.Vlen[i] = Math.sqrt(s) || 1;
  }
  return head;
};

export const classify = (head, vector, allowed, info) => {
  const { labels, d, W, b, knn } = head;
  let len = 0;
  for (let j = 0; j < d; j++) len += vector[j] * vector[j];
  len = Math.sqrt(len) || 1;

  // 1. linear classifier -> probabilities
  const p = new Array(labels.length);
  let top = -Infinity;
  for (let c = 0; c < labels.length; c++) {
    let s = 0;
    const o = c * d;
    for (let j = 0; j < d; j++) s += W[o + j] * vector[j];
    p[c] = b[c] + (s * head.scale) / len;            // it was trained on unit-length vectors times `scale`
    if (p[c] > top) top = p[c];
  }
  let z = 0;
  for (let c = 0; c < labels.length; c++) { p[c] = Math.exp(p[c] - top); z += p[c]; }
  for (let c = 0; c < labels.length; c++) p[c] /= z;

  // 2. the k most similar known notes vote, closer ones counting more
  const n = knn.y.length;
  const best = [];                                    // [similarity, label index], kept sorted, at most k long
  for (let i = 0; i < n; i++) {
    let s = 0;
    const o = i * d;
    for (let j = 0; j < d; j++) s += head.V[o + j] * vector[j];
    s /= head.Vlen[i] * len;
    if (best.length < knn.k || s > best[best.length - 1][0]) {
      let at = best.length;
      while (at > 0 && best[at - 1][0] < s) at--;
      best.splice(at, 0, [s, knn.y[i]]);
      if (best.length > knn.k) best.pop();
    }
  }
  const q = new Array(labels.length).fill(0);
  let qz = 0;
  for (const [s, c] of best) { const w = Math.exp((s - 1) * knn.sharp); q[c] += w; qz += w; }

  // 3. blend, then take the best label the caller allows
  let pick = null, pickScore = -Infinity;
  for (let c = 0; c < labels.length; c++) {
    if (allowed && !allowed.includes(labels[c])) continue;
    const score = (1 - knn.weight) * p[c] + knn.weight * (qz ? q[c] / qz : 0);
    if (score > pickScore) { pickScore = score; pick = labels[c]; }
  }
  if (info) info.score = pickScore;
  // a head with a floor (the symbols of "Other"): an answer it is not sure enough of is no answer in particular
  if (knn.floor && pickScore < knn.floor) return !allowed || allowed.includes(knn.none) ? knn.none : null;
  return pick;
};
