/* Lag hunting: drives a built Flow through a journey in the project's own Electron, with no window on screen, and
   records what the report (report.cjs) needs. His data is never touched: the run has its own data folder, seeded
   once with a copy of his saved entries.

   Build first, into a folder of its own so the app's dist is left alone:
     npx vite build --outDir "$TMPDIR/flow-perf/dist"
   Run (from the project folder):
     env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/perf/run.cjs finance --trace
     node tools/perf/report.cjs finance
   Journeys: launch, finance, trade, stocks, cards, pull (see journeys.cjs).
   Flags: --trace (what each hitch is made of, and the graphics programs built), --shots (stills on, frame timing off),
          --fresh (an empty data folder), --dist=<folder>, --name=<output name>, --sw=<chromium switch>[=value],
          --no-rest (nothing is drawn in quiet moments after the opening, to compare with),
          --profile=<name> (a data folder of its own, kept between runs, empty to begin with; with --fresh it is emptied first), --cold (the app is told the system's cache of
          graphics programs is empty and builds them before its opening: the journey starts once that is over. To
          make the cache really empty, run a copy of Electron.app whose bundle ids were changed and signed again)
   Run a journey twice before measuring: the first run of a build fills the caches a normal launch already has, and
   files the screens that the warm-up draws at the next launch.
   It is the real engine but not his 120Hz display: frames here come at whatever rate the hidden surface gives. */
const { app, BrowserWindow, protocol, net, session, contentTracing, dialog, powerSaveBlocker } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");

const args = process.argv.slice(2);
const flag = (name) => { const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`)); return hit ? (hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true) : null; };
const journey = args.find((a) => !a.startsWith("--")) || "launch";
const BASE = path.join(os.tmpdir(), "flow-perf");
const DIST = path.resolve(flag("dist") || (fs.existsSync(path.join(BASE, "dist", "index.html")) ? path.join(BASE, "dist") : path.join(__dirname, "..", "..", "dist")));
const OUT = path.join(BASE, "out", String(flag("name") || journey));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => fs.appendFileSync(path.join(OUT, "log.txt"), a.join(" ") + "\n");
dialog.showErrorBox = (t, m) => log("ERRORBOX", t, m);
process.on("uncaughtException", (e) => { log("UNCAUGHT", e.stack); app.exit(1); });
setTimeout(() => { log("HARD TIMEOUT"); app.exit(2); }, 300000);

// its own data folder: a copy of his saved entries the first time (or nothing, with --fresh)
const profile = path.join(BASE, flag("profile") ? `profile-${flag("profile")}` : flag("fresh") ? "profile-fresh" : "profile");
if (flag("fresh")) fs.rmSync(profile, { recursive: true, force: true });
if (!fs.existsSync(profile)) {
  fs.mkdirSync(profile, { recursive: true });
  const saved = path.join(app.getPath("appData"), "flow", "Local Storage");
  if (!flag("fresh") && !flag("profile") && fs.existsSync(saved)) fs.cpSync(saved, path.join(profile, "Local Storage"), { recursive: true });
}
app.setPath("userData", profile);
if (app.dock) app.dock.hide();
// a hidden app with no window is put to sleep by macOS now and then (App Nap): its timers all but stop, and a journey
// that takes a minute ran into the five-minute limit (it happened twice, both times the fourth run in a row)
powerSaveBlocker.start("prevent-app-suspension");
for (const a of args) { const m = /^--sw=([^=]+)(?:=(.*))?$/.exec(a); if (m) app.commandLine.appendSwitch(m[1], m[2]); }
if (!args.some((a) => a.startsWith("--sw=js-flags"))) app.commandLine.appendSwitch("js-flags", "--expose-gc");      // as the app's own shell does

const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
  "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join("; ");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } }]);

app.whenReady().then(async () => {
  protocol.handle("app", async (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname === "/" ? "/index.html" : pathname)));
    try {
      const res = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(res.headers);
      headers.set("Content-Security-Policy", CSP);
      return new Response(res.body, { status: res.status, headers });
    } catch (e) { return new Response("Not found", { status: 404 }); }
  });
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (d, done) => done({ cancel: true }));

  const shots = !!flag("shots");
  const win = new BrowserWindow({
    width: 1440, height: 900, show: false, useContentSize: true, backgroundColor: "#0e1012",
    webPreferences: { offscreen: shots ? { deviceScaleFactor: 2 } : { useSharedTexture: true, deviceScaleFactor: 2 }, preload: path.join(__dirname, "preload.cjs"),
                      contextIsolation: false, sandbox: false, nodeIntegration: false, spellcheck: false, backgroundThrottling: false,
                      additionalArguments: [...(flag("cold") ? ["--flow-gfx-cold"] : []), ...(flag("no-rest") ? ["--flow-no-rest"] : [])] },
  });
  const wc = win.webContents;
  wc.setFrameRate(120);
  const paints = [];
  wc.on("paint", (e) => { paints.push(performance.timeOrigin + performance.now()); if (e.texture) e.texture.release(); });
  wc.on("console-message", (e) => log("CONSOLE", e.level, e.message));
  wc.on("render-process-gone", (e, d) => { log("RENDERER GONE", JSON.stringify(d)); app.exit(3); });

  // (with --cold the recording starts once the preparation is over: it alone would fill it)
  const startTrace = async () => {
    await contentTracing.startRecording({
      recording_mode: "record-until-full",
      included_categories: ["toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline", "blink.user_timing", "cc", "gpu", "viz", "v8.execute",
        "skia", "skia.gpu", "skia.shaders", "disabled-by-default-skia.shaders", "disabled-by-default-skia.gpu", "disabled-by-default-gpu.graphite.dawn",
        // --prof: which functions the script's time goes to (build with --minify false to get their names)
        ...(flag("prof") ? ["disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"] : [])],
      excluded_categories: ["*"],
    });
  };
  if (flag("trace") && !flag("cold")) await startTrace();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => Promise.race([wc.executeJavaScript(code, true), new Promise((_, no) => setTimeout(() => no(new Error("no answer from the page: " + code.slice(0, 60))), 20000))]);
  const c = {
    wc, sleep, js, log, OUT, shots,
    mark: (name) => js(`window.__mark(${JSON.stringify(name)})`),
    // a step of the journey: named, so the report can say what happened in it
    step: async (name, act, wait) => { log("STEP", name, `${Math.round(process.uptime())}s`); await c.mark(name); await act(); await sleep(wait); },
    move: (x, y) => wc.sendInputEvent({ type: "mouseMove", x: Math.round(x), y: Math.round(y) }),
    async click(x, y) {
      x = Math.round(x); y = Math.round(y);
      wc.sendInputEvent({ type: "mouseMove", x, y });
      await sleep(30);
      wc.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
      wc.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
    },
    // press the nth element matching a selector, at a point given as fractions of its box (the middle by default)
    async press(sel, nth = 0, fx = 0.5, fy = 0.5) {
      const r = await js(`(() => { const el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; })()`);
      if (!r) { log("NOT FOUND", sel, nth); return false; }
      await c.click(r.l + r.w * fx, r.t + r.h * fy);
      return true;
    },
    // a trackpad-like scroll: many small wheel events
    async scroll(total, ms = 500) {
      const n = Math.max(1, Math.round(ms / 8));
      for (let i = 0; i < n; i++) { wc.sendInputEvent({ type: "mouseWheel", x: 700, y: 500, deltaX: 0, deltaY: -total / n, canScroll: true }); await sleep(8); }
    },
    key: (keyCode) => { wc.sendInputEvent({ type: "keyDown", keyCode }); wc.sendInputEvent({ type: "keyUp", keyCode }); },
    async shot(name, rect) { fs.writeFileSync(path.join(OUT, name + ".png"), (await wc.capturePage(rect)).toPNG()); },
  };

  win.loadURL("app://trace/index.html");
  if (flag("cold")) {
    const from = Date.now();
    await sleep(500);
    if (shots) { await sleep(1300); await c.shot("prep"); }
    while (Date.now() - from < 90000 && !(await js("!!(window.__perf && window.__perf.primed)").catch(() => false))) await sleep(100);
    log("PRIMED after", Date.now() - from, "ms");
    if (flag("trace")) await startTrace();
  }
  const journeys = require("./journeys.cjs");
  try {
    if (!journeys[journey]) throw new Error(`no journey called ${journey} (there are: ${Object.keys(journeys).join(", ")})`);
    await journeys[journey](c);
  } catch (e) { log("JOURNEY ERROR", e.stack); }

  fs.writeFileSync(path.join(OUT, "perf.json"), await js("JSON.stringify({ ...window.__perf, origin: performance.timeOrigin })").catch(() => "{}"));
  fs.writeFileSync(path.join(OUT, "paints.json"), JSON.stringify({ paints }));
  if (flag("trace")) await contentTracing.stopRecording(path.join(OUT, "trace.json"));
  log("DONE");
  console.log(`${journey}: recorded in ${OUT}`);
  // a normal quit, so the caches are written to the data folder as they would be in the real app
  win.destroy();
  setTimeout(() => app.exit(0), 4000);
  app.quit();
});
