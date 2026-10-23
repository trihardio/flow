/* The only bridges between the app and the desktop shell: the on-device AI helper, and the latest rates and prices. */
const { contextBridge, ipcRenderer } = require("electron");

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
