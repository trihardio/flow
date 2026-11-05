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
// (taken out of App.jsx with everything it leans on, wherever that stands: pick.mjs, since 5 November 2026)
const { hlReadTimetable: read } = await (await import("./pick.mjs")).pick(["hlReadTimetable"]);
const { ocrStraight: straight, ocrBmp } = new Function(`${cut(main, "/* ocr-loop-start */", "/* ocr-loop-end */")}\nreturn { ocrStraight, ocrBmp };`)();
const dir = process.argv[2] || path.join(os.tmpdir(), "flow-ocr"), tmp = path.join(os.tmpdir(), "flow-ocr-read.js");
fs.writeFileSync(tmp, js);
const D = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const want = {
  "1-grid": [["Mon", "08:00", "09:40", "Calculus II", "Room 301"], ["Mon", "13:00", "14:40", "Physics Lab", "Lab B2"], ["Tue", "10:00", "11:40", "Data Structures", "GK1-204"],
             ["Wed", "08:00", "10:30", "Linear Algebra", "Room 105"], ["Thu", "15:00", "16:40", "English for Engineers", "Hall A"], ["Fri", "09:00", "10:40", "Discrete Math", "Room 302"]],
  // no times in the blocks: read off where each block's edges stand against the hours, in the picture's colours (to 5 minutes)
  "2-grid-plain": [["Mon", "08:00", "10:00", "Algorithms", "Room 12", 5], ["Wed", "13:00", "15:00", "Statistics", "Room 4", 5], ["Fri", "10:00", "12:00", "Economics", "Room 7", 5]],
  "3-portal": [["Mon", "07:30", "10:00", "Algoritma dan Pemrograman", "GK1-301"], ["Tue", "10:15", "12:45", "Kalkulus II", "R. 7602"], ["Wed", "13:00", "14:40", "Fisika Dasar", "Lab Fisika"],
               ["Thu", "08:00", "09:40", "Bahasa Inggris", "R. 9105"], ["Fri", "13:30", "16:00", "Matematika Diskrit", "GK2-205"]],
  "4-list": [["Mon", "08:00", "09:40", "Calculus II", "Room 301"], ["Mon", "13:00", "14:40", "Physics", "Lab B2"], ["Wed", "10:00", "11:40", "Chemistry", "Room 210"], ["Fri", "13:00", "14:30", "Economics", "Room 105"]],
  "5-turned": [["Mon", "08:00", "09:40", "Biology", ""], ["Tue", "12:00", "13:40", "History", ""], ["Thu", "10:00", "11:40", "Art", ""]],
  "6-merged": [["Mon", "07:30", "09:10", "Kimia", "R.101"], ["Mon", "09:20", "11:00", "Biologi", "R.102"], ["Wed", "13:00", "14:40", "Sejarah", "R.201"], ["Wed", "15:00", "16:40", "Geografi", "R.202"]],
  // his university's week (28 October 2026; a copy of his screenshot, not in the project): a portal's grid with dates in its
  // headers ("2/11 (Mon)"), hour labels under their lines, blocks with no times in them, a code with its offering
  // ("MGW1010_MA_OC"), a campus code ("MY-01_ON-CAMPUS"), the kind, a group number and the room ("MA_ClassRoom_61")
  "c-monash": [["Mon", "14:00", "16:00", "BTW1042 Tutorial", "MA ClassRoom 9"], ["Tue", "12:00", "14:00", "MKW1120 Tutorial", "MA ClassRoom 9"],
               ["Tue", "15:00", "17:00", "ETW1001 Tutorial", "MA ClassRoom 6"], ["Thu", "10:00", "12:00", "MGW1010 Tutorial", "MA ClassRoom 61"]],
  // two real timetables from the internet he tried on 23 October 2026 (not in the project; copies of his screenshots): a phone's
  // photo of a university portal's week at a slant, times without am / pm, a corner's "Wks 4560", the far "Fri" too small
  // to read; and a sheet of hour rows ("8-9", "12-1") with merged cells and no times in them (read off the cells' colours)
  "a-unsw": [["Mon", "13:30", "15:00", "ECON1202 - TUT", "Block G6"], ["Mon", "16:00", "18:30", "COMM1140 - LEC", "MathewsThA"], ["Tue", "11:30", "13:00", "ECON1101-LE1", "Online"], ["Wed", "14:00", "15:30", "ECON1202 - LEC", "Burrows Th"], ["Wed", "16:00", "18:00", "COMM1140 - TUT", "Mat 301"], ["Thu", "09:30", "11:00", "ECON1101 - LE2", "Science Th"], ["Thu", "13:00", "14:30", "ECON1101 -WKS", "Mat 214"], ["Fri", "12:30", "14:00", "ECON1202 -LEC", "InsathG03"]],
  "b-hourly": [["Mon", "08:00", "09:00", "Breakfast", ""], ["Mon", "11:00", "12:00", "To Callaghan", ""], ["Mon", "12:00", "13:00", "CIVL9100 Lecture", ""], ["Mon", "13:00", "14:00", "Lunch", ""], ["Mon", "14:00", "15:00", "CIVL9100 Consolidate", ""], ["Mon", "15:00", "16:00", "To home", ""], ["Mon", "17:00", "18:00", "PDTY1234 Prep, review", ""], ["Mon", "18:00", "19:00", "Dinner", ""], ["Mon", "22:00", "23:00", "Sleep", ""], ["Tue", "08:00", "09:00", "Breakfast", ""], ["Tue", "09:00", "10:00", "To Callaghan", ""], ["Tue", "10:00", "12:00", "PDTY1234 Lecture", ""], ["Tue", "12:00", "13:00", "PDTY1234 Consolidate", ""], ["Tue", "13:00", "14:00", "CIVL9100 Tutorial", ""], ["Tue", "14:00", "15:00", "Lunch", ""], ["Tue", "15:00", "18:00", "Gym", ""], ["Tue", "18:00", "19:00", "To home", ""], ["Tue", "19:00", "20:00", "Dinner", ""], ["Tue", "22:00", "23:00", "Sleep", ""], ["Wed", "08:00", "09:00", "Breakfast", ""], ["Wed", "12:00", "13:00", "Lunch", ""], ["Wed", "13:00", "14:00", "To work", ""], ["Wed", "14:00", "18:00", "WORK", ""], ["Wed", "18:00", "19:00", "To home", ""], ["Wed", "19:00", "20:00", "Dinner", ""], ["Wed", "22:00", "23:00", "Sleep", ""], ["Thu", "08:00", "09:00", "Breakfast", ""], ["Thu", "10:00", "11:00", "GSBS5678 Prep, review", ""], ["Thu", "12:00", "13:00", "Lunch", ""], ["Thu", "15:00", "16:00", "PDTY1234 Tute exercise", ""], ["Thu", "16:00", "17:00", "To NUSpace", ""], ["Thu", "17:00", "19:00", "GSBS5678 Lecture", ""], ["Thu", "19:00", "20:00", "To home", ""], ["Thu", "20:00", "21:00", "Dinner", ""], ["Thu", "22:00", "23:00", "Sleep", ""], ["Fri", "08:00", "09:00", "Breakfast", ""], ["Fri", "10:00", "11:00", "GSBS5678 Consolidate", ""], ["Fri", "12:00", "13:00", "Lunch", ""], ["Fri", "13:00", "14:00", "To Callaghan", ""], ["Fri", "14:00", "15:00", "PDTY1234 Tutorial", ""], ["Fri", "15:00", "18:00", "Gym", ""], ["Fri", "18:00", "19:00", "To home", ""], ["Fri", "19:00", "20:00", "Dinner", ""], ["Fri", "22:00", "23:00", "Sleep", ""], ["Sat", "08:00", "09:00", "Breakfast", ""], ["Sat", "12:00", "13:00", "Lunch", ""], ["Sat", "13:00", "14:00", "To work", ""], ["Sat", "14:00", "18:00", "WORK", ""], ["Sat", "18:00", "19:00", "To home", ""], ["Sat", "19:00", "20:00", "Dinner", ""], ["Sat", "22:00", "23:00", "Sleep", ""], ["Sun", "08:00", "09:00", "Breakfast", ""], ["Sun", "12:00", "13:00", "Lunch", ""], ["Sun", "17:00", "18:00", "CIVL9100 Prep, review", ""], ["Sun", "18:00", "19:00", "Dinner", ""], ["Sun", "22:00", "23:00", "Sleep", ""]],
  // drawn after his screenshots of 5 November 2026 (make.cjs 7 and 8): his app's week as a dark list, the portal's grid
  "7-week-dark": [["Mon", "14:00", "16:00", "BTW1042: Tutorial", ""], ["Tue", "12:00", "14:00", "MKW1120: Tutorial", ""], ["Tue", "15:00", "17:00", "ETW1001: Tutorial", ""], ["Thu", "10:00", "12:00", "MGW1010: Tutorial", ""]],
};
// assignments off a picture (hlAsgReadMany, 5 November 2026): his deadlines as a dark list, a course page's assessment table,
// on 5 November 2026 (the dates in them are read against that day)
const wantAsg = {
  "asg-1-deadlines": [{ cls: "BTW1042", title: "Individual Research Assignment", due: "2026-11-20", at: "20:55", weight: 25 }, { cls: "MKW1120", title: "Assignment 1: Individual Poster", due: "2026-11-20", at: "23:55", weight: 30 },
                      { cls: "ETW1001", title: "Assignment 1", due: "2026-11-20", at: "23:55", weight: 15 }, { cls: "MGW1010", title: "Assessment 1: Individual Reflections Essay (Management Around Me)", due: "2026-11-20", at: "23:55" }],
  "asg-2-table": [{ title: "Assessment 1: Individual Reflections Essay (Management Around Me)", due: "2026-11-20", at: "23:55" }, { title: "Assignment 3A: Proposal Worksheet", due: "2027-01-04", at: "23:55" },
                  { title: "Assignment 3B: Case Analysis", due: "2027-01-22", at: "23:55" }, { title: "Assessment 2: Interview Managers in Practice", due: "2026-12-10", at: "23:55", weight: 30, kind: "talk" }],
};
const { hlAsgReadMany } = await (await import("./pick.mjs")).pick(["hlAsgReadMany"]);
const min = (t) => +t.slice(0, 2) * 60 + +t.slice(3), norm = (s) => String(s).toLowerCase().replace(/\s+/g, "");
let ok = 0, all = 0, roomsOk = 0, extra = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png")).sort()) {
  const name = f.replace(".png", ""), t0 = Date.now();
  const pass = async (deg) => { try { const g = JSON.parse(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", tmp, path.join(dir, f), String(deg)], { encoding: "utf8" })); return Array.isArray(g.lines) ? g : null; } catch (e) { return null; } };
  const res = await straight(pass), lines = res.lines;
  if (wantAsg[name]) {
    const got = hlAsgReadMany(lines, new Date("2026-11-05T12:00:00")), used = new Set();
    console.log(`\n${name}: ${lines.length} lines read in ${Date.now() - t0} ms, ${got.length} assignments`);
    for (const e of wantAsg[name]) {
      all++;
      const same = (q, a, b) => (q === "title" ? String(a || "").toLowerCase().replace(/[^a-z0-9]/g, "") === String(b).toLowerCase().replace(/[^a-z0-9]/g, "") : norm(a) === norm(b));
      const i = got.findIndex((g, k) => !used.has(k) && Object.keys(e).every((q) => same(q, g[q], e[q])));
      if (i >= 0) { used.add(i); ok++; roomsOk++; console.log(`  ok   ${e.due} ${e.at} ${e.cls ? e.cls + " " : ""}${e.title}`); }
      else console.log(`  MISS ${JSON.stringify(e)}`);
    }
    got.forEach((g, k) => { if (!used.has(k)) { extra++; console.log(`  EXTRA ${JSON.stringify(g)}`); } });
    continue;
  }
  // the picture's colours, as the shell hands them over (the same reading asked with "px")
  const bmp = JSON.parse(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", tmp, path.join(dir, f), String(res.deg || 0), "px"], { encoding: "utf8", maxBuffer: 64 << 20 })).bmp;
  const got = read(lines, +res.W, +res.H, bmp ? ocrBmp(bmp) : null), exp = want[name] || [];
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
