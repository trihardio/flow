import { Fragment, memo, useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

const STORE_KEY = "pnl-calendar-idr";
if (typeof document !== "undefined") {
  document.documentElement.style.background = "#0e1012";
  if (document.body) document.body.style.background = "#0e1012";
}
// RELEASE SWITCH: set to false for the official build to hide "Add test data" / "Clear test data"
const SHOW_TEST_TOOLS = true;
// AI helpers (categorising expenses, picking goal icons) run on an on-device model inside the Mac app
// (window.flowAI, fully offline). In a plain browser they're skipped quietly and the keyword rules do the work
const AI_OK = typeof window !== "undefined" && !!window.flowAI;

/* Persistence adapter.
   - Inside Claude artifacts, window.storage is provided.
   - Running locally (vite/CRA/Electron), fall back to localStorage so the
     data survives reloads, restarts and app packaging. */
const store = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage?.get) return window.storage.get(key);
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (v === null) throw new Error("not found");
    return { key, value: v };
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage?.set) return window.storage.set(key, value);
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return { key, value };
  },
};
// A backup holds only what he entered himself: generated test entries (test: true) are left out, and a day or month
// left with nothing is dropped. In the Mac app the file goes straight into his "exports" folder, in a folder of its
// side that electron/main.cjs picks from the file's name (pnl-export-…, crypto-export-…, idx-export-…).
const ownEntries = (byKey) => Object.fromEntries(Object.entries(byKey).map(([k, list]) => [k, list.filter((it) => !it.test)]).filter(([, list]) => list.length));
const BACKUP_DONE = AI_OK ? "Saved to exports" : "Backup downloaded";

/* ---------- warm-up: the screens he has opened before are drawn once more, all but invisibly, under the opening screen ----------
   The first time a screen is shown after a launch it pays for things its second showing doesn't: its text is shaped in
   every font, weight and size it uses, the system is asked for a font for the few characters Inter lacks, pictures are
   decoded, and the graphics process builds a small program for each new kind of paint, blur and blend. A burst of
   those freezes a few frames: the lag Rassam saw the first time he went to the wallets, scrolled down to a card or
   opened a chart, and never the second time. None of it can be asked for ahead of time, except by drawing the thing.
   So a moment after a screen has settled, its markup is filed away (IndexedDB "flow-warm", apart from his data and
   never in a backup), and at the next launch every filed screen is put back into the page for a couple of frames:
   laid out, painted and drawn at next to no opacity, in a box nothing can click or focus, then thrown away. That is
   done while the opening screen stands still (its pieces have landed, the outro hasn't begun), the screens needed
   soonest and used most recently first, as many as fit (about a dozen); nothing of it runs once the app is in use. It never touches
   the real panels or their state, so it can't break them; it only makes their first showing as cheap as their
   second. A screen he has never opened is simply not warmed. */
// a screen is filed this long after it opened, once its own animations are over, and again later if he is still on
// it (by then he has scrolled, and the cards further down have come in), each time when the page is idle
const WARM_SETTLE_MS = 1400, WARM_AGAIN_MS = [7000, 25000];
const WARM_MAX_CHARS = 700000;         // a screen bigger than this is not filed
const WARM_KEEP_MS = 30 * 86400000;    // a screen not opened for a month is no longer warmed
const WARM_MAX_SLICES = 3;             // a long page is drawn a window-height at a time, this many at most
const warm = { page: null, db: null, all: null, pending: null };
const warmOpen = () => (warm.db ||= new Promise((done) => {
  try {
    const rq = indexedDB.open("flow-warm", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("screens", { keyPath: "key" });
    rq.onsuccess = () => done(rq.result);
    rq.onerror = rq.onblocked = () => done(null);
  } catch (e) { done(null); }
}));
const warmAll = async () => {
  const db = await warmOpen();
  if (!db) return [];
  return new Promise((done) => {
    try {
      const rq = db.transaction("screens").objectStore("screens").getAll();
      rq.onsuccess = () => done(rq.result || []);
      rq.onerror = () => done([]);
    } catch (e) { done([]); }
  });
};
// Run `job` in a gap with room for it, so it never pushes a frame late: while something is animating the gaps are
// too short and it waits. Returns what cancels it.
const warmWhenIdle = (job, opts) => {
  let id = 0;
  const run = (gap) => {
    if (gap.timeRemaining() < 10 && !gap.didTimeout) { id = window.requestIdleCallback(run, opts); return; }
    job();
  };
  id = window.requestIdleCallback(run, opts);
  return () => window.cancelIdleCallback(id);
};
// File the page as it stands now under `key` (the newest copy replaces the one before).
// rank: what is needed soonest after a launch is warmed first (0 the wallets and the trading selection, 1 a panel,
// 2 a pop-up). Of a pop-up ("panel+chart") only the pop-up is filed: the panel under it has its own copy.
const warmFile = (key, rank) => {
  const page = warm.page;
  if (!page) return;
  // an element's markup without what is marked data-nowarm: the 3D coin (a hundred layers) and the stage's backdrop,
  // which are on the first screen anyway
  const markup = (el) => {
    if (el.hasAttribute("data-nowarm")) return "";
    if (!el.querySelector("[data-nowarm]")) return el.outerHTML;
    const shell = el.cloneNode(false).outerHTML, cut = shell.lastIndexOf("</");
    return shell.slice(0, cut) + [...el.children].map(markup).join("") + shell.slice(cut);
  };
  let html = "";
  for (const el of page.children) {
    if (el.tagName === "STYLE" || el.classList.contains("open-panel")) continue;
    if (rank === 2 && getComputedStyle(el).position !== "fixed") continue;
    html += markup(el);
  }
  if (!html || html.length > WARM_MAX_CHARS) return;
  // reading the markup took a few ms; storing it takes a few more, so that waits for a gap of its own
  warmOpen().then((db) => db && warmWhenIdle(() => {
    try { db.transaction("screens", "readwrite").objectStore("screens").put({ key, rank, html, at: Date.now() }); } catch (e) { /* not filed: it just won't be warmed */ }
  }));
};
// the screen named `key` is filed once it has stood for a moment (null: nothing to file, e.g. in the middle of a transition)
const useWarmScreen = (key, rank = key && key.includes("+") ? 2 : 1) => {
  useEffect(() => {
    if (!key || typeof indexedDB === "undefined" || !window.requestIdleCallback) return;
    let cancel = () => {};
    // the first copy is taken within four seconds whatever happens; the later ones only if the page falls idle
    const file = (opts) => () => { cancel(); cancel = warmWhenIdle(() => warmFile(key, rank), opts); };
    const timers = [setTimeout(file({ timeout: 4000 }), WARM_SETTLE_MS), ...WARM_AGAIN_MS.map((ms) => setTimeout(file(), ms))];
    return () => { timers.forEach(clearTimeout); cancel(); };
  }, [key]);
};
const warmFrame = () => new Promise((next) => requestAnimationFrame(next));
const warmHost = () => {
  const host = document.createElement("div");
  host.className = "warm-host";
  host.setAttribute("inert", "");
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  return host;
};
// One filed screen: put in (laid out, painted, drawn), then the outline of every second element is touched, which
// repaints those in place (redrawing part of a tile already drawn has its own set of graphics programs, the ones a
// highlight under the pointer or a number changing would otherwise be the first to ask for), then on down a long page
// a window-height per frame. `go()` false stops it early.
const warmOne = async (host, sc, go) => {
  const box = document.createElement("div");
  box.className = "warm-screen";
  box.innerHTML = sc.html;
  host.appendChild(box);
  const tall = Math.min(WARM_MAX_SLICES, Math.ceil(box.scrollHeight / window.innerHeight));
  await warmFrame();
  box.classList.add("touch");
  await warmFrame();
  for (let i = 1; i < tall && go(); i++) { box.style.top = `${-i * window.innerHeight}px`; await warmFrame(); }
  box.remove();
};
// App start: draw as many filed screens as fit before `deadline` (performance.now()), under the opening screen
const warmReplay = (deadline) => (warm.pending = (async () => {
  if (typeof document === "undefined" || typeof indexedDB === "undefined") return;
  const queue = (await (warm.all || warmAll())).filter((sc) => sc && typeof sc.html === "string" && Date.now() - sc.at < WARM_KEEP_MS)
    .sort((a, b) => (a.rank ?? 1) - (b.rank ?? 1) || b.at - a.at);
  const left = () => deadline - performance.now();
  if (!queue.length || left() < 140) return;
  const host = warmHost();
  const guard = setTimeout(() => host.remove(), Math.max(0, left()));      // gone on time even if no frame comes (window hidden)
  try {
    while (queue.length && left() > 90) await warmOne(host, queue.shift(), () => left() > 60);
    await warmFrame();
  } catch (e) { /* a screen that can't be put back is skipped, with the rest */ }
  clearTimeout(guard);
  host.remove();
})());
// Everything the opening screen and the first panels are drawn with: resolves once the bundled fonts are loaded and
// unpacked (the icon font alone takes ~55ms, which used to land in the middle of the logo coming in) and the logo decoded.
const warmFonts = () => {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve();
  const jobs = [["48px 'Press Start 2P'", "FLOW 0123456789"], ["20px 'Material Symbols Outlined'", "home"], ["400 64px 'Ballet'", "Rassam"],
                ["400 40px 'Mrs Saint Delafield'", "Rassam"], ...[400, 500, 600, 700, 800].map((w) => [`${w} 14px 'Inter'`, "Flow 0123"])]
    .map(([font, text]) => document.fonts.load(font, text).catch(() => {}));
  const logo = document.querySelector(".open-panel-logo");
  if (logo?.decode) jobs.push(logo.decode().catch(() => {}));
  return Promise.all(jobs);
};

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const DOW_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_LIMIT = 50_000;
const WARN_YELLOW = 300_000;
const WARN_RED = 200_000;
const MYR_RATE = 4400;
// RM shown to one decimal, rounded to the nearest 0.1 (11.49 → 11.5)
const oneDp = (rm) => (Math.round(rm * 10 + 1e-9) / 10).toFixed(1);
/* A number while it counts (CountNum) must not flicker. At rest an amount drops its trailing zeros (1,2jt · 1,23jt ·
   800Rb · 800,5Rb), so written that way frame by frame its width jumped between one decimal and two all through
   the count, which Rassam saw under the bar when switching years. While counting, each unit keeps its precision:
   - both ends in this unit, the end having no more decimals than the start (1,23 → 1,5): the start's, all the way;
     it only drops to the end's when the count stops.
   - both ends in this unit, the end having more (1,2 → 1,57): the start's until the digits it shows have arrived
     (1,2 1,3 1,4 1,5), then the end's (1,50 … 1,57). One change, never back.
   - only one end in this unit (1,23jt → 900,9Rb): that end's (1,23 … 1,00jt, then 999,9 … 900,9Rb).
   - a unit the count only passes through: none.
   A unit is [from this amount up, divided by, written after it, most decimals]; null below the smallest unit. */
const LIVE_UNITS = {
  IDR: [[1e6, 1e6, "jt", 2], [1e3, 1e3, "Rb", 1]],                              // the finance side
  IDRT: [[1e9, 1e9, "M", 2], [1e6, 1e6, "jt", 2], [1e3, 1e3, "Rb", 1]],        // the trading side
  MYR: [[1e6, 1e6, "M", 2], [1e3, 1e3, "k", 1]],
  USDT: [[1e6, 1e6, "M", 2], [1e5, 1e3, "K", 0], [1e4, 1e3, "K", 1]],
};
const liveUnit = (v, units) => units.find((u) => v >= u[0]) || null;
const liveAt = (x, u, dp) => Math.floor((x / u[1]) * 10 ** dp + 1e-6);
const restDp = (x, u) => { let dp = u[3]; while (dp > 0 && liveAt(x, u, dp) % 10 === 0) dp--; return dp; };      // decimals it has at rest
const liveText = (v, from, to, units, comma) => {
  const u = liveUnit(v, units);
  if (!u) return null;
  const dF = liveUnit(from, units) === u ? restDp(from, u) : -1, dT = liveUnit(to, units) === u ? restDp(to, u) : -1;
  const dp = dF >= 0 && dT > dF ? (liveAt(v, u, dF) === liveAt(to, u, dF) ? dT : dF) : Math.max(dF, dT, 0);
  const text = (liveAt(v, u, dp) / 10 ** dp).toFixed(dp);
  return (comma ? text.replace(".", ",") : text) + u[2];
};
const WARN_FRAC = 0.75; // weekly line turns yellow above 75% of the daily limit (37.5Rb of 50Rb)
const DOTS_PER_ROW = 12;
// A chart line's first stretch runs from the y-axis to its first point. It sets off at this share of that point's
// value, so it comes in with a slight rise. From zero it was a wall from the corner up to January, which he found weird.
const CHART_LEAD = 0.9;
// the card leaving its wallet and going back in (see the styles): how long each way takes, and its speed curve
const CARD_OUT_MS = 500, CARD_IN_MS = 420;
const CARD_OUT_EASE = "cubic-bezier(0.3,0,0.15,1)", CARD_IN_EASE = "cubic-bezier(0.4,0,0.2,1)";
/* Money flow, as it opens: the income bar fills from the top (FLOW_SRC_MS, easing out); each ribbon sets off at the
   moment the fill reaches its top edge and sweeps across in FLOW_RIB_MS; its expense bar lands as the ribbon's front
   gets there (FLOW_LAND of the sweep), and its label just after. One clock for all of it, so nothing arrives before
   what it hangs from: with one shared sweep and a fixed delay per row, bars used to appear ahead of their ribbons. */
const FLOW_START_MS = 60, FLOW_SRC_MS = 520, FLOW_RIB_MS = 640, FLOW_LAND = 0.8;
/* The page's backdrop (see the body rule), as one picture of a fixed height: a lighter grey at the top that deepens on
   the way down, and five soft glows along the page. It was six CSS gradients on body. With more than one background
   layer the engine draws the whole backdrop again whenever the page's height changes, and a card folding changes
   it on every frame: the graphics process was stuck 7–21ms per frame. One layer of a fixed height isn't redrawn.
   Each glow keeps its colour as it fades out, which is how the engine drew CSS's "transparent": compared pixel by
   pixel with the CSS version, the page's content hidden. */
const PAGE_BG_H = 3800;
const PAGE_BG = (() => {
  const glows = [   // x in % of the width, y, the two radii, the colour, its strength, where it has faded out. The first is on top
    [8, -80, 1100, 720, "168,182,198", 0.17, 0.62], [104, 240, 900, 760, "128,142,158", 0.11, 0.64], [-6, 1180, 1000, 760, "150,164,180", 0.10, 0.64],
    [106, 2050, 1000, 800, "140,154,170", 0.10, 0.64], [40, 2950, 1100, 760, "120,134,150", 0.09, 0.64],
  ];
  const base = [[0, "#272b30"], [420, "#212529"], [1000, "#1b1e22"], [1900, "#16191c"], [3000, "#121417"]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${PAGE_BG_H}"><defs>`
    + `<linearGradient id="b" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="3000">${base.map(([y, c]) => `<stop offset="${y / 3000}" stop-color="${c}"/>`).join("")}</linearGradient>`
    + glows.map(([, , , , rgb, a, end], i) => `<radialGradient id="g${i}"><stop offset="0" stop-color="rgb(${rgb})" stop-opacity="${a}"/><stop offset="${end}" stop-color="rgb(${rgb})" stop-opacity="0"/></radialGradient>`).join("")
    + `</defs><rect width="100%" height="100%" fill="url(#b)"/>`
    + glows.map(([x, y, rx, ry], i) => `<ellipse cx="${x}%" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#g${i})"/>`).reverse().join("")
    + `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
// the header digits wait this long after the yearly panel appears before they start flickering into the pixel font
const YEAR_FLICK_DELAY_MS = 400;
// longest a header digit can flicker after the year intro (that wait + 240ms delay + 1150ms), plus a little slack
const YEAR_FLICK_MS = YEAR_FLICK_DELAY_MS + 1500;
// yearly panel: how much of the neighbouring years shows round the year in view, in px. The year stack fills the
// window down to the footer; the first year sits at the top (all of this shows of the next year below it), the last
// year at the bottom (the previous year shows above it), and any year in between sits in the middle, half on each side.
const YEAR_PEEK = 120;
const QADD_H = 46;          // the height the quick-add row takes from the finance year stack
// the app's name as it stands on the opening screen (pixel wordmark, one falling piece per letter)
const APP_WORD = "FLOW";
// the side titles on the wallets panel and the trading panel: the word, and the shades of its thickness from the back
// (dark) to just behind the white face. Green for the finance side, the coin's gold for trading, both muted
// It faces forward (he asked): each copy also sits a little lower than the one before, one font pixel in all, so the
// thickness shows as a lip under the letters even head-on; the sides only come into view as it sways or leans
const SIDE_DEPTH = 10, SIDE_STEP = 2, SIDE_DROP = 0.3;
const sideShades = (a, b) => Array.from({ length: SIDE_DEPTH }, (_, i) => {
  const t = i / (SIDE_DEPTH - 1);
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(",")})`;
});
const SIDE_WORDS = [
  { text: "FINANCE", shades: sideShades([38, 84, 64], [112, 190, 152]) },
  { text: "TRADING", shades: sideShades([92, 68, 22], [214, 174, 88]) },
];
// opening screen timing: how long the logo and the wordmark stay up, how fast the background fades once the outro starts,
// how long the outro is given before the splash is removed, and (when it is replayed from the footer logo) how long
// it takes to cover the app
const OPEN_HOLD_MS = 1500, OPEN_FADE_MS = 620, OPEN_OUT_MS = 1550, OPEN_COVER_MS = 320;
// the fall starts first; the background begins fading this much later, and is still gone before any piece leaves the screen
const OPEN_FADE_DELAY_MS = 100;
// the wallets are built this long before the outro, hidden behind the still splash, so the fall never starts on a busy frame
const OPEN_PREP_MS = 280;
// app start: the logo and wordmark come in once what they are drawn with is ready, or after this long at the latest
const OPEN_READY_MAX_MS = 600;
// the screens filed by the warm-up (see "warm-up" below) are drawn again from this long after the splash came in (the
// logo has landed and the last letter is creeping its final pixel or two, too slowly for a late frame to show), and
// are cleared away this long before the outro starts
const OPEN_WARM_AT_MS = 720, OPEN_WARM_CLEAR_MS = 80;
// if that drawing is still waiting for a frame when the outro is due, the outro waits for it, this long at most
const OPEN_WARM_LATE_MS = 350;
// speed curve of the outro fall: a ramp that starts slow, builds to moderately fast and is fastest at the very end,
// never fast-to-slow (what Premiere Pro draws for "ease out" of a keyframe; in CSS terms a cubic ease-in)
const OPEN_FALL_EASE = "cubic-bezier(0.32, 0, 0.67, 0)";
// selections panel → trading panel: how long the coin's flip plays before the stage starts to fade
const TRADE_FLIP_MS = 900;
// the IDX globe: how long its turn and the wordmark under it are shown before the stage starts to fade
const IDX_REVEAL_MS = 1900;
const IDX_SPIN_MS = 1500;          // one full turn of the globe when it is pressed
const IDX_TILT = 16;               // how far its axis leans from upright, degrees

// Month title, pixel font: "t" is drawn one font pixel (3px) further right in its box than the other letters, which
// leaves a gap on its left. Each "t" and everything after it is pulled back by that pixel; this is that pull for the
// letter at position i (also valid past the end of the word).
const monthTightShift = (word, i) => -3 * [...word.slice(0, i + 1)].filter((ch) => ch === "t").length;
// Month title flicker: where each normal-font letter sits, as a shift from the middle of its pixel cell (24px cells,
// 21px glyphs). The letters keep their own widths and are spread evenly across the width of the pixel word, so the
// normal-font word is evenly spaced, yet every letter stays close to its pixel twin.
const monthTwinShift = (() => {
  let ctx = null;
  const known = {};
  return (word) => {
    if (known[word]) return known[word];
    ctx = ctx || document.createElement("canvas").getContext("2d");
    ctx.font = "800 29px Inter";
    const w = [...word].map((ch) => ctx.measureText(ch).width);
    const span = word.length * 24 - 3 + monthTightShift(word, word.length);
    const gap = word.length > 1 ? (span - w.reduce((a, b) => a + b, 0)) / (word.length - 1) : 0;
    let x = 0;
    const shift = w.map((cw, i) => { const mid = x + cw / 2; x += cw + gap; return +(mid - (i * 24 + monthTightShift(word, i) + 10.5)).toFixed(2); });
    if (document.fonts?.check?.("800 29px Inter")) known[word] = shift;      // only kept once the real font has measured it
    return shift;
  };
})();

const pad = (x) => String(x).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const monthKeyOf = (y, m) => `${y}-${pad(m + 1)}`;
const uid = () => Date.now() + "-" + Math.random().toString(36).slice(2, 7);
const MAX_AMOUNT = 1e13;   // Rp 10.000 trillion: far above any real entry, well inside exact number range
const parseNum = (s) => {
  const n = parseInt(String(s).replace(/[^\d]/g, "").slice(0, 14), 10);
  return isNaN(n) ? 0 : Math.min(n, MAX_AMOUNT);
};
const cleanAmount = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(n, MAX_AMOUNT)) : 0; };
const digitsOf = (s) => String(s).replace(/[^\d]/g, "");

// loading/importing: keep only well-formed day keys and entries, so one bad item can't turn totals into NaN
const migrateSpending = (sp) => {
  const out = {};
  if (!sp || typeof sp !== "object") return out;
  for (const k in sp) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const v = sp[k];
    if (typeof v === "number") { out[k] = [{ id: uid(), amount: cleanAmount(v), desc: "" }]; continue; }
    if (!Array.isArray(v)) continue;
    const items = v.filter((it) => it && typeof it === "object").map((it) => ({
      ...it, id: it.id || uid(), amount: cleanAmount(it.amount), desc: typeof it.desc === "string" ? it.desc : "",
    }));
    if (items.length) out[k] = items;
  }
  return out;
};
const migrateIncomes = (inc) => {
  const out = {};
  if (!inc || typeof inc !== "object") return out;
  for (const k in inc) {
    if (!/^\d{4}-\d{2}$/.test(k) || !Array.isArray(inc[k])) continue;
    out[k] = inc[k].filter((it) => it && typeof it === "object").map((it) => ({
      id: it.id || uid(), amount: cleanAmount(it.amount), desc: typeof it.desc === "string" ? it.desc : "",
      day: Number.isInteger(it.day) && it.day >= 1 && it.day <= 31 ? it.day : null,
      ...(it.test ? { test: true } : {}),
    }));
  }
  return out;
};

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const GREEN = [61, 220, 151];
const YELLOW = [245, 211, 75];
const RED = [255, 93, 108];
const spendColor = (spent, limit) => {
  if (spent > limit) return rgb(RED);
  const soft = limit * 0.9;
  if (spent <= soft) return rgb(GREEN);
  const t = (spent - soft) / (limit - soft);
  return rgb([lerp(GREEN[0], YELLOW[0], t), lerp(GREEN[1], YELLOW[1], t), lerp(GREEN[2], YELLOW[2], t)]);
};
const spendTint = (spent, limit) => {
  if (spent > limit) return "rgba(255,93,108,0.12)";
  if (spent <= limit * 0.9) return "rgba(61,220,151,0.10)";
  return "rgba(245,211,75,0.10)";
};
const spendBorder = (spent, limit) => {
  if (spent > limit) return "#5a2830";
  if (spent <= limit * 0.9) return "#1e4436";
  return "#57501f";
};
const remainColor = (remaining) => {
  if (remaining < WARN_RED) return rgb(RED);
  if (remaining < WARN_YELLOW) {
    const t = 1 - (remaining - WARN_RED) / (WARN_YELLOW - WARN_RED);
    return rgb([lerp(YELLOW[0], RED[0], t), lerp(YELLOW[1], RED[1], t), lerp(YELLOW[2], RED[2], t)]);
  }
  return rgb(GREEN);
};

/* Animated number: eases from whatever it currently shows to the new value */
const useCountUp = (value, duration, still) => {      // still: it starts on its value, and only counts when that changes
  const [n, setN] = useState(still ? value : 0);
  const [busy, setBusy] = useState(false);
  const [span, setSpan] = useState({ from: 0, to: 0 });
  const cur = useRef(still ? value : 0);
  useEffect(() => {
    const start = cur.current;
    setSpan({ from: start, to: value });
    const delta = value - start;
    if (delta === 0) { setN(value); setBusy(false); return; }
    setBusy(true);
    let raf, t0 = null;
    const step = (t) => {
      if (t0 === null) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const v = start + delta * e;
      cur.current = v;
      setN(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else { cur.current = value; setN(value); setBusy(false); }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return [n, busy, span];
};

const CountNum = ({ value, duration, render, still }) => {
  const [n, busy, span] = useCountUp(value, duration, still);
  return <>{render(n, busy, span)}</>;
};

/* Rolling digit for the year label */
/* One step per swipe, for everything that steps on the scroll wheel (the year stacks, the chart pop-ups).
   A trackpad keeps sending wheel events after the fingers have left it (the glide), longer and less evenly with one
   more finger resting on it. A lock that simply ran out after half a second let that tail step again: 2026 → 2028.
   Waiting for the wheel to fall quiet fixed that, but left a second swipe dead for as long as the first one's glide
   was still running (a second or more, unless the pointer was moved, which ends a glide), and he swipes twice in a row.
   What tells a hand from a glide is that a glide only ever dies away. So a new swipe begins:
   - when the wheel has been quiet for WHEEL_QUIET_MS, or
   - when the events grow again: one WHEEL_SURGE times bigger than what the stream had died down to, and at least
     WHEEL_SURGE_PX more. Not within WHEEL_AGAIN_MS of the step, while that swipe itself is still gathering speed.
   Nothing here runs on a timer. tools/wheel-test.mjs feeds it trackpad streams: run it after touching this.
   `lock` is a ref of the caller's; `big` is whether this event moved far enough to count; `delta` is how far. */
const WHEEL_QUIET_MS = 600, WHEEL_AGAIN_MS = 300, WHEEL_SURGE = 3, WHEEL_SURGE_PX = 10;
const wheelSwipe = (lock, big, delta) => {
  const t = performance.now(), mag = Math.abs(delta);
  const s = lock.current || (lock.current = { last: -1e9, step: -1e9, used: false, low: 0 });
  const settled = t - s.step >= WHEEL_AGAIN_MS;
  if (t - s.last > WHEEL_QUIET_MS || (s.used && settled && mag >= Math.max(s.low * WHEEL_SURGE, s.low + WHEEL_SURGE_PX))) s.used = false;      // a new swipe begins here
  s.low = settled ? Math.min(s.low, mag) : mag;          // what the stream has died down to since the step
  s.last = t;
  if (s.used || !big) return false;
  s.used = true; s.step = t; s.low = mag;
  return true;
};

/* Compare, on the chart pop-ups of both sides and on the weekly chart: the period on the chart against the one before
   or after it (year, month or week), drawn as a ghost behind the chart's own marks and on the same scale. Off until
   it is asked for. He wanted a colour that sits back like grey without being grey, and found violet too showy: a dark
   steel blue at half strength.
   - Turning it on never replays the chart's own line (that plays once, when the chart opens): the marks glide to the
     new scale (.ch-morph, .ch-slide; the scale's numbers count across) while the ghost draws itself in like any line.
   - Turning it off, the marks glide back and the ghost glides onto the chart's own line and fades under it.
   data: { "-1": { label, per, … } | null, 1: … } (per: the period it belongs to). */
const CMP_INK = "#7d93a8";
const CMP_MS = 520;          // how long marks take to glide to a new scale, and a ghost to leave
// the ghost that was just switched off, or swapped for the other one: it stays CMP_MS longer, on its way out
const useGone = (on) => {
  const ref = useRef({ on, gone: null, timer: 0 });
  const [, redraw] = useState(0);
  const r = ref.current;
  if (r.on !== on) {
    r.gone = r.on; r.on = on;
    clearTimeout(r.timer);
    r.timer = setTimeout(() => { r.gone = null; redraw((n) => n + 1); }, CMP_MS + 80);
  }
  useEffect(() => () => clearTimeout(ref.current.timer), []);
  return r.gone;
};
// where the line through `line` (as smoothPath draws it) is at x; level beyond its ends
const lineYAt = (line, x) => {
  const last = line[line.length - 1];
  if (x <= line[0].x) return line[0].y;
  if (x >= last.x) return last.y;
  let k = 1;
  while (line[k].x < x) k++;
  const p = line[k - 1], q = line[k], u = (x - p.x) / (q.x - p.x || 1);
  let lo = 0, hi = 1;          // along a segment the curve's x runs 1.5t − 1.5t² + t³: find t
  for (let n = 0; n < 14; n++) { const t = (lo + hi) / 2; if (1.5 * t - 1.5 * t * t + t * t * t < u) lo = t; else hi = t; }
  const t = (lo + hi) / 2;
  return p.y + (q.y - p.y) * (3 * t * t - 2 * t * t * t);
};
/* pts: the ghost's points [{ x, y, v }]. lead: it starts on the y-axis, a little short of its first value, as the
   chart lines do. gone: on its way out, when it follows the chart's own line instead (into: that line's points). */
const GhostLine = ({ pts, PL, Y, lead, gone, into }) => {
  if (!pts.length || (gone && !(into && into.length))) return null;
  const own = lead ? [{ x: PL, y: gone ? 0 : Y(pts[0].v * CHART_LEAD) }, ...pts] : pts;
  const at = gone ? own.map((p) => ({ x: p.x, y: lineYAt(into, p.x) })) : own;
  return <path className={`cmp-line line-sweep${gone ? " gone" : ""}`} pathLength="1" d={smoothPath(at)} fill="none" stroke={CMP_INK} strokeWidth="2.4"
               strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />;
};
// the borderless button at the bottom right of a chart pop-up: off → the one before → the one after → off
const CmpButton = ({ cmp, data, what, onPick }) => {
  const there = [-1, 1].filter((d) => data && data[d]);
  const now = there.includes(cmp) ? cmp : 0, order = [0, ...there];
  return (
    <button className={`cmp-btn${now ? " on" : ""}`} disabled={!there.length} onClick={() => onPick(order[(order.indexOf(now) + 1) % order.length])}
            title={!there.length ? `Nothing in the ${what} before or after to compare with` : now ? `Compared with ${data[now].label}. Click to change` : `Compare with the ${what} before or after`}>
      <i /><RollWord text={now ? `vs ${data[now].label}` : "Compare"} up={!!now} step={14} />
    </button>
  );
};

// one continuous smooth path through a list of points
const smoothPath = (p) => {
  if (!p.length) return "";
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let k = 1; k < p.length; k++) {
    const a = p[k - 1], b = p[k], dx = (b.x - a.x) / 2;
    d += ` C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
};

const CurrencyRoll = ({ idx }) => {
  const h = 17;
  return (
    <span style={{ display: "inline-block", height: h, overflow: "hidden", verticalAlign: "top", lineHeight: `${h}px` }}>
      <span style={{ display: "block", transform: `translateY(${-idx * h}px)`,
                     transition: "transform .42s cubic-bezier(0.32,0.72,0.24,1)" }}>
        <span style={{ display: "block", height: h }}>IDR</span>
        <span style={{ display: "block", height: h }}>MYR</span>
      </span>
    </span>
  );
};

const DigitRoll = ({ digit, size, height }) => {
  const h = height ?? Math.round(size * 1.02);
  return (
    <span style={{ display: "inline-block", height: h, overflow: "hidden", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${-digit * h}px)`,
                     transition: "transform .55s cubic-bezier(0.32,0.72,0.24,1)" }}>
        {[0,1,2,3,4,5,6,7,8,9].map((d) => (
          <span key={d} style={{ display: "block", height: h, lineHeight: `${h}px` }}>{d}</span>
        ))}
      </span>
    </span>
  );
};

const SimChip = () => (
  <svg className="sim" viewBox="0 0 46 36" fill="none">
    <rect x="0.6" y="0.6" width="44.8" height="34.8" rx="5" fill="url(#chipG)" stroke="rgba(70,78,86,0.55)" strokeWidth="1" />
    <defs>
      <linearGradient id="chipG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#cfd4d9" /><stop offset="45%" stopColor="#9aa1a8" />
        <stop offset="70%" stopColor="#dfe3e7" /><stop offset="100%" stopColor="#a7aeb5" />
      </linearGradient>
    </defs>
    <g stroke="rgba(60,68,76,0.6)" strokeWidth="1.1" fill="none">
      <path d="M15 0.6 V12 H1" />
      <path d="M15 35.4 V24 H1" />
      <path d="M31 0.6 V12 H45" />
      <path d="M31 35.4 V24 H45" />
      <path d="M15 12 H31" /><path d="M15 24 H31" />
      <path d="M23 12 V24" />
    </g>
  </svg>
);

const WALLETS = [
  { id: "puzzle", cards: ["palladium", "platinum"],   exp: "12-26", year: 0 },
  { id: "arena",  cards: ["coutts", "couttspurple"], exp: "12-27", year: 1 },
  { id: "python", cards: ["obsidian", "ivory"],       exp: "12-28", year: 2 },
];
// the wallet of the current year: the one the selections panel shows
const HOME_WALLET = Math.max(0, WALLETS.findIndex((w) => !w.year));

const PATTERN_OF = {
  palladium: "ornate", platinum: "damask",
  coutts: "none", couttspurple: "none",
  ivory: "guilloche", obsidian: "guilloche",
};

const CardPattern = ({ variant }) => {
  const kind = PATTERN_OF[variant] || "guilloche";
  const [uid] = useState(() => `p${Math.random().toString(36).slice(2, 8)}`);
  const motifs = kind === "ornate" || kind === "damask";
  return (
    <svg className={`cf-pattern cf-pat-${kind}`} viewBox="0 0 400 250" preserveAspectRatio="none">
      <defs>
        <pattern id={uid} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M11 0 V22 M0 11 H22" stroke="currentColor" strokeWidth="0.55" opacity="0.5" />
          <circle cx="11" cy="11" r="4.8" fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.45" />
        </pattern>
      </defs>

      {kind === "guilloche" && <rect width="400" height="250" fill={`url(#${uid})`} />}

      {kind === "damask" && (
        <g>
          <rect x="12" y="12" width="376" height="226" rx="12" fill="none"
                stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
          <rect x="18" y="18" width="364" height="214" rx="9" fill="none"
                stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
        </g>
      )}

      {motifs && (
        <g className="cf-motif" fill="currentColor" stroke="currentColor">
          {/* left cloud-scroll cluster */}
          <g transform="translate(30,66) scale(1.05)">
            <path d="M6 30 C0 18 10 6 24 8 C30 0 46 0 50 10 C64 6 76 14 74 26
                     C86 26 92 36 86 44 C78 52 62 50 58 42 C50 52 32 52 26 42
                     C14 46 4 40 6 30 Z" stroke="none" opacity="0.92" />
            <circle cx="36" cy="28" r="7.5" fill="#000" opacity="0.001" />
          </g>

          {/* right large S-curl */}
          <g transform="translate(266,52) scale(1.08)" fill="none" strokeLinecap="round">
            <path d="M92 14 C72 4 48 14 44 34 C40 52 56 66 70 60 C82 55 84 40 74 36"
                  strokeWidth="12" opacity="0.92" />
            <path d="M26 82 C40 90 58 86 66 74" strokeWidth="10" opacity="0.85" />
            <path d="M16 114 C34 120 54 112 60 98" strokeWidth="8" opacity="0.7" />
          </g>

          {/* lower-left curl */}
          <g transform="translate(42,148) scale(1)" fill="none" strokeLinecap="round">
            <path d="M10 58 C-2 40 10 18 30 16 C46 15 56 29 48 42 C42 51 29 50 27 42"
                  strokeWidth="12" opacity="0.9" />
            <path d="M62 22 C80 22 92 34 92 48 C92 60 82 68 72 64" strokeWidth="10" opacity="0.8" />
            <path d="M104 66 C118 60 128 46 126 32" strokeWidth="8" opacity="0.62" />
          </g>
        </g>
      )}
    </svg>
  );
};

/* ---------- the crocodile logo: the original artwork, background removed (192×179, own palette) ---------- */
const CROC_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEWg0k7cul8eMBdnp0JspTjs642frk3S2mI6aydJXirW4tK0246TlZKT2T6Cbzx+wDZ/wEI+izJCOyKVf0kAAACd4E312oBWljlKhS+a3UvjvV3z2H1EeCs6Zyek5lD9/f3R+GIAAAAnQhzpxWiDvTmIxDs0WyRppzuLQ59BAAAAKHRSTlP//////////////////////////wD/////////////////////////SwSqoAAAEOZJREFUeNrtnQt/ozYSwIUhBrbdtndXDDKPposN3/8bHtLMCL0A4Rh773edtpsm6zj6My9pNFLYn8dLUzWVJc97c/YCgMqVfwD+Afi/Amj+0cDbNdA0TSak+ZkAmjEBqZJxkqpK2mEY2knoFWdH4sYrWfMOgIR1Qhi/s0nu9+93HE410Hunn5akeQtiWVRZvQEgZlxIwW53kARGlzcK4FMjSCf57AjA9uvmLQBF4QNomxUNND8RQEIAdwJo2+x/CWDsbIBmWwP5T6UBXoh/0IRuM0C7poHcC/AOJx5tJ74RwJ+LAF1LGhDR6s0AZ1Z0kxV1LLlJmZ0490UhqYDOCZ9vMCEmI2KaYnD8PFelGMf0B5lH+okv6BalkNrjXSK/J59ir6BoHgDZD2CbRayeJwGoB84LKRyHW+BH+b/yL7pksJz6vQCtBVAYIkctMdRXJg2YAM37AfJFACTQv/CzA7gjtoh+AoDUBJgmljoA5/aYbYDhvQAi1swAeZ5P4b2tCC1VDssN71VUGgCmhTdoIFUAap5DETZVo+4KO4y+QQMjE+kquTFcnMhEPK0ERgIYGYoaJo2fjShxLP6b/uCIAN9wZuNkfG2ezWucIwA4zBhowKXASZJbQg/vTHm345rNCIB4SnOmEAChnlF72e58sE8DYs420iBud5hB0M8808yhI8clgGQRgFNGHsxwdJAG5IBnABAfAKeUtQygRacJIB7MtebbAWDwCqB0AKyEFrcvALiLefPtpgDuN9uEPmcADlOgAnxgG+AFGkgEgNAA2cMdNeIH0KZvnceJgYzbGsiPNSGKQjB/xrJQaUehlKJ+8f075+LfcV4AgFTcSAjSiYUOhiM1UEEhq/zlG8oHyC+MQzRXg0ow6p8/6CUkv5IGKDGwDgCY/B5RJTsOYMggUn/7y5KPwspbOK/OYvuVf31LYhCRtcX7jRCNFDs/EGBaKjZNnrcuwLxggeRUySVv03oASgIAaUczHxRHAgwNlBx8AOZ8uZKsuwDU0q15E4DOsEcDiQnQHQ/gNaHuYYB4iliv1UC7BDAj7APgxfsB4CHyxwDEN5AWZieuDgRQeUDXgK4CAZCJtWX8zX6p68SFXmcRPvD19YCV9CsLoDn9DXKyNGCYUCbWxi2+8u9flwAySs0jJbQfKFkoiANQxYkmZVxaAFkQgHi6zeAHKFcBTgAQ7AsOQGPPfYMAuK2BaYW4DFDGDTzhdkEDpx9yY/AhDdgAtgm1LgD4QLAGBELTLgGcDIDqARPaD2BGIcgDwouHFR/wAHAXoKpeooECNMBpfYhhdB+AXIUWDF3gQBPK/CakL3ABYJ8G5BOYACgKNQ9Hocby4WYnQPGgBsB9Jg2chGTSfnYBsPONnacVBrNqaGwKppNjqJVX6QPgxlyoxBjYhgOoFc79DKWu4ccgJGsz6FHYBuA4cubsa+HXYWEbBICozQ4AEnpuwplPcz6oAgBwQdXZALg479YAzESmVsn7AUZa2AwnwxeCAGA25QBglaej6tSxAKRGBVBJZwjTAMSQdYDDNYCzUhMgxISKRYDiURPansw1foDiEYBuyQc6KLKp6tT2VCIEIJfjz/0mZGog0IkLikKptYU0l5jlzrQH4Hunkpj8AGG0WQQooazSLvgA3wcwRX6xWzGK8SWivoZ9TAwn1GeVEFDOELBvjKpVjNO2ERow+0O8Lj7H8MLbOL+UMbEpwum9WPJ1AA5bKqw5gSQMK/b4+YlUQWW2T2v/RatCF+auRWdv1XDnr1i1HYW2AOCndwoAnLmLKamTSREA0yq3ZLHGop525gtjn0aufQvza9Pss/w6AM7EbQDSwOACdFTDwhozFNILzhe3VL1/JafPBwCASXdn/DxbAlBPnVOlnK/tCfv3iRdMqNsBwL4AoD1L+DSUgLYGAnyg2coDrPCbEAH8WDEh9dD5op0sMwCAby60F4B7NRATwCduffkBFrogNgau4pWjgXk2CoKz0XIbYMRFXIwaYJjsEysPpNomarHX6G3peBzLLQO18fbH9IlINtL0YU2zvjJDgHmLgcbXueFe2/gq5hj6NQLYZ+q4WsGi0M/fXpExPZZo6cj+fLXx52HBLFiwGQD+oOS4DcA3DTXYoh/H0AHA5mlWGgLAHxgXf9bYMfp+AYAtvOUaE9/97PluDeACMQiA79YAdw157i3YC2DMiSyAIsCEzB6kkAjJjezrTj4fcWQ7CoUDMG+02Yrx+jSCWac0WLepgmnZNMmUVKhFipVJMo7JaAJMslnZUqlQ/7HhcwKYiFPalJn7lHcLzPNDYZdLfZFSg6SJbCS5J7RWpnRfbtaFTABrx7TYmB/jSuKHLhMAt7Mctx4Lg2EjxfQ/AkD27igAfCUdwwwE4NyTd+e0VnDuvsQL4PV1zepqVIAGIHthvgog3rxbSPmF7Z2dmoh7ADw+pH1BaMAG8GmA870A3KeEDfGakNYMxI1g6wGYLCn9HRvwTB/YB4AFuNNu+eEDsNeSxvzJMKF6HWBrPWBpgCV/75U5CInhn05tx/Xn7psE6hqQ/zcBGCbUUBgN0AAK67Ccsh8gNyRrOm3r2hi/KOGLoM8UAEZR6cS6BhqyzyoLrU4n3+EoT7Ub4Lc66kmiPorSghcLs/AUnjcMWgh9X0odhARAmTnTaqRCGe0ygMwkjwDkdW9IOlu+YfjcAADr76/AbQNAf930HwKcWliguTvfCuCGAM0TAai4pWtAM3wAkAgpNaHaZWsdQC4xFwHu2FWZoCn/2441+ZL8xwcAfmwt8hQAJmGlAdeEKseEFnoPdADRDJ0wLD5M5okO9nERn34sSo0vhI8EwH1r0hTHrQKoArhtAGRVswlwB4CahoNS75W0WCQAH6jnACoBosnx0YBXAEI0MBEk7OKM6LIiPgD/dIo0UOtTiP6KBNsAmxqAxtzfGcaIsPF7EC7pXP63DkTMTkzSX6NIAtxoOl1VKgjpAO0mgDph+GElmS2Ai5oah1mY4QMsEe1JcRzbWisrJw9IgCwIQGl4nrMHEPgNCv+qtjIYApyNZo95fVq4ANVuAPVTQwDky+rLZevpm984A2hLJDknXgIIMiFzbJd9QiG+1k3Q8/QXNEAp4ysAlAh2Dtz5HFCMoHN5AQDdBhH1tnyJqPa/hJntNmsAoU5Mkovgpkt/2WtNm4S6BhwACKTZD3PHPhzgt8MBJvk4b2igysRyaZrM0UZH+xMAQLoGWQIoVLvC0Mr7Tobdrcc+E3oOwTR9iM4JnGscrc09JZV1/cr+3mmfBjDfGtOxBwDSHgFuAQDQqPcgwHV6VkLkn70ZWD8e14AXgPsBsrYN7JnbNKEoteTRMDtNoTcBuAbQPgbgiHmRxRTUhIJIJiVd9/uAAWAWMHSA9giAKa9E/VWXPjQCLQKoA98WQH4IQGVoIBCgJp9aAFDlcVFSlOuC9mEnfhpAbQKAvfkAjNo+nW/PHw6jB2gAqihSCQhwd00IW4vyk+x7PYU3vm5K5gGIAEJ+6JfNXn3sr/BN/RKA6o3KrVnoERq4WmH0I8gHhAK8AFgDg2rSMQBaZhdx1L6DLZUlmNU6TH/FpLioAXDjQwDc87kVNJZjf3mWXG2Joqvna6IOsQbAXwdgJoYkvW4KDH9VA1BTfTnAlHKS/hokvjwQ2/vsA26ZvE4DYQDk8E4e4JYGGnlGfWjJ5V5gQh4fcJ69irXMAiiVJri5rzPAFlx2MIB4SAEA12utKnJrANqWMjb/ZT+HBoIB5t311wDAvDG5RqlMU88C0JrADwFQtwWADA1VozcBVn3AXBe8AmAgALzxj0VBTix6+70AxasBZg0gQEB51y6r6J277wO4awCBhS279Vj2PYnOJwpG1IIsFsbehc1RAEH19doFMG5QkhkZATCjZe8A8JbW0RfWALiuASoTvcKJHYB6caPhXK0CuBp4C8DyRs/HKkAxJzIF0BwCMFgAF62nQxlP7dkm+Dj/awkAE1mGfQJH+IDYTRVnqhpbA/oWuVFKdSWl5dzoA5gQ8MKhpDrAhKDzp2PVYAHQ1Nm3r2ovkvtplSm2uuk88cJFdKzMng/Q4erPAUjFvD+aAerlraaa1jg4/sQCUMuE6hAAaHwVAMOwpAE3hBrdBhbAaJmQmtUdoQF1hH6Qt8avAdj7Mz8JQBcIYJmOTrBsQi8A6GYAQTBP5iwnruftb2dbZ00D+mnHrjzIBwAAZAkA0rBuNxePBvAyGlcD0OJfLnUvfuH2+/kaCbiuObEWNL05GdIQPD5A+UABzCdl4b4Wusvw6wB0f4O6tZXUfsZ+stprQohgTYkUwBWbNvWbKEULEZlQLneLTye6CrD9CoBxT2LR4eWL1ZnCvqOBufPDrfZSwQ4/agCyCW4GoO5FyxceAjBPpCoAnDbYABfNkNYBTA3IHi6OBw2fCHBmhXG1mgFQ+0yoXm7+MgDE9qWrAbNa/QSAkXELAI/vQLOaBaBab7YAoDKsABJsJMUuKLljI9zAWRc8cPs9M+uwswY8AHZf4DJAbwJgJ+/N8oFnANg+UCgNYJSp3U0zsqNwDeDvZNCjEKwLvm5C83EnDNSj/D0Iy05cG32Bhk7UayPsr0ohn43TP3BrKTlxA9f1DM7amO0cuJYh4xIyJ72lbUJaOa62M0BPlS6rZFdTMoRV0tCyzjj3qA7sDHBfadaGA3CnJ4nugAoBuBj9fxd7KyFSNUcDoEWA+RqECsOpvG9K1Ir2AHDz7ggfwMUDEBnRFKZCHoDaBMCpg35BtVx8kAawieKJGsiWADzblgEaGJQGjNujGgPgOSZUbQBE2kRoP4B1QXUFPXSPADCntdMF0EOj5gNf0YAL8KgGWIATLwDoixk/QL8EYD00MqETXRr3RABTA9O8zHFijwaora1f04B2iGXWQDiAmdTFZRy4eqW9sXONHQb2gQJtkDjQ+bgWrQLsOUZqAdAFdOqALF7SPbbBAPTLrghAXaQOe2NVxj6WOju2d7ydFhcbQB00LIz7c7qxbYI1AIcE1awk1kwHNODtvqw3AUSfXV9vAJQzgH5h0R4APCGnTMgF+PCXzuuApoPe/tbUysQagH7UdhfA7XZf0EBFAHtNKJpNyAZA8QEUDwNIBAcAmxcf9wFfm9c0dtmi6jMh7Tw5ATRBPiB/eciN1kYagDSiCWBTA5HTcwONTx4AbLH1AxgakJt+gQDShPAimti6AiJMA1GgBnoyIQsAJzLqF5mN9Es72GonQd5UqsSEd/TNVwHRW5xpP2P7jNzyvjGdw0zyfFrQ5In1KyPKEX86HXuO6V7nRYAKnnQy4gq+G+3tLKwoDud0R+vuZV1bEb3pws6TOrcdqy8sAmCdMqE7IexNoLLFjY1zb7YReJUw34ThlqvV9OPaR7hd1S5tvyqAKhSAyqzdIwB6FTREA300YKfWJkD5BIB2G2CnCU0akEdOVgGKQrt7s3wqQL117modINCEAgGaxPilPa4PVCbA9frgKaHa1MBOH9gGSGin82gTigI1ABIAoHqQUKwVZNM4GljIB6sDp2+C9LwNEFvDCXBiedGufhU4hWobQM+udeAhxV7vhg0BcBNDCIB5lzmN3AGI4Hz5igp8xV2aGCGAjEEvBWh1DQhj2OMLvXr4MLeL4BeVvwtAdj3sAsAzKaQEABjeZkLygoJNALPI26sJNpnQ+wBw1tzb7QQXq8quNSD0ap4td5l6msw9A4AClQWSVK4J2WdRwqW2zgNG9KZlEjT+pGKhrdHzLzAdLDlH+kGUaJ/Y51joTXHbqoRfIo2XYJrPvpJ//19Ax6+8F4Vy4wAAAABJRU5ErkJggg==";
const CrocLogo = ({ className, style }) => (
  <img className={className} style={style} src={CROC_LOGO} alt="" draggable={false} />
);
/* engraved versions for the cards: the original's shading translated into each metal's own tones
   (every original colour keeps its own step from dark to light; eye whites are the polished highlight) */
const CROC_ENGRAVED = {
  platinum: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEVFS1GiqKxze4KOkZNrcnqaoalkbHRcZGyHjJF7g4pTW2Lj5+q5wchGTFKSmqFNVVywtbkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACbqUqjAAAAKHRSTlMA/////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADO3tQwAADPBJREFUeNrtnYma4yYMgBeb053Fef+nrQ0SBgE2+Eiy7dJ+2+5MJsNvXUgg8uvX80Nyycn49UcNno+/AH8B/lcA8q8EPi4BieObAKSBwf2f3KhpmtQy8BU6G0ZWxicAjGXrsGK0yxhHO+JTnuAVlv2QwRQMolED/wiAWAezevTDwORkAPiJCFbYDYDatfyQBA4AcgnIbwQYNwD5RwEwCiCPJfBdKiTY+g+okN4AVL8EvsKINQL8apBAFBM+BaC9G2XWeB+/GbEqeSHviTL3+QEVsj9+4jClH82HdR7LHwjAfuAFrD6EF5+JjWIRyjtAqFqY8DxxLuGBC5gsThf+6/7Xf8NMxCa+C4A8dP/kGXI5AGLU8psBgCD5wpcDFGZMiD4PwFKAxTvGAELQOVOA6bMAq6/JADiiBdvdjBdkkhsxhIUPSIAFALm5UYBLfc6nJWCsS0m0heTEBeIlEwgAxsIgzn4J1oYOZPI/oK1ZZODj83MZjhGwZsMouuIYo/HvUrPNeEU8FiENZFChaPV8PFgl4NZsOAk9+hUE/k6NK4dguMcA4RVTSvCQBPyEAwDkuQUAgSGrDiDiZcUGwL8EwE8+AAy7AFE8eBRgXNfNy4RxEqOmKhT5f+GXQKwVYHoTgJswAox7ANHyraxCUZR7kwQ2L+TXz+ARB+qFtidrF1e7/rvFOpg/F3k8WGUwPQnAYb7slQ5mhffmYVLo7HV4SfgOSgBfYgEgRIoHASYfaeXrHzJeNG7Bqk6af7KX4jyl8iUMQxZ84kGA5Reu0VLlAFvC4gf3IVUVAPDRQ7xVhrCLxyUgiwDpepk71i6AkLrJDwEkDCck8D4A9Z8FiBC6AMQXANB08YoEHlyNIkCIA4kRixLAK3tpQQKRB1slcD0fIEGf0zgw//ZjzuJACrDYO7zyt6kBSAzNBgPaBOM8CE8yp8EM5wGmMsCwCzADwGlbkHTp2AQgugCGoEIVCcwTbgxeB6AqpHIAQQgOAFYEqWoAcwLAz6hQN0DqhUIcqAOYIoDIAc54I3kOIAQzcRLAi9HOaMSPqZAsq1Cc4J4FELd4IUlsWHYCnFchlwLN07wOrz9dAFZrq5cMwxKfuKYazrdC5jWUAESyFhrAB6p2gJDhjNqXulAQqlkSAneMsn0tBHG/rAkAUGUHAA58l9WY5y0eNBhzyEooAJYY9gDSEbLkfgCDiU0IaLLVnYa6cSaBBGB4GADFuEVkZwxtEvA+ZB/gcQnAc0wBWlSIVQHYWYCOxVwKwE4ClG2AQb6yr0KiE2BXhVIJNBoxQy/EyBbSVmJ2O9MFABsFMQfgfqesAgy+rKIqAKIPYPH8626FKymZtb4G55iw1KRZshdh12Dhvh6mbUNCAwps3REogy/UxkbvsW6KCHwva64DCL+lYuXsBx6BMPD3GUWB2dUPqWNFVeiDffnCKyw/9kJHAP7dWQCAZZXBoI4qhQA2qtyixqZJPb5lsk+TY7vNp+EGAP87cwA/phwgLJ9FXEhne7t5pW+55fMDAKDSGv4uawDhqQuslO8pUWWX8gYVshcA4mfJRL4Tv2MT8NJjAHkUB2xFhXSDCoWHLqp6svP0HUBpLdQLIIoSCDbwA1tfZYDKKYijiR95ITahAsDK9hjAQBIXkjsI9obEgSj5FaxX6XOcUL/Bfat112MJNk71fU5zkA9YeqZEVHx4svHFNh96yxAhg4WB32jIxGJfEjlssXPQQdw2dYiCmy24bbTlDwyOjXnAvqI2a/RpjBjA6zwaWmse0DsvcZ/yXAWwlbfcYxLdz16ckoBoBBDdEhC5Im9nC3oBiA0kAOysDex6SJFE33sMmXqhdgBb9DZHPj72upZ0adgGEVgfWUJwsUO67R+28o8LQhgKbTr9jqcnZwybLnLPqsa8PZSc0Yz+IAbmymjEw2FdKAWgG44H62PIJKZ4LACCRjlBHksRIG6yCRLANsxGACEKcTc66ixEITCXAIq2HmldAcCdhbkKcMIsKwAFGxKsWwJC9AKIkhAORlGFosNAInG2FQA8gHcFAOpXc/eYSgA0l0zWTz0AR/kAkYA1v3vH5oTW6c+gQqLg0AJECSBRIdlhAzAs5LYnAFQypGTR1nUy/7WE751/yYhjCUjUT95cnTbWt/LwbgDOsItm/XmtGROsvgpPB/4cwxOECBA2iKIa6SoMtXOmzwnxBIAK04DJsKhFgyUZXA1AUwB/vm7dJJnBsHyCtrPzrQFA3ggQji0eS4B2i/JUAg7ApZhVgBFPVYIqT9TXqNrgJQBvxyTJ61AhnqnQ0dkDN/t1KYYnDdeZuPFay6L0rGJ8bBFfOPop0YC+FwaJBPYA5CHA6AGy9z63Qm4j8BawGD4o8EUJLATlxfCV6R8DuN98CHAoAX8wV98BYNOxC6AhhOFymvPghGIAxVt7VPSLvXGEE7tUagPvlcBnAHRy2CPZZ+u1gY8DiK1CvObIfx4AKTVeAKBHzv8wgHAbxEjHI0ZMy+p1gN5OOTWSSy3GZyWQAXhHKqd0x74dgL8D4KUPJMBdzWZZzOFGh/ougKoEtuMKk3L3nUz9/Q6PAfheKN/XaGoA/PLlK89JwK2d4SaBYwBIU88B+BWWhopB6lhfNwOIKsBJCWQqpGtr+V43u6lQHUDEEripuzW9yGJxanGkWIR0FSAtYCQq9AQATwFukEDU8P0WAH4KINhUGSCUx9eSossL1GkjfgoAU9ccIKnty/gWlu+RACaQCDDmKgR6pGZ3WmKW9/XUlABgyef/0wQAP1QDCIagyCr0CQDqRl9tKqQrAFBOgq37RwCiyL760SxOOCHsSsLrv6t+VCTAoLT9AEChrp0uV0yWQRSSCqhA7AGI9wGkgcGw8XDA9PcAGPsIQFECNYijxdwCAKXZN0qgHcBBUABBJCBdj/qk0OTeokLH0w4WbgnAkDYDbcuiyW/ByYcB1ofUJAHWBBBtKcPhP/kdEmgG2IrE7wFAN+p3im4DiA6BP3rvEG7pSKxGXwNI84J3AEwIAJO0usmI3dH8EgB7N8AmAQA4UVaJT+5+DmDsBnjRo8dDcgWU8P1kboMD8vuvB0huUHIReQOQD91leAGA7QIIIgGXIr/DiHtsgO8C5BL4MoDXLgDbAtmjKuSvBnoEgAnsCngCYN1NXXuqJJVAT5kiHNYsX4Mm4MIhwx9QITj5Y/l0AcCHt1HTPgJ6znR4AACzvwyApVH3uNAy6hpASBP4IwDeUawAi5WdlsAeQFjVDQ8BuBb6yd0a/xfgkwDKLbjsvQBJt+OzAFABuQGgcB0mtvievaqkfkowAMBiyNCEpgcARwDYOmX9lhPeZXhH/CLqiY9NnznrlZTw9KjjmyjXr6AKKbdbPM94FaC6BCCS24ChV51fAsAydwTgiDYAPL142RZyCdwGkErAfR0uW7gTQD8HMI4FCaTV6hsAjBVFG+DhpNEpAJYCGNhNE1ux150uvyEvSA/xiUgCr3sl4AaxgTsAal7oogoRCeDXIy/k84LrKkSvlV4l4G6cuAAQtkJYfkE1tDtPl3NjSxvI1gsu3JkkeMtMhXZAtkoXLdnB8FnSpCzpewz9Lv6+0h6QrM84HPE/D7DV7MoASlnSus9nvMcNbnrvAUivQWoG0KcAYOkQd0O55CPcIgaXm9wnAXmvBKYgAVHs+ZLpB5ZcAeAHAPoiQOLy+Ix7Nt0ANjva2Qgw3gxwVgL2SSMe6zZQbBucHwBIJaA3F7mnQqFxYE8CcRPLCQmkQZ1lrb9Ss8oJg2iS2B8wxgFAl0ovBGBIAlroTRBGNQPg7xTp8n9tkvLFPvs6aJDZ2fE+BIg6JZPLTwx8dFiLBCDjEyQBG6DTQmp2DkCPLRJIWz23D5VoB4AOuaBCOcBZCYylw6gkEkcAcattFwCcGy1IgJ8F0HUVIkfOYgB2GsAhZABwePG8DVRcrDuiWlKhqJ+8zwa8G8HcKALwJ58aAHR25gYOPo3FejurASQSkI1rIT2mbtSQKyDaJKAbJYBfoACCJiHqsE7kqi+ShxKTodU/fAt9R4cHvscyseVXKEM+MiL6xAUAOLzXGS4PNoZR/48De9A1u4EABYVvWtl52vq26Y26NQC8f7LwUSYKNjb02LGhsQewmhpsV6na9msA4K0AQ6b7jwF4CfiTWocAww0A6gEA33KyCxBX04bhmwAaVagRQJrkQ3tyG+ApwE1G3GsDxwCbF3pYArpRAsQn1gGoB6YZpMwkcEYQNDwfAdBo1GDE7qLd+CrwKZSWygDjufmPTQBD7fMddgHSu8yn9FKDDQB1qVN1NE7eATgf9FYAdVUCGldbzgacaD8FoPuNecRmtXEDmD6pQlqfsYHQLfhZADSDTu+ZXM2ADuJGAAJi+KENvNoHTdvw4x3VYJrmbxouHqJDTWToOwe+KWxbDf5DpOESzPTZc/f9fwErhZS2xL+tnQAAAABJRU5ErkJggg==",
  palladium: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEVROxi0lVyBaTpuViuni1V5YDSTd0WgfkvIqmy2m2Ds38FSOxheRyBaQx2agExlTSQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD0fptNAAAAKHRSTlMA////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSBoEgAADNBJREFUeNrtnema26wOgAsIEr5O4vu/22ODxCLABm/JPKf8mLaZdIbXWhGC/Plz/VBaaTb+/Kqhy/EP4B/A/xWA+ieBj0tA0fgmAGWkH1qaeWgt1TRNyyzpHaYcqjE+ASDBLgPgDfN4v+FNT3nCd4B4siG4JHDIT4jEgBsCzNsPSbMLAM+EQMzjaVWDQH0EQIgNgLYEvgFAEsD7lwIY+8sB5DJ5EVTIRAA1DvAVRmy4TywBbOo6Pw8g7KxFFqR38RUJPBmBsIX7/IAKgfOIQqBzfBotl3nMX2j+4olvsM0hvPisTOUxf7kDhKuFiZaIIzxw8KiA0xX4p/ur+4aV0/05xgBAPtysHUZ4JUrgRlXaDYAE6QvfDlDOmBF9AYBYBXChoj1KG7gbQIgKgCa0YLvReFEmpREjwgckIAwXgCIPG+YtrOBu9AMSMLCEK+n/mAfNLgCEV8I0IQRrPoAQ/I8Ac8MKx2DWRhNeAvC8HjMUTZWhuGsh0ZkFYIl1+SAAQjU3rDmXR7/kbLSSlPNfXQYRJECZgyXDJQDZBCCZRVu4TpVmCbgJRwA/agBAIasNkHinGcDcYAtDALTYQYBiAAto5oZ4ME99sQATAN6Gq9AzAoBPgYS3gW2AGyQgF4BFAqQPb5RIHSBJ32zFiD0Z3CqB6IUwf6a6EPNCweuLwtPSf9KQBQRnxIsMpisBNCqC5ass4P6frCOKJHhLZj8YDwBXRcnTuACAtPT5HxtPweIWxWTzX/FWySp0xnujwA4XAqgmQFyw+OA0BJBHDPiIBIDlyzsAwtJNfQggZRiRgMwB7IcA7G6AWQL2CyRgRRqY7LgRfxjAP0QQe404SCEasb4QIMSBVAKpCCLAs3hrASDSOstiA8fXAyzoaw7w+uvHi0mgVCGF7/xrmgAUmg0FtB8c+0F0nnkZuR9gqgPIVYAXAuy2BcXzri4AGAKQWxJ4/dDG4HGADhXyNtANYFYBXhnADmPWe20AijgwjdkAlAB7vJHaBxCiMewEAO9GX2TEd6tQusDdA+CewAxw3AtxADUIsF+FFvOZJfBahtefIQAwrmSVlKUwQ18ckY4rL1kDAMgrtugD+wHCCufty2Nm+pkm3PjvlATNHIp9LXzdL2y7ABB1BIAGPbfFmF8xHnQYM+CCiq8Yn7g4t2sAeSAL68JxgLBzOL0yW+gC8G6gAMAqj6Xq1LUAJMYAoJ0x9EnA+5B1gMslgFlpDtCjQqIJIG5VoaoEegBsywasL7KF6tR2KnFYhXIJdBoxlTbY9rp4xhKz25lekwA6I+9GVRNArgPAGMBs94v7dzVaudTXqI8phJi86gOxJhW+QdtGpMAmfV/+VjbkcQAsqYF6+SGpYo//fgVR8DpbsoOR1YVEuTEf95r4N/S2F9oC8L/dBgBvzNZQUBeVuECVW9LYbFFPO/Mi26dxa1+RvwYW5HEAzMQ5AElgKgEs1bCwxuwL6QKguaVa/ZZLny8AAJLAqyWBWEOIZUHMJscGtFTI3gSQPEv/z14C2hrosAG1FQeooFHagB8/KyoUHjo09aTN4AFqudAoAKxK4OfJ2pZygEYXxMbEg78qJBCzUVQAzGy3AQwu4nBxF0pMku9aJ5uoYlTp+ZiTdIPr/GRd4PZ0XAdU3P7fAhDJ9jpz5kXwQcWBsSffIPD7TFGVqLRIv78jC019SRKO+L9XG392D4yCIgHwXyg49gBsKWq3Ru/HEFwCkrLSfgmMzQvOmjt630MA9R+5xgTDzx6GJYALxC4AGJYAlIocewtGAbKciAGInqVk1oPU4yEhi75l8rnHkLkXGgCoepstH5+lEY1mphURWArjaVbq6tYZwDxUdzE3/bX9OYFPxClsusj9Ural6LEAXHxXukaS0L5MACA360I5ANsxFRv5Ma4kftIxAwCPcsAeSxXABeQAgK/TMcxOAIBK3I1hLRF6siipAVRtPUteCwDXC3MUYPnhthHyBbdOGxLxCkBlkquirUsAYBQAakLYGFUVSpqBIHO2DQBqwMttYAwAC3Cv4fFTA+BrySx/GgHYWg8wCYD8OzqiE1qm/0IVgopDg3YYN7kKKXKKHRIIjhfLKeMAvGnVJlvXwHyuBbC1aC1zCSjST91dnZbgj/LoYQAtQs/u0oNrqErRk08EX/dmx1jCBlFSI1WrG8c+kuwBUKJc8EBN8WsAD8/NAXx/3bJJ8kLD8gu0FQDsqXyrEwGouLUigYdHENSEyoumKYBbYjYB3thVST9i4r6mdRBVyRoApKnOKkBdhXShQlu9B74n1EiIpxfwl7iqRHEkLClgQ3FIphLLGykJAZhNALUJ8PYAhX3tW+r2ETiAeeYCFfigBJbG6BNWivV0qgGABNsAmxLwjbnmAoCVlQ48jN+gMJROax2c0BhA8EZPceMAaXw1q9j5+CUAJmv2iOtTUQLo7wZIlki+SvHbACxb/BwBaBwk/C0A4TYIGPCGB4w4a7dZAxg9KaeKasm1EigAvCNVP/mOfT+AvgPgaTYkoF3NhpK5JTv9LoCmBERoV5iUa3uaxlvPLgOY0wfcl5HGsM29MPTho4nXScAVI8MptEsBHsuzmof7CrljfZ4MAGcDFCpkDiSdPIXeBAB9/unW/CKL2aktAqIxC+kxbgMZQF7AuBxgjisGHumAwwDhwPctADqTQC9AsKk6QCiPLyVF6n39MgCvbzWArLavvlMCSxXlgR342dleI/KSjNs1+YkRWF8EYDyE+6MPwP8naAGE3iiehV4B8GBu9NmnQqYBgOUkX026BiC7G0ipIk6Ek+irEjC+x7AhAW/GlwBU6tqsQvfgw5hH5TVXh1gBgPsA8sAgxWNz4PTXALwUbwdYJACPrlGNA3yfHUuzN0qgDyDsI3AA4BJwZ9TjVQG3qND2sw++FhiAzA8DRUcw+S04dTHA8pA6AB4P0QWQbClj85/6Dgl0A8R8/R4AcqPGJWunASRN4JfeO0RbOmFn8RhAvi64A2AiALzxD0yXEfsmywqAuBsgSgABdpRV0s7dzwG8hwGeUF58g/dIoTNix7HULwDIun84wJVXfuwBEKsAUJGAusOIR2xArwLcI4EDAM9VABED2cUA0wUAGMhU3idwKkDo2OISGCnVhfVcDSB2LdJlpicDWNfyqScGMFJnmeO2SQ+dNS6iA3kBgMXVXwEglrzfdBaKwkItlwP1ILJLl04G8E1YC8A07ZQAAzBMhUJWd4UE6CiVntyt8b8QwJ4PIO8EsBFAuQP8cK4E0tOOVl5kAx7Aj2MAdTcaDpxJtfeqkvaGeLABKmyxBc0xCcSTsg5AT6flQqH/hwCKjbo9AA9s2kyT6ti+5M7p+a7a4/e4QX5PoqCz6voQAJW5EwDXBBcBqHvxsC3wsx4nAuQScD1c8aTkaQCLVO0lAMv2ZSkBXq0+AQAYAB7fCZ1GuwD836IzwkZS7ILCcy6npNVs1Z1I4BAA5AB5f0AiAXW6DYggAXGiBPBuU8OPO59hxDbfql+WhS5jPwDwoP4qQXerGRRCMOKfafS+nvrEkwhJTytcesdUqCjH5ZvdvtJVlOyyVdIc3W12YCKo0jQOArZRUDgAEGt2dQCl0vudl2sQNLrTXQAA1fObWwBmF8BUAYAAcKsE4CBAdnvUFSqkL5UAu6Ba+x66fQCwD+BxMsBXGjG0AfLESx0x4hEAE3cJ1lSI2tpgTQLJIZY9EmBNf/TJP+mN340Og2SSONF4XItWAa3DBwQgw2/PL18w/QDvvGIYL1L3e2NaNbs8Ona8NwF0ett8crf1AAAeEgxZiUlUJ0pgB4B59EgguW0+6TMcAcATckGFSoC9EnjUmlFZJE7v+4edAMa8GxLQewFMW4VYy1n+gQV7ARxCAYDNi/ttoBGlXYtqTYWS8+RjNuA+PMTQ2igB8J1PHQCm6LnxjU8VAGyxrQPAXoB415pgEtCdEjCdEqAXCgC8kFT0A2B/ruT3y5kigJ1xwiNcx+fmrCT7yIjkExcIYKs+RPdPG1zBlx+kgRXFCVeDj0MEJCj6oY2dp3Bu2/AbdUuAfLeq8lEmKOXJr8fNcYClm5FWYu3tV8g+l6QXIPX/lwHMQjQTdmptAsgTANQFAP7IySpAWk2T8psAOlWoE4DHwMIGdA7wOEkCgzbQASD4Z8hcJAHTKQGcTT8Ad//8aEKUwJ54EDZFvJffBODRqMOI3UW7mfOZsiLZxE5yDEkCsm7YDgDZull9FaDmPUsJLOmC22YZVB1MjBDA+aBbAVQqgUUZRiWAiZ1vy/cfVP4pANf1MGbMDzqs9ogA08dUyKV8gxKAdJfywwCYNY8BmEeyywSUzJ0BYFr/pVQhfhalf/DzgIYvJfcD8Nbo2Gc8sWHOHPRDcdtKaryvW3Nv7l6av/E/iGZ560QJBeMAAAAASUVORK5CYII=",
  coutts: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEUhIyVvdXtma254fIBFSU4+Q0gxNTkkJyo4PUJMUVeCiZBWW2HKztJZYGZ+hYsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD6YqOIAAAAKHRSTlMA//////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGUXE9QAADTpJREFUeNrtnYuW2ygMQAdhXAhN//9z1wYEQoABJ3bSs2XP9jGTZrjWCyRBfn6uH1ppxcbPXzVUOf4B/AP4XwHofxL4uAS01us+9DcBaBOG8r8qs4aBr7DFMLo6Vv0JAANyHwBP2MbzCc8wHYUEIB9sSGRkGrWojwC4IcA+/UAJ6AjwIAQ7bALgdq0/AiBEB6CUgP5GgOffCiA5gO4DfJcKbZMXUYXsEEBLAl9hxBYBfgYksHurDwNYEHLTIgnG+/iOF/KeqHCfH1AhcB5RyjClh1XLPo/tFwSQj/AC2RzCi08aahSbUO4A4Wph4vPEucQHvvmpfUCYrgi/uz+6b0SAO9cYEwAiG27WDiN+pQDQ3wwQCOgXvh2gnDEj+gIAmQPo/b8E4EJFe3weYPc1OcC2NlaIJqPBQma9kYoAhLDwAQnICKCTGw1wcdZScDf6AQkYcFsSC2FzgrOLAAa/EqeJ8wfDByCCGxbMqjFA+3EJQFizYRTdcYyx+HdtZTJeoEOYLczlAwEQ1fKdzkUScGs2nIR9+hUE/kyLKwcMYKIPALWIfJEqbRLwE44AYZ9bAQAMWW0A4p0ogPoSANzsBIClAGgEtEsBnvu6eZswTuJpuQoR/w9+CSS+DcBNGAGeRwBk+SYrKuTJ4FaA5IX8+jl4xIV7IYleXxSeFkEUZAHhHgAV5iv/hFE8b5wUOntLUyr+OyiBPB5sJh2zZNcB4DP685uNh2BxC1d1hr/y9x+cJ0ZtExZ8MfRdCbAt03QVIG1YfHBSPqLWAPDRY07R5PFAXAzglps1gHy9rBzrFEDcuukPAVCGMxLAf3o9QFWF5CsA8l4JNAESwhwAiM8D+IcI4qwRRykkI1YXAsQ4QCVARSCV31mu5g9/aQkgaJ5lt4HX9wMs6CsGoH/hYBLIVMjvjvGVpgmAodlgQMN/sp4GUdnOaTELl8AQgKsbNQCWEYDztqD50nEIALgEnAxaAIvRaxfgrAQ4gOoDeBsYloCZAFBnVGgaIPdCPg70bKACACXAGW+kzwHEaAwxkM0BgHejH1MhusHtqlAFwD0BCnDaC2lmw3oSQJyUgDcfIF50LxhMAIC1YLcdBrAc2r7VcL417LyWGgBka6El+MAJgLjDefqEmV1/rXQMgODMoahrIYj7YUMAAVVPAODA58biwYAxQ9hQFYW5sDmXRwB5IIu75HmAWDlcc1sYAvBuoKwsZgDLxQAoxpV4o+2dxiTgfcgxwOUSCKvSHGBEhUQTQJwF6C/mdB1AnAGQLRuQPsnWUSGYBDhUoVwCg0aMqQ1GIB8pxewq00cSCM7Iu1HdBFhCWqUBAHMAm93v1QqXUjJ7fg37mDA7xaoVe7BwX0+5HMCyESqw8+UGX2gN8PeIw7wOEFJqgBZnMGOPjy+KgufZSAUjywuJsjCfak38G6rvhXoA/qfLCOCNOQKsshIXMHOLGptt6rEyL7I6jdv7ivxrm+dbXgcIK/EJAIk5rJBj9ol0AdAsqVa/5ZbPFwB4lZa2BxCfOmCmHI5qwvU6cUOF5E0A5Fn6v44SYGlgwAZ0Lw5gQoOrEAL8OlCh+NChqSdtBg9QWwvNAkBVAsQLyQOARhdEZ+LRXxUSaKxGlz6ACZs4lACmmAxzhZIUUcWs0vORChuxcrhXPbZg41Tf72k6O7MwC1JeZ868CD5BcWDuyTcIfJ0pqRKmFvHnD6xCqS8h4Yj//bDx5/QIUVAQAP8LBscRgJ6iDmv0eQzBJbDgqnRcAnPzgnfNPXjflwDqb3nEBNPPHqYlEDaIQwAwLQEoFTn1FswCZGsiBiBGtpJZD9KIh4Qs+paLzzOGzL3QBEDV2/R8fLaMYKc0QHZFIME7aJlWpXnZX+Gb9BNCinXwkAXC2NOTqeSBq6eWopMEcGxHCETm6RsxcK+M4X7p5oVyAFYxFZ31MdQBgEc5YI8Fg6UIEHIHoIdsFL4Wj2EOAgBU4m4KawKgfEkVoGrr2eI1s5kdwPXCvAqwv7lshHzBrVOyhXgGULEhJloOUJMAwCwA1ITQGVUVIs1AkDnbCsD+bLABL7eBOYCQv/r16vAAfC+ZrZ8yFRLHAL39AJMAvAeAENQWgVQC/k82VyGNTnFAAtHxsnTKxIzzoSUpXQPzucH5I0A0J5NLQKN+hmLJQGbOd5TZp5qe/8LsRgoQjVV4eN5pKxD/DXYQIgBGZpoj3YWxHvT0OSGeAFhLgKhAmeJnAGEj0wDw/XXb/wiw+g3aQeXbBgD9RgBMblEJUMUnAPy0qGISWFXYYjYBnthViarc0fQ0lhpAKDrmm7wIEIJwWwIFQL+93c1+X4o9aP/wLmuXlSiy7mmI3FOCFLVYjrFPytSLX0jgeSAB3QV4egDBNsXzG3XRJPC6I5IDTRLwCnysQl0JbAS1xbA8GNVcCRwAkLMQ9KV9gK4EfGOuBZnWOf35VxDKRAxdMoh63h0sLqeVik5oDiB6owcLMj0AGZfGo6kgagOxhZeNRRVxwJethgCihNOafYCgvZn038kiWACwWbNH+qYoAdQ0QPypIwCoHyOJuBoA2SL5LIWadaMEIJ+bnBvo4oXM9xKyQlCRALrAVwB4y/ngxIu/e5TM6cgbAH7YKauKMzlDJOovgbzd5ghg1Ihje1AJMKtNXUIqgQLAO1JesR8HWC4H2M8x2o4EFFOh5RsAqDW3AMSSn5Bdxyd+pELvIfDlfn+u0bDiXhyKXb9yogO5BuDjbbYcOwEgEcAOAAy3nPUBcsf6OC+BKgDUAdbTAGvXjZ51s0mF2gDwOkDZj5nfJaLVmwHyBMblAOocAO6UqgDxwPctAOoMgEhNR1WAmB7fU4puX/AFAGIUIMvta3oLy3tOeL8uAbKDDADPUoVC2m6dbnztu6WzEkgbvD5A7I26AKArgce8DTxN3r0eayjXAJDIvvtRfgdbOol+VJnqSMCb8SUAlbx2uE4o/GYmiiJHAHAfQB4YjHwLgJfi7QD6lASSG+V19vsl8CIAMAnoLAzcokJjAPE4RQ6w5IeBkiMIklgvBnA3LI4AiJiROwIgJeWbAIYlMAiQnO49AOFkamreeA8AaQK/BIBfd6CHJXBoA/m+4FaAcOPfoBG71vwagPgYQLj6AwbSuzytQjt3xcclIIZTwg/eepyu/AjOaM1LjPo2gKH8uigBlrz7JwGw63BvBaim1oMtHAEAlQDukT8CIJqFBqsOAb5EAu1Cz+MQQKRAFgH0LQC0pyMqj6iUCR62qULsPNkVEogdW604EKreh1W22KxZA9gQwoVDRl0CIF3LpzoC4HXV1iaZnyNgF9HBsr4fQIbdXwEgGYBol5p6AJAuXboCwDdhHUugdKFZt0ETgLVKXSGBdIS+C9Coz3waQA4CMNWhBB8FkBwA6kYsUvm7KOscAdDTjnK5yAZGAHwYpnojmxJYSgl4b7ysZ68qaXcJchswzT4hjlCxAYwHESCdlA33tZytVtbcP7u1FY+AhX4yUVWhgMCWREWnM72J0rUvhR/CO7fWVwCyexIFnlVXFt1+rVmu0Xt0BOCa4EqAl22Bn/VIAGHZwAFk1jA3B2DxoOEbAXapyhaAqKmQaDd/DUggz1a/AcAAMIBwfMc3qzGA2HrTA5A5gAmNpNjK+cZVKdt1EwlUAHhf4IwEfNcPtwH9dhsQUQLBy4iy5oR6NC6B8JkM9gojlnm9Zb8S2N040TJikfUF5oeXuARkcUF1PO6cVy3XsxMnEXK/4MJdoRTeslAhcvE3jwCtlJ3gu6Rw5Ut8Fpp3cp958tiThHdAjQDIrP9PtnOOVYB0DYKKtnACAKB6fpMCyCoA9aZ+KVQBEH0AIAAXSeAQ4KC9+kgC2e1RV6iQGgKgnaQzAOyC6pckAF2Aum9/SQLvBOirUAOAbmamAfKFl37FiE8DvCgBcojljBfKg7oojv6uFs/78AMFI1XLYo3BAJYsoKX3NOMq9MxTnukidV8bU2ury0NMlF1lC0DR2+bJEt2gCAYk4A8JxlWJIarjJVDtvhRjAKIDQG+bJzKdAQgn5KIKlQCPeup8UIWGAehR2ykAa58NCSgEeEGFGonfGoA4DeAQCoDQvPhmG3AyqAIAOU+OAHrIBtyHh1jcGxEA31cIL0mgZgOyBQBnAZwKBds07AqI90oAWioksw2EHHCjbnJaLTz5FwHwLWzDoUzczyPp57lsP2I17CMjyCcuhNd173UOlwcbg0v54oM0IoA8d0alKq2VPXl+jXcE4DfqtgDw/snKR5lwCcDRKb90ELdMV08ALBFAjQIshf+fAKBZ0LdIYJmXwGsA71ah8BFC5JNh3gogeueu7gTQJo+BhQ2oY4C582anbaAPYAT/DJkPq1CYTR+Ae2C2g4xnE1bbW2COTHwUgEejASN2F+3Sq8D5pQC2El3F4CFFmAVYWp/vcAiwzAGI4ROj8xK4BWDyUNxfDfBXSkB8vwRYO4FkWXbSgHAHAAMxqgvwGB9FhigCmKH5m4GLh/hYSwB6EGXyfit+jmXN0in7Rd3hk6S5N3df2r7xHw12h2me5ZIyAAAAAElFTkSuQmCC",
  couttspurple: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEUlGDKWeLCCbahSQW17ZJuEZ5ZHOGA3KUwoHDhqV4pAMljXzOyehsmdgL9lUH4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABtdkTKAAAAKHRSTlMA//////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGUXE9QAAC49JREFUeNrtnYly5CgMQAPIeGDS8/+fu22DOASYw8bt1IatymySTodnCQkdkK+v+UNLLcn4+lFDpuMX4BfgfwWgfyXwcQlorddt6CcBaGGHNB+lWO3AV6hkCJ0dq/4EgFBsGwrs5EDZ6UgkUOybDIaMRKOE/AgAbIP7x2snpx3Ad0CwwXoAuq71RwA4rwCkEtC/ABcCMAqg6wDPUiHg239dACUJPGIRKwT4apDAZq0+DKAUZ28tYko0WSFjiRLz+QEVUrtFZMxO6VvJzYttHxCAfdsXsOLgu/SAiXBRvIVyBwhVC/cUHYB74MD3AXa63P67/+/+DQdw5x6jA4BHY5/1juG+kgDoJwNYgvALTwdIZ0yIHgDAYgC9/ecBAOicHwaw2ZoY4L03lojG3IKFaPU6qgDAuoUPSIB5W+7NqIVzs2acmtEPSMD4K+Ed7za17SvOK+E33DRx/krQARbBbwQ1OmgzZgDYyEUE831PxX2u3c6BQaAzG4AN2jIAiKpopDNNAso/TRUDSbdzQAfG6wCQ88iTVMlJoAEA0GWVAQLrFALIhwCYyTuAdA0UHNpUgLoKBfYfzBaIPxFANgEE2zeWUSFDBrcCeCtk98+YFyJWiKHVd7bI+zr8EYgcwj0A+MvZKx4uM+Qm5XTMvQTHPyoJxQyAok9jAgA+o9dfMl6c+C3c1Ym/yUtxnui1hd3wOdc3E+C9TdNZAB+wGOckjUc9BLA5RRH7Az4ZYN9u5gDi/bLcWbsAXOimPwQQMoxIAH90PkBWhdgZAHavBIoAHqEPAPjnAcxDBD66iJ0U/CKWEwGcHwglEIqASRNZruKVvDQB4GGeZVsD5+MB4mokAdB/cBAJRCpkomN85b8igPPn6NDwR9ZhkGTbQiXQBLDXjc4AjK8FPQQAVAK7DA4A1irAqAR0RYUyAGYN9EmgEUCeVyHZqkIQ+YG1HwBSgBFrpMcAnDcG58j6APYolH9OhcIAd0SF9icQAuirAHQnAB+UgFk+KrCiW8GgA8DGu0FaymZsNkMkfawhcgAQ7YWEtYE9ACTQVuufNRwNIGBnrpK6FoIYihYAi6oHAPC5EX/QsJjBBlRJYc4G5+wIIHZkLi4cAMDAZo3XQhOA2U2llcUIQEwGQDGugTV6v1ObBIwNOQaYLgG7K40BWlSIFwH4KEB9L6TzAHwEgJXWADNJtooKQSfAoQrFEmhcxBytECMlJJ9i3ivTRxKwxsiYUX0MsFcDsgDQByAw42kK59o6ApcDdX7B90RYg+2+AVg2sgpsX+ZeGL3HVhQB8l6nAMCUVBSuONsCwdyTRlFgdPVN6i9BFprHVQtGSzWQfEvJuhWqAZjfzhyAWcwOYEWVQgAVZG5RY6OgHivzPKrT7LEvj78WpBRPANideAcAwxyWzTGbRDoHKJZUs98CPgfAqLTfVpUA3FMHzJTDUU04XycuqBDrAFAnAIJnaT5tJcDSQMMa0DU/oHhehdzO/ECF3EOHop6UGQxAbi/UCwBZCQRWiB0AFLogKhN39iqRQGE3KuoAwgZxTgLW2QviB1hQROW9Sk8HgyQesDHBrvompqlEZorHJQacH0vNfVD44t6GniMwdSYPgqlF/P0NkVhoSwJ3RD8/bPwZHtYL8qDEZD6gc2zYRlcVtVmjxzE4rZG5XWkLAAzMC66au7W+JwBU4S2PmKD72UO3BGyA2AQA3RKAVJF9b0EvQLQnIgC8JZSMepBaLCRE3jfdfI4sZGqF2gFU1trUbHy4jaCnNBSrioAp41mcc1FZgPfQzcnc8Ne27wnCjbirTbACs38oKpGaiM+oIIDrUmgFIBVTXtkfQx4AqJcD8lgaAOwr8RhmIwBAxu96t8YB0pdkAbJrPdC6WQDbm7OCy+d0dTKyEY8AMmso+EIrAEAvAOSEUBlZFQqagSAytgUAlV0DfQA2f/Xn7DAANJaM9k89ALV4gEhAXQMQEOQ2gVUAjWa0QQLYMMZIOqVjxvHQLChdR/PfUvjG+NfWgEb9tMWShswcdpTJ7vm/Q6AFByxgOifyu/Bk3vhziQTQsYU50k0Ya7WnTw6ozBIN5jU/UnwoA0CyBsyhFukAVhOgHVS+3VGkCwEwuTUgAUkksEobYlYBXP9gRdP9EDkAs45JkHcCoN7e7rZi2Gn4flczXltalPYqhm2L+MLFTInxnC/PZ007JKBbAZL37h68SJAH2AOCFhXqAxgf+e3UgQTMQYSzEgB6fGEcgEQIXjQZAIAYQEpnhPoAHMiL3ThUXF71Q8jED5iy1VMBSD6NpwDy2QBBiLTviUsA+ukSQJdxBoC2nP8wALSnsNAxF4DXAFoXsWsPWohduBvAGFJasW8HEHcAvGoSkESFxMMAihLgIj4hu7ZPfL4KbXsHc6RRKFrcc0OS61cGOpDnATAEUA0AzS1nOQCzzwLYPy6xYX1dDAB5gHUYIFEhKO3le82sV6EyAJwHSPsx47tEtAw9xVtIZwHiBMZ0ABkDXCCB4MD3LQByCADXVAHApce3lOIeFzwPwOhbDiDK7evwFpZrTnhfAYAB5IEK2daitbvxtW6WMgAAdkrNAPaHSgCuN2oCQCIBakZfbSoEBQCbAzPZpDkAgWff7Ci9g81kkg4lYZKnb4KiBMwyngKQyWvb64TsPyKJICANKsz8DwHgPoDYMQi2VIeZ/qEETE71dgCdk0AJImNGaZ39fgm0A2wjAQAiAR25gVtUqAEA3ApPAOLDQH5bZCWxTgbYb1hskQBrAghKyjcBNEqgGcBX1+8BsCdTF2DGTV0EEDSBTwGg1x04z3YOII4LPgIATYsYmywTAP5xgJG0SmBOfxLAKxVBfBjIObQLA5ubAFjskVdyHe5jVSgEgFACGCM/DUAeAjxeAq9DAO4dmQPQPwaAnCebIQHYL5tWoEuOrEmHCuexgEddi0JOALCdP0qeATDubYHKRXTbTXqXAzAb/SUALPa69UTLewdVAAB/6dIMANP4elYCeQDSKjVDAv4I/U8FYD8cgE0GCE87MjFpDdwgAdPiL9bRq0rKNSi6BsQZAOoPgpOy9r6W0Wplxn/RW1vpyeMRAKzz0PslUIVo59Z6BiC6J5HjWXV5CgCIKpUBTq8FUPTm4ssAshKAqwGU4tHValdKoAAAlwJsp0VjAHv6xXUaDQGwGECEKhQC6EskEF83K68AKEqArAF9+RrgTgLsQglMXMT+uJO/EnjfsZ8AcKUQlr/bdjvnElct19GJBx6SXrmWqNABiM900ZRd/OcwVsWic4/uwM5AGw4kPUnnAXzO7hjAX4Mg3VoYAID47ohWADgDEF5QvQcfP1AC0e1RM1RIzpSAIhdUn5CASlo7GwGWxwBMVKGiFSIPzauQngwA3kQeqRC2tS1HEggOsYxYodgn8uTo76pYocMgmKSdaFjqMJ+XMl3uYmpyWTte0i3WYQB3kbqpjcm12C7eUPGuAriDhjy6P4cJFEEvgA/AhD1psSo2BgBLhwQUjy4s6gEQVAIJwKgEllwzahkgPGo7DhBJQI4CQFmF7MgB8IsBbPPiCQnkTezeoppToeA8OQLo3jUAEYDpK2wAgKTnxjY+LdkzXKwEAKcA7EkqkZjRFglAowSWggrZjUz6h8yOOwlWLV2KKSmi4FuoK0544HuIfc6rIH8yIviLCxageq+zv0yWEfufALALCFBQK3ny9AJdB0Bv1C0D4J0QFQnAeQCoA3gJyD6A0P5PA1h6AMTPBQizaUI8CQAuBdAksZGsAUmt0L0q1A7AyV+XmSUBaJSAnU07QPLk4+M5gQRGBEHdcw1AlC4mL68B90esyd/AWUsAy9j8l4kAog0AyyydqgM4+Y8DDErAbuxMV/VnAaB/MS94WG15AABUgpSj5DRMXcTtKgTdKgRLWOO4A0BW18CrfdCw7UIA2hpN/4RsABDdI9F5vxU9x7JG6RRpiifSXoIZT13u3/8PzxWdiI/NvYYAAAAASUVORK5CYII=",
  ivory: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEUSGitOaZlQb6cuQmdkgrklNlYTHTEdK0ZWdKpif7Q9VoNjh8i7ze0YJT4+VH0iL0gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADSok1tAAAAKHRSTlMA////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSBoEgAADHlJREFUeNrtnYGS4yYMQE9gzsKp2///28YGgRBgwLGT7MzSmevubZLlWUISkuD+/Ll/mHz8+VHjF+AX4BfgF+ALAOZtfBWA0X64L4zR87qu2zTpFUs2tCmO+SNAGnAbAAs8x7LAQvNZ/SsAH2Lg7Icg0OYjAPtQEB4vTS4APBjBBlsFMJ8BUKoBkEvA/AJcCIASwLQBvkuFnpNXJYD5p6iQWMQLAfz5GRJYQOFTixC0XANzyQo5S5SZzw8AwG4REf2UHovZvNj2BwHgw78Aq0M58aGWInkDgFSL+BRpLuGBP+3UNsBPV/n/71/uP0C9zm+PMQYAVDL2We8Y4W+CBH4EgCfgf/HtAPmMBdEXAGAKYLb/IsDuKurj82tgszUpgAkAuAO4BQvJ6g1U37CIEXMVIguLYdaopBn9AIDeXa5eyPPS7AKApr8J06T5g5YDCGEfC+jZpA76NoC4q9oc8HMqcZe1YFy8wIfSpgZAqMsbHFoAoCG3iQtFDuTAVBuAZEaq9C0AQC6rDsCs0zcC0GbHA+RroOLQbgVYmgDM/oMLgVQvwPpGANMFwMI3LKiQI4O3SiBaIR8/U15IWCEkq68yS0tvMpA4hF0CmwzWOwHol8ttVnzeNKmgYzylso9/y9bouaTl07gBgLT08Y8YDyX8Frlk/U/20jBPeokP+ILruxFgC9NMESBuWJxzMk4RDgF88KFTf6DuBFidsy8CpPHyHpKOAYSt26cAOMMZCdBb7wcoqhC+AoDvlUAVICKMAYD6PIB7iKDOLuIghfcABD/AJcBFgMbtLGf9yF6aASieZ7lmDQhXYwSA+UtDSCBRIbc7plf+WwUI/pwcGr1lPg2ShS1SAl0A++TWFwDMmwFASmCTwRHA/DYA0wZwa2BMAl8FkFoh5wfmcQD4KEDwxhAc2RgAODP6MRXiG9wzKrQ/ga8AUCcl4JYPCCs6ALCXqp87DBA5tG2r4aj8nqoEAEksFIzkAEDcaLtU1/p3XX3hPylbHQD4mUNW1yIQR9EPoM0JAHpu46oEfkOVFeb85hyPAFJHFvaFJwBoY7OeAHBmIK8sJgD6ZgAS4xkAl05rANwuAR+VjgOoKoA6C9AO5kwZ4JQEsLYG0CXZGioEgwCHKnROAmSFUJSQYop5tyxHEvDGqAtgz8IVAWAMQG/NSgu4ZNuWX6M+JjLMoloBPjm6xFwOUNmIFHi35ZpeuGiQnxGGfh3Ap9SAVpymjD09viAKmWdjFYwkL6TywnysNckfmJetkP/tGADcYg4AMxb8AmVuSWOTTT1V5lVSp9n3vir9O5ZSfAHAR+I1gDUHQMph+RyzS6QrgGpJtfgjUPcAOJXGpS6BmEOIaUEfTY4NqKkQvgmAPUv3bS8BlQauWQNlFSKAvwcqFB46VPWkzuAASrHQ8CIuSoBZITwAqHRBNCYe7FUmgUo0qtsAofzrJQDh+9QUIiuiqlGllyOXwOKksPS3pPlZsPK6MOaZ8/GKA2NPvkLg6kx5hYZ+f0cUym0Jc0fy+8PGn9PDe0HFANwf5Bx7AFqK2q3R5zGUlECISvslMDYvuGru3vq+BFD+yCMmGH72MCwBv0HsAoBhCUCuyLG3YBQgiYkEgOrZSiY9SD0WEhLvmwefZxaytEIDAEVr07LxSRghTmkANkWA4Aw0ZlFpArBVPLszcfzX9scEPBAPtQmsKXpMAE+TnfZh3UAtGi/I3eumI0sBRMVUNeJjKAOA9HIgHgu4aXuK5xc5gH+lGQMAKPjd6NYUQP6SIkBxrTNZWC+AqwG2D8eKy1dydaIIxBOAwhriorWcoA4AYIZVCIZHUYVYMxAkxrYA8NQkXIprYAzA56/+vjocgNxLJvFTokL2KgD3jmsAGEEpCOQS2L+qAHStgfAOkU4ZmHE6DLLSNQib640/AXgrWlgDpJ9zb2aOOsrM8Py1ZZuJbYIKVCUKR/e83aS3Ed4oJUCObRZby7nZ0zcOMNvC+ZKS4icAfvH6PCAWDlu685ndNaflBgBKbnEJMMV3AFCUgBES6AegBsj/Gpoehy4B+KJjuskLAN4JBwm0AUwvgKYa2VM9/QJ7TNu3j+qwSAHN/gdrt8yiRPTzjva/F2DuB7A0HT/s6EBVJXBrwDIPDC5tcCXAlM1oOhglgHI4RRKwSQgBnuACAP8Z4G1E3/wLCFMGEBcHTuLT0PuGHMCMAgSQh3AyLYAphMZ9GpasAUjLq6zyYUb9AAcIEo4xewdBWaH8j6zwYB5gSZo94v5UXQEQfmsPwP4yO02tp5++MQKwLZLLUphRM8oA0rlNY4NMvOUqWHj6FQmQy3gFgBzB4MSz7x1KYnSmNwCQPYUsW/ISkS2/BNJ2mzZAew2EZnVpDXEa1aYmIZdABuAM6XkAfTvAczyWhgSMANDfAMADlRpArPav8972tI6fdygAXEOwO17tzjXK4l4Yr18aUJKA97dJOHYC4Bk7LFqc6aoCdLectQFSw/o4L4EiAJQB5tMAcz0mq4x+FWoDwOsA1fSFkYkDGuNrIAFIExhvAUCxRjotUBUgHPj+jAR6AGxsOioChPT4NwHYXoAkt2/E4cqvkIDLohxJIDTt4PxyD3XhJN9JCcQNXthtYg0g9EbdAFBYxOl49K8BLJpRVkN5C4C8g82lYA7zMG0JuGV8C0CByF8n5P+nu0sieAgA7wMQtx1h7/QPJeByqh8AmHsBilZI1tnXLwUI5QAJAEICZj+jfusR9RygR328OQIJkB4GimGRl8T8LQA2bOaPAFhJ+YcCxOr6mwHwUgDWBH4LQIgx3FhNtwQO10C6L3gHwEoA4uKhxiKmJssMQL0bIErAA3Skd7O0CjOnnwNYGEBnYis/AZEeBgoO7cKNTR9AV37dHgBg6pHn4dTihQDF1DqthQMA4BK4EWBtAthqoWExhwDwHQD1Qs/jEEBFR/Z3vvXam1UATKynIyiPLZQJDgC8I5tvlEDsiBES4CXyJJVaSHItS9mjgUq6FrW5BWCv8oJZy44MS3VVuUlGX+puXES33aR3OQD63V8GgL6xySbNlUUEWzsRRz2I8dKlOwB84+u281hrEshNaNJtUAUQrVJ3SCAcoV/3W+OPAGR95ksAsBNAqA4n+CgARoCNIAZzYhHbWP7OyjpHAPy0I+qb1oADcKMG4Nww15tpRAKuxV/Pl/sxHa+R8K1nMvZPgyGGUFgD0h+wk7Luvha6oeES8y9ubaUjYL6fzBZVyCOIkMgmCRd2joCASIUu9MiQ3pOo6Ky6WcjsZxKInR/ViodUpXsBxM3FBODDBgkwMUVqAJQkAFcDbA8FawC2pEK23vxl0+lXAOBSAA0gAPzpF9esJgBC600LAIU14ioEN6oQMAkUAGRfYDfAG9eAChLwVsbmNSfSo+krAFAl50W3/rw9Yq8tYpv0BSYyEWaU3VWa3m27nXNx3vIFAEBxgExeuSZViKXjrPQAWEnZ2XSXtM7+ypd4ARndVTAPOzbIepJGAKak/68KMIlt3szvdwZ24ojumxoCADg6vzm7hs0SALem/sxMATIFWAsA7MzXXRIoARTKlh0SiADpVaAfAAAWCI0DiAuqXwKAJkA5vnlJAlcCqLMAfDNTBsA6gCoDmLsBcEgCeCQBdojlDEDqE/MbFObF+g4DeaCgXmXF0rYzcRAEIC9rD2H3fBogXKROAPBodDd1VGymGoDhAOxua00tDqMAcQMWJVDsvrR9ALYBwG+bZ2dzRgC0lEDZfJ6UgLUVgDlXIbgCAIoAL6iQzZpK91ECUDcBXLsG3KksLKkQO09OAGZ0DUARwF68iLEGAC8B+JNUt0vAqZAE8BeSZv+Q2XEnwcz+eZysiEIfQTfR2fYZuWbdeJvY9tG6epUhHXtulpziZbIo7D8Nn1FcFxxo3W11xNKHVipP8dy2vJC2DkB3QuQS8IWNA4DC8bdCujoCIPhy1Vwvv0Ly75L0AnD7PwDAs6A9EkBYfadWE0BfADC3AQZV6CmB/cjJIQDPpml9KYBtnbvqAGir0DgA8PSPlv+QSQVg7LzZ6TWge6xQOWNzkwo1Afxs+gGyJy9a+yNAxR8cTjzdILQBdO1e70OABIYqSqsE4N7Vdh5SlG+9CSB9y5peapAA7GUW231iNK8POBv0VoA5Axg8FCcB1vlzAO7irDMhBAdYP6ZCPpgfOKeLaavppwHYmcW0LJxm2VkDQqZCZCDeq0LyLEr/kLeawCy2kucB8iMn4YCsGEty0dzg/VbyHAt9qC9bueKJ8ZdgCn+0//x/qYWtxgV71pMAAAAASUVORK5CYII=",
  obsidian: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACzCAMAAADotONaAAAAeFBMVEURIRdclnJFgmcjSTkaOStQfV0/emEQJRo0ZE8rV0S018k6cVoULiMyUz0gOSkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACkhe9iAAAAKHRSTlMA//////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGUXE9QAACldJREFUeNrtnYua46YOgBtBtKbQ8/6P29ggDAIM2GBnTof228tMkuW3biAJ5q+/5g8ppGDjrx81RDp+AX4B/lMA8lcCj0tA0vgmAKncEPZXoaQxZp0lvWJJhpKF8QSA0rAOjYv+jGXRCz1l416h4cUGcEk8qVNK4zpAJ4/XA7wCghV2B+AE8iEJVADKEvgFGAEAP14CCOt/KYDsB/gKI164TzwC4AwPACzWjYJWRQm8GAGAKIw7VUi/7MTdlF7LPgs34OVeAOWBVnwqlMfnlztAuFqoBMA/cHSTpem637c/2m8oc/8aowOAPXT75IG4NgBmEPKbARxB9IUvB8jMmBE9DwCHAIh8zhzAPAuw+poEQBCat93deJ1MUiN2CA9IABQXgCQPC7HPeVoCagu5aqHIuwXiz07AAyjtBnP2n2Ct+CAm+4ZFqxt2OApdwKUJr39Wyv9dLrAbL4ZjF5IfXCjLDXtOpVOA+O+0cvCGWwfwrzAxwV0SKAEghawyAIbLiltsoQvATr4R4KZ4oJYqQOD/0S6BoBXAfB1AsHzLAwRR7iYJcBWitBD3QvuT1R9Xu/5f80KbBFYZmJkAbsKCb7NAo/XmflLk7JdkVbcweJdbCiLFRADS0tffbLx43KKYrP5OXkrzJI1RbMGHEwFkEWDfsNhxACASgJgdH5EAsvXyCQC/dZMPAUQMvwCPAAQIXQD4BQB8u3hFAhNXoybarnxGZMSYA3glL81IIPBgqwSu7wdKWUsC+EMjiQMcwL90KQL4wEYBjd5yHkREOyehLgCYPIBoAjhtC1KdkQB2AYgWgLMSOAGAjKACoDoAxBkVOmkDmMQB02cDmAKc8UbnVAh8MMOTAPiwCoUb3LMAOMQLFatXjQDnVWjbAgXz31JlHXWLtVT92WFo5hPXrcbmW+nfygEgWws59nYA77yXxaa6zB9jXOG/URJIFaOkrkUg7QCiH4AGfQqLBw3G7HclHIBSDEcALJCdB1C0sTGxLTQBOE+WSOBWABKjCbzR55PaJGB9yLMA9BxjgBYVgiIA3A4AJwHyNgBuv3IMgCNVKJZAoxEDeSFgJSSeYk4BdBDE7Fpom34RQBwDYB+AWpuVFr35ebXm11wfE6WaFohqEXoNFtvX/bS139A4BdabL1f0wkXp4DPWogjSZyU5uxMAaEsqmh4XtUAoenxeFDzPFlQwjitJB7Um3eCFagD208EDuGUVAUhuFDrI3JLGxpt6+sioTpNib8WnEQD23ywBmBTAL58xTKTDUTUv961t+TwBwKn0UpZAMAH/TN1qsm8MAdAXAMJnCZhW4g9swr20DiBrcUAXVIgA/hyokH/oWNSTg6efBaDKeA8AZiUQeCE4ACh0QdQmXvNCHatRAlBuE+c3dzx35qvYyPXgwkBW2BBr8FiDzab6ci//1wAihc778KjwBbsPHTKwtC9o2ImFviRw2HjQ6IDDpu6iYKJKgoJj4z7gWFGbNfo0Rg7Afqd1H9A7LxynPFcBdOEjj5iw+9njKQlgIwB2SwBTRd57C3oBCjZg33XWBg49JEbRd4whnwfQWW9T8/Gh19XslIZuEIG2kcUHFy3icOBL+fWEEL1Dx9PveHp7ro5WTwXm/aGkyScVty97I66XnGIAXnCsrI8xD4A8yiF7LM0APsvXCICYibtBqzNiJjDnALK2HmjdLIATZlkAyNhQ8IVWAMReAMwJoTKyKhQ0A2HkbAsAywAAl7/6c3VIwGjWmfVTD0BtP8AkoMcABAS5RWAVQJ6xAZZO6ZgxGxCUrqP5ryl86/xrNiBJP0VzdpraQkX3/P95vf0c3/B+AyCUVuGF4gMkEuDpSel0SVZ7+voB5KuYRYkUH3MAb8fNbSAFEOIYwB9FGgjg2xbLEng7hLoE3BazCkAf8b+apvuhcgDWjtkmryiBRoAWCSi9q+ercUD4exrQQ7QLALIfIP9v1nkOCLIA7/d7hgROD8gvpwoAjmCABFxj7ggAHY9jgHcMIERU92gH8CCvO4fv2OVS+ykAS9TscVBna2+qfgwA9wxxsEf+QQD5VON/EID86TtZi00xYp5WLwP0npSTq3MLB8yVQB1A9gH8820AvX2YkwHYkQ4FpX4LI7e2J9PfejYNYAu8yp5rVEWAy0cT50lgXfwsKj5R9H8AgKMBEhV611Jc7SpUB0Ax/nRr3BrzcWocsN8GIoA4gTEd4BNX3nBOxYoA/sD3LQBCnLERenEBwKfH15Qi9b7+GIAoty+/UwJAaldWIadHsrvx9SYA99oSgDeEWwBOuNEDAJdOcqX7KQDR3UBS8jvYLMMhSF0C4FLbEwAyeW2WoXu3DjgEwPsA4sCgoHX6hxIAeARg6yxqFkFlMfcBMLdLoA3AlwM4AHIJbGfU96sCblGhFvXxCS12QD8+DLQvi5wk5GSA9SE1AbyaAIKS8k0AzRJoBNjLDPcAeDcKQwGCJvCp9w7RoStJ2ehrAPG+4A4AQwB08VCbEavwbp8QAO4G2CXQUWHgN2UE7vQ5gKW/RJK0mkVXQCGAuXw08WaAuOUMOcDMKz/GA2BGAvIOIz6RGy0A3COBaQCwB7LJAGYWAPhuqhkAazV1PVOV2EDHHhOWJR/RqFvEfV2JCQC28we0MPlABm3xwJa6+TkC3mc6A4B2fwkA2OJ1V6KoAIDs0qXBANZRrADGnJRABYAfcx8OsH222W6N/wV4EkBuB/j1WIDotONcADtGAGQuosOwYjNyc6+SG6nYhqYvXU09hwSwn5S1AGbYWgg1v6WPX1V4BuDtmjbZPYgLP+o54CpA1NE9iTAIwI06wGVbmCQB+5YMAI4GWKYBQAkAhwIojVNsIFYhFapQCHDdncbXx+AkgKINyG+1AbjNiHXyMwSGudHgrtI9O0FGbHrv68lPPIiQ6wUX4Y3fS8k1HtSa0pSdGz7XxM49kiRMPwgWe5LmAUip2dF9cQUgvgZpMoChoygYdfWLByQAVwA0e2wzVEjMlIBm+fYLEtCl1s6fAzDRiKFsA/ljg/MBYAyAdscCL0ggjomQHP21E8+lscpVVigaODAAEQU0oLMJqM4DqLg2JqRuXesfVGzKAPs5vejyk9MAGP3MjV0CNwBEP0moA0CVJDAXQKYSwBEAkQTEBADWchap0GAA17w42AbsqSzIqVBwnvy0DcQ/DcF2Po0FcM4qD4CXAWIvZCn0FBViAFj6QWbHnQTrBxC04tk/H8BGnPAI3ON6EaAqlV/9sefqvc7u8mCloPDkKaNoFhjQHU4ioQ8tlZ48QPXCCbr9WGV0359N2HZNAwHgTTuxcQCipPtzAIzr1LoFQM6QgLHVngOA2Jl/HUBdhRoBpIp+aA9+D0CjChFA2Qs9BMBmU2+V5u6fH03YAc7Eg3iDUAdIolHdBlLnY6IkmQc4c1qIv7UK0P6jpQ8AChJwUuhTpQRg80G3AsgrAJABMPI5AGhuMTiQgDGPqZBbzHdJAL4JYIARk4MYCMBAlEhV6MLJafbWt99Kqqbpq4aLh4pu1C+n3+FBlHff4OdYasvpZPwLReVdJzZS07MAAAAASUVORK5CYII=",
};

const CardFace = ({ variant, exp = "12-26" }) => (
  <div className={`cardface ${variant}`}>
    <div className="cf-metal" />
    <div className="cf-grain" />
    <CardPattern variant={variant} />
    <img className="cf-logo" src={CROC_ENGRAVED[variant] || CROC_ENGRAVED.platinum} alt="" draggable={false} />
    <div className="cf-sheen-fixed" />
    <div className="cf-content">
      <SimChip />
      <div className="cf-script">Rassam</div>
      <div className="cf-foot">
        <span className="cf-name">RASSAM MAWARDI</span>
        <span className="cf-exp"><span className="cf-exp-lbl">EXPIRES<br />END</span>{exp}</span>
      </div>
    </div>
  </div>
);

const PuzzleBody = ({ shine }) => (
  <>
    <div className="wall wall-rear puzzle-rear">
      <div className="pz-skin" />
      <div className="wall-lip" />
    </div>
  <div className="hold-front puzzle-front">
    <div className="lp lp-main" />
    <div className="lp lp-wedge" />
    <div className="lp-seam" />
    <div className="lp-lip" />
    <div className="lp-stitch" />
    <div className="anagram">
      <svg viewBox="0 0 100 74" fill="none">
        <g stroke="rgba(48,40,30,0.45)" strokeWidth="3" fill="none">
          <path d="M50 8c-13 0-22 8-22 16s9 14 22 14 22-6 22-14S63 8 50 8z" />
          <path d="M50 66c-13 0-22-8-22-16s9-14 22-14 22 6 22 14-9 16-22 16z" />
          <path d="M18 37c0-13 8-22 16-22s14 9 14 22-6 22-14 22-16-9-16-22z" />
          <path d="M82 37c0-13-8-22-16-22s-14 9-14 22 6 22 14 22 16-9 16-22z" />
        </g>
      </svg>
    </div>
    {shine}
  </div>
  </>
);

const ArenaSkin = () => (
  <>
    <div className="ar-base" />
    <div className="ar-crinkle" />
    <div className="ar-gloss" />
  </>
);

const ArenaBody = ({ shine }) => (
  <>
    <div className="seam-outline seam-arena" />

    {/* rear pocket wall — the card behind sits above this line */}
    <div className="wall wall-rear arena-wall ar-pocket">
      <ArenaSkin />
      <div className="wall-lip" />

    </div>
    {/* front pocket wall */}
    <div className="wall wall-front arena-wall">
      <div className="seam-front seam-front-ar" />
      <ArenaSkin />
      <div className="wall-lip" />

      <div className="anagram anagram-dark">
        <svg viewBox="0 0 100 74" fill="none">
          <g stroke="rgba(22,25,28,0.5)" strokeWidth="3" fill="none">
            <path d="M50 8c-13 0-22 8-22 16s9 14 22 14 22-6 22-14S63 8 50 8z" />
            <path d="M50 66c-13 0-22-8-22-16s9-14 22-14 22 6 22 14-9 16-22 16z" />
            <path d="M18 37c0-13 8-22 16-22s14 9 14 22-6 22-14 22-16-9-16-22z" />
            <path d="M82 37c0-13-8-22-16-22s-14 9-14 22 6 22 14 22 16-9 16-22z" />
          </g>
        </svg>
      </div>
      {shine}
    </div>
  </>
);

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 9 L12 16 L19 9" />
  </svg>
);

const PythonBody = ({ shine }) => (
  <>
    <div className="seam-outline seam-python" />

    <div className="wall wall-rear py-wall">
      <div className="py-skin py-red" />
      <div className="wall-lip" />

    </div>
    <div className="wall wall-front py-wall">
      <div className="seam-front seam-front-py" />
      <div className="py-skin py-green" />
      <div className="py-scales" />
      <div className="wall-lip" />

      <div className="anagram anagram-py">
        <svg viewBox="0 0 100 74" fill="none">
          <g stroke="rgba(255,240,235,0.4)" strokeWidth="3" fill="none">
            <path d="M50 8c-13 0-22 8-22 16s9 14 22 14 22-6 22-14S63 8 50 8z" />
            <path d="M50 66c-13 0-22-8-22-16s9-14 22-14 22 6 22 14-9 16-22 16z" />
            <path d="M18 37c0-13 8-22 16-22s14 9 14 22-6 22-14 22-16-9-16-22z" />
            <path d="M82 37c0-13-8-22-16-22s-14 9-14 22 6 22 14 22 16-9 16-22z" />
          </g>
        </svg>
      </div>
      {shine}
    </div>
  </>
);

/* ---------- the trading coin: a 3D Bitcoin coin for the selections panel ----------
   A plain, chunky coin: two faces (a rim, one thin ring and the symbol) and a smooth edge with real thickness.
   The edge is a ring of flat strips standing on the rim, so the thickness is true geometry and stays correct
   however the coin tilts or flips. Everything is painted once; moving the coin only changes transforms. */
const COIN_D = 320, COIN_T = 40;            // diameter and thickness, px
const COIN_SIDES = 96;                      // flat strips round the edge
const COIN_REST = { rx: 6, ry: -24 };       // resting pose, degrees: turned aside so the edge shows
// the coin under the pointer: its tilt, the light on its face (gx, gy), how far it lifts, and its shadow's shift
const COIN_STILL = { rx: 0, ry: 0, gx: 0, gy: 0, lift: 0, sx: 0, sy: 0 };
// each strip is half a pixel wider than the exact fit, so neighbours overlap and no gap can open between them
const COIN_STRIP_W = +(COIN_D * Math.tan(Math.PI / COIN_SIDES) + 0.5).toFixed(2);

// The edge is lit once, for the resting pose: a key light from the upper left and a softer one from the right, run
// through a gold ramp from deep shadow to highlight. Each strip fades from the shade at one side to the shade at
// the other, so the ring of flat strips reads as one round, smooth edge.
const COIN_STRIPS = (() => {
  const rad = (d) => (d * Math.PI) / 180;
  const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const KEY = unit([-0.5, -0.72, 0.48]), RIM = unit([0.92, -0.1, 0.38]);
  const RIM_H = unit([RIM[0], RIM[1], RIM[2] + 1]);          // half-way to the viewer: where the soft sheen sits
  const ry = rad(COIN_REST.ry), rx = rad(COIN_REST.rx);
  const light = (deg) => {                    // the edge at this angle round the coin, turned into the resting pose
    const nx = Math.sin(rad(deg)), ny = -Math.cos(rad(deg));
    const z = -nx * Math.sin(ry);
    const v = [nx * Math.cos(ry), ny * Math.cos(rx) - z * Math.sin(rx), ny * Math.sin(rx) + z * Math.cos(rx)];
    return 0.17 + 0.56 * (Math.max(0, dot(v, KEY)) * 0.9 + Math.max(0, dot(v, RIM)) * 0.46) + Math.pow(Math.max(0, dot(v, RIM_H)), 6) * 0.12;
  };
  const RAMP = [[0, [34, 22, 6]], [0.18, [86, 60, 18]], [0.4, [156, 114, 38]], [0.62, [214, 172, 76]], [0.82, [246, 218, 132]], [1, [255, 246, 206]]];
  const gold = (v) => {
    const t = Math.max(0, Math.min(1, v));
    let i = 1;
    while (i < RAMP.length - 1 && RAMP[i][0] < t) i++;
    const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i];
    return rgb(c0.map((c, j) => lerp(c, c1[j], (t - t0) / (t1 - t0))));
  };
  const step = 360 / COIN_SIDES;
  return Array.from({ length: COIN_SIDES }, (_, i) => (
    <i key={i} className="cn-strip" style={{
      transform: `rotateZ(${(i * step).toFixed(2)}deg) translateY(${-(COIN_D / 2 - 0.3)}px) rotateX(90deg)`,
      "--a": gold(light((i - 0.5) * step)), "--b": gold(light((i + 0.5) * step)),
    }} />
  ));
})();

/* the faces are drawn in a 400-unit square. BTC_PATH is the Bitcoin symbol in its own large units. */
const BTC_PATH = "M2947.77 1754.38c40.72,-272.26 -166.56,-418.61 -450,-516.24l91.95 -368.8 -224.5 -55.94 -89.51 359.09c-59.02,-14.72 -119.63,-28.59 -179.87,-42.34l90.16 -361.46 -224.36 -55.94 -92 368.68c-48.84,-11.12 -96.81,-22.11 -143.35,-33.69l0.26 -1.16 -309.59 -77.31 -59.72 239.78c0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57l-104.74 420.15c6.26,1.59 14.38,3.89 23.34,7.49 -7.49,-1.86 -15.46,-3.89 -23.73,-5.87l-146.81 588.57c-11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72l-111.46 256.98 292.15 72.83c54.35,13.63 107.61,27.89 160.06,41.3l-92.9 373.03 224.24 55.94 92 -369.07c61.26,16.63 120.71,31.97 178.91,46.43l-91.69 367.33 224.51 55.94 92.89 -372.33c382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61l-0.07 -0.05zm-512.93 719.26c-69.38,278.78 -538.76,128.08 -690.94,90.29l123.28 -494.2c152.17,37.99 640.17,113.17 567.67,403.91zm69.43 -723.3c-63.29,253.58 -453.96,124.75 -580.69,93.16l111.77 -448.21c126.73,31.59 534.85,90.55 468.94,355.05l-0.02 0z";
const COIN_DEFS = (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs>
      <clipPath id="cnClip"><circle cx="200" cy="200" r="200" /></clipPath>
      {/* the raised parts, drawn once and reused: the rim and the symbol */}
      <path id="cnRimShape" fillRule="evenodd" d="M200 0a200 200 0 1 0 0 400a200 200 0 1 0 0-400zM200 22a178 178 0 1 1 0 356a178 178 0 1 1 0-356z" />
      <path id="cnSymbol" transform="translate(200 200) scale(0.088) translate(-2045.6 -2045.9)" d={BTC_PATH} />
      <linearGradient id="cnBase" x1="0.12" y1="0.06" x2="0.9" y2="0.96">
        <stop offset="0" stopColor="#fdeebb" /><stop offset="0.3" stopColor="#eccb74" /><stop offset="0.56" stopColor="#d0a23f" />
        <stop offset="0.8" stopColor="#a97c23" /><stop offset="1" stopColor="#86601a" />
      </linearGradient>
      <radialGradient id="cnDish" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#4e3306" stopOpacity="0" /><stop offset="0.62" stopColor="#4e3306" stopOpacity="0.05" />
        <stop offset="0.92" stopColor="#3e2803" stopOpacity="0.34" /><stop offset="1" stopColor="#3e2803" stopOpacity="0.42" />
      </radialGradient>
      <radialGradient id="cnGlow" cx="0.3" cy="0.24" r="0.6">
        <stop offset="0" stopColor="#fffbe2" stopOpacity="0.75" /><stop offset="0.5" stopColor="#fff3c4" stopOpacity="0.16" />
        <stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cnRim" x1="0.14" y1="0.1" x2="0.86" y2="0.92">
        <stop offset="0" stopColor="#fff6d2" /><stop offset="0.28" stopColor="#efd27f" /><stop offset="0.55" stopColor="#caa043" />
        <stop offset="0.8" stopColor="#9c7526" /><stop offset="0.93" stopColor="#bf9740" /><stop offset="1" stopColor="#dcb862" />
      </linearGradient>
      <linearGradient id="cnGlyph" x1="0.2" y1="0.05" x2="0.8" y2="0.98">
        <stop offset="0" stopColor="#fffbe8" /><stop offset="0.36" stopColor="#fbe9a8" /><stop offset="0.72" stopColor="#efcf7a" />
        <stop offset="1" stopColor="#d9b055" />
      </linearGradient>
      {/* height map → shading. The opacity of whatever is drawn is its height. A light from the upper left turns
          every slope into a warm highlight or a brown shadow laid over the metal; the steepest slopes get a glint. */}
      <filter id="cnEmboss" filterUnits="userSpaceOnUse" x="0" y="0" width="400" height="400" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.25" result="h" />
        <feDiffuseLighting in="h" surfaceScale="6" diffuseConstant="1" lightingColor="#ffffff" result="d">
          <feDistantLight azimuth="225" elevation="30" />
        </feDiffuseLighting>
        <feColorMatrix in="d" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0 0  -1.7 0 0 0 0.85" result="sh" />
        <feColorMatrix in="d" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.82  1.8 0 0 0 -0.9" result="hi" />
        <feSpecularLighting in="h" surfaceScale="6" specularConstant="0.6" specularExponent="30" lightingColor="#fffbe6" result="sp0">
          <feDistantLight azimuth="225" elevation="50" />
        </feSpecularLighting>
        <feColorMatrix in="sp0" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.25 -0.12" result="sp" />
        <feMerge><feMergeNode in="sh" /><feMergeNode in="hi" /><feMergeNode in="sp" /></feMerge>
      </filter>
      <filter id="cnCast" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
    </defs>
  </svg>
);
// field: the sunken part of a face (the metal and one thin ring) with the shadow and shine at the foot of the rim
// and the symbol
const COIN_FIELD = (
  <svg className="cn-layer" viewBox="0 0 400 400" aria-hidden="true">
    <g clipPath="url(#cnClip)">
      <circle cx="200" cy="200" r="200" fill="url(#cnBase)" />
      <circle cx="200" cy="200" r="180" fill="url(#cnDish)" />
      <circle cx="200" cy="200" r="200" fill="url(#cnGlow)" />
      <use href="#cnSymbol" transform="translate(6 8)" fill="#2a1700" opacity="0.3" filter="url(#cnCast)" />
      <g filter="url(#cnEmboss)" fill="#fff">
        <circle cx="200" cy="200" r="200" fillOpacity="0.34" />
        <use href="#cnRimShape" />
        <circle cx="200" cy="200" r="160" fill="none" stroke="#fff" strokeWidth="2.6" strokeOpacity="0.5" />
        <use href="#cnSymbol" />
      </g>
    </g>
  </svg>
);
// devices: what is raised (the rim and the symbol). They sit above the lustre, so the sheen sweeps the field only.
// The symbol stands on a few darker copies of itself, stepped down and to the right: its side walls.
const COIN_DEVICES = (
  <svg className="cn-layer" viewBox="0 0 400 400" aria-hidden="true">
    <g clipPath="url(#cnClip)">
      <use href="#cnRimShape" fill="url(#cnRim)" />
      <g fill="#7d5714">
        <use href="#cnSymbol" transform="translate(4.2 5.6)" />
        <use href="#cnSymbol" transform="translate(2.8 3.7)" />
        <use href="#cnSymbol" transform="translate(1.4 1.9)" />
      </g>
      <use href="#cnSymbol" fill="url(#cnGlyph)" />
      <g filter="url(#cnEmboss)" fill="#fff">
        <use href="#cnRimShape" />
        <use href="#cnSymbol" />
      </g>
    </g>
  </svg>
);
const CoinFace = ({ side, lustreRef, glareRef }) => (
  <div className={`coin-face ${side}`}>
    {COIN_FIELD}
    <div ref={lustreRef} className={lustreRef ? "cn-lustre live" : "cn-lustre"} />
    {COIN_DEVICES}
    {glareRef && <div className="cn-glare"><i ref={glareRef} /></div>}
  </div>
);
// memo: nothing in it ever changes, so re-renders of the app skip the coin entirely
const BtcCoin = memo(({ lustreRef, glareRef }) => (
  <div className="coin-3d">
    {COIN_DEFS}
    <CoinFace side="front" lustreRef={lustreRef} glareRef={glareRef} />
    <CoinFace side="back" />
    {COIN_STRIPS}
  </div>
));

/* ---------- Indonesian stocks: the IDX globe ----------
   Traced from Rassam's picture of the Indonesia Stock Exchange logo, in a 400-unit square that the globe fills:
   IDX_BANDS are the white bands on the globe (carried a little past the rim; the clip circle cuts them), IDX_WORD
   is the wordmark that stands under it ("IDX / Indonesia Stock Exchange / Bursa Efek Indonesia"). */
const IDX_BANDS = "M185.9 -3.3 186.4 -3.8 201.4 -3.5 201.9 -3.3 201.9 2.4 208 7.3 209.2 7.1 212 2.4 212 -3.3 212.7 -3.6 213.6 -3.7 214.6 -2.8 223.1 -2.8 224 -1.9 230.6 -1.9 231.5 -0.9 236.2 -0.9 237.2 0.1 239.7 0.5 239.7 3.3 238.7 4.2 238.7 6.1 230.6 13.6 224.4 20.2 224.9 21.5 239.1 34.1 241 36.2 233.4 31 223.1 22.6 222.1 22.5 221.4 23.1 202.7 43.8 154.4 102.3 138.9 120 139.4 120.9 142.1 122.1 156.2 126.5 192.9 139.8 216.5 149 222.6 152 221.2 152.2 220.2 151.5 217.7 151.1 205.2 147 173.7 137.9 132.7 127.5 130.8 128.2 126.3 133.2 121.1 137.9 120.8 138.8 121.4 139.3 127.1 140.8 133.6 141.9 163.4 149.2 190.1 156.5 218.4 165.2 219.4 165.2 220.4 163.3 222.4 156.7 223.2 152 224.3 150.1 229.7 131.3 241.1 83.3 245 59.8 247.2 37.2 247 19.3 246.5 13.6 245.1 6.1 246.2 5.2 246 2.4 249.4 1.9 250.4 2.8 252.2 2.8 253.2 3.8 256 3.8 256.9 4.7 258.8 4.7 259.8 5.6 262.6 5.7 263.5 6.6 265.2 7.1 265.2 8 264.3 8.9 264.3 10.8 263.4 11.8 263.4 12.7 289.6 33.4 299.7 41.9 301.2 43.8 294.6 39.4 281.4 29.8 280.5 28.7 263.5 16.8 262.9 17.4 261.9 37.2 260.1 52.2 266.3 57.9 289.9 77.3 290.8 78.5 301.8 88 303.1 88.5 303.4 88 305.1 72.9 306.4 52.2 306.4 33.4 307.4 32.5 307.4 31.5 309.3 29.6 309.6 28.4 310.6 29.2 311.5 29.2 313.4 31.1 314.4 31.1 316.2 32.9 317.2 32.9 320 35.8 320.9 35.8 323.8 38.6 324.7 38.6 328.3 41.9 325.5 44.7 325.5 45.6 324.6 46.6 323.6 58.8 324 60.7 324.7 61.4 355.8 85.1 365.2 92.9 366.1 93.5 368.9 91.6 369.9 92.3 370.8 90.7 374.1 93.6 374.1 94.6 375 95.5 375 96.5 376.9 98.4 376.9 99.3 377.9 100.2 377.9 101.2 378.8 102.1 378.8 103.1 379.7 104 379.7 104.9 381.5 106.8 381.2 108.2 379.3 110.1 378.4 110.1 377.4 111.1 376.5 111.1 351.2 87.1 323.8 62.8 323.2 63.5 321 80.5 317.1 101.2 318.3 103.1 331.5 115.3 346.6 130.4 365.2 150.3 374.6 161.3 385.9 175.8 397.2 192.5 402.8 192.5 403.2 193.4 403.3 199.1 404.2 200 403.3 200.9 403.3 218.8 402.3 219.8 402.1 224.5 401.9 225 400.9 225 400 224.1 396.2 224.1 393.6 216.9 386.2 201.9 376.8 186.8 366.3 171.8 355 156.7 336.3 134.1 318.1 113.5 315.3 111.1 305.3 150.1 296.2 179.3 313.1 188.7 312.5 189.2 311.5 189 297.4 183 295.5 182.6 294.3 184.9 289.9 199.1 285.9 209.4 279.5 228.4 280.5 229.4 298.4 236.7 320 245.1 320.9 245 346.5 216 349.6 212.2 349.6 211.3 345.4 209.3 309.6 196.4 308.7 195.7 306.8 195.4 306.8 195 308.7 194.9 321.9 198.8 352 208.5 352.9 208.2 354.5 206.6 360.1 200 362.4 198 362.5 199.1 355.4 209.4 355.8 209.8 383.9 220.7 395.3 226.6 399.1 227 400 227.6 400.9 227.6 401.3 228.2 400.9 229.2 399.1 229.2 398.1 228.2 395.3 228.2 393.4 227.6 370.8 218.8 368 218.1 353.9 212.7 352.9 212.7 340.7 226.7 324.1 244.2 323 246.1 345.4 253.4 364.2 257.6 374.6 258.1 382.1 257.7 385.9 256.8 389.6 255.3 390.6 255.3 391.5 256.2 394.4 256.2 395.5 257.4 394.8 258.4 394.8 261.2 393.9 262.1 393.9 264 392.9 264.9 392.9 266.8 391.1 269.6 391.1 271.5 390.1 272.5 390.1 274.4 388.2 277.2 388.2 279.1 387.3 280 387.3 280.9 386.4 281.9 386.4 282.8 384.5 285.6 384.5 287.5 382.6 290.4 382.6 291.3 381.6 292.2 381.6 293.2 379.8 295.1 379.8 296 378.8 296.9 378.8 297.9 377.9 298.8 377.9 299.8 376.9 300.7 376.9 301.6 375.5 302.7 374.6 302.7 372.7 300.8 371.8 300.8 369.9 299.5 339.8 288.3 311.5 278.8 298.4 274.8 295.4 274.4 261.9 310.1 240.6 331.8 223.7 374.1 218.6 385.4 211.9 397.6 211.9 403.3 210.8 403.7 209.7 403.3 209.7 397.6 233.4 342.8 235.2 338.4 234.4 337.6 219.7 351.5 197.6 370.6 180.7 383.9 165 394.8 165 396.7 164.1 397.6 164.1 400.5 163.8 400.7 162.8 400 159.1 400 158.1 399.1 155.3 399.1 154.4 398.1 150.6 398.1 149.6 397.2 147.8 397.2 146.8 396.2 144 396.2 143.1 395.3 141.2 395.3 140.2 394.3 137.4 394.3 136.5 393.4 134.6 393.4 133.6 392.5 131.8 392.5 130.4 391.1 130.4 390.1 131.2 389.2 131.3 387.3 132.1 386.4 132.7 384.1 137.6 374.1 144.2 359.1 146.4 352.5 133.6 341.1 104.5 317.2 103.3 317.6 98.7 328 89.4 352.9 87.1 362.8 84.2 365.6 84.3 366.6 82.8 366.9 80 364.2 79.1 364.2 76.2 361.4 75.3 361.4 72.5 358.6 71.5 358.6 66.6 353.4 71.5 347.8 82.7 328.9 92.9 310.1 93.3 309.2 92.9 308.2 84.7 301.7 62.1 285.2 28.2 262 8.5 249.7 7.5 249.7 6.6 250.7 3.8 250.7 2.8 251.2 2.5 250.8 2.4 248 1.4 247.1 1.4 244.2 0.5 243.3 0.5 239.5 -0.5 238.6 -0.5 233.9 -1.4 232.9 -1.4 228.2 -2.4 227.3 -2 219.8 -0.9 218.6 2.8 218.6 11.8 227.3 36.7 248.3 99.8 295.8 101.7 293.2 107.6 280.9 107.4 279.1 89.5 262.1 69.6 244.6 54.6 231.9 37.9 218.8 3.8 194.1 2.8 193.7 -2.8 193.7 -3.3 191.5 -3.3 181.2 -2.4 180.2 -2 172.7 0 172.6 0.9 173.5 3.9 173.6 14.1 183.6 25.4 193.7 84.7 242.8 96 253.4 103.5 261.2 107.5 265.9 111.1 271.2 112 271 112.9 269.6 124.2 243.9 135.5 215.4 140.9 200 142.1 198.4 142.7 199.1 143.5 200 144.9 203.8 145.2 212.2 143 223.5 140.8 231.1 136.8 242.4 132.2 253.6 109.9 302.6 110.1 303.8 123.5 314.8 136.2 326.1 145.2 335.5 150.6 342.6 152.8 338.4 161.5 315.8 161.7 314.8 160.9 314.1 157.2 320.2 156.2 321 156.2 319.5 171.6 287.5 177 272.5 183.9 249.9 184.5 249.4 185.4 249.8 187.2 252.7 188.3 253.6 189 262.1 188.5 273.4 186.6 283.8 179.2 308.2 167.8 338.4 149.6 382.6 147.5 388.2 147.8 389.1 160 382 175.1 372.2 193.6 359.1 208.6 347.8 240.9 321.5 243 319.5 245 315.8 245.6 313.3 246.2 313.9 245.7 315.8 246.6 316.5 249.4 314.3 271.1 295.2 293.6 274.4 293.6 273.4 288 271.5 267.3 265.7 265.4 265.6 263.4 269.6 260 279.1 254.1 292.8 253.9 291.3 254.1 290.6 255 290.4 254.8 288.5 260.9 269.6 262.1 264.9 261.6 264.2 257.9 263 247.5 260.6 246.8 259.3 250.4 257 253.2 255.9 258.8 254.6 265.4 254.1 270.1 237.6 265.4 235.3 246.6 228 220.2 218.5 207.1 214.4 206.1 214.5 205.6 215.1 197.6 232.6 197.2 232 197.5 231.1 203.5 214.1 202.4 212.8 192.9 209.9 191.6 208.5 196.7 206 201.4 205.3 206.1 205.2 206.9 204.7 216.5 175.6 217.3 172.7 217 171.8 216.5 171.4 202.3 168 152.5 158.4 115.8 152.8 103.5 151.4 95.1 154 89.4 154.1 89.2 152.9 90.8 151.1 90.8 150.1 85.6 149.1 69.6 148 47.1 147.2 25.4 148.1 15 149.2 8.5 150.4 7.5 150.4 6.6 149.5 3.8 149.5 3.4 149.2 3.3 145.4 4.2 144.5 4.2 142.6 5.2 141.6 5.2 138.8 6.1 137.9 6.1 136 7.1 135.1 7.1 133.2 9 130.4 9.2 128.5 10.4 128 11.3 128 14.1 129.9 39.5 129.5 64.9 130.8 81.9 132.7 103.5 135.9 105.4 135.8 115.1 125.6 115.7 124.7 114.8 123.4 81.9 117 80 117 75.3 118.6 70.6 118.9 69.3 118.1 70.3 116.2 70 115.3 68.7 115 54.6 113.3 39.5 112 22.6 111.6 21.6 110.7 20.7 110.7 19.8 109.8 18.8 109.8 17.8 108.7 18.4 107.8 18.4 106.8 20.2 104.9 20.2 104 21.2 103.1 21.2 102.1 22.1 101.2 22.1 100.2 23.1 99.3 23.1 98.4 24.9 96.5 24.9 95.5 25.4 95.1 27.3 94.5 29.2 96.4 30.1 96.4 31.1 97.3 39.5 97.9 56.5 100.1 79.1 104.4 82.8 104.5 84.7 103.3 114.8 72.4 127.9 57.9 147.2 35.3 159.3 20.2 171.1 4.2 171.1 1.4 170.2 0.5 170.2 -1.4 171.3 -1.8 176 -1.9 176.9 -2.8 185.4 -2.8ZM197.6 3.2 191.1 8.1 190.1 9.4 184.8 13.6 176 22.1 160.9 37.8 115.3 88 103.5 99.7 95.4 106.8 95.3 107.8 96.9 108.5 122.4 115.5 124.2 115.5 125.5 114.4 145.2 91.8 163.8 69 189.4 35.3 197.6 23.9 204.2 13.8 205.4 12.7 206.8 9.9 200 4.2ZM264.9 10.8 265.4 10.5 265.7 10.8 265.4 12ZM259.8 54.8 254.6 80.5 248.7 103.1 239.1 132.7 226 167.1 228.7 168.5 252.2 176 281.4 186.3 283.3 186.6 284.2 185.1 285.4 180.2 285.6 178.4 285.2 177.9 261.6 167.6 248.5 162.4 246.4 161.4 246.1 160.5 267.3 167.7 286.1 175.1 287.5 171.8 294 142.6 301.2 103.1 301.8 96.5 299.6 93.6 281.4 75 280.7 73.9 277.6 71.3 261.5 55.1 260.7 54.4ZM224 173.2 223.3 173.6 221.6 178.4 220.8 179.3 218.5 185.9 211.3 201.9 210.2 204.7 210.3 205.6 225.9 209.1 239.1 213.3 273.1 226.4 274.3 223.5 280.5 200.7 281.8 194.4 282.6 192.5 283.1 187.8 250.4 179.1ZM274.8 240.4 269.8 253.6 270.3 254.6 284.2 257 297.4 260.1 310.6 263.9 333.2 271.2 350.1 277.4 351.1 277.6 351.8 277.2 342.4 271.5 324.5 262.1 313.4 256.9 311.5 256.4 310.6 255.4 301.2 250.8 277.6 240.4 275.8 239.7ZM161.9 312.5 161.5 313.9 161.9 314.4 162.2 312.9Z";
const IDX_WORD = "M21.3 466.4 25.4 465.8 63.1 465.8 64.6 466.4 62.7 467.3 60.2 469.7 57.2 474.8 55.2 482.4 54.9 492.7 55.1 603.8 57.4 613.2 60.5 617.9 64.3 620.7 63.1 621.3 22.6 621.3 21.6 620.7 25.3 617.9 28.7 612.2 30 608.5 31.2 600 31.2 494.6 31 485.2 28.7 474.8 25.4 469.5ZM77.8 466.4 80 465.8 143.1 465.8 160 468 167.5 469.9 183.5 476.5 190.1 480.3 199.5 487.9 203.2 491.8 211.1 502.1 215.3 510.6 218.5 520 220.6 531.3 220.6 552.9 219.6 559.5 217.4 568 211.1 582.1 205.2 590.4 194.8 601 182.6 609.6 176.9 612.4 165.6 616.8 152.5 620.1 142.1 621.2 78.1 621.2 77.8 620.7 82.3 616 85 611.3 87 604.7 87.7 596.2 87.7 494.6 87 480.5 85.8 475.8 83.5 471.1 80.9 468.2ZM238 466.4 240 465.8 265.4 465.9 272 468.9 280.5 476.8 289 488 308.7 520.4 310.7 519.1 324.7 500.8 333.3 488 338.2 478.6 339.5 474.8 339.4 472 338.5 470.1 336.9 468.2 335.1 467.2 331.5 466.4 336.9 465.8 370.8 465.8 371.8 466.3 320 534.9 319.8 536 346.1 578.4 359.5 597.2 372.7 612.5 378.6 617.9 383 620.7 381.2 621.2 354.8 621.1 351.1 620 346.5 616.9 341.6 610.8 304 554 296.2 563.3 275.5 590.6 268.7 600.9 265.3 607.5 264.4 611.3 265.1 615.1 267.5 617.9 272 620.8 268.2 621.3 228.7 621.3 228.2 620.7 291.6 539.8 292.4 537.9 269.2 501.4 260.9 489.9 250.4 477.2 242.8 469.8ZM122.4 483.3 112 484.8 111 486.1 111 601.9 112 603.1 123.3 604.4 137.4 604.3 149.6 602.3 160 599 172.2 592 179.8 585.5 187.4 575.5 190.2 569.9 192.4 563.3 194.5 552 194.5 536.9 192.4 523.8 188.5 512.5 182.7 503.1 175.1 495.2 168.5 490.7 160 486.7 147.8 483.6 134.6 482.5ZM127.1 683.8 131.8 683.6 138.4 684.3 141.2 685.2 141.9 686.6 141.8 692.2 141.2 693.1 136.5 690 131.8 688.9 125.2 689.5 122.4 690.9 120.3 693.2 119.7 696 120.4 698.8 124.2 702.8 138.4 710 143.1 713.7 146.1 718.6 146.2 723.3 144.9 726.7 142.7 729.9 136.5 734.6 129.9 736.7 121.4 736.9 112 734.6 110.1 726.1 117.6 730.1 122.4 731.4 127.1 731.9 129.9 731.4 134.6 729.2 136.5 727.3 137.9 724.2 137.6 721.4 135 717.6 130.8 714.7 117.6 707.9 113.9 704.5 111.8 700.7 111.3 696.9 111.8 693.2 114 689.4 117.2 686.6 119.5 685.4 122.4 684.4ZM-222.3 684.7 -211.5 684.7 -211.4 685.6 -213.1 689.4 -213.3 695.1 -213.2 730.8 -211.8 734.5 -210.7 735.5 -211.8 735.9 -222.1 736 -223.4 735.5 -221.7 732.7 -220.9 728 -220.9 694.1 -221.7 687.5 -222.9 685.6ZM-136.4 684.7 -132.7 684.7 -128.9 683.9 -128.3 684.7 -128.3 731.8 -126.2 735.5 -128 736 -134.8 735.5 -134.4 719.5 -135.9 712 -138.4 707.5 -141.2 705.1 -146.8 704 -151.5 705.3 -155.5 709.2 -157.2 712.9 -157.7 715.8 -156.9 722.4 -154.4 726.8 -149.6 730.6 -145.9 731.9 -142.1 731.9 -139.3 730.6 -138.9 731.8 -142.1 736.1 -145.9 736.8 -152.5 735.9 -155.3 734.8 -159.7 731.8 -163.1 727.1 -164.3 724.2 -165.2 718.6 -164.3 712 -162 707.3 -159.7 704.5 -157.2 702.3 -152.5 699.9 -147.8 699.3 -143.1 699.7 -135.5 703 -135 701.6 -135 691.3 -135.4 688.5 -136.8 685.6ZM257.3 684.7 264.5 683.9 264.9 684.7 264.9 728 265.2 732.7 267.1 735.5 266.4 735.9 256 735.5 257.7 732.7 258 728.9 258 691.3 257.8 688.5 256.5 685.6ZM316.2 684.7 336.9 684.2 343.1 684.7 343.2 691.3 342.6 692.2 338.8 690.6 334.1 690.1 326.6 690.6 326.1 691.3 326.1 704.5 326.6 705.3 337.9 705 338.6 705.4 338.7 708.2 338.7 711.1 337.9 712.1 333.2 710.8 326.3 711.1 326.1 728.9 326.6 729.6 338.8 730.6 344.5 729.4 349.2 726.7 349.7 727.1 349.5 728 346.4 735.9 317.2 735.9 315.7 735.5 317.7 732.7 318.5 728 318.4 691.3ZM431 684.7 438.6 684.1 439.2 684.7 439.5 703.6 445.2 700.2 449.9 699.3 456.5 700 461.4 703.5 462.5 705.4 463.7 710.1 463.8 729.9 464.5 732.7 466.1 735.5 456.5 736 455 735.5 456.4 733.6 457.3 729.9 457.3 716.7 456.6 710.1 454.5 706.4 449.9 704 446.1 704.1 443.3 705.1 441.7 706.4 440.1 709.2 439.2 713.9 439.1 728.9 440.3 733.6 441.6 735.5 440.5 735.9 430.3 735.5 432.6 730.8 432.6 690.4 432.4 688.5 430.8 685.6ZM38.7 686.6 41.4 686 43.3 686.3 45.4 688.5 45.5 692.2 44 694.1 40.5 694.9 38.6 694.4 37.5 693.2 36.5 691.3 36.4 689.4ZM158.9 688.5 160 688.4 160.5 689.4 160.9 700 170.4 699.8 170.9 700.7 170.9 705.4 170.4 705.9 167.5 705.1 160.6 705.4 160.7 726.1 161.9 728.7 163.8 730.8 166.6 732 169.4 731.6 169.8 732.7 167.5 735.8 164.7 736.8 160 735.9 156.6 732.7 155 729.9 153.3 721.4 153.8 705.4 148.6 704.5 149.6 702.3 151.8 701.6 155.3 698.5 157.4 694.1 157.7 689.4 158.1 688.5ZM-200.7 699.8 -196.4 699.8 -195.8 704.2 -194.8 704.1 -192.9 702.1 -190.1 700.3 -184.5 699.2 -178.8 700.1 -175.1 702.6 -173 705.4 -171.8 709.2 -171.6 729.9 -170.5 733.6 -169.2 735.5 -170.4 736 -180.6 735.5 -178.2 730.8 -178.4 712.9 -179.3 709.2 -181.1 706.4 -182.6 705.1 -186.4 704 -190.1 704.1 -192.9 705.4 -195.3 709.2 -196.1 713.9 -196.1 729.9 -195.1 733.6 -193.6 735.5 -196.7 735.9 -204.9 735.5 -202.8 731.8 -202.7 728.9 -202.8 704.5 -204.7 700.7 -203.3 699.9ZM-106.8 699.8 -101.6 699.3 -96.9 699.7 -91.3 702.1 -86.3 706.4 -82.6 713.9 -82.7 721.4 -85.8 728 -91.3 733.5 -96 735.8 -102.6 736.8 -108.2 736 -111.1 735 -116.7 731 -119.1 728 -120.9 724.2 -121.8 716.7 -120.8 712 -119 708.2 -117.8 706.4 -112.9 702.3ZM-72.8 699.8 -68.7 699.4 -67.8 704.6 -63.1 700.7 -57.4 699.3 -51.8 700 -47.5 702.6 -45.5 705.4 -44.5 708.2 -43.9 713.9 -44.2 728 -43.2 732.7 -41.6 735.5 -42.4 735.9 -52.8 735.5 -50.5 730.8 -50.7 712 -52 708.2 -53.6 706.2 -57.4 704.1 -61.2 704 -64.9 705.1 -66.9 707.3 -68.2 710.1 -68.2 731.8 -66.2 735.5 -68.7 735.9 -77.5 735.5 -75.6 732.7 -75.1 729.9 -75.1 706.4 -75.8 702.6 -77 700.7 -76.2 699.9ZM-23.7 699.8 -17.9 699.2 -13.2 699.8 -8.5 702 -5.6 704.5 -3.6 707.3 -2.1 710.1 -1 715.8 -1.9 716.4 -28.2 716.4 -29.2 717.6 -28.7 721.4 -27.6 724.2 -23.5 728.9 -16.9 731.8 -10.4 731.9 -5.6 730.5 -2.8 728.7 -2 728.9 -4.2 733.6 -5.6 735.1 -7.5 735.9 -15.1 736.8 -22.6 736 -30.1 732.1 -33.9 728.6 -36 725.2 -37.1 721.4 -37.2 717.6 -37.2 713.9 -36 710.1 -32 704.5 -27.3 701.2ZM13.1 699.8 17.9 699.2 26.4 699.8 27.1 701.6 27 705.4 26.4 705.9 20.7 704.1 15.1 704.1 11.3 705.8 10.6 708.2 11.6 710.1 14.1 712 23.5 715.5 27.7 717.6 30.2 720.5 31.3 723.3 31.1 727.9 28.2 732.1 21.6 735.8 15.1 736.8 7.5 736 4.7 735 2.4 728.9 2.8 728.4 8.5 730.9 12.2 731.8 18.8 731.9 23.3 729.9 24.6 728 24.8 726.1 22.8 723.3 19.6 721.4 8.5 716.8 4.5 712.9 4.3 706.4 5.3 704.5 7.5 702.2ZM42.4 699.8 44.2 699.3 44.8 700.7 44.9 730.8 45.8 733.6 47.3 735.5 36.7 735.9 35.9 735.5 38.1 731.8 38.3 728.9 38.3 706.4 38.1 704.5 36.3 700.7 36.7 700.2ZM61 699.8 65.9 699.2 71.5 699.7 75.8 701.6 78.6 704.5 79.6 706.4 80.2 711.1 80 725.4 81.5 728.9 86.2 732.7 83.8 736.1 82.8 736.7 78.1 735.7 75.2 733.6 73.8 730.8 73.7 717.6 72.5 716.5 62.1 720 60.2 721 58.2 723.3 58.2 728 60.2 730.1 64 731.9 70.6 731.5 70.3 732.7 67.8 735.9 63.1 736.8 58.4 736 55.5 734.6 52.5 731.8 51 728.9 50.6 726.1 51 722.4 52.6 719.5 57.4 716.5 70.6 713.1 73.5 710.1 73.6 708.2 72.6 706.4 67.8 704.1 63.1 704.3 57.4 706.1 56.9 705.4ZM190.1 699.8 198.6 699.5 205.2 702.1 210 706.4 213.1 712.9 213.2 721.4 211.1 727.1 208.1 730.8 205.2 733.4 199.5 736 192.9 736.8 187.3 735.9 184.5 734.6 181.6 732.9 177.9 729 175.3 724.2 174.4 718.6 174.6 715.8 175.4 712 177.8 707.3 183.5 702ZM232.9 699.8 239.1 699.2 245.6 699.8 246.6 700.7 246.8 706.4 245.6 706.9 242.8 705 238.1 704 234.4 704.2 229.6 706.3 226.6 709.2 224.7 712.9 224.4 716.7 224.9 721.4 226.8 725 229.6 728.1 236.2 731.5 243.8 731.8 250.4 729.3 250.4 730.8 248.3 734.6 245.6 735.9 237.2 736.8 230.6 735.8 227.8 734.6 224 732.4 221.2 729.8 217.7 724.2 216.9 718.6 217.4 714.8 217.6 712.9 219.8 708.2 223.1 704.3 225.9 702.4ZM408.7 699.8 416 699.3 422.6 700.3 423 706.4 421.6 706.7 419.8 705.3 416.9 704.3 413.2 704 409.4 704.6 405.6 706.4 402.8 709.3 400.8 712.9 400.7 720.5 403 725.2 405.6 728 409.4 730.5 414.1 731.8 418.8 731.9 427.3 728.9 424.4 734.6 422.6 735.6 414.1 736.8 406.6 735.7 401.9 733.6 399.1 731.5 394.7 726.1 393.6 723.3 393.1 718.6 393.5 713.9 394.9 710.1 397.3 706.4 400 703.8 403.8 701.5ZM478.4 699.8 483.8 699.3 489.4 699.8 492.2 701 495.9 704.5 496.9 706.4 497.5 711.1 497.3 725.2 499.4 729.9 502.8 731.8 503.3 732.7 500.7 736.3 499.8 736.7 496 735.9 493.4 734.6 491.8 732.7 490.8 729.9 490.4 716.5 479.1 720.1 477.2 721.1 475.5 723.3 475.3 727.1 477.2 730 481.9 731.9 488 731.8 484.7 736 480.9 736.8 475.3 735.9 471.5 733.6 469.2 730.8 468.1 728 468 723.3 469.6 719.7 472.1 717.6 475.3 716.3 485.6 714.1 489.4 712.1 490.7 710.1 490.8 708.2 489.8 706.4 485.6 704.2 480.9 704.1 474.4 706.1 474.4 705ZM512.2 699.8 514.8 699.4 515.5 699.8 515.6 703.5 515.8 704.3 516.7 704.4 519.6 701.6 522.4 700 527.1 699.3 532.7 700 535.5 701.5 537.6 703.5 539.5 706.4 540.4 711.1 540.6 730.8 542.7 735.5 535.5 736 531.4 735.5 533.2 732.7 533.8 728.9 533.8 717.6 533.1 710.1 530.8 706.2 527.1 704.3 525.2 704 522.4 704 519 705.4 516.8 708.2 515.9 711.1 515.7 729.9 516.4 732.7 518.1 735.5 508.2 735.9 506.9 735.5 508.3 733.6 509.4 728.9 509.4 706.4 508.3 702.6 507.1 700.7 508.2 700ZM561.6 699.8 566.6 699.2 586.4 699.1 588.3 699.8 587.4 702.6 585.4 704.7 579.8 704 577.4 704.5 580.2 707.3 582 711.1 581.8 716.7 579.3 720.5 574.1 723.7 564.7 726 563 727.1 563 728 563.8 728.6 565.6 729 576 729.7 579.8 730.9 584.5 733.5 586.9 736.5 587.5 741.2 586.9 744.9 585.4 747.3 580.7 750.9 574.1 753.4 560 753.7 555.3 752.6 549.6 750.1 547.8 748.7 545.9 746.6 545.1 744 545.6 740.2 547.4 738.4 549.6 737.2 553.4 737 555 737.4 554 739.3 553.9 744 555.3 746.3 559.1 748.3 563.8 749.2 570.4 749 576 747.3 579.5 744 580.2 741.2 579.8 739.1 576.9 735.9 571.3 734.1 559.1 733.9 555.9 732.7 554.1 730.8 554.1 727.1 558.8 724.2 555.3 722.5 550.8 717.6 549.7 714.8 549.9 709.2 551 706.4 553.5 703.5 558.1 700.6ZM603.7 699.8 608.9 699.3 613.6 699.7 619.3 702.3 623.3 706.4 624.3 708.2 626.3 715.8 624.9 716.4 598.6 716.5 598 717.6 598.3 720.5 599.7 724.2 603.3 728.6 609.9 731.8 617.4 731.7 621.2 730.7 624.9 728.6 625 729.9 622.1 734.8 619.3 736 611.8 736.8 604.2 735.8 597.6 732.6 593.9 728.9 591.4 725.2 590.2 721.4 590 717.6 590.1 713.9 591.3 710.1 593.6 706.4 597.6 702.4ZM276.3 700.7 276.7 700.1 279.5 700.1 285.2 700.2 285.9 700.7 274.8 714 274.4 715.8 283.8 728 290.6 735.5 289.9 735.8 284.2 735.6 281.4 734.7 279.5 733.2 267.2 716.7 267.5 714.8 272.9 709.2 276.3 704.5 276.7 702.6ZM355.2 700.7 355.8 700.1 358.6 700.2 363.3 701 367.1 704.1 372 711.1 373.6 712.1 379.5 704.5 379.7 700.7 380.2 700.2 389.6 700.5 376.5 716.7 383.1 726.2 391.6 735.5 384.9 735.9 381.5 734.6 378.6 731.8 371.8 722.1 370.8 722.3 363 731.8 362.5 733.6 363.3 735.6 353.9 736 352.4 735.5 366.4 719.5 368.2 716.7 362.4 708.7ZM-105.4 704.3 -108.2 705.4 -110.6 707.3 -113.5 712 -114.5 716.7 -113.6 722.4 -111.3 727.1 -109.2 729.3 -104.5 731.8 -99.8 731.9 -94.2 728.9 -91.3 725.2 -90 721.4 -90.1 715.8 -92.1 710.1 -95.3 706.4 -99.8 704.2ZM-21.6 704.2 -24.5 705.4 -27.5 708.2 -28.8 711.1 -28.2 712.3 -9.2 712 -9.2 710.1 -10.4 707.9 -13.2 705.1 -16.9 704.1ZM191.1 704.2 186.6 706.4 183.3 710.1 182.2 712.9 181.8 716.7 182.4 722.4 184.5 726.4 188.2 730.2 192 731.8 196.7 731.7 200.5 730.2 204.4 726.1 206 721.4 205.6 713.9 204.5 711.1 200.5 706 195.8 704.1ZM561.9 704.4 558.6 706.4 557 709.2 557 712.9 558.2 715.8 560.9 718.7 563.8 720.2 568.5 720.4 571.3 719.2 573.2 717.5 574.5 714.8 574.5 710.1 573.2 707.8 570.4 705.3 567.5 704.2ZM605.2 704.3 600.5 707.4 598.6 710.3 598.6 712 617.8 712 618 710.1 615.5 706.2 611.8 704.3ZM109.7 776 114.8 775.4 119.4 776 114.8 781.2 112 780.3 108.2 780.7 107.1 781.6 105.8 784.5 105.4 787.3 105.9 792 108.2 792.5 115.8 792.1 116.1 797.6 106.4 797.1 105.7 797.6 105.8 823.1 108 827.8 106.4 828.2 96.9 828.1 96.5 827.8 98.3 824.9 98.7 821.2 98.7 798.6 97.9 797.2 95.6 796.7 98.3 792.9 99.5 784.5 100.7 781.6 104.5 777.7ZM60 776.9 79.1 776.4 85 776.9 84.7 784.7 80 782.7 77.2 782.5 68.7 782.6 67.5 783.5 67.8 797.3 79.1 797.1 80.2 797.6 80.4 798.6 80 804.1 74.4 803.1 67.8 803.4 67.4 821.2 75.3 822.5 80.9 822.7 85.6 821.8 90.4 819.1 91.2 820.2 88.5 827.8 59.3 828.2 57.3 827.8 58.8 825.9 60 821.2 60 784.5 59.1 779.8 57.9 777.9 58.4 777ZM167.9 776.9 171.3 776.4 171.8 776.9 171.7 819.3 172 824.9 174.2 827.8 173.2 828.2 163.8 828.3 162.7 827.8 164.7 824 164.8 819.3 164.8 781.6 163.1 777.9 163.8 777.2ZM335.4 776.9 337.9 776.4 338.8 776.9 339 823.1 339.7 825.9 341.1 827.8 338.8 828.2 332.5 827.8 332.8 813.6 332.4 807.1 331.2 803.3 329.6 800.5 327.5 798.3 325.6 797.2 320.9 796.2 316.2 797.3 311.3 802.4 309.9 806.1 309.9 812.7 312.5 818.6 317.2 822.6 321.9 824 325.6 823.9 328.5 823 328.5 824 325.6 828.2 323.8 828.9 320.9 829.1 314.4 828 308.7 824.8 303.6 818.4 302.5 814.6 302.4 810.8 302.5 806.1 303.8 802.4 307.8 796.5 310.6 794.3 315.3 791.9 324.7 791.9 331.3 795.3 332.2 795.1 332.4 781.6 330.5 777.9 331.3 777.2ZM-159.7 777.9 -159.1 777 -137.4 777.5 -133.6 778.5 -128.7 782.6 -127.4 785.4 -127.5 791.1 -130.6 795.8 -133.7 797.6 -133.9 798.6 -128 801.3 -124.8 804.2 -123.1 807.1 -122 811.8 -123.3 818.1 -126.1 822 -128.7 824 -132.7 826.1 -141.2 828 -158.1 828.2 -160.4 827.8 -158.6 824.9 -157.7 819.3 -157.7 785.4 -158.5 779.8ZM242.1 777.9 242.8 777.1 252.2 777 253.2 777.1 253.6 777.9 251.8 781.6 251.7 784.5 251.7 822.1 252.7 825.9 254.3 827.8 253.2 828.2 242.8 828.2 241.4 827.8 243 825.9 244.2 818.4 244.1 783.5 243.3 779.8ZM511.8 778.8 513.9 778.3 516.7 778.6 518.6 780.7 518.7 784.5 516.7 786.7 513.9 787.4 512 786.7 510.6 785.4 509.9 781.6ZM-147.8 781.6 -149.6 781.8 -150.2 783.5 -149.8 797.6 -143.1 797.1 -139.3 796 -135.5 791.9 -135.3 787.3 -136.3 785.4 -138.4 783.4 -141.2 781.9ZM-111.5 792 -110.1 791.8 -109.3 792.9 -109.4 811.8 -108.3 818.4 -104.5 822.4 -100.7 823.4 -96.9 822.7 -94.6 821.2 -92.2 818.4 -91.2 814.6 -91.2 797.6 -93 792.9 -92.2 792.4 -85.3 792 -84.6 792.9 -84.6 823.1 -83.7 825.9 -82.2 827.8 -90.4 828.2 -91.1 827.8 -91.3 823.8 -96.9 827.8 -101.6 829.1 -108.2 828.1 -111.7 825.9 -114.7 820.2 -115.7 813.6 -116.1 796.7 -117.7 792.9ZM-69.8 792 -68.7 791.9 -67.8 792.7 -67.8 796.1 -66.8 796.2 -65 793.9 -62.1 792.1 -56.5 791.7 -55.8 792.9 -56 797.6 -56.5 798.1 -60.2 797.2 -63.1 798.1 -65.3 799.5 -67 802.4 -67.8 808.9 -67.8 821.2 -67 825.9 -65.5 827.8 -66.8 828.2 -75.3 828.2 -76.6 827.8 -74.5 823.1 -74.5 796.7 -76 792.9ZM-40.9 792 -34.8 791.5 -27.3 792.3 -26.7 793.9 -26.8 797.6 -27.3 798.2 -32.9 796.4 -38.6 796.3 -42.4 798.1 -43.3 800.5 -42.4 802.2 -40.5 803.7 -26.4 809.8 -24.1 811.8 -22.6 815.5 -22.9 820.2 -26.3 824.9 -32 828 -38.6 829.2 -46.1 828.2 -48.9 827.2 -51.3 822.1 -50.8 820.6 -42.4 823.8 -34.8 824 -31.1 822.6 -29.2 820.2 -29.1 818.4 -31.1 815.5 -35.8 812.8 -45.2 809.3 -47.1 807.9 -49.1 805.2 -49.8 801.4 -49.4 798.6 -48.5 796.7 -45.2 793.7ZM-9.5 792 -4.7 791.5 1.9 792 5.6 794 8.3 796.7 9.4 799.1 10 804.2 9.8 818.4 12 822.1 15.3 824 15.8 824.9 13.2 829 7.6 827.8 4.3 824.9 3.2 822.1 3.3 809.9 2.8 808.9 -7.5 811.7 -11.3 814.4 -12.3 816.5 -12.4 819.3 -9.4 822.8 -6.6 824 0.2 824 -2.8 828.2 -7.5 829.1 -12.2 828.1 -16 826.1 -18.4 823.1 -19.3 821.2 -19.5 815.5 -18.9 813.6 -16.9 811 -12.2 808.6 -5.6 807.4 0 805.4 1.9 804.2 3.2 802.4 3.2 800.5 1.9 798.3 -2.8 796.3 -6.6 796.4 -13.3 798.6 -13.6 797.6ZM134.7 792 144.9 791.9 149.6 794.4 152.3 796.7 154.9 800.5 156.5 804.2 156.7 808 155.3 808.7 128.9 808.9 128.6 811.8 130.8 817.4 135.5 821.8 141.2 824 148.7 823.8 155.7 821.2 154.8 824 152.5 827.3 150.6 828.1 143.1 829.1 134.6 828 129.9 825.9 127.1 823.8 122.4 818.4 120.5 810.8 121.2 804.2 122.5 801.4 124.2 798.7 128 795.1 130.8 793.2ZM266.1 792 270.1 792 270.4 795.8 271.1 797 274.8 793.3 278.6 791.7 286.1 792 291.1 794.8 294.1 800.5 294.8 808 294.4 821.2 295.2 824.9 297.1 827.8 287.1 828.3 285.7 827.8 287.8 824 287.5 803.3 286.5 800.5 285 798.6 283.3 797.3 278.6 796.2 273.9 797.2 271.6 799.5 270.5 802.4 270.4 824 272.5 827.8 271.1 828.2 261.2 827.8 262.6 825.9 263.5 821.2 263.4 799.5 263 795.8 261.8 792.9 262.6 792.2ZM361.4 792 371.8 791.8 375.5 793.3 380.2 796.6 383 799.5 385.1 803.3 386.1 810.8 384.1 818.4 378.4 825 372.7 828 365.2 829.1 356.7 827 350.1 821.3 348.2 818.4 346.9 814.6 347.1 806.1 347.9 803.3 350.1 799.5 355.8 794.4ZM396.9 792 401 792 401.2 795.8 401.9 796.7 404.7 794.2 409.4 791.8 416.9 791.9 422.2 794.8 424.2 797.6 425.6 801.4 425.7 822.1 426.8 825.9 428.1 827.8 427.3 828.2 418.8 828.2 416.8 827.8 418.3 825.9 419.2 823.1 418.8 804.2 418.1 801.4 416 798.3 412.2 796.5 409.4 796.2 404.7 797.5 401.7 801.4 401.3 822.1 402.1 825.9 403.6 827.8 393.4 828.2 392.2 827.8 393.8 825.9 394.6 823.1 394.6 796.7 392.9 792.9ZM446.9 792 453.6 791.6 459.3 792.6 464.9 796.4 468 800.5 469.8 807.1 469.6 808.2 468.7 808.6 443.3 808.7 442.1 808.9 441.7 809.9 442.1 813.6 444.4 818.4 447.1 820.9 450.8 823 453.6 824.1 461.2 823.9 468.7 820.9 468.7 822 466.8 825.9 464 827.9 454.6 829.2 447.1 827.8 440.5 824.2 436.7 820.2 435 817.4 433.8 813.6 433.6 810.8 433.8 806.1 434.9 802.4 439.5 796.1ZM484.5 792 491.3 791.6 498.8 792.4 499.2 797.6 498.8 798.1 492.2 796.3 487.5 796.3 483.9 797.6 482.5 799.5 482.5 800.5 483.8 802.5 486.2 804.2 497.9 808.7 499.6 809.9 501.9 811.8 503.2 815.5 503 820.2 500.7 824 496 827.1 488.5 829.1 483.8 828.9 477.2 827.3 474.3 821.2 475.3 820.7 479.1 822.5 483.8 823.9 491.3 823.9 495.1 822.3 496.6 820.2 496.5 817.4 494.8 815.5 492.2 813.9 480.9 809.4 478.9 808 476.7 805.2 476.1 800.5 477.5 796.7 480 794.2ZM515.5 792 517.6 792 518.1 792.9 518.1 820.2 519 825.9 520.6 827.8 519.5 828.2 510.1 828.2 509.2 827.8 510.5 825.9 511.5 823.1 511.5 800.5 511.5 796.7 509.9 792.9ZM535.3 792 545.9 791.9 550.2 793.9 553 796.7 554.8 802.4 554.1 814.6 555.1 820.2 556.6 822.1 560.2 824 560.7 824.9 558.1 828.7 556.2 829 552.5 828 549.1 824.9 547.7 820.2 547.8 809.9 546.8 808.8 537.4 811.6 533.6 814.1 532.4 816.5 532.4 819.3 534.6 822.4 537.4 823.7 544.8 824 544.1 825.9 542.1 828.1 540.2 828.9 535.5 828.9 530 826.8 526.9 824 525 820.2 524.8 816.5 527 811.8 531.8 808.9 544.9 805.4 547.6 802.4 547.5 799.5 546.8 798.7 544.9 797.2 542.1 796.3 538.4 796.4 531.8 798.4 531.2 797.6ZM183.3 792.9 184.5 792.4 192 792.5 192.6 792.9 182.5 805.2 181.1 807.1 181.2 808 189.8 819.3 197.6 827.9 191.1 828 187.3 826.3 184.5 823.3 174.1 808.9 173.9 808 174.5 807.1 179 802.4 183.1 796.7ZM136.5 796.5 133.7 797.6 130.8 799.9 129.4 802.4 129.3 804.2 148.8 804.2 149.1 803.3 147.9 800.5 144.9 797.5 141.2 796.3ZM363.3 796.5 358.9 798.6 355.3 803.3 354.2 807.1 354.4 812.7 356.5 818.4 360.5 822.5 364.2 823.9 370.8 823.5 375.3 820.2 377.7 816.5 378.6 811.8 377.6 805.2 375.7 801.4 372.7 798.3 368 796.3ZM449.9 796.4 447.1 797.3 444.2 799.5 442.3 802.4 442.4 804.2 443.3 804.7 461.5 804.2 461.7 802.4 459.3 798.5 454.6 796.4ZM-148.7 802.3 -149.6 802.4 -150.1 803.3 -150.1 821.2 -149.6 821.8 -140.2 822.7 -133.6 820.4 -131.5 817.4 -130.3 813.6 -130.5 810.8 -132.7 806.4 -135.5 804.2 -139.3 802.6Z";
/* The globe itself is drawn by a few lines of WebGL: a ball that carries the logo's bands, seen straight on. Turning
   it about its leaning axis carries the bands round the ball like a real globe: they bunch up towards the rim, go
   round the back and come round again. At a turn of 0 it is exactly the flat logo, so the flat SVG can stand in for
   it until this is set up (and for good if WebGL is not there). It draws only the white bands; the red ball, the
   gloss and the shadow stay CSS. Returns { draw(turnInRadians), lose() } or null. */
const idxGlobeGL = (canvas) => {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, "attribute vec2 a; varying vec2 p; void main() { p = a; gl_Position = vec4(a, 0.0, 1.0); }"));
  // for each point of the disc: where it is on the ball, where that point was before the turn, and whether the logo has a band there
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `precision highp float;
    varying vec2 p; uniform sampler2D bands; uniform mat3 turn; uniform float px;
    void main() {
      vec2 q = p / 0.997;
      float r = length(q);
      vec3 was = turn * vec3(q, sqrt(max(0.0, 1.0 - r * r)));
      float a = texture2D(bands, vec2(was.x, -was.y) * 0.5 + 0.5).a * (1.0 - smoothstep(1.0 - px, 1.0, r));
      gl_FragColor = vec4(a);
    }`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  // the bands as a picture, painted from the same outline the flat logo uses
  const pic = document.createElement("canvas");
  pic.width = pic.height = 1024;
  const c = pic.getContext("2d");
  c.scale(2.56, 2.56);
  c.fillStyle = "#fff";
  c.fill(new Path2D(IDX_BANDS), "evenodd");
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pic);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");      // keeps the bands crisp where they bunch up at the rim
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(prog, "px"), 3 / canvas.width);
  const uTurn = gl.getUniformLocation(prog, "turn");
  const ax = Math.sin((IDX_TILT * Math.PI) / 180), ay = Math.cos((IDX_TILT * Math.PI) / 180);    // the axis, leaning to the right
  return {
    draw(angle) {
      // undo the turn: rotate by -angle about the axis (columns first, as WebGL wants them)
      const co = Math.cos(-angle), si = Math.sin(-angle), k = 1 - co;
      gl.uniformMatrix3fv(uTurn, false, [co + ax * ax * k, ax * ay * k, -ay * si, ax * ay * k, co + ay * ay * k, ax * si, ay * si, -ax * si, co]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    lose() { gl.getExtension("WEBGL_lose_context")?.loseContext(); },
  };
};
const IdxGlobe = memo(({ canvasRef, live, still }) => (
  <>
    <div className="idx-ground" />
    <div className={still ? "idx-float still" : "idx-float"}>
      <div className="idx-disc" />
      <svg className="idx-bands" style={live ? { visibility: "hidden" } : undefined} viewBox="0 0 400 400" aria-hidden="true">
        <defs><clipPath id="idxClip"><circle cx="200" cy="200" r="199.4" /></clipPath></defs>
        <path clipPath="url(#idxClip)" fill="#fff" fillRule="evenodd" d={IDX_BANDS} />
      </svg>
      <canvas ref={canvasRef} className="idx-gl" />
      <div className="idx-gloss" />
    </div>
    <svg className="idx-word" viewBox="0 0 400 400" aria-hidden="true"><path fill="#c9cdd2" fillRule="evenodd" d={IDX_WORD} /></svg>
  </>
));

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <g className="trash-lid">
      <line x1="2.2" y1="4.6" x2="13.8" y2="4.6" />
      <path d="M6 4.6 V3.4 Q6 2.6 6.8 2.6 H9.2 Q10 2.6 10 3.4 V4.6" />
    </g>
    <path d="M3.6 4.6 L4.6 13.6 Q4.7 14.2 5.3 14.2 H10.7 Q11.3 14.2 11.4 13.6 L12.4 4.6" />
    <line x1="6.4" y1="7.2" x2="6.6" y2="11.8" />
    <line x1="8" y1="7.2" x2="8" y2="11.8" />
    <line x1="9.6" y1="7.2" x2="9.4" y2="11.8" />
  </svg>
);

/* Defined outside the main component so React keeps the same DOM node
   across renders — otherwise the input loses focus while typing. */
const sanitizeAmount = (raw, allowDecimal, places = 2) => {
  if (!allowDecimal) {
    const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
    return isNaN(n) ? "" : n.toLocaleString("id-ID");
  }
  // MYR: digits with a single "." decimal, up to two places (`places`: three in the journal's Full TP % and Risk % boxes)
  let v = String(raw).replace(/,/g, ".").replace(/[^\d.]/g, "");
  const parts = v.split(".");
  v = parts.shift() + (parts.length ? "." + parts.join("").slice(0, places) : "");
  return v;
};

const AmountField = ({ value, setValue, onSubmit, accent, cur, ghost, width, allowDecimal }) => (
  <span style={{ position: "relative", display: "inline-block", width: width || 140 }}>
    <input
      className={`amt-field ${accent}`}
      style={{ ...S.darkInput, width: "100%" }}
      placeholder={`${cur} 0`}
      value={value}
      onChange={(e) => setValue(sanitizeAmount(e.target.value, allowDecimal))}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if (ghost) { setValue(parseNum(digitsOf(value) + "000").toLocaleString("id-ID")); return; }
        onSubmit();
      }}
      inputMode={allowDecimal ? "decimal" : "numeric"}
    />
    {ghost && (
      <span style={S.ghostOverlay} aria-hidden="true">
        <span style={{ visibility: "hidden" }}>{value}</span>
        <span style={{ color: "#6d757d" }}>.000</span>
      </span>
    )}
  </span>
);

/* A word that rolls over to the next one letter by letter. First the old word leaves, each letter just after the one
   before it, all of it gone within about RW_OUT_MS + RW_OUT_SPREAD_MS; only then does the new word arrive, each letter
   `step` ms after the letter before it. (Both at once had the two words lying on top of each other, which he didn't
   want.) up: they travel upwards, otherwise downwards. Nothing moves the first time it is shown. */
const RW_OUT_MS = 150, RW_OUT_SPREAD_MS = 130;
const RollWord = ({ text, up, step = 24 }) => {
  const [st, setSt] = useState({ now: text, old: null, id: 0 });
  if (st.now !== text) setSt({ now: text, old: st.now, id: st.id + 1 });
  const gone = st.old === null ? 0 : RW_OUT_MS + Math.min(step * (st.old.length - 1), RW_OUT_SPREAD_MS);      // when the old word has left
  const letters = (word, cls) => {
    const out = cls === "rw-out", each = out ? Math.min(step, RW_OUT_SPREAD_MS / Math.max(1, word.length - 1)) : step;
    return [...word].map((ch, i) => <span key={i} className={cls} style={{ animationDelay: `${Math.round((out ? 0 : gone) + i * each)}ms` }}>{ch}</span>);
  };
  return (
    <span className="rollw" style={{ "--ry": up ? "65%" : "-65%" }}>
      {st.old !== null && <span key={`o${st.id}`} className="rollw-old" aria-hidden="true">{letters(st.old, "rw-out")}</span>}
      <span key={`n${st.id}`}>{letters(st.now, st.id ? "rw-in" : "rw")}</span>
    </span>
  );
};

/* Quick add on the yearly panel: today's expense or income without opening the month and the day. One row, no list;
   anything added is edited on its date, as before. It keeps what is typed to itself, so a keystroke re-renders this
   box and nothing behind it. api.current.add(kind, amount as typed, description) files it and gives back the amount
   as the app writes it, or null when there is no amount. */
const QuickAdd = memo(({ api, cur, isMYR, boxRef }) => {
  const [kind, setKind] = useState("exp");
  const [amt, setAmt] = useState("");
  const [desc, setDesc] = useState("");
  const [done, setDone] = useState(null);          // the last thing added, shown for a moment: { id, kind, text }
  const amtRef = useRef(null);
  const inc = kind === "inc";
  const ghost = !isMYR && digitsOf(amt).length > 0 && digitsOf(amt).length < 4;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone((d) => (d && d.id === done.id ? null : d)), 2600);
    return () => clearTimeout(t);
  }, [done]);
  const submit = () => {
    const note = desc.trim(), shown = api.current.add(kind, amt, note);
    amtRef.current?.focus();
    if (!shown) return;
    setAmt(""); setDesc("");
    setDone({ id: Date.now(), kind, text: `${inc ? "+" : "−"}${shown}${note ? ` ${note}` : ""}` });
  };
  // + and − switch between income and expense from either box, so the hands can stay on the keys
  const onKey = (e, isAmt) => {
    if (e.key === "Escape") { e.target.blur(); return; }
    if (isAmt && (e.key === "+" || e.key === "=")) { e.preventDefault(); setKind("inc"); return; }
    if (isAmt && e.key === "-") { e.preventDefault(); setKind("exp"); return; }
    if (e.key !== "Enter") return;
    if (isAmt && ghost) { setAmt(parseNum(digitsOf(amt) + "000").toLocaleString("id-ID")); return; }
    submit();
  };
  return (
    <div ref={boxRef} className={`qadd glass-soft${inc ? " inc" : ""}`}>
      <button className="qadd-kind" onMouseDown={(e) => e.preventDefault()} onClick={() => setKind(inc ? "exp" : "inc")}
              title={inc ? "Income · click (or press −) for an expense" : "Expense · click (or press +) for income"}>
        <i /><RollWord text={inc ? "Income" : "Expense"} up={inc} />
      </button>
      <span className="qadd-amt">
        <input ref={amtRef} className={`amt-field ${inc ? "green" : "red"}`} style={S.darkInput} placeholder={`${cur} 0`} value={amt}
               inputMode={isMYR ? "decimal" : "numeric"} aria-label="Amount for today"
               onChange={(e) => setAmt(sanitizeAmount(e.target.value, isMYR))} onKeyDown={(e) => onKey(e, true)} />
        {ghost && (
          <span style={S.ghostOverlay} aria-hidden="true">
            <span style={{ visibility: "hidden" }}>{amt}</span>
            <span style={{ color: "#6d757d" }}>.000</span>
          </span>
        )}
      </span>
      {/* the grey hint is drawn over the empty box instead of being the box's own placeholder, so it can roll over
          with the rest when expense and income are switched */}
      <span className="qadd-descbox">
        <input className="desc-field qadd-desc" style={S.darkInput} value={desc} aria-label="Description"
               onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => onKey(e, false)} />
        {!desc && <span className="qadd-ph" aria-hidden="true"><RollWord text={inc ? "Today · salary, bonus" : "Today · lunch, fuel, coffee"} up={inc} step={9} /></span>}
      </span>
      {/* one button for both: red and green are two layers that cross-fade, and the upright of the + shrinks into the
          middle to leave the −, or grows back out of it */}
      <button className="draw-btn qadd-go" onMouseDown={(e) => e.preventDefault()} onClick={submit}
              title={inc ? "Add to today's income" : "Add to today's expenses"}>
        <i className="qg-red" /><i className="qg-green" />
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect className="pi-h" x="2.5" y="7" width="11" height="2" rx="1" fill="currentColor" />
          <rect className="qg-v" x="7" y="2.5" width="2" height="11" rx="1" fill="currentColor" />
        </svg>
      </button>
      {done && <span key={done.id} className={`qadd-done${done.kind === "inc" ? " inc" : ""}`}><span className="msym">check</span>{done.text}</span>}
    </div>
  );
});

/* Debts, a section of the Goals card: what he owes ("owe") and what others owe him ("owed"), each with how much of it
   has been paid back. Rows are the goals' own rows (name, paid / total, bar, a + that opens the amount box).
   It keeps what is typed to itself, so a keystroke re-renders this section and nothing behind it.
   api.current: { save(next list), fmt, fmtLive, toIDR(amount as typed) }. */
const cleanDebts = (list) => (Array.isArray(list) ? list : [])
  .filter((d) => d && typeof d === "object" && d.id && typeof d.name === "string" && Number(d.amount) > 0)
  .map((d) => {
    const amount = Math.min(Number(d.amount), MAX_AMOUNT);
    return { id: d.id, name: d.name.slice(0, 60), amount, paid: Math.min(amount, Math.max(0, Number(d.paid) || 0)), dir: d.dir === "owed" ? "owed" : "owe", ...(d.test && { test: true }) };
  });
const DEBT_KINDS = [
  { dir: "owe", label: "I owe", icon: "call_made", tone: "#e2808c", who: "Who I owe, e.g. Budi", pay: "I paid this much back", unpay: "Take a payment back" },
  { dir: "owed", label: "Owed to me", icon: "call_received", tone: "#8fd7a4", who: "Who owes me, e.g. Sari", pay: "They paid this much back", unpay: "Take a payment back" },
];
const Debts = memo(({ debts, api, cur, isMYR }) => {
  const [adding, setAdding] = useState(false);
  const [dir, setDir] = useState("owe");
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  const [payId, setPayId] = useState(null);         // the debt whose payment box is open
  const [payAmt, setPayAmt] = useState("");
  const [leaving, setLeaving] = useState(null);
  const { fmt, fmtLive, toIDR, save } = api.current;
  const ghostOf = (v) => !isMYR && digitsOf(v).length > 0 && digitsOf(v).length < 4;
  const add = () => {
    const who = name.trim(), amount = toIDR(amt);
    if (!who || !amount) return;
    save([...debts, { id: uid(), name: who, amount, paid: 0, dir }]);
    setName(""); setAmt(""); setAdding(false);
  };
  const pay = (id, sign) => {
    const by = toIDR(payAmt);
    if (!by) return;
    save(debts.map((d) => (d.id === id ? { ...d, paid: Math.min(d.amount, Math.max(0, d.paid + sign * by)) } : d)));
    setPayAmt("");
  };
  const remove = (id) => {
    setLeaving(id);
    setTimeout(() => { save(api.current.list().filter((d) => d.id !== id)); setLeaving(null); setPayId((p) => (p === id ? null : p)); }, 260);
  };
  const left = (kind) => debts.filter((d) => d.dir === kind).reduce((a, d) => a + d.amount - d.paid, 0);
  const kindNow = DEBT_KINDS.find((k) => k.dir === dir);
  return (
    <div className="debt-sec">
      <div style={S.flowHead}>
        <span style={S.sectionLabel}>Debts</span>
        {debts.length > 0 && (
          <span style={S.flowSub}>
            I owe <b style={{ color: "#e2808c" }}>{fmt(left("owe"))}</b>{" · "}owed to me <b style={{ color: "#8fd7a4" }}>{fmt(left("owed"))}</b>
          </span>
        )}
      </div>
      {debts.length === 0 && !adding && <div style={S.insEmpty}>No debts. Add what you owe someone, or what someone owes you.</div>}
      {DEBT_KINDS.map((k) => {
        const list = debts.filter((d) => d.dir === k.dir);
        return list.length === 0 ? null : (
          <div key={k.dir}>
            <div className="debt-group"><i style={{ background: k.tone }} />{k.label}</div>
            {list.map((d, i) => {
              const pct = (d.paid / d.amount) * 100, done = d.paid >= d.amount, open = payId === d.id;
              return (
                <div key={d.id} className={`goal-row${leaving === d.id ? " leaving" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div style={S.goalTop}>
                    <span style={{ ...S.goalName, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="msym" style={{ fontSize: 19, color: done ? "#8fd7a4" : k.tone }}>{k.icon}</span>
                      <span className={`debt-name${done ? " done" : ""}`}>{d.name}</span>
                      {done && <span className="msym" style={{ fontSize: 15, color: "#e6c877", marginLeft: -2 }}>check_circle</span>}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={S.goalAmt}>
                        <CountNum value={d.paid} duration={600} render={fmtLive} />
                        <span style={{ color: "#6d757d" }}> / {fmt(d.amount)}</span>
                      </span>
                      <button className="goal-icon-btn" title={open ? "Close" : "Record a payment"} onClick={() => { setPayId(open ? null : d.id); setPayAmt(""); }}>
                        <span className="msym" style={{ fontSize: 18, transform: open ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
                      </button>
                      <button className="trash-btn" style={{ ...S.delBtn, marginLeft: 2 }} title="Delete debt" onClick={() => remove(d.id)}><TrashIcon /></button>
                    </span>
                  </div>
                  <div style={S.goalBarRow}>
                    <GoalBar pct={pct} done={done} delay={120 + i * 60} />
                    <span style={{ ...S.goalPct, color: done ? "#8fd7a4" : "#c7cdd2" }}>
                      <CountNum value={Math.floor(pct)} duration={600} render={(n) => `${Math.round(n)}%`} />
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(0.4,0,0.2,1)" }}>
                    <div style={S.fold}>
                      <div style={{ ...S.goalFundRow, opacity: open ? 1 : 0, transition: "opacity .24s ease" }}>
                        <AmountField value={open ? payAmt : ""} setValue={setPayAmt} accent="green" cur={cur} width={150}
                                     ghost={open && ghostOf(payAmt)} allowDecimal={isMYR} onSubmit={() => pay(d.id, 1)} />
                        <button className="goal-io in" title={k.pay} onClick={() => pay(d.id, 1)}><span className="msym">download</span></button>
                        <button className="goal-io out" title={k.unpay} onClick={() => pay(d.id, -1)}><span className="msym">upload</span></button>
                        <span style={S.goalNote}>{done ? "Settled" : `${fmt(d.amount - d.paid)} left`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateRows: adding ? "1fr" : "0fr", transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={S.fold}>
          <div style={{ ...S.goalFundRow, paddingTop: 12, opacity: adding ? 1 : 0, transition: "opacity .24s ease" }}>
            <span className="wr-seg">
              {DEBT_KINDS.map((k) => <button key={k.dir} className={dir === k.dir ? "on" : ""} onClick={() => setDir(k.dir)}>{k.label}</button>)}
            </span>
            <input style={{ ...S.darkInput, width: 190 }} placeholder={kindNow.who} value={name}
                   onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <AmountField value={amt} setValue={setAmt} accent={dir === "owe" ? "red" : "green"} cur={cur} width={150}
                         ghost={ghostOf(amt)} allowDecimal={isMYR} onSubmit={add} />
            <button className="goal-save" onClick={add} title="Save debt" aria-label="Save debt"><span className="msym" style={{ fontSize: 22 }}>check</span></button>
          </div>
        </div>
      </div>
      <button className="goal-new" onClick={() => setAdding((v) => !v)}>
        <span className="msym" style={{ fontSize: 17, transform: adding ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
        {adding ? "Cancel" : "New debt"}
      </button>
    </div>
  );
});

/* top-10 list used in the wrapped detail panel (module level so hover re-renders don't replay it) */
const WrList = ({ rows, color, emptyText, dkey }) => rows.length === 0 ? <div style={S.insEmpty}>{emptyText}</div> : (
  <div className="wr-list">
    {rows.map((row, k) => (
      <div key={`${dkey}-${k}-${row.label}`} className="wr-li" style={{ animationDelay: `${40 + k * 35}ms` }}>
        <span className="wr-li-rank">{k + 1}</span>
        <span className="wr-li-main">
          <span className="wr-li-name">{row.label}</span>
          <span className="wr-li-track"><span className="wr-li-fill" style={{ width: `${Math.max(2, row.frac * 100)}%`, background: row.color || color, animationDelay: `${120 + k * 35}ms` }} /></span>
        </span>
        <span className="wr-li-val">
          <span style={{ color: row.valColor || "#e8eaec" }}>{row.value}</span>
          {row.sub && <span className="wr-li-sub">{row.sub}</span>}
        </span>
      </div>
    ))}
  </div>
);

/* ---------- test data: the generator ----------
   What "Add test data" makes, one month at a time. Pure: the same settings and the same random source give the same
   entries. tools/projection-test.mjs reads this block out of the file to make the months it backtests on.
   Amounts in thousands of rupiah. small / mid: [% of spending days that have one, least, most]. big: [fewest a
   month, most a month, least, most]. weekend: what a Saturday or Sunday costs against a weekday. spike: % of days
   that cost 3–6 times as much. swing: how far a whole month may sit above or below the usual, in %. */
const SPEND_STYLES = {
  balanced: { label: "Balanced", small: [88, 10, 50], mid: [20, 50, 150], big: [2, 3, 300, 500], weekend: 1, spike: 0, swing: 0 },
  frugal:   { label: "Frugal", small: [62, 5, 30], mid: [7, 40, 90], big: [0, 1, 200, 350], weekend: 1, spike: 0, swing: 0 },
  erratic:  { label: "Erratic", small: [70, 5, 90], mid: [30, 60, 260], big: [3, 6, 250, 900], weekend: 1, spike: 8, swing: 60 },
  big:      { label: "Big spender", small: [96, 30, 90], mid: [45, 100, 300], big: [4, 6, 400, 1200], weekend: 1, spike: 0, swing: 0 },
  weekend:  { label: "Weekend splurger", small: [80, 8, 35], mid: [25, 50, 120], big: [1, 2, 300, 600], weekend: 3.2, spike: 0, swing: 0 },
};
const TEST_SMALL = [["Chatime", "food"], ["Kopi Kenangan", "food"], ["Nasi padang", "food"], ["McDonald's", "food"],
  ["Makan siang", "food"], ["Mixue", "food"], ["Grab", "transport"], ["Gojek", "transport"], ["MRT", "transport"],
  ["Parkir", "transport"], ["Indomaret", "shopping"], ["Snack", "food"]];
const TEST_MID = [["Dinner", "food"], ["Sushi Tei", "food"], ["Bensin", "transport"], ["Uniqlo", "shopping"],
  ["Pulsa", "bills"], ["Wingstop", "food"], ["Starbucks", "food"], ["Grab", "transport"]];
const TEST_BIG = [["Electricity", "bills"], ["Lego", "shopping"], ["Groceries", "shopping"], ["Internet", "bills"],
  ["Shoes", "shopping"], ["Water bill", "bills"]];
// the bills that come back every month: name, share of the monthly total, day of the month. Names of their own:
// one that the app reads as the same thing as a random buy above ("Wifi" is "Internet") would be mixed up with it
const TEST_BILLS = [["Rent", 0.62, 1], ["IndiHome", 0.14, 5], ["Phone plan", 0.08, 12], ["PLN", 0.16, 20]];
const TEST_DAYS_ALL = Array.from({ length: 31 }, (_, i) => i + 1);
const DEFAULT_TEST_CFG = {
  incMin: 1, incMax: 3, incDays: [1],                       // jt per payment, and the days of the month one arrives
  style: "balanced", small: [88, 10, 50], mid: [20, 50, 150], big: [2, 3, 300, 500], weekend: 1, spike: 0, swing: 0,
  dows: [true, true, true, true, true, true, true],         // Monday … Sunday: the days of the week with spending
  days: TEST_DAYS_ALL,                                      // … and the days of the month
  bills: 0,                                                 // jt of monthly bills (0: none)
  toToday: false, zeros: true, fresh: false, seed: "", range: "year", goals: true, debts: true,
};
// a random source that gives the same numbers for the same seed
const seededRand = (seed) => {
  let s = 7;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  s = s || 1;
  const next = () => (s = (s * 48271) % 2147483647) / 2147483647;
  next(); next(); next();
  return next;
};
// One month. last: the last day to fill (today's, when the settings stop at today). Gives the incomes, the entries
// of each day that has any ({ day: [items] }) and the days left without one (zeros).
const testMonth = (cfg, y, m, rand, last = 31) => {
  const rnd = (a, b) => a + Math.floor(rand() * (b - a + 1)), pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const end = Math.min(new Date(y, m + 1, 0).getDate(), last);
  const incomes = [], days = {}, zeros = [];
  const put = (d, it) => { (days[d] || (days[d] = [])).push(it); };
  const lo = Math.round(cfg.incMin * 10), hi = Math.round(cfg.incMax * 10);            // in 100Rb steps
  // a month that doesn't have the day (the 31st in June) gets no payment for it
  [...cfg.incDays].sort((a, b) => a - b).forEach((day, k) => {
    if (day <= end) incomes.push({ amount: rnd(lo, hi) * 100_000, desc: k === 0 ? "Salary" : pick(["Freelance", "Side project", "Bonus"]), day });
  });
  if (cfg.bills > 0) TEST_BILLS.forEach(([desc, share, day]) => {
    if (day <= end) put(day, { amount: Math.max(1, Math.round(cfg.bills * 1000 * share * (desc === "PLN" ? 0.85 + rand() * 0.3 : 1))) * 1000, desc, cat: "bills" });
  });
  const on = [];                                                                     // the days with spending
  for (let d = 1; d <= end; d++) if (cfg.days.includes(d) && cfg.dows[(new Date(y, m, d).getDay() + 6) % 7]) on.push(d);
  const bigDays = new Set(), nBig = Math.min(rnd(cfg.big[0], cfg.big[1]), on.length);
  while (bigDays.size < nBig) bigDays.add(pick(on));
  const swing = 1 + (rand() * 2 - 1) * (cfg.swing / 100);
  for (let d = 1; d <= end; d++) {
    if (on.includes(d)) {
      const dow = new Date(y, m, d).getDay(), wkend = dow === 0 || dow === 6;
      const mult = swing * (wkend ? cfg.weekend : 1) * (rand() * 100 < cfg.spike ? rnd(3, 6) : 1);
      const amt = (a, b) => Math.max(1, Math.round(rnd(a, b) * mult)) * 1000;
      if (rand() * 100 < cfg.small[0]) { const [desc, cat] = pick(TEST_SMALL); put(d, { amount: amt(cfg.small[1], cfg.small[2]), desc, cat }); }
      if (rand() * 100 < cfg.mid[0]) { const [desc, cat] = pick(TEST_MID); put(d, { amount: amt(cfg.mid[1], cfg.mid[2]), desc, cat }); }
      if (bigDays.has(d)) { const [desc, cat] = pick(TEST_BIG); put(d, { amount: Math.max(1, rnd(cfg.big[2], cfg.big[3])) * 1000, desc, cat }); }
    }
    if (!days[d]) zeros.push(d);
  }
  return { incomes, days, zeros };
};
/* ---------- test data: end of the generator ---------- */
const TEST_CFG_KEY = "pnl-test-config";
// saved settings made whole: anything missing or out of range takes its usual value. Settings saved before the
// developer options (a style by name, "how often" for the income) are read as what they meant
const cleanTestCfg = (raw) => {
  const r = raw && typeof raw === "object" ? raw : {}, D = DEFAULT_TEST_CFG, st = SPEND_STYLES[r.style] || {};
  const num = (v, d, lo, hi) => (v !== null && v !== "" && Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
  const list = (v, d, top, fix) => (Array.isArray(v) && v.length === d.length ? v : d).map((x, i) => fix(num(x, d[i], 0, top(i))));
  const order = (a, i, j) => { if (a[j] < a[i]) a[j] = a[i]; return a; };
  const days = (v, d) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((x) => Number.isInteger(x) && x >= 1 && x <= 31))].sort((a, b) => a - b) : d);
  const incMin = num(r.incMin, D.incMin, 0.1, 1000);
  return {
    incMin, incMax: Math.max(incMin, num(r.incMax, D.incMax, 0.1, 1000)),
    incDays: days(r.incDays, { "2-3": [1, 15], weekly: [1, 8, 15, 22] }[r.incFreq] || D.incDays),
    style: SPEND_STYLES[r.style] ? r.style : r.style === "custom" ? "custom" : D.style,
    small: order(list(r.small, st.small || D.small, (i) => (i ? 1e5 : 100), (x) => x), 1, 2),
    mid: order(list(r.mid, st.mid || D.mid, (i) => (i ? 1e5 : 100), (x) => x), 1, 2),
    big: order(order(list(r.big, st.big || D.big, (i) => (i < 2 ? 31 : 1e5), (x) => x), 0, 1), 2, 3).map((x, i) => (i < 2 ? Math.round(x) : x)),
    weekend: num(r.weekend, st.weekend ?? D.weekend, 0, 20), spike: num(r.spike, st.spike ?? D.spike, 0, 100), swing: num(r.swing, st.swing ?? D.swing, 0, 95),
    dows: Array.isArray(r.dows) && r.dows.length === 7 ? r.dows.map(Boolean) : D.dows,
    days: days(r.days, D.days), bills: num(r.bills, D.bills, 0, 1000),
    toToday: !!r.toToday, zeros: r.zeros !== false, fresh: !!r.fresh, seed: typeof r.seed === "string" ? r.seed.slice(0, 24) : "",
    range: ["year", "month", "rest"].includes(r.range) ? r.range : D.range, goals: r.goals !== false, debts: r.dv ? r.debts !== false : true, dv: 1,
  };
};
// roughly what a month comes to with these settings, in rupiah (the pop-up shows it)
const estimateTest = (c) => {
  const mean = (a, b) => (a + b) / 2;
  const wd = c.dows.slice(0, 5).filter(Boolean).length, we = c.dows.slice(5).filter(Boolean).length;
  const perDay = (c.small[0] * mean(c.small[1], c.small[2]) + c.mid[0] * mean(c.mid[1], c.mid[2])) / 100;
  const everyday = (30 / 7) * (wd + we * c.weekend) * (c.days.length / 31) * perDay * (1 + (c.spike / 100) * 3.5);
  const big = Math.min(mean(c.big[0], c.big[1]), ((wd + we) / 7) * c.days.length) * mean(c.big[2], c.big[3]);
  return Math.round((everyday + big + c.bills * 1000) * 1000);
};

/* ---------- test-data settings: the developer options (a double click on "Add test data") ----------
   A pop-up of its own with its own draft, so typing in it re-renders nothing behind it. Everything sits in sections
   that fold, each saying what it is set to in one line while it is shut: Rassam asked for a lot more to play with
   (the days income arrives on, when he spends, every figure of the spending style) without the pop-up getting
   cluttered. A preset only fills in the figures under it; changing one of them makes the style "Custom". */
const TEST_DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const nth = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const testNum = (str) => { const v = parseFloat(String(str).replace(",", ".")); return Number.isFinite(v) ? v : null; };
// the settings as the text in the boxes …
const testDraft = (c) => ({ ...c, incMin: String(c.incMin), incMax: String(c.incMax), bills: String(c.bills), weekend: String(c.weekend),
  spike: String(c.spike), swing: String(c.swing), small: c.small.map(String), mid: c.mid.map(String), big: c.big.map(String) });
// … and back: the settings (null while a box holds something that can't be used) and the boxes that are wrong
const testFromDraft = (d) => {
  const bad = new Set();
  const n = (name, s, lo, hi) => { const v = testNum(s); if (v === null || v < lo || v > hi) { bad.add(name); return lo; } return v; };
  const c = { ...d, incMin: n("incMin", d.incMin, 0.1, 1000), incMax: n("incMax", d.incMax, 0.1, 1000), bills: n("bills", d.bills, 0, 1000),
    weekend: n("weekend", d.weekend, 0, 20), spike: n("spike", d.spike, 0, 100), swing: n("swing", d.swing, 0, 95),
    small: d.small.map((s, i) => n("small" + i, s, 0, i ? 1e5 : 100)), mid: d.mid.map((s, i) => n("mid" + i, s, 0, i ? 1e5 : 100)),
    big: d.big.map((s, i) => n("big" + i, s, 0, i < 2 ? 31 : 1e5)).map((x, i) => (i < 2 ? Math.round(x) : x)) };
  if (c.incMax < c.incMin) bad.add("incMax");
  if (c.small[2] < c.small[1]) bad.add("small2");
  if (c.mid[2] < c.mid[1]) bad.add("mid2");
  if (c.big[1] < c.big[0]) bad.add("big1");
  if (c.big[3] < c.big[2]) bad.add("big3");
  return { cfg: bad.size ? null : c, bad };
};
// the days of a month as a small calendar: a press switches a day
const DayGrid = ({ value, onToggle }) => (
  <div className="tcfg-cal">
    {TEST_DAYS_ALL.map((day) => <button key={day} className={value.includes(day) ? "on" : ""} aria-pressed={value.includes(day)} onClick={() => onToggle(day)}>{day}</button>)}
  </div>
);
const TestCfg = ({ cfg, closing, year, month, fmt, onRun, onClose }) => {
  const [d, setD] = useState(() => testDraft(cfg));
  const [open, setOpen] = useState({});
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const knob = (patch) => set({ ...patch, style: "custom" });
  // switches read the draft as it is at that moment, so two presses in a row both count
  const toggleDay = (key) => (day) => setD((x) => ({ ...x, [key]: x[key].includes(day) ? x[key].filter((v) => v !== day) : [...x[key], day].sort((a, b) => a - b) }));
  const { cfg: c, bad } = testFromDraft(d);
  const go = () => { if (c) onRun(c); };
  const box = (name, value, onText, unit, width) => (
    <span className={`tcfg-num sm${bad.has(name) ? " bad" : ""}`}>
      <input style={width ? { width } : undefined} value={value} inputMode="decimal" aria-label={name}
             onChange={(e) => onText(e.target.value.replace(/[^\d.,]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
      {unit && <span className="tcfg-unit">{unit}</span>}
    </span>
  );
  const part = (key, i, unit) => box(key + i, d[key][i], (v) => setD((x) => ({ ...x, style: "custom", [key]: x[key].map((old, k) => (k === i ? v : old)) })), unit);
  const one = (key, unit, change = knob) => box(key, d[key], (v) => change({ [key]: v }), unit);
  const flip = (key, label, note) => (
    <div className="tcfg-row"><span className="tcfg-lbl">{label}{note && <span className="tcfg-note">{note}</span>}</span>
      <button className={`tcfg-switch${d[key] ? " on" : ""}`} onClick={() => setD((x) => ({ ...x, [key]: !x[key] }))} aria-pressed={d[key]} aria-label={label}><span /></button></div>
  );
  const sec = (key, icon, title, sum, body) => (
    <div className="tcfg-sec fold">
      <button className="tcfg-fold" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} aria-expanded={!!open[key]}>
        <span className="msym">{icon}</span><span className="tcfg-fold-t">{title}</span><span className="tcfg-fold-s">{sum}</span>
        <span className={`plain-arrow chev${open[key] ? " up" : ""}`}><Chevron /></span>
      </button>
      {/* shut, its boxes are out of the Tab order too */}
      <div className={`tcfg-body${open[key] ? " open" : ""}`} ref={(el) => { if (el) el.inert = !open[key]; }}><div><div className="tcfg-pad">{body}</div></div></div>
    </div>
  );
  const dowSum = d.dows.every(Boolean) ? "Every day" : d.dows.some(Boolean) ? TEST_DOW.filter((_, i) => d.dows[i]).join(" ") : "No day";
  const rangeText = d.range === "month" ? `${MONTHS_FULL[month]} ${year}` : d.range === "rest" ? `${MONTHS_SHORT[month]}–Dec ${year}` : `all of ${year}`;
  const perMonth = d.incDays.filter((x) => x <= 28).length;
  return (
    <div style={{ ...S.backdrop, zIndex: 70, animation: closing ? "fadeOut .22s ease both" : "fadeIn .22s ease backwards" }} onClick={onClose}>
      <div className="glass tcfg-modal" onClick={(e) => e.stopPropagation()}
           style={{ animation: closing ? "modalPopOut .23s var(--ease-soft) both" : "modalPop .42s var(--ease) backwards" }}>
        <div style={S.modalHead}>
          <span style={S.wrKicker}><span className="msym" style={{ fontSize: 17, color: "#e3cd77" }}>science</span>Developer options · test data</span>
          <button className="x-btn" style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className="tcfg-sub">Generated entries are added to {rangeText}. Clear test data removes only these.</div>

        {sec("inc", "payments", "Income", d.incDays.length ? `${d.incMin}–${d.incMax} jt · ${d.incDays.length <= 4 ? "on the " + d.incDays.map(nth).join(", ") : d.incDays.length + " days a month"}` : "None", <>
          <div className="tcfg-row"><span className="tcfg-lbl">Each payment</span>
            <span className="tcfg-ctl">{one("incMin", null, set)}<span className="tcfg-to">to</span>{one("incMax", "jt", set)}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Arrives on<span className="tcfg-note">press the days · a month that doesn't have the day skips it</span></span>
            <button className="tcfg-mini" onClick={() => set({ incDays: [] })}>None</button></div>
          <DayGrid value={d.incDays} onToggle={toggleDay("incDays")} />
        </>)}

        {sec("when", "event", "When spending happens", [dowSum, d.days.length < 31 && `${d.days.length} of 31 dates`, d.toToday && "up to today"].filter(Boolean).join(" · "), <>
          <div className="tcfg-row"><span className="tcfg-lbl">Days of the week</span>
            <span className="tcfg-dows">{TEST_DOW.map((name, i) => (
              <button key={name} className={d.dows[i] ? "on" : ""} aria-pressed={d.dows[i]} onClick={() => setD((x) => ({ ...x, dows: x.dows.map((v, k) => (k === i ? !v : v)) }))}>{name}</button>
            ))}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Days of the month<span className="tcfg-note">only the lit days get spending</span></span>
            <span className="tcfg-ctl"><button className="tcfg-mini" onClick={() => set({ days: TEST_DAYS_ALL })}>All</button><button className="tcfg-mini" onClick={() => set({ days: [] })}>None</button></span></div>
          <DayGrid value={d.days} onToggle={toggleDay("days")} />
          {flip("toToday", "Stop at today", "later days stay empty, which gives the projection something to work out")}
          {flip("zeros", "Mark the days without spending", "as no-spend days")}
        </>)}

        {sec("much", "shopping_cart", "How much is spent", `${SPEND_STYLES[d.style] ? SPEND_STYLES[d.style].label : "Custom"}${c ? ` · ≈ ${fmt(estimateTest(c))} a month` : ""}`, <>
          <div className="tcfg-row"><span className="tcfg-lbl">Start from<span className="tcfg-note">fills in the figures below</span></span>
            <span className="tcfg-seg">{Object.entries(SPEND_STYLES).map(([k, st]) => (
              <button key={k} className={d.style === k ? "on" : ""} onClick={() => set({ style: k, small: st.small.map(String), mid: st.mid.map(String), big: st.big.map(String),
                weekend: String(st.weekend), spike: String(st.spike), swing: String(st.swing) })}>{st.label}</button>
            ))}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Small buys<span className="tcfg-note">coffee, lunch, a ride</span></span>
            <span className="tcfg-ctl">{part("small", 0, "% of days")}{part("small", 1)}<span className="tcfg-to">to</span>{part("small", 2, "Rb")}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Medium buys<span className="tcfg-note">dinner, petrol, clothes</span></span>
            <span className="tcfg-ctl">{part("mid", 0, "% of days")}{part("mid", 1)}<span className="tcfg-to">to</span>{part("mid", 2, "Rb")}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Big buys<span className="tcfg-note">on days picked at random</span></span>
            <span className="tcfg-ctl">{part("big", 0)}<span className="tcfg-to">to</span>{part("big", 1, "a month")}{part("big", 2)}<span className="tcfg-to">to</span>{part("big", 3, "Rb")}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">A weekend day costs</span><span className="tcfg-ctl">{one("weekend", "× a weekday")}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Spike days<span className="tcfg-note">a day that costs 3 to 6 times as much</span></span><span className="tcfg-ctl">{one("spike", "% of days")}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Months differ by<span className="tcfg-note">a whole month dearer or cheaper than usual</span></span>
            <span className="tcfg-ctl"><span className="tcfg-to">up to ±</span>{one("swing", "%")}</span></div>
          <div className="tcfg-row"><span className="tcfg-lbl">Monthly bills<span className="tcfg-note">rent on the 1st, IndiHome 5th, phone 12th, PLN 20th · 0 for none</span></span>
            <span className="tcfg-ctl">{one("bills", "jt a month", set)}</span></div>
        </>)}

        {sec("more", "tune", "Range and extras", [rangeText, d.fresh && "replaces the old", d.goals && "goals", d.debts && "debts", d.seed && `seed ${d.seed}`].filter(Boolean).join(" · "), <>
          <div className="tcfg-row"><span className="tcfg-lbl">Months</span>
            <span className="tcfg-seg">{[["year", `All of ${year}`], ["month", `${MONTHS_SHORT[month]} only`], ["rest", `${MONTHS_SHORT[month]}–Dec`]].map(([v, label]) => (
              <button key={v} className={d.range === v ? "on" : ""} onClick={() => set({ range: v })}>{label}</button>
            ))}</span></div>
          {flip("fresh", "Replace the test data already there", "instead of adding to it")}
          {flip("goals", "Sample goals")}
          {flip("debts", "Sample debts")}
          <div className="tcfg-row"><span className="tcfg-lbl">Seed<span className="tcfg-note">the same seed makes the same data · empty for a new roll each time</span></span>
            <span className="tcfg-num sm"><input style={{ width: 104, textAlign: "left", paddingLeft: 9 }} value={d.seed} maxLength={24} placeholder="random" aria-label="seed"
                   onChange={(e) => set({ seed: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") go(); }} /></span></div>
        </>)}

        <div className="tcfg-foot">
          <span className="tcfg-est">
            {!c ? "Check the boxes marked red"
              : <>≈ <b style={{ color: "#8fd7a4" }}>{perMonth ? `${fmt(c.incMin * 1e6 * perMonth)}${c.incMax > c.incMin ? `–${fmt(c.incMax * 1e6 * perMonth)}` : ""}` : fmt(0)}</b> in, ≈ <b style={{ color: "#ff8d97" }}>{fmt(estimateTest(c))}</b> out per month</>}
          </span>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button className="bk-btn" onClick={() => setD(testDraft(DEFAULT_TEST_CFG))}>Reset</button>
            <button className="tcfg-go" disabled={!c} onClick={go}><span className="msym" style={{ fontSize: 18 }}>auto_awesome</span>Generate</button>
          </span>
        </div>
      </div>
    </div>
  );
};

/* liquid-glass hover bubble for the SVG charts; positioned in % of the chart's viewBox */
const GlassTip = ({ x, y, W, H, label, value, color, below }) => (
  <div className={`glass-tip${below ? " below" : ""}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}>
    <span className="glass-tip-inner">
      <span className="glass-tip-label">{label}</span>
      <span className="glass-tip-value" style={color ? { color } : undefined}>{value}</span>
    </span>
  </div>
);

/* goal icons: picked by the user, or inferred from the goal's name (keywords first, AI for anything else) */
const GOAL_ICONS = [
  "savings", "account_balance", "shield", "laptop_mac", "phone_iphone", "headphones", "photo_camera", "watch",
  "sports_esports", "flight", "beach_access", "luggage", "home", "apartment", "chair", "directions_car",
  "two_wheeler", "school", "menu_book", "favorite", "diamond", "celebration", "redeem", "child_care",
  "pets", "fitness_center", "medical_services", "checkroom", "music_note", "trending_up", "construction", "star",
];
const GOAL_ICON_RULES = [
  ["laptop_mac", ["macbook", "laptop", "notebook", "computer", "pc", "imac", "desktop", "monitor"]],
  ["phone_iphone", ["iphone", "phone", "hp ", "handphone", "samsung", "pixel", "android"]],
  ["headphones", ["airpods", "headphone", "earbuds", "earphone", "sony wh"]],
  ["photo_camera", ["camera", "kamera", "lens", "fujifilm", "canon", "nikon", "gopro"]],
  ["watch", ["watch", "jam", "rolex", "apple watch", "garmin"]],
  ["sports_esports", ["ps5", "playstation", "xbox", "switch", "nintendo", "console", "gaming", "steam deck"]],
  ["flight", ["trip", "travel", "japan", "korea", "europe", "flight", "holiday", "liburan", "vacation", "tokyo", "bali", "umrah", "hajj", "haji"]],
  ["home", ["house", "rumah", "home", "down payment", "dp ", "mortgage", "kpr"]],
  ["apartment", ["apartment", "apartemen", "condo", "rent", "sewa"]],
  ["chair", ["furniture", "sofa", "desk", "chair", "bed", "kasur"]],
  ["directions_car", ["car", "mobil", "tesla", "bmw", "toyota", "honda"]],
  ["two_wheeler", ["motor", "motorbike", "scooter", "vespa", "bike"]],
  ["school", ["school", "sekolah", "tuition", "kuliah", "university", "education", "course", "mba", "dba", "degree"]],
  ["favorite", ["wedding", "nikah", "married", "anniversary", "ring"]],
  ["diamond", ["jewel", "gold", "emas", "diamond", "luxury"]],
  ["child_care", ["baby", "bayi", "kids", "child", "anak"]],
  ["pets", ["pet", "cat", "kucing", "dog", "anjing"]],
  ["fitness_center", ["gym", "fitness", "bicycle", "sepeda", "marathon"]],
  ["medical_services", ["medical", "health", "hospital", "dental", "insurance", "asuransi"]],
  ["trending_up", ["invest", "saham", "stock", "crypto", "bitcoin", "reksadana", "portfolio"]],
  ["shield", ["emergency", "darurat", "rainy day", "safety"]],
  ["redeem", ["gift", "hadiah", "birthday", "present", "christmas", "lebaran", "eid"]],
  ["checkroom", ["clothes", "baju", "outfit", "fashion", "shoes", "sepatu", "bag", "tas"]],
  ["music_note", ["guitar", "piano", "concert", "music"]],
  ["construction", ["renovation", "renovasi", "repair"]],
];
const inferGoalIcon = (name) => {
  const n = ` ${String(name || "").toLowerCase()} `;
  for (const [icon, words] of GOAL_ICON_RULES) if (words.some((w) => n.includes(w))) return icon;
  return null;
};

/* goal progress bar: grows from 0 on mount, then eases between values */
// a goal's progress as a ring with its % in the middle (after his picture of a goal card)
const GoalRing = ({ pct, color, delay, children }) => {
  const R = 21, C = 2 * Math.PI * R, f = (C * Math.max(0, Math.min(100, pct))) / 100;
  return (
    <span className="goal-ring">
      <svg viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5.5" />
        <circle className="score-arc goal-arc" style={{ animationDelay: `${delay || 0}ms` }} cx="26" cy="26" r={R} fill="none" stroke={color}
                strokeWidth="5.5" strokeLinecap="round" strokeDasharray={`${f} ${C}`} />
      </svg>
      <span className="goal-ring-n">{children}</span>
    </span>
  );
};
const GoalBar = ({ pct, done, delay }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(r1); if (r2) cancelAnimationFrame(r2); };
  }, []);
  return (
    <div className="goal-track">
      <div className={`goal-fill${done ? " done" : ""}`}
           style={{ width: on ? `${Math.max(0, Math.min(100, pct))}%` : "0%", transitionDelay: on ? `${delay || 0}ms` : "0ms" }} />
    </div>
  );
};

const SplitBar = ({ remainingVal, totalVal, frac, animKey }) => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setOn(true)); });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [animKey]);
  const green = frac * 100;
  return (
    <div style={S.barTrack}>
      {/* left-to-right reveal: a window slides in while the bar inside slides the opposite way, so the bar
          stays put and is uncovered from the left. Both are GPU transforms — no relayout or repaint per frame. */}
      <div style={{ flex: "1 1 100%", width: "100%", height: "100%", overflow: "hidden", transform: on ? "translate3d(0,0,0)" : "translate3d(-100%,0,0)",
                    transition: on ? "transform .62s cubic-bezier(0.32,0.72,0.24,1)" : "none" }}>
      <div style={{ width: "100%", height: "100%", transform: on ? "translate3d(0,0,0)" : "translate3d(100%,0,0)",
                    transition: on ? "transform .62s cubic-bezier(0.32,0.72,0.24,1)" : "none" }}>
        {/* red fills the track; the green layer slides over it, so the green/red border moves by transform alone */}
        <div style={{ width: "100%", height: "100%", overflow: "hidden", background: totalVal > 0 ? "#ff5d6c" : "#2c3034",
                      transition: "background .3s ease" }}>
          <div style={{ width: "100%", height: "100%", background: remainColor(remainingVal), transform: `translate3d(${green - 100}%,0,0)`,
                        transition: "transform .5s cubic-bezier(0.32,0.72,0.24,1), background .3s ease" }} />
        </div>
      </div>
      </div>
    </div>
  );
};

const CATS = {
  food: { label: "Food", icon: "fork_spoon" },
  transport: { label: "Transport", icon: "directions_car" },
  shopping: { label: "Shopping", icon: "shopping_bag" },
  bills: { label: "Bills", icon: "receipt_long" },
  other: { label: "Other", icon: "apps" },
};
const CAT_ORDER = ["food", "transport", "shopping", "bills", "other"];

const ICON_CHOICES = [
  "fork_spoon", "restaurant", "local_cafe", "local_pizza", "lunch_dining", "icecream",
  "directions_car", "local_gas_station", "directions_bus", "train", "flight", "local_taxi",
  "shopping_bag", "shopping_cart", "storefront", "checkroom", "redeem", "diamond",
  "receipt_long", "bolt", "water_drop", "wifi", "home", "phone_iphone",
  "medical_services", "fitness_center", "school", "pets", "sports_esports", "movie",
  "music_note", "build", "savings", "apps",
];

const CAT_RULES = {
  food: [
    "makan", "food", "eat", "lunch", "dinner", "breakfast", "brunch", "steak", "coffee", "kopi", "nasi", "ayam", "mie", "noodle", "snack", "restaurant", "resto", "cafe", "kafe", "bakso", "sate", "pizza", "burger", "tea", "teh", "drink", "minum", "sarapan", "warung", "boba", "sushi", "chicken", "rice", "bread", "roti", "cake", "juice", "es ", "dessert", "bakery", "seafood", "ramen", "dimsum", "martabak", "gorengan", "padang", "geprek", "soto", "gado",
    "mcdonald", "mcd", "kfc", "burger king", "wendys", "wendy's", "popeyes", "subway", "dominos", "domino's", "pizza hut", "starbucks", "sbux", "dunkin", "jco", "j.co", "richeese", "hokben", "yoshinoya", "marugame", "solaria", "sederhana", "burger nangor", "blenger", "moon chicken", "wingstop", "shihlin", "kokumi", "auntie anne", "krispy kreme", "chick fil", "five guys", "shake shack", "taco bell", "sushi tei", "genki", "ichiban", "bakmi", "eatlah", "haus", "mixue",
    "chatime", "boost juice", "boost", "teazzi", "chagee", "kopi kenangan", "janji jiwa", "fore", "tomoro", "point coffee", "gong cha", "koi the", "xing fu", "menantea", "es teler", "tiger sugar", "dum dum", "milk tea", "matcha", "smoothie", "bubble tea",
  ],
  transport: [
    "transport", "gojek", "gocar", "goride", "gosend", "grab", "grabcar", "grabbike", "bluebird", "blue bird", "silverbird", "silver bird", "taxi", "taksi", "uber", "maxim", "indriver",
    "bensin", "pertamax", "pertalite", "shell", "fuel", "petrol", "gasoline", "spbu",
    "parkir", "parking", "tol", "toll", "emoney", "e-money", "e money", "flazz", "brizzi", "tapcash",
    "bus", "busway", "transjakarta", "train", "kereta", "krl", "mrt", "lrt", "commuter", "ojek", "flight", "pesawat", "tiket", "airport", "bandara", "damri", "angkot", "commute", "tambal ban",
  ],
  shopping: [
    "shop", "belanja", "baju", "clothes", "shirt", "kaos", "celana", "jacket", "jaket", "shoes", "sepatu", "sandal", "tokopedia", "shopee", "lazada", "blibli", "amazon", "tiktok shop", "mall", "beli", "gift", "hadiah", "bag", "tas", "makeup", "skincare", "parfum", "uniqlo", "zara", "h&m", "nike", "adidas", "muji", "ikea",
    "alfamart", "alfamidi", "indomaret", "lawson", "family mart", "familymart", "circle k", "circlek", "minimarket", "convenience store",
    "lego", "bearbrick", "be@rbrick", "kaws", "gunpla", "gundam", "figure", "figurine", "funko", "pop mart", "popmart", "labubu", "smiski", "sonny angel", "hot wheels", "hotwheels", "pokemon card", "trading card", "vinyl", "sneaker", "collectible", "keyboard", "mousepad", "headset", "console", "nintendo", "playstation", "steam",
  ],
  bills: [
    "bill", "tagihan", "listrik", "electric", "electricity", "pln", "token listrik", "water", "air pam", "pdam", "gas", "lpg", "elpiji", "internet", "wifi", "indihome", "biznet", "firstmedia", "pulsa", "kuota", "paket data", "telkomsel", "indosat",
    "rent", "sewa", "kos", "kontrakan", "mortgage", "kpr", "subscription", "langganan", "insurance", "asuransi", "bpjs", "spotify", "netflix", "youtube premium", "icloud", "google one", "cicilan", "loan", "angsuran", "tax", "pajak", "iuran", "spp", "tuition",
  ],
};

const inferCat = (desc) => {
  const d = (desc || "").toLowerCase().trim();
  if (!d) return null;
  for (const cat of ["food", "transport", "shopping", "bills"]) {
    if (CAT_RULES[cat].some((w) => d.includes(w))) return cat;
  }
  return null;
};

const HamburgerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <rect className="hl l1" x="2" y="3.2" width="12" height="1.7" rx="0.85" fill="currentColor" />
    <rect className="hl l2" x="2" y="7.15" width="12" height="1.7" rx="0.85" fill="currentColor" />
    <rect className="hl l3" x="2" y="11.1" width="12" height="1.7" rx="0.85" fill="currentColor" />
  </svg>
);

const CAT_HOVER_ICON = {
  income: "money",
  food: "fork_spoon",
  transport: "directions_bus",
  shopping: "shopping_bag",
  bills: "receipt",
  other: "grid_view",
  left: "savings",
};

const CAT_COLORS = {
  income: "#5ad2a6", food: "#ff8fa3", transport: "#7cc9ff",
  shopping: "#c49bff", bills: "#ffd069", other: "#a9b6c9", left: "#7fd8b4",
};

/* Title reel — scrolls through the five category icons only */
const TITLE_SLOT = 26;
const CatTitleReel = ({ cat }) => {
  const idx = Math.max(0, CAT_ORDER.indexOf(cat));
  const prev = useRef(idx);
  const [blur, setBlur] = useState(false);
  const dist = Math.max(1, Math.abs(idx - prev.current));
  useEffect(() => {
    if (prev.current !== idx) { setBlur(true); const t = setTimeout(() => setBlur(false), 260); prev.current = idx; return () => clearTimeout(t); }
  }, [idx]);
  const dur = Math.min(0.14 * dist + 0.12, 0.6);
  return (
    <span style={{ width: 24, height: TITLE_SLOT, overflow: "hidden", display: "inline-block", flexShrink: 0 }}>
      <span style={{ display: "block", transform: `translateY(${-idx * TITLE_SLOT}px)`,
                     transition: `transform ${dur}s cubic-bezier(0.45,0,0.2,1), filter .18s ease`,
                     filter: blur ? "blur(2.2px)" : "blur(0px)" }}>
        {CAT_ORDER.map((c) => (
          <span key={c} style={{ height: TITLE_SLOT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="msym" style={{ fontSize: 20, color: CAT_COLORS[c] }}>{CATS[c].icon}</span>
          </span>
        ))}
      </span>
    </span>
  );
};

/* Pretty names: McDonalds, KFC, Burger King … */
const WORD_FIX = {
  mcdonalds: "McDonalds", kfc: "KFC", mcd: "McD", mcdonalds: "McDonalds", mcdonald: "McDonald", jco: "J.CO", "j.co": "J.CO",
  hokben: "HokBen", mrt: "MRT", lrt: "LRT", krl: "KRL", spbu: "SPBU", pln: "PLN", pdam: "PDAM",
  bpjs: "BPJS", lpg: "LPG", kpr: "KPR", atm: "ATM", kaws: "KAWS", lego: "LEGO", ikea: "IKEA",
  "h&m": "H&M", tcg: "TCG", ac: "AC", tv: "TV", ps5: "PS5", ps4: "PS4", id: "ID", bca: "BCA",
  bri: "BRI", bni: "BNI", ovo: "OVO", gopay: "GoPay", gojek: "Gojek", grabfood: "GrabFood",
  gofood: "GoFood", grabcar: "GrabCar", goride: "GoRide", be: "Be", "be@rbrick": "Be@rbrick",
};
/* Variants that should be counted as the same thing in the breakdown lists. */
const CANON = {
  // food
  snack: "snacks", snacks: "snacks", cemilan: "snacks", jajan: "snacks",
  mcd: "mcdonalds", mcdonald: "mcdonalds", mcdonalds: "mcdonalds", "mc donalds": "mcdonalds",
  "mc d": "mcdonalds", macd: "mcdonalds", mekdi: "mcdonalds",
  kfc: "kfc", "k f c": "kfc",
  bk: "burger king", "burger king": "burger king",
  sbux: "starbucks", starbuck: "starbucks", starbucks: "starbucks",
  kopi: "coffee", cofee: "coffee", coffe: "coffee", coffee: "coffee",
  makan: "food", makanan: "food", food: "food", eat: "food",
  minum: "drinks", minuman: "drinks", drink: "drinks", drinks: "drinks",
  lunch: "lunch", makansiang: "lunch",
  dinner: "dinner", makanmalam: "dinner",
  breakfast: "breakfast", sarapan: "breakfast",
  bobba: "boba", boba: "boba", "bubble tea": "boba",
  // transport
  gojek: "gojek", goride: "gojek", gocar: "gojek", gosend: "gojek",
  grab: "grab", grabbike: "grab", grabcar: "grab",
  bensin: "fuel", fuel: "fuel", petrol: "fuel", gas: "fuel", pertamax: "fuel", pertalite: "fuel",
  parkir: "parking", parking: "parking",
  tol: "toll", toll: "toll",
  taxi: "taxi", taksi: "taxi",
  // shopping / convenience
  alfamart: "convenience store", indomaret: "convenience store", lawson: "convenience store",
  "family mart": "convenience store", familymart: "convenience store", circlek: "convenience store",
  "circle k": "convenience store", minimarket: "convenience store", alfamidi: "convenience store",
  belanja: "shopping", shopping: "shopping", shop: "shopping",
  baju: "clothes", clothes: "clothes", clothing: "clothes",
  sepatu: "shoes", shoes: "shoes", sneakers: "shoes", sneaker: "shoes",
  // bills
  listrik: "electricity", electricity: "electricity", electric: "electricity",
  wifi: "internet", internet: "internet",
  pulsa: "phone credit", kuota: "phone credit",
};
const canonKey = (raw) => {
  const k = (raw || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[.'’]/g, "");
  if (!k) return "__none__";
  if (CANON[k]) return CANON[k];
  const singular = k.endsWith("s") && k.length > 3 ? k.slice(0, -1) : null;
  if (singular && CANON[singular]) return CANON[singular];
  return k;
};

const prettyName = (raw) => {
  const s = (raw || "").trim();
  if (!s) return "No description";
  return s.split(/\s+/).map((w) => {
    const lw = w.toLowerCase();
    if (WORD_FIX[lw]) return WORD_FIX[lw];
    if (/^mc[a-z]/.test(lw)) return "Mc" + lw.charAt(2).toUpperCase() + lw.slice(3);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
};

/* ---------- month-end projection: the maths ----------
   How much will be left when the month ends, read from how he has actually been spending. Three kinds of spending
   are counted apart, because they behave differently:
   - everyday spending: what a Monday, a Tuesday … a Sunday usually costs. Read from the last 12 weeks, with recent
     days counting more (a day three weeks back counts half), so this month weighs most and weekdays and weekends
     each get their own figure;
   - bills that come back every month (same name, about the same amount) and haven't been paid yet this month;
   - big one-off buys, which follow no weekday: read from the whole year behind (twelve weeks hold too few of them
     to tell). How many he makes in a month comes from the months behind; how many of them are still to come then
     follows from how many are made already and how much of the month is gone. Someone who makes two every month
     has, after two, next to none to come; where the months differ as chance would have it, the ones made say nothing.
   Days with nothing logged count as days without spending, except a week or more in a row (the app wasn't in use).
   Whatever is already written on a later day of the month is taken as written; only its empty days are projected.
   Tested by tools/projection-test.mjs, which reads this block out of the file. */
const PROJ_DAYS = 84;       // how far back the everyday pattern is read
const PROJ_LONG = 365;      // … and the big one-off buys
const PROJ_MONTHS = 4;      // months behind it takes to read how many big buys a month has (fewer: so many a day, by chance)
const PROJ_EVEN = 4;        // … their counts are evened out with this many months' worth of plain chance
const PROJ_HALF = 21;       // a day this many days back counts half as much as yesterday
const PROJ_GAP = 7;         // this many unlogged days in a row are left out
const PROJ_LATE = 7;        // a monthly bill or pay this many days late is no longer expected this month
const PROJ_SAME = 1.6;      // "about the same amount" for a bill or pay: the biggest month within this many times the smallest
const PROJ_EXACT = 1.15;    // … and for anything that isn't a bill, which must come back almost to the rupiah
const PROJ_DRIFT = 10;      // "around the same day": its days of the month lie within this many days
const PROJ_LEAN = 4;        // how hard one day of the week leans on its group (in days of history)
const projMedian = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q), h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
// what comes back month after month. months: the three months before, each a list of { key, amount, day, it }.
// A name counts when it is in at least two of them, once or twice a month, around the same day of the month and for
// about the same amount (same(it) gives how far apart the amounts may be).
const projRecurring = (months, same, keep) => {
  const seen = {};
  months.forEach((items, mi) => items.forEach(({ key, amount, day, it }) => {
    const r = seen[key] || (seen[key] = { per: {}, it });
    const p = r.per[mi] || (r.per[mi] = { n: 0, sum: 0, day });
    p.n++; p.sum += amount; p.day = Math.min(p.day, day);
  }));
  const out = {};
  Object.keys(seen).forEach((key) => {
    const per = Object.values(seen[key].per), it = seen[key].it;
    if (per.length < 2 || per.some((p) => p.n > 2)) return;
    const sums = per.map((p) => p.sum), amount = projMedian(sums);
    if (Math.max(...sums) > same(it) * Math.min(...sums) || !keep(amount, it)) return;
    // the 30th and the 2nd are three days apart, so the days are also compared with the month's end joined to its start
    const spread = (ds) => Math.max(...ds) - Math.min(...ds);
    const raw = per.map((p) => p.day), wrapped = raw.map((x) => (x > 15 ? x - 31 : x));
    if (Math.min(spread(raw), spread(wrapped)) > PROJ_DRIFT) return;
    out[key] = { key, amount, day: Math.round(projMedian(raw)), desc: it.desc || "" };
  });
  return out;
};
// Big buys still to come this month. counts: how many each month behind had; k: made so far this month; gone: the
// share of the month that is over. Each number a month might hold (as often as the months behind held it, evened out
// with chance around their average) is weighed by how well it fits k buys by now, the buys falling on any day alike.
// Gives how many more to expect and how uncertain that number is (its variance).
const projBigLeft = (counts, k, gone) => {
  const mu = counts.reduce((a, v) => a + v, 0) / counts.length;
  const top = Math.max(k, ...counts, Math.ceil(mu * 3)) + 4;
  let chance = Math.exp(-mu), fit = 0, sum = 0, sum1 = 0, sum2 = 0;      // chance: of exactly n in a month, by chance alone
  for (let n = 0; n <= top; n++) {
    if (n > 0) chance *= mu / n;
    if (n < k) continue;
    // k of n by now: (n choose k) × gone^k × (1 − gone)^(n − k); gone^k is the same for every n and drops out
    fit = n === k ? 1 : fit * (n / (n - k)) * (1 - gone);
    const w = ((counts.filter((c) => c === n).length + PROJ_EVEN * chance) / (counts.length + PROJ_EVEN)) * fit;
    sum += w; sum1 += w * (n - k); sum2 += w * (n - k) * (n - k);
  }
  const mean = sum > 0 ? sum1 / sum : 0;
  return { mean, v: sum > 0 ? Math.max(0, sum2 / sum - mean * mean) : 0 };
};
// today is (y, m, d), at the given hour. Returns null until there are five days with spending to read a pattern from.
const projectMonth = ({ spending, incomes, limits, y, m, d, hour = 12, catOf }) => {
  const dim = new Date(y, m + 1, 0).getDate(), daysLeft = dim - d;
  const lim = (limits || {})[monthKeyOf(y, m)] || DEFAULT_LIMIT;
  const itemsOn = (yy, mm, dd) => spending[keyOf(yy, mm, dd)] || [];
  const real = (it) => !it.zero && it.amount > 0;
  const nameOf = (it) => canonKey(it.desc);
  const isWe = (dow) => dow === 0 || dow === 6;

  // 1. bills and pay that come back every month
  const before = [1, 2, 3].map((k) => new Date(y, m - k, 1));
  const bills = projRecurring(before.map((p) => {
    const out = [], n = new Date(p.getFullYear(), p.getMonth() + 1, 0).getDate();
    for (let dd = 1; dd <= n; dd++) {
      itemsOn(p.getFullYear(), p.getMonth(), dd).forEach((it) => { if (real(it) && (it.desc || "").trim()) out.push({ key: nameOf(it), amount: it.amount, day: dd, it }); });
    }
    return out;
  }), (it) => (catOf(it) === "bills" ? PROJ_SAME : PROJ_EXACT), (amount, it) => amount >= lim || catOf(it) === "bills");
  const pays = projRecurring(before.map((p) => (incomes[monthKeyOf(p.getFullYear(), p.getMonth())] || [])
    .filter((it) => it.amount > 0).map((it) => ({ key: nameOf(it), amount: it.amount, day: it.day || 1, it }))), () => PROJ_SAME, () => true);
  const isBill = (it) => !!(it.desc || "").trim() && !!bills[nameOf(it)];

  // 2. the days before today, newest first, without the bills
  const hist = [];
  for (let back = 1; back <= PROJ_LONG; back++) {
    const dt = new Date(y, m, d - back);
    const all = itemsOn(dt.getFullYear(), dt.getMonth(), dt.getDate());
    hist.push({ back, dow: dt.getDay(), ym: dt.getFullYear() * 12 + dt.getMonth(), logged: all.length > 0, items: all.filter((it) => real(it) && !isBill(it)) });
  }
  // only the days the app was in use: from the first logged day on, without a week or more of nothing in a row
  const used = [];
  let run = [];
  hist.forEach((h) => {
    if (!h.logged) { run.push(h); return; }
    if (run.length < PROJ_GAP) used.push(...run);
    run = []; used.push(h);
  });
  const days = used.filter((h) => h.back <= PROJ_DAYS);       // the everyday pattern: the last twelve weeks of them
  if (days.filter((h) => h.items.length).length < 5) return null;

  // 3. a big one-off buy is one item worth at least two days' limit and three ordinary days. They are counted over
  //    the whole year in use, and per month behind (perMonth: the months with 20 days or more in use)
  const sumOf = (items) => items.reduce((a, it) => a + it.amount, 0);
  const bigFrom = Math.max(2 * lim, 3 * projMedian(days.map((h) => sumOf(h.items)).filter((v) => v > 0)));
  let bigSum = 0, bigSq = 0, bigN = 0;
  const perMonth = {};
  used.forEach((h) => {
    h.routine = 0;
    let n = 0;
    h.items.forEach((it) => { if (it.amount >= bigFrom) { bigSum += it.amount; bigSq += it.amount * it.amount; bigN++; n++; } else h.routine += it.amount; });
    h.w = Math.pow(0.5, (h.back - 1) / PROJ_HALF);
    if (h.back >= d) { const pm = perMonth[h.ym] || (perMonth[h.ym] = { days: 0, n: 0 }); pm.days++; pm.n += n; }
  });
  const counts = Object.values(perMonth).filter((pm) => pm.days >= 20).map((pm) => pm.n);

  // 4. the everyday pattern: each day of the week leans on its own history and, where that is thin, on its group
  //    (weekdays or the weekend). A group seen less than twice is read as the average of all days.
  const stat = (list) => {
    let sw = 0, sx = 0, sv = 0, sw2 = 0;
    list.forEach((h) => { sw += h.w; sw2 += h.w * h.w; sx += h.w * h.routine; });
    const mean = sw ? sx / sw : 0;
    list.forEach((h) => { sv += h.w * (h.routine - mean) * (h.routine - mean); });
    return { sw, mean, v: sw ? sv / sw : 0, n: sw2 ? (sw * sw) / sw2 : 0 };
  };
  const all = stat(days);
  const groups = [false, true].map((we) => {
    const g = stat(days.filter((h) => isWe(h.dow) === we));
    return g.n >= 2 ? g : all;
  });
  const byDow = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const s = stat(days.filter((h) => h.dow === dow)), g = groups[isWe(dow) ? 1 : 0];
    return (s.sw * s.mean + PROJ_LEAN * g.mean) / (s.sw + PROJ_LEAN);
  });

  // 5. this month so far, and what is already written down for later days. A later day that holds anything (a
  //    planned bill, a no-spend mark, generated test data) is taken as written; only the empty ones are projected.
  let spent = 0, todaySoFar = 0, planned = 0, bigNow = 0;
  const paid = {}, written = {}, onDay = {};
  for (let dd = 1; dd <= dim; dd++) {
    const all = itemsOn(y, m, dd);
    if (dd > d && all.length) written[dd] = true;
    all.filter(real).forEach((it) => {
      if (isBill(it)) paid[nameOf(it)] = true;
      onDay[dd] = (onDay[dd] || 0) + it.amount;
      if (dd > d) planned += it.amount;
      else {
        spent += it.amount;
        if (dd === d && !isBill(it) && it.amount < bigFrom) todaySoFar += it.amount;
        if (!isBill(it) && it.amount >= bigFrom) bigNow++;
      }
    });
  }

  // 6. the rest of today (what a day like today usually costs, less what is already logged; from noon on the
  //    day counts as running out), then every empty day still to come
  const todayMore = Math.max(0, byDow[new Date(y, m, d).getDay()] - todaySoFar) * Math.max(0, Math.min(1, (24 - hour) / 12));
  let everyday = todayMore, nWd = 0, nWe = 0;
  const open = [0, 0];                     // empty days to come: weekdays, weekend days
  for (let dd = d + 1; dd <= dim; dd++) {
    const dow = new Date(y, m, dd).getDay(), we = isWe(dow);
    if (we) nWe++; else nWd++;
    if (written[dd]) continue;
    everyday += byDow[dow];
    open[we ? 1 : 0]++;
  }
  const openDays = open[0] + open[1];
  // big buys still to come, on the empty days. With enough months behind: what those months and this one so far
  // say (projBigLeft). Otherwise so many a day, by chance.
  const bigRate = bigN / used.length, bigEach = bigN ? bigSum / bigN : 0;
  const known = counts.length >= PROJ_MONTHS && daysLeft > 0;
  const left = known ? projBigLeft(counts, bigNow, d / dim) : { mean: bigRate * daysLeft, v: bigRate * daysLeft };
  const share = daysLeft ? openDays / daysLeft : 0;
  const bigMore = left.mean * share, big = bigMore * bigEach;
  // how far off it may be: the days still to come vary as they did before, the big buys come or don't and cost
  // more or less, and the averages themselves are only known as well as the days behind them. The spread of the
  // number of big buys is taken halfway between what the months behind say and plain chance: the months alone made
  // the range too narrow in the backtest (it should hold the real end four times in five, and now does).
  let variance = 0.5 * (left.v + left.mean) * share * bigEach * bigEach + bigMore * Math.max(0, (bigN ? bigSq / bigN : 0) - bigEach * bigEach);
  open.forEach((n, i) => { const g = groups[i]; variance += n * g.v + (g.n > 0 ? (n * n * g.v) / g.n : 0); });

  const billsDue = Object.values(bills).filter((b) => !paid[b.key] && b.day >= d - PROJ_LATE).sort((p, q) => p.day - q.day);
  const billSum = billsDue.reduce((s, x) => s + x.amount, 0);

  // income: everything entered for the month, plus the pay that comes every month and isn't in yet
  let income = 0;
  const got = {};
  (incomes[monthKeyOf(y, m)] || []).forEach((it) => { if (it.amount > 0) { income += it.amount; got[nameOf(it)] = true; } });
  const payDue = Object.values(pays).filter((x) => !got[x.key] && x.day >= d - PROJ_LATE).sort((p, q) => p.day - q.day);
  const paySum = payDue.reduce((s, x) => s + x.amount, 0);

  // the month's running total day by day: what is written up to today, then what each later day is expected to add
  // (a written day what it holds; an empty one its day of the week and its share of the big buys; a bill on its
  // day, a late one tomorrow; the rest of today goes with tomorrow). path[0] is the month's start.
  const billOn = {};
  billsDue.forEach((b) => { const dd = Math.min(dim, Math.max(b.day, d + 1)); billOn[dd] = (billOn[dd] || 0) + b.amount; });
  const path = [0];
  for (let dd = 1; dd <= dim; dd++) {
    const add = dd <= d ? onDay[dd] || 0
      : (written[dd] ? onDay[dd] || 0 : byDow[new Date(y, m, dd).getDay()] + (openDays ? big / openDays : 0)) + (billOn[dd] || 0) + (dd === d + 1 ? todayMore : 0);
    path.push(path[dd - 1] + add);
  }

  const toCome = everyday + big + billSum + planned;
  const endSpend = spent + toCome, endIncome = income + paySum;
  return {
    dim, daysLeft, openDays, spent, income, toCome, endSpend, endIncome, endLeft: endIncome - endSpend, sd: Math.sqrt(variance),
    everyday, todayMore, big, bigN, bigFrom, bigEach, bigPerMonth: bigRate * 30, bigNow, bigMore, bigMonths: counts.length,
    planned, billsDue, billSum, payDue, paySum,
    weekday: (byDow[1] + byDow[2] + byDow[3] + byDow[4] + byDow[5]) / 5, weekend: (byDow[0] + byDow[6]) / 2, nWd, nWe, byDow, daysRead: days.length, path,
  };
};
/* ---------- month-end projection: end of the maths ---------- */

/* The projection as a path through the month: what is spent so far (solid), what the days to come are expected to
   add (dashed), the range the month should end in four times in five (the cone, opening from today), and the
   month's income as the ceiling, with what is left (or short) marked at the end. Bills that are due sit on their
   day. Drawn at the size it is given (1 unit = 1px), like the PnL analysis charts; the pointer's day is its own
   state, so moving over it redraws nothing else. */
const ProjChart = ({ p, tone, hasInc, band, fmt, monthName }) => {
  const box = useRef(null);
  const [w, setW] = useState(0);
  const [hot, setHot] = useState(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setW(Math.round(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 208, PT = 16, PB = 26, PR = 16, ih = H - PT - PB;
  const { path, dim } = p, d = dim - p.daysLeft;
  const ticks = niceTicks(0, Math.max(p.endSpend + band, hasInc ? p.endIncome : 0, 1), 4);
  const top = ticks[ticks.length - 1];
  const PL = Math.max(30, Math.max(...ticks.map((v) => fmt(v).length)) * 6.5 + 15), iw = Math.max(40, w - PL - PR);
  const r1 = (x) => Math.round(x * 10) / 10;
  const X = (day) => r1(PL + (day / dim) * iw), Y = (v) => r1(PT + (1 - Math.min(v, top) / top) * ih);
  // a smooth step from day to day that never overshoots a day's value
  const curve = (pts) => pts.map(([x, y], i) => { if (!i) return `M${x} ${y}`; const mid = r1((pts[i - 1][0] + x) / 2); return `C${mid} ${pts[i - 1][1]} ${mid} ${y} ${x} ${y}`; }).join("");
  // so far: from the y-axis, a little under the first day's figure (CHART_LEAD), to today
  const done = [[X(0), Y(path[1] * CHART_LEAD)]], todo = [], hiEdge = [], loEdge = [];
  for (let i = 1; i <= d; i++) done.push([X(i), Y(path[i])]);
  for (let i = d; i <= dim; i++) {
    const spread = p.daysLeft ? band * Math.sqrt((i - d) / p.daysLeft) : 0;
    todo.push([X(i), Y(path[i])]);
    hiEdge.push(`${X(i)} ${Y(path[i] + spread)}`);
    loEdge.push(`${X(i)} ${Y(Math.max(path[d], path[i] - spread))}`);
  }
  const xEnd = X(dim), yEnd = Y(path[dim]), yInc = Y(p.endIncome), xNow = X(d);
  const bills = p.billsDue.map((b) => { const day = Math.min(dim, Math.max(b.day, d + 1)); return { ...b, x: X(day), y: Y(path[day]) }; });
  const pays = p.payDue.map((x) => ({ ...x, x: X(Math.min(dim, Math.max(x.day, d + 1))) }));
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const day = Math.max(1, Math.min(dim, Math.round((((e.clientX - r.left) / r.width) * w - PL) / iw * dim)));
    setHot((h) => (h === day ? h : day));
  };
  const gap = Math.abs(yInc - yEnd);
  return (
    <div ref={box} className="an-plot proj-plot" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHot(null)}>
      {w > 0 && (
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
          <defs><clipPath id="pj-wipe"><rect className="pj-wipe" x={xNow} y="0" width={Math.max(1, w - xNow)} height={H} /></clipPath></defs>
          {ticks.map((v, i) => (
            <g key={v} className="axis-fade" style={{ animationDelay: `${40 + i * 30}ms` }}>
              {/* the x-axis is the one unbroken line; the levels above it are dashed */}
              {i === 0 ? <line x1={PL} y1={Y(0)} x2={w - PR} y2={Y(0)} stroke="#c7cdd2" strokeWidth="1" />
                       : <line x1={PL} y1={Y(v)} x2={w - PR} y2={Y(v)} stroke="#3a3f44" strokeWidth="1" strokeDasharray="4 4" />}
              <text x={PL - 9} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end">{fmt(v)}</text>
            </g>
          ))}
          {hasInc && (
            <g className="axis-fade" style={{ animationDelay: "200ms" }}>
              <line x1={PL} y1={yInc} x2={w - PR} y2={yInc} stroke="#3ddc97" strokeOpacity="0.75" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" />
              <text x={PL + 8} y={yInc - 7} fill="#8fd7a4" fontSize="11" fontWeight="600">Income {fmt(p.endIncome)}</text>
              {pays.map((x) => <circle key={x.key} cx={x.x} cy={yInc} r="3.5" fill="#1d2024" stroke="#3ddc97" strokeWidth="1.5"><title>{`${prettyName(x.desc || x.key).replace("No description", "Income")} ${fmt(x.amount)}, around the ${nth(x.day)}`}</title></circle>)}
            </g>
          )}
          {/* today */}
          <line className="axis-fade" x1={xNow} y1={PT} x2={xNow} y2={Y(0)} stroke="#62696f" strokeWidth="1" strokeDasharray="2 4" style={{ animationDelay: "260ms" }} />
          <g className="axis-fade" style={{ animationDelay: "120ms" }} fill="#8a9299" fontSize="11">
            {xNow - PL > 64 && <text x={PL} y={H - 8}>1 {monthName}</text>}
            {xEnd - xNow > 78 && <text x={xNow} y={H - 8} textAnchor={xNow - PL > 64 ? "middle" : "start"} fill="#c7cdd2">Today</text>}
            <text x={xEnd} y={H - 8} textAnchor="end">{dim} {monthName}</text>
          </g>
          {/* what is still to come is uncovered from today towards the month's end, once the line so far is drawn */}
          {p.daysLeft > 0 && (
            <g clipPath="url(#pj-wipe)">
              <path d={`M${hiEdge.join("L")}L${[...loEdge].reverse().join("L")}Z`} fill={tone} fillOpacity="0.10" />
              <path d={curve(todo)} fill="none" stroke="#e8eaec" strokeOpacity="0.8" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
              {bills.map((b) => <circle key={b.key} cx={b.x} cy={b.y} r="3.5" fill="#1d2024" stroke="#ff8d97" strokeWidth="1.5"><title>{`${prettyName(b.desc || b.key)} ${fmt(b.amount)}, around the ${nth(b.day)}`}</title></circle>)}
            </g>
          )}
          {d > 0 && <path className="an-line" pathLength="1" d={curve(done)} fill="none" stroke="#e8eaec" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
          <circle className="pj-now" cx={xNow} cy={Y(path[d])} r="3.5" fill="#e8eaec" />
          {/* the end: what is left under the income, or how far over it */}
          <g className="pj-end">
            {hasInc && gap > 14 && <line x1={xEnd} y1={yInc} x2={xEnd} y2={yEnd} stroke={tone} strokeWidth="2" strokeLinecap="round" />}
            <circle cx={xEnd} cy={yEnd} r="4.5" fill={tone} stroke="#1d2024" strokeWidth="1.5" />
            {hasInc && gap > 26 && <text x={xEnd - 9} y={(yInc + yEnd) / 2 + 4} fill={tone} fontSize="11.5" fontWeight="700" textAnchor="end">{fmt(Math.abs(p.endLeft))} {p.endLeft >= 0 ? "left" : "short"}</text>}
          </g>
          {hot !== null && (
            <g pointerEvents="none">
              <line x1={X(hot)} y1={PT} x2={X(hot)} y2={Y(0)} stroke="#8a9299" strokeWidth="1" />
              <circle cx={X(hot)} cy={Y(path[hot])} r="4" fill="#e8eaec" stroke="#1d2024" strokeWidth="1.5" />
            </g>
          )}
        </svg>
      )}
      {w > 0 && hot !== null && <GlassTip x={X(hot)} y={Y(path[hot])} W={w} H={H} label={`${hot} ${monthName}${hot > d ? " · expected" : ""}`} value={fmt(path[hot])} below={Y(path[hot]) < 70} />}
    </div>
  );
};

const REEL = ["menu", ...CAT_ORDER]; // menu, food, transport, shopping, bills, other
const SLOT = 22;

/* Vertical reel: switching categories scrolls through the icons in order,
   passing every icon in between. Defined outside so transitions persist. */
const CatReel = ({ cat, customIcon }) => {
  const idx = customIcon ? REEL.length : (cat ? REEL.indexOf(cat) : 0);
  const prev = useRef(idx);
  const dist = Math.max(1, Math.abs(idx - prev.current));
  useEffect(() => { prev.current = idx; }, [idx]);
  const dur = Math.min(0.13 * dist + 0.12, 0.72);
  return (
    <span style={{ position: "relative", width: 20, height: SLOT, overflow: "hidden", display: "block" }}>
      <span style={{ display: "block", transform: `translateY(${-idx * SLOT}px)`, transition: `transform ${dur}s cubic-bezier(0.45,0,0.2,1)` }}>
        {REEL.map((k) => (
          <span key={k} style={{ height: SLOT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {k === "menu" ? <HamburgerIcon /> : <span className="msym" style={{ fontSize: 17, color: "#c7cdd2" }}>{CATS[k].icon}</span>}
          </span>
        ))}
        <span style={{ height: SLOT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {customIcon ? <span className="msym" style={{ fontSize: 17, color: "#e3b341" }}>{customIcon}</span> : null}
        </span>
      </span>
    </span>
  );
};

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect className="pi-h" x="2.5" y="7" width="11" height="2" rx="1" fill="currentColor" />
    <rect className="pi-v" x="7" y="2.5" width="2" height="11" rx="1" fill="currentColor" />
  </svg>
);
const MinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16">
    <rect className="pi-h" x="2.5" y="7" width="11" height="2" rx="1" fill="currentColor" />
  </svg>
);

/* ===================== TRADING PnL TRACKER =====================
   The two trading sides: crypto, reached from the coin, and Indonesian stocks (IDX/IHSG), reached from the globe.
   Both are the same tracker (TradeTracker), laid out exactly like the finance side (yearly panel, monthly panel,
   day panel, cards, chart pop-up, wrapped) and built from the same styles and animations. What it counts is closed
   trades: each has a realised PnL (a profit or a loss), a name (a pair, or a stock) and, for crypto, a side.
   What differs between the two is listed in MARKETS. Each keeps its data under its own key, never mixed with the
   other's or with the spending data. It is a component of its own, so nothing in here can disturb the finance panels. */
const CRYPTO_KEY = "pnl-crypto-usd";
const MAX_PNL = 1e9;                  // $1 billion on one trade: far above any real entry
const C_GREEN = "#3ddc97", C_RED = "#ff5d6c", C_MUTE = "#8a9299";

// dollars, compact: 8.05 · 124.5 · 1,235 · 12.3K · 1.23M
const usdAbs = (n) => {
  const v = Math.round(Math.abs(n) * 100) / 100;
  const cut = (x, dp) => String(+(Math.floor(x * 10 ** dp + 1e-6) / 10 ** dp).toFixed(dp));
  if (v >= 1e6) return cut(v / 1e6, 2) + "M";
  if (v >= 1e4) return cut(v / 1e3, v >= 1e5 ? 0 : 1) + "K";
  if (v >= 1e3) return Math.round(v).toLocaleString("en-US");
  return cut(v, v >= 100 ? 1 : 2);
};
// while a number is counting it keeps a steady precision, so its width doesn't jitter: in K and M as liveText says,
// under $1,000 the precision of the end that rests there (the one it lands on, if both do)
const usdLive = (n, busy, span) => {
  if (!busy || !span) return usdAbs(n);
  const v = Math.abs(n), from = Math.abs(span.from), to = Math.abs(span.to);
  if (v >= 1e3) return liveText(v, from, to, LIVE_UNITS.USDT, false) ?? usdAbs(n);
  const dps = (x) => (usdAbs(x).split(".")[1] || "").length;
  return v.toFixed(to < 1e3 ? dps(to) : from < 1e3 ? dps(from) : 0);
};
const signOf = (n) => (n > 0 ? "+" : n < 0 ? "-" : "");
const pnlOf = (str) => { const v = parseFloat(str); return Number.isFinite(v) ? Math.min(Math.round(v * 100) / 100, MAX_PNL) : 0; };
const winPct = (s) => (s.n ? Math.round((s.wins / s.n) * 100) : 0);
const tradesWord = (n) => `${n} ${n === 1 ? "trade" : "trades"}`;

// what is typed for a pair → "BTC", "BTC/USDT", "1000PEPE"
const pairName = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 14);
// the coin a pair is about: BTCUSDT, BTC/USDT and BTCPERP all count as BTC
const coinOf = (pair) => String(pair || "").replace(/\/.*$/, "").replace(/(USDT|USDC|USD|PERP)$/, "") || String(pair || "").replace(/\/.*$/, "");
const COIN_TINT = { BTC: "#f7931a", ETH: "#8c9eff", SOL: "#b07cff", BNB: "#f3ba2f", XRP: "#c7cdd2", DOGE: "#d9bd62", ADA: "#5b8def",
                    AVAX: "#ef6a6a", LINK: "#5c84f0", SUI: "#6fbcff", PEPE: "#6cc24a", TON: "#39a9eb", HYPE: "#7ee8d0", BONK: "#f5a524" };
const coinTint = (coin) => COIN_TINT[coin] || `hsl(${[...coin].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)} 52% 70%)`;

/* the journal's own fields on a trade (crypto), each kept only when it is filled in and makes sense:
   tp = how far the full TP is from the entry in %, risk = how far the stop is from the entry in % (the risk of that
   one trade, not the share of the account he risks), both to three decimals; tf = time frame, lev = leverage,
   rr = the R it made or lost, dur = how long it ran (as typed), pre = the plan before, note = the description after,
   imgs = the pictures attached (their ids, see "pictures on a trade") */
const TF_LIST = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"];
// each time frame has a muted colour of its own, cool for the short ones and warm for the long (he asked for the boxes to differ)
const TF_TINT = ["#8fd0d6", "#8fc4e0", "#9db4ea", "#b3a6e8", "#cfa0dc", "#e0a3bd", "#e3b08f", "#d9c486"];
const TF_LONG = "#b7cf9a";                                 // anything longer than a day
const TF_UNIT = { m: 1, h: 60, D: 1440, W: 10080, M: 43200 };
// a time frame as he types it ("45m", "2H", "3 d", "1w"; a capital M is a month), in the list's own spelling, or ""
const tfClean = (s) => {
  const m = /^\s*(\d{1,3})\s*([mhHdDwWM])\s*$/.exec(String(s ?? ""));
  if (!m || !+m[1]) return "";
  return `${+m[1]}${m[2] === "m" || m[2] === "M" ? m[2] : m[2] === "h" || m[2] === "H" ? "h" : m[2].toUpperCase()}`;
};
const tfMin = (tf) => parseInt(tf, 10) * TF_UNIT[tf.slice(-1)];
// one of his own takes the colour of the listed one nearest to it in length
const tfTint = (tf) => {
  const at = TF_LIST.indexOf(tf);
  if (at >= 0) return TF_TINT[at];
  const min = tfMin(tf);
  if (!(min > 0)) return TF_TINT[0];
  if (min > 1440) return TF_LONG;
  let best = 0;
  TF_LIST.forEach((t, i) => { if (Math.abs(Math.log(tfMin(t) / min)) < Math.abs(Math.log(tfMin(TF_LIST[best]) / min))) best = i; });
  return TF_TINT[best];
};
const SHOT_MAX = 6;                                        // pictures on one trade
const shotIdOk = (s) => typeof s === "string" && /^(ph:\d{1,9}|[a-z0-9-]{6,40})$/.test(s);
const journalOf = (it) => {
  const o = {};
  for (const [k, max, dp] of [["tp", 1e5, 3], ["risk", 100, 3], ["lev", 1000, 2], ["rr", 1000, 2]]) {
    const v = Number(it[k]);
    if (it[k] !== "" && it[k] != null && Number.isFinite(v) && v > 0) o[k] = roundTo(Math.min(v, max), dp);
  }
  const tf = tfClean(it.tf);
  if (tf) o.tf = tf;
  for (const [k, max] of [["dur", 16], ["pre", 400], ["note", 4000]]) {
    if (typeof it[k] === "string" && it[k].trim()) o[k] = it[k].trim().slice(0, max);
  }
  const imgs = Array.isArray(it.imgs) ? [...new Set(it.imgs.filter(shotIdOk))].slice(0, SHOT_MAX) : [];
  if (imgs.length) o.imgs = imgs;
  return o;
};
const NO_TRADES = [];

// loading/importing: keep only well-formed day keys and trades, so one bad item can't turn totals into NaN
const migrateTrades = (t, dp) => {
  const out = {};
  if (!t || typeof t !== "object") return out;
  for (const k in t) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(t[k])) continue;
    // a PnL of exactly 0 is a break-even trade (the journal's Breakeven); anything that isn't a number is dropped
    const items = t[k].filter((it) => it && typeof it === "object" && Number.isFinite(Number(it.pnl)) && (Number(it.pnl) !== 0 || it.pnl === 0)).map((it) => ({
      id: it.id || uid(), pnl: Math.max(-MAX_PNL * 1e4, Math.min(MAX_PNL * 1e4, roundTo(Number(it.pnl), dp))),
      pair: pairName(it.pair), side: it.side === "short" ? "short" : "long",
      ...journalOf(it),
      ...(it.be && Number(it.pnl) !== 0 ? { be: true } : {}),     // marked break-even though it closed a few dollars off
      ...(it.test ? { test: true } : {}),
    }));
    if (items.length) out[k] = items;
  }
  return out;
};
// money put into the trading account, or taken out of it (a minus), by day: "2026-10-02" -> [{ id, amt }]
const migrateDeps = (d, dp) => {
  const out = {};
  if (!d || typeof d !== "object") return out;
  for (const k in d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(d[k])) continue;
    const items = d[k].filter((it) => it && typeof it === "object" && Number.isFinite(Number(it.amt)) && Number(it.amt) !== 0)
      .map((it) => ({ id: it.id || uid(), amt: Math.max(-MAX_PNL * 1e4, Math.min(MAX_PNL * 1e4, roundTo(Number(it.amt), dp))) }));
    if (items.length) out[k] = items;
  }
  return out;
};
const NO_DEPS = [];
// the balance as saved: what he typed (never less than nothing), the day he typed it, and the moment
const cleanBal = (b) => (b && typeof b === "object" && Number.isFinite(b.v) && b.v >= 0 && b.v <= 2 * MAX_AMOUNT && /^\d{4}-\d{2}-\d{2}$/.test(b.at)
  ? { v: b.v, at: b.at, ts: Number.isFinite(b.ts) ? b.ts : 8.64e15 } : null);
// was this entry already part of the balance when it was typed? Anything for an earlier day, and what had been logged
// for that same day by then (an entry's id begins with the moment it was made). Whatever came after moves the balance
const inBal = (mark, day, id) => day < mark.at || (day === mark.at && !(parseInt(id, 10) > mark.ts));

// totals of a list of trades, added onto `acc`. profit and loss are both kept as positive sums
const newTally = () => ({ n: 0, wins: 0, losses: 0, profit: 0, loss: 0, pnl: 0 });
const tally = (list, acc = newTally()) => {
  for (const t of list) {
    acc.n++; acc.pnl += t.pnl;
    // a break-even trade is a trade, neither won nor lost: one at exactly 0, or one he marked break-even with the few
    // dollars it closed at (be). Those dollars still count in the sums
    if (t.be) { if (t.pnl > 0) acc.profit += t.pnl; else acc.loss -= t.pnl; }
    else if (t.pnl > 0) { acc.wins++; acc.profit += t.pnl; } else if (t.pnl < 0) { acc.losses++; acc.loss -= t.pnl; }
  }
  return acc;
};
// one month: its totals, each day's own totals (null for a day without trades), and its green and red days
const cryptoMonth = (trades, y, m) => {
  const dim = new Date(y, m + 1, 0).getDate();
  const tot = { ...newTally(), days: [], greenDays: 0, greenSum: 0, redDays: 0, redSum: 0 };
  for (let d = 1; d <= dim; d++) {
    const list = trades[keyOf(y, m, d)];
    if (!list || !list.length) { tot.days.push(null); continue; }
    const day = tally(list);
    tally(list, tot);
    tot.days.push(day);
    if (day.pnl >= 0) { tot.greenDays++; tot.greenSum += day.pnl; } else { tot.redDays++; tot.redSum += day.pnl; }
  }
  return tot;
};
const cryptoYear = (trades, y) => {
  const tot = { ...newTally(), months: [] };
  for (let m = 0; m < 12; m++) {
    const ms = cryptoMonth(trades, y, m);
    tot.months.push(ms);
    tot.n += ms.n; tot.wins += ms.wins; tot.losses += ms.losses; tot.profit += ms.profit; tot.loss += ms.loss; tot.pnl += ms.pnl;
  }
  return tot;
};

const TEST_COINS = ["BTC", "BTC", "BTC", "BTC", "ETH", "ETH", "ETH", "SOL", "SOL", "SOL", "BNB", "XRP", "DOGE", "SUI", "AVAX", "LINK", "PEPE", "HYPE"];

/* ---------- crypto tracker: currencies ----------
   Trades are always kept in USDT. The panel can show them in rupiah or ringgit instead: a view only, worked out
   with the rate of the moment (the latest one fetched while online, or one typed by hand in the calculator's
   hidden settings, or the built-in one until either exists). */
const CRYPTO_PREFS_KEY = "pnl-crypto-prefs";
const CUR_LIST = ["USDT", "IDR", "MYR"];
const CUR_SIGN = { USDT: "$", IDR: "Rp", MYR: "RM" };
const FX_DEFAULT = { IDR: 17900, MYR: 4.08 };       // 1 USDT on 2 October 2026: only used until a live or a typed rate exists
const FX_FRESH_MS = 60 * 1000;                      // a live rate younger than this is not fetched again
const CUR_TRIPLE_MS = 300;                          // clicks on the currency pill closer together than this count as one quick run
const fxOk = (c, v) => Number.isFinite(v) && (c === "IDR" ? v > 1000 && v < 1e6 : v > 1 && v < 100);
// an amount already in its currency, the short way the panels write it: $124.5 · 2,22jt · 449Rb · 1,2k
const curBody = (cur, amount) => {
  const v = Math.abs(amount);
  if (cur === "USDT") return usdAbs(v);
  const cut = (x, dp) => (Math.floor(x * 10 ** dp + 1e-6) / 10 ** dp).toString().replace(".", ",");
  if (cur === "MYR") return v >= 1e6 ? cut(v / 1e6, 2) + "M" : v >= 1e3 ? cut(v / 1e3, 1) + "k" : oneDp(v);
  return v >= 1e9 ? cut(v / 1e9, 2) + "M" : v >= 1e6 ? cut(v / 1e6, 2) + "jt" : v >= 1e3 ? cut(v / 1e3, 1) + "Rb" : String(Math.floor(v));
};
// the same while a number is counting: the resting units, each at one steady precision (see liveText)
const curLive = (cur, rate, n, busy, span) => {
  if (cur === "USDT") return usdLive(n, busy, span);
  const v = Math.abs(n) * rate;
  if (!busy || !span) return curBody(cur, v);
  return liveText(v, Math.abs(span.from) * rate, Math.abs(span.to) * rate, LIVE_UNITS[cur === "MYR" ? "MYR" : "IDRT"], true) ?? curBody(cur, v);
};
// the calculator writes amounts out in full: $6.68 · Rp119,742 · RM27.21, or shortened for its RR table: Rp190.9k
const NF2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const NF3 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const exactIn = (cur, amount) => CUR_SIGN[cur] + (cur === "IDR" ? NF0 : NF2).format(Math.abs(amount));
const shortIn = (cur, amount) => {
  const v = Math.abs(amount);
  return v >= 1e9 ? `${CUR_SIGN[cur]}${+(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${CUR_SIGN[cur]}${+(v / 1e6).toFixed(2)}M`
    : v >= 1e4 ? `${CUR_SIGN[cur]}${+(v / 1e3).toFixed(1)}k` : exactIn(cur, v);
};

const CurRoll = ({ idx }) => {
  const h = 17;
  return (
    <span style={{ display: "inline-block", height: h, overflow: "hidden", verticalAlign: "top", lineHeight: `${h}px` }}>
      <span style={{ display: "block", transform: `translateY(${-idx * h}px)`, transition: "transform .42s cubic-bezier(0.32,0.72,0.24,1)" }}>
        {CUR_LIST.map((c) => <span key={c} style={{ display: "block", height: h }}>{c}</span>)}
      </span>
    </span>
  );
};

/* A switch whose grey box slides from one choice to the other and takes that choice's width on the way (Rassam asked
   for the box to move, not to vanish and come back). Only transforms move: the box is two rounded pieces, each as
   wide as the whole switch, one clipping the other. The outer one slides to the choice's left edge; the inner one
   slides back inside it until its right end is on the choice's right edge. What shows is where the two overlap. */
const SlideSeg = ({ options, value, onPick, style }) => {
  const wrap = useRef(null), box = useRef(null), fill = useRef(null);
  useLayoutEffect(() => {
    const el = wrap.current, on = el.querySelector("button.on");
    if (!on) return;
    box.current.style.transform = `translateX(${on.offsetLeft}px)`;
    fill.current.style.transform = `translateX(${on.offsetWidth - el.clientWidth}px)`;
    // put in place without a move the first time; every switch after that slides
    if (!el.classList.contains("go")) requestAnimationFrame(() => el.classList.add("go"));
  }, [value]);
  return (
    <span className="wr-seg slide" style={style} ref={wrap}>
      <span className="seg-box" ref={box}><span className="seg-fill" ref={fill} /></span>
      {options.map(([v, label]) => <button key={v} className={v === value ? "on" : ""} onClick={() => onPick(v)}>{label}</button>)}
    </span>
  );
};

/* ---------- live prices: the latest price of the coin or stock typed in a calculator ----------
   Asked of the Mac app (the page itself can't reach the internet) a moment after the name is typed, then again every
   couple of seconds for as long as the calculator is open. Every price that arrives is remembered in the side's prefs
   (the `book` the tracker hands over), so the last one shows at once next time, and offline it is all there is.
   A plain browser has none. */
const QUOTE_MS = { crypto: 2000, idx: 5000 };        // how often a price is asked again
const QUOTE_MIN = { crypto: 2, idx: 4 };             // letters a name needs before it is asked (a stock code has four)
const QUOTE_WAIT_MS = 220;                           // typing has to pause this long first
const QUOTE_KEEP = 40;                               // prices remembered, newest first
const QUOTE_SAVE_MS = 15000;                         // they are written to the prefs this often at most
const quoteOk = (q) => !!q && typeof q.price === "string" && /^\d{1,14}(\.\d{1,14})?$/.test(q.price) && Number(q.price) > 0;
// what was saved from an earlier session, made safe to show again
const cleanQuotes = (list) => (Array.isArray(list) ? list : []).filter((q) => quoteOk(q) && typeof q.s === "string" && /^[A-Z0-9]{2,12}$/.test(q.s) && q.at > 0)
  .slice(0, QUOTE_KEEP).map((q) => ({ s: q.s, price: q.price, chg: Number.isFinite(q.chg) ? q.chg : null, src: String(q.src || "").slice(0, 20), late: q.late > 0 ? Number(q.late) : 0, at: Number(q.at) }));
// when something was fetched: "Friday 2 Oct, 11:27 PM"
const stampText = (at) => {
  const t = new Date(at);
  return `${t.toLocaleDateString("en-US", { weekday: "long" })} ${t.getDate()} ${MONTHS_SHORT[t.getMonth()]}, ${t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};
// the line in a calculator's settings: when this side's data was last fetched, and what is being used while offline
const dataNote = (book, word, quote) => {
  if (!book.can) return `Live ${word} data is fetched in the Mac app.`;
  const at = book.at();
  const off = quote.off || (typeof navigator !== "undefined" && navigator.onLine === false);
  if (!at) return off ? `Offline. No ${word} data has been fetched yet.` : `No ${word} data fetched yet.`;
  const from = quote.q && quote.q.src ? ` Prices: ${quote.q.src}${quote.q.late ? `, about ${Math.round(quote.q.late / 60)} minutes behind the exchange` : ""}.` : "";
  return off ? `Offline. Using the ${word} data fetched ${stampText(at)}.` : `Updated ${word} data at ${stampText(at)}.${from}`;
};
const NO_QUOTE = { q: null, live: false, off: false };
/* The price of `symbol`: { q, live, off }. q is { price (text, as the exchange writes it), chg (% today), src, late
   (seconds behind the exchange), at }, or null when there is none. live: it is from this moment; otherwise it is the
   remembered one. off: the last ask did not get through. */
const useQuote = (book, symbol) => {
  const on = book.can && symbol.length >= QUOTE_MIN[book.market];
  const [got, setGot] = useState({ sym: "", q: null, off: false });
  useEffect(() => {
    if (!on) return;
    let dead = false, timer = 0;
    const again = () => { if (!dead) timer = setTimeout(ask, QUOTE_MS[book.market]); };
    const ask = () => {
      if (document.hidden) { again(); return; }
      window.flowFX.quote(book.market, symbol).then((r) => {
        if (dead) return;
        if (quoteOk(r)) {
          const q = { price: r.price, chg: Number.isFinite(r.chg) ? r.chg : null, src: String(r.src || ""), late: r.late > 0 ? r.late : 0, at: Date.now() };
          book.put(symbol, q);
          // nothing to redraw unless the price, the change or the minute it was fetched in has moved
          setGot((p) => (p.sym === symbol && p.q && !p.off && p.q.price === q.price && p.q.chg === q.chg && Math.floor(p.q.at / 60000) === Math.floor(q.at / 60000) ? p : { sym: symbol, q, off: false }));
        } else if (r && r.none) setGot((p) => (p.sym === symbol && !p.q && !p.off ? p : { sym: symbol, q: null, off: false }));
        else setGot((p) => (p.sym === symbol && p.off ? p : { sym: symbol, q: book.get(symbol), off: true }));
      }).catch(() => {}).finally(again);
    };
    timer = setTimeout(ask, QUOTE_WAIT_MS);
    return () => { dead = true; clearTimeout(timer); };
  }, [symbol, on]);
  if (!on) return NO_QUOTE;
  if (got.sym !== symbol) return { q: book.get(symbol), live: false, off: false };      // not answered yet: the remembered price
  return { q: got.q, live: !!got.q && !got.off, off: got.off };
};
// the price at the right end of the coin or stock box: a green dot while it is live, grey for a remembered one.
// A press writes it into the entry
const QuoteChip = ({ quote, text, change, onPick }) => {
  const { q, live } = quote;
  if (!q) return null;
  const tip = `${live ? "Latest price" : "Last price fetched"}, ${q.src}${q.late ? ` (about ${Math.round(q.late / 60)} minutes behind the exchange)` : ""} · ${stampText(q.at)}. Click to use it.`;
  return (
    <button className={`pc-live${live ? "" : " old"}`} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={onPick} title={tip}>
      <i />{text}{change && <em className={q.chg > 0 ? "up" : q.chg < 0 ? "dn" : undefined}>{change}</em>}
    </button>
  );
};

/* ---------- position calculator: the maths ----------
   From the levels, the risk and the highest leverage allowed:
   - the position has to be exactly big enough that being stopped out loses the risk: size = risk / distance to the stop
   - the margin (IM) is $1 whenever it can be, so the leverage is the size itself, to two decimals, never under 1x
     and never over the maximum
   - where the leverage is held at 1x or at the maximum, the margin gives instead: IM = size / leverage, to three decimals
   Everything shown is then worked out again from that rounded leverage and margin, the two numbers that get typed
   into the exchange, so the figures are what the position will really do.
   Targets are taken in the order the price reaches them, nearest to the entry first, whatever order they were typed
   in. Each partial target closes a share of the whole position; a blank one is skipped and the rest move up a number.
   The full TP closes whatever is still open; with no full TP the furthest partial target stands in for it.
   Levels that can't be right (a stop on the wrong side of the entry, a target that closes nothing, ...) are not
   worked out: they come back as errors that name the box. */
const CALC_IM = 1;                                   // the margin every position starts from, in USDT
const CALC_MAX_LEV = 1000;                           // no exchange goes higher: a bigger number is a slip of the finger
const roundTo = (v, dp) => Number(v.toFixed(dp));       // exact to the last decimal kept, at any size
const numOf = (s) => { const v = parseFloat(s); return Number.isFinite(v) ? v : 0; };
// what is typed in a number box: digits and one decimal point. A comma typed is a decimal point. In something pasted
// ("$64,250.50", "1,234,567", "1.234,56") the separators that only group thousands are dropped instead
const numIn = (raw, dp, pasted) => {
  let v = String(raw).trim();
  if (pasted) {
    const dot = v.lastIndexOf("."), comma = v.lastIndexOf(",");
    if (dot >= 0 && comma >= 0) v = dot > comma ? v.replace(/,/g, "") : v.replace(/\./g, "");
    else if (/^\D*\d{1,3}(,\d{3})+\D*$/.test(v)) v = v.replace(/,/g, "");
  }
  const parts = v.replace(/,/g, ".").replace(/[^\d.]/g, "").split(".");
  return (parts.shift() + (parts.length ? "." + parts.join("").slice(0, dp) : "")).slice(0, 18);
};
// the targets in the order the price reaches them. Close % stay with their place in the list: the first target hit
// closes what the first filled box says, the second what the second says. The furthest one is the full TP (slot "full")
const orderTargets = (entry, tps, fullTp, fullText) => {
  const filled = tps.map((t, i) => ({ ...t, i })).filter((t) => t.price > 0);
  const prices = filled.map((t) => ({ price: t.price, text: t.text }));
  if (fullTp > 0) prices.push({ price: fullTp, text: fullText });
  prices.sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));
  const parts = fullTp > 0 ? filled.length : filled.length - 1;
  return prices.map((p, k) => (k < parts ? { ...p, slot: filled[k].i, close: filled[k].close } : { ...p, slot: "full" }));
};
// the same order written back into the boxes (as typed text), when Enter is pressed
const arrangeTargets = (f) => {
  const slots = f.tps.map((t, i) => i).filter((i) => numOf(f.tps[i].price) > 0);
  const hasFull = numOf(f.full) > 0;
  const texts = [...slots.map((i) => f.tps[i].price), ...(hasFull ? [f.full] : [])];
  const entry = numOf(f.entry);
  texts.sort((a, b) => Math.abs(numOf(a) - entry) - Math.abs(numOf(b) - entry));
  const tps = f.tps.map((t) => ({ ...t }));
  slots.forEach((i, k) => { tps[i].price = texts[k]; });
  return { ...f, tps, full: hasFull ? texts[texts.length - 1] : f.full };
};
const calcPosition = ({ entry, sl, risk, maxLev, tps = [], fullTp = 0, fullText, side }) => {
  const errors = [];
  const err = (fields, msg) => errors.push({ fields, msg });
  if (!(entry > 0)) err(["entry"], "Entry is missing.");
  if (!(sl > 0)) err(["sl"], "Stop loss is missing.");
  else if (sl === entry) err(["sl"], "Stop loss is the same as the entry.");
  if (!(risk > 0)) err(["risk"], "Risk $ is missing.");
  if (!(maxLev > 0)) err(["maxLev"], "Max leverage is missing.");
  else if (maxLev < 1) err(["maxLev"], "Max leverage can't be under 1x.");
  else if (maxLev > CALC_MAX_LEV) err(["maxLev"], `Max leverage is over ${CALC_MAX_LEV}x. Check the number.`);
  if (!(entry > 0)) return { errors };

  // which way the trade goes: locked by hand, or read from the levels. The targets decide; the stop settles a tie
  const named = tps.map((t, i) => ({ price: t.price, close: t.close, field: `tp${i}`, name: `TP${i + 1}`, i })).filter((t) => t.price > 0);
  const parts = fullTp > 0 ? [...named] : named.slice(0, -1);     // with no full TP the last partial stands in for it: its % is not used
  if (fullTp > 0) named.push({ price: fullTp, field: "full", name: "Full TP" });
  const slDir = sl > 0 && sl !== entry ? (sl < entry ? 1 : -1) : 0;
  const auto = side !== "long" && side !== "short";
  const lean = named.filter((t) => t.price > entry).length - named.filter((t) => t.price < entry).length + slDir / 2;
  const dir = !auto ? (side === "long" ? 1 : -1) : Math.sign(lean);
  if (!dir) return { errors, auto };                              // nothing to read a side from yet
  const word = dir > 0 ? "long" : "short";
  if (slDir && slDir !== dir) err(["sl"], `Stop loss is ${sl > entry ? "above" : "below"} the entry. On a ${word} it has to be ${dir > 0 ? "below" : "above"}.`);
  named.forEach((t) => {
    if (t.price === entry) err([t.field], `${t.name} is the same as the entry.`);
    else if ((t.price > entry ? 1 : -1) !== dir) err([t.field], `${t.name} is ${t.price > entry ? "above" : "below"} the entry. On a ${word} every target has to be ${dir > 0 ? "above" : "below"}.`);
  });
  parts.forEach((t) => {
    if (!(t.close > 0)) err([`close${t.i}`], `${t.name} closes 0%. Give it a share of the position, or empty its price.`);
    else if (t.close > 100) err([`close${t.i}`], `${t.name} closes more than 100%.`);
  });
  const share = parts.reduce((s, t) => s + (t.close > 0 ? t.close : 0), 0);
  if (share > 100 + 1e-9 && parts.every((t) => !(t.close > 100))) {
    err(parts.map((t) => `close${t.i}`), `The partial targets close ${+share.toFixed(2)}% together, more than the whole position.`);
  }
  if (errors.length) return { errors, long: dir > 0, auto };

  const move = (price) => ((price - entry) / entry) * dir;        // how far a price is from the entry, in the trade's favour
  const slDist = -move(sl);
  const want = risk / slDist;                                     // the size that loses exactly the risk at the stop
  if (want < 0.0005) return { errors: [{ fields: ["risk"], msg: "Risk $ is too small for this stop: no position is that small." }], long: dir > 0, auto };
  const lev = roundTo(Math.min(Math.max(want / CALC_IM, 1), maxLev), 2);
  const im = Math.max(roundTo(want / lev, 3), 0.001);
  const size = im * lev;
  let open = 100;                                                 // % of the position still open
  const targets = orderTargets(entry, tps, fullTp, fullText).map((t, k) => {
    const close = t.slot === "full" ? open : Math.min(t.close, open);
    open = Math.max(0, roundTo(open - close, 6));
    return { label: t.slot === "full" ? "Full TP" : `TP${k + 1}`, price: t.price, text: t.text, move: move(t.price), full: size * move(t.price),
             close, open, pnl: (size * move(t.price) * close) / 100 };
  });
  const lossAtSl = size * slDist;
  const total = targets.reduce((s, t) => s + t.pnl, 0);
  const last = targets[targets.length - 1];
  const rr = [];
  if (targets.length > 1) rr.push({ label: `${targets.map((t) => +t.close.toFixed(2)).join("/")} partials`, profit: total });
  if (last) rr.push({ label: "100% → Full TP", profit: last.full });
  return {
    errors, long: dir > 0, auto, lev, im, size, qty: size / entry, slMove: -slDist, risk: lossAtSl,
    targets, partials: Math.max(0, targets.length - 1), total, split: targets.map((t) => `${+t.close.toFixed(2)}%`).join(" / "),
    rr: rr.map((r) => ({ ...r, ratio: r.profit / lossAtSl })),
  };
};

/* ---------- position calculator: the pop-up ---------- */
// made-up levels for the "Test levels" button: [coin, a price it trades near, decimals of its price, its max leverage]
const CALC_TEST_COINS = [["BTC", 118400, 1, 125], ["ETH", 4320, 2, 100], ["SOL", 182, 2, 75], ["AVAX", 11.09, 3, 75], ["DOGE", 0.2413, 5, 75],
                         ["XRP", 2.843, 4, 75], ["SUI", 3.512, 4, 50], ["LINK", 21.77, 3, 50], ["PEPE", 0.00001234, 8, 50], ["HYPE", 48.2, 3, 20]];
const CALC_BLANK = { coin: "", side: "", entry: "", sl: "", risk: "", riskCur: "USDT", maxLev: "", tps: [{ price: "", close: "25" }, { price: "", close: "30" }], full: "" };
const CALC_DP = 12;                                  // decimals a price box takes: enough for the smallest coins
// what was saved from an earlier session, made safe to show again
const cleanCalc = (c) => {
  const str = (v) => (typeof v === "string" ? v.slice(0, 18) : "");
  if (!c || typeof c !== "object") return CALC_BLANK;
  const tps = (Array.isArray(c.tps) ? c.tps : []).slice(0, 8).map((t) => ({ price: numIn(str(t && t.price), CALC_DP), close: numIn(str(t && t.close), 2) }));
  while (tps.length < 2) tps.push({ price: "", close: CALC_BLANK.tps[tps.length].close });
  const riskCur = CUR_LIST.includes(c.riskCur) ? c.riskCur : "USDT";       // the currency the risk box was left in
  return { coin: str(c.coin).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12), side: c.side === "long" || c.side === "short" ? c.side : "",
           entry: numIn(str(c.entry), CALC_DP), sl: numIn(str(c.sl), CALC_DP), risk: riskCur === "IDR" ? idrIn(str(c.risk)) : numIn(str(c.risk), 2), riskCur, maxLev: numIn(str(c.maxLev), 2),
           tps, full: numIn(str(c.full), CALC_DP) };
};
// a quantity without an exponent: 6,583,468 · 7.325 · 0.003122 · 0.000008333
const qtyText = (q) => {
  if (q >= 1000) return NF0.format(q);
  if (q >= 1) return String(+q.toFixed(3));
  return q > 0 ? q.toFixed(Math.min(14, 3 - Math.floor(Math.log10(q)))).replace(/0+$/, "").replace(/\.$/, "") : "0";
};

/* Both calculators: what Enter brings up arrives line by line, the top line first and each one PC_LINE_MS after the
   one above, so a whole plan is there in well under half a second. The lines are the direct children of .pc-res and
   .pc-err, and nth-child gives each its turn (PC_LINE_CSS, written into the stylesheet), so nothing is numbered in
   the JSX. A line plays it once, when it appears: results already on show stay still while the levels are typed. */
const PC_LINE_MS = 12;                               // between one line and the next
const PC_LINE_LAST = 26;                             // from this line down they all come together, so a long plan is no slower
const PC_LINE_CSS = Array.from({ length: PC_LINE_LAST - 1 }, (_, i) => i + 2).map((n) =>
  `.pc-res > :nth-child(${n === PC_LINE_LAST ? `n+${n}` : n}), .pc-err > :nth-child(${n === PC_LINE_LAST ? `n+${n}` : n}) { animation-delay: ${(n - 1) * PC_LINE_MS}ms; }`).join("\n        ");
/* The pop-up eases to its new height when the results or the form get longer or shorter, where it used to jump. Run
   after every render: the height the two columns want is read, and when that has changed the body goes from the
   height it has on screen at that moment (so a change in the middle of a move carries on from where it is) to the
   new one. Written straight to the element; no state, so it costs a render nothing. Height is layout, but of one
   small pop-up for a quarter of a second, and a box can't be resized with a transform without stretching what is in it. */
const PC_FIT_MS = 240;
const useEaseHeight = () => {
  const ref = useRef(null), want = useRef(null), timer = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let to = 0;
    for (const kid of el.children) to = Math.max(to, parseFloat(getComputedStyle(kid).height) || 0);
    const was = want.current;
    want.current = to;
    if (was === null || Math.abs(to - was) < 1) return;
    const from = el.style.height ? parseFloat(getComputedStyle(el).height) : was;
    el.style.transition = "none";
    el.style.overflow = "clip";                      // what doesn't fit yet stays out of sight (the last lines are still on their way in)
    el.style.height = `${from}px`;
    void el.offsetHeight;                            // the starting height has to be in place before the move is set off
    el.style.transition = `height ${PC_FIT_MS}ms cubic-bezier(0.22,1,0.36,1)`;
    el.style.height = `${to}px`;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { el.style.height = ""; el.style.overflow = ""; el.style.transition = ""; }, PC_FIT_MS + 40);
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  return ref;
};

const PositionCalc = ({ draft, onSaved, onClose, cur, cur2, onCurClick, onCur2Click, rateOf, fx, canFetch, onRate, live }) => {
  const [f, setF] = useState(draft.current.inputs);
  const [shown, setShown] = useState(draft.current.shown);   // Enter has been pressed once: from then on the results follow the levels as they are typed
  const [strict, setStrict] = useState(false);               // Enter was pressed on levels that can't be right: the errors stay up until they are fixed
  const [closing, setClosing] = useState(false);
  const [tools, setTools] = useState(false);                 // the hidden rate settings
  const [rateText, setRateText] = useState({});
  const lastGood = useRef(null);
  const formRef = useRef(null);
  const fitRef = useEaseHeight();
  useEffect(() => { formRef.current?.querySelector("input")?.focus(); }, []);

  const update = (next) => { draft.current.inputs = next; setF(next); };
  const set = (patch) => update({ ...f, ...patch });
  const setTp = (i, patch) => update({ ...f, tps: f.tps.map((t, k) => (k === i ? { ...t, ...patch } : t)) });

  /* The risk is typed in the main currency (Risk $, Risk IDR, Risk MYR). Switching the currency, here or on the panel
     while this was closed, exchanges what is in the box at the rate of the moment; an empty box only changes its label.
     Rupiah are whole and grouped (44.750), as on the stocks side. The maths still gets the risk in USDT. */
  const rc = f.riskCur || "USDT", riskRate = rateOf(rc);
  const riskOf = (c, text) => (c === "IDR" ? idrOf(text) : numOf(text));
  const riskText = (c, v) => (c === "IDR" ? idrText(v) : String(+v.toFixed(2)));
  const riskUsd = useRef(null);            // the risk before it was rounded into another currency, so switching back gives the number he typed
  useLayoutEffect(() => {
    if (rc === cur) return;
    const typed = riskOf(rc, f.risk);
    if (!(typed > 0)) { update({ ...f, riskCur: cur }); return; }
    const usd = riskUsd.current ?? typed / riskRate;
    riskUsd.current = usd;
    update({ ...f, risk: riskText(cur, usd * rateOf(cur)), riskCur: cur });
  }, [cur]);
  const riskName = `Risk ${rc === "USDT" ? "$" : rc}`;
  const say = (msg) => (rc === "USDT" ? msg : msg.replace("Risk $", riskName));       // the maths words its errors in dollars

  const work = (g) => calcPosition({
    entry: numOf(g.entry), sl: numOf(g.sl), risk: riskOf(rc, g.risk) / riskRate, maxLev: numOf(g.maxLev), side: g.side,
    tps: g.tps.map((t) => ({ price: numOf(t.price), close: numOf(t.close), text: t.price })), fullTp: numOf(g.full), fullText: g.full,
  });
  const res = useMemo(() => work(f), [f, riskRate]);
  const ok = res.errors.length === 0;
  if (ok) lastGood.current = res;
  // the coin's latest price: grey in the empty entry box, and what Enter takes for an entry left empty
  const quote = useQuote(live, f.coin);
  const livePrice = quote.q ? numIn(quote.q.price, CALC_DP) : "";
  const withLive = (g) => (livePrice && !g.entry ? { ...g, entry: livePrice } : g);
  useEffect(() => { if (strict && ok) setStrict(false); }, [strict, ok]);
  // what the right-hand side shows: the results; the errors (after an Enter that failed); or, when a level is only
  // half typed, the last good results dimmed with the reason on top
  const panel = !shown ? "empty" : ok ? "res" : strict || !lastGood.current ? "err" : "stale";
  const r = panel === "res" ? res : panel === "stale" ? lastGood.current : null;
  const wrong = new Set(panel === "err" ? res.errors.flatMap((e) => e.fields) : []);
  const bad = (field) => (wrong.has(field) ? " bad" : "");
  // without a full TP the last filled partial target stands in for it; otherwise the full TP closes what the partials leave
  const filled = f.tps.map((t, i) => i).filter((i) => numOf(f.tps[i].price) > 0);
  const hasFull = numOf(f.full) > 0;
  const standIn = hasFull || !filled.length ? -1 : filled[filled.length - 1];
  const rest = Math.max(0, 100 - filled.reduce((s, i) => s + (i === standIn ? 0 : Math.max(numOf(f.tps[i].close), 0)), 0));

  const close = () => { onSaved(draft.current.inputs, draft.current.shown); setClosing(true); setTimeout(onClose, 190); };
  const submit = () => {
    setShown(true); draft.current.shown = true;
    const g = withLive(f);
    if ((g === f ? res : work(g)).errors.length) { if (g !== f) update(g); setStrict(true); return; }
    const tidy = arrangeTargets(g);                          // targets typed out of order are put in the order the price reaches them
    update(tidy);
    onSaved(tidy, true);
  };
  const clear = () => {
    update({ ...f, coin: "", side: "", entry: "", sl: "", full: "", tps: f.tps.map((t) => ({ ...t, price: "" })) });
    setShown(false); draft.current.shown = false; lastGood.current = null; setStrict(false);
    formRef.current?.querySelector("input")?.focus();
  };
  // Enter calculates wherever the focus is, except in the rate settings and on the corner buttons; Esc steps back out
  const keys = useRef(null);
  keys.current = (e) => {
    if (e.key === "Escape") { if (tools) setTools(false); else close(); return; }
    if (e.key !== "Enter") return;
    const at = document.activeElement;
    if (at && at.closest && (at.closest(".pc-head") || at.classList.contains("pc-go"))) return;
    e.preventDefault(); submit();
  };
  useEffect(() => {
    const onKey = (e) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // test tool: a made-up trade on a real-looking coin (long or short, a stop 0.6% to 5% away, three targets), calculated at once
  const testLevels = () => {
    const [coin, near, dp, maxLev] = CALC_TEST_COINS[Math.floor(Math.random() * CALC_TEST_COINS.length)];
    const dir = Math.random() < 0.6 ? 1 : -1;
    const entry = near * (0.97 + Math.random() * 0.06), stop = 0.006 + Math.random() * 0.044;
    const at = (move) => (entry * (1 + dir * move)).toFixed(dp);
    const tps = f.tps.map((t, i) => ({ close: t.close, price: i < 2 ? at(stop * (i ? 2.2 + Math.random() : 1.2 + Math.random() * 0.8)) : "" }));
    update({ coin, side: "", entry: entry.toFixed(dp), sl: at(-stop), risk: f.risk || riskText(rc, (1 + Math.floor(Math.random() * 9) / 2) * riskRate), riskCur: rc,
             maxLev: String(maxLev), tps, full: at(stop * (3.4 + Math.random() * 2)) });
    setShown(true); draft.current.shown = true; setStrict(false);
  };
  const keepFocus = (e) => e.preventDefault();               // on the helper buttons: a click must not take the focus from the box being typed in
  const pasted = (e) => /^insert(FromPaste|FromDrop|ReplacementText)$/.test(e.nativeEvent.inputType || "");
  const price = (field, v, onChange, ghost) => (
    <input className={`pc-in${bad(field)}`} data-f={field} inputMode="decimal" value={v} placeholder={ghost || "0"}
           onChange={(e) => onChange(numIn(e.target.value, CALC_DP, pasted(e)))} />
  );
  const goTo = (field) => formRef.current?.querySelector(`[data-f="${field}"]`)?.focus();

  // amounts in the results: the main currency, then the second one in brackets
  const k1 = rateOf(cur), k2 = rateOf(cur2);
  const amount = (v, short) => {
    const sign = Math.abs(v * k1) < (cur === "IDR" ? 0.5 : 0.005) ? "" : v > 0 ? "+" : "-";
    return (
      <span className={sign === "+" ? "pc-pos" : sign === "-" ? "pc-neg" : undefined}>
        {sign}{exactIn(cur, v * k1)}
        <span className="pc-2nd"> (≈ {v < 0 && sign ? "-" : ""}{(short || Math.abs(v * k2) >= 1e8 ? shortIn : exactIn)(cur2, v * k2)})</span>
      </span>
    );
  };
  const pct = (m) => `${m >= 0 ? "+" : "-"}${Math.abs(m * 100).toFixed(2)}%`;
  const coin = f.coin || "—";
  const sideWord = res.long === undefined ? "" : res.long ? "long" : "short";
  const manual = fx.manual.IDR || fx.manual.MYR;
  const fxNote = manual ? "Typed by hand. Empty a box to go back to the live rate."
    : fx.live ? `Live rate, fetched ${stampText(fx.live.at)}.`
    : canFetch ? "No live rate yet (offline). This is the built-in rate." : "Built-in rate. Live rates are fetched in the Mac app.";

  return (
    <div style={{ ...S.backdrop, animation: closing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={close}>
      <div className="glass pc-modal" style={{ ...S.modal, animation: closing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="pc-head">
          <span style={S.panelTitle}>Calculator</span>
          <button className="cur-btn" style={{ ...S.currency, marginLeft: 6 }} title="Main currency · click: USDT ⇄ IDR · three quick clicks: MYR" onClick={onCurClick}>
            <CurRoll idx={CUR_LIST.indexOf(cur)} />
          </button>
          {panel !== "empty" && (
            <button className="cur-btn pc-cur2" style={{ ...S.currency, marginLeft: 0 }} title="Second currency, shown in brackets" onClick={onCur2Click}>
              ≈ <CurRoll idx={CUR_LIST.indexOf(cur2)} />
            </button>
          )}
          <span className="pc-tools">
            {/* hidden until the pointer is in this corner: the exchange rates */}
            <button className={`pc-gear${tools ? " on" : ""}`} style={S.closeBtn} title="Exchange rates" aria-label="Exchange rates"
                    onClick={() => { setRateText({}); setTools((t) => !t); }}>
              <span className="msym">settings</span>
            </button>
            <button className="x-btn" style={S.closeBtn} onClick={close}>✕</button>
            {tools && (
              <div className="pc-pop">
                <div className="pc-lab">Exchange rate</div>
                {["IDR", "MYR"].map((c) => (
                  <div key={c} className="pc-pop-row">
                    <span>1 USDT =</span>
                    <input className="pc-in" inputMode="decimal"
                           value={rateText[c] ?? String(+rateOf(c).toFixed(c === "IDR" ? 2 : 4))}
                           onChange={(e) => { const v = numIn(e.target.value, 4, pasted(e)); setRateText((t) => ({ ...t, [c]: v })); onRate(c, numOf(v)); }} />
                    <span>{c}</span>
                  </div>
                ))}
                <div className="pc-note">{fxNote}</div>
                <div className="pc-note">{dataNote(live, "crypto", quote)}</div>
              </div>
            )}
          </span>
        </div>

        <div className="pc-body" ref={fitRef}>
          <div className="pc-form" ref={formRef}>
            <div className="pc-line">
              <label>Coin</label>
              <span className="pc-coin">
                <input className="pc-in" value={f.coin} placeholder="BTC" spellCheck={false} autoCapitalize="characters"
                       onChange={(e) => set({ coin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) })} />
                <span className="pc-ghost" aria-hidden="true"><i>{f.coin || "BTC"}</i><b>/USDT.P</b></span>
                <QuoteChip quote={quote} text={quote.q && quote.q.price.replace(/^\d+/, (w) => NF0.format(Number(w)))} onPick={() => set({ entry: livePrice })}
                           change={quote.q && quote.q.chg !== null && f.coin.length <= 5 && `${quote.q.chg >= 0 ? "+" : "-"}${Math.abs(quote.q.chg).toFixed(2)}%`} />
              </span>
            </div>
            <div className="pc-line">
              <label>Side</label>
              {/* neither pressed: the side is read from the levels, and the one it reads lights up faintly */}
              <span className="pc-side">
                {["long", "short"].map((s) => (
                  <button key={s} tabIndex={-1} onMouseDown={keepFocus} className={`pc-side-b ${s}${f.side === s ? " on" : !f.side && sideWord === s ? " auto" : ""}`}
                          title={f.side === s ? `Locked to ${s}. Click to go back to automatic` : `Lock the position to a ${s}`}
                          onClick={() => set({ side: f.side === s ? "" : s })}>
                    {s}{!f.side && sideWord === s && <i>auto</i>}
                  </button>
                ))}
              </span>
            </div>
            <div className="pc-line"><label>Entry</label>{price("entry", f.entry, (v) => set({ entry: v }), livePrice)}</div>
            <div className="pc-line"><label>Stop loss</label>{price("sl", f.sl, (v) => set({ sl: v }))}</div>
            <div className="pc-line two">
              <label>{riskName}</label>
              <input className={`pc-in${bad("risk")}`} data-f="risk" inputMode="decimal" value={f.risk} placeholder="0" title={`What is lost if the stop is hit, in ${rc}`}
                     onChange={(e) => { riskUsd.current = null; set({ risk: rc === "IDR" ? idrIn(e.target.value, 0, pasted(e)) : numIn(e.target.value, 2, pasted(e)) }); }} />
              <label>Max lev</label>
              <span className="pc-unit">
                <input className={`pc-in${bad("maxLev")}`} data-f="maxLev" inputMode="decimal" value={f.maxLev} placeholder="0" title="The highest leverage this coin allows"
                       onChange={(e) => set({ maxLev: numIn(e.target.value, 2, pasted(e)) })} />
                <span>x</span>
              </span>
            </div>
            <div className="pc-rule" />
            {f.tps.map((t, i) => (
              <div key={i} className={`pc-line tp${i >= 2 ? " more" : ""}`}>
                <label>TP{i + 1}</label>
                {price(`tp${i}`, t.price, (v) => setTp(i, { price: v }))}
                <span className={`pc-unit${i === standIn ? " off" : ""}`}>
                  <input className={`pc-in${bad(`close${i}`)}`} data-f={`close${i}`} inputMode="decimal" value={t.close} placeholder="0"
                         title={i === standIn ? "There is no full TP, so this target stands in for it and closes whatever is left" : `How much of the position TP${i + 1} closes`}
                         onChange={(e) => setTp(i, { close: numIn(e.target.value, 2, pasted(e)) })} />
                  <span>%</span>
                </span>
                {i >= 2 && <button className="pc-x" tabIndex={-1} onMouseDown={keepFocus} title="Remove this target" onClick={() => update({ ...f, tps: f.tps.filter((_, k) => k !== i) })}>×</button>}
              </div>
            ))}
            {f.tps.length < 8 && (
              <button className="pc-add" tabIndex={-1} onMouseDown={keepFocus} onClick={() => update({ ...f, tps: [...f.tps, { price: "", close: "25" }] })}>+ Add partial TP</button>
            )}
            <div className="pc-line tp">
              <label>Full TP</label>
              {price("full", f.full, (v) => set({ full: v }))}
              <span className="pc-rest" title={hasFull || !filled.length ? "The full TP closes whatever is still open" : `Empty: TP${standIn + 1} stands in as the full TP`}>
                {hasFull || !filled.length ? `${+rest.toFixed(2)}%` : `= TP${standIn + 1}`}
              </span>
            </div>
            <div className="pc-go-row">
              <span style={{ display: "inline-flex", gap: 14 }}>
                <button className="pc-clear" tabIndex={-1} onMouseDown={keepFocus} onClick={clear} title="Empty the coin and the levels. Risk, max leverage and the close % stay">Clear levels</button>
                {SHOW_TEST_TOOLS && <button className="pc-clear test" tabIndex={-1} onMouseDown={keepFocus} onClick={testLevels} title="Fill in made-up levels to try the calculator. Your risk and close % stay">Test levels</button>}
              </span>
              <button className="pc-go" onClick={submit} title="Calculate (Enter)" aria-label="Calculate"><span className="msym">keyboard_return</span></button>
            </div>
          </div>

          {panel === "empty" ? (
            <div className="pc-empty">
              <span className="msym">calculate</span>
              <span>Entry, stop loss, risk and max leverage, then Enter.</span>
            </div>
          ) : panel === "err" ? (
            <div className="pc-err">
              <div className="pc-err-h"><span className="msym">error</span>Error</div>
              <div className="pc-err-sub">
                {res.errors.length === 1 ? "One box can't be right. It is marked in red." : `${res.errors.length} things can't be right. The boxes are marked in red.`}
                {sideWord && (res.auto ? ` Read as a ${sideWord} from your levels: lock Long or Short if that is wrong.` : ` Locked to a ${sideWord}.`)}
              </div>
              {res.errors.map((e, i) => (
                <button key={i} className="pc-err-row" tabIndex={-1} onMouseDown={keepFocus} onClick={() => goTo(e.fields[0])} title="Go to that box"><span>{i + 1}</span>{say(e.msg)}</button>
              ))}
            </div>
          ) : (
            <div className={`pc-res${panel === "stale" ? " stale" : ""}`}>
              {panel === "stale" && <div className="pc-why">Not updated: {say(res.errors[0].msg)}</div>}
              <div className="pc-res-head">
                <span className="pc-sym">{coin}<span>/USDT.P</span></span>
                <span className={`pc-dir ${r.long ? "long" : "short"}`}>{r.long ? "Long" : "Short"}</span>
              </div>
              <div className="pc-tiles">
                <div className="pc-tile glass-soft key"><div className="pc-tile-l">Leverage</div><div className="pc-tile-v">{+r.lev.toFixed(2)}x</div></div>
                <div className="pc-tile glass-soft key"><div className="pc-tile-l">IM</div><div className="pc-tile-v">${NF3.format(r.im)}</div></div>
                <div className="pc-tile glass-soft"><div className="pc-tile-l">Position size</div><div className="pc-tile-v">${NF2.format(r.size)}</div></div>
                <div className="pc-tile glass-soft"><div className="pc-tile-l">Quantity</div><div className="pc-tile-v">≈ {qtyText(r.qty)}<span> {coin}</span></div></div>
              </div>

              <div className="pc-title">Full-position PnL</div>
              <div className="pc-row h"><span>Level</span><span>Price</span><span>Move</span><span>Full-position PnL</span></div>
              <div className="pc-row"><span className="k">SL</span><span>{f.sl}</span><span>{pct(r.slMove)}</span><span>{amount(-r.risk)}</span></div>
              {r.targets.map((t) => (
                <div key={t.label} className="pc-row"><span className="k">{t.label}</span><span>{t.text}</span><span>{pct(t.move)}</span><span>{amount(t.full)}</span></div>
              ))}

              {r.partials > 0 && (
                <>
                  <div className="pc-title">Partial TP plan <span>— {r.split}</span></div>
                  <div className="pc-row h"><span>Target</span><span>Close</span><span>Remaining</span><span>Realized PnL</span></div>
                  {r.targets.map((t) => (
                    <div key={t.label} className="pc-row"><span className="k">{t.label} <i>@ {t.text}</i></span><span>{+t.close.toFixed(2)}%</span><span>{+t.open.toFixed(2)}%</span><span>{amount(t.pnl)}</span></div>
                  ))}
                  <div className="pc-row t"><span className="k">Total</span><span>100%</span><span>0%</span><span>{amount(r.total)}</span></div>
                </>
              )}

              {r.rr.length > 0 && (
                <>
                  <div className="pc-title">RR</div>
                  <div className="pc-row h rr"><span>Strategy</span><span>Profit</span><span>Risk</span><span>RR</span></div>
                  {r.rr.map((x) => (
                    <div key={x.label} className="pc-row rr">
                      <span className="k">{x.label}</span><span>{amount(x.profit, true)}</span><span>{exactIn(cur, r.risk * k1)}</span>
                      <span className="pc-rr">1 : {x.ratio.toFixed(2)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- stock calculator (IDX/IHSG): the maths ----------
   Indonesian stocks are bought in lots of 100 shares, in rupiah, with no leverage and no shorting, and the broker
   takes a fee on the way in and a bigger one (it carries the tax) on the way out. The lots are typed (he asked for
   lots in place of a risk amount), so the question is what they come to:
   - the money going in = lots × 100 × entry, and the same with the buy fee
   - one lot's loss at the stop = 100 × (entry with the buy fee − stop less the sell fee); the stop loses that × lots
   Every figure is net of both fees. Targets are taken nearest first, like the crypto calculator's; each sells whole
   lots (its share of the position, rounded to the lot), and the full TP sells whatever is still held.
   Averaging down: a holding (average price and lots) plus further buys gives the new average, step by step, and the
   price a sale then has to reach to break even with the fees. It also answers the question the other way round:
   how many lots at a price bring the average down to the one wanted. */
const IDX_LOT = 100;                                 // shares in a lot
const IDX_FEES = { buy: 0.15, sell: 0.25 };          // % of the trade's value: the usual broker fees, to be set to the broker's own
const idxTick = (p) => (p < 200 ? 1 : p < 500 ? 2 : p < 2000 ? 5 : p < 5000 ? 10 : 25);      // the step prices move in at each level
const idrText = (v) => Math.round(v).toLocaleString("id-ID");
// a rupiah box: digits, grouped the Indonesian way as they are typed (1.250.000). `dp` decimals after a comma where a
// price can have them (an average). Something pasted with separators that only group thousands is read as a whole number
const idrIn = (raw, dp = 0, pasted) => {
  let v = String(raw).trim();
  if (pasted && /^\D*\d{1,3}([.,]\d{3})+\D*$/.test(v)) v = v.replace(/[.,]/g, "");
  const [whole, ...rest] = v.replace(/[^\d,]/g, "").split(",");
  const grouped = whole.replace(/^0+(?=\d)/, "").slice(0, 13).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dp && rest.length ? `${grouped || "0"},${rest.join("").slice(0, dp)}` : grouped;
};
const idrOf = (s) => { const v = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const calcStock = ({ entry, sl, lots, tps = [], fullTp = 0, fullText, feeBuy = IDX_FEES.buy, feeSell = IDX_FEES.sell }) => {
  const errors = [];
  const err = (fields, msg) => errors.push({ fields, msg });
  if (!(entry > 0)) err(["entry"], "Entry is missing.");
  if (!(sl > 0)) err(["sl"], "Stop loss is missing.");
  else if (sl === entry) err(["sl"], "Stop loss is the same as the entry.");
  if (!(lots > 0)) err(["lots"], "Lots is missing.");
  else if (!Number.isInteger(lots)) err(["lots"], "Lots has to be a whole number: a stock is bought in whole lots.");
  if (!(entry > 0)) return { errors };
  const named = tps.map((t, i) => ({ price: t.price, close: t.close, field: `tp${i}`, name: `TP${i + 1}`, i })).filter((t) => t.price > 0);
  const parts = fullTp > 0 ? [...named] : named.slice(0, -1);     // with no full TP the last partial stands in for it: its % is not used
  if (fullTp > 0) named.push({ price: fullTp, field: "full", name: "Full TP" });
  if (sl > entry) err(["sl"], "Stop loss is above the entry. A stock is bought, so its stop has to be below.");
  named.forEach((t) => {
    if (t.price === entry) err([t.field], `${t.name} is the same as the entry.`);
    else if (t.price < entry) err([t.field], `${t.name} is below the entry. Every target has to be above.`);
  });
  parts.forEach((t) => {
    if (!(t.close > 0)) err([`close${t.i}`], `${t.name} sells 0%. Give it a share of the position, or empty its price.`);
    else if (t.close > 100) err([`close${t.i}`], `${t.name} sells more than 100%.`);
  });
  const share = parts.reduce((s, t) => s + (t.close > 0 ? t.close : 0), 0);
  if (share > 100 + 1e-9 && parts.every((t) => !(t.close > 100))) {
    err(parts.map((t) => `close${t.i}`), `The partial targets sell ${+share.toFixed(2)}% together, more than the whole position.`);
  }
  if (errors.length) return { errors };

  const fb = feeBuy / 100, fs = feeSell / 100;
  const cost = entry * (1 + fb);                                  // what a share costs, the buy fee in it
  const net = (price) => price * (1 - fs);                        // what a share brings when sold, the sell fee taken
  const lossLot = (cost - net(sl)) * IDX_LOT;                     // what one lot loses at the stop
  let held = lots;                                                // lots still held
  const targets = orderTargets(entry, tps, fullTp, fullText).map((t, k) => {
    const sold = t.slot === "full" ? held : Math.min(held, Math.round((lots * t.close) / 100));
    held -= sold;
    const gain = (net(t.price) - cost) * IDX_LOT;                 // one lot's profit there
    return { label: t.slot === "full" ? "Full TP" : `TP${k + 1}`, price: t.price, text: t.text, move: (t.price - entry) / entry, full: gain * lots,
             lots: sold, close: (sold / lots) * 100, held, open: (held / lots) * 100, pnl: gain * sold };
  });
  const loss = lots * lossLot;
  const total = targets.reduce((s, t) => s + t.pnl, 0);
  const last = targets[targets.length - 1];
  const rr = [];
  if (targets.length > 1) rr.push({ label: `${targets.map((t) => t.lots).join("/")} lots`, profit: total });
  if (last) rr.push({ label: "All → Full TP", profit: last.full });
  const notes = [];
  [["Entry", entry], ["Stop loss", sl], ...named.map((t) => [t.name, t.price])].forEach(([name, p]) => {
    if (p % idxTick(p)) notes.push(`${name} ${idrText(p)} is not on a price step: at this level prices move in steps of Rp${idxTick(p)}.`);
  });
  targets.forEach((t) => { if (t.label !== "Full TP" && !t.lots) notes.push(`${t.label} sells no lots: its share of ${lots} ${lots === 1 ? "lot" : "lots"} rounds to nothing.`); });
  return {
    errors, lots, shares: lots * IDX_LOT, value: lots * IDX_LOT * entry, paid: lots * IDX_LOT * cost, breakEven: cost / (1 - fs), slMove: (sl - entry) / entry,
    risk: loss, lossLot, targets, partials: Math.max(0, targets.length - 1), total, notes,
    split: targets.map((t) => `${t.lots} ${t.lots === 1 ? "lot" : "lots"}`).join(" / "), rr: rr.map((r) => ({ ...r, ratio: r.profit / loss })),
  };
};
const calcAverage = ({ avg, held, buys = [], target = 0, at = 0, feeBuy = IDX_FEES.buy, feeSell = IDX_FEES.sell }) => {
  const errors = [];
  const err = (fields, msg) => errors.push({ fields, msg });
  if (!(avg > 0)) err(["avg"], "Average price is missing.");
  if (!(held >= 1)) err(["held"], "Lots held is missing.");
  const rows = buys.map((b, i) => ({ ...b, i })).filter((b) => b.price > 0 || b.lots > 0);
  rows.forEach((b) => {
    if (!(b.price > 0)) err([`bp${b.i}`], `Buy ${b.i + 1} has lots but no price.`);
    else if (!(b.lots >= 1)) err([`bl${b.i}`], `Buy ${b.i + 1} has a price but no lots.`);
  });
  const aiming = target > 0 || at > 0;
  if (aiming && !(target > 0)) err(["target"], "The average to aim for is missing.");
  if (aiming && !(at > 0)) err(["at"], "The price to buy at is missing.");
  if (!rows.length && !aiming) err(["bp0"], "Add a buy (its price and lots), or an average to aim for.");
  if (errors.length) return { errors };

  const fb = feeBuy / 100, fs = feeSell / 100;
  const even = (a) => (a * (1 + fb)) / (1 - fs);                  // the price a sale has to reach to give back what was paid, both fees in
  let lots = held, paid = held * IDX_LOT * avg;                   // paid: the shares' own cost, fees aside (how a broker shows an average)
  const steps = [{ label: "Now", price: avg, lots: held, spend: 0, avg, total: held }];
  rows.forEach((b, k) => {
    const before = paid / (lots * IDX_LOT);
    lots += b.lots; paid += b.lots * IDX_LOT * b.price;
    steps.push({ label: `Buy ${k + 1}`, price: b.price, lots: b.lots, spend: b.lots * IDX_LOT * b.price * (1 + fb), avg: paid / (lots * IDX_LOT), total: lots, up: b.price > before });
  });
  const now = paid / (lots * IDX_LOT);                            // the average after the buys
  let aim = null;
  if (aiming) {
    if (!(target < now)) return { errors: [{ fields: ["target"], msg: `The average to aim for is not below your average${rows.length ? " after these buys" : ""} (${idrText(now)}). Buying lower can only pull it down.` }] };
    if (!(at < target)) return { errors: [{ fields: ["at"], msg: "The price to buy at has to be below the average you aim for." }] };
    const need = Math.ceil((lots * (now - target)) / (target - at) - 1e-9);          // whole lots: rounded up, so the average ends at or under the aim
    aim = { lots: need, spend: need * IDX_LOT * at * (1 + fb), avg: (paid + need * IDX_LOT * at) / ((lots + need) * IDX_LOT), total: lots + need, even: 0 };
    aim.even = even(aim.avg);
  }
  const last = rows.length ? rows[rows.length - 1].price : 0;     // the latest buy: the price the stock is at
  return {
    errors, steps, aim, avg: now, lots, shares: lots * IDX_LOT, invested: paid, spent: steps.reduce((s, x) => s + x.spend, 0),
    change: (now - avg) / avg, evenBefore: even(avg), even: even(now), last,
    riseBefore: last ? even(avg) / last - 1 : null, rise: last ? even(now) / last - 1 : null,
    floating: last ? (last - now) * lots * IDX_LOT : null,
  };
};

/* ---------- stock calculator (IDX/IHSG): the pop-up ---------- */
const STOCK_BLANK = { tab: "pos", coin: "", entry: "", sl: "", lots: "", tps: [{ price: "", close: "25" }, { price: "", close: "30" }], full: "",
                      avg: "", held: "", buys: [{ price: "", lots: "" }], target: "", at: "" };
// made-up levels for the "Test levels" button: [stock, a price it trades near]
const STOCK_TEST = [["BBCA", 8650], ["BBRI", 3920], ["BMRI", 4810], ["TLKM", 3080], ["ASII", 5625], ["ANTM", 3240], ["ADRO", 1865], ["GOTO", 63],
                    ["BREN", 7850], ["UNVR", 1640], ["MDKA", 2310], ["PGAS", 1705], ["BRIS", 2620], ["AMMN", 6975]];
const cleanStock = (c) => {
  const str = (v) => (typeof v === "string" ? v.slice(0, 20) : "");
  if (!c || typeof c !== "object") return STOCK_BLANK;
  const tps = (Array.isArray(c.tps) ? c.tps : []).slice(0, 8).map((t) => ({ price: idrIn(str(t && t.price)), close: numIn(str(t && t.close), 2) }));
  while (tps.length < 2) tps.push({ price: "", close: STOCK_BLANK.tps[tps.length].close });
  const buys = (Array.isArray(c.buys) ? c.buys : []).slice(0, 8).map((b) => ({ price: idrIn(str(b && b.price)), lots: idrIn(str(b && b.lots)) }));
  if (!buys.length) buys.push({ price: "", lots: "" });
  return { tab: c.tab === "avg" ? "avg" : "pos", coin: str(c.coin).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
           entry: idrIn(str(c.entry)), sl: idrIn(str(c.sl)), lots: idrIn(str(c.lots)), tps, full: idrIn(str(c.full)),
           avg: idrIn(str(c.avg), 2), held: idrIn(str(c.held)), buys, target: idrIn(str(c.target), 2), at: idrIn(str(c.at)) };
};
const NFID2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const StockCalc = ({ draft, onSaved, onClose, fees, onFees, live }) => {
  const [f, setF] = useState(draft.current.inputs);
  const [shown, setShown] = useState(draft.current.shown);   // Enter has been pressed once: from then on the results follow what is typed
  const [strict, setStrict] = useState(false);               // Enter was pressed on numbers that can't be right: the errors stay up until they are fixed
  const [closing, setClosing] = useState(false);
  const [tools, setTools] = useState(false);                 // the hidden fee settings
  const [feeText, setFeeText] = useState({});
  const lastGood = useRef({});
  const formRef = useRef(null);
  const fitRef = useEaseHeight();
  useEffect(() => { formRef.current?.querySelector("input")?.focus(); }, []);

  const update = (next) => { draft.current.inputs = next; setF(next); };
  const set = (patch) => update({ ...f, ...patch });
  const setTp = (i, patch) => update({ ...f, tps: f.tps.map((t, k) => (k === i ? { ...t, ...patch } : t)) });
  const setBuy = (i, patch) => update({ ...f, buys: f.buys.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const pos = f.tab === "pos";

  const work = (g) => (g.tab === "pos"
    ? calcStock({ entry: idrOf(g.entry), sl: idrOf(g.sl), lots: idrOf(g.lots), fullTp: idrOf(g.full), fullText: g.full,
                  tps: g.tps.map((t) => ({ price: idrOf(t.price), close: numOf(t.close), text: t.price })), feeBuy: fees.buy, feeSell: fees.sell })
    : calcAverage({ avg: idrOf(g.avg), held: idrOf(g.held), buys: g.buys.map((b) => ({ price: idrOf(b.price), lots: idrOf(b.lots) })),
                    target: idrOf(g.target), at: idrOf(g.at), feeBuy: fees.buy, feeSell: fees.sell }));
  const res = useMemo(() => work(f), [f, fees]);
  // the stock's latest price: grey in the empty entry box (and in "Buying at"), and what Enter takes for one left empty
  const quote = useQuote(live, f.coin);
  const livePrice = quote.q ? idrIn(quote.q.price) : "";
  const withLive = (g) => (!livePrice ? g : g.tab === "pos" ? (g.entry ? g : { ...g, entry: livePrice }) : g.target && !g.at ? { ...g, at: livePrice } : g);
  const pickLive = () => {
    if (pos) { set({ entry: livePrice }); return; }
    const empty = f.buys.findIndex((b) => !b.price);                 // averaging down: the first buy without a price, else "Buying at"
    if (empty >= 0) setBuy(empty, { price: livePrice }); else set({ at: livePrice });
  };
  // what the lots come to, as they are typed: at the entry, or at the latest price while the entry is still empty
  const lotsAt = idrOf(f.entry) || idrOf(livePrice), lotsWorth = idrOf(f.lots) * IDX_LOT * lotsAt;
  const ok = res.errors.length === 0;
  if (ok) lastGood.current[f.tab] = res;
  useEffect(() => { if (strict && ok) setStrict(false); }, [strict, ok]);
  const good = lastGood.current[f.tab];
  const panel = !shown ? "empty" : ok ? "res" : strict || !good ? "err" : "stale";
  const r = panel === "res" ? res : panel === "stale" ? good : null;
  const wrong = new Set(panel === "err" ? res.errors.flatMap((e) => e.fields) : []);
  const bad = (field) => (wrong.has(field) ? " bad" : "");
  const filled = f.tps.map((t, i) => i).filter((i) => idrOf(f.tps[i].price) > 0);
  const hasFull = idrOf(f.full) > 0;
  const standIn = hasFull || !filled.length ? -1 : filled[filled.length - 1];
  const rest = Math.max(0, 100 - filled.reduce((s, i) => s + (i === standIn ? 0 : Math.max(numOf(f.tps[i].close), 0)), 0));

  const close = () => { onSaved(draft.current.inputs, draft.current.shown); setClosing(true); setTimeout(onClose, 190); };
  const submit = () => {
    setShown(true); draft.current.shown = true;
    const g = withLive(f);
    if (g !== f) update(g);
    if ((g === f ? res : work(g)).errors.length) { setStrict(true); return; }
    if (!pos) { onSaved(g, true); return; }
    // targets typed out of order are put in the order the price reaches them
    const tidy = arrangeTargets({ ...g, entry: String(idrOf(g.entry)), tps: g.tps.map((t) => ({ ...t, price: t.price && String(idrOf(t.price)) })), full: g.full && String(idrOf(g.full)) });
    const next = { ...g, tps: tidy.tps.map((t) => ({ ...t, price: idrIn(t.price) })), full: idrIn(tidy.full) };
    update(next);
    onSaved(next, true);
  };
  const clear = () => {
    update(pos ? { ...f, coin: "", entry: "", sl: "", lots: "", full: "", tps: f.tps.map((t) => ({ ...t, price: "" })) }
               : { ...f, coin: "", avg: "", held: "", buys: [{ price: "", lots: "" }], target: "", at: "" });
    setShown(false); draft.current.shown = false; lastGood.current = {}; setStrict(false);
    formRef.current?.querySelector("input")?.focus();
  };
  // test tool: made-up numbers on a real-looking stock, on its price steps, calculated at once
  const testLevels = () => {
    const [coin, near] = STOCK_TEST[Math.floor(Math.random() * STOCK_TEST.length)];
    const snap = (p) => { const t = idxTick(p); return idrIn(String(Math.max(t, Math.round(p / t) * t))); };
    const entry = near * (0.96 + Math.random() * 0.08), stop = 0.02 + Math.random() * 0.06;
    if (pos) {
      update({ ...f, coin, entry: snap(entry), sl: snap(entry * (1 - stop)), lots: f.lots || String(1 + Math.floor(Math.random() * 40)),
               tps: f.tps.map((t, i) => ({ close: t.close, price: i < 2 ? snap(entry * (1 + stop * (i ? 2.3 + Math.random() : 1.2 + Math.random() * 0.8))) : "" })),
               full: snap(entry * (1 + stop * (3.5 + Math.random() * 2))) });
    } else {
      const held = 5 + Math.floor(Math.random() * 40), more = Math.max(1, Math.round(held * (0.3 + Math.random())));
      const avg = idrOf(snap(entry)), down = idrOf(snap(entry * (1 - 0.06 - Math.random() * 0.12))), lower = idrOf(snap(down * 0.95));
      update({ ...f, coin, avg: idrIn(String(avg)), held: String(held), buys: [{ price: idrIn(String(down)), lots: String(more) }],
               target: snap(((held * avg + more * down) / (held + more) + lower) / 2), at: idrIn(String(lower)) });
    }
    setShown(true); draft.current.shown = true; setStrict(false);
  };
  // Enter calculates wherever the focus is, except in the fee settings and on the corner buttons; Esc steps back out
  const keys = useRef(null);
  keys.current = (e) => {
    if (e.key === "Escape") { if (tools) setTools(false); else close(); return; }
    if (e.key !== "Enter") return;
    const at = document.activeElement;
    if (at && at.closest && (at.closest(".pc-head") || at.classList.contains("pc-go"))) return;
    e.preventDefault(); submit();
  };
  useEffect(() => {
    const onKey = (e) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const keepFocus = (e) => e.preventDefault();
  const pasted = (e) => /^insert(FromPaste|FromDrop|ReplacementText)$/.test(e.nativeEvent.inputType || "");
  const box = (field, v, onChange, dp, hint, ghost) => (
    <input className={`pc-in${bad(field)}`} data-f={field} inputMode={dp ? "decimal" : "numeric"} value={v} placeholder={ghost || "0"} title={hint}
           onChange={(e) => onChange(idrIn(e.target.value, dp, pasted(e)))} />
  );
  const goTo = (field) => formRef.current?.querySelector(`[data-f="${field}"]`)?.focus();
  const rp = (v) => `Rp${idrText(Math.abs(v))}`;
  const amount = (v) => {
    const sign = Math.abs(v) < 0.5 ? "" : v > 0 ? "+" : "-";
    return <span className={sign === "+" ? "pc-pos" : sign === "-" ? "pc-neg" : undefined}>{sign}{rp(v)}</span>;
  };
  const pct = (m, dp = 2) => `${m >= 0 ? "+" : "-"}${Math.abs(m * 100).toFixed(dp).replace(".", ",")}%`;
  const lotsWord = (n) => `${NFID2.format(n)} ${n === 1 ? "lot" : "lots"}`;
  const coin = f.coin || "—";

  return (
    <div style={{ ...S.backdrop, animation: closing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={close}>
      <div className="glass pc-modal" style={{ ...S.modal, animation: closing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="pc-head">
          <span style={S.panelTitle}>Calculator</span>
          <SlideSeg style={{ marginLeft: 8 }} value={f.tab} onPick={(tab) => { set({ tab }); setStrict(false); }} options={[["pos", "Position"], ["avg", "Average down"]]} />
          <span className="pc-tools">
            {/* hidden until the pointer is in this corner: the broker's fees */}
            <button className={`pc-gear${tools ? " on" : ""}`} style={S.closeBtn} title="Broker fees" aria-label="Broker fees"
                    onClick={() => { setFeeText({}); setTools((t) => !t); }}>
              <span className="msym">settings</span>
            </button>
            <button className="x-btn" style={S.closeBtn} onClick={close}>✕</button>
            {tools && (
              <div className="pc-pop">
                <div className="pc-lab">Broker fees</div>
                {[["buy", "On a buy"], ["sell", "On a sell"]].map(([k, name]) => (
                  <div key={k} className="pc-pop-row">
                    <span>{name}</span>
                    <input className="pc-in" inputMode="decimal" value={feeText[k] ?? String(fees[k])}
                           onChange={(e) => { const v = numIn(e.target.value, 3); setFeeText((t) => ({ ...t, [k]: v })); onFees(k, v === "" ? null : numOf(v)); }} />
                    <span>%</span>
                  </div>
                ))}
                <div className="pc-note">Of the trade's value. The sell fee carries the 0.1% tax. Empty a box to go back to {IDX_FEES.buy}% and {IDX_FEES.sell}%.</div>
                <div className="pc-note">{dataNote(live, "stock", quote)}</div>
              </div>
            )}
          </span>
        </div>

        <div className="pc-body" ref={fitRef}>
          <div className="pc-form" ref={formRef}>
            <div className="pc-line">
              <label>Stock</label>
              <span className="pc-coin">
                <input className="pc-in" value={f.coin} placeholder="BBCA" spellCheck={false} autoCapitalize="characters"
                       onChange={(e) => set({ coin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) })} />
                <QuoteChip quote={quote} text={livePrice} onPick={pickLive}
                           change={quote.q && quote.q.chg !== null && `${quote.q.chg >= 0 ? "+" : "-"}${Math.abs(quote.q.chg).toFixed(2).replace(".", ",")}%`} />
              </span>
            </div>
            {pos ? (
              <>
                <div className="pc-line"><label>Entry</label>{box("entry", f.entry, (v) => set({ entry: v }), 0, undefined, livePrice)}</div>
                <div className="pc-line"><label>Stop loss</label>{box("sl", f.sl, (v) => set({ sl: v }))}</div>
                <div className="pc-line lots">
                  <label>Lots</label>{box("lots", f.lots, (v) => set({ lots: v }), 0, "How many lots to buy. A lot is 100 shares")}
                  {/* the lots in rupiah, as they are typed */}
                  <span className={`pc-conv${lotsWorth > 0 ? "" : " off"}`}
                        title={lotsWorth > 0 ? `${idrText(idrOf(f.lots) * IDX_LOT)} shares at ${idrText(lotsAt)}${f.entry ? "" : " (the latest price)"} · Rp${idrText(lotsWorth * (1 + fees.buy / 100))} with the buy fee` : "Lots × 100 shares × the entry"}>
                    = <b>Rp{idrText(lotsWorth)}</b>
                  </span>
                </div>
                <div className="pc-rule" />
                {f.tps.map((t, i) => (
                  <div key={i} className={`pc-line tp${i >= 2 ? " more" : ""}`}>
                    <label>TP{i + 1}</label>
                    {box(`tp${i}`, t.price, (v) => setTp(i, { price: v }))}
                    <span className={`pc-unit${i === standIn ? " off" : ""}`}>
                      <input className={`pc-in${bad(`close${i}`)}`} data-f={`close${i}`} inputMode="decimal" value={t.close} placeholder="0"
                             title={i === standIn ? "There is no full TP, so this target stands in for it and sells whatever is left" : `How much of the position TP${i + 1} sells`}
                             onChange={(e) => setTp(i, { close: numIn(e.target.value, 2, pasted(e)) })} />
                      <span>%</span>
                    </span>
                    {i >= 2 && <button className="pc-x" tabIndex={-1} onMouseDown={keepFocus} title="Remove this target" onClick={() => update({ ...f, tps: f.tps.filter((_, k) => k !== i) })}>×</button>}
                  </div>
                ))}
                {f.tps.length < 8 && (
                  <button className="pc-add" tabIndex={-1} onMouseDown={keepFocus} onClick={() => update({ ...f, tps: [...f.tps, { price: "", close: "25" }] })}>+ Add partial TP</button>
                )}
                <div className="pc-line tp">
                  <label>Full TP</label>
                  {box("full", f.full, (v) => set({ full: v }))}
                  <span className="pc-rest" title={hasFull || !filled.length ? "The full TP sells whatever is still held" : `Empty: TP${standIn + 1} stands in as the full TP`}>
                    {hasFull || !filled.length ? `${+rest.toFixed(2)}%` : `= TP${standIn + 1}`}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="pc-line two">
                  <label>Avg price</label>{box("avg", f.avg, (v) => set({ avg: v }), 2, "Your average price now")}
                  <label>Lots</label>{box("held", f.held, (v) => set({ held: v }), 0, "Lots you hold now")}
                </div>
                <div className="pc-rule" />
                {f.buys.map((b, i) => (
                  <div key={i} className={`pc-line tp buy${i >= 1 ? " more" : ""}`}>
                    <label>Buy {i + 1}</label>
                    {box(`bp${i}`, b.price, (v) => setBuy(i, { price: v }), 0, "The price of this buy")}
                    <span className="pc-unit">{box(`bl${i}`, b.lots, (v) => setBuy(i, { lots: v }), 0, "Lots bought")}<span>lot</span></span>
                    {i >= 1 && <button className="pc-x" tabIndex={-1} onMouseDown={keepFocus} title="Remove this buy" onClick={() => update({ ...f, buys: f.buys.filter((_, k) => k !== i) })}>×</button>}
                  </div>
                ))}
                {f.buys.length < 8 && (
                  <button className="pc-add" tabIndex={-1} onMouseDown={keepFocus} onClick={() => update({ ...f, buys: [...f.buys, { price: "", lots: "" }] })}>+ Add a buy</button>
                )}
                <div className="pc-rule" />
                <div className="pc-lab pc-cap" title="Leave both empty if you only want the buys above worked out">Or: how many lots get the average down to…</div>
                <div className="pc-line two">
                  <label>Aim avg</label>{box("target", f.target, (v) => set({ target: v }), 2, "The average you want to get down to")}
                  <label>Buying at</label>{box("at", f.at, (v) => set({ at: v }), 0, "The price you would buy at to get there", livePrice)}
                </div>
              </>
            )}
            <div className="pc-go-row">
              <span style={{ display: "inline-flex", gap: 14 }}>
                <button className="pc-clear" tabIndex={-1} onMouseDown={keepFocus} onClick={clear} title="Empty this page's numbers. The sell % stay">Clear</button>
                {SHOW_TEST_TOOLS && <button className="pc-clear test" tabIndex={-1} onMouseDown={keepFocus} onClick={testLevels} title="Fill in made-up numbers to try the calculator">Test levels</button>}
              </span>
              <button className="pc-go" onClick={submit} title="Calculate (Enter)" aria-label="Calculate"><span className="msym">keyboard_return</span></button>
            </div>
          </div>

          {panel === "empty" ? (
            <div className="pc-empty">
              <span className="msym">calculate</span>
              <span>{pos ? "Entry, stop loss and lots, then Enter." : "Your average and lots, a buy or an average to aim for, then Enter."}</span>
            </div>
          ) : panel === "err" ? (
            <div className="pc-err">
              <div className="pc-err-h"><span className="msym">error</span>Error</div>
              <div className="pc-err-sub">{res.errors.length === 1 ? "One box can't be right. It is marked in red." : `${res.errors.length} things can't be right. The boxes are marked in red.`}</div>
              {res.errors.map((e, i) => (
                <button key={i} className="pc-err-row" tabIndex={-1} onMouseDown={keepFocus} onClick={() => goTo(e.fields[0])} title="Go to that box"><span>{i + 1}</span>{e.msg}</button>
              ))}
            </div>
          ) : pos ? (
            <div key="pos" className={`pc-res${panel === "stale" ? " stale" : ""}`}>
              {panel === "stale" && <div className="pc-why">Not updated: {res.errors[0].msg}</div>}
              <div className="pc-res-head"><span className="pc-sym">{coin}</span><span className="pc-dir long">Buy</span><span className="pc-held">{lotsWord(r.lots)} = {idrText(r.shares)} shares</span></div>
              <div className="pc-tiles">
                <div className="pc-tile glass-soft key"><div className="pc-tile-l">Buy value</div><div className="pc-tile-v">{rp(r.value)}</div></div>
                <div className="pc-tile glass-soft key"><div className="pc-tile-l">With the buy fee</div><div className="pc-tile-v">{rp(r.paid)}</div></div>
                <div className="pc-tile glass-soft"><div className="pc-tile-l">Loss at the stop</div><div className="pc-tile-v">{rp(r.risk)}</div></div>
                <div className="pc-tile glass-soft"><div className="pc-tile-l">Break-even price</div><div className="pc-tile-v">{NFID2.format(r.breakEven)}</div></div>
              </div>
              {r.notes.map((n) => <div key={n} className="pc-hint">{n}</div>)}

              <div className="pc-title">Full-position PnL <span>— after fees</span></div>
              <div className="pc-row h"><span>Level</span><span>Price</span><span>Move</span><span>Full-position PnL</span></div>
              <div className="pc-row"><span className="k">SL</span><span>{f.sl}</span><span>{pct(r.slMove)}</span><span>{amount(-r.risk)}</span></div>
              {r.targets.map((t) => (
                <div key={t.label} className="pc-row"><span className="k">{t.label}</span><span>{t.text}</span><span>{pct(t.move)}</span><span>{amount(t.full)}</span></div>
              ))}

              {r.partials > 0 && (
                <>
                  <div className="pc-title">Partial TP plan <span>— {r.split}</span></div>
                  <div className="pc-row h"><span>Target</span><span>Sell</span><span>Still held</span><span>Realized PnL</span></div>
                  {r.targets.map((t) => (
                    <div key={t.label} className="pc-row"><span className="k">{t.label} <i>@ {t.text}</i></span><span>{lotsWord(t.lots)}</span><span>{lotsWord(t.held)}</span><span>{amount(t.pnl)}</span></div>
                  ))}
                  <div className="pc-row t"><span className="k">Total</span><span>{lotsWord(r.lots)}</span><span>0 lots</span><span>{amount(r.total)}</span></div>
                </>
              )}

              {r.rr.length > 0 && (
                <>
                  <div className="pc-title">RR</div>
                  <div className="pc-row h rr"><span>Strategy</span><span>Profit</span><span>Risk</span><span>RR</span></div>
                  {r.rr.map((x) => (
                    <div key={x.label} className="pc-row rr">
                      <span className="k">{x.label}</span><span>{amount(x.profit)}</span><span>{rp(r.risk)}</span>
                      <span className="pc-rr">1 : {x.ratio.toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div key="avg" className={`pc-res${panel === "stale" ? " stale" : ""}`}>
              {panel === "stale" && <div className="pc-why">Not updated: {res.errors[0].msg}</div>}
              <div className="pc-res-head"><span className="pc-sym">{coin}</span><span className="pc-dir long">Average down</span></div>
              <div className="pc-tiles">
                <div className="pc-tile glass-soft key"><div className="pc-tile-l">New average</div><div className="pc-tile-v">{NFID2.format(r.avg)}<span> {r.steps.length > 1 ? pct(r.change) : ""}</span></div></div>
                <div className="pc-tile glass-soft key"><div className="pc-tile-l">Lots held</div><div className="pc-tile-v">{NFID2.format(r.lots)}<span> = {idrText(r.shares)} shares</span></div></div>
                <div className="pc-tile glass-soft"><div className="pc-tile-l">Money in the stock</div><div className="pc-tile-v">{rp(r.invested)}</div></div>
                <div className="pc-tile glass-soft"><div className="pc-tile-l">Break-even price</div><div className="pc-tile-v">{NFID2.format(r.even)}</div></div>
              </div>

              {r.steps.length > 1 && (
                <>
                  <div className="pc-title">Step by step</div>
                  <div className="pc-row h av"><span>Step</span><span>Price</span><span>Lots</span><span>Cost with fee</span><span>Average after</span></div>
                  {r.steps.map((x) => (
                    <div key={x.label} className="pc-row av">
                      <span className="k">{x.label}</span><span>{NFID2.format(x.price)}</span><span>{x.label === "Now" ? NFID2.format(x.lots) : `+${NFID2.format(x.lots)}`}</span>
                      <span>{x.spend ? rp(x.spend) : "—"}</span><span className={x.up ? "pc-neg" : undefined} style={{ fontWeight: 700 }}>{NFID2.format(x.avg)}</span>
                    </div>
                  ))}
                  <div className="pc-row t av"><span className="k">Total</span><span /><span>{NFID2.format(r.lots)}</span><span>{rp(r.spent)}</span><span>{NFID2.format(r.avg)}</span></div>
                  {r.steps.some((x) => x.up) && <div className="pc-hint">A buy above the average raises it (marked in red).</div>}

                  <div className="pc-title">Getting back to even <span>— after fees</span></div>
                  <div className="pc-row h av3"><span /><span>Before</span><span>After the buys</span></div>
                  <div className="pc-row av3"><span className="k">Break-even price</span><span>{NFID2.format(r.evenBefore)}</span><span style={{ fontWeight: 700 }}>{NFID2.format(r.even)}</span></div>
                  <div className="pc-row av3"><span className="k">Rise needed from {NFID2.format(r.last)}</span><span>{pct(r.riseBefore)}</span><span style={{ fontWeight: 700 }}>{pct(r.rise)}</span></div>
                  <div className="pc-row av3"><span className="k">Floating PnL at {NFID2.format(r.last)}</span><span /><span>{amount(r.floating)}</span></div>
                </>
              )}

              {r.aim && (
                <>
                  <div className="pc-title">To reach an average of {f.target} <span>— buying at {f.at}</span></div>
                  <div className="pc-row h av3"><span>Buy</span><span>Cost with fee</span><span>Average after</span></div>
                  <div className="pc-row av3"><span className="k">{lotsWord(r.aim.lots)} <i>= {idrText(r.aim.lots * IDX_LOT)} shares</i></span><span>{rp(r.aim.spend)}</span><span style={{ fontWeight: 700 }}>{NFID2.format(r.aim.avg)}</span></div>
                  <div className="pc-hint">You would then hold {lotsWord(r.aim.total)}, breaking even at {NFID2.format(r.aim.even)}.{r.steps.length > 1 ? " This is on top of the buys above." : ""}</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- trading side: PnL analysis, the first card under the calendar (after Bybit's P&L analysis page) ----------
   A time frame (the last 7 to 180 days, or two dates of his own) and three line charts over it: the running PnL,
   the same as a percentage of the balance the time frame began with, and the balance itself.
   The app only knows closed trades. So the balance is typed once (the tracker keeps it as `base`: that balance
   minus everything the trades had made) and follows the trades from there. It has no price history either, so the
   percentage is set against the time frame just before it, where Bybit sets it against Bitcoin. */
const AN_RANGES = [7, 30, 60, 90, 180];
const AN_MAX_DAYS = 366;                              // the longest custom time frame
const AN_BLUE = "#6ea8ff", AN_ORANGE = "#f5a742";
// a date as one number (days since 1970), so a time frame is plain arithmetic
const dayNo = (y, m, d) => Math.round(Date.UTC(y, m, d) / 86400000);
const dayOf = (n) => { const t = new Date(n * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() }; };
const dayText = (n, withYear) => { const t = dayOf(n); return `${t.d} ${MONTHS_SHORT[t.m]}${withYear ? ` ${t.y}` : ""}`; };
const dayIso = (n) => { const t = dayOf(n); return keyOf(t.y, t.m, t.d); };
const isoDay = (s) => { const m = /^(2\d{3})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? dayNo(+m[1], +m[2] - 1, +m[3]) : null; };
const cleanAn = (a) => ({
  kind: a && (AN_RANGES.includes(a.kind) || a.kind === "custom") ? a.kind : 7,
  from: a && isoDay(a.from) !== null ? a.from : "", to: a && isoDay(a.to) !== null ? a.to : "",
});
// the days a time frame covers. A preset ends on `end` and reaches back from it; a custom one is its own two dates
const anWindow = (an, end, y, m) => {
  if (an.kind !== "custom") return { start: end - an.kind + 1, end };
  const a = isoDay(an.from), b = isoDay(an.to);
  if (a === null || b === null) return { start: Math.min(dayNo(y, m, 1), end), end };
  const hi = Math.max(a, b);
  return { start: Math.max(Math.min(a, b), hi - AN_MAX_DAYS + 1), end: hi };
};
// round steps for an axis (1, 2, 2.5 or 5 times a power of ten), about `count` of them from lo to hi
const niceTicks = (lo, hi, count) => {
  const raw = (hi - lo) / count, pow = 10 ** Math.floor(Math.log10(raw)), f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const a = Math.floor(lo / step + 1e-9), b = Math.ceil(hi / step - 1e-9);
  return Array.from({ length: b - a + 1 }, (_, i) => +((a + i) * step).toPrecision(12));
};
const pctText = (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

/* one line chart of the analysis card: dashed levels, dates along the bottom, one or two lines.
   It is drawn at the size it is given (one unit = 1px), so its text is the same size in a narrow window and a wide one.
   The pointer's day is its own state, so moving over a chart redraws that chart only */
const AnChart = ({ lines, days, kind, cur, zero, tone, note, height = 218 }) => {
  const box = useRef(null);
  const [w, setW] = useState(0);
  const [hot, setHot] = useState(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setW(Math.round(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const N = days.length, H = height, PT = 12, PB = 30, PR = 10;
  const g = useMemo(() => {
    if (!w) return null;
    const shown = lines.filter((l) => l.vals);
    const sym = cur === "USDT" ? "$" : "";
    const label = kind === "pct" ? (v) => `${+v.toFixed(2)}%` : (v) => `${v < 0 ? "-" : ""}${sym}${curBody(cur, v)}`;
    const ih = H - PT - PB;
    let levels;                                                   // [{ v, text }], top to bottom
    if (!shown.length) levels = [4, 3, 2, 1, 0].map((v) => ({ v, text: "" }));
    else {
      let lo = Infinity, hi = -Infinity;
      shown.forEach((l) => l.vals.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
      if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      if (hi - lo < 1e-9) {
        // nothing moved: the one level that means something sits in the middle, named, between unnamed ones
        const pad = Math.abs(hi) * 0.1 || 1;
        levels = [2, 1, 0, -1, -2].map((k) => ({ v: hi + (k * pad) / 2, text: k ? "" : label(hi) }));
      } else levels = niceTicks(lo, hi, 4).reverse().map((v) => ({ v, text: label(v) }));
    }
    const top = levels[0].v, bot = levels[levels.length - 1].v;
    const PL = shown.length ? Math.max(30, Math.max(...levels.map((t) => t.text.length)) * 6.5 + 15) : 10;
    const iw = Math.max(40, w - PL - PR);
    const r1 = (x) => Math.round(x * 10) / 10;
    const X = (i) => r1(PL + (N > 1 ? i / (N - 1) : 0.5) * iw);
    const Y = (v) => r1(PT + ((top - v) / (top - bot)) * ih);
    // a smooth curve that never overshoots a day's value; past half a year the days are too close to tell from straight lines
    const path = (ys) => {
      let d = `M${X(0)} ${ys[0]}`;
      for (let i = 1; i < N; i++) {
        if (N > 200) { d += `L${X(i)} ${ys[i]}`; continue; }
        const mid = r1((X(i - 1) + X(i)) / 2);
        d += `C${mid} ${ys[i - 1]} ${mid} ${ys[i]} ${X(i)} ${ys[i]}`;
      }
      return d;
    };
    const at = [...new Set([0, 1, 2, 3].map((k) => Math.round((k * (N - 1)) / 3)))];
    return {
      PL, iw, X,
      levels: levels.map((t) => ({ y: Y(t.v), text: t.text, zero: shown.length > 0 && Math.abs(t.v) < 1e-9 })),
      dates: at.map((i, k) => ({ x: X(i), text: dayText(days[i]), anchor: N === 1 ? "middle" : k === 0 ? "start" : k === at.length - 1 ? "end" : "middle" })),
      marks: shown.map((l) => { const ys = l.vals.map(Y); return { color: l.color, vals: l.vals, ys, d: N > 1 ? path(ys) : "" }; }),
    };
  }, [lines, days, kind, cur, zero, w, H]);
  const onMove = (e) => {
    if (!g || !g.marks.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * w;
    const i = N > 1 ? Math.max(0, Math.min(N - 1, Math.round(((x - g.PL) / g.iw) * (N - 1)))) : 0;
    setHot((h) => (h === i ? h : i));
  };
  const main = g && hot !== null && hot < N ? g.marks[0] : null;
  const tipText = (v) => (kind === "pct" ? pctText(v)
    : `${tone === "pnl" ? signOf(v) : v < 0 ? "-" : ""}${cur === "USDT" ? "$" : ""}${curBody(cur, v)}`);
  return (
    <div ref={box} className="an-plot" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHot(null)}>
      {g && (
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`}>
          {g.levels.map((t, i) => (
            <g key={i} className="axis-fade" style={{ animationDelay: `${40 + i * 30}ms` }}>
              <line x1={g.PL} y1={t.y} x2={w - PR} y2={t.y} stroke={t.zero ? "#62696f" : "#3a3f44"} strokeWidth="1" strokeDasharray="4 4" />
              {t.text && <text x={g.PL - 9} y={t.y + 4} fill="#8a9299" fontSize="11" textAnchor="end">{t.text}</text>}
            </g>
          ))}
          {g.dates.map((t, i) => (
            <text key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 40}ms` }} x={t.x} y={H - 9} fill="#8a9299" fontSize="11" textAnchor={t.anchor}>{t.text}</text>
          ))}
          {g.marks.map((m, i) => (m.d
            ? <path key={i} className="an-line" pathLength="1" d={m.d} fill="none" stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            : <circle key={i} className="axis-fade" cx={g.X(0)} cy={m.ys[0]} r="4" fill={m.color} />))}
          {main && (
            <g pointerEvents="none">
              <line x1={g.X(hot)} y1={PT} x2={g.X(hot)} y2={H - PB} stroke="#5a6168" strokeWidth="1" />
              {g.marks.map((m, i) => <circle key={i} cx={g.X(hot)} cy={m.ys[hot]} r="4.5" fill={m.color} stroke="#1c1f23" strokeWidth="2" />)}
            </g>
          )}
        </svg>
      )}
      {note && <div className="an-note">{note}</div>}
      {main && (
        <GlassTip key={hot} W={w} H={H} x={Math.min(Math.max(g.X(hot), 60), Math.max(60, w - 60))} y={main.ys[hot]} below={main.ys[hot] < 66}
                  label={dayText(days[hot])} value={tipText(main.vals[hot])}
                  color={tone !== "pnl" ? undefined : main.vals[hot] > 0 ? "#9df0c9" : main.vals[hot] < 0 ? "#ff8d97" : undefined} />
      )}
    </div>
  );
};

// `unit` and `dp` are the currency the trades are kept in (USDT with cents, or whole rupiah): what the balance is typed in
const PnlAnalysis = memo(({ trades, deps, an, start, end, cur, rate, base, allPnl, allDep, unit, dp, api }) => {
  const [bal, setBal] = useState(null);                 // the balance box while it is being typed in
  const [dates, setDates] = useState(null);             // the two date boxes while one is being typed in
  const balRef = useRef(null);
  const custom = an.kind === "custom";
  const N = end - start + 1;
  // every day that has trades, oldest first: [day, PnL, trades]
  const daily = useMemo(() => {
    const out = [];
    for (const k in trades) {
      const n = isoDay(k);
      if (n !== null) out.push([n, trades[k].reduce((s, t) => s + t.pnl, 0), trades[k].length]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }, [trades]);
  // money put into the account or taken out of it, by day, oldest first: [day, amount]
  const flows = useMemo(() => {
    const out = [];
    for (const k in deps) {
      const n = isoDay(k);
      if (n !== null) out.push([n, deps[k].reduce((s, t) => s + t.amt, 0)]);
    }
    return out.sort((a, b) => a[0] - b[0]);
  }, [deps]);
  const data = useMemo(() => {
    // what was made before day s, then the running total at the end of each day from s to e; the same for the money
    // put in (put: before day s, fl: since)
    const run = (s, e) => {
      let i = 0, before = 0, c = 0, n = 0, j = 0, put = 0, f = 0;
      while (i < daily.length && daily[i][0] < s) before += daily[i++][1];
      while (j < flows.length && flows[j][0] < s) put += flows[j++][1];
      const cum = [], fl = [];
      for (let d = s; d <= e; d++) {
        if (i < daily.length && daily[i][0] === d) { c += daily[i][1]; n += daily[i][2]; i++; }
        if (j < flows.length && flows[j][0] === d) f += flows[j++][1];
        cum.push(Math.round(c * 100) / 100); fl.push(f);
      }
      return { before, cum, n, put, fl };
    };
    const now = run(start, end), prev = run(start - N, start - 1);
    // the balance each time frame began with, and what was put in since: what the percentages are of
    const eq = base === null ? null : base + now.before + now.put, prevEq = base === null ? null : base + prev.before + prev.put;
    const share = (r, q) => (q !== null && r.fl.some((f) => q + f > 0) ? r.cum.map((c, i) => (q + r.fl[i] > 0 ? (c / (q + r.fl[i])) * 100 : 0)) : null);
    const pct = share(now, eq);
    const prevPct = pct && prev.n > 0 ? share(prev, prevEq) : null;
    const asset = base === null ? null : now.cum.map((c, i) => Math.max(0, eq + now.fl[i] + c) * rate);
    return {
      days: Array.from({ length: N }, (_, i) => start + i), n: now.n, total: now.cum[N - 1],
      pct, prevPct, asset, broke: base !== null && !pct,
      pnlLines: [{ color: AN_BLUE, vals: now.cum.map((c) => c * rate) }],
      pctLines: [{ color: AN_ORANGE, vals: pct }, { color: AN_BLUE, vals: prevPct }],
      assetLines: [{ color: AN_ORANGE, vals: asset }],
    };
  }, [daily, flows, start, end, base, rate]);

  const sym = cur === "USDT" ? "$" : "";
  const tone = (v) => (v > 0 ? "#5ee3a9" : v < 0 ? "#ff8d97" : "#9aa3ab");
  // an account can't hold less than nothing: if what is logged says so, something is missing, and it reads 0
  const balance = base === null ? null : Math.max(0, Math.round((base + allPnl + allDep) * 100) / 100);
  const balShown = balance === null ? "" : dp ? NF2.format(balance) : Math.round(balance).toLocaleString("id-ID");
  const balText = balance === null ? "" : dp ? String(balance) : `${balance < 0 ? "-" : ""}${Math.abs(Math.round(balance)).toLocaleString("id-ID")}`;
  const saveBal = () => {
    if (bal === null) return;
    const v = dp ? parseFloat(bal) : parseNum(bal);
    setBal(null);
    if (bal.trim() === "") { if (balance !== null) api.current.setBalance(null); }
    else if (bal !== balText && Number.isFinite(v)) api.current.setBalance(Math.min(v, MAX_AMOUNT));
  };
  const pickCustom = () => { if (!custom) api.current.setAn({ kind: "custom", from: an.from || dayIso(start), to: an.to || dayIso(end) }); };
  // a date box is followed as soon as it holds a whole date; the other end moves along if they would cross or the
  // time frame would be longer than a year
  const typeDate = (which, v) => {
    const boxes = dates || { from: dayIso(start), to: dayIso(end) }, n = isoDay(v);
    if (n === null) { setDates({ ...boxes, [which]: v }); return; }
    let a = which === "from" ? n : isoDay(boxes.from) ?? n, b = which === "to" ? n : isoDay(boxes.to) ?? n;
    if (a > b) { if (which === "from") b = a; else a = b; }
    if (b - a + 1 > AN_MAX_DAYS) { if (which === "from") b = a + AN_MAX_DAYS - 1; else a = b - AN_MAX_DAYS + 1; }
    setDates(null);
    api.current.setAn({ kind: "custom", from: dayIso(a), to: dayIso(b) });
  };
  const needBal = (
    <button className="an-ask" onClick={() => setBal("")}>
      Type your balance to see this
    </button>
  );
  const pk = `${start}-${end}`;
  const last = N - 1;
  return (
    <div>
      <div className="an-bar">
        <div className="an-tabs">
          {AN_RANGES.map((d) => (
            <button key={d} className={`an-tab${an.kind === d ? " on" : ""}`} onClick={() => { setDates(null); if (an.kind !== d) api.current.setAn({ ...an, kind: d }); }}>Last {d} D</button>
          ))}
          <button className={`an-tab${custom ? " on" : ""}`} onClick={pickCustom}>Custom Time Frame</button>
        </div>
        {/* the balance: a figure, pressed to be typed over (what the exchange shows now). Empty: no balance */}
        {bal !== null ? (
          <label className="an-bal edit">
            <span>Balance</span><i>{CUR_SIGN[unit]}</i>
            <input ref={balRef} autoFocus inputMode={dp ? "decimal" : "numeric"} placeholder="0" aria-label="Balance" value={bal}
                   onFocus={(e) => e.target.select()} onChange={(e) => setBal(sanitizeAmount(e.target.value, !!dp))}
                   onBlur={saveBal} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
          </label>
        ) : (
          <button className={`an-bal${balance === null ? " none" : ""}`} onClick={() => setBal(balText)}
                  title={`Your account balance, in ${unit === "IDR" ? "rupiah" : unit}. Press to type what ${unit === "USDT" ? "the exchange" : "your broker"} shows now: from that day on it follows the trades${unit === "USDT" ? ", deposits and withdrawals" : ""} you log. Something logged for an earlier day only rewrites the past. It never goes below zero`}>
            <span>Balance</span>
            {balance === null ? <b>Set it</b> : <b><i>{CUR_SIGN[unit]}</i>{balShown}</b>}
            <span className="msym">edit</span>
          </button>
        )}
      </div>
      {custom && (
        <div className="an-dates">
          <input type="date" className="an-date" aria-label="From" value={dates ? dates.from : dayIso(start)} onChange={(e) => typeDate("from", e.target.value)} onBlur={() => setDates(null)} />
          <span>to</span>
          <input type="date" className="an-date" aria-label="To" value={dates ? dates.to : dayIso(end)} onChange={(e) => typeDate("to", e.target.value)} onBlur={() => setDates(null)} />
          <span>{N === 1 ? "1 day" : `${N} days`}</span>
        </div>
      )}
      <div className="an-asof">Data from {dayText(start, dayOf(start).y !== dayOf(end).y)} to {dayText(end, true)} · {tradesWord(data.n)}</div>
      <div className="an-grid">
        <div>
          <div className="an-title">Cumulative PnL <span>({cur})</span></div>
          <div className="an-val" style={{ color: data.n ? tone(data.total) : "#9aa3ab" }}>{signOf(data.total)}{sym}{curBody(cur, data.total * rate)}</div>
          <div className="an-box glass-soft">
            <AnChart key={pk} lines={data.pnlLines} days={data.days} kind="money" cur={cur} zero tone="pnl"
                     note={data.n ? null : "No trades in this time frame"} />
          </div>
        </div>
        <div>
          <div className="an-title">Cumulative PnL <span>(%)</span></div>
          <div className="an-val">
            <span className="an-key"><i style={{ background: AN_ORANGE }} />Cumulative PnL%<b style={{ color: data.pct ? tone(data.pct[last]) : "#9aa3ab" }}>{data.pct ? pctText(data.pct[last]) : "—"}</b></span>
            <span className="an-key" title={`The ${N === 1 ? "day" : `${N} days`} just before this time frame, for comparison`}>
              <i style={{ background: AN_BLUE }} />Previous {N} D<b style={{ color: data.prevPct ? tone(data.prevPct[last]) : "#9aa3ab" }}>{data.prevPct ? pctText(data.prevPct[last]) : "—"}</b>
            </span>
          </div>
          <div className="an-box glass-soft">
            <AnChart key={pk} lines={data.pctLines} days={data.days} kind="pct" cur={cur} zero tone="pnl"
                     note={data.pct ? null : data.broke ? "There was no balance left when this time frame began" : needBal} />
          </div>
        </div>
        <div className="an-wide">
          <div className="an-title">Total asset trend <span>({cur})</span></div>
          <div className="an-val" style={{ color: data.asset ? "#f2f5f8" : "#9aa3ab" }}>{data.asset ? `${data.asset[last] < 0 ? "-" : ""}${sym}${curBody(cur, data.asset[last])}` : "—"}</div>
          <div className="an-box glass-soft">
            <AnChart key={pk} lines={data.assetLines} days={data.days} kind="money" cur={cur} note={data.asset ? null : needBal} />
          </div>
        </div>
      </div>
    </div>
  );
});

/* the ring on the Coins / Stocks card (after Bybit's asset distribution): how the month's winnings are shared out
   between the coins, biggest first, or its losses. Each coin is one piece of the ring and one row beside it */
const RING_MAX = 6;                                   // coins named on the ring; any others are added together as "Other"
const RING_R = 76, RING_W = 36, RING_C = 2 * Math.PI * RING_R;
const RING_RAMP = { win: [[104, 232, 178], [23, 96, 70]], loss: [[255, 128, 140], [122, 38, 48]] };   // biggest → smallest
const ringTint = (ramp, i, n) => {
  const t = n > 1 ? i / Math.max(n - 1, 3) : 0.28;
  return `rgb(${ramp[0].map((c, k) => Math.round(c + (ramp[1][k] - c) * t)).join(",")})`;
};
const CoinRing = memo(({ coins, cur, rate, label, none, things, loss, onLoss }) => {
  const [hot, setHot] = useState(null);
  const amt = (v) => `${cur === "USDT" ? "$" : ""}${curBody(cur, v * rate)}`;
  const word = (n) => (loss ? (n === 1 ? "loss" : "losses") : n === 1 ? "win" : "wins");
  const all = coins.map((c) => ({ name: c.coin || none, v: loss ? c.loss : c.profit, n: loss ? c.losses : c.wins }))
    .filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const rest = all.slice(RING_MAX);
  const rows = rest.length > 1 ? [...all.slice(0, RING_MAX), { name: "Other", other: rest.length, v: rest.reduce((s, r) => s + r.v, 0), n: rest.reduce((s, r) => s + r.n, 0) }] : all;
  const total = rows.reduce((s, r) => s + r.v, 0);
  const named = rows.filter((r) => !r.other).length;
  const gap = rows.length > 1 ? 3 : 0;
  let from = 0;
  rows.forEach((r, i) => {
    r.color = r.other ? "#5d656c" : ringTint(RING_RAMP[loss ? "loss" : "win"], i, named);
    r.share = r.v / total; r.from = from; r.len = Math.max(1.5, r.share * RING_C - gap);
    from += r.share * RING_C;
  });
  const on = hot !== null && hot < rows.length ? rows[hot] : null;
  const side = (isLoss, text) => {
    const lit = loss === isLoss, c = isLoss ? C_RED : C_GREEN;
    return (
      <button className="mode-btn" title={isLoss ? `Which ${things} the losses came from` : `Which ${things} the winnings came from`}
              onClick={() => { setHot(null); onLoss(isLoss); }}
              style={{ ...S.modeBtn, color: lit ? c : "#6d757d", borderColor: lit ? `${c}99` : "#33373b", background: lit ? "rgba(255,255,255,0.07)" : "none" }}>{text}</button>
    );
  };
  return (
    <div className="ring-wrap">
      <div className="ring-head">
        <div>
          <div className="an-title">{loss ? "Loss" : "Win"} distribution <span>({cur})</span></div>
          <div className="an-asof" style={{ margin: "3px 0 0" }}>Biggest to smallest · {label}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{side(false, "Wins")}{side(true, "Losses")}</div>
      </div>
      <div className="ring-body" onMouseLeave={() => setHot(null)}>
        <div className="ring-fig">
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block", transform: "rotate(-90deg)" }}>
            {!rows.length && <circle cx="100" cy="100" r={RING_R} fill="none" stroke="#2c3034" strokeWidth={RING_W} />}
            {rows.map((r, i) => (
              <circle key={`${loss}-${i}`} className="ring-seg" cx="100" cy="100" r={RING_R} fill="none" stroke={r.color} strokeWidth={RING_W}
                      strokeDasharray={`${r.len} ${RING_C}`} strokeDashoffset={-r.from}
                      style={{ animationDelay: `${80 + i * 70}ms`, opacity: on && on !== r ? 0.28 : 1 }}
                      onMouseEnter={() => setHot(i)} />
            ))}
          </svg>
          <div key={on ? `${loss}-${hot}` : `${loss}`} className="ring-mid">
            <span>{on ? on.name : `${loss ? "Losses" : "Wins"} (${cur})`}</span>
            <b>{rows.length ? amt(on ? on.v : total) : "—"}</b>
            {on && <span>{(on.share * 100).toFixed(2)}%</span>}
          </div>
        </div>
        <div className="ring-list">
          {!rows.length && <div style={S.flowEmpty}>{loss ? "No losing trades this month." : "No winning trades this month."}</div>}
          {rows.map((r, i) => (
            <div key={`${loss}-${r.name}`} className={`ring-row bd-item${on === r ? " on" : ""}`} style={{ animationDelay: `${90 + i * 55}ms` }} onMouseEnter={() => setHot(i)}>
              <i style={{ background: r.color }} />
              <span className="ring-name">{r.name}<small>{r.other ? `${r.other} ${things}` : `${r.n} ${word(r.n)}`}</small></span>
              <span className="ring-amt">{amt(r.v)}</span>
              <span className="ring-pct">{(r.share * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/* A part of a card that plays its opening when it is scrolled to, not when the card is put on the page. Until then it
   holds its room but isn't shown; then it is put there afresh, which starts its animations and count-ups from the
   beginning. It keeps that to itself, so the panel behind it isn't worked out again. */
const Reveal = ({ children }) => {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={seen ? "rv seen" : "rv"}><Fragment key={seen ? "in" : "wait"}>{children}</Fragment></div>;
};

/* A card under the calendar, on both sides: it pops in when it is scrolled into view and folds away on its arrow.
   Seen, open and the replay count are its own, so none of them re-renders the tracker around it (on the finance side
   that was the whole panel worked out again, 17ms, as each card came into view and on every press of an arrow).
   style: extra for the card. loose: what reaches out of the fold is shown (an open menu). parts: its content is made
   of Reveal parts that open themselves, so it isn't put there afresh when the card is seen. */
// each card's own colour, muted: its title is a tag in it and a soft glow of it sits behind the title. The glow is a
// band of a fixed height at the top (never sized from the card), so folding a card draws nothing again
const CARD_TINT = { "weekly expenses": "#86bfe8", "money flow": "#7fd8b4", goals: "#e3c477", "PnL analysis": "#86bfe8", performance: "#7fd8b4", coins: "#e3c477", stocks: "#e3c477" };
const FoldCard = ({ title, sub, runKey, name, style, loose, parts, children }) => {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState(true);
  const [closing, setClosing] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } });
    }, { threshold: 0.18 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-card={name} className={`flow-card glass${seen ? " shown" : ""}`} style={{ ...S.flowCard, ...style, "--tint": CARD_TINT[name] || "#9aa3ab" }}>
      <div className="card-aura" />
      <div style={S.flowHead}>
        <span className="card-tag"><i />{title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={S.flowSub}>{sub}</span>
          <button className={`plain-arrow chev${open ? " up" : ""}`} style={S.plainArrow}
                  onClick={() => {
                    if (open) { setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 300); }
                    else { setOpen(true); setRun((n) => n + 1); }
                  }}
                  title={open ? `Hide ${name}` : `Show ${name}`}><Chevron /></button>
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateRows: open && !closing ? "1fr" : "0fr", transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={loose ? S.foldLoose : S.fold}>
          <div key={`${run}-${parts || seen}-${runKey}`} className="fold-in"
               style={{ opacity: closing ? 0 : 1, transform: closing ? "translateY(-14px)" : "translateY(0)",
                        transition: "opacity .26s ease, transform .3s cubic-bezier(0.4,0,0.2,1)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* a pair box: the coin as typed, with USDT.P written after it in grey (not when the quote is already typed: BTCUSDT,
   BTC/USDT). A stock's box has nothing written after it. `tail` is more grey text, at the right end of the box */
const PairBox = ({ value, wrap, pad, ghost, tail, ...input }) => (
  <span style={{ position: "relative", display: "block", ...wrap }}>
    <input value={value} {...input} />
    {ghost && value && !value.includes("/") && coinOf(value) === value && (
      <span className="pair-ghost" style={{ padding: `0 ${pad}px` }} aria-hidden="true"><i>{value}</i><b>{ghost}</b></span>
    )}
    {tail && <span className="pair-tail" style={{ right: pad }} aria-hidden="true">{tail}</span>}
  </span>
);

/* the long / short switch on a trade */
const SideChip = ({ side, onToggle, big }) => (
  <button className={`side-chip${side === "short" ? " short" : ""}${big ? " big" : ""}`} onClick={onToggle}
          title={side === "short" ? "Short · click for long" : "Long · click for short"}>
    <span className="msym">trending_up</span>{side === "short" ? "Short" : "Long"}
  </button>
);

/* ---------- pictures on a trade (crypto journal) ----------
   A picture is made small before it is kept: at most SHOT_EDGE px on its long side, as WebP, which brings a chart
   screenshot from megabytes down to some 40–150 KB. Pictures live in IndexedDB "flow-shots", apart from the trades:
   a trade only holds their ids (imgs), so the saved trades stay small and typing in a box rewrites no picture.
   They go into the backup with the trades. A picture no trade points to any more is removed the next time the
   crypto side is opened, never at once (an import can be undone, and the trade would come back without it).
   Test data has pictures at no cost: the id "ph:<number>" is a made-up chart, drawn on the spot from that number.
   Only the crypto side keeps pictures: if the stocks side ever does, shotSweep must be told about its trades too. */
const SHOT_EDGE = 1600, SHOT_Q = 0.8;
const shots = { db: null, urls: new Map() };
const shotOpen = () => (shots.db ||= new Promise((done) => {
  try {
    const rq = indexedDB.open("flow-shots", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("img");
    rq.onsuccess = () => done(rq.result);
    rq.onerror = rq.onblocked = () => done(null);
  } catch (e) { done(null); }
}));
// one request on the store; null when it could not be done
const shotDo = async (mode, ask) => {
  const db = await shotOpen();
  if (!db) return null;
  return new Promise((done) => {
    try {
      const rq = ask(db.transaction("img", mode).objectStore("img"));
      rq.onsuccess = () => done(rq.result ?? true);
      rq.onerror = () => done(null);
    } catch (e) { done(null); }
  });
};
// a picture file made small and kept: its id, or null if it can't be read as a picture
const shotAdd = async (file) => {
  let blob = null;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, SHOT_EDGE / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    const cx = cv.getContext("2d");
    cx.imageSmoothingQuality = "high";
    cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close();
    const small = await new Promise((done) => cv.toBlob(done, "image/webp", SHOT_Q));
    blob = small && (k < 1 || small.size < file.size) ? small : file;        // a file already smaller than that is kept as it is
  } catch (e) { return null; }
  const id = uid();
  return (await shotDo("readwrite", (s) => s.put(blob, id))) ? id : null;
};
// where a kept picture is shown from: made once per picture, kept for the session
const shotUrl = (id) => {
  if (!shots.urls.has(id)) shots.urls.set(id, shotDo("readonly", (s) => s.get(id)).then((b) => (b instanceof Blob ? URL.createObjectURL(b) : null)));
  return shots.urls.get(id);
};
// for the backup: the pictures these trades hold, as text; and back again
const shotPack = async (trades) => {
  const out = {};
  for (const k in trades) for (const t of trades[k]) for (const id of t.imgs || []) {
    if (id.startsWith("ph:") || out[id]) continue;
    const b = await shotDo("readonly", (s) => s.get(id));
    const text = b instanceof Blob ? await new Promise((done) => { const r = new FileReader(); r.onload = () => done(r.result); r.onerror = () => done(null); r.readAsDataURL(b); }) : null;
    if (text) out[id] = text;
  }
  return out;
};
const shotUnpack = async (images) => {
  for (const id in images) {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+\/=]+)$/.exec(typeof images[id] === "string" ? images[id] : "");
    if (!shotIdOk(id) || id.startsWith("ph:") || !m) continue;
    try {
      const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await shotDo("readwrite", (s) => s.put(new Blob([bytes], { type: m[1] }), id));
      shots.urls.delete(id);
    } catch (e) { /* that one picture is left out */ }
  }
};
// the pictures no trade points to any more are removed. Only ever called with trades that were just read in full
const shotSweep = async (trades) => {
  const keep = new Set();
  for (const k in trades) for (const t of trades[k]) for (const id of t.imgs || []) keep.add(id);
  const keys = await shotDo("readonly", (s) => s.getAllKeys());
  const gone = Array.isArray(keys) ? keys.filter((id) => !keep.has(id)) : [];
  if (!gone.length) return;
  const db = await shotOpen();
  try { const st = db.transaction("img", "readwrite").objectStore("img"); gone.forEach((id) => st.delete(id)); } catch (e) { /* they stay until next time */ }
};
// a test picture: a made-up chart with its entry, target and stop, the same one every time for the same number
const phDraw = (cv, seed, w, h) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  if (!c) return;
  c.scale(dpr, dpr);
  let s = (seed % 2147483646) + 1;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  rnd(); rnd();
  const up = rnd() < 0.5, n = 46, bw = w / n, cs = [];
  let p = 0;
  for (let i = 0; i < n; i++) {
    const o = p;
    p += (rnd() - 0.5 + (up ? 0.09 : -0.09)) * 2;
    cs.push([o, p, Math.max(o, p) + rnd() * 0.7, Math.min(o, p) - rnd() * 0.7]);
  }
  const max = Math.max(...cs.map((k) => k[2])), min = Math.min(...cs.map((k) => k[3]));
  const y = (v) => h * 0.1 + ((max - v) / (max - min || 1)) * h * 0.8;
  c.fillStyle = "#15181c"; c.fillRect(0, 0, w, h);
  c.lineWidth = 1;
  c.strokeStyle = "rgba(255,255,255,0.05)";
  for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, Math.round((h * i) / 5) + 0.5); c.lineTo(w, Math.round((h * i) / 5) + 0.5); c.stroke(); }
  cs.forEach(([o, cl, hi, lo], i) => {
    const x = i * bw + bw / 2;
    c.fillStyle = c.strokeStyle = cl >= o ? "#5fbf95" : "#d9707b";
    c.beginPath(); c.moveTo(x, y(hi)); c.lineTo(x, y(lo)); c.stroke();
    c.fillRect(x - bw * 0.31, Math.min(y(o), y(cl)), bw * 0.62, Math.max(1, Math.abs(y(o) - y(cl))));
  });
  const entry = cs[Math.floor(n * 0.42)][1], gap = (max - min) * 0.24 * (up ? 1 : -1);
  c.setLineDash([Math.max(3, w / 90), Math.max(2, w / 120)]);
  [[entry, "#aab3bb"], [entry + gap, "#5fbf95"], [entry - gap * 0.5, "#d9707b"]].forEach(([v, col]) => {
    c.strokeStyle = col; c.beginPath(); c.moveTo(0, y(v)); c.lineTo(w, y(v)); c.stroke();
  });
  c.setLineDash([]);
  if (h > 200) { c.fillStyle = "rgba(255,255,255,0.3)"; c.font = "600 15px Inter, sans-serif"; c.fillText("Test picture", 16, h - 16); }
};
// one picture: a kept one from its address, a test one drawn on the spot. Small in a sheet, `big` when opened
const Shot = ({ id, big }) => {
  const ph = id.startsWith("ph:");
  const [url, setUrl] = useState(null);
  const cv = useRef(null);
  useLayoutEffect(() => { if (ph && cv.current) phDraw(cv.current, +id.slice(3) || 0, big ? 960 : 104, big ? 540 : 66); }, [id]);
  useEffect(() => {
    if (ph) return;
    let on = true;
    shotUrl(id).then((u) => { if (on) setUrl(u); });
    return () => { on = false; };
  }, [id]);
  return ph ? <canvas ref={cv} /> : url ? <img src={url} alt="" draggable={false} decoding="async" /> : <i />;
};
// a picture opened large, over everything: a press anywhere or Esc closes it (and only it)
const ShotView = ({ id, onClose }) => {
  const [out, setOut] = useState(false);
  const close = () => { setOut(true); setTimeout(onClose, 170); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return createPortal(<div className={`shot-view${out ? " out" : ""}`} onClick={close}><Shot id={id} big /></div>, document.body);
};

/* ---------- trading journal (crypto day panel) ----------
   A trade is a page of properties, after his Notion picture: Win / Breakeven / Loss and the $ box on top, then coin,
   position, time frame, duration, full TP %, risk %, leverage and R, the notes before, and a big description.
   A sheet keeps what is typed to itself, so typing redraws nothing behind it. The one on top adds a trade (Enter or
   the button); the one inside a logged trade saves itself, at once on a switch and on leaving a box otherwise.
   A logged trade's sheet also holds its pictures (see "pictures on a trade"). */
const JR_RES = { win: ["Win", "emoji_events"], be: ["Breakeven", "drag_handle"], loss: ["Loss", "close"] };
// a break-even trade is one at exactly $0, or one he marked break-even with the few dollars it closed at (be)
const resOf = (t) => (t.be || !t.pnl ? "be" : t.pnl > 0 ? "win" : "loss");
const sheetOf = (t = {}) => ({
  res: t.id ? resOf(t) : "win", amt: t.pnl ? String(t.be ? t.pnl : Math.abs(t.pnl)) : "", pair: t.pair || "", side: t.side === "short" ? "short" : "long",
  tp: String(t.tp || ""), tf: t.tf || "", risk: String(t.risk || ""), lev: String(t.lev || ""), rr: String(t.rr || ""),
  dur: t.dur || "", pre: t.pre || "", note: t.note || "", imgs: t.imgs || [],
});
// what a sheet comes to as a trade; null while a win or a loss has no amount yet. A break-even trade may carry what
// it closed at, with a minus if it cost a little
const sheetTrade = (d) => {
  const amt = pnlOf(d.amt);
  if (d.res !== "be" && !amt) return null;
  const pnl = d.res === "be" ? amt : d.res === "loss" ? -Math.abs(amt) : Math.abs(amt);
  return { pnl, ...(d.res === "be" && pnl ? { be: true } : {}), pair: pairName(d.pair), side: d.side, ...journalOf(d) };
};
const JrRow = ({ icon, tint, label, cls, children }) => (
  <div className={`jr-row${cls ? " " + cls : ""}`}>
    <span className="jr-k"><span className="msym" style={{ color: tint }}>{icon}</span>{label}</span>
    <span className="jr-v">{children}</span>
  </div>
);
const TradeSheet = memo(function TradeSheet({ trade, api, ghost, active, onView }) {
  const [d, setD] = useState(() => sheetOf(trade));
  const live = useRef(d);                                  // the latest draft, for a save on the way out of a box
  const saved = useRef(trade ? JSON.stringify(sheetTrade(d)) : "");
  const amtRef = useRef(null);
  const kept = useRef("");                                 // the amount a win or a loss had, while it is switched to break-even
  const [own, setOwn] = useState(() => (TF_LIST.includes(d.tf) ? "" : d.tf));      // the box for a time frame of his own
  const [busy, setBusy] = useState(false);                 // pictures being made small
  const save = () => {
    const f = trade && sheetTrade(live.current), sig = JSON.stringify(f);
    if (f && sig !== saved.current) { saved.current = sig; api.current.edit(trade.id, f); }
  };
  const set = (patch, now) => { live.current = { ...live.current, ...patch }; setD(live.current); if (now) save(); };
  const add = () => {
    const f = sheetTrade(live.current);
    if (!f) { amtRef.current?.focus(); return; }
    api.current.add(f);
    set({ ...sheetOf(), side: live.current.side, tf: live.current.tf });
    amtRef.current?.focus();
  };
  // to break-even: back to $0, and he types what it closed at if it wasn't nothing. Away from it: the amount it had before
  const setRes = (id) => {
    const cur = live.current;
    if (id === cur.res) return;
    let amt = cur.amt;
    if (id === "be") { kept.current = cur.amt; amt = ""; }
    else if (cur.res === "be") amt = cur.amt.replace("-", "") || kept.current;
    set({ res: id, amt }, true);
  };
  const onKey = (e) => { if (e.key === "Enter") { if (trade) e.target.blur(); else add(); } };
  const num = (k, places) => ({ className: "jr-in", inputMode: "decimal", value: d[k], onChange: (e) => set({ [k]: sanitizeAmount(e.target.value, true, places) }), onBlur: save, onKeyDown: onKey });
  const text = (k, max) => ({ className: "jr-in", value: d[k], onChange: (e) => set({ [k]: e.target.value.slice(0, max) }), onBlur: save });
  // what a % comes to with the leverage typed, in grey at the right end of its box (nothing without a leverage)
  const lev = Math.min(Number(d.lev) || 0, 1000);
  const withLev = (k) => (lev > 0 && Number(d[k]) > 0 ? `${roundTo(Number(d[k]) * lev, 2)}% at ${roundTo(lev, 2)}x` : "");
  // a time frame of his own is taken when its box is left, or on Enter; one that is in the list lights up its own box
  const ownDone = () => {
    const tf = tfClean(own);
    if (!tf) { setOwn(""); if (live.current.tf && !TF_LIST.includes(live.current.tf)) set({ tf: "" }, true); return; }
    setOwn(TF_LIST.includes(tf) ? "" : tf);
    if (tf !== live.current.tf) set({ tf }, true);
  };
  const ownTf = tfClean(own);
  // pictures: from the file box, dropped on the sheet, or pasted while this trade is the open one
  const attach = async (files) => {
    const list = [...(files || [])].filter((f) => /^image\//.test(f.type)).slice(0, SHOT_MAX - live.current.imgs.length);
    if (!list.length) return;
    setBusy(true);
    const ids = (await Promise.all(list.map(shotAdd))).filter(Boolean);
    setBusy(false);
    if (ids.length) set({ imgs: [...live.current.imgs, ...ids].slice(0, SHOT_MAX) }, true);
  };
  useEffect(() => {
    if (!trade || !active) return;
    const onPaste = (e) => {
      const files = [...((e.clipboardData && e.clipboardData.files) || [])].filter((f) => /^image\//.test(f.type));
      if (files.length) { e.preventDefault(); attach(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active]);
  const short = d.side === "short";
  return (
    <div className={`jr-sheet ${d.res}${trade ? " in-list" : ""}`}
         onDragOver={trade ? (e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); } : undefined}
         onDrop={trade ? (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); attach(e.dataTransfer.files); } } : undefined}>
      <div className="jr-top">
        <div className="jr-res">
          {Object.entries(JR_RES).map(([id, [label, icon]]) => (
            <button key={id} tabIndex={-1} className={`jr-res-b${d.res === id ? " on" : ""}`} onClick={() => setRes(id)}>
              <span className="msym">{icon}</span>{label}
            </button>
          ))}
        </div>
        <label className="jr-pnl" title={d.res === "be" ? "A break-even trade is neither won nor lost. Leave it at $0, or type what it closed at (with a minus if it cost a little)" : "Realised PnL of the trade, in USDT"}>
          <span>{d.res === "win" ? "+$" : d.res === "loss" ? "−$" : "$"}</span>
          <input ref={amtRef} inputMode="decimal" placeholder="0.00" aria-label="PnL in dollars" value={d.amt}
                 onChange={(e) => set({ amt: (live.current.res === "be" && /^\s*[-−]/.test(e.target.value) ? "-" : "") + sanitizeAmount(e.target.value, true) })}
                 onBlur={() => { if (trade && trade.pnl && live.current.res !== "be" && !pnlOf(live.current.amt)) set({ amt: String(Math.abs(trade.pnl)) }); save(); }}
                 onKeyDown={onKey} />
        </label>
      </div>
      <div className="jr-cols">
        <div className="jr-col">
          <JrRow icon="toll" tint="#d9bd62" label="Coin">
            <PairBox pad={11} ghost={ghost && ` ${ghost}`} className="jr-in" placeholder="BTC, ETH, SOL…" aria-label="Coin" value={d.pair}
                     onChange={(e) => set({ pair: pairName(e.target.value) })} onBlur={save} onKeyDown={onKey} />
          </JrRow>
          <JrRow icon="trending_up" tint={short ? "#e2808c" : "#8fd7a4"} label="Position" cls={short ? "flip" : ""}>
            {["long", "short"].map((s) => (
              <button key={s} tabIndex={-1} className={`jr-chip ${s}${d.side === s ? " on" : ""}`} onClick={() => set({ side: s }, true)}>{s === "long" ? "Long" : "Short"}</button>
            ))}
          </JrRow>
          <JrRow icon="candlestick_chart" tint="#8fb4e0" label="Time frame">
            {TF_LIST.map((tf, i) => (
              <button key={tf} tabIndex={-1} className={`jr-chip tf${d.tf === tf ? " on" : ""}`} style={{ "--tf": TF_TINT[i] }}
                      onClick={() => { setOwn(""); set({ tf: d.tf === tf ? "" : tf }, true); }}>{tf}</button>
            ))}
            <input className={`jr-chip tf own${ownTf && d.tf === ownTf ? " on" : ""}`} style={{ "--tf": ownTf ? tfTint(ownTf) : "#8a9299" }}
                   value={own} placeholder="Own" maxLength={5} aria-label="A time frame of your own" title="A time frame of your own: 45m, 2h, 3D, 1W…"
                   onChange={(e) => setOwn(e.target.value.replace(/[^\dmhHdDwWM]/g, ""))} onBlur={ownDone}
                   onKeyDown={(e) => { if (e.key === "Enter") { ownDone(); if (trade) e.target.blur(); else add(); } }} />
          </JrRow>
          <JrRow icon="hourglass_top" tint="#8fb4e0" label="Duration">
            <input {...text("dur", 16)} onKeyDown={onKey} placeholder="e.g. 5h 40m" aria-label="Duration" />
          </JrRow>
        </div>
        <div className="jr-col">
          <JrRow icon="flag" tint="#7ccfb0" label="Full TP %">
            <PairBox pad={11} ghost=" %" tail={withLev("tp")} {...num("tp", 3)} style={{ color: "#a5dcc6" }} placeholder="Entry to full TP, in %" aria-label="Full TP %" />
          </JrRow>
          <JrRow icon="shield" tint="#dc9ba4" label="Risk %">
            <PairBox pad={11} ghost=" %" tail={withLev("risk")} {...num("risk", 3)} style={{ color: "#dfa8b0" }} placeholder="Entry to stop, in %" aria-label="Risk %" />
          </JrRow>
          <JrRow icon="speed" tint="#b7a4e6" label="Leverage">
            <PairBox pad={11} ghost=" x" {...num("lev")} placeholder="e.g. 20" aria-label="Leverage" />
          </JrRow>
          <JrRow icon="balance" tint="#e0b97c" label="R / Factor">
            <PairBox pad={11} ghost=" R" {...num("rr")} style={{ color: "#ecd3a4" }} placeholder="e.g. 8" aria-label="R factor" />
          </JrRow>
        </div>
      </div>
      <JrRow icon="lightbulb" tint="#cfc59a" label="Pre notes">
        <input {...text("pre", 400)} onKeyDown={onKey} placeholder="The plan before the entry" aria-label="Pre notes" />
      </JrRow>
      <JrRow icon="edit_note" tint="#aab3bb" label="Description" cls="top">
        <textarea {...text("note", 4000)} rows={4} placeholder="How it went, and what to take from it" aria-label="Description"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onKey(e); }} />
      </JrRow>
      {trade && (
        <JrRow icon="image" tint="#9db7c9" label="Pictures" cls="top">
          {/* left out of the warm-up's copy of the screen: a kept picture's address only lasts for the session */}
          <div className="jr-shots" data-nowarm="">
            {d.imgs.map((id) => (
              <span key={id} className="jr-shot" onClick={() => onView(id)} title="Open">
                <Shot id={id} />
                <button tabIndex={-1} className="jr-shot-x" onClick={(e) => { e.stopPropagation(); set({ imgs: live.current.imgs.filter((x) => x !== id) }, true); }} title="Remove" aria-label="Remove">×</button>
              </span>
            ))}
            {d.imgs.length < SHOT_MAX && (
              <label className={`jr-shot add${busy ? " busy" : ""}`} title="Attach pictures: choose them, drop them here, or paste one">
                <span className="msym">add_photo_alternate</span>
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </JrRow>
      )}
      {!trade && (
        <div className="jr-foot">
          <button className="jr-add" onClick={add} title="Add this trade (Enter)"><span className="msym">add</span>Add trade</button>
        </div>
      )}
    </div>
  );
});
/* money put into the trading account or taken out of it, on the day it happened: it moves the balance (the analysis
   card's asset and % charts) without counting as PnL. One line under the day's trades: he asked to enter his deposits
   "somewhere on log trades ui". Typed in USDT, like the trades */
const DepositBox = memo(function DepositBox({ list, api, shown }) {
  const [out, setOut] = useState(false);                   // putting in, or taking out
  const [amt, setAmt] = useState("");
  const [short, setShort] = useState(null);                // what the account held, when a withdrawal asked for more
  const add = () => {
    const v = pnlOf(amt);
    if (!v) return;
    const res = api.current.addDep(out ? -v : v);
    if (res === true) { setAmt(""); setShort(null); } else { setShort(res); setTimeout(() => setShort(null), 3200); }
  };
  return (
    <div className="jr-dep">
      <span className="jr-k"><span className="msym" style={{ color: "#9db7c9" }}>account_balance_wallet</span>Deposits</span>
      <span className="jr-v">
        {[false, true].map((o) => (
          <button key={o ? "out" : "in"} tabIndex={-1} className={`jr-chip${out === o ? " on" : ""}`} onClick={() => setOut(o)}>{o ? "Withdraw" : "Deposit"}</button>
        ))}
        <label className="jr-pnl dep" title="Money put into the trading account, or taken out of it, in USDT. It moves the balance, not the PnL">
          <span>{out ? "−$" : "+$"}</span>
          <input inputMode="decimal" placeholder="0.00" aria-label={out ? "Withdrawal in dollars" : "Deposit in dollars"} value={amt}
                 onChange={(e) => setAmt(sanitizeAmount(e.target.value, true))} onKeyDown={(e) => e.key === "Enter" && add()} />
        </label>
        <button tabIndex={-1} className="jr-chip" onClick={add} title="Add it to this day (Enter)">Add</button>
        {short !== null && <span className="jr-dep-no">{short > 0 ? `Only ${api.current.abs(short)} in the account that day` : "Nothing in the account to take out that day"}</span>}
        {list.map((it) => (
          <span key={it.id} className="jr-dep-chip">
            {it.amt < 0 ? "Withdrew" : "Deposited"}<b>{api.current.abs(Math.abs(it.amt))}</b>
            <button className="chip-x jr-dep-x" onClick={() => api.current.delDep(it.id)} title="Delete" aria-label="Delete">×</button>
          </span>
        ))}
      </span>
    </div>
  );
});
/* the day's journal: the sheet for a new trade, then the trades logged, one line each (a press opens a trade's own
   sheet), then the day's deposits */
const TradeJournal = memo(function TradeJournal({ list, deps, removing, api, ghost, shown }) {
  const [open, setOpen] = useState(null);
  const [seen, setSeen] = useState({});                    // sheets are built the first time they are opened
  const [view, setView] = useState(null);                  // the picture opened large
  const toggle = (id) => { setOpen((o) => (o === id ? null : id)); setSeen((s) => (s[id] ? s : { ...s, [id]: true })); };
  return (
    <>
      <TradeSheet api={api} ghost={ghost} />
      {list.length > 0 && <div style={{ ...S.sectionLabel, marginTop: 18 }}>Logged</div>}
      <div style={S.expList}>
        {list.map((it, idx) => {
          const res = resOf(it), sign = res === "win" ? "+" : res === "loss" ? "−" : "";
          const meta = [it.rr && `${sign}${it.rr}R`, it.tp && `TP ${it.tp}%`, it.risk && `${it.risk}% risk`, it.lev && `${it.lev}x`, it.dur, it.note || it.pre].filter(Boolean).join("  ·  ");
          return (
            <div key={it.id} className={`row-wrap${removing[it.id] ? " collapsing" : ""}`}>
              <div style={S.fold}>
                <div style={{ transformOrigin: "center center", animation: removing[it.id] ? "popOutCenter .24s ease both" : `fadeDown .25s ease ${90 + idx * 45}ms backwards` }}>
                  <div className={`jr-item glass-soft ${res}${open === it.id ? " open" : ""}`}>
                    <div className="jr-sum" onClick={() => toggle(it.id)} title={open === it.id ? "Close" : "Open this trade"}>
                      <span className="jr-badge"><span className="msym">{JR_RES[res][1]}</span>{JR_RES[res][0]}</span>
                      <span className="jr-name">{it.pair || "No pair"}{ghost && it.pair && !it.pair.includes("/") && coinOf(it.pair) === it.pair && <i>{ghost}</i>}</span>
                      <span className={`jr-tag ${it.side}`}>{it.side === "short" ? "Short" : "Long"}</span>
                      {it.tf && <span className="jr-tag tf" style={{ "--tf": tfTint(it.tf) }}>{it.tf}</span>}
                      <span className="jr-meta">{meta}</span>
                      {it.imgs && <span className="jr-pics" title={it.imgs.length === 1 ? "1 picture" : `${it.imgs.length} pictures`}><span className="msym">image</span>{it.imgs.length}</span>}
                      <span className="jr-amt">{api.current.money(it.pnl)}</span>
                      <span className="msym jr-chev">expand_more</span>
                      <button className="trash-btn" style={S.delBtn} onClick={(e) => { e.stopPropagation(); api.current.del(it.id); }} title="Delete"><TrashIcon /></button>
                    </div>
                    <div className="jr-fold">
                      <div style={S.fold}>{seen[it.id] && <TradeSheet trade={it} api={api} ghost={ghost} active={open === it.id} onView={setView} />}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <DepositBox list={deps} api={api} shown={shown} />
      {view && <ShotView id={view} onClose={() => setView(null)} />}
    </>
  );
});

const TEST_STOCKS = ["BBCA", "BBCA", "BBCA", "BBRI", "BBRI", "BMRI", "BMRI", "TLKM", "ASII", "ANTM", "ANTM", "ADRO", "GOTO", "BREN", "AMMN", "UNVR", "MDKA", "PGAS", "BRIS"];
/* What differs between the two trading sides: where the data is kept, the currency trades are kept in (and its
   decimals), whether a trade has a side, and the words for things. */
const MARKETS = {
  crypto: { key: CRYPTO_KEY, prefsKey: CRYPTO_PREFS_KEY, base: "USDT", dp: 2, sides: true, journal: true, ghost: "USDT.P", nameOf: coinOf,
            hint: "Pair — e.g. BTC, ETH, SOL", small: "Pair", none: "No pair", things: "Coins", app: "flow-crypto", file: "crypto-export", word: "crypto",
            calc: "Calculator", testNames: TEST_COINS, testStep: 0.01,
            test: { bal: 1000, min: 5, max: 40, balUnit: ["USDT", 1, 100], sizeUnit: ["USDT", 1, 5] } },
  idx: { key: "pnl-idx-idr", prefsKey: "pnl-idx-prefs", base: "IDR", dp: 0, sides: false, ghost: "", nameOf: (pair) => pair,
         hint: "Stock — e.g. BBCA, TLKM, ANTM", small: "Stock", none: "No stock", things: "Stocks", app: "flow-idx", file: "idx-export", word: "stock",
         calc: "Calculator", testNames: TEST_STOCKS, testStep: 500,
         test: { bal: 100, min: 500, max: 3000, balUnit: ["jt", 1e6, 10], sizeUnit: ["Rb", 1e3, 100] } },
};

/* test-data presets for the trading side: what kind of trader the made-up trades come from.
   win = the share of trades won, drawn afresh for each month; days = the chance a day has trades; count = trades on
   such a day; rr = how big a winner is against a loser; wild = the chance a trade is several times the usual size */
const TRADE_STYLES = {
  steady:  { label: "Steady", icon: "balance", desc: "Wins a little more than half, even sizes",
             win: [0.5, 0.6], days: 0.7, count: [1, 3], rr: 1, wild: 0.03 },
  sniper:  { label: "Sniper", icon: "my_location", desc: "Few trades, mostly right, lets winners run",
             win: [0.56, 0.72], days: 0.34, count: [1, 1], rr: 1.7, wild: 0.05 },
  scalper: { label: "Scalper", icon: "bolt", desc: "Many small trades every single day",
             win: [0.54, 0.66], days: 0.92, count: [3, 7], rr: 0.8, wild: 0.01, size: 0.5 },
  degen:   { label: "Degen", icon: "casino", desc: "Big swings: lucky months, then blown ones",
             win: [0.32, 0.6], days: 0.75, count: [1, 4], rr: 1.3, wild: 0.14 },
  slump:   { label: "Slump", icon: "trending_down", desc: "Loses more often than it wins",
             win: [0.36, 0.48], days: 0.65, count: [1, 3], rr: 1, wild: 0.04 },
};
const TEST_FREQ = { less: 0.55, norm: 1, more: 1.6 };
const WILD_MEAN = 4.5;                                // a wild trade is 3 to 6 times the usual size
// the settings as saved: anything missing or odd falls back to the market's own defaults (MARKETS[…].test)
const cleanTradeTest = (c, T) => {
  const o = c && typeof c === "object" ? c : {};
  const n = (v, dflt) => (Number.isFinite(v) && v > 0 && v <= 1e7 ? v : dflt);
  const min = n(o.min, T.min);
  return { bal: n(o.bal, T.bal), min, max: Math.max(min, n(o.max, T.max)), freq: TEST_FREQ[o.freq] ? o.freq : "norm",
           style: TRADE_STYLES[o.style] ? o.style : "steady", range: ["year", "month", "rest"].includes(o.range) ? o.range : "year" };
};
// roughly what a style comes to in a month with these settings (shown in the settings pop-up)
const tradeStyleEst = (st, cfg, T) => {
  const f = TEST_FREQ[cfg.freq] || 1, w = (st.win[0] + st.win[1]) / 2;
  const trades = 30.4 * Math.min(0.96, st.days * f) * ((st.count[0] + st.count[1]) / 2) * Math.max(1, f);
  const size = ((cfg.min + cfg.max) / 2) * T.sizeUnit[1] * (st.size || 1) * (1 + st.wild * (WILD_MEAN - 1));
  return { trades, win: w, pnl: trades * size * (w * Math.sqrt(st.rr) - (1 - w) / Math.sqrt(st.rr)) };
};

/* the test-data settings (double-click "Add test data"), the finance side's pop-up with a trader's questions.
   It keeps its own draft, so typing in it never redraws the tracker behind it */
const TradeTestCfg = ({ cfg, M, year, month, onRun, onClose }) => {
  const T = M.test;
  const draftOf = (c) => ({ ...c, balStr: String(c.bal), minStr: String(c.min), maxStr: String(c.max) });
  const [d, setD] = useState(() => draftOf(cfg));
  const [closing, setClosing] = useState(false);
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const num = (str) => { const v = parseFloat(String(str).replace(",", ".")); return isNaN(v) ? null : Math.max(0, Math.min(1e7, v)); };
  const bal = num(d.balStr), lo = num(d.minStr), hi = num(d.maxStr);
  const ok = bal > 0 && lo > 0 && hi !== null && hi >= lo;
  const close = () => { setClosing(true); setTimeout(onClose, 230); };
  const run = () => { if (!ok) return; onRun({ bal, min: lo, max: hi, freq: d.freq, style: d.style, range: d.range }); close(); };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      // the arrow keys step months in the panel behind: not while this is open
      else if (e.key.startsWith("Arrow") && !/^(input|textarea)$/i.test(e.target.tagName || "")) e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const bump = (k, by) => { const s = Math.abs(by), v = num(d[k]) ?? 0; set({ [k]: String(Math.max(s, Math.round((v + by) / s) * s)) }); };
  const seg = (value, options, onPick) => (
    <span className="tcfg-seg">
      {options.map(([v, lbl]) => <button key={v} className={value === v ? "on" : ""} onClick={() => onPick(v)}>{lbl}</button>)}
    </span>
  );
  const numBox = (k, [unit, , step]) => (
    <span className={`tcfg-num wide${num(d[k]) === null ? " bad" : ""}`}>
      <button onClick={() => bump(k, -step)} aria-label="Less">−</button>
      <input value={d[k]} inputMode="decimal" onChange={(e) => set({ [k]: e.target.value.replace(/[^\d.,]/g, "") })}
             onKeyDown={(e) => { if (e.key === "Enter") run(); }} />
      <span className="tcfg-unit">{unit}</span>
      <button onClick={() => bump(k, step)} aria-label="More">+</button>
    </span>
  );
  const sym = M.base === "USDT" ? "$" : "";
  const signed = (v) => `${v < 0 ? "-" : "+"}${sym}${curBody(M.base, Math.abs(v))}`;
  const live = ok ? { ...d, min: lo, max: hi } : null;                 // the numbers as typed, once they make sense
  const est = live ? tradeStyleEst(TRADE_STYLES[d.style], live, T) : null;
  const where = d.range === "month" ? `${MONTHS_FULL[month]} ${year}` : d.range === "rest" ? `${MONTHS_SHORT[month]}–Dec ${year}` : `all of ${year}`;
  return (
    <div style={{ ...S.backdrop, zIndex: 70, animation: closing ? "fadeOut .22s ease both" : "fadeIn .22s ease backwards" }} onClick={close}>
      <div className="glass tcfg-modal" onClick={(e) => e.stopPropagation()}
           style={{ animation: closing ? "modalPopOut .23s var(--ease-soft) both" : "modalPop .42s var(--ease) backwards" }}>
        <div style={S.modalHead}>
          <span style={S.wrKicker}><span className="msym" style={{ fontSize: 17, color: "#e3cd77" }}>science</span>Test data settings</span>
          <button className="x-btn" style={S.closeBtn} onClick={close}>✕</button>
        </div>
        <div className="tcfg-sub">Made-up trades are added to {where}, and the balance is set so that {year} begins on the amount below. Clear test data removes only these trades and puts your own balance back.</div>

        <div className="tcfg-sec">
          <div className="tcfg-h"><span className="msym">account_balance_wallet</span>Account</div>
          <div className="tcfg-row"><span className="tcfg-lbl">Balance on 1 Jan {year}</span>{numBox("balStr", T.balUnit)}</div>
          <div className="tcfg-row"><span className="tcfg-lbl">Win or loss per trade</span>
            <span className="tcfg-ctl">{numBox("minStr", T.sizeUnit)}<span className="tcfg-to">to</span>{numBox("maxStr", T.sizeUnit)}</span></div>
          {lo !== null && hi !== null && hi < lo && <div className="tcfg-err">The maximum must be at least the minimum.</div>}
          <div className="tcfg-row"><span className="tcfg-lbl">How often</span>
            {seg(d.freq, [["less", "Less"], ["norm", "Normal"], ["more", "More"]], (v) => set({ freq: v }))}</div>
        </div>

        <div className="tcfg-sec">
          <div className="tcfg-h"><span className="msym">candlestick_chart</span>Trading style</div>
          <div className="tcfg-styles">
            {Object.entries(TRADE_STYLES).map(([k, st]) => {
              const e = live ? tradeStyleEst(st, live, T) : null;
              return (
                <button key={k} className={`tcfg-style${d.style === k ? " on" : ""}`} onClick={() => set({ style: k })}>
                  <span className="msym tcfg-style-ico">{st.icon}</span>
                  <span className="tcfg-style-name">{st.label}</span>
                  <span className="tcfg-style-desc">{st.desc}</span>
                  <span className="tcfg-style-est" style={{ color: !e ? "#8a9299" : e.pnl >= 0 ? "#8fd7a4" : "#ff8d97" }}>
                    {e ? `≈ ${signed(e.pnl)}/mo · ${Math.round(e.win * 100)}% win` : `${Math.round(((st.win[0] + st.win[1]) / 2) * 100)}% win`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="tcfg-sec">
          <div className="tcfg-h"><span className="msym">date_range</span>Range</div>
          <div className="tcfg-row"><span className="tcfg-lbl">Months</span>
            {seg(d.range, [["year", `All of ${year}`], ["month", `${MONTHS_SHORT[month]} only`], ["rest", `${MONTHS_SHORT[month]}–Dec`]], (v) => set({ range: v }))}</div>
        </div>

        <div className="tcfg-foot">
          <span className="tcfg-est">
            {est ? <>≈ <b style={{ color: "#e8eaec" }}>{Math.round(est.trades)} trades</b> and ≈ <b style={{ color: est.pnl >= 0 ? "#8fd7a4" : "#ff8d97" }}>{signed(est.pnl)}</b> a month</>
              : "Enter a balance and a size range to continue"}
          </span>
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button className="bk-btn" onClick={() => setD(draftOf(cleanTradeTest(null, T)))}>Reset</button>
            <button className="tcfg-go" disabled={!ok} onClick={run}><span className="msym" style={{ fontSize: 18 }}>auto_awesome</span>Generate</button>
          </span>
        </div>
      </div>
    </div>
  );
};

function TradeTracker({ market, onHome }) {
  const M = MARKETS[market];
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState("year");
  const [fromYear, setFromYear] = useState(false);     // month view opened from the year panel
  const [yearRise, setYearRise] = useState(false);     // rise-in for the header year (month -> year)
  const [yearShift, setYearShift] = useState(false);
  const [trades, setTrades] = useState({});            // "2026-10-02" -> [{ id, pnl, pair, side }]
  const [deps, setDeps] = useState({});                // money put into the account or taken out: "2026-10-02" -> [{ id, amt }]
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [panelClosing, setPanelClosing] = useState(false);
  const [panelAnim, setPanelAnim] = useState(false);
  const [draft, setDraft] = useState({ win: "", winPair: "", loss: "", lossPair: "" });
  const [newSide, setNewSide] = useState("long");
  const [amtEdit, setAmtEdit] = useState(null);        // { id, str } while an entry's amount is being retyped
  const [removing, setRemoving] = useState({});
  const [chartOpen, setChartOpen] = useState(false);
  const [chartClosing, setChartClosing] = useState(false);
  const [chartMode, setChartMode] = useState("line");
  const [chartAt, setChartAt] = useState(null);        // the period the chart pop-up shows: { y, m, dir }
  const [hoverPt, setHoverPt] = useState(null);
  const chartWrapRef = useRef(null);
  const chartModalRef = useRef(null);
  const chartWheelLock = useRef(null);
  const [recap, setRecap] = useState(null);                 // { kind: "year" | "month", y, m }
  const [recapClosing, setRecapClosing] = useState(false);
  const [recapDetail, setRecapDetail] = useState(null);     // "rank" | "coins" | "trades" | "traded"
  const [recapDetailOpen, setRecapDetailOpen] = useState(false);
  const [recapHover, setRecapHover] = useState(null);
  const recapDetailRef = useRef(null);

  /* ---------- currency, exchange rates and the calculator's last levels: kept apart from the trades ---------- */
  const [cur, setCur] = useState(M.base);                 // what the panel shows amounts in (crypto can switch; stocks are in rupiah)
  const [cur2Pick, setCur2Pick] = useState("IDR");        // the second currency of the calculator's results
  const [fx, setFx] = useState({ live: null, manual: {} });   // live: { IDR, MYR, at }, manual: rates typed by hand (they win)
  const [calcOpen, setCalcOpen] = useState(false);
  const [fees, setFees] = useState(IDX_FEES);             // the broker's buy and sell fee, %, for the stock calculator
  const calcDraft = useRef({ inputs: M.sides ? CALC_BLANK : STOCK_BLANK, shown: false });
  const [an, setAn] = useState(() => cleanAn(null));      // the analysis card's time frame: { kind: 7 … 180 | "custom", from, to }
  /* the balance, as he typed it, with the day and the moment he typed it: { v, at, ts }, null until he types one. It is
     tied to that moment: what is logged afterwards for that day or a later one moves it; what is logged for an earlier
     day (a trade entered late) only rewrites the past (inBal).
     Until 5 October 2026 it was kept as a bare offset, so a trade entered late for last week pulled today's balance
     down with it, below zero in the end ("how can i have negative balance?"). */
  const [balMark, setBalMark] = useState(null);
  const [ringLoss, setRingLoss] = useState(false);        // the ring on the Coins card: winnings, or losses
  const prefsRef = useRef({ cur: M.base, cur2: "IDR", fx: { live: null, manual: {} }, calc: null, fees: IDX_FEES, an: cleanAn(null), bal: null, test: cleanTradeTest(null, M.test),
                            quotes: [], dataAt: 0 });
  const savePrefs = (patch) => {
    prefsRef.current = { ...prefsRef.current, ...patch };
    store.set(M.prefsKey, JSON.stringify(prefsRef.current)).catch(() => {});
  };
  /* the calculator's live prices (useQuote): the last price of each name looked up, newest first, and when this side's
     data was last fetched (`dataAt`, shown in the calculator's settings). Kept in the prefs, so offline the last ones
     are still there. One object for the tracker's whole life, so handing it to the calculator redraws nothing. */
  const quoteSaved = useRef(0);
  const quoteBook = useRef(null);
  if (!quoteBook.current) quoteBook.current = {
    market, can: typeof window !== "undefined" && !!(window.flowFX && window.flowFX.quote),
    get: (sym) => prefsRef.current.quotes.find((q) => q.s === sym) || null,
    put: (sym, q) => {
      const quotes = [{ ...q, s: sym }, ...prefsRef.current.quotes.filter((x) => x.s !== sym)].slice(0, QUOTE_KEEP);
      prefsRef.current = { ...prefsRef.current, quotes, dataAt: q.at };
      if (q.at - quoteSaved.current >= QUOTE_SAVE_MS) { quoteSaved.current = q.at; savePrefs({}); }
    },
    at: () => prefsRef.current.dataAt,
  };
  const setFee = (k, v) => {
    const next = { ...prefsRef.current.fees, [k]: v === null || !(v >= 0 && v <= 5) ? IDX_FEES[k] : v };
    setFees(next); savePrefs({ fees: next });
  };
  // the latest USDT rates, asked of the Mac app (the page itself can't reach the internet). Quiet when offline
  const canFetch = M.base === "USDT" && typeof window !== "undefined" && !!window.flowFX;
  const fxBusy = useRef(false);
  const fxAsked = useRef(0);
  const refreshFx = () => {
    const live = prefsRef.current.fx.live, now = Date.now();
    if (!canFetch || fxBusy.current || (live && now - live.at < FX_FRESH_MS) || now - fxAsked.current < 60000) return;
    fxBusy.current = true; fxAsked.current = now;
    window.flowFX.rates().then((r) => {
      if (!r || !fxOk("IDR", r.IDR) || !fxOk("MYR", r.MYR)) return;
      const next = { ...prefsRef.current.fx, live: { IDR: r.IDR, MYR: r.MYR, at: Date.now() } };
      setFx(next); savePrefs({ fx: next, dataAt: next.live.at });
    }).catch(() => {}).finally(() => { fxBusy.current = false; });
  };
  const rateOf = (c) => (c === "USDT" ? 1 : fx.manual[c] || (fx.live && fx.live[c]) || FX_DEFAULT[c]);
  const setRate = (c, v) => {
    const manual = { ...prefsRef.current.fx.manual };
    if (fxOk(c, v)) manual[c] = v; else delete manual[c];
    const next = { ...prefsRef.current.fx, manual };
    setFx(next); savePrefs({ fx: next });
  };
  // one click: USDT ⇄ IDR, or back to USDT from MYR. Three quick clicks in a row: MYR. Every click acts at once (the
  // first two of the three just switch as usual), so going USDT, IDR, USDT, IDR quickly never lands on MYR by accident
  // the way the old double click did, and nothing waits on a timer
  const curRun = useRef({ at: 0, n: 0 });
  const onCurClick = (e) => {
    const run = curRun.current, at = e.timeStamp;
    run.n = at - run.at <= CUR_TRIPLE_MS ? run.n + 1 : 1;
    run.at = at;
    const triple = run.n === 3;
    if (triple) run.n = 0;                 // the click after a triple starts a new count: one click back to USDT
    const next = triple ? "MYR" : cur === "USDT" ? "IDR" : "USDT";
    setCur(next); savePrefs({ cur: next }); refreshFx();
  };
  const cur2 = cur2Pick !== cur ? cur2Pick : cur === "USDT" ? "IDR" : "USDT";
  const onCur2Click = () => { const next = CUR_LIST.find((c) => c !== cur && c !== cur2); setCur2Pick(next); savePrefs({ cur2: next }); };
  const openCalc = () => { refreshFx(); setCalcOpen(true); };

  /* ---------- data: load once, then every change is written in order ---------- */
  const tradesRef = useRef(trades);
  const depsRef = useRef(deps);
  const saveChain = useRef(Promise.resolve());
  useEffect(() => {
    (async () => {
      try {
        const res = await store.get(M.key);
        if (res && res.value) {
          const saved = JSON.parse(res.value), t = migrateTrades(saved.trades, M.dp), dps = migrateDeps(saved.deps, M.dp);
          tradesRef.current = t; setTrades(t); depsRef.current = dps; setDeps(dps);
          // the pictures of trades that are gone go now, while nothing can be attaching one (never if the trades could not be read)
          if (M.journal && saved.trades && typeof saved.trades === "object") shotSweep(t);
        }
      } catch (e) {}
      try {
        const res = await store.get(M.prefsKey);
        const p = res && res.value ? JSON.parse(res.value) : null;
        if (p && typeof p === "object") {
          const pf = p.fx && typeof p.fx === "object" ? p.fx : {};
          const live = pf.live && fxOk("IDR", pf.live.IDR) && fxOk("MYR", pf.live.MYR) ? { IDR: pf.live.IDR, MYR: pf.live.MYR, at: Number(pf.live.at) || 0 } : null;
          const manual = {};
          ["IDR", "MYR"].forEach((c) => { if (pf.manual && fxOk(c, pf.manual[c])) manual[c] = pf.manual[c]; });
          const calc = p.calc && typeof p.calc === "object" ? { inputs: (M.sides ? cleanCalc : cleanStock)(p.calc.inputs), shown: !!p.calc.shown } : null;
          const fee = (k) => (p.fees && p.fees[k] >= 0 && p.fees[k] <= 5 ? Number(p.fees[k]) : IDX_FEES[k]);
          // a balance saved the old way (a bare offset, `base`) becomes the balance that offset comes to today, as if typed
          // today. One that comes to less than nothing is dropped: he is asked for it again
          const today = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
          const fromBase = (b, own) => {
            if (!Number.isFinite(b) || Math.abs(b) > 2 * MAX_AMOUNT) return null;
            let v = b;
            for (const k in tradesRef.current) if (k <= today) for (const t of tradesRef.current[k]) if (!own || !t.test) v += t.pnl;
            for (const k in depsRef.current) if (k <= today) for (const t of depsRef.current[k]) v += t.amt;
            return v >= 0 ? { v: Math.round(v * 100) / 100, at: today, ts: Date.now() } : null;
          };
          prefsRef.current = { cur: M.base === "USDT" && CUR_LIST.includes(p.cur) ? p.cur : M.base, cur2: CUR_LIST.includes(p.cur2) ? p.cur2 : "IDR",
                               fx: { live, manual }, calc, fees: { buy: fee("buy"), sell: fee("sell") },
                               an: cleanAn(p.an), bal: cleanBal(p.bal) || fromBase(p.base, false),
                               test: cleanTradeTest(p.test, M.test),
                               quotes: cleanQuotes(p.quotes), dataAt: p.dataAt > 0 ? Number(p.dataAt) : 0 };
          // his own balance, put aside while test data stands in for it
          if ("balKeep" in p) prefsRef.current.balKeep = cleanBal(p.balKeep);
          else if ("baseKeep" in p) prefsRef.current.balKeep = fromBase(p.baseKeep, true);
          setCur(prefsRef.current.cur); setCur2Pick(prefsRef.current.cur2); setFx(prefsRef.current.fx); setFees(prefsRef.current.fees);
          setAn(prefsRef.current.an); setBalMark(prefsRef.current.bal); setTestCfg(prefsRef.current.test);
          if (calc) calcDraft.current = calc;
        }
      } catch (e) {}
      setLoaded(true);
      refreshFx();
    })();
  }, []);
  const persist = () => {
    const snapshot = JSON.stringify({ version: 1, trades: tradesRef.current, deps: depsRef.current });
    setSaving(true);
    const mine = saveChain.current.then(async () => {
      try { await store.set(M.key, snapshot); setSaveError(false); }
      catch (e) { console.error(e); setSaveError(true); }
    });
    saveChain.current = mine;
    return mine.then(() => { if (saveChain.current === mine) setSaving(false); });
  };
  const commit = (next, save = true) => {
    if (!loaded) return Promise.resolve();
    tradesRef.current = next; setTrades(next);
    return save ? persist() : Promise.resolve();
  };
  const commitDeps = (next) => {
    if (!loaded) return Promise.resolve();
    depsRef.current = next; setDeps(next);
    return persist();
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = `${MONTHS_SHORT[month]} ${year}`;
  const monthLabelFull = `${MONTHS_FULL[month]} ${year}`;
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayNum = isCurrentMonth ? now.getDate() : -1;

  const ms = useMemo(() => cryptoMonth(trades, year, month), [trades, year, month]);
  // this year + the next two, every year that holds trades, and whichever year is being viewed
  const YEARS = useMemo(() => {
    const ys = new Set([now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2, year]);
    Object.keys(trades).forEach((k) => { const y = parseInt(k.slice(0, 4), 10); if (y > 1900 && y < 3000) ys.add(y); });
    return [...ys].sort((a, b) => a - b);
  }, [trades, year]);
  const allYears = useMemo(() => YEARS.map((y) => cryptoYear(trades, y)), [trades, YEARS]);
  const yearIdx = Math.max(0, YEARS.indexOf(year));
  const ys = allYears[yearIdx];
  const pnlVsPrev = useMemo(() => {
    const pd = new Date(year, month - 1, 1);
    const pm = cryptoMonth(trades, pd.getFullYear(), pd.getMonth());
    if (!pm.n || pm.pnl === 0 || !ms.n) return null;
    return { pct: ((ms.pnl - pm.pnl) / Math.abs(pm.pnl)) * 100, name: MONTHS_FULL[pd.getMonth()], prev: pm.pnl };
  }, [trades, year, month, ms]);

  /* ---------- header year: the digits flicker from the normal font into the pixel font when the panel opens ---------- */
  const [yearFlick, setYearFlick] = useState(() => Array.from({ length: String(now.getFullYear()).length }, () => ({
    cls: `fk${Math.floor(Math.random() * 3)}`,
    style: { "--kd": `${YEAR_FLICK_DELAY_MS + 300 + Math.round(Math.random() * 240)}ms`, "--kt": `${Math.round(800 + Math.random() * 350)}ms` },
  })));
  useEffect(() => {
    if (!yearFlick) return;
    const t = setTimeout(() => setYearFlick(null), YEAR_FLICK_MS + 300);
    return () => clearTimeout(t);
  }, [yearFlick]);

  /* ---------- year stack: one scroll step per year ---------- */
  const yearWrapRef = useRef(null);
  const wheelLock = useRef(null);
  const stepYear = (dir) => {
    const next = Math.min(YEARS.length - 1, Math.max(0, yearIdx + dir));
    if (next === yearIdx) return;
    setYearShift(true);
    setYear(YEARS[next]);
    setTimeout(() => setYearShift(false), 420);
  };
  useEffect(() => {
    if (view !== "year") return;
    const el = yearWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const big = Math.abs(e.deltaY) >= 4;
      if (big) e.preventDefault();
      if (wheelSwipe(wheelLock, big, e.deltaY)) stepYear(e.deltaY > 0 ? 1 : -1);
    };
    const onKey = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (chartOpen || calcOpen || recap) return;   // the chart pop-up browses on its own
      e.preventDefault();
      stepYear(e.key === "ArrowDown" ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [view, yearIdx, YEARS, chartOpen, calcOpen, recap]);

  // one month forward or back, staying inside the years that exist (YEARS)
  const monthAfter = (y, m, dir) => {
    const mm = m + dir;
    if (mm >= 0 && mm <= 11) return { y, m: mm };
    const i = YEARS.indexOf(y) + dir;
    return i < 0 || i >= YEARS.length ? null : { y: YEARS[i], m: dir > 0 ? 0 : 11 };
  };
  const nav = (dir) => {
    const to = monthAfter(year, month, dir);
    if (!to) return;
    setMonth(to.m); setYear(to.y); setSelected(null);
  };
  useEffect(() => {
    if (view !== "month") return;
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (chartOpen || calcOpen || recap) return;
      e.preventDefault();
      nav(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, year, month, chartOpen, calcOpen, recap, YEARS]);

  /* ---------- month title flicker: the same one as the finance side ---------- */
  const [monthFlick, setMonthFlick] = useState(null);
  const monthShown = useRef(null);
  useLayoutEffect(() => {
    if (view !== "month") { monthShown.current = null; return; }
    const name = MONTHS_FULL[month], from = monthShown.current;
    monthShown.current = name;
    const wait = from ? 0 : YEAR_FLICK_DELAY_MS;
    const shift = from ? [] : monthTwinShift(name);
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    setMonthFlick((f) => ({
      id: (f?.id || 0) + 1, wait, from,
      cells: Array.from({ length: Math.max(name.length, from ? from.length : 0) }, (_, i) => (from
        ? { cls: `fk${rnd(0, 2)}`, style: { "--kd": `${i * 45 + rnd(0, 90)}ms`, "--kt": `${rnd(1250, 1650)}ms`, "--ox": `${monthTightShift(from, i) - monthTightShift(name, i)}px` } }
        : { cls: `fk${rnd(0, 2)}`, style: { "--kd": `${wait + rnd(0, 240)}ms`, "--kt": `${rnd(800, 1150)}ms`, "--nx": `${shift[i] || 0}px` } })),
    }));
  }, [view, year, month]);
  useEffect(() => {
    if (!monthFlick?.cells) return;
    const t = setTimeout(() => setMonthFlick((f) => (f && f.id === monthFlick.id ? { ...f, cells: null } : f)), monthFlick.from ? 2400 : monthFlick.wait + 1500);
    return () => clearTimeout(t);
  }, [monthFlick]);

  /* ---------- the selected day and its trades ---------- */
  const selKey = selected !== null ? keyOf(year, month, selected) : null;
  const selTrades = selKey ? trades[selKey] || NO_TRADES : NO_TRADES;
  const selDeps = selKey ? deps[selKey] || NO_DEPS : NO_DEPS;
  const selDay = selected !== null ? ms.days[selected - 1] : null;
  // what is typed for an amount: dollars with cents, or whole rupiah grouped as on the finance side (1.250.000, and a
  // grey .000 to accept with Enter while it is under four digits)
  const amtOf = (str) => (M.dp ? pnlOf(str) : parseNum(str));
  const amtText = (v) => (M.dp ? String(Math.abs(v)) : Math.abs(v).toLocaleString("id-ID"));
  const ghostOf = (str) => !M.dp && digitsOf(str).length > 0 && digitsOf(str).length < 4;
  const addTrade = (sign) => {
    if (selKey === null) return;
    const amt = amtOf(sign > 0 ? draft.win : draft.loss);
    if (!amt) return;
    const pair = pairName(sign > 0 ? draft.winPair : draft.lossPair);
    const cur = tradesRef.current;
    commit({ ...cur, [selKey]: [...(cur[selKey] || []), { id: uid(), pnl: sign * amt, pair, side: M.sides ? newSide : "long" }] });
    setDraft((d) => (sign > 0 ? { ...d, win: "", winPair: "" } : { ...d, loss: "", lossPair: "" }));
  };
  const editTrade = (id, patch, save) => {
    const cur = tradesRef.current;
    commit({ ...cur, [selKey]: (cur[selKey] || []).map((it) => (it.id === id ? { ...it, ...patch } : it)) }, save);
  };
  const commitAmt = (it) => {
    const v = amtEdit && amtEdit.id === it.id ? amtOf(amtEdit.str) : 0;
    setAmtEdit(null);
    if (v && v !== Math.abs(it.pnl)) editTrade(it.id, { pnl: Math.sign(it.pnl) * v }, true);
  };
  const deleteTrade = (id) => {
    const key = selKey;
    setRemoving((r) => ({ ...r, [id]: true }));
    setTimeout(() => {
      const cur = tradesRef.current;
      const rem = (cur[key] || []).filter((it) => it.id !== id);
      const next = { ...cur };
      if (rem.length === 0) delete next[key]; else next[key] = rem;
      commit(next);
      setRemoving((r) => { const c = { ...r }; delete c[id]; return c; });
    }, 260);
  };
  const closePanel = () => {
    setPanelClosing(true);
    setPanelAnim(true);
    setTimeout(() => { setSelected(null); setPanelClosing(false); setPanelAnim(false); }, 340);
  };
  useEffect(() => {
    if (selected === null) return;
    setPanelAnim(true);
    const t = setTimeout(() => setPanelAnim(false), 360);
    return () => clearTimeout(t);
  }, [selected]);

  /* ---------- chart pop-up: its own month / year, so browsing in it never moves the panel behind ---------- */
  const cY = chartOpen && chartAt ? chartAt.y : year;
  const cM = chartOpen && chartAt ? chartAt.m : month;
  const cDays = new Date(cY, cM + 1, 0).getDate();
  const cToday = cY === now.getFullYear() && cM === now.getMonth() ? now.getDate() : -1;
  const chartLabel = view === "year" ? String(cY) : `${MONTHS_SHORT[cM]} ${cY}`;
  const chartYearIdx = YEARS.indexOf(cY);
  const chartCanStep = (dir) => (view === "year" ? chartYearIdx + dir >= 0 && chartYearIdx + dir < YEARS.length : !!monthAfter(cY, cM, dir));
  const stepChart = (dir) => {
    setHoverPt(null);
    setChartAt((c) => {
      if (!c) return c;
      if (view === "year") {
        const i = YEARS.indexOf(c.y) + dir;
        return i < 0 || i >= YEARS.length ? c : { y: YEARS[i], m: c.m, dir };
      }
      const to = monthAfter(c.y, c.m, dir);
      return to ? { ...to, dir } : c;
    });
  };
  const closeChart = (after) => {
    setChartClosing(true); setHoverPt(null);
    setTimeout(() => {
      setChartOpen(false); setChartClosing(false); setChartAt(null); setChartCmp(0);
      if (after) after();
    }, 190);
  };
  // clicking a point leaves the chart and opens that day / month
  const chartGo = (isMonthMode, i) => closeChart(() => {
    setYear(cY);
    if (isMonthMode) { setMonth(cM); setView("month"); setSelected(i + 1); }
    else { setMonth(i); setView("month"); setSelected(null); }
  });
  useEffect(() => {
    if (!chartOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") { closeChart(); return; }
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      e.preventDefault();
      stepChart(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
    };
    const el = chartWrapRef.current;
    const onWheel = (e) => {
      const md = chartModalRef.current;
      if (md && md.scrollHeight > md.clientHeight + 1) return;      // a pop-up too tall for the window keeps its normal scrolling
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      e.preventDefault();
      if (wheelSwipe(chartWheelLock, Math.abs(d) >= 4, d)) stepChart(d > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    if (el) el.addEventListener("wheel", onWheel, { passive: false });
    return () => { window.removeEventListener("keydown", onKey); if (el) el.removeEventListener("wheel", onWheel); };
  }, [chartOpen, view, YEARS]);
  const chartVals = useMemo(() => (view === "year"
    ? (cY === year ? ys : cryptoYear(trades, cY)).months.map((m) => (m.n ? m.pnl : null))
    : (cY === year && cM === month ? ms : cryptoMonth(trades, cY, cM)).days.map((d) => (d ? d.pnl : null))),
  [trades, view, cY, cM, year, month, ys, ms]);
  // compare (see CmpButton): 0 off, -1 the period before the chart's, 1 the one after
  const [chartCmp, setChartCmp] = useState(0);
  const chartCmpData = useMemo(() => {
    if (!chartOpen) return null;
    const of = (dir) => {
      let vals, label;
      if (view === "year") {
        const y = YEARS[YEARS.indexOf(cY) + dir];
        if (YEARS.indexOf(cY) < 0 || y === undefined) return null;
        vals = cryptoYear(trades, y).months.map((m) => (m.n ? m.pnl : null)); label = String(y);
      } else {
        const to = monthAfter(cY, cM, dir);
        if (!to) return null;
        vals = cryptoMonth(trades, to.y, to.m).days.map((d) => (d ? d.pnl : null)); label = `${MONTHS_SHORT[to.m]} ${to.y}`;
      }
      return vals.some((v) => v !== null) ? { vals, label, per: `${view}|${cY}|${cM}` } : null;
    };
    return { "-1": of(-1), 1: of(1) };
  }, [chartOpen, trades, view, cY, cM, YEARS]);
  const cmpOn = (chartCmp && chartCmpData && chartCmpData[chartCmp]) || null;
  const cmpWas = useGone(cmpOn);
  const cmpGone = cmpWas && cmpWas.per === `${view}|${cY}|${cM}` ? cmpWas : null;

  /* ---------- PnL analysis: its time frame, and the balance that its percentage and asset charts stand on ---------- */
  // a preset time frame ends today, or on the last day of the month shown once that month is over
  const anEnd = Math.min(dayNo(year, month, daysInMonth), dayNo(now.getFullYear(), now.getMonth(), now.getDate()));
  const { start: anFrom, end: anTo } = anWindow(an, anEnd, year, month);
  const anTot = useMemo(() => {
    const t = newTally();
    for (let d = anFrom; d <= anTo; d++) tally(trades[dayIso(d)] || [], t);
    return t;
  }, [trades, anFrom, anTo]);
  // everything made up to today: what lies between `base` and the balance now (test data also fills the months still to come)
  const anToday = keyOf(now.getFullYear(), now.getMonth(), now.getDate());
  const allPnl = useMemo(() => {
    let s = 0;
    for (const k in trades) if (k <= anToday) for (const t of trades[k]) s += t.pnl;
    return Math.round(s * 100) / 100;
  }, [trades, anToday]);
  // and everything put into the account or taken out of it up to today
  const allDep = useMemo(() => {
    let s = 0;
    for (const k in deps) if (k <= anToday) for (const t of deps[k]) s += t.amt;
    return Math.round(s * 100) / 100;
  }, [deps, anToday]);
  // what the account would hold with nothing logged at all, worked back from the balance and its day: what the charts stand on
  const eqBase = useMemo(() => {
    if (!balMark) return null;
    let s = 0;
    for (const k in trades) if (k <= balMark.at) for (const t of trades[k]) if (inBal(balMark, k, t.id)) s += t.pnl;
    for (const k in deps) if (k <= balMark.at) for (const t of deps[k]) if (inBal(balMark, k, t.id)) s += t.amt;
    return Math.round((balMark.v - s) * 100) / 100;
  }, [balMark, trades, deps]);
  // handed to the card as one ref, so the card is not redrawn every time this panel is
  const anApi = useRef(null);
  anApi.current = {
    setAn: (next) => { setAn(next); savePrefs({ an: next }); },
    // the balance is kept with today's date and this moment: from here on it rises and falls with what is logged
    setBalance: (v) => { const bal = v === null ? null : { v, at: anToday, ts: Date.now() }; setBalMark(bal); savePrefs({ bal }); },
  };

  /* ---------- the month in detail: coins, sides, best and worst trade ---------- */
  const detail = useMemo(() => {
    const coins = {}, sides = { long: newTally(), short: newTally() };
    let best = null, worst = null;
    for (let d = 1; d <= daysInMonth; d++) {
      for (const t of trades[keyOf(year, month, d)] || []) {
        const coin = M.nameOf(t.pair);
        if (!coins[coin]) coins[coin] = { coin, ...newTally() };
        tally([t], coins[coin]); tally([t], sides[t.side === "short" ? "short" : "long"]);
        if (t.pnl > 0 && (!best || t.pnl > best.pnl)) best = { ...t, d };
        if (t.pnl < 0 && (!worst || t.pnl < worst.pnl)) worst = { ...t, d };
      }
    }
    return { coins: Object.values(coins).sort((a, b) => b.pnl - a.pnl), sides, best, worst };
  }, [trades, year, month, daysInMonth]);

  /* ---------- wrapped: a year or a month looked back on, in the finance side's own pop-up ---------- */
  // each screen of this side is filed for the next launch's warm-up (see "warm-up" at the top)
  useWarmScreen(`${market}-${view}${chartOpen ? "+chart" : calcOpen ? "+calc" : recap ? "+recap" : ""}`);
  const openRecap = (r) => { setRecapClosing(false); setRecapDetail(null); setRecapDetailOpen(false); setRecapHover(null); setRecap(r); };
  const closeRecap = () => {
    setRecapClosing(true);
    setTimeout(() => { setRecap(null); setRecapClosing(false); }, 240);
  };
  useEffect(() => {
    if (!recap) return;
    const onKey = (e) => { if (e.key === "Escape") closeRecap(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recap]);
  const toggleRecapDetail = (key) => {
    if (recapDetailOpen && recapDetail === key) { setRecapDetailOpen(false); return; }
    setRecapDetail(key); setRecapDetailOpen(true);
    setTimeout(() => recapDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
  };
  const recapData = useMemo(() => {
    if (!recap) return null;
    const { kind, y } = recap;
    const all = [], coins = {}, sides = { long: newTally(), short: newTally() }, units = [];
    let run = 0, streak = 0, greenDays = 0, tradedDays = 0;
    (kind === "year" ? [...Array(12).keys()] : [recap.m]).forEach((m) => {
      const dim = new Date(y, m + 1, 0).getDate();
      const mt = newTally();
      for (let d = 1; d <= dim; d++) {
        const list = trades[keyOf(y, m, d)] || [];
        const day = tally(list);
        tally(list, mt);
        list.forEach((t) => {
          const coin = M.nameOf(t.pair);
          if (!coins[coin]) coins[coin] = { coin, ...newTally() };
          tally([t], coins[coin]); tally([t], sides[t.side === "short" ? "short" : "long"]);
          all.push({ pnl: t.pnl, coin, side: t.side === "short" ? "short" : "long", when: `${d} ${MONTHS_SHORT[m]}` });
        });
        // the longest run of trading days in a row that ended in profit (a day without trades doesn't break it)
        if (day.n) { tradedDays++; if (day.pnl >= 0) { greenDays++; run++; streak = Math.max(streak, run); } else run = 0; }
        if (kind === "month") units.push({ i: d, label: `${DOW_FULL[(new Date(y, m, d).getDay() + 6) % 7]} ${d}`, sub: `${MONTHS_SHORT[m]} ${y}`, short: String(d), value: day.pnl, has: day.n > 0, n: day.n, wins: day.wins });
      }
      if (kind === "year") units.push({ i: m, label: MONTHS_FULL[m], short: MONTHS_SHORT[m], value: mt.pnl, has: mt.n > 0, n: mt.n, wins: mt.wins });
    });
    const tot = tally(all);
    const active = units.filter((u) => u.has);
    const coinList = Object.values(coins);
    return {
      kind, y, m: recap.m, units, tot, sides, streak, greenDays, tradedDays, empty: tot.n === 0, active: active.length,
      best: active.length ? active.reduce((p, q) => (q.value > p.value ? q : p)) : null,
      worst: active.length > 1 ? active.reduce((p, q) => (q.value < p.value ? q : p)) : null,
      avg: active.length ? tot.pnl / active.length : 0,
      ranked: [...active].sort((p, q) => q.value - p.value),
      byPnl: [...coinList].sort((p, q) => q.pnl - p.pnl),
      byCount: [...coinList].sort((p, q) => q.n - p.n || q.pnl - p.pnl),
      wins: all.filter((t) => t.pnl > 0).sort((p, q) => q.pnl - p.pnl),
      losses: all.filter((t) => t.pnl < 0).sort((p, q) => p.pnl - q.pnl),
    };
  }, [recap, trades]);

  /* ---------- backup: export / import the trades ---------- */
  const fileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState("");
  const [undoImport, setUndoImport] = useState(null);
  const msgTimer = useRef(0);
  const flashBackup = (m, t = 3000) => { clearTimeout(msgTimer.current); setBackupMsg(m); msgTimer.current = setTimeout(() => setBackupMsg(""), t); };
  const exportData = async () => {
    // his own trades, the deposits, and the pictures those trades hold (as text, so a backup stays one file)
    const own = ownEntries(trades), images = M.journal ? await shotPack(own) : {};
    const blob = new Blob([JSON.stringify({ app: M.app, version: 1, exportedAt: new Date().toISOString(), trades: own,
      ...(Object.keys(depsRef.current).length ? { deposits: depsRef.current } : {}), ...(Object.keys(images).length ? { images } : {}) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `${M.file}-${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    flashBackup(BACKUP_DONE, 2600);
  };
  const importData = async (file) => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { flashBackup("Could not read that file"); return; }
    // only accept a backup of this same side of the app — never wipe trades with another file (crypto's dollars read as rupiah, say)
    const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (!isObj(data) || !isObj(data.trades) || (data.app || "flow-crypto") !== M.app) { flashBackup(`That isn't a ${M.word} PnL backup file, nothing was changed`, 4000); return; }
    const prev = { trades: tradesRef.current, deps: depsRef.current };
    if (M.journal && isObj(data.images)) await shotUnpack(data.images);
    const dps = migrateDeps(data.deposits, M.dp);
    depsRef.current = dps; setDeps(dps);
    await commit(migrateTrades(data.trades, M.dp));
    setUndoImport(prev);
    flashBackup("Backup restored", 10000);
    setTimeout(() => setUndoImport((u) => (u === prev ? null : u)), 10000);
  };
  const revertImport = async () => {
    if (!undoImport) return;
    const prev = undoImport;
    setUndoImport(null);
    depsRef.current = prev.deps; setDeps(prev.deps);
    await commit(prev.trades);
    flashBackup("Import undone");
  };

  /* ---------- test data: adds to what's there; every generated trade carries test: true so it can be removed again ----------
     One click adds with the saved settings; a double click opens the settings instead (as on the finance side).
     It also sets the balance, so that the year begins on the amount in the settings: the analysis card's percentage
     and asset charts then have something to stand on. His own balance is put aside and comes back on Clear test data. */
  const [testMsg, setTestMsg] = useState("");
  const flashTest = (m) => { setTestMsg(m); setTimeout(() => setTestMsg(""), 3200); };
  const [testCfg, setTestCfg] = useState(() => cleanTradeTest(null, M.test));
  const [testOpen, setTestOpen] = useState(false);
  const testClickTimer = useRef(0);
  const onTestDataClick = (e) => {
    clearTimeout(testClickTimer.current);
    if (e.detail >= 2) { setTestOpen(true); return; }
    testClickTimer.current = setTimeout(() => addTestData(testCfg), 260);
  };
  const runTestCfg = (cfg) => { setTestCfg(cfg); savePrefs({ test: cfg }); addTestData(cfg); };
  const addTestData = (cfg) => {
    if (!loaded) return;
    const st = TRADE_STYLES[cfg.style] || TRADE_STYLES.steady, T = M.test;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const next = { ...tradesRef.current };
    const freq = TEST_FREQ[cfg.freq] || 1;
    const from = cfg.range === "year" ? 0 : month, to = cfg.range === "month" ? month : 11;
    const start = cfg.bal * T.balUnit[1];
    let eq = start, n = 0;                             // the balance as the year goes by, trades already there included
    for (let m = 0; m < 12; m++) {
      const dim = new Date(year, m + 1, 0).getDate();
      const edge = rnd(st.win[0], st.win[1]);          // how good this month is: the share of trades that win
      for (let d = 1; d <= dim; d++) {
        const k = keyOf(year, m, d);
        (next[k] || []).forEach((t) => { eq += t.pnl; });
        if (m < from || m > to || Math.random() >= Math.min(0.96, st.days * freq)) continue;    // not in range, or a day off
        const add = [];
        const count = Math.max(1, Math.round(rnd(st.count[0] - 0.49, st.count[1] + 0.49) * Math.max(1, freq)));
        for (let i = 0; i < count; i++) {
          const win = Math.random() < edge;
          // sizes shrink with a shrunken account (a losing year winds down, it doesn't hit zero in March), never grow with it
          let size = rnd(cfg.min, cfg.max) * T.sizeUnit[1] * (st.size || 1) * (Math.random() < st.wild ? rnd(3, 6) : 1) * (win ? Math.sqrt(st.rr) : 1 / Math.sqrt(st.rr))
            * Math.min(1, Math.max(0.15, eq / start));
          if (!win) size = Math.min(size, Math.max(0, eq) * 0.5);        // and nobody loses more than is in the account
          size = roundTo(Math.round(size / M.testStep) * M.testStep, M.dp);
          if (!(size > 0)) continue;
          // some carry a picture or two (the journal's): a made-up chart, drawn from its number and kept nowhere
          const pics = M.journal && Math.random() < 0.4 ? { imgs: Array.from({ length: Math.random() < 0.3 ? 2 : 1 }, () => `ph:${Math.floor(Math.random() * 1e9)}`) } : {};
          add.push({ id: uid(), pnl: win ? size : -size, pair: pick(M.testNames), side: M.sides && Math.random() >= 0.62 ? "short" : "long", ...pics, test: true });
          eq += win ? size : -size;
        }
        if (add.length) { next[k] = [...(next[k] || []), ...add]; n += add.length; }
      }
    }
    commit(next);
    // the balance: `start` as the year begins (so on the last day of the year before), whatever earlier years made.
    // The one he had typed is kept for Clear test data
    const bal = { v: start, at: `${year - 1}-12-31`, ts: Date.now() };
    if (!("balKeep" in prefsRef.current)) prefsRef.current = { ...prefsRef.current, balKeep: prefsRef.current.bal };
    setBalMark(bal); savePrefs({ bal });
    flashTest(`Added ${n} trades · ${year} starts on ${CUR_SIGN[M.base]}${M.dp ? NF0.format(start) : start.toLocaleString("id-ID")}`);
  };
  const clearTestData = () => {
    const next = {};
    let n = 0;
    Object.entries(tradesRef.current).forEach(([k, arr]) => {
      const keep = arr.filter((it) => !it.test); n += arr.length - keep.length;
      if (keep.length) next[k] = keep;
    });
    commit(next);
    if ("balKeep" in prefsRef.current) {
      const { balKeep, ...rest } = prefsRef.current;
      prefsRef.current = rest;
      setBalMark(balKeep); savePrefs({ bal: balKeep });
    }
    flashTest(n ? `Removed ${n} test trades` : "No test data to remove");
  };

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // amounts on the panel, in the currency chosen: trades are kept in USDT and converted only to be shown
  const rate = cur === M.base ? 1 : rateOf(cur), sym = cur === "USDT" ? "$" : "";
  const moneyAbs = (n) => `${sym}${curBody(cur, n * rate)}`;
  const money = (n) => `${signOf(n)}${moneyAbs(n)}`;
  // the journal's way in (crypto day panel), handed over as one ref so the journal is not redrawn with this panel.
  // An edit replaces the trade with what its sheet holds, so a box that was emptied is gone from the trade too
  const jrApi = useRef(null);
  jrApi.current = {
    money, abs: moneyAbs, del: deleteTrade,
    // true when it is added. A withdrawal of more than the account held at the end of that day is refused, and what it
    // held is handed back instead (only when the balance is known)
    addDep: (amt) => {
      const all = depsRef.current;
      if (amt < 0 && eqBase !== null) {
        let held = eqBase;
        for (const k in tradesRef.current) if (k <= selKey) for (const t of tradesRef.current[k]) held += t.pnl;
        for (const k in all) if (k <= selKey) for (const t of all[k]) held += t.amt;
        held = Math.max(0, Math.round(held * 100) / 100);
        if (-amt > held) return held;
      }
      commitDeps({ ...all, [selKey]: [...(all[selKey] || []), { id: uid(), amt }] });
      return true;
    },
    delDep: (id) => {
      const next = { ...depsRef.current }, rest = (next[selKey] || []).filter((it) => it.id !== id);
      if (rest.length) next[selKey] = rest; else delete next[selKey];
      commitDeps(next);
    },
    add: (f) => { const all = tradesRef.current; commit({ ...all, [selKey]: [...(all[selKey] || []), { id: uid(), ...f }] }); },
    edit: (id, f) => { const all = tradesRef.current; commit({ ...all, [selKey]: (all[selKey] || []).map((it) => (it.id === id ? { id, ...f, ...(it.test ? { test: true } : {}) } : it)) }); },
  };
  const absLive = (n, busy, span) => `${sym}${curLive(cur, rate, n, busy, span)}`;
  const moneyLive = (n, busy, span) => `${signOf(busy && span ? span.to : n)}${absLive(n, busy, span)}`;
  const tone = (s) => (!s || !s.n ? C_MUTE : s.pnl >= 0 ? C_GREEN : C_RED);
  const grossBar = (s, key) => (
    <SplitBar remainingVal={WARN_YELLOW} totalVal={s.profit + s.loss} frac={s.profit + s.loss > 0 ? s.profit / (s.profit + s.loss) : 0} animKey={key} />
  );
  // called as plain functions, never as components: a component defined in here would be remounted on every render
  const chartButton = (title) => (
    <button className="chart-btn" style={S.chartBtn} title={title} onClick={() => { setHoverPt(null); setChartAt({ y: year, m: month }); setChartOpen(true); }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect className="cb1" x="1" y="9" width="3" height="6" rx="1.5" fill="currentColor" />
        <rect className="cb2" x="6.5" y="5" width="3" height="10" rx="1.5" fill="currentColor" />
        <rect className="cb3" x="12" y="1" width="3" height="14" rx="1.5" fill="currentColor" />
      </svg>
    </button>
  );
  const barDefs = (
    <defs>
      {/* each bar runs from a lighter shade at its tip to a slightly deeper one at the zero line */}
      <linearGradient id="cBarPos" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cecb4" /><stop offset="100%" stopColor="#2bbd82" /></linearGradient>
      <linearGradient id="cBarNeg" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#ff9aa4" /><stop offset="100%" stopColor="#e5505d" /></linearGradient>
    </defs>
  );

  /* ---------- performance: win rate, verdict and the numbers behind it ---------- */
  const renderPerf = () => {
    if (!ms.n) return <div style={S.flowEmpty}>No trades logged this month yet.</div>;
    const wr = winPct(ms);
    const pf = ms.loss > 0 ? ms.profit / ms.loss : null;                       // null: no losing trade at all
    const band = ms.pnl > 0 ? { word: pf === null || pf >= 2 ? "Strong month" : "Profitable", color: "#8fd7a4" }
      : ms.pnl === 0 ? { word: "Break-even", color: "#e3cd77" } : { word: "In the red", color: "#e2808c" };
    const cond = !pnlVsPrev ? { text: "NO EARLIER MONTH", color: "#8a9299" }
      : ms.pnl > pnlVsPrev.prev ? { text: "IMPROVING", color: "#8fd7a4" }
      : ms.pnl < pnlVsPrev.prev ? { text: "SLIPPING", color: "#e2808c" } : { text: "STEADY", color: "#e3cd77" };
    const R = 52, C = 2 * Math.PI * R, ARC = C * (300 / 360);
    const filled = ARC * (wr / 100);
    const avgWin = ms.wins ? ms.profit / ms.wins : 0, avgLoss = ms.losses ? ms.loss / ms.losses : 0;
    const avgTop = Math.max(avgWin, avgLoss, 1e-9);
    const { best, worst, sides } = detail;
    const bestTop = Math.max(best ? best.pnl : 0, worst ? -worst.pnl : 0, 1e-9);
    const sideBox = (label, s) => (s.n
      ? { label, value: money(s.pnl), note: `${tradesWord(s.n)} · ${winPct(s)}% win`, pct: winPct(s), color: s.pnl >= 0 ? "#8fd7a4" : "#e2808c" }
      : { label, value: "N/A", pct: 0, color: "#8a9299" });
    const dayTop = Math.max(1e-9, ...ms.days.map((d) => (d ? Math.abs(d.pnl) : 0)));
    const dayBox = (label, way, color) => {
      let pick = null;
      ms.days.forEach((d, i) => { if (d && (!pick || (d.pnl - pick.pnl) * way > 0)) pick = { ...d, d: i + 1 }; });
      return pick ? { label, value: money(pick.pnl), note: `${pick.d} ${MONTHS_SHORT[month]} · ${tradesWord(pick.n)}`, pct: (Math.abs(pick.pnl) / dayTop) * 100, color: pick.pnl >= 0 ? "#8fd7a4" : "#e2808c" }
        : { label, value: "N/A", pct: 0, color: "#8a9299" };
    };
    const tradeBox = (label, t, color) => (t
      ? { label, value: money(t.pnl), note: `${M.nameOf(t.pair) || M.none} · ${t.d} ${MONTHS_SHORT[month]}`, pct: (Math.abs(t.pnl) / bestTop) * 100, color }
      : { label, value: "N/A", pct: 0, color: "#8a9299" });
    const boxes = [
      { label: "PROFIT FACTOR", value: pf === null ? "No losses" : pf.toFixed(2), note: pf === null ? null : "won per 1 lost",
        pct: pf === null ? 100 : (pf / 3) * 100, color: pf === null || pf >= 1 ? "#8fd7a4" : "#e2808c" },
      { label: "AVG PER TRADE", value: money(ms.pnl / ms.n), note: tradesWord(ms.n), pct: (Math.abs(ms.pnl / ms.n) / avgTop) * 100, color: ms.pnl >= 0 ? "#8fd7a4" : "#e2808c" },
      { label: "AVG WIN", value: ms.wins ? money(avgWin) : "N/A", note: ms.wins ? `${ms.wins} ${ms.wins === 1 ? "win" : "wins"}` : null, pct: (avgWin / avgTop) * 100, color: ms.wins ? "#8fd7a4" : "#8a9299" },
      { label: "AVG LOSS", value: ms.losses ? money(-avgLoss) : "N/A", note: ms.losses ? `${ms.losses} ${ms.losses === 1 ? "loss" : "losses"}` : null, pct: (avgLoss / avgTop) * 100, color: ms.losses ? "#e2808c" : "#8a9299" },
      tradeBox("BEST TRADE", best, "#8fd7a4"),
      tradeBox("WORST TRADE", worst, "#e2808c"),
      ...(M.sides ? [sideBox("LONGS", sides.long), sideBox("SHORTS", sides.short)] : [dayBox("BEST DAY", 1, "#8fd7a4"), dayBox("WORST DAY", -1, "#e2808c")]),
    ];
    const summary = `You closed ${tradesWord(ms.n)}: ${ms.wins} ${ms.wins === 1 ? "winner" : "winners"} and ${ms.losses} ${ms.losses === 1 ? "loser" : "losers"}. `
      + `Winners brought in ${money(ms.profit)}, losers cost ${money(-ms.loss)}`
      + (pf !== null && ms.profit > 0 ? `, so the winners made ${pf.toFixed(2)} times what the losers cost.` : ".");
    return (
      <div className="score-card" style={{ ...S.scoreCard, borderTop: "none", paddingTop: 6 }}>
        <div key={`gauge-${year}-${month}-${wr}`} className="score-dial" style={{ position: "relative", width: 216, height: 216, flexShrink: 0, "--gc": band.color }}>
          <svg viewBox="0 0 132 132" style={{ width: 216, height: 216, transform: "rotate(120deg)" }}>
            <defs>
              <linearGradient id="cWinGrad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#e2808c" />
                <stop offset="45%" stopColor={wr > 35 ? "#e3cd77" : "#e9a173"} />
                <stop offset="100%" stopColor={wr >= 50 ? "#8fd7a4" : "#e3cd77"} />
              </linearGradient>
            </defs>
            <circle cx="66" cy="66" r={R} fill="none" stroke="#33373b" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${ARC} ${C}`} />
            <circle className="score-arc" cx="66" cy="66" r={R} fill="none" stroke="url(#cWinGrad)" strokeWidth="11"
                    strokeLinecap="round" strokeDasharray={`${filled} ${C}`} />
          </svg>
          <div style={S.scoreCenter}>
            <div style={S.scoreNum}>{wr}</div>
            <div style={S.scoreCap}>WIN RATE</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...S.scoreWord, color: band.color }}>{band.word}</span>
            <span title={pnlVsPrev ? `${money(ms.pnl - pnlVsPrev.prev)} vs ${pnlVsPrev.name}` : "No earlier month to compare"}
                  style={{ ...S.scorePill, color: cond.color, background: "rgba(255,255,255,0.05)", border: `1px solid ${cond.color}44` }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: cond.color, display: "inline-block", marginRight: 7 }} />
              {cond.text}
            </span>
          </div>
          <div style={S.scoreLabel}>TRADING PERFORMANCE</div>
          <p style={S.scoreText}>{summary}</p>
        </div>
        <div style={{ ...S.subRow, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {boxes.map((b, bi) => (
            <div key={b.label} className="sub-box glass-soft" style={{ ...S.subBox, "--tc": b.color, animationDelay: `${260 + bi * 70}ms` }}>
              <div style={S.subLabel}><i style={{ display: "inline-block", width: 6, height: 6, borderRadius: 99, background: b.color, marginRight: 7, verticalAlign: "1px" }} />{b.label}</div>
              <div style={{ ...S.subValue, color: b.color, fontSize: 18, display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                {b.value}
                {b.note && <span style={S.subNote}>{b.note}</span>}
              </div>
              <div style={S.subTrack}>
                <span className="bd-fill" style={{ width: `${Math.max(2, Math.min(100, b.pct))}%`, background: b.color, animationDelay: `${340 + bi * 70}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ---------- coins: what each one made or lost this month ---------- */
  const renderCoins = () => {
    const rows = detail.coins;
    if (!rows.length) return <div style={S.flowEmpty}>No trades logged this month yet.</div>;
    const topAbs = Math.max(...rows.map((r) => Math.abs(r.pnl)), 1e-9);
    return (
      <>
      <CoinRing coins={rows} cur={cur} rate={rate} label={monthLabel} none={M.none} things={M.things.toLowerCase()} loss={ringLoss} onLoss={setRingLoss} />
      <div style={{ ...S.bdList, paddingTop: 8, paddingBottom: 10 }}>
        {rows.map((r, i) => {
          const color = r.pnl >= 0 ? C_GREEN : C_RED;
          return (
            <div key={r.coin || "none"} className="bd-item" style={{ ...S.bdRow, gridTemplateColumns: "minmax(150px, 230px) 76px 1fr 84px", animationDelay: `${60 + i * 55}ms` }}>
              <span style={{ ...S.bdName, display: "flex", alignItems: "center", gap: 10 }}>
                <span className="tok" style={{ background: r.coin ? coinTint(r.coin) : "#4a5055" }}>{r.coin ? r.coin.replace(/^\d+/, "")[0] || r.coin[0] : "?"}</span>
                {r.coin || M.none}
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#6d757d" }}>{tradesWord(r.n)}</span>
              </span>
              <span style={{ ...S.bdPct, fontSize: 12.5, color: "#aeb5bb" }}>{winPct(r)}% win</span>
              <span style={S.bdTrack}>
                <span className="bd-fill" style={{ width: `${Math.max(1, (Math.abs(r.pnl) / topAbs) * 100)}%`, background: color, animationDelay: `${100 + i * 55}ms` }} />
              </span>
              <span style={{ ...S.bdAmt, fontSize: 13.5, fontWeight: 700, color }}>{money(r.pnl)}</span>
            </div>
          );
        })}
      </div>
      </>
    );
  };

  /* ===================== CHART ===================== */
  const renderChartSvg = (mode) => {
    const isMonthMode = mode === "month";
    const N = isMonthMode ? cDays : 12;
    // the data marks are keyed by period, so stepping to another month / year redraws them and leaves the axes still
    const pk = isMonthMode ? `${cY}-${cM}` : `${cY}`;
    const W = 720, H = 380, PL = 64, PR = 20, PT = 24, PB = 44;
    const iw = W - PL - PR, ih = H - PT - PB;
    const X = isMonthMode ? (i) => PL + ((i + 1) / N) * iw : (i) => PL + ((i + 0.5) / N) * iw;
    const labelOf = (i) => (isMonthMode ? `${i + 1} ${MONTHS_SHORT[cM]}` : `${MONTHS_SHORT[i]} ${cY}`);
    const xTickEls = (isMonthMode
      ? Array.from({ length: Math.floor(N / 5) }, (_, k) => ({ x: PL + (((k + 1) * 5) / N) * iw, label: String((k + 1) * 5) }))
      : MONTHS_SHORT.map((nm, m) => ({ x: X(m), label: nm })));
    const tickLive = (n, busy, span) => `${n < -0.004 ? "-" : ""}${absLive(n, busy, span)}`;
    const GREY = "#6d757d";
    const curIdx = isMonthMode ? cToday - 1 : (cY === now.getFullYear() ? now.getMonth() : -1);
    const hasAny = chartVals.some((v) => v !== null);
    const svgProps = { className: chartAt && chartAt.dir ? "ch-moved" : undefined, viewBox: `0 0 ${W} ${H}`, style: { width: "100%", height: "auto" }, onMouseLeave: () => setHoverPt(null) };
    const axes = (yTicks, Y) => (
      <>
        <line className="axis-y" x1={PL} y1={PT} x2={PL} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
        <line className="axis-x" x1={PL - 6} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
        {hasAny && yTicks.map((v, i) => (
          <g key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 30}ms` }}>
            <text x={PL - 10} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end"><CountNum value={v} duration={CMP_MS} render={tickLive} still /></text>
            {Y(v) < PT + ih - 0.5 && <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#2c3034" strokeWidth="1" />}
          </g>
        ))}
        {xTickEls.map((t, i) => (
          <text key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 18}ms` }} x={t.x} y={PT + ih + 20} fill="#8a9299" fontSize="11" textAnchor="middle">{t.label}</text>
        ))}
        {!hasAny && <text x={PL + iw / 2} y={PT + ih / 2 + 14} fill="#4a5055" fontSize="44" fontWeight="800" textAnchor="middle">N/A</text>}
      </>
    );
    const tipMark = hoverPt && (
      <g key={hoverPt.label} className="ch-tip" pointerEvents="none">
        <line x1={hoverPt.x} y1={PT} x2={hoverPt.x} y2={PT + ih} stroke="#4a5055" strokeWidth="1" />
        <circle className="tip-dot" cx={hoverPt.x} cy={hoverPt.y} r="5" fill="#ffffff" />
      </g>
    );

    if (chartMode === "line") {
      // running total through the period. A segment is coloured when it joins consecutive days with trades, grey when
      // it bridges days without any; the colour switches exactly at the data point
      let run = 0;
      const pts = [];
      chartVals.forEach((v, i) => { if (v !== null) { run += v; pts.push({ i, x: X(i), v: run }); } });
      // the period compared with: its own running total
      const ghostOf = (c) => { let r = 0; const g = []; c.vals.slice(0, N).forEach((v, i) => { if (v !== null) { r += v; g.push({ x: X(i), v: r }); } }); return g; };
      const ghost = cmpOn ? ghostOf(cmpOn) : [];
      const vals = [...pts, ...ghost].map((p) => p.v);
      const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
      const span = (maxV - minV) || 1;
      const Y = (v) => PT + ih - ((v - minV) / span) * ih;
      const zeroY = Y(0);
      pts.forEach((p) => { p.y = Y(p.v); });
      ghost.forEach((p) => { p.y = Y(p.v); });
      // start on the y-axis, a little short of the first point's value (see CHART_LEAD), so there's no gap before the 1st
      const full = pts.length ? [{ i: -1, x: PL, y: Y(pts[0].v * CHART_LEAD), v: pts[0].v * CHART_LEAD }, ...pts] : [];
      const linePath = smoothPath(full);
      const areaPath = full.length ? `${linePath} L ${full[full.length - 1].x} ${zeroY} L ${PL} ${zeroY} Z` : "";
      const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minV + f * span);
      const o = (x) => Math.min(1, Math.max(0, (x - PL) / iw));
      const stops = (on, off) => {
        const s = [];
        for (let k = 1; k < full.length; k++) {
          const a = full[k - 1], b = full[k], c = b.i - a.i > 1 ? off : on;
          s.push({ o: o(a.x), c }, { o: o(b.x), c });
        }
        return s.map((st, k) => <stop key={k} offset={st.o} stopColor={st.c} />);
      };
      const hGrad = (id, on, off) => <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={PL} y1="0" x2={PL + iw} y2="0">{stops(on, off)}</linearGradient>;
      const cur = pts.find((q) => q.i === curIdx);
      return (
        <svg key={`cc-line-${mode}`} {...svgProps}>
          <defs>
            <linearGradient id="cPosFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3ddc97" stopOpacity="0.42" /><stop offset="100%" stopColor="#3ddc97" stopOpacity="0.06" /></linearGradient>
            <linearGradient id="cNegFill" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#ff5d6c" stopOpacity="0.42" /><stop offset="100%" stopColor="#ff5d6c" stopOpacity="0.06" /></linearGradient>
            <linearGradient id="cGreyPosFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREY} stopOpacity="0.34" /><stop offset="100%" stopColor={GREY} stopOpacity="0.05" /></linearGradient>
            <linearGradient id="cGreyNegFill" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor={GREY} stopOpacity="0.34" /><stop offset="100%" stopColor={GREY} stopOpacity="0.05" /></linearGradient>
            {hGrad("cLineG", "#3ddc97", GREY)}
            {hGrad("cLineR", "#ff5d6c", GREY)}
            {hGrad("cMaskData", "#fff", "#000")}
            {hGrad("cMaskEmpty", "#000", "#fff")}
            <mask id="cDataMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><rect x="0" y="0" width={W} height={H} fill="url(#cMaskData)" /></mask>
            <mask id="cEmptyMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><rect x="0" y="0" width={W} height={H} fill="url(#cMaskEmpty)" /></mask>
            <clipPath id="cAbove"><rect className="ch-morph" x="0" y="0" width={W} height={zeroY} /></clipPath>
            <clipPath id="cBelow"><rect className="ch-morph" x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
          </defs>
          {axes(yTicks, Y)}
          {hasAny && (
            <Fragment key={pk}>
              {zeroY < PT + ih - 0.5 && <line className="ch-slide" x1={PL} y1="0" x2={W - PR} y2="0" style={{ transform: `translateY(${zeroY}px)` }} stroke="#6d757d" strokeWidth="1" strokeDasharray="3 4" />}
              {cmpOn && <GhostLine key={`g${cmpOn.label}`} pts={ghost} PL={PL} Y={Y} lead />}
              {cmpGone && <GhostLine key={`g${cmpGone.label}`} pts={ghostOf(cmpGone)} PL={PL} Y={Y} lead gone into={full} />}
              <g className="area-rise" style={{ transformOrigin: `0px ${zeroY}px` }}>
                <g mask="url(#cDataMask)">
                  <path className="ch-morph" d={areaPath} fill="url(#cPosFill)" clipPath="url(#cAbove)" />
                  <path className="ch-morph" d={areaPath} fill="url(#cNegFill)" clipPath="url(#cBelow)" />
                </g>
                <g mask="url(#cEmptyMask)">
                  <path className="ch-morph" d={areaPath} fill="url(#cGreyPosFill)" clipPath="url(#cAbove)" />
                  <path className="ch-morph" d={areaPath} fill="url(#cGreyNegFill)" clipPath="url(#cBelow)" />
                </g>
              </g>
              <path className="line-sweep slow ch-morph" pathLength="1" d={linePath} fill="none" stroke="url(#cLineG)" strokeWidth="2.6" strokeLinecap="round" clipPath="url(#cAbove)" />
              <path className="line-sweep slow ch-morph" pathLength="1" d={linePath} fill="none" stroke="url(#cLineR)" strokeWidth="2.6" strokeLinecap="round" clipPath="url(#cBelow)" />
              {cur && <circle className="axis-fade ch-morph" cx={cur.x} cy={cur.y} r="4" fill="#c7cdd2" />}
              {pts.map((p) => (
                <rect key={p.i} x={p.x - iw / N / 2} y={PT} width={iw / N} height={ih} fill="transparent" style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoverPt({ x: p.x, y: p.y, label: labelOf(p.i), value: money(p.v) })}
                      onClick={() => chartGo(isMonthMode, p.i)} />
              ))}
              {tipMark}
            </Fragment>
          )}
        </svg>
      );
    }

    // bars: what each day (or month) made or lost on its own
    const ghostVals = cmpOn ? cmpOn.vals.slice(0, N) : [];      // the period compared with: what each of its days (or months) made
    const present = [...chartVals, ...ghostVals].filter((v) => v !== null);
    const maxV = Math.max(0, ...present), minV = Math.min(0, ...present);
    const span = (maxV - minV) * 1.08 || 1;
    const top = maxV + (maxV - minV) * (maxV > 0 ? 0.08 : 0);
    const Y = (v) => PT + ((top - v) / span) * ih;
    const zeroY = Y(0);
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => top - f * span);
    const barW = Math.max(6, (iw / N) * 0.72);
    const tops = (list) => list.slice(0, N).map((v, i) => (v === null ? null : { x: X(i), y: Y(v), v })).filter(Boolean);
    return (
      <svg key={`cc-bars-${mode}`} {...svgProps}>
        {barDefs}
        {axes(yTicks, Y)}
        {hasAny && (
          <Fragment key={pk}>
            {minV < 0 && <line className="ch-slide" x1={PL} y1="0" x2={W - PR} y2="0" style={{ transform: `translateY(${zeroY}px)` }} stroke="#6d757d" strokeWidth="1" strokeDasharray="3 4" />}
            {cmpOn && <GhostLine key={`g${cmpOn.label}`} pts={tops(cmpOn.vals)} PL={PL} Y={Y} lead />}
            {cmpGone && <GhostLine key={`g${cmpGone.label}`} pts={tops(cmpGone.vals)} PL={PL} Y={Y} lead gone into={tops(chartVals)} />}
            {chartVals.map((v, i) => (v === null ? null : (
              <rect key={i} className="bar-grow ch-morph" x={X(i) - barW / 2} width={barW} rx={Math.min(6, barW / 4)}
                    y={v >= 0 ? Y(v) : zeroY} height={Math.max(1.5, Math.abs(Y(v) - zeroY))}
                    fill={v >= 0 ? "url(#cBarPos)" : "url(#cBarNeg)"} opacity="0.92"
                    style={{ animationDelay: `${120 + i * 18}ms`, cursor: "pointer", transformOrigin: v >= 0 ? "center bottom" : "center top" }}
                    onMouseEnter={() => setHoverPt({ x: X(i), y: v >= 0 ? Y(v) : zeroY, label: labelOf(i), value: money(v) })}
                    onClick={() => chartGo(isMonthMode, i)} />
            )))}
            {tipMark}
          </Fragment>
        )}
      </svg>
    );
  };

  /* ---------- wrapped: the pop-up ---------- */
  const renderRecapDetail = (r) => {
    const isYear = r.kind === "year";
    const coinName = (c) => c || M.none;
    const pnlCol = (v) => (v >= 0 ? "#8fd7a4" : "#e2808c"), barCol = (v) => (v >= 0 ? C_GREEN : C_RED);
    const two = (a, b, left, right) => (
      <div className="wr-two">
        <div><div style={{ ...S.wrLabel, color: "#8fd7a4" }}>{left}</div><WrList dkey={`${recapDetail}-a`} rows={a} emptyText="—" /></div>
        <div><div style={{ ...S.wrLabel, color: "#e2808c" }}>{right}</div><WrList dkey={`${recapDetail}-b`} rows={b} emptyText="—" /></div>
      </div>
    );
    let title = "", icon = "list", acc = "#9aa3ab", body = null;
    if (recapDetail === "rank") {
      acc = "#7fb6e0"; icon = "leaderboard"; title = `Best & worst ${isYear ? "months" : "days"}`;
      const max = Math.max(1e-9, ...r.ranked.map((u) => Math.abs(u.value)));
      const rows = (arr) => arr.map((u) => ({ label: isYear ? u.label : `${u.label} ${MONTHS_SHORT[r.m]}`, value: money(u.value), valColor: pnlCol(u.value),
        frac: Math.abs(u.value) / max, color: barCol(u.value), sub: `${tradesWord(u.n)} · ${winPct(u)}% win` }));
      body = two(rows(r.ranked.slice(0, 5)), rows([...r.ranked].reverse().slice(0, 5)), "Top 5 best", "Top 5 worst");
    } else if (recapDetail === "coins") {
      acc = "#e3b341"; icon = "toll"; title = `${M.things}: what each made or lost`;
      const max = Math.max(1e-9, ...r.byPnl.map((c) => Math.abs(c.pnl)));
      const rows = (arr) => arr.map((c) => ({ label: coinName(c.coin), value: money(c.pnl), valColor: pnlCol(c.pnl), frac: Math.abs(c.pnl) / max, color: barCol(c.pnl),
        sub: `${tradesWord(c.n)} · ${winPct(c)}% win` }));
      body = two(rows(r.byPnl.filter((c) => c.pnl > 0).slice(0, 5)), rows([...r.byPnl].reverse().filter((c) => c.pnl < 0).slice(0, 5)), "Made the most", "Lost the most");
    } else if (recapDetail === "trades") {
      acc = "#3ddc97"; icon = "bolt"; title = "Biggest trades";
      const max = Math.max(1e-9, r.wins[0] ? r.wins[0].pnl : 0, r.losses[0] ? -r.losses[0].pnl : 0);
      const rows = (arr) => arr.slice(0, 5).map((t) => ({ label: M.sides ? `${coinName(t.coin)} · ${t.side}` : coinName(t.coin), value: money(t.pnl), valColor: pnlCol(t.pnl), frac: Math.abs(t.pnl) / max, color: barCol(t.pnl), sub: t.when }));
      body = two(rows(r.wins), rows(r.losses), "Biggest wins", "Biggest losses");
    } else if (recapDetail === "traded") {
      acc = "#b89cff"; icon = "repeat"; title = `Most traded ${M.things.toLowerCase()}`;
      const rows = r.byCount.slice(0, 10), max = rows[0] ? rows[0].n : 1;
      body = <WrList dkey="traded" emptyText="No trades." rows={rows.map((c) => ({ label: coinName(c.coin), value: `${c.n}×`, valColor: "#cdbdff", sub: `${money(c.pnl)} · ${winPct(c)}% win`, frac: c.n / max, color: c.coin ? coinTint(c.coin) : "#6d757d" }))} />;
    }
    return (
      <div className="wr-detail" style={{ "--acc": acc }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.wrLabel, marginBottom: 0, color: "#c7cdd2" }}><span className="msym wr-ico">{icon}</span>{title}</span>
          <button className="x-btn" style={{ ...S.closeBtn, width: 26, height: 26 }} onClick={() => setRecapDetailOpen(false)}>✕</button>
        </div>
        {body}
      </div>
    );
  };
  const renderRecap = () => {
    const r = recapData;
    if (!r) return null;
    const isYear = r.kind === "year";
    const unitWord = isYear ? "month" : "day";
    const title = isYear ? `${r.y}` : `${MONTHS_FULL[r.m]} ${r.y}`;
    const maxAbs = Math.max(1e-9, ...r.units.filter((u) => u.has).map((u) => Math.abs(u.value)));
    const wr = winPct(r.tot);
    const pf = r.tot.loss > 0 ? r.tot.profit / r.tot.loss : null;
    const topCoin = r.byPnl[0], busy = r.byCount[0], bestTrade = r.wins[0], worstTrade = r.losses[0];
    // the coins' shares of all trades: the six most traded, the rest as one
    const shares = r.byCount.slice(0, 6).map((c) => ({ name: c.coin || M.none, n: c.n, color: c.coin ? coinTint(c.coin) : "#6d757d" }));
    const others = r.byCount.slice(6).reduce((a, c) => a + c.n, 0);
    if (others) shares.push({ name: "Others", n: others, color: "#4a5055" });
    let tileN = 0;
    const tile = (cls, acc, detail, extra) => ({
      className: `wr-tile ${cls}${detail ? " clickable" : ""}${detail && recapDetailOpen && recapDetail === detail ? " active" : ""}`,
      style: { "--acc": acc, animationDelay: `${120 + (tileN++) * 70}ms`, ...extra },
      ...(detail ? { onClick: () => toggleRecapDetail(detail), title: "Show the list" } : {}),
    });
    const RING_R = 30, RING_C = 2 * Math.PI * RING_R;
    const hov = recapHover !== null ? r.units[recapHover] : null;
    const sideLine = (name, s2, color, note) => (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...S.wrSmall, marginTop: 0, color, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10.5 }}>{name}</div>
        <div style={{ ...S.wrBig, fontSize: 21, color: !s2.n ? "#6d757d" : s2.pnl >= 0 ? "#e8eaec" : "#e2808c" }}>{s2.n ? money(s2.pnl) : "N/A"}</div>
        <div style={S.wrSmall}>{s2.n ? note || `${tradesWord(s2.n)} · ${winPct(s2)}% win` : "no trades"}</div>
      </div>
    );
    // the two halves of the wide tile: longs and shorts, or (stocks are only bought) the winning trades and the losing ones
    const halves = M.sides
      ? [["Longs", r.sides.long, "#7fb6e0"], ["Shorts", r.sides.short, "#b89cff"]]
      : [["Winners", { n: r.tot.wins, pnl: r.tot.profit }, "#8fd7a4", r.tot.wins ? `${tradesWord(r.tot.wins)} · ${money(r.tot.profit / r.tot.wins)} each` : ""],
         ["Losers", { n: r.tot.losses, pnl: -r.tot.loss }, "#e2808c", r.tot.losses ? `${tradesWord(r.tot.losses)} · ${money(-r.tot.loss / r.tot.losses)} each` : ""]];
    return (
      <div style={{ ...S.backdrop, zIndex: 60, animation: recapClosing ? "fadeOut .22s ease both" : "fadeIn .22s ease backwards" }} onClick={closeRecap}>
        <div className="glass wr-modal" onClick={(e) => e.stopPropagation()}
             style={{ animation: recapClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .45s var(--ease) backwards" }}>
          <div style={S.modalHead}>
            <span style={S.wrKicker}>
              <span className="msym" style={{ fontSize: 17, color: "#e6c877" }}>auto_awesome</span>
              <span className="px-word">{isYear ? "YEARLY" : "MONTHLY"} WRAPPED</span>
            </span>
            <button className="x-btn" style={S.closeBtn} onClick={closeRecap}>✕</button>
          </div>

          {r.empty ? (
            <div className="wr-tile wr-hero" style={{ "--acc": "#6d757d", minHeight: 220, animationDelay: "100ms" }}>
              <div style={S.wrLabel}>{title}</div>
              <div style={{ ...S.wrHeroNum, fontSize: 40, color: "#6d757d" }}>No trades yet</div>
              <div style={S.wrHeroSub}>Log some trades for this {isYear ? "year" : "month"} and your recap will fill in.</div>
            </div>
          ) : (
            <>
            <div className="wr-grid">
              {/* hero */}
              <div {...tile("wr-hero", r.tot.pnl >= 0 ? "#3ddc97" : "#ff5d6c", null)}>
                <div style={S.wrLabel}>{title}</div>
                <div className="wr-hero-num" style={{ ...S.wrHeroNum,
                     backgroundImage: r.tot.pnl >= 0 ? "linear-gradient(100deg, #ffffff 10%, #9ff2cb 55%, #3ddc97)" : "linear-gradient(100deg, #ffffff 10%, #ffb3ba 55%, #ff5d6c)" }}>
                  <CountNum value={r.tot.pnl} duration={900} render={moneyLive} />
                </div>
                <div style={S.wrHeroSub}>
                  Realised PnL for the {isYear ? "year" : "month"}
                  <br /><span style={{ color: "#e8eaec" }}>You closed <b>{tradesWord(r.tot.n)}</b> and won <b>{wr}%</b> of them.</span>
                </div>
                <div className="wr-bars" onMouseLeave={() => setRecapHover(null)}>
                  {hov && (
                    <div className="wr-bar-tip" style={{ left: `${Math.min(88, Math.max(12, ((recapHover + 0.5) / r.units.length) * 100))}%` }}>
                      <span style={{ color: "#8a9299", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        {isYear ? hov.label : `${hov.label} ${MONTHS_SHORT[r.m]}`}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: !hov.has ? "#6d757d" : hov.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                        {hov.has ? money(hov.value) : "No trades"}
                      </span>
                    </div>
                  )}
                  {r.units.map((u, k) => {
                    const h = u.has ? Math.max(4, (Math.abs(u.value) / maxAbs) * 100) : 4;
                    const dim = recapHover !== null && recapHover !== k;
                    return (
                      <div key={k} className="wr-bar-col" style={{ opacity: dim ? 0.4 : 1 }} onMouseEnter={() => setRecapHover(k)}>
                        <div className="wr-bar-half">
                          {u.has && u.value >= 0 && <span className="wr-bar up" style={{ height: `${h}%`, animationDelay: `${420 + k * (isYear ? 45 : 14)}ms` }} />}
                        </div>
                        <div className="wr-bar-half down">
                          {u.has && u.value < 0 && <span className="wr-bar dn" style={{ height: `${h}%`, animationDelay: `${420 + k * (isYear ? 45 : 14)}ms` }} />}
                          {!u.has && <span className="wr-bar none" />}
                        </div>
                        {(isYear || u.i === 1 || u.i % 5 === 0) && <span className="wr-bar-lbl">{isYear ? u.short.slice(0, 1) : u.short}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* best / worst */}
              <div {...tile("", "#3ddc97", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">north_east</span>Best {unitWord}</div>
                <div style={S.wrBig}>{r.best.label}</div>
                {!isYear && <div style={S.wrSmall}>{r.best.sub}</div>}
                <div style={{ ...S.wrValue, color: r.best.value >= 0 ? "#8fd7a4" : "#e2808c" }}><CountNum value={r.best.value} duration={800} render={moneyLive} /></div>
                <span className="msym wr-more">arrow_outward</span>
              </div>
              <div {...tile("", "#ff5d6c", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">south_east</span>Worst {unitWord}</div>
                {r.worst ? (
                  <>
                    <div style={S.wrBig}>{r.worst.label}</div>
                    {!isYear && <div style={S.wrSmall}>{r.worst.sub}</div>}
                    <div style={{ ...S.wrValue, color: r.worst.value >= 0 ? "#8fd7a4" : "#e2808c" }}><CountNum value={r.worst.value} duration={800} render={moneyLive} /></div>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>N/A</div>}
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* average / win rate */}
              <div {...tile("", "#7fb6e0", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">equalizer</span>Avg {isYear ? "monthly" : "daily"} PnL</div>
                <div style={{ ...S.wrBig, color: r.avg >= 0 ? "#e8eaec" : "#e2808c" }}><CountNum value={r.avg} duration={800} render={moneyLive} /></div>
                <div style={S.wrSmall}>across {r.active} active {unitWord}{r.active === 1 ? "" : "s"}</div>
                <span className="msym wr-more">arrow_outward</span>
              </div>
              <div {...tile("wr-row", "#e3cd77", null)}>
                <svg width="74" height="74" viewBox="0 0 74 74" style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
                  <circle cx="37" cy="37" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                  <circle className="wr-ring" cx="37" cy="37" r={RING_R} fill="none" stroke="#e3cd77" strokeWidth="7" strokeLinecap="round"
                          strokeDasharray={RING_C} style={{ "--ring-off": RING_C * (1 - wr / 100), "--ring-c": RING_C }} />
                </svg>
                <div>
                  <div style={S.wrLabel}>Win rate</div>
                  <div style={S.wrBig}><CountNum value={wr} duration={800} render={(n) => `${Math.round(n)}%`} /></div>
                  <div style={S.wrSmall}>{r.tot.wins} of {tradesWord(r.tot.n)} won</div>
                </div>
              </div>

              {/* the coin that made the most, and how the trades are spread over the coins */}
              <div {...tile("wr-wide", topCoin && topCoin.coin ? coinTint(topCoin.coin) : "#6d757d", "coins")}>
                <div style={S.wrLabel}><span className="msym wr-ico">local_fire_department</span>{topCoin.pnl >= 0 ? "Top earner" : "Smallest loss"}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                  <span className="wr-cat-ico" style={{ color: "#14171a", background: topCoin.coin ? coinTint(topCoin.coin) : "#4a5055", fontSize: 20, fontWeight: 800 }}>
                    {topCoin.coin ? topCoin.coin.replace(/^\d+/, "")[0] || topCoin.coin[0] : "?"}
                  </span>
                  <div>
                    <div style={S.wrBig}>{topCoin.coin || M.none}</div>
                    <div style={S.wrSmall}>
                      <b style={{ color: topCoin.pnl >= 0 ? "#8fd7a4" : "#e2808c" }}>{money(topCoin.pnl)}</b> · {tradesWord(topCoin.n)} · {winPct(topCoin)}% win
                    </div>
                  </div>
                </div>
                <div className="wr-stack">
                  {shares.map((c, k) => (
                    <span key={c.name} className="wr-stack-seg" style={{ width: `${(c.n / r.tot.n) * 100}%`, background: c.color, animationDelay: `${520 + k * 80}ms` }} />
                  ))}
                </div>
                <div style={S.wrLegend}>
                  {shares.map((c) => (
                    <span key={c.name} className="wr-leg">
                      <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: 99, marginRight: 6, background: c.color }} />{c.name} {Math.round((c.n / r.tot.n) * 100)}%
                    </span>
                  ))}
                </div>
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* the single best trade */}
              <div {...tile("", "#3ddc97", "trades")}>
                <div style={S.wrLabel}><span className="msym wr-ico">bolt</span>{bestTrade ? "Best trade" : "Smallest loss"}</div>
                {(() => {
                  const t = bestTrade || r.losses[r.losses.length - 1];
                  return (
                    <>
                      <div style={S.wrBig}>{t.coin || M.none}</div>
                      <div style={{ ...S.wrValue, color: t.pnl >= 0 ? "#8fd7a4" : "#e2808c" }}><CountNum value={t.pnl} duration={800} render={moneyLive} /></div>
                      <div style={S.wrSmall}>{M.sides ? `${t.side} · ` : ""}{t.when}{worstTrade && bestTrade ? ` · worst ${money(worstTrade.pnl)}` : ""}</div>
                    </>
                  );
                })()}
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* the coin traded most often */}
              <div {...tile("", "#b89cff", "traded")}>
                <div style={S.wrLabel}><span className="msym wr-ico">repeat</span>Most traded</div>
                <div style={S.wrBig}>{busy.coin || M.none}</div>
                <div style={{ ...S.wrValue, color: "#cdbdff" }}>{busy.n}×</div>
                <div style={S.wrSmall}>{money(busy.pnl)} in total</div>
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* longs against shorts */}
              <div {...tile("wr-wide", "#7fb6e0", null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">swap_vert</span>{M.sides ? "Longs vs shorts" : "Winners vs losers"}</div>
                <div style={{ display: "flex", gap: 18, marginTop: 2 }}>
                  {halves.map(([name, s2, color, note]) => <Fragment key={name}>{sideLine(name, s2, color, note)}</Fragment>)}
                </div>
                <div className="wr-stack">
                  {halves.map(([name, s2, color], k) => s2.n > 0 && (
                    <span key={name} className="wr-stack-seg" style={{ width: `${(s2.n / r.tot.n) * 100}%`, background: color, animationDelay: `${560 + k * 80}ms`, cursor: "default" }} />
                  ))}
                </div>
              </div>

              {/* green days in a row / profit factor */}
              <div {...tile("", "#3ddc97", null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">local_fire_department</span>Green streak</div>
                <div style={S.wrBig}><CountNum value={r.streak} duration={800} render={(n) => Math.round(n)} /> {r.streak === 1 ? "day" : "days"}</div>
                <div style={S.wrSmall}>in a row in profit · {r.greenDays} of {r.tradedDays} trading days green</div>
              </div>
              <div {...tile("", "#e3cd77", null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">balance</span>Profit factor</div>
                <div style={{ ...S.wrBig, color: pf === null || pf >= 1 ? "#e8eaec" : "#e2808c" }}>{pf === null ? "No losses" : pf.toFixed(2)}</div>
                <div style={S.wrSmall}>{money(r.tot.profit)} won · {money(-r.tot.loss)} lost</div>
              </div>
            </div>

            {/* the list that opens under the grid */}
            <div ref={recapDetailRef} style={{ display: "grid", gridTemplateRows: recapDetailOpen ? "1fr" : "0fr", transition: "grid-template-rows .38s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={S.fold}>
                <div style={{ paddingTop: 12, opacity: recapDetailOpen ? 1 : 0, transform: recapDetailOpen ? "none" : "translateY(-10px)",
                              transition: "opacity .28s ease, transform .32s cubic-bezier(0.22,1,0.36,1)" }}>
                  {recapDetail && renderRecapDetail(r)}
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const flashing = (f) => (f ? (f.from ? " swap" : " flick") : "");

  return (
    <>
      {view === "year" ? (
        <div ref={yearWrapRef}>
          <div className="year-shell">
            <div style={S.yearHeader}>
              <div style={S.yearBigWrap}>
                <span className={`recap-link year-big${yearRise ? " year-big-anim" : ""}${yearFlick ? " flick" : ""}`} style={S.yearBig}
                      title={`${year} wrapped`} onClick={() => openRecap({ kind: "year", y: year })}>
                  {String(year).split("").map((ch, i, all) => (
                    <span key={i} className={`yb-cell${yearFlick?.[i] ? ` ${yearFlick[i].cls}` : ""}`} style={yearFlick?.[i]?.style}>
                      <span className="yb-px">{i < all.length - 1 ? ch : <DigitRoll digit={Number(ch)} height={48} />}</span>
                      {yearFlick && <span className="yb-n" aria-hidden="true">{ch}</span>}
                    </span>
                  ))}
                </span>
              </div>
              <div style={S.yearBarWrap}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>{grossBar(ys, "cy")}</div>
                  {chartButton("Yearly chart")}
                </div>
                <div style={S.barMeta}>
                  <span style={{ color: tone(ys) }} title="Net PnL of the year / everything the winning trades made">
                    <strong><CountNum value={ys.pnl} duration={560} render={moneyLive} /></strong>
                    {" / "}{money(ys.profit)}
                  </span>
                  <span style={{ color: C_RED }} title="Everything the losing trades cost">
                    {ys.n > 0 && <span style={{ color: C_MUTE }}>{tradesWord(ys.n)} · {winPct(ys)}% win{"  ·  "}</span>}
                    <CountNum value={-ys.loss} duration={560} render={moneyLive} />
                  </span>
                </div>
              </div>
            </div>

            <div className="year-nav glass">
              <button className="ynav-btn" title="Previous year (↑)" disabled={yearIdx === 0} onClick={() => stepYear(-1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15.5 L12 8.5 L19 15.5" /></svg>
              </button>
              <button className="ynav-btn" title="Next year (↓)" disabled={yearIdx === YEARS.length - 1} onClick={() => stepYear(1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8.5 L12 15.5 L19 8.5" /></svg>
              </button>
            </div>

            <div className="year-viewport">
              <div className={`year-track${yearShift ? " shifting" : ""}`}
                   style={{ transform: `translateY(calc(${yearIdx === 0 ? 0 : yearIdx === YEARS.length - 1 ? YEAR_PEEK : YEAR_PEEK / 2}px - var(--yb) * ${yearIdx}))` }}>
                {YEARS.map((yr, yi) => {
                  const st = allYears[yi];
                  const active = yr === year;
                  return (
                    <div key={yr} className={`year-block${active ? " active" : ""}`} onClick={() => { if (!active) stepYear(yi - yearIdx); }}>
                      <div className="year-block-tag">{yr}</div>
                      <div style={S.yearGrid}>
                        {MONTHS_SHORT.map((name, m) => {
                          const mo = st.months[m];
                          const isNow = yr === now.getFullYear() && m === now.getMonth();
                          const bg = !mo.n ? "#26292c" : mo.pnl >= 0 ? "rgba(61,220,151,0.08)" : "rgba(255,93,108,0.10)";
                          const border = isNow ? "#7fb6e0" : !mo.n ? "#33373b" : mo.pnl >= 0 ? "#1e4436" : "#5a2830";
                          return (
                            <div key={name} className="ycell"
                                 style={{ ...S.yearCell, background: bg, borderColor: border, animation: active ? `tileIn .42s var(--ease) ${m * 22}ms backwards` : "none" }}
                                 onClick={() => { if (active) { setYear(yr); setMonth(m); setSelected(null); setFromYear(true); setView("month"); setTimeout(() => setFromYear(false), 1100); } }}>
                              <span style={S.yearCellName}>{name}</span>
                              {mo.n ? (
                                <>
                                  <span style={{ ...S.yearCellSpent, color: tone(mo) }}>
                                    <CountNum value={mo.pnl} duration={560} render={moneyLive} />
                                  </span>
                                  <span style={S.yearCellExp}>{tradesWord(mo.n)} · {winPct(mo)}% win</span>
                                </>
                              ) : (
                                <span style={{ ...S.yearCellSpent, color: C_MUTE }}>·</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={fromYear ? "month-view enter" : "month-view"}>
          <div style={S.topRow}>
            <h1 className={`recap-link month-big${monthFlick?.cells ? flashing(monthFlick) : ""}`} style={S.title} title={`${MONTHS_FULL[month]} wrapped`}
                onClick={() => openRecap({ kind: "month", y: year, m: month })}>
              {Array.from({ length: monthFlick?.cells ? monthFlick.cells.length : MONTHS_FULL[month].length }, (_, i) => {
                const ch = MONTHS_FULL[month][i], f = monthFlick?.cells?.[i];
                const old = f && monthFlick.from ? monthFlick.from[i] : undefined;
                return (
                  <span key={`${monthFlick?.id || 0}-${i}`} className={`yb-cell${f ? ` ${f.cls}` : ""}${ch === "t" ? " tt" : ""}`} style={f?.style}>
                    {ch && <span className="yb-px">{ch}</span>}
                    {f && ch && !monthFlick.from && <span className="yb-n" aria-hidden="true">{ch}</span>}
                    {old && <span className="yb-old" aria-hidden="true">{old}</span>}
                  </span>
                );
              })}
            </h1>
            <div style={S.navBox}>
              {/* the arrows stay hidden until the pointer is on the month switcher */}
              <span className="month-nav">
                <button className="nav-arrow" disabled={!monthAfter(year, month, -1)} title="Previous month (←)" onClick={() => nav(-1)}>‹</button>
                <button className="month-btn" style={S.monthLabelBtn}
                        onClick={() => { setYearRise(true); setSelected(null); setView("year"); setTimeout(() => setYearRise(false), 700); }}
                        title="View year">{monthLabel}</button>
                <button className="nav-arrow" disabled={!monthAfter(year, month, 1)} title="Next month (→)" onClick={() => nav(1)}>›</button>
              </span>
              {M.base === "USDT" ? (
                <button className="cur-btn" style={S.currency} title="Click: USDT ⇄ IDR · three quick clicks: MYR" onClick={onCurClick}>
                  <CurRoll idx={CUR_LIST.indexOf(cur)} />
                </button>
              ) : <span style={{ ...S.currency, cursor: "default" }} title="Realised PnL, in rupiah">{M.base}</span>}
            </div>
          </div>

          {/* the month at a glance, as on the finance side */}
          <div className="hero" style={{ "--hc": tone(ms) }}>
            <div className="hero-head">
              <span className="hero-tag"><i />PnL this month</span>
              {ms.n > 0 && (
                <span key={`vs-${year}-${month}`} className="hero-vs">
                  <b style={{ color: "#e8eaec" }}>{winPct(ms)}%</b> win rate
                  {pnlVsPrev && (
                    <>
                      {"  ·  "}
                      <b style={{ color: pnlVsPrev.pct >= 0 ? C_GREEN : C_RED }}>
                        {pnlVsPrev.pct >= 0 ? "+" : "−"}{Math.abs(pnlVsPrev.pct).toFixed(1)}%
                      </b>
                      {" "}vs {pnlVsPrev.name}
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="hero-num"><CountNum value={ms.pnl} duration={280} render={moneyLive} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>{grossBar(ms, "cm")}</div>
              {chartButton("Monthly chart")}
            </div>
            <div className="hero-tiles">
              <div className="hero-tile" style={{ "--tc": C_GREEN }} title="Winning trades / what they made">
                <span className="ht-cap">{ms.wins === 1 ? "Win" : "Wins"}</span>
                <span className="ht-val"><CountNum value={ms.wins} duration={260} render={(n) => Math.round(n)} /></span>
                <span className="ht-sub" style={{ color: C_GREEN }}>+<CountNum value={ms.profit} duration={260} render={absLive} /></span>
              </div>
              <div className="hero-tile" style={{ "--tc": C_RED }} title="Losing trades / what they cost">
                <span className="ht-cap">{ms.losses === 1 ? "Loss" : "Losses"}</span>
                <span className="ht-val"><CountNum value={ms.losses} duration={260} render={(n) => Math.round(n)} /></span>
                <span className="ht-sub" style={{ color: C_RED }}>-<CountNum value={ms.loss} duration={260} render={absLive} /></span>
              </div>
              <div className="hero-tile" style={{ "--tc": C_GREEN }} title="Green days / what they made">
                <span className="ht-cap">{ms.greenDays === 1 ? "Green day" : "Green days"}</span>
                <span className="ht-val"><CountNum value={ms.greenDays} duration={260} render={(n) => Math.round(n)} /></span>
                <span className="ht-sub" style={{ color: C_GREEN }}>+<CountNum value={ms.greenSum} duration={260} render={absLive} /></span>
              </div>
              <div className="hero-tile" style={{ "--tc": C_RED }} title="Red days / what they cost">
                <span className="ht-cap">{ms.redDays === 1 ? "Red day" : "Red days"}</span>
                <span className="ht-val"><CountNum value={ms.redDays} duration={260} render={(n) => Math.round(n)} /></span>
                <span className="ht-sub" style={{ color: C_RED }}>-<CountNum value={-ms.redSum} duration={260} render={absLive} /></span>
              </div>
            </div>
          </div>

          <div className="cal-wrap">
            <div key={`grid-${year}-${month}`} style={S.grid}>
              {DOW.map((d, i) => <div key={i} style={S.dowCell}>{d}</div>)}
              {cells.map((d, i) => {
                if (d === null) return <div key={"e" + i} />;
                const day = ms.days[d - 1];
                const list = trades[keyOf(year, month, d)] || [];
                const up = day && day.pnl >= 0;
                const bg = !day ? "#26292c" : up ? "rgba(61,220,151,0.10)" : "rgba(255,93,108,0.12)";
                const border = selected === d ? "#ffffff" : d === todayNum ? "#7fb6e0" : !day ? "#33373b" : up ? "#1e4436" : "#5a2830";
                return (
                  <div key={d} className={`cell${i < 7 ? " tip-below" : ""}`}
                       style={{ ...S.cell, background: bg, borderColor: border, animation: `tileIn .2s var(--ease) ${d * 2}ms backwards` }}
                       onClick={() => { setSelected(d); setAmtEdit(null); setDraft({ win: "", winPair: "", loss: "", lossPair: "" }); }}>
                    <span className="cell-tip glass" style={S.cellTip}>
                      <span style={S.cellTipDate}>{d} {monthLabelFull}</span>
                      <span style={S.cellTipRow}>
                        <span style={{ color: C_GREEN }}>+ {moneyAbs(day ? day.profit : 0)}</span>
                        <span style={{ color: C_RED }}>− {moneyAbs(day ? day.loss : 0)}</span>
                      </span>
                    </span>
                    <span style={S.cellDay}>{d}</span>
                    {list.length > 0 && (
                      <span style={{ ...S.dotGrid, gridTemplateColumns: `repeat(${Math.min(list.length, DOTS_PER_ROW)}, 4px)` }}>
                        {list.map((t, k) => (
                          <span key={`${resOf(t)}-${k}`} className="dot-in" style={{ ...S.dot, background: resOf(t) === "win" ? C_GREEN : resOf(t) === "loss" ? C_RED : "#8a9299" }} />
                        ))}
                      </span>
                    )}
                    {deps[keyOf(year, month, d)] && <span className="msym" style={S.cellDep}>account_balance_wallet</span>}
                    {day ? (
                      <>
                        <span style={{ ...S.cellSpent, color: up ? C_GREEN : C_RED }}>{money(day.pnl)}</span>
                        <span style={{ ...S.cellPnlSmall, color: up ? "#a5efcd" : "#ffb3bb" }}>{day.wins}W · {day.losses}L{day.n > day.wins + day.losses ? ` · ${day.n - day.wins - day.losses}BE` : ""}</span>
                      </>
                    ) : <span style={S.cellEmpty}>·</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* as wide as the calendar and the cards under it (he found it "proportionally smaller" than the other boxes): the
              margins are on this outer box, so the panel is not cut at the sides while it opens */}
          <div style={{ display: "grid", gridTemplateRows: selected !== null && !panelClosing ? "1fr" : "0fr", transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)", margin: "0 -14px" }}>
            <div style={{ overflow: panelAnim ? "hidden" : "visible", minHeight: 0 }}>
              {selected !== null && (
                <div key={`panel-${selKey}`} className="glass" style={{ ...S.panel, opacity: panelClosing ? 0 : 1, transition: "opacity .24s ease" }}>
                  <div style={S.panelHead}>
                    <span style={S.panelTitle}>{selected} {monthLabelFull}</span>
                    <span style={S.panelTotal}>
                      {tradesWord(selTrades.length)} · PnL{" "}
                      <strong style={{ color: !selDay ? "#9aa3ab" : selDay.pnl >= 0 ? C_GREEN : C_RED }}>{money(selDay ? selDay.pnl : 0)}</strong>
                    </span>
                    <button className="x-btn" style={S.closeBtn} onClick={closePanel}>✕</button>
                  </div>

                  {M.journal ? <TradeJournal list={selTrades} deps={selDeps} removing={removing} api={jrApi} ghost={M.ghost} shown={`${cur}${rate}`} /> : [1, -1].map((sign) => {
                    const win = sign > 0;
                    const rows = selTrades.filter((it) => (it.pnl > 0) === win);
                    const delay = win ? 0.04 : 0.1;
                    return (
                      <Fragment key={sign}>
                        <div style={{ ...S.sectionLabel, marginTop: win ? 0 : 14, animation: `fadeDown .25s ease ${delay}s both` }}>{win ? "Profit" : "Loss"}</div>
                        <div style={{ ...S.addRow, animation: `fadeDown .25s ease ${delay + 0.03}s both` }}>
                          <AmountField value={win ? draft.win : draft.loss} setValue={(v) => setDraft((d) => (win ? { ...d, win: v } : { ...d, loss: v }))}
                                       accent={win ? "green" : "red"} cur={M.dp ? "$" : "Rp"} allowDecimal={!!M.dp} ghost={ghostOf(win ? draft.win : draft.loss)} onSubmit={() => addTrade(sign)} />
                          <PairBox wrap={{ flex: 1, minWidth: 160 }} pad={14} ghost={M.ghost} className="desc-field" style={{ ...S.darkInput, width: "100%" }} placeholder={M.hint}
                                 value={win ? draft.winPair : draft.lossPair}
                                 onChange={(e) => { const v = pairName(e.target.value); setDraft((d) => (win ? { ...d, winPair: v } : { ...d, lossPair: v })); }}
                                 onKeyDown={(e) => e.key === "Enter" && addTrade(sign)} />
                          {M.sides && <SideChip big side={newSide} onToggle={() => setNewSide((s) => (s === "long" ? "short" : "long"))} />}
                          <button className="draw-btn" style={win ? S.addIconBtn : S.addIconBtnRed} title={win ? "Add a winning trade" : "Add a losing trade"}
                                  onClick={() => addTrade(sign)}>{win ? <PlusIcon /> : <MinusIcon />}</button>
                        </div>
                        {rows.length > 0 && (
                          <div style={S.expList}>
                            {rows.map((it, idx) => (
                              <div key={it.id} className={`row-wrap${removing[it.id] ? " collapsing" : ""}`}>
                                <div style={S.fold}>
                                  <div style={{ display: "flex", transformOrigin: "center center",
                                                animation: removing[it.id] ? "popOutCenter .24s ease both" : `fadeDown .25s ease ${90 + idx * 45}ms backwards` }}>
                                    <div className={`entry-row glass-soft ${win ? "inc" : "exp"}`} style={S.entryRow}>
                                      <input style={{ ...S.entryAmt, color: win ? C_GREEN : C_RED }} inputMode={M.dp ? "decimal" : "numeric"}
                                             value={amtEdit && amtEdit.id === it.id ? amtEdit.str : amtText(it.pnl)}
                                             onFocus={() => setAmtEdit({ id: it.id, str: amtText(it.pnl) })}
                                             onChange={(e) => setAmtEdit({ id: it.id, str: sanitizeAmount(e.target.value, !!M.dp) })}
                                             onBlur={() => commitAmt(it)}
                                             onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                                      <span style={S.entryDivider} />
                                      <PairBox wrap={{ flex: 1, minWidth: 40 }} pad={12} ghost={M.ghost} style={{ ...S.entryDesc, width: "100%" }} value={it.pair} placeholder={M.small}
                                             onChange={(e) => editTrade(it.id, { pair: pairName(e.target.value) }, false)} onBlur={persist}
                                             onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                                      {M.sides && <SideChip side={it.side} onToggle={() => editTrade(it.id, { side: it.side === "short" ? "long" : "short" }, true)} />}
                                      <button className="trash-btn" style={S.delBtn} onClick={() => deleteTrade(it.id)} title="Delete"><TrashIcon /></button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                  {selTrades.length === 0 && !M.journal && <p style={{ ...S.emptyList, marginTop: 2 }}>No trades recorded for this day.</p>}
                </div>
              )}
            </div>
          </div>

          <FoldCard title="PnL analysis" name="PnL analysis" runKey="an"
                      sub={<><span style={{ color: anTot.n ? (anTot.pnl >= 0 ? "#5ee3a9" : "#ff8d97") : undefined }}>{money(anTot.pnl)}</span> · {dayText(anFrom)} – {dayText(anTo)}</>}>
            <PnlAnalysis trades={trades} deps={deps} an={an} start={anFrom} end={anTo} cur={cur} rate={rate} base={eqBase} allPnl={allPnl} allDep={allDep} unit={M.base} dp={M.dp} api={anApi} />
          </FoldCard>
          <FoldCard title="Performance" name="performance" runKey={`${year}-${month}`} sub={monthLabel}>
            {renderPerf()}
          </FoldCard>
          <FoldCard title={M.things} name={M.things.toLowerCase()} runKey={`${year}-${month}`} sub={detail.coins.length ? `${detail.coins.length} traded · ${monthLabel}` : monthLabel}>
            {renderCoins()}
          </FoldCard>
        </div>
      )}

      {chartOpen && (
        <div ref={chartWrapRef} style={{ ...S.backdrop, animation: chartClosing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={() => closeChart()}>
          <div ref={chartModalRef} className="glass" style={{ ...S.modal, animation: chartClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              {/* the ‹ › arrows stay hidden until the pointer is on the title; they browse the chart only, never the panel behind */}
              <span className="chart-nav" style={S.panelTitle}>
                <span>Chart —</span>
                <span className="chart-per" style={{ minWidth: view === "year" ? 39 : 80 }}>
                  <span key={chartLabel} className={chartAt && chartAt.dir ? (chartAt.dir > 0 ? "chart-lbl next" : "chart-lbl prev") : "chart-lbl"}>{chartLabel}</span>
                </span>
                <button className="nav-arrow" disabled={!chartCanStep(-1)} title={view === "year" ? "Previous year (←)" : "Previous month (←)"} onClick={() => stepChart(-1)}>‹</button>
                <button className="nav-arrow" disabled={!chartCanStep(1)} title={view === "year" ? "Next year (→)" : "Next month (→)"} onClick={() => stepChart(1)}>›</button>
              </span>
              <button className="x-btn" style={S.closeBtn} onClick={() => closeChart()}>✕</button>
            </div>
            <div style={S.modeRow}>
              {[
                { id: "line", title: "Cumulative PnL" },
                { id: "bars", title: view === "year" ? "PnL of each month" : "PnL of each day" },
              ].map((m) => {
                const on = chartMode === m.id;
                return (
                  <button key={m.id} className="mode-btn" title={m.title} onClick={() => { setHoverPt(null); setChartMode(m.id); }}
                          style={{ ...S.modeBtn, color: on ? "#e8eaec" : "#6d757d", borderColor: on ? "#8a9299" : "#33373b", background: on ? "rgba(255,255,255,0.07)" : "none" }}>
                    {m.id === "line" ? (
                      <span style={{ display: "inline-flex", gap: 1 }}>
                        <span style={{ color: on ? C_GREEN : "inherit" }}>+</span>
                        <span style={{ opacity: 0.75 }}>/</span>
                        <span style={{ color: on ? C_RED : "inherit" }}>−</span>
                      </span>
                    ) : (
                      <svg width="20" height="16" viewBox="0 0 20 16" style={{ display: "block" }}>
                        <rect x="1" y="1" width="4.4" height="7" rx="1.6" fill={on ? C_GREEN : "currentColor"} />
                        <rect x="7.8" y="8" width="4.4" height="7" rx="1.6" fill={on ? C_RED : "currentColor"} />
                        <rect x="14.6" y="3.5" width="4.4" height="4.5" rx="1.6" fill={on ? C_GREEN : "currentColor"} />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ position: "relative" }}>
              {renderChartSvg(view === "year" ? "year" : "month")}
              {hoverPt && <GlassTip key={hoverPt.label} W={720} H={380} x={Math.min(Math.max(hoverPt.x, 64 + 64), 720 - 20 - 64)}
                                    y={hoverPt.y} below={hoverPt.y < 24 + 62} label={hoverPt.label} value={hoverPt.value} />}
            </div>
            <div key={`legend-${chartMode}`} style={S.legend}>
              {chartMode === "line"
                ? <span style={{ color: C_GREEN, animation: "fadeRight .3s ease both" }}>▬ Cumulative PnL</span>
                : <span style={{ color: C_GREEN, animation: "fadeRight .3s ease both" }}>▮ PnL of each {view === "year" ? "month" : "day"}</span>}
              <CmpButton cmp={chartCmp} data={chartCmpData} what={view === "year" ? "year" : "month"} onPick={(v) => { setHoverPt(null); setChartCmp(v); }} />
            </div>
          </div>
        </div>
      )}

      {recap && renderRecap()}
      {testOpen && <TradeTestCfg cfg={testCfg} M={M} year={year} month={month} onRun={runTestCfg} onClose={() => setTestOpen(false)} />}

      {/* the position calculator: its button never moves with the page. Above the year arrows, or in the corner */}
      <button className={`calc-fab glass${view === "year" ? " above" : ""}`} title={M.calc} aria-label={M.calc} onClick={openCalc}>
        <span className="msym">calculate</span>
      </button>
      {calcOpen && !M.sides && (
        <StockCalc draft={calcDraft} onSaved={(inputs, shown) => savePrefs({ calc: { inputs, shown } })} onClose={() => setCalcOpen(false)} fees={fees} onFees={setFee} live={quoteBook.current} />
      )}
      {calcOpen && M.sides && (
        <PositionCalc draft={calcDraft} onSaved={(inputs, shown) => savePrefs({ calc: { inputs, shown } })} onClose={() => setCalcOpen(false)}
                      cur={cur} cur2={cur2} onCurClick={onCurClick} onCur2Click={onCur2Click} rateOf={rateOf} fx={fx} canFetch={canFetch} onRate={setRate} live={quoteBook.current} />
      )}

      <div style={S.footerRow}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span>{!loaded ? "Loading…" : saving ? "Saving…" : ""}</span>
          {saveError && <span className="bk-msg" style={{ color: "#ff8d97" }} title="The trades could not be stored (storage full or blocked). Export a backup now.">Couldn't save — export a backup</span>}
          <button className="bk-btn ico" onClick={exportData} title="Export: save a backup of every trade" aria-label="Export"><span className="msym">download</span></button>
          <button className="bk-btn ico" onClick={() => fileRef.current?.click()} title="Import: restore trades from a backup file" aria-label="Import"><span className="msym">upload</span></button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                 onChange={(e) => { importData(e.target.files?.[0]); e.target.value = ""; }} />
          {backupMsg && <span className="bk-msg">{backupMsg}</span>}
          {undoImport && <button className="bk-btn" onClick={revertImport} title="Put back the trades you had before this import">Undo</button>}
          {SHOW_TEST_TOOLS && <>
            <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />
            <button className="bk-btn ico test" onClick={onTestDataClick} title="Add test data · click: with your saved settings · double-click: change the settings" aria-label="Add test data"><span className="msym">science</span></button>
            <button className="bk-btn ico" onClick={clearTestData} title="Clear test data: remove only the generated test trades, and put your own balance back" aria-label="Clear test data"><span className="msym">delete_sweep</span></button>
            {testMsg && <span className="bk-msg" style={{ color: "#e3cd77" }}>{testMsg}</span>}
          </>}
        </span>
        <button className="foot-logo" onClick={onHome} title="Back to home" aria-label="Back to home"><CrocLogo /></button>
      </div>
    </>
  );
}

export default function PnlCalendar() {
  const now = new Date();
  // re-render just after midnight so "today" (outline, weekly chart, insights) never goes stale while the app is open
  const [dayTick, setDayTick] = useState(0);
  useEffect(() => {
    const n = new Date();
    const ms = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5) - n;
    const t = setTimeout(() => setDayTick((x) => x + 1), ms);
    return () => clearTimeout(t);
  }, [dayTick]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState("year");
  const [launched, setLaunched] = useState(false);
  const [launchExit, setLaunchExit] = useState(false);
  const [yearIntro, setYearIntro] = useState(false);   // plays the big-year opening animation
  const [yearRise, setYearRise] = useState(false);
  const [fromYear, setFromYear] = useState(false);   // month view opened from the year panel     // rise-in for the header year (month -> year)
  const [introMove, setIntroMove] = useState(false);   // second half: travel to the header slot
  const [introTarget, setIntroTarget] = useState(null);
  // after the intro lands, each header digit flickers between the normal font and the pixel font before settling on
  // pixel. Only set by the wallet → year intro, so it never plays when coming back from a month or a pop-up.
  const [yearFlick, setYearFlick] = useState(null);     // per digit: { cls, style } rolled afresh each time
  // the month title does the same, letter by letter, when the monthly panel opens: it holds the normal font a moment,
  // then flickers into the pixel font. When the month is switched there is no normal font: the old month's pixel
  // letters give way to the new month's pixel letters, one after another from the left.
  // { id, wait, from, cells }: id restarts the animation, from is the old month's name (null when the panel has just
  // opened), cells (per letter) is null once it has settled
  const [monthFlick, setMonthFlick] = useState(null);
  const monthShown = useRef(null);            // the month name on screen until now
  const introTextRef = useRef(null);
  const headerYearRef = useRef(null);
  const [yearShift, setYearShift] = useState(false);   // motion blur while switching years
  const [currency, setCurrency] = useState("IDR");
  const [spending, setSpending] = useState({});
  const [incomes, setIncomes] = useState({});
  const [limits, setLimits] = useState({});
  const [selected, setSelected] = useState(null);
  const [newAmt, setNewAmt] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIncAmt, setNewIncAmt] = useState("");
  const [newIncDesc, setNewIncDesc] = useState("");
  const [incomeDraft, setIncomeDraft] = useState("");
  const [showIncomeList, setShowIncomeList] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartClosing, setChartClosing] = useState(false);
  const [chartMode, setChartMode] = useState("both");
  // the period the chart pop-up is showing: { y, m, dir }. It browses on its own, so the panel behind never moves
  const [chartAt, setChartAt] = useState(null);
  const chartWrapRef = useRef(null);
  const chartModalRef = useRef(null);
  const chartWheelLock = useRef(null);
  const [panelClosing, setPanelClosing] = useState(false);
  const [panelAnim, setPanelAnim] = useState(false);
  const [catView, setCatView] = useState(null); // category id shown in the breakdown modal
  const [catViewClosing, setCatViewClosing] = useState(false);
  const [scoreView, setScoreView] = useState(null); // "open" | "closing": the pop-up that shows how the score is worked out
  const [hoverBtn, setHoverBtn] = useState(null);
  const [suppressBtn, setSuppressBtn] = useState(null);
  /* goals: global savings targets that carry across every month */
  const [goals, setGoals] = useState([]);
  const [debts, setDebts] = useState([]);              // what he owes and is owed: see Debts
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [fundGoal, setFundGoal] = useState(null);
  const [fundAmt, setFundAmt] = useState("");
  const [goalLeaving, setGoalLeaving] = useState(null);
  /* insights drop-down inside money flow */
  const [insOpen, setInsOpen] = useState(false);
  const [insClosing, setInsClosing] = useState(false);
  const [insRun, setInsRun] = useState(0);
  const [weekHover, setWeekHover] = useState(null);
  const [removing, setRemoving] = useState({});
  const [hoverPt, setHoverPt] = useState(null);
  const [catMenu, setCatMenu] = useState(null); // { id, stage: 'cats'|'other'|'icons', closing }
  const [otherDesc, setOtherDesc] = useState("");
  const [aiCats, setAiCats] = useState({}); // id -> category from AI
  const aiTried = useRef({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const isMYR = currency === "MYR";
  const fmt = (n) => {
    const neg = n < 0;
    let v = Math.abs(n);
    if (isMYR) {
      const rm = v / MYR_RATE;
      let s;
      if (rm >= 1_000_000) s = (Math.floor((rm / 1_000_000) * 100) / 100).toString().replace(".", ",") + "M";
      else if (rm >= 1_000) s = (Math.floor((rm / 1_000) * 10) / 10).toString().replace(".", ",") + "k";
      else s = oneDp(rm);                              // e.g. 11.49 → 11.5, 11 → 11.0
      return (neg && s !== "0.0" ? "-" : "") + s;
    }
    v = Math.floor(v);
    let s;
    if (v >= 1_000_000) s = (Math.floor((v / 1_000_000) * 100) / 100).toString().replace(".", ",") + "jt";
    else if (v >= 1_000) s = (Math.floor((v / 1_000) * 10) / 10).toString().replace(".", ",") + "Rb";
    else s = String(v);
    return (neg ? "-" : "") + s;
  };
  const fmtCoarse = (n) => {
    const neg = n < 0;
    let v = Math.abs(n);
    if (isMYR) v = Math.floor(v / MYR_RATE);
    v = Math.floor(v);
    let str;
    if (v >= 1_000_000) str = Math.floor(v / 1_000_000) + (isMYR ? "M" : "jt");
    else if (v >= 1_000) str = Math.floor(v / 1_000) + (isMYR ? "k" : "Rb");
    else str = String(v);
    return (neg ? "-" : "") + str;
  };
  // while it counts: the resting units, each at one steady precision (see liveText), so nothing flickers
  const fmtLive = (n, busy, span) => {
    if (!busy || !span) return fmt(n);
    const amt = (x) => (isMYR ? Math.abs(x) / MYR_RATE : Math.floor(Math.abs(x)));
    const text = liveText(amt(n), amt(span.from), amt(span.to), LIVE_UNITS[isMYR ? "MYR" : "IDR"], true);
    return text === null ? fmt(n) : (n < 0 ? "-" : "") + text;
  };
  const cur = isMYR ? "RM" : "Rp";
  const toDisp = (idr) => (isMYR ? Math.floor(idr / MYR_RATE) : idr);
  // income chips / totals: RM with one decimal, Rp as before
  const chipAmt = (idr) => (isMYR ? oneDp(idr / MYR_RATE) : idr.toLocaleString("id-ID"));
  const toIDR = (disp) => (isMYR ? Math.round(disp * MYR_RATE) : disp);
  // parse whatever is typed in the active currency into rupiah
  const amtToIDR = (str) => {
    if (!isMYR) return parseNum(str);
    const v = parseFloat(String(str).replace(/,/g, ".").replace(/[^\d.]/g, ""));
    return isNaN(v) ? 0 : Math.min(Math.round(v * MYR_RATE), MAX_AMOUNT);
  };
  const dispStr = (idr) => (!idr ? "" : isMYR ? (idr / MYR_RATE).toFixed(2) : idr.toLocaleString("id-ID"));

  const mKey = monthKeyOf(year, month);
  const dailyLimit = limits[mKey] || DEFAULT_LIMIT;
  const monthIncomes = incomes[mKey] || [];
  const sortedIncomes = useMemo(() => [...monthIncomes].sort((a, b) => b.amount - a.amount), [monthIncomes]);
  const chipRefs = useRef({});
  const chipPos = useRef({});
  useLayoutEffect(() => {
    const ids = new Set(sortedIncomes.map((it) => it.id));
    // drop bookkeeping for chips that no longer exist so the rest don't jump
    Object.keys(chipPos.current).forEach((id) => { if (!ids.has(id)) delete chipPos.current[id]; });
    Object.keys(chipRefs.current).forEach((id) => { if (!ids.has(id)) delete chipRefs.current[id]; });

    sortedIncomes.forEach((it) => {
      const node = chipRefs.current[it.id];
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const prev = chipPos.current[it.id];
      if (prev && (prev.left !== rect.left || prev.top !== rect.top)) {
        const dx = prev.left - rect.left;
        const dy = prev.top - rect.top;
        node.style.transition = "none";
        node.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(() => {
          node.style.transition = "transform .3s cubic-bezier(0.22,0.9,0.25,1)";
          node.style.transform = "translate(0px, 0px)";
        });
      }
      chipPos.current[it.id] = { left: rect.left, top: rect.top };
    });
  }, [sortedIncomes, showIncomeList, currency]);

  const totalIncome = monthIncomes.reduce((s, it) => s + it.amount, 0);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayNum = isCurrentMonth ? now.getDate() : -1;

  useEffect(() => {
    (async () => {
      try {
        const res = await store.get(STORE_KEY);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          setSpending(migrateSpending(data.spending || {}));
          setLimits(data.limits || {});
          if (data.currency) setCurrency(data.currency);
          let inc = data.incomes || {};
          if (!data.incomes && data.monthlyIncome) {
            inc = { [monthKeyOf(now.getFullYear(), now.getMonth())]: [{ id: uid(), amount: data.monthlyIncome, desc: "", day: null }] };
          }
          setIncomes(migrateIncomes(inc));
          if (Array.isArray(data.goals)) setGoals(data.goals);
          setDebts(cleanDebts(data.debts));
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  /* Saving: every call merges into the newest known data (never a stale snapshot from an older render),
     writes run strictly in order, and a failed write is shown to the user instead of being swallowed. */
  const latestData = useRef(null);
  latestData.current = { spending, incomes, limits, currency, goals, debts, ...(latestData.pending || {}) };
  const saveChain = useRef(Promise.resolve());
  const [saveError, setSaveError] = useState(false);
  const persist = (next = {}) => {
    latestData.pending = { ...(latestData.pending || {}), ...next };
    const snapshot = JSON.stringify({ ...latestData.current, ...latestData.pending });
    setSaving(true);
    saveChain.current = saveChain.current.then(async () => {
      try { await store.set(STORE_KEY, snapshot); setSaveError(false); }
      catch (e) { console.error(e); setSaveError(true); }
    });
    const mine = saveChain.current;
    return mine.then(() => { if (saveChain.current === mine) { setSaving(false); latestData.pending = null; } });
  };
  // the Debts section's way in (a ref, so the section isn't redrawn every time this panel is)
  const debtApi = useRef(null);
  debtApi.current = { fmt, fmtLive, toIDR: amtToIDR, list: () => latestData.current.debts, save: (next) => { setDebts(next); persist({ debts: next }); } };

  /* ---------- backup: export / import the whole dataset ---------- */
  const fileRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState("");

  const exportData = () => {
    const blob = new Blob([JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      spending: ownEntries(spending), incomes: ownEntries(incomes), limits, currency,
      goals: goals.filter((g) => !g.test).map((g) => ({ ...g, deposits: (g.deposits || []).filter((d) => !d.test) })),
      debts: debts.filter((x) => !x.test),
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `pnl-export-${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setBackupMsg(BACKUP_DONE);
    setTimeout(() => setBackupMsg(""), 2600);
  };

  const [undoImport, setUndoImport] = useState(null);      // previous data, kept briefly after an import
  const msgTimer = useRef(0);
  const flashBackup = (m, ms = 3000) => { clearTimeout(msgTimer.current); setBackupMsg(m); msgTimer.current = setTimeout(() => setBackupMsg(""), ms); };
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const applyData = async (d) => {
    setGoals(d.goals); setDebts(d.debts); setSpending(d.spending); setIncomes(d.incomes); setLimits(d.limits); setCurrency(d.currency);
    await persist(d);
  };
  const importData = async (file) => {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { flashBackup("Could not read that file"); return; }
    // only accept something that actually looks like a backup from this app — never wipe data with a random file
    const looksRight = isObj(data) && (isObj(data.spending) || isObj(data.incomes))
      && (data.spending === undefined || isObj(data.spending)) && (data.incomes === undefined || isObj(data.incomes))
      && (data.limits === undefined || isObj(data.limits)) && (data.goals === undefined || Array.isArray(data.goals))
      && (data.debts === undefined || Array.isArray(data.debts));
    if (!looksRight) { flashBackup("That isn't a PnL backup file, nothing was changed", 4000); return; }
    const prev = { spending, incomes, limits, currency, goals, debts };
    const next = {
      debts: cleanDebts(data.debts),
      spending: migrateSpending(data.spending || {}),
      incomes: migrateIncomes(data.incomes || {}),
      limits: data.limits || {},
      currency: data.currency === "MYR" || data.currency === "IDR" ? data.currency : currency,
      goals: (data.goals || []).filter((g) => isObj(g) && g.id && typeof g.name === "string")
        .map((g) => ({ ...g, target: Number(g.target) || 0, deposits: Array.isArray(g.deposits) ? g.deposits.filter((x) => isObj(x) && typeof x.amount === "number") : [] })),
    };
    await applyData(next);
    setUndoImport(prev);
    flashBackup("Backup restored", 10000);
    setTimeout(() => setUndoImport((u) => (u === prev ? null : u)), 10000);
  };
  const revertImport = async () => {
    if (!undoImport) return;
    const prev = undoImport;
    setUndoImport(null);
    await applyData(prev);
    flashBackup("Import undone");
  };

  /* ---------- test data (for trying the app out) ----------
     Adds to what's there, never replaces. Every generated entry carries test: true
     so "Clear test data" can remove exactly those and nothing else. */
  const [testMsg, setTestMsg] = useState("");
  const flashTest = (m) => { setTestMsg(m); setTimeout(() => setTestMsg(""), 2800); };

  /* ---- test-data settings (double-click "Add test data"): the pop-up is TestCfg, with its own draft ---- */
  const [testCfg, setTestCfg] = useState(DEFAULT_TEST_CFG);
  const [cfgDraft, setCfgDraft] = useState(null);           // true while the pop-up is open
  const [cfgClosing, setCfgClosing] = useState(false);
  const testClickTimer = useRef(0);
  useEffect(() => { (async () => {
    try { const r = await store.get(TEST_CFG_KEY); if (r?.value) setTestCfg(cleanTestCfg(JSON.parse(r.value))); } catch (e) {}
  })(); }, []);
  // single click adds with the saved settings; a double click opens the settings instead of adding twice
  const onTestDataClick = (e) => {
    clearTimeout(testClickTimer.current);
    if (e.detail >= 2) { openTestCfg(); return; }
    testClickTimer.current = setTimeout(() => addTestData(testCfg), 260);
  };
  const openTestCfg = () => { setCfgClosing(false); setCfgDraft(true); };
  const closeTestCfg = () => { setCfgClosing(true); setTimeout(() => { setCfgDraft(null); setCfgClosing(false); }, 230); };
  const runTestCfg = async (cfg) => {
    setTestCfg(cfg);
    try { await store.set(TEST_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
    closeTestCfg();
    await addTestData(cfg);
  };

  const addTestData = async (cfg = testCfg) => {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const tag = (it) => ({ id: uid(), ...it, test: true });
    let nextSp = { ...spending }, nextInc = { ...incomes }, baseGoals = goals, baseDebts = debts;
    if (cfg.fresh) { const own = ownTestFree(); nextSp = own.spending; nextInc = own.incomes; baseGoals = own.goals; baseDebts = own.debts; }
    const ty = year, thisY = now.getFullYear(), thisM = now.getMonth();
    const mFrom = cfg.range === "month" || cfg.range === "rest" ? month : 0;
    const mTo = cfg.range === "month" ? month : 11;
    let nE = 0, nI = 0, nZ = 0;
    for (let m = mFrom; m <= mTo; m++) {
      // stopping at today: the months after this one stay empty, and this one ends on today's date
      const last = !cfg.toToday || ty < thisY || (ty === thisY && m < thisM) ? 31 : ty === thisY && m === thisM ? now.getDate() : 0;
      if (!last) continue;
      const g = testMonth(cfg, ty, m, cfg.seed ? seededRand(`${cfg.seed}|${ty}|${m}`) : Math.random, last);
      if (g.incomes.length) { const mk = monthKeyOf(ty, m); nextInc[mk] = [...(nextInc[mk] || []), ...g.incomes.map(tag)]; nI += g.incomes.length; }
      Object.entries(g.days).forEach(([d, items]) => {
        const k = keyOf(ty, m, +d);
        nextSp[k] = [...(nextSp[k] || []).filter((it) => !it.zero), ...items.map(tag)];
        nE += items.length;
      });
      // a day with nothing spent is marked as a no-spend day (unless it already has entries)
      if (cfg.zeros) g.zeros.forEach((d) => {
        const k = keyOf(ty, m, d);
        if (!(nextSp[k] || []).length) { nextSp[k] = [tag({ amount: 0, desc: "No spend day", zero: true })]; nZ++; }
      });
    }
    const addDebts = cfg.debts && !baseDebts.some((x) => x.test);     // one set of sample debts, not one more a click
    const nextDebts = addDebts ? [...baseDebts, ...[["Budi", 1_500_000, 500_000, "owe"], ["Kartu kredit", 4_200_000, 1_200_000, "owe"], ["Sari", 800_000, 0, "owed"], ["Andi", 2_000_000, 750_000, "owed"]]
      .map(([name, amount, paid, dir]) => tag({ name, amount, paid, dir }))] : baseDebts;
    const said = `Added ${nE} expenses, ${nZ} no-spend days, ${nI} incomes${addDebts ? ", 4 debts" : ""}`;
    const styleName = SPEND_STYLES[cfg.style] ? SPEND_STYLES[cfg.style].label.toLowerCase() : "custom";
    // goals: monthly deposits from January up to this month (or the whole year if it's a future year)
    const lastM = ty < now.getFullYear() ? 11 : ty === now.getFullYear() ? now.getMonth() : 11;
    if (!cfg.goals) {
      setSpending(nextSp); setIncomes(nextInc); setGoals(baseGoals); setDebts(nextDebts);
      await persist({ spending: nextSp, incomes: nextInc, goals: baseGoals, debts: nextDebts });
      flashTest(`${said} (${styleName})`);
      return;
    }
    const plans = [
      { name: "Emergency fund", target: 20_000_000, lo: 800, hi: 1_500 },
      { name: "Japan trip",     target: 12_000_000, lo: 900, hi: 1_600 },
      { name: "New MacBook",    target: 28_000_000, lo: 300, hi: 900 },
      { name: "House down payment", target: 150_000_000, lo: 1_000, hi: 3_000, skip: 0.3 },
    ];
    const newGoals = plans.map((pl) => {
      const deposits = [];
      let saved = 0;
      for (let m = 0; m <= lastM && saved < pl.target; m++) {
        if (pl.skip && Math.random() < pl.skip) continue;
        const amt = Math.min(pl.target - saved, rnd(pl.lo, pl.hi) * 1000 * 1);
        const a = Math.round(amt / 50_000) * 50_000 || amt;
        deposits.push({ id: uid(), amount: a, date: keyOf(ty, m, rnd(3, 10)), test: true });
        saved += a;
        // the odd withdrawal, like real life
        if (m > 2 && Math.random() < 0.08 && saved > 1_000_000) {
          const w = rnd(3, 8) * 100_000;
          deposits.push({ id: uid(), amount: -w, date: keyOf(ty, m, rnd(15, 25)), test: true });
          saved -= w;
        }
      }
      return { id: uid(), name: pl.name, target: pl.target, deposits, test: true };
    });
    const nextGoals = [...baseGoals, ...newGoals];
    setSpending(nextSp); setIncomes(nextInc); setGoals(nextGoals); setDebts(nextDebts);
    await persist({ spending: nextSp, incomes: nextInc, goals: nextGoals, debts: nextDebts });
    flashTest(`${said}, ${newGoals.length} goals (${styleName})`);
  };

  // everything he entered himself: the data without the generated entries, and how many of those there were
  const ownTestFree = () => {
    const nextSp = {}, nextInc = {};
    let n = 0;
    Object.entries(spending).forEach(([k, arr]) => {
      const keep = arr.filter((it) => !it.test); n += arr.length - keep.length;
      if (keep.length) nextSp[k] = keep;
    });
    Object.entries(incomes).forEach(([k, arr]) => {
      const keep = arr.filter((it) => !it.test); n += arr.length - keep.length;
      if (keep.length) nextInc[k] = keep;
    });
    const nextGoals = goals.filter((g) => !g.test).map((g) => ({ ...g, deposits: (g.deposits || []).filter((d) => !d.test) }));
    const nextDebts = debts.filter((x) => !x.test);
    n += goals.length - nextGoals.length + debts.length - nextDebts.length;
    return { spending: nextSp, incomes: nextInc, goals: nextGoals, debts: nextDebts, n };
  };
  const clearTestData = async () => {
    const own = ownTestFree();
    setSpending(own.spending); setIncomes(own.incomes); setGoals(own.goals); setDebts(own.debts);
    await persist({ spending: own.spending, incomes: own.incomes, goals: own.goals, debts: own.debts });
    flashTest(own.n ? `Removed ${own.n} test entries` : "No test data to remove");
  };

  const [goalIconMenu, setGoalIconMenu] = useState(null);   // goal id whose picker is open
  const [aiGoalIcons, setAiGoalIcons] = useState({});
  const aiGoalTried = useRef({});
  const goalIconOf = (g) => g.icon || inferGoalIcon(g.name) || aiGoalIcons[g.id] || "savings";
  const setGoalIcon = (id, icon) => {
    const next = goals.map((g) => (g.id === id ? { ...g, icon: icon || undefined } : g));
    setGoals(next); persist({ goals: next }); setGoalIconMenu(null);
  };
  // names the keyword list can't place → ask the model to pick from the icon set
  useEffect(() => {
    if (!AI_OK) return;
    goals.forEach(async (g) => {
      if (g.icon || inferGoalIcon(g.name) || aiGoalIcons[g.id] || aiGoalTried.current[g.id]) return;
      aiGoalTried.current[g.id] = true;
      try {
        const icon = await window.flowAI.pick("goal", g.name, GOAL_ICONS);
        if (GOAL_ICONS.includes(icon)) setAiGoalIcons((m) => ({ ...m, [g.id]: icon }));
      } catch (e) { /* no answer: keep the default */ }
    });
  }, [goals]);
  useEffect(() => {
    if (!goalIconMenu) return;
    const close = (e) => { if (!e.target.closest?.(".goal-sym-wrap")) setGoalIconMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [goalIconMenu]);

  const [editingGoal, setEditingGoal] = useState(null);   // goal id being renamed
  const [editGoalName, setEditGoalName] = useState("");
  const [doneOpen, setDoneOpen] = useState(false);          // completed-goals drop-down
  const [doneMounted, setDoneMounted] = useState(false);    // rows stay mounted until the collapse finishes
  const doneTimer = useRef(0);
  const toggleDone = () => {
    clearTimeout(doneTimer.current);
    if (doneOpen) { setDoneOpen(false); doneTimer.current = setTimeout(() => setDoneMounted(false), 380); }
    else { setDoneMounted(true); requestAnimationFrame(() => setDoneOpen(true)); }
  };
  const startRename = (g) => { setEditingGoal(g.id); setEditGoalName(g.name); };
  const commitRename = () => {
    const id = editingGoal, name = editGoalName.trim();
    setEditingGoal(null);
    if (!id || !name) return;
    const next = goals.map((g) => (g.id === id ? { ...g, name } : g));
    setGoals(next); persist({ goals: next });
  };

  const goalSaved = (g) => Math.max(0, (g.deposits || []).reduce((sum, d) => sum + d.amount, 0));
  const addGoal = () => {
    const name = newGoalName.trim();
    const target = amtToIDR(newGoalTarget);
    if (!name || !target) return;
    const next = [...goals, { id: uid(), name, target, deposits: [] }];
    setGoals(next); persist({ goals: next });
    setNewGoalName(""); setNewGoalTarget(""); setNewGoalOpen(false);
  };
  // deposits land on today when viewing this month, otherwise on the selected (or last) day of the viewed month
  const depositDate = () => {
    if (year === now.getFullYear() && month === now.getMonth()) return keyOf(year, month, now.getDate());
    return keyOf(year, month, selected ?? new Date(year, month + 1, 0).getDate());
  };
  const moveGoalFunds = (id, sign) => {
    let amt = amtToIDR(fundAmt);
    if (!amt) return;
    const next = goals.map((g) => {
      if (g.id !== id) return g;
      if (sign < 0) amt = Math.min(amt, goalSaved(g));
      if (!amt) return g;
      return { ...g, deposits: [...(g.deposits || []), { id: uid(), amount: sign * amt, date: depositDate() }] };
    });
    setGoals(next); persist({ goals: next });
    setFundAmt("");
  };
  const deleteGoal = (id) => {
    setGoalLeaving(id);
    setTimeout(() => {
      setGoals((cur) => { const next = cur.filter((g) => g.id !== id); persist({ goals: next }); return next; });
      setGoalLeaving(null);
      if (fundGoal === id) setFundGoal(null);
    }, 260);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthLabel = `${MONTHS_SHORT[month]} ${year}`;
  const monthLabelFull = `${MONTHS_FULL[month]} ${year}`;

  const dayTotal = (d) => (spending[keyOf(year, month, d)] || []).reduce((s, it) => s + it.amount, 0);

  const stats = useMemo(() => {
    let spent = 0, greenDays = 0, greenSum = 0, redDays = 0, redSum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const items = spending[keyOf(year, month, d)];
      if (!items || items.length === 0) continue;
      const sp = items.reduce((s, it) => s + it.amount, 0);
      spent += sp;
      const pnl = dailyLimit - sp;
      if (pnl >= 0) { greenDays++; greenSum += pnl; }
      else { redDays++; redSum += pnl; }
    }
    return { spent, greenDays, greenSum, redDays, redSum, pnl: greenSum + redSum };
  }, [spending, year, month, daysInMonth, dailyLimit]);

  const statsForYear = (y) => {
    const arr = [];
    let yIncome = 0, ySpent = 0;
    for (let m = 0; m < 12; m++) {
      const dim = new Date(y, m + 1, 0).getDate();
      const lim = limits[monthKeyOf(y, m)] || DEFAULT_LIMIT;
      let spent = 0, pnl = 0, hasData = false;
      for (let d = 1; d <= dim; d++) {
        const items = spending[keyOf(y, m, d)];
        if (!items || items.length === 0) continue;
        hasData = true;
        const sp = items.reduce((s, it) => s + it.amount, 0);
        spent += sp; pnl += lim - sp;
      }
      const inc = (incomes[monthKeyOf(y, m)] || []).reduce((s, it) => s + it.amount, 0);
      yIncome += inc; ySpent += spent;
      arr.push({ spent, pnl, hasData, income: inc });
    }
    return { months: arr, income: yIncome, spent: ySpent };
  };
  const yearStats = useMemo(() => statsForYear(year), [spending, incomes, year, limits]);
  // this year + the next two, every year that holds data, and whichever year is being viewed — never loses old years
  const YEARS = useMemo(() => {
    const ys = new Set([now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2, year]);
    [...Object.keys(spending), ...Object.keys(incomes)].forEach((k) => { const y = parseInt(k.slice(0, 4), 10); if (y > 1900 && y < 3000) ys.add(y); });
    return [...ys].sort((a, b) => a - b);
  }, [spending, incomes, year, dayTick]);
  // a month box's own decoration: that month's spending day by day, as a small line (the data is the picture)
  const yearSparks = useMemo(() => {
    const out = {};
    YEARS.forEach((yr) => {
      for (let m = 0; m < 12; m++) {
        const dim = new Date(yr, m + 1, 0).getDate(), v = [];
        let max = 0;
        for (let d = 1; d <= dim; d++) { const t = (spending[keyOf(yr, m, d)] || []).reduce((a, it) => a + it.amount, 0); v.push(t); if (t > max) max = t; }
        if (max > 0) {
          // evened out over neighbouring days, then drawn as one curve: no corners, round ends
          let w = v;
          for (let k = 0; k < 3; k++) w = w.map((t, i) => ((w[i - 1] ?? t) + 2 * t + (w[i + 1] ?? t)) / 4);
          const top = Math.max(...w);
          out[`${yr}-${m}`] = smoothPath(w.map((t, i) => ({ x: +(2 + (i / (dim - 1)) * 96).toFixed(1), y: +(27 - (t / top) * 23).toFixed(1) })));
        }
      }
    });
    return out;
  }, [spending, YEARS.join()]);
  const allYearStats = useMemo(() => YEARS.map((y) => statsForYear(y)), [spending, incomes, limits, YEARS]);

  const pnlVsPrev = useMemo(() => {
    const pd = new Date(year, month - 1, 1);
    const pm = statsForYear(pd.getFullYear()).months[pd.getMonth()];
    if (!pm.hasData || pm.pnl === 0) return null;
    return { pct: ((stats.pnl - pm.pnl) / Math.abs(pm.pnl)) * 100, name: MONTHS_FULL[pd.getMonth()] };
  }, [spending, limits, year, month, stats.pnl]);

  /* ---------- recap ("wrapped") for a month or a year ---------- */
  const [recap, setRecap] = useState(null);          // { kind: "year" | "month", y, m }
  const [recapClosing, setRecapClosing] = useState(false);
  const openRecap = (r) => { setRecapClosing(false); setRecap(r); };
  const closeRecap = () => {
    setRecapClosing(true);
    setTimeout(() => { setRecap(null); setRecapClosing(false); }, 240);
  };
  useEffect(() => {
    if (!recap) return;
    const onKey = (e) => { if (e.key === "Escape") closeRecap(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recap]);

  const [recapDetail, setRecapDetail] = useState(null);     // "cat:food" | "catbig:food" | "income" | "regular" | "rank"
  const [recapDetailOpen, setRecapDetailOpen] = useState(false);
  const [recapHover, setRecapHover] = useState(null);
  const recapDetailRef = useRef(null);
  useEffect(() => { setRecapDetail(null); setRecapDetailOpen(false); setRecapHover(null); }, [recap]);
  const toggleRecapDetail = (key) => {
    const group = (k) => (k && k.startsWith("cat") ? "cat" : k);
    if (recapDetailOpen && group(recapDetail) === group(key)) { setRecapDetailOpen(false); return; }
    setRecapDetail(key); setRecapDetailOpen(true);
    setTimeout(() => recapDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
  };

  const recapData = useMemo(() => {
    if (!recap) return null;
    const catOf = (it) => { const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other"; return c in CATS ? c : "other"; };
    const cats = { food: 0, transport: 0, shopping: 0, bills: 0, other: 0 };
    const catItems = { food: {}, transport: {}, shopping: {}, bills: {}, other: {} };
    const places = {}, srcs = {}, txs = [];
    let tx = 0, logged = 0, under = 0, spentTot = 0, incTot = 0;
    const addDay = (y, m, d, lim) => {
      const items = spending[keyOf(y, m, d)] || [];
      if (!items.length) return null;
      let sp = 0;
      items.forEach((it) => {
        sp += it.amount;
        if (it.zero) return;
        const c = catOf(it);
        cats[c] += it.amount; tx++;
        const raw = (it.desc || "").trim();
        const k = raw ? canonKey(raw) : "__none__";
        const name = raw ? prettyName(k) : "No description";
        if (!catItems[c][k]) catItems[c][k] = { name, sum: 0, n: 0 };
        catItems[c][k].sum += it.amount; catItems[c][k].n++;
        if (raw) { if (!places[k]) places[k] = { name, n: 0, sum: 0, cat: c }; places[k].n++; places[k].sum += it.amount; }
        txs.push({ amount: it.amount, name, cat: c, when: `${d} ${MONTHS_SHORT[m]}` });
      });
      logged++; if (sp <= lim) under++; spentTot += sp;
      return sp;
    };
    const addInc = (y, m) => {
      let t = 0;
      (incomes[monthKeyOf(y, m)] || []).forEach((it) => {
        t += it.amount;
        const raw = (it.desc || "").trim();
        const k = raw ? canonKey(raw) : "__none__";
        if (!srcs[k]) srcs[k] = { name: raw ? prettyName(k) : "Unlabelled income", v: 0, n: 0 };
        srcs[k].v += it.amount; srcs[k].n++;
      });
      incTot += t;
      return t;
    };
    const units = [];
    let lim = DEFAULT_LIMIT;
    if (recap.kind === "year") {
      for (let m = 0; m < 12; m++) {
        const l = limits[monthKeyOf(recap.y, m)] || DEFAULT_LIMIT;
        const dim = new Date(recap.y, m + 1, 0).getDate();
        let sp = 0, any = false;
        for (let d = 1; d <= dim; d++) { const v = addDay(recap.y, m, d, l); if (v !== null) { sp += v; any = true; } }
        const inc = addInc(recap.y, m);
        units.push({ i: m, label: MONTHS_FULL[m], short: MONTHS_SHORT[m], value: inc - sp, has: any || inc > 0, inc, sp });
      }
    } else {
      const { y, m } = recap;
      lim = limits[monthKeyOf(y, m)] || DEFAULT_LIMIT;
      addInc(y, m);
      const dim = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        const v = addDay(y, m, d, lim);
        const dow = DOW_FULL[(new Date(y, m, d).getDay() + 6) % 7];
        units.push({ i: d, label: `${dow} ${d}`, sub: `${MONTHS_SHORT[m]} ${y}`, short: String(d), value: v === null ? 0 : lim - v, has: v !== null, sp: v || 0 });
      }
    }
    const active = units.filter((u) => u.has);
    const catRows = CAT_ORDER.map((c) => ({ c, v: cats[c] })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
    const srcList = Object.values(srcs).sort((a, b) => b.v - a.v);
    const placeList = Object.values(places).sort((a, b) => b.n - a.n || b.sum - a.sum);
    const best = active.length ? active.reduce((a, b) => (b.value > a.value ? b : a)) : null;
    const worst = active.length > 1 ? active.reduce((a, b) => (b.value < a.value ? b : a)) : null;
    const total = active.reduce((a, u) => a + u.value, 0);
    const catItemLists = {};
    CAT_ORDER.forEach((c) => { catItemLists[c] = Object.values(catItems[c]).sort((a, b) => b.sum - a.sum); });
    return {
      kind: recap.kind, y: recap.y, m: recap.m, lim,
      empty: active.length === 0,
      units, active: active.length, best, worst, total, avg: active.length ? total / active.length : 0,
      ranked: [...active].sort((a, b) => b.value - a.value),
      catRows, catItemLists, txs, spentTot, incTot, tx, logged, under,
      srcList, placeList,
      src: srcList[0] || null,
      place: placeList[0] && placeList[0].n >= 2 ? placeList[0] : null,
    };
  }, [recap, spending, incomes, limits, aiCats]);

  const remaining = totalIncome - stats.spent;
  const remainFrac = totalIncome > 0 ? Math.max(0, Math.min(1, remaining / totalIncome)) : 0;
  const yearRemaining = yearStats.income - yearStats.spent;
  const yearRemainFrac = yearStats.income > 0 ? Math.max(0, Math.min(1, yearRemaining / yearStats.income)) : 0;

  useEffect(() => {
    if (!yearIntro) { setIntroMove(false); setIntroTarget(null); return; }
    let t1, t2;
    const raf = requestAnimationFrame(() => {
      // The header year is in the pixel font, whose digits sit further apart than the normal font's. Each header digit
      // carries a hidden normal-font twin (.yb-n) exactly over it; the big digits land on those twins, spreading
      // slightly as they shrink, so the hand-over to the header is seamless.
      const el = introTextRef.current;
      const a = el?.getBoundingClientRect();
      const chars = el ? [...el.children] : [];
      const b = [...(headerYearRef.current?.querySelectorAll(".yb-n") || [])].map((m) => m.getBoundingClientRect());
      if (a && a.height > 0 && b.length && b.length === chars.length && b[0].height > 0) {
        const scale = b[0].height / a.height;
        const ls = parseFloat(getComputedStyle(el).letterSpacing) || 0;
        const mid = (k) => chars[k].offsetLeft + (chars[k].offsetWidth - ls) / 2;      // centre of the glyph, before scaling
        const dx = b[0].left + b[0].width / 2 - a.left - scale * mid(0);
        setIntroTarget({
          scale, dx,
          dy: (b[0].top + b[0].height / 2) - (a.top + a.height / 2),
          shift: chars.map((_, k) => (b[k].left + b[k].width / 2 - a.left - dx) / scale - mid(k)),
        });
      }
      t1 = setTimeout(() => setIntroMove(true), 450);          // align, settle, travel
      t2 = setTimeout(() => {                                  // panel appears the moment it lands
        setYearIntro(false);
        setYearFlick(Array.from({ length: chars.length || 4 }, () => ({
          cls: `fk${Math.floor(Math.random() * 3)}`,
          style: { "--kd": `${YEAR_FLICK_DELAY_MS + Math.round(Math.random() * 240)}ms`, "--kt": `${Math.round(800 + Math.random() * 350)}ms` },
        })));
      }, 855);
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
  }, [yearIntro]);
  useEffect(() => {
    if (!yearFlick) return;
    const t = setTimeout(() => setYearFlick(null), YEAR_FLICK_MS);
    return () => clearTimeout(t);
  }, [yearFlick]);

  /* ---------- year stack: one scroll step per year ---------- */
  const yearWrapRef = useRef(null);
  const wheelLock = useRef(null);
  const yearIdx = Math.max(0, YEARS.indexOf(year));
  const stepYear = (dir) => {
    const next = Math.min(YEARS.length - 1, Math.max(0, yearIdx + dir));
    if (next === yearIdx) return;
    setYearShift(true);
    setYear(YEARS[next]);
    setTimeout(() => setYearShift(false), 420);
  };
  useEffect(() => {
    if (!launched || view !== "year") return;
    const el = yearWrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const big = Math.abs(e.deltaY) >= 4;
      if (big) e.preventDefault();
      if (wheelSwipe(wheelLock, big, e.deltaY)) stepYear(e.deltaY > 0 ? 1 : -1);
    };
    const onKey = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (chartOpen) return;   // the chart pop-up browses on its own
      e.preventDefault();
      stepYear(e.key === "ArrowDown" ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => { el.removeEventListener("wheel", onWheel); window.removeEventListener("keydown", onKey); };
  }, [launched, view, yearIdx, YEARS, chartOpen]);

  // a digit typed on the yearly panel, with nothing else open, lands in the quick-add amount
  useEffect(() => {
    if (!launched || view !== "year" || chartOpen || recap || cfgDraft) return;
    const onKey = (e) => {
      if (!/^[0-9]$/.test(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      quickBoxRef.current?.querySelector("input")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [launched, view, chartOpen, recap, cfgDraft]);

  useEffect(() => {
    if (!launched || view !== "month") return;
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (chartOpen || catView || scoreView) return;
      e.preventDefault();
      nav(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [launched, view, year, month, chartOpen, catView, scoreView, YEARS]);

  // one month forward or back, staying inside the years that exist (YEARS): past December it goes to the next year
  // in the list, before January to the previous one, and at either end of the list there is nowhere to go (null)
  const monthAfter = (y, m, dir) => {
    const mm = m + dir;
    if (mm >= 0 && mm <= 11) return { y, m: mm };
    const i = YEARS.indexOf(y) + dir;
    return i < 0 || i >= YEARS.length ? null : { y: YEARS[i], m: dir > 0 ? 0 : 11 };
  };
  const nav = (dir) => {
    if (view === "year") { setYear(year + dir); return; }
    const to = monthAfter(year, month, dir);
    if (!to) return;
    setMonth(to.m); setYear(to.y); setSelected(null);
  };
  // month title flicker. Rolled before the first paint of the new title, so the new month never shows in the pixel
  // font for a frame first
  useLayoutEffect(() => {
    if (!launched || view !== "month") { monthShown.current = null; return; }
    const name = MONTHS_FULL[month], from = monthShown.current;
    monthShown.current = name;
    const wait = from ? 0 : YEAR_FLICK_DELAY_MS;       // just opened: hold the normal font a moment first
    const shift = from ? [] : monthTwinShift(name);
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    setMonthFlick((f) => ({
      id: (f?.id || 0) + 1, wait, from,
      // one cell per letter of the longer name: a longer old name fades out past the end of the new one
      cells: Array.from({ length: Math.max(name.length, from ? from.length : 0) }, (_, i) => (from
        // switching: each letter flickers between the old month and the new one in the header year's rhythms (--kt long),
        // starting a little later the further right it is (--kd); --ox keeps the old letter where it stood
        ? { cls: `fk${rnd(0, 2)}`, style: { "--kd": `${i * 45 + rnd(0, 90)}ms`, "--kt": `${rnd(1250, 1650)}ms`, "--ox": `${monthTightShift(from, i) - monthTightShift(name, i)}px` } }
        : { cls: `fk${rnd(0, 2)}`, style: { "--kd": `${wait + rnd(0, 240)}ms`, "--kt": `${rnd(800, 1150)}ms`, "--nx": `${shift[i] || 0}px` } })),
    }));
  }, [launched, view, year, month]);
  useEffect(() => {
    if (!monthFlick?.cells) return;
    const t = setTimeout(() => setMonthFlick((f) => (f && f.id === monthFlick.id ? { ...f, cells: null } : f)), monthFlick.from ? 2400 : monthFlick.wait + 1500);
    return () => clearTimeout(t);
  }, [monthFlick]);

  const selKey = selected !== null ? keyOf(year, month, selected) : null;
  const selItems = selKey ? spending[selKey] || [] : [];
  const selIncomes = selected !== null ? monthIncomes.filter((it) => it.day === selected) : [];

  // double-clicking the minus button files a 0Rb "no spend" day
  const addZeroDay = async () => {
    if (selKey === null) return;
    if (selItems.some((it) => it.zero)) return;
    const next = { ...spending, [selKey]: [...selItems, { id: uid(), amount: 0, desc: "No spend day", zero: true }] };
    setSpending(next); setNewAmt(""); setNewDesc("");
    await persist({ spending: next });
  };

  const addExpense = async () => {
    const amt = amtToIDR(newAmt);
    if (!amt) return;
    const next = { ...spending, [selKey]: [...selItems.filter((it) => !it.zero), { id: uid(), amount: amt, desc: newDesc.trim() }] };
    setSpending(next); setNewAmt(""); setNewDesc("");
    await persist({ spending: next });
  };
  const editExpense = (id, field, value) => {
    setSpending({
      ...spending,
      [selKey]: selItems.map((it) => (it.id === id ? { ...it, [field]: field === "amount" ? amtToIDR(value) : value } : it)),
    });
  };
  const deleteExpense = (id) => {
    setRemoving((r) => ({ ...r, [id]: true }));
    setTimeout(async () => {
      const rem = selItems.filter((it) => it.id !== id);
      const next = { ...spending };
      if (rem.length === 0) delete next[selKey]; else next[selKey] = rem;
      setSpending(next);
      setRemoving((r) => { const c = { ...r }; delete c[id]; return c; });
      await persist({ spending: next });
    }, 260);
  };

  // the top box files income against today (or the selected date when browsing
  // another month), so it always shows up as a green dot on the calendar
  const quickIncomeDay = () => {
    if (isCurrentMonth) return todayNum;
    if (selected !== null) return selected;
    return 1;
  };

  const addIncomeEntry = async (amount, desc, day) => {
    if (!amount) return;
    const next = { ...incomes, [mKey]: [...monthIncomes, { id: uid(), amount, desc, day }] };
    setIncomes(next);
    await persist({ incomes: next });
  };
  // quick add (yearly panel): files an expense or an income against today, whatever year or month is on screen
  const quickApi = useRef(null);
  const quickBoxRef = useRef(null);
  quickApi.current = {
    add: (kind, typed, desc) => {
      const amount = amtToIDR(typed);
      if (!amount) return null;
      const t = new Date();
      if (kind === "inc") {
        const k = monthKeyOf(t.getFullYear(), t.getMonth());
        const next = { ...incomes, [k]: [...(incomes[k] || []), { id: uid(), amount, desc, day: t.getDate() }] };
        setIncomes(next); persist({ incomes: next });
      } else {
        const k = keyOf(t.getFullYear(), t.getMonth(), t.getDate());
        const next = { ...spending, [k]: [...(spending[k] || []).filter((it) => !it.zero), { id: uid(), amount, desc }] };
        setSpending(next); persist({ spending: next });
      }
      return fmt(amount);
    },
  };

  const editIncome = (id, field, value) => {
    setIncomes({
      ...incomes,
      [mKey]: monthIncomes.map((it) => (it.id === id ? { ...it, [field]: field === "amount" ? amtToIDR(value) : value } : it)),
    });
  };
  // chips in the header list: drop instantly, the FLIP pass slides the rest
  const deleteIncomeNow = async (id) => {
    const rem = monthIncomes.filter((it) => it.id !== id);
    const next = { ...incomes };
    if (rem.length === 0) delete next[mKey]; else next[mKey] = rem;
    setIncomes(next);
    await persist({ incomes: next });
  };

  const deleteIncome = (id) => {
    setRemoving((r) => ({ ...r, [id]: true }));
    setTimeout(async () => {
      const rem = monthIncomes.filter((it) => it.id !== id);
      const next = { ...incomes };
      if (rem.length === 0) delete next[mKey]; else next[mKey] = rem;
      setIncomes(next);
      setRemoving((r) => { const c = { ...r }; delete c[id]; return c; });
      await persist({ incomes: next });
    }, 260);
  };

  /* ---------- categories ---------- */
  const resolvedCat = (it) => it.cat || inferCat(it.desc) || aiCats[it.id] || null;
  const iconOf = (it) => {
    if (it.icon) return it.icon;
    const c = resolvedCat(it);
    return c ? CATS[c].icon : null;
  };

  const setItemCat = async (id, cat, icon) => {
    const next = {
      ...spending,
      [selKey]: selItems.map((it) => (it.id === id ? { ...it, cat, ...(icon !== undefined ? { icon } : {}) } : it)),
    };
    setSpending(next);
    await persist({ spending: next });
  };
  const setItemDescAndCat = async (id, desc, cat, icon) => {
    const next = {
      ...spending,
      [selKey]: selItems.map((it) => (it.id === id
        ? { ...it, cat, desc: desc !== undefined && desc !== "" ? desc : it.desc, ...(icon !== undefined ? { icon } : {}) }
        : it)),
    };
    setSpending(next);
    await persist({ spending: next });
  };

  // AI fallback when keywords don't match and the user picked nothing
  useEffect(() => {
    const pending = selItems.filter(
      (it) => !it.zero && !it.cat && !it.icon && it.desc && !inferCat(it.desc) && !aiCats[it.id] && !aiTried.current[it.id]
    );
    if (pending.length === 0 || !AI_OK) return;
    pending.forEach(async (it) => {
      aiTried.current[it.id] = true;
      try {
        const cat = await window.flowAI.pick("cat", it.desc, CAT_ORDER);
        if (CAT_ORDER.includes(cat)) setAiCats((m) => ({ ...m, [it.id]: cat }));
      } catch (e) { /* no answer: stay uncategorised */ }
    });
  }, [selItems]);

  const closeCatMenu = () => {
    if (!catMenu) return;
    setCatMenu((m) => ({ ...m, closing: true }));
    setTimeout(() => setCatMenu(null), 180);
  };

  const commitEdits = async () => persist({});

  const saveLimit = async (val) => {
    const num = amtToIDR(val);
    const next = { ...limits, [mKey]: num || DEFAULT_LIMIT };
    if (!num) delete next[mKey];
    setLimits(next);
    await persist({ limits: next });
  };

  // triple-click "Daily limit" → copy this month's limit to every month of the year
  const [limitFlash, setLimitFlash] = useState(0);
  const applyLimitToYear = async () => {
    const next = { ...limits };
    for (let m = 0; m < 12; m++) {
      const k = monthKeyOf(year, m);
      if (dailyLimit === DEFAULT_LIMIT) delete next[k]; else next[k] = dailyLimit;
    }
    setLimits(next);
    setLimitFlash((n) => n + 1);
    await persist({ limits: next });
  };

  const pickCurrency = async (c) => {
    setCurrency(c);
    await persist({ currency: c });
  };

  const closePanel = () => {
    setPanelClosing(true);
    setPanelAnim(true);
    setTimeout(() => { setSelected(null); setPanelClosing(false); setPanelAnim(false); }, 340);
  };
  useEffect(() => {
    if (selected === null) return;
    setPanelAnim(true);
    const t = setTimeout(() => setPanelAnim(false), 360);
    return () => clearTimeout(t);
  }, [selected]);
  const closeChart = (after) => {
    setChartClosing(true); setHoverPt(null);
    setTimeout(() => {
      setChartOpen(false); setChartClosing(false); setChartAt(null); setChartCmp(0);
      if (after) after();
    }, 190);
  };

  /* ---------- chart pop-up: its own month / year ---------- */
  const cY = chartOpen && chartAt ? chartAt.y : year;
  const cM = chartOpen && chartAt ? chartAt.m : month;
  const cDays = new Date(cY, cM + 1, 0).getDate();
  const cLimit = limits[monthKeyOf(cY, cM)] || DEFAULT_LIMIT;
  const cToday = cY === now.getFullYear() && cM === now.getMonth() ? now.getDate() : -1;
  const chartLabel = view === "year" ? String(cY) : `${MONTHS_SHORT[cM]} ${cY}`;
  const chartYearIdx = YEARS.indexOf(cY);
  // both stop at the ends of the year list, like the yearly and monthly panels
  const chartCanStep = (dir) => (view === "year" ? chartYearIdx + dir >= 0 && chartYearIdx + dir < YEARS.length : !!monthAfter(cY, cM, dir));
  const stepChart = (dir) => {
    setHoverPt(null);
    setChartAt((c) => {
      if (!c) return c;
      if (view === "year") {
        const i = YEARS.indexOf(c.y) + dir;
        return i < 0 || i >= YEARS.length ? c : { y: YEARS[i], m: c.m, dir };
      }
      const to = monthAfter(c.y, c.m, dir);
      return to ? { ...to, dir } : c;
    });
  };
  // clicking a point leaves the chart and opens that day / month
  const chartGo = (isMonthMode, i) => closeChart(() => {
    setYear(cY);
    if (isMonthMode) { setMonth(cM); setView("month"); setSelected(i + 1); }
    else { setMonth(i); setView("month"); setSelected(null); }
  });
  // while it is open: ← → (or ↑ ↓) and the scroll wheel step through the periods
  useEffect(() => {
    if (!chartOpen) return;
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      e.preventDefault();
      stepChart(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
    };
    const el = chartWrapRef.current;
    const onWheel = (e) => {
      // a pop-up too tall for the window keeps its normal scrolling
      const md = chartModalRef.current;
      if (md && md.scrollHeight > md.clientHeight + 1) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      e.preventDefault();
      if (wheelSwipe(chartWheelLock, Math.abs(d) >= 4, d)) stepChart(d > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    if (el) el.addEventListener("wheel", onWheel, { passive: false });
    return () => { window.removeEventListener("keydown", onKey); if (el) el.removeEventListener("wheel", onWheel); };
  }, [chartOpen, view, YEARS]);

  /* ---------- ghost .000 helper ---------- */
  const needsGhost = (val) => {
    const d = digitsOf(val);
    return !isMYR && d.length > 0 && d.length < 4;
  };

  const chart = useMemo(() => {
    const exp = [], inc = [];
    const mInc = incomes[monthKeyOf(cY, cM)] || [];
    for (let d = 1; d <= cDays; d++) {
      const items = spending[keyOf(cY, cM, d)];
      const sp = items && items.length ? items.reduce((s, it) => s + it.amount, 0) : null;
      const ic = mInc.filter((it) => it.day === d).reduce((s, it) => s + it.amount, 0) || null;
      exp.push(sp); inc.push(ic);
    }
    return { exp, inc };
  }, [spending, incomes, cY, cM, cDays]);
  const chartYearStats = useMemo(() => (cY === year ? yearStats : statsForYear(cY)), [yearStats, cY, year, spending, incomes, limits]);
  // compare (see CmpButton): 0 off, -1 the period before the chart's, 1 the one after
  const [chartCmp, setChartCmp] = useState(0);
  const chartCmpData = useMemo(() => {
    if (!chartOpen) return null;
    const of = (dir) => {
      let exp, inc, label;
      if (view === "year") {
        const y = YEARS[YEARS.indexOf(cY) + dir];
        if (YEARS.indexOf(cY) < 0 || y === undefined) return null;
        const months = statsForYear(y).months;
        exp = months.map((m) => (m.hasData ? m.spent : null)); inc = months.map((m) => (m.income > 0 ? m.income : null)); label = String(y);
      } else {
        const to = monthAfter(cY, cM, dir);
        if (!to) return null;
        const mInc = incomes[monthKeyOf(to.y, to.m)] || [], days = new Date(to.y, to.m + 1, 0).getDate();
        exp = []; inc = [];
        for (let d = 1; d <= days; d++) {
          const items = spending[keyOf(to.y, to.m, d)];
          exp.push(items && items.length ? items.reduce((sum, it) => sum + it.amount, 0) : null);
          inc.push(mInc.filter((it) => it.day === d).reduce((sum, it) => sum + it.amount, 0) || null);
        }
        label = `${MONTHS_SHORT[to.m]} ${to.y}`;
      }
      return exp.some((v) => v !== null) || inc.some((v) => v !== null) ? { exp, inc, label, per: `${view}|${cY}|${cM}` } : null;
    };
    return { "-1": of(-1), 1: of(1) };
  }, [chartOpen, view, cY, cM, spending, incomes, limits, YEARS]);
  const cmpOn = (chartCmp && chartCmpData && chartCmpData[chartCmp]) || null;
  const cmpWas = useGone(cmpOn);
  const cmpGone = cmpWas && cmpWas.per === `${view}|${cY}|${cM}` ? cmpWas : null;

  /* ---------- weekly expense chart ---------- */
  const weekData = useMemo(() => {
    // Monday-first week containing today (or the 1st of the shown month)
    const base = selected !== null
      ? new Date(year, month, selected)
      : isCurrentMonth ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
                       : new Date(year, month, 1);
    const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dow);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const items = spending[keyOf(d.getFullYear(), d.getMonth(), d.getDate())] || [];
      const total = items.reduce((sum, it) => sum + it.amount, 0);
      const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      const isSel = selected !== null && d.getFullYear() === year && d.getMonth() === month && d.getDate() === selected;
      const future = d > now;
      days.push({ label: DOW_FULL[i], total, isToday, isSel, future, date: d });
    }
    let lastIdx = -1;
    days.forEach((d, i) => { if (!d.future || d.total > 0) lastIdx = i; });
    const first = days[0].date, last = days[6].date;
    const range = `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
    return { days, lastIdx, range, total: days.reduce((s, d) => s + d.total, 0) };
  }, [spending, year, month, isCurrentMonth, selected, dayTick]);
  // compare on the weekly chart (the symbol at its top right): the week before (-1) or after (1) the one shown, as a
  // ghost line (see "Compare"). 0 = off
  const [weekCmp, setWeekCmp] = useState(0);
  const weekCmpData = useMemo(() => {
    const monday = weekData.days[0].date;
    const of = (dir) => {
      const vals = [];
      let end = -1;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dir * 7 + i);
        const total = (spending[keyOf(d.getFullYear(), d.getMonth(), d.getDate())] || []).reduce((sum, it) => sum + it.amount, 0);
        vals.push(total);
        if (d <= now || total > 0) end = i;        // as on the chart's own line: no further than today, unless something is entered
      }
      return vals.some((v) => v > 0) ? { vals: vals.slice(0, end + 1), label: dir < 0 ? "the week before" : "the week after", per: monday.getTime() } : null;
    };
    return { "-1": of(-1), 1: of(1) };
  }, [weekData, spending]);
  const weekOn = (weekCmp && weekCmpData[weekCmp]) || null;
  const weekWas = useGone(weekOn);
  const weekGone = weekWas && weekWas.per === weekData.days[0].date.getTime() ? weekWas : null;

  const renderWeek = () => {
    const pts = weekData.lastIdx >= 0 ? weekData.days.slice(0, weekData.lastIdx + 1) : [];
    const W = 720, H = 250, PL = 66, PR = 26, PT = 18, PB = 34;
    const iw = W - PL - PR, ih = H - PT - PB;
    const weekLimit = Math.max(...weekData.days.map((d) =>
      limits[monthKeyOf(d.date.getFullYear(), d.date.getMonth())] || DEFAULT_LIMIT));
    const maxV = Math.max(...weekData.days.map((d) => d.total), ...(weekOn ? weekOn.vals : []), weekLimit, 1) * 1.15;
    const X = (i) => PL + (i / 6) * iw;
    const Y = (v) => PT + ih - (v / maxV) * ih;

    const curve = (arr) => {
      if (!arr.length) return "";
      let d = `M ${X(0)} ${Y(arr[0].total)}`;
      for (let k = 1; k < arr.length; k++) {
        const x0 = X(k - 1), y0 = Y(arr[k - 1].total);
        const x1 = X(k), y1 = Y(arr[k].total);
        const dx = (x1 - x0) / 2;
        d += ` C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;
      }
      return d;
    };
    const line = curve(pts);
    const area = pts.length > 1 ? `${line} L ${X(pts.length - 1)} ${PT + ih} L ${X(0)} ${PT + ih} Z` : "";
    const yTicks = [0, 0.33, 0.66, 1].map((f) => f * maxV);
    const endIdx = pts.length - 1;

    return (
      <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          <linearGradient id="weekFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7cdd2" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#c7cdd2" stopOpacity="0" />
          </linearGradient>
          {/* line colour by height: green under 75% of the limit, yellow up to the limit, red above it */}
          {(() => {
            const o = (y) => Math.min(1, Math.max(0, (y - PT) / ih));
            const yLim = o(Y(weekLimit)), yWarn = o(Y(weekLimit * WARN_FRAC));
            return (
              <linearGradient id="weekLine" gradientUnits="userSpaceOnUse" x1="0" y1={PT} x2="0" y2={PT + ih}>
                <stop offset={0} stopColor="#ff5d6c" />
                <stop offset={yLim} stopColor="#ff5d6c" />
                <stop offset={yLim} stopColor="#ffd069" />
                <stop offset={yWarn} stopColor="#ffd069" />
                <stop offset={yWarn} stopColor="#3ddc97" />
                <stop offset={1} stopColor="#3ddc97" />
              </linearGradient>
            );
          })()}
        </defs>
        {/* axes */}
        <line x1={PL} y1={PT - 4} x2={PL} y2={PT + ih} stroke="#4a5055" strokeWidth="1.4" />
        <line x1={PL} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#4a5055" strokeWidth="1.4" />
        {yTicks.map((v, i) => (
          Math.abs(Y(v) - Y(weekLimit)) < 13 ? null : (
            <text key={i} x={PL - 12} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end">
              {v === 0 ? "0" : <CountNum value={v} duration={CMP_MS} render={(n) => fmtCoarse(n)} still />}
            </text>
          )
        ))}
        {weekData.days.map((d, i) => (
          <text key={i} x={X(i)} y={PT + ih + 22} fontSize="11" textAnchor="middle"
                fill={d.isSel || d.isToday ? "#e8eaec" : "#8a9299"} fontWeight={d.isSel || d.isToday ? 700 : 400}>
            {d.label}
          </text>
        ))}
        {/* daily limit marker */}
        {weekLimit > 0 && Y(weekLimit) > PT - 2 && (
          <g className="axis-fade ch-slide" style={{ animationDelay: "260ms", transform: `translateY(${Y(weekLimit)}px)` }}>
            <line x1={PL} y1="0" x2={W - PR} y2="0"
                  stroke="#c7cdd2" strokeWidth="1.4" strokeDasharray="5 5" opacity="0.5" />
            <text x={PL - 12} y="4" fill="#aeb5bb" fontSize="11"
                  fontWeight="600" textAnchor="end">
              {fmtCoarse(weekLimit)}
            </text>
          </g>
        )}

        {weekOn && <GhostLine key={`g${weekOn.label}`} pts={weekOn.vals.map((v, i) => ({ x: X(i), y: Y(v), v }))} />}
        {weekGone && <GhostLine key={`g${weekGone.label}`} pts={weekGone.vals.map((v, i) => ({ x: X(i), y: 0, v }))} gone into={pts.map((d, i) => ({ x: X(i), y: Y(d.total) }))} />}
        {pts.length > 1 && (
          <>
            <path className="axis-fade ch-morph" d={area} fill="url(#weekFill)" />
            <path className="line-draw ch-morph" pathLength="1" d={line} fill="none" stroke="url(#weekLine)"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animationDuration: ".8s" }} />
          </>
        )}
        {pts.length > 0 && (() => {
          const todayInWeek = weekData.days.findIndex((d) => d.isToday);
          const mi = todayInWeek >= 0 && todayInWeek <= endIdx ? todayInWeek : endIdx;
          return (
            <circle className="axis-fade ch-morph" style={{ animationDelay: "420ms" }}
                    cx={X(mi)} cy={Y(weekData.days[mi].total)} r="6"
                    fill="#1e2124" stroke="#e8eaec" strokeWidth="2.2" />
          );
        })()}

        {/* hover targets */}
        {weekData.days.map((d, i) => (
          <rect key={`h${i}`} x={X(i) - iw / 12} y={PT - 6} width={iw / 6} height={ih + 6}
                fill="transparent" style={{ cursor: d.future && d.total === 0 ? "default" : "pointer" }}
                onMouseEnter={() => (!d.future || d.total > 0) && setWeekHover({ i, x: X(i), y: Y(d.total), d })}
                onMouseLeave={() => setWeekHover(null)} />
        ))}
        {weekHover && (
          <g key={`wk-${weekHover.i}`} className="wk-tip" pointerEvents="none">
            <line x1={weekHover.x} y1={PT} x2={weekHover.x} y2={PT + ih} stroke="#3a3f44" strokeWidth="1" />
            <circle className="tip-dot" cx={weekHover.x} cy={weekHover.y} r="5" fill="#ffffff" />
          </g>
        )}
      </svg>
      {/* compare: a symbol at the chart's top right corner, in line with the top of the y-axis and the end of the x-axis */}
      {(() => {
        const there = [-1, 1].filter((d) => weekCmpData[d]);
        const on = there.includes(weekCmp) ? weekCmp : 0, order = [0, ...there];
        return (
          <button className={`wk-cmp${on ? " on" : ""}`} disabled={!there.length} style={{ right: `${(PR / W) * 100}%`, top: `${((PT - 4) / H) * 100}%` }}
                  onClick={() => setWeekCmp(order[(order.indexOf(on) + 1) % order.length])}
                  title={!there.length ? "Nothing in the week before or after to compare with" : on ? `Compared with ${weekCmpData[on].label}. Click to change` : "Compare with the week before or after"}>
            <span key={on} className="msym">{on < 0 ? "keyboard_double_arrow_left" : on > 0 ? "keyboard_double_arrow_right" : "compare_arrows"}</span>
          </button>
        );
      })()}
      {weekHover && (
        <GlassTip key={`wkg-${weekHover.i}`} W={W} H={H} x={Math.min(Math.max(weekHover.x, PL + 58), W - PR - 58)}
                  y={weekHover.y} below={weekHover.y < PT + 56} label={`${weekHover.d.label} ${weekHover.d.date.getDate()}`} value={fmt(weekHover.d.total)}
                  color={weekHover.d.total > weekLimit ? "#ff8d97" : weekHover.d.total > weekLimit * WARN_FRAC ? "#ffd98a" : "#9df0c9"} />
      )}
      </div>
    );
  };

  /* ---------- money flow (sankey) ---------- */
  const flowTotals = useMemo(() => {
    const t = { food: 0, transport: 0, shopping: 0, bills: 0, other: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const items = spending[keyOf(year, month, d)] || [];
      items.forEach((it) => {
        const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
        t[c in t ? c : "other"] += it.amount;
      });
    }
    return t;
  }, [spending, year, month, daysInMonth, aiCats]);

  /* ---------- insights ---------- */
  const insights = useMemo(() => {
    const catOfItem = (it) => {
      const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
      return c in CATS ? c : "other";
    };
    const monthCats = (y, m) => {
      const t = { food: 0, transport: 0, shopping: 0, bills: 0, other: 0 };
      let total = 0, any = false;
      const dim = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= dim; d++) {
        (spending[keyOf(y, m, d)] || []).forEach((it) => { t[catOfItem(it)] += it.amount; total += it.amount; any = true; });
      }
      return { t, total, any };
    };
    const dayTot = (dt) => (spending[keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate())] || []).reduce((a, it) => a + it.amount, 0);
    const B = ({ children }) => <b style={{ color: "#e8eaec", fontWeight: 700 }}>{children}</b>;
    const dLabel = (d) => `${d} ${MONTHS_SHORT[month]}`;
    const times = (r) => `${r >= 10 ? Math.round(r) : r.toFixed(1).replace(/\.0$/, "")}×`;

    const isCur = year === now.getFullYear() && month === now.getMonth();
    const isPast = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth());
    const dim = new Date(year, month + 1, 0).getDate();
    // any month other than the current one is read as a whole month, including future months with (test) data
    const elapsed = isCur ? now.getDate() : dim;
    const cur = monthCats(year, month);
    if (!elapsed || !cur.any) return [];
    const out = [];

    // 1. category (and overall) vs the average of up to 3 previous months with data
    if (!isCur || elapsed >= 7) {
      const prev = [];
      for (let k = 1; k <= 12 && prev.length < 3; k++) {
        const dt = new Date(year, month - k, 1);
        const mc = monthCats(dt.getFullYear(), dt.getMonth());
        if (mc.any) prev.push(mc);
      }
      if (prev.length) {
        const factor = dim / elapsed;
        const n = prev.length;
        const cands = [];
        [...CAT_ORDER, "__all"].forEach((c) => {
          const avg = prev.reduce((a, mc) => a + (c === "__all" ? mc.total : mc.t[c]), 0) / n;
          const proj = (c === "__all" ? cur.total : cur.t[c]) * factor;
          if (avg < 20000 || proj < 1) return;
          const pct = Math.round(((proj - avg) / avg) * 100);
          if (Math.abs(pct) < 20) return;
          cands.push({ c, pct, avg });
        });
        cands.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 2).forEach(({ c, pct, avg }) => {
          const up = pct > 0;
          const name = c === "__all" ? "Total" : CATS[c].label;
          out.push({
            key: `cat-${c}`, tone: up ? "bad" : "good", icon: up ? "trending_up" : "trending_down",
            text: <>{name} spending {isCur ? "is on pace to be" : "was"} <B>{Math.abs(pct)}% {up ? "higher" : "lower"}</B> than your {n}-month average ({fmt(avg)}).</>,
          });
        });
      }
    }

    // 2. monthly budget (daily limit × days)
    const lim = limits[monthKeyOf(year, month)] || DEFAULT_LIMIT;
    const budget = lim * dim;
    let cum = 0, crossed = 0;
    for (let d = 1; d <= elapsed; d++) {
      cum += dayTot(new Date(year, month, d));
      if (!crossed && cum > budget) crossed = d;
    }
    if (crossed) {
      out.push({ key: "budget", tone: "bad", icon: "event_busy",
        text: <>You passed this month's budget of {fmt(budget)} on <B>{dLabel(crossed)}</B>.</> });
    } else if (isCur && elapsed >= 3) {
      const rate = cur.total / elapsed;
      const day = rate > 0 ? Math.ceil(budget / rate) : Infinity;
      if (day <= dim) {
        out.push({ key: "budget", tone: "bad", icon: "event_busy",
          text: <>At your current pace ({fmt(rate)}/day) you'll pass your {fmt(budget)} budget around <B>{dLabel(day)}</B>.</> });
      } else {
        out.push({ key: "budget", tone: "good", icon: "event_available",
          text: <>At this pace you'll finish the month about <B>{fmt(budget - rate * dim)} under</B> your {fmt(budget)} budget.</> });
      }
    } else if (!isCur) {
      out.push({ key: "budget", tone: "good", icon: "event_available",
        text: <>You finished {MONTHS_SHORT[month]} <B>{fmt(budget - cur.total)} under</B> your {fmt(budget)} budget.</> });
    }

    // 3. income pace
    const inc = (incomes[monthKeyOf(year, month)] || []).reduce((a, it) => a + it.amount, 0);
    if (isCur && inc > 0 && elapsed >= 3) {
      const rate = cur.total / elapsed;
      if (cur.total > inc) {
        out.push({ key: "income", tone: "bad", icon: "account_balance_wallet",
          text: <>Spending has already passed this month's income by <B>{fmt(cur.total - inc)}</B>.</> });
      } else if (rate > 0 && Math.ceil(inc / rate) <= dim) {
        out.push({ key: "income", tone: "bad", icon: "account_balance_wallet",
          text: <>At this pace, spending will overtake this month's income around <B>{dLabel(Math.ceil(inc / rate))}</B>.</> });
      }
    }

    // 4. weekend vs weekday pattern over the last 8 weeks
    {
      const end = isCur ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(year, month, dim);
      let we = 0, weN = 0, weHits = 0, wd = 0, wdN = 0, wdHits = 0;
      for (let k = 0; k < 56; k++) {
        const dt = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k);
        const v = dayTot(dt);
        const isWe = dt.getDay() === 0 || dt.getDay() === 6;
        if (isWe) { we += v; weN++; if (v > 0) weHits++; } else { wd += v; wdN++; if (v > 0) wdHits++; }
      }
      const weAvg = we / weN, wdAvg = wd / wdN;
      if (weHits >= 2 && wdHits >= 3 && wdAvg > 0) {
        const r = weAvg / wdAvg;
        if (r >= 1.5) {
          out.push({ key: "weekend", tone: "warn", icon: "weekend",
            text: <>You usually spend <B>{times(r)} more</B> per day on weekends ({fmt(weAvg)} vs {fmt(wdAvg)} on weekdays).</> });
        } else if (r <= 0.67) {
          out.push({ key: "weekend", tone: "good", icon: "weekend",
            text: <>Weekends are your lighter days: <B>{fmt(weAvg)}/day</B> vs {fmt(wdAvg)} on weekdays.</> });
        }
      }
    }

    // 5. under-limit streak (logged days, most recent first)
    if (isCur) {
      let streak = 0;
      for (let d = elapsed; d >= 1; d--) {
        const items = spending[keyOf(year, month, d)] || [];
        if (!items.length) continue;
        if (items.reduce((a, it) => a + it.amount, 0) > lim) break;
        streak++;
      }
      if (streak >= 3) {
        out.push({ key: "streak", tone: "good", icon: "local_fire_department",
          text: <>Your last <B>{streak} logged days</B> were all under the daily limit.</> });
      }
    }

    // 6. most frequent place this month
    {
      const map = {};
      for (let d = 1; d <= dim; d++) {
        (spending[keyOf(year, month, d)] || []).forEach((it) => {
          const raw = (it.desc || "").trim();
          if (!raw || it.zero) return;
          const k = canonKey(raw);
          if (!map[k]) map[k] = { n: 0, sum: 0 };
          map[k].n++; map[k].sum += it.amount;
        });
      }
      const top = Object.entries(map).sort((a, b) => b[1].n - a[1].n || b[1].sum - a[1].sum)[0];
      if (top && top[1].n >= 3) {
        out.push({ key: "freq", tone: "neutral", icon: "storefront",
          text: <><B>{prettyName(top[0])}</B> shows up {top[1].n} times this month, {fmt(top[1].sum)} in total.</> });
      }
    }

    // ---- per-day totals for the elapsed part of this month (used by several insights below)
    const days = [];
    for (let d = 1; d <= elapsed; d++) {
      const items = spending[keyOf(year, month, d)] || [];
      days.push({ d, items, total: items.reduce((a, it) => a + it.amount, 0), zero: items.some((it) => it.zero) });
    }
    const logged = days.filter((x) => x.items.length);

    // 7. same point last month
    {
      const pd = new Date(year, month - 1, 1), pdim = new Date(pd.getFullYear(), pd.getMonth() + 1, 0).getDate();
      let prevSoFar = 0;
      for (let d = 1; d <= Math.min(elapsed, pdim); d++) prevSoFar += dayTot(new Date(pd.getFullYear(), pd.getMonth(), d));
      const curSoFar = days.reduce((a, x) => a + x.total, 0);
      if (prevSoFar > 0) {
        const pct = Math.round(((curSoFar - prevSoFar) / prevSoFar) * 100);
        if (Math.abs(pct) >= 10) {
          const up = pct > 0;
          out.push({ key: "mom", tone: up ? "warn" : "good", icon: up ? "arrow_upward" : "arrow_downward",
            text: <>{isCur ? `By day ${elapsed}` : "This month"} you've spent <B>{fmt(Math.abs(curSoFar - prevSoFar))} {up ? "more" : "less"}</B> than {MONTHS_FULL[pd.getMonth()]} ({up ? "+" : "−"}{Math.abs(pct)}%).</> });
        }
      }
    }

    // 8. days over the daily limit
    {
      const over = logged.filter((x) => x.total > lim);
      if (over.length) {
        const worst = over.reduce((a, b) => (b.total > a.total ? b : a));
        out.push({ key: "over", tone: over.length >= logged.length / 2 ? "bad" : "warn", icon: "report",
          text: <><B>{over.length} day{over.length === 1 ? "" : "s"}</B> over your daily limit so far; the biggest was {dLabel(worst.d)} at {fmt(worst.total)}.</> });
      }
    }

    // 9. no-spend days
    {
      const z = days.filter((x) => x.zero && x.total === 0).length;
      if (z > 0) out.push({ key: "zero", tone: "good", icon: "do_not_disturb_on",
        text: <><B>{z} no-spend day{z === 1 ? "" : "s"}</B> this month, keeping {fmt(z * lim)} of your limit untouched.</> });
    }

    // 10. small purchases add up
    {
      const SMALL = 25000;
      const small = logged.flatMap((x) => x.items).filter((it) => !it.zero && it.amount < SMALL);
      const sum = small.reduce((a, it) => a + it.amount, 0);
      if (small.length >= 8 && cur.total > 0) out.push({ key: "small", tone: "neutral", icon: "local_cafe",
        text: <>{small.length} small buys under {fmt(SMALL)} added up to <B>{fmt(sum)}</B>, {Math.round((sum / cur.total) * 100)}% of this month's spending.</> });
    }

    // 11. priciest weekday over the last 8 weeks
    {
      const end = isCur ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(year, month, dim);
      const sum = Array(7).fill(0), cnt = Array(7).fill(0);
      for (let k = 0; k < 56; k++) {
        const dt = new Date(end.getFullYear(), end.getMonth(), end.getDate() - k);
        const i = (dt.getDay() + 6) % 7; sum[i] += dayTot(dt); cnt[i]++;
      }
      const avg = sum.map((v, i) => v / (cnt[i] || 1)), overall = sum.reduce((a, b) => a + b, 0) / 56;
      let top = 0; for (let i = 1; i < 5; i++) if (avg[i] > avg[top]) top = i;   // Mon–Fri only; weekends have their own insight
      if (overall > 0 && avg[top] / overall >= 1.3) out.push({ key: "dow", tone: "neutral", icon: "calendar_month",
        text: <><B>{["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays"][top]}</B> are your priciest weekday, averaging {fmt(avg[top])} ({times(avg[top] / overall)} your usual day).</> });
    }

    // 12. biggest single purchase
    {
      let big = null;
      logged.forEach((x) => x.items.forEach((it) => { if (!it.zero && (!big || it.amount > big.amount)) big = { ...it, d: x.d }; }));
      if (big && big.amount >= lim) out.push({ key: "big", tone: "neutral", icon: "shopping_bag",
        text: <>Biggest purchase: <B>{big.desc ? prettyName(canonKey(big.desc)) : "an unlabelled expense"}</B>, {fmt(big.amount)} on {dLabel(big.d)}.</> });
    }

    // 13. average daily spend vs the limit
    if (logged.length >= 3) {
      const avg = logged.reduce((a, x) => a + x.total, 0) / logged.length;
      const pct = Math.round((avg / lim) * 100);
      out.push({ key: "avg", tone: pct > 100 ? "warn" : "good", icon: "speed",
        text: <>You average <B>{fmt(avg)} a day</B>, {pct}% of your {fmt(lim)} limit.</> });
    }

    // 14. category share of the month
    {
      const top = CAT_ORDER.map((c) => [c, cur.t[c]]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 0 && cur.total > 0) {
        const share = Math.round((top[1] / cur.total) * 100);
        if (share >= 35) out.push({ key: "share", tone: "neutral", icon: CATS[top[0]].icon,
          text: <><B>{CATS[top[0]].label}</B> makes up {share}% of this month's spending ({fmt(top[1])}).</> });
      }
    }

    // 15. goal forecasts: when each active goal will be reached at its usual monthly pace
    {
      const c0 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const cutoff = keyOf(c0.getFullYear(), c0.getMonth(), 1);
      const eta = [];
      goals.forEach((g) => {
        const saved = Math.max(0, (g.deposits || []).reduce((a, d) => a + d.amount, 0));
        if (!g.target || saved >= g.target) return;
        const byMonth = {};
        (g.deposits || []).forEach((d) => { if (d.date >= cutoff) byMonth[d.date.slice(0, 7)] = (byMonth[d.date.slice(0, 7)] || 0) + d.amount; });
        const months = Object.values(byMonth);
        if (months.length < 2) return;
        const pace = months.reduce((a, b) => a + b, 0) / 6;       // average over the last 6 months, gaps included
        if (pace <= 0) return;
        const n = Math.ceil((g.target - saved) / pace);
        const when = new Date(now.getFullYear(), now.getMonth() + n, 1);
        eta.push({ g, n, when });
      });
      eta.sort((a, b) => a.n - b.n).slice(0, 2).forEach(({ g, n, when }) => out.push({ key: `eta-${g.id}`, tone: n <= 12 ? "good" : "neutral", icon: "flag",
        text: <>At your usual pace, <B>{g.name}</B> will be fully funded around <B>{MONTHS_FULL[when.getMonth()]} {when.getFullYear()}</B>{n > 24 ? `, about ${Math.round(n / 12)} years away` : ""}.</> }));
    }

    const order = { bad: 0, warn: 1, good: 2, neutral: 3 };
    return out.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [spending, incomes, limits, aiCats, year, month, currency, goals, dayTick]);

  const catBreakdown = useMemo(() => {
    if (!catView) return { rows: [], total: 0 };
    const map = {};
    if (catView === "left") {
      // what is left of the month's income, split into what went into each goal this month and what is still free.
      // The money in the goals is part of what is left over, not on top of it
      const left = Math.max(0, totalIncome - stats.spent);
      const mS = keyOf(year, month, 1), mE = keyOf(year, month, daysInMonth);
      const rows = [];
      goals.forEach((g) => {
        const a = (g.deposits || []).filter((d) => d.date >= mS && d.date <= mE).reduce((x, d) => x + d.amount, 0);
        if (a > 0) rows.push({ key: g.id, label: g.name, amount: a, icon: goalIconOf(g) });
      });
      rows.sort((a, b) => b.amount - a.amount);
      const inGoals = rows.reduce((x, r) => x + r.amount, 0);
      const free = Math.max(0, left - inGoals);
      if (free > 0) rows.push({ key: "__free__", label: "Not in a goal", amount: free, color: "#8a9299", icon: "account_balance_wallet" });
      const total = Math.max(left, inGoals);
      const pv = new Date(year, month - 1, 1), pvy = pv.getFullYear(), pvm = pv.getMonth();
      let prevSp = 0;
      for (let d = 1, n = new Date(pvy, pvm + 1, 0).getDate(); d <= n; d++) (spending[keyOf(pvy, pvm, d)] || []).forEach((it) => { prevSp += it.amount; });
      const prevLeft = (incomes[monthKeyOf(pvy, pvm)] || []).reduce((x, it) => x + it.amount, 0) - prevSp;
      return { rows, total, inGoals, free, vsPct: prevLeft > 0 ? ((left - prevLeft) / prevLeft) * 100 : null };
    }
    if (catView === "income") {
      monthIncomes.forEach((it) => {
        const raw = (it.desc || "").trim();
        const key = canonKey(raw);
        if (!map[key]) map[key] = { label: prettyName(key === "__none__" ? "" : key), amount: 0 };
        map[key].amount += it.amount;
      });
    } else {
      for (let d = 1; d <= daysInMonth; d++) {
        const items = spending[keyOf(year, month, d)] || [];
        items.forEach((it) => {
          const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
          if (it.zero || (c in CATS ? c : "other") !== catView) return;
          const raw = (it.desc || "").trim();
          const key = canonKey(raw);
          if (!map[key]) map[key] = { label: prettyName(key === "__none__" ? "" : key), amount: 0 };
          map[key].amount += it.amount;
        });
      }
    }
    const rows = Object.values(map).sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    // same category, previous month
    const pd = new Date(year, month - 1, 1), py = pd.getFullYear(), pm = pd.getMonth();
    let prevTotal = 0;
    if (catView === "income") {
      prevTotal = (incomes[monthKeyOf(py, pm)] || []).reduce((s, it) => s + it.amount, 0);
    } else {
      const pdim = new Date(py, pm + 1, 0).getDate();
      for (let d = 1; d <= pdim; d++) {
        (spending[keyOf(py, pm, d)] || []).forEach((it) => {
          const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other";
          if ((c in CATS ? c : "other") === catView) prevTotal += it.amount;
        });
      }
    }
    const vsPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
    return { rows, total, vsPct };
  }, [catView, spending, incomes, year, month, daysInMonth, aiCats, goals, aiGoalIcons, totalIncome, stats.spent]);

  const closeCatView = () => {
    setCatViewClosing(true);
    setTimeout(() => { setCatView(null); setCatViewClosing(false); }, 190);
  };

  // measure the list so the modal can animate its height between categories
  const bdRef = useRef(null);
  const [bdHeight, setBdHeight] = useState("auto");
  useLayoutEffect(() => {
    if (!catView || !bdRef.current) return;
    const h = bdRef.current.offsetHeight;   // not the drawn box: the pop-up is still scaled down while it comes in
    setBdHeight(`${h}px`);
  }, [catView, catBreakdown]);

  const renderFlow = () => {
    const nodes = CAT_ORDER.filter((c) => flowTotals[c] > 0).map((c) => ({
      key: c, label: CATS[c].label, icon: CATS[c].icon, value: flowTotals[c], color: CAT_COLORS[c],
    }));
    const leftOver = totalIncome - stats.spent;
    if (leftOver > 0 && totalIncome > 0) {
      nodes.push({ key: "left", label: "Left over", icon: "savings", value: leftOver, color: CAT_COLORS.left });
    }
    if (nodes.length === 0) {
      return <div style={S.flowEmpty}>No expenses recorded yet this month.</div>;
    }

    const total = nodes.reduce((s, n) => s + n.value, 0);
    // PITCH: the room one label takes. The bars are GAP apart and their middles, where the labels sit, at least PITCH
    // apart, so the labels of small categories never lie on each other (the chart grows taller instead)
    const GAP = 14, PT = 18, PB = 18, PITCH = 30;
    const W = 720, xL = 92, barW = 11, xR = 470;
    const inner = nodes.length * 44 - (nodes.length - 1) * 10;
    let yR = PT, yL = PT, mid = -1e9;
    const rows = nodes.map((n) => {
      const h = Math.max(6, (n.value / total) * inner);
      mid = Math.max(yR + h / 2, mid + PITCH);
      const r = { ...n, hR: h, yR: mid - h / 2, yL, hL: h };
      yR = mid + h / 2 + GAP;
      yL += h;
      return r;
    });
    const leftH = yL - PT;
    const H = Math.max(yL, yR - GAP) + PB;
    // when each row's ribbon sets off: the income bar eases out as 1 − (1 − t)³, so its fill is at a share f of its
    // height after 1 − ∛(1 − f) of its time; and when that ribbon's front reaches the expense bar
    rows.forEach((r) => { r.t0 = Math.round(FLOW_START_MS + FLOW_SRC_MS * (1 - Math.cbrt(1 - (r.yL - PT) / leftH))); r.t1 = Math.round(r.t0 + FLOW_RIB_MS * FLOW_LAND); });

    const ribbon = (y0, y1, y2, y3) => {
      const mx = (xL + barW + xR) / 2;
      const x1 = xL + barW;
      return `M ${x1} ${y0} C ${mx} ${y0}, ${mx} ${y2}, ${xR} ${y2} L ${xR} ${y3} C ${mx} ${y3}, ${mx} ${y1}, ${x1} ${y1} Z`;
    };

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <defs>
          {rows.map((r) => (
            <Fragment key={r.key}>
              {/* each ribbon is uncovered from the left by a sweep of its own */}
              <clipPath id={`fw-${r.key}`}>
                <rect className="flow-wipe-rect" style={{ animationDelay: `${r.t0}ms` }} x={xL + barW} y="0" width={xR - xL - barW} height={H} />
              </clipPath>
              <linearGradient id={`fg-${r.key}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={r.color} stopOpacity="0.30" />
                <stop offset="100%" stopColor={r.color} stopOpacity="0.72" />
              </linearGradient>
            </Fragment>
          ))}
        </defs>

        {/* source bar */}
        <rect className="flow-src" x={xL} y={PT} width={barW} height={leftH} rx={5} fill="#8a9299" opacity="0.75" />
        <foreignObject x={xL - 190} y={PT + leftH / 2 - 20} width="182" height="42">
          {/* the label is only as wide as its text (pushed to the right end of its slot), so the highlight under the
              pointer is a whole rounded box. As wide as the slot, it ran out past the card's edge and was cut off there */}
          <div xmlns="http://www.w3.org/1999/xhtml" className="flow-tag src" style={{ display: "flex", justifyContent: "flex-end" }}>
            <div className={totalIncome > 0 ? "flow-label" : ""}
                 onClick={totalIncome > 0 ? () => setCatView("income") : undefined}
                 style={{ fontFamily: "Inter, sans-serif", textAlign: "right", padding: "4px 7px", borderRadius: 7,
                          cursor: totalIncome > 0 ? "pointer" : "default" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e8eaec" }}>{totalIncome > 0 ? "Income" : "Spent"}</div>
              <div style={{ fontSize: 12, color: "#8a9299", fontVariantNumeric: "tabular-nums" }}>
                {fmt(totalIncome > 0 ? totalIncome : stats.spent)}
              </div>
            </div>
          </div>
        </foreignObject>

        {/* ribbons: each sets off as the income bar's fill reaches it, and sweeps across */}
        {rows.map((r) => (
          <path key={r.key} className="flow-rib" style={{ animationDelay: `${r.t0}ms` }} clipPath={`url(#fw-${r.key})`}
                d={ribbon(r.yL, r.yL + r.hL, r.yR, r.yR + r.hR)} fill={`url(#fg-${r.key})`} />
        ))}

        {/* expense bars land as their ribbon's front arrives, their labels just after */}
        {rows.map((r) => (
          <g key={r.key}>
            <rect className="flow-bar" style={{ animationDelay: `${r.t1}ms` }} x={xR} y={r.yR} width={barW} height={r.hR} rx={5} fill={r.color} />
            <foreignObject x={xR + 18} y={r.yR + r.hR / 2 - 14} width="260" height="30">
              <div xmlns="http://www.w3.org/1999/xhtml" className="flow-tag" style={{ animationDelay: `${r.t1 + 70}ms` }}>
                <div className="flow-label"
                     onClick={() => setCatView(r.key)}
                     style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif",
                              padding: "3px 7px", borderRadius: 7, cursor: "pointer" }}>
                  <span className="msym" style={{ fontSize: 18, color: r.color }}>{r.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e8eaec" }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: "#8a9299", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(r.value)} · {Math.round((r.value / total) * 100)}%
                  </span>
                </div>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    );
  };

  /* ---------- money efficiency score ---------- */
  const scoreFor = (y, m) => {
    const dim = new Date(y, m + 1, 0).getDate();
    const lim = limits[monthKeyOf(y, m)] || DEFAULT_LIMIT;
    let spent = 0, green = 0, red = 0;
    const days = [];
    for (let d = 1; d <= dim; d++) {
      const items = spending[keyOf(y, m, d)];
      if (!items || items.length === 0) continue;
      const sp = items.reduce((s, it) => s + it.amount, 0);
      spent += sp; days.push(sp);
      if (sp <= lim) green++; else red++;
    }
    if (days.length === 0) return null;
    const inc = (incomes[monthKeyOf(y, m)] || []).reduce((s, it) => s + it.amount, 0);
    const savings = inc > 0 ? Math.max(0, Math.min(1, (inc - spent) / inc)) : 0;
    const disc = green / (green + red);
    const mean = spent / days.length;
    const sd = Math.sqrt(days.reduce((s, v) => s + (v - mean) ** 2, 0) / days.length);
    const cv = mean > 0 ? Math.min(1, sd / mean) : 1;
    const discPts = disc * 35;
    const savingsPts = inc > 0 ? (Math.min(savings, 0.5) / 0.5) * 40 : (disc * 40);
    const consPts = (1 - cv) * 25;
    return {
      score: Math.round(savingsPts + discPts + consPts),
      savings, disc, cv, spent, inc, green, red, days: days.length, lim, mean, sd,
    };
  };
  const scoreNow = useMemo(() => scoreFor(year, month), [spending, incomes, limits, year, month]);
  // Savings-rate bands (soft palette, red → green)
  const scoreBand = (pct) =>
    pct <= 15 ? { word: "Awful", color: "#e2808c" } :
    pct <= 35 ? { word: "Moderate", color: "#e9a173" } :
    pct <= 50 ? { word: "Balanced", color: "#e3cd77" } :
    pct <= 60 ? { word: "Good", color: "#b6d886" } :
    pct <= 75 ? { word: "Great", color: "#8fd7a4" } :
    pct <= 90 ? { word: "Excellent", color: "#74cf9b" } :
                { word: "Exceptional", color: "#e6c877", star: true };

  // Trend badge: this month's savings rate vs the average of the last 3 months with data
  const savingsTrend = useMemo(() => {
    const hist = [];
    for (let k = 1; k <= 6 && hist.length < 3; k++) {
      let m = month - k, y = year;
      while (m < 0) { m += 12; y -= 1; }
      const st = scoreFor(y, m);
      if (st && st.inc > 0) hist.push(st.savings * 100);
    }
    if (hist.length === 0) return null;
    return hist.reduce((a, b) => a + b, 0) / hist.length;
  }, [spending, incomes, limits, year, month]);

  // Previous month's leftover (income - spent) in Rp, for the vs-last-month box
  const prevMonthSaved = useMemo(() => {
    let m = month - 1, y = year;
    if (m < 0) { m = 11; y -= 1; }
    const st = scoreFor(y, m);
    if (!st || (st.inc === 0 && st.spent === 0)) return null;
    return st.inc - st.spent;
  }, [spending, incomes, limits, year, month]);

  const trendOf = (pct) => {
    if (savingsTrend === null) return { text: "NEW", color: "#8a9299", delta: null };
    const diff = pct - savingsTrend;
    if (diff >= 3) return { text: "IMPROVING", color: "#8fd7a4", delta: diff };
    if (diff <= -3) return { text: "DECLINING", color: "#e2808c", delta: diff };
    return { text: "STABLE", color: "#b6d886", delta: diff };
  };

  const consistencyOf = (cv) =>
    cv > 0.8 ? { word: "ERRATIC", color: "#e2808c" } :
    cv > 0.6 ? { word: "INCONSISTENT", color: "#e9a173" } :
    cv > 0.4 ? { word: "VARIABLE", color: "#e3cd77" } :
    cv > 0.22 ? { word: "CONSISTENT", color: "#b6d886" } :
                { word: "STEADY", color: "#8fd7a4" };

  const renderScore = () => {
    if (!scoreNow) return null;
    const hasInc = scoreNow.inc > 0;
    const savePct = hasInc ? Math.max(0, Math.round(scoreNow.savings * 100)) : 0;
    const band = hasInc ? scoreBand(savePct) : { word: "No income", color: "#8a9299" };
    const cond = hasInc ? trendOf(savePct) : { text: "NO INCOME", color: "#8a9299", delta: null };
    const cons = consistencyOf(scoreNow.cv);

    const R = 52, C = 2 * Math.PI * R, ARC = C * (300 / 360);
    const filled = ARC * (Math.max(0, Math.min(100, savePct)) / 100);

    const summary = hasInc
      ? `You kept ${savePct}% of this month's income, stayed under the ${fmt(scoreNow.lim)} limit on ${scoreNow.green} of ${scoreNow.days} logged days, and day-to-day spending looks ${cons.word.toLowerCase()}.`
      : `No income logged this month yet. You stayed under the ${fmt(scoreNow.lim)} limit on ${scoreNow.green} of ${scoreNow.days} logged days, and day-to-day spending looks ${cons.word.toLowerCase()}.`;

    const discPct = Math.round(scoreNow.disc * 100);
    const discColor = "#e3cd77";
    const consPct = Math.round((1 - Math.min(1, scoreNow.cv)) * 100);
    const boxes = [
      (() => {
        const thisSaved = scoreNow.inc - scoreNow.spent;
        if (prevMonthSaved === null) {
          return { label: "VS LAST MONTH", value: "N/A", pct: 0, color: "#8a9299" };
        }
        const diff = thisSaved - prevMonthSaved;
        const base = Math.max(Math.abs(prevMonthSaved), Math.abs(thisSaved), 1);
        const relPct = prevMonthSaved !== 0 ? Math.round((diff / Math.abs(prevMonthSaved)) * 100) : null;
        return {
          label: "VS LAST MONTH",
          value: `${diff >= 0 ? "+" : "-"}${fmt(Math.abs(diff))}`,
          note: relPct !== null ? `${relPct >= 0 ? "+" : ""}${relPct}%` : null,
          pct: Math.round((Math.abs(diff) / base) * 100),
          color: diff >= 0 ? "#8fd7a4" : "#e2808c",
        };
      })(),
      { label: "LIMIT DISCIPLINE", value: `${scoreNow.green}/${scoreNow.days}`, pct: discPct, color: discColor },
      { label: "CONSISTENCY", value: cons.word, pct: consPct, color: cons.color },
    ];

    return (
      <div className="score-card" style={S.scoreCard}>
        <div key={`gauge-${year}-${month}-${savePct}`} className="score-dial" style={{ position: "relative", width: 216, height: 216, flexShrink: 0, "--gc": band.color }}>
          <svg viewBox="0 0 132 132" style={{ width: 216, height: 216, transform: "rotate(120deg)" }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#e2808c" />
                <stop offset="45%" stopColor={savePct > 35 ? "#e3cd77" : "#e9a173"} />
                <stop offset="100%" stopColor={band.color} />
              </linearGradient>
            </defs>
            <circle cx="66" cy="66" r={R} fill="none" stroke="#33373b" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={`${ARC} ${C}`} />
            <circle className="score-arc" cx="66" cy="66" r={R} fill="none" stroke="url(#scoreGrad)" strokeWidth="11"
                    strokeLinecap="round" strokeDasharray={`${filled} ${C}`} />
          </svg>
          <div style={S.scoreCenter}>
            <div className="score-hit" title="How this score is worked out" onClick={() => setScoreView("open")}>
              <div style={S.scoreNum}>{hasInc ? `${savePct}` : "—"}</div>
              <div style={S.scoreCap}>SCORE</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...S.scoreWord, color: band.color }}>
              {band.star ? "★ " : ""}{band.word}
            </span>
            <span title={cond.delta !== null && cond.delta !== undefined
                          ? `${cond.delta >= 0 ? "+" : ""}${cond.delta.toFixed(1)} pts vs recent months`
                          : "No earlier months to compare"}
                  style={{ ...S.scorePill, color: cond.color, background: "rgba(255,255,255,0.05)", border: `1px solid ${cond.color}44` }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: cond.color, display: "inline-block", marginRight: 7 }} />
              {cond.text}
            </span>
          </div>
          <div style={S.scoreLabel}>MONEY EFFICIENCY</div>
          <p style={S.scoreText}>{summary}</p>
        </div>

        <div className="score-orbit" style={S.subRow}>
          {boxes.map((b, bi) => (
            <div key={b.label} className="sub-box glass-soft" style={{ ...S.subBox, "--tc": b.color, animationDelay: `${260 + bi * 90}ms` }}>
              <div style={S.subLabel}><i style={{ display: "inline-block", width: 6, height: 6, borderRadius: 99, background: b.color, marginRight: 7, verticalAlign: "1px" }} />{b.label}</div>
              <div style={{ ...S.subValue, color: b.color, fontSize: b.label === "CONSISTENCY" || b.label === "VS LAST MONTH" ? 18 : 22, display: "flex", alignItems: "baseline", gap: 7 }}>
                {b.value}
                {b.note && <span style={S.subNote}>{b.note}</span>}
              </div>
              <div style={S.subTrack}>
                <span className="bd-fill" style={{ width: `${Math.max(2, Math.min(100, b.pct))}%`, background: b.color, animationDelay: `${340 + bi * 90}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ---------- how the score is worked out (the number in the ring, pressed) ----------
     Every figure the score card shows, with the sum behind it. Only the first part makes the number itself. */
  const closeScoreView = () => { setScoreView("closing"); setTimeout(() => setScoreView(null), 190); };
  const renderScoreInfo = () => {
    if (!scoreNow) return null;
    const closing = scoreView === "closing";
    const st = scoreNow, hasInc = st.inc > 0;
    const kept = st.inc - st.spent;
    const savePct = hasInc ? Math.max(0, Math.round(st.savings * 100)) : 0;
    const band = hasInc ? scoreBand(savePct) : { word: "No income", color: "#8a9299" };
    const cond = hasInc ? trendOf(savePct) : { text: "NO INCOME", color: "#8a9299", delta: null };
    const cons = consistencyOf(st.cv);
    const pts = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)} pts`;
    const BANDS = [[0, 15], [16, 35], [36, 50], [51, 60], [61, 75], [76, 90], [91, 100]];
    const CONS = [["Steady", "up to 22%", 0.1], ["Consistent", "22–40%", 0.3], ["Variable", "40–60%", 0.5], ["Inconsistent", "60–80%", 0.7], ["Erratic", "over 80%", 0.9]];
    const head = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", color: "#6d757d", margin: "16px 0 7px" };
    const row = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, fontSize: 13.5, color: "#aab1b8", padding: "3px 0" };
    const val = { fontWeight: 600, color: "#e8eaec", fontVariantNumeric: "tabular-nums", textAlign: "right" };
    const sum = { ...row, marginTop: 4, paddingTop: 7, borderTop: "1px solid #33373b" };
    const note = { fontSize: 12, color: "#747c84", lineHeight: 1.5, margin: "6px 0 0" };
    const chips = { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 };
    const chip = (on, color) => ({ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 8, fontVariantNumeric: "tabular-nums",
      color: on ? color : "#6d757d", background: on ? "rgba(255,255,255,0.06)" : "none", border: `1px solid ${on ? color : "#33373b"}` });
    const Row = (label, value, color) => (
      <div style={row}><span>{label}</span><span style={color ? { ...val, color } : val}>{value}</span></div>
    );
    return (
      <div style={{ ...S.backdrop, animation: closing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={closeScoreView}>
        <div className="glass" style={{ ...S.modal, width: "min(520px, 94vw)", maxHeight: "90vh", overflowY: "auto", animation: closing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }}
             onClick={(e) => e.stopPropagation()}>
          <div style={S.modalHead}>
            <span style={{ ...S.panelTitle, display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span className="msym" style={{ fontSize: 20, color: band.color }}>speed</span>
              How the score is worked out
            </span>
            <button className="x-btn" style={S.closeBtn} onClick={closeScoreView}>✕</button>
          </div>

          <div style={{ ...head, marginTop: 2 }}>THE SCORE · {MONTHS_FULL[month].toUpperCase()} {year}</div>
          {Row("Income", fmt(st.inc))}
          {Row("Spent", `− ${fmt(st.spent)}`)}
          <div style={sum}><span>Kept</span><span style={{ ...val, color: kept >= 0 ? "#8fd7a4" : "#e2808c" }}>{kept < 0 ? "− " : ""}{fmt(Math.abs(kept))}</span></div>
          {hasInc
            ? <div style={row}><span>Kept ÷ income = {fmt(Math.abs(kept))} ÷ {fmt(st.inc)}</span><span style={{ ...val, fontSize: 20, fontWeight: 800, color: band.color }}>{savePct}</span></div>
            : <p style={note}>No income is logged this month, so there is no score yet.</p>}
          <p style={note}>The score is the share of the month's income you kept, from 0 to 100. Spending more than you earned gives 0. Money put into a goal is not spending, so it counts as kept.</p>
          <div style={chips}>
            {BANDS.map(([lo, hi]) => { const b = scoreBand(hi), on = hasInc && savePct >= lo && savePct <= hi;
              return <span key={lo} style={chip(on, b.color)}>{lo}–{hi} {b.word}</span>; })}
          </div>

          <div style={head}>TREND · <span style={{ color: cond.color }}>{cond.text}</span></div>
          {Row("This month", hasInc ? `${savePct}` : "—")}
          {Row("Average of the last months with income (3 at most)", savingsTrend === null ? "none yet" : savingsTrend.toFixed(1))}
          {cond.delta !== null && cond.delta !== undefined && <div style={sum}><span>Difference</span><span style={{ ...val, color: cond.color }}>{pts(cond.delta)}</span></div>}
          <p style={note}>3 points or more above the average is Improving, 3 or more below is Declining, in between is Stable.</p>

          <div style={head}>VS LAST MONTH</div>
          {Row("Kept this month", `${kept < 0 ? "− " : ""}${fmt(Math.abs(kept))}`)}
          {Row("Kept last month", prevMonthSaved === null ? "nothing logged" : `${prevMonthSaved < 0 ? "− " : ""}${fmt(Math.abs(prevMonthSaved))}`)}
          {prevMonthSaved !== null && <div style={sum}><span>Difference</span>
            <span style={{ ...val, color: kept - prevMonthSaved >= 0 ? "#8fd7a4" : "#e2808c" }}>{kept - prevMonthSaved >= 0 ? "+ " : "− "}{fmt(Math.abs(kept - prevMonthSaved))}</span></div>}

          <div style={head}>LIMIT DISCIPLINE</div>
          {Row("Daily limit", fmt(st.lim))}
          {Row("Days with spending logged", st.days)}
          {Row("At or under the limit", st.green, "#8fd7a4")}
          {Row("Over the limit", st.red, st.red ? "#e2808c" : undefined)}
          <div style={sum}><span>{st.green} ÷ {st.days}</span><span style={{ ...val, color: "#e3cd77" }}>{Math.round(st.disc * 100)}%</span></div>

          <div style={head}>CONSISTENCY · <span style={{ color: cons.color }}>{cons.word}</span></div>
          {Row("Average spent on a logged day", fmt(Math.round(st.mean)))}
          {Row("Usual swing from that average", `± ${fmt(Math.round(st.sd))}`)}
          <div style={sum}><span>Swing ÷ average</span><span style={{ ...val, color: cons.color }}>{Math.round(st.sd / (st.mean || 1) * 100)}%</span></div>
          <div style={chips}>
            {CONS.map(([w, range, mid]) => { const c = consistencyOf(mid), on = c.word === cons.word;
              return <span key={w} style={chip(on, c.color)}>{w} {range}</span>; })}
          </div>
          <p style={note}>Trend, last month, limit discipline and consistency are shown beside the score. They don't change the number.</p>
        </div>
      </div>
    );
  };

  /* ---------- month-end projection (money flow, between the efficiency score and the insights) ----------
     Only for the month we are in: how much will be left on its last day (projectMonth, above). */
  const projHour = now.getHours();
  const projection = useMemo(() => {
    if (view !== "month" || !isCurrentMonth) return null;
    const catOf = (it) => { const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other"; return c in CATS ? c : "other"; };
    return projectMonth({ spending, incomes, limits, y: now.getFullYear(), m: now.getMonth(), d: now.getDate(), hour: projHour, catOf });
  }, [spending, incomes, limits, aiCats, view, isCurrentMonth, dayTick, projHour]);

  // how it did at this same point of the three months before: each is worked out again from only what was entered by
  // that day, and set against how the month's spending really ended
  const projRecord = useMemo(() => {
    if (!projection) return [];
    const catOf = (it) => { const c = it.cat || inferCat(it.desc) || aiCats[it.id] || "other"; return c in CATS ? c : "other"; };
    const out = [];
    for (let k = 1; k <= 3; k++) {
      const first = new Date(now.getFullYear(), now.getMonth() - k, 1), yy = first.getFullYear(), mm = first.getMonth();
      const dimK = new Date(yy, mm + 1, 0).getDate(), cutD = Math.min(now.getDate(), dimK), last = keyOf(yy, mm, cutD), mk = monthKeyOf(yy, mm);
      let actual = 0;
      for (let dd = 1; dd <= dimK; dd++) (spending[keyOf(yy, mm, dd)] || []).forEach((it) => { if (!it.zero && it.amount > 0) actual += it.amount; });
      if (!actual || cutD >= dimK) continue;
      const sp = {}, inc = {};
      Object.keys(spending).forEach((key) => { if (key <= last) sp[key] = spending[key]; });
      Object.keys(incomes).forEach((key) => { if (key < mk) inc[key] = incomes[key]; else if (key === mk) inc[key] = incomes[key].filter((it) => (it.day || 1) <= cutD); });
      const r = projectMonth({ spending: sp, incomes: inc, limits, y: yy, m: mm, d: cutD, hour: 24, catOf });
      if (r) out.push({ name: MONTHS_SHORT[mm], off: Math.abs(r.endSpend - actual) / actual });
    }
    return out;
  }, [projection]);

  const renderProjection = () => {
    if (!isCurrentMonth) return null;
    const p = projection;
    const head = (right) => (
      <div className="proj-head">
        <span className="msym" style={{ fontSize: 18, color: "#c7cdd2" }}>query_stats</span>
        <span style={S.insTitle}>Projection</span>
        <span style={{ flex: 1 }} />
        {right && <span style={S.flowSub}>{right}</span>}
      </div>
    );
    if (!p) {
      return (
        <div className="proj-box">
          {head()}
          <div style={{ ...S.insEmpty, padding: "2px 2px 6px" }}>Not enough data yet. A projection appears once five days of spending are logged.</div>
        </div>
      );
    }
    const end = `${p.dim} ${MONTHS_SHORT[month]}`;
    const hasInc = p.endIncome > 0;
    const good = p.endLeft >= 0;
    // the likely range: four times in five the month ends inside it
    const band = 1.28 * p.sd;
    const lo = hasInc ? p.endLeft - band : p.endSpend - band, hi = hasInc ? p.endLeft + band : p.endSpend + band;
    const names = (list) => list.map((b) => prettyName(b.desc || b.key)).join(", ");
    const tone = !hasInc ? "#e8eaec" : good ? "#3ddc97" : "#ff5d6c";
    // what each empty day could cost and the month still end on zero, once the bills, the big buys and what is
    // already written are set aside
    const room = hasInc && p.openDays > 0 ? Math.max(0, (p.endLeft + p.everyday - p.todayMore) / p.openDays) : null;
    const tiles = [
      { label: "WEEKDAYS", value: fmt(p.weekday), unit: "/ day", note: p.nWd ? `${p.nWd} still to come` : "none left this month",
        tip: "What a weekday usually costs you, read from the last 12 weeks. Recent days count more." },
      { label: "WEEKENDS", value: fmt(p.weekend), unit: "/ day", note: p.nWe ? `${p.nWe} still to come` : "none left this month",
        tip: "What a Saturday or Sunday usually costs you, read the same way." },
    ];
    if (room !== null) tiles.push({ label: "ROOM A DAY", value: fmt(room), unit: "/ day", note: room > 0 ? "and the month ends on zero" : "none: the month is short as it is", color: room > 0 ? undefined : "#ff8d97",
      tip: "What each of the empty days still to come could cost with the month ending on exactly zero, after the bills due, the big buys expected and what is already entered." });
    if (p.billsDue.length) tiles.push({ label: "BILLS DUE", value: fmt(p.billSum), note: names(p.billsDue),
      tip: "Bills that come back every month and aren't paid yet this month: " + p.billsDue.map((b) => `${prettyName(b.desc || b.key)} ${fmt(b.amount)}, around ${b.day} ${MONTHS_SHORT[month]}`).join(" · ") });
    if (p.big >= 1000) tiles.push({ label: "BIG BUYS", value: `≈ ${fmt(p.big)}`, note: p.bigMonths >= 4 ? `${p.bigNow} made, about ${p.bigMore.toFixed(1).replace(".0", "")} more` : `about ${p.bigPerMonth >= 1.5 ? Math.round(p.bigPerMonth) : "1"} a month`,
      tip: `One-off buys of ${fmt(p.bigFrom)} or more follow no weekday. You make about ${p.bigPerMonth.toFixed(1).replace(".0", "")} a month at ${fmt(p.bigEach)} each, read from the last year. ${p.bigMonths >= 4 ? `Going by how many each of the last ${p.bigMonths} months had and the ${p.bigNow} made so far this month, about ${p.bigMore.toFixed(1)} more should come.` : "The days left carry this much of them."}` });
    if (p.planned > 0) tiles.push({ label: "ALREADY ENTERED", value: fmt(p.planned), note: `on ${p.daysLeft - p.openDays} later day${p.daysLeft - p.openDays === 1 ? "" : "s"}`,
      tip: "Expenses already written on later days of this month. Those days are taken as written; only the empty days are projected." });
    if (p.paySum > 0) tiles.push({ label: "INCOME DUE", value: `+${fmt(p.paySum)}`, note: names(p.payDue).replace(/No description/g, "Income"), color: "#8fd7a4",
      tip: "Income that comes every month and hasn't arrived yet. It is counted in what will be left." });
    return (
      <div className="proj-box">
        {head(p.daysLeft === 0 ? "last day of the month" : `${p.daysLeft} day${p.daysLeft === 1 ? "" : "s"} left`)}
        <div className="proj-main">
          <span className="proj-num" style={{ color: !hasInc ? "#e8eaec" : good ? "#3ddc97" : "#ff5d6c" }}>
            <CountNum value={hasInc ? Math.abs(p.endLeft) : p.endSpend} duration={620} render={fmtLive} />
          </span>
          <span className="proj-cap">{hasInc ? (good ? `left on ${end}` : `short on ${end}`) : `spent by ${end}`}</span>
          <span style={{ flex: 1 }} />
          {band >= 1000 && (
            <span className="proj-range" title="Four times in five the month should end inside this range">
              likely {hasInc && hi < 0 ? `${fmt(-hi)} to ${fmt(-lo)} short` : `${fmt(lo)} to ${fmt(hi)}`}
            </span>
          )}
        </div>
        <ProjChart p={p} tone={tone} hasInc={hasInc} band={band} fmt={fmt} monthName={MONTHS_SHORT[month]} />
        <div className="proj-legend">
          <span><i className="done" />Spent so far <b>{fmt(p.spent)}</b></span>
          <span><i className="todo" />Still to come <b>{fmt(p.toCome)}</b></span>
          {band >= 1000 && <span><i className="cone" style={{ background: tone }} />Likely range</span>}
          {p.billsDue.length > 0 && <span><i className="bill" />Bill due</span>}
        </div>
        <div className="proj-tiles">
          {tiles.map((t, i) => (
            <div key={t.label} className="sub-box glass-soft proj-tile" title={t.tip} style={{ animationDelay: `${300 + i * 70}ms` }}>
              <div style={S.subLabel}>{t.label}</div>
              <div className="proj-tile-val" style={t.color ? { color: t.color } : undefined}>{t.value}{t.unit && <span>{t.unit}</span>}</div>
              <div className="proj-tile-note">{t.note}</div>
            </div>
          ))}
        </div>
        {projRecord.length > 0 && (
          <div className="proj-rec" title="The projection worked out again as it would have stood on this day of each earlier month, from only what was entered by then, against how that month's spending really ended.">
            <span className="msym">history</span>
            <span>On the {nth(now.getDate())} of earlier months it landed {projRecord.map((r, i) => <Fragment key={r.name}>{i > 0 && " · "}<b>{Math.round(r.off * 100)}%</b>{i === 0 && " off"} in {r.name}</Fragment>)}</span>
          </div>
        )}
      </div>
    );
  };

  // Esc closes whichever pop-up is on top
  useEffect(() => {
    if (!cfgDraft && !catView && !chartOpen && !scoreView) return;
    const onKey = (e) => {
      if (e.key !== "Escape" || recap) return;
      if (cfgDraft) closeTestCfg();
      else if (scoreView) closeScoreView();
      else if (catView) closeCatView();
      else if (chartOpen) closeChart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfgDraft, catView, chartOpen, recap, scoreView]);

  /* ---------- test-data settings pop-up ---------- */
  /* ---------- recap modal ---------- */
  const renderRecapDetail = (r, signed) => {
    const isYear = r.kind === "year";
    const unitWord = isYear ? "months" : "days";
    const key = recapDetail || "";
    let title = "", icon = "list", acc = "#9aa3ab", body = null, controls = null;

    if (key.startsWith("cat")) {
      const big = key.startsWith("catbig:");
      const c = key.split(":")[1];
      acc = CAT_COLORS[c]; icon = CATS[c].icon;
      title = big ? `Biggest ${CATS[c].label.toLowerCase()} purchases` : `Top ${CATS[c].label.toLowerCase()} spending`;
      controls = (
        <div className="wr-chips">
          {r.catRows.map((cr) => (
            <button key={cr.c} className={`wr-chip${cr.c === c ? " on" : ""}`} style={{ "--acc": CAT_COLORS[cr.c] }}
                    onClick={() => setRecapDetail(`${big ? "catbig" : "cat"}:${cr.c}`)}>
              <span className="msym" style={{ fontSize: 15 }}>{CATS[cr.c].icon}</span>{CATS[cr.c].label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span className="wr-seg">
            <button className={!big ? "on" : ""} onClick={() => setRecapDetail(`cat:${c}`)}>By item</button>
            <button className={big ? "on" : ""} onClick={() => setRecapDetail(`catbig:${c}`)}>Single purchases</button>
          </span>
        </div>
      );
      if (big) {
        const rows = r.txs.filter((t) => t.cat === c).sort((a, b) => b.amount - a.amount).slice(0, 10);
        const max = rows[0]?.amount || 1;
        body = <WrList dkey={key} color={acc} emptyText="Nothing in this category." rows={rows.map((t) => ({ label: t.name, value: fmt(t.amount), sub: t.when, frac: t.amount / max }))} />;
      } else {
        const rows = (r.catItemLists[c] || []).slice(0, 10);
        const max = rows[0]?.sum || 1;
        const tot = r.catRows.find((x) => x.c === c)?.v || 1;
        body = <WrList dkey={key} color={acc} emptyText="Nothing in this category." rows={rows.map((it) => ({ label: it.name, value: fmt(it.sum), sub: `${it.n}× · ${Math.round((it.sum / tot) * 100)}%`, frac: it.sum / max }))} />;
      }
    } else if (key === "income") {
      acc = "#3ddc97"; icon = "payments"; title = "Top income sources";
      const rows = r.srcList.slice(0, 10), max = rows[0]?.v || 1;
      body = <WrList dkey={key} color="#3ddc97" emptyText="No income logged." rows={rows.map((sr) => ({ label: sr.name, value: fmt(sr.v), valColor: "#8fd7a4", sub: `${sr.n}× · ${Math.round((sr.v / (r.incTot || 1)) * 100)}%`, frac: sr.v / max }))} />;
    } else if (key === "regular") {
      acc = "#b89cff"; icon = "storefront"; title = "Most frequent purchases";
      const rows = r.placeList.slice(0, 10), max = rows[0]?.n || 1;
      body = <WrList dkey={key} emptyText="No purchases with descriptions yet." rows={rows.map((pl) => ({ label: pl.name, value: `${pl.n}×`, valColor: "#cdbdff", sub: fmt(pl.sum), frac: pl.n / max, color: CAT_COLORS[pl.cat] }))} />;
    } else if (key === "rank") {
      acc = "#7fb6e0"; icon = "leaderboard"; title = `Best & worst ${unitWord}`;
      const top = r.ranked.slice(0, 5), bottom = [...r.ranked].reverse().slice(0, 5);
      const max = Math.max(1, ...r.ranked.map((u) => Math.abs(u.value)));
      const toRows = (arr) => arr.map((u) => ({ label: isYear ? u.label : `${u.label} ${MONTHS_SHORT[r.m]}`, value: signed(u.value),
        valColor: u.value >= 0 ? "#8fd7a4" : "#e2808c", frac: Math.abs(u.value) / max, color: u.value >= 0 ? "#3ddc97" : "#ff5d6c",
        sub: isYear ? `in ${fmt(u.inc)} · out ${fmt(u.sp)}` : `spent ${fmt(u.sp)}` }));
      body = (
        <div className="wr-two">
          <div><div style={{ ...S.wrLabel, color: "#8fd7a4" }}>Top 5 best</div><WrList dkey={key} rows={toRows(top)} emptyText="—" /></div>
          <div><div style={{ ...S.wrLabel, color: "#e2808c" }}>Top 5 worst</div><WrList dkey={key} rows={toRows(bottom)} emptyText="—" /></div>
        </div>
      );
    }
    return (
      <div className="wr-detail" style={{ "--acc": acc }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ ...S.wrLabel, marginBottom: 0, color: "#c7cdd2" }}><span className="msym wr-ico">{icon}</span>{title}</span>
          <button className="x-btn" style={{ ...S.closeBtn, width: 26, height: 26 }} onClick={() => setRecapDetailOpen(false)}>✕</button>
        </div>
        {controls}
        {body}
      </div>
    );
  };

  const renderRecap = () => {
    const r = recapData;
    if (!r) return null;
    const isYear = r.kind === "year";
    const unitWord = isYear ? "month" : "day";
    const signed = (n, b, sp) => `${n >= 0 ? "+" : "−"}${fmtLive(Math.abs(n), b, sp && { from: Math.abs(sp.from), to: Math.abs(sp.to) })}`;
    const title = isYear ? `${r.y}` : `${MONTHS_FULL[r.m]} ${r.y}`;
    const kept = r.incTot > 0 ? Math.round(((r.incTot - r.spentTot) / r.incTot) * 100) : null;
    const underPct = r.logged ? Math.round((r.under / r.logged) * 100) : 0;
    const maxAbs = Math.max(1, ...r.units.filter((u) => u.has).map((u) => Math.abs(u.value)));
    const topCat = r.catRows[0];
    const catTotal = r.catRows.reduce((a, c) => a + c.v, 0) || 1;
    const group = (k) => (k && k.startsWith("cat") ? "cat" : k);
    const openGroup = recapDetailOpen ? group(recapDetail) : null;
    let tileN = 0;
    const tile = (cls, acc, detail, extra) => ({
      className: `wr-tile ${cls}${detail ? " clickable" : ""}${detail && openGroup === group(detail) ? " active" : ""}`,
      style: { "--acc": acc, animationDelay: `${120 + (tileN++) * 70}ms`, ...extra },
      ...(detail ? { onClick: () => toggleRecapDetail(detail), title: "Show top 10" } : {}),
    });
    const RING_R = 30, RING_C = 2 * Math.PI * RING_R;
    const hov = recapHover !== null ? r.units[recapHover] : null;

    return (
      <div style={{ ...S.backdrop, zIndex: 60, animation: recapClosing ? "fadeOut .22s ease both" : "fadeIn .22s ease backwards" }} onClick={closeRecap}>
        <div className="glass wr-modal" onClick={(e) => e.stopPropagation()}
             style={{ animation: recapClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .45s var(--ease) backwards" }}>
          <div style={S.modalHead}>
            <span style={S.wrKicker}>
              <span className="msym" style={{ fontSize: 17, color: "#e6c877" }}>auto_awesome</span>
              <span className="px-word">{isYear ? "YEARLY" : "MONTHLY"} WRAPPED</span>
            </span>
            <button className="x-btn" style={S.closeBtn} onClick={closeRecap}>✕</button>
          </div>

          {r.empty ? (
            <div className="wr-tile wr-hero" style={{ "--acc": "#6d757d", minHeight: 220, animationDelay: "100ms" }}>
              <div style={S.wrLabel}>{title}</div>
              <div style={{ ...S.wrHeroNum, fontSize: 40, color: "#6d757d" }}>Nothing logged yet</div>
              <div style={S.wrHeroSub}>Add some expenses or income for this {isYear ? "year" : "month"} and your recap will fill in.</div>
            </div>
          ) : (
            <>
            <div className="wr-grid">
              {/* hero */}
              <div {...tile("wr-hero", r.total >= 0 ? "#3ddc97" : "#ff5d6c", null)}>
                <div style={S.wrLabel}>{title}</div>
                <div className="wr-hero-num" style={{ ...S.wrHeroNum,
                     backgroundImage: r.total >= 0 ? "linear-gradient(100deg, #ffffff 10%, #9ff2cb 55%, #3ddc97)" : "linear-gradient(100deg, #ffffff 10%, #ffb3ba 55%, #ff5d6c)" }}>
                  <CountNum value={r.total} duration={900} render={signed} />
                </div>
                <div style={S.wrHeroSub}>
                  {isYear ? "Net for the year (income − expenses)" : "PnL for the month against your daily limit"}
                  {kept !== null && <><br /><span style={{ color: "#e8eaec" }}>You kept <b>{Math.max(0, kept)}%</b> of the {fmt(r.incTot)} you earned.</span></>}
                </div>
                <div className="wr-bars" onMouseLeave={() => setRecapHover(null)}>
                  {hov && (
                    <div className="wr-bar-tip" style={{ left: `${Math.min(88, Math.max(12, ((recapHover + 0.5) / r.units.length) * 100))}%` }}>
                      <span style={{ color: "#8a9299", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        {isYear ? hov.label : `${hov.label} ${MONTHS_SHORT[r.m]}`}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: !hov.has ? "#6d757d" : hov.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                        {hov.has ? `${hov.value >= 0 ? "+" : "−"}${fmt(Math.abs(hov.value))}` : "No data"}
                      </span>
                    </div>
                  )}
                  {r.units.map((u, k) => {
                    const h = u.has ? Math.max(4, (Math.abs(u.value) / maxAbs) * 100) : 4;
                    const dim = recapHover !== null && recapHover !== k;
                    return (
                      <div key={k} className="wr-bar-col" style={{ opacity: dim ? 0.4 : 1 }} onMouseEnter={() => setRecapHover(k)}>
                        <div className="wr-bar-half">
                          {u.has && u.value >= 0 && <span className="wr-bar up" style={{ height: `${h}%`, animationDelay: `${420 + k * (isYear ? 45 : 14)}ms` }} />}
                        </div>
                        <div className="wr-bar-half down">
                          {u.has && u.value < 0 && <span className="wr-bar dn" style={{ height: `${h}%`, animationDelay: `${420 + k * (isYear ? 45 : 14)}ms` }} />}
                          {!u.has && <span className="wr-bar none" />}
                        </div>
                        {(isYear || u.i === 1 || u.i % 5 === 0) && <span className="wr-bar-lbl">{isYear ? u.short.slice(0, 1) : u.short}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* best / worst */}
              <div {...tile("", "#3ddc97", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">north_east</span>Best {unitWord}</div>
                <div style={S.wrBig}>{r.best.label}</div>
                {!isYear && <div style={S.wrSmall}>{r.best.sub}</div>}
                <div style={{ ...S.wrValue, color: r.best.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                  <CountNum value={r.best.value} duration={800} render={signed} />
                </div>
                <span className="msym wr-more">arrow_outward</span>
              </div>
              <div {...tile("", "#ff5d6c", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">south_east</span>Worst {unitWord}</div>
                {r.worst ? (
                  <>
                    <div style={S.wrBig}>{r.worst.label}</div>
                    {!isYear && <div style={S.wrSmall}>{r.worst.sub}</div>}
                    <div style={{ ...S.wrValue, color: r.worst.value >= 0 ? "#8fd7a4" : "#e2808c" }}>
                      <CountNum value={r.worst.value} duration={800} render={signed} />
                    </div>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>N/A</div>}
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* average / discipline */}
              <div {...tile("", "#7fb6e0", "rank")}>
                <div style={S.wrLabel}><span className="msym wr-ico">equalizer</span>Avg {isYear ? "monthly" : "daily"} PnL</div>
                <div style={{ ...S.wrBig, color: r.avg >= 0 ? "#e8eaec" : "#e2808c" }}>
                  <CountNum value={r.avg} duration={800} render={signed} />
                </div>
                <div style={S.wrSmall}>across {r.active} active {unitWord}{r.active === 1 ? "" : "s"}</div>
                <span className="msym wr-more">arrow_outward</span>
              </div>
              <div {...tile("wr-row", "#e3cd77", null)}>
                <svg width="74" height="74" viewBox="0 0 74 74" style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
                  <circle cx="37" cy="37" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                  <circle className="wr-ring" cx="37" cy="37" r={RING_R} fill="none" stroke="#e3cd77" strokeWidth="7" strokeLinecap="round"
                          strokeDasharray={RING_C} style={{ "--ring-off": RING_C * (1 - underPct / 100), "--ring-c": RING_C }} />
                </svg>
                <div>
                  <div style={S.wrLabel}>Limit discipline</div>
                  <div style={S.wrBig}><CountNum value={underPct} duration={800} render={(n) => `${Math.round(n)}%`} /></div>
                  <div style={S.wrSmall}>{r.under} of {r.logged} logged days under the limit</div>
                </div>
              </div>

              {/* biggest expense category */}
              <div {...tile("wr-wide", topCat ? CAT_COLORS[topCat.c] : "#6d757d", topCat ? `cat:${topCat.c}` : null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">local_fire_department</span>Biggest expense</div>
                {topCat ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
                      <span className="wr-cat-ico" style={{ color: CAT_COLORS[topCat.c], background: `${CAT_COLORS[topCat.c]}22` }}>
                        <span className="msym" style={{ fontSize: 24 }}>{CATS[topCat.c].icon}</span>
                      </span>
                      <div>
                        <div style={S.wrBig}>{CATS[topCat.c].label}</div>
                        <div style={S.wrSmall}>
                          <b style={{ color: "#e8eaec" }}>{fmt(topCat.v)}</b> · {Math.round((topCat.v / catTotal) * 100)}% of all spending
                        </div>
                      </div>
                    </div>
                    <div className="wr-stack">
                      {r.catRows.map((c, k) => (
                        <span key={c.c} className="wr-stack-seg"
                              onClick={(e) => { e.stopPropagation(); if (recapDetailOpen && recapDetail === `cat:${c.c}`) setRecapDetailOpen(false); else toggleRecapDetail(`cat:${c.c}`); }}
                              style={{ width: `${(c.v / catTotal) * 100}%`, background: CAT_COLORS[c.c], animationDelay: `${520 + k * 80}ms` }} />
                      ))}
                    </div>
                    <div style={S.wrLegend}>
                      {r.catRows.map((c) => (
                        <span key={c.c} className="wr-leg" onClick={(e) => { e.stopPropagation(); setRecapDetail(`cat:${c.c}`); if (!recapDetailOpen) toggleRecapDetail(`cat:${c.c}`); }}>
                          <i style={{ background: CAT_COLORS[c.c] }} />{CATS[c.c].label} {Math.round((c.v / catTotal) * 100)}%
                        </span>
                      ))}
                    </div>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>No expenses</div>}
                <span className="msym wr-more">arrow_outward</span>
              </div>

              {/* best income source */}
              <div {...tile("", "#3ddc97", r.src ? "income" : null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">payments</span>Top income source</div>
                {r.src ? (
                  <>
                    <div style={S.wrBig}>{r.src.name}</div>
                    <div style={{ ...S.wrValue, color: "#8fd7a4" }}><CountNum value={r.src.v} duration={800} render={fmtLive} /></div>
                    <div style={S.wrSmall}>{Math.round((r.src.v / (r.incTot || 1)) * 100)}% of income</div>
                    <span className="msym wr-more">arrow_outward</span>
                  </>
                ) : <div style={{ ...S.wrBig, color: "#6d757d" }}>No income</div>}
              </div>

              {/* most visited */}
              <div {...tile("", "#b89cff", r.placeList.length ? "regular" : null)}>
                <div style={S.wrLabel}><span className="msym wr-ico">storefront</span>Your regular</div>
                {r.place ? (
                  <>
                    <div style={S.wrBig}>{r.place.name}</div>
                    <div style={{ ...S.wrValue, color: "#cdbdff" }}>{r.place.n}×</div>
                    <div style={S.wrSmall}>{fmt(r.place.sum)} in total</div>
                  </>
                ) : (
                  <>
                    <div style={S.wrBig}>{r.tx}</div>
                    <div style={S.wrSmall}>transactions logged</div>
                  </>
                )}
                {r.placeList.length > 0 && <span className="msym wr-more">arrow_outward</span>}
              </div>
            </div>

            {/* top-10 panel that opens under the grid */}
            <div ref={recapDetailRef} style={{ display: "grid", gridTemplateRows: recapDetailOpen ? "1fr" : "0fr",
                 transition: "grid-template-rows .38s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={S.fold}>
                <div style={{ paddingTop: 12, opacity: recapDetailOpen ? 1 : 0, transform: recapDetailOpen ? "none" : "translateY(-10px)",
                              transition: "opacity .28s ease, transform .32s cubic-bezier(0.22,1,0.36,1)" }}>
                  {recapDetail && renderRecapDetail(r, (v) => `${v >= 0 ? "+" : "−"}${fmt(Math.abs(v))}`)}
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- insights drop-down (inside money flow) ---------- */
  const TONE = { bad: "#e2808c", warn: "#e3cd77", good: "#8fd7a4", neutral: "#9aa3ab" };
  const toggleIns = () => {
    if (insOpen) {
      setInsClosing(true);
      setTimeout(() => { setInsOpen(false); setInsClosing(false); }, 300);
    } else { setInsOpen(true); setInsRun((n) => n + 1); }
  };
  // the three that matter most stay on show; the rest wait behind "View all". What decides: a budget or income that is
  // short, days over the limit, a category that jumped, a goal's date, then the month against the last one
  const insRank = (it) => {
    const k = it.key.startsWith("cat-") ? "cat" : it.key.startsWith("eta-") ? "eta" : it.key;
    const bad = it.tone === "bad" || it.tone === "warn";
    return k === "budget" ? (bad ? 0 : 6) : k === "income" ? 1 : k === "over" ? 2 : k === "cat" ? (bad ? 3 : 8) : k === "eta" ? 4
      : k === "mom" ? 5 : k === "avg" ? 7 : k === "weekend" ? 9 : k === "streak" ? 10 : 20;
  };
  const insRow = (it, i) => (
    <div key={it.key} className="ins-row" style={{ animationDelay: `${60 + i * 55}ms` }}>
      <span className="ins-ico" style={{ color: TONE[it.tone], background: `${TONE[it.tone]}1f` }}>
        <span className="msym" style={{ fontSize: 17 }}>{it.icon}</span>
      </span>
      <span style={S.insText}>{it.text}</span>
    </div>
  );
  const renderInsights = () => {
    // one of a kind among the three (one category, one goal), so they say three different things
    const seen = {}, main = [];
    [...insights].sort((x, y) => insRank(x) - insRank(y)).forEach((it) => {
      const kind = it.key === "income" ? "budget" : it.key.split("-")[0];
      if (main.length < 3 && !seen[kind]) { seen[kind] = 1; main.push(it); }
    });
    const rest = insights.filter((it) => !main.includes(it));
    const shown = insOpen && !insClosing;
    return (
      <div className="ins-box">
        <div className="ins-head">
          <span className="msym" style={{ fontSize: 18, color: "#c7cdd2" }}>lightbulb</span>
          <span style={S.insTitle}>Insights</span>
        </div>
        <div key={`ins-main-${year}-${month}`}>
          {insights.length === 0
            ? <div style={S.insEmpty}>Not enough data yet. Insights appear once you've logged a few days.</div>
            : main.map(insRow)}
        </div>
        {rest.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateRows: shown ? "1fr" : "0fr", transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={S.fold}>
                {insOpen && (
                  <div key={`ins-${insRun}-${year}-${month}`} style={{ opacity: insClosing ? 0 : 1, transform: insClosing ? "translateY(-10px)" : "none",
                       transition: "opacity .24s ease, transform .28s cubic-bezier(0.4,0,0.2,1)" }}>
                    {rest.map(insRow)}
                  </div>
                )}
              </div>
            </div>
            <button className="ins-more" onClick={toggleIns}>
              {shown ? "Show fewer" : `View all ${insights.length} insights`}
              <span className={`plain-arrow chev${shown ? " up" : ""}`}><Chevron /></span>
            </button>
          </>
        )}
      </div>
    );
  };

  /* ---------- goals ---------- */
  const renderGoals = () => {
    const mStart = keyOf(year, month, 1), mEnd = keyOf(year, month, daysInMonth);
    const isDone = (g) => g.target > 0 && goalSaved(g) >= g.target;
    const active = goals.filter((g) => !isDone(g)), completed = goals.filter(isDone);
    // the month a goal is on pace for: its average over the last 6 months, gaps included (as the insight reckons it)
    const pc0 = new Date(now.getFullYear(), now.getMonth() - 5, 1), paceCut = keyOf(pc0.getFullYear(), pc0.getMonth(), 1);
    const goalPace = (g, saved) => {
      if (!g.target || saved >= g.target) return null;
      const byMonth = {};
      (g.deposits || []).forEach((d) => { if (d.date >= paceCut) byMonth[d.date.slice(0, 7)] = (byMonth[d.date.slice(0, 7)] || 0) + d.amount; });
      const months = Object.values(byMonth), pace = months.reduce((a, b) => a + b, 0) / 6;
      if (months.length < 2 || pace <= 0) return null;
      const n = Math.ceil((g.target - saved) / pace);
      return { n, pace, need: (g.target - saved) / 12, when: new Date(now.getFullYear(), now.getMonth() + n, 1) };
    };
    const renderGoalRow = (g, gi, list) => {
          const saved = goalSaved(g);
          const eta = goalPace(g, saved);
          const pct = g.target > 0 ? (saved / g.target) * 100 : 0;
          const done = pct >= 100;
          const thisMonth = (g.deposits || []).filter((d) => d.date >= mStart && d.date <= mEnd).reduce((a, d) => a + d.amount, 0);
          const open = fundGoal === g.id;
          return (
            <div key={g.id} className={`goal-row${goalLeaving === g.id ? " leaving" : ""}`}
                 style={{ animationDelay: `${gi * 60}ms`, position: "relative", zIndex: goalIconMenu === g.id ? 20 : "auto" }}>
              <GoalRing pct={pct} delay={120 + gi * 60} color={done ? "#e6c877" : eta && eta.n <= 12 ? "#8fd7a4" : eta ? "#8fa3b8" : "#6d7780"}>
                <CountNum value={Math.floor(Math.min(999, pct))} duration={600} render={(n) => `${Math.round(n)}%`} />
              </GoalRing>
              <div style={S.goalTop}>
                <span style={{ ...S.goalName, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="goal-sym-wrap">
                    <button className={`goal-sym${goalIconMenu === g.id ? " open" : ""}`} title="Choose an icon"
                            onClick={() => setGoalIconMenu(goalIconMenu === g.id ? null : g.id)}>
                      <span key={goalIconOf(g)} className="msym goal-sym-ico" style={{ color: done ? "#8fd7a4" : undefined }}>{goalIconOf(g)}</span>
                    </button>
                    {goalIconMenu === g.id && (
                      <div className={`goal-sym-pop glass${gi >= 2 && gi >= list.length - 2 ? " up" : ""}`}>
                        <button className={`goal-sym-opt auto${!g.icon ? " on" : ""}`} title="Auto: pick from the goal's name" onClick={() => setGoalIcon(g.id, null)}>
                          <span className="msym" style={{ fontSize: 18 }}>auto_awesome</span><span>Auto</span>
                        </button>
                        {GOAL_ICONS.map((ic) => (
                          <button key={ic} className={`goal-sym-opt${g.icon === ic ? " on" : ""}`} onClick={() => setGoalIcon(g.id, ic)}>
                            <span className="msym" style={{ fontSize: 19 }}>{ic}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </span>
                  {editingGoal === g.id ? (
                    <input className="goal-name-input" value={editGoalName} autoFocus
                           style={{ width: `${Math.max(6, editGoalName.length + 1)}ch` }}
                           onChange={(e) => setEditGoalName(e.target.value)}
                           onBlur={commitRename}
                           onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingGoal(null); }} />
                  ) : (
                    <span className={`goal-name-text${done ? " done" : ""}`} title="Click to rename" onClick={() => startRename(g)}>{g.name}</span>
                  )}
                  {done && <span className="msym" style={{ fontSize: 15, color: "#e6c877", marginLeft: -2 }}>check_circle</span>}
                  {eta && <span className="tag-pill" style={{ "--tc": eta.n <= 12 ? "#8fd7a4" : "#8fa3b8" }}>{eta.n <= 12 ? "ON TRACK" : "SLOW"}</span>}
                  {thisMonth !== 0 && (
                    <span style={{ ...S.goalNote, color: thisMonth > 0 ? "#8fd7a4" : "#e2808c" }}>
                      {thisMonth > 0 ? "+" : "−"}{fmt(Math.abs(thisMonth))} in {MONTHS_SHORT[month]}
                    </span>
                  )}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <button className="goal-icon-btn" title={open ? "Close" : "Add or withdraw funds"}
                          onClick={() => { setFundGoal(open ? null : g.id); setFundAmt(""); }}>
                    <span className="msym" style={{ fontSize: 18, transform: open ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
                  </button>
                  <button className="trash-btn" style={{ ...S.delBtn, marginLeft: 2 }} title="Delete goal" onClick={() => deleteGoal(g.id)}><TrashIcon /></button>
                </span>
              </div>
              <div className="goal-lines">
                <span className="goal-amt"><CountNum value={saved} duration={300} render={fmtLive} /> <span>of {fmt(g.target)}</span></span>
                <span className="goal-pred">
                  {done ? <b style={{ color: "#e6c877" }}>Fully funded</b>
                    : eta ? <>On pace for <b>{MONTHS_FULL[eta.when.getMonth()]} {eta.when.getFullYear()}</b> at about {fmt(Math.round(eta.pace))} a month{eta.n > 12 ? <> · <b>{fmt(Math.round(eta.need))}</b> a month would finish it in a year</> : ""}</>
                    : "No date yet: it needs deposits in two of the last six months"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .3s cubic-bezier(0.4,0,0.2,1)" }}>
                <div style={S.fold}>
                  <div style={{ ...S.goalFundRow, opacity: open ? 1 : 0, transition: "opacity .24s ease" }}>
                    <AmountField value={open ? fundAmt : ""} setValue={setFundAmt} accent="green" cur={cur} width={150}
                                 ghost={needsGhost(fundAmt)} allowDecimal={isMYR} onSubmit={() => moveGoalFunds(g.id, 1)} />
                    <button className="goal-io in" title="Add to goal" onClick={() => moveGoalFunds(g.id, 1)}>
                      <span className="msym">download</span>
                    </button>
                    <button className="goal-io out" title="Withdraw from goal" onClick={() => moveGoalFunds(g.id, -1)}>
                      <span className="msym">upload</span>
                    </button>
                    {!done && g.target > saved && <span style={S.goalNote}>{fmt(g.target - saved)} to go</span>}
                  </div>
                </div>
              </div>
            </div>
          );
    };
    return (
      <div style={{ paddingTop: 4 }}>
        {goals.length === 0 && !newGoalOpen && (
          <div style={S.insEmpty}>No goals yet. Add one, like an emergency fund, and track it across the year.</div>
        )}
        {active.map((g, gi) => renderGoalRow(g, gi, active))}

        {/* completed goals: tucked away above "New goal", revealed with the drop-down */}
        {completed.length > 0 && (
          <div className="goal-done-box">
            <button className="goal-done-head" onClick={toggleDone}>
              <span className="msym" style={{ fontSize: 17, color: "#8fd7a4" }}>task_alt</span>
              <span>Completed</span>
              <span className="goal-done-count">{completed.length}</span>
              <span style={{ flex: 1 }} />
              <span className={`plain-arrow chev${doneOpen ? " up" : ""}`}><Chevron /></span>
            </button>
            <div style={{ display: "grid", gridTemplateRows: doneOpen ? "1fr" : "0fr", transition: "grid-template-rows .34s cubic-bezier(0.4,0,0.2,1)" }}>
              <div style={{ overflow: goalIconMenu && completed.some((g) => g.id === goalIconMenu) ? "visible" : "hidden", minHeight: 0 }}>
                <div style={{ opacity: doneOpen ? 1 : 0, transform: doneOpen ? "none" : "translateY(-8px)", transition: "opacity .26s ease, transform .3s cubic-bezier(0.22,1,0.36,1)" }}>
                  {doneMounted && completed.map((g, gi) => renderGoalRow(g, gi, completed))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateRows: newGoalOpen ? "1fr" : "0fr", transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)" }}>
          <div style={S.fold}>
            <div style={{ ...S.goalFundRow, paddingTop: 12, opacity: newGoalOpen ? 1 : 0, transition: "opacity .24s ease" }}>
              <input style={{ ...S.darkInput, width: 190 }} placeholder="Goal, e.g. Emergency fund"
                     value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }} />
              <AmountField value={newGoalTarget} setValue={setNewGoalTarget} accent="green" cur={cur} width={150}
                           ghost={needsGhost(newGoalTarget)} allowDecimal={isMYR} onSubmit={addGoal} />
              <button className="goal-save" onClick={addGoal} title="Save goal" aria-label="Save goal">
                <span className="msym" style={{ fontSize: 22 }}>check</span>
              </button>
            </div>
          </div>
        </div>
        <button className="goal-new" onClick={() => setNewGoalOpen((v) => !v)}>
          <span className="msym" style={{ fontSize: 17, transform: newGoalOpen ? "rotate(45deg)" : "none", transition: "transform .3s cubic-bezier(0.34,1.3,0.64,1)" }}>add</span>
          {newGoalOpen ? "Cancel" : "New goal"}
        </button>
      </div>
    );
  };

  /* ---------- dot add/remove animation ---------- */
  const [dotGhosts, setDotGhosts] = useState({});
  const prevDots = useRef({});
  useEffect(() => {
    const next = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const k = keyOf(year, month, d);
      const inc = monthIncomes.filter((it) => it.day === d).length;
      const exp = (spending[k] || []).length;
      next[k] = [...Array(inc).fill("g"), ...Array(exp).fill("r")];
      const before = prevDots.current[k] || [];
      if (before.length > next[k].length) {
        const removed = before.slice(next[k].length);
        setDotGhosts((g) => ({ ...g, [k]: removed }));
        setTimeout(() => setDotGhosts((g) => { const c = { ...g }; delete c[k]; return c; }), 240);
      }
    }
    prevDots.current = next;
  }, [spending, incomes, year, month, daysInMonth]);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  /* ===================== CHART ===================== */
  const renderChart = (mode) => (
    <div style={{ position: "relative" }}>
      {renderChartSvg(mode)}
      {hoverPt && <GlassTip key={hoverPt.label} W={720} H={380} x={Math.min(Math.max(hoverPt.x, 64 + 64), 720 - 20 - 64)}
                            y={hoverPt.y} below={hoverPt.y < 24 + 62} label={hoverPt.label} value={hoverPt.value} />}
    </div>
  );
  const renderChartSvg = (mode) => {
    const isMonthMode = mode === "month";
    const N = isMonthMode ? cDays : 12;
    // the data marks are keyed by period, so stepping to another month / year redraws them and leaves the axes still
    const pk = isMonthMode ? `${cY}-${cM}` : `${cY}`;
    const W = 720, H = 380, PL = 64, PR = 20, PT = 24, PB = 44;
    const iw = W - PL - PR, ih = H - PT - PB;
    const X = isMonthMode ? (i) => PL + ((i + 1) / N) * iw : (i) => PL + ((i + 0.5) / N) * iw;
    const labelOf = (i) => (isMonthMode ? `${i + 1} ${MONTHS_SHORT[cM]}` : `${MONTHS_SHORT[i]} ${cY}`);
    const xTickEls = (isMonthMode
      ? Array.from({ length: Math.floor(N / 5) }, (_, k) => ({ x: PL + (((k + 1) * 5) / N) * iw, label: String((k + 1) * 5) }))
      : MONTHS_SHORT.map((nm, m) => ({ x: X(m), label: nm })));
    const Tooltip = ({ x, y, label, value }) => (
      <g className="ch-tip" pointerEvents="none">
        <line x1={x} y1={PT} x2={x} y2={PT + ih} stroke="#4a5055" strokeWidth="1" />
        <circle className="tip-dot" cx={x} cy={y} r="5" fill="#ffffff" />
      </g>
    );

    const GREY = "#6d757d";
    /* a segment is coloured when it joins consecutive days, grey when it bridges
       days with no entries; colours switch exactly at the data point */
    const colorStops = (pts, on, off) => {
      const o = (x) => Math.min(1, Math.max(0, (x - PL) / iw));
      const s = [];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], b = pts[k];
        const c = b.i - a.i > 1 ? off : on;
        s.push({ o: o(a.x), c }, { o: o(b.x), c });
      }
      return s;
    };
    const HGrad = ({ id, pts, on, off }) => (
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={PL} y1="0" x2={PL + iw} y2="0">
        {colorStops(pts, on, off).map((s, k) => <stop key={k} offset={s.o} stopColor={s.c} />)}
      </linearGradient>
    );

    if (chartMode === "both") {
      const net = [], has = [];
      for (let i = 0; i < N; i++) {
        let raw;
        if (isMonthMode) {
          const e = chart.exp[i], ic = chart.inc[i];
          raw = e === null && ic === null ? null : (ic || 0) - (e || 0);
        } else {
          const m = chartYearStats.months[i];
          raw = !m.hasData && m.income === 0 ? null : m.income - m.spent;
        }
        has.push(raw !== null);
        net.push(raw || 0);
      }
      const hasAny = has.some(Boolean);
      let run = 0;
      const pts = [];
      for (let i = 0; i < N; i++) { run += net[i]; if (has[i]) pts.push({ i, x: X(i), v: run }); }
      // the period compared with: its own running total
      const ghostOf = (c) => {
        let r = 0; const g = [];
        for (let i = 0; i < Math.min(N, c.exp.length); i++) {
          const e = c.exp[i], ic = c.inc[i];
          if (e !== null || ic !== null) { r += (ic || 0) - (e || 0); g.push({ x: X(i), v: r }); }
        }
        return g;
      };
      const ghost = cmpOn ? ghostOf(cmpOn) : [];
      const vals = [...pts, ...ghost].map((p) => p.v);
      const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
      const span = (maxV - minV) || 1;
      const Y = (v) => PT + ih - ((v - minV) / span) * ih;
      const zeroY = Y(0);
      pts.forEach((p) => { p.y = Y(p.v); });
      ghost.forEach((p) => { p.y = Y(p.v); });
      // start on the y-axis, a little short of the first point's value (see CHART_LEAD), so there's no gap before the 1st
      const full = pts.length ? [{ i: -1, x: PL, y: Y(pts[0].v * CHART_LEAD), v: pts[0].v * CHART_LEAD }, ...pts] : [];
      const linePath = smoothPath(full);
      const areaPath = full.length ? `${linePath} L ${full[full.length - 1].x} ${zeroY} L ${PL} ${zeroY} Z` : "";
      const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => minV + f * span);

      return (
        <svg key={`c-both-${mode}-${currency}`} className={chartAt && chartAt.dir ? "ch-moved" : undefined} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} onMouseLeave={() => setHoverPt(null)}>
          <defs>
            <linearGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ddc97" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#3ddc97" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="negFill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ff5d6c" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#ff5d6c" stopOpacity="0.06" />
            </linearGradient>
            <linearGradient id="greyPosFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREY} stopOpacity="0.34" />
              <stop offset="100%" stopColor={GREY} stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="greyNegFill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={GREY} stopOpacity="0.34" />
              <stop offset="100%" stopColor={GREY} stopOpacity="0.05" />
            </linearGradient>
            <HGrad id="pnlLineG" pts={full} on="#3ddc97" off={GREY} />
            <HGrad id="pnlLineR" pts={full} on="#ff5d6c" off={GREY} />
            <HGrad id="pnlMaskData" pts={full} on="#fff" off="#000" />
            <HGrad id="pnlMaskEmpty" pts={full} on="#000" off="#fff" />
            <mask id="pnlDataMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <rect x="0" y="0" width={W} height={H} fill="url(#pnlMaskData)" />
            </mask>
            <mask id="pnlEmptyMask" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <rect x="0" y="0" width={W} height={H} fill="url(#pnlMaskEmpty)" />
            </mask>
            <clipPath id="above"><rect className="ch-morph" x="0" y="0" width={W} height={zeroY} /></clipPath>
            <clipPath id="below"><rect className="ch-morph" x="0" y={zeroY} width={W} height={H - zeroY} /></clipPath>
          </defs>
          <line className="axis-y" x1={PL} y1={PT} x2={PL} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
          <line className="axis-x" x1={PL - 6} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
          {hasAny && yTicks.map((v, i) => (
            <g key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 30}ms` }}>
              <text x={PL - 10} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end"><CountNum value={v} duration={CMP_MS} render={fmtLive} still /></text>
              {Y(v) < PT + ih - 0.5 && <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#2c3034" strokeWidth="1" />}
            </g>
          ))}
          {xTickEls.map((t, i) => (
            <text key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 18}ms` }} x={t.x} y={PT + ih + 20} fill="#8a9299" fontSize="11" textAnchor="middle">{t.label}</text>
          ))}
          {!hasAny ? (
            <text x={PL + iw / 2} y={PT + ih / 2 + 14} fill="#4a5055" fontSize="44" fontWeight="800" textAnchor="middle">N/A</text>
          ) : (
            <Fragment key={pk}>
              {zeroY < PT + ih - 0.5 && <line className="ch-slide" x1={PL} y1="0" x2={W - PR} y2="0" style={{ transform: `translateY(${zeroY}px)` }} stroke="#6d757d" strokeWidth="1" strokeDasharray="3 4" />}
              {cmpOn && <GhostLine key={`g${cmpOn.label}`} pts={ghost} PL={PL} Y={Y} lead />}
              {cmpGone && <GhostLine key={`g${cmpGone.label}`} pts={ghostOf(cmpGone)} PL={PL} Y={Y} lead gone into={full} />}
              <g className="area-rise" style={{ transformOrigin: `0px ${zeroY}px` }}>
                <g mask="url(#pnlDataMask)">
                  <path className="ch-morph" d={areaPath} fill="url(#posFill)" clipPath="url(#above)" />
                  <path className="ch-morph" d={areaPath} fill="url(#negFill)" clipPath="url(#below)" />
                </g>
                <g mask="url(#pnlEmptyMask)">
                  <path className="ch-morph" d={areaPath} fill="url(#greyPosFill)" clipPath="url(#above)" />
                  <path className="ch-morph" d={areaPath} fill="url(#greyNegFill)" clipPath="url(#below)" />
                </g>
              </g>
              <path className="line-sweep slow ch-morph" pathLength="1" d={linePath} fill="none" stroke="url(#pnlLineG)" strokeWidth="2.6" strokeLinecap="round" clipPath="url(#above)" />
              <path className="line-sweep slow ch-morph" pathLength="1" d={linePath} fill="none" stroke="url(#pnlLineR)" strokeWidth="2.6" strokeLinecap="round" clipPath="url(#below)" />
              {(() => {
                const ci = isMonthMode ? cToday - 1 : (cY === now.getFullYear() ? now.getMonth() : -1);
                const p = pts.find((q) => q.i === ci);
                return p ? <circle className="axis-fade ch-morph" cx={p.x} cy={p.y} r="4" fill="#c7cdd2" /> : null;
              })()}
              {pts.map((p) => (
                <rect key={p.i} x={p.x - iw / N / 2} y={PT} width={iw / N} height={ih} fill="transparent" style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHoverPt({ x: p.x, y: p.y, label: labelOf(p.i), value: fmt(p.v) })}
                      onClick={() => chartGo(isMonthMode, p.i)} />
              ))}
              {hoverPt && <Tooltip key={hoverPt.label} {...hoverPt} />}
            </Fragment>
          )}
        </svg>
      );
    }

    const expVals = isMonthMode ? chart.exp : chartYearStats.months.map((m) => (m.hasData ? m.spent : null));
    const incVals = isMonthMode ? chart.inc : chartYearStats.months.map((m) => (m.income > 0 ? m.income : null));
    const showExp = chartMode === "expense";
    const showInc = chartMode === "income";
    const vals = showExp ? expVals : incVals;
    const hasAny = vals.some((v) => v !== null);
    const ghostVals = cmpOn ? (showExp ? cmpOn.exp : cmpOn.inc).slice(0, N) : [];      // the period compared with
    const maxVal = Math.max(1, ...vals.filter((v) => v !== null), ...ghostVals.filter((v) => v !== null), showExp && isMonthMode ? cLimit : 0) * 1.12;
    const Y = (v) => PT + ih - (v / maxVal) * ih;
    const pts = [];
    if (showExp) expVals.forEach((v, i) => { if (v !== null) pts.push({ i, x: X(i), y: Y(v), v }); });
    // start on the y-axis, a little short of the first point's value (see CHART_LEAD), so there's no gap before the 1st
    const expFull = pts.length ? [{ i: -1, x: PL, y: Y(pts[0].v * CHART_LEAD), v: pts[0].v * CHART_LEAD }, ...pts] : [];
    const expLine = smoothPath(expFull);
    const yTicks = [0.25, 0.5, 0.75, 1].map((f) => f * maxVal);
    const curIdx = isMonthMode ? cToday - 1 : (cY === now.getFullYear() ? now.getMonth() : -1);
    // income columns fill ~72% of their slot so they read as solid bars but never touch
    const barW = Math.max(6, (iw / N) * 0.72);
    // the biggest income of the period gets the lighter gradient
    const topInc = showInc ? Math.max(0, ...incVals.filter((v) => v !== null)) : 0;
    const tops = (list) => list.slice(0, N).map((v, i) => (v === null ? null : { x: X(i), y: Y(v), v })).filter(Boolean);

    return (
      <svg key={`c-${chartMode}-${mode}-${currency}`} className={chartAt && chartAt.dir ? "ch-moved" : undefined} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} onMouseLeave={() => setHoverPt(null)}>
        <line className="axis-y" x1={PL} y1={PT} x2={PL} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
        <line className="axis-x" x1={PL - 6} y1={PT + ih} x2={W - PR} y2={PT + ih} stroke="#e8eaec" strokeWidth="2" />
        {hasAny && yTicks.map((v, i) => (
          <g key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 30}ms` }}>
            <text x={PL - 10} y={Y(v) + 4} fill="#8a9299" fontSize="11" textAnchor="end"><CountNum value={v} duration={CMP_MS} render={fmtLive} still /></text>
            {Y(v) < PT + ih - 0.5 && <line x1={PL} y1={Y(v)} x2={W - PR} y2={Y(v)} stroke="#2c3034" strokeWidth="1" />}
          </g>
        ))}
        {xTickEls.map((t, i) => (
          <text key={i} className="axis-fade" style={{ animationDelay: `${60 + i * 18}ms` }} x={t.x} y={PT + ih + 20} fill="#8a9299" fontSize="11" textAnchor="middle">{t.label}</text>
        ))}
        {!hasAny ? (
          <text x={PL + iw / 2} y={PT + ih / 2 + 14} fill="#4a5055" fontSize="44" fontWeight="800" textAnchor="middle">N/A</text>
        ) : (
          <Fragment key={pk}>
            {cmpOn && <GhostLine key={`g${cmpOn.label}`} pts={tops(showExp ? cmpOn.exp : cmpOn.inc)} PL={PL} Y={Y} lead />}
            {cmpGone && <GhostLine key={`g${cmpGone.label}`} pts={tops(showExp ? cmpGone.exp : cmpGone.inc)} PL={PL} Y={Y} lead gone into={showExp ? expFull : tops(incVals)} />}
            {showInc && (
              <defs>
                {/* each bar runs from a light green at the top to a slightly deeper green at its base */}
                <linearGradient id="incBarG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6cecb4" /><stop offset="100%" stopColor="#2bbd82" />
                </linearGradient>
                <linearGradient id="incBarTopG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c4fae2" /><stop offset="100%" stopColor="#82ebbe" />
                </linearGradient>
              </defs>
            )}
            {showInc && incVals.map((v, i) => v !== null ? (
              <rect key={"i" + i} className="bar-grow ch-morph" style={{ animationDelay: `${120 + i * 18}ms`, cursor: "pointer" }}
                    x={X(i) - barW / 2} y={Y(v)} width={barW} height={PT + ih - Y(v)} rx={Math.min(6, barW / 4)}
                    fill={v === topInc ? "url(#incBarTopG)" : "url(#incBarG)"} opacity="0.92"
                    onMouseEnter={() => setHoverPt({ x: X(i), y: Y(v), label: labelOf(i), value: fmt(v) })}
                    onClick={() => chartGo(isMonthMode, i)} />
            ) : null)}
            {showExp && expFull.length > 1 && (
              <>
                <defs><HGrad id="expLineG" pts={expFull} on="#ff5d6c" off={GREY} /></defs>
                <path className="line-sweep slow ch-morph" pathLength="1" d={expLine} fill="none"
                      stroke="url(#expLineG)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {showExp && curIdx >= 0 && expVals[curIdx] !== null && (
              <circle className="axis-fade ch-morph" cx={X(curIdx)} cy={Y(expVals[curIdx])} r="4" fill="#c7cdd2" />
            )}
            {showExp && pts.map((p) => (
              <rect key={p.i} x={p.x - iw / N / 2} y={PT} width={iw / N} height={ih} fill="transparent" style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoverPt({ x: p.x, y: p.y, label: labelOf(p.i), value: fmt(p.v) })}
                    onClick={() => chartGo(isMonthMode, p.i)} />
            ))}
            {hoverPt && <Tooltip key={hoverPt.label} {...hoverPt} />}
          </Fragment>
        )}
      </svg>
    );
  };

  // called as a plain function ({ChartButton(...)}), never as <ChartButton />: a component defined in here would be remounted on every render
  const ChartButton = ({ title }) => (
    <button className="chart-btn" style={S.chartBtn} title={title} onClick={() => { setHoverPt(null); setChartAt({ y: year, m: month }); setChartOpen(true); }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect className="cb1" x="1" y="9" width="3" height="6" rx="1.5" fill="currentColor" />
        <rect className="cb2" x="6.5" y="5" width="3" height="10" rx="1.5" fill="currentColor" />
        <rect className="cb3" x="12" y="1" width="3" height="14" rx="1.5" fill="currentColor" />
      </svg>
    </button>
  );

  /* ---------- launch card (3D tilt + cursor light) ---------- */
  const cardRef = useRef(null);
  const targetTilt = useRef({ rx: 0, ry: 0 });
  const targetSpot = useRef({ x: 50, y: 50 });
  const [hoverCard, setHoverCard] = useState(false);
  const [phase, setPhase] = useState(1);   // 1 = wallet, 2 = card pulled out
  // until when a card is on its way out or back in: for that long the tilt is let go of and the pointer left alone,
  // so the pocket card and the big card lie flat when one takes over from the other
  const flyUntil = useRef(0), floatRef = useRef(null);
  // a card pressed while its wallet is still sliding into the middle is handed over late (cardCt: the usual point),
  // when the wallet has arrived and the two cards are on the same spot again
  const cardCt = useRef(0.55), cardLate = useRef(false), walletAt = useRef(0);
  const [picked, setPicked] = useState("platinum");
  const [activeWallet, setActiveWallet] = useState(HOME_WALLET);
  useLayoutEffect(() => { walletAt.current = performance.now(); }, [activeWallet]);
  // the wallet the selections panel shows, and the wallets panel opens on: the current year's at app start, then the
  // one of the year he came home from (he asked for the cards to follow the year: home from 2027 shows the 2027 wallet)
  const [homeWallet, setHomeWallet] = useState(HOME_WALLET);
  const [greetOn, setGreetOn] = useState(false);
  const [greetExit, setGreetExit] = useState(false);
  // selections panel, between the opening screen and the wallets: null = still choosing (the current-year wallet
  // and the trading coin, one in focus), "wallet" = the wallets panel, "markets" = the trading selection (the coin
  // for crypto, the IDX globe for Indonesian stocks), "trade" = on the way into one of the trading panels
  const [choice, setChoice] = useState(null);
  const picking = choice === null;
  const inMarkets = choice === "markets";
  const [pickFocus, setPickFocus] = useState("wallet");   // which of the two is in the middle of the selections panel: "wallet" or "coin"
  const [marketFocus, setMarketFocus] = useState("crypto");   // the same for the trading selection: "crypto" (the coin) or "idx" (the globe)
  const [tradeKind, setTradeKind] = useState("crypto");       // which trading panel was entered
  const coinFocused = (picking && pickFocus === "coin") || (inMarkets && marketFocus === "crypto");
  const globeFocused = inMarkets && marketFocus === "idx";
  const [hoverGlobe, setHoverGlobe] = useState(false);
  const [globeLive, setGlobeLive] = useState(false);      // the 3D globe is set up and has taken over from the flat logo
  const [hoverCoin, setHoverCoin] = useState(false);
  const [tradeIn, setTradeIn] = useState(false);       // the stage backdrop fading away over the trading panel

  /* Tilt + cursor light are written straight to CSS variables (--rx, --ry, --sx, --sy) on <html>.
     No React state is touched, so the app never re-renders for this, and the loop stops once settled. */
  const launchRef = useRef(null);
  const walletExp = (w) => (w ? `12-${String((now.getFullYear() + (w.year || 0)) % 100).padStart(2, "0")}` : "");
  const tiltCur = useRef({ rx: 0, ry: 0, sx: 50, sy: 50 });
  const tiltRaf = useRef(0);
  // written straight onto the few elements that move; nothing inherited, so the other card faces never repaint
  const phaseRef = useRef(1), hoverRef = useRef(false);
  const writeTilt = () => {
    const root = launchRef.current;
    if (!root) return;
    const c = tiltCur.current;
    const tr = `rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg)`;
    root.querySelectorAll(".wallet-unit").forEach((u) => {
      const w = u.querySelector(".wallet-3d");
      if (w) w.style.transform = u.classList.contains("active") && (phaseRef.current === 1 || performance.now() < flyUntil.current) ? tr : "none";
    });
    const ct = root.querySelector(".card-tilt");
    if (ct) ct.style.transform = tr;
    root.querySelectorAll(".wallet-unit.active .shine-spot").forEach((el) => { el.style.transform = `translate3d(${(c.sx * 0.5).toFixed(2)}%, ${(c.sy * 0.5).toFixed(2)}%, 0)`; });
    const sheen = root.querySelector(".card-sheen");
    if (sheen) sheen.style.transform = `translateX(${(c.ry * 1.6).toFixed(2)}%) translateY(${(c.rx * -1.2).toFixed(2)}%)`;
    if (phaseRef.current === 2 && hoverRef.current) {            // gloss + rim only repaint while they're visible
      const gl = root.querySelector(".card-gloss"), ed = root.querySelector(".card-edge");
      if (gl) gl.style.background = `radial-gradient(circle 260px at ${c.sx.toFixed(1)}% ${c.sy.toFixed(1)}%, rgba(255,255,255,0.5), rgba(255,255,255,0.12) 38%, transparent 68%)`;
      if (ed) ed.style.background = `conic-gradient(from ${((c.sx - 50) * 3.6).toFixed(1)}deg at ${c.sx.toFixed(1)}% ${c.sy.toFixed(1)}%, rgba(255,255,255,0.75), rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.12) 72%, rgba(255,255,255,0.65) 100%)`;
    }
  };
  const stepTilt = () => {
    const c = tiltCur.current, tt = targetTilt.current, ts = targetSpot.current;
    // while a card is leaving or coming back the tilt is let go of quickly, so both cards lie flat when one takes over from the other
    const ease = performance.now() < flyUntil.current ? 0.3 : 0.06;
    c.rx += (tt.rx - c.rx) * ease; c.ry += (tt.ry - c.ry) * ease;
    c.sx += (ts.x - c.sx) * 0.09;  c.sy += (ts.y - c.sy) * 0.09;
    const done = Math.abs(tt.rx - c.rx) < 0.008 && Math.abs(tt.ry - c.ry) < 0.008
              && Math.abs(ts.x - c.sx) < 0.05 && Math.abs(ts.y - c.sy) < 0.05;
    if (done) { c.rx = tt.rx; c.ry = tt.ry; c.sx = ts.x; c.sy = ts.y; }
    writeTilt();
    tiltRaf.current = done ? 0 : requestAnimationFrame(stepTilt);
  };
  const kickTilt = () => { if (!tiltRaf.current) tiltRaf.current = requestAnimationFrame(stepTilt); };
  useEffect(() => () => { cancelAnimationFrame(tiltRaf.current); tiltRaf.current = 0; }, []);
  useLayoutEffect(() => { phaseRef.current = phase; hoverRef.current = hoverCard; writeTilt(); });
  // the coin on the selections panel tilts the same way, on its own small loop: its tilt, plus the lustre on its
  // face, which turns as the coin tilts
  // On the trading panel (coin and globe) it faces forward and the pointer does more: it leans further, so the thick
  // edge swings into view, lifts towards the viewer, a light follows the pointer over its face and its shadow slides
  // away under it. All of it is transforms on layers that are already there.
  const coinTiltRef = useRef(null), coinLustreRef = useRef(null), coinGlareRef = useRef(null), coinShadowRef = useRef(null);
  const coinTarget = useRef({ ...COIN_STILL }), coinCur = useRef({ ...COIN_STILL }), coinRaf = useRef(0), coinEase = useRef(0.06);
  const writeCoin = () => {
    const c = coinCur.current;
    if (coinTiltRef.current) coinTiltRef.current.style.transform = `translateZ(${c.lift.toFixed(2)}px) rotateX(${c.rx.toFixed(3)}deg) rotateY(${c.ry.toFixed(3)}deg)`;
    if (coinLustreRef.current) coinLustreRef.current.style.transform = `rotate(${(c.ry * 4 + c.rx * 2.2).toFixed(2)}deg)`;
    if (coinGlareRef.current) coinGlareRef.current.style.transform = `translate3d(${c.gx.toFixed(1)}px, ${c.gy.toFixed(1)}px, 0)`;
    if (coinShadowRef.current) coinShadowRef.current.style.transform = `translate3d(${(6 + c.sx).toFixed(1)}px, ${(36 + c.sy).toFixed(1)}px, 0) scale(0.94, 1)`;
  };
  const stepCoin = () => {
    const c = coinCur.current, t = coinTarget.current;
    let done = true;
    for (const k in t) { c[k] += (t[k] - c[k]) * coinEase.current; if (Math.abs(t[k] - c[k]) >= 0.008) done = false; }
    if (done) Object.assign(c, t);
    writeCoin();
    coinRaf.current = done ? 0 : requestAnimationFrame(stepCoin);
  };
  const kickCoin = () => { if (!coinRaf.current) coinRaf.current = requestAnimationFrame(stepCoin); };
  useEffect(() => () => { cancelAnimationFrame(coinRaf.current); coinRaf.current = 0; }, []);
  // the IDX globe: one loop works out how far it is turned and draws it. The turn is the pointer's pull (eased, like
  // the tilts), plus a slow sway to and fro while it floats idle, plus the full turn when it is pressed.
  const globeCanvasRef = useRef(null), globeGL = useRef(null), globeRaf = useRef(0);
  const globeAnim = useRef({ cur: 0, target: 0, sway: 0, idle: false, spinAt: 0 });
  const stepGlobe = (now) => {
    const g = globeAnim.current;
    g.cur += (g.target - g.cur) * 0.06;
    g.sway += ((g.idle ? 1 : 0) - g.sway) * 0.03;                     // the sway fades in and out, never cuts
    const k = g.spinAt ? Math.min(1, (now - g.spinAt) / IDX_SPIN_MS) : 0;
    const spin = (1 - Math.pow(1 - Math.pow(k, 1.3), 2.6)) * Math.PI * 2;    // off briskly, a long gentle settle
    const settled = !g.idle && g.sway < 0.003 && Math.abs(g.target - g.cur) < 0.01 && (!g.spinAt || k === 1);
    if (settled) { g.cur = g.target; g.sway = 0; }
    globeGL.current?.draw((g.cur * Math.PI) / 180 + g.sway * 0.3 * Math.sin((now / 7000) * Math.PI * 2) + spin);
    globeRaf.current = settled ? 0 : requestAnimationFrame(stepGlobe);
  };
  const kickGlobe = () => { if (!globeRaf.current) globeRaf.current = requestAnimationFrame(stepGlobe); };
  useEffect(() => () => { cancelAnimationFrame(globeRaf.current); globeRaf.current = 0; }, []);
  // it sways only while it floats: in focus, and not under the pointer
  useEffect(() => { globeAnim.current.idle = globeFocused && !hoverGlobe; kickGlobe(); }, [globeFocused, hoverGlobe]);

  // background light follows the cursor by moving composited layers — no re-render, no repaint
  const bgRaf = useRef(0), bgNext = useRef(null);
  const litWinRef = useRef(null), litInnerRef = useRef(null), glowRef = useRef(null);
  const placeBg = (x, y) => {
    if (litWinRef.current) litWinRef.current.style.transform = `translate3d(${x - 340}px, ${y - 340}px, 0)`;
    if (litInnerRef.current) litInnerRef.current.style.transform = `translate3d(${340 - x}px, ${340 - y}px, 0)`;
    if (glowRef.current) glowRef.current.style.transform = `translate3d(${x - 420}px, ${y - 420}px, 0)`;
  };
  /* ---------- open app panel: FLOW splash at app start, and again whenever the footer logo is pressed ---------- */
  const [openPanel, setOpenPanel] = useState("in");     // "in" → "out" (outro playing over the wallets) → "done"
  const [openRun, setOpenRun] = useState(0);            // 0 = app start; every footer-logo press plays it again
  const [walletsReady, setWalletsReady] = useState(false);   // wallets mounted behind the splash, just before the outro
  // App start only: the logo and wordmark are held back (drawn, but all but invisible) until the fonts are loaded and
  // unpacked and the logo is decoded, then come in. That is a tenth of a second or so, while the window is still
  // opening; before, that work landed in the middle of the logo coming in and made it stutter. Everything after is
  // timed from the moment they come in, so the splash itself is exactly as long as it was.
  const [openGo, setOpenGo] = useState(false);
  const openGoAt = useRef(0);
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      // two frames on, so what was just loaded is laid out and drawn before anything moves
      requestAnimationFrame(() => requestAnimationFrame(() => { openGoAt.current = performance.now(); setOpenGo(true); }));
    };
    const cap = setTimeout(go, OPEN_READY_MAX_MS);
    warmFonts().then(go, go);
    if (typeof indexedDB !== "undefined") warm.all = warmAll();       // read now, in hand when the warm-up starts
    return () => { done = true; clearTimeout(cap); };
  }, []);
  useEffect(() => {
    if (!openGo) return;
    let live = true, t2 = 0;
    const out = () => { if (!live) return; setOpenPanel("out"); t2 = setTimeout(() => setOpenPanel("done"), OPEN_OUT_MS); };
    const t0 = setTimeout(() => setWalletsReady(true), OPEN_HOLD_MS - OPEN_PREP_MS);
    // the outro starts on time; only if the warm-up under the splash is still waiting for a frame (the graphics
    // process held up, as on a first launch) does it wait for that, a moment at most, rather than start on a stalled frame
    const t1 = setTimeout(() => {
      const late = new Promise((r) => setTimeout(r, OPEN_WARM_LATE_MS));
      (warm.pending ? Promise.race([warm.pending, late]) : Promise.resolve()).then(out, out);
    }, OPEN_HOLD_MS);
    return () => { live = false; clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [openRun, openGo]);
  // App start only: once the splash's pieces have all but landed, the screens filed at earlier launches are drawn
  // under it (see "warm-up" at the top), and cleared away before the outro starts
  useEffect(() => {
    if (!openGo) return;
    const t = setTimeout(() => warmReplay(openGoAt.current + OPEN_HOLD_MS - OPEN_WARM_CLEAR_MS), OPEN_WARM_AT_MS);
    return () => clearTimeout(t);
  }, [openGo]);

  // Outro: the logo drops first, then each letter follows at its own moment with its own speed, drift and spin
  // (clockwise or anticlockwise). Rolled afresh for every play, so no two outros fall the same way. The values are
  // handed to CSS as variables and the fall itself is a plain transform animation on the GPU: no per-frame JS.
  const openFall = useMemo(() => {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const either = (a, b) => (Math.random() < 0.5 ? -1 : 1) * rnd(a, b);
    const piece = (delay, dur, fall, drift, spin) => ({
      "--fd": `${Math.round(delay)}ms`, "--ft": `${Math.round(dur)}ms`,
      "--fy": `${fall.toFixed(1)}vh`, "--fx": `${Math.round(drift)}px`, "--fr": `${spin.toFixed(1)}deg`,
    });
    return {
      logo: piece(0, rnd(900, 1050), rnd(84, 98), either(8, 46), either(18, 70)),
      letters: Array.from({ length: APP_WORD.length }, () => piece(rnd(100, 340), rnd(850, 1150), rnd(72, 94), either(6, 64), either(22, 150))),
    };
  }, [openRun]);
  // (every bundled font is loaded before the splash comes in: warmFonts, in the launch effect above)
  // the screen being shown, named for the warm-up: null while something is on its way in or out
  const warmStage = openPanel !== "done" || launched || launchExit ? null
    : choice === null ? (pickFocus === "coin" ? "pick-coin" : null) : choice === "wallet" ? (phase === 2 ? "card" : "wallets")
    : choice === "markets" ? "markets" : null;
  const warmPanel = !launched || greetOn || yearIntro || tradeIn || view === "trade" ? null
    : `${view}${chartOpen ? "+chart" : recap ? "+recap" : catView ? "+cat" : scoreView ? "+score" : ""}`;
  useWarmScreen(warmStage || warmPanel, warmStage ? 0 : undefined);
  useLayoutEffect(() => { if (!launched) placeBg(window.innerWidth * 0.5, window.innerHeight * 0.42); }, [launched, openPanel, walletsReady]);
  const sideTilt = useRef([]);
  const onVeilMove = (e) => {
    bgNext.current = [e.clientX, e.clientY];
    if (bgRaf.current) return;
    bgRaf.current = requestAnimationFrame(() => {
      bgRaf.current = 0;
      placeBg(bgNext.current[0], bgNext.current[1]);
      // the side title leans after the pointer, like the wallet and the coin under it (eased by its own transition)
      const tx = (bgNext.current[0] / window.innerWidth - 0.5) * 30, ty = -(bgNext.current[1] / window.innerHeight - 0.5) * 20;
      sideTilt.current.forEach((el) => { if (el) el.style.transform = `perspective(700px) rotateX(${ty.toFixed(2)}deg) rotateY(${tx.toFixed(2)}deg)`; });
    });
  };
  const onCardMove = (e) => {
    if (performance.now() < flyUntil.current) return;
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setHoverCard(true);       // also here: an "enter" while the card was on its way is not taken
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    targetTilt.current = { ry: (px - 0.5) * 12, rx: -(py - 0.5) * 8.5 };
    targetSpot.current = { x: px * 100, y: py * 100 };
    kickTilt();
  };
  const onCardEnter = () => { if (performance.now() >= flyUntil.current) setHoverCard(true); };
  const onCoinMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    coinEase.current = inMarkets ? 0.1 : 0.06;
    coinTarget.current = inMarkets
      ? { ry: px * 58, rx: -py * 46, gx: px * COIN_D, gy: py * COIN_D, lift: 44, sx: -px * 46, sy: 14 - py * 30 }
      : { ...COIN_STILL, ry: px * 22, rx: -py * 16 };
    setHoverCoin(true);       // also here: if it slid under a resting pointer, no "enter" was ever sent
    kickCoin();
  };
  const onCoinLeave = () => { setHoverCoin(false); coinEase.current = 0.06; coinTarget.current = { ...COIN_STILL }; kickCoin(); };
  // selections panel: bring the wallet or the coin into the middle (a press on the tucked one, or the scroll wheel)
  const focusPick = (which) => { setPickFocus(which); onCardLeave(); onCoinLeave(); };
  const chooseWallet = () => { setChoice("wallet"); onCardLeave(); onCoinLeave(); };
  // back to the selections panel, with the thing just left in the middle: the wallet (from the wallets panel) or
  // the coin (from the trading selection)
  const backToChoice = (focus = "wallet") => { setChoice(null); setPickFocus(focus); setActiveWallet(homeWallet); onCardLeave(); onCoinLeave(); onGlobeLeave(); };
  // trading selection: the coin stays in the middle as "crypto", and the IDX globe comes in beside it
  const onGlobeMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    globeAnim.current.target = ((e.clientX - r.left) / r.width - 0.5) * 64;       // it turns to follow the pointer, in degrees
    setHoverGlobe(true);      // also here: if it slid under a resting pointer, no "enter" was ever sent
    kickGlobe();
  };
  const onGlobeLeave = () => { setHoverGlobe(false); globeAnim.current.target = 0; kickGlobe(); };
  const openMarkets = () => { setChoice("markets"); setMarketFocus("crypto"); onCardLeave(); onCoinLeave(); };
  const focusMarket = (which) => { setMarketFocus(which); onCoinLeave(); onGlobeLeave(); };
  // The card goes out and comes back as one move that can be turned round at any moment (see the styles): no timers,
  // and no press is ever ignored.
  const openCard = (which) => {
    // another card is still on its way back in: the big card lets go of it and starts from this one's pocket
    const bc = cardRef.current;
    if (bc && which !== picked) {
      bc.style.transition = "none"; bc.style.setProperty("--cp", "0");
      void bc.offsetWidth;
      bc.style.transition = ""; bc.style.removeProperty("--cp");
    }
    cardLate.current = performance.now() - walletAt.current < 700;
    fitCard();
    flyUntil.current = performance.now() + CARD_OUT_MS;
    setPicked(which); setPhase(2); onCardLeave();
  };
  // the big card's size against the pocket card's (384 × 242): the pocket card's face is laid out at the big card's
  // size and scaled by these, and the big card starts its way out scaled by them
  const fitCard = () => {
    const el = launchRef.current;
    if (!el) return;
    el.style.setProperty("--csx", String(384 / Math.min(560, window.innerWidth * 0.84)));
    el.style.setProperty("--csy", String(242 / Math.min(340, window.innerHeight * 0.44)));
    // how far along its way the card is clear of the pocket in front of it: there the big card takes over
    cardCt.current = Math.min(0.9, 286 / (window.innerHeight / 2 + 68) + 0.04);
    el.style.setProperty("--ct", (cardLate.current ? 0.97 : cardCt.current).toFixed(3));
  };
  useEffect(() => { window.addEventListener("resize", fitCard); return () => window.removeEventListener("resize", fitCard); }, []);
  const walletLock = useRef(false);
  const stepWallet = (dir) => {
    setActiveWallet((cur) => {
      const next = Math.min(WALLETS.length - 1, Math.max(0, cur + dir));
      if (next !== cur) onCardLeave();
      return next;
    });
  };
  useEffect(() => {
    if (launched || phase !== 1 || choice === "trade") return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      if (walletLock.current) return;
      walletLock.current = true;
      if (choice === null) focusPick(e.deltaY > 0 ? "coin" : "wallet");     // selections panel: wallet ↔ coin
      else if (choice === "markets") focusMarket(e.deltaY > 0 ? "idx" : "crypto");     // trading selection: coin ↔ globe
      else stepWallet(e.deltaY > 0 ? 1 : -1);
      setTimeout(() => { walletLock.current = false; }, 620);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [launched, phase, choice]);
  // Esc steps back out: a pulled-out card goes back in, then the wallets (or the trading selection) give way to the
  // selections panel
  useEffect(() => {
    if (launched || launchExit || (choice !== "wallet" && choice !== "markets")) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (choice === "markets") backToChoice("coin");
      else if (phase === 2) closeCard(); else backToChoice();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [launched, launchExit, choice, phase]);
  // The 3D globe is set up (a few milliseconds of work) only once the trading selection has opened and its move has
  // finished. Until then the flat logo stands in; tucked to the side, small and out of focus, the swap can't be seen.
  // Never earlier: just after the opening it collided with the first presses on the selections panel.
  useEffect(() => {
    if (launched || !inMarkets || globeGL.current) return;
    const t = setTimeout(() => {
      const cv = globeCanvasRef.current;
      if (!cv || globeGL.current) return;
      cv.width = cv.height = Math.round(300 * Math.min(2, window.devicePixelRatio || 1));
      globeGL.current = idxGlobeGL(cv);
      if (!globeGL.current) return;
      globeGL.current.draw(0);
      setGlobeLive(true);
      kickGlobe();
    }, 900);
    return () => clearTimeout(t);
  }, [launched, inMarkets]);
  // entering the app takes the stage away, and the canvas with it: hand the graphics context back
  useEffect(() => {
    if (!launched || !globeGL.current) return;
    globeGL.current.lose();
    globeGL.current = null;
    setGlobeLive(false);
  }, [launched]);
  const closeCard = () => {
    // the idle float is held where it is and eased out, so the big card is on the pocket card's spot when that takes over
    const fl = floatRef.current;
    if (fl) {
      const m = getComputedStyle(fl).transform;
      fl.style.transition = "none"; fl.style.transform = m === "none" ? "" : m;
      requestAnimationFrame(() => { fl.style.transition = "transform .14s ease-out"; fl.style.transform = "none"; });
    }
    flyUntil.current = performance.now() + CARD_IN_MS;
    setPhase(1); onCardLeave();
  };
  const onCardLeave = () => {
    setHoverCard(false);
    targetTilt.current = { rx: 0, ry: 0 };
    targetSpot.current = { x: 50, y: 50 };
    kickTilt();
  };
  const enterApp = () => {
    setLaunchExit(true);
    setTimeout(() => {
      setGreetOn(true);
      setYear(now.getFullYear() + (WALLETS[activeWallet]?.year || 0));
      setLaunched(true);
    }, 620);
    setTimeout(() => setGreetExit(true), 1620);          // greeting holds a full second, then fades
    setTimeout(() => {                                   // year intro starts right after
      setGreetOn(false);
      setGreetExit(false);
      setYearIntro(true);
    }, 1840);
  };
  // trading selection, the one in focus pressed. The coin flips on the spot; the globe spins once round its axis,
  // lifts, and the IDX wordmark comes up under it. Then the stage fades and that trading panel is underneath.
  const enterTrade = (kind) => {
    if (!inMarkets || marketFocus !== kind) return;
    setTradeKind(kind);
    setChoice("trade");
    onCardLeave(); onCoinLeave(); onGlobeLeave();
    coinEase.current = 0.3;      // the lean and the lift under the pointer go at once: the toss spins about a level axis
    if (kind === "idx") { globeAnim.current.spinAt = performance.now(); kickGlobe(); }
    else if (launchRef.current) {
      // the toss is rolled afresh every time: how far its axis leans out of the level one and to which side, how many
      // turns, and which way it tumbles. Always whole turns, so it still lands facing forward
      const lean = (0.12 + Math.random() * 0.58) * (Math.random() < 0.5 ? -1 : 1);
      const turns = (2 + Math.floor(Math.random() * 3)) * (Math.random() < 0.5 ? -1 : 1);
      launchRef.current.style.setProperty("--flip-lean", lean.toFixed(2));
      launchRef.current.style.setProperty("--flip-deg", `${turns * 360}deg`);
    }
    const hold = kind === "idx" ? IDX_REVEAL_MS : TRADE_FLIP_MS;
    setTimeout(() => setLaunchExit(true), hold);
    setTimeout(() => { setView("trade"); setLaunched(true); setTradeIn(true); }, hold + 620);
    setTimeout(() => setTradeIn(false), hold + 620 + 460);
  };
  // footer logo: back to the very beginning. The FLOW splash fades in over the app, and the app is swapped
  // for the wallets once it is covered, so the splash then opens onto the wallets exactly as at app start.
  const homeTimer = useRef(0);
  useEffect(() => () => clearTimeout(homeTimer.current), []);
  const goHome = () => {
    if (openPanel !== "done") return;
    setWalletsReady(false);
    setOpenPanel("in");
    setOpenRun((n) => n + 1);
    clearTimeout(homeTimer.current);
    homeTimer.current = setTimeout(resetToWallets, OPEN_COVER_MS);
  };
  const resetToWallets = () => {
    setSelected(null);
    setCatView(null);
    setChartOpen(false); setChartAt(null);
    setCatMenu(null);
    cancelAnimationFrame(tiltRaf.current); tiltRaf.current = 0;
    tiltCur.current = { rx: 0, ry: 0, sx: 50, sy: 50 };
    targetTilt.current = { rx: 0, ry: 0 }; targetSpot.current = { x: 50, y: 50 };
    writeTilt();
    cancelAnimationFrame(coinRaf.current); coinRaf.current = 0;
    coinCur.current = { ...COIN_STILL }; coinTarget.current = { ...COIN_STILL };
    cancelAnimationFrame(globeRaf.current); globeRaf.current = 0;
    globeAnim.current = { cur: 0, target: 0, sway: 0, idle: false, spinAt: 0 };
    setHoverGlobe(false);
    setLaunchExit(false);
    setLaunched(false);
    setPhase(1);
    flyUntil.current = 0;
    // home from the finance panels: the wallet of the year that was on screen (a year with no wallet: the current year's).
    // Home from a trading panel leaves it as it was
    const ofYear = WALLETS.findIndex((w) => (w.year || 0) === year - now.getFullYear());
    const home = view === "trade" ? homeWallet : ofYear < 0 ? HOME_WALLET : ofYear;
    setHomeWallet(home);
    setActiveWallet(home);
    setChoice(null);
    setPickFocus("wallet");
    setMarketFocus("crypto");
    setHoverCoin(false);
    setTradeIn(false);
    setGreetOn(false);
    setGreetExit(false);
    setView("year");
  };

  return (
    <div style={S.page} ref={(el) => { warm.page = el; }} onClick={() => { if (catMenu) closeCatMenu(); }}>
      {/* fonts are bundled with the app (src/fonts.css, loaded by main.jsx), so nothing comes from the internet */}
      <style>{`

        html { background: #101215; }
        html, body { scroll-behavior: smooth; margin: 0; }
        /* graphite backdrop for the yearly + monthly panels. It is the page's own background, so it travels with
           everything else when you scroll: a lighter grey at the top that deepens on the way down, plus a few soft
           glows set along the page (in px, so they stay at the same spots however long the page is).
           It is painted once into the page's tiles and scrolling only moves them, so it costs nothing per frame.
           One picture (PAGE_BG), so a change of the page's height doesn't draw it again either.
           !important because index.html and the boot code give body a plain inline colour, which would cover it. */
        body {
          min-height: 100vh;
          background: ${PAGE_BG} no-repeat 0 0 / 100% ${PAGE_BG_H}px #121417 !important;
        }
        :root {
          --ease: cubic-bezier(0.22, 1, 0.36, 1);
          --ease-soft: cubic-bezier(0.32, 0.72, 0.24, 1);
          --glass: rgba(43, 44, 46, 0.55);
          --glass-hi: rgba(255, 255, 255, 0.10);
          --glass-line: rgba(255, 255, 255, 0.09);
        }

        /* everything cascades in when a month is opened from the year panel */
        /* Two speeds (6 October 2026, his rule): cinematic moves (changing years, opening Wrapped, entering the wallet)
           may take 500–900ms; utility ones (opening a month, adding an expense, switching a time frame) are all there
           in 150–300ms. A month is utility: everything is in place within 0.3s of the press */
        .month-view.enter > * { animation: mvIn .22s var(--ease) backwards; }
        .month-view.enter > *:nth-child(1) { animation-delay: .00s; }
        .month-view.enter > *:nth-child(2) { animation-delay: .01s; }
        .month-view.enter > *:nth-child(3) { animation-delay: .02s; }
        .month-view.enter > *:nth-child(4) { animation-delay: .03s; }
        .month-view.enter > *:nth-child(5) { animation-delay: .04s; }
        .month-view.enter > *:nth-child(6) { animation-delay: .05s; }
        .month-view.enter > *:nth-child(7) { animation-delay: .06s; }
        .month-view.enter > *:nth-child(8) { animation-delay: .07s; }
        .month-view.enter > *:nth-child(n+9) { animation-delay: .08s; }
        @keyframes mvIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* the day tiles ride in a touch later, one after another */
        .month-view.enter .cell { animation: tileIn .2s var(--ease) backwards; }

        .cal-wrap {
          position: relative; border-radius: 20px; padding: 14px;
          margin: 0 -14px; overflow: hidden;
          background:
            linear-gradient(168deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.018) 34%, rgba(255,255,255,0.006) 100%);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
        }
        .cal-wrap::before {
          content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
          background:
            linear-gradient(112deg, transparent 18%, rgba(255,255,255,0.055) 34%, rgba(255,255,255,0.012) 44%, transparent 58%),
            radial-gradient(70% 50% at 8% -12%, rgba(255,255,255,0.09), transparent 62%);
        }
        .cal-wrap > * { position: relative; z-index: 1; }

        /* ---------- liquid glass surfaces ---------- */
        .glass {
          position: relative;
          background: var(--glass);
          backdrop-filter: blur(16px) saturate(135%);
          -webkit-backdrop-filter: blur(16px) saturate(135%);
          border: 1px solid var(--glass-line);
          box-shadow:
            0 18px 44px rgba(0,0,0,0.38),
            inset 0 1px 0 var(--glass-hi),
            inset 0 -1px 0 rgba(0,0,0,0.22);
          transition: box-shadow .45s var(--ease), border-color .45s var(--ease), transform .45s var(--ease);
        }
        /* the specular edge that makes it read as glass */
        .glass::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          z-index: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 20%, transparent 44%);
        }
        .glass > *, .cell > *, .ycell > * { position: relative; z-index: 1; }
        .glass:hover { border-color: rgba(255,255,255,0.16); box-shadow: 0 26px 60px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.16); }


        .glass-soft {
          background: rgba(36, 40, 45, 0.44);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
        }

        ::selection { background: rgba(61,220,151,0.28); color: #f2f6fa; }
        ::-webkit-scrollbar { width: 11px; height: 11px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.10); border-radius: 99px;
          border: 3px solid transparent; background-clip: content-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); background-clip: content-box; }

        /* inputs glow instead of jumping */
        input {
          transition: border-color .28s var(--ease), box-shadow .28s var(--ease), background .28s ease;
        }
        input:focus {
          box-shadow: 0 0 0 3px rgba(61,220,151,0.14);
          border-color: rgba(61,220,151,0.55) !important;
          outline: none !important;
        }
        .desc-field:focus { box-shadow: 0 0 0 3px rgba(154,163,171,0.14); border-color: rgba(200,210,220,0.45) !important; }
        .amt-field.red:focus { box-shadow: 0 0 0 3px rgba(255,93,108,0.16); border-color: rgba(255,93,108,0.6) !important; }

        /* buttons feel physical */
        button { transition: transform .22s var(--ease), background .22s ease, border-color .22s ease, color .22s ease; }
        button:active { transform: scale(0.965); }
        * { -webkit-font-smoothing: antialiased; }

        .stage-bg {
          position: fixed; inset: 0; z-index: 139; pointer-events: none;
          background: radial-gradient(circle at 50% 42%, #262b31 0%, #191d21 45%, #0d0f11 100%);
          opacity: 1; transition: opacity .43s ease;
        }
        .stage-bg.out { opacity: 0; }

        /* ---------- trading panel (work in progress) ---------- */
        /* trading tracker: the long / short switch on a trade (the same rising arrow, turned over for a short), and the
           round coin badge in the coins card */
        .side-chip { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px 0 8px; margin-left: 6px; flex-shrink: 0;
                     background: none; border: 1px solid rgba(255,255,255,0.10); border-radius: 9px; color: #9aa3ab; cursor: pointer;
                     font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
                     transition: border-color .18s ease, color .18s ease; }
        .side-chip:hover { border-color: #8a9299; color: #e8eaec; }
        .side-chip .msym { font-size: 16px; transition: transform .3s var(--ease); }
        .side-chip.short .msym { transform: scaleY(-1); }
        .side-chip.big { height: 38px; min-width: 88px; justify-content: center; margin-left: 0; border-radius: 11px; background: rgba(255,255,255,0.04); }
        /* the hidden copy of what is typed pushes the grey text to its end, so it has to be as wide as the typed text:
           every box has even-width digits (tabular-nums), and without them here the copy was narrower by 2–3px for
           every "1" typed: "10x" and "1000CATUSDT.P" ran into each other (he sent a picture) */
        .pair-ghost { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; font-size: 14px; pointer-events: none; white-space: pre;
                      font-variant-numeric: tabular-nums; }
        .pair-tail { position: absolute; top: 0; height: 100%; display: flex; align-items: center; color: #6d757d; font-size: 12.5px; pointer-events: none;
                     white-space: nowrap; font-variant-numeric: tabular-nums; animation: fadeIn .2s ease backwards; }
        .pair-ghost i { visibility: hidden; font-style: normal; }
        .pair-ghost b { font-weight: 400; color: #6d757d; }
        /* trading journal (crypto day panel): a trade as a page of properties. The icons are tinted, muted on purpose;
           of the text only the result, the position, the time frame, the full TP, the risk and the R carry a colour */
        .jr-sheet, .jr-item { --tone: #8fd7a4; --tone-bg: rgba(61,220,151,0.10); --tone-bd: rgba(61,220,151,0.34); }
        .jr-sheet.loss, .jr-item.loss { --tone: #e2808c; --tone-bg: rgba(255,93,108,0.10); --tone-bd: rgba(255,93,108,0.34); }
        .jr-sheet.be, .jr-item.be { --tone: #d6c88f; --tone-bg: rgba(227,205,119,0.09); --tone-bd: rgba(227,205,119,0.30); }
        .jr-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
        .jr-res { display: inline-flex; gap: 3px; padding: 3px; border-radius: 12px; background: rgba(24,27,31,0.55); border: 1px solid rgba(255,255,255,0.08); }
        .jr-res-b { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 13px 0 10px; border-radius: 9px; border: 1px solid transparent;
                    background: none; color: #8a9299; font-size: 13px; font-weight: 600; cursor: pointer;
                    transition: color .18s ease, background .18s ease, border-color .18s ease; }
        .jr-res-b .msym { font-size: 17px; }
        .jr-res-b:hover { color: #e8eaec; }
        .jr-res-b.on { color: var(--tone); background: var(--tone-bg); border-color: var(--tone-bd); }
        .jr-pnl { display: inline-flex; align-items: center; gap: 6px; box-sizing: border-box; width: 190px; height: 40px; padding: 0 13px; border-radius: 11px; cursor: text;
                  background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); color: var(--tone); font-size: 16px; font-weight: 700;
                  transition: border-color .25s ease, box-shadow .25s ease, opacity .25s ease; }
        .jr-pnl:focus-within { border-color: var(--tone-bd); box-shadow: 0 0 0 3px var(--tone-bg); }
        .jr-pnl input { flex: 1; min-width: 0; padding: 0; background: none; border: none; outline: none; color: inherit; font: inherit; font-variant-numeric: tabular-nums; }
        .jr-pnl input::placeholder, .jr-in::placeholder { color: #5b636b; }
        .jr-cols { display: flex; flex-wrap: wrap; column-gap: 28px; }
        .jr-col { flex: 1 1 300px; min-width: 0; }
        .jr-row { display: flex; align-items: center; gap: 8px; min-height: 40px; }
        .jr-row.top { align-items: flex-start; margin-top: 3px; }
        .jr-k { display: inline-flex; align-items: center; gap: 9px; width: 122px; height: 34px; flex-shrink: 0; color: #9aa3ab; font-size: 13.5px; }
        .jr-k .msym { font-size: 18px; transition: transform .3s var(--ease); }
        .jr-row.flip .jr-k .msym { transform: scaleY(-1); }
        .jr-v { flex: 1; min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
        .jr-v > span { flex: 1; }
        .jr-in { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 9px; border: 1px solid transparent; outline: none;
                 background: rgba(255,255,255,0.035); color: #e8eaec; font-family: inherit; font-size: 14px;
                 transition: background .2s ease, border-color .2s ease; }
        .jr-in:hover { background: rgba(255,255,255,0.06); }
        .jr-in:focus { background: rgba(24,27,31,0.62); border-color: rgba(200,210,220,0.42); }
        textarea.jr-in { display: block; min-height: 104px; padding: 10px 12px; line-height: 1.5; resize: vertical; }
        .jr-chip { height: 28px; padding: 0 9px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.09); background: none; color: #8a9299;
                   font-size: 12px; font-weight: 600; cursor: pointer; transition: color .18s ease, background .18s ease, border-color .18s ease; }
        .jr-chip:hover { color: #e8eaec; border-color: rgba(255,255,255,0.22); }
        .jr-chip.on, .jr-tag { color: #a9c6ea; background: rgba(120,165,225,0.12); border-color: rgba(120,165,225,0.36); }
        .jr-chip.long.on, .jr-tag.long { color: #8fd7a4; background: rgba(61,220,151,0.10); border-color: rgba(61,220,151,0.34); }
        .jr-chip.short.on, .jr-tag.short { color: #e2808c; background: rgba(255,93,108,0.10); border-color: rgba(255,93,108,0.34); }
        /* each time frame in its own muted colour (--tf): faint while it is not the one chosen. The last box is typed in */
        .jr-chip.tf { color: color-mix(in srgb, var(--tf) 55%, #8a9299); }
        .jr-chip.tf:hover { color: var(--tf); border-color: color-mix(in srgb, var(--tf) 40%, transparent); }
        .jr-chip.tf.on, .jr-tag.tf { color: var(--tf); background: color-mix(in srgb, var(--tf) 13%, transparent); border-color: color-mix(in srgb, var(--tf) 38%, transparent); }
        .jr-chip.own { width: 58px; box-sizing: border-box; padding: 0 4px; text-align: center; outline: none; cursor: text; font-family: inherit; }
        .jr-chip.own::placeholder { color: #6d757d; font-weight: 500; }
        .jr-chip.own:focus { border-color: rgba(200,210,220,0.42); }
        .jr-foot { display: flex; justify-content: flex-end; margin-top: 12px; }
        .jr-add { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px 0 11px; border-radius: 11px; cursor: pointer;
                  border: 1px solid var(--tone-bd); background: var(--tone-bg); color: var(--tone); font-size: 13.5px; font-weight: 700;
                  transition: box-shadow .2s ease, transform .18s ease, color .18s ease, background .18s ease, border-color .18s ease; }
        .jr-add .msym { font-size: 19px; }
        .jr-add:hover { box-shadow: 0 0 0 3px var(--tone-bg); }
        .jr-add:active { transform: scale(0.97); }
        .jr-item { border-radius: 12px; transition: border-color .2s ease; }
        .jr-item:hover, .jr-item.open { border-color: var(--tone-bd) !important; }
        .jr-sum { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 6px 7px 6px 9px; cursor: pointer; }
        .jr-badge { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px 0 7px; border-radius: 8px; flex-shrink: 0;
                    color: var(--tone); background: var(--tone-bg); font-size: 11.5px; font-weight: 700; }
        .jr-badge .msym { font-size: 15px; }
        .jr-name { flex-shrink: 0; color: #e8eaec; font-size: 14px; font-weight: 700; }
        .jr-name i { margin-left: 4px; color: #6d757d; font-size: 12px; font-style: normal; font-weight: 400; }
        .jr-tag { display: inline-flex; align-items: center; height: 22px; padding: 0 7px; border-radius: 7px; flex-shrink: 0; font-size: 11px; font-weight: 700; }
        .jr-meta { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: pre; color: #8a9299; font-size: 12.5px; }
        .jr-amt { flex-shrink: 0; color: var(--tone); font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .jr-chev { flex-shrink: 0; color: #6d757d; font-size: 20px; transition: transform .3s var(--ease); }
        .jr-item.open .jr-chev { transform: rotate(180deg); }
        .jr-fold { display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows .3s cubic-bezier(0.4,0,0.2,1), visibility 0s .3s; }
        .jr-item.open .jr-fold { grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows .3s cubic-bezier(0.4,0,0.2,1); }
        .jr-sheet.in-list { padding: 12px; border-top: 1px solid rgba(255,255,255,0.07); }
        /* pictures on a trade: small tiles in its sheet (a press opens one large), and how many on its line */
        .jr-pics { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; color: #6d757d; font-size: 12px; }
        .jr-pics .msym { font-size: 15px; }
        .jr-shots { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 8px; padding: 3px 0; }
        .jr-shot { position: relative; width: 104px; height: 66px; border-radius: 9px; overflow: hidden; flex-shrink: 0; cursor: zoom-in;
                   background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.10); transition: border-color .2s ease, transform .2s var(--ease); }
        .jr-shot:hover { border-color: rgba(200,210,220,0.42); transform: translateY(-1px); }
        .jr-shot img, .jr-shot canvas { display: block; width: 100%; height: 100%; object-fit: cover; }
        .jr-shot-x { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; padding: 0; border: none; border-radius: 6px; cursor: pointer;
                     background: rgba(14,16,18,0.74); color: #c9cfd4; font-size: 13px; line-height: 18px; opacity: 0; transition: opacity .18s ease, color .18s ease; }
        .jr-shot:hover .jr-shot-x { opacity: 1; }
        .jr-shot-x:hover { color: #ff8d97; }
        .jr-shot.add { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-style: dashed; color: #6d757d; transition: color .2s ease, border-color .2s ease, opacity .2s ease; }
        .jr-shot.add:hover { color: #e8eaec; transform: none; }
        .jr-shot.add .msym { font-size: 22px; }
        .jr-shot.add.busy { opacity: 0.45; pointer-events: none; }
        .shot-view { position: fixed; inset: 0; z-index: 290; display: flex; align-items: center; justify-content: center; background: rgba(8,10,12,0.86);
                     cursor: zoom-out; animation: fadeIn .18s ease backwards; transition: opacity .17s ease; }
        .shot-view.out { opacity: 0; }
        .shot-view img, .shot-view canvas { display: block; max-width: 92vw; max-height: 88vh; border-radius: 12px; box-shadow: 0 30px 80px rgba(0,0,0,0.6);
                                             animation: shotIn .24s cubic-bezier(0.22,1,0.36,1) backwards; }
        .shot-view canvas { width: min(92vw, 960px); height: auto; }
        @keyframes shotIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
        /* deposits: one line under the day's trades, in the journal's neutral blue (green and red are for PnL) */
        .jr-dep { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.07);
                  --tone: #a9c6ea; --tone-bg: rgba(120,165,225,0.10); --tone-bd: rgba(120,165,225,0.34); }
        .jr-pnl.dep { width: 150px; height: 32px; padding: 0 11px; border-radius: 9px; font-size: 14px; }
        .jr-v > .jr-dep-chip, .jr-v > .jr-dep-no { flex: none; }
        .jr-dep-no { color: #e2808c; font-size: 12.5px; animation: fadeIn .2s ease backwards; }
        .jr-dep-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 5px 0 10px; border-radius: 8px; color: #9aa3ab; font-size: 12.5px;
                       background: rgba(120,165,225,0.07); border: 1px solid rgba(120,165,225,0.22); animation: fadeDown .25s ease backwards; }
        .jr-dep-chip b { color: #a9c6ea; font-weight: 700; font-variant-numeric: tabular-nums; }
        .jr-dep-x { padding: 0 3px; background: none; border: none; color: #6d757d; font-size: 16px; line-height: 1; cursor: pointer; transition: color .18s ease; }
        .tok { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
               font-size: 11px; font-weight: 800; color: #14171a; }
        /* trading side: the PnL analysis card (time-frame tabs, the balance box, three line charts) */
        .an-bar { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; margin-top: 4px; }
        .an-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-left: -4px; }
        .an-tab { background: none; border: none; height: 32px; padding: 0 13px; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 700;
                  color: #7d858c; cursor: pointer; white-space: nowrap; transition: color .2s ease, background .2s ease; }
        .an-tab:hover { color: #e8eaec; }
        .an-tab.on { color: #f5a742; background: rgba(245,167,66,0.13); }
        /* the balance: one pill. At rest a figure with a pencil, pressed it is typed over; dashed while there is none */
        .an-bal { margin-left: auto; display: inline-flex; align-items: center; gap: 10px; box-sizing: border-box; height: 36px; padding: 0 7px 0 13px; border-radius: 11px;
                  background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); color: #8a9299; font-family: inherit; cursor: pointer;
                  transition: border-color .2s ease, box-shadow .2s ease; }
        .an-bal:hover { border-color: rgba(255,255,255,0.24); }
        .an-bal > span:first-child { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
        .an-bal b { color: #f2f5f8; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .an-bal i { margin-right: 3px; color: #8a9299; font-style: normal; font-size: 13px; font-weight: 600; }
        .an-bal .msym { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 7px; font-size: 15px; color: #6d757d;
                        transition: color .2s ease, background .2s ease; }
        .an-bal:hover .msym { color: #e8eaec; background: rgba(255,255,255,0.07); }
        .an-bal.none { border-style: dashed; border-color: rgba(245,167,66,0.42); color: #c99a55; }
        .an-bal.none b { color: #f5a742; font-size: 13px; font-weight: 600; }
        .an-bal.edit { padding-right: 13px; gap: 8px; cursor: text; border-color: #f5a742; box-shadow: 0 0 0 2px rgba(245,167,66,0.14); }
        .an-bal.edit i { margin-right: -4px; }
        .an-bal input { width: 118px; padding: 0; background: none; border: none; outline: none; color: #f2f5f8; font-family: inherit; font-size: 15px; font-weight: 700; }
        .an-bal input::placeholder { color: #6d757d; font-weight: 500; }
        .an-dates { display: flex; align-items: center; gap: 9px; margin-top: 10px; font-size: 12px; color: #6d757d; animation: fadeDown .22s ease backwards; }
        .an-date { color-scheme: dark; height: 32px; box-sizing: border-box; padding: 0 9px; border-radius: 10px; background: rgba(24,27,31,0.62);
                   border: 1px solid rgba(255,255,255,0.10); color: #e8eaec; font: inherit; font-size: 13px; font-variant-numeric: tabular-nums;
                   outline: none; transition: border-color .25s ease, box-shadow .25s ease; }
        .an-date:focus { border-color: #f5a742; box-shadow: 0 0 0 2px rgba(245,167,66,0.14); }
        .an-asof { margin: 9px 2px 0; font-size: 11.5px; color: #6d757d; font-variant-numeric: tabular-nums; }
        .an-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; gap: 20px 22px; margin-top: 16px; padding-bottom: 10px; }
        .an-grid > div { min-width: 0; }
        .an-wide { grid-column: 1 / -1; }
        .an-title { font-size: 15px; font-weight: 700; color: #e8eaec; }
        .an-title span { font-weight: 400; color: #9aa3ab; }
        .an-val { min-height: 30px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px 16px; margin: 3px 0 9px; font-size: 20px; font-weight: 700;
                  font-variant-numeric: tabular-nums; }
        .an-key { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; color: #c7cdd2; white-space: nowrap; }
        .an-key i { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .an-key b { font-size: 16px; font-weight: 700; margin-left: 2px; }
        .an-box { border-radius: 14px; padding: 12px 12px 2px; }
        .an-plot { position: relative; }
        .an-plot svg { position: absolute; left: 0; top: 0; display: block; overflow: visible; }
        .an-line { stroke-dasharray: 1; animation: drawLine .3s var(--ease-soft) backwards; }
        .an-note { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 13px; font-weight: 600; color: #6d757d; pointer-events: none;
                   animation: axisIn .35s ease backwards; }
        .an-ask { pointer-events: auto; background: rgba(245,167,66,0.10); border: 1px solid rgba(245,167,66,0.30); color: #f5a742; height: 32px; padding: 0 14px;
                  border-radius: 10px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
        .an-ask:hover { background: rgba(245,167,66,0.18); border-color: rgba(245,167,66,0.5); }
        /* trading side: the win / loss ring above the list of coins */
        .ring-wrap { padding: 4px 0 16px; margin-bottom: 8px; border-bottom: 1px solid #33373b; }
        .ring-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .ring-body { display: flex; align-items: flex-start; gap: 18px 44px; flex-wrap: wrap; margin-top: 14px; }
        .ring-fig { position: relative; width: 200px; height: 200px; flex-shrink: 0; }
        .ring-seg { cursor: pointer; transition: opacity .18s ease; animation: scoreDraw .75s cubic-bezier(0.3,0,0.2,1) backwards; }
        .ring-mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; pointer-events: none;
                    text-align: center; animation: axisIn .22s ease backwards; }
        .ring-mid span { font-size: 12px; color: #9aa3ab; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ring-mid b { font-size: 20px; font-weight: 800; color: #f2f5f8; font-variant-numeric: tabular-nums; }
        .ring-list { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 2px; padding-top: 6px; }
        .ring-row { display: grid; grid-template-columns: 9px minmax(0, 1fr) auto 66px; align-items: center; gap: 12px; padding: 6px 10px; margin: 0 -10px;
                    border-radius: 10px; transition: background .18s ease; }
        .ring-row.on { background: rgba(255,255,255,0.055); }
        .ring-row i { width: 9px; height: 9px; border-radius: 50%; }
        .ring-name { font-size: 14px; font-weight: 600; color: #e8eaec; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ring-name small { margin-left: 9px; font-size: 11.5px; font-weight: 500; color: #6d757d; }
        .ring-amt { font-size: 13.5px; font-weight: 700; color: #e8eaec; font-variant-numeric: tabular-nums; }
        .ring-pct { font-size: 13px; color: #9aa3ab; text-align: right; font-variant-numeric: tabular-nums; }
        /* crypto tracker: the position calculator. Its button is the year arrows' twin and sits right above them on
           the yearly panel, in the corner on the monthly one (lifted over the footer logo where the window is narrow) */
        .calc-fab.glass {
          position: fixed; right: 26px; bottom: 26px; z-index: 30; width: 47px; height: 46px; padding: 0; border-radius: 16px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: #cbd3db;
          background: rgba(255,255,255,0.055) !important; border: 1px solid rgba(255,255,255,0.16) !important;
          backdrop-filter: blur(22px) saturate(170%); -webkit-backdrop-filter: blur(22px) saturate(170%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.22) !important;
          transition: color .18s ease, transform .22s var(--ease-soft);
        }
        .calc-fab.glass.above { bottom: 112px; }
        .calc-fab.glass:hover { color: #ffffff; transform: translateY(-2px); }
        .calc-fab.glass:active { transform: scale(0.94); }
        .calc-fab .msym { font-size: 23px; }
        @media (max-width: 1420px) { .calc-fab.glass:not(.above) { bottom: 88px; } }
        .pc-modal { width: min(1080px, 95vw) !important; padding: 18px 22px 22px !important; }
        .glass > .pc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; z-index: 3; }
        .pc-cur2 { animation: fadeRight .3s ease backwards; }
        .pc-tools { margin-left: auto; display: flex; align-items: center; gap: 8px; position: relative; padding-left: 40px; }
        .pc-gear { display: inline-flex; align-items: center; justify-content: center; opacity: 0;
                   transition: opacity .2s ease, color .18s ease, border-color .18s ease, background .18s ease, transform .22s var(--ease); }
        /* the ✕ on every pop-up and panel, the calculators' gear, and the × on an income chip: they light up under the pointer */
        .x-btn:hover, .pc-gear:hover { color: #e8eaec !important; border-color: rgba(255,255,255,0.24) !important; background: rgba(255,255,255,0.10) !important; }
        .chip-x:hover { color: #ff8d97 !important; }
        .pc-gear .msym { font-size: 16px; }
        .pc-tools:hover .pc-gear, .pc-gear:focus-visible, .pc-gear.on { opacity: 1; }
        .pc-pop { position: absolute; right: 0; top: calc(100% + 10px); z-index: 6; width: 286px; border-radius: 14px; padding: 13px 14px 12px;
                  background: #25292e; border: 1px solid rgba(255,255,255,0.13); box-shadow: 0 16px 36px rgba(0,0,0,0.5);
                  animation: fadeDown .18s ease backwards; }
        .pc-pop-row { display: grid; grid-template-columns: auto minmax(0, 1fr) 34px; align-items: center; gap: 9px; margin-top: 9px; font-size: 13px; color: #9aa3ab; }
        .pc-note { font-size: 11.5px; color: #6d757d; margin-top: 10px; line-height: 1.45; }
        .pc-body { display: grid; grid-template-columns: 322px minmax(0, 1fr); gap: 26px; align-items: start; }
        .pc-form { display: flex; flex-direction: column; gap: 9px; }
        .pc-line { display: grid; grid-template-columns: 66px minmax(0, 1fr); align-items: center; gap: 10px; }
        .pc-line.two { grid-template-columns: 66px minmax(0, 1fr) auto minmax(0, 1fr); }
        .pc-line.tp { grid-template-columns: 66px minmax(0, 1fr) 84px; position: relative; }
        .pc-line > label, .pc-lab { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8a9299; white-space: nowrap; }
        .pc-in { width: 100%; min-width: 0; background: rgba(24,27,31,0.62); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; color: #e8eaec;
                 padding: 9px 12px; font-size: 14px; font-variant-numeric: tabular-nums; outline: none; transition: border-color .2s ease, box-shadow .2s ease; }
        .pc-in:focus { border-color: rgba(200,210,220,0.45); box-shadow: 0 0 0 3px rgba(154,163,171,0.13); }
        .pc-in.bad { border-color: rgba(255,93,108,0.6); }
        .pc-in::placeholder { color: #50575e; }
        /* the coin: always capitals, with /USDT.P written after it in grey */
        .pc-coin { position: relative; display: block; }
        .pc-coin .pc-in, .pc-ghost { font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
        .pc-ghost { position: absolute; left: 0; top: 0; height: 100%; display: flex; align-items: center; padding: 0 13px; font-size: 14px; pointer-events: none; white-space: pre; }
        .pc-ghost i { visibility: hidden; font-style: normal; }
        .pc-ghost b { font-weight: 500; color: #6d757d; text-transform: none; }
        /* the latest price of what is typed, at the right end of its box: a press writes it into the entry */
        .pc-live { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); height: 26px; padding: 0 8px; border: none; border-radius: 7px;
                   display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.055); color: #c7cdd2; cursor: pointer;
                   font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap;
                   transition: background .15s ease, color .15s ease; animation: fadeIn .2s ease backwards; }
        .pc-live:hover { background: rgba(255,255,255,0.12); color: #ffffff; }
        .pc-live i { width: 6px; height: 6px; border-radius: 50%; background: #3ddc97; flex-shrink: 0; }
        .pc-live em { font-style: normal; font-size: 11.5px; color: #8a9299; }
        .pc-live em.up { color: #5ee3a9; }
        .pc-live em.dn { color: #ff8d97; }
        .pc-live.old { color: #8a9299; }
        .pc-live.old i { background: #6d757d; }
        .pc-live.old em { color: #6d757d; }
        /* stock calculator: the lots, and what they come to in rupiah beside them */
        .pc-line.lots { grid-template-columns: 66px minmax(0, 0.62fr) minmax(0, 1fr); }
        .pc-conv { font-size: 14px; color: #6d757d; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-conv b { font-weight: 700; color: #e8eaec; margin-left: 3px; }
        .pc-conv.off b { color: #50575e; font-weight: 600; }
        .pc-cap { margin: 2px 0 1px; color: #6d757d; letter-spacing: 0.08em; }
        .pc-held { font-size: 12.5px; color: #8a9299; font-variant-numeric: tabular-nums; }
        .pc-unit { position: relative; display: block; transition: opacity .2s ease; }
        .pc-unit .pc-in { padding-right: 26px; }
        .pc-unit > span { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); color: #6d757d; font-size: 12.5px; pointer-events: none; }
        .pc-rest { font-size: 13px; color: #8a9299; text-align: right; padding-right: 11px; font-variant-numeric: tabular-nums; }
        .pc-unit.off { opacity: 0.38; }                        /* this target stands in for the full TP: its % is not used */
        /* long / short: pressed is locked by hand; the faint one is what the levels say */
        .pc-side { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pc-side-b { height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.10); background: rgba(24,27,31,0.62); color: #6d757d; cursor: pointer;
                     font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
                     display: inline-flex; align-items: center; justify-content: center; gap: 7px;
                     transition: color .18s ease, border-color .18s ease, background .18s ease; }
        .pc-side-b:hover { color: #e8eaec; border-color: rgba(255,255,255,0.24); }
        .pc-side-b i { font-style: normal; font-size: 9px; font-weight: 600; letter-spacing: 0.08em; opacity: 0.7; animation: pcFade .2s ease backwards; }
        @keyframes pcFade { from { opacity: 0; } }
        .pc-side-b.long.auto { color: #8fd7a4; border-color: rgba(143,215,164,0.22); }
        .pc-side-b.short.auto { color: #e2808c; border-color: rgba(226,128,140,0.22); }
        .pc-side-b.long.on { color: #a5efcd; border-color: rgba(61,220,151,0.55); background: rgba(61,220,151,0.12); }
        .pc-side-b.short.on { color: #ffb3bb; border-color: rgba(255,93,108,0.55); background: rgba(255,93,108,0.12); }
        .pc-rule { height: 1px; background: rgba(255,255,255,0.07); margin: 5px 0; }
        .pc-x { position: absolute; right: -20px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #6d757d; cursor: pointer;
                font-size: 17px; line-height: 1; padding: 2px; transition: color .15s ease; }
        .pc-x:hover { color: #ff8d97; }
        .pc-add { align-self: flex-start; margin-left: 76px; background: none; border: 1px dashed rgba(255,255,255,0.17); color: #8a9299; border-radius: 9px;
                  padding: 5px 11px; font-size: 12px; cursor: pointer; transition: color .15s ease, border-color .15s ease; }
        .pc-add:hover { color: #e8eaec; border-color: rgba(255,255,255,0.34); }
        .pc-go-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
        .pc-clear { background: none; border: none; color: #6d757d; font-size: 12px; cursor: pointer; padding: 6px 2px; transition: color .15s ease; }
        .pc-clear:hover { color: #e8eaec; }
        .pc-clear.test { color: #b9a862; }
        .pc-clear.test:hover { color: #e3cd77; }
        /* the enter button: grey, blue under the pointer */
        .pc-go { width: 58px; height: 40px; border-radius: 11px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.08); color: #9aa3ab;
                 cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
                 transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s var(--ease-soft); }
        .pc-go:hover, .pc-go:focus-visible { background: #3f8ae0; border-color: #7fb6e0; color: #ffffff; outline: none; }
        .pc-go:active { transform: scale(0.95); }
        .pc-go .msym { font-size: 21px; }
        .pc-empty { animation: pcFade .25s ease backwards; min-height: 470px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center;
                    color: #565d64; font-size: 13px; border: 1px dashed rgba(255,255,255,0.08); border-radius: 16px; }
        .pc-empty .msym { font-size: 30px; color: #454b51; }
        /* levels that can't be right: what is wrong, one line each; a line takes you to its box */
        .pc-err { min-height: 470px; border: 1px solid rgba(255,93,108,0.22); background: rgba(255,93,108,0.045); border-radius: 16px; padding: 20px 22px;
                  animation: pcFade .2s ease backwards; }
        .pc-err-h { display: flex; align-items: center; gap: 9px; font-size: 19px; font-weight: 800; color: #ff8d97; }
        .pc-err-h .msym { font-size: 23px; }
        .pc-err-sub { font-size: 12.5px; color: #8a9299; margin: 6px 0 14px; line-height: 1.5; }
        .pc-err-row { display: flex; align-items: baseline; gap: 11px; width: 100%; text-align: left; background: none; border: none; cursor: pointer;
                      border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 2px; color: #e8eaec; font-size: 13.5px; line-height: 1.45;
                      transition: color .15s ease; }
        .pc-err-row:hover { color: #ffb3bb; }
        .pc-err-row span { flex-shrink: 0; width: 19px; height: 19px; border-radius: 50%; background: rgba(255,93,108,0.16); color: #ff8d97;
                           font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
        .pc-why { font-size: 12.5px; color: #ff8d97; margin-bottom: 10px; }
        /* stock calculator: quiet notes under the tiles, and the average-down tables' own columns */
        .pc-hint { font-size: 12px; color: #b9a862; line-height: 1.45; margin-top: 7px; }
        .pc-row.av { grid-template-columns: 0.8fr 1fr 0.7fr 1.5fr 1.2fr; }
        .pc-row.av3 { grid-template-columns: 1.7fr 1fr 1.2fr; }
        .pc-line.tp.buy .pc-unit .pc-in { padding-right: 34px; }
        .pc-res { min-height: 470px; }
        /* the lines come in one after another from the top (PC_LINE_CSS gives each its turn); transform and opacity
           only. Dimming for results that are waiting on a half-typed level is eased too. */
        .pc-res > * { animation: pcLine .2s var(--ease) backwards; transition: opacity .18s ease; }
        .pc-err > * { animation: pcLine .2s var(--ease) backwards; }
        ${PC_LINE_CSS}
        @keyframes pcLine { from { opacity: 0; transform: translateY(-8px); } }
        .pc-res.stale > :not(.pc-why) { opacity: 0.38; }
        /* a target or a buy added with the + button comes in the same way */
        .pc-line.more { animation: pcLine .2s var(--ease) backwards; }
        /* while the pop-up eases to a new height (useEaseHeight) the body is clipped; this leaves room for the glow
           round the box being typed in */
        .pc-body { overflow-clip-margin: 5px; }
        .pc-res-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .pc-sym { font-size: 17px; font-weight: 800; letter-spacing: 0.02em; }
        .pc-sym span { color: #6d757d; font-weight: 600; }
        .pc-dir { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; border: 1px solid; }
        .pc-dir.long { color: #8fd7a4; border-color: rgba(143,215,164,0.32); background: rgba(61,220,151,0.07); }
        .pc-dir.short { color: #e2808c; border-color: rgba(226,128,140,0.32); background: rgba(255,93,108,0.07); }
        .pc-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-bottom: 4px; }
        .pc-tile { border-radius: 13px; padding: 10px 13px 11px; min-width: 0; }
        .pc-tile-l { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #6d757d; }
        .pc-tile-v { font-size: 19px; font-weight: 800; margin-top: 4px; color: #c7cdd2; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pc-tile-v span { font-size: 12px; font-weight: 600; color: #8a9299; }
        .pc-tile.key .pc-tile-v { color: #ffffff; }
        .pc-title { font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #9aa3ab; margin: 16px 0 3px; }
        .pc-title span { color: #6d757d; letter-spacing: 0.04em; font-weight: 600; }
        .pc-row { display: grid; grid-template-columns: 1.15fr 0.8fr 0.8fr 2fr; align-items: baseline; gap: 8px; padding: 7px 2px;
                  border-bottom: 1px solid rgba(255,255,255,0.055); font-size: 13.5px; color: #c7cdd2; font-variant-numeric: tabular-nums; }
        .pc-row.rr { grid-template-columns: 1.15fr 2fr 0.8fr 0.8fr; }
        .pc-row > :nth-child(n+2) { text-align: right; }
        .pc-row.h { font-size: 10px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; color: #6d757d; padding: 4px 2px 6px; }
        .pc-row.t { border-bottom: none; font-weight: 700; color: #e8eaec; }
        .pc-row .k { font-weight: 700; color: #e8eaec; white-space: nowrap; }
        .pc-row .k i { font-style: normal; font-weight: 500; color: #8a9299; }
        .pc-pos { color: #5ee3a9; font-weight: 700; }
        .pc-neg { color: #ff8d97; font-weight: 700; }
        .pc-2nd { color: #7d858d; font-weight: 500; }
        .pc-rr { font-weight: 800; color: #e8eaec; }

        /* ---------- greeting (card -> year) ---------- */
        .greet-veil {
          position: fixed; inset: 0; z-index: 160;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          opacity: 1;
          transition: opacity .22s ease;
          pointer-events: none;
        }
        .greet-veil.out { opacity: 0; }
        .greet-title {
          font-size: clamp(34px, 5vw, 62px); font-weight: 700; letter-spacing: -0.02em; color: #94a2af;
          animation: greetRise .55s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes greetRise {
          from { opacity: 0; transform: translateY(34px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .greet-name {
          font-family: 'Ballet', cursive; font-weight: 400; color: #f4f7fa;
          font-size: clamp(86px, 12vw, 176px); line-height: 0.95; margin-top: -2px;
          animation: greetRise .6s cubic-bezier(0.22,1,0.36,1) .16s both;
        }

        /* ---------- year opening animation ---------- */
        .year-big-anim { animation: yearRise .65s cubic-bezier(0.22,1,0.36,1) both; display: inline-flex; align-items: flex-start; }
        /* header year: the pixel font of the FLOW wordmark (48px, so one font pixel = 6px), no shadow */
        .year-big .yb-cell { position: relative; display: inline-block; width: 1em; height: 1em; }
        .year-big .yb-px { display: block; height: 1em; }
        .year-big .yb-px, .year-big .yb-px span { font-family: 'Press Start 2P', 'Inter', sans-serif; -webkit-font-smoothing: none; }
        /* the same digit in the normal font, sized and placed so it sits exactly over the pixel digit (same height,
           same centre). Only in the page around the wallet → year intro. */
        .year-big .yb-n { position: absolute; left: 0; top: -8.5px; width: 42px; text-align: center; opacity: 0; pointer-events: none;
                          font-size: 58px; font-weight: 800; line-height: 1.02; letter-spacing: 0; }
        /* flicker: normal → pixel → normal → pixel…, short cross-fades (opacity only), a different rhythm, start and
           length per digit, ending on pixel */
        .year-big.flick .yb-n, .year-big.flick .yb-px { animation-duration: var(--kt); animation-delay: var(--kd);
                                                        animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
        .year-big.flick .fk0 .yb-n { animation-name: ybN0; }  .year-big.flick .fk0 .yb-px { animation-name: ybP0; }
        .year-big.flick .fk1 .yb-n { animation-name: ybN1; }  .year-big.flick .fk1 .yb-px { animation-name: ybP1; }
        .year-big.flick .fk2 .yb-n { animation-name: ybN2; }  .year-big.flick .fk2 .yb-px { animation-name: ybP2; }
        @keyframes ybN0 { 0%, 12% { opacity: 1; } 19%, 30% { opacity: 0; } 37%, 52% { opacity: 1; } 60%, 100% { opacity: 0; } }
        @keyframes ybP0 { 0%, 12% { opacity: 0; } 19%, 30% { opacity: 1; } 37%, 52% { opacity: 0; } 60%, 100% { opacity: 1; } }
        @keyframes ybN1 { 0%, 6% { opacity: 1; } 12%, 18% { opacity: 0; } 24%, 40% { opacity: 1; } 47%, 58% { opacity: 0; } 64%, 72% { opacity: 1; } 80%, 100% { opacity: 0; } }
        @keyframes ybP1 { 0%, 6% { opacity: 0; } 12%, 18% { opacity: 1; } 24%, 40% { opacity: 0; } 47%, 58% { opacity: 1; } 64%, 72% { opacity: 0; } 80%, 100% { opacity: 1; } }
        @keyframes ybN2 { 0%, 20% { opacity: 1; } 27%, 34% { opacity: 0; } 40%, 46% { opacity: 1; } 51% { opacity: .35; } 56%, 68% { opacity: 1; } 77%, 100% { opacity: 0; } }
        @keyframes ybP2 { 0%, 20% { opacity: 0; } 27%, 34% { opacity: 1; } 40%, 46% { opacity: 0; } 51% { opacity: .65; } 56%, 68% { opacity: 0; } 77%, 100% { opacity: 1; } }
        @keyframes yearRise { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        /* month title: the same cells and the same flicker at half the size (24px pixel font, so one font pixel = 3px).
           --nx nudges each normal-font letter so the word is evenly spaced (see monthTwinShift) */
        .month-big .yb-cell { position: relative; display: inline-block; width: 1em; height: 1em; }
        .month-big .yb-cell.tt { margin-left: -3px; }       /* "t" sits a font pixel to the right in its box: pull it back */
        .month-big .yb-px { display: block; height: 1em; font-family: 'Press Start 2P', 'Inter', sans-serif; -webkit-font-smoothing: none; }
        .month-big .yb-n { position: absolute; left: 0; top: -4.25px; width: 21px; text-align: center; opacity: 0; pointer-events: none;
                           font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased;
                           font-size: 29px; font-weight: 800; line-height: 1.02; letter-spacing: 0; white-space: nowrap;
                           display: flex; justify-content: center; translate: var(--nx, 0px) 0; }
        .month-big.flick .yb-n, .month-big.flick .yb-px { animation-duration: var(--kt); animation-delay: var(--kd);
                                                          animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
        .month-big.flick .fk0 .yb-n { animation-name: ybN0; }  .month-big.flick .fk0 .yb-px { animation-name: ybP0; }
        .month-big.flick .fk1 .yb-n { animation-name: ybN1; }  .month-big.flick .fk1 .yb-px { animation-name: ybP1; }
        .month-big.flick .fk2 .yb-n { animation-name: ybN2; }  .month-big.flick .fk2 .yb-px { animation-name: ybP2; }
        /* switching months: pixel font to pixel font. Each cell flickers between the old month's letter (.yb-old) and
           the new one several times before settling on the new one: the header year's own rhythms (ybN = the one that
           goes, ybP = the one that stays), opacity only, a little later for each letter to the right. */
        .month-big .yb-old { position: absolute; left: var(--ox, 0px); top: 0; opacity: 0; pointer-events: none;
                             font-family: 'Press Start 2P', 'Inter', sans-serif; -webkit-font-smoothing: none; }
        .month-big.swap .yb-old, .month-big.swap .yb-px { animation-duration: var(--kt); animation-delay: var(--kd);
                                                          animation-timing-function: ease-in-out; animation-fill-mode: backwards; }
        .month-big.swap .fk0 .yb-old { animation-name: ybN0; }  .month-big.swap .fk0 .yb-px { animation-name: ybP0; }
        .month-big.swap .fk1 .yb-old { animation-name: ybN1; }  .month-big.swap .fk1 .yb-px { animation-name: ybP1; }
        .month-big.swap .fk2 .yb-old { animation-name: ybN2; }  .month-big.swap .fk2 .yb-px { animation-name: ybP2; }
        .year-intro {
          position: fixed; inset: 0; z-index: 155;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .year-intro-text {
          position: relative; display: flex; font-weight: 800; letter-spacing: -0.02em;
          font-size: 240px; line-height: 1.02;
          transform-origin: 0% 50%;
          transition: transform .4s cubic-bezier(0.5,0,0.15,1);
        }
        .yi-ch {
          display: inline-block;
          /* brushed metal, lit from the middle */
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, rgba(28,33,38,0.10) 1px 2px),
            linear-gradient(103deg,
              #79828b 0%, #626b74 18%, #aab3bb 34%, #e3eaf0 46%,
              #98a1a9 58%, #6b747d 76%, #58616a 100%);
          background-size: auto, 100% 100%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: chIn .38s cubic-bezier(0.22,1,0.36,1) both;
          transition: -webkit-text-fill-color .32s ease, translate .4s cubic-bezier(0.5,0,0.15,1);
        }
        .yi-ch.settled { -webkit-text-fill-color: #e8eaec; }
        @keyframes chIn {
          from { opacity: 0; transform: translateY(64px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* the intro takes the texture of whichever card was pulled out */
        .yi-palladium .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,246,214,0.14) 0 1px, rgba(60,46,16,0.14) 1px 2px),
            linear-gradient(103deg, #a98a49 0%, #7d6430 18%, #f0dcab 42%, #8d7139 62%, #dcc48a 84%, #9a7d40 100%);
        }
        .yi-platinum .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, rgba(60,66,72,0.12) 1px 2px),
            linear-gradient(103deg, #b6bdc4 0%, #79818a 18%, #f6f8fa 42%, #838b94 62%, #dfe4e9 84%, #939ba3 100%);
        }
        .yi-coutts .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, rgba(12,14,17,0.16) 1px 2px),
            linear-gradient(103deg, #6b7178 0%, #33383d 20%, #a8b0b8 44%, #2b2f34 66%, #7d848c 100%);
        }
        .yi-couttspurple .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(240,228,255,0.12) 0 1px, rgba(24,15,36,0.18) 1px 2px),
            linear-gradient(103deg, #7a5ea8 0%, #3a2856 20%, #d3bff0 44%, #33234c 66%, #8b6dbd 100%);
        }
        .yi-ivory .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(210,228,255,0.14) 0 1px, rgba(8,16,34,0.18) 1px 2px),
            linear-gradient(103deg, #3f6bb4 0%, #1a2c52 20%, #b8d0f4 44%, #16274a 66%, #4d7cc4 100%);
        }
        .yi-obsidian .yi-ch {
          background-image:
            repeating-linear-gradient(90deg, rgba(206,238,222,0.14) 0 1px, rgba(6,24,18,0.18) 1px 2px),
            linear-gradient(103deg, #2f6b53 0%, #123326 20%, #a8dcc2 44%, #102c21 66%, #3a7d61 100%);
        }

        .year-nav {
          position: fixed; right: 26px; bottom: 26px; z-index: 30;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          border-radius: 16px; padding: 7px 6px;
          background: rgba(255,255,255,0.055) !important;
          border: 1px solid rgba(255,255,255,0.16) !important;
          backdrop-filter: blur(22px) saturate(170%); -webkit-backdrop-filter: blur(22px) saturate(170%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.22) !important;
        }
        .year-nav .ynav-btn { color: #cbd3db; }
        .ynav-btn {
          background: none; border: none; color: #8a9299; cursor: pointer;
          padding: 6px 8px; border-radius: 9px; line-height: 0;
          /* opacity is in the list so an arrow fades to its greyed-out state at the first or last year, and back */
          transition: color .18s ease, background .18s ease, transform .18s var(--ease-soft), opacity .32s ease;
        }
        .ynav-btn svg { width: 17px; height: 17px; display: block; }
        .ynav-btn:hover:not(:disabled) { color: #e8eaec; background: rgba(255,255,255,0.08); }
        .ynav-btn:active:not(:disabled) { transform: scale(0.92); }
        .ynav-btn:disabled { opacity: 0.25; cursor: default; }

        /* ---------- year stack ---------- */
        /* the stack fills the window between the header and the footer (258px is what those two take), but is never
           smaller than it used to be. --yb is the height of one year: the stack minus the peek at its neighbours. */
        .year-viewport { --yv: max(480px, calc(100vh - 296px)); --yb: calc(var(--yv) - ${YEAR_PEEK}px);
                         height: var(--yv); overflow: hidden; margin-top: 2px; }
        /* quick add (finance yearly panel): one small row between the header and the year stack, which gives up
           QADD_H px of its height for it */
        .year-viewport.with-qadd { --yv: max(480px, calc(100vh - 296px - ${QADD_H}px)); }
        /* the box is 46px tall and starts 8px up in the header's bottom margin; 10px stay clear under it (6 here and
           the stack's own 2px top margin, which no longer folds into the header's) */
        .qadd-row { display: flex; height: ${QADD_H + 6}px; margin-top: -8px; align-items: flex-start; }
        .qadd { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 5px; border-radius: 15px;
                transition: border-color .2s ease; }
        .qadd:focus-within { border-color: rgba(255,255,255,0.15); }
        .qadd input { height: 34px; padding: 0 12px !important; font-size: 13.5px !important; border-radius: 10px !important; }
        .qadd-amt { position: relative; display: inline-block; width: 124px; }
        .qadd-amt input { width: 100%; }
        .qadd-amt > span { font-size: 13.5px !important; }
        .qadd-desc { width: 214px; }
        .qadd-kind { display: inline-flex; align-items: center; gap: 7px; height: 34px; width: 98px; padding: 0 0 0 11px; flex-shrink: 0;
                     background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; color: #c7cdd2;
                     font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .qadd-kind:hover { border-color: #8a9299; color: #e8eaec; }
        .qadd-kind i { width: 7px; height: 7px; border-radius: 99px; background: #ff5d6c; transition: background .2s ease; }
        .qadd.inc .qadd-kind i { background: #3ddc97; }
        .qadd-descbox { position: relative; display: inline-block; }
        .qadd-ph { position: absolute; left: 13px; right: 13px; top: 0; height: 100%; display: flex; align-items: center; overflow: hidden;
                   font-size: 13.5px; color: #757575; pointer-events: none; }   /* the colour of a placeholder */
        .qadd-go { position: relative; width: 38px; height: 34px; border-radius: 10px; flex-shrink: 0; padding: 0; border: none; background: none;
                   cursor: pointer; line-height: 1; color: #2b0d11; transition: color .26s ease; }
        .qadd.inc .qadd-go { color: #07291c; }
        .qadd-go i { position: absolute; inset: 0; border-radius: inherit; transition: opacity .26s ease; }
        .qadd-go .qg-red { background: linear-gradient(160deg,#ff7a86,#e0434f); box-shadow: 0 6px 18px rgba(255,93,108,0.26), inset 0 1px 0 rgba(255,255,255,0.32); }
        .qadd-go .qg-green { background: linear-gradient(160deg,#54e6a8,#2bbd80); box-shadow: 0 6px 18px rgba(61,220,151,0.28), inset 0 1px 0 rgba(255,255,255,0.35); opacity: 0; }
        .qadd.inc .qadd-go .qg-red { opacity: 0; }
        .qadd.inc .qadd-go .qg-green { opacity: 1; }
        .qadd-go svg { position: relative; }
        .qadd-go .qg-v { transform: scaleY(0); transition: transform .3s cubic-bezier(0.4,0,0.2,1); }
        .qadd.inc .qadd-go .qg-v { transform: scaleY(1); }
        /* RollWord: letters leave and arrive one after another */
        .rollw { position: relative; display: inline-block; white-space: pre; }
        .rollw-old { position: absolute; left: 0; top: 0; }
        .rw, .rw-in, .rw-out { display: inline-block; }
        .rw-in { animation: rwIn .34s cubic-bezier(0.22,1,0.36,1) backwards; }
        .rw-out { opacity: 0; animation: rwOut ${RW_OUT_MS}ms ease-in backwards; }
        @keyframes rwIn { from { opacity: 0; transform: translateY(var(--ry)); } }
        @keyframes rwOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(calc(var(--ry) * -1)); } }
        .qadd-done { position: absolute; left: 100%; top: 50%; margin: -11px 0 0 14px; height: 22px; display: inline-flex; align-items: center;
                     gap: 5px; white-space: nowrap; font-size: 12.5px; font-weight: 600; color: #ff8d97; font-variant-numeric: tabular-nums;
                     pointer-events: none; opacity: 0; animation: qaddDone 2.5s ease backwards; }
        .qadd-done.inc { color: #5ee3a9; }
        .qadd-done .msym { font-size: 16px; }
        @keyframes qaddDone {
          0% { opacity: 0; transform: translateX(-8px); } 9% { opacity: 1; transform: translateX(0); }
          78% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(6px); }
        }
        .year-track {
          transition: transform .72s var(--ease-soft);
          will-change: transform;
        }
        .year-track.shifting { opacity: 0.92; }
        .year-block {
          height: var(--yb); padding-top: 4px;
          opacity: 0.13; transform: scale(0.965);
          transition: opacity .6s ease, transform .72s var(--ease-soft);
          cursor: pointer;
        }
        .year-block.active { opacity: 1; transform: scale(1); cursor: default; }
        .year-block-tag {
          font-size: 12px; font-weight: 700; color: #6d757d; letter-spacing: 0.12em;
          margin-bottom: 8px; opacity: 0; transition: opacity .4s ease;
        }
        .year-block:not(.active) .year-block-tag { opacity: 1; }

        /* ---------- launch screen ---------- */
        .launch-veil {
          position: fixed; inset: 0; z-index: 200; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          animation: veilIn .6s ease both;
        }
        .launch-veil.out { animation: veilOut .6s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes veilIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes veilOut { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }

        .bg-dots {
          position: absolute; inset: -10%; pointer-events: none;
          background-image: radial-gradient(rgba(190,205,220,0.05) 1px, transparent 1.1px);
          background-size: 17px 17px;
        }
        .bg-dots.lit {
          background-image: radial-gradient(rgba(205,220,235,0.22) 1.1px, transparent 1.2px);
        }
        .bg-glow { position: absolute; left: 0; top: 0; width: 840px; height: 840px; pointer-events: none; will-change: transform;
                   background: radial-gradient(circle 420px at 50% 50%, rgba(190,205,220,0.07), transparent 70%); }
        .bg-lit-win { position: absolute; left: 0; top: 0; width: 680px; height: 680px; overflow: hidden; pointer-events: none; will-change: transform;
                      -webkit-mask-image: radial-gradient(circle 340px at 50% 50%, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%);
                      mask-image: radial-gradient(circle 340px at 50% 50%, #000 0%, rgba(0,0,0,0.5) 50%, transparent 78%); }
        .bg-lit-win .bg-dots.lit { inset: auto; left: -10vw; top: -10vh; width: 120vw; height: 120vh; will-change: transform; }

        .launch-wrap { position: static; }
        /* wallets panel: the way back to the selections panel. The whole top-left corner is the button;
           its arrow is invisible until the pointer is there (like .month-nav) */
        .pick-back {
          position: fixed; left: 0; top: 0; z-index: 6; width: 76px; height: 76px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; padding: 0; color: #c7cdd2; cursor: pointer;
          opacity: 0; pointer-events: none; transition: opacity .2s ease;
        }
        .pick-back .msym { font-size: 24px; transform: translateX(5px); transition: transform .28s var(--ease); }
        .pick-back.on { pointer-events: auto; }
        .pick-back.on:hover, .pick-back.on:focus-visible { opacity: 1; }
        .pick-back.on:hover .msym, .pick-back.on:focus-visible .msym { transform: none; }
        .pick-back:active { color: #e8eaec; }
        /* the side's title on the wallets panel and the trading panel: pixel letters with real thickness (copies of the
           word set back one behind the other, like the coin's edge), floating and leaning after the pointer.
           Three nested boxes as on the coin: .sw-tilt (pointer, written from JS), .sw-float (idle float), .sw-3d (resting
           pose). Opacity only on .side-word: on those three it would flatten the letters */
        .side-word { position: fixed; left: 0; right: 0; top: 52px; z-index: 5; display: flex; justify-content: center; pointer-events: none;
                     font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 24px; line-height: 1; letter-spacing: 3px;
                     opacity: 0; transform: translateY(-10px); transition: opacity .2s ease, transform .3s var(--ease); }
        .side-word.on { opacity: 1; transform: none; transition: opacity .4s ease .22s, transform .55s var(--ease) .22s; }
        .sw-tilt { transform: perspective(700px); transform-style: preserve-3d; transition: transform .7s cubic-bezier(0.22,1,0.36,1); will-change: transform; }
        .sw-float { transform-style: preserve-3d; animation: swFloat 7s ease-in-out infinite; animation-play-state: paused; }
        .side-word.on .sw-float { animation-play-state: running; }
        @keyframes swFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotateY(-6deg) rotateX(2deg); }
          50%      { transform: translate3d(0, -7px, 0) rotateY(6deg) rotateX(-2deg); }
        }
        .sw-3d { position: relative; transform-style: preserve-3d; }
        .sw-l, .sw-face { font-family: 'Press Start 2P', 'Inter', sans-serif; font-weight: 400; -webkit-font-smoothing: none; }
        .sw-l { position: absolute; left: 0; top: 0; white-space: nowrap; }
        .sw-face { position: relative; display: block; white-space: nowrap; color: #f4f6f8; }
        @keyframes wrapIn { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }

        /* ---------- stage: wallet (phase 1) -> card (phase 2) ---------- */

        .wallet-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: 452px; height: 344px;
          transform: translate(-50%, -50%);
          cursor: pointer; perspective: 1500px;
          /* pre-rasterised layer: sliding/scaling is a pure GPU move, no repaint, no first-frame hitch */
          will-change: transform, opacity, filter;
          /* the blur is always there, of nothing unless the wallet is tucked away (as on the coin): gaining or losing a
             filter makes every layer of the wallet be drawn again, and the first time that happened in a launch (the
             first switch between wallet and coin) it froze a few frames. Now only the blur's strength changes */
          filter: blur(0px);
          /* --cp: how far its card is out (0 in the pocket, 1 out). The wallet drops away by that much */
          --cp: 0; translate: 0 calc(var(--cp) * (50vh + 76px));
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, --cp ${CARD_IN_MS}ms ${CARD_IN_EASE};
        }
        .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; }
        .wallet-unit.side-left  { transform: translate(-50%, -50%) translateX(-430px) scale(0.56); opacity: 0.65; z-index: 3; }
        .wallet-unit.side-right:hover, .wallet-unit.side-left:hover { opacity: 0.92; }
        /* two steps away: parked further out and out of reach until you step across */
        .wallet-unit.far.side-right { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; pointer-events: none; }
        .wallet-unit.far.side-left  { transform: translate(-50%, -50%) translateX(-760px) scale(0.42); opacity: 0; pointer-events: none; }
        /* The card leaves the wallet as one piece, in one move (he asked for no fade, for any change of asset to be
           invisible, and found the first version, which rose, stopped and set off again, janky and too slow).
           One number does all of it: --cp, 0 in the pocket and 1 out, eased once (CARD_OUT_MS out, CARD_IN_MS back).
           The wallet drops away by it; the pocket card cancels that drop, so on screen it only drifts to the middle
           and grows to the big card's size, the pocket's walls hiding it the way they really would; the big card
           makes exactly the same move on top, switched off. Once the card is clear of the pocket (--ct) the big one
           is shown in its place, in the middle of the move; since the two are the same picture on the same spot at
           every moment, when that happens can't be seen. Going back is the same number running down.
           Because everything hangs on that one number, a press in the middle just turns it round from where it is:
           there are no timers and nothing is locked. Stepping to another wallet while the card is still coming back
           hands it to the pocket card at once (.away), which then finishes inside its wallet as that moves aside.
           The number is written to "translate" and to the cards' own transforms, never to a property that has a
           transition of its own (the wallet's "transform" has one). */
        .phase2 .wallet-unit.active { --cp: 1; transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, --cp ${CARD_OUT_MS}ms ${CARD_OUT_EASE}; }
        .phase2 .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(660px) scale(0.45); opacity: 0; pointer-events: none; }
        .phase2 .wallet-unit.side-left  { transform: translate(-50%, -50%) translateX(-660px) scale(0.45); opacity: 0; pointer-events: none; }
        /* selections panel: a carousel of two, built like the wallets. The one in focus is in the middle; the other is
           tucked to the side, smaller, dimmer and a touch out of focus. The other years' wallets stay out of sight.
           The blur is switched, never animated: it comes on once the wallet is most of the way out, and goes
           the moment it starts back. */
        .pick-coin .wallet-unit.active, .markets .wallet-unit.active, .trade .wallet-unit.active {
          transform: translate(-50%, -50%) translateX(-430px) scale(0.56); opacity: 0.65; z-index: 3; filter: blur(2px);
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, filter 0s linear .26s;
        }
        .pick-coin .wallet-unit.active:hover { opacity: 0.92; }
        /* the coin was pressed: the wallet slips away, and the trading selection (coin and IDX globe) takes the stage */
        .markets .wallet-unit.active, .trade .wallet-unit.active { transform: translate(-50%, -50%) translateX(-700px) scale(0.45); opacity: 0; pointer-events: none; }
        .pick .wallet-unit.side-right, .markets .wallet-unit.side-right, .trade .wallet-unit.side-right { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; pointer-events: none; }
        .pick .wallet-unit.side-left, .markets .wallet-unit.side-left, .trade .wallet-unit.side-left { transform: translate(-50%, -50%) translateX(-760px) scale(0.42); opacity: 0; pointer-events: none; }
        .wallet-3d {
          position: absolute; inset: 0; transform-style: preserve-3d;
          will-change: transform;            /* eased per-frame in JS, so no CSS transition on top */
        }

        .holder { position: absolute; inset: 0; }

        /* back wall + visible gusset edge */
        .hold-back {
          position: absolute; left: 0; right: 0; top: 48px; bottom: 0;
          border-radius: 16px;
          background: linear-gradient(180deg, #8d8172 0%, #6d6354 60%, #5d5445 100%);
          box-shadow: 0 30px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14);
        }
        .hold-back::after {
          content: ""; position: absolute; inset: 0; border-radius: 16px;
          border: 1px solid rgba(40,33,24,0.45);
          background:
            radial-gradient(rgba(255,255,255,0.10) 0.6px, transparent 0.7px) 0 0 / 4px 4px,
            radial-gradient(rgba(0,0,0,0.16) 0.6px, transparent 0.7px) 2px 2px / 5px 5px;
          opacity: 0.6;
        }

        /* cards inside the pocket */
        .slot-card {
          position: absolute; left: 34px; width: 384px; height: 242px;
          border-radius: calc(20px * var(--csx, 0.6857)) / calc(20px * var(--csy, 0.7118)); overflow: hidden; z-index: 2;
          box-shadow: 0 6px 14px rgba(0,0,0,0.4);
          will-change: transform, opacity;
          /* out of the pocket (--cp): it cancels the wallet's drop, drifts to the middle of the window (--ty),
             straightens (--rot) and grows to the big card's size */
          --cp: 0; transition: --cp ${CARD_IN_MS}ms ${CARD_IN_EASE};
          translate: 0 calc(var(--cp) * (-50vh - 76px));
          transform: translateY(calc(var(--cp) * var(--ty))) rotate(calc((1 - var(--cp)) * var(--rot)))
                     scale(calc(1 + var(--cp) * (1 / var(--csx, 0.6857) - 1)), calc(1 + var(--cp) * (1 / var(--csy, 0.7118) - 1)));
        }
        /* the face, laid out at the big card's size and scaled to the pocket card's */
        .slot-in { position: absolute; left: 0; top: 0; width: min(560px, 84vw); height: min(340px, 44vh); container-type: inline-size;
                   transform-origin: 0 0; transform: scale(var(--csx, 0.6857), var(--csy, 0.7118));
                   /* a surface of its own, drawn at full size and scaled like the big card's, so the two are the same picture */
                   will-change: transform; }
        /* back card: sits behind both pocket walls */
        .slot-card.gold { top: 10px; --ty: 41px; --rot: -0.6deg; z-index: 2; }
        /* front card: sits inside the front pocket, ahead of the rear wall */
        .slot-card.plat { top: 92px; --ty: -41px; --rot: 0.35deg; z-index: 4; }
        /* the pressed card goes out … */
        .phase2 .wallet-unit.active .slot-card.sel { --cp: 1; transition: --cp ${CARD_OUT_MS}ms ${CARD_OUT_EASE}; }
        /* … and is switched off once the big card stands in for it (a hair later than that one comes on, so there
           is never a frame with neither) */
        .wallet-unit.active .slot-card.sel { opacity: clamp(0, calc((var(--ct, 0.55) + 0.004 - var(--cp)) * 500), 1); }

        /* front pocket with the puzzle panels */
        .puzzle-front {
          position: absolute; left: 0; right: 0; top: 48px; bottom: 0; z-index: 5;
          border-radius: 16px; overflow: hidden;
        }
        /* leather pocket walls that sit IN FRONT of the cards */
        .wall {
          position: absolute; left: 0; right: 0; bottom: 0;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 -1px 0 rgba(255,255,255,0.10), 0 10px 26px rgba(0,0,0,0.4);
        }
        .wall-rear  { top: 118px; z-index: 3; }
        .puzzle-rear { border-radius: 14px; }
        .pz-skin {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.10), transparent 60%),
            linear-gradient(168deg, #8b7f6e 0%, #796d5d 45%, #6a5f50 100%);
        }
        .pz-skin::after {
          content: ""; position: absolute; inset: 0; opacity: 0.45; mix-blend-mode: overlay;
          background:
            radial-gradient(rgba(255,255,255,0.14) 0.6px, transparent 0.7px) 0 0 / 4px 4px,
            radial-gradient(rgba(0,0,0,0.18) 0.6px, transparent 0.7px) 2px 2px / 5px 5px;
        }
        .wall-front { top: 178px; z-index: 5; }
        .wall-lip {
          position: absolute; left: 0; right: 0; top: 0; height: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,0.20), transparent);
        }
        .wall-lip::after {
          content: ""; position: absolute; left: 12px; right: 12px; top: 7px; height: 0;
          border-top: 1.5px dashed rgba(216,222,228,0.34);
        }
        .lp { position: absolute; inset: 0; }
        .lp-main {
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.10), transparent 60%),
            linear-gradient(168deg, #8b7f6e 0%, #796d5d 42%, #6a5f50 78%, #5f5546 100%);
          clip-path: polygon(0 34%, 100% 8%, 100% 100%, 0 100%);
        }
        .lp-wedge {
          background:
            radial-gradient(120% 120% at 10% 90%, rgba(255,255,255,0.08), transparent 60%),
            linear-gradient(150deg, #7d7160 0%, #6b6051 100%);
          clip-path: polygon(0 34%, 0 100%, 72% 100%);
        }
        .lp-seam {
          position: absolute; left: -6%; width: 112%; top: 0; height: 0;
          border-top: 1.5px solid rgba(52,44,33,0.55);
          box-shadow: 0 1.5px 0 rgba(255,255,255,0.12);
          transform-origin: left center;
          top: 34%; transform: rotate(24.5deg);
        }
        .lp-seam::after {
          content: ""; position: absolute; left: 0; right: 0; top: 3px; height: 0;
          border-top: 1.5px dashed rgba(226,215,196,0.55);
        }
        /* stitched lip along the pocket opening */
        .lp-lip {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.16), transparent 14px);
          clip-path: polygon(0 34%, 100% 8%, 100% 11.5%, 0 37.5%);
        }
        .lp-lip::after {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(103deg,
            rgba(226,215,196,0.6) 0 5px, transparent 5px 11px);
          clip-path: polygon(0 38.5%, 100% 12.5%, 100% 14%, 0 40%);
        }
        /* perimeter stitching */
        .lp-stitch {
          position: absolute; inset: 8px; border-radius: 11px;
          border: 1.5px dashed rgba(226,215,196,0.5);
          clip-path: polygon(0 32%, 100% 6%, 100% 100%, 0 100%);
        }
        .anagram {
          position: absolute; right: 40px; bottom: 34px; width: 78px; height: 58px; opacity: 0.55;
          filter: drop-shadow(0 1px 0 rgba(255,255,255,0.18));
        }
        .anagram-dark { opacity: 0.42; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.14)); }
        .leather-shine { position: absolute; inset: 0; pointer-events: none; transition: opacity .45s ease; overflow: hidden; }
        /* the puzzle wallet's front is cut away at a slant, and the cards show through the part cut off: there the light
           keeps to the leather (.lp-main's own outline). As a plain box it also lit the cards, from the wallet's top line
           down: a straight line of light across the back card under the pointer (he sent a picture of it) */
        .puzzle-front .leather-shine { clip-path: polygon(0 34%, 100% 8%, 100% 100%, 0 100%); }
        /* light spot is pre-painted once and slid with transform (200%-size box centred on the cursor) */
        .shine-spot { position: absolute; left: -100%; top: -100%; width: 200%; height: 200%; will-change: transform;
                      transform: translate3d(25%, 25%, 0); }

        /* ---------- Arena lambskin holder ---------- */
        .arena .hold-back {
          background: linear-gradient(180deg, #5c6166 0%, #45494e 60%, #34383c 100%);
        }
        .arena-wall { border-radius: 14px; }
        .ar-base {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 80% at 30% 8%, rgba(255,255,255,0.20), transparent 58%),
            radial-gradient(90% 70% at 82% 96%, rgba(0,0,0,0.30), transparent 66%),
            linear-gradient(168deg, #676c72 0%, #545a60 38%, #43484e 72%, #383c41 100%);
        }
        /* crinkled grain: overlapping crackle lines */
        .ar-crinkle {
          position: absolute; inset: 0; opacity: 0.9; mix-blend-mode: overlay;
          background-image:
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='220' height='220' filter='url(%23n)' opacity='0.55'/></svg>"),
            repeating-linear-gradient(41deg, rgba(255,255,255,0.10) 0 0.8px, transparent 0.8px 17px),
            repeating-linear-gradient(-27deg, rgba(255,255,255,0.08) 0 0.8px, transparent 0.8px 26px),
            repeating-linear-gradient(83deg, rgba(0,0,0,0.12) 0 0.8px, transparent 0.8px 21px),
            repeating-linear-gradient(-66deg, rgba(0,0,0,0.10) 0 0.8px, transparent 0.8px 31px);
          background-size: 220px 220px, auto, auto, auto, auto;
        }
        /* soft creases and worn patches */
        .ar-crinkle::after {
          content: ""; position: absolute; inset: 0; opacity: 0.55;
          background:
            radial-gradient(46% 26% at 22% 34%, rgba(255,255,255,0.16), transparent 70%),
            radial-gradient(38% 22% at 74% 58%, rgba(255,255,255,0.12), transparent 72%),
            radial-gradient(52% 30% at 58% 86%, rgba(0,0,0,0.20), transparent 74%),
            radial-gradient(30% 40% at 8% 72%, rgba(0,0,0,0.16), transparent 76%);
        }
        .ar-gloss {
          position: absolute; inset: 0; pointer-events: none;
          background:
            linear-gradient(158deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 16%, transparent 30%),
            radial-gradient(70% 34% at 68% 90%, rgba(255,255,255,0.12), transparent 72%),
            linear-gradient(0deg, rgba(0,0,0,0.22) 0%, transparent 22%);
        }

        /* darker grey pockets sitting behind the cards */
        .arena .hold-back {
          background: linear-gradient(180deg, #3c4045 0%, #2e3236 60%, #24272b 100%);
        }
        /* the pocket behind the front card reads as a dark recess, like the back panel */
        .ar-pocket .ar-base {
          background:
            radial-gradient(120% 80% at 30% 8%, rgba(255,255,255,0.07), transparent 58%),
            linear-gradient(168deg, #3a3e43 0%, #2e3237 42%, #26292d 74%, #202327 100%);
        }
        .ar-pocket .ar-gloss { opacity: 0.3; }
        .ar-pocket .ar-crinkle { opacity: 0.55; }
        .ar-pocket::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(0,0,0,0.34), rgba(0,0,0,0.12) 26%, transparent 60%);
        }
        /* stitching toned to each panel, same U shape as the python holder */
        /* a single seam tracing the holder: down both sides, round the bottom.
           Drawn on top so it never doubles up where the panels overlap. */
        .seam-outline {
          position: absolute; left: 9px; right: 9px; top: 58px; bottom: 9px;
          border: 1.6px dashed; border-top: none; border-bottom: none; border-radius: 0;
          z-index: 4; pointer-events: none;
        }
        .seam-front {
          position: absolute; left: 9px; right: 9px; top: 0; bottom: 9px;
          border: 1.6px dashed; border-top: none; border-radius: 0 0 13px 13px;
          z-index: 7; pointer-events: none;
        }
        .seam-front-ar { border-color: rgba(24,27,31,0.92); }
        .seam-front-py { border-color: rgba(9,48,33,0.95); }
        .seam-arena  { border-color: rgba(24,27,31,0.9); }
        .seam-python { border-color: rgba(96,26,22,0.9); }
        /* the lower half of the python seam is sewn in dark green over the snakeskin */

        /* ---------- python holder ---------- */
        .py-wall { border-radius: 14px; }
        .python .hold-back {
          background:
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.16), transparent 58%),
            linear-gradient(168deg, #c14a41 0%, #a83b34 52%, #8e2f2a 100%);
        }
        .python .hold-back::after {
          background:
            radial-gradient(rgba(255,255,255,0.20) 0.7px, transparent 0.8px) 0 0 / 5px 5px,
            radial-gradient(rgba(0,0,0,0.22) 0.7px, transparent 0.8px) 2.5px 2.5px / 6px 6px;
          border: 1.5px dashed rgba(150,54,46,0.6);
          border-radius: 16px; opacity: 1;
        }
        .py-skin { position: absolute; inset: 0; }
        .py-green {
          background:
            radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,0.12), transparent 60%),
            linear-gradient(165deg, #2f7d5f 0%, #1d5a44 38%, #14402f 72%, #0e3325 100%);
        }
        .py-red {
          background:
            radial-gradient(rgba(255,255,255,0.18) 0.7px, transparent 0.8px) 0 0 / 5px 5px,
            radial-gradient(rgba(0,0,0,0.20) 0.7px, transparent 0.8px) 2.5px 2.5px / 6px 6px,
            radial-gradient(120% 90% at 30% 8%, rgba(255,255,255,0.16), transparent 58%),
            linear-gradient(168deg, #c14a41 0%, #a83b34 52%, #8e2f2a 100%);
        }
        .py-scales {
          position: absolute; inset: 0; opacity: 0.85;
          background-image:
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(255,255,255,0.16) 60%, transparent 64%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(0,0,0,0.42) 66%, transparent 70%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(255,255,255,0.13) 60%, transparent 64%),
            radial-gradient(ellipse 6px 4.4px at 50% 50%, rgba(0,0,0,0.38) 66%, transparent 70%);
          background-size: 15px 11px, 15px 11px, 15px 11px, 15px 11px;
          background-position: 0 0, 1.2px 1.4px, 7.5px 5.5px, 8.7px 6.9px;
        }
        .py-scales::after {
          content: ""; position: absolute; inset: 0; mix-blend-mode: overlay; opacity: 0.5;
          background:
            radial-gradient(60% 42% at 26% 34%, rgba(255,255,255,0.22), transparent 70%),
            radial-gradient(52% 38% at 74% 76%, rgba(0,0,0,0.30), transparent 72%);
        }

        /* ================= card faces ================= */
        .cf-pattern { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
        .cf-sheen-fixed {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background:
            linear-gradient(118deg, rgba(255,255,255,0.18) 0%, transparent 26%),
            radial-gradient(80% 60% at 78% 92%, rgba(0,0,0,0.2), transparent 70%);
        }
        .cf-content { z-index: 3; }
        .cf-exp { display: inline-flex; align-items: center; gap: 6px; }
        .cf-exp-lbl { font-size: 0.62em; line-height: 1.05; letter-spacing: 0.1em; opacity: 0.75; text-align: right; }

        /* wallet 1 · engraved gold (back) */
        .palladium .cf-metal {
          background:
            radial-gradient(90% 70% at 22% 12%, rgba(255,248,214,0.5), transparent 60%),
            linear-gradient(142deg, #d9bd7d 0%, #a98a49 22%, #f0dcab 42%, #9c7d3f 62%, #e2c98f 82%, #ad8e4d 100%);
        }
        .palladium .cf-grain {
          opacity: 0.5;
          background:
            radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.6px) 0 0 / 3px 3px,
            repeating-linear-gradient(100deg, rgba(255,255,255,0.16) 0 0.6px, rgba(90,70,25,0.10) 1.4px 2px);
        }
        .palladium .cf-pattern { color: #4a3712; mix-blend-mode: multiply; opacity: 0.9; filter: drop-shadow(0 1px 0 rgba(255,246,214,0.5)); }
        .palladium .cf-script { color: rgba(96,72,26,0.9); text-shadow: 0 1.2px 0 rgba(255,246,214,0.75), 0 -1px 1px rgba(50,36,10,0.45); }
        .palladium .cf-name, .palladium .cf-exp { color: rgba(92,70,26,0.88); text-shadow: 0 1px 0 rgba(255,246,214,0.65); }

        /* wallet 1 · engraved silver (front) */
        .platinum .cf-metal {
          background:
            radial-gradient(90% 70% at 24% 10%, rgba(255,255,255,0.55), transparent 60%),
            linear-gradient(142deg, #e9edf1 0%, #b6bdc4 22%, #f6f8fa 42%, #a9b0b7 62%, #e2e6ea 82%, #b9c0c7 100%);
        }
        .platinum .cf-grain {
          opacity: 0.45;
          background: repeating-linear-gradient(100deg, rgba(255,255,255,0.35) 0 0.5px, rgba(110,120,130,0.12) 1.4px 2px);
        }
        .platinum .cf-pattern { color: #4c565f; mix-blend-mode: multiply; opacity: 0.72; filter: drop-shadow(0 1px 0 rgba(255,255,255,0.65)); }
        .platinum .cf-script { color: rgba(96,105,115,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.9), 0 -1px 1px rgba(40,48,56,0.35); }
        .platinum .cf-name, .platinum .cf-exp { color: rgba(92,100,110,0.88); text-shadow: 0 1px 0 rgba(255,255,255,0.8); }

        /* wallet 2 · carbon weave (back) */
        .coutts .cf-metal {
          background: linear-gradient(146deg, #6b7278 0%, #3d4349 28%, #7d858c 50%, #363b41 76%, #616970 100%);
        }
        .coutts .cf-grain {
          opacity: 0.6;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 4px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.24) 0 2px, transparent 2px 4px);
        }
        .coutts .cf-script { color: rgba(214,222,230,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.18), 0 -1px 2px rgba(0,0,0,0.6); }
        .coutts .cf-name, .coutts .cf-exp { color: rgba(206,215,224,0.86); text-shadow: 0 1px 1px rgba(0,0,0,0.55); }

        /* wallet 2 · carbon weave, dark purple (front) */
        .couttspurple .cf-metal {
          background: linear-gradient(146deg, #7a5ea8 0%, #3a2856 28%, #8b6dbd 50%, #33234c 76%, #6b5296 100%);
        }
        .couttspurple .cf-grain {
          opacity: 0.6;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.13) 0 2px, transparent 2px 4px),
            repeating-linear-gradient(-45deg, rgba(0,0,0,0.26) 0 2px, transparent 2px 4px);
        }
        .couttspurple .cf-script { color: rgba(232,220,250,0.9); text-shadow: 0 1.2px 0 rgba(255,255,255,0.16), 0 -1px 2px rgba(18,10,28,0.65); }
        .couttspurple .cf-name, .couttspurple .cf-exp { color: rgba(226,214,246,0.86); text-shadow: 0 1px 1px rgba(18,10,28,0.6); }

        /* wallet 3 · sapphire blue (front) */
        .ivory .cf-metal {
          background:
            radial-gradient(70% 55% at 84% 8%, rgba(240,226,178,0.5), transparent 56%),
            radial-gradient(80% 60% at 12% 96%, rgba(4,10,26,0.75), transparent 62%),
            linear-gradient(142deg, #3f6ec4 0%, #24447f 26%, #16294f 52%, #0c1730 74%, #1b3566 100%);
        }
        .ivory .cf-grain { opacity: 0.25; background: repeating-linear-gradient(100deg, rgba(255,255,255,0.2) 0 0.5px, rgba(0,0,0,0.16) 1.4px 2px); }
        .ivory .cf-pattern { color: #9fc0f0; mix-blend-mode: soft-light; opacity: 0.95; }
        .ivory .cf-script { color: rgba(126,166,224,0.92); text-shadow: 0 1.2px 0 rgba(190,214,248,0.3), 0 -1px 2px rgba(4,12,30,0.75); }
        .ivory .cf-name, .ivory .cf-exp { color: rgba(132,168,222,0.9); text-shadow: 0 1px 0 rgba(190,214,248,0.24), 0 -1px 1px rgba(4,12,30,0.65); }

        /* wallet 3 · deep green (back) */
        .obsidian .cf-metal {
          background:
            radial-gradient(70% 55% at 84% 8%, rgba(226,238,196,0.42), transparent 56%),
            radial-gradient(80% 60% at 12% 96%, rgba(3,16,11,0.75), transparent 62%),
            linear-gradient(142deg, #2f7458 0%, #1a4835 26%, #102c21 52%, #081a13 74%, #17402f 100%);
        }
        .obsidian .cf-grain { opacity: 0.25; background: repeating-linear-gradient(100deg, rgba(255,255,255,0.18) 0 0.5px, rgba(0,0,0,0.18) 1.4px 2px); }
        .obsidian .cf-pattern { color: #97cfb1; mix-blend-mode: soft-light; opacity: 0.95; }
        .obsidian .cf-script { color: rgba(112,180,146,0.92); text-shadow: 0 1.2px 0 rgba(180,224,202,0.28), 0 -1px 2px rgba(4,20,14,0.75); }
        .obsidian .cf-name, .obsidian .cf-exp { color: rgba(120,184,152,0.9); text-shadow: 0 1px 0 rgba(180,224,202,0.22), 0 -1px 1px rgba(4,20,14,0.65); }

        .anagram-py { opacity: 0.5; }


        /* the pulled-out card, centred on screen */
        .big-card {
          position: fixed; left: 50%; top: 50%; z-index: 12;
          width: min(560px, 84vw); height: min(340px, 44vh);
          cursor: pointer; perspective: 1300px;
          will-change: transform, opacity;
          /* the pocket card's own move, made on top of it: from its spot (--py: its middle against the window's), tilt
             and size to the middle of the window. Switched off until the card is clear of the pocket (--ct), but drawn
             all along (will-change keeps it ready, so taking over costs nothing) */
          --cp: 0; --cq: var(--cp); --py: 41px; --rot: 0.35deg;
          opacity: clamp(0, calc((var(--cp) - var(--ct, 0.55)) * 500), 1); pointer-events: none;
          transition: --cp ${CARD_IN_MS}ms ${CARD_IN_EASE};
          transform: translate(-50%, -50%) translateY(calc((1 - var(--cp)) * var(--py))) rotate(calc((1 - var(--cp)) * var(--rot)))
                     scale(calc(var(--csx, 0.6857) + var(--cp) * (1 - var(--csx, 0.6857))), calc(var(--csy, 0.7118) + var(--cp) * (1 - var(--csy, 0.7118))));
        }
        .big-card.from-back { --py: -41px; --rot: -0.6deg; }
        .phase2 .big-card { --cp: 1; pointer-events: auto; transition: --cp ${CARD_OUT_MS}ms ${CARD_OUT_EASE}; }
        /* its wallet is no longer the one in the middle: the pocket card has it */
        .big-card.away { opacity: 0; }
        /* its shadow: the pocket card's own where it takes over, the deep one once it is out (--cq is --cp handed down) */
        .card-shadow { position: absolute; inset: 0; border-radius: 20px; pointer-events: none; }
        .card-shadow.near { box-shadow: 0 calc(6px / var(--csy, 0.7118)) calc(14px / var(--csx, 0.6857)) rgba(0,0,0,0.4);
                            opacity: clamp(0, calc((1 - var(--cq)) / (1 - var(--ct, 0.55))), 1); }
        .card-shadow.far { box-shadow: 0 34px 80px rgba(0,0,0,0.55); transition: box-shadow .4s ease;
                           opacity: clamp(0, calc((var(--cq) - var(--ct, 0.55)) / (1 - var(--ct, 0.55))), 1); }
        .big-card:hover .card-shadow.far { box-shadow: 0 46px 110px rgba(0,0,0,0.6); }
        /* the lights on the card come on only once it is out, and are gone before the pocket card takes over */
        .phase2 .card-sheen:not(.lit) { transition-delay: .25s; }
        .phase1 .card-gloss, .phase1 .card-sheen, .phase1 .card-edge { transition-duration: .1s; }
        .card-tilt { width: 100%; height: 100%; transform-style: preserve-3d; will-change: transform; }
        .big-card.out, .wallet-unit.out { animation: cardOut .55s cubic-bezier(0.5,0,0.75,0) both; }
        @keyframes cardOut { to { opacity: 0; transform: translate(-50%, -50%) translateY(-30px) scale(1.07); } }
        /* the idle float only runs once the card is out, from rest (so it adds nothing at the hand-over) */
        .launch-float { width: 100%; height: 100%; transform-style: preserve-3d; }
        .phase2 .launch-float { animation: floaty 7s ease-in-out ${CARD_OUT_MS}ms infinite; }
        .launch-float.still { animation-play-state: paused; }
        @keyframes floaty {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
          50%  { transform: translate3d(0, -12px, 0) rotate(0.4deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }

        /* ---------- selections panel: the trading coin ---------- */
        /* a unit like a wallet (placed, scaled and faded as one layer) with the 3D coin inside. In focus it sits in
           the middle; out of focus it is tucked to the right exactly like the next wallet would be */
        .coin-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: ${COIN_D}px; height: ${COIN_D}px; border-radius: 50%;     /* round, so only the coin itself answers the pointer */
          transform: translate(-50%, -50%);
          cursor: pointer;
          /* the blur is always there, of nothing while in focus: bringing the coin into focus then only changes its
             strength, instead of rebuilding how the whole 3D coin is drawn in the middle of the move */
          filter: blur(0px);
          will-change: transform, opacity, filter;
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, visibility 0s;
        }
        /* tucked away. The blur is switched, never animated (see the wallet above). Coming back from the wallets panel
           it waits a moment, so it never shows through the wallet that is leaving the same spot */
        .coin-unit.side { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; filter: blur(2px);
                          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease .12s, filter 0s linear .26s, visibility 0s; }
        .coin-unit.side:hover { opacity: 0.92; }
        /* trading selection with the globe in focus: the coin is tucked to the left instead */
        .coin-unit.side.left { transform: translate(-50%, -50%) translateX(-430px) scale(0.56); }
        /* the other one was pressed: this one just fades where it is */
        .coin-unit.side.gone, .idx-unit.side.gone { opacity: 0; pointer-events: none; }
        /* wallets panel: it drops back and is gone before the next wallet arrives in its place, then is switched off
           so it costs nothing there */
        .coin-unit.away { transform: translate(-50%, -50%) translateX(520px) scale(0.42); opacity: 0; visibility: hidden; pointer-events: none; filter: blur(2px);
                          transition: transform .5s cubic-bezier(0.22,1,0.36,1), opacity .18s ease, visibility 0s linear .5s; }
        .coin-shadow { position: absolute; inset: -16%; border-radius: 50%; pointer-events: none; transform: translate3d(6px, 36px, 0) scale(0.94, 1); will-change: transform;
                       background: radial-gradient(closest-side, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.16) 70%, transparent 100%); }
        /* three nested 3D boxes: the cursor tilt (written from JS), the idle float, and the coin in its resting pose */
        .coin-tilt, .coin-float, .coin-3d { position: absolute; inset: 0; transform-style: preserve-3d; }
        .coin-tilt { pointer-events: none; will-change: transform; }
        /* the float runs only while the coin is in focus, and holds still under the pointer */
        .coin-float { animation: coinFloat 7s ease-in-out infinite; }
        .coin-float.still { animation-play-state: paused; }
        @keyframes coinFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotateY(0deg) rotateX(0deg); }
          50%      { transform: translate3d(0, -9px, 0) rotateY(7deg) rotateX(-2.5deg); }
        }
        .coin-3d { transform: rotateX(${COIN_REST.rx}deg) rotateY(${COIN_REST.ry}deg); transition: transform .7s cubic-bezier(0.22,1,0.36,1); }
        /* trading panel (coin and globe): the coin turns to face forward (he asked for it) */
        .markets .coin-3d, .trade .coin-3d { transform: rotateX(0deg) rotateY(0deg); }
        /* pressed: a coin toss, seen from the front. It springs up and spins end over end about its level axis, three
           times round, quick off the thumb and slowing as it comes down, and lands facing forward. Before it faced
           forward it also turned once round sideways on the way; from the forward pose that sent it through slanted
           poses, which he found very weird. Keep it a plain end-over-end spin. The lean it had under the pointer is
           let go of at once (enterTrade), so it spins about a level axis. */
        .trade-crypto .coin-3d { animation: coinFlip 1.1s cubic-bezier(0.25,0.2,0.15,1) forwards, coinHop 1.1s linear; }
        /* the flip's motion blur: directional, along the tumble (up and down), like a real one. CSS can only blur
           evenly, so three plain boxes sit round the coin: the middle one blurs, while the outer one squeezes it
           sideways to a quarter and the inner one stretches it back four times. The blur is therefore four times
           weaker sideways than up and down. Strongest while the coin is fastest, gone as it settles. The boxes do
           nothing outside the flip, and they are outside the 3D boxes (a filter there would flatten the coin); the
           innermost one carries the perspective. An SVG blur filter did this too, but made the flip stutter. */
        .coin-smear, .coin-smear > div, .coin-smear > div > div { position: absolute; inset: 0; pointer-events: none; }
        .coin-smear > div > div { perspective: 1300px; }
        .trade-crypto .coin-smear { transform: scaleX(0.25); }
        .trade-crypto .coin-smear > div { animation: coinBlur 1.1s linear backwards; }
        .trade-crypto .coin-smear > div > div { transform: scaleX(4); }
        @keyframes coinBlur { 0% { filter: blur(0px); } 12% { filter: blur(11px); } 44% { filter: blur(8px); } 82%, 100% { filter: blur(0px); } }
        /* a tossed coin tumbles about an axis that is not quite level: one axis for the whole toss, leaning out of the
           level one (X with a share of Y), so both turn together and it still lands facing forward */
        @keyframes coinFlip { from { transform: rotate3d(1, var(--flip-lean, 0.4), 0, 0deg); } to { transform: rotate3d(1, var(--flip-lean, 0.4), 0, var(--flip-deg, 1080deg)); } }
        @keyframes coinHop {
          0%   { translate: 0 0; animation-timing-function: cubic-bezier(0.2,0.7,0.4,1); }
          40%  { translate: 0 -46px; animation-timing-function: cubic-bezier(0.6,0,0.8,0.4); }
          100% { translate: 0 0; }
        }
        /* will-change on everything the coin is painted on (faces, their layers, the edge strips): they are then
           painted once at full size, even while the coin sits tucked away at half size. Without it they were painted
           small, and had to be painted again, big, the first time the coin grew into focus: a visible hitch. */
        .coin-face, .cn-layer, .cn-lustre, .cn-strip { will-change: transform; }
        .coin-face { position: absolute; inset: 0; border-radius: 50%; backface-visibility: hidden; }
        .coin-face.front { transform: translateZ(${COIN_T / 2}px); }
        .coin-face.back { transform: rotateY(180deg) translateZ(${COIN_T / 2}px); }
        .cn-layer { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        /* lustre: a soft sheen across the field, lighter along one diagonal and darker along the other. On the front
           it is turned from JS as the coin tilts */
        .cn-lustre { position: absolute; inset: 0; border-radius: 50%;
                     background: conic-gradient(from 315deg,
                       rgba(255,251,232,0.36) 0deg, rgba(255,251,232,0.10) 28deg, rgba(60,36,4,0) 52deg, rgba(60,36,4,0.16) 90deg,
                       rgba(60,36,4,0) 128deg, rgba(255,251,232,0.07) 154deg, rgba(255,251,232,0.24) 180deg, rgba(255,251,232,0.07) 206deg,
                       rgba(60,36,4,0) 232deg, rgba(60,36,4,0.16) 270deg, rgba(60,36,4,0) 308deg, rgba(255,251,232,0.10) 332deg,
                       rgba(255,251,232,0.36) 360deg); }
        /* trading panel: a light that follows the pointer over the front face (moved from JS), there only under the
           pointer. A plain pale gold glow, no blend mode; the round box cuts it off at the coin's rim */
        .cn-glare { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none;
                    opacity: 0; transition: opacity .4s ease; will-change: opacity; }
        .markets .coin-unit:not(.side):hover .cn-glare { opacity: 1; }
        .cn-glare i { position: absolute; left: -50%; top: -50%; width: 200%; height: 200%; display: block; will-change: transform;
                      background: radial-gradient(closest-side, rgba(255,252,236,0.62) 0%, rgba(255,247,214,0.3) 16%, rgba(255,240,190,0.1) 38%, rgba(255,240,190,0) 62%); }
        /* one flat strip of the smooth edge. Its two shades (--a at one side, --b at the other) are worked out per
           strip in COIN_STRIPS; the edge also darkens a little towards the back of the coin */
        .cn-strip { position: absolute; left: 50%; top: 50%; display: block; backface-visibility: hidden;
                    width: ${COIN_STRIP_W}px; height: ${COIN_T}px; margin: ${-COIN_T / 2}px 0 0 ${-COIN_STRIP_W / 2}px;
                    background:
                      linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0) 42%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.16)),
                      linear-gradient(90deg, var(--a), var(--b)); }

        /* ---------- trading selection: the IDX globe (Indonesian stocks) ---------- */
        /* a unit like the coin: in the middle when in focus, tucked to the right when not, and out of sight (switched
           off) everywhere but the trading selection */
        .idx-unit {
          position: fixed; left: 50%; top: 50%; z-index: 4;
          width: 300px; height: 300px; border-radius: 50%;
          transform: translate(-50%, -50%);
          cursor: pointer;
          filter: blur(0px);                 /* always there, as on the coin and the wallet: only its strength changes */
          will-change: transform, opacity, filter;
          transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease, visibility 0s;
        }
        .idx-unit.side { transform: translate(-50%, -50%) translateX(430px) scale(0.56); opacity: 0.65; z-index: 3; filter: blur(2px);
                         transition: transform .8s cubic-bezier(0.22,1,0.36,1), opacity .5s ease .12s, filter 0s linear .26s, visibility 0s; }
        .idx-unit.side:hover { opacity: 0.92; }
        .idx-unit.away { transform: translate(-50%, -50%) translateX(760px) scale(0.42); opacity: 0; visibility: hidden; pointer-events: none; filter: blur(2px);
                         transition: transform .5s cubic-bezier(0.22,1,0.36,1), opacity .18s ease, visibility 0s linear .5s; }
        .idx-halo { position: absolute; inset: -16%; border-radius: 50%; pointer-events: none; transform: translate3d(6px, 36px, 0) scale(0.94, 1);
                    background: radial-gradient(closest-side, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.42) 42%, rgba(0,0,0,0.16) 70%, transparent 100%); }
        /* the globe and its wordmark, laid out as in the logo. Pressed, the whole thing lifts and shrinks a little so
           the wordmark has room under the globe, the globe spins once, and the wordmark comes up */
        .idx-lift { position: absolute; inset: 0; pointer-events: none; transition: transform .9s cubic-bezier(0.22,1,0.36,1); }
        .idx-unit.go { cursor: default; }
        .idx-unit.go .idx-lift { transform: translateY(-128px) scale(0.8); }
        .idx-unit.go .idx-halo { opacity: 0; transition: opacity .4s ease; }
        .idx-disc { position: absolute; inset: 0; border-radius: 50%;
                    background: linear-gradient(135deg, #d2261f 6%, #c0221f 30%, #a32422 55%, #85262a 78%, #6f2529 96%); }
        .idx-bands, .idx-word, .idx-gl { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; overflow: visible; }
        /* the idle float: it bobs gently while in focus (the slow turn to and fro that goes with it is drawn in
           stepGlobe), and holds still under the pointer */
        .idx-float { position: absolute; inset: 0; animation: idxFloat 7s ease-in-out infinite; }
        .idx-float.still { animation-play-state: paused; }
        @keyframes idxFloat { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -9px, 0); } }
        /* what makes the flat logo a ball: a soft light from the upper left and a darker limb on the far side */
        .idx-gloss { position: absolute; inset: 0; border-radius: 50%;
                     background: radial-gradient(60% 55% at 30% 24%, rgba(255,255,255,0.22), rgba(255,255,255,0) 62%),
                                 radial-gradient(90% 90% at 70% 78%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.22) 100%); }
        .idx-ground { position: absolute; left: -2%; right: -2%; top: 99.2%; height: 5%; border-radius: 50%;
                      background: radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0)); }
        .idx-word { visibility: hidden; opacity: 0; transform: translateY(16px); }
        .idx-unit.go .idx-word { visibility: visible; opacity: 1; transform: none;
                                 transition: opacity .55s ease .38s, transform .8s cubic-bezier(0.22,1,0.36,1) .38s; }

        /* ---------- metal cards ---------- */
        .launch-card {
          container-type: inline-size;
          position: relative; width: 100%; height: 100%;
          border-radius: 20px; overflow: hidden; isolation: isolate;
        }

        .cardface { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
        .cf-metal { position: absolute; inset: 0; }
        /* very fine brushed grain — barely visible */
        .cf-grain {
          position: absolute; inset: 0; opacity: 0.28;
          background: repeating-linear-gradient(100deg,
            rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 0.5px,
            rgba(120,128,136,0.10) 1.5px, rgba(120,128,136,0.10) 2px);
        }
        .cf-content {
          position: absolute; inset: 0; padding: 8.5% 7%; z-index: 2;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .sim { width: 13%; min-width: 34px; height: auto; margin-top: 8.5%; }
        /* the crocodile, top-left like an issuer's mark, in its original colours; the card's sheen passes over it */
        .cf-logo { position: absolute; left: 7cqw; top: 5.4cqw; width: 7.6cqw; height: auto; pointer-events: none; user-select: none; }
        /* cut-in depth: light edge underneath, soft shadow on top — the same pressed-in look as the card text */
        .palladium .cf-logo    { filter: drop-shadow(0 0.22cqw 0 rgba(255,246,214,0.55)) drop-shadow(0 -0.16cqw 0.12cqw rgba(50,34,8,0.4)); }
        .platinum .cf-logo     { filter: drop-shadow(0 0.22cqw 0 rgba(255,255,255,0.75)) drop-shadow(0 -0.16cqw 0.12cqw rgba(40,48,56,0.32)); }
        .coutts .cf-logo       { filter: drop-shadow(0 0.2cqw 0 rgba(255,255,255,0.16)) drop-shadow(0 -0.16cqw 0.14cqw rgba(0,0,0,0.55)); }
        .couttspurple .cf-logo { filter: drop-shadow(0 0.2cqw 0 rgba(240,226,255,0.16)) drop-shadow(0 -0.16cqw 0.14cqw rgba(10,4,20,0.6)); }
        .ivory .cf-logo        { filter: drop-shadow(0 0.2cqw 0 rgba(190,214,248,0.2)) drop-shadow(0 -0.16cqw 0.14cqw rgba(2,6,16,0.6)); }
        .obsidian .cf-logo     { filter: drop-shadow(0 0.2cqw 0 rgba(180,224,202,0.18)) drop-shadow(0 -0.16cqw 0.14cqw rgba(2,10,6,0.6)); }
        .cf-script {
          position: absolute; right: 7%; top: 12%;
          font-family: 'Mrs Saint Delafield', cursive; font-size: clamp(38px, 8.6cqw, 74px);
          color: rgba(58,63,69,0.78); line-height: 1;
          text-shadow: 0 1px 0 rgba(255,255,255,0.7), 0 -1px 1px rgba(0,0,0,0.18);
        }
        .cf-foot { display: flex; align-items: baseline; justify-content: space-between; }
        .cf-name {
          font-size: clamp(9px, 2.6cqw, 15px); font-weight: 600; letter-spacing: 0.18em; color: rgba(62,68,75,0.8);
          text-shadow: 0 1px 0 rgba(255,255,255,0.65);
        }
        .cf-exp {
          font-size: clamp(7px, 2cqw, 11px); font-weight: 600; letter-spacing: 0.14em; color: rgba(78,84,91,0.75);
          text-shadow: 0 1px 0 rgba(255,255,255,0.6);
        }

        .card-gloss { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity .45s ease; z-index: 3; }
        .card-sheen {
          position: absolute; inset: -30%; pointer-events: none; mix-blend-mode: screen; z-index: 3;
          transition: opacity .45s ease;
          background: linear-gradient(100deg,
            transparent 32%, rgba(255,255,255,0.18) 44%, rgba(255,255,255,0.42) 50%,
            rgba(255,255,255,0.14) 56%, transparent 70%);
        }
        .card-edge {
          position: absolute; inset: 0; border-radius: 20px; padding: 1.4px; pointer-events: none; z-index: 4;
          transition: opacity .4s ease;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }
        .card-edge-blur.on { backdrop-filter: blur(7px) saturate(150%); -webkit-backdrop-filter: blur(7px) saturate(150%); animation: fadeIn .4s ease backwards; }
        .card-edge-blur {
          position: absolute; inset: 0; border-radius: 20px; padding: 7px; pointer-events: none; z-index: 4;
          transition: opacity .4s ease;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
        }

        /* ---------- leather card holder ---------- */


        .msym { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal; line-height: 1; letter-spacing: normal; text-transform: none; display: inline-block; white-space: nowrap; direction: ltr; -webkit-font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; transition: font-variation-settings .3s ease, transform .3s ease; }
        .cat-swap { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; overflow: hidden; }
        .cat-swap .glyph { position: absolute; transition: transform .26s cubic-bezier(0.34,1.25,0.64,1), opacity .2s ease; }
        .cat-swap .g-base { transform: scale(1); opacity: 1; }
        .cat-swap .g-hover { transform: scale(0.72); opacity: 0; }
        .cat-swap.on .g-base { transform: scale(1.28); opacity: 0; }
        .cat-swap.on .g-hover { transform: scale(1.18); opacity: 1; font-variation-settings: 'FILL' 1; }
        .ham-btn { transition: border-color .18s ease, color .18s ease; }
        .ham-btn:hover { border-color: #8a9299 !important; color: #e8eaec !important; }
        .ham-btn svg rect { transform-box: fill-box; }
        .ham-btn:hover .l1 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) 0s both; }
        .ham-btn:hover .l2 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) .07s both; }
        .ham-btn:hover .l3 { animation: hamSlide .34s cubic-bezier(0.55,0,0.35,1) .14s both; }
        @keyframes hamSlide {
          0% { transform: translateX(0); }
          46% { transform: translateX(16px); }
          47% { transform: translateX(-16px); }
          100% { transform: translateX(0); }
        }
        .flow-wrap.down { animation: flowDown .34s cubic-bezier(0.4,0,0.2,1) both; }
        .flow-wrap.up { animation: flowUp .34s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes flowDown { from { opacity: 0; transform: translateY(-26px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes flowUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
        .dot-in { animation: dotIn .26s cubic-bezier(0.34,1.35,0.64,1) both; }
        .dot-out { animation: dotOut .22s ease both; }
        @keyframes dotIn { from { opacity: 0; transform: scale(0.2); } 70% { transform: scale(1.25); } to { opacity: 1; transform: scale(1); } }
        @keyframes dotOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.2); } }
        .bk-btn {
          background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.10);
          color: #8a9299; border-radius: 9px; padding: 4px 11px; font-size: 11.5px;
          font-weight: 600; letter-spacing: 0.04em; cursor: pointer;
          transition: color .18s ease, border-color .18s ease, background .18s ease;
        }
        .bk-btn:hover { color: #e8eaec; border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.08); }
        /* recap */
        .recap-link { cursor: pointer; transition: opacity .18s ease, text-shadow .25s ease; }
        .recap-link:hover { opacity: .86; text-shadow: 0 0 22px rgba(255,255,255,0.18); }
        .wr-modal { border-radius: 24px; width: min(980px, 94vw); max-height: 90vh; overflow: auto; padding: 20px 22px 22px; transform-origin: center center;
                    background: radial-gradient(60% 50% at 0% 0%, rgba(61,220,151,0.10), transparent 70%),
                                radial-gradient(50% 60% at 100% 100%, rgba(127,182,224,0.10), transparent 70%), rgba(28,31,35,0.86) !important; }
        .wr-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(132px, auto); gap: 12px; margin-top: 8px; }
        .wr-tile { position: relative; overflow: hidden; border-radius: 18px; padding: 16px 18px;
                   background: radial-gradient(130% 120% at 0% 0%, color-mix(in srgb, var(--acc) 17%, transparent), transparent 62%), rgba(255,255,255,0.035);
                   border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
                   animation: wrIn .6s cubic-bezier(0.22,1,0.36,1) both; transition: transform .25s cubic-bezier(0.22,1,0.36,1), border-color .25s ease, box-shadow .25s ease; }
        .wr-tile:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--acc) 40%, rgba(255,255,255,0.08)); }
        .wr-tile.wr-hero { grid-column: span 2; grid-row: span 2; display: flex; flex-direction: column; padding: 20px 22px 16px;
                   background: radial-gradient(90% 80% at 0% 0%, color-mix(in srgb, var(--acc) 24%, transparent), transparent 65%),
                               radial-gradient(70% 70% at 100% 100%, rgba(127,182,224,0.14), transparent 70%), rgba(255,255,255,0.04); }
        .wr-tile.wr-wide { grid-column: span 2; }
        .wr-tile.wr-row { display: flex; align-items: center; gap: 14px; }
        .wr-ico { font-size: 15px !important; color: var(--acc); }
        @keyframes wrIn { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        .wr-bars { margin-top: auto; padding-top: 18px; display: flex; align-items: stretch; gap: 3px; height: 150px; }
        .wr-bar-col { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; padding-bottom: 16px; }
        .wr-bar-half { flex: 1; display: flex; align-items: flex-end; justify-content: center; }
        .wr-bar-half.down { align-items: flex-start; border-top: 1px solid rgba(255,255,255,0.12); }
        .wr-bar { display: block; width: 100%; max-width: 22px; border-radius: 5px; animation: wrGrow .7s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-bar.up { background: linear-gradient(180deg, #7ef0bd, #3ddc97); transform-origin: bottom; border-radius: 5px 5px 2px 2px; }
        .wr-bar.dn { background: linear-gradient(0deg, #ff97a0, #ff5d6c); transform-origin: top; border-radius: 2px 2px 5px 5px; }
        .wr-bar.none { height: 3px; background: rgba(255,255,255,0.10); animation: none; margin-top: -2px; }
        @keyframes wrGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .wr-bar-lbl { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); font-size: 10px; color: #6d757d; }
        .wr-bars { position: relative; }
        .wr-bar-col { cursor: default; transition: opacity .2s ease; }
        .wr-bar-tip { position: absolute; top: 0; transform: translate(-50%, -60%); z-index: 3; pointer-events: none;
                      display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 11px; border-radius: 10px;
                      background: rgba(24,27,31,0.92); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 8px 22px rgba(0,0,0,0.4);
                      white-space: nowrap; animation: tipIn .16s ease both; transition: left .18s cubic-bezier(0.22,1,0.36,1); }
        @keyframes tipIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -60%); } }
        .wr-tile.clickable { cursor: pointer; }
        .wr-tile.active { border-color: color-mix(in srgb, var(--acc) 65%, transparent);
                          box-shadow: 0 0 0 1px color-mix(in srgb, var(--acc) 35%, transparent), 0 10px 30px color-mix(in srgb, var(--acc) 14%, transparent); }
        .wr-more { position: absolute; top: 14px; right: 14px; font-size: 16px !important; color: #6d757d; opacity: 0;
                   transform: translate(-4px, 4px); transition: opacity .2s ease, transform .25s cubic-bezier(0.22,1,0.36,1), color .2s ease; }
        .wr-tile.clickable:hover .wr-more, .wr-tile.active .wr-more { opacity: 1; transform: none; color: var(--acc); }
        .wr-stack-seg, .wr-leg { cursor: pointer; }
        .wr-leg { transition: color .15s ease; }
        .wr-leg:hover { color: #e8eaec; }
        .wr-detail { border-radius: 18px; padding: 16px 18px 12px; border: 1px solid rgba(255,255,255,0.08);
                     background: radial-gradient(90% 140% at 0% 0%, color-mix(in srgb, var(--acc) 12%, transparent), transparent 60%), rgba(255,255,255,0.03); }
        .wr-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
        .wr-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 5px 10px; border-radius: 99px; cursor: pointer;
                   background: none; color: #8a9299; border: 1px solid rgba(255,255,255,0.1); transition: all .18s ease; }
        .wr-chip:hover { color: #e8eaec; }
        .wr-chip.on { color: var(--acc); border-color: color-mix(in srgb, var(--acc) 55%, transparent); background: color-mix(in srgb, var(--acc) 10%, transparent); }
        .wr-seg { display: inline-flex; padding: 2px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
        .wr-seg button { background: none; border: none; color: #8a9299; font-size: 12px; padding: 4px 10px; border-radius: 8px; cursor: pointer; transition: all .18s ease; }
        .wr-seg button.on { background: rgba(255,255,255,0.1); color: #e8eaec; }
        /* the same switch with a grey box that slides between the choices (SlideSeg) */
        .wr-seg.slide { position: relative; }
        .wr-seg.slide button { position: relative; z-index: 1; }
        .wr-seg.slide button.on { background: none; }
        .seg-box, .seg-fill { position: absolute; left: 0; width: 100%; border-radius: 8px; will-change: transform; }
        .seg-box { top: 2px; bottom: 2px; overflow: hidden; pointer-events: none; }
        .seg-fill { top: 0; bottom: 0; background: rgba(255,255,255,0.1); }
        .wr-seg.slide.go .seg-box, .wr-seg.slide.go .seg-fill { transition: transform .34s var(--ease-soft); }
        .wr-list { display: flex; flex-direction: column; }
        .wr-li { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 8px 2px;
                 border-top: 1px solid rgba(255,255,255,0.05); animation: fadeRight .36s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-li:first-child { border-top: none; }
        .wr-li-rank { font-size: 12px; font-weight: 800; color: #6d757d; text-align: center; font-variant-numeric: tabular-nums; }
        .wr-li-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .wr-li-name { font-size: 13.5px; font-weight: 600; color: #e8eaec; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wr-li-track { height: 5px; border-radius: 99px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .wr-li-fill { display: block; height: 100%; border-radius: 99px; transform-origin: left; animation: wrGrowX .6s cubic-bezier(0.22,1,0.36,1) both; }
        .wr-li-val { display: flex; flex-direction: column; align-items: flex-end; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .wr-li-sub { font-size: 11px; font-weight: 500; color: #6d757d; margin-top: 1px; }
        .wr-two { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        @media (max-width: 760px) { .wr-two { grid-template-columns: 1fr; } }
        .wr-ring { animation: wrRing 1.1s cubic-bezier(0.22,1,0.36,1) .4s both; }
        @keyframes wrRing { from { stroke-dashoffset: var(--ring-c); } to { stroke-dashoffset: var(--ring-off); } }
        .wr-cat-ico { width: 46px; height: 46px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .wr-stack { display: flex; height: 10px; border-radius: 99px; overflow: hidden; margin-top: 14px; background: rgba(255,255,255,0.06); gap: 2px; }
        .wr-stack-seg { display: block; height: 100%; transform-origin: left; animation: wrGrowX .7s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes wrGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .wr-tile i { display: inline-block; width: 8px; height: 8px; border-radius: 3px; margin-right: 6px; }
        @media (max-width: 760px) {
          .wr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wr-tile.wr-hero, .wr-tile.wr-wide { grid-column: span 2; }
        }
        /* goals */
        .goal-row { display: grid; grid-template-columns: 60px minmax(0, 1fr); column-gap: 16px; align-items: center; }
        .goal-row > .goal-ring { grid-row: 1 / span 3; align-self: start; margin-top: 4px; }
        .goal-ring { position: relative; width: 60px; height: 60px; display: block; }
        .goal-lines { display: flex; flex-direction: column; gap: 3px; margin-top: 2px; padding-left: 2px; min-width: 0; }
        .goal-amt { font-size: 13.5px; font-weight: 600; color: #d5dade; font-variant-numeric: tabular-nums; }
        .goal-amt span { color: #7b838b; font-weight: 500; }
        .goal-pred { font-size: 12.5px; color: #8a9299; }
        .goal-pred b { color: #c7cdd2; font-weight: 600; }
        .goal-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
        .goal-arc { transition: stroke-dasharray .6s cubic-bezier(0.22,1,0.36,1); }
        .goal-ring-n { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800;
                       color: #e8eaec; font-variant-numeric: tabular-nums; }
        .goal-row { padding: 11px 2px 11px; border-bottom: 1px solid rgba(255,255,255,0.06); animation: fadeDown .42s cubic-bezier(0.22,1,0.36,1) both; }
        .goal-row.leaving { animation: goalOut .26s ease both; }
        @keyframes goalOut { to { opacity: 0; transform: translateX(14px); } }
        .goal-track { flex: 1; height: 9px; border-radius: 99px; background: rgba(255,255,255,0.07); overflow: hidden;
                      box-shadow: inset 0 1px 2px rgba(0,0,0,0.35); }
        .goal-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #4f8fd6, #7fb6e0);
                     box-shadow: 0 0 12px rgba(127,182,224,0.35);
                     transition: width .9s cubic-bezier(0.32,0.72,0.24,1), background .4s ease; }
        .goal-fill.done { background: linear-gradient(90deg, #3ddc97, #8ff0c4); box-shadow: 0 0 12px rgba(61,220,151,0.35); }
        .goal-icon-btn { background: none; border: none; color: #6d757d; cursor: pointer; padding: 3px; line-height: 0;
                         border-radius: 8px; transition: color .15s ease, background .15s ease; }
        .goal-icon-btn:hover { color: #e8eaec; background: rgba(255,255,255,0.07); }
        .goal-icon-btn.del:hover { color: #e2808c; }
        .goal-act.add { color: #8fd7a4; }
        .goal-new { display: inline-flex; align-items: center; gap: 6px; margin: 12px 0 4px; background: none;
                    border: 1px dashed rgba(255,255,255,0.16); color: #9aa3ab; border-radius: 10px; padding: 7px 12px;
                    font-size: 12.5px; cursor: pointer; transition: color .15s ease, border-color .15s ease, background .15s ease; }
        .goal-new:hover { color: #e8eaec; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); }
        /* month-end projection (money flow, above the insights) */
        .proj-box { margin-top: 14px; border-radius: 14px; background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07); padding: 2px 12px 12px;
                    animation: bdItemIn .4s cubic-bezier(0.4,0,0.2,1) .2s backwards; }
        .proj-head { display: flex; align-items: center; gap: 8px; padding: 11px 0 9px; }
        .proj-main { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; padding: 0 2px; }
        .proj-num { font-size: 27px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.1; }
        .proj-cap { font-size: 13.5px; color: #aeb5bb; }
        .proj-range { font-size: 12.5px; color: #8a9299; font-variant-numeric: tabular-nums; }
        @keyframes projWipe { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .proj-legend { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 8px 2px 0;
                       font-size: 12.5px; color: #9aa3ab; font-variant-numeric: tabular-nums; }
        .proj-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .proj-legend i { width: 14px; height: 10px; border-radius: 3px; }
        .proj-legend i.done { height: 2px; border-radius: 2px; background: #e8eaec; }
        .proj-legend i.todo { height: 2px; background: repeating-linear-gradient(90deg, #e8eaec 0 2px, transparent 2px 6px); }
        .proj-legend i.cone { opacity: 0.22; }
        .proj-legend i.bill { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #ff8d97; box-sizing: border-box; }
        .proj-plot { margin: 10px 0 0; }
        .pj-wipe { transform-box: fill-box; transform-origin: left center; animation: flowWipe .8s cubic-bezier(0.45,0,0.15,1) 1s backwards; }
        .pj-now { animation: axisIn .3s ease .95s backwards; }
        .pj-end { animation: flowTagIn .4s cubic-bezier(0.22,1,0.36,1) 1.65s backwards; }
        .proj-rec { display: flex; align-items: center; gap: 7px; margin: 11px 2px 0; font-size: 12px; color: #8a9299; font-variant-numeric: tabular-nums; }
        .proj-rec .msym { font-size: 15px; color: #6d757d; }
        .proj-rec b { color: #c7cdd2; font-weight: 600; }
        .proj-legend b { color: #e8eaec; font-weight: 600; }
        .proj-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 10px; margin-top: 13px; }
        .proj-tile { border-radius: 12px; padding: 10px 13px 11px; min-width: 0; }
        .proj-tile-val { font-size: 17px; font-weight: 800; color: #e8eaec; margin: 4px 0 2px; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .proj-tile-val span { font-size: 12px; font-weight: 600; color: #8a9299; margin-left: 5px; }
        .proj-tile-note { font-size: 12px; color: #8a9299; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* insights drop-down */
        .ins-box { margin-top: 14px; border-radius: 14px; background: rgba(255,255,255,0.03);
                   border: 1px solid rgba(255,255,255,0.07); padding: 2px 12px; }
        .ins-head { width: 100%; display: flex; align-items: center; gap: 8px; padding: 11px 0; }
        .ins-more { width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: none; border: none;
                    border-top: 1px solid rgba(255,255,255,0.05); cursor: pointer; padding: 10px 0; color: #9aa3ab; font: inherit;
                    font-size: 12.5px; font-weight: 600; transition: color .16s ease; }
        .ins-more:hover, .ins-more:hover .plain-arrow { color: #e8eaec; }
        .ins-count { font-size: 11px; font-weight: 700; color: #1e2124; background: #c7cdd2; border-radius: 99px;
                     padding: 1px 7px; line-height: 16px; }
        .ins-row { display: flex; align-items: flex-start; gap: 11px; padding: 9px 0;
                   border-top: 1px solid rgba(255,255,255,0.05); animation: fadeRight .38s cubic-bezier(0.22,1,0.36,1) both; }
        .ins-ico { flex-shrink: 0; width: 28px; height: 28px; border-radius: 9px; display: inline-flex;
                   align-items: center; justify-content: center; }
        .goal-name-text { cursor: text; border-radius: 5px; padding: 1px 3px; margin: -1px -3px; position: relative;
                          transition: background .15s ease, color .2s ease; }
        .goal-name-text:hover { background: rgba(255,255,255,0.06); }
        /* completed: a thin strike that draws itself across the name */
        .goal-name-text.done, .debt-name.done { color: #9aa3ab; }
        .debt-name { position: relative; padding: 1px 3px; margin: -1px -3px; }
        /* debts: a section of the Goals card, under the goals */
        .debt-sec { margin-top: 18px; padding-top: 16px; border-top: 1px solid #33373b; }
        .debt-group { display: flex; align-items: center; gap: 8px; margin: 12px 2px 0; font-size: 11px; font-weight: 700; letter-spacing: .12em;
                      text-transform: uppercase; color: #8a9299; }
        .debt-group i { width: 7px; height: 7px; border-radius: 99px; }
        .goal-name-text.done::after, .debt-name.done::after { content: ""; position: absolute; left: 3px; right: 3px; top: 52%; height: 1.5px; border-radius: 1px;
                                      background: rgba(232,234,236,0.75); transform-origin: left; animation: strikeIn .5s cubic-bezier(0.22,1,0.36,1) .15s both; }
        @keyframes strikeIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .goal-name-input { font: inherit; color: #e8eaec; background: rgba(255,255,255,0.06); border: 1px solid rgba(127,182,224,0.55);
                           border-radius: 7px; padding: 2px 7px; outline: none; min-width: 6ch; max-width: 320px;
                           box-shadow: 0 0 0 3px rgba(127,182,224,0.12); animation: fadeIn .15s ease; }
        .goal-done-box { margin-top: 10px; border-radius: 13px; border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.025); padding: 0 12px; }
        .goal-done-head { width: 100%; display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer;
                          padding: 10px 0; color: #9aa3ab; font-size: 12.5px; font-weight: 600; }
        .goal-done-head:hover { color: #e8eaec; }
        .goal-done-head:hover .plain-arrow { color: #e8eaec; }
        .goal-done-count { font-size: 11px; font-weight: 700; color: #1e2124; background: #8fd7a4; border-radius: 99px; padding: 1px 7px; line-height: 16px; }
        .goal-done-box .goal-row:last-child { border-bottom: none; }
        .goal-sym-wrap { position: relative; display: inline-flex; }
        .goal-sym { background: none; border: none; padding: 0; margin: 0; cursor: pointer; line-height: 0; color: #c7cdd2;
                    transition: color .18s ease, transform .25s cubic-bezier(0.34,1.4,0.64,1); }
        .goal-sym:hover, .goal-sym.open { color: #ffffff; transform: scale(1.12); }
        .goal-sym-ico { font-size: 21px; animation: symIn .38s cubic-bezier(0.34,1.4,0.64,1) both; }
        @keyframes symIn { from { opacity: 0; transform: scale(.4) rotate(-20deg); } to { opacity: 1; transform: none; } }
        .goal-sym-pop { position: absolute; top: calc(100% + 8px); left: -8px; z-index: 30; width: 318px; padding: 8px; border-radius: 14px;
                        display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; animation: fadeDown .22s cubic-bezier(0.22,1,0.36,1) both;
                        box-shadow: 0 14px 34px rgba(0,0,0,0.45);
                        background: rgba(30,33,37,0.97) !important; border: 1px solid rgba(255,255,255,0.10); }
        .goal-sym-pop.up { top: auto; bottom: calc(100% + 8px); animation-name: fadeUpPop; }
        @keyframes fadeUpPop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .goal-sym-opt { height: 34px; border: none; border-radius: 9px; background: none; color: #9aa3ab; cursor: pointer;
                        display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s ease, color .15s ease; }
        .goal-sym-opt:hover { background: rgba(255,255,255,0.08); color: #e8eaec; }
        .goal-sym-opt.on { background: rgba(127,182,224,0.16); color: #7fb6e0; }
        .goal-sym-opt.auto { grid-column: 1 / -1; justify-content: flex-start; padding: 0 10px; font-size: 12.5px; font-weight: 600; margin-bottom: 3px;
                             border-bottom: 1px solid rgba(255,255,255,0.06); border-radius: 9px 9px 0 0; }
        .goal-io, .goal-save { width: 38px; height: 38px; flex-shrink: 0; box-sizing: border-box; padding: 0; border-radius: 11px;
                    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                    transition: background .18s ease, border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
        .goal-io .msym { font-size: 20px; transition: transform .25s cubic-bezier(0.34,1.4,0.64,1); }
        .goal-io.in  { color: #3ddc97; background: rgba(61,220,151,0.10); border: 1px solid rgba(61,220,151,0.32); }
        .goal-io.out { color: #ff5d6c; background: rgba(255,93,108,0.08); border: 1px solid rgba(255,93,108,0.30); }
        .goal-io.in:hover  { background: rgba(61,220,151,0.18); border-color: rgba(61,220,151,0.6); box-shadow: 0 0 16px rgba(61,220,151,0.22); }
        .goal-io.out:hover { background: rgba(255,93,108,0.15); border-color: rgba(255,93,108,0.55); box-shadow: 0 0 16px rgba(255,93,108,0.2); }
        .goal-io.in:hover .msym  { transform: translateY(2px); }
        .goal-io.out:hover .msym { transform: translateY(-2px); }
        .goal-io:active, .goal-save:active { transform: scale(0.94); }
        .goal-save { width: 38px; height: 38px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center;
                     cursor: pointer; color: #3ddc97; background: rgba(61,220,151,0.10); border: 1px solid rgba(61,220,151,0.32);
                     box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
                     transition: background .18s ease, border-color .18s ease, transform .15s ease, box-shadow .2s ease; }
        .goal-save:hover { background: rgba(61,220,151,0.18); border-color: rgba(61,220,151,0.6); box-shadow: 0 0 16px rgba(61,220,151,0.25), inset 0 1px 0 rgba(255,255,255,0.1); }
        .goal-save:hover .msym { transform: scale(1.12); }
        .goal-save:active { transform: scale(0.94); }
        .nospend-tag { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #a5efcd;
                       background: rgba(61,220,151,0.12); border: 1px solid rgba(61,220,151,0.25); border-radius: 99px; padding: 2px 8px; margin-top: 2px; }
        .nospend-row { background: rgba(61,220,151,0.06) !important; border-color: rgba(61,220,151,0.2) !important; gap: 10px; align-items: center; }
        .limit-label { background: none; border: none; padding: 4px 6px; margin: 0 -2px 0 0; border-radius: 7px; cursor: pointer;
                       user-select: none; transition: color .15s ease, background .15s ease; }
        .limit-label:hover { color: #e8eaec !important; background: rgba(255,255,255,0.05); }
        .limit-label:active { transform: scale(0.97); }
        .limit-flash { position: absolute; right: 0; bottom: calc(100% + 4px); font-size: 11.5px; font-weight: 600; color: #8fd7a4; white-space: nowrap;
                       animation: limitFlash 2.4s cubic-bezier(0.22,1,0.36,1) both; pointer-events: none; }
        @keyframes limitFlash { 0% { opacity: 0; transform: translateY(4px); } 12% { opacity: 1; transform: none; }
                                78% { opacity: 1; } 100% { opacity: 0; } }
        /* test-data settings pop-up */
        .tcfg-modal { border-radius: 24px; width: min(640px, 94vw); max-height: 90vh; overflow: auto; padding: 20px 22px 18px; transform-origin: center center;
                      background: radial-gradient(70% 50% at 0% 0%, rgba(227,205,119,0.08), transparent 70%), rgba(30,33,37,0.72) !important; }
        .tcfg-sub { font-size: 12.5px; color: #8a9299; margin: -2px 0 12px; line-height: 1.45; }
        .tcfg-sec { padding: 12px 0 10px; border-top: 1px solid rgba(255,255,255,0.07); }
        .tcfg-h { display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; color: #9aa3ab; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 8px; }
        .tcfg-h .msym { font-size: 16px; color: #c7cdd2; }
        .tcfg-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; flex-wrap: wrap; }
        .tcfg-lbl { font-size: 13.5px; color: #c7cdd2; }
        .tcfg-ctl { display: inline-flex; align-items: center; gap: 8px; }
        .tcfg-to { font-size: 12px; color: #6d757d; }
        .tcfg-err { font-size: 12px; color: #ff8d97; margin: -2px 0 4px; text-align: right; }
        .tcfg-num { display: inline-flex; align-items: center; height: 34px; border-radius: 10px; background: rgba(24,27,31,0.6);
                    border: 1px solid rgba(255,255,255,0.10); overflow: hidden; transition: border-color .15s ease, box-shadow .15s ease; }
        .tcfg-num:focus-within { border-color: rgba(127,182,224,0.6); box-shadow: 0 0 0 3px rgba(127,182,224,0.12); }
        .tcfg-num.bad { border-color: rgba(255,93,108,0.6); }
        .tcfg-num button { width: 28px; height: 100%; background: none; border: none; color: #9aa3ab; cursor: pointer; font-size: 16px; transition: color .15s, background .15s; }
        .tcfg-num button:hover { color: #e8eaec; background: rgba(255,255,255,0.06); }
        .tcfg-num.wide input { width: 58px; }
        .tcfg-num input { width: 42px; background: none; border: none; outline: none; color: #e8eaec; font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .tcfg-unit { font-size: 12px; color: #8a9299; margin: 0 4px 0 3px; }
        .tcfg-seg { display: inline-flex; padding: 2px; border-radius: 11px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); }
        .tcfg-seg button { background: none; border: none; color: #8a9299; font-size: 12.5px; padding: 6px 11px; border-radius: 9px; cursor: pointer; transition: all .18s ease; white-space: nowrap; }
        .tcfg-seg button:hover { color: #e8eaec; }
        .tcfg-seg button.on { background: rgba(255,255,255,0.12); color: #ffffff; box-shadow: inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.25); }
        .tcfg-styles { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
        .tcfg-style { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; column-gap: 9px; row-gap: 2px; text-align: left;
                      padding: 10px 12px; border-radius: 13px; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
                      color: inherit; transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s var(--ease-soft); }
        .tcfg-style:hover { background: rgba(255,255,255,0.06); transform: translateY(-1px); }
        .tcfg-style.on { border-color: rgba(227,205,119,0.6); background: rgba(227,205,119,0.08); box-shadow: 0 0 0 1px rgba(227,205,119,0.25); }
        .tcfg-style-ico { grid-row: 1 / span 3; font-size: 20px !important; color: #9aa3ab; margin-top: 1px; transition: color .18s ease; }
        .tcfg-style.on .tcfg-style-ico { color: #e3cd77; }
        .tcfg-style-name { font-size: 13.5px; font-weight: 700; color: #e8eaec; }
        .tcfg-style-desc { font-size: 11.5px; color: #8a9299; line-height: 1.35; }
        .tcfg-style-est { font-size: 11px; color: #ff8d97; margin-top: 2px; font-variant-numeric: tabular-nums; }
        .tcfg-switch { width: 42px; height: 24px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.08); position: relative; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
        .tcfg-switch span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #c7cdd2; transition: transform .25s cubic-bezier(0.34,1.4,0.64,1), background .2s; }
        .tcfg-switch.on { background: rgba(61,220,151,0.35); border-color: rgba(61,220,151,0.55); }
        .tcfg-switch.on span { transform: translateX(18px); background: #ffffff; }
        /* the developer options: sections that fold, the day calendar, the small boxes */
        .tcfg-sec.fold { padding: 0; }
        .tcfg-fold { width: 100%; display: flex; align-items: center; gap: 9px; padding: 13px 2px; background: none; border: none; color: inherit; cursor: pointer; text-align: left; font-family: inherit; }
        .tcfg-fold > .msym { font-size: 18px; color: #c7cdd2; }
        .tcfg-fold-t { font-size: 14px; font-weight: 700; color: #e8eaec; white-space: nowrap; }
        .tcfg-fold-s { flex: 1; min-width: 0; text-align: right; font-size: 12.5px; color: #8a9299; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                       font-variant-numeric: tabular-nums; transition: color .15s ease; }
        .tcfg-fold:hover .tcfg-fold-s, .tcfg-fold:hover .plain-arrow { color: #e8eaec; }
        .tcfg-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s cubic-bezier(0.4,0,0.2,1); }
        .tcfg-body.open { grid-template-rows: 1fr; }
        .tcfg-body > div { min-height: 0; overflow-x: visible; overflow-y: clip; }
        .tcfg-pad { padding: 0 2px 12px; opacity: 0; transform: translateY(-8px); transition: opacity .2s ease, transform .28s cubic-bezier(0.4,0,0.2,1); }
        .tcfg-body.open .tcfg-pad { opacity: 1; transform: none; }
        .tcfg-note { display: block; font-size: 11.5px; color: #6d757d; margin-top: 1px; }
        .tcfg-num.sm { height: 30px; border-radius: 9px; }
        .tcfg-num.sm input { width: 44px; padding: 0 7px 0 4px; font-size: 13px; }
        .tcfg-num.sm .tcfg-unit { margin: 0 8px 0 -2px; white-space: nowrap; }
        .tcfg-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin: 6px 0 8px; }
        .tcfg-cal button, .tcfg-dows button, .tcfg-mini { height: 30px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #8a9299;
                       font: 600 12.5px Inter, sans-serif; font-variant-numeric: tabular-nums; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .tcfg-cal button:hover, .tcfg-dows button:hover, .tcfg-mini:hover { color: #e8eaec; background: rgba(255,255,255,0.08); }
        .tcfg-cal button.on, .tcfg-dows button.on { color: #1a1d20; background: #e3cd77; border-color: rgba(255,255,255,0.3); }
        .tcfg-cal button.on:hover, .tcfg-dows button.on:hover { color: #1a1d20; background: #ecd98a; }
        .tcfg-dows { display: inline-flex; gap: 5px; }
        .tcfg-dows button { padding: 0 9px; }
        .tcfg-mini { height: 26px; padding: 0 10px; font-size: 12px; }
        .tcfg-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
        .tcfg-est { font-size: 12.5px; color: #9aa3ab; }
        .tcfg-go { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 700;
                   color: #1a1d20; background: linear-gradient(180deg, #f0dc8e, #e3cd77); border: 1px solid rgba(255,255,255,0.3);
                   box-shadow: 0 6px 18px rgba(227,205,119,0.25), inset 0 1px 0 rgba(255,255,255,0.5); transition: transform .15s ease, filter .15s ease, opacity .15s; }
        .tcfg-go:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .tcfg-go:active { transform: scale(0.97); }
        .tcfg-go:disabled { opacity: .4; cursor: not-allowed; transform: none; }
        .bk-btn.test { color: #e3cd77; border-color: rgba(227,205,119,0.3); }
        /* the footer's buttons are symbols: no border, the same highlight under the pointer */
        .bk-btn.ico { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 26px; padding: 0; border-color: transparent; background: none; }
        .bk-btn.ico:hover { border-color: transparent; background: rgba(255,255,255,0.08); }
        .bk-btn.ico .msym { font-size: 17px; }
        .bk-msg { color: #5ee3a9; font-size: 11.5px; animation: fadeRight .3s ease both; }
        /* ---------- open app panel ---------- */
        .open-panel { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; }
        /* the grey backdrop is its own layer, so the outro can fade it while the logo and letters stay solid */
        .open-panel-bg { position: absolute; inset: 0;
                         background: radial-gradient(circle at 50% 48%, #43484f 0%, #2a2e33 34%, #17191c 70%, #0e1012 100%); }
        /* replayed from the footer logo: the splash fades in over the app instead of cutting to it */
        .open-panel.again { animation: openPanelIn ${OPEN_COVER_MS}ms ease backwards; }
        @keyframes openPanelIn { from { opacity: 0; } }
        /* ---- outro ---- only the backdrop fades. It starts just after the fall does, takes its time, and is
           still gone before the pieces have left the screen */
        .open-panel.out { pointer-events: none; }
        .open-panel.out .open-panel-bg { animation: openBgOut ${OPEN_FADE_MS}ms ease-in-out ${OPEN_FADE_DELAY_MS}ms forwards; }
        @keyframes openBgOut { to { opacity: 0; } }
        /* the logo and each letter drop off the bottom, turning as they go. Delay, duration, distance, sideways drift
           and spin come from the --f* variables rolled in openFall. Transform only, so it runs on the GPU. */
        .open-panel.out .open-panel-logo, .open-panel.out .open-panel-word .opw-ch {
          animation: openFall var(--ft) ${OPEN_FALL_EASE} var(--fd) forwards; }
        @keyframes openFall { to { transform: translate3d(var(--fx), var(--fy), 0) rotate(var(--fr)); } }
        .open-panel-inner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 22px; }
        .open-panel-logo { width: 96px; height: auto; user-select: none; will-change: transform;
                           filter: drop-shadow(0 10px 22px rgba(0,0,0,0.45));
                           animation: openLogoIn 1.05s cubic-bezier(0.22,1,0.36,1) .06s backwards; }
        /* one continuous ease, no mid-way keyframe, so the logo settles without a kink */
        @keyframes openLogoIn {
          from { opacity: 0; transform: translateY(22px) scale(0.8); }
          to   { opacity: 1; transform: none; }
        }
        /* pixel wordmark: the font sits on an 8x8 grid, so at 48px one font pixel is 6px. White letters over a shadow
           that is offset by exactly one font pixel; the shadow's pastel-green gradient steps once per pixel row.
           One extra font pixel between letters keeps a clear gap between each shadow and the next letter. */
        .open-panel-word { display: flex; font-family: 'Press Start 2P', 'Inter', sans-serif; font-weight: 400; font-size: 48px; line-height: 1;
                           letter-spacing: 6px; margin-right: -6px; -webkit-font-smoothing: none; }
        .open-panel-word span { font-family: inherit; }   /* the global * rule would otherwise put Inter back on the letters */
        .open-panel-word .opw-ch { position: relative; display: inline-block; will-change: transform;
                                   animation: openCharIn .8s cubic-bezier(0.22,1,0.36,1) var(--d) backwards; }
        .open-panel-word .opw-sh { position: absolute; left: 6px; top: 6px; color: transparent; -webkit-background-clip: text; background-clip: text;
                                   background-image: linear-gradient(180deg, #a3d9a8 0 12.5%, #98d09e 12.5% 25%, #8dc794 25% 37.5%, #82be8a 37.5% 50%,
                                                                     #77b580 50% 62.5%, #6cac76 62.5% 75%, #61a36c 75% 100%); }
        .open-panel-word .opw-fg { position: relative; display: inline-block; color: #ffffff; }
        @keyframes openCharIn {
          from { opacity: 0; transform: translateY(24px) scale(0.88); }
          to   { opacity: 1; transform: none; }
        }
        /* app start: the pieces are in place but held back until what they are drawn with is ready. At 1% they can't
           be seen, yet they are already drawn, so their first moving frame has nothing left to prepare */
        .open-panel.wait .open-panel-logo, .open-panel.wait .open-panel-word .opw-ch { animation: none; opacity: 0.01; }
        /* ---------- warm-up (see the top of the file): filed screens drawn for a few frames, all but invisibly ---------- */
        .warm-host { position: fixed; inset: 0; overflow: hidden; contain: strict; opacity: 0.004; pointer-events: none; z-index: 2; }
        .warm-screen { position: absolute; left: 0; right: 0; top: 0; max-width: 1280px; min-height: 100vh; margin: 0 auto; padding: 30px 32px 52px; color: #e8eaec; }
        /* everything in its resting state at once: no entrance animation to wait for, and the cards that only show
           once scrolled to are shown */
        .warm-screen *, .warm-screen *::before, .warm-screen *::after { animation: none !important; transition: none !important; }
        .warm-screen .flow-card { visibility: visible !important; opacity: 1 !important; transform: none !important; }
        .warm-screen .rv { visibility: visible !important; }
        /* the touch: every second element repaints (never all of them: a tile repainted whole is drawn afresh, and
           it is the redrawing of part of one that needs its own programs) */
        .warm-screen.touch *:nth-child(2n), .warm-screen.touch *:nth-child(2n)::before, .warm-screen.touch *:nth-child(2n)::after {
          outline: 1px solid rgba(0,0,0,0.02) !important; outline-offset: -1px !important; }
        .warm-screen.touch svg *:nth-child(2n) { stroke-opacity: 0.99; }
        /* crocodile home button in the footer: just the logo, no tile or outline */
        .foot-logo { background: none; border: none; outline: none; padding: 0; margin: 0; cursor: pointer; line-height: 0; align-self: center;
                     -webkit-tap-highlight-color: transparent; }
        .foot-logo img { display: block; height: 24px; width: auto; user-select: none; }
        .plain-arrow { background: none; border: none; color: #6d757d; cursor: pointer; line-height: 0; padding: 2px 4px; transition: color .15s ease; }
        .plain-arrow:hover { color: #e8eaec; }
        .chev svg { width: 15px; height: 15px; display: block; transform-origin: 50% 50%; }
        /* closed = 0deg (pointing down), open = 180deg; always turns clockwise */
        .chev svg { animation: chevDown .34s cubic-bezier(0.34,1.1,0.64,1) both; }
        .chev.up svg { animation: chevUp .34s cubic-bezier(0.34,1.1,0.64,1) both; }
        @keyframes chevUp   { from { transform: rotate(0deg); }   to { transform: rotate(180deg); } }
        @keyframes chevDown { from { transform: rotate(180deg); } to { transform: rotate(360deg); } }
        .flow-card { opacity: 0; visibility: hidden; transform: scale(0.94); }
        .flow-card > .card-aura { position: absolute; left: 0; top: 0; width: min(100%, 820px); height: 130px; max-height: 100%; z-index: 0; border-top-left-radius: inherit; pointer-events: none;
                                  background: radial-gradient(820px 130px at 0% 0%, color-mix(in srgb, var(--tint) 27%, transparent), transparent 74%); }
        .card-tag { display: inline-flex; align-items: center; gap: 7px; margin: -3px 0 6px -4px; padding: 5px 11px 5px 9px; border-radius: 99px;
                    font-size: 11px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase;
                    color: var(--tint); background: color-mix(in srgb, var(--tint) 12%, transparent); border: 1px solid color-mix(in srgb, var(--tint) 20%, transparent); }
        .card-tag i { width: 6px; height: 6px; border-radius: 99px; background: var(--tint); }
        .hero { position: relative; margin: 4px -14px 22px; padding: 18px 22px 18px; border-radius: 24px;
                border: 1px solid color-mix(in srgb, var(--hc) 24%, rgba(255,255,255,0.07));
                background: radial-gradient(900px 300px at 0% 0%, color-mix(in srgb, var(--hc) 24%, transparent), transparent 70%),
                            radial-gradient(640px 260px at 100% 100%, color-mix(in srgb, var(--hc) 9%, transparent), transparent 72%),
                            linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
                box-shadow: 0 18px 44px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.10); }
        .hero-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .hero-tag { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px 5px 9px; border-radius: 99px; font-size: 11px; font-weight: 700;
                    letter-spacing: 0.13em; text-transform: uppercase; color: var(--hc); background: color-mix(in srgb, var(--hc) 13%, transparent);
                    border: 1px solid color-mix(in srgb, var(--hc) 22%, transparent); }
        .hero-tag i { width: 6px; height: 6px; border-radius: 99px; background: var(--hc); }
        .hero-vs { font-size: 12.5px; color: #aab1b8; padding: 5px 12px; border-radius: 99px; background: rgba(255,255,255,0.055);
                   border: 1px solid rgba(255,255,255,0.07); white-space: pre; animation: fadeRight .4s ease backwards; }
        .hero-vs b { font-weight: 700; }
        .hero-num { font-size: 64px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.05; margin: 12px 0 14px; color: var(--hc);
                    font-variant-numeric: tabular-nums; text-shadow: 0 0 40px color-mix(in srgb, var(--hc) 34%, transparent); }
        .hero-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
        .hero-tile { position: relative; display: flex; flex-direction: column; gap: 3px; padding: 11px 14px 12px 22px; border-radius: 14px; min-width: 0;
                     background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.06); }
        .hero-tile::before { content: ""; position: absolute; left: 10px; top: 12px; bottom: 12px; width: 3px; border-radius: 3px; background: var(--tc); }
        .ht-cap { font-size: 10.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #8a9299; white-space: nowrap; }
        .ht-val { font-size: 21px; font-weight: 800; color: #eef1f4; font-variant-numeric: tabular-nums; white-space: nowrap; letter-spacing: -0.01em; }
        .ht-val small { font-size: 12px; font-weight: 600; color: #8a9299; letter-spacing: 0; }
        .ht-sub { font-size: 12px; color: #8a9299; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* ---- personalities (6 October 2026): depth instead of borders, green as the brand, one dominant visual a screen ---- */
        .flow-card.glass { border-color: transparent; box-shadow: 0 34px 80px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.08); }
        .flow-card.glass:hover { border-color: transparent; box-shadow: 0 34px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.11); }
        .cal-wrap { border-color: transparent !important; box-shadow: 0 30px 70px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07); }
        /* the month's card: no border, a neon edge of its colour along the top, and a big soft glow of it spilling out behind */
        .hero { border-color: transparent; box-shadow: 0 34px 80px rgba(0,0,0,0.46), inset 0 1.5px 0 color-mix(in srgb, var(--hc) 62%, transparent), 0 -1px 26px color-mix(in srgb, var(--hc) 16%, transparent); }
        .hero::before { content: ""; position: absolute; left: -70px; top: -90px; width: 760px; height: 420px; z-index: -1; pointer-events: none;
                        background: radial-gradient(closest-side, color-mix(in srgb, var(--hc) 20%, transparent), transparent); }
        .hero-num { font-size: 92px; letter-spacing: -0.045em; margin: 14px 0 18px -4px; }
        .hero-tiles { grid-template-columns: 1.75fr 1fr 1fr 1fr; align-items: end; }
        .hero-tile { border-color: transparent; }
        .hero-tile:first-child { padding-top: 16px; padding-bottom: 17px; background: color-mix(in srgb, var(--tc) 9%, rgba(255,255,255,0.04)); }
        .hero-tile:first-child .ht-val { font-size: 32px; }
        /* the year as a poster */
        .poster { position: relative; }
        .poster::before { content: ""; position: absolute; left: -60px; top: -70px; width: 560px; height: 260px; z-index: -1; pointer-events: none;
                          background: radial-gradient(closest-side, color-mix(in srgb, var(--hc) 17%, transparent), transparent); }
        .poster-line { display: flex; align-items: flex-end; gap: 18px; margin: -18px 0 12px; }
        .poster-num { font-size: 76px; font-weight: 800; letter-spacing: -0.045em; line-height: 0.95; color: var(--hc); font-variant-numeric: tabular-nums;
                      text-shadow: 0 0 44px color-mix(in srgb, var(--hc) 32%, transparent); }
        .poster-cap { display: flex; flex-direction: column; gap: 3px; padding-bottom: 7px; font-size: 13px; color: #8a9299; font-variant-numeric: tabular-nums; }
        .poster-cap b { font-size: 15px; font-weight: 700; color: #e8eaec; }
        .ycell > .spark { position: absolute; z-index: 0; left: 10px; bottom: 8px; width: calc(100% - 20px); height: 30%; opacity: 0.42; pointer-events: none; }
        /* a day's spending as a bar rising behind its figure, and the neon edge on today */
        .cell > .cbar { position: absolute; z-index: 0; left: 0; right: 0; bottom: 0; border-radius: 0 0 13px 13px; pointer-events: none;
                        background: linear-gradient(to top, color-mix(in srgb, currentColor 30%, transparent), transparent); }
        .cell.today { box-shadow: 0 0 0 1px rgba(127,182,224,0.5), 0 0 22px rgba(127,182,224,0.28); }
        /* the score: the dial is the picture, the three boxes sit beside it, stepped */
        .score-dial::before { content: ""; position: absolute; inset: -34px; border-radius: 50%; pointer-events: none;
                              background: radial-gradient(closest-side, color-mix(in srgb, var(--gc) 22%, transparent), transparent 78%); }
        .score-orbit { display: flex !important; flex-direction: column; width: 290px !important; flex-shrink: 0; margin: 0 !important; gap: 10px !important; }
        .score-orbit > :nth-child(2) { margin-left: -28px; margin-right: 28px; }
        .score-orbit > .sub-box { border-color: transparent; }
        /* goals: softer and warmer than the rest */
        .flow-card[data-card="goals"] { border-radius: 30px !important; }
        .flow-card[data-card="goals"] > .card-aura { width: 100%; height: 220px;
            background: radial-gradient(900px 220px at 18% 0%, color-mix(in srgb, var(--tint) 20%, transparent), transparent 74%); }
        .flow-card[data-card="goals"] .goal-row { border-bottom-color: transparent; padding: 14px 2px; }
        /* trading: sharper, technical, terminal-like. Square corners, a fine grid, figures in the system's fixed-width face */
        .term .hero, .term .flow-card, .term .cal-wrap { border-radius: 8px !important; }
        .term .hero { background: repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 26px),
                                  repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 26px),
                                  radial-gradient(900px 300px at 0% 0%, color-mix(in srgb, var(--hc) 20%, transparent), transparent 70%), rgba(18,21,24,0.72); }
        .term .hero-num, .term .ht-val, .term .ht-sub, .term .cell, .term .ycell, .term .hero-vs b { font-family: ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: -0.05em; }
        .term .hero-num { font-size: 80px; }
        .term .hero-tile, .term .sub-box, .term .cell, .term .ycell { border-radius: 5px !important; }
        .term .hero-tag, .term .card-tag { border-radius: 4px; }
        .term .hero-tag i, .term .card-tag i { width: 6px; height: 11px; border-radius: 1px; }
        .term .hero-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .term .hero-tile:first-child .ht-val { font-size: 21px; }
        .term .hero-tile:first-child { padding: 11px 14px 12px 22px; background: rgba(255,255,255,0.045); }
        /* ---- 6 October 2026, second brief: pixel type used sparingly, the data moving, one focal point a screen,
           and colour roles: green = gain / progress, red = loss / risk, gold = reached / achieved, blue-grey = information ---- */
        .px-word { font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 16px; line-height: 1; letter-spacing: 1px; color: #e6c877; -webkit-font-smoothing: none; }
        .hero-tile:first-child .ht-val { font-family: 'Press Start 2P', 'Inter', sans-serif; font-size: 24px; font-weight: 400; letter-spacing: 0; text-transform: uppercase;
                                         -webkit-font-smoothing: none; padding: 5px 0 3px; }
        .term .hero-tile:first-child .ht-val { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-weight: 800; font-size: 21px; text-transform: none; padding: 0; letter-spacing: -0.05em; }
        /* one hero, the rest quieter: the three small tiles step back, and so does quick add until it is used */
        .hero-tile:not(:first-child) { background: transparent; }
        .hero-tile:not(:first-child) .ht-val { font-size: 18px; color: #c7cdd2; }
        .term .hero-tile:not(:first-child) { background: rgba(255,255,255,0.045); }
        .qadd { opacity: 0.7; transition: opacity .2s ease; }
        .qadd:hover, .qadd:focus-within { opacity: 1; }
        .cell > .cbar { transform-origin: 50% 100%; animation: cbarUp .3s var(--ease) backwards; }
        @keyframes cbarUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        .cell.over::after { content: ""; position: absolute; inset: -1px; border-radius: inherit; border: 1.5px solid #ff5d6c; opacity: 0; pointer-events: none;
                            animation: overPulse .7s ease-out .4s backwards; }
        @keyframes overPulse { 0% { opacity: 0; transform: scale(1); } 28% { opacity: 0.9; } 100% { opacity: 0; transform: scale(1.09); } }
        .goal-done-count { background: #e6c877 !important; }
        .tag-pill { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; padding: 3px 8px; border-radius: 99px; white-space: nowrap;
                    color: var(--tc); background: color-mix(in srgb, var(--tc) 14%, transparent); }
        /* each card, and what folds in it, is a surface of its own for good: when a card folds, the cards under it and
           its own content are only moved and cut off, never drawn again */
        .flow-card, .fold-in { will-change: transform; }
        /* a part of a card that waits to be scrolled to (Reveal) */
        .rv:not(.seen) { visibility: hidden; }
        .rv:not(.seen) * { animation: none !important; }
        .rv.seen { animation: rvIn .3s ease-out backwards; }
        @keyframes rvIn { from { opacity: 0; } }
        /* "backwards" + explicit end state: the animation lets go when it finishes. A held (both/forwards)
           animation blocks backdrop blur for anything inside the card, e.g. the glass chart tooltip. */
        .flow-card.shown { visibility: visible; opacity: 1; transform: none; animation: flowPopIn .5s cubic-bezier(0.22,1,0.36,1) backwards; }
        @keyframes flowPopIn {
          0%   { opacity: 0; transform: scale(0.94); }
          60%  { opacity: 1; transform: scale(1.012); }
          100% { opacity: 1; transform: scale(1); }
        }
        .flow-label { transition: background .16s ease; }
        .flow-label:hover { background: #33373b; }
        .score-hit { pointer-events: auto; cursor: pointer; display: flex; flex-direction: column; align-items: center; padding: 9px 14px; border-radius: 16px; transition: background .16s ease; }
        .score-hit:hover { background: rgba(255,255,255,0.07); }
        .score-arc { animation: scoreDraw 1s cubic-bezier(0.3,0,0.2,1) both; transform-origin: center; }
        @keyframes scoreDraw { from { stroke-dasharray: 0 9999; } }
        .bd-title { animation: bdTitleIn .3s cubic-bezier(0.34,1.15,0.64,1) both; }
        @keyframes bdTitleIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .bd-icon { display: inline-block; animation: bdIconRoll .4s cubic-bezier(0.55,0,0.35,1) both; }
        @keyframes bdIconRoll {
          0% { transform: translateY(0); filter: blur(0px); }
          42% { transform: translateY(-24px); filter: blur(2.5px); }
          43% { transform: translateY(24px); filter: blur(2.5px); }
          100% { transform: translateY(0); filter: blur(0px); }
        }
        .score-card { animation: bdItemIn .4s cubic-bezier(0.4,0,0.2,1) .12s both; }
        .sub-box { background-image: linear-gradient(150deg, color-mix(in srgb, var(--tc, transparent) 17%, transparent), transparent 64%);
                   border-color: color-mix(in srgb, var(--tc, #fff) 16%, rgba(255,255,255,0.05)); }
        .sub-box { animation: subBoxIn .38s cubic-bezier(0.34,1.15,0.64,1) both; }
        @keyframes subBoxIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .bd-item { animation: bdItemIn .34s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes bdItemIn { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }
        .bd-fill { display: block; height: 100%; border-radius: 99px; animation: bdGrow .55s cubic-bezier(0.4,0,0.2,1) both; transform-origin: left center; }
        @keyframes bdGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        /* Money flow opening (timings: FLOW_* near the top of the file). The income bar fills from the top; each
           ribbon is uncovered from the left by its own sweep, fading up as it sets off; each expense bar grows out of
           its middle as the ribbon's front arrives; the labels slide in. Transforms and opacity only. */
        .flow-src { transform-box: fill-box; transform-origin: center top;
                    animation: flowSrcIn ${FLOW_SRC_MS}ms cubic-bezier(0.33,1,0.68,1) ${FLOW_START_MS}ms backwards; }
        @keyframes flowSrcIn { from { transform: scaleY(0); } }
        .flow-wipe-rect { transform-box: fill-box; transform-origin: left center; animation: flowWipe ${FLOW_RIB_MS}ms cubic-bezier(0.45,0,0.15,1) backwards; }
        @keyframes flowWipe { from { transform: scaleX(0); } }
        .flow-rib { animation: flowRibIn ${Math.round(FLOW_RIB_MS * 0.45)}ms ease-out backwards; }
        @keyframes flowRibIn { from { opacity: 0; } }
        .flow-bar { transform-box: fill-box; transform-origin: center center; animation: flowBarIn .36s cubic-bezier(0.34,1.45,0.64,1) backwards; }
        @keyframes flowBarIn { from { opacity: 0; transform: scaleY(0.15); } }
        .flow-tag { animation: flowTagIn .38s cubic-bezier(0.22,1,0.36,1) backwards; }
        .flow-tag.src { animation-delay: ${FLOW_START_MS + 120}ms; }
        @keyframes flowTagIn { from { opacity: 0; transform: translateX(-9px); } }
        .mode-btn:hover {
          border-color: rgba(255,255,255,0.28) !important; color: #e8eaec !important;
          background: rgba(255,255,255,0.06) !important; transform: translateY(-1px);
        }
        .cat-btn-glow { box-shadow: 0 0 0 3px rgba(255,255,255,0.05); }
        .wk-tip { animation: wkTipIn .18s cubic-bezier(0.34,1.2,0.64,1) both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes wkTipIn { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        .cat-pop { animation: popUpIn .2s cubic-bezier(0.34,1.15,0.64,1) both; }
        .cat-pop.closing { animation: popDownOut .18s ease both; }
        @keyframes popUpIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popDownOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
        .cat-opt { transition: background .15s ease, color .15s ease; }
        .cat-opt:hover { background: #33373b !important; color: #e8eaec !important; }
        .icon-opt { transition: background .15s ease, color .15s ease; }
        .icon-opt:hover { background: #33373b !important; color: #f5d34b !important; }
        * { box-sizing: border-box; font-family: 'Inter', sans-serif; }
        input { font-variant-numeric: tabular-nums; }
        .cell, .ycell {
          position: relative; overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 14px rgba(0,0,0,0.26);
          transition: transform .24s var(--ease-soft), border-color .2s ease, box-shadow .24s ease;
          will-change: transform;
        }
        /* day tiles must not clip: their hover tooltip sits outside the tile */
        .cell { overflow: visible; }
        .cell:hover { z-index: 6; }
        .cell.tip-below .cell-tip { bottom: auto; top: calc(100% + 8px); }
        /* painted glass: a specular corner + a soft inner glow, no compositing cost */
        /* --lit goes 0 → 1 under the pointer and the sheen is worked out from it, so the brighter corner eases in
           with the lift (a gradient can't be transitioned, a registered number can). At 0 and at 1 these are exactly
           the two gradients that used to be switched. */
        @property --lit { syntax: "<number>"; inherits: false; initial-value: 0; }
        /* how far a card is out of its wallet; --cq hands it down to the big card's shadows */
        @property --cp { syntax: "<number>"; inherits: false; initial-value: 0; }
        @property --cq { syntax: "<number>"; inherits: true; initial-value: 0; }
        .cell::before, .ycell::before {
          content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          background:
            linear-gradient(157deg, rgba(255,255,255,calc(0.13 + 0.07 * var(--lit))) 0%, rgba(255,255,255,calc(0.04 + 0.02 * var(--lit))) calc(22% + 2% * var(--lit)), transparent calc(46% + 4% * var(--lit))),
            radial-gradient(120% 80% at 84% 108%, rgba(0,0,0,calc(0.20 - 0.02 * var(--lit))), transparent 62%);
          transition: --lit .24s ease;
        }
        .cell:hover::before, .ycell:hover::before { --lit: 1; }
        .cell:hover, .ycell:hover {
          border-color: rgba(255,255,255,0.22) !important;
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 22px rgba(0,0,0,0.3);
        }
        .cell:active, .ycell:active { transform: translateY(0) scale(0.99); }
        .month-btn { color: #e8eaec; transition: color .18s ease, text-shadow .25s ease, transform .22s var(--ease); }
        .month-btn:hover { color: #ffffff; text-shadow: 0 0 18px rgba(255,255,255,0.28); }
        .cur-btn:hover { border-color: #6a7178 !important; color: #e8eaec !important; }
        .cur-opt:hover { background: #33373b !important; }
        /* compare: the ghost line, and its borderless button at the bottom right of the chart pop-up */
        .ch-morph { transition: d ${CMP_MS}ms var(--ease-soft), y ${CMP_MS}ms var(--ease-soft), height ${CMP_MS}ms var(--ease-soft), cy ${CMP_MS}ms var(--ease-soft); }
        .ch-slide { transition: transform ${CMP_MS}ms var(--ease-soft); }
        .cmp-line { stroke-opacity: 0.55; transition: d ${CMP_MS}ms var(--ease-soft), stroke-opacity ${CMP_MS}ms ease; }
        .cmp-line.line-sweep { animation-duration: 1.1s; animation-delay: .04s; }
        .cmp-line.gone { stroke-opacity: 0; }
        .wk-cmp { position: absolute; display: inline-flex; padding: 0; background: none; border: none; color: #6d757d; cursor: pointer; line-height: 0;
                  transition: color .18s ease; }
        .wk-cmp .msym { font-size: 18px; animation: wkCmpIn .3s var(--ease-soft) backwards; }
        .wk-cmp:hover { color: #e8eaec; }
        .wk-cmp.on { color: #a9bccd; }
        .wk-cmp:disabled { opacity: 0.4; cursor: default; color: #6d757d; }
        @keyframes wkCmpIn { from { opacity: 0; transform: scale(0.6) rotate(-45deg); } }
        .cmp-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; background: none; border: none; padding: 2px 0;
                   font-size: 12px; font-weight: 600; color: #6d757d; cursor: pointer; transition: color .18s ease; }
        .cmp-btn i { width: 14px; height: 2.4px; border-radius: 2px; background: ${CMP_INK}; opacity: 0.5; transition: opacity .18s ease; }
        .cmp-btn:hover { color: #e8eaec; }
        .cmp-btn.on { color: #a9bccd; }
        .cmp-btn.on i, .cmp-btn:hover i { opacity: 1; }
        .cmp-btn:disabled { opacity: 0.45; cursor: default; color: #6d757d; }
        .cmp-btn:disabled i { opacity: 0.5; }
        .chart-btn { transition: border-color .18s ease, color .18s ease; }
        .chart-btn:hover { border-color: #8a9299 !important; color: #e8eaec !important; }
        .chart-btn svg rect { transform-box: fill-box; transform-origin: center bottom; }
        .chart-btn:hover .cb1 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) both; }
        .chart-btn:hover .cb2 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) .07s both; }
        .chart-btn:hover .cb3 { animation: riseBar .45s cubic-bezier(0.34,1.25,0.64,1) .14s both; }
        @keyframes riseBar { from { transform: scaleY(0.2); } to { transform: scaleY(1); } }
        .collapse-btn { transition: border-color .18s ease, color .18s ease, transform .15s ease; }
        .collapse-btn:hover { border-color: #8a9299 !important; color: #ffffff !important; }
        .nav-arrow { background: none; border: none; color: #9aa3ab; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1; transition: color .15s; }
        .nav-arrow:hover { color: #e8eaec; }
        /* month switcher: the arrows fade in only while the pointer is on it (or an arrow has keyboard focus) */
        .month-nav { display: inline-flex; align-items: center; gap: 8px; }
        .month-nav .nav-arrow { opacity: 0; transition: opacity .2s ease, color .15s ease, transform .22s var(--ease); }
        .month-nav:hover .nav-arrow, .month-nav .nav-arrow:focus-visible { opacity: 1; }
        /* at the first January or the last December of the year list there is nowhere further to go */
        .month-nav .nav-arrow:disabled { cursor: default; color: #9aa3ab; }
        .month-nav:hover .nav-arrow:disabled { opacity: .25; }
        /* chart pop-up: the same hidden arrows, sitting right after the title */
        .chart-nav { display: inline-flex; align-items: center; gap: 6px; }
        .chart-per { display: inline-block; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .chart-lbl { display: inline-block; }
        .chart-lbl.next { animation: chartLblNext .26s var(--ease) backwards; }
        .chart-lbl.prev { animation: chartLblPrev .26s var(--ease) backwards; }
        @keyframes chartLblNext { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes chartLblPrev { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .chart-nav .nav-arrow { opacity: 0; transition: opacity .2s ease, color .15s ease; }
        .chart-nav:hover .nav-arrow, .chart-nav .nav-arrow:focus-visible { opacity: 1; }
        .chart-nav .nav-arrow:disabled { cursor: default; color: #9aa3ab; }
        .chart-nav:hover .nav-arrow:disabled { opacity: .25; }
        /* after a step the data redraws briskly; the slow first draw is only for opening */
        .ch-moved .line-sweep.slow { animation-duration: .3s; animation-delay: 0s; }
        .ch-moved .area-rise { animation-duration: .26s; animation-delay: 0s; }
        .trash-btn { display: inline-flex; align-items: center; justify-content: center; transition: background .18s ease, border-color .18s ease, color .18s ease; }
        .trash-btn:hover { background: #ffb3bb !important; border-color: #ffb3bb !important; color: #111 !important; }
        .trash-lid { transition: transform .25s cubic-bezier(0.34, 1.4, 0.64, 1); transform-box: fill-box; transform-origin: 15% 85%; }
        .trash-btn:hover .trash-lid { transform: rotate(-26deg) translate(-1.5px, -1px); }
        .plus-btn span { display: inline-block; transition: transform .18s ease; }
        .plus-btn:hover span { transform: scale(1.25); }
        .draw-btn { display: inline-flex; align-items: center; justify-content: center; }
        .draw-btn svg rect { transform-box: fill-box; transform-origin: center center; }
        .draw-btn:hover .pi-h { animation: drawH .38s cubic-bezier(0.34,1.2,0.64,1) both; }
        .draw-btn:hover .pi-v { animation: drawV .38s cubic-bezier(0.34,1.2,0.64,1) .06s both; }
        @keyframes drawH { from { transform: scaleX(0.18); } to { transform: scaleX(1); } }
        @keyframes drawV { from { transform: scaleY(0.18); } to { transform: scaleY(1); } }
        .collapse-btn { overflow: hidden; }
        .collapse-btn span { display: inline-block; }
        .collapse-btn .ca-rot { transition: transform .38s cubic-bezier(0.34,1.3,0.64,1); }
        .collapse-btn:hover .ca-loop { animation: arrowLoop .42s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes arrowLoop {
          0% { transform: translateY(0); }
          49% { transform: translateY(22px); }
          50% { transform: translateY(-22px); }
          100% { transform: translateY(0); }
        }
        .chip-flip { will-change: transform; }
        .ghost-plus { background: none; border: 1px solid #3a3f44; color: #9aa3ab; transition: background .18s ease, color .18s ease, border-color .18s ease; }
        .ghost-plus:hover { background: #3ddc97 !important; border-color: #3ddc97 !important; color: #111 !important; font-weight: 800 !important; }
        .limit-input { background: transparent; border: 1px solid transparent; transition: background .2s ease, border-color .2s ease; }
        .limit-input:hover, .limit-input:focus { background: #26292c !important; border-color: #3a3f44 !important; outline: none; }
        .amt-field { transition: border-color .25s ease, box-shadow .25s ease; outline: none !important; }
        .amt-field.green:focus { border-color: #3ddc97 !important; box-shadow: 0 0 0 2px rgba(61,220,151,0.14); }
        .amt-field.red:focus { border-color: #ff5d6c !important; box-shadow: 0 0 0 2px rgba(255,93,108,0.14); }
        .desc-field { transition: border-color .25s ease, box-shadow .25s ease; outline: none !important; }
        .desc-field:focus { border-color: #9aa3ab !important; box-shadow: 0 0 0 2px rgba(154,163,171,0.12); }
        .entry-row { transition: border-color .2s ease; }
        .entry-row.inc:hover { border-color: #2f7d5c !important; }
        .entry-row.exp:hover { border-color: #8f3b45 !important; }
        .entry-row input { background: transparent; border: none; outline: none; }
        /* liquid-glass chart bubble */
        /* the outer box only positions; opacity/scale animate on the glass itself, because a fading
           parent would cut the blur off from the chart behind it */
        .glass-tip { position: absolute; z-index: 5; pointer-events: none; transform: translate(-50%, calc(-100% - 16px)); }
        .glass-tip-inner { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 104px; padding: 9px 16px 10px;
                     border-radius: 16px; white-space: nowrap; position: relative; overflow: hidden;
                     background: linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.07) 100%), rgba(22,25,29,0.38);
                     backdrop-filter: blur(26px) saturate(170%); -webkit-backdrop-filter: blur(26px) saturate(170%);
                     animation: glassTipIn .22s cubic-bezier(0.34,1.35,0.64,1) both; transform-origin: 50% 100%;
                     border: 1px solid rgba(255,255,255,0.22);
                     box-shadow: 0 16px 36px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.25),
                                 inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.06), inset 0 0 18px rgba(255,255,255,0.05); }
        .glass-tip-inner::before { content: ""; position: absolute; inset: 0 0 55% 0; border-radius: 16px 16px 40% 40%;
                     background: linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0)); pointer-events: none; }
        .glass-tip-label { position: relative; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(232,234,236,0.62); }
        .glass-tip-value { position: relative; font-size: 15px; font-weight: 800; color: #ffffff; font-variant-numeric: tabular-nums;
                     text-shadow: 0 1px 8px rgba(0,0,0,0.35); }
        @keyframes glassTipIn { from { opacity: 0; transform: translateY(8px) scale(.9); } to { opacity: 1; transform: none; } }
        .glass-tip.below { transform: translate(-50%, 16px); }
        .glass-tip.below .glass-tip-inner { transform-origin: 50% 0%; animation-name: glassTipInBelow; }
        @keyframes glassTipInBelow { from { opacity: 0; transform: translateY(-8px) scale(.9); } to { opacity: 1; transform: none; } }
        .tip-dot { filter: drop-shadow(0 0 6px rgba(255,255,255,0.55)); }
        /* in-page cards sit on a smooth fixed gradient: blurring it is visually identical but costs a full-card
           GPU blur on every scrolled frame. Real blur is kept for things that float over content. */
        .flow-card.glass { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
                .cell:hover > .cell-tip { backdrop-filter: blur(18px) saturate(150%) !important; -webkit-backdrop-filter: blur(18px) saturate(150%) !important; }
        .cell-tip {
          background: rgba(30,34,39,0.94) !important;
          border: 1px solid rgba(255,255,255,0.20) !important;
          box-shadow: 0 14px 30px rgba(0,0,0,0.5) !important;
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
          position: absolute; bottom: calc(100% + 8px); left: 50%;
          transform: translateX(-50%) translateY(5px) scale(0.95);
          opacity: 0; pointer-events: none;
          transition: opacity .18s ease, transform .18s ease; z-index: 20; white-space: nowrap;
        }
        .cell:hover .cell-tip { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        .row-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .26s cubic-bezier(0.4,0,0.2,1); }
        .row-wrap.collapsing { grid-template-rows: 0fr; }
        .axis-fade { animation: axisIn .35s ease both; }
        /* axes grow out of the origin */
        .axis-y {
          transform-box: fill-box; transform-origin: bottom center;
          animation: axisGrow .5s var(--ease) both;
        }
        .axis-x {
          transform-box: fill-box; transform-origin: left center;
          animation: axisGrow .6s var(--ease) .12s both;
        }
        @keyframes axisGrow { from { transform: scale3d(1,0.02,1); opacity: 0.4; } to { transform: scale3d(1,1,1); opacity: 1; } }
        .axis-x { animation-name: axisGrowX; }
        @keyframes axisGrowX { from { transform: scale3d(0.02,1,1); opacity: 0.4; } to { transform: scale3d(1,1,1); opacity: 1; } }

        /* one continuous sweep from the first point to the right */
        .line-sweep {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          animation: drawLine 1.7s var(--ease-soft) .3s both;
        }
        .line-sweep.slow { animation-duration: .62s; animation-delay: .24s; }

        /* the gradient fill rises from the zero line */
        .area-rise {
          transform-box: view-box;
          animation: areaRise 1.1s var(--ease) .42s both;
        }
        @keyframes areaRise { from { transform: scaleY(0.04); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }

        /* chart tooltip settles smoothly between points */
        .ch-tip { animation: chTipIn .2s var(--ease) both; }
        @keyframes chTipIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .line-draw { stroke-dasharray: 1; animation: drawLine .55s ease both; }
        .bar-grow { animation: growBar .4s ease both; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes axisIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawLine { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes growBar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes fadeRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tileIn {
          0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.85); }
          25% { opacity: 0.6; }
          70% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes panelOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-16px) scale(0.97); } }
        @keyframes popOutCenter {
          0% { opacity: 1; transform: scale(1); }
          45% { opacity: 0.85; transform: scale(1.06); }
          100% { opacity: 0; transform: scale(0.9); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modalPop { 0% { opacity: 0; transform: scale(0.94) translateY(12px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modalPopOut { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.96) translateY(8px); } }
      `}</style>

      {/* one hidden icon, always present: it gets the icon font set up during the opening screen, so the first
          view that shows icons doesn't pay for that in the middle of its entrance animation */}
      <span className="msym" aria-hidden="true" style={{ position: "fixed", left: 0, top: 0, visibility: "hidden", pointerEvents: "none" }}>home</span>
      {/* the same for the few characters Inter doesn't have (▾ ✕ ▮ and the like), which the system supplies from its own
          fonts: the first time it is asked takes 30–50ms. Asked here, in the very first layout before anything shows,
          it no longer lands in the first month view or the first chart */}
      <span aria-hidden="true" style={{ position: "fixed", left: 0, top: 0, visibility: "hidden", pointerEvents: "none", whiteSpace: "nowrap", fontWeight: 500 }}>▾✕▮▬→←⇄↔≈★<b>▾✕▮▬</b></span>

      {(!launched || greetOn || yearIntro || tradeIn) && (
        <div data-nowarm="" className={`stage-bg${(yearIntro && introMove) || tradeIn ? " out" : ""}`} />
      )}

      {openPanel !== "done" && (
        <div key={openRun} className={`open-panel${openRun > 0 ? " again" : ""}${openGo ? "" : " wait"}${openPanel === "out" ? " out" : ""}`} aria-label="Flow"
             style={{ position: "fixed", inset: 0, zIndex: 300 }}>
          <div className="open-panel-bg" />
          <div className="open-panel-inner">
            <CrocLogo className="open-panel-logo" style={openFall.logo} />
            <div className="open-panel-word">
              {APP_WORD.split("").map((ch, i) => (
                <span key={i} className="opw-ch" style={{ "--d": `${280 + i * 70}ms`, ...openFall.letters[i] }}>
                  <span className="opw-sh" aria-hidden="true">{ch}</span>
                  <span className="opw-fg">{ch}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!launched && (openPanel !== "in" || walletsReady) && (
        <div ref={(el) => { launchRef.current = el; fitCard(); }} className={`launch-veil${launchExit ? " out" : ""}`}
             onMouseMove={onVeilMove}
             onClick={(e) => e.stopPropagation()}>

          {/* ambient dot field + cursor light on the background */}
          <div data-nowarm="" className="bg-dots" />
          {/* the lit dots are a pre-rendered circular window that slides with the cursor (GPU transform,
              no repaint); the pattern inside slides the opposite way so the dots stay aligned */}
          <div data-nowarm="" className="bg-lit-win" ref={litWinRef}><div className="bg-dots lit" ref={litInnerRef} /></div>
          <div data-nowarm="" className="bg-glow" ref={glowRef} />

          {/* wallets panel and trading selection: the hidden arrow in the top-left corner, one step back like Esc */}
          <button className={`pick-back${(choice === "wallet" || inMarkets) && !launchExit ? " on" : ""}`}
                  tabIndex={(choice === "wallet" || inMarkets) && !launchExit ? 0 : -1}
                  title="Back (Esc)" aria-label="Back"
                  onClick={(e) => {
                    e.stopPropagation(); e.currentTarget.blur();
                    if (launchExit) return;
                    if (inMarkets) { backToChoice("coin"); return; }
                    if (choice !== "wallet") return;
                    if (phase === 2) closeCard(); else backToChoice();
                  }}>
            <span className="msym">arrow_back</span>
          </button>

          {/* which side this is, in the pixel font: on the wallets panel and the trading panel, never on the selections panel */}
          {SIDE_WORDS.map((w, wi) => (
            <div key={w.text} className={`side-word${(wi === 0 ? choice === "wallet" && !launchExit : inMarkets) ? " on" : ""}`}>
              <div className="sw-tilt" ref={(el) => { sideTilt.current[wi] = el; }}>
                <div className="sw-float">
                  <div className="sw-3d">
                    {w.shades.map((c, i) => <span key={i} className="sw-l" style={{ color: c, transform: `translate3d(0, ${((SIDE_DEPTH - i) * SIDE_DROP).toFixed(1)}px, ${-(SIDE_DEPTH - i) * SIDE_STEP}px)` }}>{w.text}</span>)}
                    <span className="sw-face">{w.text}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className={`launch-wrap phase${phase}${picking ? (pickFocus === "coin" ? " pick pick-coin" : " pick") : inMarkets ? " markets" : choice === "trade" ? ` trade trade-${tradeKind}` : ""}`}>
            {/* ---- the card that gets pulled out ---- */}
            <div ref={cardRef}
                 className={`big-card${WALLETS.some((w) => w.cards[0] === picked) ? " from-back" : ""}${WALLETS[activeWallet]?.cards.includes(picked) ? "" : " away"}${launchExit ? " out" : ""}`}
                 onMouseMove={phase === 2 ? onCardMove : undefined}
                 onMouseEnter={phase === 2 ? onCardEnter : undefined}
                 onMouseLeave={phase === 2 ? onCardLeave : undefined}
                 onClick={(e) => { e.stopPropagation(); if (phase === 2 && +getComputedStyle(e.currentTarget).opacity > 0.5) enterApp(); }}>
              <div className="card-tilt">
                <div ref={floatRef} className={`launch-float${hoverCard ? " still" : ""}`}>
                  <i className="card-shadow near" /><i className="card-shadow far" />
                  <div className="launch-card">
                    <CardFace variant={picked} exp={walletExp(WALLETS.find((w) => w.cards.includes(picked)))} />
                    <div className="card-gloss" style={{
                          opacity: phase === 2 && hoverCard ? 1 : 0,
                        }} />
                    <div className={hoverCard ? "card-sheen lit" : "card-sheen"} style={{
                          opacity: phase === 2 ? (hoverCard ? 0.9 : 0.4) : 0,
                        }} />
                    <div className="card-edge" style={{
                          opacity: phase === 2 && hoverCard ? 1 : 0,
                        }} />
                    {phase === 2 && hoverCard && <div className="card-edge-blur on" />}
                  </div>
                </div>
              </div>
            </div>

            {/* ---- card holders ---- */}
            {WALLETS.map((w, wi) => {
              const isActive = wi === activeWallet;
              const dist = wi - activeWallet;
              const side = dist < 0 ? "side-left" : "side-right";
              const walletTucked = choice !== "wallet" && pickFocus === "coin";     // selections panel, coin in focus
              return (
                <div key={w.id}
                     className={`wallet-unit ${w.id} ${isActive ? "active" : side}${Math.abs(dist) > 1 ? " far" : ""}${launchExit && choice === "wallet" ? " out" : ""}`}
                     onMouseMove={isActive && phase === 1 && !walletTucked ? onCardMove : undefined}
                     onMouseEnter={isActive && phase === 1 && !walletTucked ? onCardEnter : undefined}
                     onMouseLeave={isActive && phase === 1 && !walletTucked ? onCardLeave : undefined}
                     onClick={(e) => {
                       e.stopPropagation();
                       // selections panel: a press anywhere on the wallet opens the wallets panel, or brings it back into focus
                       if (choice !== "wallet") { if (picking && isActive) { walletTucked ? focusPick("wallet") : chooseWallet(); } return; }
                       if (!isActive) { if (phase === 1) { setActiveWallet(wi); onCardLeave(); } return; }
                       if (phase === 2) closeCard();
                     }}>
                  <div className="wallet-3d">
                    <div className="holder">
                      <div className="hold-back" />
                      {w.cards.map((variant, ci) => (
                        <div key={variant}
                             className={`slot-card ${ci === 0 ? "gold" : "plat"}${picked === variant ? " sel" : ""}`}
                             onClick={(e) => {
                               if (choice !== "wallet") return;      // selections panel: the press belongs to the whole wallet
                               e.stopPropagation();
                               if (!isActive) { setActiveWallet(wi); onCardLeave(); return; }
                               phase === 1 ? openCard(variant) : closeCard();
                             }}>
                          <div className="slot-in"><CardFace variant={variant} exp={walletExp(w)} /></div>
                        </div>
                      ))}
                      {w.id === "python" ? (
                        <PythonBody shine={
                          <div className="leather-shine" style={{ opacity: isActive && phase === 1 && hoverCard ? 1 : 0 }}>
                            <div className="shine-spot" style={{ background: "radial-gradient(circle 260px at 50% 50%, rgba(255,240,235,0.14), transparent 70%)" }} />
                          </div>} />
                      ) : w.id === "puzzle"
                        ? <PuzzleBody shine={
                            <div className="leather-shine" style={{ opacity: isActive && phase === 1 && hoverCard ? 1 : 0 }}>
                              <div className="shine-spot" style={{ background: "radial-gradient(circle 260px at 50% 50%, rgba(255,246,230,0.13), transparent 70%)" }} />
                            </div>} />
                        : <ArenaBody shine={
                            <div className="leather-shine" style={{ opacity: isActive && phase === 1 && hoverCard ? 1 : 0 }}>
                              <div className="shine-spot" style={{ background: "radial-gradient(circle 260px at 50% 50%, rgba(226,238,250,0.16), transparent 70%)" }} />
                            </div>} />}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ---- selections panel: the trading coin, the wallet's neighbour. On the trading selection it is "crypto" ---- */}
            <div data-nowarm="" className={`coin-unit${choice === "wallet" ? " away" : picking ? (pickFocus === "coin" ? "" : " side")
                              : inMarkets ? (marketFocus === "idx" ? " side left" : "") : tradeKind === "idx" ? " side left gone" : ""}`}
                 onMouseMove={coinFocused ? onCoinMove : undefined}
                 onMouseEnter={coinFocused ? () => setHoverCoin(true) : undefined}
                 onMouseLeave={coinFocused ? onCoinLeave : undefined}
                 onClick={(e) => {
                   e.stopPropagation();
                   if (picking) { coinFocused ? openMarkets() : focusPick("coin"); }
                   else if (inMarkets) { coinFocused ? enterTrade("crypto") : focusMarket("crypto"); }
                 }}>
              <div className="coin-shadow" ref={coinShadowRef} />
              <div className="coin-smear"><div><div>
                <div className="coin-tilt" ref={coinTiltRef}>
                  <div className={`coin-float${coinFocused && !hoverCoin ? "" : " still"}`}>
                    <BtcCoin lustreRef={coinLustreRef} glareRef={coinGlareRef} />
                  </div>
                </div>
              </div></div></div>
            </div>

            {/* ---- trading selection: the IDX globe, Indonesian stocks ---- */}
            <div className={`idx-unit${inMarkets ? (globeFocused ? "" : " side") : choice === "trade" ? (tradeKind === "idx" ? " go" : " side gone") : " away"}`}
                 onMouseMove={globeFocused ? onGlobeMove : undefined}
                 onMouseEnter={globeFocused ? () => setHoverGlobe(true) : undefined}
                 onMouseLeave={globeFocused ? onGlobeLeave : undefined}
                 onClick={(e) => { e.stopPropagation(); if (inMarkets) { globeFocused ? enterTrade("idx") : focusMarket("idx"); } }}>
              <div className="idx-halo" />
              <div className="idx-lift"><IdxGlobe canvasRef={globeCanvasRef} live={globeLive} still={!globeFocused || hoverGlobe} /></div>
            </div>
          </div>
        </div>
      )}

      {greetOn && (
        <div className={`greet-veil${greetExit ? " out" : ""}`}>
          <div className="greet-title">
            {now.getHours() < 12 ? "Good Morning," : now.getHours() < 18 ? "Good Afternoon," : "Good Evening,"}
          </div>
          <div className="greet-name">Rassam</div>
        </div>
      )}


      {launched && yearIntro && (
        <div className="year-intro">
          <div ref={introTextRef}
               className={`year-intro-text yi-${picked}${introMove ? " moving" : ""}`}
               style={introMove && introTarget
                 ? { transform: `translate(${introTarget.dx}px, ${introTarget.dy}px) scale(${introTarget.scale})` }
                 : undefined}>
            {String(year).split("").map((ch, i) => (
              <span key={i} className={`yi-ch${introMove ? " settled" : ""}`}
                    style={{ animationDelay: `${i * 55}ms`,
                             ...(introMove && introTarget?.shift ? { translate: `${introTarget.shift[i].toFixed(2)}px 0` } : null) }}>{ch}</span>
            ))}
          </div>
        </div>
      )}

      {!launched ? null : view === "trade" ? (
        <div className="term"><TradeTracker key={tradeKind} market={tradeKind} onHome={goHome} /></div>
      ) : view === "year" ? (
        <div ref={yearWrapRef}>
          <div className="year-shell" style={{ opacity: yearIntro ? 0 : 1 }}>
            <div style={S.yearHeader}>
              <div style={S.yearBigWrap}>
                <span ref={headerYearRef} className={`recap-link year-big${yearRise ? " year-big-anim" : ""}${yearFlick ? " flick" : ""}`} style={S.yearBig}
                      title={`${year} wrapped`} onClick={() => openRecap({ kind: "year", y: year })}>
                  {String(year).split("").map((ch, i, all) => (
                    <span key={i} className={`yb-cell${yearFlick?.[i] ? ` ${yearFlick[i].cls}` : ""}`} style={yearFlick?.[i]?.style}>
                      <span className="yb-px">{i < all.length - 1 ? ch : <DigitRoll digit={Number(ch)} height={48} />}</span>
                      {(yearIntro || yearFlick) && <span className="yb-n" aria-hidden="true">{ch}</span>}
                    </span>
                  ))}
                </span>
              </div>
              {/* the year as a poster: one figure, huge, with a glow of its colour; the bar and the rest under it */}
              <div className="poster" style={{ ...S.yearBarWrap, "--hc": remainColor(yearRemaining) }}>
                <div className="poster-line">
                  <span className="poster-num">
                    <CountNum value={yearRemaining} duration={560} render={(n, b, sp) => `${n < 0 ? "−" : ""}${fmtLive(Math.abs(n), b, sp)}`} />
                  </span>
                  <span className="poster-cap">
                    <b>{yearRemaining >= 0 ? "net gain" : "net loss"} this year</b>
                    <span>{fmt(yearStats.income)} in · <CountNum value={yearStats.spent} duration={560} render={fmtLive} /> out</span>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <SplitBar remainingVal={yearRemaining} totalVal={yearStats.income} frac={yearRemainFrac} animKey={`y-${currency}-${yearIntro ? "i" : "l"}`} />
                  </div>
                  {ChartButton({ title: "Yearly chart" })}
                </div>
              </div>
            </div>

            <div className="qadd-row"><QuickAdd api={quickApi} cur={cur} isMYR={isMYR} boxRef={quickBoxRef} /></div>

            <div className="year-nav glass">
              <button className="ynav-btn" title="Previous year (↑)"
                      disabled={yearIdx === 0}
                      onClick={() => stepYear(-1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 15.5 L12 8.5 L19 15.5" />
                </svg>
              </button>
              <button className="ynav-btn" title="Next year (↓)"
                      disabled={yearIdx === YEARS.length - 1}
                      onClick={() => stepYear(1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8.5 L12 15.5 L19 8.5" />
                </svg>
              </button>
            </div>

            <div className="year-viewport with-qadd" key={`vp-${yearIntro ? "intro" : "live"}`}>
              <div className={`year-track${yearShift ? " shifting" : ""}`}
                   style={{ transform: `translateY(calc(${yearIdx === 0 ? 0 : yearIdx === YEARS.length - 1 ? YEAR_PEEK : YEAR_PEEK / 2}px - var(--yb) * ${yearIdx}))` }}>
                {YEARS.map((yr, yi) => {
                  const st = allYearStats[yi];
                  const active = yr === year;
                  return (
                    <div key={yr} className={`year-block${active ? " active" : ""}`}
                         onClick={() => { if (!active) stepYear(yi - yearIdx); }}>
                      <div className="year-block-tag">{yr}</div>
                      <div style={S.yearGrid}>
                        {MONTHS_SHORT.map((name, m) => {
                          const ms = st.months[m];
                          const hasAnything = ms.hasData || ms.income > 0;
                          const profit = ms.income - ms.spent;
                          const isNow = yr === now.getFullYear() && m === now.getMonth();
                          const color = !hasAnything ? "#8a9299" : profit >= 0 ? "#3ddc97" : "#ff5d6c";
                          const bg = !hasAnything ? "#26292c" : profit >= 0 ? "rgba(61,220,151,0.08)" : "rgba(255,93,108,0.10)";
                          const border = isNow ? "#7fb6e0" : !hasAnything ? "#33373b" : profit >= 0 ? "#1e4436" : "#5a2830";
                          return (
                            <div key={name} className="ycell"
                                 style={{ ...S.yearCell, background: bg, borderColor: border,
                                          animation: active ? `tileIn .42s var(--ease) ${m * 22}ms backwards` : "none" }}
                                 onClick={() => { if (active) { setYear(yr); setMonth(m); setSelected(null); setFromYear(true); setView("month"); setTimeout(() => setFromYear(false), 1100); } }}>
                              <span style={S.yearCellName}>{name}</span>
                              {yearSparks[`${yr}-${m}`] && (
                                <svg className="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
                                  <path d={yearSparks[`${yr}-${m}`]} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              {hasAnything ? (
                                <>
                                  <span style={{ ...S.yearCellSpent, color }}>
                                    <CountNum value={profit} duration={560}
                                              render={(n, b, sp) => `${n >= 0 ? "" : "-"}${fmtLive(Math.abs(n), b, sp)}`} />
                                  </span>
                                  <span style={S.yearCellExp}>
                                    <CountNum value={ms.spent} duration={560}
                                              render={(n, b, sp) => `-${fmtLive(n, b, sp)}`} />
                                  </span>
                                </>
                              ) : (
                                <span style={{ ...S.yearCellSpent, color: "#8a9299" }}>·</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={fromYear ? "month-view enter" : "month-view"}>
          <div style={S.topRow}>
            <h1 className={`recap-link month-big${monthFlick?.cells ? (monthFlick.from ? " swap" : " flick") : ""}`} style={S.title} title={`${MONTHS_FULL[month]} wrapped`}
                onClick={() => openRecap({ kind: "month", y: year, m: month })}>
              {Array.from({ length: monthFlick?.cells ? monthFlick.cells.length : MONTHS_FULL[month].length }, (_, i) => {
                const ch = MONTHS_FULL[month][i], f = monthFlick?.cells?.[i];
                const old = f && monthFlick.from ? monthFlick.from[i] : undefined;
                return (
                  <span key={`${monthFlick?.id || 0}-${i}`} className={`yb-cell${f ? ` ${f.cls}` : ""}${ch === "t" ? " tt" : ""}`} style={f?.style}>
                    {ch && <span className="yb-px">{ch}</span>}
                    {f && ch && !monthFlick.from && <span className="yb-n" aria-hidden="true">{ch}</span>}
                    {old && <span className="yb-old" aria-hidden="true">{old}</span>}
                  </span>
                );
              })}
            </h1>
            <div style={S.navBox}>
              {/* the arrows stay hidden until the pointer is on the month switcher */}
              <span className="month-nav">
                <button className="nav-arrow" disabled={!monthAfter(year, month, -1)} title="Previous month (←)" onClick={() => nav(-1)}>‹</button>
                <button className="month-btn" style={S.monthLabelBtn}
                        onClick={() => { setYearRise(true); setView("year"); setTimeout(() => setYearRise(false), 700); }}
                        title="View year">{monthLabel}</button>
                <button className="nav-arrow" disabled={!monthAfter(year, month, 1)} title="Next month (→)" onClick={() => nav(1)}>›</button>
              </span>
              <button className="cur-btn" style={S.currency}
                      title="Switch currency"
                      onClick={(e) => { e.stopPropagation(); pickCurrency(isMYR ? "IDR" : "MYR"); }}>
                <CurrencyRoll idx={isMYR ? 1 : 0} />
              </button>
            </div>
          </div>

          <div style={S.incomeRow}>
            <label style={S.incomeLabel}>Income ({cur})</label>
            <span style={{ position: "relative", display: "inline-block", width: 150 }}>
              <input className="amt-field green" style={{ ...S.incomeInput, width: "100%" }} inputMode="numeric"
                     placeholder={isMYR ? "e.g. 120" : "e.g. 500.000"} value={incomeDraft}
                     onChange={(e) => setIncomeDraft(sanitizeAmount(e.target.value, isMYR))}
                     onKeyDown={(e) => {
                       if (e.key !== "Enter") return;
                       if (needsGhost(incomeDraft)) { setIncomeDraft(parseNum(digitsOf(incomeDraft) + "000").toLocaleString("id-ID")); return; }
                       addIncomeEntry(amtToIDR(incomeDraft), "", quickIncomeDay());
                       setIncomeDraft(""); setShowIncomeList(true);
                     }} />
              {needsGhost(incomeDraft) && (
                <span style={{ ...S.ghostOverlay, fontSize: 15 }} aria-hidden="true">
                  <span style={{ visibility: "hidden" }}>{incomeDraft}</span>
                  <span style={{ color: "#6d757d" }}>.000</span>
                </span>
              )}
            </span>
            <button className="ghost-plus" style={S.ghostPlusBtn} title="Add income"
                    onClick={() => { addIncomeEntry(amtToIDR(incomeDraft), "", quickIncomeDay()); setIncomeDraft(""); setShowIncomeList(true); }}>+</button>
            <button className="collapse-btn" style={S.arrowBtn}
                    onClick={() => setShowIncomeList((v) => !v)} title="Income history">
              <span className="ca-loop"><span className="ca-rot" style={{ transform: showIncomeList ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span></span>
            </button>
            <span style={S.limitWrap}>
              <button className="limit-label" style={S.incomeLabel}
                      title={`Triple-click to use this limit for every month of ${year}`}
                      onClick={(e) => { if (e.detail === 3) applyLimitToYear(); }}>Daily limit:</button>
              {limitFlash > 0 && (
                <span key={limitFlash} className="limit-flash" onAnimationEnd={() => setLimitFlash(0)}>Applied to all of {year}</span>
              )}
              <input className="limit-input" style={S.limitInput} inputMode="numeric"
                     value={isMYR ? (dailyLimit / MYR_RATE).toFixed(2) : toDisp(dailyLimit).toLocaleString("id-ID")}
                     onChange={(e) => saveLimit(sanitizeAmount(e.target.value, isMYR))} />
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateRows: showIncomeList ? "1fr" : "0fr", transition: "grid-template-rows .28s cubic-bezier(0.4, 0, 0.2, 1)" }}>
            <div style={S.fold}>
              <div className="glass-soft" style={{ ...S.incomeList, opacity: showIncomeList ? 1 : 0, transform: showIncomeList ? "translateY(0)" : "translateY(-10px)", transition: "opacity .25s ease, transform .25s ease" }}>
                {monthIncomes.length === 0 ? (
                  <span style={S.emptyList}>No income recorded this month.</span>
                ) : sortedIncomes.map((it) => (
                  <span key={it.id} className="chip-flip" ref={(el) => { chipRefs.current[it.id] = el; }} style={S.incomeChip}>
                    +{chipAmt(it.amount)}{cur}
                    {it.day ? <span style={S.chipDay}>({it.day})</span> : null}
                    <button className="chip-x" style={S.chipDel} onClick={() => deleteIncomeNow(it.id)} aria-label="Delete">×</button>
                  </span>
                ))}
                {monthIncomes.length > 0 && <span style={S.incomeTotal}>Total {chipAmt(totalIncome)}{cur}</span>}
              </div>
            </div>
          </div>

          {/* the month at a glance: one card in the colour of the month's result, the figure big, four tiles under the bar */}
          <div className="hero" style={{ "--hc": stats.pnl >= 0 ? "#3ddc97" : "#ff5d6c" }}>
            <div className="hero-head">
              <span className="hero-tag"><i />PnL this month</span>
              {pnlVsPrev && (
                <span key={`vs-${year}-${month}`} className="hero-vs">
                  <b style={{ color: pnlVsPrev.pct >= 0 ? "#3ddc97" : "#ff5d6c" }}>
                    {pnlVsPrev.pct >= 0 ? "+" : "−"}{Math.abs(pnlVsPrev.pct).toFixed(1).replace(".", ",")}%
                  </b>
                  {" "}vs {pnlVsPrev.name}
                </span>
              )}
            </div>
            <div className="hero-num">
              <CountNum value={stats.pnl} duration={280}
                        render={(n, b, sp) => `${n >= 0 ? "+" : ""}${fmtLive(n, b, sp)}`} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <SplitBar remainingVal={remaining} totalVal={totalIncome} frac={remainFrac} animKey={`m-${currency}`} />
              </div>
              {ChartButton({ title: "Monthly chart" })}
            </div>
            <div className="hero-tiles">
              <div className="hero-tile" style={{ "--tc": remainColor(remaining) }}>
                <span className="ht-cap">Left</span>
                <span className="ht-val" style={{ color: remainColor(remaining) }}><CountNum value={remaining} duration={260} render={fmtLive} /></span>
                <span className="ht-sub">of {fmt(totalIncome)} income</span>
              </div>
              <div className="hero-tile" style={{ "--tc": "#ff5d6c" }}>
                <span className="ht-cap">Spent</span>
                <span className="ht-val"><CountNum value={stats.spent} duration={260} render={fmtLive} /></span>
                <span className="ht-sub"><CountNum value={totalIncome > 0 ? (stats.spent / totalIncome) * 100 : 0} duration={260} render={(n) => Math.round(n)} />% of income</span>
              </div>
              <div className="hero-tile" style={{ "--tc": "#3ddc97" }}>
                <span className="ht-cap">Under the limit</span>
                <span className="ht-val"><CountNum value={stats.greenDays} duration={260} render={(n) => Math.round(n)} /> <small>days</small></span>
                <span className="ht-sub" style={{ color: "#3ddc97" }}>+<CountNum value={stats.greenSum} duration={260} render={fmtLive} /></span>
              </div>
              <div className="hero-tile" style={{ "--tc": "#ff5d6c" }}>
                <span className="ht-cap">Over the limit</span>
                <span className="ht-val"><CountNum value={stats.redDays} duration={260} render={(n) => Math.round(n)} /> <small>days</small></span>
                <span className="ht-sub" style={{ color: "#ff5d6c" }}><CountNum value={stats.redSum} duration={260} render={fmtLive} /></span>
              </div>
            </div>
          </div>

          <div className="cal-wrap">
          <div key={`grid-${year}-${month}`} style={S.grid}>
            {DOW.map((d, i) => <div key={i} style={S.dowCell}>{d}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={"e" + i} />;
              const items = spending[keyOf(year, month, d)];
              const has = items && items.length > 0;
              const spent = has ? items.reduce((s, it) => s + it.amount, 0) : 0;
              const dIncomes = monthIncomes.filter((it) => it.day === d);
              const incTotal = dIncomes.reduce((s, it) => s + it.amount, 0);
              const color = spendColor(spent, dailyLimit);
              const bg = !has ? "#26292c" : spendTint(spent, dailyLimit);
              const border = selected === d ? "#ffffff" : d === todayNum ? "#7fb6e0" : has ? spendBorder(spent, dailyLimit) : "#33373b";
              const dayPnl = dailyLimit - spent;
              const dots = [...dIncomes.map(() => "g"), ...(has ? items.map((it) => (it.zero ? "z" : "r")) : [])];
              const dayKey = keyOf(year, month, d);
              return (
                <div key={d} className={`cell${i < 7 ? " tip-below" : ""}${d === todayNum ? " today" : ""}${has && spent > dailyLimit ? " over" : ""}`}
                     style={{ ...S.cell, background: bg, borderColor: border, animation: `tileIn .2s var(--ease) ${d * 2}ms backwards` }}
                     onClick={() => { setSelected(d); setNewAmt(""); setNewDesc(""); setNewIncAmt(""); setNewIncDesc(""); }}>
                  {has && spent > 0 && <i className="cbar" style={{ animationDelay: `${90 + d * 4}ms`, height: `${Math.round(Math.min(1, spent / (dailyLimit * 2 || 1)) * 78)}%`, color }} />}
                  <span className="cell-tip glass" style={S.cellTip}>
                    <span style={S.cellTipDate}>{d} {monthLabelFull}</span>
                    <span style={S.cellTipRow}>
                      <span style={{ color: "#3ddc97" }}>+ {fmt(incTotal)}</span>
                      <span style={{ color: "#ff5d6c" }}>− {fmt(spent)}</span>
                    </span>
                    {has && items.some((it) => it.zero) && <span style={{ color: "#a5efcd", fontSize: 11 }}>No spend day</span>}
                  </span>
                  <span style={S.cellDay}>{d}</span>
                  {(dots.length > 0 || (dotGhosts[dayKey] || []).length > 0) && (
                    <span style={{ ...S.dotGrid, gridTemplateColumns: `repeat(${Math.min(dots.length + (dotGhosts[dayKey] || []).length, DOTS_PER_ROW)}, 4px)` }}>
                      {dots.map((t, k) => (
                        <span key={`${t}-${k}`} className="dot-in" style={{ ...S.dot, background: t === "g" ? "#3ddc97" : t === "z" ? "#8a9299" : "#ff5d6c" }} />
                      ))}
                      {(dotGhosts[dayKey] || []).map((t, k) => (
                        <span key={`gh-${k}`} className="dot-out" style={{ ...S.dot, background: t === "g" ? "#3ddc97" : t === "z" ? "#6d757d" : "#ff5d6c" }} />
                      ))}
                    </span>
                  )}
                  {has && spent === 0 && items.some((it) => it.zero) ? (
                    <>
                      <span className="nospend-tag">No spend</span>
                      <span style={{ ...S.cellPnlSmall, color: "#a5efcd" }}>(+{fmt(dailyLimit)})</span>
                    </>
                  ) : has ? (
                    <>
                      <span style={{ ...S.cellSpent, color }}>{fmt(spent)}<span style={S.cellLimit}>/{fmt(dailyLimit)}</span></span>
                      <span style={{ ...S.cellPnlSmall, color: dayPnl >= 0 ? "#a5efcd" : "#ffb3bb" }}>
                        ({dayPnl >= 0 ? "+" : "-"}{fmt(Math.abs(dayPnl))})
                      </span>
                    </>
                  ) : <span style={S.cellEmpty}>·</span>}
                </div>
              );
            })}
          </div>
          </div>

          {/* as wide as the calendar and the cards under it, like the trading side's (he sent a picture of it sitting
              narrower than the other boxes). The margins are on this outer box, so the panel is not cut at the sides
              while it opens */}
          <div style={{ display: "grid",
                        gridTemplateRows: selected !== null && !panelClosing ? "1fr" : "0fr",
                        transition: "grid-template-rows .32s cubic-bezier(0.4,0,0.2,1)", margin: "0 -14px" }}>
           <div style={{ overflow: panelAnim ? "hidden" : "visible", minHeight: 0 }}>
          {selected !== null && (
            <div key={`panel-${selKey}`} className="glass" style={{ ...S.panel, opacity: panelClosing ? 0 : 1, transition: "opacity .24s ease" }}>
              <div style={S.panelHead}>
                <span style={S.panelTitle}>{selected} {monthLabelFull}</span>
                <span style={S.panelTotal}>
                  Total {fmt(dayTotal(selected))} / {fmt(dailyLimit)} · PnL{" "}
                  <strong style={{ color: dailyLimit - dayTotal(selected) >= 0 ? "#3ddc97" : "#ff5d6c" }}>
                    {dailyLimit - dayTotal(selected) >= 0 ? "+" : ""}{fmt(dailyLimit - dayTotal(selected))}
                  </strong>
                </span>
                <button className="x-btn" style={S.closeBtn} onClick={closePanel}>✕</button>
              </div>

              <div style={{ ...S.sectionLabel, animation: "fadeDown .25s ease .04s both" }}>Income</div>
              <div style={{ ...S.addRow, animation: "fadeDown .25s ease .07s both" }}>
                <AmountField value={newIncAmt} setValue={setNewIncAmt} accent="green" cur={cur} ghost={needsGhost(newIncAmt)} allowDecimal={isMYR}
                             onSubmit={() => { addIncomeEntry(amtToIDR(newIncAmt), newIncDesc.trim(), selected); setNewIncAmt(""); setNewIncDesc(""); }} />
                <input className="desc-field" style={{ ...S.darkInput, flex: 1, minWidth: 160 }} placeholder="Description — e.g. salary, bonus"
                       value={newIncDesc} onChange={(e) => setNewIncDesc(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") { addIncomeEntry(amtToIDR(newIncAmt), newIncDesc.trim(), selected); setNewIncAmt(""); setNewIncDesc(""); } }} />
                <button className="draw-btn" style={S.addIconBtn} title="Add income"
                        onClick={() => { addIncomeEntry(amtToIDR(newIncAmt), newIncDesc.trim(), selected); setNewIncAmt(""); setNewIncDesc(""); }}>
                  <PlusIcon />
                </button>
              </div>
              {selIncomes.length > 0 && (
                <div style={{ ...S.expList, marginBottom: 14 }}>
                  {selIncomes.map((it, idx) => (
                    <div key={it.id} className={`row-wrap${removing[it.id] ? " collapsing" : ""}`}>
                      <div style={S.fold}>
                        <div style={{ display: "flex",
                          animation: removing[it.id] ? "popOutCenter .24s ease both" : `fadeDown .25s ease ${90 + idx * 45}ms backwards`,
                          transformOrigin: "center center" }}>
                          <div className="entry-row glass-soft inc" style={S.entryRow}>
                            <input style={{ ...S.entryAmt, color: "#3ddc97" }} inputMode="numeric" value={dispStr(it.amount)}
                                   onChange={(e) => editIncome(it.id, "amount", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <span style={S.entryDivider} />
                            <input style={S.entryDesc} value={it.desc} placeholder=""
                                   onChange={(e) => editIncome(it.id, "desc", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <button className="trash-btn" style={S.delBtn} onClick={() => deleteIncome(it.id)} title="Delete"><TrashIcon /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ ...S.sectionLabel, animation: "fadeDown .25s ease .1s both" }}>Expenses</div>
              <div style={{ ...S.addRow, animation: "fadeDown .25s ease .13s both" }}>
                <AmountField value={newAmt} setValue={setNewAmt} accent="red" cur={cur} ghost={needsGhost(newAmt)} allowDecimal={isMYR} onSubmit={addExpense} />
                <input className="desc-field" style={{ ...S.darkInput, flex: 1, minWidth: 160 }} placeholder="Description — e.g. lunch, fuel, coffee"
                       value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                       onKeyDown={(e) => e.key === "Enter" && addExpense()} />
                <button className="draw-btn" style={S.addIconBtnRed}
                        title="Add expense · double-click for a no-spend day"
                        onClick={addExpense} onDoubleClick={addZeroDay}><MinusIcon /></button>
              </div>

              {selItems.length === 0 ? (
                <p style={S.emptyList}>No expenses recorded for this day.</p>
              ) : (
                <div style={S.expList}>
                  {selItems.map((it, idx) => (
                    <div key={it.id} className={`row-wrap${removing[it.id] ? " collapsing" : ""}`}>
                      <div style={{ overflow: removing[it.id] ? "hidden" : "visible", minHeight: 0 }}>
                        <div style={{ display: "flex",
                          animation: removing[it.id] ? "popOutCenter .24s ease both" : `fadeDown .25s ease ${160 + idx * 45}ms backwards`,
                          transformOrigin: "center center" }}>
                          {it.zero ? (
                          <div className="entry-row glass-soft nospend-row" style={S.entryRow}>
                            <span className="msym" style={{ fontSize: 19, color: "#8fd7a4", marginLeft: 4 }}>do_not_disturb_on</span>
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#c9f2dd" }}>No spend day</span>
                            <span style={{ fontSize: 12, color: "#8fd7a4", marginRight: 6 }}>+{fmt(dailyLimit)} kept</span>
                            <button className="trash-btn" style={S.delBtn} onClick={() => deleteExpense(it.id)} title="Remove no-spend mark"><TrashIcon /></button>
                          </div>
                          ) : (
                          <div className="entry-row glass-soft exp" style={S.entryRow}>
                            <input style={{ ...S.entryAmt, color: "#ff5d6c" }} inputMode="numeric" value={dispStr(it.amount)}
                                   onChange={(e) => editExpense(it.id, "amount", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <span style={S.entryDivider} />
                            <input style={S.entryDesc} value={it.desc} placeholder=""
                                   onChange={(e) => editExpense(it.id, "desc", e.target.value)} onBlur={commitEdits}
                                   onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
                            <span style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                              <button className="ham-btn" style={S.catBtn} title="Category"
                                      onClick={() => setCatMenu(catMenu && catMenu.id === it.id ? null : { id: it.id, stage: "cats", closing: false })}>
                                <CatReel cat={it.cat || inferCat(it.desc) || aiCats[it.id] || null} customIcon={it.icon || null} />
                              </button>

                              {catMenu && catMenu.id === it.id && catMenu.stage === "cats" && (
                                <div className={`cat-pop glass${catMenu.closing ? " closing" : ""}`} style={S.catPop}>
                                  {CAT_ORDER.map((c) => (
                                    <button key={c} className="cat-opt" style={S.catOpt} title={CATS[c].label}
                                            onClick={() => {
                                              if (c === "other") { setOtherDesc(it.desc || ""); setCatMenu({ id: it.id, stage: "other", closing: false }); return; }
                                              setItemCat(it.id, c, null); closeCatMenu();
                                            }}>
                                      <span className="msym" style={{ fontSize: 19 }}>{CATS[c].icon}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {catMenu && catMenu.id === it.id && catMenu.stage === "other" && (
                                <div className={`cat-pop glass${catMenu.closing ? " closing" : ""}`} style={S.otherPop}>
                                  <input style={S.otherInput} placeholder="Description" value={otherDesc} autoFocus
                                         onChange={(e) => setOtherDesc(e.target.value)}
                                         onKeyDown={(e) => { if (e.key === "Enter") { setItemDescAndCat(it.id, otherDesc, "other"); closeCatMenu(); } }} />
                                  <button className="icon-opt" style={S.globeBtn} title="Choose an icon"
                                          onClick={() => setCatMenu({ id: it.id, stage: "icons", closing: false })}>
                                    <span className="msym" style={{ fontSize: 19, color: "#e3b341" }}>language</span>
                                  </button>
                                </div>
                              )}

                              {catMenu && catMenu.id === it.id && catMenu.stage === "icons" && (
                                <div className={`cat-pop glass${catMenu.closing ? " closing" : ""}`} style={S.iconPop}>
                                  {ICON_CHOICES.map((ic) => (
                                    <button key={ic} className="icon-opt" style={S.iconOpt}
                                            onClick={() => { setItemDescAndCat(it.id, otherDesc, "other", ic); closeCatMenu(); }}>
                                      <span className="msym" style={{ fontSize: 19 }}>{ic}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>
                            <button className="trash-btn" style={S.delBtn} onClick={() => deleteExpense(it.id)} title="Delete"><TrashIcon /></button>
                          </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
           </div>
          </div>

          <FoldCard title="Weekly expenses" name="weekly expenses" runKey={weekData.range}
                    sub={<><CountNum value={weekData.total} duration={560} render={fmtLive} /> · {weekData.range}</>}>
            {renderWeek()}
          </FoldCard>

          {/* each part opens when it is scrolled to, not all of them when the top of the card first shows */}
          <FoldCard parts title="Money flow" name="money flow" runKey={`${year}-${month}`} sub={monthLabel}>
            <Reveal>{renderFlow()}</Reveal>
            <Reveal>{renderScore()}</Reveal>
            <Reveal>{renderProjection()}</Reveal>
            <Reveal>{renderInsights()}</Reveal>
          </FoldCard>

          <FoldCard title="Goals" name="goals" runKey="goals" loose={!!goalIconMenu} style={{ position: "relative", zIndex: goalIconMenu ? 6 : "auto" }}
                    sub={goals.length > 0 && <><CountNum value={goals.reduce((a, g) => a + goalSaved(g), 0)} duration={600} render={fmtLive} />{" of "}{fmt(goals.reduce((a, g) => a + g.target, 0))}</>}>
            {renderGoals()}
            <Debts debts={debts} api={debtApi} cur={cur} isMYR={isMYR} />
          </FoldCard>
        </div>
      )}

      {launched && recap && renderRecap()}
      {launched && cfgDraft && <TestCfg cfg={testCfg} closing={cfgClosing} year={year} month={month} fmt={fmt} onRun={runTestCfg} onClose={closeTestCfg} />}

      {launched && scoreView && renderScoreInfo()}

      {launched && catView && (
        <div style={{ ...S.backdrop, animation: catViewClosing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={closeCatView}>
          <div className="glass" style={{ ...S.modal, width: "min(620px, 94vw)", animation: catViewClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }}
               onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <span key={`ttl-${catView}`} className="bd-title" style={{ ...S.panelTitle, display: "inline-flex", alignItems: "center", gap: 9 }}>
                {catView === "income"
                  ? <span style={S.bdIconWin}><span className="msym" style={{ fontSize: 20, color: CAT_COLORS.income }}>money</span></span>
                  : catView === "left"
                  ? <span style={S.bdIconWin}><span className="msym" style={{ fontSize: 20, color: CAT_COLORS.left }}>savings</span></span>
                  : <CatTitleReel cat={catView} />}
                {catView === "income" ? "Income Sources" : catView === "left" ? "Left Over" : catView === "bills" ? "Bills" : `${CATS[catView].label} Expenses`}
                <span key={`vs-${catView}`} style={S.bdVs}>
                  VS LAST MONTH{" "}
                  <span style={{ color: "#747c84" }}>
                    {catBreakdown.vsPct === null ? "N/A" : `${catBreakdown.vsPct >= 0 ? "+" : "−"}${Math.abs(Math.round(catBreakdown.vsPct))}%`}
                  </span>
                </span>
              </span>
              <button className="x-btn" style={S.closeBtn} onClick={closeCatView}>✕</button>
            </div>
            <div style={S.modeRow}>
              {["income", ...CAT_ORDER, "left"].map((c) => {
                const active = catView === c;
                const hot = hoverBtn === c && suppressBtn !== c;
                const col = CAT_COLORS[c];
                return (
                  <button key={c} title={c === "income" ? "Income sources" : c === "left" ? "Left over" : CATS[c].label}
                          onMouseEnter={() => { if (suppressBtn !== c) setHoverBtn(c); }}
                          onMouseLeave={() => { setHoverBtn(null); if (suppressBtn === c) setSuppressBtn(null); }}
                          onClick={() => { setCatView(c); setHoverBtn(null); setSuppressBtn(c); }}
                          style={{ ...S.modeBtn, minWidth: 38, ...(c === "left" ? { marginLeft: "auto" } : null),
                            color: active ? col : hot ? "#e8eaec" : "#6d757d",
                            borderColor: active ? col : hot ? "#8a9299" : "#33373b",
                            background: active ? "#1e2124" : "none",
                            display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <span className={`cat-swap${hot ? " on" : ""}`}>
                      <span className="msym glyph g-base" style={{ fontSize: 17 }}>{c === "income" ? "savings" : c === "left" ? "account_balance_wallet" : CATS[c].icon}</span>
                      <span className="msym glyph g-hover" style={{ fontSize: 17 }}>{CAT_HOVER_ICON[c]}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", transition: "height .34s cubic-bezier(0.4,0,0.2,1)", height: bdHeight, overflow: "hidden" }}>
              <div ref={bdRef} style={{ alignSelf: "start" }}>
                {catBreakdown.rows.length === 0 ? (
                  <div key={`empty-${catView}`} className="bd-item" style={S.flowEmpty}>{catView === "income" ? "No income recorded this month." : catView === "left" ? "Nothing left over this month." : "Nothing recorded in this category this month."}</div>
                ) : (
                  <div key={`bd-${catView}`} style={S.bdList}>
                    {catBreakdown.rows.map((r, i) => {
                      const pct = Math.max(1, Math.round((r.amount / catBreakdown.total) * 100));
                      return (
                        <div key={r.key || r.label} className="bd-item" style={{ ...S.bdRow, animationDelay: `${60 + i * 55}ms` }}>
                          <span style={r.icon ? { ...S.bdName, display: "flex", alignItems: "center", gap: 7 } : S.bdName}>
                            {r.icon && <span className="msym" style={{ fontSize: 17, color: r.color || CAT_COLORS[catView], flexShrink: 0 }}>{r.icon}</span>}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                          </span>
                          <span style={{ ...S.bdPct, color: r.color || CAT_COLORS[catView] }}>{pct}%</span>
                          <span style={S.bdTrack}>
                            <span className="bd-fill" style={{ width: `${pct}%`, background: r.color || CAT_COLORS[catView], animationDelay: `${100 + i * 55}ms` }} />
                          </span>
                          <span style={S.bdAmt}>{fmt(r.amount)}</span>
                        </div>
                      );
                    })}
                    <div className="bd-item" style={{ ...S.bdTotal, animationDelay: `${60 + catBreakdown.rows.length * 55}ms` }}>
                      {catView === "left"
                        ? `In goals ${fmt(catBreakdown.inGoals)} · Not in a goal ${fmt(catBreakdown.free)} · Left over ${fmt(catBreakdown.total)}`
                        : `Total ${fmt(catBreakdown.total)}`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {launched && chartOpen && (
        <div ref={chartWrapRef} style={{ ...S.backdrop, animation: chartClosing ? "fadeOut .19s ease both" : "fadeIn .2s ease backwards" }} onClick={() => closeChart()}>
          <div ref={chartModalRef} className="glass" style={{ ...S.modal, animation: chartClosing ? "modalPopOut .24s var(--ease-soft) both" : "modalPop .4s var(--ease) backwards" }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              {/* the ‹ › arrows stay hidden until the pointer is on the title; they browse the chart only, never the panel behind */}
              <span className="chart-nav" style={S.panelTitle}>
                <span>Chart —</span>
                {/* as wide as the widest label ("June 2028"), so the arrows never shift under the pointer */}
                <span className="chart-per" style={{ minWidth: view === "year" ? 39 : 80 }}>
                  <span key={chartLabel} className={chartAt && chartAt.dir ? (chartAt.dir > 0 ? "chart-lbl next" : "chart-lbl prev") : "chart-lbl"}>{chartLabel}</span>
                </span>
                <button className="nav-arrow" disabled={!chartCanStep(-1)} title={view === "year" ? "Previous year (←)" : "Previous month (←)"} onClick={() => stepChart(-1)}>‹</button>
                <button className="nav-arrow" disabled={!chartCanStep(1)} title={view === "year" ? "Next year (→)" : "Next month (→)"} onClick={() => stepChart(1)}>›</button>
              </span>
              <button className="x-btn" style={S.closeBtn} onClick={() => closeChart()}>✕</button>
            </div>
            <div style={S.modeRow}>
              {[
                { id: "income", label: "+", title: "Income only", on: "#3ddc97", onB: "#1e4436" },
                { id: "expense", label: "−", title: "Expenses only", on: "#ff5d6c", onB: "#5a2830" },
                { id: "both", label: "pnl", title: "Cumulative PnL", on: "#e8eaec", onB: "#8a9299" },
              ].map((m) => (
                <button key={m.id} className="mode-btn" title={m.title} onClick={() => { setHoverPt(null); setChartMode(m.id); }}
                        style={{ ...S.modeBtn, color: chartMode === m.id ? m.on : "#6d757d",
                          borderColor: chartMode === m.id ? m.onB : "#33373b",
                          background: chartMode === m.id ? "rgba(255,255,255,0.07)" : "none" }}>
                  {m.label === "pnl"
                    ? (<span style={{ display: "inline-flex", gap: 1 }}>
                         <span style={{ color: chartMode === m.id ? "#3ddc97" : "inherit" }}>+</span>
                         <span style={{ opacity: 0.75 }}>/</span>
                         <span style={{ color: chartMode === m.id ? "#ff5d6c" : "inherit" }}>−</span>
                       </span>)
                    : m.label}
                </button>
              ))}
            </div>
            {renderChart(view === "year" ? "year" : "month")}
            <div key={`legend-${chartMode}`} style={S.legend}>
              {chartMode === "expense" && <span style={{ color: "#ff5d6c", animation: "fadeRight .3s ease both" }}>— Expenses</span>}
              {chartMode === "income" && <span style={{ color: "#3ddc97", animation: "fadeRight .3s ease both" }}>▮ Income</span>}
              {chartMode === "both" && <span style={{ color: "#3ddc97", animation: "fadeRight .3s ease both" }}>▬ Cumulative PnL (carried over)</span>}
              <CmpButton cmp={chartCmp} data={chartCmpData} what={view === "year" ? "year" : "month"} onPick={(v) => { setHoverPt(null); setChartCmp(v); }} />
            </div>
          </div>
        </div>
      )}

      {launched && view !== "trade" && <div style={S.footerRow}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span>{!loaded ? "Loading…" : saving ? "Saving…" : ""}</span>
         {saveError && <span className="bk-msg" style={{ color: "#ff8d97" }} title="Your browser refused to store the data (storage full or blocked). Export a backup now.">Couldn't save — export a backup</span>}
          <button className="bk-btn ico" onClick={exportData} title="Export: save a backup of everything" aria-label="Export"><span className="msym">download</span></button>
          <button className="bk-btn ico" onClick={() => fileRef.current?.click()} title="Import: restore from a backup file" aria-label="Import"><span className="msym">upload</span></button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
                 onChange={(e) => { importData(e.target.files?.[0]); e.target.value = ""; }} />
          {backupMsg && <span className="bk-msg">{backupMsg}</span>}
          {undoImport && <button className="bk-btn" onClick={revertImport} title="Put back the data you had before this import">Undo</button>}
          {SHOW_TEST_TOOLS && <>
          <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", margin: "0 2px" }} />
          <button className="bk-btn ico test" onClick={onTestDataClick} title="Add test data · click: with your saved settings · double-click: change the settings" aria-label="Add test data"><span className="msym">science</span></button>
          <button className="bk-btn ico" onClick={clearTestData} title="Clear test data: remove only the generated test entries" aria-label="Clear test data"><span className="msym">delete_sweep</span></button>
          {testMsg && <span className="bk-msg" style={{ color: "#e3cd77" }}>{testMsg}</span>}
          </>}
        </span>
        <button className="foot-logo" onClick={goHome} title="Back to home" aria-label="Back to home"><CrocLogo /></button>

      </div>}
    </div>
  );
}

const S = {
  page: { background: "transparent", minHeight: "100vh", color: "#e8eaec", width: "100%", maxWidth: 1280, margin: "0 auto", padding: "30px 32px 52px" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" },
  // pixel font of the FLOW wordmark, no shadow; 24px keeps it on the font's 8x8 grid (3px per font pixel)
  title: { margin: 0, fontFamily: "'Press Start 2P', 'Inter', sans-serif", fontSize: 24, fontWeight: 400, lineHeight: 1, letterSpacing: 0, WebkitFontSmoothing: "none" },
  navBox: { display: "flex", alignItems: "center", gap: 8 },
  monthLabelBtn: { fontSize: 16, fontWeight: 600, minWidth: 90, textAlign: "center", background: "none", border: "none", cursor: "pointer", padding: "4px 6px" },
  currency: { fontSize: 13, color: "#9aa3ab", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "5px 12px", marginLeft: 4, cursor: "pointer", transition: "border-color .18s, color .18s" },
  curMenu: { position: "absolute", top: "calc(100% + 8px)", right: 0, borderRadius: 12, padding: 3, display: "flex", flexDirection: "column", gap: 2, zIndex: 40, minWidth: 78, boxShadow: "0 10px 24px rgba(0,0,0,0.45)", animation: "fadeDown .18s ease both" },
  curOpt: { border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", textAlign: "left", transition: "background .18s ease, color .18s ease", letterSpacing: "0.02em" },

  yearHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 28, marginBottom: 24, flexWrap: "wrap" },
  yearBigWrap: { display: "flex", alignItems: "center", gap: 8 },
  yearBig: { fontSize: 48, fontWeight: 400, lineHeight: 1, letterSpacing: 0, marginTop: 12, display: "inline-flex", alignItems: "flex-start" },
  yearBarWrap: { flex: 1, minWidth: 260, paddingTop: 14 },
  chartBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#9aa3ab", borderRadius: 10, width: 34, height: 30, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  // the twelve months fill their year: three equal rows in whatever height the year block has (--yb), less its tag and a gap
  yearGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 12, height: "calc(var(--yb) - 40px)" },
  yearCell: { borderWidth: 1, borderStyle: "solid", borderRadius: 16, minHeight: 116, padding: 12, cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontVariantNumeric: "tabular-nums" },
  yearCellName: { position: "absolute", top: 8, left: 10, fontSize: 12, fontWeight: 600, color: "#8a9299" },
  yearCellSpent: { fontSize: 18, fontWeight: 700 },
  yearCellExp: { fontSize: 11, fontWeight: 400, color: "#8a9299" },

  incomeRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  incomeLabel: { fontSize: 13, color: "#9aa3ab" },
  incomeInput: { background: "rgba(44,48,53,0.55)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, color: "#e8eaec", padding: "9px 13px", fontSize: 15 },
  ghostOverlay: { position: "absolute", left: 0, top: 0, height: "100%", display: "flex", alignItems: "center", padding: "0 12px", fontSize: 14, pointerEvents: "none", fontVariantNumeric: "tabular-nums", whiteSpace: "pre" },
  ghostPlusBtn: { borderRadius: 11, width: 36, height: 38, fontSize: 20, fontWeight: 600, cursor: "pointer", lineHeight: 1 },
  arrowBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#9aa3ab", borderRadius: 11, width: 36, height: 38, fontSize: 14, cursor: "pointer" },
  limitWrap: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", position: "relative" },
  limitInput: { color: "#e8eaec", padding: "8px 10px", fontSize: 14, width: 100, borderRadius: 6 },
  incomeList: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderRadius: 12, padding: "11px 13px", marginBottom: 14 },
  incomeChip: { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(61,220,151,0.12)", border: "1px solid rgba(61,220,151,0.28)", color: "#5ee3a9", borderRadius: 999, padding: "5px 12px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  chipDay: { fontSize: 11, color: "#8a9299", fontWeight: 500 },
  chipDel: { background: "none", border: "none", color: "#6d757d", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 },
  incomeTotal: { marginLeft: "auto", fontSize: 13, color: "#9aa3ab", fontVariantNumeric: "tabular-nums" },

  bigPnl: { fontSize: 46, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, textShadow: "0 0 34px color-mix(in srgb, currentColor 32%, transparent)", marginBottom: 10, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "baseline", gap: 12 },
  bigPnlSub: { fontSize: 13, fontWeight: 500, color: "#9aa3ab", textShadow: "none" },
  pnlVs: { marginLeft: "auto", fontSize: 13, fontWeight: 500, color: "#9aa3ab", letterSpacing: 0, animation: "fadeRight .4s ease both" },
  bdVs: { marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: "#50575e", letterSpacing: "0.1em", alignSelf: "center", animation: "fadeRight .35s ease .1s both" },
  wrKicker: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: "#9aa3ab", textTransform: "uppercase", letterSpacing: "0.16em" },
  wrLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#8a9299", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 },
  wrHeroNum: { fontSize: 54, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontVariantNumeric: "tabular-nums" },
  wrHeroSub: { fontSize: 13, color: "#9aa3ab", marginTop: 8, lineHeight: 1.5 },
  wrBig: { fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em", color: "#e8eaec", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" },
  wrValue: { fontSize: 17, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" },
  wrSmall: { fontSize: 12, color: "#8a9299", marginTop: 4, lineHeight: 1.4 },
  wrLegend: { display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11.5, color: "#8a9299", marginTop: 9 },
  barTrack: { height: 11, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden", display: "flex", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" },
  barSeg: { height: "100%" },
  barMeta: { display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4, fontVariantNumeric: "tabular-nums", marginTop: 8 },
  dayStats: { display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 20, fontVariantNumeric: "tabular-nums" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 },
  dowCell: { textAlign: "center", fontSize: 11, color: "#7d858d", padding: "6px 0 10px", fontWeight: 700, letterSpacing: "0.12em" },
  cell: { borderWidth: 1, borderStyle: "solid", borderRadius: 14, minHeight: 88, padding: 8, cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontVariantNumeric: "tabular-nums", transformOrigin: "center center" },
  cellDay: { position: "absolute", top: 6, left: 9, fontSize: 12, color: "#8a9299" },
  cellDep: { position: "absolute", top: 6, right: 8, fontSize: 13, color: "#8fa9c4" },      // a deposit or a withdrawal on that day (trading side)
  dotGrid: { position: "absolute", bottom: 7, left: 10, display: "grid", gap: 3, justifyItems: "start" },
  dot: { width: 4, height: 4, borderRadius: 99 },
  cellTip: { borderRadius: 11, padding: "8px 13px", display: "flex", flexDirection: "column", gap: 3, fontSize: 12, boxShadow: "0 6px 18px rgba(0,0,0,0.35)" },
  cellTipDate: { color: "#8b949d", fontWeight: 700, textAlign: "center", fontSize: 11, letterSpacing: "0.04em" },
  cellTipRow: { display: "flex", gap: 14, justifyContent: "center", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" },
  cellSpent: { fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 },
  cellLimit: { fontSize: 8, fontWeight: 600, color: "#8a9299" },
  cellPnlSmall: { fontSize: 10, fontWeight: 600 },
  cellEmpty: { color: "#4a5055" },

  panel: { marginTop: 24, borderRadius: 16, padding: "18px 20px" },
  panelHead: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14, animation: "fadeDown .25s ease both" },
  panelTitle: { fontSize: 15, fontWeight: 700 },
  panelTotal: { fontSize: 13, color: "#9aa3ab", marginLeft: "auto", fontVariantNumeric: "tabular-nums" },
  sectionLabel: { fontSize: 11.5, fontWeight: 700, color: "#9aa3ab", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 9 },
  closeBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#9aa3ab", borderRadius: 10, width: 30, height: 30, cursor: "pointer", fontSize: 12 },
  addRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" },
  darkInput: { background: "rgba(24,27,31,0.62)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, color: "#e8eaec", padding: "10px 13px", fontSize: 14 },
  addIconBtn: { background: "linear-gradient(160deg,#54e6a8,#2bbd80)", color: "#07291c", border: "none", borderRadius: 11, width: 40, height: 38, boxShadow: "0 6px 18px rgba(61,220,151,0.28), inset 0 1px 0 rgba(255,255,255,0.35)", fontSize: 20, fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  addIconBtnRed: { background: "linear-gradient(160deg,#ff7a86,#e0434f)", color: "#2b0d11", border: "none", borderRadius: 11, width: 40, height: 38, boxShadow: "0 6px 18px rgba(255,93,108,0.26), inset 0 1px 0 rgba(255,255,255,0.32)", fontSize: 20, fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  emptyList: { color: "#6d757d", fontSize: 13, margin: "6px 2px" },
  expList: { display: "flex", flexDirection: "column", gap: 8 },
  entryRow: { width: "100%", display: "flex", alignItems: "center", borderRadius: 11, padding: "5px 7px", minWidth: 0, overflow: "visible" },
  entryAmt: { width: 150, padding: "8px 10px", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  entryDivider: { width: 1, height: 20, background: "#3a3f44", flexShrink: 0 },
  entryDesc: { flex: 1, minWidth: 40, padding: "8px 12px", fontSize: 14, color: "#c7cdd2" },
  catBtn: { background: "none", border: "1px solid transparent", color: "#8a9299", borderRadius: 6, width: 32, height: 30, padding: 0, cursor: "pointer", flexShrink: 0, marginLeft: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  catPop: { position: "absolute", bottom: "calc(100% + 8px)", right: -4, borderRadius: 12, padding: 4, display: "flex", gap: 2, zIndex: 40, boxShadow: "0 10px 24px rgba(0,0,0,0.45)" },
  catOpt: { background: "none", border: "none", borderRadius: 7, width: 34, height: 32, color: "#9aa3ab", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  otherPop: { position: "absolute", bottom: "calc(100% + 8px)", right: -4, borderRadius: 12, padding: 5, display: "flex", gap: 5, alignItems: "center", zIndex: 41, boxShadow: "0 10px 24px rgba(0,0,0,0.45)" },
  otherInput: { background: "#1e2124", border: "1px solid #3a3f44", borderRadius: 7, color: "#e8eaec", padding: "7px 10px", fontSize: 13, width: 168, outline: "none" },
  globeBtn: { background: "none", border: "1px solid #3f454b", borderRadius: 7, width: 32, height: 32, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  iconPop: { position: "absolute", bottom: "calc(100% + 8px)", right: -4, borderRadius: 12, padding: 6, display: "grid", gridTemplateColumns: "repeat(6, 32px)", gap: 2, zIndex: 42, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" },
  iconOpt: { background: "none", border: "none", borderRadius: 7, width: 32, height: 30, color: "#9aa3ab", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  delBtn: { background: "rgba(255,93,108,0.06)", border: "1px solid rgba(255,93,108,0.28)", color: "#ff8d97", borderRadius: 10, width: 34, height: 32, padding: 0, cursor: "pointer", flexShrink: 0, marginLeft: 6 },

  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px) saturate(115%)", WebkitBackdropFilter: "blur(10px) saturate(115%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 24 },
  modal: { borderRadius: 20, width: "min(900px, 92vw)", maxHeight: "88vh", overflow: "auto", padding: "20px 22px 18px", transformOrigin: "center center" },
  modalHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modeRow: { display: "flex", gap: 6, marginBottom: 12 },
  modeBtn: { border: "1px solid", borderRadius: 11, minWidth: 44, height: 32, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 11px", transition: "color .22s cubic-bezier(0.32,0.72,0.24,1), border-color .22s, background .22s, transform .22s", fontVariantNumeric: "tabular-nums" },
  legend: { display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, marginTop: 10 },

  flowCard: { marginTop: 24, marginLeft: -14, marginRight: -14, borderRadius: 20, padding: "18px 20px 12px" },
  // the inner box of everything that folds away (grid rows 1fr ⇄ 0fr). It cuts off only what the fold hides, top and
  // bottom: a plain overflow: hidden also sliced whatever reaches a few px past the sides (a highlighted tab, a row
  // under the pointer), which left those boxes with square corners on one side and round ones on the other
  fold: { overflowX: "visible", overflowY: "clip", minHeight: 0 },
  foldLoose: { minHeight: 0 },
  flowHead: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  flowSub: { fontSize: 12, color: "#6d757d" },
  plainArrow: { background: "none", border: "none", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "2px 4px" },
  flowEmpty: { color: "#6d757d", fontSize: 13, padding: "18px 2px" },
  insTitle: { fontSize: 11.5, fontWeight: 700, color: "#9aa3ab", textTransform: "uppercase", letterSpacing: "0.14em" },
  insEmpty: { color: "#6d757d", fontSize: 13, padding: "12px 2px 8px" },
  insText: { fontSize: 13.5, color: "#aeb5bb", lineHeight: 1.45 },
  goalTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  goalName: { fontSize: 14.5, fontWeight: 700, color: "#e8eaec" },
  goalNote: { fontSize: 11.5, fontWeight: 500, color: "#6d757d", marginLeft: 8 },
  goalAmt: { fontSize: 13, fontWeight: 600, color: "#e8eaec", fontVariantNumeric: "tabular-nums" },
  goalBarRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 9 },
  goalPct: { fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  goalFundRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 10 },
  // every square button in a fund/new-goal row matches the amount field's height exactly

  bdIconWin: { width: 22, height: 22, overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  bdList: { display: "flex", flexDirection: "column", gap: 12, marginTop: 6, paddingBottom: 4 },
  bdRow: { display: "grid", gridTemplateColumns: "minmax(90px, 190px) 46px 1fr auto", alignItems: "center", gap: 12 },
  bdName: { fontSize: 14, fontWeight: 600, color: "#e8eaec", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bdPct: { fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  bdTrack: { height: 8, background: "#3a3f44", borderRadius: 99, overflow: "hidden", display: "block" },
  bdAmt: { fontSize: 12, color: "#8a9299", fontVariantNumeric: "tabular-nums", minWidth: 54, textAlign: "right" },
  bdTotal: { marginTop: 6, fontSize: 12, color: "#6d757d", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  scoreCard: { display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", marginTop: 4, paddingTop: 16, borderTop: "1px solid #33373b" },
  scoreCenter: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  scoreNum: { fontFamily: "'Press Start 2P', 'Inter', sans-serif", WebkitFontSmoothing: "none", fontSize: 48, letterSpacing: 0, fontWeight: 400, color: "#f2f5f8", lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: "0 2px 18px rgba(180,210,240,0.16)" },
  scoreCap: { fontSize: 11, fontWeight: 700, color: "#8a9299", letterSpacing: "0.16em", marginTop: 6 },
  scoreWord: { fontSize: 34, fontWeight: 800, letterSpacing: "-0.01em" },
  scorePill: { fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", padding: "4px 11px", borderRadius: 99 },
  scoreLabel: { fontSize: 11, fontWeight: 700, color: "#6d757d", letterSpacing: "0.12em", marginTop: 4 },
  scoreText: { fontSize: 13.5, color: "#c7cdd2", lineHeight: 1.55, margin: "8px 0 0", maxWidth: 460 },
  subRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, width: "100%", marginTop: 4 },
  subBox: { borderRadius: 14, padding: "13px 15px 15px" },
  subLabel: { fontSize: 10.5, fontWeight: 700, color: "#6d757d", letterSpacing: "0.11em" },
  subNote: { fontSize: 12, fontWeight: 600, color: "#8a9299", fontVariantNumeric: "tabular-nums" },
  subValue: { fontSize: 22, fontWeight: 800, margin: "5px 0 10px", fontVariantNumeric: "tabular-nums" },
  subTrack: { height: 6, background: "#2c3034", borderRadius: 99, overflow: "hidden", display: "block" },
  footerRow: { marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "#6d757d", display: "flex", justifyContent: "space-between" },
};
