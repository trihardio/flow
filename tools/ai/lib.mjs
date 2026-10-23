/* Shared pieces for training and testing the on-device categoriser. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(HERE, "..", "..");

export const norm = (t) => String(t).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

// "# label" headers followed by comma-separated notes
export const readList = (file) => {
  const out = [];
  let label = null;
  for (const raw of fs.readFileSync(path.join(HERE, file), "utf8").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const m = line.match(/^#\s*([a-z0-9_]+)\s*$/);
      if (m) label = m[1];
      continue;
    }
    for (const part of line.split(",")) {
      const text = norm(part);
      if (text && label) out.push({ text, label });
    }
  }
  const seen = new Set();
  return out.filter((r) => (seen.has(r.text + "|" + r.label) ? false : (seen.add(r.text + "|" + r.label), true)));
};

// the app's own keyword rules, read straight out of App.jsx so tests only count notes that reach the AI
export const appRules = () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "App.jsx"), "utf8");
  const cut = (from, to) => { const a = src.indexOf(from); const b = src.indexOf(to, a); return src.slice(a, b); };
  const code = cut("const GOAL_ICON_RULES", "/* goal progress bar") + cut("const CAT_RULES", "const HamburgerIcon");
  return new Function(`${code}; return { inferCat, inferGoalIcon, inferSym };`)();
};

/* ---- softmax classifier on top of sentence embeddings ---- */
export const trainHead = (X, y, labels, { epochs = 500, lr = 0.05, l2 = 1e-4, log = false } = {}) => {
  const n = X.length, d = X[0].length, k = labels.length;
  const W = new Float64Array(k * d), b = new Float64Array(k);
  const mW = new Float64Array(k * d), vW = new Float64Array(k * d), mb = new Float64Array(k), vb = new Float64Array(k);
  const count = new Array(k).fill(0); y.forEach((c) => count[c]++);
  const cw = count.map((c) => n / (k * Math.max(c, 1)));       // rarer classes weigh more
  const gW = new Float64Array(k * d), gb = new Float64Array(k), p = new Float64Array(k);
  for (let ep = 1; ep <= epochs; ep++) {
    gW.fill(0); gb.fill(0); let loss = 0;
    for (let i = 0; i < n; i++) {
      const x = X[i]; let mx = -Infinity;
      for (let c = 0; c < k; c++) { let s = b[c]; const o = c * d; for (let j = 0; j < d; j++) s += W[o + j] * x[j]; p[c] = s; if (s > mx) mx = s; }
      let z = 0; for (let c = 0; c < k; c++) { p[c] = Math.exp(p[c] - mx); z += p[c]; }
      const w = cw[y[i]];
      for (let c = 0; c < k; c++) {
        const g = (p[c] / z - (c === y[i] ? 1 : 0)) * w; gb[c] += g; const o = c * d;
        for (let j = 0; j < d; j++) gW[o + j] += g * x[j];
      }
      loss -= Math.log(p[y[i]] / z + 1e-12) * w;
    }
    const b1 = 0.9, b2 = 0.999, t1 = 1 - Math.pow(b1, ep), t2 = 1 - Math.pow(b2, ep);
    for (let q = 0; q < k * d; q++) {
      const g = gW[q] / n + l2 * W[q];
      mW[q] = b1 * mW[q] + (1 - b1) * g; vW[q] = b2 * vW[q] + (1 - b2) * g * g;
      W[q] -= lr * (mW[q] / t1) / (Math.sqrt(vW[q] / t2) + 1e-8);
    }
    for (let c = 0; c < k; c++) {
      const g = gb[c] / n;
      mb[c] = b1 * mb[c] + (1 - b1) * g; vb[c] = b2 * vb[c] + (1 - b2) * g * g;
      b[c] -= lr * (mb[c] / t1) / (Math.sqrt(vb[c] / t2) + 1e-8);
    }
    if (log && ep % 100 === 0) console.log(`  epoch ${ep} loss ${(loss / n).toFixed(4)}`);
  }
  return { labels, d, W: Array.from(W), b: Array.from(b) };
};

export const predict = (head, x) => {
  const { labels, d, W, b } = head; let best = 0, bs = -Infinity;
  for (let c = 0; c < labels.length; c++) { let s = b[c]; const o = c * d; for (let j = 0; j < d; j++) s += W[o + j] * x[j]; if (s > bs) { bs = s; best = c; } }
  return labels[best];
};

// embeddings are unit length; scaling them up lets the classifier learn in fewer steps
export const SCALE = 8;
export const prep = (v) => { let s = 0; for (const a of v) s += a * a; s = Math.sqrt(s) || 1; return Float64Array.from(v, (a) => (a / s) * SCALE); };
