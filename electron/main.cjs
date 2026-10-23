/* Flow desktop shell (the app was called Trace until October 2026; the page's address is the one name that still says so).
   - Serves the built app (dist/) from app://trace so storage, fonts and icons all come from the app bundle.
   - Blocks every internet request the page could make: the app works fully offline.
   - Two exceptions, made here and never by the page, both asked for by Rassam: the latest USDT exchange rates, and
     the latest price of the coin or stock typed in a calculator.
   - Runs the on-device AI helper in its own process and remembers its answers. */
const { app, BrowserWindow, protocol, net, session, ipcMain, utilityProcess, nativeTheme, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");

/* The browser engine is kept off the internet altogether: whatever name it is asked to find, it is told there is none
   (the page comes from the app's own files, which need no lookup), and it looks nothing up over an encrypted channel
   of its own either (see whenReady). So it can never open a connection to anyone, and can never print "handshake
   failed ... net_error -200" again, whatever is added to the page or the shell later. The two things the app does ask
   the internet for are asked by this process itself (askJson), which these rules do not touch. */
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND");

const DIST = path.join(__dirname, "..", "dist");
const MODEL_FILE = "flow-ai.gguf";
const MODEL_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "models", MODEL_FILE)
  : path.join(__dirname, "..", "models", MODEL_FILE);
const HEAD_PATH = path.join(__dirname, "ai-head.json");      // the trained classifier (tools/ai/train.mjs)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

protocol.registerSchemesAsPrivileged([
  // codeCache: the app's script is kept pre-compiled between launches, so screens open faster the first time
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

/* Where everything Rassam has entered lives: the folder "flow". It was "trace" until the names were changed over
   (2 October 2026), so the first launch after that moves the old folder across whole. If that can't be done the old
   folder goes on being used: the data is never left behind.
   The page keeps its app://trace address, because what it has saved is filed under that address inside the folder.
   Changing the address would hide all of it. */
// where Export puts a backup: Rassam's own folder beside the project, not Downloads, in a folder per side that is
// picked from how the file's name begins
const EXPORT_DIR = path.join(app.getPath("home"), "Documents", "misc", "react app", "Financial Tracker", "exports");
const EXPORT_SIDES = { "pnl-export": "financial exports", "crypto-export": "crypto exports", "idx-export": "idx exports", "fx-export": "forex exports", "health-export": "health exports" };
// A file's name begins with the account's first name since 11 October 2026 ("rassam-pnl-export-11-10-2026.json": letters
// and digits, then the side); one named the old way, with the side first, still finds its folder.
// An export never replaces a file (11 October 2026: "it should have a (1) or (2) at the end so it doesnt replace the
// previous one but stack on top"): the first of a day keeps the plain name, the next ones are "… (1).json", "… (2).json".
const freeName = (dir, name) => {
  const ext = path.extname(name), stem = name.slice(0, name.length - ext.length);
  let out = name;
  for (let n = 1; fs.existsSync(path.join(dir, out)); n++) out = `${stem} (${n})${ext}`;
  return out;
};
const exportSide = (name) => { const m = new RegExp(`^(?:[a-z0-9]+-)?(${Object.keys(EXPORT_SIDES).join("|")})-`).exec(name); return m ? EXPORT_SIDES[m[1]] : null; };
const DATA_DIR = path.join(app.getPath("appData"), "flow");
const OLD_DATA_DIR = path.join(app.getPath("appData"), "trace");
const hasData = (dir) => fs.existsSync(path.join(dir, "Local Storage"));
try {
  if (hasData(OLD_DATA_DIR) && !hasData(DATA_DIR)) {
    // a new folder with nothing saved in it yet is set aside (never deleted) to make room for the real one
    if (fs.existsSync(DATA_DIR)) fs.renameSync(DATA_DIR, `${DATA_DIR}-empty-${Date.now()}`);
    fs.renameSync(OLD_DATA_DIR, DATA_DIR);
  }
} catch (e) { /* left where it was: used from there below */ }
app.setPath("userData", hasData(OLD_DATA_DIR) && !hasData(DATA_DIR) ? OLD_DATA_DIR : DATA_DIR);
app.setName("Flow");

/* ---------- first launch: is the system's cache of graphics programs empty? ----------
   macOS keeps the graphics programs an app has built in a folder of that app's own (…/C/<the helper's bundle id>/
   com.apple.metal, beside the temp folder). The installed app and "npm run app" are two apps to it, so the folder is
   empty the first time the installed app is opened, on any other Mac, and again after a macOS update: everything is
   then built from nothing, which froze the opening and every screen the first time it was shown (8 October 2026).
   When that is the case the page is told (--flow-gfx-cold, read in preload.cjs) and builds them all before its opening
   plays (warmPrime in App.jsx); when it is done a note is left in that same folder, so it goes with the cache if the
   system clears it. The note names the system and the engine: a new one of either builds its programs anew. */
const GFX_VER = `${os.release()}|${process.versions.electron}|3`;      // (the last figure: raised when the preparation draws more than it did, so it is gone through once more)
const GFX_AI_MAX_MS = 30000;          // the page waits for the AI helper's one-time setup this long at most (it took 24s when measured)
const gfxHome = (() => {
  if (process.platform !== "darwin") return "";
  try {
    const exe = path.basename(process.execPath);
    const plist = fs.readFileSync(path.join(path.dirname(process.execPath), "..", "Frameworks", `${exe} Helper.app`, "Contents", "Info.plist"), "utf8");
    const id = /<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
    return id ? path.join(os.tmpdir(), "..", "C", id[1]) : "";
  } catch (e) { return ""; }
})();
const gfxHasCache = () => fs.existsSync(path.join(gfxHome, "com.apple.metal"));
const gfxCold = (() => {
  if (!gfxHome) return false;
  let note = "";
  try { note = fs.readFileSync(path.join(gfxHome, "flow-primed"), "utf8"); } catch (e) { /* never done here */ }
  // "|1": the cache was there when the note was written. If it is gone now, it was cleared.
  return !(note === `${GFX_VER}|0` || (note === `${GFX_VER}|1` && gfxHasCache()));
})();
const gfxPrimed = () => {
  try { fs.mkdirSync(gfxHome, { recursive: true }); fs.writeFileSync(path.join(gfxHome, "flow-primed"), `${GFX_VER}|${gfxHasCache() ? 1 : 0}`); } catch (e) { /* asked again next time */ }
};
let aiReady = Promise.resolve();      // on such a launch: the AI helper's own one-time setup, which the page waits for too
// The page may clear its memory at a moment of its choosing (window.gc). It does so once per launch, while the opening
// screen stands still (after the warm-up's screens were drawn and thrown away under it, or at the end of the first
// launch's preparation), so that the clearing does not happen in the middle of the first presses. Since 9 October 2026
// on every launch: left to the engine it took 17ms as the wallet was first pressed and 33ms as the first month opened.
app.commandLine.appendSwitch("js-flags", "--expose-gc");

// a second launch hands over to the first and leaves at once: app.quit() here still let it get ready, open a window
// and write the AI cache over the first one's on the way out
if (!app.requestSingleInstanceLock()) app.exit(0);

/* ---------- on-device AI ---------- */
const AI_KINDS = new Set(["cat", "goal"]);
let aiProc = null;
let aiSeq = 0;
const aiWaiting = new Map();          // request id -> resolve
const AI_WAIT_MS = 30000;             // an answer that never comes (helper stuck, or gone between two messages) is null
const AI_CACHE_MAX = 3000;            // remembered answers; the oldest goes first, so ai-cache.json stays small
let aiCache = {};
let aiCacheFile = "";
let aiCacheTimer = null;
let aiVersion = "";                   // changes whenever the classifier is retrained, which empties the cache

const packAiCache = () => JSON.stringify({ version: aiVersion, answers: aiCache });
const loadAiCache = () => {
  aiCacheFile = path.join(app.getPath("userData"), "ai-cache.json");
  // from what is in the file, not from its date: the installed app's copy has a date of its own, so opening it and
  // "npm run app" in turn emptied the remembered answers and ran the helper's setup again every time
  try {
    const fd = fs.openSync(HEAD_PATH, "r"), buf = Buffer.alloc(262144);
    const n = fs.readSync(fd, buf, 0, buf.length, 0), size = fs.fstatSync(fd).size;
    fs.closeSync(fd);
    aiVersion = `${size}-${crypto.createHash("sha1").update(buf.subarray(0, n)).digest("hex").slice(0, 12)}`;
  } catch (e) { aiVersion = ""; }
  try {
    const saved = JSON.parse(fs.readFileSync(aiCacheFile, "utf8"));
    aiCache = saved && saved.version === aiVersion && saved.answers ? saved.answers : {};
  } catch (e) { aiCache = {}; }
};
const saveAiCache = () => {
  clearTimeout(aiCacheTimer);
  aiCacheTimer = setTimeout(() => {
    fs.promises.writeFile(aiCacheFile, packAiCache()).catch(() => {});
  }, 800);
};

const startAi = () => {
  if (aiProc) return aiProc;
  if (!fs.existsSync(MODEL_PATH) || !fs.existsSync(HEAD_PATH)) return null;
  const proc = utilityProcess.fork(path.join(__dirname, "ai.mjs"), [MODEL_PATH, HEAD_PATH], { serviceName: "Flow AI", stdio: "ignore" });
  proc.on("message", (m) => {
    const done = aiWaiting.get(m.id);
    if (done) { aiWaiting.delete(m.id); done(m.result || null); }
  });
  // the helper quits by itself after a few idle minutes to give its memory back; anything still waiting gets no answer
  proc.on("exit", () => {
    if (aiProc === proc) aiProc = null;
    aiWaiting.forEach((done) => done(null));
    aiWaiting.clear();
  });
  aiProc = proc;
  return proc;
};

const aiPick = (kind, text, labels) => {
  if (!AI_KINDS.has(kind) || typeof text !== "string" || !Array.isArray(labels)) return null;
  const clean = text.trim().replace(/\s+/g, " ").slice(0, 120);
  const opts = labels.filter((l) => typeof l === "string" && /^[a-z0-9_]{1,40}$/.test(l)).slice(0, 64);
  if (!clean || opts.length < 2) return null;
  const key = `${kind}|${clean.toLowerCase()}`;
  const hit = aiCache[key];
  if (hit && opts.includes(hit)) return hit;
  const proc = startAi();
  if (!proc) return null;
  return new Promise((resolve) => {
    const id = ++aiSeq;
    const late = setTimeout(() => { const done = aiWaiting.get(id); if (done) { aiWaiting.delete(id); done(null); } }, AI_WAIT_MS);
    aiWaiting.set(id, (result) => {
      clearTimeout(late);
      if (result && opts.includes(result)) {
        const keys = Object.keys(aiCache);
        if (keys.length >= AI_CACHE_MAX) keys.slice(0, keys.length - AI_CACHE_MAX + 1).forEach((k) => delete aiCache[k]);
        aiCache[key] = result; saveAiCache(); resolve(result);
      }
      else resolve(null);
    });
    proc.postMessage({ id, kind, text: clean, labels: opts });
  });
};

// The model's very first start on a Mac takes several seconds of one-time setup. Do it quietly in the
// background shortly after the first launch (and after each retrain), so the first real question is quick.
// Resolves when it is over (or was not needed).
const warmAi = () => new Promise((over) => {
  const flag = path.join(app.getPath("userData"), "ai-warm");
  let done = "";
  try { done = fs.readFileSync(flag, "utf8"); } catch (e) { /* first launch */ }
  if (done === aiVersion) return over();
  const proc = startAi();
  if (!proc) return over();
  const id = ++aiSeq;
  aiWaiting.set(id, (result) => { if (result === "ok") fs.promises.writeFile(flag, aiVersion).catch(() => {}); over(); });
  proc.postMessage({ id, kind: "warm" });
});

/* ---------- exchange rates: the first of the two things the app asks the internet for ----------
   The crypto side can show its amounts in rupiah or ringgit, and wants the rate of the moment for that. The page
   still can't reach anything: it asks this process, which reads one of two public price tables (no key, no account,
   nothing sent but the request itself), since the page's own session cancels every request.
   Offline, or if neither answers, it returns nothing and the page keeps the last rate it had. */
const FX_SOURCES = [
  // what one USDT trades for
  { url: "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr,myr", pick: (j) => j && j.tether && { IDR: j.tether.idr, MYR: j.tether.myr } },
  // fallback: the US dollar's own rates
  { url: "https://open.er-api.com/v6/latest/USD", pick: (j) => j && j.rates && { IDR: j.rates.IDR, MYR: j.rates.MYR } },
];
/* Both things are asked by this process itself (Node's own fetch), never through the browser engine. His provider
   answers for the exchanges it blocks with a page of its own, whose certificate is not theirs, and the engine prints
   "handshake failed ... net_error -200" in the terminal for every try that lands there (he asked twice what those
   lines were). A look at the certificate before the engine was pointed at a host did not hold: the look and the engine
   find a name's address separately and can be told different ones (6 October 2026: the Mac's own lookup gave an
   exchange's real address, so the look passed, while the engine was sent to the block page). Asked from here, a host
   that answers with the wrong certificate is simply an error like any other: that source rests, and nothing is printed.
   No cookies, nothing kept, nothing sent but the request itself. */
const askJson = (url, init = {}, ms = 5000) => fetch(url, { ...init, headers: { accept: "application/json", "user-agent": app.userAgentFallback, ...init.headers }, signal: AbortSignal.timeout(ms) });
const fetchRates = async () => {
  for (const src of FX_SOURCES) {
    try {
      const res = await askJson(src.url);
      if (!res.ok) continue;
      const r = src.pick(await res.json());
      if (r && r.IDR > 1000 && r.IDR < 1e6 && r.MYR > 1 && r.MYR < 100) return { IDR: Number(r.IDR), MYR: Number(r.MYR) };
    } catch (e) { /* offline, or that source is down: try the next */ }
  }
  return null;
};

/* ---------- live prices: the second thing the app asks the internet for ----------
   Rassam asked for the latest price of the coin or stock typed in a calculator, as fresh as it can be had. Same
   rules as the rates: the page asks this process, which reads a public price table (no key, no account; the request
   carries nothing but the coin or stock code), in the same way. Offline it returns nothing and the page
   keeps the last price it had.
   Each market has a list of sources, best first. A source that can't be reached is left alone for ten minutes (his
   provider blocks the big exchanges outright), and the one that last knew a name is asked first for that name.
   Crypto prices are the USDT perpetual's where there is one. Stock prices come ten minutes behind the exchange:
   nothing that is free and needs no login is fresher. */
const QUOTE_TIMEOUT_MS = 4000;
const QUOTE_REST_MS = 10 * 60 * 1000;
const tvScan = (board, tickers) => ({
  url: `https://scanner.tradingview.com/${board}/scan`,
  init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbols: { tickers }, columns: ["close", "change", "pricescale", "update_mode"] }) },
});
// a TradingView row: the price to its own number of decimals, and how many seconds behind the exchange it runs
const tvPick = (j) => {
  const d = j && Array.isArray(j.data) && j.data[0] && j.data[0].d;
  if (!d || !(d[0] > 0)) return null;
  const dp = d[2] > 1 ? Math.min(12, Math.round(Math.log10(d[2]))) : 0;
  const late = /^delayed_streaming_(\d+)$/.exec(d[3] || "");
  return { price: Number(d[0]).toFixed(dp), chg: d[1], late: late ? Number(late[1]) : 0 };
};
const QUOTE_SOURCES = {
  crypto: [
    { name: "Bybit", req: (s) => ({ url: `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${s}USDT` }),
      pick: (j) => { const t = j && j.result && Array.isArray(j.result.list) && j.result.list[0]; return t ? { price: t.lastPrice, chg: Number(t.price24hPcnt) * 100 } : null; } },
    { name: "Binance", req: (s) => ({ url: `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${s}USDT` }),
      pick: (j) => (j && j.lastPrice ? { price: j.lastPrice, chg: Number(j.priceChangePercent) } : null) },
    { name: "Gate.io", req: (s) => ({ url: `https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=${s}_USDT` }),
      pick: (j) => (Array.isArray(j) && j[0] && j[0].last ? { price: j[0].last, chg: Number(j[0].change_percentage) } : null) },
    { name: "Binance spot", req: (s) => ({ url: `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${s}USDT` }),
      pick: (j) => (j && j.lastPrice ? { price: j.lastPrice, chg: Number(j.priceChangePercent) } : null) },
    { name: "TradingView", req: (s) => tvScan("crypto", [`BYBIT:${s}USDT.P`, `BINANCE:${s}USDT.P`, `BINANCE:${s}USDT`]), pick: tvPick },
  ],
  idx: [
    { name: "TradingView", req: (s) => tvScan("indonesia", [`IDX:${s}`]), pick: tvPick },
    { name: "Yahoo", req: (s) => ({ url: `https://query1.finance.yahoo.com/v8/finance/chart/${s}.JK?interval=1d&range=1d` }),
      pick: (j) => {
        const m = j && j.chart && Array.isArray(j.chart.result) && j.chart.result[0] && j.chart.result[0].meta;
        if (!m || !(m.regularMarketPrice > 0)) return null;
        return { price: String(Math.round(m.regularMarketPrice)), chg: m.chartPreviousClose > 0 ? (m.regularMarketPrice / m.chartPreviousClose - 1) * 100 : null, late: 600 };
      } },
  ],
};
// a price as the digits it is written in ("85167.90" → "85167.9"): never through a number, which would turn the
// smallest coins into 4.4e-6
const priceText = (v) => {
  const s = String(v == null ? "" : v).trim();
  if (!/^\d{1,14}(\.\d{1,14})?$/.test(s) || !(Number(s) > 0)) return "";
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};
const quoteDown = new Map();          // source name -> the time until which it is not asked
const quoteFrom = new Map();          // "market:NAME" -> the source that last knew it
const quoteBusy = new Map();          // "market:NAME" -> the answer on its way: asking twice at once is one request
const readQuote = async (market, symbol, key) => {
  const list = QUOTE_SOURCES[market];
  const known = list.findIndex((s) => s.name === quoteFrom.get(key));
  const order = known > 0 ? [list[known], ...list.filter((s, i) => i !== known)] : list;
  let reached = false;
  for (const src of order) {
    if ((quoteDown.get(src.name) || 0) > Date.now()) continue;
    const { url, init = {} } = src.req(symbol);
    try {
      const res = await askJson(url, init, QUOTE_TIMEOUT_MS);
      const j = await res.json();     // a block page or an error page is not a price table: it throws, and the source rests
      reached = true;
      const q = src.pick(j);
      const price = q ? priceText(q.price) : "";
      if (price) {
        if (quoteFrom.size > 400) quoteFrom.clear();
        quoteFrom.set(key, src.name);
        return { price, chg: Number.isFinite(q.chg) ? Math.round(q.chg * 100) / 100 : null, src: src.name, late: q.late > 0 ? q.late : 0 };
      }
    } catch (e) { quoteDown.set(src.name, Date.now() + QUOTE_REST_MS); }
  }
  // nothing answered at all: offline. Every source is asked again next time, so the prices are back the moment the internet is
  if (!reached) { quoteDown.clear(); return null; }
  return { none: true };              // online, and nobody lists that name
};
const fetchQuote = (market, symbol) => {
  if (typeof market !== "string" || !Object.hasOwn(QUOTE_SOURCES, market) || typeof symbol !== "string" || !/^[A-Z0-9]{2,12}$/.test(symbol)) return null;
  const key = `${market}:${symbol}`;
  if (!quoteBusy.has(key)) quoteBusy.set(key, readQuote(market, symbol, key).catch(() => null).finally(() => quoteBusy.delete(key)));
  return quoteBusy.get(key);
};

/* ---------- window ---------- */
let win = null;
const createWindow = () => {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 620,
    backgroundColor: "#0e1012",
    show: false,
    title: "Flow",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      spellcheck: false,          // background throttling stays on (the default): a hidden window stops animating and costs nothing
      additionalArguments: gfxCold ? ["--flow-gfx-cold"] : [],
    },
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("app://trace/")) e.preventDefault(); });
  win.on("closed", () => { win = null; });
  win.loadURL("app://trace/index.html");
};

app.on("second-instance", () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  nativeTheme.themeSource = "dark";
  app.configureHostResolver({ secureDnsMode: "off" });

  protocol.handle("app", async (req) => {
    try {
      const { pathname } = new URL(req.url);
      const rel = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);   // a bad %-escape throws: 404
      const file = path.normalize(path.join(DIST, rel));
      if (rel.includes("\0") || !file.startsWith(DIST + path.sep)) return new Response("Not found", { status: 404 });
      const res = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(res.headers);
      headers.set("Content-Security-Policy", CSP);
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      return new Response("Not found", { status: 404 });
    }
  });

  // offline by design: nothing in the page may reach the internet (the rates and prices above are read by this process)
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (details, done) => done({ cancel: true })
  );
  session.defaultSession.setPermissionRequestHandler((wc, permission, done) => done(false));
  // Export: the backup goes straight into its side's folder under EXPORT_DIR, with no save box. Exporting again
  // the same day stacks: the file gets (1), (2) … after its name (freeName). If the folder can't be made, the usual save box comes up.
  session.defaultSession.on("will-download", (e, item) => {
    try {
      const name = path.basename(item.getFilename());
      if (!name || name.startsWith(".")) return;     // no real name (or a hidden file): the usual save box
      const side = exportSide(name);
      const dir = side ? path.join(EXPORT_DIR, side) : EXPORT_DIR;
      fs.mkdirSync(dir, { recursive: true });
      item.setSavePath(path.join(dir, freeName(dir, name)));
    } catch (err) { /* save box */ }
  });

  ipcMain.handle("ai:pick", (e, kind, text, labels) => aiPick(kind, text, labels));
  ipcMain.handle("fx:rates", () => fetchRates());
  ipcMain.handle("fx:quote", (e, market, symbol) => fetchQuote(market, symbol));
  ipcMain.handle("gfx:settle", () => aiReady);
  ipcMain.on("gfx:primed", gfxPrimed);

  createWindow();
  loadAiCache();                    // after the window is on its way; no question can arrive before this returns
  // the helper's setup builds graphics programs of its own: on a first launch it is done while the page builds its
  // own, before anything moves, and not eight seconds into the app
  // (and the helper is let go as soon as its setup is over, not five idle minutes later: on an 8 GB Mac its memory
  // is better free while he first looks around; the first note it is asked about starts it again)
  if (gfxCold) aiReady = Promise.race([warmAi().then(() => { if (aiProc && !aiWaiting.size) aiProc.kill(); }), new Promise((r) => setTimeout(r, GFX_AI_MAX_MS))]);
  else setTimeout(warmAi, 8000);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  clearTimeout(aiCacheTimer);
  try { if (aiCacheFile) fs.writeFileSync(aiCacheFile, packAiCache()); } catch (e) { /* nothing to do */ }
  if (aiProc) aiProc.kill();
});
