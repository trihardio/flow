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
const all = { "1-grid": grid("Semester timetable", g1, true), "2-grid-plain": grid("Week", g2, false), "3-portal": portal, "4-list": list, "5-turned": turned, "6-merged": merged };
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  const w = new BrowserWindow({ show: false, width: 1280, height: 860, webPreferences: { offscreen: true, zoomFactor: 1 } });
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
