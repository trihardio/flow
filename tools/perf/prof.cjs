// what the page's long tasks were made of: node prof.cjs <trace.json> [min ms] — streams the trace (one event a line)
const fs = require("fs"), readline = require("readline");
const file = process.argv[2], min = Number(process.argv[3] || 25) * 1000;
(async () => {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const names = {}, tasks = [], marks = [], profs = {};
  for await (let line of rl) {
    if (line.length < 10) continue;
    if (line.endsWith(",")) line = line.slice(0, -1);
    if (line.startsWith('{"traceEvents"')) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.name === "thread_name" && e.args) names[`${e.pid}:${e.tid}`] = e.args.name;
    else if (e.ph === "X" && e.dur >= min && /RunTask$/.test(e.name)) tasks.push(e);
    else if (e.cat === "blink.user_timing" && /^H:/.test(e.name)) marks.push([e.ts, e.name.slice(2)]);
    else if (e.name === "Profile" && e.args && e.args.data) { profs[`${e.pid}:${e.id}`] = { pid: e.pid, tid: e.tid, t: e.args.data.startTime, nodes: new Map(), samples: [] }; }
    else if (e.name === "ProfileChunk" && e.args && e.args.data) {
      const p = profs[`${e.pid}:${e.id}`]; if (!p) continue;
      const cp = e.args.data.cpuProfile || {}, td = e.args.data.timeDeltas || [];
      for (const n of cp.nodes || []) p.nodes.set(n.id, n);
      (cp.samples || []).forEach((s, i) => { p.t += td[i] || 0; p.samples.push([p.t, s]); });
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const stepAt = (ts) => { let s = "start"; for (const [t, n] of marks) if (t <= ts) s = n; return s; };
  const main = tasks.filter((t) => names[`${t.pid}:${t.tid}`] === "CrRendererMain");
  for (const t of main) {
    const step = stepAt(t.ts);
    if (!/enter|chip|gallery|fx|add|note|ql|day|calendar/.test(step)) continue;
    const self = {}, incl = {};
    let n = 0;
    for (const p of Object.values(profs)) {
      if (p.pid !== t.pid) continue;
      for (const [ts, id] of p.samples) {
        if (ts < t.ts || ts > t.ts + t.dur) continue;
        n++;
        let node = p.nodes.get(id), first = true;
        const seen = new Set();
        while (node) {
          const f = node.callFrame || {}, nm = `${f.functionName || "(anon)"}${f.url && /assets\/index/.test(f.url) ? ":" + (f.lineNumber + 1) : ""}`;
          if (first) { self[nm] = (self[nm] || 0) + 1; first = false; }
          if (f.url && /assets\/index/.test(f.url) && !seen.has(nm)) { incl[nm] = (incl[nm] || 0) + 1; seen.add(nm); }
          node = node.parent ? p.nodes.get(node.parent) : null;
        }
      }
    }
    const top = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k).map(([a, b]) => `${a} ${b}`).join(" | ");
    console.log(`\n[${step}] +${Math.round((t.ts - (marks.find((m) => m[1] === step) || [t.ts])[0]) / 1000)}ms ${Math.round(t.dur / 1000)}ms, ${n} samples`);
    console.log("  self:", top(self, 8));
    console.log("  ours (inclusive):", top(incl, 14));
  }
})();
