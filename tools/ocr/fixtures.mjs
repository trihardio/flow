// The picture readers against his reference screenshots (5 November 2026, his words: "train the AI with these images that i
// will use in the future. This is including the timetable ai and the new auto assignment AI"). `node tools/ocr/fixtures.mjs` (the quick check, no reading of pictures; tools/ocr/test.mjs reads drawn pictures with the Mac).
// Each fixture in tools/ocr/fixtures is what the Mac's text reading gives for one picture (each line: text, x, y, w, h in
// the picture's pixels) and what must come out of it. The readers are taken out of src/App.jsx as they are (pick.mjs).
//   node tools/ocr/fixtures.mjs                  every fixture; exit 1 if any fails
//   node tools/ocr/fixtures.mjs --read <picture>     the Mac's own reading of a picture, as a fixture's "lines" (to add one)
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pick } from "./pick.mjs";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "../..");

if (process.argv[2] === "--read") {
  // the same script the app runs (OCR_JS in electron/main.cjs), on a picture of his
  const src = readFileSync(join(root, "electron/main.cjs"), "utf8"), i = src.indexOf("const OCR_JS = "), q = src[i + 15], j = src.indexOf(q + ";", i + 16);
  const dir = mkdtempSync(join(tmpdir(), "flow-ocr-")), js = join(dir, "read.js");
  writeFileSync(js, (0, eval)(src.slice(i + 15, j + 1)));
  const g = JSON.parse(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", js, process.argv[3], "0"], { maxBuffer: 32 << 20 }).toString());
  rmSync(dir, { recursive: true, force: true });
  const r = (n) => Math.round(n);
  console.log(JSON.stringify({ W: g.W, H: g.H, lines: g.lines.map((o) => [o.t, r(o.x * g.W), r(o.y * g.H), r(o.w * g.W), r(o.h * g.H)]) }));
  process.exit(0);
}

const { hlReadTimetable, hlAsgReadMany } = await pick(["hlReadTimetable", "hlAsgReadMany"]);
const lines = (f) => f.lines.map(([t, x, y, w, h]) => ({ t, c: 1, x: x / f.W, y: y / f.H, w: w / f.W, h: h / f.H, q: [x, y, x + w, y, x + w, y + h, x, y + h] }));
let bad = 0;
for (const file of readdirSync(join(here, "fixtures")).filter((n) => n.endsWith(".json")).sort()) {
  const f = JSON.parse(readFileSync(join(here, "fixtures", file), "utf8"));
  const got = f.kind === "timetable" ? hlReadTimetable(lines(f), f.W, f.H, null) : hlAsgReadMany(lines(f), new Date(f.now));
  const keys = f.kind === "timetable" ? ["name", "dow", "from", "to"] : ["cls", "title", "due", "at", "weight", "kind"];
  const say = (o) => keys.filter((k) => o[k] != null && o[k] !== "").map((k) => `${k}=${o[k]}`).join(" ");
  const left = [...got], miss = [];
  for (const e of f.expect) {
    const i = left.findIndex((g) => keys.every((k) => (e[k] == null ? true : String(g[k]) === String(e[k]))));
    if (i >= 0) left.splice(i, 1); else miss.push(e);
  }
  const ok = !miss.length && !left.length;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${file}  (${got.length} read, ${f.expect.length} expected)`);
  if (!ok) { for (const e of miss) console.log("     missing: " + say(e)); for (const g of left) console.log("     extra:   " + say(g)); }
}
process.exit(bad ? 1 : 0);
