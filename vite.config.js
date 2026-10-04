import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // relative paths so the built app also loads from inside the Mac app bundle
  base: "./",
  plugins: [react()],
  server: { open: true },
  // the whole app is one script read from the app bundle on disk, never downloaded, so its size is not a concern:
  // only warn if it grows far beyond what it is now (about 550 kB)
  build: { chunkSizeWarningLimit: 1500 },
});
