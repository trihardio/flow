/* Makes the on-device model smaller without changing what it gives for a note (22 October 2026, his words: "condense
   the app so it doesnt take too much space in my computer when downloaded").
     node tools/ai/prune-vocab.mjs <in.gguf> <out.gguf>
   Of the model's 322 MB, 214 MB is its word table: 262,144 pieces of text, each with 768 numbers. Most are pieces of
   scripts no note in Flow is written in (Chinese, Japanese, Arabic, Thai, Hindi …). The tokenizer only ever cuts a text
   into pieces that are in that text (or into bytes, for a character it has no piece for). So keeping every piece made
   only of the characters below, all bytes and the real control pieces, any note made of those characters is cut exactly
   as before, into the same pieces with the same numbers: what the model gives for it does not change. The pieces kept
   keep their order, so the first ids (pad 0, eos 1, bos 2, unk 3) stay what they were.
   Kept characters: Latin-1 (English, Indonesian, Malay, and accents like é), general punctuation, currency, symbols,
   arrows, the space mark the tokenizer uses (▁), and emoji. tools/ai/check-prune.mjs proves it on every note. */
import fs from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error("usage: node tools/ai/prune-vocab.mjs <in.gguf> <out.gguf>"); process.exit(1); }
const keepChar = (cp) => cp <= 0x00ff || (cp >= 0x2000 && cp <= 0x2bff) || cp === 0xfe0f || cp === 0x200d || (cp >= 0x1f000 && cp <= 0x1faff);

const buf = fs.readFileSync(inPath);
let at = 0;
const u32 = () => { const v = buf.readUInt32LE(at); at += 4; return v; };
const u64 = () => { const v = buf.readBigUInt64LE(at); at += 8; return v; };
const str = () => { const n = Number(u64()); const s = buf.toString("utf8", at, at + n); at += n; return s; };
const SIZE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
// a value, read as its raw bytes (kept as they are unless rebuilt below); arrays of strings are read one by one
const value = (type) => {
  const from = at;
  if (type === 8) { str(); return { type, raw: buf.subarray(from, at) }; }
  if (type === 9) {
    const et = u32(), n = Number(u64());
    if (et === 8) { const items = []; for (let i = 0; i < n; i++) items.push(str()); return { type, et, items, raw: buf.subarray(from, at) }; }
    const size = SIZE[et]; at += size * n;
    return { type, et, n, data: buf.subarray(from + 12, at), raw: buf.subarray(from, at) };
  }
  at += SIZE[type];
  return { type, raw: buf.subarray(from, at) };
};

if (buf.toString("ascii", 0, 4) !== "GGUF") throw new Error("not a GGUF file");
at = 4;
const version = u32(), nTensors = Number(u64()), nKv = Number(u64());
const kvs = [];
for (let i = 0; i < nKv; i++) { const key = str(), type = u32(); kvs.push({ key, ...value(type) }); }
const tensors = [];
for (let i = 0; i < nTensors; i++) {
  const name = str(), nd = u32(), dims = []; for (let d = 0; d < nd; d++) dims.push(u64());
  tensors.push({ name, dims, type: u32(), offset: u64() });
}
const kv = (k) => kvs.find((x) => x.key === k);
const alignKv = kv("general.alignment"), align = alignKv ? alignKv.raw.readUInt32LE(0) : 32;
const dataStart = Math.ceil(at / align) * align;

// which pieces stay
const tokens = kv("tokenizer.ggml.tokens").items, types = kv("tokenizer.ggml.token_type"), scores = kv("tokenizer.ggml.scores");
const typeOf = (i) => types.data.readInt32LE(i * 4);
const keep = [];
for (let i = 0; i < tokens.length; i++) {
  const ty = typeOf(i);
  if (ty === 2 || ty === 6) keep.push(i);                                            // unknown, bytes
  else if (ty === 3) { if (!/^<unused\d+>$/.test(tokens[i])) keep.push(i); }        // real control pieces only
  else if (ty === 5) continue;                                                       // unused
  else if ([...tokens[i]].every((ch) => keepChar(ch.codePointAt(0)))) keep.push(i);
}
const newId = new Map(keep.map((old, i) => [old, i]));
for (const k of ["bos_token_id", "eos_token_id", "unknown_token_id", "padding_token_id"]) {
  const x = kv(`tokenizer.ggml.${k}`); if (!x) continue;
  const old = x.raw.readUInt32LE(0);
  if (!newId.has(old)) throw new Error(`${k} ${old} would be dropped`);
  const b = Buffer.alloc(4); b.writeUInt32LE(newId.get(old)); x.raw = b;
}

// the three token arrays, rebuilt with the pieces kept
const strArray = (items) => {
  const parts = [Buffer.alloc(12)]; parts[0].writeUInt32LE(8, 0); parts[0].writeBigUInt64LE(BigInt(items.length), 4);
  for (const s of items) { const b = Buffer.from(s, "utf8"), h = Buffer.alloc(8); h.writeBigUInt64LE(BigInt(b.length)); parts.push(h, b); }
  return Buffer.concat(parts);
};
const numArray = (et, src) => {
  const h = Buffer.alloc(12); h.writeUInt32LE(et, 0); h.writeBigUInt64LE(BigInt(keep.length), 4);
  const out = Buffer.alloc(keep.length * 4); keep.forEach((old, i) => src.copy(out, i * 4, old * 4, old * 4 + 4));
  return Buffer.concat([h, out]);
};
kv("tokenizer.ggml.tokens").raw = strArray(keep.map((i) => tokens[i]));
types.raw = numArray(types.et, types.data);
scores.raw = numArray(scores.et, scores.data);

// the tensors: the word table keeps its rows in the same order; the rest is copied as it is
const ROW = { 0: (n) => n * 4, 1: (n) => n * 2, 8: (n) => (n / 32) * 34 };
const sizeOf = (t, rows) => { const per = ROW[t.type]; if (!per) throw new Error(`tensor type ${t.type} not handled`); return per(Number(t.dims[0])) * rows; };
const blobs = tensors.map((t, i) => {
  const next = i + 1 < tensors.length ? Number(tensors[i + 1].offset) : buf.length - dataStart;
  const src = buf.subarray(dataStart + Number(t.offset), dataStart + next);
  if (t.name !== "token_embd.weight") return src.subarray(0, sizeOf(t, t.dims.slice(1).reduce((a, d) => a * Number(d), 1)));
  if (Number(t.dims[1]) !== tokens.length) throw new Error("word table and tokens differ in length");
  const row = sizeOf(t, 1), out = Buffer.alloc(row * keep.length);
  keep.forEach((old, i) => src.copy(out, i * row, old * row, old * row + row));
  t.dims = [t.dims[0], BigInt(keep.length)];
  return out;
});

// written back: header, the settings, the tensors' list with new places, then the data, each part aligned
const parts = [];
const head = Buffer.alloc(24); head.write("GGUF", 0, "ascii"); head.writeUInt32LE(version, 4); head.writeBigUInt64LE(BigInt(nTensors), 8); head.writeBigUInt64LE(BigInt(nKv), 16);
parts.push(head);
const sBuf = (s) => { const b = Buffer.from(s, "utf8"), h = Buffer.alloc(8); h.writeBigUInt64LE(BigInt(b.length)); return Buffer.concat([h, b]); };
for (const x of kvs) { const t = Buffer.alloc(4); t.writeUInt32LE(x.type); parts.push(sBuf(x.key), t, x.raw); }
let off = 0;
const pad = (n) => Math.ceil(n / align) * align;
tensors.forEach((t, i) => {
  const nd = Buffer.alloc(4); nd.writeUInt32LE(t.dims.length); parts.push(sBuf(t.name), nd);
  for (const d of t.dims) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(d)); parts.push(b); }
  const tail = Buffer.alloc(12); tail.writeUInt32LE(t.type, 0); tail.writeBigUInt64LE(BigInt(off), 4); parts.push(tail);
  off = pad(off + blobs[i].length);
});
let size = parts.reduce((a, b) => a + b.length, 0);
parts.push(Buffer.alloc(pad(size) - size));
blobs.forEach((b) => { parts.push(b); parts.push(Buffer.alloc(pad(b.length) - b.length)); });
const out = Buffer.concat(parts);
fs.writeFileSync(outPath, out);
fs.writeFileSync(outPath.replace(/\.gguf$/, "") + ".keep.json", JSON.stringify(keep));
console.log(`pieces kept: ${keep.length} of ${tokens.length}; ${(buf.length / 1e6).toFixed(1)} MB → ${(out.length / 1e6).toFixed(1)} MB`);
