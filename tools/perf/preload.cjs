// Lag hunting (see run.cjs): the app's bridges, answering nothing, and a frame log that starts before the page's script.
window.flowAI = { pick: () => Promise.resolve(null) };
window.flowFX = { rates: () => Promise.resolve(null), quote: () => Promise.resolve(null) };
const P = (window.__perf = { frames: [], marks: [], warmed: [] });
const tick = (t) => { P.frames.push(t); requestAnimationFrame(tick); };
requestAnimationFrame(tick);
window.__mark = (name) => { P.marks.push([name, performance.now()]); performance.mark("H:" + name); };
// the warm-up's screens, counted as they are put in
window.addEventListener("DOMContentLoaded", () => {
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("warm-screen")) P.warmed.push(Math.round(performance.now())); })))
    .observe(document.documentElement, { childList: true, subtree: true });
});
