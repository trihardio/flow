/* The only bridges between the app and the desktop shell: the on-device AI helper, the latest rates and prices, and the
   iPhone's Health file. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowAI", {
  // kind: "cat" (expense category) or "goal" (goal icon). Resolves to one of `labels`, or null when unsure.
  pick: (kind, text, labels) => ipcRenderer.invoke("ai:pick", kind, text, labels),
});

// The installed app's first launch (or the first after a macOS update): the system's cache of graphics programs is
// empty, and the page builds them all before its opening plays (warmPrime in App.jsx; how it is told is in main.cjs).
contextBridge.exposeInMainWorld("flowGfx", {
  cold: process.argv.includes("--flow-gfx-cold"),
  settle: () => ipcRenderer.invoke("gfx:settle"),     // resolves once the AI helper's own one-time setup is over
  primed: () => ipcRenderer.send("gfx:primed"),       // everything is built: not again until the cache is empty again
});

contextBridge.exposeInMainWorld("flowFX", {
  // Resolves to { IDR, MYR } (what 1 USDT is worth right now), or null when offline.
  rates: () => ipcRenderer.invoke("fx:rates"),
  // market: "crypto" or "idx"; symbol: the coin or stock code. Resolves to { price, chg, src, late } (the price as
  // text, the day's change in %, where it came from, how many seconds behind the exchange it runs), to { none: true }
  // when nobody lists that name, or to null when offline.
  quote: (market, symbol) => ipcRenderer.invoke("fx:quote", market, symbol),
});

contextBridge.exposeInMainWorld("flowHealth", {
  // The file the iPhone's shortcut saves in iCloud Drive (see phoneRead in main.cjs): { text, at (when it was saved) },
  // or null when there is none.
  phone: () => ipcRenderer.invoke("health:phone"),
  // a timetable's picture (bytes, its file's extension) read by the Mac's own text recognition, offline: { lines } or { error }
  ocr: (bytes, ext) => ipcRenderer.invoke("health:ocr", bytes, ext),
});
