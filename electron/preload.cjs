/* The only bridges between the app and the desktop shell: the on-device AI helper, the latest rates and prices, and the
   iPhone's Health file. */
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("flowAI", {
  // kind: "cat" (expense category), "goal" (goal icon) or "sym" (the symbol of an expense in Other). Resolves to one
  // of `labels`, or null when unsure.
  pick: (kind, text, labels) => ipcRenderer.invoke("ai:pick", kind, text, labels),
});

// The installed app's first launch (or the first after a macOS update): the system's cache of graphics programs is
// empty, and the page builds them all before its opening plays (warmPrime in App.jsx; how it is told is in main.cjs).
contextBridge.exposeInMainWorld("flowGfx", {
  cold: process.argv.includes("--flow-gfx-cold"),
  settle: () => ipcRenderer.invoke("gfx:settle"),     // resolves once the AI helper's own one-time setup is over
  primed: () => ipcRenderer.send("gfx:primed"),       // everything is built: not again until the cache is empty again
});

// A copy a day: the page hands over what Export would write, the shell puts it into "automatic backups" in the exports
// folder (keepBackup in main.cjs). Resolves to true (written), "there" (that day's file exists) or false.
// info: { days, folder }: how many days of copies are kept and the folder's name, for the settings to say.
contextBridge.exposeInMainWorld("flowBackup", {
  keep: (name, text) => ipcRenderer.invoke("backup:keep", name, text),
  info: () => ipcRenderer.invoke("backup:info"),
  // old exports (28 October 2026): olds() lists Flow's own export files 28 days old or more ({ name, days }); clean(names)
  // removes those of them 30 days old or more, each checked again by the shell
  olds: () => ipcRenderer.invoke("backup:olds"),
  clean: (names) => ipcRenderer.invoke("backup:clean", names),
});

contextBridge.exposeInMainWorld("flowFX", {
  // Resolves to { IDR, MYR } (what 1 USDT is worth right now), or null when offline.
  rates: () => ipcRenderer.invoke("fx:rates"),
  // market: "crypto" or "idx"; symbol: the coin or stock code. Resolves to { price, chg, src, late } (the price as
  // text, the day's change in %, where it came from, how many seconds behind the exchange it runs), to { none: true }
  // when nobody lists that name, or to null when offline.
  quote: (market, symbol) => ipcRenderer.invoke("fx:quote", market, symbol),
  // the money exchanger: every currency against the dollar (daily), and live rates for the ones on screen
  table: () => ipcRenderer.invoke("fx:table"),
  live: (codes) => ipcRenderer.invoke("fx:live", codes),
});

contextBridge.exposeInMainWorld("flowHealth", {
  // The file the iPhone's shortcut saves in iCloud Drive (see phoneRead in main.cjs): { text, at (when it was saved) },
  // or null when there is none.
  phone: () => ipcRenderer.invoke("health:phone"),
  // a timetable's picture (bytes, its file's extension) read by the Mac's own text recognition, offline: { lines } or { error }
  ocr: (bytes, ext) => ipcRenderer.invoke("health:ocr", bytes, ext),
  // a class's notes: a link opened in his browser, or a kept file in its own app (noteOpen in main.cjs: { ok } / { gone } / { error });
  // where a file dropped or picked lives on the disk ("" when it has no place there)
  open: (target) => ipcRenderer.invoke("health:open", target),
  // a kept file shown in Finder: its folder opened with it picked (noteReveal in main.cjs: { ok } / { gone } / { error })
  reveal: (target) => ipcRenderer.invoke("health:reveal", target),
  // a deadline's heads-up, as the Mac's own notification (made by main.cjs; nothing goes to the internet); and, when one is
  // pressed, the assignment it was about (onDue gives back how to stop listening)
  notify: (title, body, id) => ipcRenderer.invoke("health:notify", title, body, id),
  onDue: (fn) => { const on = (e, id) => fn(id); ipcRenderer.on("health:due", on); return () => ipcRenderer.removeListener("health:due", on); },
  // an assignment's due details read by the Mac's own on-device model (dueAI in main.cjs): the words that give the day,
  // time, week, weight and where to hand it in, or { error }
  dueAI: (text) => ipcRenderer.invoke("health:due-ai", text),
  where: (file) => { try { return webUtils.getPathForFile(file) || ""; } catch (e) { return ""; } },
});
