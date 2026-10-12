/* Lag hunting (see run.cjs): what happened in each step of a recorded journey.
     node tools/perf/report.cjs <journey or output name> [min ms, default 8] [--programs]
   Per step: how long the page was busy in one go (and with what), how long the graphics process was stuck in one go,
   and how many graphics programs had to be built there (a burst of those is a few frozen frames; with the warm-up
   working there are next to none after the start). --programs lists them.
   The "-1" steps against the "-2" steps are the first-time lag. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) || "launch";
const MIN = Number(args.find((a) => /^\d+$/.test(a)) || 8);
const dir = fs.existsSync(name) ? name : path.join(os.tmpdir(), "flow-perf", "out", name);
const perf = JSON.parse(fs.readFileSync(path.join(dir, "perf.json"), "utf8"));
const marks = perf.marks || [];
const stepAt = (t) => { let s = "start", from = 0; for (const [n, at] of marks) { if (at <= t) { s = n; from = at; } else break; } return [s, t - from]; };

console.log(`warm-up: ${perf.warmed?.length || 0} screens drawn under the opening screen${perf.warmed?.length ? ` (${perf.warmed[0]}–${perf.warmed.at(-1)}ms)` : ""}`);
console.log("\n== the page's own frames: gaps over 22ms (ms into the step:+gap) ==");
const gaps = {};
for (let i = 1; i < perf.frames.length; i++) {
  const g = perf.frames[i] - perf.frames[i - 1], [s, off] = stepAt(perf.frames[i - 1]);
  (gaps[s] ||= []);
  if (g > 22) gaps[s].push(`${Math.round(off)}:+${Math.round(g)}`);
}
for (const [s, v] of Object.entries(gaps)) if (v.length) console.log(`  [${s}] ${v.join("  ")}`);

const tf = path.join(dir, "trace.json");
if (!fs.existsSync(tf)) { console.log("\n(no trace: run with --trace for what each hitch is made of)"); process.exit(0); }

// the trace can be bigger than a JS string can hold: read it in chunks and pull out one event at a time
const ev = [];
{
  const keep = (e) => e.ph === "M" || (e.ph === "X" && (e.dur >= 500 || e.name === "createGraphicsPipeline")) || (e.cat && e.cat.includes("blink.user_timing"));
  const fd = fs.openSync(tf, "r"), buf = Buffer.alloc(8 << 20);
  let depth = 0, inStr = false, esc = false, started = false, cur = [], n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
    let from = depth >= 2 ? 0 : -1;
    for (let i = 0; i < n; i++) {
      const ch = buf[i];
      if (inStr) { if (esc) esc = false; else if (ch === 92) esc = true; else if (ch === 34) inStr = false; continue; }
      if (ch === 34) { inStr = true; continue; }
      if (ch === 123 || ch === 91) {
        depth++;
        if (!started && ch === 91) { started = true; depth = 1; continue; }
        if (started && depth === 2 && ch === 123) from = i;
      } else if (ch === 125 || ch === 93) {
        depth--;
        if (started && depth === 1 && ch === 125) {
          cur.push(buf.subarray(from < 0 ? 0 : from, i + 1));
          try { const e = JSON.parse(Buffer.concat(cur).toString("utf8")); if (keep(e)) ev.push(e); } catch (err) { /* not an event */ }
          cur = []; from = -1;
        }
      }
    }
    if (started && depth >= 2) cur.push(Buffer.from(buf.subarray(from < 0 ? 0 : from, n)));
  }
  fs.closeSync(fd);
}
const thread = {};
for (const e of ev) if (e.ph === "M" && e.name === "thread_name") thread[`${e.pid}:${e.tid}`] = e.args.name;
const tmarks = ev.filter((e) => e.cat && e.cat.includes("blink.user_timing") && e.name && e.name.startsWith("H:")).map((e) => ({ name: e.name.slice(2), ts: e.ts, key: `${e.pid}:${e.tid}` })).sort((a, b) => a.ts - b.ts);
if (!tmarks.length) { console.log("\n(no step marks in the trace)"); process.exit(0); }
const mainKey = tmarks[0].key;
// before the first mark the clock is the page's own: the first mark's time in the page says when the page began
const t0 = tmarks[0].ts - (marks[0] ? marks[0][1] * 1000 : 0);
const tstep = (ts) => { let s = "start", from = t0; for (const m of tmarks) { if (m.ts <= ts) { s = m.name; from = m.ts; } else break; } return [s, (ts - from) / 1000]; };

const TASK = "ThreadControllerImpl::RunTask";
const PLUMBING = new Set(["RunTask", TASK, "SimpleWatcher::OnHandleReady", "Receive mojo message", "MessagePort::Accept", "TimerBase::run", "AsyncTask Run", "WebFrameWidgetImpl::UpdateLifecycle",
  "LocalFrameView::RunStyleAndLayoutLifecyclePhases", "LocalFrameView::UpdateStyleAndLayout", "Blink.Style.UpdateTime", "Document::updateStyle", "Document::recalcStyle", "Blink.Layout.UpdateTime",
  "LocalFrameView::layout", "LocalFrameView::performLayout", "v8.callFunction", "ProxyMain::BeginMainFrame", "WebFrameWidgetImpl::BeginMainFrame", "Blink.ForcedStyleAndLayout.UpdateTime",
  "Document::UpdateStyleAndLayout", "LocalFrameView::RunPaintLifecyclePhase", "Blink.Paint.UpdateTime", "Blink.PrePaint.UpdateTime", "LocalFrameView::RunPrePaintLifecyclePhase", "RunMicrotasks", "EventDispatch"]);
const NICE = { FunctionCall: "script", UpdateLayoutTree: "styles", Layout: "layout", Paint: "paint", PrePaint: "pre-paint", Layerize: "layers", Commit: "hand-over", MinorGC: "memory clean-up", MajorGC: "memory clean-up (big)",
  DecodeFont: "font unpacked", ParseHTML: "markup read", "v8.evaluateModule": "script loaded", FireIdleCallback: "idle work", TimerFire: "timer" };

console.log(`\n== the page busy for ${MIN}ms or more in one go (script time includes any layout it forced) ==`);
const main = ev.filter((e) => `${e.pid}:${e.tid}` === mainKey && e.ph === "X").sort((a, b) => a.ts - b.ts);
for (const t of main.filter((e) => e.name === TASK && e.dur >= MIN * 1000)) {
  const sum = {};
  for (const k of main) if (k !== t && k.ts >= t.ts && k.ts + k.dur <= t.ts + t.dur && !PLUMBING.has(k.name) && (NICE[k.name] || k.dur > 3000)) sum[k.name] = (sum[k.name] || 0) + k.dur;
  const parts = Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, d]) => `${NICE[n] || n} ${(d / 1000).toFixed(0)}`);
  const [s, off] = tstep(t.ts);
  console.log(`  [${s}] +${off.toFixed(0)}ms  ${(t.dur / 1000).toFixed(0)}ms  ${parts.join(", ")}`);
}

console.log("\n== the graphics process stuck for 7ms or more in one go (no frame can be shown meanwhile) ==");
const stuck = {};
for (const e of ev) {
  if (e.ph !== "X" || e.name !== TASK || e.dur < 7000) continue;
  const tn = thread[`${e.pid}:${e.tid}`];
  if (tn !== "CrGpuMain" && tn !== "VizCompositorThread") continue;
  const [s, off] = tstep(e.ts);
  (stuck[s] ||= []).push(`${off.toFixed(0)}:${(e.dur / 1000).toFixed(0)}`);
}
for (const [s, v] of Object.entries(stuck)) console.log(`  [${s}] ${v.join("  ")}`);

// --inside=<step>: what the longest standstill of the graphics process in that step was made of
const inside = (args.find((a) => a.startsWith("--inside=")) || "").slice(9);
if (inside) {
  const tasks = ev.filter((e) => e.ph === "X" && e.name === TASK && e.dur >= 7000 && ["CrGpuMain", "VizCompositorThread"].includes(thread[`${e.pid}:${e.tid}`]) && tstep(e.ts)[0] === inside).sort((a, b) => b.dur - a.dur);
  for (const t of tasks.slice(0, 2)) {
    console.log(`\n== inside the ${(t.dur / 1000).toFixed(0)}ms standstill of [${inside}] (${thread[`${t.pid}:${t.tid}`]}) ==`);
    const kids = ev.filter((k) => k !== t && k.ph === "X" && k.pid === t.pid && k.tid === t.tid && k.ts >= t.ts && k.ts + k.dur <= t.ts + t.dur).sort((a, b) => b.dur - a.dur).slice(0, 22);
    for (const k of kids) console.log(`    ${(k.dur / 1000).toFixed(1)}ms  +${((k.ts - t.ts) / 1000).toFixed(0)}  ${k.name}${k.args && k.args.desc ? "  " + String(k.args.desc).slice(0, 150) : ""}`);
  }
}
console.log("\n== graphics programs built ==");
const built = {};
for (const e of ev) if (e.ph === "X" && e.name === "createGraphicsPipeline") (built[tstep(e.ts)[0]] ||= []).push(e);
let later = 0;
for (const [s, list] of Object.entries(built)) {
  if (s !== "start") later += list.length;
  console.log(`  [${s}] ${list.length} (${(list.reduce((a, e) => a + e.dur, 0) / 1000).toFixed(1)}ms)`);
  if (args.includes("--programs") && s !== "start") for (const e of list) console.log(`      ${(e.dur / 1000).toFixed(1)}ms ${e.args.desc}`);
}
console.log(`  after the start: ${later}`);
