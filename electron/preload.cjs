/* The only bridges between the app and the desktop shell: the on-device AI helper, and the latest rates and prices. */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flowAI", {
  // kind: "cat" (expense category) or "goal" (goal icon). Resolves to one of `labels`, or null when unsure.
  pick: (kind, text, labels) => ipcRenderer.invoke("ai:pick", kind, text, labels),
});

contextBridge.exposeInMainWorld("flowFX", {
  // Resolves to { IDR, MYR } (what 1 USDT is worth right now), or null when offline.
  rates: () => ipcRenderer.invoke("fx:rates"),
  // market: "crypto" or "idx"; symbol: the coin or stock code. Resolves to { price, chg, src, late } (the price as
  // text, the day's change in %, where it came from, how many seconds behind the exchange it runs), to { none: true }
  // when nobody lists that name, or to null when offline.
  quote: (market, symbol) => ipcRenderer.invoke("fx:quote", market, symbol),
});
