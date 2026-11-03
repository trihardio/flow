// The pixel art of the GitHub page (README.md): the banner (the installer's swamp with FLOW over it), one sprite per
// app and the two download buttons. Writes docs/art/*.svg. Run: node tools/readme/art.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "docs/art");
fs.mkdirSync(out, { recursive: true });

// a grid of characters → crisp rects (one per run of a colour along a row)
const rects = (grid, pal, s = 1, x0 = 0, y0 = 0) => {
  let r = "";
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (pal[c]) r += `<rect x="${x0 + x * s}" y="${y0 + y * s}" width="${n * s}" height="${s}" fill="${pal[c]}"/>`;
      x += n;
    }
  });
  return r;
};
const svg = (w, h, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"${extra}>${body}</svg>\n`;
const sprite = (name, grid, pal) => fs.writeFileSync(path.join(out, `${name}.svg`), svg(16, 16, rects(grid, pal)).replace('width="16" height="16"', 'width="64" height="64"'));

// a disc of 16×16: rim, face and a mask drawn over it
const disc = (fn) => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  return fn(x, y, d);
}).join(""));

sprite("wallet", [
  "................",
  "................",
  "....KKKKKKKK....",
  "...KGGGGGGGGK...",
  "...KgggggggggK..",
  "..KKKKKKKKKKKKK.",
  "..KBBBBBBBBBBBK.",
  "..KBhhhhhhhhhBK.",
  "..KBBBBBBBBKKKKK",
  "..KBBBBBBBKYYYYK",
  "..KBBBBBBBKYKYYK",
  "..KBBBBBBBKYYYYK",
  "..KBBBBBBBBKKKKK",
  "..KbbbbbbbbbbbK.",
  "..KKKKKKKKKKKKK.",
  "................",
], { K: "#2a1a12", G: "#5fd39b", g: "#2e9467", B: "#9a6338", b: "#6e4426", h: "#b77a48", Y: "#f6c64f" });

// Health: three rings, each partly closed (as the app's activity rings)
const RINGS = [[5.6, 7.7, "#ff2d6f", "#5c1530", 0.8], [3.6, 5.6, "#9cf03c", "#2f4d17", 0.65], [1.6, 3.6, "#2fd5ff", "#123f4d", 0.9]];
sprite("rings", disc((x, y, d) => {
  const i = RINGS.findIndex(([a, b]) => d >= a && d < b);
  if (i < 0) return ".";
  const turn = ((Math.atan2(x - 7.5, -(y - 7.5)) / (2 * Math.PI)) + 1) % 1;
  return turn <= RINGS[i][4] ? "abc"[i] : "ABC"[i];
}), Object.fromEntries(RINGS.flatMap(([, , on, off], i) => [["abc"[i], on], ["ABC"[i], off]])));

// Trading: the coin (crypto), the globe (IDX), the die (forex)
const B = ["..##.#.", "#######", ".##..##", ".#####.", ".##..##", "#######", "..##.#."];
sprite("coin", disc((x, y, d) => {
  const gx = x - 4, gy = y - 4;
  if (d < 6.2 && gy >= 0 && gy < 7 && gx >= 0 && gx < 7 && B[gy][gx] === "#") return "M";
  return d >= 7.6 ? "." : d >= 6.6 ? "R" : d >= 5.6 && x + y > 15 ? "S" : "F";
}), { R: "#9a5b07", F: "#f7a823", S: "#d98a12", M: "#fff1c9" });

const LAND = ["................", "................", ".....LL.........", "....LLLL....LL..", "...LLLLL...LLLL.", "...LLLL....LLL..", "....LL.....LL...", ".....LL.........", "......LLL...L...", "......LLLL..LL..", ".......LL...LLL.", ".......L....LL..", "................", "................", "................", "................"];
sprite("globe", disc((x, y, d) => (d >= 7.6 ? "." : d >= 6.6 ? "R" : LAND[y][x] === "L" ? (x + y > 16 ? "l" : "L") : x + y > 17 ? "w" : "W")),
  { R: "#123a6b", W: "#3b8fe6", w: "#2a6fc0", L: "#64d468", l: "#3fa54a" });

sprite("die", [
  "................",
  "..KKKKKKKKKKKK..",
  ".KWWWWWWWWWWWWK.",
  ".KWDDWWWWWWDDWK.",
  ".KWDDWWWWWWDDWK.",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWWDDWWWWWK.",
  ".KWWWWWDDWWWWWK.",
  ".KWWWWWWWWWWWWK.",
  ".KWWWWWWWWWWWWK.",
  ".KWDDWWWWWWDDWK.",
  ".KWDDWWWWWWDDWK.",
  ".KSWWWWWWWWWWSK.",
  "..KKKKKKKKKKKK..",
  "................",
], { K: "#2b2f3a", W: "#f4f1ea", S: "#cfc9bb", D: "#e2455a" });

// a 5×7 pixel font, only the letters the page uses
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."], E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."], G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"], M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"], O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"], S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."], W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."], "·": [".", ".", ".", "#", ".", ".", "."], " ": ["..", "..", "..", "..", "..", "..", ".."],
};
const textW = (t) => [...t].reduce((w, c) => w + FONT[c][0].length + 1, -1);
const text = (t, s, x0, y0, fill) => {
  let x = x0, r = "";
  for (const c of t) { r += rects(FONT[c].map((row) => row.replace(/#/g, "x")), { x: fill }, s, x, y0); x += (FONT[c][0].length + 1) * s; }
  return r;
};

// the banner: the installer's swamp at sunset (build/background@2x.png, 1320×810) with FLOW and the three apps over the sky
const png = fs.readFileSync(path.join(root, "build/background@2x.png")).toString("base64");
const W = 1320, H = 810, centre = (t, s) => Math.round((W - textW(t) * s) / 2);
const title = "FLOW", sub = "MONEY · HEALTH · TRADING";
const banner = `<image href="data:image/png;base64,${png}" width="${W}" height="${H}" style="image-rendering:pixelated"/>`
  + text(title, 15, centre(title, 15) + 8, 42, "#2a1030") + text(title, 15, centre(title, 15), 34, "#ffe7b0")
  + text(sub, 5, centre(sub, 5) + 5, 165, "#2a1030") + text(sub, 5, centre(sub, 5), 160, "#ffd08a");
fs.writeFileSync(path.join(out, "banner.svg"), svg(W, H, banner));

// the download buttons: a chunky pixel frame, a down arrow and the words
const ARROW = ["..##..", "..##..", "..##..", "######", ".####.", "..##.."];
const button = (name, label, face, edge) => {
  const s = 4, w = 16 + 6 * s + 12 + textW(label) * s + 18, h = 13 * s;
  const frame = `<rect x="4" y="0" width="${w - 8}" height="${h}" fill="${edge}"/><rect x="0" y="4" width="${w}" height="${h - 8}" fill="${edge}"/>`
    + `<rect x="8" y="4" width="${w - 16}" height="${h - 12}" fill="${face}"/><rect x="4" y="8" width="${w - 8}" height="${h - 20}" fill="${face}"/>`
    + `<rect x="8" y="${h - 8}" width="${w - 16}" height="4" fill="#00000040"/>`;
  const arrow = rects(ARROW.map((r) => r.replace(/#/g, "x")), { x: "#fff7e0" }, s, 16, 12);
  fs.writeFileSync(path.join(out, `${name}.svg`), svg(w, h, frame + arrow + text(label, s, 16 + 6 * s + 12, 12, "#fff7e0")));
};
button("btn-mac", "DOWNLOAD FOR MAC", "#e06a3b", "#5a1f2a");
button("btn-win", "DOWNLOAD FOR WINDOWS", "#3b7fe0", "#1b2a5a");
console.log(fs.readdirSync(out).join(" "));
