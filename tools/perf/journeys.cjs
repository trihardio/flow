/* Lag hunting (see run.cjs): the journeys. Every step is done twice where it can be ("-1", then "-2"), because the
   lag Rassam notices is the first time a thing is opened after a launch; the second time is the yardstick. */

// the month box of the current month, among the month boxes on screen
const monthBox = (c) => c.js(`(() => { const on = [...document.querySelectorAll('.ycell')].map((e, i) => [i, e.getBoundingClientRect()]).filter(([, r]) => r.top > 0 && r.bottom < innerHeight);
  return on.length ? on[Math.min(${new Date().getMonth()}, on.length - 1)][0] : -1; })()`);
const SPLASH_MS = 4200;      // the opening screen and its outro, with room to spare

// just the opening screen
const launch = async (c) => { await c.sleep(SPLASH_MS); };

// wallet ⇄ coin, the wallets, a card, into the app, a month, its cards, the chart, a day, the wrapped
const finance = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.step("coin-focus-1", () => c.press(".coin-unit"), 1000);
  await c.step("wallet-focus-1", () => c.press(".wallet-unit.active"), 1000);
  await c.step("coin-focus-2", () => c.press(".coin-unit"), 1000);
  await c.step("wallet-focus-2", () => c.press(".wallet-unit.active"), 1000);
  await c.step("wallets-1", () => c.press(".wallet-unit.active"), 1400);
  await c.step("wallets-back", async () => c.key("Escape"), 1200);
  await c.step("wallets-2", () => c.press(".wallet-unit.active"), 1400);
  await c.step("card-1", () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1400);     // the strip of the card that shows above the wallet
  await c.step("enter-1", () => c.press(".big-card"), 6500);
  await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("year-back", () => c.press(".month-btn"), 1800);
  await c.step("month-2", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("scroll-1", () => c.scroll(1400, 900), 1800);
  await c.step("scroll-1b", () => c.scroll(1600, 900), 1800);
  await c.step("scroll-up", () => c.scroll(-3200, 700), 1200);
  await c.step("scroll-2", () => c.scroll(3000, 1400), 1500);
  await c.step("scroll-up-2", () => c.scroll(-3200, 700), 1200);
  await c.step("chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close", async () => c.key("Escape"), 900);
  await c.step("chart-2", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close-2", async () => c.key("Escape"), 900);
  await c.step("day-1", () => c.press(".cell", 9), 1500);
  await c.step("day-2", () => c.press(".cell", 10), 1500);
  await c.step("wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close", async () => c.key("Escape"), 900);
  await c.step("wrapped-2", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close-2", async () => c.key("Escape"), 900);
  await c.step("end", async () => {}, 300);
};

// the finance month's cards: each comes into view while scrolling down, then Money flow is folded and opened with its arrow
const cards = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.step("month", async () => c.press(".ycell", await monthBox(c)), 3200);
  for (const n of [1, 2, 3, 4, 5, 6]) await c.step(`scroll-${n}`, () => c.scroll(450, 500), 1500);
  await c.js(`document.querySelectorAll('.flow-card')[1].scrollIntoView({ block: 'start' })`); await c.sleep(900);
  for (const n of [1, 2]) {
    await c.step(`flow-close-${n}`, () => c.press(".flow-card .chev", 1), 1200);
    await c.step(`flow-open-${n}`, () => c.press(".flow-card .chev", 1), 2200);
  }
  await c.step("end", async () => {}, 300);
};

// the trading selection, into a tracker (the coin, or the globe for stocks), a month, its cards, chart, currency, calculator, wrapped
const trading = (stocks) => async (c) => {
  const fx = stocks === "fx";
  const unit = fx ? ".coin-unit.fx" : stocks ? ".idx-unit" : ".coin-unit";
  await c.sleep(SPLASH_MS);
  await c.step("coin-focus-1", () => c.press(".coin-unit"), 1000);
  await c.step("markets-1", () => c.press(".coin-unit"), 1600);
  await c.step("markets-back", async () => c.key("Escape"), 1200);
  await c.step("markets-2", () => c.press(".coin-unit"), 1600);
  await c.step("globe-focus-1", () => c.press(".idx-unit"), 1100);
  await c.step("crypto-focus-1", () => c.press(".coin-unit"), 1100);
  await c.step("globe-focus-2", () => c.press(".idx-unit"), 1100);
  if (!stocks) await c.step("crypto-focus-2", () => c.press(".coin-unit"), 1100);
  if (fx) await c.step("fx-focus-1", () => c.press(".coin-unit.fx"), 1100);
  await c.step("enter-1", () => c.press(unit), stocks === true ? 6000 : 4500);
  await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("year-back", () => c.press(".month-btn"), 1800);
  await c.step("month-2", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("scroll-1", () => c.scroll(1200, 900), 1800);
  await c.step("scroll-1b", () => c.scroll(1200, 900), 1800);
  await c.step("scroll-1c", () => c.scroll(1600, 900), 1800);
  await c.step("scroll-up", () => c.scroll(-4200, 700), 1200);
  await c.step("scroll-2", () => c.scroll(4000, 1600), 1500);
  await c.step("scroll-up-2", () => c.scroll(-4200, 700), 1200);
  await c.step("chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close", async () => c.key("Escape"), 900);
  await c.step("chart-2", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close-2", async () => c.key("Escape"), 900);
  if (stocks !== true) for (const n of [1, 2, 3, 4]) await c.step(`currency-${n}`, () => c.press(".cur-btn"), 1300);
  await c.step("day-1", () => c.press(".cell", 9), 1500);
  await c.step("day-2", () => c.press(".cell", 10), 1500);
  await c.step("calc-1", () => c.press(".calc-fab"), 1500);
  await c.step("calc-close", async () => c.key("Escape"), 900);
  await c.step("calc-2", () => c.press(".calc-fab"), 1500);
  await c.step("calc-close-2", async () => c.key("Escape"), 900);
  await c.step("wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close", async () => c.key("Escape"), 900);
  await c.step("wrapped-2", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close-2", async () => c.key("Escape"), 900);
  await c.step("end", async () => {}, 300);
};

// the card out of its wallet and back, turned round half-way, another wallet pressed while it is still going back,
// then the coin on the trading panel under the pointer. Every frame it notes where the pocket card and the big card
// are and which is showing (pull.json), to check that one takes over from the other on the same spot.
const pull = async (c) => {
  const fs = require("node:fs"), path = require("node:path");
  await c.sleep(SPLASH_MS);
  await c.step("wallets", () => c.press(".wallet-unit.active"), 1400);
  await c.js(`(() => { const P = (window.__pull = []); const box = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, +getComputedStyle(e).opacity]; };
    const f = () => { const a = document.querySelector(".slot-card.sel"), b = document.querySelector(".big-card"), w = document.querySelector(".wallet-unit.active");
      if (a && b && w) P.push([performance.now(), ...box(a), ...box(b), w.className.split(" ")[1], a.closest(".wallet-unit").className.split(" ")[1]]); requestAnimationFrame(f); };
    requestAnimationFrame(f); })()`);
  const card = () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08);     // the strip of the card that shows above the wallet
  // stills with the move held at a point of its way: just before and just after the big card takes over
  const hold = (v) => c.js(`document.querySelectorAll(".wallet-unit.active, .wallet-unit.active .slot-card.sel, .big-card").forEach((e) => { e.style.transition = ${v == null ? '""' : '"none"'}; ${v == null ? 'e.style.removeProperty("--cp")' : `e.style.setProperty("--cp", "${v}")`}; })`);
  await c.step("out-1", card, 900);
  if (c.shots) {
    const ct = +(await c.js(`getComputedStyle(document.querySelector(".big-card")).getPropertyValue("--ct")`));
    for (const [n, v] of [["hold-a", 0.25], ["hold-b", ct - 0.01], ["hold-c", ct + 0.01], ["hold-d", 0.85]]) { await hold(v); await c.sleep(250); await c.shot(n); }
    await hold(null); await c.sleep(300);
    await c.shot("out");
  }
  await c.step("back-1", async () => c.key("Escape"), 800);
  await c.step("out-2", card, 180);
  await c.step("turned-round", async () => c.key("Escape"), 800);
  await c.step("out-3", card, 900);
  await c.step("back-3", async () => c.key("Escape"), 120);
  await c.step("other-wallet", () => c.press(".wallet-unit.side-right:not(.far)"), 150);
  await c.step("its-card", card, 1000);
  if (c.shots) await c.shot("other-out");
  await c.step("back-4", async () => c.key("Escape"), 900);
  if (c.shots) await c.shot("other-back");
  fs.writeFileSync(path.join(c.OUT, "pull.json"), await c.js("JSON.stringify(window.__pull)"));
  await c.step("selections", async () => c.key("Escape"), 1000);
  await c.step("coin-focus", () => c.press(".coin-unit"), 1000);
  await c.step("trading-panel", () => c.press(".coin-unit"), 1300);
  if (c.shots) await c.shot("coin-forward");
  const r = await c.js(`(() => { const r = document.querySelector(".coin-unit").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width }; })()`);
  const at = async (name, fx, fy) => { await c.step(name, async () => { for (let i = 0; i <= 12; i++) { c.move(r.l + r.w * (0.5 + (fx - 0.5) * i / 12), r.t + r.w * (0.5 + (fy - 0.5) * i / 12)); await c.sleep(16); } }, 1100); if (c.shots) await c.shot(name); };
  await at("coin-hover-right", 0.86, 0.3);
  await at("coin-hover-left", 0.16, 0.74);
  // the toss, held at five moments of its way (stills only): the pointer off the coin, the flip's class put on by hand
  if (c.shots) {
    c.move(40, 40); await c.sleep(900);
    await c.js(`document.querySelector(".launch-wrap").classList.add("trade-crypto")`);
    for (const t of [90, 200, 380, 650, 1100]) {
      await c.js(`document.getAnimations().forEach((a) => { if (/^coin(Flip|Hop|Blur)$/.test(a.animationName)) { a.pause(); a.currentTime = ${t}; } })`);
      await c.sleep(150);
      await c.shot("flip-" + t, { x: Math.round(r.l - 60), y: Math.round(r.t - 90), width: Math.round(r.w + 120), height: Math.round(r.w + 150) });
    }
  }
  await c.step("end", async () => {}, 300);
};

// The side titles on the trading and wallets panels, then Money flow's pop-ups and the insights (stills and what they
// say, not timing; run with --shots): the Left over tab, how the score is worked out, the three main insights and the rest
const flow = async (c) => {
  const said = {};
  const see = (sel) => c.js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].pop(); return e ? e.innerText : null; })()`);
  const go = async (sel, wait = 1300) => { await c.js(`(() => { const e = ${sel}; if (e) e.scrollIntoView({ block: 'center' }); })()`); await c.sleep(wait); };
  await c.sleep(SPLASH_MS);
  await c.shot("pick");
  await c.press(".coin-unit"); await c.sleep(1000);
  await c.press(".coin-unit"); await c.sleep(1600); await c.shot("trading");
  await c.move(300, 700); await c.sleep(900); await c.shot("trading-tilt", { x: 520, y: 0, width: 400, height: 140 });
  await c.key("Escape"); await c.sleep(1200);
  await c.press(".wallet-unit.active"); await c.sleep(1000);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.shot("wallets", { x: 520, y: 0, width: 400, height: 140 });
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.shot("card");
  await c.press(".big-card"); await c.sleep(6500);
  await c.shot("year");
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.sleep(600); await c.shot("month-top");
  for (const [i, n] of [[0, "card-weekly"], [1, "card-flow"], [2, "card-goals"]]) { await go(`document.querySelectorAll('.flow-card')[${i}]`, 2200); await c.shot(n); }
  const left = `[...document.querySelectorAll('.flow-label')].find((e) => e.textContent.includes('Left over'))`;
  await go(left, 2600);
  await c.js(`(() => { const e = ${left}; if (e) e.click(); })()`); await c.sleep(1400);
  said.left = await see(".glass"); await c.shot("left");
  await c.key("Escape"); await c.sleep(700);
  await go(`document.querySelector('.score-hit')`, 2000);
  await c.js(`document.querySelector('.score-hit')?.click()`); await c.sleep(1400);
  said.score = await see(".glass"); await c.shot("score");
  await c.key("Escape"); await c.sleep(700);
  await go(`document.querySelector('.ins-box')`, 2200);
  said.insMain = await see(".ins-box"); await c.shot("ins-main");
  await c.js(`document.querySelector('.ins-more')?.click()`); await c.sleep(900);
  await go(`document.querySelector('.ins-box')`, 1200);
  said.insAll = await see(".ins-box"); await c.shot("ins-all");
  require("node:fs").writeFileSync(require("node:path").join(require("node:os").tmpdir(), "flow-perf", "flow-said.json"), JSON.stringify(said, null, 1));
};

// the crypto side's look (stills; run with --shots): the yearly panel, the month's top, the Performance card
const term = async (c) => {
  await c.sleep(SPLASH_MS);
  for (const w of [1000, 1600]) { await c.press(".coin-unit"); await c.sleep(w); }
  await c.press(".coin-unit"); await c.sleep(330);
  c.said = await c.js(`(() => { const w = document.querySelector('.launch-veil'), k = document.querySelector('.coin-3d'); return [w.style.getPropertyValue('--flip-lean'), w.style.getPropertyValue('--flip-deg'), getComputedStyle(k).transform.slice(0, 60)].join(' | '); })()`);
  require("node:fs").writeFileSync(require("node:path").join(require("node:os").tmpdir(), "flow-perf", "flip-said.txt"), String(c.said));
  await c.shot("term-flip"); await c.sleep(5200);
  await c.shot("term-year");
  await c.press(".ycell", await monthBox(c)); await c.sleep(3000); await c.shot("term-month");
  await c.js(`document.querySelectorAll('.flow-card')[1]?.scrollIntoView({ block: 'center' })`); await c.sleep(2400); await c.shot("term-perf");  // the journal: test data in, a day opened, a trade looked at, then its form, then its menu
  await c.js(`window.scrollTo(0, 0)`); await c.sleep(600);
  await c.js(`[...document.querySelectorAll('.bk-btn')].find((b) => /test data/i.test(b.title) && !/clear/i.test(b.title))?.click()`); await c.sleep(1800);
  await c.shot("term-tiles");
  await c.js(`(() => { const t = [...document.querySelectorAll('.cell')].find((e) => /W/.test(e.innerText) && e.querySelectorAll('.dot-in').length > 1); if (t) t.click(); })()`); await c.sleep(1500);
  await c.js(`document.querySelector('.jr-item')?.scrollIntoView({ block: 'start' })`); await c.sleep(1300);
  await c.shot("term-rows");
  await c.js(`document.querySelector('.jr-item .jr-sum')?.click()`); await c.sleep(900); await c.shot("term-view");
  await c.js(`document.querySelector('.jr-item .jv-btn')?.click()`); await c.sleep(700); await c.shot("term-edit");
  await c.js(`document.querySelectorAll('.jr-item')[1]?.querySelector('.jr-dots')?.click()`); await c.sleep(500); await c.shot("term-menu");
  // the menu's box open, held half-way and drawn back (the number that draws it out, set by hand), then shut for good
  const row = `document.querySelectorAll('.jr-item')[1]`;
  const strip = await c.js(`(() => { const r = ${row}.getBoundingClientRect(); return { x: Math.round(r.right - 600), y: Math.round(r.top - 4), width: 604, height: Math.round(r.height + 8) }; })()`);
  await c.shot("term-menu-open", strip);
  for (const v of [0.5, 0]) { await c.js(`${row}.querySelector('.jr-sum').style.cssText += ';--mo:${v};transition:none'`); await c.sleep(200); await c.shot("term-menu-" + v, strip); }
  await c.js(`(() => { const s = ${row}.querySelector('.jr-sum').style; s.removeProperty('--mo'); s.removeProperty('transition'); ${row}.querySelector('.jr-dots').click(); })()`); await c.sleep(700);
  await c.shot("term-menu-shut", strip);
  // the number while it runs, read every frame: opened, shut, then opened and turned round half-way
  const run = await c.js(`new Promise((done) => { const sum = ${row}.querySelector('.jr-sum'), dots = sum.querySelector('.jr-dots'), out = [], t0 = performance.now(); let last = t0, worst = 0;
    const tick = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; out.push([Math.round(t - t0), +(+getComputedStyle(sum).getPropertyValue('--mo')).toFixed(2), sum.querySelectorAll('.jr-acts').length]); if (t - t0 < 1500) requestAnimationFrame(tick); else done({ worst: Math.round(worst), frames: out.length, out }); };
    requestAnimationFrame(tick); dots.click(); setTimeout(() => dots.click(), 500); setTimeout(() => dots.click(), 1000); setTimeout(() => dots.click(), 1090); })`);
  require("node:fs").writeFileSync(require("node:path").join(require("node:os").tmpdir(), "flow-perf", "menu-said.json"), JSON.stringify(run));
  // the wrapped: a list opened under the tiles brings the scroll bar in, and no tile may get narrower for it
  const wide = () => c.js(`(() => { const m = document.querySelector('.wr-modal'); return { tiles: [...m.querySelectorAll('.wr-tile')].slice(0, 6).map((t) => t.offsetWidth), scrolls: m.scrollHeight > m.clientHeight, inner: m.clientWidth }; })()`);
  await c.js(`window.scrollTo(0, 0)`); await c.sleep(500);
  await c.js(`document.querySelector('.month-big')?.click()`); await c.sleep(1500);
  const w0 = await wide(); await c.shot("term-wrapped");
  await c.js(`document.querySelector('.wr-tile.clickable')?.click()`); await c.sleep(1200);
  const w1 = await wide(); await c.shot("term-wrapped-list");
  require("node:fs").writeFileSync(require("node:path").join(require("node:os").tmpdir(), "flow-perf", "wrapped-said.json"), JSON.stringify({ before: w0, after: w1 }));
};

// the stocks side's journal (stills; run with --shots): test data, a day, a trade looked at, its form, the Breakdown card
const idxj = async (c) => {
  await c.sleep(SPLASH_MS);
  for (const w of [1000, 1600]) { await c.press(".coin-unit"); await c.sleep(w); }
  for (const w of [1200, 7000]) { await c.press(".idx-unit"); await c.sleep(w); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(2500);
  await c.js(`[...document.querySelectorAll('.bk-btn')].find((b) => /test data/i.test(b.title) && !/clear/i.test(b.title))?.click()`); await c.sleep(1800);
  await c.js(`(() => { const t = [...document.querySelectorAll('.cell')].find((e) => e.querySelectorAll('.dot-in').length > 1); if (t) t.click(); })()`); await c.sleep(1500);
  await c.js(`document.querySelector('.jr-sheet')?.scrollIntoView({ block: 'start' })`); await c.sleep(1300); await c.shot("idx-sheet");
  await c.js(`document.querySelector('.jr-item')?.scrollIntoView({ block: 'start' })`); await c.sleep(1300);
  await c.js(`document.querySelectorAll('.jr-item')[1]?.querySelector('.jr-sum')?.click()`); await c.sleep(900); await c.shot("idx-view");
  await c.js(`document.querySelector('.jr-item .jv-btn')?.click()`); await c.sleep(700); await c.shot("idx-edit");
  await c.js(`document.querySelector('[data-card="breakdown"]')?.scrollIntoView({ block: 'center' })`); await c.sleep(2400); await c.shot("idx-breakdown");
};

// stills (--shots): the account button in the corner of the selections, wallets and trading panels (at rest and under
// the pointer), then the bottom of the day tiles with the lowest and the highest bar, enlarged, on finance and crypto
const corners = async (c) => {
  const corner = { x: 1440 - 380, y: 900 - 130, width: 380, height: 130 };
  const tiles = async (name) => {
    const list = JSON.parse(await c.js(`JSON.stringify([...document.querySelectorAll('.cell > .cbar')].map((b) => { const r = b.parentElement.getBoundingClientRect(); return { h: parseFloat(b.style.getPropertyValue('--h')), l: r.left, b: r.bottom, w: r.width, t: r.top }; }).filter((x) => x.h > 0 && x.t > 0 && x.b < innerHeight).sort((a, b) => a.h - b.h))`));
    c.log("TILES", name, list.length, "bars, lowest", list[0] && list[0].h, "highest", list.at(-1) && list.at(-1).h);
    if (!list.length) return;
    for (const [tag, t] of [["low", list[0]], ["high", list.at(-1)]]) await c.shot(`${name}-${tag}`, { x: Math.round(t.l - 8), y: Math.round(t.b - 40), width: Math.round(t.w + 16), height: 48 });
  };
  await c.sleep(SPLASH_MS);
  await c.shot("who-selections", corner);
  c.move(1440 - 42, 900 - 40); await c.sleep(600); await c.shot("who-pointer", corner); c.move(700, 300); await c.sleep(400);
  // pressed: the page loads again and stops at the select acc panel; the first account goes back in
  await c.press(".who-btn"); await c.sleep(6000);
  c.log("PRESSED", await c.js(`JSON.stringify({ panel: !!document.querySelector('.acc-pick'), title: (document.querySelector('.acc-pick') || {}).innerText || '' })`));
  await c.shot("who-pressed");
  await c.press(".acc-tile"); await c.sleep(2500);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1700); await c.shot("who-trading", corner);
  await c.press(".coin-unit"); await c.sleep(5000);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200); await tiles("crypto");
  await c.press(".month-btn"); await c.sleep(1800); await c.press(".foot-logo"); await c.sleep(4800);
  await c.press(".wallet-unit.active"); await c.sleep(1500); await c.shot("who-wallets", corner);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200); await tiles("finance");
};

// The 3D of the panels before an app, each thing once (what a first launch pays for; twice with --rounds=2): the
// wallet and the coin under the pointer, wallet ⇄ coin, the trading panel with the coin, the globe and the die and
// each of the three ways in, then the wallets panel, a card out of its wallet, and the way into the finance side.
const stage = async (c) => {
  const coin = ".coin-unit:not(.fx)";
  // the pointer drawn across something, as a hand would
  const over = (name, sel) => c.step(name, async () => {
    const r = await c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
    if (!r) { c.log("NOT FOUND", sel); return; }
    for (let i = 0; i <= 24; i++) { const k = i / 24; c.move(r.l + r.w * (0.22 + 0.56 * k), r.t + r.h * (0.3 + 0.4 * Math.sin(k * Math.PI))); await c.sleep(16); }
  }, 700);
  const home = (name) => c.step(name, () => c.press(".foot-logo"), 4800);
  const rounds = process.argv.includes("--rounds=2") ? [1, 2] : [1];
  await c.sleep(SPLASH_MS);
  // (--cold: how the first launch's rehearsal of these panels went: late frames and time per go)
  c.log("TOUR", await c.js(`performance.getEntriesByType("mark").map((m) => m.name).filter((n) => n.startsWith("flow-tour")).join(" | ")`));
  // somebody new (--fresh): the login and the introduction come first, card by card
  if (await c.js(`!!document.querySelector(".acc-in")`)) {
    await typeName(c, "Flow");
    await c.sleep(400);
    await c.step("login-continue", () => c.press(".acc-go"), 1000);
    for (const n of [1, 2, 3]) await c.step(`intro-next-${n}`, () => c.press(".acc-intro .acc-go"), 1000);
    await c.step("intro-start", () => c.press(".acc-intro .acc-go"), 2400);
  }
  for (const n of rounds) {
    await over(`wallet-hover-${n}`, ".wallet-unit.active");
    await c.step(`coin-focus-${n}`, () => c.press(coin), 900);
    await over(`coin-hover-${n}`, coin);
    await c.step(`markets-${n}`, () => c.press(coin), 2000);
    await over(`coin-lean-${n}`, coin);
    await c.step(`globe-focus-${n}`, () => c.press(".idx-unit"), 1100);
    await over(`globe-hover-${n}`, ".idx-unit");
    await c.step(`die-focus-${n}`, () => c.press(".coin-unit.fx"), 1100);
    await over(`die-hover-${n}`, ".coin-unit.fx");
    await c.step(`enter-fx-${n}`, () => c.press(".coin-unit.fx"), 4500);
    await home(`home-a-${n}`);
    await c.press(coin); await c.sleep(900); await c.press(coin); await c.sleep(1800); await c.press(".idx-unit"); await c.sleep(1100);
    await c.step(`enter-idx-${n}`, () => c.press(".idx-unit"), 6000);
    await home(`home-b-${n}`);
    await c.press(coin); await c.sleep(900); await c.press(coin); await c.sleep(1800);
    await c.step(`enter-crypto-${n}`, () => c.press(coin), 4500);
    await home(`home-c-${n}`);
    await c.step(`wallets-${n}`, () => c.press(".wallet-unit.active"), 1400);
    await over(`wallets-hover-${n}`, ".wallet-unit.active");
    await c.step(`wallet-next-${n}`, () => c.press(".wallet-unit.side-right:not(.far)"), 900);
    await c.step(`wallet-prev-${n}`, () => c.press(".wallet-unit.side-left:not(.far)"), 900);
    await c.step(`card-${n}`, () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1400);
    await over(`card-hover-${n}`, ".big-card");
    await c.step(`enter-finance-${n}`, () => c.press(".big-card"), 6500);
    await home(`home-d-${n}`);
  }
  await c.step("end", async () => {}, 300);
};

const typeName = (c, name) => c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(name)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
// The introduction (--shots --fresh): a still of every card, one half-way between two, one after Back, and where Start
// leaves him; what each card says goes into the log.
const intro = async (c) => {
  const said = () => c.js(`(() => { const s = document.querySelector(".in-slide.on"); return s ? s.innerText.replace(/\\n+/g, " | ") : null; })()`);
  await c.sleep(SPLASH_MS);
  await c.shot("login");
  await typeName(c, "Rassam");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(1100);
  for (const n of [1, 2, 3, 4]) {
    await c.shot(`intro-${n}`); c.log("CARD", n, await said());
    if (n === 4) break;
    await c.press(".acc-intro .acc-go");
    if (n === 1) { await c.sleep(190); await c.shot("intro-between"); }
    await c.sleep(1000);
  }
  c.key("Left"); await c.sleep(1000); c.log("AFTER LEFT", await said());
  c.key("Right"); await c.sleep(1000);
  await c.press(".acc-intro .acc-go"); await c.sleep(2600);
  await c.shot("after-start");
  c.log("USERS", await c.js(`localStorage.getItem("flow-users")`));
};
// "Reset account" and "Restore my entries" (the usual profile, a copy of his entries): what is saved under which key
// before, while the account is somebody new, and after the way back; and what the new account is shown.
const reset = async (c) => {
  const keys = () => c.js(`JSON.stringify(Object.keys(localStorage).sort().map((k) => { const v = localStorage.getItem(k); let h = 0; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0; return k + " " + v.length + " " + h; }))`);
  const row = (text) => c.js(`(() => { const b = [...document.querySelectorAll(".snav .sd-row")].find((e) => e.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
  const into = async () => {
    await c.press(".wallet-unit.active"); await c.sleep(1400);
    await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
    await c.press(".big-card"); await c.sleep(6500);
  };
  const seen = async (name) => c.log("SEEN", name, await c.js(`JSON.stringify({ poster: document.querySelector(".poster-num")?.innerText, rows: [...document.querySelectorAll(".snav .sd-row")].map((e) => e.innerText.trim().replace(/\\s+/g, " ")).slice(-4), who: document.querySelector(".sd-row .sd-pic") ? "pic" : "" })`));
  await c.sleep(SPLASH_MS);
  const before = await keys();
  c.log("BEFORE", before);
  await into();
  await seen("his own");
  if (c.shots) await c.shot("before");
  c.log("RESET pressed", await row("Reset account"));
  // the page loads again: the preparation once more, the opening, the login
  for (let i = 0; i < 80 && !(await c.js(`!!document.querySelector(".acc.in .acc-in") && !document.querySelector(".open-panel")`).catch(() => false)); i++) await c.sleep(500);
  c.log("DURING", await keys());
  if (c.shots) await c.shot("login-again");
  await typeName(c, "Tester");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(900); await c.press(".in-skip"); await c.sleep(3000);
  await into();
  await seen("somebody new");
  if (c.shots) await c.shot("new");
  c.log("RESTORE pressed", await row("Restore my entries"));
  await c.sleep(2500);
  for (let i = 0; i < 40 && !(await c.js(`!!document.querySelector(".wallet-unit.active") && !document.querySelector(".open-panel")`).catch(() => false)); i++) await c.sleep(500);
  const after = await keys();
  c.log("AFTER", after);
  c.log(before === after ? "SAME AS BEFORE: every key, its length and its sum" : "DIFFERENT FROM BEFORE");
  await into();
  await seen("back");
  if (c.shots) await c.shot("back");
};

// first openings only, on the trading side, quickly (to compare settings over several runs): each thing once
const firsts = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.step("coin-focus-1", () => c.press(".coin-unit"), 1000);
  await c.step("markets-1", () => c.press(".coin-unit"), 1600);
  await c.step("enter-1", () => c.press(".coin-unit"), 4500);
  await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close", async () => c.key("Escape"), 900);
  await c.step("day-1", () => c.press(".cell", 9), 1500);
  await c.step("calc-1", () => c.press(".calc-fab"), 1500);
  await c.step("calc-close", async () => c.key("Escape"), 900);
  await c.step("wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("end", async () => {}, 300);
};

// First openings after he has sat still for a while (the trading side, then the finance side): the screens the opening
// had no time for are drawn while nothing is pressed (warmRest in App.jsx). The "rest" steps are those quiet moments:
// no frame gap may show in them, and the screens drawn in them are counted in the log.
const rested = async (c) => {
  const drawn = async (name) => c.log("DRAWN", name, await c.js("window.__perf.warmed.length"), "screens so far");
  await c.sleep(SPLASH_MS);
  await drawn("under the opening");
  await c.step("coin-focus-1", () => c.press(".coin-unit"), 1000);
  await c.step("markets-1", () => c.press(".coin-unit"), 1600);
  await c.step("enter-1", () => c.press(".coin-unit"), 4500);
  await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("rest-1", async () => {}, 9000);
  await drawn("after the first rest");
  await c.step("chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("chart-close", async () => c.key("Escape"), 900);
  await c.step("day-1", () => c.press(".cell", 9), 1500);
  await c.step("calc-1", () => c.press(".calc-fab"), 1500);
  await c.step("calc-close", async () => c.key("Escape"), 900);
  await c.step("wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("wrapped-close", async () => c.key("Escape"), 900);
  await c.step("rest-2", async () => {}, 9000);
  await drawn("after the second rest");
  // the pointer moved in the middle of a rest: the drawing must stop at once and nothing may be left showing
  await c.step("rest-moved", async () => { await c.sleep(2600); c.move(600, 400); await c.sleep(120); c.log("HOST", await c.js("(() => { const h = document.querySelector('.warm-host'); return h ? 'opacity ' + getComputedStyle(h).opacity + ', ' + h.querySelectorAll('*').length + ' elements' : 'none'; })()")); }, 600);
  await c.step("year-back", () => c.press(".month-btn"), 1800);
  await c.step("home", () => c.press(".foot-logo"), 4800);
  await c.step("wallets-1", () => c.press(".wallet-unit.active"), 1400);
  await c.step("card-1", () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1400);
  await c.step("fin-enter-1", () => c.press(".big-card"), 6500);
  await c.step("fin-month-1", async () => c.press(".ycell", await monthBox(c)), 3200);
  await c.step("rest-3", async () => {}, 9000);
  await drawn("after the third rest");
  await c.step("fin-chart-1", () => c.press(".chart-btn"), 1800);
  await c.step("fin-chart-close", async () => c.key("Escape"), 900);
  await c.step("fin-wrapped-1", () => c.press(".month-big"), 2500);
  await c.step("fin-wrapped-close", async () => c.key("Escape"), 900);
  await c.step("end", async () => {}, 300);
  c.log("HOST at the end", await c.js("(() => { const h = document.querySelector('.warm-host'); return h ? h.querySelectorAll('*').length + ' elements' : 'none'; })()"));
};

// Every part of a month comes in with the others (the entrance is keyed on data-mv, see ".month-view.enter" in
// App.jsx): the finance month and the crypto month are opened, and a tenth of a second in each part must be on its way in
const parts = async (c) => {
  const look = async (name) => {
    await c.sleep(110);
    const got = JSON.parse(await c.js(`JSON.stringify([...document.querySelector('.month-view').children].map((el) => ({ what: (el.getAttribute('data-card') || el.className || el.tagName).toString().slice(0, 24), mv: el.hasAttribute('data-mv'), anim: getComputedStyle(el).animationName, delay: getComputedStyle(el).animationDelay })))`));
    const bad = got.filter((g) => !g.mv || !/mvIn|flowPopIn/.test(g.anim));
    c.log("PARTS", name, got.length, "parts,", bad.length ? "NOT COMING IN: " + JSON.stringify(bad) : "all coming in", "delays", got.map((g) => g.delay).join(" "));
    await c.sleep(1500);
    c.log("AFTER", name, "enter class", await c.js(`document.querySelector('.month-view').className`), "animations left", await c.js(`[...document.querySelector('.month-view').children].filter((el) => getComputedStyle(el).animationName === 'mvIn').length`));
  };
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await look("finance");
  await c.press(".month-btn"); await c.sleep(1800); await c.press(".foot-logo"); await c.sleep(4800);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await c.press(".ycell", await monthBox(c)); await look("crypto");
};

// The crypto calculator's IM box (stills and what it says; run with --shots): empty (worked out), typed (the leverage
// stays and the Risk box follows), a risk typed (the IM is worked out again), typed as 0, and emptied again
const imbox = async (c) => {
  const type = (field, text) => c.js(`(() => { const el = document.querySelector('.pc-form [data-f="${field}"]'); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const said = async (name) => {
    await c.sleep(800);
    c.log("IM", name, await c.js(`(() => { const b = document.querySelector('[data-f="im"]'); const k = document.querySelector('[data-f="risk"]'); return JSON.stringify({ box: b.value, grey: b.placeholder, tag: b.nextElementSibling ? b.nextElementSibling.textContent : "", red: b.classList.contains("bad"),
      risk: { box: k.value, grey: k.placeholder, auto: k.classList.contains("auto") },
      labels: [...document.querySelectorAll('.pc-form label')].map((l) => l.textContent).join(" | "), tiles: [...document.querySelectorAll('.pc-tile')].map((t) => t.innerText.replace(/\\n/g, " ")), notes: [...document.querySelectorAll('.pc-why, .pc-err-row')].map((n) => n.innerText), sl: [...document.querySelectorAll('.pc-row')][1]?.innerText.replace(/\\n/g, " ") }); })()`));
    const r = await c.js(`(() => { const r = document.querySelector('.pc-modal').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
    await c.shot("im-" + name, r);
  };
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await c.press(".calc-fab"); await c.sleep(1200);
  for (const [k, v] of [["entry", "11.088"], ["sl", "10.639"], ["risk", "3.29"], ["maxLev", "75"], ["tp0", "12"], ["close0", "25"], ["tp1", "12.442"], ["close1", "30"], ["full", "12.91"], ["im", ""]]) await type(k, v);
  c.key("Enter"); await said("auto");
  await type("im", "1.3"); await said("typed");
  await type("risk", "5"); await said("risk-typed");
  await type("im", "0"); c.key("Enter"); await said("zero");
  await type("im", ""); await said("auto-again");
};

// Several items in one expense (stills and what the page says; run with --shots --fresh): the list opened with the button
// beside the description, three items typed, filed as one expense, its items shown, one changed, one removed
const items = async (c) => {
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "char", keyCode: ch }); await c.sleep(25); } };
  const line = async (amt, name) => { await type(amt); c.key("Enter"); await c.sleep(150); await type(name); c.key("Enter"); await c.sleep(350); };
  const said = async (name) => {
    await c.sleep(800);
    c.log("ITEMS", name, await c.js(`(() => { const v = (e) => e.value, a = document.activeElement, saved = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}').spending || {};
      return JSON.stringify({ at: a.placeholder || a.className || a.tagName, total: document.querySelector('.split-sum')?.value ?? null,
        draft: [...document.querySelector('.parts-fold').querySelectorAll('.pt-wrap:not(.out) .pt-line')].map((l) => [...l.querySelectorAll('input')].map(v).join(' ')),
        open: document.querySelector('.parts-fold').classList.contains('open'),
        rows: [...document.querySelectorAll('.entry-row.exp')].map((r) => [...r.querySelectorAll(':scope > input')].map(v).join(' ') + ' #' + (r.querySelector('.parts-btn')?.textContent ?? '-')),
        lines: [...document.querySelectorAll('.row-wrap .pt-wrap:not(.out) .pt-line')].map((l) => [...l.querySelectorAll('input')].map(v).join(' ')),
        saved: Object.values(saved).flat().map((e) => e.desc + ' ' + e.amount + ' ' + JSON.stringify((e.parts || []).map((p) => p.desc + ' ' + p.amount))) }); })()`));
    const r = await c.js(`(() => { const r = document.querySelector('.split-btn').closest('.glass').getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`);
    await c.shot("items-" + name, r);
  };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelector('.split-btn').scrollIntoView({ block: 'center' })`); await said("shut");
  // a hidden page is never "in use" to the engine, so a box being typed in would not show as such in a still
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  await c.press(".split-btn"); await said("focus");
  await line("20", "pizza"); await line("10", "drinks"); await line("15", "sides");
  c.key("Enter"); await c.sleep(300);                  // Enter on the empty line: on to the name of the whole
  await type("lunch"); await said("typed");
  c.key("Enter"); await said("filed");
  await c.press(".parts-btn"); await said("shown");
  await c.js(`(() => { const el = document.querySelectorAll('.row-wrap .pt-amt input')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '12.000'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); })()`);
  await said("changed");
  await c.press(".row-wrap .pt-x", 2); await said("removed");
};

// Split bill (stills and what the page says; run with --shots --fresh): opened from a day's Expenses row. Two people,
// each with two things of their own listed item by item (35.000 and 40.000), service 5% and tax 10%: with no bill typed
// each pays for what they had (86.625: 40.425 and 46.200); with a bill of 100.000 the other 25.000 is shared (115.500:
// 54.863 and 60.638). Then his share is named, given a category and added to that day
const bill = async (c) => {
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "char", keyCode: ch }); await c.sleep(25); } };
  const into = async (sel, nth, text, enter) => {
    await c.js(`document.querySelectorAll(${JSON.stringify(sel)})[${nth}].focus()`);
    await type(text);
    if (enter) c.key("Enter");
    await c.sleep(200);
  };
  const line = async (amt, name) => { await type(amt); c.key("Enter"); await c.sleep(150); await type(name); c.key("Enter"); await c.sleep(350); };
  const said = async (name) => {
    await c.sleep(800);
    c.log("BILL", name, await c.js(`(() => { const saved = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}').spending || {};
      return JSON.stringify({ label: document.querySelector('.sb-f span').textContent, own: [...document.querySelectorAll('.sb-row')].map((r) => r.querySelectorAll('input')[1].value),
        items: [...document.querySelectorAll('.sb-person')].map((p) => [...p.querySelectorAll('.pt-line')].map((l) => [...l.querySelectorAll('input')].map((e) => e.value).join(' ').trim()).filter(Boolean)),
        pays: [...document.querySelectorAll('.sb-pay')].map((e) => e.textContent), tip: document.querySelector('.sb-pay').title, tiles: [...document.querySelectorAll('.sb-tile')].map((e) => e.innerText.replace(/\\n/g, ' ')),
        note: document.querySelector('.sb-note')?.textContent ?? null, mine: document.querySelector('.sb-exp input').value, cats: [...document.querySelectorAll('.sb-cat')].map((e) => e.className.replace('sb-cat', '').trim() || '-').join(' '),
        add: document.querySelector('.sb-add').textContent, saved: Object.entries(saved).map(([k, l]) => k + ': ' + l.map((e) => e.desc + ' ' + e.amount + ' ' + (e.cat || 'auto')).join(', ')) }); })()`));
    const r = await c.js(`(() => { const r = document.querySelector('.set-modal.sb').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
    await c.shot("bill-" + name, r);
  };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelectorAll('.split-btn')[1].scrollIntoView({ block: 'center' })`); await c.sleep(900);
  await c.press(".split-btn", 1); await c.sleep(900);
  await c.press(".sb-row .split-btn", 0); await c.sleep(700);
  await line("20", "pizza"); await line("15", "fries"); c.key("Enter"); await c.sleep(600);
  await c.press(".sb-row .split-btn", 1); await c.sleep(700);
  await line("30", "steak"); await line("10", "tea");
  await into(".sb-top input", 1, "5"); await into(".sb-top input", 2, "10");
  await said("own-only");
  await into(".sb-top input", 0, "100", true); await said("with-bill");
  await into(".sb-exp input", 1, "dinner");
  await c.press(".sb-cat", 4); await c.sleep(200);
  await c.press(".sb-add"); await said("added");
};

// The score dial with 81 in it (a still and where the figure stands; run with --shots --fresh): an income of 1jt and
// 190Rb spent this month. The figure's ink must be in the middle of the dial
const score81 = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.js(`(() => { const t = new Date(), mk = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
    localStorage.setItem('pnl-calendar-idr', JSON.stringify({ spending: { [mk + '-02']: [{ id: 'a', amount: 190000, desc: 'things' }] }, incomes: { [mk]: [{ id: 'b', amount: 1000000, desc: 'salary', day: 1 }] }, limits: {}, currency: 'IDR', goals: [], debts: [] })); })()`);
  c.wc.reload(); await c.sleep(SPLASH_MS + 2500);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  for (let i = 0; i < 6 && !(await c.js(`!!document.querySelector('.score-hit')`)); i++) { await c.scroll(700, 400); await c.sleep(900); }
  await c.js(`document.querySelector('.score-hit').scrollIntoView({ block: 'center' })`); await c.sleep(2600);
  const r = await c.js(`(() => { const hit = document.querySelector('.score-hit'), fig = hit.firstElementChild.firstElementChild, dial = hit.parentElement.parentElement.getBoundingClientRect(), f = fig.getBoundingClientRect(), u = parseFloat(getComputedStyle(fig).fontSize) / 8;
    return { text: fig.textContent, unit: u, dialMid: +(dial.left + dial.width / 2).toFixed(2), inkLeft: +f.left.toFixed(2), inkRight: +(f.right - u).toFixed(2), inkMid: +((f.left + f.right - u) / 2).toFixed(2),
      x: Math.round(dial.left - 10), y: Math.round(dial.top - 10), width: Math.round(dial.width + 20), height: Math.round(dial.height + 20) }; })()`);
  c.log("SCORE", JSON.stringify(r));
  await c.shot("score", { x: r.x, y: r.y, width: r.width, height: r.height });
};

// "Test levels" in the crypto calculator, pressed eight times (what the page says; needs the test tools on): the targets
// and their close % must differ from press to press, and every press must give results, never an error
const testlv = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await c.press(".calc-fab"); await c.sleep(1200);
  for (let i = 1; i <= 8; i++) {
    await c.press(".pc-clear.test"); await c.sleep(700);
    c.log("TESTLV", i, await c.js(`(() => { const v = (k) => document.querySelector('.pc-form [data-f="' + k + '"]')?.value ?? null, tps = [];
      for (let i = 0; v('tp' + i) !== null; i++) tps.push(v('tp' + i) ? v('tp' + i) + ' ' + v('close' + i) + '%' : '-');
      return JSON.stringify({ entry: v('entry'), sl: v('sl'), tps, full: v('full'), plan: document.querySelector('.pc-title span')?.textContent ?? null, tiles: document.querySelectorAll('.pc-tile').length, errors: [...document.querySelectorAll('.pc-err-row')].map((n) => n.innerText) }); })()`));
  }
};

// the finance month's day tiles (a still and what each bar says; run with --shots, and --fresh for a month of test data):
// the bar against the daily limit
const tiles = async (c) => {
  await c.sleep(SPLASH_MS);
  const fresh = await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (fresh) { await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000); }
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  if (fresh) { await c.press('button[aria-label="Add test data"]'); await c.sleep(2600); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.js(`document.querySelector('.cal-wrap').scrollIntoView({ block: 'center' })`); await c.sleep(1200);
  c.log("TILES", await c.js(`JSON.stringify([...document.querySelectorAll('.cal-wrap .cell')].map((e) => { const b = e.querySelector('.cbar'); return e.innerText.replace(/\\s+/g, ' ').slice(0, 40) + ' => ' + (b ? b.style.getPropertyValue('--h') + ' ' + b.style.color : 'no bar'); }))`));
  const r = await c.js(`(() => { const r = document.querySelector('.cal-wrap').getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`);
  await c.shot("tiles", r);
};

// The forex die and the pictures on a setup (stills and what the page says; run with --shots --fresh): the die tucked
// beside the globe, in focus, under the pointer and in mid-toss; then on the forex side a picture dropped on the Setup
// line of the sheet that adds a trade and one pasted while typing in it, the trade added, and looked at
const fxdie = async (c) => {
  const around = async (name, sel, pad = 70) => {
    const r = await c.js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(), x = Math.max(0, r.left - ${pad}), y = Math.max(0, r.top - ${pad}); return { x: Math.round(x), y: Math.round(y), width: Math.round(Math.min(innerWidth, r.right + ${pad}) - x), height: Math.round(Math.min(innerHeight, r.bottom + ${pad}) - y) }; })()`);
    await c.shot(name, r);
  };
  const set = (sel, text) => c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const picture = (how) => c.js(`(async () => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d'); g.fillStyle = '#16324a'; g.fillRect(0, 0, 640, 360);
    g.strokeStyle = '#7fd0a0'; g.lineWidth = 6; g.beginPath(); g.moveTo(20, 300); g.lineTo(200, 180); g.lineTo(380, 240); g.lineTo(620, 60); g.stroke();
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png')), dt = new DataTransfer(); dt.items.add(new File([blob], 'setup.png', { type: 'image/png' }));
    const line = document.querySelector('.jr-sheet:not(.in-list) .jr-pre');
    if (${JSON.stringify(how)} === 'drop') line.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    else { line.querySelector('input.jr-in').focus(); window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })); }
    return true; })()`);
  const said = async (name) => c.log("SETUP", name, await c.js(`(() => { const sheet = document.querySelector('.jr-sheet:not(.in-list)'), saved = JSON.parse(localStorage.getItem('pnl-fx-usd') || '{}').trades || {};
    return JSON.stringify({ onSetup: sheet.querySelectorAll('.jr-pre .jr-shot').length, onTrade: sheet.querySelectorAll('.jr-shot:not(.add)').length - sheet.querySelectorAll('.jr-pre .jr-shot').length,
      rows: [...document.querySelectorAll('.jr-item .jr-sum')].map((r) => r.innerText.replace(/\\s+/g, ' ').slice(0, 70)), count: document.querySelector('.jr-item .jr-pics')?.textContent ?? null,
      view: [...document.querySelectorAll('.jr-item .jv-note')].map((n) => n.querySelector('.jv-k').textContent + ': ' + (n.querySelector('p')?.textContent ?? '') + ' / ' + [...n.querySelectorAll('.jr-shot img')].map((i) => i.naturalWidth + 'px').join(' ')),
      saved: Object.values(saved).flat().map((t) => ({ pre: t.pre, preImgs: t.preImgs, imgs: t.imgs, pnl: t.pnl })) }); })()`));
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(2400);
  await c.press(".idx-unit"); await c.sleep(1600); await c.shot("die-tucked");
  await c.press(".coin-unit.fx"); await c.sleep(2000); await around("die", ".coin-unit.fx");
  const r = await c.js(`(() => { const r = document.querySelector('.coin-unit.fx').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
  for (let i = 0; i <= 12; i++) { c.move(r.l + r.w * (0.5 + 0.3 * i / 12), r.t + r.h * (0.5 - 0.28 * i / 12)); await c.sleep(16); }
  await c.sleep(1100); await around("die-hover", ".coin-unit.fx");
  await c.click(r.l + r.w * 0.8, r.t + r.h * 0.22); await c.sleep(330); await around("die-toss", ".coin-unit.fx", 120);
  await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(2800);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelector('.jr-sheet:not(.in-list)').scrollIntoView({ block: 'start' })`); await c.sleep(1300);
  await picture("drop"); await c.sleep(1300); await picture("paste"); await c.sleep(1300);
  await set(".jr-sheet:not(.in-list) .jr-pre input.jr-in", "breakout, retest of the range high");
  await said("on the sheet"); await around("setup-form", ".jr-sheet:not(.in-list)", 10);
  await set(".jr-sheet:not(.in-list) .jr-pnl input", "25");
  await c.js(`document.querySelector('.jr-sheet:not(.in-list) .jr-add').click()`); await c.sleep(1400);
  await said("added");
  await c.js(`document.querySelector('.jr-item .jr-sum').click()`); await c.sleep(1200);
  await c.js(`document.querySelector('.jr-item').scrollIntoView({ block: 'center' })`); await c.sleep(1300);
  await said("looked at"); await around("setup-view", ".jr-item", 10);
};

// Which of its 8 columns each character of the pixel font is drawn in (what the page says): the table PX_INK in App.jsx
// is written from this. A character is drawn at 8px, one font pixel a canvas pixel, and each column with ink is marked
const pxink = async (c) => {
  await c.sleep(SPLASH_MS);
  c.log("PXINK", await c.js(`(() => { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 40; const g = cv.getContext('2d', { willReadFrequently: true }), out = {};
    for (const ch of '0123456789-+%.,') { g.clearRect(0, 0, 16, 40); g.font = "8px 'Press Start 2P'"; g.fillStyle = '#fff'; g.fillText(ch, 0, 24);
      const d = g.getImageData(0, 0, 16, 40).data; let cols = ''; for (let x = 0; x < 10; x++) { let on = 0; for (let y = 0; y < 40; y++) if (d[(y * 16 + x) * 4 + 3] > 100) on = 1; cols += on ? '#' : '.'; } out[ch] = cols; }
    return JSON.stringify({ loaded: document.fonts.check("8px 'Press Start 2P'"), advance: g.measureText('1').width, out }); })()`));
};

/* ---------- the screens shipped with the app (public/warm-seed.json) ----------
   On its first launch the installed app draws every screen before its opening plays (warmPrime in App.jsx). Somebody
   new has filed no screens yet, so a set made of test data only is shipped. To make it again after the look of the
   app has changed (from the project folder, each line as in run.cjs, with --profile=seed):
     seedprep --fresh        an empty data folder: the login, then test data on all four sides
     finance, cards, flow, trade, stocks, fx       every screen is opened, and files itself
     year-finance, year-crypto, year-idx, year-fx  the yearly panels' pop-ups
     dump                    writes them to public/warm-seed.json */
const seedprep = async (c) => {
  const flask = async () => { await c.press('button[aria-label="Add test data"]'); await c.sleep(2600); };
  const home = async () => { await c.press(".foot-logo"); await c.sleep(4600); };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await flask(); await home();
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await flask(); await home();
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
  await c.press(".idx-unit"); await c.sleep(1100); await c.press(".idx-unit"); await c.sleep(6500);
  await flask(); await home();
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
  await c.press(".idx-unit"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(5000);
  await flask();
  c.log("SEEDPREP", await c.js(`JSON.stringify(Object.keys(localStorage).map((k) => k + ":" + localStorage.getItem(k).length))`));
};
// the yearly panel's pop-ups on one side (chart, calculator, wrapped), each left open long enough to file itself
const yearpops = (kind) => async (c) => {
  await c.sleep(SPLASH_MS);
  if (kind === "finance") {
    await c.press(".wallet-unit.active"); await c.sleep(1400);
    await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
    await c.press(".big-card"); await c.sleep(6500);
  } else {
    await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
    if (kind === "crypto") { await c.press(".coin-unit"); await c.sleep(5000); }
    else { await c.press(".idx-unit"); await c.sleep(1100); }
    if (kind === "idx") { await c.press(".idx-unit"); await c.sleep(6500); }
    if (kind === "fx") { await c.press(".coin-unit.fx"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(5000); }
  }
  for (const sel of [".chart-btn", kind === "finance" ? null : ".calc-fab", ".year-big"]) {
    if (!sel) continue;
    await c.press(sel); await c.sleep(3200);
    c.key("Escape"); await c.sleep(1000);
  }
};
const dump = async (c) => {
  await c.sleep(SPLASH_MS);
  const all = JSON.parse(await c.js(`new Promise((done) => { const rq = indexedDB.open("flow-warm", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("screens", { keyPath: "key" });
    rq.onerror = () => done("[]");
    rq.onsuccess = () => { const g = rq.result.transaction("screens").objectStore("screens").getAll(); g.onerror = () => done("[]"); g.onsuccess = () => done(JSON.stringify(g.result)); }; })`));
  const out = all.filter((sc) => sc && typeof sc.key === "string" && typeof sc.html === "string").sort((a, b) => (a.rank ?? 1) - (b.rank ?? 1) || a.key.localeCompare(b.key))
    .map((sc) => ({ key: sc.key, rank: sc.rank ?? 1, html: sc.html }));
  for (const sc of out) c.log("SCREEN", sc.rank, sc.key, sc.html.length);
  require("node:fs").writeFileSync(require("node:path").join(c.OUT, "warm-seed.json"), JSON.stringify(out));
  c.log("DUMPED", out.length, "screens,", out.reduce((a, sc) => a + sc.html.length, 0), "characters");
};

// The month's hero on both sides and the quick log's Often row (run with --shots, on the usual profile): stills of the
// big figure and the first tile, which face each is drawn in, and the names the Often row holds.
const hero = async (c) => {
  const box = (sel) => c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`);
  const face = (sel) => c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const s = getComputedStyle(e); return [e.innerText, s.fontFamily.split(",")[0], s.fontSize, s.fontWeight, s.textTransform].join(" | "); })()`);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  c.log("FINANCE", await face(".hero-num"), "//", await face(".hero-tile .ht-val"));
  await c.shot("hero-finance", (await box(".hero")) || undefined);
  await c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }))`); await c.sleep(900);
  c.log("OFTEN", await c.js(`(() => { const e = document.querySelector(".ql-often"); return e ? e.innerText.replace(/\\s+/g, " ") : null; })()`));
  await c.shot("often", (await box(".ql-often")) || undefined);
  c.key("Escape"); await c.sleep(600);
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(700);
  await c.press(".foot-logo"); await c.sleep(4800);
  for (const w of [1000, 1600, 6200]) { await c.press(".coin-unit"); await c.sleep(w); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  c.log("TRADING", await face(".hero-num"), "//", await face(".hero-tile .ht-val"));
  await c.shot("hero-trading", (await box(".hero")) || undefined);
};

// A no-spend mark and an expense on one day (run with --shots --fresh). First a still of the login with a background
// and a figure chosen, and the names of the backgrounds. Then on the day panel: an amount typed and the minus
// double-clicked must leave one expense and no mark; a double click on an empty day leaves the mark; an expense added
// to that day takes the mark off again.
const nospend = async (c) => {
  const saved = () => c.js(`(() => { const sp = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}').spending || {}; return JSON.stringify(Object.entries(sp).map(([k, v]) => k.slice(8) + ': ' + v.map((e) => (e.zero ? 'NO-SPEND' : e.amount)).join(' + '))); })()`);
  // a hidden page is never "in use", so keys typed at it go nowhere: the amount is put into the box as React reads it
  const type = async (text) => c.log("BOX", await c.js(`(() => { const el = document.querySelector('button.draw-btn[title^="Add expense"]').parentElement.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; })()`));
  const minus = 'button.draw-btn[title^="Add expense"]';
  const at = () => c.js(`(() => { const r = document.querySelector(${JSON.stringify(minus)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  const twice = async () => {
    const r = await at();
    c.wc.sendInputEvent({ type: "mouseMove", ...r }); await c.sleep(30);
    for (const n of [1, 2]) { c.wc.sendInputEvent({ type: "mouseDown", ...r, button: "left", clickCount: n }); c.wc.sendInputEvent({ type: "mouseUp", ...r, button: "left", clickCount: n }); await c.sleep(70); }
    await c.sleep(800);
  };
  const amount = async () => { await c.js(`(() => { const el = document.querySelector('button.draw-btn[title^="Add expense"]').parentElement.querySelector('input'); el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.focus(); })()`); await c.sleep(400); };
  const day = async (n) => { await c.js(`document.querySelector('.cal-wrap').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500); await c.press(".cell", n); await c.sleep(1500); };
  await c.sleep(SPLASH_MS);
  await c.press('.acc-bgc[title="Forest"]'); await c.sleep(300); await c.press('.acc-pic[title="Batman"]'); await c.sleep(600);
  c.log("BACKS", await c.js(`JSON.stringify([...document.querySelectorAll('.acc-bgc')].map((b) => b.title))`));
  await c.shot("login", (await c.js(`(() => { const r = document.querySelector('.acc-card').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; })()`)) || undefined);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await day(9); await amount(); await type("20"); await c.sleep(200); await twice();
  c.log("TYPED THEN DOUBLE CLICK", await saved());
  await day(11); await amount(); await twice();
  c.log("EMPTY DAY DOUBLE CLICK", await saved());
  await amount(); await type("15"); await c.sleep(200); await c.press(minus); await c.sleep(800);
  c.log("EXPENSE ON THE MARKED DAY", await saved());
  await twice();
  c.log("DOUBLE CLICK AGAIN", await saved());
};

// The footer's Export and Import (run with --shots): which symbol each button carries, the note that shows while the
// pointer is on it, and the name an export would be saved under. The press is caught before a file is made: a real
// download in a hidden run would bring a save box up on his screen.
const foot = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  const at = (label) => c.js(`(() => { const r = document.querySelector('button.bk-btn[aria-label="${label}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  c.log("SYMBOLS", await c.js(`JSON.stringify([...document.querySelectorAll('button.bk-btn.ico')].map((b) => b.getAttribute('aria-label') + ' = ' + b.querySelector('.msym').textContent + ' / ' + b.querySelector('.bk-tip').innerText.replace(/\\n/g, ': ') + (b.title ? ' TITLE ' + b.title : '')))`));
  for (const label of ["Export", "Import"]) {
    const p = await at(label); c.move(p.x, p.y); await c.sleep(900);
    await c.shot("foot-" + label.toLowerCase(), { x: Math.max(0, Math.round(p.x - 60)), y: Math.round(p.y - 90), width: 330, height: 120 });
  }
  await c.js(`HTMLAnchorElement.prototype.click = function () { window.__saved = this.download; }; 0`);      // (a function can't be handed back to the run)
  await c.press('button.bk-btn[aria-label="Export"]'); await c.sleep(900);
  c.log("FILE", await c.js(`window.__saved`));
};

// What is saved (nothing is pressed): every key with its length, the accounts, and how many days, entries and test
// entries each finance key holds. To look at his data as it stands now, copy his "Local Storage" folder into a
// profile of its own first (cp -R into $TMPDIR/flow-perf/profile-look) and run with --profile=look.
const keys = async (c) => {
  await c.sleep(2500);
  c.log("KEYS", await c.js(`JSON.stringify(Object.keys(localStorage).sort().map((k) => k + " " + localStorage.getItem(k).length))`));
  c.log("USERS", await c.js(`(() => { try { const u = JSON.parse(localStorage.getItem("flow-users")); return JSON.stringify({ last: u.last, list: u.list.map((x) => x.id + " " + x.first + " " + x.last + (x.fresh ? " fresh" : "")) }); } catch (e) { return String(localStorage.getItem("flow-users")).slice(0, 200); } })()`));
  c.log("ASIDE", await c.js(`String(localStorage.getItem("flow-aside")).slice(0, 300).replace(/data:image[^"]+/g, "(picture)")`));
  c.log("FINANCE", await c.js(`JSON.stringify(Object.keys(localStorage).filter((k) => k.endsWith("pnl-calendar-idr")).map((k) => { try { const d = JSON.parse(localStorage.getItem(k)), all = Object.values(d.spending || {}).flat(); return k + ": " + Object.keys(d.spending || {}).length + " days, " + all.length + " entries, " + all.filter((e) => e.test).length + " test, " + Object.keys(d.incomes || {}).length + " income months, " + Object.keys(d.limits || {}).length + " limits, " + (d.goals || []).length + " goals, " + (d.debts || []).length + " debts, last day " + Object.keys(d.spending || {}).sort().pop(); } catch (e) { return k + ": unreadable"; } }))`));
};

// Backups with nothing in them (run with --fresh, finance side): an empty account pressed on Export must write no file;
// an empty backup handed to Import must change nothing; a backup with one expense must come in; the empty one handed
// over after it must leave that expense; and Export must then name its file. The file box is never opened (the file
// is put on the hidden input) and the download is caught before a file is made.
const backup = async (c) => {
  const said = () => c.js(`[...document.querySelectorAll('.bk-msg')].map((e) => e.innerText).join(' | ')`);
  const days = () => c.js(`JSON.stringify(Object.entries(JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}').spending || {}).map(([k, v]) => k + ': ' + v.map((e) => e.amount).join(' + ')))`);
  const give = async (obj) => { await c.js(`(() => { const inp = document.querySelector('input[type=file][accept*="json"]'), dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(obj))}], "x.json", { type: "application/json" })); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); return 0; })()`); await c.sleep(700); };
  const out = async () => { await c.js(`window.__saved = null; 0`); await c.press('button.bk-btn[aria-label="Export"]'); await c.sleep(700); return c.js(`String(window.__saved)`); };
  const empty = { version: 1, spending: {}, incomes: {}, limits: {}, currency: "IDR", goals: [], debts: [] };
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`HTMLAnchorElement.prototype.click = function () { window.__saved = this.download; }; 0`);
  c.log("EXPORT, EMPTY ACCOUNT ->", await out(), "//", await said());
  await give(empty); c.log("IMPORT, EMPTY FILE ->", await said(), "//", await days());
  await give({ ...empty, spending: { "2026-10-05": [{ id: "a", amount: 25000, desc: "kopi" }] } }); c.log("IMPORT, ONE EXPENSE ->", await said(), "//", await days());
  await give(empty); c.log("IMPORT, EMPTY FILE AFTER IT ->", await said(), "//", await days());
  c.log("EXPORT ->", await out(), "//", await said());
};

// A logged row dragged by its bar onto another day (run with --fresh; with --shots stills of the login's backgrounds
// and of a drag under way, without it the frame times of each drag for report.cjs). The entries are put into the
// saved data first, so one carries a category, one its items and one a symbol of its own: each must arrive as it left.
const dragmove = async (c) => {
  const seed = { spending: { "2026-10-10": [{ id: "e1", amount: 60000, desc: "sweatpants", cat: "shopping" }, { id: "e2", amount: 45000, desc: "lunch", parts: [{ id: "p1", amount: 20000, desc: "pizza" }, { id: "p2", amount: 25000, desc: "drinks" }] }, { id: "e3", amount: 7000, desc: "snack", cat: "other", icon: "cookie" }],
    "2026-10-04": [{ id: "z", amount: 0, desc: "No spend day", zero: true }] }, incomes: { "2026-10": [{ id: "i1", amount: 500000, desc: "bonus", day: 10 }] }, limits: {}, currency: "IDR", goals: [], debts: [] };
  const saved = () => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'); return JSON.stringify({ days: Object.fromEntries(Object.entries(d.spending || {}).sort().map(([k, v]) => [k.slice(8), v.map((e) => (e.zero ? 'MARK' : e.id)).join(',')])), inc: Object.values(d.incomes || {}).flat().map((e) => e.id + '@' + e.day).join(',') }); })()`);
  const entry = (id) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'); for (const [k, v] of Object.entries(d.spending || {})) for (const e of v) if (e.id === ${JSON.stringify(id)}) return k.slice(8) + ' ' + JSON.stringify(e); return null; })()`);
  const grip = (text) => c.js(`(() => { const row = [...document.querySelectorAll('.entry-row')].find((r) => [...r.querySelectorAll('input')].some((i) => i.value === ${JSON.stringify(text)})); if (!row) return null; const r = row.querySelector('.row-grip').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const tile = (day) => c.js(`(() => { const r = document.querySelector('.cell[data-day="${day}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const send = (type, p, more) => c.wc.sendInputEvent({ type, x: Math.round(p.x), y: Math.round(p.y), ...more });
  const down = async (p) => { send("mouseMove", p); await c.sleep(40); send("mouseDown", p, { button: "left", clickCount: 1 }); await c.sleep(60); };
  const glide = async (a, b, n = 18) => { for (let i = 1; i <= n; i++) { send("mouseMove", { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }, { modifiers: ["leftButtonDown"] }); await c.sleep(16); } };
  const up = (p) => send("mouseUp", p, { button: "left", clickCount: 1 });
  const mid = () => c.js(`(() => { const ring = document.querySelector('.cal-ring'), r = ring.getBoundingClientRect(), t = [...document.querySelectorAll('.cell[data-day]')].find((e) => { const q = e.getBoundingClientRect(); return Math.abs(q.left - r.left) < 1.5 && Math.abs(q.top - r.top) < 1.5 && Math.abs(q.width - r.width) < 1.5; });
    const chip = document.querySelector('.dnd-chip-in'), bar = chip && chip.querySelector('i').getBoundingClientRect();
    return JSON.stringify({ chip: chip ? [...chip.children].map((e) => e.textContent).join(' | ') : null, shown: chip ? getComputedStyle(chip).opacity : null, barAt: bar ? [Math.round(bar.left + bar.width / 2), Math.round(bar.top + bar.height / 2)] : null,
      ring: ring.classList.contains('on') ? 'on day ' + (t ? t.dataset.day : '?') : 'off', dimmed: document.querySelectorAll('.row-wrap.dnd-src').length, tilesUnderPointer: document.querySelectorAll('.cell:hover').length, marked: String(getSelection()).length }); })()`);
  const after = () => c.js(`JSON.stringify({ chips: document.querySelectorAll('.dnd-chip').length, dimmed: document.querySelectorAll('.row-wrap.dnd-src').length, held: document.querySelectorAll('.row-grip.held').length, ring: document.querySelector('.cal-ring') ? document.querySelector('.cal-ring').className : 'none', rows: [...document.querySelectorAll('.entry-row')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value).join(' ')).join(' / ') })`);
  const top = async () => { await c.js(`document.querySelector('.cal-wrap').scrollIntoView({ block: 'start', behavior: 'instant' }); 0`); await c.sleep(400); };
  await c.sleep(SPLASH_MS);
  if (c.shots) {
    await c.press('.acc-bgc[title="Night lake"]'); await c.sleep(300); await c.press('.acc-pic[title="Santa hat"]'); await c.sleep(600);
    c.log("BACKS", await c.js(`JSON.stringify([...document.querySelectorAll('.acc-bgc')].map((b) => b.title))`));
    await c.shot("login", (await c.js(`(() => { const r = document.querySelector('.acc-card').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; })()`)) || undefined);
  }
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(2500);
  await c.js(`localStorage.setItem('pnl-calendar-idr', ${JSON.stringify(JSON.stringify(seed))}); location.reload(); 0`);
  await c.sleep(SPLASH_MS + 1500);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await top(); await c.press('.cell[data-day="10"]'); await c.sleep(1600); await top();
  c.log("START", await saved(), "//", await after());
  const was = { e1: await entry("e1"), e2: await entry("e2"), e3: await entry("e3") };
  // 1. an expense onto a day that holds a no-spend mark
  let a = await grip("sweatpants"), b = await tile(4);
  await c.step("drag-1", async () => { await down(a); await glide(a, b); }, 420);
  c.log("1 MID", "pointer", JSON.stringify([Math.round(b.x), Math.round(b.y)]), await mid());
  if (c.shots) await c.shot("drag-mid");
  await c.step("drop-1", async () => up(b), 1100);
  c.log("1 DROPPED ON 4", await saved(), "//", await after());
  c.log("1 SAME ENTRY", (await entry("e1")).slice(3) === was.e1.slice(3), await entry("e1"));
  // 2. the one with items
  a = await grip("lunch"); b = await tile(4);
  await c.step("drag-2", async () => { await down(a); await glide(a, b); }, 300);
  await c.step("drop-2", async () => up(b), 1100);
  c.log("2 ITEMS KEPT", (await entry("e2")).slice(3) === was.e2.slice(3), await entry("e2"), "//", await saved());
  // 3. an income
  a = await grip("bonus"); b = await tile(6);
  await c.step("drag-3", async () => { await down(a); await glide(a, b); }, 300);
  if (c.shots) await c.shot("drag-income");
  await c.step("drop-3", async () => up(b), 1100);
  c.log("3 INCOME TO 6", await saved());
  // 4. let go beside the calendar, on its own day, and Esc: nothing may change
  a = await grip("snack"); let out = { x: 24, y: 300 };
  await down(a); await glide(a, out); await c.sleep(300); c.log("4 OFF THE CALENDAR, MID", await mid()); up(out); await c.sleep(700);
  c.log("4 LET GO BESIDE IT", await saved(), "//", await after());
  a = await grip("snack"); b = await tile(10);
  await down(a); await glide(a, b); await c.sleep(300); c.log("5 OWN DAY, MID", await mid()); up(b); await c.sleep(700);
  c.log("5 LET GO ON ITS OWN DAY", await saved());
  a = await grip("snack"); b = await tile(5);
  await down(a); await glide(a, b); await c.sleep(300); c.key("Escape"); await c.sleep(500);
  c.log("6 ESC", await saved(), "//", await after()); up(b); await c.sleep(500);
  c.log("6 AND THE BUTTON LET GO AFTER IT", await saved(), "//", await after());
  // 7. a press on the bar without moving
  a = await grip("snack"); await down(a); await c.sleep(200); up(a); await c.sleep(400);
  c.log("7 A PRESS ONLY", await saved(), "//", await after());
  // 8. the calendar out of sight: held at the top edge, the page scrolls to it
  await c.js(`(() => { const g = [...document.querySelectorAll('.entry-row')].pop().querySelector('.row-grip').getBoundingClientRect(); window.scrollBy({ top: g.top - 130, behavior: 'instant' }); return 0; })()`); await c.sleep(500);
  a = await grip("snack"); const y0 = await c.js(`scrollY`), hid = await c.js(`document.querySelector('.cell[data-day="2"]').getBoundingClientRect().bottom`);
  await down(a); await glide(a, { x: a.x, y: 14 }, 10);
  for (let i = 0; i < 40 && (await c.js(`document.querySelector('.cell[data-day="2"]').getBoundingClientRect().top`)) < 90; i++) await c.sleep(60);
  b = await tile(2); await glide({ x: a.x, y: 14 }, b, 14); await c.sleep(320);
  c.log("8 SCROLLED", "day 2's bottom edge was at", Math.round(hid), "scrollY", Math.round(y0), "->", Math.round(await c.js(`scrollY`)), await mid());
  await c.step("drop-8", async () => up(b), 1100);
  c.log("8 LAST ONE OUT, DAY 10 EMPTIED", await saved(), "//", await after());
  c.log("8 SAME ENTRY", (await entry("e3")).slice(3) === was.e3.slice(3), await entry("e3"));
  // 9. the day it went to shows it, and it can be taken on from there
  await top(); await c.press('.cell[data-day="4"]'); await c.sleep(1600); await top();
  c.log("9 DAY 4 OPENED", await after());
  a = await grip("lunch"); b = await tile(20);
  await c.step("drag-9", async () => { await down(a); await glide(a, b); }, 300);
  await c.step("drop-9", async () => up(b), 1100);
  c.log("9 ON TO 20", await saved(), "//", (await entry("e2")).slice(3) === was.e2.slice(3));
  await c.step("end", async () => {}, 300);
};

// Import of any side's backup from any side, then planned expenses in Weekly expenses (run with --shots --fresh).
// The file box is never opened: the file is put on the hidden input.
const plans = async (c) => {
  const said = () => c.js(`[...document.querySelectorAll('.bk-msg')].map((e) => e.innerText).join(' | ')`);
  const key = (k) => c.js(`(() => { const v = localStorage.getItem(${JSON.stringify(k)}); if (!v) return 'none'; const d = JSON.parse(v); return d.trades ? Object.entries(d.trades).map(([k, t]) => k.slice(5) + ':' + t.map((x) => x.pair + ' ' + x.pnl).join(',')).join(' ') || 'no trades' : Object.entries(d.spending || {}).map(([k, t]) => k.slice(5) + ':' + t.map((x) => x.desc + ' ' + x.amount).join(',')).join(' ') + ' plans:' + (d.plans || []).map((x) => x.date.slice(5) + ' ' + x.desc + ' ' + x.amount).join(','); })()`);
  const give = async (obj) => { await c.js(`(() => { const inp = document.querySelector('input[type=file][accept*="json"]'), dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(obj))}], "anything at all (3).json", { type: "application/json" })); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); return 0; })()`); await c.sleep(800); };
  const crypto = { app: "flow-crypto", version: 1, trades: { "2026-10-05": [{ id: "t1", pnl: 120.5, pair: "BTCUSDT", side: "long" }] } };
  const idx = { app: "flow-idx", version: 1, trades: { "2026-10-06": [{ id: "s1", pnl: 350000, pair: "ANTM" }] } };
  const fin = { version: 1, spending: { "2026-10-05": [{ id: "a", amount: 25000, desc: "kopi" }] }, incomes: {}, limits: {}, currency: "IDR", goals: [], debts: [] };
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  // on the finance side: a crypto backup, its undo, again; a stocks backup; something that is no backup
  await give(crypto); c.log("FINANCE <- CRYPTO FILE:", await said(), "// crypto:", await key("pnl-crypto-usd"));
  await c.js(`[...document.querySelectorAll('button.bk-btn')].find((b) => b.innerText === 'Undo').click(); 0`); await c.sleep(700);
  c.log("UNDO:", await said(), "// crypto:", await key("pnl-crypto-usd"));
  await give(crypto); await give(idx); c.log("FINANCE <- STOCKS FILE:", await said(), "// stocks:", await key("pnl-idx-idr"), "// crypto:", await key("pnl-crypto-usd"));
  await give({ hello: 1 }); c.log("NOT A BACKUP:", await said());
  await give(fin); c.log("FINANCE <- FINANCE FILE:", await said(), "// finance:", await key("pnl-calendar-idr"));
  // planned expenses, on this month's Weekly expenses card
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.js(`document.querySelector('.wp').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(2600);
  const set = (sel, v) => c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; })()`);
  const days = () => c.js(`JSON.stringify([...document.querySelectorAll('.wp-pick button')].map((b) => b.innerText + (b.classList.contains('on') ? '*' : '')))`);
  const card = async (name) => { const r = await c.js(`(() => { const r = document.querySelector('.wp').closest('.flow-card').getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`); await c.shot(name, r); };
  const chart = () => c.js(`(() => { const card = document.querySelector('.wp').closest('.flow-card'), p = card.querySelector('path[stroke="#8fa3b8"]'); return JSON.stringify({ dashed: p ? p.getAttribute('d').length : 0, dots: card.querySelectorAll('circle[stroke="#8fa3b8"]').length, head: card.innerText.split('\\n').slice(0, 3).join(' '), rows: [...card.querySelectorAll('.wp-row')].map((r) => r.innerText.replace(/\\s+/g, ' ').replace(/ check.*/, '')) }); })()`);
  c.log("DAYS OFFERED", await days());
  await card("plans-empty");
  await set(".wp input.amt-field", "150.000"); await set(".wp .desc-field", "haircut"); await c.press('.wp .split-btn'); await c.sleep(700);
  c.log("PLAN 1", await chart(), "//", await key("pnl-calendar-idr"));
  await c.press(".wp-pick button", 0); await c.sleep(200);
  await set(".wp input.amt-field", "80.000"); await set(".wp .desc-field", "dinner out"); await c.press('.wp .split-btn'); await c.sleep(1200);
  c.log("PLAN 2, TODAY", await days(), await chart());
  await card("plans-two");
  // the tick: it becomes an expense of today and leaves the plan; the bin: it only leaves
  await c.js(`[...document.querySelectorAll('.wp-row')].find((r) => r.innerText.includes('dinner out')).querySelector('.wp-do').click(); 0`); await c.sleep(1100);
  c.log("TICKED", await chart(), "//", await key("pnl-calendar-idr"));
  await c.js(`document.querySelector('.wp-row .trash-btn').click(); 0`); await c.sleep(1100);
  c.log("BINNED", await chart(), "//", await key("pnl-calendar-idr"));
  // a plan in the past is dropped when the entries are read; one to come is kept
  await set(".wp input.amt-field", "60.000"); await set(".wp .desc-field", "books"); await c.press('.wp .split-btn'); await c.sleep(700);
  await c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr')); d.plans.push({ id: 'old', amount: 99000, desc: 'last week', date: '2026-10-03' }); localStorage.setItem('pnl-calendar-idr', JSON.stringify(d)); location.reload(); return 0; })()`);
  await c.sleep(SPLASH_MS + 1500);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.js(`document.querySelector('.wp').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(2600);
  c.log("AFTER A RELOAD WITH A PAST PLAN PUT IN", await chart());
  // from a trading side: a finance backup and a forex one
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(700);
  await c.press(".foot-logo"); await c.sleep(4800);
  for (const w of [1000, 1600, 6200]) { await c.press(".coin-unit"); await c.sleep(w); }
  c.log("CRYPTO SIDE OPENED, ITS TRADES:", await key("pnl-crypto-usd"), "// on screen:", await c.js(`(document.querySelector('.poster-num') || {}).innerText`));
  await give({ ...fin, spending: { "2026-10-07": [{ id: "b", amount: 33000, desc: "bensin" }] } }); c.log("CRYPTO <- FINANCE FILE:", await said(), "// finance:", await key("pnl-calendar-idr"));
  await give({ app: "flow-fx", version: 1, trades: { "2026-10-08": [{ id: "f1", pnl: 25.85, pair: "EURUSD", side: "long" }] } }); c.log("CRYPTO <- FOREX FILE:", await said(), "// forex:", await key("pnl-fx-usd"));
  await give({ ...crypto, trades: { "2026-10-09": [{ id: "t2", pnl: -40, pair: "ETHUSDT", side: "short" }] } }); c.log("CRYPTO <- CRYPTO FILE:", await said(), "// crypto:", await key("pnl-crypto-usd"));
};

// Planned expenses and the weekly chart (run with --shots --fresh): the dashed red outline sliding to the day pressed
// (its place read every frame), a plan's long-dashed line, the chart stepped to other weeks with its arrows, and a
// day's note pressed open into that day's list, then shut by a press outside it and by Esc.
const pick = async (c) => {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const seed = { spending: { [day(0)]: [{ id: "a", amount: 45000, desc: "lunch" }, { id: "b", amount: 18000, desc: "kopi" }, { id: "c", amount: 15000, desc: "gojek" }], [day(-3)]: [{ id: "d", amount: 30000, desc: "snack" }] }, incomes: {}, limits: {}, currency: "IDR", goals: [], debts: [], plans: [] };
  const into = async () => {
    await c.press(".wallet-unit.active"); await c.sleep(1400);
    await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
    await c.press(".big-card"); await c.sleep(6500);
    await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
    await c.js(`document.querySelector('.wp').closest('.flow-card').scrollIntoView({ block: 'start', behavior: 'instant' }); 0`); await c.sleep(2800);
  };
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(2500);
  await c.js(`localStorage.setItem('pnl-calendar-idr', ${JSON.stringify(JSON.stringify(seed))}); location.reload(); 0`);
  await c.sleep(SPLASH_MS + 1500);
  await into();
  const set = (sel, v) => c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; })()`);
  const days = () => c.js(`JSON.stringify([...document.querySelectorAll('.wp-days button')].map((b) => b.innerText + (b.classList.contains('on') ? '*' : '')))`);
  const at = `(() => { const s = document.querySelector('.wp-days'), b = s.querySelector('.wp-on').getBoundingClientRect(), o = s.querySelector('button.on').getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10, Math.round(o.left * 10) / 10, Math.round(o.right * 10) / 10, s.querySelector('button.on').innerText]; })()`;
  const card = async (name) => { const r = await c.js(`(() => { const r = document.querySelector('.wp').closest('.flow-card').getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`); await c.shot(name, r); };
  const chart = () => c.js(`(() => { const k = document.querySelector('.wp').closest('.flow-card'), p = k.querySelector('path[stroke-dasharray="13 7"]'), box = k.querySelector('.wp .amt-field'); return JSON.stringify({ head: k.innerText.split('\\n').slice(0, 3).join(' '), dashed: p ? [p.getAttribute('stroke'), p.getAttribute('stroke-linecap'), p.getAttribute('d').length] : null, dots: k.querySelectorAll('circle[stroke-dasharray]').length, amountBox: getComputedStyle(box).borderColor + ' typed:' + box.value, outline: getComputedStyle(k.querySelector('.wp-on')).border }); })()`);
  // 1. the outline slides
  c.log("DAYS", await days());
  c.log("1 AT REST: outline left, right, day left, right", JSON.stringify(await c.js(at)));
  await c.js(`(() => { window.__box = []; const t0 = performance.now(), f = () => { const v = ${at}; window.__box.push([Math.round(performance.now() - t0), v[0], v[1]]); if (performance.now() - t0 < 700) requestAnimationFrame(f); }; requestAnimationFrame(f); return 0; })()`);
  await c.press(".wp-days button", 4); await c.sleep(900);
  c.log("1 WHILE IT MOVED: ms, left, right", await c.js(`JSON.stringify(window.__box.filter((x, i) => i % 3 === 0).slice(0, 12))`));
  c.log("1 AFTER", JSON.stringify(await c.js(at)));
  // 2. a plan two days on: the long-dashed line
  await c.press(".wp-days button", 2); await c.sleep(500);
  await set(".wp input.amt-field", "150.000"); await set(".wp .desc-field", "haircut"); await c.press(".wp .split-btn"); await c.sleep(1300);
  c.log("2 PLANNED IN TWO DAYS", await chart());
  await card("week-planned");
  // 3. the chart stepped on a week: what is typed stays, the days are that week's, a plan there shows there
  await set(".wp input.amt-field", "70.000");
  await c.press(".wk-step", 1); await c.sleep(1500);
  c.log("3 A WEEK ON", await days(), await chart());
  await c.press(".wp-days button", 1); await c.sleep(450); await set(".wp .desc-field", "dinner out"); await c.press(".wp .split-btn"); await c.sleep(1300);
  c.log("3 PLANNED THERE", await chart());
  await card("week-next");
  await c.press(".wk-step", 0); await c.sleep(900); await c.press(".wk-step", 0); await c.sleep(1500);
  c.log("3 A WEEK BACK FROM THIS ONE", await days(), await chart());
  await c.press(".wk-step", 1); await c.sleep(1500);
  c.log("3 THIS WEEK AGAIN", await chart());
  // 4. a day's note pressed open
  const col = (i) => c.js(`(() => { const r = [...document.querySelector('.wp').closest('.flow-card').querySelectorAll('svg rect[fill="transparent"]')][${i}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 }; })()`);
  const tips = () => c.js(`JSON.stringify({ note: [...document.querySelectorAll('.glass-tip:not(.pin)')].map((e) => e.innerText.replace(/\\n+/g, ' ')), open: [...document.querySelectorAll('.glass-tip.pin')].map((e) => e.className.replace('glass-tip ', '') + ': ' + e.innerText.replace(/\\n+/g, ' | ')) })`);
  let p0 = await col(0), p2 = await col(2);
  c.move(p0.x, p0.y); await c.sleep(450); c.log("4 POINTER ON TODAY", await tips());
  await c.click(p0.x, p0.y); await c.sleep(500); c.log("4 PRESSED", await tips());
  const fits = await c.js(`(() => { const t = document.querySelector('.glass-tip.pin .glass-tip-inner').getBoundingClientRect(), k = document.querySelector('.wp').closest('.flow-card').getBoundingClientRect(); return JSON.stringify({ box: [Math.round(t.left), Math.round(t.top), Math.round(t.right), Math.round(t.bottom)], card: [Math.round(k.left), Math.round(k.top), Math.round(k.right), Math.round(k.bottom)] }); })()`);
  c.log("4 WHERE IT STANDS", fits);
  await card("note-open");
  c.move(p2.x, p2.y); await c.sleep(450); c.log("4 POINTER ON ANOTHER DAY MEANWHILE", await tips());
  const out = await c.js(`(() => { const r = document.querySelector('.wp-head').getBoundingClientRect(); return { x: r.left + 200, y: r.top + r.height / 2 }; })()`);
  await c.click(out.x, out.y); await c.sleep(120); c.log("4 PRESSED OUTSIDE, 0.12s ON", await tips()); await c.sleep(450); c.log("4 AND 0.6s ON", await tips());
  c.move(p2.x, p2.y); await c.sleep(450); c.log("4 POINTER ON THE DAY WITH THE PLAN", await tips());
  await c.click(p2.x, p2.y); await c.sleep(500); c.log("4 THAT ONE PRESSED", await tips());
  await card("note-plan");
  c.key("Escape"); await c.sleep(500); c.log("4 ESC", await tips(), "month still open:", await c.js(`!!document.querySelector('.wp')`));
};

// The information symbol under the score, and a planned expense in the projection (run with --shots --fresh): a still
// of the dial with the symbol, the note under the pointer (what it says, and that nothing lies over it), then the
// projection's tiles with one plan two days on.
const scoreinfo = async (c) => {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const sp = {};
  for (let n = 1; n <= 45; n++) sp[day(-n)] = [{ id: "s" + n, amount: 30000 + (n % 4) * 9000, desc: n % 3 ? "lunch" : "gojek" }];
  sp[day(0)] = [{ id: "s0", amount: 42000, desc: "lunch" }];
  const mk = (n) => day(n).slice(0, 7), inc = {};
  inc[mk(0)] = [{ id: "i0", amount: 3000000, desc: "salary", day: 1 }]; if (mk(-40) !== mk(0)) inc[mk(-40)] = [{ id: "i1", amount: 3000000, desc: "salary", day: 1 }];
  const seed = { spending: sp, incomes: inc, limits: {}, currency: "IDR", goals: [], debts: [], plans: [{ id: "p1", amount: 150000, desc: "haircut", date: day(2) }] };
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(2500);
  await c.js(`localStorage.setItem('pnl-calendar-idr', ${JSON.stringify(JSON.stringify(seed))}); location.reload(); 0`);
  await c.sleep(SPLASH_MS + 1500);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  for (let i = 0; i < 8 && !(await c.js(`!!document.querySelector('.score-hit')`)); i++) { await c.scroll(700, 400); await c.sleep(900); }
  await c.js(`document.querySelector('.score-card').scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -40, behavior: 'instant' }); 0`); await c.sleep(2800);
  const area = () => c.js(`(() => { const k = document.querySelector('.score-card').getBoundingClientRect(); return { x: Math.round(k.left - 6), y: Math.round(Math.max(0, k.top - 6)), width: Math.round(k.width + 12), height: Math.round(Math.min(innerHeight - Math.max(0, k.top - 6), k.height + 330)) }; })()`);
  c.log("CARD", await c.js(`document.querySelector('.score-card').innerText.replace(/\\n+/g, ' | ').slice(0, 260)`));
  c.log("SYMBOL AND TREND TAG", await c.js(`(() => { const row = document.querySelector('.score-row'), b = row.querySelector('.info-btn').getBoundingClientRect(), tag = row.children[1].getBoundingClientRect(); return JSON.stringify({ tag: row.children[1].innerText, tagRight: Math.round(tag.right), symbolLeft: Math.round(b.left), tagMidY: Math.round(tag.top + tag.height / 2), symbolMidY: Math.round(b.top + b.height / 2), inDial: document.querySelectorAll('.score-dial .info-btn').length }); })()`));
  await c.shot("score-rest", await area());
  const b = await c.js(`(() => { const r = document.querySelector('.score-row .info-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  c.move(b.x, b.y); await c.sleep(700);
  c.log("NOTE", await c.js(`(() => { const t = document.querySelector('.score-row .info-tip'), r = t.getBoundingClientRect(); let over = 0, n = 0; for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) { n++; const e = document.elementFromPoint(r.left + r.width * i / 6, r.top + r.height * j / 6); if (!e || !t.contains(e)) over++; } return JSON.stringify({ shown: getComputedStyle(t).opacity, box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], window: [innerWidth, innerHeight], pointsCovered: over + ' of ' + n, says: [...t.children].map((e) => e.innerText.replace(/\\n+/g, ' ')) }); })()`));
  await c.shot("score-note", await c.js(`(() => { const r = document.querySelector('.score-row').getBoundingClientRect(); return { x: Math.round(r.left - 250), y: Math.round(Math.max(0, r.top - 40)), width: 880, height: 330 }; })()`));
  c.move(700, 40); await c.sleep(500);
  await c.js(`document.querySelector('.proj-box').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(2600);
  c.log("PROJECTION TILES", await c.js(`JSON.stringify([...document.querySelectorAll('.proj-tiles > *')].map((e) => e.innerText.replace(/\\n+/g, ' ')))`));
  c.log("PROJECTION HEAD", await c.js(`document.querySelector('.proj-main').innerText.replace(/\\n+/g, ' | ').slice(0, 200)`));
};

// Every panel and pop-up on all four sides (stills with --shots; run on a profile with test data on every side, e.g.
// `seedprep --profile=look --fresh`, then `look --profile=look --shots`). After each press the log lists what is
// moving 60ms and 300ms later (CSS animations by name, transitions by property, each with the class of what it moves),
// so a pop-up or a button that changes without moving shows up as "nothing moving".
const look = async (c) => {
  const what = `(e) => e ? (e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "")) : "?"`;
  const moving = () => c.js(`(() => { const d = ${what}; const n = {};
    for (const a of document.getAnimations()) { if (a.playState !== "running") continue; const t = a.effect && a.effect.target;
      if (t && t.closest && t.closest(".warm-host")) continue;
      const k = (a.animationName || ("~" + a.transitionProperty)) + " @" + d(t); n[k] = (n[k] || 0) + 1; }
    return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => v > 1 ? k + " ×" + v : k).join(" | ") || "nothing moving"; })()`);
  const act = async (name, fn, wait = 1200, shoot = true) => {
    c.log("LOOK", name);
    await fn(); await c.sleep(60); c.log("  60ms", await moving()); await c.sleep(240); c.log("  300ms", await moving());
    await c.sleep(Math.max(0, wait - 300)); if (shoot && c.shots) await c.shot(name);
  };
  const tap = (sel, nth = 0) => () => c.press(sel, nth);
  const tapText = (sel, text) => () => c.js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (!e) return false; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`).then((p) => p ? c.click(p[0], p[1]) : c.log("  NOT FOUND", text));
  const esc = () => act("esc", async () => c.key("Escape"), 900, false);
  const view = async (name, sel, block = "start") => { await c.js(`(() => { const e = ${sel}; if (e) e.scrollIntoView({ block: ${JSON.stringify(block)}, behavior: 'instant' }); })()`); await c.sleep(2000); if (c.shots) await c.shot(name); };
  const top = () => c.js(`scrollTo({ top: 0, behavior: 'instant' })`);
  const goHome = async () => { await c.js(`document.querySelector('.foot-logo')?.scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500); return c.press(".foot-logo"); };
  const cmdN = async () => { c.wc.sendInputEvent({ type: "keyDown", keyCode: "N", modifiers: ["control"] }); c.wc.sendInputEvent({ type: "char", keyCode: "n", modifiers: ["control"] }); c.wc.sendInputEvent({ type: "keyUp", keyCode: "N", modifiers: ["control"] }); };

  await c.sleep(1100); if (c.shots) await c.shot("splash");
  await c.sleep(SPLASH_MS - 1100); if (c.shots) await c.shot("pick");
  if (!process.argv.includes("--trade-only")) await lookFinance();
  async function lookFinance() {
  await act("pick-coin", tap(".coin-unit"), 1100);
  await act("markets", tap(".coin-unit"), 1700);
  await act("markets-idx", tap(".idx-unit"), 1200);
  await act("markets-fx", tap(".coin-unit.fx"), 1200);
  await act("markets-back", async () => c.key("Escape"), 1300);
  await act("pick-wallet", tap(".wallet-unit.active"), 1100);
  await act("wallets", tap(".wallet-unit.active"), 1500);
  await act("card", () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1500);
  await act("enter-finance", tap(".big-card"), 6500);
  // finance, the year
  await act("year-chart", tap(".chart-btn"), 2600); await esc();
  await act("year-wrapped", tap(".year-big"), 2600); await esc();
  await act("settings", tap('button[aria-label="Settings"]'), 1200); await esc();
  await act("sidebar", tap(".snav-burger"), 1200); await esc();
  await act("quicklog", cmdN, 1200); await esc();
  await act("month", async () => c.press(".ycell", await monthBox(c)), 3600);
  await act("month-chart", tap(".chart-btn"), 2600); await esc();
  await act("month-wrapped", tap(".month-big"), 2600); await esc();
  await act("day", tap(".cell", 9), 1600);
  await view("day-panel", `document.querySelector('.cell.sel') || document.querySelectorAll('.cell')[9]`, "start");
  for (const [i, n] of [[0, "card-weekly"], [1, "card-flow"], [2, "card-goals"]]) await view(n, `document.querySelectorAll('.flow-card')[${i}]`);
  await view("flow-score", `document.querySelector('.score-hit')`, "center");
  await view("flow-proj", `document.querySelector('.proj-tile')`, "center");
  await view("flow-ins", `document.querySelector('.ins-box')`, "center");
  await view("debts", `document.querySelector('.debt-sec')`, "center");
  await view("page-end", `document.querySelector('.foot-logo')`, "end");
  await view("flow-chart", `document.querySelector('.flow-label')`, "center");
  await act("cat-pop", tap(".flow-label"), 1600); await esc();
  await view("score-dial", `document.querySelector('.score-hit')`, "center");
  await act("score-pop", tap(".score-hit"), 1600); await esc();
  await c.js(`document.querySelectorAll('.flow-card')[1].scrollIntoView({ block: 'start', behavior: 'instant' })`); await c.sleep(1200);
  await act("fold-flow", tap(".flow-card .chev", 1), 1000);
  await act("unfold-flow", tap(".flow-card .chev", 1), 1800);
  await top(); await c.sleep(800);
  await act("sidebar-month", tap(".snav-burger"), 1200);
  await act("split-bill", tapText(".snav button", "Split bill"), 1500); await esc();
  await act("home", goHome, 5000);
  }
  // the three trading sides
  for (const [side, sel] of [["crypto", null], ["idx", ".idx-unit"], ["fx", ".coin-unit.fx"]]) {
    await act(`${side}-in`, async () => {
      await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
      if (sel) { await c.press(sel); await c.sleep(1100); await c.press(sel); } else await c.press(".coin-unit");
    }, 6000);
    await act(`${side}-calc`, tap(".calc-fab"), 1800); await esc();
    await act(`${side}-month`, async () => c.press(".ycell", await monthBox(c)), 3600);
    await act(`${side}-calc-month`, tap(".calc-fab"), 1600);
    await act(`${side}-calc-test`, tapText("button.pc-clear.test", "Test levels"), 1400); await esc();
    await act(`${side}-day`, tap(".cell", 9), 1600);
    await view(`${side}-day-panel`, `document.querySelectorAll('.cell')[9]`, "start");
    await act(`${side}-trade`, tap(".jr-sum"), 1400);
    for (const [i, n] of [[0, "card-1"], [1, "card-2"], [2, "card-3"]]) await view(`${side}-${n}`, `document.querySelectorAll('.flow-card')[${i}]`);
    await top(); await c.sleep(600);
    await act(`${side}-home`, goHome, 5000);
  }
};

// Presses every safe pressable thing on a month panel, one after the other, and logs for each what came onto the page
// and whether it moved in (run on a profile with test data, `sweep --profile=look`; `--side=crypto|idx|fx` for a trading
// side). Skipped: what leaves the panel, files, test data, accounts, deleting. "STILL" lines are the ones to look at:
// something new appeared with nothing moving.
const sweep = async (c) => {
  const side = (process.argv.find((a) => a.startsWith("--side=")) || "--side=finance").slice(7);
  await c.sleep(SPLASH_MS);
  if (side === "finance") {
    await c.press(".wallet-unit.active"); await c.sleep(1400);
    await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
    await c.press(".big-card"); await c.sleep(6500);
  } else {
    await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
    const sel = side === "idx" ? ".idx-unit" : side === "fx" ? ".coin-unit.fx" : null;
    if (sel) { await c.press(sel); await c.sleep(1100); await c.press(sel); } else await c.press(".coin-unit");
    await c.sleep(6000);
  }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  await c.press(".cell", 9); await c.sleep(1800);
  // each pressable is kept as a selector and its place among the matches, and found again before its press: a press
  // can put a whole part of the panel there afresh
  const list = JSON.parse(await c.js(`(() => {
    const SKIP = /delete|remove|clear|reset|restore|export|import|switch|test data|back to home|picture|file|account|trash|bin\\b|undo|previous month|next month/i;
    const NAV = ".foot-logo, .month-btn, .snav-burger, .bk-btn, .who-btn, .pick-back, .snav, .warm-host, input, textarea, select, .row-grip, .nav-arrow, .chev";
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const isBtn = el.tagName === "BUTTON" || el.getAttribute("role") === "button";
      if (!isBtn && getComputedStyle(el).cursor !== "pointer") continue;
      if (!isBtn && el.parentElement && getComputedStyle(el.parentElement).cursor === "pointer") continue;
      if (el.closest(NAV) || el instanceof SVGElement) continue;
      const words = (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "") + " " + el.textContent.slice(0, 40);
      if (SKIP.test(words) || /delete|delete_sweep|close/.test(el.textContent.trim())) continue;
      const sel = el.tagName.toLowerCase() + [...el.classList].filter((k) => /^[a-z][\\w-]*$/i.test(k)).map((k) => "." + k).join("");
      out.push({ sel, nth: [...document.querySelectorAll(sel)].indexOf(el) });
    }
    return JSON.stringify(out); })()`));
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const r = await c.js(`(() => { window.__sw = window.__sw || {}; const el = document.querySelectorAll(${JSON.stringify(list[i].sel)})[${list[i].nth}]; if (!el) return null;
      el.scrollIntoView({ block: "center", behavior: "instant" }); const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === "hidden") return null;
      const d = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
      window.__sw.desc = d(el) + " '" + ((el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent).trim().replace(/\\s+/g, " ").slice(0, 28)) + "'";
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!r) continue;
    await c.sleep(350);
    await c.js(`window.__sw.added = []; window.__sw.mo = new MutationObserver((ms) => { for (const m of ms) for (const a of m.addedNodes) if (a.nodeType === 1 && !a.closest(".warm-host")) window.__sw.added.push(a); });
      window.__sw.mo.observe(document.body, { childList: true, subtree: true }); window.__sw.before = document.getAnimations().length;`);
    await c.click(r.x, r.y);
    await c.sleep(70);
    const out = await c.js(`(() => { window.__sw.mo.disconnect();
      const added = window.__sw.added.filter((a) => a.isConnected && !window.__sw.added.some((b) => b !== a && b.contains(a)));
      const vis = added.filter((a) => { const r = a.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
      const moving = (a) => { for (let e = a; e && e !== document.body; e = e.parentElement) if (e.getAnimations().some((x) => x.playState === "running")) return true;
        return a.getAnimations({ subtree: true }).some((x) => x.playState === "running"); };
      const still = vis.filter((a) => !moving(a));
      const d = (e) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
      return { desc: window.__sw.desc, added: vis.length, still: still.map(d).slice(0, 4), run: document.getAnimations().filter((x) => x.playState === "running").length }; })()`);
    c.log(out.still.length ? "STILL" : out.added ? "MOVES" : out.run ? "CHANGE" : "NONE", out.desc, "added", out.added, "running", out.run, out.still.join(" "));
    await c.sleep(600);
    c.key("Escape"); await c.sleep(500);
  }
};

// The press on every pressable (pressKit): each is held, then let go, and quick-clicked; the log says how far it sank
// (its `scale`), whether its own `transform` was left as it was, and that it is back to 1 afterwards. A thing with a
// press of its own (a day tile) must not sink.
const press = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  c.log("FRAMES in 1s", await c.js(`new Promise((done) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else done(n); }; requestAnimationFrame(f); })`));
  const read = (sel, nth) => c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return null;
    const cs = getComputedStyle(el), a = el.__press; return { scale: cs.scale + (a ? " [" + a.playState + " " + Math.round(a.currentTime) + "ms]" : ""), transform: cs.transform }; })()`);
  for (const [sel, nth] of [[".chart-btn", 0], [".nav-arrow", 1], [".month-big", 0], [".info-btn", 0], [".collapse-btn", 0], [".cell", 9],
    [".flow-label", 1], [".score-hit", 0], [".ins-more", 0], [".goal-sym", 0], [".goal-new", 0], [".plain-arrow.chev", 0], [".split-btn", 0], [".snav-burger", 0]]) {
    const at = await c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return null;
      el.scrollIntoView({ block: "center", behavior: "instant" }); const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width), Math.round(r.height)]; })()`);
    if (!at) { c.log("PRESS", sel, "not found"); continue; }
    await c.sleep(500);
    c.log("  aims at", await c.js(`(() => { const hit = document.elementFromPoint(${at[0]}, ${at[1]}), t = window.__perf.press.target(hit), el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}];
      const d = (e) => e ? e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "") : "nothing";
      return d(hit) + " -> " + d(t) + (t === el ? " (itself)" : t ? "" : "") + " depth " + (t ? window.__perf.press.depth(t).toFixed(3) : "-"); })()`));
    const rest = await read(sel, nth);
    c.wc.sendInputEvent({ type: "mouseMove", x: at[0], y: at[1] }); await c.sleep(300);
    const hover = await read(sel, nth);
    c.wc.sendInputEvent({ type: "mouseDown", x: at[0], y: at[1], button: "left", clickCount: 1 }); await c.sleep(180);
    const held = await read(sel, nth);
    c.wc.sendInputEvent({ type: "mouseUp", x: at[0], y: at[1], button: "left", clickCount: 1 }); await c.sleep(120);
    const mid = await read(sel, nth);
    await c.sleep(400);
    const after = await read(sel, nth);
    c.log("PRESS", sel, `${at[2]}x${at[3]}`, "held", held && held.scale, "120ms after", mid && mid.scale, "after", after && after.scale,
      held && hover && held.transform === hover.transform ? "transform kept" : `transform ${hover && hover.transform} -> ${held && held.transform}`, "rest", rest && rest.scale);
    c.key("Escape"); await c.sleep(700);
  }
  // a quick click: down and up 20ms apart, read 60ms on
  const at = await c.js(`(() => { const el = document.querySelector(".chart-btn"); el.scrollIntoView({ block: "center", behavior: "instant" }); const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()`);
  await c.sleep(400);
  c.wc.sendInputEvent({ type: "mouseDown", x: at[0], y: at[1], button: "left", clickCount: 1 }); await c.sleep(20);
  c.wc.sendInputEvent({ type: "mouseUp", x: at[0], y: at[1], button: "left", clickCount: 1 });
  const dip = [];
  for (let i = 0; i < 8; i++) { await c.sleep(40); dip.push((await read(".chart-btn", 0)).scale); }
  c.log("TAP", dip.join(" "));
  c.key("Escape"); await c.sleep(700);
};

// Stills of the 22 October 2026 pass (run with --shots on a profile with test data, `polish --profile=look`): the
// journal's Win / Breakeven / Loss sliding (mid-way and settled), the trading hero's four tiles, both sides' settings
// switch, and Money flow coming into view while the page is scrolled (no hole before it pops in).
const polish = async (c) => {
  const box = (sel, pad = 12) => c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left - ${pad})), y: Math.max(0, Math.round(r.top - ${pad})), width: Math.round(r.width + ${pad} * 2), height: Math.round(r.height + ${pad} * 2) }; })()`);
  const shotOf = async (name, sel, pad) => { const r = await box(sel, pad); if (r) await c.shot(name, r); else c.log("NO", sel); };
  await c.sleep(SPLASH_MS);
  // finance: Money flow scrolled into view a little at a time
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  await c.js(`(() => { const e = document.querySelectorAll('.flow-card')[0]; scrollTo({ top: e.getBoundingClientRect().bottom + scrollY - innerHeight + 40, behavior: 'instant' }); })()`); await c.sleep(1200);
  for (const n of [1, 2, 3]) { await c.js(`scrollBy({ top: 90, behavior: 'instant' })`); await c.sleep(700); await c.shot(`flow-scroll-${n}`); }
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'end', behavior: 'instant' })`); await c.sleep(1500);
  await shotOf("foot-finance", ".foot-logo", 0);
  await c.press('button[aria-label="Settings"]'); await c.sleep(1000);
  await shotOf("set-finance", ".set-modal");
  await c.press(".set-modal .wr-seg button:last-of-type"); await c.sleep(170); await shotOf("set-finance-mid", ".set-modal .wr-seg", 6);
  await c.sleep(600); await shotOf("set-finance-myr", ".set-modal .wr-seg", 6);
  await c.press(".set-modal .wr-seg button:first-of-type"); await c.sleep(800);
  c.key("Escape"); await c.sleep(800);
  await c.press(".foot-logo"); await c.sleep(5000);
  // crypto: the hero, then a day's journal
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(6000);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  await shotOf("crypto-tiles", ".hero-tiles");
  await c.press(".cell", 9); await c.sleep(1800);
  await c.js(`document.querySelector('.jr-res').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(800);
  await shotOf("res-win", ".jr-res", 8);
  await c.press(".jr-res button", 2); await c.sleep(160); await shotOf("res-mid", ".jr-res", 8);
  await c.sleep(700); await shotOf("res-loss", ".jr-res", 8);
  await c.press(".jr-res button", 1); await c.sleep(800); await shotOf("res-be", ".jr-res", 8);
  await c.press(".jr-res button", 0); await c.sleep(800); await shotOf("res-win-again", ".jr-res", 8);
  await shotOf("crypto-sheet", ".jr-sheet", 8);
};

// Stills of the second 22 October 2026 batch (`fixes --profile=look --shots`): the weekly chart's round scale, the Left
// over pop-up when more went into the goals than was left, the debts' bars in their side's colour, and the stock and
// forex journal forms (their two columns even).
const fixes = async (c) => {
  const box = (sel, pad = 10) => c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left - ${pad})), y: Math.max(0, Math.round(r.top - ${pad})), width: Math.round(r.width + ${pad} * 2), height: Math.round(Math.min(innerHeight - Math.max(0, r.top - ${pad}), r.height + ${pad} * 2)) }; })()`);
  const view = async (sel, block = "start") => { await c.js(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: ${JSON.stringify(block)}, behavior: 'instant' })`); await c.sleep(2200); };
  await c.sleep(SPLASH_MS);
  await c.shot("start");
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  await view(".flow-card"); await c.shot("weekly", await box(".flow-card"));
  c.log("TICKS", await c.js(`[...document.querySelectorAll('.wk-tick')].map((t) => t.textContent + (getComputedStyle(t).opacity === "0" ? " (faded)" : "")).join(" | ")`));
  await view(".debt-sec", "center"); await c.shot("debts", await box(".debt-sec"));
  const left = `[...document.querySelectorAll('.flow-label')].find((e) => e.textContent.includes('Left over'))`;
  await c.js(`(() => { const e = ${left}; if (e) e.scrollIntoView({ block: 'center', behavior: 'instant' }); })()`); await c.sleep(2400);
  await c.js(`(() => { const e = ${left}; if (e) e.click(); })()`); await c.sleep(1500);
  c.log("LEFT", await c.js(`[...document.querySelectorAll('.bd-item')].map((e) => e.innerText.replace(/\\s+/g, " ")).join(" / ")`));
  await c.shot("left");
  c.key("Escape"); await c.sleep(800);
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500);
  await c.press(".foot-logo"); await c.sleep(5000);
  for (const [side, sel] of [["idx", ".idx-unit"], ["fx", ".coin-unit.fx"]]) {
    await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
    await c.press(".idx-unit"); await c.sleep(1100); if (side === "fx") { await c.press(".coin-unit.fx"); await c.sleep(1100); }
    await c.press(sel); await c.sleep(6000);
    await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
    await c.press(".cell", 9); await c.sleep(1800);
    await view(".jr-sheet"); await c.shot(`${side}-form`, await box(".jr-sheet"));
    c.log("COLS", side, await c.js(`[...document.querySelector('.jr-sheet .jr-cols').children].map((e) => Math.round(e.getBoundingClientRect().height)).join(" / ")`));
    await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500);
    await c.press(".foot-logo"); await c.sleep(5000);
  }
};


// Health (23 October 2026; run with --shots --fresh): the rings on the selections panel (tucked beside the coin, in the
// middle, under the pointer, on their way in), the page empty, then with test data a still of every part of it, and
// presses on its pieces with what was saved after each: a to-do ticked and one added, a class added on an empty hour, a
// day's steps typed, a goal of 75 kg in 3 months, a gym session, a note on the board dragged, a day stepped. No file box
// is opened (a hidden run must never open one)
const health = async (c) => {
  const box = (sel, pad = 10) => c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.left - ${pad})), y: Math.max(0, Math.round(r.top - ${pad})), width: Math.round(Math.min(innerWidth, r.width + ${pad} * 2)), height: Math.round(Math.min(innerHeight - Math.max(0, r.top - ${pad}), r.height + ${pad} * 2)) }; })()`);
  const view = async (sel, block = "start", wait = 2200) => { await c.js(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: ${JSON.stringify(block)}, behavior: 'instant' })`); await c.sleep(wait); };
  const shot = async (name, sel) => { if (c.shots) await c.shot(name, sel ? (await box(sel)) || undefined : undefined); };
  const set = (sel, text) => c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const blur = (sel) => c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.blur(); return !!el; })()`);
  const tapText = (sel, text) => c.js(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.textContent.includes(${JSON.stringify(text)})); if (!e) return false; e.click(); return true; })()`);
  const saved = (what) => c.js(`(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('flow-health')); const v = k ? JSON.parse(localStorage.getItem(k)) : null; if (!v) return 'nothing saved';
    return JSON.stringify(${what}); })()`);
  const errs = () => c.js(`(window.__perf && window.__perf.errors || []).join(' | ') || 'no page errors'`);
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  await c.sleep(SPLASH_MS);
  const fresh = await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (fresh) { await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000); }
  await shot("h-pick");
  await c.press(".coin-unit"); await c.sleep(1300); await shot("h-pick-coin");
  await c.press(".ring-unit"); await c.sleep(1400); await shot("h-pick-rings");
  c.log("RINGS", await c.js(`JSON.stringify({ wrap: document.querySelector('.launch-wrap').className, rings: document.querySelector('.ring-unit').className, coin: document.querySelector('.coin-unit:not(.fx)').className })`));
  const r = await c.js(`(() => { const r = document.querySelector('.ring-unit').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
  for (let i = 0; i <= 12; i++) { c.move(r.l + r.w * (0.5 + 0.32 * i / 12), r.t + r.h * (0.5 - 0.3 * i / 12)); await c.sleep(16); }
  await c.sleep(1100); await shot("h-rings-hover");
  await c.click(r.l + r.w * 0.82, r.t + r.h * 0.2); await c.sleep(420); await shot("h-rings-go");
  await c.sleep(3200); await shot("h-empty");
  c.log("IN", await c.js(`JSON.stringify({ page: !!document.querySelector('.hl-page'), cards: [...document.querySelectorAll('.hlt .flow-card')].map((e) => e.dataset.card) })`));
  await view(".foot-logo", "end", 600);
  await c.js(`document.querySelector('button[aria-label="Add test data"]').click()`); await c.sleep(1800);
  c.log("TEST", await saved(`{ todos: v.todos.length, classes: v.classes.length, gym: v.gym.length, board: v.board.length, steps: Object.keys(v.steps).length, weights: Object.keys(v.weights).length, goal: v.goal, profile: v.profile }`));
  await c.js(`scrollTo({ top: 0, behavior: 'instant' })`); await c.sleep(2400); await shot("h-top");
  for (const [name, card] of [["todo", "to-do"], ["week", "week"], ["activity", "activity"], ["body", "body"], ["diet", "diet"], ["gym", "gym"], ["board", "vision board"]]) {
    await view(`[data-card="${card}"]`); await shot(`h-${name}`, `[data-card="${card}"]`);
  }
  // a to-do ticked, and one added for a week
  await view('[data-card="to-do"]', "start", 1200);
  await c.js(`document.querySelector('.hl-todo .hl-check').click()`); await c.sleep(700);
  await set(".hl-add-t", "Buy groceries"); await tapText(".hl-rep button", "Every day"); await c.sleep(300);
  await set(".hl-len .jr-in", "7"); await c.js(`document.querySelector('.hl-plus').click()`); await c.sleep(900);
  c.log("TODO", await saved(`v.todos.filter((t) => !t.test || Object.keys(t.done).length).slice(-2).map((t) => t.text + ' ' + t.rep + ' ' + t.len + ' done:' + Object.keys(t.done).length)`));
  c.log("TODO ROWS", await c.js(`[...document.querySelectorAll('.hl-todo')].map((e) => (e.classList.contains('done') ? '[x] ' : '[ ] ') + e.innerText.replace(/\\s+/g, ' ')).join(' / ')`));
  await shot("h-todo-after", '[data-card="to-do"]');
  // a class on an empty hour: Saturday at ten
  await view('[data-card="week"]', "start", 1200);
  const sat = await c.js(`(() => { const d = document.querySelectorAll('.hl-tt-day')[5].getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + 46 * 2.5 }; })()`);
  await c.click(sat.x, sat.y); await c.sleep(600);
  await set(".hl-form > .jr-in", "Org meeting"); await c.sleep(200); await shot("h-week-form", '[data-card="week"]');
  await c.js(`document.querySelector('.hl-form .hl-save').click()`); await c.sleep(900);
  c.log("CLASS", await saved(`v.classes.filter((x) => !x.test).map((x) => x.name + ' ' + x.dow + ' ' + x.from + '-' + x.to)`));
  // a day's steps, typed
  await view('[data-card="activity"]', "start", 1200);
  await set(".hl-steps-in input", "9500"); await blur(".hl-steps-in input"); await c.sleep(900);
  c.log("STEPS", await saved(`{ today: v.steps[Object.keys(v.steps).sort().pop()], typed: Object.keys(v.typed) }`));
  // the goal: off, then 75 kg in 3 months
  await view('[data-card="diet"]', "start", 1200);
  await tapText('[data-card="diet"] .bk-btn', "Change goal"); await c.sleep(700);
  await set('.hl-goal-form input[aria-label="Target weight"]', "75"); await c.sleep(300);
  c.log("GOAL FORM", await c.js(`document.querySelector('.hl-goal-form')?.innerText.replace(/\\s+/g, ' ')`));
  await c.js(`document.querySelector('.hl-goal-form .hl-save').click()`); await c.sleep(1400);
  c.log("GOAL", await saved(`v.goal`), "//", await c.js(`[...document.querySelectorAll('[data-card="diet"] .hl-tile')].map((e) => e.innerText.replace(/\\s+/g, ' ')).join(' | ') + ' // ' + (document.querySelector('.hl-warn')?.innerText.replace(/\\s+/g, ' ') || 'no warning')`));
  await shot("h-diet-goal", '[data-card="diet"]');
  // a gym session
  await view('[data-card="gym"]', "start", 1200);
  await tapText('[data-card="gym"] .hl-save', "Log a session"); await c.sleep(600);
  await set(".hl-ex-head .jr-in", "Bench press");
  await c.js(`(() => { const ins = document.querySelectorAll('.hl-set .pc-in'); const put = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    put(ins[0], '80'); put(ins[1], '5'); put(ins[2], '80'); put(ins[3], '5'); return true; })()`); await c.sleep(300);
  await shot("h-gym-sheet", '[data-card="gym"]');
  await c.js(`[...document.querySelectorAll('.hl-sheet .hl-save')].pop().click()`); await c.sleep(900);
  c.log("GYM", await saved(`v.gym.filter((x) => !x.test).map((s) => s.name + ' ' + s.min + 'min ' + s.ex.map((e) => e.name + ' ' + e.sets.map((x) => x.kg + 'x' + x.reps).join(',')).join(';'))`));
  // the board: a note dragged 160px right and 90 down
  await view('[data-card="vision board"]', "start", 1200);
  const g = await c.js(`(() => { const r = document.querySelector('.hl-bi .hl-bi-grip').getBoundingClientRect(); return { x: r.left + 30, y: r.top + 8 }; })()`);
  const send = (type, p, more) => c.wc.sendInputEvent({ type, x: Math.round(p.x), y: Math.round(p.y), ...more });
  send("mouseMove", g); await c.sleep(60); send("mouseDown", g, { button: "left", clickCount: 1 }); await c.sleep(60);
  for (let i = 1; i <= 16; i++) { send("mouseMove", { x: g.x + 10 * i, y: g.y + 5.6 * i }, { modifiers: ["leftButtonDown"] }); await c.sleep(16); }
  send("mouseUp", { x: g.x + 160, y: g.y + 90 }, { button: "left", clickCount: 1 }); await c.sleep(700);
  c.log("BOARD", await saved(`v.board.slice(0, 2).map((b) => b.text + ' @' + b.x + ',' + b.y + ' z' + b.z)`));
  await shot("h-board-after", '[data-card="vision board"]');
  // a day back, by the arrow
  await c.js(`scrollTo({ top: 0, behavior: 'instant' })`); await c.sleep(600);
  await c.press(".hl-page .nav-arrow", 0); await c.sleep(1800); await shot("h-yesterday");
  // the sidebar: its rows, and one of them pressed
  await c.press(".snav-burger"); await c.sleep(1200); await shot("h-sidebar");
  c.log("SIDEBAR", await c.js(`[...document.querySelectorAll('.snav .sd-t')].map((e) => e.textContent).join(' / ')`));
  await tapText(".snav button", "Gym"); await c.sleep(1600);
  c.log("GYM ROW", await c.js(`Math.round(document.querySelector('[data-card="gym"]').getBoundingClientRect().top)`));
  // ⌘N: the box of a new to-do
  c.wc.sendInputEvent({ type: "keyDown", keyCode: "N", modifiers: ["control"] }); c.wc.sendInputEvent({ type: "keyUp", keyCode: "N", modifiers: ["control"] }); await c.sleep(900);
  c.log("CMD N", await c.js(`document.activeElement && document.activeElement.className`));
  c.log("ERRORS", await errs());
};

// Health's backup (run with --fresh): Export with nothing of his own (and with test data only), then with a to-do of his
// own, the file's name and what is in it; that file handed to Health's Import (empty after Clear test data and the to-do
// removed: it must come back), then to the finance side's Import (it must go to Health), and a finance file to Health's.
// The download is caught before a file is made (a real one would bring a save box up on his screen)
const hbackup = async (c) => {
  const say = () => c.js(`[...document.querySelectorAll('.bk-msg')].map((e) => e.textContent).join(' | ') || '(no message)'`);
  const held = () => c.js(`(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('flow-health')); const v = k ? JSON.parse(localStorage.getItem(k)) : null;
    return v ? JSON.stringify({ todos: v.todos.map((t) => t.text + (t.test ? '*' : '')), steps: Object.keys(v.steps).length, classes: v.classes.length }) : 'nothing'; })()`);
  const give = (json, name) => c.js(`(() => { const input = document.querySelector('input[type=file][accept="application/json,.json"]'); const dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(json)}], ${JSON.stringify(name)}, { type: 'application/json' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const exportNow = async () => {
    await c.js(`window.__saved = null; if (!window.__mkUrl) { window.__mkUrl = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blob = b; return window.__mkUrl(b); }; }
      HTMLAnchorElement.prototype.click = function () { const a = this; window.__blob.text().then((t) => { window.__saved = { name: a.download, text: t }; }); }; 0`);
    await c.js(`document.querySelector('button[aria-label="Export"]').click()`); await c.sleep(900);
    return c.js(`window.__saved`);
  };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".coin-unit"); await c.sleep(1100); await c.press(".ring-unit"); await c.sleep(1300); await c.press(".ring-unit"); await c.sleep(3600);
  c.log("EMPTY", JSON.stringify(await exportNow()), await say()); await c.sleep(3800);
  await c.js(`document.querySelector('button[aria-label="Add test data"]').click()`); await c.sleep(1200);
  c.log("TEST ONLY", JSON.stringify(await exportNow()), await say()); await c.sleep(3800);
  await c.js(`(() => { const el = document.querySelector('.hl-add-t'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Pack the gym bag'); el.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.hl-plus').click(); return true; })()`);
  await c.sleep(900);
  const file = await exportNow();
  const data = file && JSON.parse(file.text);
  c.log("EXPORT", file && file.name, data && JSON.stringify({ app: data.app, todos: data.health.todos.map((t) => t.text), steps: Object.keys(data.health.steps).length, classes: data.health.classes.length, goal: data.health.goal, profile: data.health.profile.kg, tests: data.health.tests }));
  await c.sleep(3800);
  await c.js(`document.querySelector('button[aria-label="Clear test data"]').click()`); await c.sleep(900);
  await c.js(`[...document.querySelectorAll('.hl-todo')].find((e) => e.textContent.includes('Pack the gym bag')).querySelector('.hl-x').click()`); await c.sleep(900);
  c.log("CLEARED", await held());
  await give(file.text, file.name); await c.sleep(1200);
  c.log("IMPORTED HERE", await held(), "//", await say());
  // home, into finance, and the same file handed to its Import
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500);
  await c.press(".foot-logo"); await c.sleep(5000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('flow-health')); const v = JSON.parse(localStorage.getItem(k)); v.todos = []; localStorage.setItem(k, JSON.stringify(v)); return true; })()`);
  await give(file.text, file.name); await c.sleep(1400);
  c.log("FROM FINANCE", await held(), "//", await say());
  const fin = JSON.stringify({ spending: { "2026-10-20": [{ id: "e1", amount: 25000, desc: "kopi" }] }, incomes: {}, limits: {}, currency: "IDR", goals: [], debts: [] });
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500);
  await c.press(".foot-logo"); await c.sleep(5000);
  await c.press(".coin-unit"); await c.sleep(1100); await c.press(".ring-unit"); await c.sleep(1300); await c.press(".ring-unit"); await c.sleep(3600);
  await give(fin, "flow-pnl-export.json"); await c.sleep(1400);
  c.log("FINANCE FILE", await c.js(`(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('pnl-calendar-idr')); return k ? JSON.stringify(JSON.parse(localStorage.getItem(k)).spending) : 'nothing'; })()`), "//", await say());
};

module.exports = { hbackup, health, fixes, polish, press, sweep, look, launch, stage, intro, reset, finance, cards, pull, flow, term, idxj, hero, nospend, foot, keys, backup, dragmove, plans, pick, scoreinfo, trade: trading(false), stocks: trading(true), fx: trading("fx"), seedprep, dump, corners, firsts, rested, parts, imbox, items, bill, testlv, tiles, pxink, score81, fxdie,
  "year-finance": yearpops("finance"), "year-crypto": yearpops("crypto"), "year-idx": yearpops("idx"), "year-fx": yearpops("fx") };
