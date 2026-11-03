import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // relative paths so the built app also loads from inside the Mac app bundle
  base: "./",
  plugins: [react()],
  server: { open: true },
  // the whole app is one script read from the app bundle on disk, never downloaded, and its compiled form is cached
  // between launches (codeCache in electron/main.cjs), so its size is not a concern. Split into pieces loaded later, a
  // feature would wait for its piece the first time it opened (PRODUCT.md: nothing may lag, not even the first time).
  // Only warn if it grows far beyond what it is now (about 1.5 MB on 24 October 2026; 550 kB when the limit was set)
  build: { chunkSizeWarningLimit: 3000 },
});
