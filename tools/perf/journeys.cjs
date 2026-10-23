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
// 54.863 and 60.637). Then his share is named, given a category and added to that day
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

// The page's backdrop behind the calendar (stills and figures; run with --shots): the whole window with the calendar in
// its middle, on finance and on crypto. Read from each still: where the calendar stands on the page, the backdrop's own
// colour in the gutters beside each row of days, and how light the glass of the empty tiles is, with what that leaves
// of the date's grey (#8a9299) against it. Run it before and after a change to PAGE_BG and compare the two logs
const backdrop = async (c) => {
  const fs = require("node:fs"), path = require("node:path");
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const look = async (name) => {
    await c.js(`document.querySelector('.cal-wrap').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(1800);
    const info = await c.js(`(() => { const w = document.querySelector('.cal-wrap').getBoundingClientRect(); return { top: Math.round(w.top + scrollY), bottom: Math.round(w.bottom + scrollY), page: document.documentElement.scrollHeight, win: [innerWidth, innerHeight],
      tiles: [...document.querySelectorAll('.cal-wrap .cell')].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width * 0.72), Math.round(r.top + r.height * 0.3), Math.round(r.top + r.height / 2), e.querySelector('.cbar') || e.classList.contains('today') ? 1 : 0]; }) }; })()`);
    const img = await c.wc.capturePage(); fs.writeFileSync(path.join(c.OUT, name + ".png"), img.toPNG());
    const W = img.getSize().width, k = W / info.win[0], px = img.toBitmap();
    const at = (x, y) => { let r = 0, g = 0, b = 0, n = 0; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const o = ((Math.round(y * k) + dy) * W + Math.round(x * k) + dx) * 4; b += px[o]; g += px[o + 1]; r += px[o + 2]; n++; } return [r / n, g / n, b / n]; };
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b), hex = (p) => "#" + p.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const rows = [...new Set(info.tiles.map((t) => t[2]))];
    const empty = info.tiles.filter((t) => !t[3]).map((t) => L(at(t[0], t[1])));
    const lightest = Math.max(...empty), darkest = Math.min(...empty), grey = L([0x8a, 0x92, 0x99]);
    c.log(name.toUpperCase(), JSON.stringify({ calendar: `${info.top} to ${info.bottom} of ${info.page}`, window: info.win.join("x"),
      gutters: rows.map((y) => `${hex(at(26, y))} ${hex(at(info.win[0] - 26, y))}`),
      emptyTiles: empty.length, tileLight: [darkest, lightest].map((v) => v.toFixed(4)).join(" to "), dateGreyAgainstLightest: ((grey + 0.05) / (lightest + 0.05)).toFixed(2), againstDarkest: ((grey + 0.05) / (darkest + 0.05)).toFixed(2) }));
  };
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  await look("finance");
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(700);
  await c.press(".foot-logo"); await c.sleep(4800);
  for (const w of [1000, 1600, 6200]) { await c.press(".coin-unit"); await c.sleep(w); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await look("trading");
};

// The yearly panel (stills and what the page says; run with --shots): each month box's words on finance, whether any
// are cut off, how high each month's line peaks on the year's one scale (0 the floor, 1 the top), the months still to
// come, the note under the pointer on this month's box and the quick-add hint's colour; then the same panel on crypto
const year = async (c) => {
  const boxes = () => c.js(`JSON.stringify([...document.querySelectorAll('.year-block.active .ycell')].map((e) => { const p = e.querySelector('.spark path'), ys = p ? p.getAttribute('d').split(/[ML]/).filter(Boolean).map((q) => +q.trim().split(' ')[1]) : null;
    return e.innerText.replace(/\\n+/g, ' | ') + (e.classList.contains('later') ? ' (later)' : '') + ([...e.querySelectorAll('span')].some((x) => x.scrollWidth > x.clientWidth + 1) ? ' CUT' : '') + (ys ? ' peak ' + ((27 - Math.min(...ys)) / 23).toFixed(2) : ''); }))`);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(7000);
  c.log("FINANCE", await boxes());
  // the header: how high the year's digits and the big figure stand and where their feet are, the pixel digits' size, and the sparkle beside the year
  c.log("HEADER", await c.js(`(() => { const y = document.querySelector('.year-big'), px = y.querySelector('.yb-px'), f = document.querySelector('.poster-num'), w = y.querySelector('.yb-wr'), a = px.getBoundingClientRect(), b = f.getBoundingClientRect(), n = y.querySelector('.yb-n');
    return JSON.stringify({ year: getComputedStyle(y).fontSize, digitBox: Math.round(a.width) + 'x' + Math.round(a.height), yearFoot: Math.round(a.bottom), figure: getComputedStyle(f).fontSize, figureBox: Math.round(b.top) + ' to ' + Math.round(b.bottom), sparkle: w ? getComputedStyle(w).fontSize + ' ' + getComputedStyle(w).color : 'none', twin: n ? getComputedStyle(n).fontSize + ' wide ' + getComputedStyle(n).width + ' top ' + getComputedStyle(n).top : 'not mounted now' }); })()`));
  c.log("HINT", await c.js(`(() => { const h = document.querySelector('.qadd-ph'), q = document.querySelector('.qadd'); return h ? getComputedStyle(h).color + ' at ' + getComputedStyle(q).opacity : 'no hint'; })()`));
  await c.shot("year");
  const n = await monthBox(c);
  const r = await c.js(`(() => { const r = document.querySelectorAll('.ycell')[${n}].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
  c.move(r.x, r.y); await c.sleep(700);
  c.log("NOTE", await c.js(`(() => { const t = document.querySelectorAll('.ycell')[${n}].querySelector('.cell-tip'); if (!t) return 'no note'; const b = t.getBoundingClientRect(), v = document.querySelector('.year-viewport').getBoundingClientRect(); return JSON.stringify({ says: t.innerText.replace(/\\n+/g, ' | '), shown: getComputedStyle(t).opacity, insideTheStack: b.top >= v.top && b.bottom <= v.bottom, blur: getComputedStyle(t).backdropFilter }); })()`));
  await c.shot("year-note", { x: Math.max(0, Math.round(r.l - 60)), y: Math.max(0, Math.round(r.t - 110)), width: Math.round(r.w + 120), height: Math.round(r.h + 150) });
  c.move(700, 40); await c.sleep(400);
  await c.press(".foot-logo"); await c.sleep(4800);
  for (const w of [1000, 1600, 6600]) { await c.press(".coin-unit"); await c.sleep(w); }
  c.log("CRYPTO", await boxes());
  await c.shot("year-crypto");
};

// The headers of the sections inside cards and the projection's figures (stills and what the page says; run with
// --shots): every header's symbol, name and type (they are one kind: SecHead in App.jsx), and that the figures under the
// projection's chart have no frame of their own
const heads = async (c) => {
  const shot = async (sel, name, wait = 2400) => {
    await c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'center', behavior: 'instant' }); })()`); await c.sleep(wait);
    const r = await c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`);
    if (r) await c.shot(name, r); else c.log("NOT THERE", sel);
  };
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await shot(".wp", "planned"); await shot(".proj-box", "projection", 3400); await shot(".ins-box", "insights");
  await shot('[data-card="goals"]', "goals"); await shot(".debt-sec", "debts");
  c.log("HEADS", await c.js(`JSON.stringify([...document.querySelectorAll('.sec-head')].map((h) => { const t = getComputedStyle(h.querySelector('.sec-t')), i = getComputedStyle(h.querySelector('.msym')); return [h.innerText.replace(/\\n+/g, ' | '), t.fontSize, t.fontWeight, t.color, t.letterSpacing, 'symbol ' + i.fontSize, i.color].join(' ; '); }))`));
  c.log("FIGURES", await c.js(`JSON.stringify([...document.querySelectorAll('.proj-tiles > *')].map((e) => { const s = getComputedStyle(e); return [e.innerText.replace(/\\n+/g, ' | '), 'border ' + s.borderTopWidth, 'fill ' + s.backgroundColor + ' ' + s.backgroundImage.slice(0, 12), 'shadow ' + s.boxShadow.slice(0, 12)].join(' ; '); }))`));
};

// The projection's headline and the insights (stills and what the page says; run with --shots): what the headline reads,
// its colour, the chart's end label with its colour, and the insights that speak of the daily limits for the month
const proj = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.js(`document.querySelector('.proj-box').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(3200);
  c.log("HEAD", await c.js(`(() => { const m = document.querySelector('.proj-main'), e = document.querySelector('.pj-end text'), n = [...m.querySelectorAll('.proj-num')];
    return JSON.stringify({ reads: m.innerText.replace(/\\n+/g, ' | '), figures: n.map((x) => getComputedStyle(x).color), end: e ? e.textContent + ' ' + e.getAttribute('fill') : null,
      record: (document.querySelector('.proj-rec') || {}).innerText }); })()`));
  await c.shot("projection", await c.js(`(() => { const r = document.querySelector('.proj-box').getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`));
  await c.js(`document.querySelector('.ins-box').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(2200);
  await c.js(`document.querySelector('.ins-more')?.click()`); await c.sleep(1000);
  c.log("INSIGHTS", await c.js(`JSON.stringify(document.querySelector('.ins-box').innerText.split(/\\n+/).filter((t) => /limits for the month|budget/i.test(t)))`));
};

// The way into the quick log on the finance month (stills and what the page says; run with --shots): the capsule in the
// strip under the title, where it and its neighbours stand, and that a press opens the quick log and Esc shuts it
const logpill = async (c) => {
  const box = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(" "); })()`;
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  c.log("PILL", await c.js(`JSON.stringify({ text: (document.querySelector(".log-pill") || {}).innerText, pill: ${box(".log-pill")}, income: ${box(".amt-field.green")}, limit: ${box(".limit-input")}, currency: ${box(".cur-btn")}, hero: ${box(".hero")} })`));
  await c.shot("strip", await c.js(`(() => { const a = document.querySelector(".month-view").getBoundingClientRect(), h = document.querySelector(".hero").getBoundingClientRect(); return { x: Math.max(0, Math.round(a.left) - 24), y: Math.max(0, Math.round(a.top) - 8), width: Math.round(a.width) + 48, height: Math.round(h.top - a.top) + 120 }; })()`));
  await c.press(".log-pill"); await c.sleep(1000);
  c.log("PRESSED", await c.js(`JSON.stringify({ quickLog: !!document.querySelector(".ql"), cursorIn: document.activeElement ? document.activeElement.className : null })`));
  await c.shot("open");
  c.key("Escape"); await c.sleep(800);
  c.log("ESC", await c.js(`JSON.stringify({ quickLog: !!document.querySelector(".ql") })`));
};

// The Weekly expenses card in the week of today (a still and what the page says; run with --shots): the header's line,
// the axis text with the size it comes out at on screen (it is written in the drawing's units: see WeekBox in App.jsx)
// and the steps of the scale
const week = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.js(`document.querySelectorAll('.flow-card')[0].scrollIntoView({ block: 'center' })`); await c.sleep(2600);
  c.log("WEEK", await c.js(`(() => { const card = document.querySelectorAll('.flow-card')[0], svg = card.querySelector('svg[viewBox="0 0 720 250"]'); if (!svg) return 'no chart';
    const w = svg.getBoundingClientRect().width, k = w / 720;
    const ax = [...svg.querySelectorAll('.wk-ax')].map((t) => t.textContent + ' ' + (parseFloat(getComputedStyle(t).fontSize) * k).toFixed(1) + 'px');
    return JSON.stringify({ head: card.innerText.split(/\\n+/).slice(0, 3).join(' | '), wk: svg.parentElement.style.getPropertyValue('--wk'), width: Math.round(w), ax }); })()`));
  const r = await c.js(`(() => { const r = document.querySelectorAll('.flow-card')[0].getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()`);
  await c.shot("week", r);
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
  // the big figure's comma or decimal point (pxSeps in App.jsx): its face, its edges, and how far it is pulled in on each side
  const seps = () => c.js(`[...document.querySelectorAll(".hero-num .pxs")].map((e) => { const s = getComputedStyle(e); return [JSON.stringify(e.textContent), s.fontFamily.split(",")[0], s.webkitFontSmoothing, s.marginLeft, s.marginRight].join(" "); }).join(" ; ") || "none"`);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3600);
  c.log("FINANCE", await face(".hero-num"), "//", await face(".hero-tile .ht-val"), "// sep:", await seps());
  await c.shot("hero-finance", (await box(".hero")) || undefined);
  await c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true }))`); await c.sleep(900);
  c.log("OFTEN", await c.js(`(() => { const e = document.querySelector(".ql-often"); return e ? e.innerText.replace(/\\s+/g, " ") : null; })()`));
  await c.shot("often", (await box(".ql-often")) || undefined);
  c.key("Escape"); await c.sleep(600);
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(700);
  await c.press(".foot-logo"); await c.sleep(4800);
  for (const w of [1000, 1600, 6200]) { await c.press(".coin-unit"); await c.sleep(w); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  c.log("TRADING", await face(".hero-num"), "//", await face(".hero-tile .ht-val"), "// sep:", await seps());
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
  const out = await c.js(`(() => { const r = document.querySelector('.wp .sec-head').getBoundingClientRect(); return { x: r.left + 200, y: r.top + r.height / 2 }; })()`);
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

// The whole finance side as stills, and what the page's own figures say about its text (run with --shots and a profile
// of its own: --profile=polish, with --fresh the first time for the login and test data; never his entries). Year,
// month, calendar, a day, the three cards and their parts, the footer, every pop-up, the sidebar. The log lists per
// screen the text that is faint or small (against a card's fill, near enough), what is cut off, and the buttons that
// have no name or are small to press.
const AUDIT = String.raw`(() => {
  const host = document.querySelector('.warm-host');
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[,\s\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const BG = [30, 33, 38], seen = {}, clip = {}, bare = {}, tiny = {};
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || (host && host.contains(el)) || el.closest('style, script, defs')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let op = 1; for (let e = el; e && e !== document.body; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op < 0.05) continue;
    const c = rgb(el instanceof SVGElement ? cs.fill : cs.color); if (!c) continue;
    const a = c[3] * op, mix = [0, 1, 2].map((i) => c[i] * a + BG[i] * (1 - a));
    const l1 = lum(mix), l2 = lum(BG), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), size = parseFloat(cs.fontSize);
    const key = [name(el), size + 'px', cs.fontWeight, ratio.toFixed(1)].join(' ');
    (seen[key] = seen[key] || { n: 0, t: t.slice(0, 26), ratio, size }).n++;
    if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX)) clip[name(el)] = t.slice(0, 40);
  }
  for (const b of document.querySelectorAll('button, [role="button"]')) {
    if (host && host.contains(b)) continue;
    const r = b.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || getComputedStyle(b).visibility === 'hidden') continue;
    const own = [...b.childNodes].filter((x) => !(x.nodeType === 1 && x.classList.contains('msym'))).map((x) => x.textContent).join('').trim();
    if (!b.getAttribute('aria-label') && !b.title && !own) bare[name(b)] = (bare[name(b)] || 0) + 1;
    if (r.width < 24 || r.height < 24) tiny[name(b) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)] = (tiny[name(b) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)] || 0) + 1;
  }
  const rows = Object.entries(seen), line = ([k, v]) => k + ' x' + v.n + ' "' + v.t + '"';
  return JSON.stringify({
    faint: rows.filter(([, v]) => v.ratio < (v.size >= 18 ? 3 : 4.5)).sort((a, b) => b[1].n - a[1].n).slice(0, 45).map(line),
    small: rows.filter(([, v]) => v.size < 11).sort((a, b) => a[1].size - b[1].size).slice(0, 30).map(line),
    cut: clip, noName: bare, smallToPress: tiny,
  }, null, 1);
})()`;
const look = async (c) => {
  const go = async (sel, wait = 1600, block = "center") => { await c.js(`(() => { const e = ${sel}; if (e) e.scrollIntoView({ block: '${block}', behavior: 'instant' }); })(); 0`); await c.sleep(wait); };
  const mid = (sel) => c.js(`(() => { const e = ${sel}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const audit = async (name) => c.log("AUDIT", name, await c.js(AUDIT));
  const esc = async (wait = 850) => { c.key("Escape"); await c.sleep(wait); };
  await c.sleep(SPLASH_MS);
  const fresh = await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (fresh) { await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000); }
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  // finance opens on Home since 20 October 2026: test data pressed in the page (its button is below the window there), a
  // still of Home, then the yearly panel by Home's Calendar button
  if (fresh && (await c.js(`!!document.querySelector('.dash')`))) { c.move(700, 20); await c.sleep(600); await c.shot("00-home-empty"); }      // what somebody new sees first
  if (fresh) { await c.js(`(() => { const b = document.querySelector('button[aria-label="Add test data"]'); if (b) b.click(); })()`); await c.sleep(3200); }
  c.move(700, 20); await c.sleep(500);
  if (await c.js(`!!document.querySelector('.dash')`)) {
    await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(1200); await c.shot("00-home"); await audit("home");
    await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2600);
  }
  await c.shot("01-year"); await audit("year");
  let p = await mid(`document.querySelectorAll('.ycell')[${await monthBox(c)}]`);
  if (p) { c.move(p.x, p.y); await c.sleep(800); await c.shot("02-year-hover", { x: Math.max(0, Math.round(p.x - 330)), y: Math.max(0, Math.round(p.y - 190)), width: 660, height: 380 }); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  c.move(700, 20); await c.sleep(400);
  await c.shot("03-month-top");
  // the window's own scroll bar must take no room; a press beside a small symbol must still be the symbol's
  c.log("CHECKS", await c.js(`(() => { const hit = (sel, dx, dy) => { const e = document.querySelector(sel); if (!e) return sel + ' missing'; const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.left + dx, r.top + r.height / 2 + dy);
      return sel + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' pressed ' + Math.abs(dx) + 'px beside: ' + (at === e || e.contains(at) ? 'its own' : 'somebody else'); };
    return JSON.stringify({ lane: innerWidth - document.documentElement.clientWidth, scrolls: document.documentElement.scrollHeight > innerHeight, bodyText: getComputedStyle(document.body).color,
      hits: [hit('.month-nav .nav-arrow', -4, 0), hit('.chip-x', -4, 0), hit('.plain-arrow.chev', -4, 0)] }); })()`));
  if (process.argv.includes("--top")) return;
  // a button reached with Tab (a hidden page is never in use unless told so)
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  for (let i = 0; i < 3; i++) { c.wc.sendInputEvent({ type: "keyDown", keyCode: "Tab" }); c.wc.sendInputEvent({ type: "keyUp", keyCode: "Tab" }); await c.sleep(250); }
  c.log("FOCUS", await c.js(`(() => { const e = document.activeElement, s = getComputedStyle(e); return [e.tagName, e.className, e.matches(':focus-visible'), s.outlineStyle, s.outlineWidth, s.outlineColor].join(' | '); })()`));
  await c.shot("03b-focus", { x: 0, y: 0, width: 1440, height: 160 });
  await c.js(`document.activeElement.blur(); 0`);
  try { await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: false }); c.wc.debugger.detach(); } catch (e) {}
  c.move(700, 20); await c.sleep(300);
  await go(`document.querySelector('.cal-wrap')`); await c.shot("04-calendar");
  p = await mid(`document.querySelectorAll('.cell')[5]`);
  if (p) { c.move(p.x, p.y); await c.sleep(800); await c.shot("04b-cell-hover", { x: Math.max(0, Math.round(p.x - 300)), y: Math.max(0, Math.round(p.y - 190)), width: 600, height: 340 }); }
  await c.press(".cell", 9); await c.sleep(1800);
  await go(`document.querySelector('.amt-field.red')?.closest('.glass')`); await c.shot("05-day");
  for (const [sel, n, block] of [["document.querySelectorAll('.flow-card')[0]", "06-weekly"], ["document.querySelectorAll('.flow-card')[1]", "07-flow", "start"], ["document.querySelector('.score-row')", "08-score"],
    ["document.querySelector('.proj-box')", "09-projection"], ["document.querySelector('.ins-box')", "10-insights"], ["document.querySelectorAll('.flow-card')[2]", "11-goals", "start"],
    ["document.querySelector('.debt-sec')", "12-debts"], ["document.querySelector('.foot-logo')", "13-foot", "end"]]) { await go(sel, 2600, block || "center"); await c.shot(n); }
  await audit("month");
  c.log("INSIGHT", await c.js(`(document.querySelector('.ins-box')?.innerText || '').split('\\n').filter(Boolean).slice(0, 3).join(' / ')`));
  await go(`document.querySelector('.hero')`, 900);
  p = await mid(`document.querySelector('.limit-input')`);
  if (p) { c.move(p.x, p.y); await c.sleep(600); await c.shot("13b-limit-hover", { x: Math.round(p.x - 260), y: Math.max(0, Math.round(p.y - 50)), width: 360, height: 100 }); c.move(700, 20); await c.sleep(300); }
  await c.press(".chart-btn"); await c.sleep(2700); await c.shot("14-chart"); await esc();
  await c.press(".month-big"); await c.sleep(2900); await c.shot("15-wrapped"); await audit("wrapped"); await esc();
  await go(`document.querySelectorAll('.flow-label')[1]`, 2500);
  await c.js(`document.querySelectorAll('.flow-label')[1]?.click(); 0`); await c.sleep(1500); await c.shot("16-category"); await esc();
  await go(`document.querySelector('.hero')`, 900);
  await c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true })); 0`); await c.sleep(1100); await c.shot("17-quicklog"); await audit("quicklog"); await esc(700);
  await c.press(".snav-burger"); await c.sleep(1300); await c.shot("18-sidebar"); await audit("sidebar");
  await c.js(`[...document.querySelectorAll('.snav button')].find((b) => b.innerText.includes('Split bill'))?.click(); 0`); await c.sleep(1600); await c.shot("19-splitbill"); await esc();
  await go(`document.querySelector('.foot-logo')`, 900, "end");
  await c.js(`[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || ''))?.click(); 0`); await c.sleep(1500); await c.shot("20-settings"); await esc(600);
};

// The 13 October 2026 batch (stills and what the page says; run with --shots --fresh): what a day's logged rows show
// for an expense in Other (the symbol its words name, one picked by hand, the plain one), the picker under Other with
// every symbol's name and drawn width, a symbol picked there; the developer options switched off and on in the
// settings (the footer's and the sidebar's test tools with them); then the split bill: four people, a 400.000 pizza
// three of them had, evenly and by hand (one pays 200.000), a service of 20.000 as an amount and a tax of 10%
// (462.000: 231.000, 115.500, 115.500 and nothing)
const others = async (c) => {
  const seed = { spending: { "2026-10-10": [{ id: "e1", amount: 50000, desc: "potong rambut" }, { id: "e2", amount: 80000, desc: "obat flu", cat: "other" }, { id: "e3", amount: 30000, desc: "sesuatu", cat: "other" },
    { id: "e4", amount: 25000, desc: "kopi" }, { id: "e5", amount: 7000, desc: "snack", cat: "other", icon: "cookie" }, { id: "e6", amount: 120000, desc: "futsal sama temen", cat: "other" }] }, incomes: {}, limits: {}, currency: "IDR", goals: [], debts: [] };
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "char", keyCode: ch }); await c.sleep(25); } };
  const into = async (sel, nth, text, enter) => { await c.js("document.querySelectorAll(" + JSON.stringify(sel) + ")[" + nth + "].focus()"); await type(text); if (enter) c.key("Enter"); await c.sleep(250); };
  const box = async (name, el) => {
    await c.sleep(700);
    const r = await c.js("(() => { const e = " + el + "; if (!e) return null; const r = e.getBoundingClientRect(), t = Math.max(0, r.top); return { x: Math.round(r.left), y: Math.round(t), width: Math.round(r.width), height: Math.round(Math.min(innerHeight, r.bottom) - t) }; })()");
    if (r && r.height > 0) await c.shot("others-" + name, r); else c.log("NO BOX", name);
  };
  // the symbol each logged row shows: the reel stands on "none" (the three lines), a category's, or the row's own
  const rows = () => c.js("JSON.stringify([...document.querySelectorAll('.entry-row.exp')].map((r) => { const m = [...r.querySelectorAll('.ham-btn .msym')], s = r.querySelector('.ham-btn > span > span'), at = s ? Math.round(-new DOMMatrix(getComputedStyle(s).transform).m42 / 22) : -1; return r.querySelectorAll(':scope > input')[1].value + ': ' + (at === 0 ? 'none' : m[at - 1] ? m[at - 1].textContent : '?'); }))");
  const tools = () => c.js("JSON.stringify({ footer: [...document.querySelectorAll('.bk-btn.ico')].map((b) => b.getAttribute('aria-label')), side: [...document.querySelectorAll('.snav .sd-t')].map((e) => e.textContent).filter((t) => /reset|restore/i.test(t)), saved: localStorage.getItem('flow-dev'), sw: [...document.querySelectorAll('.set-modal .set-row:last-child .wr-seg button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' ') })");
  const bill = () => c.js("JSON.stringify({ label: document.querySelector('.sb-f span').textContent, rates: [...document.querySelectorAll('.sb-rate')].map((r) => r.querySelector('span').childNodes[0].textContent + ' ' + r.querySelector('button.on').textContent + ' ' + r.querySelector('input').value), names: [...document.querySelectorAll('.sb-row > input')].map((e) => e.value), pays: [...document.querySelectorAll('.sb-pay')].map((e) => e.textContent), tip: document.querySelector('.sb-pay').title, items: [...document.querySelectorAll('.sb-item')].map((it) => [...it.querySelectorAll('.sb-irow input')].map((e) => e.value).join(' ') + ' [' + it.querySelector('.sb-how button.on').textContent + '] who ' + [...it.querySelectorAll('.sb-chip')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' ') + ' hand ' + [...it.querySelectorAll('.sb-hand input')].map((e) => e.value || '(' + e.placeholder + ')').join(' / ') + ' note ' + (it.querySelector('.sb-inote') ? it.querySelector('.sb-inote').className.replace('sb-inote', '').trim() + ' ' + it.querySelector('.sb-inote').textContent : '-')), tiles: [...document.querySelectorAll('.sb-tile')].map((e) => e.innerText.replace(/\\n/g, ' ')), mine: document.querySelector('.sb-exp input').value })");
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(2500);
  await c.js("localStorage.setItem('pnl-calendar-idr', " + JSON.stringify(JSON.stringify(seed)) + "); location.reload(); 0");
  await c.sleep(SPLASH_MS + 1500);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.press('.cell[data-day="10"]'); await c.sleep(1600);
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  await c.js("document.querySelectorAll('.entry-row.exp')[2].scrollIntoView({ block: 'center', behavior: 'instant' }); 0"); await c.sleep(1200);
  c.log("ROWS", await rows());
  await box("rows", "document.querySelector('.entry-row.exp').closest('.glass')");
  // 1. the picker under Other, on "obat flu"
  await c.press(".entry-row.exp .ham-btn", 1); await c.sleep(500);
  await c.press(".cat-opt", 4); await c.sleep(500);
  await c.press(".cat-pop .icon-opt"); await c.sleep(700);
  c.log("PICKER", await c.js("JSON.stringify({ n: document.querySelectorAll('.cat-pop .icon-opt').length, on: [...document.querySelectorAll('.cat-pop .icon-opt.on')].map((b) => b.title + ' ' + b.textContent), wide: [...document.querySelectorAll('.cat-pop .icon-opt')].filter((b) => Math.abs(b.querySelector('.msym').getBoundingClientRect().width - 19) > 1.5).map((b) => b.textContent), names: [...document.querySelectorAll('.cat-pop .icon-opt')].map((b) => b.title).join(', ') })"));
  await box("picker", "document.querySelector('.cat-pop')");
  await c.press('.cat-pop .icon-opt[title="Gym"]'); await c.sleep(1200);
  c.log("PICKED", await rows(), await c.js("JSON.stringify(JSON.parse(localStorage.getItem('pnl-calendar-idr')).spending['2026-10-10'].map((e) => e.desc + ' ' + (e.cat || '-') + ' ' + (e.icon || '-')))"));
  // 2. the developer options, off and on again
  await c.js("[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || '')).click(); 0"); await c.sleep(1200);
  c.log("DEV as it starts", await tools());
  await box("settings", "document.querySelector('.set-modal')");
  await c.js("[...document.querySelectorAll('.set-modal .set-row:last-child .wr-seg button')][1].click(); 0"); await c.sleep(500);
  c.log("DEV off", await tools());
  await box("settings-off", "document.querySelector('.set-modal')");
  c.key("Escape"); await c.sleep(700);
  await c.js("scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); 0"); await c.sleep(600);
  await box("footer-off", "document.querySelector('.bk-btn.ico').parentElement");
  await c.js("location.reload(); 0"); await c.sleep(SPLASH_MS + 1500);
  c.log("DEV off, after a reload", await c.js("JSON.stringify({ saved: localStorage.getItem('flow-dev') })"));
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  c.log("DEV off, in the app again", await tools());
  await c.js("[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || '')).click(); 0"); await c.sleep(1200);
  await c.js("[...document.querySelectorAll('.set-modal .set-row:last-child .wr-seg button')][0].click(); 0"); await c.sleep(500);
  c.log("DEV on again", await tools());
  c.key("Escape"); await c.sleep(700);
  // 3. the split bill
  await c.press('.cell[data-day="10"]'); await c.sleep(1600);
  await c.js("document.querySelectorAll('.split-btn')[1].scrollIntoView({ block: 'center', behavior: 'instant' }); 0"); await c.sleep(900);
  await c.press(".split-btn", 1); await c.sleep(900);
  await c.press(".sb-step button", 1); await c.sleep(300); await c.press(".sb-step button", 1); await c.sleep(400);
  await into(".sb-row > input", 1, "Adi"); await into(".sb-row > input", 2, "Budi"); await into(".sb-row > input", 3, "Citra");
  await c.press(".sb-more"); await c.sleep(500);
  await into(".sb-irow input", 0, "400", true); await into(".sb-irow input", 1, "pizza");
  c.log("BILL all four", await bill());
  await c.press(".sb-chip", 3); await c.sleep(400);
  c.log("BILL three of four", await bill());
  await box("bill-even", "document.querySelector('.set-modal.sb')");
  await c.press(".sb-how button", 1); await c.sleep(600);
  c.log("BILL by hand, nothing typed", await bill());
  await into(".sb-hand input", 0, "200", true);
  c.log("BILL by hand, 200", await bill());
  await box("bill-hand", "document.querySelector('.set-modal.sb')");
  await into(".sb-hand input", 1, "300", true);
  c.log("BILL by hand, too much", await bill());
  await box("bill-over", "document.querySelector('.set-modal.sb')");
  await c.js("(() => { const el = document.querySelectorAll('.sb-hand input')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); })()"); await c.sleep(400);
  await c.press(".sb-unit button", 1); await c.sleep(600);
  await into(".sb-rate input", 0, "20", true); await into(".sb-rate input", 1, "10");
  c.log("BILL service 20.000, tax 10%", await bill());
  await box("bill-rates", "document.querySelector('.set-modal.sb')");
};

// 13 October 2026, the safety net and what came with it (run with --fresh --shots --backup; never his entries):
// ⌘N on the selections panel with no app entered, the copy a day (--backup gives the page a stand-in for the shell,
// which only notes what it is handed), a bin and its Undo on the day panel, the rating once the projection says the
// month ends short, and the split bill's "I paid". The premise of the rating step (over half the income still kept,
// the month projected to end short) holds in the first half of a month; the log says what it found either way.
const safety = async (c) => {
  const p2 = (n) => String(n).padStart(2, "0");
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  const now = new Date(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const per = Math.round((2000000 * 1.08) / dim / 1000) * 1000;      // a day's spending: the month ends 8% over its income
  const sp = {}, inc = {};
  for (let n = 1; n <= 75; n++) sp[day(-n)] = [{ id: "s" + n, amount: per, desc: "lunch" }];
  for (const n of [0, -31, -62]) inc[day(n).slice(0, 7)] = [{ id: "i" + n, amount: 2000000, desc: "salary", day: 1 }];
  const seed = { spending: sp, incomes: inc, limits: {}, currency: "IDR", goals: [], debts: [], plans: [] };
  const saved = (what) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'), today = '${day(0)}'; return JSON.stringify(${what}); })()`);
  const setBox = (sel, nth, text) => c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); })(); 0`);
  const keyIn = (sel, key) => c.js(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true })); 0`);
  const crop = (sel, pad, h) => c.js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(Math.max(0, r.left - ${pad})), y: Math.round(Math.max(0, r.top - ${pad})), width: Math.round(r.width + 2 * ${pad}), height: Math.round(${h} || r.height + 2 * ${pad}) }; })()`);
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(2500);
  await c.js(`localStorage.setItem('pnl-calendar-idr', ${JSON.stringify(JSON.stringify(seed))}); location.reload(); 0`);
  await c.sleep(SPLASH_MS + 1500);

  // ⌘N on the selections panel
  await c.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true })); 0`); await c.sleep(700);
  c.log("QUICK LOG OVER THE PANEL", await c.js(`(() => { const q = document.querySelector('.ql'); return JSON.stringify({ open: !!q, onTop: !!q && q.contains(document.elementFromPoint(innerWidth / 2, q.getBoundingClientRect().top + 30)), appEntered: !!document.querySelector('.year-viewport'), backdropBlur: q ? getComputedStyle(q.parentElement).backdropFilter : null, says: q ? q.innerText.replace(/\\n+/g, ' | ').slice(0, 170) : null }); })()`));
  await c.shot("stage-quick", { x: 300, y: 80, width: 840, height: 420 });
  await setBox(".ql-in", 0, "kopi 25"); await c.sleep(300);
  await keyIn(".ql-in", "Enter"); await c.sleep(600);
  c.log("FILED FROM THE PANEL", await saved(`d.spending[today]`));
  await keyIn(".ql-in", "Escape"); await c.sleep(600);
  c.log("SHUT", await c.js(`JSON.stringify({ open: !!document.querySelector('.ql'), appEntered: !!document.querySelector('.year-viewport') })`));

  // the copy a day: what the page hands to the shell, and what it notes
  for (let i = 0; i < 26 && (await c.js(`window.__perf.kept ? window.__perf.kept.length : -1`)) === 0; i++) await c.sleep(1000);
  c.log("A COPY A DAY", await c.js(`JSON.stringify({ handed: window.__perf.kept || 'run without --backup', noted: localStorage.getItem('flow-auto') })`));

  // into finance, today's panel: the bin, then Undo
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3200);
  await c.press(".cell.today"); await c.sleep(1600);
  const note = () => c.js(`(() => { const n = document.querySelector('.undo-note'), r = n.getBoundingClientRect(); return JSON.stringify({ on: n.classList.contains('on'), says: n.innerText.replace(/\\n+/g, ' '), opacity: getComputedStyle(n).opacity, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], window: [innerWidth, innerHeight] }); })()`);
  c.log("BEFORE", await note(), "bins on the day:", await c.js(`document.querySelectorAll('.trash-btn[title="Delete"]').length`), await saved(`d.spending[today]`));
  await c.js(`document.querySelector('.trash-btn[title="Delete"]').click(); 0`); await c.sleep(1000);
  c.log("AFTER THE BIN", await note(), await saved(`d.spending[today] || null`));
  await c.shot("undo-note", await crop(".undo-note", 60));
  await c.js(`document.querySelector('.undo-note .un-b').click(); 0`); await c.sleep(900);
  c.log("AFTER UNDO", await note(), await saved(`d.spending[today] || null`));

  // the rating, with the projection saying the month ends short
  for (let i = 0; i < 8 && !(await c.js(`!!document.querySelector('.score-hit')`)); i++) { await c.scroll(700, 400); await c.sleep(900); }
  await c.js(`document.querySelector('.score-card').scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -40, behavior: 'instant' }); 0`); await c.sleep(2800);
  c.log("SCORE CARD", await c.js(`JSON.stringify({ rating: document.querySelector('.score-row').children[0].innerText, colour: getComputedStyle(document.querySelector('.score-row').children[0]).color, card: document.querySelector('.score-card').innerText.replace(/\\n+/g, ' | ').slice(0, 330) })`));
  await c.shot("score-capped", await crop(".score-card", 6));
  await c.js(`document.querySelector('.proj-box').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(2400);
  c.log("PROJECTION HEAD", await c.js(`document.querySelector('.proj-main').innerText.replace(/\\n+/g, ' | ').slice(0, 160)`));
  await c.js(`document.querySelector('.score-card').scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -40, behavior: 'instant' }); 0`); await c.sleep(900);
  await c.press(".score-hit"); await c.sleep(1000);
  c.log("SCORE POP-UP", await c.js(`(() => { const m = document.querySelector('[aria-label="How the score is worked out"]'); return JSON.stringify({ lit: [...m.querySelectorAll('span')].filter((s) => /^\\d+–\\d+ /.test(s.innerText) && s.style.background !== 'none').map((s) => s.innerText), note: [...m.querySelectorAll('p')].map((p) => p.innerText).filter((t) => /stops at/.test(t)) }); })()`));
  await c.js(`document.querySelector('[aria-label="How the score is worked out"] .x-btn').click(); 0`); await c.sleep(700);

  // the split bill: 100.000 between two, and "I paid"
  await c.js(`document.querySelectorAll('.split-btn')[1].scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(900);
  await c.press(".split-btn", 1); await c.sleep(1000);
  await setBox(".sb-top input", 0, "100000"); await c.sleep(500);
  await setBox(".sb-exp input", 1, "dinner"); await c.sleep(300);
  const owe = () => c.js(`JSON.stringify({ pays: [...document.querySelectorAll('.sb-pay')].map((e) => e.textContent), button: document.querySelector('.sb-owe').innerText.replace(/\\n+/g, ' '), off: document.querySelector('.sb-owe').disabled })`);
  c.log("SPLIT", await owe());
  await c.js(`document.querySelector('.sb-owe').scrollIntoView({ block: 'center', behavior: 'instant' })`); await c.sleep(500);
  await c.press(".sb-owe"); await c.sleep(800);
  c.log("I PAID", await owe(), await saved(`d.debts`));
  await c.shot("bill-owed", await crop(".sb-owe", 30, 150));
};

// the copy a day alone (--fresh --backup): the login, then nothing is touched until the page has handed its copy over
const copyday = async (c) => {
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(2500);
  const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fin = { spending: { [today]: [{ id: "a", amount: 25000, desc: "kopi" }, { id: "t", amount: 9000, desc: "made up", test: true }] }, incomes: {}, limits: {}, currency: "IDR", goals: [], debts: [], plans: [] };
  const fx = { version: 1, trades: { [today]: [{ id: "f", pnl: 12.5, pair: "EURUSD", side: "long" }] }, deps: {} };
  const idx = { version: 1, trades: { [today]: [{ id: "x", pnl: 5000, pair: "ANTM", test: true }] }, deps: {} };
  await c.js(`localStorage.setItem('pnl-calendar-idr', ${JSON.stringify(JSON.stringify(fin))}); localStorage.setItem('pnl-fx-usd', ${JSON.stringify(JSON.stringify(fx))}); localStorage.setItem('pnl-idx-idr', ${JSON.stringify(JSON.stringify(idx))}); location.reload(); 0`);
  const t0 = Date.now();
  for (let i = 0; i < 40 && !(await c.js(`localStorage.getItem('flow-auto')`)); i++) await c.sleep(1000);
  c.log("A COPY A DAY", `after ${Math.round((Date.now() - t0) / 1000)}s`, await c.js(`JSON.stringify({ handed: window.__perf.kept || 'run without --backup', noted: localStorage.getItem('flow-auto') })`));
};

// The trading panel and the three trading sides as stills, with what the page's own figures say about its text (run
// with --shots --fresh: the login, then test data on each side; never his entries). The finance side's `look`, told
// which side. Per side: year, month, calendar, a day with trades, a trade looked at and its form, every card, the
// chart, the wrapped, the calculator with made-up levels, the quick log, the sidebar, the settings.
const tlook = async (c) => {
  const go = async (sel, wait = 1600, block = "center") => { await c.js(`(() => { const e = ${sel}; if (e) e.scrollIntoView({ block: '${block}', behavior: 'instant' }); })(); 0`); await c.sleep(wait); };
  const audit = async (name) => c.log("AUDIT", name, await c.js(AUDIT));
  const esc = async (wait = 850) => { c.key("Escape"); await c.sleep(wait); };
  const only = process.argv.find((a) => a.startsWith("--side="));
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  let first = true;
  for (const [kind, pre] of [["crypto", "c"], ["idx", "s"], ["fx", "f"]]) {
    if (only && only !== `--side=${kind}`) continue;
    await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1800);
    if (first) {
      await c.press(".idx-unit"); await c.sleep(1500); c.move(700, 20); await c.sleep(500);
      await c.shot("00-panel");
      c.log("CAPTION", await c.js(`(() => { const cap = document.querySelector('.mk-cap'); if (!cap) return 'none'; const on = cap.querySelector('.at'), r = on.getBoundingClientRect(), g = document.querySelector('.idx-unit').getBoundingClientRect(); return JSON.stringify({ shown: getComputedStyle(cap).opacity, says: on.innerText, others: [...cap.children].filter((e) => e !== on).map((e) => getComputedStyle(e).opacity), top: Math.round(r.top), midX: Math.round(r.left + r.width / 2), globe: [Math.round(g.top), Math.round(g.bottom), Math.round(g.left + g.width / 2)], window: [innerWidth, innerHeight] }); })()`));
      await c.press(".coin-unit"); await c.sleep(1300);
      c.log("CAPTION", await c.js(`JSON.stringify({ says: document.querySelector('.mk-cap .at').innerText, coin: (() => { const g = document.querySelector('.coin-unit').getBoundingClientRect(); return [Math.round(g.top), Math.round(g.bottom)]; })() })`));
      await c.shot("00b-panel-coin");
      await c.press(".idx-unit"); await c.sleep(1300);
      c.log("PANEL", await c.js(`JSON.stringify({ words: [...document.querySelectorAll('.launch-veil *')].filter((e) => e.children.length === 0 && e.innerText && e.innerText.trim() && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0).map((e) => e.innerText.trim()).slice(0, 12), named: [...document.querySelectorAll('.coin-unit, .idx-unit')].map((e) => e.className.split(' ').slice(0, 3).join('.') + ': ' + (e.getAttribute('aria-label') || e.title || 'no name') + ' role=' + (e.getAttribute('role') || '-') + ' tab=' + e.tabIndex) })`));
      await c.press(".coin-unit"); await c.sleep(1300);
      first = false;
    }
    if (kind === "crypto") { await c.press(".coin-unit"); await c.sleep(5000); }
    if (kind === "idx") { await c.press(".idx-unit"); await c.sleep(1100); await c.press(".idx-unit"); await c.sleep(6500); }
    if (kind === "fx") { await c.press(".idx-unit"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(5000); }
    // the sides open on Home since 20 October 2026: test data pressed in the page, a still of Home, then the yearly panel
    if (await c.js(`!!document.querySelector('.dash')`)) { c.move(700, 20); await c.sleep(600); await c.shot(`${pre}00-home-empty`); }
    await c.js(`(() => { const b = document.querySelector('button[aria-label="Add test data"]'); if (b) b.click(); })()`); await c.sleep(3200);
    c.move(700, 20); await c.sleep(500);
    if (await c.js(`!!document.querySelector('.dash')`)) {
      await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(1200); await c.shot(`${pre}00-home`); await audit(`${kind} home`);
      await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2600);
    }
    await c.shot(`${pre}01-year`); await audit(`${kind} year`);
    await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
    c.move(700, 20); await c.sleep(400);
    await c.shot(`${pre}02-month-top`);
    await go(`document.querySelector('.cal-wrap')`); await c.shot(`${pre}03-calendar`);
    const at = await c.js(`[...document.querySelectorAll('.cell')].findIndex((e) => /\\dW|\\dL/.test(e.innerText))`);
    await c.press(".cell", Math.max(0, at)); await c.sleep(1900);
    await go(`document.querySelector('.jr-sheet')`, 1200, "start"); await c.js(`window.scrollBy({ top: -90, behavior: 'instant' }); 0`); await c.sleep(500);
    await c.shot(`${pre}04-day`);
    c.log("ROWS", kind, await c.js(`JSON.stringify([...document.querySelectorAll('.jr-sum')].slice(0, 6).map((r) => r.innerText.replace(/\\n+/g, ' ').slice(0, 120)))`));
    await go(`document.querySelector('.jr-sum')`, 900);
    await c.press(".jr-sum"); await c.sleep(1500);
    await go(`document.querySelector('.jv-top')`, 900); await c.shot(`${pre}05-view`);
    await c.press(".jv-btn.ico"); await c.sleep(1500);
    await go(`document.querySelector('.jr-sum')`, 900, "start"); await c.js(`window.scrollBy({ top: -80, behavior: 'instant' }); 0`); await c.sleep(500);
    await c.shot(`${pre}06-form`);
    await audit(`${kind} day`);
    const cards = await c.js(`document.querySelectorAll('.flow-card').length`);
    for (let i = 0; i < cards; i++) { await go(`document.querySelectorAll('.flow-card')[${i}]`, 2700, "start"); await c.js(`window.scrollBy({ top: -70, behavior: 'instant' }); 0`); await c.sleep(400); await c.shot(`${pre}1${i}-card`); }
    await go(`document.querySelector('.foot-logo')`, 1200, "end"); await c.shot(`${pre}19-foot`, { x: 0, y: 700, width: 1440, height: 200 });
    await audit(`${kind} month`);
    await go(`document.querySelector('.hero')`, 900);
    await c.press(".chart-btn"); await c.sleep(2700); await c.shot(`${pre}20-chart`); await esc();
    await c.press(".month-big"); await c.sleep(2900); await c.shot(`${pre}21-wrapped`); await audit(`${kind} wrapped`); await esc();
    await c.press(".calc-fab"); await c.sleep(1500);
    await c.js(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Test levels')?.click(); 0`); await c.sleep(1900);
    await c.shot(`${pre}22-calc`); await audit(`${kind} calc`);
    c.log("PRESS AREA", kind, await c.js(`(() => { const e = document.querySelector('.pc-x'); if (!e) return 'no x on a target'; const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.left - 4, r.top + r.height / 2); return '.pc-x ' + Math.round(r.width) + 'x' + Math.round(r.height) + ', pressed 4px beside: ' + (at === e ? 'its own' : 'somebody else'); })()`));
    await esc();
    await c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true })); 0`); await c.sleep(1100); await c.shot(`${pre}23-quicklog`, { x: 300, y: 80, width: 840, height: 420 }); await audit(`${kind} quicklog`); await esc(700);
    await c.press(".snav-burger"); await c.sleep(1300); await c.shot(`${pre}24-sidebar`, { x: 0, y: 0, width: 560, height: 900 }); await esc();
    await go(`document.querySelector('.foot-logo')`, 900, "end");
    await c.js(`[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || ''))?.click(); 0`); await c.sleep(1500); await c.shot(`${pre}25-settings`, { x: 360, y: 100, width: 720, height: 700 }); await esc(700);
    await c.press(".foot-logo"); await c.sleep(4900);
  }
};

// the x on a trade's picture (--fresh): the crypto side with test data, a trade that carries a picture opened in its
// form, and what a press on the x, 4px and 8px beside it, 4px under it and in the picture's middle lands on
const shotx = async (c) => {
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1800); await c.press(".coin-unit"); await c.sleep(5000);
  await c.press('button[aria-label="Add test data"]'); await c.sleep(2800);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  const days = await c.js(`[...document.querySelectorAll('.cell')].map((e, i) => (/\\dW|\\dL/.test(e.innerText) ? i : -1)).filter((i) => i >= 0)`);
  let row = -1;
  for (const d of days.slice(0, 12)) {
    await c.js(`document.querySelectorAll('.cell')[${d}].scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(600);
    await c.press(".cell", d); await c.sleep(1800);
    row = await c.js(`[...document.querySelectorAll('.jr-sum')].findIndex((r) => /image/.test(r.innerText))`);
    if (row >= 0) break;
  }
  if (row < 0) { c.log("PICTURE X", "no trade with a picture in twelve days"); return; }
  await c.js(`document.querySelectorAll('.jr-sum')[${row}].scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(900);
  await c.press(".jr-sum", row); await c.sleep(1600);
  await c.js(`document.querySelector('.jv-btn.ico').scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(800);
  await c.press(".jv-btn.ico"); await c.sleep(1600);
  await c.js(`[...document.querySelectorAll('.jr-shot-x')].find((x) => getComputedStyle(x).visibility !== 'hidden' && x.getBoundingClientRect().width > 0)?.scrollIntoView({ block: 'center', behavior: 'instant' }); 0`); await c.sleep(900);
  c.log("PICTURE X", await c.js(`(() => { const x = [...document.querySelectorAll('.jr-shot-x')].find((e) => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0); if (!x) return 'no x on show';
    const r = x.getBoundingClientRect(), pic = x.closest('.jr-shot'), p = pic.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (px, py) => { const e = document.elementFromPoint(px, py); return e === x ? 'the x' : e && pic.contains(e) ? 'the picture' : 'something else'; };
    return JSON.stringify({ x: [Math.round(r.width), Math.round(r.height)], picture: [Math.round(p.width), Math.round(p.height)], after: getComputedStyle(x, '::after').inset || getComputedStyle(x, '::after').top,
      onIt: at(cx, cy), left4: at(r.left - 4, cy), under4: at(cx, r.bottom + 4), left8: at(r.left - 8, cy), under8: at(cx, r.bottom + 8), pictureMiddle: at(p.left + p.width / 2, p.top + p.height / 2) }); })()`));
};

// Lag of the 13 October 2026 additions (the usual profile, a copy of his entries; --trace for milliseconds and the
// programs built; each thing twice): the quick log over the selections panel (open, type, file, shut), the trading
// panel with its name under the one in the middle (in, along the row, out), then on today's panel a bin and its Undo.
// What it files is removed again at the end.
const lagnew = async (c) => {
  const setBox = (sel, text) => c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); })(); 0`);
  const keyIn = (sel, key) => c.js(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true })); 0`);
  const bin = () => c.js(`[...document.querySelectorAll('.trash-btn[title="Delete"]')].filter((b) => !b.closest('.warm-host') && b.getBoundingClientRect().width > 0).pop()?.click(); 0`);
  await c.sleep(SPLASH_MS + 1500);
  for (const n of [1, 2]) {
    await c.step(`quicklog-open-${n}`, () => c.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true })); 0`), 1500);
    await c.step(`quicklog-type-${n}`, () => setBox(".ql-in", "kopi 25"), 800);
    await c.step(`quicklog-file-${n}`, () => keyIn(".ql-in", "Enter"), 1000);
    await c.step(`quicklog-shut-${n}`, () => keyIn(".ql-in", "Escape"), 1000);
  }
  for (const n of [1, 2]) {
    await c.step(`coin-focus-${n}`, () => c.press(".coin-unit"), 1200);
    await c.step(`markets-in-${n}`, () => c.press(".coin-unit"), 1800);
    await c.step(`globe-${n}`, () => c.press(".idx-unit"), 1400);
    await c.step(`die-${n}`, () => c.press(".coin-unit.fx"), 1400);
    await c.step(`globe-back-${n}`, () => c.press(".idx-unit"), 1400);
    await c.step(`markets-out-${n}`, async () => c.key("Escape"), 1500);
    await c.step(`wallet-focus-${n}`, () => c.press(".wallet-unit.active"), 1200);
  }
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  await c.press(".cell.today"); await c.sleep(1900);
  for (const n of [1, 2]) {
    await c.step(`bin-${n}`, bin, 1400);
    await c.step(`undo-${n}`, () => c.js(`document.querySelector('.undo-note .un-b').click(); 0`), 1400);
  }
  c.log("NOTE", await c.js(`document.querySelector('.undo-note').innerText.replace(/\\n+/g, ' ')`));
  await bin(); await c.sleep(1400); await bin(); await c.sleep(1400);
  await c.step("end", async () => {}, 300);
};

// What Add test data fills in (--fresh; 13 October 2026: "all data and subdata"): on finance the expenses with items
// (and whether the items add up), the buys in Other and how many carry a picked symbol, the plans, debts, goals; on
// each trading side the trades, the break-even ones, the deposits and withdrawals. Then Clear test data, and what is left.
const testdata = async (c) => {
  const flask = async () => { await c.press('button[aria-label="Add test data"]'); await c.sleep(3000); };
  const sweep = async () => { await c.js(`[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /clear test/i.test(b.getAttribute('aria-label') || ''))?.click(); 0`); await c.sleep(2200); };
  const home = async () => { await c.press(".foot-logo"); await c.sleep(4900); };
  const fin = () => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'), all = Object.values(d.spending || {}).flat(), items = all.filter((e) => e.parts && e.parts.length), other = all.filter((e) => e.cat === 'other');
    return JSON.stringify({ expenses: all.filter((e) => !e.zero).length, marked: all.filter((e) => e.test).length === all.length, withItems: items.length, itemCounts: [2, 3, 4].map((n) => n + ':' + items.filter((e) => e.parts.length === n).length).join(' '),
      itemsAddUp: items.every((e) => e.parts.reduce((a, p) => a + p.amount, 0) === e.amount && e.parts.every((p) => p.id && p.desc && p.amount > 0 && p.amount % 1000 === 0)), anItem: items[0] ? items[0].desc + ' ' + items[0].amount + ' = ' + items[0].parts.map((p) => p.desc + ' ' + p.amount).join(' + ') : null,
      other: other.length, otherKinds: [...new Set(other.map((e) => e.desc))].length, otherPicked: other.filter((e) => e.icon).length, plans: (d.plans || []).map((p) => p.desc + ' ' + p.amount + ' ' + p.date + (p.test ? ' test' : '')),
      debts: (d.debts || []).map((x) => x.name + ' ' + x.paid + '/' + x.amount + ' ' + x.dir), goalDeposits: (d.goals || []).map((g) => (g.deposits || []).length), incomes: Object.values(d.incomes || {}).flat().length }); })()`);
  const side = (key) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('${key}') || '{}'), all = Object.values(d.trades || {}).flat(), be = all.filter((t) => t.be), deps = Object.entries(d.deps || {}).sort(), cash = deps.flatMap(([, l]) => l);
    let bal = 0, low = 0; const days = [...new Set([...Object.keys(d.trades || {}), ...Object.keys(d.deps || {})])].sort(); for (const k of days) { for (const x of (d.deps || {})[k] || []) bal += x.amt; for (const t of (d.trades || {})[k] || []) bal += t.pnl; low = Math.min(low, bal); }
    return JSON.stringify({ trades: all.length, breakEven: be.length, aBreakEven: be[0] ? [be[0].pnl, 'rr' in be[0] ? be[0].rr : 'no R', (be[0].note || '').slice(0, 34)] : null, bare: all.filter((t) => !t.tf || !t.pre || !t.note).length,
      deposits: cash.filter((x) => x.amt > 0).length, withdrawals: cash.filter((x) => x.amt < 0).length, cashMarked: cash.every((x) => x.test), someCash: deps.slice(0, 3).map(([k, l]) => k + ' ' + l.map((x) => x.amt).join(',')), lowestAgainstTheStart: Math.round(low) }); })()`);
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await flask(); c.log("FINANCE", await fin());
  c.log("FINANCE SAID", await c.js(`(document.querySelector('.bk-msg') || {}).innerText || ''`));
  await flask(); c.log("FINANCE AGAIN (one set of plans and debts)", await c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'); return JSON.stringify({ plans: (d.plans || []).length, debts: (d.debts || []).length }); })()`));
  await sweep(); c.log("FINANCE CLEARED", await fin());
  await flask(); await home();
  for (const [kind, key] of [["crypto", "pnl-crypto-usd"], ["fx", "pnl-fx-usd"], ["idx", "pnl-idx-idr"]]) {
    await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1800);
    if (kind === "crypto") { await c.press(".coin-unit"); await c.sleep(5000); }
    if (kind === "idx") { await c.press(".idx-unit"); await c.sleep(1100); await c.press(".idx-unit"); await c.sleep(6500); }
    if (kind === "fx") { await c.press(".idx-unit"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(5000); }
    await flask(); c.log(kind.toUpperCase(), await side(key));
    c.log(kind.toUpperCase() + " SHOWS", await c.js(`JSON.stringify({ said: (document.querySelector('.bk-msg') || {}).innerText || '', page: !!document.querySelector('.year-viewport') })`));
    await sweep(); c.log(kind.toUpperCase() + " CLEARED", await side(key));
    await home();
  }
};

// The Dev account (--fresh --shots; 13 October 2026): after the login the select acc panel lists it with its yellow
// outline; Manage accounts leaves it alone; gone in as Dev, test data lands under its own keys and the first account's
// stay empty; the account button and the sidebar's row carry the outline; Developer options switched off in the
// settings takes it away at once (the page loads again and asks who is using Flow) and keeps what it holds; on again,
// it is back as it was left.
const devacc = async (c) => {
  const saved = () => c.js(`JSON.stringify({ accounts: (JSON.parse(localStorage.getItem('flow-users') || '{}').list || []).map((u) => u.id), last: (JSON.parse(localStorage.getItem('flow-users') || '{}')).last, devOptions: localStorage.getItem('flow-dev'), keys: Object.keys(localStorage).filter((k) => /pnl-calendar/.test(k)).map((k) => k + ':' + localStorage.getItem(k).length) })`);
  const tiles = () => c.js(`JSON.stringify({ title: (document.querySelector('.acc-title') || {}).innerText || 'no panel', tiles: [...document.querySelectorAll('.acc-tile')].map((t) => t.innerText.replace(/\\n+/g, ' ').replace(/^(edit|add) /, '').trim() + (t.classList.contains('dev') ? ' [outline ' + getComputedStyle(t.querySelector('.acc-face')).outline + ', opacity ' + getComputedStyle(t).opacity + ', presses ' + getComputedStyle(t).pointerEvents + ']' : '')) })`);
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  c.log("AFTER THE LOGIN", await saved(), await c.js(`document.querySelector('.who-btn').className`));
  await c.press(".who-btn"); await c.sleep(3200);
  c.log("SELECT ACC PANEL", await tiles()); await c.shot("dev-panel");
  await c.press(".acc-manage"); await c.sleep(900);
  c.log("MANAGE ACCOUNTS", await tiles());
  await c.press(".acc-manage"); await c.sleep(900);
  await c.js(`document.querySelector('.acc-tile.dev').click(); 0`); await c.sleep(3600);
  c.log("IN AS DEV", await saved(), await c.js(`JSON.stringify({ button: document.querySelector('.who-btn').className, ring: getComputedStyle(document.querySelector('.who-pic')).boxShadow })`));
  c.move(1400, 870); await c.sleep(700); await c.shot("dev-who", { x: 1140, y: 800, width: 300, height: 100 }); c.move(700, 300); await c.sleep(300);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  c.log("THE CARD", await c.js(`(document.querySelector('.wallet-unit.active .slot-card') || {}).innerText || ''`));
  await c.press(".big-card"); await c.sleep(6500);
  await c.press('button[aria-label="Add test data"]'); await c.sleep(3000);
  c.log("TEST DATA AS DEV", await saved());
  await c.press(".snav-burger"); await c.sleep(1300);
  c.log("SIDEBAR", await c.js(`(() => { const p = document.querySelector('.sd-pic'); return JSON.stringify({ row: p.parentElement.innerText.replace(/\\n+/g, ' '), cls: p.className, ring: getComputedStyle(p).boxShadow }); })()`));
  await c.shot("dev-sidebar", { x: 0, y: 560, width: 420, height: 340 });
  c.key("Escape"); await c.sleep(900);
  await c.js(`[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || ''))?.click(); 0`); await c.sleep(1500);
  await c.js(`[...[...document.querySelectorAll('.set-row')].find((r) => /Developer options/.test(r.innerText)).querySelectorAll('button')].find((b) => b.innerText.trim() === 'Off').click(); 0`); await c.sleep(3600);
  c.log("DEVELOPER OPTIONS OFF", await tiles(), await saved());
  await c.js(`localStorage.setItem('flow-dev', '1'); sessionStorage.setItem('flow-pick-acc', '1'); location.reload(); 0`); await c.sleep(3600);
  c.log("ON AGAIN", await tiles());
  await c.js(`document.querySelector('.acc-tile.dev').click(); 0`); await c.sleep(3600);
  c.log("BACK IN AS DEV", await saved());
};

// A bug hunt in developer mode (13 October 2026: "use developer mode, test for imperfections, bugs, lag"): the Dev
// account with full test data, every screen of one side opened (--side=finance|crypto|idx|fx; --profile=hunt, with
// --fresh the first time: the login, then into the Dev account, which later runs go straight into). After each screen
// the page is read for text that should never show (NaN, undefined, Infinity, [object, Invalid Date, null) and for
// text cut off in its box; the run's log also holds every console error. Each press is a step, so `report.cjs hunt`
// (after --trace) says where the page or the graphics process stood still.
const HUNT = String.raw`(() => {
  const host = document.querySelector('.warm-host'), bad = [], cut = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue; if (!t.trim()) continue;
    const el = n.parentElement; if (!el || (host && host.contains(el)) || el.closest('style, script, defs')) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (/NaN|undefined|Infinity|\[object|Invalid Date|\bnull\b/.test(t)) bad.push(t.trim().slice(0, 50));
    if (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX) && !/ellipsis/.test(cs.textOverflow)) cut.push((el.className && el.className.baseVal === undefined ? String(el.className).split(' ')[0] : el.tagName) + ': ' + t.trim().slice(0, 30));
  }
  return JSON.stringify({ bad: [...new Set(bad)].slice(0, 6), cut: [...new Set(cut)].slice(0, 6) });
})()`;
const hunt = async (c) => {
  const side = (process.argv.find((a) => a.startsWith("--side=")) || "--side=finance").slice(7);
  let seen = 0;
  const scan = async (name) => { seen++; const r = await c.js(HUNT); if (r !== '{"bad":[],"cut":[]}') c.log("FOUND", name, r); };
  const go = async (sel, wait = 1500, block = "center") => { await c.js(`(() => { const e = ${sel}; if (e) e.scrollIntoView({ block: '${block}', behavior: 'instant' }); })(); 0`); await c.sleep(wait); };
  const click = (sel) => c.js(`(() => { const e = ${sel}; if (!e) return 'missing'; e.click(); return 'ok'; })()`);
  const st = async (name, sel, wait = 1500) => { let r; await c.step(name, async () => { r = await click(sel); }, wait); if (r !== "ok") c.log("MISSING", name); await scan(name); };
  const esc = async (wait = 900) => { c.key("Escape"); await c.sleep(wait); };
  const setBox = (sel, text) => c.js(`(() => { const el = ${sel}; if (!el) return; el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); })(); 0`);
  const keyIn = (sel, key) => c.js(`(() => { const el = ${sel}; if (el) el.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true })); })(); 0`);
  const byText = (css, text) => `[...document.querySelectorAll('${css}')].find((b) => !b.closest('.warm-host') && b.innerText.includes(${JSON.stringify(text)}))`;
  const cmdN = () => c.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true, cancelable: true })); 0`);
  const store = (key, what) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('u:dev:${key}') || '{}'), now = new Date(), mk = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'); return ${what}; })()`);
  // Home (since 20 October 2026 every side opens on it): the board, every widget previewed at every size in the gallery,
  // the layouts, the exchanger and its list of currencies; then the calendar, where the rest of the hunt begins
  const home = async () => {
    if (!(await c.js(`!!document.querySelector('.dash')`))) return;
    await scan("home");
    await st("home-edit", `document.querySelector('.dash-tools [aria-label="Edit widgets"]')`, 900);
    await st("home-gallery", byText(".dash-tools .dg-btn", "Add widget"), 1300);
    const n = await c.js(`document.querySelectorAll('.dg-gal-it').length`);
    for (let w = 0; w < n; w++) {
      await click(`document.querySelectorAll('.dg-gal-it')[${w}]`); await c.sleep(500);
      const sizes = await c.js(`document.querySelectorAll('.dg-gal-main .wr-seg button').length`);
      for (let z = 0; z < sizes; z++) { await click(`document.querySelectorAll('.dg-gal-main .wr-seg button')[${z}]`); await c.sleep(420); await scan(`gallery ${w}.${z} ` + await c.js(`(document.querySelector('.dg-gal-name') || {}).innerText`)); }
    }
    await esc();
    await st("home-layouts", byText(".dash-tools .dg-btn", "Layouts"), 1300); await esc();
    await click(byText(".dash-tools .dg-btn", "Done")); await c.sleep(700);
    await c.step("exchanger", () => c.js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', metaKey: true, bubbles: true, cancelable: true })); 0`), 1300); await scan("exchanger");
    await st("exchanger-list", `document.querySelector('.fx-cur')`, 900);
    await setBox(`document.querySelector('.fx-search input')`, "dollar"); await c.sleep(500); await scan("exchanger search");
    await esc(500); await esc(700);
    await st("home-calendar", `document.querySelector('.dash-tools [aria-label="Calendar"]')`, 2600);
  };
  await c.sleep(SPLASH_MS);
  if (await c.js(`!!document.querySelector('.acc-in')`)) {
    await typeName(c, "Flow"); await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
    await c.press(".who-btn"); await c.sleep(3200);
    await click(`document.querySelector('.acc-tile.dev')`); await c.sleep(3800);
  }
  c.log("WHO", await c.js(`JSON.stringify({ last: JSON.parse(localStorage.getItem('flow-users') || '{}').last, button: (document.querySelector('.who-btn') || {}).className })`));
  if (side === "finance") {
    await c.press(".wallet-unit.active"); await c.sleep(1400);
    await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
    await c.step("enter", () => c.press(".big-card"), 6500);
    // pressed in the page: on Home the footer is below the window, where a mouse press lands on nothing
    if (!(await store("pnl-calendar-idr", "Object.keys(d.spending || {}).length"))) { c.log("TEST DATA", await click(`document.querySelector('button[aria-label="Add test data"]')`)); await c.sleep(3200); }
    await home();
    await scan("year");
    for (const n of [1, 2]) { await st(`year-chart-${n}`, `document.querySelector('.chart-btn')`, 2600); await esc(); }
    for (const n of [1, 2]) { await st(`year-wrapped-${n}`, `document.querySelector('.year-big')`, 2900); await esc(); }
    await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3800); await scan("month");
    for (const n of [1, 2]) { await st(`month-chart-${n}`, `document.querySelector('.chart-btn')`, 2600); await esc(); }
    for (const n of [1, 2]) { await st(`month-wrapped-${n}`, `document.querySelector('.month-big')`, 2900); await esc(); }
    // a day with an expense that has items, and one with a buy in Other
    const days = JSON.parse(await store("pnl-calendar-idr", `JSON.stringify({ items: +(Object.keys(d.spending).filter((k) => k.startsWith(mk) && d.spending[k].some((e) => e.parts))[0] || '').slice(8), other: +(Object.keys(d.spending).filter((k) => k.startsWith(mk) && d.spending[k].some((e) => e.cat === 'other'))[0] || '').slice(8) })`));
    c.log("DAYS", JSON.stringify(days));
    for (const [what, d] of [["other", days.other], ["items", days.items]]) {
      if (!d) continue;
      await go(`document.querySelectorAll('.cell')[${d - 1}]`, 600);
      await c.step(`day-${what}`, () => c.press(".cell", d - 1), 1900); await scan(`day-${what}`);
      c.log("ROWS " + what, await c.js(`JSON.stringify([...document.querySelectorAll('.entry-row')].filter((r) => !r.closest('.warm-host')).slice(0, 8).map((r) => [...r.querySelectorAll('input')].map((i) => i.value).join(' | ') + ' {' + [...r.querySelectorAll('.msym')].map((m) => m.innerText).join(',') + '}'))`));
    }
    await st("items-open", `[...document.querySelectorAll('button, [role="button"]')].find((b) => !b.closest('.warm-host') && /^receipt_long\\s*\\d+$/.test(b.innerText.trim()))`, 1300);
    await go(`document.querySelector('.entry-row')`, 500); await c.shot("fin-day-rows", { x: 100, y: 200, width: 1240, height: 520 });
    for (let i = 0; i < 3; i++) { await c.step(`card-${i}`, () => go(`document.querySelectorAll('.flow-card')[${i}]`, 100, "start"), 2700); await scan(`card-${i}`); }
    await go(`document.querySelector('.wk-cmp')`, 900);
    for (const n of [1, 2]) await st(`week-back-${n}`, `document.querySelector('.wk-cmp.wk-step')`, 1300);
    await st("week-compare", `document.querySelector('.wk-cmp:not(.wk-step)')`, 1300);
    await st("week-forward", `document.querySelectorAll('.wk-cmp.wk-step')[1]`, 1300); await click(`document.querySelectorAll('.wk-cmp.wk-step')[1]`); await c.sleep(1200);
    await go(`document.querySelector('.wp-row')`, 900); c.log("PLANS", await c.js(`JSON.stringify([...document.querySelectorAll('.wp-row')].map((r) => r.innerText.replace(/\\n+/g, ' ')))`));
    await st("plan-happened", `document.querySelector('.wp-row .wp-do')`, 1600);
    await go(`document.querySelectorAll('.flow-label')[1]`, 2400);
    for (const n of [1, 2]) { await st(`category-${n}`, `document.querySelectorAll('.flow-label')[1]`, 1600); await esc(); }
    await go(`document.querySelector('.score-card')`, 2400);
    for (const n of [1, 2]) { await st(`score-${n}`, `document.querySelector('.score-hit')`, 1300); await click(`document.querySelector('[aria-label="How the score is worked out"] .x-btn')`); await c.sleep(800); }
    await go(`document.querySelector('.proj-box')`, 2400); await scan("projection");
    await go(`document.querySelector('.ins-box')`, 2400); await st("insights-all", byText(".ins-box button", "View all"), 1300);
    await go(`document.querySelector('.debt-sec')`, 2400); await scan("goals and debts");
    await go(`document.querySelector('.hero')`, 900);
    for (const n of [1, 2]) { await c.step(`quicklog-${n}`, cmdN, 1300); await setBox(`document.querySelector('.ql-in')`, "kopi 25"); await c.sleep(300); await keyIn(`document.querySelector('.ql-in')`, "Enter"); await c.sleep(700); await scan("quicklog"); await keyIn(`document.querySelector('.ql-in')`, "Escape"); await c.sleep(800); }
    await c.step("sidebar", () => c.press(".snav-burger"), 1300); await scan("sidebar");
    await st("splitbill", byText(".snav button", "Split bill"), 1600);
    await setBox(`document.querySelector('.sb-top input')`, "100000"); await c.sleep(500); await click(`document.querySelector('.sb-owe')`); await c.sleep(700); await scan("splitbill filled"); await esc();
    await go(`document.querySelector('.foot-logo')`, 900, "end");
    await st("settings", `[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || ''))`, 1400); await esc(700);
    await st("year-back", `document.querySelector('.month-btn')`, 2200);
  } else {
    const key = { crypto: "pnl-crypto-usd", idx: "pnl-idx-idr", fx: "pnl-fx-usd" }[side];
    await c.press(".coin-unit"); await c.sleep(1000); await c.step("markets", () => c.press(".coin-unit"), 1800);
    if (side === "crypto") await c.step("enter", () => c.press(".coin-unit"), 5000);
    if (side === "idx") { await c.press(".idx-unit"); await c.sleep(1100); await c.step("enter", () => c.press(".idx-unit"), 6500); }
    if (side === "fx") { await c.press(".idx-unit"); await c.sleep(1100); await c.press(".coin-unit.fx"); await c.sleep(1100); await c.step("enter", () => c.press(".coin-unit.fx"), 5000); }
    if (process.argv.includes("--again")) { await click(`[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /clear test/i.test(b.getAttribute('aria-label') || ''))`); await c.sleep(2200); }
    if (process.argv.includes("--again") || !(await store(key, "Object.keys(d.trades || {}).length"))) { c.log("TEST DATA", await click(`document.querySelector('button[aria-label="Add test data"]')`)); await c.sleep(3200); }
    if (side === "fx") c.log("BREAK-EVEN PIPS", await store(key, `JSON.stringify(Object.values(d.trades).flat().filter((t) => t.be).slice(0, 40).map((t) => Math.round(Math.abs(t.close - t.open) / (/JPY$/.test(t.pair) ? 0.01 : t.pair === 'XAUUSD' ? 0.1 : 0.0001) * 10) / 10).sort((a, b) => a - b).filter((v, i, l) => i === 0 || i === l.length - 1 || i === (l.length >> 1)))`), "(least, middle, most; and how many close on their stop:", await store(key, `Object.values(d.trades).flat().filter((t) => t.be && t.close === t.sl).length`), ")");
    await home();
    await scan("year");
    for (const n of [1, 2]) { await st(`year-chart-${n}`, `document.querySelector('.chart-btn')`, 2600); await esc(); }
    for (const n of [1, 2]) { await st(`year-wrapped-${n}`, `document.querySelector('.year-big')`, 2900); await esc(); }
    for (const n of [1, 2]) { await st(`calc-${n}`, `document.querySelector('.calc-fab')`, 1500); await click(byText("button", "Test levels")); await c.sleep(1500); await scan("calc levels"); await click(byText("button", "Test levels")); await c.sleep(1200);
      await click(`document.querySelector('.pc-undo button')`); await c.sleep(600); await click(`document.querySelectorAll('.pc-undo button')[1]`); await c.sleep(600); await scan("calc undo redo"); await esc(); }
    await c.step("month-1", async () => c.press(".ycell", await monthBox(c)), 3800); await scan("month");
    for (const n of [1, 2]) { await st(`month-chart-${n}`, `document.querySelector('.chart-btn')`, 2600); await esc(); }
    for (const n of [1, 2]) { await st(`month-wrapped-${n}`, `document.querySelector('.month-big')`, 2900); await esc(); }
    if (side !== "idx") for (const n of [1, 2, 3]) { await st(`currency-${n}`, `document.querySelector('.cur-btn')`, 1300); }
    const days = JSON.parse(await store(key, `JSON.stringify({ be: +(Object.keys(d.trades).filter((k) => k.startsWith(mk) && d.trades[k].some((t) => t.be))[0] || Object.keys(d.trades).filter((k) => k.startsWith(mk))[0] || '').slice(8), cash: +(Object.keys(d.deps || {}).filter((k) => k.startsWith(mk))[0] || '').slice(8) })`));
    c.log("DAYS", JSON.stringify(days));
    if (days.be) {
      await go(`document.querySelectorAll('.cell')[${days.be - 1}]`, 600);
      await c.step("day-1", () => c.press(".cell", days.be - 1), 1900); await scan("day");
      c.log("ROWS", await c.js(`JSON.stringify([...document.querySelectorAll('.jr-sum')].filter((r) => !r.closest('.warm-host')).slice(0, 6).map((r) => r.innerText.replace(/\\n+/g, ' ').slice(0, 110)))`));
      const at = await c.js(`Math.max(0, [...document.querySelectorAll('.jr-sum')].findIndex((r) => /Breakeven/.test(r.innerText)))`);
      await go(`document.querySelectorAll('.jr-sum')[${at}]`, 800);
      await c.step("trade-view", () => c.press(".jr-sum", at), 1500); await scan("trade view");
      await go(`document.querySelector('.jv-btn.ico')`, 700); await c.step("trade-form", () => c.press(".jv-btn.ico"), 1500); await scan("trade form");
      await go(`document.querySelectorAll('.jr-sum')[${at}]`, 600, "start"); await c.js(`window.scrollBy({ top: -80, behavior: 'instant' }); 0`); await c.sleep(500); await c.shot(`${side}-be-trade`, { x: 100, y: 0, width: 1240, height: 620 });
    }
    if (days.cash) {
      await go(`document.querySelectorAll('.cell')[${days.cash - 1}]`, 600);
      await c.step("day-cash", () => c.press(".cell", days.cash - 1), 1900);
      await go(`document.querySelector('.jr-cash-head')`, 700); await st("cash-open", `document.querySelector('.jr-cash-head')`, 1100);
      c.log("CASH", await c.js(`(document.querySelector('.jr-cash') || {}).innerText.replace(/\\n+/g, ' ').slice(0, 160)`));
      await c.shot(`${side}-cash`, await c.js(`(() => { const r = document.querySelector('.jr-cash').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(Math.max(0, r.top - 10)), width: Math.round(r.width), height: Math.round(r.height + 20) }; })()`));
    }
    const cards = await c.js(`document.querySelectorAll('.flow-card').length`);
    for (let i = 0; i < cards; i++) { await c.step(`card-${i}`, () => go(`document.querySelectorAll('.flow-card')[${i}]`, 100, "start"), 2700); await scan(`card-${i}`); }
    await go(`document.querySelector('.an-tab')`, 900);
    for (let i = 1; i < 5; i++) await st(`analysis-tab-${i}`, `document.querySelectorAll('.an-tab')[${i}]`, 1500);
    await go(`document.querySelectorAll('.flow-card')[2]`, 2700, "start"); await go(`document.querySelector('.ring-seg')`, 900);
    if (!(await c.js(`!!document.querySelector('.ring-seg')`))) c.log("RING", await c.js(`JSON.stringify({ segs: [...document.querySelectorAll('.wr-seg')].map((e) => e.className), card: (document.querySelectorAll('.flow-card')[2] || {}).innerText.slice(0, 80) })`));
    await st("ring-losses", `document.querySelectorAll('.ring-sw button')[1]`, 1300);
    if (side === "idx") { await go(byText("button", "This year"), 900); await st("breakdown-year", byText("button", "This year"), 1300); }
    await go(`document.querySelector('.hero')`, 900);
    for (const n of [1, 2]) { await c.step(`quicklog-${n}`, cmdN, 1300); await setBox(`document.querySelector('.ql-in')`, side === "idx" ? "antm 350" : side === "fx" ? "eurusd 40 sell" : "btc 120"); await c.sleep(300); await keyIn(`document.querySelector('.ql-in')`, "Enter"); await c.sleep(700); await scan("quicklog"); await keyIn(`document.querySelector('.ql-in')`, "Escape"); await c.sleep(800); }
    await c.step("sidebar", () => c.press(".snav-burger"), 1300); await scan("sidebar"); await esc();
    await go(`document.querySelector('.foot-logo')`, 900, "end");
    await st("settings", `[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || ''))`, 1400); await esc(700);
    await st("year-back", `document.querySelector('.month-btn')`, 2200);
  }
  await c.step("end", async () => {}, 300);
  c.log("SCREENS READ", seen);
};

/* The light look (13 October 2026; `--shots --profile=light --fresh`, without `--light`): into finance on test data in
   the dark look and a still of the month; then the switch in Settings pressed on and off, a still of each, and what
   the page says each time: the scheme on body, the big figure's colour, a day tile's fill, the key saved, and a
   mark put on the window beforehand (still there: the page was never loaded again). */
const light = async (c) => {
  const esc = async (wait = 850) => { c.key("Escape"); await c.sleep(wait); };
  const settings = async () => { await c.js(`[...document.querySelectorAll('button.bk-btn.ico')].find((b) => /settings/i.test(b.getAttribute('aria-label') || ''))?.click(); 0`); await c.sleep(1500); };
  const said = () => c.js(`(() => { const cs = (sel, k) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[k] : 'missing'; };
    return JSON.stringify({ body: cs('body', 'colorScheme'), figure: cs('.hero-num', 'color'), tile: cs('.cell', 'backgroundColor'), card: cs('.flow-card', 'backgroundColor'),
      key: localStorage.getItem('flow-theme'), sw: (document.querySelector('.th-sw') || {}).className || null, mark: window.__same || null }); })()`);
  await c.sleep(SPLASH_MS);
  const fresh = await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  if (fresh) { await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000); }
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card");
  // with --light: the way in from the dark stage to a light app, a still every 0.45s (the greeting, the big year, the yearly panel)
  if (process.argv.includes("--light")) { for (let k = 0; k < 8; k++) { await c.sleep(450); await c.shot(`0-enter-${k}`); } await c.sleep(2900); } else await c.sleep(6500);
  if (fresh) { await c.press('button[aria-label="Add test data"]'); await c.sleep(2600); }
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  c.move(700, 20); await c.sleep(400);
  await c.js(`window.__same = 'same page'; 0`);
  await c.shot("1-dark"); c.log("DARK", await said());
  // the liquid glass slider (14 October 2026): its number on the page and on the pop-up, its key, its word, a card's fill
  const glass = () => c.js(`(() => { const m = document.querySelector('.set-modal'), s = document.querySelector('.lg-sl');
    return JSON.stringify({ root: document.documentElement.style.getPropertyValue('--lg-k'), pane: m ? m.style.getPropertyValue('--lg-k') : 'no pane',
      key: localStorage.getItem('flow-glass'), word: s ? s.parentElement.querySelector('.set-k small').textContent : 'missing',
      card: getComputedStyle(document.querySelector('.flow-card')).backgroundColor }); })()`);
  // as an arrow key does it: the value set, then the input event (no press, so it is not a drag)
  const glassTo = async (n) => { await c.js(`(() => { const el = document.querySelector('.lg-sl input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${n}'); el.dispatchEvent(new Event('input', { bubbles: true })); return 0; })()`); await c.sleep(500); };
  const PANE = { x: 420, y: 160, width: 600, height: 580 };
  await settings(); await c.shot("2-settings-dark", PANE); c.log("GLASS DEFAULT", await glass());
  await c.press(".lg-sl input", 0, 0.03, 0.5); await c.sleep(700); await c.shot("2b-settings-dark-clear", PANE); c.log("GLASS PRESSED NEAR CLEAR END", await glass());
  await glassTo(100); await c.shot("2c-settings-dark-tinted", PANE); c.log("GLASS TINTED", await glass());
  await glassTo(50);
  await c.press(".th-sw"); await c.sleep(1000);
  await c.shot("3-settings-light", PANE); c.log("LIGHT", await said());
  await esc(); await c.shot("4-light");
  await settings(); await glassTo(0); await esc(); await c.shot("4b-light-clear");
  await settings(); await glassTo(100); await esc(); await c.shot("4c-light-tinted");
  await settings(); await glassTo(50); await c.press(".th-sw"); await c.sleep(1000); c.log("DARK AGAIN", await said());
  await esc(); await c.shot("5-dark-again");
  await settings(); await glassTo(0); await esc(); await c.shot("6-dark-clear"); c.log("GLASS CLEAR, CLOSED", await glass().catch(() => "n/a"));
  await settings(); await glassTo(50); await esc();
};
// Test data per period and per card (14 October 2026): the footer's flask fills the year on the yearly panel and the
// month on a month, and makes only that period anew (other months' test entries keep their ids); split bills and their
// debts; each card's flask (a click, and its pop-up opened as a double click does); finance, then crypto. --shots --fresh
const parttest = async (c) => {
  // the footer's flask pressed in the page (on a month it is below the window), as one click
  const flask = async () => { await c.js(`(() => { document.querySelector('button[aria-label="Add test data"]').click(); return 0; })()`); await c.sleep(1500); };
  const said = () => c.js(`(document.querySelector('.bk-msg') || {}).innerText || ''`);
  const generate = async () => { await c.js(`(() => { document.querySelector('.pt-modal .tcfg-go').click(); return 0; })()`); await c.sleep(1300); };
  const dbl = (sel) => c.js(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'missing'; b.scrollIntoView({ block: 'center' }); b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })); return 'opened'; })()`);
  const press = (text) => c.js(`(() => { const b = [...document.querySelectorAll('.pt-modal button')].find((x) => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) return 'no ' + ${JSON.stringify(text)}; b.click(); return 'ok'; })()`);
  // per month of the year on screen: how many test entries, and a fingerprint of their ids
  const fin = () => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'), by = {};
    for (const [k, l] of Object.entries(d.spending || {})) for (const e of l) if (e.test) { const m = k.slice(0, 7); (by[m] = by[m] || []).push(e.id); }
    const all = Object.values(d.spending || {}).flat(), split = all.filter((e) => / · split \\d/.test(e.desc || ''));
    return JSON.stringify({ months: Object.fromEntries(Object.entries(by).sort().map(([m, ids]) => [m, ids.length + ':' + ids.join('').slice(-6)])),
      splits: split.length, aSplit: split[0] ? split[0].desc + ' ' + split[0].amount : null, billDebts: (d.debts || []).filter((x) => x.bill).map((x) => x.name + ' ' + x.amount + ' ' + x.bill),
      plans: (d.plans || []).map((p) => p.desc + ' ' + p.amount + ' ' + p.date), goals: (d.goals || []).map((g) => g.name + ' ' + g.target + ' [' + (g.deposits || []).map((x) => x.amount).join(',') + ']'),
      debts: (d.debts || []).filter((x) => !x.bill).map((x) => x.name + ' ' + x.paid + '/' + x.amount + ' ' + x.dir) }); })()`);
  const month = (mk) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}');
    const out = Object.entries(d.spending || {}).filter(([k]) => k.startsWith('${mk}')).flatMap(([, l]) => l).filter((e) => e.test).reduce((a, e) => a + e.amount, 0);
    const inn = ((d.incomes || {})['${mk}'] || []).filter((e) => e.test).reduce((a, e) => a + e.amount, 0);
    return JSON.stringify({ in: inn, out, spent: inn ? Math.round((out / inn) * 100) + '%' : 'no income' }); })()`);
  const tr = (key) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('${key}') || '{}'), by = {}, names = {};
    for (const [k, l] of Object.entries(d.trades || {})) for (const t of l) if (t.test) { const m = k.slice(0, 7); (by[m] = by[m] || []).push(t.id); }
    return JSON.stringify(Object.fromEntries(Object.entries(by).sort().map(([m, ids]) => [m, ids.length + ':' + ids.join('').slice(-6)]))); })()`);
  const trMonth = (key, mk) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('${key}') || '{}'), l = Object.entries(d.trades || {}).filter(([k]) => k.startsWith('${mk}')).flatMap(([, x]) => x).filter((t) => t.test);
    const names = {}; l.forEach((t) => { names[t.pair] = (names[t.pair] || 0) + 1; }); const top = Object.entries(names).sort((a, b) => b[1] - a[1]);
    const deps = Object.entries(d.deps || {}).filter(([k]) => k.startsWith('${mk}')).flatMap(([k, x]) => x.filter((y) => y.test).map((y) => k.slice(8) + ':' + y.amt));
    return JSON.stringify({ trades: l.length, wins: l.filter((t) => t.pnl > 0).length, net: Math.round(l.reduce((a, t) => a + t.pnl, 0)), top: top.slice(0, 2), names: top.length, deps }); })()`);
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  const now = new Date(), mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await flask(); c.log("FINANCE, YEARLY PANEL", await said(), await fin());
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  await flask(); c.log("FINANCE, ITS MONTH (only " + mk + " new ids)", await said(), await fin());
  // the cards' flasks: Weekly expenses by a click, Money flow and Goals through their pop-ups
  await c.js(`(() => { const b = document.querySelector('[data-card="weekly expenses"] .card-flask'); b.scrollIntoView({ block: 'center' }); b.click(); return 0; })()`); await c.sleep(1400);
  c.log("WEEKLY FLASK", await said(), await fin());
  c.log("MONEY FLOW POP-UP", await dbl('[data-card="money flow"] .card-flask')); await c.sleep(900);
  await c.shot("pt-flow-pop", { x: 380, y: 120, width: 680, height: 660 });
  c.log("OVERSPENT", await press("Overspent")); await c.sleep(200); await generate();
  c.log("MONEY FLOW MADE", await said(), await month(mk));
  c.log("GOALS POP-UP", await dbl('[data-card="goals"] .card-flask')); await c.sleep(900);
  await c.shot("pt-goals-pop", { x: 380, y: 60, width: 680, height: 780 });
  await generate();
  c.log("GOALS AND DEBTS MADE", await said(), await fin());
  c.log("GOAL ROWS", await c.js(`[...document.querySelectorAll('[data-card="goals"] .goal-row')].map((r) => r.innerText.replace(/\\n+/g, ' | ').slice(0, 90)).join(' // ')`));
  await c.js(`document.querySelector('[data-card="goals"]').scrollIntoView({ block: 'start' }); 0`); await c.sleep(1200);
  await c.shot("pt-goals");
  c.log("SPLIT DEBTS AFTER MONEY FLOW (Oct's gone with its bills)", await c.js(`JSON.stringify((JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}').debts || []).filter((x) => x.bill).length)`));
  // crypto: the yearly panel, then a month, then its cards (home pressed in the page: the footer is below the window)
  await c.js(`(() => { document.querySelector('.foot-logo').click(); return 0; })()`); await c.sleep(4900);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1800); await c.press(".coin-unit"); await c.sleep(5000);
  await flask(); c.log("CRYPTO, YEARLY PANEL", await said(), await tr("pnl-crypto-usd"));
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  await flask(); c.log("CRYPTO, ITS MONTH (only " + mk + " new ids)", await said(), await tr("pnl-crypto-usd"));
  c.log("PNL ANALYSIS POP-UP", await dbl('[data-card="PnL analysis"] .card-flask')); await c.sleep(900);
  await c.shot("pt-an-pop", { x: 380, y: 60, width: 680, height: 780 });
  await press("Drawdown"); await press("Both"); await c.sleep(200); await generate();
  c.log("DRAWDOWN AND BOTH", await said(), await trMonth("pnl-crypto-usd", mk));
  c.log("COINS POP-UP", await dbl('[data-card="coins"] .card-flask')); await c.sleep(900);
  await press("One name dominates"); await c.sleep(200); await generate();
  c.log("ONE NAME", await said(), await trMonth("pnl-crypto-usd", mk), await tr("pnl-crypto-usd"));
};
// Uneven tiles (14 October 2026, "find design flaws, uneven tiles"): on every screen, each row of like siblings (same
// first class) in a grid or a flex row, and what differs among them: heights, widths, the gaps between them, and in a
// row their tops; and the left and right edges of the month's big pieces. Finance and crypto, test data. --shots --fresh
const tileaudit = async (c) => {
  const audit = (where) => c.js(`(() => {
    const out = [], seen = new Set(), r1 = (v) => Math.round(v * 10) / 10;
    const cls = (e) => (typeof e.className === 'string' && e.className.trim().split(/\\s+/)[0]) || e.tagName.toLowerCase();
    const path = (e) => { const a = []; for (let x = e, i = 0; x && x !== document.body && i < 3; x = x.parentElement, i++) a.unshift(cls(x)); return a.join(' > '); };
    for (const p of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(p);
      if (!/grid|flex/.test(cs.display) || cs.visibility === 'hidden') continue;
      const kids = [...p.children].filter((k) => { const r = k.getBoundingClientRect(), s = getComputedStyle(k); return r.width > 4 && r.height > 4 && s.position !== 'absolute' && s.position !== 'fixed'; });
      const groups = {};
      kids.forEach((k) => { (groups[cls(k)] = groups[cls(k)] || []).push(k); });
      for (const [c, list] of Object.entries(groups)) {
        if (list.length < 3) continue;
        const key = path(p) + ' > ' + c; if (seen.has(key)) continue; seen.add(key);
        const R = list.map((k) => k.getBoundingClientRect()), rows = {};
        R.forEach((r) => { const t = Math.round(r.top / 4) * 4; (rows[t] = rows[t] || []).push(r); });
        const rl = Object.values(rows).filter((x) => x.length > 1);
        const spread = (a) => r1(Math.max(...a) - Math.min(...a));
        const h = spread(R.map((r) => r.height)), w = spread(R.map((r) => r.width));
        const rowH = rl.length ? Math.max(...rl.map((x) => spread(x.map((r) => r.height)))) : 0;
        const gaps = rl.flatMap((x) => { const s = x.slice().sort((a, b) => a.left - b.left); return s.slice(1).map((r, i) => r1(r.left - s[i].right)); });
        const gap = gaps.length ? spread(gaps) : 0;
        if (h > 1.5 || w > 1.5 || rowH > 1.5 || gap > 1.5) out.push(key + ' [' + list.length + ']: ' + [h > 1.5 && 'heights ' + r1(Math.min(...R.map((r) => r.height))) + '-' + r1(Math.max(...R.map((r) => r.height))), w > 1.5 && 'widths ' + r1(Math.min(...R.map((r) => r.width))) + '-' + r1(Math.max(...R.map((r) => r.width))), rowH > 1.5 && 'in a row ' + rowH, gap > 1.5 && 'gaps ' + [...new Set(gaps)].slice(0, 6).join('/')].filter(Boolean).join(', '));
      }
    }
    const edges = ['.hero', '.cal-wrap', '.flow-card', '.poster', '.year-viewport', '.month-head', '.log-side'].flatMap((s) => [...document.querySelectorAll(s)].slice(0, 6).map((e) => { const r = e.getBoundingClientRect(); return s + ' ' + r1(r.left) + '..' + r1(r.right); }));
    return JSON.stringify({ where: ${JSON.stringify(where)}, uneven: out, edges });
  })()`);
  const cards = async () => { for (const s of ['.cal-wrap', '[data-card]:nth-of-type(1)', '.flow-card', '.flow-card:last-of-type']) { await c.js(`(() => { document.querySelectorAll(${JSON.stringify(s)}).forEach((e) => e.scrollIntoView({ block: 'center' })); return 0; })()`); await c.sleep(900); }
    await c.js(`(() => { document.querySelectorAll('[data-card]').forEach((e) => e.scrollIntoView({ block: 'center' })); window.scrollTo(0, 0); return 0; })()`); await c.sleep(1200); };
  // instant: the page scrolls smoothly, and a second scroll cut the first one short (the stills of the cards were of the top)
  const shotAt = async (sel, name) => { await c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy({ top: -24, behavior: 'instant' }); } return 0; })()`); await c.sleep(1000); await c.shot(name); };
  const flask = async () => { await c.js(`(() => { document.querySelector('button[aria-label="Add test data"]').click(); return 0; })()`); await c.sleep(2400); };
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await flask();
  c.move(700, 20); await c.sleep(600);
  await c.shot("a-fin-year"); c.log("AUDIT", await audit("finance year"));
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  // the cards' own test data, so every card has something in it
  for (const id of ["weekly expenses", "money flow", "goals"]) { await c.js(`(() => { const b = document.querySelector('[data-card="${id}"] .card-flask'); b && b.click(); return 0; })()`); await c.sleep(900); }
  await cards();
  await c.shot("a-fin-month"); await shotAt(".cal-wrap", "a-fin-cal"); await shotAt('[data-card="money flow"]', "a-fin-flow"); await shotAt('[data-card="goals"]', "a-fin-goals");
  c.log("AUDIT", await audit("finance month"));
  await c.js(`(() => { window.scrollTo(0, 0); document.querySelector('.cell .cbar') ? document.querySelectorAll('.cell')[12].click() : 0; return 0; })()`); await c.sleep(1800);
  await c.shot("a-fin-day"); c.log("AUDIT", await audit("finance day panel"));
  await c.js(`(() => { window.scrollTo(0, 0); const t = document.querySelector('.month-big'); t && t.click(); return 0; })()`); await c.sleep(2600);
  await c.shot("a-fin-wrapped"); c.log("AUDIT", await audit("finance wrapped"));
  c.key("Escape"); await c.sleep(900);
  await c.js(`(() => { document.querySelector('.foot-logo').click(); return 0; })()`); await c.sleep(4900);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1800); await c.press(".coin-unit"); await c.sleep(5000);
  await flask(); c.move(700, 20); await c.sleep(600);
  await c.shot("a-cr-year"); c.log("AUDIT", await audit("crypto year"));
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  await cards();
  await c.shot("a-cr-month"); await shotAt(".cal-wrap", "a-cr-cal"); await shotAt('[data-card="PnL analysis"]', "a-cr-an"); await shotAt('[data-card="performance"]', "a-cr-perf"); await shotAt('[data-card="coins"]', "a-cr-coins");
  c.log("AUDIT", await audit("crypto month"));
  await c.js(`(() => { window.scrollTo(0, 0); const t = document.querySelector('.month-big'); t && t.click(); return 0; })()`); await c.sleep(2600);
  await c.shot("a-cr-wrapped"); c.log("AUDIT", await audit("crypto wrapped"));
};
// The monthly spending rule (15 October 2026): set from the Money flow section on test data, then what the month's card,
// the daily limit box, the section and the saved data say; then 70/30 for this month only. --shots --fresh
const rulecheck = async (c) => {
  const read = () => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'), lim = document.querySelector('.limit-input');
    return JSON.stringify({ pill: (document.querySelector('.rule-pill') || {}).innerText || null, limit: lim && lim.value, locked: !!(lim && lim.readOnly), from: (document.querySelector('.limit-rule') || {}).innerText || null,
      rows: [...document.querySelectorAll('.rule-row')].map((r) => r.innerText.replace(/\\n+/g, ' | ')), foot: (document.querySelector('.rule-foot') || {}).innerText || null,
      saved: d.rule ? d.rule.name : null, byMonth: d.ruleByMonth || null }); })()`);
  const click = (sel) => c.js(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'missing ' + ${JSON.stringify(sel)}; b.scrollIntoView({ block: 'center', behavior: 'instant' }); b.click(); return 'ok'; })()`);
  const press = (text) => c.js(`(() => { const b = [...document.querySelectorAll('.rule-modal button')].find((x) => x.innerText.trim() === ${JSON.stringify(text)}); if (!b) return 'no ' + ${JSON.stringify(text)}; b.click(); return 'ok'; })()`);
  await c.sleep(SPLASH_MS);
  await typeName(c, "Flow");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`(() => { document.querySelector('button[aria-label="Add test data"]').click(); return 0; })()`); await c.sleep(2400);
  await c.press(".ycell", await monthBox(c)); await c.sleep(3800);
  c.log("BEFORE", await read());
  c.log("SET A RULE", await click('.rule-sec .rule-btn')); await c.sleep(900);
  await c.shot("r-pop", { x: 380, y: 40, width: 680, height: 820 });
  await c.js(`(() => { document.querySelector('.rule-modal .tcfg-go').click(); return 0; })()`); await c.sleep(1600);
  c.log("50/30/20 FOR EVERY MONTH", await read());
  await c.js(`window.scrollTo({ top: 0, behavior: 'instant' }); 0`); await c.sleep(800); await c.shot("r-top");
  await click('.rule-sec'); await c.js(`(() => { const e = document.querySelector('.rule-sec'); e.scrollIntoView({ block: 'center', behavior: 'instant' }); return 0; })()`); await c.sleep(1200); await c.shot("r-sec");
  await click('.rule-sec .rule-btn'); await c.sleep(900);
  c.log("SPEND/SAVE", await press("Spend / save"), await press("70/30"), await press("Only " + (await c.js(`(() => { const b = [...document.querySelectorAll('.rule-modal button')].find((x) => x.innerText.startsWith('Only ')); return b ? b.innerText.slice(5) : ''; })()`))));
  await c.sleep(300); await c.js(`(() => { document.querySelector('.rule-modal .tcfg-go').click(); return 0; })()`); await c.sleep(1600);
  c.log("70/30 FOR THIS MONTH ONLY", await read());
};
// Home, the dashboard (--shots --profile=dash --fresh; 20 October 2026). Test data only. On crypto: the dashboard
// filled, a widget held and dragged onto another (a swap), one resized by its corner, snap off with a free drag and a
// free resize, snap on again (half cells), one removed and put back with Undo, a layout put in and taken back with
// Undo, one added from the gallery, the shortcut buttons measured (square), a period chip, a day pressed, Home's button
// under the menu, the Classic start screen and back. Then finance: in from the wallet (the greeting gives way to Home),
// filled, a layout, the light look. After each: the saved layout, whether every widget stands where it says, text
// that should never show, and what is cut off inside a widget.
const dash = async (c) => {
  const lay = () => c.js(`(() => { const k = Object.keys(localStorage).filter((k) => /prefs$/.test(k) && localStorage.getItem(k).includes('"dash":{')).sort().pop();
    const p = k ? JSON.parse(localStorage.getItem(k)) : null; if (!p || !p.dash) return "as it comes";
    return k + " " + (p.dash.snap ? "snap " : "free ") + (p.dash.preset ? "[" + p.dash.preset + "] " : "") + p.dash.items.map((o) => o.id + "@" + o.x + "," + o.y + ":" + o.w + "x" + o.h + (o.o ? JSON.stringify(o.o) : "")).join(" "); })()`);
  const audit = (name) => c.js(`(() => {
    const b = document.querySelector(".dg-board"); if (!b) return "no board";
    const u = parseFloat(b.style.getPropertyValue("--u")), cut = [];
    const odd = (b.innerText.match(/NaN|undefined|Infinity|\\[object|Invalid Date|\\bnull\\b/g) || []).join(",");
    for (const w of b.querySelectorAll(".wdg")) {
      const inr = w.querySelector(".wd-in").getBoundingClientRect();
      for (const el of w.querySelectorAll(".wd-in *")) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (r.bottom > inr.bottom + 4 || r.right > inr.right + 4) { cut.push(w.dataset.w + "/" + w.dataset.c + ":" + (typeof el.className === "string" ? el.className : el.tagName) + " " + Math.round(r.bottom - inr.bottom) + "," + Math.round(r.right - inr.right)); break; }
      }
    }
    const acts = [...b.querySelectorAll(".wd-act")].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); }).join(" ");
    return "pitch " + u.toFixed(1) + " · widgets " + b.querySelectorAll(".wdg").length + " · odd text [" + odd + "] · cut [" + cut.join(" ; ") + "] · shortcut buttons [" + acts + "]";
  })()`).then((r) => c.log("AUDIT", name, r));
  const place = (name) => c.js(`(() => {
    const k = Object.keys(localStorage).filter((k) => /prefs$/.test(k) && localStorage.getItem(k).includes('"dash":{')).sort().pop(); if (!k) return "no saved layout";
    const items = JSON.parse(localStorage.getItem(k)).dash.items, b = document.querySelector(".dg-board"), u = parseFloat(b.style.getPropertyValue("--u"));
    const cells = [...b.querySelectorAll(".dg-cell")], off = [];
    items.forEach((o, i) => { const m = /translate3d\\(([-\\d.]+)px, ([-\\d.]+)px/.exec(cells[i] ? cells[i].style.transform : ""); if (!m || Math.abs(m[1] - o.x * u) > 0.6 || Math.abs(m[2] - o.y * u) > 0.6) off.push(o.id); });
    return cells.length + " cells, " + (off.length ? "OFF: " + off.join(",") : "all where the layout says");
  })()`).then((r) => c.log("PLACE", name, r));
  const box = (sel, nth = 0) => c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return null; el.scrollIntoView({ block: "nearest", behavior: "instant" }); const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
  const drag = async (x0, y0, x1, y1, hold = 80) => {
    c.wc.sendInputEvent({ type: "mouseMove", x: Math.round(x0), y: Math.round(y0) }); await c.sleep(50);
    c.wc.sendInputEvent({ type: "mouseDown", x: Math.round(x0), y: Math.round(y0), button: "left", clickCount: 1 }); await c.sleep(hold);
    for (let i = 1; i <= 18; i++) c.wc.sendInputEvent({ type: "mouseMove", x: Math.round(x0 + ((x1 - x0) * i) / 18), y: Math.round(y0 + ((y1 - y0) * i) / 18), modifiers: ["leftButtonDown"] }), await c.sleep(18);
    await c.sleep(150);
    c.wc.sendInputEvent({ type: "mouseUp", x: Math.round(x1), y: Math.round(y1), button: "left", clickCount: 1 }); await c.sleep(700);
  };
  const cellOf = (id) => `.dg-cell:has(> .wdg[data-w="${id}"])`;
  const into = async (sel, nth = 0) => { await c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(350); return c.press(sel, nth); };
  const tap = (text, sel) => c.js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.innerText.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`);
  const flask = async () => { await into('button[aria-label="Add test data"]'); await c.sleep(2800); };
  const home = async () => { await into(".foot-logo"); await c.sleep(4600); };
  const top = () => c.js(`window.scrollTo({ top: 0, behavior: "instant" })`);
  const where = (name) => c.js(`JSON.stringify({ home: !!document.querySelector(".dash"), year: !!document.querySelector(".year-viewport"), month: !!document.querySelector(".month-view"), homeBtn: !!document.querySelector(".snav-home") })`).then((r) => c.log("WHERE", name, r));
  const intoCrypto = async () => { await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000); };
  await c.sleep(SPLASH_MS);
  await typeName(c, "Rassam");
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await intoCrypto();
  await flask(); await top(); await c.sleep(1800);
  await c.shot("crypto-home"); await audit("crypto-home"); c.log("LAYOUT", "start", await lay());
  // held, then dragged onto its neighbour of the same size: the two change places
  let a = await box(cellOf("win")), b = await box(cellOf("streak"));
  await drag(a.l + a.w / 2, a.t + a.h / 2, b.l + b.w / 2, b.t + b.h / 2, 650);
  c.log("LAYOUT", "after hold-drag win onto streak", await lay()); await place("swap");
  // a half-cell move: the Streak widget dragged 52px to the left
  a = await box(cellOf("streak"));
  await drag(a.l + 40, a.t + 40, a.l + 40 - 52, a.t + 40);
  c.log("LAYOUT", "streak half a cell left", await lay()); await place("half");
  // the PnL widget's corner pulled down two cells and a half: 4 × 4.5
  a = await box(`${cellOf("pnl")} .dg-rz`);
  await drag(a.l + a.w / 2, a.t + a.h / 2, a.l + a.w / 2 + 6, a.t + a.h / 2 + 258);
  c.log("LAYOUT", "after resize pnl", await lay()); await place("resize"); await c.sleep(400); await c.shot("crypto-edit"); await audit("resized");
  // snap off: a free drag and a free resize; snap on again
  await c.press(".dg-snap"); await c.sleep(500);
  a = await box(cellOf("acts"));
  await drag(a.l + 40, a.t + 40, a.l + 77, a.t + 40 + 29);
  a = await box(`${cellOf("streak")} .dg-rz`);
  await drag(a.l + a.w / 2, a.t + a.h / 2, a.l + a.w / 2 + 53, a.t + a.h / 2 + 31);
  c.log("LAYOUT", "free", await lay()); await place("free");
  await top(); await c.press(".dg-snap"); await c.sleep(700);
  c.log("LAYOUT", "snap on again", await lay()); await place("snap-again");
  // removed, then Undo
  await top(); await c.sleep(300);
  await c.press(`${cellOf("bal")} .dg-rm`); await c.sleep(900);
  c.log("LAYOUT", "bal removed", await lay());
  await c.press(".dg-toast button"); await c.sleep(900);
  c.log("LAYOUT", "after undo", await lay()); await place("undo");
  // a layout, then Undo
  await c.press(".dash-tools .dg-btn", 0); await c.sleep(900); await c.shot("crypto-layouts");
  await c.press(".dg-pre-it", 1); await c.sleep(1800);
  c.log("LAYOUT", "day trader", await lay()); await place("preset"); await c.shot("crypto-preset"); await audit("preset");
  await c.press(".dg-toast button"); await c.sleep(900);
  c.log("LAYOUT", "after undo", await lay());
  // the gallery: Today, medium
  await top(); await c.press(".dash-tools .dg-btn", 1); await c.sleep(900);
  const it = await c.js(`[...document.querySelectorAll(".dg-gal-it")].findIndex((e) => e.querySelector("b").innerText === "Today")`);
  await c.press(".dg-gal-it", it); await c.sleep(500);
  await c.press(".dg-gal-main .wr-seg button", 1); await c.sleep(600);
  await c.press(".dg-gal-main .dg-btn.pri"); await c.sleep(1300);
  c.log("LAYOUT", "today added", await lay()); await place("added");
  await top(); await c.press(".dash-tools .dg-btn.pri"); await c.sleep(700);      // Done
  await audit("done"); await c.js(`window.scrollTo({ top: 760, behavior: "instant" })`); await c.sleep(900); await c.shot("crypto-home-2"); await top();
  // a period chip, a day of the calendar, Home's button under the menu
  await c.press(`${cellOf("pnl")} .wd-chip`); await c.sleep(700);
  c.log("LAYOUT", "pnl period", await lay());
  await into(".wd-day.now"); await c.sleep(2600); await where("day pressed");
  await c.shot("crypto-month-homebtn", { x: 0, y: 0, width: 400, height: 200 });
  await c.press(".snav-home"); await c.sleep(1600); await where("home button");
  // the Classic start screen, and back
  await into('button[aria-label="Settings"]'); await c.sleep(900);
  c.log("CLASSIC", await tap("Classic", ".wr-seg button")); await c.sleep(900); c.key("Escape"); await c.sleep(900); await where("classic chosen");
  await home(); await intoCrypto(); await where("crypto entered, classic");
  await into('button[aria-label="Settings"]'); await c.sleep(900);
  c.log("HOME", await tap("Home", ".wr-seg button")); await c.sleep(900); c.key("Escape"); await c.sleep(900); await where("home chosen");
  // finance: in from the wallet, the greeting gives way to Home
  await home();
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(1200); await c.shot("finance-greeting"); await c.sleep(5300);
  await where("finance entered");
  await c.shot("finance-empty"); await audit("finance-empty");
  await flask(); await top(); await c.sleep(1800); await c.shot("finance-home"); await audit("finance-home");
  await c.js(`window.scrollTo({ top: 760, behavior: "instant" })`); await c.sleep(900); await c.shot("finance-home-2"); await top(); await c.sleep(400);
  await c.press(".dash-tools .dg-btn.pri"); await c.sleep(600);          // Edit widgets
  await c.press(".dash-tools .dg-btn", 0); await c.sleep(900); await c.shot("finance-layouts");
  await c.press(".dg-pre-it", 2); await c.sleep(1800);
  c.log("LAYOUT", "finance saver", await lay()); await place("finance-preset"); await c.shot("finance-preset"); await audit("finance-preset");
  await c.press(".dash-tools .dg-btn.pri"); await c.sleep(600);          // Done
  await into('button[aria-label="Settings"]'); await c.sleep(900); await c.press(".th-sw"); await c.sleep(900); c.key("Escape"); await c.sleep(1200);
  await top(); await c.sleep(500); await c.shot("finance-light"); await audit("finance-light");
  await into('button[aria-label="Settings"]'); await c.sleep(900); await c.press(".th-sw"); await c.sleep(900); c.key("Escape"); await c.sleep(600);
};
// the Layouts sheet alone (--shots --profile=dash, after a dash run): crypto, test data, Edit, Layouts
const dashpre = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await c.press(".dash-tools .dg-btn.pri"); await c.sleep(600); await c.press(".dash-tools .dg-btn", 0); await c.sleep(1200); await c.shot("layouts");
};
// the liquid glass slider on the capsule buttons (--shots --profile=dash, after a dash run): crypto's Home at the
// clearest, the default and the most tinted, the header's buttons as stills and the Log button's computed body
const glassk = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  for (const [name, k] of [["clear", 0.2], ["default", 1], ["tinted", 1.6]]) {
    await c.js(`document.documentElement.style.setProperty("--lg-k", "${k}")`); await c.sleep(500);
    c.log("LENS", name, await c.js(`getComputedStyle(document.querySelectorAll(".dash-tools .dg-btn")[1]).backgroundImage.slice(0, 160)`));
    await c.shot(`buttons-${name}`, { x: 900, y: 40, width: 540, height: 80 });
  }
};
// every widget at sizes between the four iOS ones (--shots --profile=dash, after a dash run; 20 October 2026): on crypto
// and on finance, all widgets at 3.5 × 2.5, then 6 × 3, then 2.5 × 4 (each at least its own smallest), the page zoomed
// out so a board is one still; after each, what is cut off inside a widget and text that should never show
const dashfit = async (c) => {
  const MIN = { curve: [4, 2], year: [4, 2], fweek: [4, 2], frecent: [4, 2], fyear: [4, 2] };
  const ids = { crypto: ["bal", "pnl", "win", "curve", "cal", "year", "names", "recent", "prices", "streak", "today", "sides", "acts"],
                finance: ["ftoday", "fmonth", "fweek", "fcal", "fcats", "frecent", "fgoals", "fdebts", "fyear", "fincome", "fstreak", "facts"] };
  const pack = (list, w0, h0) => {
    const items = []; let x = 0, y = 0, rowH = 0;
    list.forEach((id, i) => {
      const [mw, mh] = MIN[id] || [2, 2], w = Math.max(mw, w0), h = Math.max(mh, h0);
      if (x + w > 12) { x = 0; y += rowH; rowH = 0; }
      items.push({ k: `w${i + 1}`, id, x, y, w, h }); x += w; rowH = Math.max(rowH, h);
    });
    return { snap: true, items };
  };
  const audit = (name) => c.js(`(() => {
    const b = document.querySelector(".dg-board"); if (!b) return "no board";
    const cut = [], odd = (b.innerText.match(/NaN|undefined|Infinity|\\[object|Invalid Date|\\bnull\\b/g) || []).join(",");
    for (const w of b.querySelectorAll(".wdg")) {
      const inr = w.querySelector(".wd-in").getBoundingClientRect();
      for (const el of w.querySelectorAll(".wd-in *")) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        if (r.bottom > inr.bottom + 3 || r.right > inr.right + 3) { cut.push(w.dataset.w + ":" + (typeof el.className === "string" ? el.className : el.tagName) + " " + Math.round(r.bottom - inr.bottom) + "," + Math.round(r.right - inr.right)); break; }
      }
    }
    return "widgets " + b.querySelectorAll(".wdg").length + " · odd [" + odd + "] · cut [" + cut.join(" ; ") + "]";
  })()`).then((r) => c.log("AUDIT", name, r));
  const into = async (sel) => { await c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(350); return c.press(sel); };
  const home = async () => { await c.js(`document.documentElement.style.zoom = ""`); await into(".foot-logo"); await c.sleep(4600); };
  const enter = { crypto: async () => { await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000); },
                  finance: async () => { await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500); } };
  await c.sleep(SPLASH_MS);
  for (const side of ["crypto", "finance"]) for (const [w, h] of [[3.5, 2.5], [6, 3], [2.5, 4]]) {
    const key = side === "crypto" ? "pnl-crypto-prefs" : "pnl-finance-prefs";
    await c.js(`(() => { const p = JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || "{}"); p.dash = ${JSON.stringify(pack(ids[side], w, h))}; p.home = true; localStorage.setItem(${JSON.stringify(key)}, JSON.stringify(p)); })()`);
    // a trading side reads its prefs each time it is entered; finance once a page load
    if (side === "finance") { await c.js(`location.reload()`); await c.sleep(SPLASH_MS + 800); }
    else if (await c.js(`!!document.querySelector(".dash") || !!document.querySelector(".year-viewport")`)) await home();
    await enter[side]();
    await c.js(`(() => { document.documentElement.style.zoom = "0.5"; window.scrollTo({ top: 0, behavior: "instant" }); })()`); await c.sleep(2200);
    await c.shot(`${side}-${w}x${h}`); await audit(`${side} ${w}x${h}`);
  }
};
// the empty space inside every widget (--profile=dash, after a dash run; 23 October 2026, his words: "fix the other widgets
// with the big empty space problem"): on crypto and finance, all widgets at 2×2, 4×2, 4×4, 8×4, 3×3 and 6×3 (each at
// least its own smallest); per widget the widest band across its inside where nothing is drawn, up and down (v) and
// side to side (h), as a share of the inside. Listed when either is over 28%; a still per pass (`--shots`)
const dashgap = async (c) => {
  const MIN = { curve: [4, 2], year: [4, 2], fweek: [4, 2], frecent: [4, 2], fyear: [4, 2] };
  const ids = { crypto: ["bal", "pnl", "win", "curve", "cal", "year", "names", "recent", "prices", "streak", "today", "sides", "acts", "xch", "plan"],
                finance: ["ftoday", "fmonth", "fweek", "fcal", "fcats", "frecent", "fgoals", "fdebts", "fyear", "fincome", "fstreak", "facts", "fxch", "fplan"] };
  const pack = (list, w0, h0) => {
    const items = []; let x = 0, y = 0, rowH = 0;
    list.forEach((id, i) => {
      const [mw, mh] = MIN[id] || [2, 2], w = Math.max(mw, w0), h = Math.max(mh, h0);
      if (x + w > 12) { x = 0; y += rowH; rowH = 0; }
      items.push({ k: `w${i + 1}`, id, x, y, w, h }); x += w; rowH = Math.max(rowH, h);
    });
    return { snap: true, items };
  };
  const measure = (name) => c.js(`(() => {
    const b = document.querySelector(".dg-board"); if (!b) return "no board";
    const out = [];
    for (const w of b.querySelectorAll(".wdg")) {
      const inr = w.querySelector(".wd-in").getBoundingClientRect(), H = Math.max(1, Math.round(inr.height)), W = Math.max(1, Math.round(inr.width));
      const rows = new Uint8Array(H), cols = new Uint8Array(W);
      for (const el of w.querySelectorAll(".wd-in *")) {
        const tag = el.tagName.toLowerCase();
        if (tag !== "svg" && el.closest("svg")) continue;
        if (!(tag === "svg" || tag === "button" || tag === "input" || !el.children.length)) continue;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
        const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
        for (let y = Math.max(0, Math.floor(r.top - inr.top)); y < Math.min(H, Math.ceil(r.bottom - inr.top)); y++) rows[y] = 1;
        for (let x = Math.max(0, Math.floor(r.left - inr.left)); x < Math.min(W, Math.ceil(r.right - inr.left)); x++) cols[x] = 1;
      }
      const run = (a) => { let m = 0, n = 0; for (const v of a) { n = v ? 0 : n + 1; m = Math.max(m, n); } return m; };
      const gv = run(rows) / H, gh = run(cols) / W;
      if (gv > 0.28 || gh > 0.28) out.push(w.dataset.w + " v" + Math.round(gv * 100) + " h" + Math.round(gh * 100) + " (" + W + "x" + H + ")");
    }
    return out.join(" | ") || "none";
  })()`).then((r) => c.log("GAP", name, r));
  const into = async (sel) => { await c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(350); return c.press(sel); };
  const home = async () => { await c.js(`document.documentElement.style.zoom = ""`); await into(".foot-logo"); await c.sleep(4600); };
  const enter = { crypto: async () => { await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000); },
                  finance: async () => { await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500); } };
  await c.sleep(SPLASH_MS);
  for (const side of ["crypto", "finance"]) for (const [w, h] of [[2, 2], [4, 2], [4, 4], [8, 4], [3, 3], [6, 3]]) {
    const key = side === "crypto" ? "pnl-crypto-prefs" : "pnl-finance-prefs";
    await c.js(`(() => { const p = JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || "{}"); p.dash = ${JSON.stringify(pack(ids[side], w, h))}; p.home = true; localStorage.setItem(${JSON.stringify(key)}, JSON.stringify(p)); })()`);
    if (side === "finance") { await c.js(`location.reload()`); await c.sleep(SPLASH_MS + 800); }
    else if (await c.js(`!!document.querySelector(".dash") || !!document.querySelector(".year-viewport")`)) await home();
    await enter[side]();
    await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(2400);
    await measure(`${side} ${w}x${h}`);
    await c.js(`(() => { document.documentElement.style.zoom = "0.5"; window.scrollTo({ top: 0, behavior: "instant" }); })()`); await c.sleep(900);
    await c.shot(`${side}-${w}x${h}`);
    await c.js(`document.documentElement.style.zoom = ""`);
  }
};
// widget stacks and the Shortcuts filling their box (usual profile, `--shots`; 23 October 2026): finance's Home given a
// known board (its own is put back at the end); Shortcuts stills at medium and small; edit mode, the stack button on
// Shortcuts, the sheet in its stack mode, Streak added; what is saved; real wheel steps over the stack, a dot pressed;
// the − taking out the widget on show, Undo; the stack in the light look
const stacks = async (c) => {
  const KEY = "pnl-finance-prefs";
  const board = { snap: true, items: [{ k: "w1", id: "facts", x: 0, y: 0, w: 4, h: 2 }, { k: "w2", id: "facts", x: 4, y: 0, w: 2, h: 2 }, { k: "w3", id: "fmonth", x: 6, y: 0, w: 4, h: 2 },
    { k: "w4", id: "fcal", x: 0, y: 2, w: 4, h: 4, st: [{ id: "fcal" }, { id: "fcats", o: { per: "m" } }, { id: "fmonth" }], at: 0 }, { k: "w5", id: "ftoday", x: 4, y: 2, w: 6, h: 3 }, { k: "w6", id: "fstreak", x: 10, y: 0, w: 2, h: 4 }] };
  const was = await c.js(`localStorage.getItem(${JSON.stringify(KEY)})`);
  const saved = (tag) => c.js(`(() => { const p = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "{}"); return JSON.stringify((p.dash && p.dash.items || []).map((o) => o.k + ":" + o.id + " " + o.w + "x" + o.h + (o.st ? " [" + o.st.map((q) => q.id).join(",") + "] at " + o.at : ""))); })()`).then((v) => c.log("SAVED", tag, v));
  const dom = (tag) => c.js(`JSON.stringify([...document.querySelectorAll(".dg-stack")].map((s) => ({ k: s.closest(".dg-cell").dataset.k, top: Math.round(s.querySelector(".dg-stk").scrollTop), h: s.querySelector(".dg-stk").clientHeight,
    dots: s.querySelectorAll(".dg-dots button").length, on: [...s.querySelectorAll(".dg-dots button")].findIndex((b) => b.classList.contains("on")), shown: [...s.querySelectorAll(".dg-pg")].map((g) => (g.inert ? "-" : "+") + g.querySelector(".wdg").dataset.w).join(" ") })))`).then((v) => c.log("STACKS", tag, v));
  const rect = (sel) => c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 14), y: Math.max(0, Math.round(b.top) - 14), width: Math.round(b.width) + 28, height: Math.round(b.height) + 28 }; })()`);
  const shot = async (sel, name) => { const r = await rect(sel); if (r) await c.shot(name, r); else c.log("NO", sel); };
  const wheel = async (sel, dy) => { const r = await c.js(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
    c.wc.sendInputEvent({ type: "mouseMove", x: r.x, y: r.y }); await c.sleep(60); c.wc.sendInputEvent({ type: "mouseWheel", x: r.x, y: r.y, deltaX: 0, deltaY: dy, canScroll: true }); };
  const enter = async () => { await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500); };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const p = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)}) || "{}"); p.dash = ${JSON.stringify(board)}; p.home = true; localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(p)); location.reload(); })()`);
  await c.sleep(SPLASH_MS + 800); await enter();
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(1500);
  await saved("start"); await dom("start");
  await shot('.dg-cell[data-k="w1"]', "acts-medium"); await shot('.dg-cell[data-k="w2"]', "acts-small"); await shot('.dg-cell[data-k="w4"]', "stack-1");
  // wheel over the pre-made stack: one step down, then back up
  await wheel('.dg-cell[data-k="w4"]', -120); await c.sleep(200); await dom("wheel mid"); await shot('.dg-cell[data-k="w4"]', "stack-2-moving"); await c.sleep(900); await dom("wheel rest"); await saved("after wheel");
  await wheel('.dg-cell[data-k="w4"]', -120); await c.sleep(1100); await dom("wheel 2"); await shot('.dg-cell[data-k="w4"]', "stack-3");
  await c.js(`document.querySelectorAll('.dg-cell[data-k="w4"] .dg-dots button')[0].click()`); await c.sleep(1200); await dom("dot 0"); await saved("after dot");
  // edit: stack Streak onto the Shortcuts
  await c.press('button[aria-label="Edit widgets"]'); await c.sleep(800);
  await c.press('.dg-cell[data-k="w1"] .dg-sk'); await c.sleep(1100);
  c.log("SHEET", await c.js(`JSON.stringify({ label: document.querySelector('.dg-gal').getAttribute('aria-label'), list: [...document.querySelectorAll('.dg-gal-it b')].map((b) => b.textContent), btn: document.querySelector('.dg-gal-main .dg-btn.pri').textContent, fit: (document.querySelector('.dg-gal-fit') || {}).textContent })`));
  await shot(".dg-gal", "sheet-stack-mode");
  await c.js(`(() => { const b = [...document.querySelectorAll('.dg-gal-it')].find((x) => x.textContent.includes('Streak')); b.scrollIntoView({ block: "center" }); b.click(); })()`); await c.sleep(700);
  await c.press(".dg-gal-main .dg-btn.pri.big"); await c.sleep(1200);
  await saved("stacked"); await dom("stacked"); await shot('.dg-cell[data-k="w1"]', "stack-4-edit");
  await c.press('.dg-cell[data-k="w1"] .dg-rm'); await c.sleep(900); await saved("taken out"); await dom("taken out");
  await c.js(`(() => { const b = document.querySelector('.dg-toast button'); if (b) b.click(); })()`); await c.sleep(900); await saved("undo"); await dom("undo");
  await c.js(`(() => { const b = [...document.querySelectorAll('.dash-tools .dg-btn.pri')].pop(); if (b) b.click(); })()`); await c.sleep(900);
  // the light look
  await c.js(`localStorage.setItem("flow-theme", "light"); location.reload()`); await c.sleep(SPLASH_MS + 800); await enter();
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(1500);
  await shot('.dg-cell[data-k="w4"]', "stack-light"); await shot('.dg-cell[data-k="w1"]', "acts-light");
  await c.js(`(() => { localStorage.removeItem("flow-theme"); const w = ${JSON.stringify(was)}; if (w === null) localStorage.removeItem(${JSON.stringify(KEY)}); else localStorage.setItem(${JSON.stringify(KEY)}, w); })()`);
  c.log("PUT BACK");
};
// the layouts with stacks (usual profile, `--shots`; 23 October 2026): on finance and on crypto, the Layouts sheet, then each
// of Smart stacks, the side's own one and One row picked; what is saved (stacks, places, holes left on the board) and a
// still of the board zoomed out; each side's own board put back at the end
const stackpre = async (c) => {
  const keys = ["pnl-finance-prefs", "pnl-crypto-prefs"], was = {};
  for (const k of keys) was[k] = await c.js(`localStorage.getItem(${JSON.stringify(k)})`);
  const rect = (sel) => c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left)), y: Math.max(0, Math.round(b.top)), width: Math.round(b.width), height: Math.round(b.height) }; })()`);
  const saved = (key, tag) => c.js(`(() => { const p = JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || "{}"), it = (p.dash && p.dash.items) || [];
    const rows = it.reduce((m, o) => Math.max(m, o.y + o.h), 0); let holes = 0;
    for (let y = 0; y < rows; y += 0.5) for (let x = 0; x < 12; x += 0.5) if (!it.some((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)) holes++;
    const n = it.reduce((a, o) => a + (o.st ? o.st.length : 1), 0);
    return p.dash.preset + " · boxes " + it.length + " · widgets " + n + " · holes " + holes + " · " + it.map((o) => o.w + "x" + o.h + "@" + o.x + "," + o.y + " " + (o.st ? "[" + o.st.map((q) => q.id + (q.o ? JSON.stringify(q.o) : "")).join(" ") + "]" : o.id)).join(" | "); })()`).then((v) => c.log("LAYOUT", tag, v));
  const into = async (sel) => { await c.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(350); return c.press(sel); };
  const enter = { crypto: async () => { await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000); },
                  finance: async () => { await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500); } };
  const pick = async (key, side, name) => {
    await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
    if (!(await c.js(`!!document.querySelector('.dash-tools .dg-btn.pri:not(.ico)')`))) { await c.press('button[aria-label="Edit widgets"]'); await c.sleep(800); }
    await c.js(`[...document.querySelectorAll('.dash-tools .dg-btn')].find((b) => b.textContent.includes('Layouts')).click()`); await c.sleep(900);
    if (name === "Smart stacks") { const r = await rect(".dg-pre"); if (r) await c.shot(`${side}-sheet`, r); }
    const ok = await c.js(`(() => { const b = [...document.querySelectorAll('.dg-pre-it')].find((x) => x.querySelector('.dg-pre-t b').textContent === ${JSON.stringify(name)}); if (!b) return false; b.click(); return true; })()`);
    if (!ok) { c.log("NO PRESET", side, name); return; }
    await c.sleep(1800); await saved(key, `${side} ${name}`);
    await c.js(`(() => { const b = [...document.querySelectorAll('.dash-tools .dg-btn.pri')].pop(); if (b) b.click(); document.documentElement.style.zoom = "0.5"; window.scrollTo({ top: 0, behavior: "instant" }); })()`); await c.sleep(1600);
    await c.shot(`${side}-${name.replace(/\s+/g, "-").toLowerCase()}`);
    c.log("ODD", side, name, await c.js(`(document.querySelector(".dg-board").innerText.match(/NaN|undefined|Infinity|\\[object|Invalid Date|\\bnull\\b/g) || []).join(",") || "none"`));
    await c.js(`document.documentElement.style.zoom = ""`); await c.sleep(300);
  };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const p = JSON.parse(localStorage.getItem("pnl-finance-prefs") || "{}"); p.home = true; localStorage.setItem("pnl-finance-prefs", JSON.stringify(p)); location.reload(); })()`);
  await c.sleep(SPLASH_MS + 800); await enter.finance();
  for (const name of ["Smart stacks", "Payday", "One row"]) await pick("pnl-finance-prefs", "finance", name);
  await into(".foot-logo"); await c.sleep(4600); await enter.crypto();
  for (const name of ["Smart stacks", "Trading session", "One row"]) await pick("pnl-crypto-prefs", "crypto", name);
  await c.js(`(() => { const w = ${JSON.stringify(was)}; for (const k in w) { if (w[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, w[k]); } })()`);
  c.log("PUT BACK");
};
// the split boxes of an income over months put their dots in as they are typed (--fresh; 23 October 2026, his picture of
// "6000000": "add decimal points here"): 7.500.000 logged, its months opened, 6000000 typed in the first box with real
// keys; the value and the caret after each step, then ← three times and a 5
const splitdots = async (c) => {
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "keyDown", keyCode: ch }); c.wc.sendInputEvent({ type: "char", keyCode: ch }); c.wc.sendInputEvent({ type: "keyUp", keyCode: ch }); await c.sleep(40); } };
  const key = async (k) => { c.wc.sendInputEvent({ type: "keyDown", keyCode: k }); c.wc.sendInputEvent({ type: "keyUp", keyCode: k }); await c.sleep(60); };
  const box = (tag) => c.js(`(() => { const i = document.activeElement; return JSON.stringify({ cls: i.className, v: i.value, caret: i.selectionStart, rest: [...document.querySelectorAll(".sp-val")].map((e) => e.textContent) }); })()`).then((v) => c.log("BOX", tag, v));
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500);
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { /* attached already */ }
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelector('.split-btn.inc').scrollIntoView({ block: 'center' })`); await c.sleep(500);
  await c.js(`(() => { const d = document.querySelector('input[placeholder^="Description — e.g. salary"]'); d.parentElement.querySelector('input').focus(); })()`); await type("7500000");
  await c.js(`document.querySelector('input[placeholder^="Description — e.g. salary"]').focus()`); await type("Allowance"); c.key("Enter"); await c.sleep(900);
  await c.press(".span-btn"); await c.sleep(900);
  await c.js(`(() => { const i = document.querySelector(".note-fold.open .sp-in"); i.focus(); i.select(); })()`); await c.sleep(200);
  await type("6"); await box("6"); await type("000"); await box("6000"); await type("000"); await box("6000000");
  for (let n = 0; n < 3; n++) await key("Left");
  await box("left x3"); await type("5"); await box("typed 5");
  await key("Enter"); await c.sleep(600); await box("enter");
  const pad = () => c.js(`(() => { const b = document.querySelector(".note-fold.open .note-pad").getBoundingClientRect(); return { x: Math.round(b.left) - 10, y: Math.round(b.top) - 30, width: Math.round(b.width) + 20, height: Math.round(b.height) + 40 }; })()`);
  await c.shot("split-2", await pad());
  await c.js(`document.querySelector(".note-fold.open .sp-act").click()`); await c.sleep(900); await c.shot("split-3", await pad());
  c.log("PARTS", await c.js(`JSON.stringify([...document.querySelectorAll(".note-fold.open .sp-lab")].map((e) => e.textContent))`));
};
// the liquid glass slider stepped with the arrow keys in crypto's settings (--profile=dash): each step fades the page
// (glassFade, a view transition); the log says whether the engine has them, the number after each step, and any error
const glassfade = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  c.log("VT", await c.js(`typeof document.startViewTransition`));
  await c.js(`(() => { const el = document.querySelector('button[aria-label="Settings"]'); el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(400);
  await c.press('button[aria-label="Settings"]'); await c.sleep(900);
  await c.js(`document.querySelector(".lg-sl input").focus()`);
  for (const k of ["Right", "Right", "Left", "Left"]) {
    c.key(k); await c.sleep(160);
    c.log("STEP", k, await c.js(`JSON.stringify({ k: document.documentElement.style.getPropertyValue("--lg-k"), fading: !!document.querySelector(":root:active-view-transition") })`).catch((e) => "err " + e.message));
    await c.sleep(600);
  }
  c.key("Escape"); await c.sleep(500);
};
// the calculator beside the exchanger (--shots for a still, the usual profile; 23 October 2026): ⌘E on crypto's Home, where
// the two stand, a sum pressed on the keypad, one typed once the keypad has been pressed, ⌘E closes both
const calcpad = async (c) => {
  const cmdE = () => c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true, bubbles: true, cancelable: true })); 0`);
  const typeK = (k) => c.js(`(document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(k)}, bubbles: true, cancelable: true })); 0`);   // at the focused element, as a real key press arrives
  const say = () => c.js(`JSON.stringify({ calc: !!document.querySelector(".calc-sheet"), line: (document.querySelector(".calc-line") || {}).textContent, big: (document.querySelector(".calc-big") || {}).textContent, so: (document.querySelector(".calc-so") || {}).textContent, keys: document.activeElement && !!document.activeElement.closest(".calc-sheet"), typed: (document.querySelector(".fx-row.on input") || {}).value })`);
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await cmdE(); await c.sleep(900);
  c.log("PLACE", await c.js(`JSON.stringify(["fx-sheet", "calc-sheet"].map((k) => { const b = document.querySelector("." + k).getBoundingClientRect(); return [k, Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }).concat([[innerWidth, innerHeight]]))`));
  for (const k of ["ac", "1", "5", "0", "000", "*", "3", "+", "2", "5", "000"]) { await c.press(`.calc-k[data-k="${k}"]`); await c.sleep(120); }
  c.log("PRESSED", await say());
  await c.press('.calc-k[data-k="="]'); await c.sleep(500);
  c.log("EQUALS", await say());
  if (c.shots) { const r = await c.js(`(() => { const a = document.querySelector(".fx-sheet").getBoundingClientRect(), b = document.querySelector(".calc-sheet").getBoundingClientRect(); return { x: Math.round(a.left) - 12, y: Math.round(Math.min(a.top, b.top)) - 12, width: Math.round(b.right - a.left) + 24, height: Math.round(Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top)) + 24 }; })()`); await c.shot("pair", r); }
  for (const k of ["Delete", "0", ",", "1", "+", "0", ".", "2", "Enter"]) { await typeK(k); await c.sleep(100); }
  c.log("TYPED", await say());
  for (const k of ["Delete", "5", "0", "0", "0", "0", "+", "1", "0", "%"]) { await typeK(k); await c.sleep(100); }
  c.log("PERCENT", await say());
  await cmdE(); await c.sleep(600);
  c.log("CLOSED", await say());
};
// the time plan (--profile=dash, after a dash run, --shots for stills; 22 October 2026): ⌘T on crypto's Home, his own
// sentence typed in, what the pop-up says; ⌘T closes it; then the Time plan widget in Add widget at each of its sizes
const timeplan = async (c) => {
  const cmdT = () => c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", metaKey: true, bubbles: true, cancelable: true })); 0`);
  const box = async (sel, name) => { if (!c.shots) return; const r = await c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 8), y: Math.max(0, Math.round(b.top) - 8), width: Math.round(b.width) + 16, height: Math.round(b.height) + 16 }; })()`); if (r) await c.shot(name, r); };
  const say = () => c.js(`JSON.stringify({ open: !!document.querySelector(".tp-sheet"), focus: !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".tp-line")), stat: (document.querySelector(".tp-sheet .fx-stat") || {}).textContent, k: (document.querySelector(".tp-k") || {}).textContent, big: (document.querySelector(".tp-sheet .tp-big") || {}).textContent, sub: (document.querySelector(".tp-sub") || {}).textContent, rows: [...document.querySelectorAll(".tp-sheet .tp-row")].map((r) => [...r.children].map((x) => x.textContent).join(" | ")) })`);
  const line = "right now is 15.23, i watch one eps of south park for 20 mins then shower for 10 mins then walk 15 mins, then i arrive at campus at _ time";
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await cmdT(); await c.sleep(700);
  c.log("OPEN", await say());
  await c.js(`(() => { const el = document.querySelector(".tp-line input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(line)}); el.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await c.sleep(1000);
  c.log("TYPED", await say());
  await box(".tp-sheet", "sheet");
  await cmdT(); await c.sleep(600);
  c.log("CLOSED", await say());
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
  await c.press('button[aria-label="Edit widgets"]'); await c.sleep(800);
  await c.press(".dash-tools .dg-btn", 1); await c.sleep(900);
  const i = await c.js(`[...document.querySelectorAll(".dg-gal-it")].findIndex((b) => /Time plan/.test(b.textContent))`);
  c.log("LISTED", i);
  if (i >= 0) {
    await c.js(`document.querySelectorAll(".dg-gal-it")[${i}].scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(300);
    await c.press(".dg-gal-it", i); await c.sleep(800);
    for (const s of [0, 1, 2]) {
      await c.press(".dg-gal-main .wr-seg button", s); await c.sleep(800);
      c.log("PREVIEW", s, await c.js(`(() => { const p = document.querySelector(".dg-gal-main .wdg"); return p ? JSON.stringify({ c: p.dataset.c, big: (p.querySelector(".tp-big") || {}).textContent, sub: (p.querySelector(".wd-sub") || {}).textContent, input: !!p.querySelector(".tpw-line input"), rows: p.querySelectorAll(".tp-row").length }) : "none"; })()`));
      await box(".dg-gal-main .wdg", `widget-${s}`);
    }
  }
  c.key("Escape"); await c.sleep(600); c.key("Escape"); await c.sleep(500);
};
// the motion pass (--profile=dash, after a dash run; 20 October 2026): whether the header's buttons ease when pressed
// (transform in their computed transition), and the day / night switch twice: a view transition, the look it lands
// on (body's colour scheme: "dark" is the light look) and the Appearance line fading up as it changes
const motionpass = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  c.log("PRESS", await c.js(`JSON.stringify([...document.querySelectorAll(".snav-burger, .snav-home, .cur-btn, .chart-btn, .ham-btn")].map((b) => b.className.split(" ")[0] + ":" + getComputedStyle(b).transitionProperty.includes("transform")))`));
  await c.js(`(() => { window.__vt = 0; const o = document.startViewTransition.bind(document); document.startViewTransition = (f) => { window.__vt++; return o(f); }; const el = document.querySelector('button[aria-label="Settings"]'); el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(400);
  await c.press('button[aria-label="Settings"]'); await c.sleep(900);
  const said = () => c.js(`JSON.stringify({ say: [...document.querySelectorAll(".set-k small")].map((s) => s.textContent).find((t) => /stay dark/.test(t)), anims: [...document.querySelectorAll(".set-k small")].reduce((n, s) => n + s.getAnimations().length, 0), scheme: getComputedStyle(document.body).colorScheme, vt: window.__vt, fading: !!document.querySelector(":root:active-view-transition") })`).catch((e) => "err " + e.message);
  c.log("OPEN", await said());
  for (const n of [1, 2]) {
    await c.press(".th-sw"); await c.sleep(150);
    c.log(`SWITCH-${n}`, await said());
    await c.sleep(900);
    c.log(`SETTLED-${n}`, await said());
  }
  c.key("Escape"); await c.sleep(500);
};
// lag on Home (--trace --profile=dash, after a dash run; 20 October 2026): each thing twice ("-1" the first time after
// the launch): into crypto (Home is the first screen), every period chip, the gallery, Layouts, edit mode, a drag,
// the board scrolled, Calendar and back, then finance in from the wallet (the greeting gives way to Home) and its chips
const homelag = async (c) => {
  const into = async (sel, nth = 0) => { await c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(300); return c.press(sel, nth); };
  const top = () => c.js(`window.scrollTo({ top: 0, behavior: "instant" })`);
  const enterCrypto = async (n) => {
    await c.step(`coin-${n}`, () => c.press(".coin-unit"), 1000);
    await c.step(`markets-${n}`, () => c.press(".coin-unit"), 1600);
    await c.step(`enter-crypto-${n}`, () => c.press(".coin-unit"), 4500);
  };
  await c.sleep(SPLASH_MS);
  await enterCrypto(1);
  const chips = await c.js(`document.querySelectorAll(".wd-chip").length`);
  for (let i = 0; i < chips; i++) for (const n of [1, 2]) { await c.step(`chip-${i}-${n}`, () => into(".wd-chip", i), 900); }
  await top(); await c.sleep(400);
  await c.step("edit-1", () => c.press(".dash-tools .dg-btn.pri"), 900);
  for (const n of [1, 2]) {
    await c.step(`gallery-${n}`, () => c.press(".dash-tools .dg-btn", 1), 1100);
    await c.step(`gallery-close-${n}`, async () => c.key("Escape"), 600);
    await c.step(`layouts-${n}`, () => c.press(".dash-tools .dg-btn", 0), 1100);
    await c.step(`layouts-close-${n}`, async () => c.key("Escape"), 600);
  }
  for (const n of [1, 2]) {
    const a = await c.js(`(() => { const r = document.querySelectorAll(".dg-cell")[2].getBoundingClientRect(); return { x: r.left + 40, y: r.top + 40 }; })()`);
    await c.step(`drag-${n}`, async () => {
      c.wc.sendInputEvent({ type: "mouseMove", x: Math.round(a.x), y: Math.round(a.y) }); await c.sleep(40);
      c.wc.sendInputEvent({ type: "mouseDown", x: Math.round(a.x), y: Math.round(a.y), button: "left", clickCount: 1 }); await c.sleep(60);
      for (let i = 1; i <= 30; i++) { c.wc.sendInputEvent({ type: "mouseMove", x: Math.round(a.x + (n === 1 ? 1 : -1) * i * 7), y: Math.round(a.y + i * 3), modifiers: ["leftButtonDown"] }); await c.sleep(16); }
      c.wc.sendInputEvent({ type: "mouseUp", x: Math.round(a.x + (n === 1 ? 210 : -210)), y: Math.round(a.y + 90), button: "left", clickCount: 1 });
    }, 1000);
  }
  await c.step("done-1", () => c.press(".dash-tools .dg-btn.pri"), 900);
  for (const n of [1, 2]) {
    await c.step(`scroll-down-${n}`, () => c.scroll(1400, 900), 1200);
    await c.step(`scroll-up-${n}`, () => c.scroll(-1600, 700), 1000);
  }
  for (const n of [1, 2]) {
    await c.step(`calendar-${n}`, () => c.press(".dash-tools .dg-btn", 0), 2200);
    await c.step(`home-btn-${n}`, () => c.press(".snav-home"), 2000);
  }
  await c.step("leave-1", () => into(".foot-logo"), 4600);
  await enterCrypto(2);
  await c.step("leave-2", () => into(".foot-logo"), 4600);
  for (const n of [1, 2]) {
    await c.step(`wallet-${n}`, () => c.press(".wallet-unit.active"), 1400);
    await c.step(`card-${n}`, () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1400);
    await c.step(`enter-finance-${n}`, () => c.press(".big-card"), 6500);
    const fc = await c.js(`document.querySelectorAll(".wd-chip").length`);
    for (let i = 0; i < fc; i++) await c.step(`fchip-${i}-${n}`, () => into(".wd-chip", i), 900);
    await top();
    if (n === 1) await c.step(`fleave-${n}`, () => into(".foot-logo"), 4600);
  }
};
// entering crypto twice, nothing else (--trace --prof, a build with --minify false: where the panel's first draw goes)
const homeenter = async (c) => {
  await c.sleep(SPLASH_MS);
  for (const n of [1, 2]) {
    await c.step(`coin-${n}`, () => c.press(".coin-unit"), 1000);
    await c.step(`markets-${n}`, () => c.press(".coin-unit"), 1600);
    await c.step(`enter-crypto-${n}`, () => c.press(".coin-unit"), 4500);
    if (n === 1) { await c.js(`document.querySelector(".foot-logo").scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(300); await c.step("leave", () => c.press(".foot-logo"), 4600); }
  }
};
// Home's header and a list row under the pointer (--shots --profile=dash): crypto, finance, finance in the light look
const dashlook = async (c) => {
  const into = async (sel) => { await c.js(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(350); return c.press(sel); };
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await c.shot("head-crypto", { x: 0, y: 0, width: 1440, height: 210 });
  const r = await c.js(`(() => { const b = document.querySelector("button.wd-row"); b.scrollIntoView({ block: "center", behavior: "instant" }); const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, l: q.left, t: q.top }; })()`);
  await c.sleep(400); c.move(r.x, r.y); await c.sleep(500);
  await c.shot("row-hover", { x: Math.max(0, Math.round(r.l - 40)), y: Math.max(0, Math.round(r.t - 60)), width: 480, height: 170 });
  await into(".foot-logo"); await c.sleep(4600);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(400);
  await c.shot("head-finance", { x: 0, y: 0, width: 1440, height: 210 });
  await into('button[aria-label="Settings"]'); await c.sleep(900); await c.press(".th-sw"); await c.sleep(900); c.key("Escape"); await c.sleep(1200);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(400);
  await c.shot("head-finance-light", { x: 0, y: 0, width: 1440, height: 210 });
  await into('button[aria-label="Settings"]'); await c.sleep(900); await c.press(".th-sw"); await c.sleep(900); c.key("Escape"); await c.sleep(600);
};
// the settings pop-up on crypto and on finance (--shots --profile=dash)
const setlook = async (c) => {
  const into = async (sel) => { await c.js(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(350); return c.press(sel); };
  const shotPop = async (name) => { const r = await c.js(`(() => { const q = document.querySelector(".set-modal").getBoundingClientRect(); return { x: Math.round(q.left) - 10, y: Math.max(0, Math.round(q.top) - 10), width: Math.round(q.width) + 20, height: Math.min(900, Math.round(q.height) + 20) }; })()`); await c.shot(name, r); };
  await c.sleep(SPLASH_MS);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  await into('button[aria-label="Settings"]'); await c.sleep(900); await shotPop("settings-crypto"); c.key("Escape"); await c.sleep(600);
  await into(".foot-logo"); await c.sleep(4600);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500);
  await into('button[aria-label="Settings"]'); await c.sleep(900); await shotPop("settings-finance"); c.key("Escape"); await c.sleep(600);
};
// scrolling after a first launch (--cold --trace, best with the cold Electron copy: see "To measure with a really empty
// graphics cache"): finance's Home scrolled down and up, a month and its cards scrolled, then the same on crypto
const coldscroll = async (c) => {
  const into = async (sel, nth = 0) => { await c.js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(300); return c.press(sel, nth); };
  const top = () => c.js(`window.scrollTo({ top: 0, behavior: "instant" })`);
  const scrolls = async (tag) => {
    for (const n of [1, 2]) {
      await c.step(`${tag}-down-${n}`, () => c.scroll(2600, 1600), 1400);
      await c.step(`${tag}-up-${n}`, () => c.scroll(-3200, 1200), 1100);
    }
  };
  await c.sleep(SPLASH_MS);
  await c.step("wallet", () => c.press(".wallet-unit.active"), 1400);
  await c.step("card", () => c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08), 1400);
  await c.step("enter-finance", () => c.press(".big-card"), 6500);
  await scrolls("fhome");
  await top(); await c.step("f-calendar", () => c.press(".dash-tools .dg-btn", 0), 2500);
  await c.step("f-month", async () => c.press(".ycell", await c.js(`new Date().getMonth()`)), 3200);
  await scrolls("fmonth");
  await top(); await c.step("f-leave", () => into(".foot-logo"), 4600);
  await c.step("coin", () => c.press(".coin-unit"), 1000);
  await c.step("markets", () => c.press(".coin-unit"), 1600);
  await c.step("enter-crypto", () => c.press(".coin-unit"), 4500);
  await scrolls("chome");
  await top(); await c.step("c-calendar", () => c.press(".dash-tools .dg-btn", 0), 2500);
  await c.step("c-month", async () => c.press(".ycell", await c.js(`new Date().getMonth()`)), 3200);
  await scrolls("cmonth");
};
// the money exchanger (--fx-rates --shots): ⌘E on finance's Home, typing, the swap, a currency picked from the list,
// one added and one taken away, then a double click on the currency pill and Home's Exchange button
const exch = async (c) => {
  const box = async (name) => { const r = await c.js(`(() => { const q = document.querySelector(".fx-sheet"); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.round(b.left) - 8, y: Math.round(b.top) - 8, width: Math.round(b.width) + 16, height: Math.round(b.height) + 16 }; })()`); if (r) await c.shot(name, r); else c.log("NO SHEET", name); };
  const typeIn = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "keyDown", keyCode: ch }); c.wc.sendInputEvent({ type: "char", keyCode: ch }); c.wc.sendInputEvent({ type: "keyUp", keyCode: ch }); await c.sleep(40); } };
  const cmdE = () => c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true, bubbles: true, cancelable: true }))`);
  const state = (tag) => c.js(`JSON.stringify({ rows: [...document.querySelectorAll(".fx-row")].map((r) => r.querySelector(".fx-nm b").textContent.replace("expand_more", "") + " " + r.querySelector("input").value + " | " + r.querySelector(".fx-rate").textContent), stat: (document.querySelector(".fx-stat") || {}).textContent, focus: document.activeElement && (document.activeElement.dataset.fx || document.activeElement.className) })`).then((s) => c.log("STATE", tag, s));
  // a hidden page takes no typed keys unless it is told it has the focus
  try { c.wc.debugger.attach("1.3"); } catch (e) { /* attached already */ }
  await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500);
  await c.step("open", cmdE, 900); await state("open"); await box("fx-1-open");
  await c.step("type", () => typeIn("250.5"), 500); await state("typed"); await box("fx-2-typed");
  await c.step("swap", () => c.press(".fx-swap"), 110); await box("fx-3-swap-mid"); await c.sleep(700); await state("swapped"); await box("fx-4-swapped");
  await c.step("pick-open", () => c.press(".fx-cur", 1), 650); await box("fx-5-list");
  await c.step("search", () => typeIn("sgd"), 400); await box("fx-6-search");
  await c.step("choose", () => c.key("Enter"), 120); await box("fx-7-roll-mid"); await c.sleep(700); await state("chosen"); await box("fx-8-chosen");
  await c.step("add-open", () => c.press(".fx-add"), 650);
  await c.step("add-search", () => typeIn("eur"), 300);
  await c.step("add", () => c.key("Enter"), 800); await state("added"); await box("fx-9-added");
  await c.step("drop", async () => { await c.js(`document.querySelectorAll(".fx-row")[2].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))`); await c.press(".fx-del", 2); }, 800); await state("dropped"); await box("fx-10-dropped");
  await c.step("close", cmdE, 600); c.log("CLOSED", await c.js(`!document.querySelector(".fx-sheet")`));
  await c.js(`(() => { const el = document.querySelector('.wd-act[aria-label="Exchange"]'); if (el) el.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(500);
  await c.step("home-btn", () => c.press('.wd-act[aria-label="Exchange"]'), 900); c.log("FROM HOME", await c.js(`!!document.querySelector(".fx-sheet")`));
  c.key("Escape"); await c.sleep(600);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
  await c.press(".dash-tools .dg-btn", 0); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  const r = await c.js(`(() => { const el = document.querySelector(".cur-btn"); if (!el) return null; el.scrollIntoView({ block: "center", behavior: "instant" }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await c.sleep(400);
  if (r) {
    await c.step("dblclick", async () => { const x = Math.round(r.x), y = Math.round(r.y); c.wc.sendInputEvent({ type: "mouseMove", x, y }); await c.sleep(30);
      for (const n of [1, 2]) { c.wc.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: n }); c.wc.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: n }); await c.sleep(90); } }, 1000);
    c.log("FROM DOUBLE CLICK", await c.js(`!!document.querySelector(".fx-sheet")`), await c.js(`document.querySelector(".cur-btn").textContent`));
    await box("fx-11-dblclick");
  } else c.log("NO CUR-BTN");
};
// details under a name (--fresh --shots, 20 October 2026): an expense with details on the day panel, its logged row's
// box opened and added to, an income with details, then the quick log's box (↓); what was saved after each
const details = async (c) => {
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "char", keyCode: ch }); await c.sleep(25); } };
  const saved = (tag) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'), a = document.activeElement;
    return JSON.stringify({ sp: Object.values(d.spending || {}).flat().map((e) => e.desc + ' ' + e.amount + ' [' + (e.note || '') + ']'),
      inc: Object.values(d.incomes || {}).flat().map((e) => e.desc + ' ' + e.amount + ' [' + (e.note || '') + ']'), focus: a.className || a.tagName,
      rows: [...document.querySelectorAll('.entry-row')].map((r) => [...r.querySelectorAll(':scope > input')].map((i) => i.value).join(' ') + (r.querySelector('.note-btn.has') ? ' (details)' : '')) }); })()`).then((v) => c.log("SAVED", tag, v));
  const panel = async (name) => { const r = await c.js(`(() => { const g = document.querySelector('.split-btn').closest('.glass').getBoundingClientRect(), t = Math.max(0, g.top); return { x: Math.round(g.left), y: Math.round(t), width: Math.round(g.width), height: Math.round(Math.min(innerHeight, g.bottom) - t) }; })()`); await c.shot("details-" + name, r); };
  const focusAmt = (ph) => c.js(`(() => { const d = document.querySelector('input[placeholder^="${ph}"]'); d.parentElement.querySelector('input').focus(); })()`);
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelector('.split-btn').scrollIntoView({ block: 'center' })`); await c.sleep(500);
  await focusAmt("Description — e.g. lunch"); await type("50");
  await c.js(`document.querySelector('input[placeholder^="Description — e.g. lunch"]').focus()`); await type("Mcdonalds");
  await c.press('button.split-btn:not(.inc)[aria-label="Details"]'); await c.sleep(600); await panel("1-open");
  await type("ayam, french fries, ice cream"); await c.sleep(200); await panel("2-typed");
  c.key("Enter"); await c.sleep(900); await saved("expense"); await panel("3-filed");
  await c.press(".entry-row.exp .note-btn"); await c.sleep(700); await panel("4-row-open");
  await type(", extra sauce"); c.key("Enter"); await c.sleep(800); await saved("edited");
  await focusAmt("Description — e.g. salary"); await type("5000");
  await c.js(`document.querySelector('input[placeholder^="Description — e.g. salary"]').focus()`); await type("Gaji");
  await c.press(".split-btn.inc"); await c.sleep(600); await type("October pay"); c.key("Enter"); await c.sleep(900); await saved("income"); await panel("5-income");
  await c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true, bubbles: true, cancelable: true }))`); await c.sleep(800);
  await type("kopi 25"); c.key("Down"); await c.sleep(600);
  const q = await c.js(`(() => { const b = document.querySelector('.ql').getBoundingClientRect(); return { x: Math.round(b.left) - 8, y: Math.round(b.top) - 8, width: Math.round(b.width) + 16, height: Math.round(b.height) + 16 }; })()`);
  await type("less sugar"); await c.shot("details-6-quick", q);
  c.key("Enter"); await c.sleep(900); await saved("quick");
};
// one income over several months (--fresh --shots, 23 October 2026): 8jt logged on a day of this month, its months
// button, 2 months picked; what is kept, the chips and the hero's income in this month and the next; the next month's
// chip pressed (back to the day, the months open); 12, then 1; deleted and Undo
const incmonths = async (c) => {
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "char", keyCode: ch }); await c.sleep(25); } };
  const state = (tag) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}');
    const left = (document.body.innerText.match(/of [^\\n]* income/) || [null])[0];
    return JSON.stringify({ kept: Object.entries(d.incomes || {}).map(([k, a]) => k + ': ' + a.map((e) => e.desc + ' ' + e.amount + (e.months ? ' x' + e.months : '')).join(', ')),
      month: (document.querySelector('.month-label, .month-big') || {}).textContent, chips: [...document.querySelectorAll('.chip-flip')].map((e) => e.textContent.replace(/\s+/g, ' ')),
      left, say: (document.querySelector('.note-fold.open .span-say') || {}).textContent || null, btn: (document.querySelector('.span-btn') || {}).textContent || null,
      seg: (document.querySelector('.note-fold.open .span-seg button.on') || {}).textContent || null }); })()`).then((v) => c.log("STATE", tag, v));
  const panel = async (name) => { const r = await c.js(`(() => { const g = document.querySelector('.split-btn.inc').closest('.glass').getBoundingClientRect(), t = Math.max(0, g.top); return { x: Math.round(g.left), y: Math.round(t), width: Math.round(g.width), height: Math.round(Math.min(innerHeight - t, 330)) }; })()`); await c.shot("incm-" + name, r); };
  const top = async (name) => { await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300); await c.shot("incm-" + name, { x: 0, y: 0, width: 1440, height: 560 }); };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelector('.split-btn.inc').scrollIntoView({ block: 'center' })`); await c.sleep(500);
  await c.js(`(() => { const d = document.querySelector('input[placeholder^="Description — e.g. salary"]'); d.parentElement.querySelector('input').focus(); })()`); await type("8000000");
  await c.js(`document.querySelector('input[placeholder^="Description — e.g. salary"]').focus()`); await type("Allowance"); c.key("Enter"); await c.sleep(900);
  await state("logged"); await panel("1-row");
  await c.press(".span-btn"); await c.sleep(700); await state("open"); await panel("2-open");
  await c.press(".note-fold.open .span-seg button", 1); await c.sleep(700); await state("two"); await panel("3-two");
  await top("4-this-month");
  await c.press(".nav-arrow", 1); await c.sleep(1600);
  await c.js(`document.querySelector('button[title="Income history"]').click()`); await c.sleep(700);
  await state("next month"); await top("5-next-month");
  await c.press(".chip-span"); await c.sleep(2000); await state("back"); await panel("6-back");
  await c.press(".note-fold.open .span-seg button", 5); await c.sleep(700); await state("twelve"); await panel("7-twelve");
  await c.press(".note-fold.open .span-seg button", 0); await c.sleep(700); await state("one");
  await c.press(".note-fold.open .span-seg button", 1); await c.sleep(700);
  await c.press(".entry-row.inc .trash-btn"); await c.sleep(900); await state("deleted");
  await c.press(".un-b"); await c.sleep(900); await state("undone");
};
// an income split across months, second version (--fresh --shots; 23 October 2026): 7,5jt logged on the 10th, its split
// opened, 6.000.000 typed in this month's box, the first handle dragged, Month, Even, a month given back, All in …;
// then 6.000.000 again and the next month's income chips; what is kept after each
const incsplit = async (c) => {
  const type = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "char", keyCode: ch }); await c.sleep(25); } };
  const state = (tag) => c.js(`(() => { const d = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}');
    return JSON.stringify({ kept: Object.entries(d.incomes || {}).map(([k, a]) => k + ': ' + a.map((e) => e.desc + ' ' + e.amount + (e.split ? ' split ' + e.split.join('/') : '')).join(', ')),
      rows: [...document.querySelectorAll('.note-fold.open .sp-row')].map((r) => r.querySelector('.sp-m').textContent + ' ' + (r.querySelector('.sp-in') ? r.querySelector('.sp-in').value : r.querySelector('.sp-val').textContent)),
      handles: document.querySelectorAll('.note-fold.open .sp-h').length, say: (document.querySelector('.note-fold.open .span-say') || {}).textContent || null,
      btn: (document.querySelector('.span-btn') || {}).textContent || null, chips: [...document.querySelectorAll('.chip-flip')].map((e) => e.textContent.replace(/\\s+/g, ' ')) }); })()`).then((v) => c.log("STATE", tag, v));
  const pad = async (name) => { const r = await c.js(`(() => { const g = document.querySelector('.note-fold.open .span-pad'); if (!g) return null; const b = g.getBoundingClientRect(); return { x: Math.round(b.left) - 30, y: Math.max(0, Math.round(b.top) - 70), width: Math.round(b.width) + 50, height: Math.round(b.height) + 80 }; })()`); if (r) await c.shot("split-" + name, r); };
  const typeIn = async (i, text) => { await c.js(`(() => { const el = document.querySelectorAll('.note-fold.open .sp-in')[${i}]; el.focus(); el.select(); })()`); await c.sleep(150); await type(text); await c.sleep(300); };
  await c.sleep(SPLASH_MS);
  await c.js(`(() => { const el = document.querySelector('.acc-in'); if (!el) return; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Flow'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await c.sleep(400); await c.press(".acc-go"); await c.sleep(700); await c.press(".in-skip"); await c.sleep(3000);
  await c.press(".wallet-unit.active"); await c.sleep(1400);
  await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { c.log("no focus emulation", e.message); }
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  await c.press(".cell", 9); await c.sleep(1500);
  await c.js(`document.querySelector('.split-btn.inc').scrollIntoView({ block: 'center' })`); await c.sleep(500);
  await c.js(`(() => { const d = document.querySelector('input[placeholder^="Description — e.g. salary"]'); d.parentElement.querySelector('input').focus(); })()`); await type("7500000");
  await c.js(`document.querySelector('input[placeholder^="Description — e.g. salary"]').focus()`); await type("pocket money"); c.key("Enter"); await c.sleep(900);
  await c.press(".span-btn"); await c.sleep(800); await state("open"); await pad("1-open");
  await typeIn(0, "6000000"); await state("typing"); c.key("Enter"); await c.sleep(700); await state("6jt kept"); await pad("2-six");
  const h = await c.js(`(() => { const b = document.querySelector('.note-fold.open .sp-bar').getBoundingClientRect(), k = document.querySelector('.note-fold.open .sp-h').getBoundingClientRect(); return { x: Math.round(k.left + k.width / 2), y: Math.round(k.top + k.height / 2), to: Math.round(b.left + b.width * 0.4) }; })()`);
  c.wc.sendInputEvent({ type: "mouseMove", x: h.x, y: h.y }); c.wc.sendInputEvent({ type: "mouseDown", x: h.x, y: h.y, button: "left", clickCount: 1 }); await c.sleep(60);
  for (let i = 1; i <= 14; i++) { c.wc.sendInputEvent({ type: "mouseMove", x: Math.round(h.x + ((h.to - h.x) * i) / 14), y: h.y, modifiers: ["leftButtonDown"] }); await c.sleep(18); }
  await state("dragging"); c.wc.sendInputEvent({ type: "mouseUp", x: h.to, y: h.y, button: "left", clickCount: 1 }); await c.sleep(600); await state("dragged to 40%");
  await c.press(".note-fold.open .sp-act", 0); await c.sleep(700); await state("month added"); await pad("3-three");
  await c.press(".note-fold.open .sp-act", 1); await c.sleep(700); await state("even");
  await c.press(".note-fold.open .sp-x", 1); await c.sleep(700); await state("last given back");
  await c.press(".note-fold.open .sp-act", 2); await c.sleep(700); await state("all in this month");
  await typeIn(0, "6000000"); c.key("Enter"); await c.sleep(700); await state("6jt again");
  await c.press(".nav-arrow", 1); await c.sleep(1600);
  await c.js(`document.querySelector('button[title="Income history"]').click()`); await c.sleep(700);
  await state("next month");
};
// the exchanger's Home widget and the pill's double click (--fx-rates --shots, 20 October 2026): the widget added at
// Medium, typed in, swapped, the sheet opened with what was typed; the gallery's Small and Large; then on the month's
// pill two clicks a second apart (they switch twice, nothing opens) and a fast double click (it opens)
const exch2 = async (c) => {
  try { c.wc.debugger.attach("1.3"); } catch (e) { /* attached already */ }
  await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  const typeIn = async (text) => { for (const ch of text) { c.wc.sendInputEvent({ type: "keyDown", keyCode: ch }); c.wc.sendInputEvent({ type: "char", keyCode: ch }); c.wc.sendInputEvent({ type: "keyUp", keyCode: ch }); await c.sleep(40); } };
  const rect = (sel) => c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 8), y: Math.max(0, Math.round(b.top) - 8), width: Math.round(b.width) + 16, height: Math.round(b.height) + 16 }; })()`);
  const shot = async (sel, name) => { const r = await rect(sel); if (r) await c.shot(name, r); else c.log("NO", sel, name); };
  const W = '.wdg[data-w="fxch"]';
  const wstate = (tag) => c.js(`JSON.stringify([...document.querySelectorAll('${W} .wfx-row')].map((r) => r.querySelector('.wfx-c b').textContent + ' ' + r.querySelector('input').value + (r.classList.contains('on') ? ' *' : '')).concat([(document.querySelector('${W} .wd-foot') || {}).textContent]))`).then((v) => c.log("WIDGET", tag, v));
  const sheetRows = () => c.js(`JSON.stringify([...document.querySelectorAll('.fx-row')].map((r) => r.querySelector('.fx-nm b').textContent.replace('expand_more', '') + ' ' + r.querySelector('input').value))`);
  const cmdE = () => c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true, bubbles: true, cancelable: true }))`);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500);
  await c.press('button[aria-label="Edit widgets"]'); await c.sleep(700);
  await c.press(".dash-tools .dg-btn", 1); await c.sleep(900);
  await c.press(".dg-gal-it", await c.js(`(() => { const all = [...document.querySelectorAll('.dg-gal-it')], k = all.findIndex((b) => b.textContent.includes('Exchange')); all[k].scrollIntoView({ block: "center" }); return k; })()`)); await c.sleep(500);
  await c.press(".dg-gal-main .wr-seg button", 1); await c.sleep(500);
  await c.press(".dg-gal-main .dg-btn.pri.big"); await c.sleep(1300);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300); await c.press(".dash-tools .dg-btn.pri"); await c.sleep(900);
  await c.js(`document.querySelector('${W}').scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(1800);
  await wstate("added"); await shot(W, "w-1-medium");
  await c.step("w-type", async () => { await c.press(`${W} input[data-i="1"]`); await c.sleep(250); await typeIn("50"); }, 500); await wstate("typed"); await shot(W, "w-2-typed");
  await c.step("w-swap", () => c.press(`${W} .wd-go`, 0), 110); await shot(W, "w-3-swap-mid"); await c.sleep(700); await wstate("swapped"); await shot(W, "w-4-swapped");
  await c.step("w-open", () => c.press(`${W} .wd-go`, 1), 900); c.log("SHEET FROM WIDGET", await sheetRows()); await shot(".fx-sheet", "w-5-sheet");
  await c.step("sheet-type", async () => { const r = await c.js(`document.activeElement && document.activeElement.dataset.fx`); c.log("SHEET FOCUS", r); await typeIn("7"); }, 500);
  await cmdE(); await c.sleep(700); await wstate("after sheet");
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300); await c.press('button[aria-label="Edit widgets"]'); await c.sleep(700);
  await c.press(".dash-tools .dg-btn", 1); await c.sleep(900);
  await c.press(".dg-gal-it", await c.js(`(() => { const all = [...document.querySelectorAll('.dg-gal-it')], k = all.findIndex((b) => b.textContent.includes('Exchange')); all[k].scrollIntoView({ block: "center" }); return k; })()`)); await c.sleep(500);
  await shot(".dg-gal-stage", "w-6-small");
  await c.press(".dg-gal-main .wr-seg button", 2); await c.sleep(600); await shot(".dg-gal-stage", "w-7-large");
  c.key("Escape"); await c.sleep(500); await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300); await c.press(".dash-tools .dg-btn.pri"); await c.sleep(700);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
  await c.press('button[aria-label="Calendar"]'); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  const r = await c.js(`(() => { const el = document.querySelector(".cur-btn"); el.scrollIntoView({ block: "center", behavior: "instant" }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await c.sleep(500);
  const x = Math.round(r.x), y = Math.round(r.y), cur = () => c.js(`(() => { const s = JSON.parse(localStorage.getItem('pnl-calendar-idr') || '{}'); return s.currency || 'IDR'; })()`);
  const two = async (gap) => { for (const n of [1, 2]) { c.wc.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: n }); c.wc.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: n }); if (n === 1) await c.sleep(gap); } };
  c.wc.sendInputEvent({ type: "mouseMove", x, y }); await c.sleep(50);
  c.log("PILL BEFORE", await cur());
  await c.step("slow-pair", async () => { await two(1000); }, 900);
  c.log("SLOW PAIR (a second apart)", "sheet:", await c.js(`!!document.querySelector(".fx-sheet")`), "currency:", await cur());
  await c.sleep(600);
  await c.step("fast-pair", async () => { await two(120); }, 900);
  c.log("FAST PAIR (120ms apart)", "sheet:", await c.js(`!!document.querySelector(".fx-sheet")`), "currency:", await cur());
};
// the Add widget sheet's motion (20 October 2026; --shots for stills, else timing only): opened, a widget picked, a size
// picked, Add widget (the flight to the board). After each, the longest gap between frames while it played
const galmotion = async (c) => {
  const shots = c.shots;
  const t0 = () => c.js(`performance.now()`);
  const gaps = async (tag, from) => c.log("FRAMES", tag, await c.js(`(() => { const f = window.__perf.frames.filter((t) => t > ${from}); let m = 0, n = 0; for (let i = 1; i < f.length; i++) { const d = f[i] - f[i - 1]; if (d > m) m = d; if (d > 20) n++; } return JSON.stringify({ frames: f.length, longest: Math.round(m), over20: n }); })()`));
  const shot = async (sel, name) => { if (!shots) return; const r = await c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 8), y: Math.max(0, Math.round(b.top) - 8), width: Math.round(b.width) + 16, height: Math.round(b.height) + 16 }; })()`); if (r) await c.shot(name, r); };
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400); await c.press(".big-card"); await c.sleep(6500);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
  await c.press('button[aria-label="Edit widgets"]'); await c.sleep(800);
  for (const round of [1, 2]) {
    let t = await t0();
    await c.step(`open-${round}`, () => c.press(".dash-tools .dg-btn", 1), 140); await shot(".dg-gal", `g${round}-1-opening`); await c.sleep(800); await gaps(`open-${round}`, t); await shot(".dg-gal", `g${round}-2-open`);
    t = await t0();
    await c.step(`pick-${round}`, () => c.press(".dg-gal-it", round === 1 ? 2 : 5), 110); await shot(".dg-gal", `g${round}-3-pick-mid`); await c.sleep(700); await gaps(`pick-${round}`, t); await shot(".dg-gal", `g${round}-4-picked`);
    t = await t0();
    await c.step(`size-${round}`, () => c.press(".dg-gal-main .wr-seg button", 1), 900); await gaps(`size-${round}`, t);
    t = await t0();
    await c.step(`add-${round}`, () => c.press(".dg-gal-main .dg-btn.pri.big"), 0);
    await c.js(`(() => { const out = (window.__fly = []), t = performance.now(); const go = () => { const g = document.querySelector('.dg-fly'); out.push([Math.round(performance.now() - t), g ? g.style.transform.replace(/translate3d\\((-?[\\d.]+)px, (-?[\\d.]+)px, 0px\\) scale\\(([\\d.]+)\\)/, (m, x, y, k) => Math.round(x) + ',' + Math.round(y) + ' x' + (+k).toFixed(2)) : 'landed', !!document.querySelector('.dg-cell[data-fly]')]); if (g && out.length < 80) requestAnimationFrame(go); }; requestAnimationFrame(go); })()`);
    await c.sleep(1200); await gaps(`add-${round}`, t);
    c.log("FLIGHT", await c.js(`JSON.stringify(window.__fly.filter((_, i, a) => i % 6 === 0 || i === a.length - 1))`));
    c.log("LEFT", await c.js(`JSON.stringify({ ghosts: document.querySelectorAll('.dg-fly').length, hidden: document.querySelectorAll('.dg-cell[data-fly]').length, cells: document.querySelectorAll('.dg-cell').length })`));
    await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(500);
  }
};
// lag of 20 October's additions (--trace --fx-rates; each thing twice, "-1" the first time after the launch): the
// exchanger opened, its list, a currency picked, the swap, closed; Add widget's flight; the finance day panel's details
// box on the expense row and on a logged row; the quick log's details box
const newlag = async (c) => {
  try { c.wc.debugger.attach("1.3"); } catch (e) { /* attached already */ }
  await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true });
  const cmd = (key) => c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "${key}", metaKey: true, bubbles: true, cancelable: true })); 0`);
  const top = () => c.js(`window.scrollTo({ top: 0, behavior: "instant" })`);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.step("enter-finance", () => c.press(".big-card"), 6500);
  for (const n of [1, 2]) {
    await c.step(`fx-open-${n}`, () => cmd("e"), 1100);
    await c.step(`fx-list-${n}`, () => c.press(".fx-cur", 1), 900);
    await c.step(`fx-pick-${n}`, () => c.press(".fx-it", 4), 900);
    await c.step(`fx-swap-${n}`, () => c.press(".fx-swap"), 900);
    await c.step(`fx-close-${n}`, () => cmd("e"), 700);
  }
  await top(); await c.sleep(300);
  await c.press('button[aria-label="Edit widgets"]'); await c.sleep(800);
  for (const n of [1, 2]) {
    await top(); await c.sleep(300);
    await c.step(`gallery-${n}`, () => c.press(".dash-tools .dg-btn", 1), 1200);
    await c.step(`gallery-pick-${n}`, () => c.press(".dg-gal-it", 2 + n), 900);
    await c.step(`add-fly-${n}`, () => c.press(".dg-gal-main .dg-btn.pri.big"), 1300);
  }
  await top(); await c.sleep(300); await c.press(".dash-tools .dg-btn.pri"); await c.sleep(700);
  await c.press('button[aria-label="Calendar"]'); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200);
  await c.step("day", async () => c.press(".cell", await c.js(`new Date().getDate() - 1`)), 1600);
  await c.js(`document.querySelector('.split-btn').scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(400);
  for (const n of [1, 2]) {
    await c.step(`note-open-${n}`, () => c.press('button.split-btn:not(.inc)[aria-label="Details"]'), 700);
    await c.step(`note-shut-${n}`, () => c.press('button.split-btn:not(.inc)[aria-label="Details"]'), 700);
  }
  if (await c.js(`!!document.querySelector('.entry-row.exp .note-btn')`)) for (const n of [1, 2]) {
    await c.step(`row-note-open-${n}`, () => c.press(".entry-row.exp .note-btn"), 700);
    await c.step(`row-note-shut-${n}`, () => c.press(".entry-row.exp .note-btn"), 700);
  }
  for (const n of [1, 2]) {
    await c.step(`ql-${n}`, () => cmd("n"), 900);
    await c.step(`ql-note-${n}`, async () => c.key("Down"), 700);
    await c.step(`ql-shut-${n}`, async () => c.key("Escape"), 600);
  }
};
// what moves (21 October 2026: "animate stuff that isnt animated"): each change pressed through on finance and crypto,
// and what animations ran 40ms and 220ms after it (endless ones, like the live dots, left out). NONE: it just swapped.
// On the way, finance in MYR read for text that should never show (NaN, undefined, Infinity, Invalid Date, null)
const motion = async (c) => {
  const ANIMS = `(() => { const host = document.querySelector('.warm-host'), out = new Set();
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running' || !a.effect) continue;
      const t = a.effect.target; if (!t || (host && host.contains(t))) continue;
      if (a.effect.getTiming().iterations === Infinity) continue;
      const nm = a.animationName || (a.transitionProperty ? 'tr:' + a.transitionProperty : 'js');
      const cl = typeof t.className === 'string' && t.className ? t.className.trim().split(/\s+/)[0] : t.tagName.toLowerCase();
      out.add(nm + '@' + cl + (a.effect.pseudoElement || ''));
    }
    return [...out].slice(0, 7).join(' '); })()`;
  const BAD = `(() => { const t = document.body.innerText, m = t.match(/.{0,24}(NaN|undefined|Infinity|Invalid Date|\\bnull\\b|\\[object).{0,24}/g); return m ? m.slice(0, 5).join(' || ') : ''; })()`;
  const click = (sel) => c.js(`(() => { const e = ${sel}; if (!e) return 'missing'; e.click(); return 'ok'; })()`);
  const look = async (name, act, wait = 1200) => {
    const r = await act();
    await c.sleep(40); const a = await c.js(ANIMS); await c.sleep(180); const b = await c.js(ANIMS);
    c.log("MOTION", name, r === "missing" ? "(MISSING)" : "", a || b ? `40ms: ${a || "-"} | 220ms: ${b || "-"}` : "NONE");
    await c.sleep(wait);
  };
  const bad = async (name) => { const r = await c.js(BAD); if (r) c.log("BAD TEXT", name, r); };
  const key = (k, mod) => c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "${k}", ${mod ? "metaKey: true, " : ""}bubbles: true, cancelable: true })); 'ok'`);
  const top = () => c.js(`window.scrollTo({ top: 0, behavior: "instant" })`);
  const q = (css, i = 0) => `document.querySelectorAll(${JSON.stringify(css)})[${i}]`;
  const pressAt = async (css, i) => { await c.js(`(() => { const e = document.querySelectorAll(${JSON.stringify(css)})[${i}]; if (e) e.scrollIntoView({ block: "center", behavior: "instant" }); })()`); await c.sleep(400); await c.press(css, i); return "ok"; };
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await look("sidebar open", () => click(q(".snav-burger")), 900);
  await look("sidebar close", () => click(q(".snav-burger")), 900);
  await look("settings open", () => click(q('[aria-label="Settings"]')), 900);
  await look("settings close", async () => { c.key("Escape"); return "ok"; }, 900);
  await look("home edit on", () => click(q('.dash-tools [aria-label="Edit widgets"]')), 900);
  await look("widget remove", () => click(q(".dg-rm")), 900);
  await look("widget undo", () => click(q(".dg-toast button")), 900);
  await look("layouts open", () => click(`[...document.querySelectorAll('.dash-tools .dg-btn')].find((b) => b.innerText.includes('Layouts'))`), 900);
  await look("layout picked", () => click(q(".dg-pre-it", 1)), 1200);
  await look("layout undo", () => click(q(".dg-toast button")), 900);
  await top(); await c.sleep(300);
  await look("home edit off", () => click(`[...document.querySelectorAll('.dash-tools .dg-btn')].find((b) => b.innerText.includes('Done'))`), 900);
  await look("quick log open", () => key("n", true), 700);
  await look("quick log close", async () => { c.key("Escape"); return "ok"; }, 700);
  await look("exchanger open", () => key("e", true), 900);
  await look("exchanger close", () => key("e", true), 900);
  await look("home -> calendar", () => click(q('.dash-tools [aria-label="Calendar"]')), 2400);
  await look("year chart open", () => click(q(".chart-btn")), 1500);
  await look("year chart close", async () => { c.key("Escape"); return "ok"; }, 900);
  await look("year -> month", async () => pressAt(".ycell", await c.js(`new Date().getMonth()`)), 3200);
  await look("month next", () => click(q(".nav-arrow", 1)), 1500);
  await look("month prev", () => click(q(".nav-arrow", 0)), 1500);
  await look("day open", async () => pressAt(".cell", await c.js(`new Date().getDate() - 1`)), 1500);
  await look("day other", async () => pressAt(".cell", await c.js(`Math.max(0, new Date().getDate() - 3)`)), 1500);
  await look("day close", () => click(`[...document.querySelectorAll('.x-btn')].find((b) => /INCOME|Income/.test((b.closest('.glass') || {}).innerText || ''))`), 1200);
  await top(); await c.sleep(400);
  await look("currency -> MYR", () => click(q(".cur-btn")), 1500);
  await bad("month in MYR");
  await look("month -> year", () => click(q(".month-btn")), 2400); await bad("year in MYR");
  await look("year -> home", () => click(q(".snav-home")), 2400); await bad("home in MYR");
  await look("exchanger in MYR", () => key("e", true), 900); await bad("exchanger in MYR"); await key("e", true); await c.sleep(800);
  await look("home -> calendar 2", () => click(q('.dash-tools [aria-label="Calendar"]')), 2400);
  await pressAt(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3200); await top(); await c.sleep(300);
  await look("currency -> IDR", () => click(q(".cur-btn")), 1500);
  await top(); await c.sleep(300);
  await look("leave to the stage", () => pressAt(".foot-logo", 0), 4600);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600);
  await look("enter crypto", async () => { await c.press(".coin-unit"); return "ok"; }, 4500);
  await look("crypto home -> calendar", () => click(q('.dash-tools [aria-label="Calendar"]')), 2400);
  await look("crypto year -> month", async () => pressAt(".ycell", await c.js(`new Date().getMonth()`)), 3200);
  await top(); await c.sleep(300);
  await look("crypto currency", () => click(q(".cur-btn")), 1200);
  await look("crypto currency back", () => click(q(".cur-btn")), 1200);
  await look("calculator open", () => click(q(".calc-fab")), 1200);
  await look("calculator close", async () => { c.key("Escape"); return "ok"; }, 1000);
  await look("crypto month -> year", () => click(q(".month-btn")), 2400);
  await look("crypto year -> home", () => click(q(".snav-home")), 2400);
};
// the spending rule's section and pop-up as stills (--shots; usual profile: opening the pop-up saves nothing)
// the rule pop-up's pocket money box and the arrow keys (23 October 2026, his report: "i cant edit already written down
// text with my arrow keys"): typed in with real key events, ← three times, a digit, Backspace; the value and the caret after each
const rpcaret = async (c) => {
  try { c.wc.debugger.attach("1.3"); await c.wc.debugger.sendCommand("Emulation.setFocusEmulationEnabled", { enabled: true }); } catch (e) { /* attached already */ }
  const key = async (k, ch) => { c.wc.sendInputEvent({ type: "keyDown", keyCode: k }); if (ch) c.wc.sendInputEvent({ type: "char", keyCode: ch }); c.wc.sendInputEvent({ type: "keyUp", keyCode: k }); await c.sleep(60); };
  const at = (tag) => c.js(`(() => { const i = document.querySelector('.rp-amt input'); return JSON.stringify({ v: i.value, caret: i.selectionStart, focus: document.activeElement === i }); })()`).then((v) => c.log("BOX", tag, v));
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3500);
  for (let i = 0; i < 12 && !(await c.js(`!!document.querySelector('.rule-sec')`)); i++) { await c.js(`window.scrollBy({ top: 600, behavior: "instant" })`); await c.sleep(900); }
  await c.js(`document.querySelector('.rule-sec .rule-btn, .rule-sec .rule-start').click()`); await c.sleep(1200);
  await c.js(`(() => { const i = document.querySelector('.rp-amt input'); i.scrollIntoView({ block: "center" }); i.focus(); })()`); await c.sleep(300);
  for (const ch of "6600000") await key(ch, ch);
  await at("typed");
  for (let n = 0; n < 3; n++) await key("Left");
  await at("left x3");
  await key("1", "1"); await at("typed 1");
  await key("Backspace"); await at("backspace");
  await key("Left"); await key("Left"); await key("Backspace"); await at("left x2, backspace");
  await key("Right"); await at("right");
  await key("Right"); await key("Backspace"); await at("right, backspace onto the dot");
  c.key("Escape"); await c.sleep(500);
};
const rulelook = async (c) => {
  const shot = async (sel, name) => { const r = await c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 8), y: Math.max(0, Math.round(b.top) - 8), width: Math.round(b.width) + 16, height: Math.min(1200, Math.round(b.height) + 16) }; })()`); if (r) await c.shot(name, r); else c.log("NO", sel); };
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3500);
  for (let i = 0; i < 12 && !(await c.js(`!!document.querySelector('.rule-sec')`)); i++) { await c.js(`window.scrollBy({ top: 600, behavior: "instant" })`); await c.sleep(900); }
  await c.js(`document.querySelector('.rule-sec').scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(1500);
  await shot(".rule-sec", "rule-1-section");
  await c.js(`document.querySelector('.rule-sec .rule-btn, .rule-sec .rule-start').click()`); await c.sleep(1200);
  await shot(".rule-modal", "rule-2-pop");
  await c.js(`[...document.querySelectorAll('.rp-plan')][1] && [...document.querySelectorAll('.rp-plan')][1].click()`); await c.sleep(700); await shot(".rule-modal", "rule-3-simple");
  await c.js(`document.querySelector('.rp-tune') && document.querySelector('.rp-tune').click()`); await c.sleep(700);
  await c.js(`document.querySelector('.rule-modal').scrollTop = 9999`); await c.sleep(400); await shot(".rule-modal", "rule-4-tune");
  c.log("POP", await c.js(`(() => { const m = document.querySelector('.rule-modal'); return m ? m.scrollHeight + ' tall, ' + m.innerText.replace(/\\n+/g, ' | ').slice(0, 900) : 'none'; })()`));
};
// the option pop-ups as stills (--shots --profile=hunt: the Dev account with test data and developer options on; 22
// October 2026): finance's test data settings (top and bottom), two cards' test data, crypto's test data settings, the
// position calculator's settings. Nothing is generated: each pop-up is opened as a double click opens it
const optlook = async (c) => {
  const shot = async (sel, name) => { const r = await c.js(`(() => { const q = document.querySelector(${JSON.stringify(sel)}); if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 8), y: Math.max(0, Math.round(b.top) - 8), width: Math.round(b.width) + 16, height: Math.min(1300, Math.round(b.height) + 16) }; })()`); if (r) await c.shot(name, r); else c.log("NO", sel, name); };
  const dbl = (sel) => c.js(`(() => { const e = ${sel}; if (!e) return 'missing'; e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 })); return 'ok'; })()`);
  const both = async (sel, name) => { await shot(sel, `${name}-a`); const t = await c.js(`(() => { const m = document.querySelector(${JSON.stringify(sel)}); if (!m || m.scrollHeight <= m.clientHeight + 4) return 0; m.scrollTop = m.scrollHeight; return m.scrollHeight; })()`); if (t) { await c.sleep(400); await shot(sel, `${name}-b`); } c.log("TALL", name, t); };
  await c.js(`localStorage.removeItem('flow-theme'); 0`); await c.sleep(200); c.wc.reload(); await c.sleep(600);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  c.log("TESTCFG", await dbl(`document.querySelector('button[aria-label="Add test data"]')`)); await c.sleep(900);
  await both(".tcfg-modal", "opt-1-finance-test"); c.key("Escape"); await c.sleep(800);
  await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3500);
  const n = await c.js(`document.querySelectorAll('.card-flask').length`); c.log("CARD FLASKS", n, await c.js(`JSON.stringify([...document.querySelectorAll('.card-flask')].map((b) => b.getAttribute('aria-label')))`));
  for (const i of [0, 1]) { c.log("CARD", i, await dbl(`document.querySelectorAll('.card-flask')[${i}]`)); await c.sleep(900); await both(".tcfg-modal", `opt-${2 + i}-card`); c.key("Escape"); await c.sleep(800); }
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(400);
  await c.js(`document.querySelector('.foot-logo').scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(400); await c.press(".foot-logo"); await c.sleep(4600);
  await c.press(".coin-unit"); await c.sleep(1000); await c.press(".coin-unit"); await c.sleep(1600); await c.press(".coin-unit"); await c.sleep(5000);
  c.log("TRADE TESTCFG", await dbl(`document.querySelector('button[aria-label="Add test data"]')`)); await c.sleep(900);
  await both(".tcfg-modal", "opt-4-crypto-test"); c.key("Escape"); await c.sleep(800);
  await c.js(`document.querySelector('.calc-fab').click()`); await c.sleep(1200);
  c.log("GEAR", await c.js(`(() => { const g = document.querySelector('.pc-gear'); if (!g) return 'missing'; g.click(); return 'ok'; })()`)); await c.sleep(800);
  await shot(".pc-modal, .pc", "opt-5-calc-tools");
};
// finance's test data settings with each section opened in turn, as stills (--shots --profile=hunt; 22 October 2026)
const optfolds = async (c) => {
  const dbl = (sel) => c.js(`(() => { const e = ${sel}; if (!e) return 'missing'; e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 })); return 'ok'; })()`);
  await c.js(`localStorage.removeItem('flow-theme'); 0`); await c.sleep(200); c.wc.reload(); await c.sleep(600);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await dbl(`document.querySelector('button[aria-label="Add test data"]')`); await c.sleep(900);
  for (const i of [0, 1, 2]) {
    await c.js(`(() => { const f = document.querySelectorAll('.tcfg-fold'); f.forEach((b, k) => { if ((b.getAttribute('aria-expanded') === 'true') !== (k === ${i})) b.click(); }); })()`); await c.sleep(700);
    await c.js(`(() => { const f = document.querySelectorAll('.tcfg-fold')[${i}]; f.scrollIntoView({ block: "start" }); })()`); await c.sleep(300);
    const r = await c.js(`(() => { const b = document.querySelector('.tcfg-modal').getBoundingClientRect(); return { x: Math.round(b.left) - 8, y: Math.max(0, Math.round(b.top) - 8), width: Math.round(b.width) + 16, height: Math.round(b.height) + 16 }; })()`);
    await c.shot(`fold-${i}`, r);
  }
};
// smaller option menus as stills (--shots --profile=hunt; 22 October 2026): an expense's category menu, its Other
// description and its icons, then the split bill
const optlook3 = async (c) => {
  const shotEl = async (js, name) => { const r = await c.js(`(() => { const q = ${js}; if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 12), y: Math.max(0, Math.round(b.top) - 12), width: Math.round(b.width) + 24, height: Math.min(1300, Math.round(b.height) + 24) }; })()`); if (r) await c.shot(name, r); else c.log("NO", name); };
  await c.js(`localStorage.removeItem('flow-theme'); 0`); await c.sleep(200); c.wc.reload(); await c.sleep(600);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2500);
  await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3500);
  const day = await c.js(`(() => { const d = JSON.parse(localStorage.getItem('u:dev:pnl-calendar-idr') || '{}').spending || {}, t = new Date(), mk = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0'); const k = Object.keys(d).filter((x) => x.startsWith(mk) && d[x].some((e) => !e.zero)).sort().pop(); return k ? +k.slice(8) : 1; })()`);
  await c.js(`document.querySelectorAll('.cell')[${day - 1}].scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(500);
  await c.press(".cell", day - 1); await c.sleep(1600);
  await c.js(`document.querySelector('.entry-row.exp .ham-btn').scrollIntoView({ block: "center", behavior: "instant" })`); await c.sleep(500);
  await c.js(`document.querySelector('.entry-row.exp .ham-btn').click()`); await c.sleep(700);
  await shotEl(`document.querySelector('.cat-pop')`, "o3-1-cats");
  await c.js(`[...document.querySelectorAll('.cat-pop .cat-opt')].pop().click()`); await c.sleep(700);
  await shotEl(`document.querySelector('.cat-pop')`, "o3-2-other");
  await c.js(`document.querySelector('.cat-pop .icon-opt') && document.querySelector('.cat-pop .icon-opt').click()`); await c.sleep(700);
  await shotEl(`document.querySelector('.cat-pop')`, "o3-3-icons");
  c.key("Escape"); await c.sleep(600); await c.js(`document.body.click()`); await c.sleep(400);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
  await c.js(`document.querySelector('.snav-burger').click()`); await c.sleep(900);
  await c.js(`(() => { const b = [...document.querySelectorAll('.snav button')].find((x) => x.innerText.includes('Split bill')); if (b) b.click(); })()`); await c.sleep(1200);
  await shotEl(`[...document.querySelectorAll('[role="dialog"]')].pop()`, "o3-4-split");
};
// the chart pop-up's controls and the account button's menu, as stills (--shots --profile=hunt; 22 October 2026)
const optlook4 = async (c) => {
  const shotEl = async (js, name) => { const r = await c.js(`(() => { const q = ${js}; if (!q) return null; const b = q.getBoundingClientRect(); return { x: Math.max(0, Math.round(b.left) - 12), y: Math.max(0, Math.round(b.top) - 12), width: Math.round(b.width) + 24, height: Math.min(1300, Math.round(b.height) + 24) }; })()`); if (r) await c.shot(name, r); else c.log("NO", name); };
  await c.js(`localStorage.removeItem('flow-theme'); 0`); await c.sleep(200); c.wc.reload(); await c.sleep(600);
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2500);
  await c.js(`document.querySelector('.chart-btn').click()`); await c.sleep(1800);
  await shotEl(`document.querySelector('[aria-label="Chart"]')`, "o4-1-chart");
  c.key("Escape"); await c.sleep(800);
  await c.js(`window.scrollTo({ top: 0, behavior: "instant" })`); await c.sleep(300);
  await c.js(`document.querySelector('.who-btn').click()`); await c.sleep(1500);
  await c.shot("o4-2-who");
};
// scroll bars (23 October 2026, "also all the other scroll bars"): run with -AppleShowScrollBars Always after the name,
// so a bar takes room when it is drawn: the window's and a pop-up's room for one, and that both still scroll
const barcheck = async (c) => {
  await c.sleep(SPLASH_MS);
  await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
  await c.press(".big-card"); await c.sleep(6500);
  c.log("WINDOW", await c.js(`(() => { const before = scrollY; scrollTo({ top: 600, behavior: "instant" }); const r = JSON.stringify({ barRoom: innerWidth - document.documentElement.clientWidth, style: getComputedStyle(document.documentElement).scrollbarWidth, scrolled: scrollY - before, tall: document.documentElement.scrollHeight > innerHeight }); scrollTo({ top: 0, behavior: "instant" }); return r; })()`));
  await c.js(`window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true, bubbles: true, cancelable: true })); 0`); await c.sleep(900);
  await c.js(`(() => { const b = document.querySelector('.fx-cur'); if (b) b.click(); })()`); await c.sleep(900);
  c.log("LIST", await c.js(`(() => { const l = document.querySelector('.fx-list'); if (!l) return 'none'; const before = l.scrollTop; l.scrollTop = 400; return JSON.stringify({ barRoom: l.offsetWidth - l.clientWidth, scrolled: l.scrollTop - before }); })()`));
};
// the liquid glass slider at its two ends and the default (23 October 2026), as stills: Home, a month's calendar, the
// settings pop-up; the slider's own key is set and the page loaded again for each (usual profile)
const glasslook = async (c) => {
  for (const v of [0, 50, 100]) {
    await c.js(`localStorage.setItem('flow-glass', '${v}'); 0`); await c.sleep(200); c.wc.reload(); await c.sleep(800);
    await c.sleep(SPLASH_MS);
    await c.press(".wallet-unit.active"); await c.sleep(1400); await c.press(".wallet-unit.active .slot-card", 0, 0.5, 0.08); await c.sleep(1400);
    await c.press(".big-card"); await c.sleep(6500);
    c.log("K", v, await c.js(`getComputedStyle(document.documentElement).getPropertyValue('--lg-k')`));
    await c.shot(`g${v}-1-home`);
    await c.js(`(() => { const b = document.querySelector('.dash-tools [aria-label="Calendar"]'); if (b) b.click(); })()`); await c.sleep(2500);
    await c.press(".ycell", await c.js(`new Date().getMonth()`)); await c.sleep(3500);
    await c.shot(`g${v}-2-month`);
    await c.js(`document.querySelector('[aria-label="Settings"]').click()`); await c.sleep(1200);
    await c.shot(`g${v}-3-settings`);
    c.key("Escape"); await c.sleep(600);
  }
  await c.js(`localStorage.setItem('flow-glass', '50'); 0`);
};
module.exports = { splitdots, stackpre, stacks, incsplit, dashgap, rpcaret, incmonths, calcpad, glasslook, barcheck, timeplan, optlook4, optlook3, optfolds, optlook, rulelook, motion, motionpass, newlag, galmotion, exch2, details, exch, coldscroll, setlook, dashlook, homeenter, homelag, glassfade, dashfit, glassk, dashpre, dash, rulecheck, tileaudit, parttest, light, hunt, devacc, testdata, shotx, lagnew, tlook, safety, copyday, others, look, week, logpill, proj, backdrop, heads, year, launch, stage, intro, reset, finance, cards, pull, flow, term, idxj, hero, nospend, foot, keys, backup, dragmove, plans, pick, scoreinfo, trade: trading(false), stocks: trading(true), fx: trading("fx"), seedprep, dump, corners, firsts, rested, parts, imbox, items, bill, testlv, tiles, pxink, score81, fxdie,
  "year-finance": yearpops("finance"), "year-crypto": yearpops("crypto"), "year-idx": yearpops("idx"), "year-fx": yearpops("fx") };
