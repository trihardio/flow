/* The installer's window: a swamp at sunset in pixel art (30 October 2026, his words: "make custom pixel art background on
   the dmg distribution file on mac. following the crocodile theme i want you to make a detailed swamp with a croc
   somewhere surrounded by trees (the forest) and a sort of sunset, though not covering the flow logo or the applications
   file logo").
   Drawn on a 220 × 135 grid, one square = 3 points: build/background.png (660 × 405) and build/background@2x.png
   (1320 × 810, each square 6 pixels); electron-builder makes the window from them and puts the two icons at
   `dmg.contents` (package.json): Flow at (165, 240), Applications at (495, 240), centres in points.
   Built like a photograph, back to front: the sky (a dithered sunset, a few lit clouds, the first stars), the sun on
   the horizon, a far forest in haze (lighter and warmer the further it is: atmospheric perspective), two stands of bald
   cypress framing the scene (dark, Spanish moss, a rim of sunlight on the edges facing the sun), the water mirroring
   all of it with a broken path of sun, and in front, sharp and darkest, reeds, cattails and lily pads. The croc is the
   point of focus: on the sun's path, between and below the two icons, swimming towards Applications, its wake drawn
   back towards Flow (the way to drag). Where the icons and their names go the water is left calm, and mid-toned under
   the names, so black (light look) and white (dark look) names both read.
   Run: node tools/dmg/swamp.mjs [--guide]   (--guide also writes tools/dmg/guide.png with the icons' places marked) */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const W = 220, H = 135, HZ = 60;            // the grid, and the horizon's row
const SUN = { x: 110, y: 51, r: 16 };
const ICONS = [{ x: 55, y: 80 }, { x: 165, y: 80 }];    // centres in squares (165 and 495, 240 points)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// a seeded random, so the picture is the same every run
let seed = 20261030;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// a value 0..1 on a ramp of colours, dithered between neighbours (pixel art's banding)
const ramp = (pal, v, x, y) => {
  const p = Math.max(0, Math.min(1, v)) * (pal.length - 1), i = Math.floor(p), f = p - i;
  return pal[Math.min(pal.length - 1, f > BAYER[y & 3][x & 3] ? i + 1 : i)];
};

const SKY = ["#120c26", "#1d1336", "#2e1945", "#461e52", "#652657", "#8b3058", "#b23f56", "#d65a4f", "#ee7c4c", "#fb9f55", "#ffbf68", "#ffdb8a"].map(hex);
const WATER = ["#0b0a18", "#141127", "#1e1833", "#2b1d40", "#3e2248", "#55284f", "#6f3152", "#8a3d55", "#a54f58", "#bf685c", "#d78a66", "#efb478"].map(hex);
const C = {
  star: hex("#e8dcff"), star2: hex("#fff3c4"),
  sunCore: hex("#fff6cf"), sunMid: hex("#ffe49a"), sunEdge: hex("#ffc46a"),
  far: hex("#7a3a60"), farRim: hex("#a8506a"), farDeep: hex("#5c2c55"),
  tree: hex("#1f1226"), tree2: hex("#2a172f"), leaf: hex("#2d1a30"), leaf2: hex("#3a2238"), moss: hex("#5a4058"), moss2: hex("#43303f"),
  rim: hex("#ff9a5c"), rim2: hex("#e0704f"),
  reed: hex("#120a15"), reed2: hex("#1d111f"), cattail: hex("#3a2016"), cattailRim: hex("#a8573a"),
  pad: hex("#22301f"), pad2: hex("#36502f"), padRim: hex("#d9895a"), lotus: hex("#ff8fb0"), lotus2: hex("#ffd2df"),
  croc: hex("#17201a"), croc2: hex("#24301f"), crocRim: hex("#ffae63"), crocRim2: hex("#ff8a52"), eye: hex("#ffe9a0"), iris: hex("#e39a2f"),
  wake: hex("#f3b878"), wake2: hex("#c97a5e"),
  bird: hex("#2a1530"), fly: hex("#fff6a8"),
  cloudTop: hex("#5e2858"), cloud: hex("#923a62"), cloudLit: hex("#e2705c"), cloudHot: hex("#ffa36a"),
};

const px = Array.from({ length: H }, () => Array(W).fill(null));
const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y][x] = c; };
const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? px[y][x] : null);
const iconAt = (x, y) => ICONS.some((ic) => Math.abs(x - ic.x) <= 18 && y >= ic.y - 18 && y <= ic.y + 24);   // an icon and its name, with room

/* ---- the sky: a sunset ramp, warmer near the sun, dithered ---- */
const skyV = (x, y) => {
  const t = Math.pow(y / HZ, 1.25), d = Math.hypot((x - SUN.x) * 0.8, (y - SUN.y) * 1.5), g = Math.max(0, 1 - d / 95);
  return Math.min(1, t * 0.84 + g * g * 0.42);
};
for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) put(x, y, ramp(SKY, skyV(x, y), x, y));
// the first stars, where the sky is darkest
for (let y = 0; y < 22; y++) for (let x = 0; x < W; x++) if (skyV(x, y) < 0.2 && hash(x, y) < 0.016) put(x, y, hash(y, x) < 0.3 ? C.star2 : C.star);
// clouds: long thin strata, lit from below by the sun
const cloud = (x0, x1, y, th, lit) => {
  for (let x = x0; x <= x1; x++) {
    const e = Math.min(x - x0, x1 - x) / 6, h = Math.max(0, Math.min(th, Math.round(e + Math.sin(x * 0.37 + y) * 0.8)));
    for (let k = 0; k < h; k++) {
      const yy = y - k, under = k === 0, top = k === h - 1 && h > 1;
      const c = under ? (lit > 0.6 ? C.cloudHot : C.cloudLit) : top ? C.cloudTop : C.cloud;
      if (!(top && BAYER[yy & 3][x & 3] > 0.7)) put(x, yy, c);
    }
  }
};
cloud(14, 82, 21, 3, 0.3); cloud(52, 96, 33, 2, 0.6); cloud(132, 205, 26, 3, 0.4); cloud(150, 190, 38, 2, 0.75); cloud(96, 128, 15, 2, 0.2);
// three birds going home
for (const [bx, by] of [[150, 13], [158, 10], [164, 15], [60, 9]]) { put(bx, by, C.bird); put(bx + 1, by + 1, C.bird); put(bx + 2, by, C.bird); put(bx - 1, by - 1, C.bird); put(bx + 3, by - 1, C.bird); }

/* ---- the sun, setting: bands cut through its lower half ---- */
for (let y = SUN.y - SUN.r; y < HZ; y++) for (let x = SUN.x - SUN.r; x <= SUN.x + SUN.r; x++) {
  const d = Math.hypot(x - SUN.x, y - SUN.y);
  if (d > SUN.r) continue;
  const gap = (y === SUN.y - 6) || (y === SUN.y - 3) || (y === SUN.y - 1) || (y === SUN.y + 1);
  if (gap && y > SUN.y - 7) continue;
  put(x, y, d < SUN.r - 9 ? C.sunCore : d < SUN.r - 3 ? C.sunMid : d < SUN.r - 1 ? C.sunEdge : BAYER[y & 3][x & 3] > 0.5 ? C.sunEdge : ramp(SKY, 0.95, x, y));
}

/* ---- the far forest, in haze: rounded crowns of different sizes, a few tall cypress spires, the odd gap ---- */
const farTop = Array(W).fill(HZ);
// a soft canopy: smooth noise at two scales, and small round crowns on it; lower near the sun so it shows whole
const vn = (t, k) => { const i = Math.floor(t), f = t - i, a = hash(i, k), b = hash(i + 1, k), u = (1 - Math.cos(f * Math.PI)) / 2; return a + (b - a) * u; };
for (let x = 0; x < W; x++) {
  const near = Math.max(0, 1 - Math.abs(x - SUN.x) / 40);
  const h = 5 + vn(x * 0.045, 1) * 7 + vn(x * 0.16, 2) * 3 - near * 3.5;
  farTop[x] = Math.round(HZ - h);
}
const base = farTop.slice();
for (let n = 0; n < 34; n++) {
  const cx = rnd() * W, r = 2 + rnd() * 3.2, lift = 1 + rnd() * 2.5;
  for (let i = Math.floor(cx - r); i <= cx + r; i++) {
    if (i < 0 || i >= W) continue;
    const q = 1 - ((i - cx) / r) ** 2;
    if (q > 0) farTop[i] = Math.min(farTop[i], Math.round(base[i] - lift * Math.sqrt(q)));
  }
}
for (let x = 0; x < W; x++) for (let y = farTop[x]; y < HZ + 1; y++) {
  const haze = 0.35 + 0.3 * Math.max(0, 1 - Math.abs(x - SUN.x) / 70);      // nearer the sun, more light comes through the haze
  const top = y === farTop[x] || y === farTop[x] + (farTop[x - 1] > y || farTop[x + 1] > y ? 0 : -1);
  const base = mix(top ? C.farRim : C.far, ramp(SKY, 0.88, x, y), haze * (top ? 0.6 : 0.35));
  put(x, y, y >= HZ - 1 ? mix(base, C.farDeep, 0.5) : base);
}
// low mist lying on the water at the foot of the far trees: a soft band, not a pattern
for (let y = HZ - 2; y <= HZ + 1; y++) for (let x = 0; x < W; x++) put(x, y, mix(get(x, y) || C.far, hex("#ffb58a"), y === HZ ? 0.3 : 0.16));

/* ---- the water: the sky mirrored, darker and cooler with depth ---- */
for (let y = HZ + 1; y < H; y++) for (let x = 0; x < W; x++) {
  const my = Math.max(0, HZ - (y - HZ) * 0.85), depth = (y - HZ) / (H - HZ);
  const v = skyV(x, my) * 0.92 - depth * 0.17 + Math.sin(x * 0.09 + y * 1.7) * 0.012;
  put(x, y, ramp(WATER, v, x, y));
}

/* ---- the near trees: bald cypresses framing both sides, Spanish moss, lit along the edges facing the sun ---- */
const mask = Array.from({ length: H }, () => Array(W).fill(0));    // 1 trunk, 2 crown, 3 moss
const mark = (x, y, k) => { if (x >= 0 && y >= 0 && x < W && y < H && !iconAt(x, y)) mask[y][x] = Math.max(mask[y][x], k); };
const blob = (cx, cy, rx, ry, k) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d <= 1 - hash(x, y) * 0.25) mark(x, y, k); } };
const cypress = (cx, base, height, reach, side) => {
  // the trunk: flared like a bell at the water, thin and slightly leaning above
  for (let y = base; y > base - height; y--) {
    const up = base - y, w = 1.4 + Math.max(0, 7 - up) * 0.75 + (up < 3 ? 1 : 0), lean = Math.round(up * 0.04 * side);
    for (let x = Math.round(cx + lean - w); x <= Math.round(cx + lean + w); x++) mark(x, y, 1);
  }
  // knees: little stumps around the foot
  for (const dx of [-7, -4, 5, 8]) { const kx = cx + dx * (0.9 + rnd() * 0.3); for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) mark(Math.round(kx), base - k, 1); }
  // crowns: flat clumps in tiers, as bald cypress grows, with moss hanging from their undersides
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const ty = base - height + 4 + i * (height * 0.13), off = (i % 2 ? 1 : -1) * reach * (0.35 + rnd() * 0.5) * (1 - i * 0.06) + side * reach * 0.25;
    const bx = cx + off, rx = 4 + rnd() * 4 + (tiers - i) * 0.6, ry = 1.6 + rnd() * 1.2;
    // a branch out to it
    const sx = cx + Math.round((base - ty) * 0.04 * side);
    for (let x = Math.min(sx, Math.round(bx)); x <= Math.max(sx, Math.round(bx)); x++) mark(x, Math.round(ty + 2), 1);
    blob(bx, ty, rx, ry, 2); blob(bx + rx * 0.5, ty - 1, rx * 0.6, ry, 2);
    for (let s = 0; s < rx * 1.3; s++) {
      const mx = Math.round(bx - rx + rnd() * rx * 2), len = 2 + Math.floor(rnd() * 8);
      for (let k = 1; k <= len; k++) if (hash(mx, k) > 0.12 || k < 3) mark(mx + (k > 5 && hash(mx, ty) > 0.6 ? side : 0), Math.round(ty + ry + k - 1), 3);
    }
  }
  blob(cx + side, base - height + 1, 5, 2.2, 2);      // the top
};
cypress(9, HZ + 9, 62, 14, 1); cypress(30, HZ + 3, 44, 9, 1); cypress(-3, HZ + 6, 50, 8, 1);
cypress(211, HZ + 9, 64, 14, -1); cypress(191, HZ + 3, 42, 9, -1); cypress(224, HZ + 5, 52, 8, -1);
const inMask = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y][x] > 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = mask[y][x];
  if (!k) continue;
  // the rim of light: an edge whose neighbour towards the sun is open sky
  const sx = Math.sign(SUN.x - x), sy = y > SUN.y ? -1 : 0, lit = !inMask(x + sx, y) && y < HZ + 2, litTop = !inMask(x, y - 1) && y < HZ;
  let c = k === 1 ? (BAYER[y & 3][x & 3] > 0.5 ? C.tree : C.tree2) : k === 2 ? (BAYER[y & 3][x & 3] > 0.6 ? C.leaf2 : C.leaf) : (hash(x, y) > 0.5 ? C.moss : C.moss2);
  if (k !== 3 && (lit || litTop) && hash(x, y + 3) > 0.25) c = Math.abs(x - SUN.x) < 120 && hash(x, y) > 0.45 ? C.rim : C.rim2;
  put(x, y, c);
  void sy;
}
// the trees in the water: mirrored, shaken by ripples, broken by light lines
for (let y = HZ + 1; y < H; y++) for (let x = 0; x < W; x++) {
  const sy = 2 * (HZ + 8) - y, wob = Math.round(Math.sin(y * 0.9) * 1.2);
  if (sy < 0 || sy >= H || iconAt(x, y) || y - HZ < 9) continue;
  if (inMask(x + wob, sy) && (y % 3 !== 0)) put(x, y, mix(get(x, y), hex("#120a1a"), 0.55));
}

/* ---- the sun's path on the water: broken dashes, wider nearer us ---- */
for (let y = HZ + 1; y < H; y++) {
  const near = (y - HZ) / (H - HZ), w = 3 + near * 20;
  for (let seg = 0; seg < 3; seg++) {
    if (hash(seg, y) < 0.3 + near * 0.2) continue;
    const len = Math.round(w * (0.25 + hash(y, seg) * 0.55)), x0 = Math.round(SUN.x - w / 2 + hash(seg * 7, y) * (w - len));
    for (let x = x0; x < x0 + len; x++) if (!iconAt(x, y)) put(x, y, near < 0.25 ? C.sunMid : ramp([hex("#ffb35c"), hex("#ffd27a"), C.sunMid], 1 - near * 0.8, x, y));
  }
}
// ripples: short light lines, longer nearer us; none where the icons sit
for (let n = 0; n < 150; n++) {
  const y = HZ + 3 + Math.floor(rnd() * (H - HZ - 4)), near = (y - HZ) / (H - HZ), len = 1 + Math.floor(rnd() * (2 + near * 6)), x0 = Math.floor(rnd() * W);
  for (let x = x0; x < x0 + len; x++) { const c = get(x, y); if (c && !iconAt(x, y) && Math.abs(x - SUN.x) > 3) put(x, y, mix(c, hex("#ffc98e"), 0.22 + near * 0.12)); }
}

/* ---- the croc: the focal point. Where the sun's path widens nearest us it pools into a patch of light; the croc
   crosses it as a crisp silhouette (backlit, as a photograph at sunset would have it), its eye catching the light,
   swimming towards Applications with its wake opening back towards Flow ---- */
const X0 = 77, CY = 121;          // the tail's end, and the waterline
const POOL = { x: X0 + 30, y: CY - 1, rx: 37, ry: 6.2 };
const GOLD = [hex("#c9733f"), hex("#ee9a4f"), hex("#ffbb63"), hex("#ffd785"), hex("#ffeaa6")];
for (let y = Math.floor(POOL.y - POOL.ry - 1); y <= POOL.y + POOL.ry + 1; y++) for (let x = POOL.x - POOL.rx - 1; x <= POOL.x + POOL.rx + 1; x++) {
  const d = Math.hypot((x - POOL.x) / POOL.rx, (y - POOL.y) / POOL.ry);
  if (d > 1.05 || (d > 0.8 && BAYER[y & 3][x & 3] < (d - 0.8) * 4)) continue;
  put(x, y, ramp(GOLD, 1 - d * 0.9 + (y % 2 ? -0.06 : 0.04), x, y));
}
// the sprite, row by row from the top of the eye's bump to the waterline: # body, e the eye's glint, a its amber, t a tooth
const row = (n, spans) => { const r = Array(56).fill(" "); for (const [a, b, ch = "#"] of spans) for (let x = a; x <= b; x++) r[x] = ch; return r.join(""); };
const SPR = [
  row(56, [[33, 35]]),
  row(56, [[32, 36]]),
  row(56, [[31, 38], [32, 32, "e"], [33, 33, "a"]]),
  row(56, [[6, 7], [11, 12], [16, 17], [21, 22], [26, 27], [29, 39], [48, 50]]),
  row(56, [[3, 44], [47, 51]]),
  row(56, [[1, 52]]),
  row(56, [[0, 51], [41, 41, "t"], [44, 44, "t"], [47, 47, "t"]]),
];
const K = hex("#0d110e"), D = hex("#1a2418");
const TOP = SPR.length;
const at = (x, y) => (SPR[y + TOP] || "")[x] || " ";
for (let r = 0; r < SPR.length; r++) for (let x = 0; x < SPR[r].length; x++) {
  const ch = SPR[r][x], y = r - TOP;
  if (ch === " ") continue;
  const c = ch === "e" ? hex("#fff1b0") : ch === "a" ? hex("#e39a2f") : ch === "t" ? hex("#efe2c4") : at(x, y - 1) === " " || at(x - 1, y) === " " || at(x + 1, y) === " " ? K : D;
  put(X0 + x, CY + y, c);
}
put(X0 + 34, CY - 7, hex("#ff9a52")); put(X0 + 35, CY - 6, hex("#c9733f"));            // the sun on its brow
// its reflection on the pool: the silhouette upside down, broken by ripples
for (let r = 0; r < SPR.length; r++) for (let x = 0; x < SPR[r].length; x++) {
  if (SPR[r][x] === " ") continue;
  const ry = CY + (TOP - 1 - r);
  if ((ry + x) % 3 !== 0) put(X0 + x, ry, mix(get(X0 + x, ry), K, 0.6));
}
// the bow wave at its snout, and the V of its wake: two clean lines opening back towards Flow
for (const [x, y] of [[53, -1], [54, -1], [53, 0], [54, 0], [55, 0], [52, -2], [53, -2]]) put(X0 + x, CY + y, hex("#fff0c0"));
for (let k = 0; k < 48; k++) {
  const fade = 1 - k / 48, x = X0 + 4 - k, c = fade > 0.5 ? C.wake : C.wake2;
  if (k < 30 || hash(k, 3) < fade + 0.25) put(x, CY - 2 - Math.round(k * 0.1), c);
  if (k < 30 || hash(k, 5) < fade + 0.2) put(x, CY + 1 + Math.round(k * 0.3), c);
}

/* ---- in front, sharp and darkest: reeds and cattails at the left, lily pads and a lotus at the right ---- */
const reed = (x, h, bend, tail) => {
  for (let k = 0; k < h; k++) {
    const xx = x + Math.round(bend * (k / h) ** 2);
    put(xx, H - 1 - k, k > h - 3 && !tail ? C.reed2 : C.reed);
    if (k > h * 0.35 && hash(xx, k + h) > 0.55) put(xx + 1, H - 1 - k, k > h * 0.7 ? C.rim2 : mix(C.rim2, C.reed, 0.5));      // the sun along one edge
  }
  if (tail) { const tx = x + Math.round(bend); for (let k = 0; k < 5; k++) { put(tx, H - h - 2 - k, C.cattail); put(tx + 1, H - h - 2 - k, k < 4 ? C.cattail : C.reed); put(tx + 1, H - h - 2 - k, k % 2 ? C.cattailRim : C.cattail); } put(tx, H - h - 8, C.reed); }
};
for (const [x, h, b, t] of [[2, 30, 2, 1], [4, 22, -1, 0], [6, 34, 3, 0], [8, 26, 1, 1], [11, 18, 4, 0], [13, 24, -2, 1], [15, 14, 2, 0], [17, 19, 5, 0], [20, 11, 3, 0], [0, 25, 1, 0], [23, 8, 2, 0]]) reed(x, h, b, t);
const pad = (cx, cy, rx) => {
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / 1.6) ** 2;
    if (d > 1 || (x === cx + 1 && y < cy + 1 && y >= cy - 1 && x > cx)) continue;          // the notch
    put(x, y, y === cy - 1 ? (x < cx ? C.padRim : C.pad2) : d > 0.6 ? C.pad : BAYER[y & 3][x & 3] > 0.5 ? C.pad2 : C.pad);
  }
};
for (const [x, y, r] of [[198, 127, 6], [210, 122, 5], [186, 131, 5], [214, 132, 6], [176, 125, 3], [146, 130, 3], [30, 128, 4], [42, 132, 5], [38, 124, 3]]) pad(x, y, r);
// a fallen log drifting at the right, lit along its top, a turtle on it
for (let x = 150; x <= 178; x++) {
  const yy = 117 + Math.round((x - 150) * 0.12);
  put(x, yy, x % 5 === 0 ? C.cattailRim : C.rim2); put(x, yy + 1, x % 3 ? C.reed2 : C.cattail); put(x, yy + 2, C.reed);
  if ((x + yy) % 2) put(x, yy + 3, mix(get(x, yy + 3), C.reed, 0.5));
}
for (const [x, y] of [[149, 117], [149, 118], [179, 120], [179, 121]]) put(x, y, C.cattail);
for (const [x, y, c] of [[162, 116, C.croc2], [163, 116, C.croc2], [164, 116, C.croc2], [163, 115, C.pad2], [162, 115, C.pad2], [165, 116, C.pad2], [166, 117, C.croc]]) put(x, y, c);
// the lotus on the biggest pad
for (const [x, y, c] of [[198, 123, C.lotus], [197, 124, C.lotus], [199, 124, C.lotus], [198, 124, C.lotus2], [196, 125, C.lotus], [200, 125, C.lotus], [197, 125, C.lotus2], [198, 125, C.lotus], [199, 125, C.lotus2], [198, 122, C.lotus2]]) put(x, y, c);

/* ---- ground fog on the water where the icons' names sit (it's how a swamp looks at dusk, and it keeps the names
   readable: mid-toned, so black names and white names both stand out) ---- */
const FOG = hex("#c08088");
for (let y = ICONS[0].y + 12; y <= ICONS[0].y + 28; y++) {
  const c = ICONS[0].y + 20.5, k = Math.max(0, 1 - Math.abs(y - c) / 8.5);
  for (let x = 0; x < W; x++) {
    const side = Math.min(1, Math.min(x, W - 1 - x) / 40);                   // thinner towards the trees
    const wisp = 0.82 + Math.sin(x * 0.11 + y * 0.7) * 0.12 + Math.sin(x * 0.043 - y) * 0.1;      // drifting, thicker and thinner
    const s0 = k * (0.32 + 0.5 * side) * wisp;
    const cur = get(x, y);
    if (cur && s0 > BAYER[y & 3][x & 3] * 0.22) put(x, y, mix(cur, FOG, s0));
  }
}
// a soft vignette: the corners darker, the eye drawn to the middle
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = (x - W / 2) / (W / 2), dy = (y - H * 0.45) / (H * 0.6), d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.86 && !iconAt(x, y)) put(x, y, mix(get(x, y), [8, 6, 16], Math.min(0.4, (d - 0.86) * 0.8)));
}

/* ---- fireflies in the trees ---- */
for (const [x, y] of [[36, 44], [24, 58], [41, 33], [18, 70], [44, 55], [33, 76], [183, 40], [176, 57], [196, 66], [171, 45], [188, 78], [203, 52], [28, 88], [192, 92]]) {
  if (iconAt(x, y)) continue;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = get(x + dx, y + dy); if (c) put(x + dx, y + dy, mix(c, C.fly, 0.35)); }
  put(x, y, C.fly);
}

/* ---- out: PNGs at 3 and 6 pixels a square ---- */
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const png = (s, mark) => {
  const w = W * s, h = H * s, raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      let c = px[Math.floor(y / s)][Math.floor(x / s)] || [255, 0, 255];
      if (mark) { const gx = x / s, gy = y / s; for (const ic of ICONS) { const inIcon = Math.abs(gx - ic.x) <= 16 && Math.abs(gy - ic.y) <= 16, onEdge = inIcon && (Math.abs(gx - ic.x) > 15.6 || Math.abs(gy - ic.y) > 15.6); const lab = Math.abs(gx - ic.x) <= 14 && gy >= ic.y + 18 && gy <= ic.y + 23; if (onEdge) c = [255, 255, 255]; else if (lab && (Math.floor(gx) + Math.floor(gy)) % 2) c = mix(c, [0, 0, 0], 0.5); } }
      const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  // 72 dpi at 1x, 144 at 2x, so the 2x one is taken for Retina
  const phys = Buffer.alloc(9); const ppm = Math.round((s === 6 ? 144 : 72) / 0.0254); phys.writeUInt32BE(ppm, 0); phys.writeUInt32BE(ppm, 4); phys[8] = 1;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("pHYs", phys), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
};
writeFileSync(path.join(root, "build", "background.png"), png(3));
writeFileSync(path.join(root, "build", "background@2x.png"), png(6));
if (process.argv.includes("--guide")) writeFileSync(path.join(root, "tools", "dmg", "guide.png"), png(4, true));

// the names' contrast: the water under each name against black and white text
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
for (const ic of ICONS) {
  let sum = 0, n = 0;
  for (let y = ic.y + 18; y <= ic.y + 23; y++) for (let x = ic.x - 14; x <= ic.x + 14; x++) { sum += lum(px[y][x]); n++; }
  const L = sum / n;
  console.log(`name under (${ic.x * 3}, ${ic.y * 3}) pt: luminance ${L.toFixed(3)} · black text ${((L + 0.05) / 0.05).toFixed(1)}:1 · white text ${(1.05 / (L + 0.05)).toFixed(1)}:1`);
}
console.log("wrote build/background.png (660×405) and build/background@2x.png (1320×810)");
// a close look at a part (for drawing): CROP=x,y,w,h in squares writes tools/dmg/crop.png at 10 pixels a square
if (process.env.CROP) {
  const [cx0, cy0, cw, ch] = process.env.CROP.split(",").map(Number), s = 10, raw = Buffer.alloc((cw * s * 3 + 1) * ch * s);
  for (let y = 0; y < ch * s; y++) { raw[y * (cw * s * 3 + 1)] = 0; for (let x = 0; x < cw * s; x++) { const c = px[cy0 + Math.floor(y / s)]?.[cx0 + Math.floor(x / s)] || [0, 0, 0]; const o = y * (cw * s * 3 + 1) + 1 + x * 3; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cw * s, 0); ihdr.writeUInt32BE(ch * s, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path.join(root, "tools", "dmg", "crop.png"), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
