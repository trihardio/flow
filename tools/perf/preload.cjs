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
const P = (window.__perf = { frames: [], marks: [], warmed: [] });
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
