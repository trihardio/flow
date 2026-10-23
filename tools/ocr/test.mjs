// Reads the timetable pictures tools/ocr/make.cjs draws with the Mac's own text recognition (the script electron/main.cjs
// runs, read out of it) and works the classes out with hlReadTimetable as it stands in src/App.jsx (read out of it, not
// copied); then compares them with what each picture says. Run on a Mac (23 October 2026).
//   node tools/ocr/test.mjs <folder of pictures>
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8"), main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error(`not found: ${a}`); return src.slice(i, j); };
const js = cut(main, "/* ocr-start */", "/* ocr-end */").replace("/* ocr-start */", "");
const reader = cut(app, "/* ---------- health: reading a timetable off a picture", "/* ---------- health: reading a timetable end");
const pad = (x) => String(x).padStart(2, "0"), hlHm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const read = new Function("pad", "hlHm", `${reader}\nreturn hlReadTimetable;`)(pad, hlHm);
const straight = new Function(`${cut(main, "/* ocr-loop-start */", "/* ocr-loop-end */")}\nreturn ocrStraight;`)();
const dir = process.argv[2] || path.join(os.tmpdir(), "flow-ocr"), tmp = path.join(os.tmpdir(), "flow-ocr-read.js");
fs.writeFileSync(tmp, js);
const D = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };
const want = {
  "1-grid": [["Mon", "08:00", "09:40", "Calculus II", "Room 301"], ["Mon", "13:00", "14:40", "Physics Lab", "Lab B2"], ["Tue", "10:00", "11:40", "Data Structures", "GK1-204"],
             ["Wed", "08:00", "10:30", "Linear Algebra", "Room 105"], ["Thu", "15:00", "16:40", "English for Engineers", "Hall A"], ["Fri", "09:00", "10:40", "Discrete Math", "Room 302"]],
  // no times in the blocks: the start is read off where the block stands; the end can't be (the usual 100 minutes)
  "2-grid-plain": [["Mon", "08:00", "09:40", "Algorithms", "Room 12"], ["Wed", "13:00", "14:40", "Statistics", "Room 4"], ["Fri", "10:00", "11:40", "Economics", "Room 7"]],
  "3-portal": [["Mon", "07:30", "10:00", "Algoritma dan Pemrograman", "GK1-301"], ["Tue", "10:15", "12:45", "Kalkulus II", "R. 7602"], ["Wed", "13:00", "14:40", "Fisika Dasar", "Lab Fisika"],
               ["Thu", "08:00", "09:40", "Bahasa Inggris", "R. 9105"], ["Fri", "13:30", "16:00", "Matematika Diskrit", "GK2-205"]],
  "4-list": [["Mon", "08:00", "09:40", "Calculus II", "Room 301"], ["Mon", "13:00", "14:40", "Physics", "Lab B2"], ["Wed", "10:00", "11:40", "Chemistry", "Room 210"], ["Fri", "13:00", "14:30", "Economics", "Room 105"]],
  "5-turned": [["Mon", "08:00", "09:40", "Biology", ""], ["Tue", "12:00", "13:40", "History", ""], ["Thu", "10:00", "11:40", "Art", ""]],
  "6-merged": [["Mon", "07:30", "09:10", "Kimia", "R.101"], ["Mon", "09:20", "11:00", "Biologi", "R.102"], ["Wed", "13:00", "14:40", "Sejarah", "R.201"], ["Wed", "15:00", "16:40", "Geografi", "R.202"]],
};
const min = (t) => +t.slice(0, 2) * 60 + +t.slice(3), norm = (s) => String(s).toLowerCase().replace(/\s+/g, "");
let ok = 0, all = 0, roomsOk = 0, extra = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png")).sort()) {
  const name = f.replace(".png", ""), t0 = Date.now();
  const pass = async (deg) => { try { const g = JSON.parse(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", tmp, path.join(dir, f), String(deg)], { encoding: "utf8" })); return Array.isArray(g.lines) ? g : null; } catch (e) { return null; } };
  const res = await straight(pass), lines = res.lines;
  const got = read(lines, +res.W, +res.H), exp = want[name] || [];
  console.log(`\n${name}: ${lines.length} lines read in ${Date.now() - t0} ms, ${got.length} classes`);
  const used = new Set();
  for (const [d, a, b, n, r, tol = 0] of exp) {
    all++;
    const i = got.findIndex((c, k) => !used.has(k) && c.dow === D[d] && norm(c.name) === norm(n) && Math.abs(min(c.from) - min(a)) <= tol && Math.abs(min(c.to) - min(b)) <= tol);
    if (i >= 0) { used.add(i); ok++; const rok = norm(got[i].room) === norm(r); if (rok) roomsOk++; console.log(`  ok   ${d} ${got[i].from}-${got[i].to} ${got[i].name} · ${got[i].room || "-"}${rok ? "" : `  (room: want ${r || "-"})`}`); }
    else console.log(`  MISS ${d} ${a}-${b} ${n} · ${r}`);
  }
  got.forEach((c, k) => { if (!used.has(k)) { extra++; console.log(`  EXTRA ${Object.keys(D)[c.dow] || c.dow} ${c.from}-${c.to} ${c.name} · ${c.room}`); } });
}
console.log(`\nclasses right: ${ok} of ${all} · rooms right: ${roomsOk} of ${ok} · extra: ${extra}`);
process.exit(ok === all && extra === 0 ? 0 : 1);
