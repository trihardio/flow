// Lag hunting (see run.cjs): the app's bridges, answering nothing, and a frame log that starts before the page's script.
window.flowAI = { pick: () => Promise.resolve(null) };
window.flowFX = { rates: () => Promise.resolve(null), quote: () => Promise.resolve(null) };
// --fx-rates: the money exchanger's rates, made up but of the right size (a daily table, live ones a little off it)
if (process.argv.includes("--flow-fx-rates")) {
  const day = { USD: 1, IDR: 18055, MYR: 4.0825, EUR: 0.8915, JPY: 158.44, SGD: 1.278, GBP: 0.749, AUD: 1.521, KWD: 0.3104, THB: 32.41, CNY: 7.12, XDR: 0.731 };
  const live = { IDR: 17995, MYR: 4.0815, EUR: 0.8914, JPY: 158.09, SGD: 1.2781, GBP: 0.7489, AUD: 1.5202, KWD: 0.3104, THB: 32.38, CNY: 7.118 };
  window.flowFX = { ...window.flowFX, rates: () => Promise.resolve({ IDR: 18010, MYR: 4.085 }),
    table: () => Promise.resolve({ rates: day, at: Date.now() - 3600e3, src: "ExchangeRate-API" }),
    live: (codes) => Promise.resolve({ rates: Object.fromEntries(codes.filter((c) => live[c]).map((c) => [c, live[c]])), at: Date.now(), src: "TradingView" }) };
}
// the iPhone's Health file: whatever a journey has put in window.__phone ({ text, at }), else none
window.flowHealth = { phone: () => Promise.resolve(window.__phone || null),
  // a timetable's picture: the reading a journey has put in window.__ocr (the Mac's own, taken beforehand), else none
  ocr: () => Promise.resolve(window.__ocr || { error: "read" }),
  // an assignment's due details: what a journey has put in window.__dueAI (text => the Mac's model's answer, taken beforehand
  // from electron/due-ai), else none
  dueAI: (t) => Promise.resolve(window.__dueAI ? window.__dueAI(t) : { error: "none" }) };
// --files (5 November 2026): kept files can be shown (their boxes, Show in folder), but nothing is opened and Finder never
// comes up: each open and reveal is only written down in window.__opened (a file box would come up on his screen: never
// press the paperclip in a run with this)
if (process.argv.includes("--flow-files")) {
  window.__opened = [];
  Object.assign(window.flowHealth, { where: () => "", open: (to) => { window.__opened.push(["open", to]); return Promise.resolve({ ok: true }); },
    reveal: (to) => { window.__opened.push(["reveal", to]); return Promise.resolve({ ok: true }); } });
}
const P = (window.__perf = { frames: [], marks: [], warmed: [] });
// layout shifts (23 October 2026, the jumps hunt): every time something on the page moved because something else
// changed its size, with what moved, from where to where (a slide drawn by transform is not one)
P.shifts = [];
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) P.shifts.push({ t: Math.round(e.startTime), v: e.value, src: (e.sources || []).slice(0, 4).map((x) => {
      const n = x.node, nm = n && n.nodeType === 1 ? n.tagName.toLowerCase() + (typeof n.className === "string" && n.className.trim() ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".") : "") : n ? "#text" : "?";
      return `${nm} y${Math.round(x.previousRect.y)}>${Math.round(x.currentRect.y)} x${Math.round(x.previousRect.x)}>${Math.round(x.currentRect.x)} h${Math.round(x.previousRect.height)}>${Math.round(x.currentRect.height)}`;
    }) });
  }).observe({ type: "layout-shift", buffered: true });
} catch (e) { /* no layout-shift entries in this engine */ }
// --backup: a stand-in for the shell's copy a day, which writes nothing and notes what the page hands it (name, length, start)
if (process.argv.includes("--flow-backup")) { P.kept = []; window.flowBackup = { keep: (name, text) => { P.kept.push([name, text.length, text.slice(0, 70).replace(/\s+/g, " ")]); return Promise.resolve(process.argv.includes("--flow-backup-fails") ? false : true); }, info: () => Promise.resolve({ days: 7, folder: "automatic backups" }) }; }
// --cold: the app is told the system's cache of graphics programs is empty, as on the installed app's first launch
if (process.argv.includes("--flow-gfx-cold")) window.flowGfx = { cold: true, settle: () => Promise.resolve(), primed: () => { P.primed = Math.round(performance.now()); } };
// --no-rest: as the app was before it drew the remaining screens in quiet moments (no idle callbacks: nothing is filed either)
if (process.argv.includes("--flow-no-rest")) delete window.requestIdleCallback, (window.requestIdleCallback = undefined);
const tick = (t) => { P.frames.push(t); requestAnimationFrame(tick); };
requestAnimationFrame(tick);
window.__mark = (name) => { P.marks.push([name, performance.now()]); performance.mark("H:" + name); };
// the warm-up's screens, counted as they are put in
window.addEventListener("DOMContentLoaded", () => {
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("warm-screen")) P.warmed.push(Math.round(performance.now())); })))
    .observe(document.documentElement, { childList: true, subtree: true });
});
// --light: the light look, as if it had been chosen in Settings (the key is the app's, see THEME_KEY)
if (process.argv.includes("--flow-light")) { try { localStorage.setItem("flow-theme", "light"); } catch (e) { /* no storage yet */ } }
