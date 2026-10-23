// Lag hunting (see run.cjs): the app's bridges, answering nothing, and a frame log that starts before the page's script.
window.flowAI = { pick: () => Promise.resolve(null) };
window.flowFX = { rates: () => Promise.resolve(null), quote: () => Promise.resolve(null) };
// the iPhone's Health file: whatever a journey has put in window.__phone ({ text, at }), else none
window.flowHealth = { phone: () => Promise.resolve(window.__phone || null),
  // a timetable's picture: the reading a journey has put in window.__ocr (the Mac's own, taken beforehand), else none
  ocr: () => Promise.resolve(window.__ocr || { error: "read" }) };
const P = (window.__perf = { frames: [], marks: [], warmed: [] });
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
