// Draws the timetables tools/ocr/test.mjs reads, as pictures (23 October 2026): six shapes a week of classes comes in,
// rendered in a window that is never shown, at twice the size (as a Mac's screenshot is).
//   env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/ocr/make.cjs <folder>
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"), path = require("node:path");
const out = process.argv[2] || path.join(require("node:os").tmpdir(), "flow-ocr");
const page = (body, css = "") => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 28px; background: #fff; color: #1d2733; font: 15px -apple-system, "Helvetica Neue", Arial, sans-serif; }
  h2 { margin: 0 0 16px; font-size: 20px; } ${css}</style></head><body>${body}</body></html>`;
const hours = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// 1 and 2: days across the top, hours down the side; blocks placed by their times (2: no times written in the blocks)
const grid = (title, cls, withTimes) => {
  const H = 56, a = 7, days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], top = (t) => (t - a) * H;
  const block = (c) => `<div class="b" style="left:${90 + c.d * 210}px;top:${44 + top(c.f)}px;height:${(c.t - c.f) * H - 6}px;background:${c.bg}">
    <b>${c.n}</b>${withTimes ? `<span>${c.fs} - ${c.ts}</span>` : ""}<span>${c.r}</span></div>`;
  return page(`<h2>${title}</h2><div class="g">${days.map((d, i) => `<div class="dh" style="left:${90 + i * 210}px">${d}</div>`).join("")}
    ${hours(a, 17).map((h) => `<div class="hr" style="top:${44 + top(h) - 9}px">${String(h).padStart(2, "0")}:00</div><div class="ln" style="top:${44 + top(h)}px"></div>`).join("")}
    ${cls.map(block).join("")}</div>`,
    `.g { position: relative; height: ${44 + 11 * H}px; width: 1150px; }
     .dh { position: absolute; top: 8px; width: 200px; text-align: center; font-weight: 700; }
     .hr { position: absolute; left: 0; width: 70px; font-size: 13px; color: #5a6672; }
     .ln { position: absolute; left: 80px; right: 0; border-top: 1px solid #e3e7ec; }
     .b { position: absolute; width: 196px; border-radius: 8px; padding: 6px 9px; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
     .b b { font-size: 14px; }`);
};
const g1 = [{ d: 0, f: 8, t: 9 + 40 / 60, fs: "08:00", ts: "09:40", n: "Calculus II", r: "Room 301", bg: "#dbe8ff" },
  { d: 0, f: 13, t: 14 + 40 / 60, fs: "13:00", ts: "14:40", n: "Physics Lab", r: "Lab B2", bg: "#dff5e6" },
  { d: 1, f: 10, t: 11 + 40 / 60, fs: "10:00", ts: "11:40", n: "Data Structures", r: "GK1-204", bg: "#fdebd3" },
  { d: 2, f: 8, t: 10.5, fs: "08:00", ts: "10:30", n: "Linear Algebra", r: "Room 105", bg: "#efe2fb" },
  { d: 3, f: 15, t: 16 + 40 / 60, fs: "15:00", ts: "16:40", n: "English for Engineers", r: "Hall A", bg: "#fde2e4" },
  { d: 4, f: 9, t: 10 + 40 / 60, fs: "09:00", ts: "10:40", n: "Discrete Math", r: "Room 302", bg: "#d9f3f1" }];
const g2 = [{ d: 0, f: 8, t: 10, n: "Algorithms", r: "Room 12", bg: "#dbe8ff" }, { d: 2, f: 13, t: 15, n: "Statistics", r: "Room 4", bg: "#dff5e6" },
  { d: 4, f: 10, t: 12, n: "Economics", r: "Room 7", bg: "#fdebd3" }];
// 3: a student portal's table, Indonesian
const portal = page(`<h2>Jadwal Kuliah Semester Ganjil 2026/2027</h2><table>
  <tr><th>No</th><th>Kode</th><th>Mata Kuliah</th><th>SKS</th><th>Hari</th><th>Jam</th><th>Ruang</th><th>Dosen</th></tr>
  <tr><td>1</td><td>IF2110</td><td>Algoritma dan Pemrograman</td><td>3</td><td>Senin</td><td>07:30 - 10:00</td><td>GK1-301</td><td>Dr. Budi Santoso, M.Kom</td></tr>
  <tr><td>2</td><td>MA1201</td><td>Kalkulus II</td><td>3</td><td>Selasa</td><td>10:15 - 12:45</td><td>R. 7602</td><td>Ir. Siti Aminah, M.T.</td></tr>
  <tr><td>3</td><td>FI1102</td><td>Fisika Dasar</td><td>2</td><td>Rabu</td><td>13:00 - 14:40</td><td>Lab Fisika</td><td>Dr. Andi Wijaya</td></tr>
  <tr><td>4</td><td>KU1011</td><td>Bahasa Inggris</td><td>2</td><td>Kamis</td><td>08:00 - 09:40</td><td>R. 9105</td><td>Ibu Rina, M.Pd</td></tr>
  <tr><td>5</td><td>IF2120</td><td>Matematika Diskrit</td><td>3</td><td>Jumat</td><td>13:30 - 16:00</td><td>GK2-205</td><td>Prof. Hadi</td></tr></table>`,
  `table { border-collapse: collapse; } th, td { border: 1px solid #cfd6de; padding: 9px 12px; text-align: left; } th { background: #eef2f6; }`);
// 4: a list under day headings, with am / pm
const list = page(`<h2>My week</h2><div class="l">
  <h3>Monday</h3><p>08:00 – 09:40 &nbsp; Calculus II · Room 301</p><p>13:00 – 14:40 &nbsp; Physics · Lab B2</p>
  <h3>Wednesday</h3><p>10:00 – 11:40 &nbsp; Chemistry · Room 210</p>
  <h3>Friday</h3><p>1:00 pm – 2:30 pm &nbsp; Economics · Room 105</p></div>`,
  `h3 { margin: 18px 0 6px; font-size: 17px; } p { margin: 4px 0 4px 18px; font-size: 15px; }`);
// 5: turned round: the days down the side, the hours across the top; no times in the blocks
const turned = (() => {
  const W = 110, a = 8, days = ["Mon", "Tue", "Wed", "Thu", "Fri"], x = (t) => 110 + (t - a) * W;
  const cls = [{ d: 0, f: 8, t: 10, n: "Biology", bg: "#dbe8ff" }, { d: 1, f: 12, t: 14, n: "History", bg: "#dff5e6" }, { d: 3, f: 10, t: 12, n: "Art", bg: "#fdebd3" }];
  return page(`<h2>Timetable</h2><div class="g">${hours(a, 17).filter((h) => h % 2 === 0).map((h) => `<div class="hh" style="left:${x(h) - 20}px">${String(h).padStart(2, "0")}:00</div>`).join("")}
    ${days.map((d, i) => `<div class="dl" style="top:${40 + i * 70}px">${d}</div>`).join("")}
    ${cls.map((c) => `<div class="b" style="left:${x(c.f) + 3}px;top:${40 + c.d * 70 + 4}px;width:${(c.t - c.f) * W - 6}px;background:${c.bg}"><b>${c.n}</b></div>`).join("")}</div>`,
    `.g { position: relative; height: 400px; width: 1200px; } .hh { position: absolute; top: 6px; font-size: 13px; color: #5a6672; }
     .dl { position: absolute; left: 0; width: 80px; height: 62px; display: flex; align-items: center; font-weight: 700; }
     .b { position: absolute; height: 54px; border-radius: 8px; display: flex; align-items: center; padding: 0 10px; box-sizing: border-box; }`);
})();
// 6: the day in one cell beside its rows (rowspan, centred), Indonesian
const merged = page(`<h2>Jadwal</h2><table>
  <tr><th>Hari</th><th>Jam</th><th>Mata Kuliah</th><th>Ruang</th></tr>
  <tr><td rowspan="2" class="m">Senin</td><td>07:30 - 09:10</td><td>Kimia</td><td>R.101</td></tr>
  <tr><td>09:20 - 11:00</td><td>Biologi</td><td>R.102</td></tr>
  <tr><td rowspan="2" class="m">Rabu</td><td>13:00 - 14:40</td><td>Sejarah</td><td>R.201</td></tr>
  <tr><td>15:00 - 16:40</td><td>Geografi</td><td>R.202</td></tr></table>`,
  `table { border-collapse: collapse; } th, td { border: 1px solid #cfd6de; padding: 10px 16px; text-align: left; } .m { vertical-align: middle; font-weight: 700; }`);
// 7 to 9 and asg-1, asg-2: drawn after his own screenshots (5 November 2026: "train the AI with these images that i will use
// in the future"): his university app's week as a dark list, its deadlines as a dark list, the timetable portal's grid
// (blocks of code_campus / mode / kind / group / room, the room cut off, no times written), a course page's assessment table
const dark = (title, items) => page(`<div class="ph"><h1>${title}</h1>${items}</div>`,
  `body { background: #16181b; color: #f1f3f5; padding: 16px; } .ph { width: 330px; } h1 { margin: 0 0 26px; font-size: 18px; }
   .d { margin: 18px 0 12px; font-size: 11.5px; font-weight: 600; color: #e6e8ea; display: flex; justify-content: space-between; } .d small { color: #a9b0b6; font-weight: 400; font-size: 10px; }
   .c { margin-bottom: 4px; padding: 13px 12px 12px; border-radius: 10px; background: #22252a; border: 1px solid #2e3237; }
   .t { font-size: 11px; color: #e6e8ea; margin-bottom: 6px; } .n { display: flex; gap: 10px; font-size: 13px; font-weight: 500; line-height: 1.45; } .n i { flex: none; width: 4px; border-radius: 2px; }`);
const card = (t, n, hue) => `<div class="c"><div class="t">${t}</div><div class="n"><i style="background:${hue}"></i><span>${n}</span></div></div>`;
const weekDark = dark("Next week", `<div class="d">Mon, 9 Nov</div>${card("2.00pm–4.00pm", "BTW1042: Tutorial", "#d8c8e8")}
  <div class="d">Tue, 10 Nov</div>${card("12.00pm–2.00pm", "MKW1120: Tutorial", "#4aa3e8")}${card("3.00pm–5.00pm", "ETW1001: Tutorial", "#bcdcf2")}
  <div class="d">Thu, 12 Nov</div>${card("10.00am–12.00pm", "MGW1010: Tutorial", "#e8e8e8")}`);
const dueDark = dark("November", `<div class="d">Fri, 20 Nov <small>15 Days</small></div>${card("Due 8.55pm", "BTW1042: Individual Research Assignment (25%)", "#d8c8e8")}
  ${card("Due 11.55pm", "MKW1120: Assignment 1: Individual Poster (30%)", "#4aa3e8")}${card("Due 11.55pm", "ETW1001: Assignment 1 [15%]", "#bcdcf2")}
  ${card("Due 11.55pm", "MGW1010: Assessment 1: Individual Reflections Essay (Management Around Me)", "#e8e8e8")}`);
const allocate = (() => {
  const blk = (d, f, code, grp, room) => `<div class="k" style="left:${52 + d * 94}px;top:${46 + (f - 9) * 59}px">${code}_MA_OC<br>MY-01_ON-<br>CAMPUS<br>Tutorial<br>${grp}<br>${room}</div>`;
  const days = ["2/11 (Mon)", "3/11 (Tue)", "4/11 (Wed)", "5/11 (Thu)", "6/11 (Fri)", "7/11 (Sat)", "8/11 (Sun)"];
  return page(`<h2 style="text-align:center;font-weight:400">02/11/2026 - 08/11/2026 (current week)</h2><div class="g">
    ${days.map((n, i) => `<div class="h" style="left:${52 + i * 94}px">${n}</div>`).join("")}
    ${hours(9, 17).map((h) => `<div class="r" style="top:${40 + (h - 9) * 59}px"><span>${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}</span></div>`).join("")}
    ${blk(3, 10, "MGW1010", 21, "MA_ClassRoom_60")}${blk(1, 12, "MKW1120", 20, "MA_ClassRoom_95")}${blk(0, 14, "BTW1042", 10, "MA_ClassRoom_93")}${blk(1, 15, "ETW1001", 20, "MA_ClassRoom_60")}</div>`,
    `.g { position: relative; width: 712px; height: 560px; font: 10px Arial, sans-serif; } .h { position: absolute; top: 14px; width: 94px; text-align: center; color: #1f3d73; }
     .r { position: absolute; left: 0; width: 712px; border-top: 1px solid #ddd; } .r span { position: absolute; top: 4px; left: 2px; font-size: 10px; color: #1f3d73; }
     .k { position: absolute; width: 89px; height: 116px; padding: 5px 4px; box-sizing: border-box; background: #c6e5d8; border-radius: 3px; overflow: hidden; white-space: nowrap; color: #1f3d73; font-size: 9.5px; line-height: 11.5px; }`);
})();
// (at his screenshot's own scale, a Mac's twice-size capture: drawn at half that, the reading lost a date's time)
const table = page(`<h1 style="color:#2b6cb0;font-size:52px;margin:0 0 40px">Assessment structure</h1><table>
  <tr class="th"><td>ASSESSMENT</td><td>WEIGHTING</td><td>DUE DATE</td></tr>
  <tr class="gp"><td><u>1. Written</u></td><td>70%</td><td></td></tr>
  <tr><td><u>Assessment 1: Individual<br>Reflections Essay<br>(Management Around Me)</u></td><td></td><td>Friday, 20 November 2026,<br>11:55 PM</td></tr>
  <tr><td><u>Assignment 3A: Proposal<br>Worksheet</u></td><td></td><td>Monday, 4 January 2027,<br>11:55 PM</td></tr>
  <tr><td><u>Assignment 3B: Case<br>Analysis</u></td><td></td><td>Friday, 22 January 2027,<br>11:55 PM</td></tr>
  <tr class="gp"><td><u>2. Presentation</u></td><td>30%</td><td></td></tr>
  <tr><td><u>Assessment 2: Interview<br>Managers in Practice</u></td><td></td><td>Thursday, 10 December 2026,<br>11:55 PM</td></tr></table>`,
  `table { border-collapse: collapse; width: 1200px; font-size: 28px; line-height: 1.6; } td { padding: 22px 16px; vertical-align: middle; } td:first-child { padding-left: 90px; width: 440px; }
   .th td { font-weight: 700; color: #555; font-size: 23px; letter-spacing: 0.04em; padding-left: 30px; border-bottom: 2px solid #888; } .gp td { background: #f4f4f4; } .gp td:first-child u { color: #2b6cb0; font-weight: 700; }`);
const all = { "1-grid": grid("Semester timetable", g1, true), "2-grid-plain": grid("Week", g2, false), "3-portal": portal, "4-list": list, "5-turned": turned, "6-merged": merged,
              "7-week-dark": weekDark, "asg-1-deadlines": dueDark, "asg-2-table": table };
// (8-allocate, his portal's grid drawn small, is left out: drawn at its size the reading took "Tutorial" for "Ttonal"; the real
// screenshot of it is "c-monash" above, read right on 28 October 2026)
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const w = new BrowserWindow({ show: false, width: 1280, height: 1240, webPreferences: { offscreen: true, zoomFactor: 1 } });
  w.webContents.setZoomFactor(1);
  for (const [name, html] of Object.entries(all)) {
    await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise((r) => setTimeout(r, 400));
    const img = await w.webContents.capturePage();
    fs.writeFileSync(path.join(out, `${name}.png`), img.toPNG());
    console.log("made", name, img.getSize());
  }
  app.quit();
});
