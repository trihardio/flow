// After packing, before the installer is made and signed: the other system's on-device AI runtime is taken out (the
// Mac's @node-llama-cpp/mac-* from the Windows app, the Windows one from the Mac app), and the Mac-only helper due-ai
// from the Windows app. electron-builder's per-platform "files" can only add to the shared list, never take out of it.
const fs = require("fs");
const path = require("path");

exports.default = async ({ appOutDir, electronPlatformName, packager }) => {
  const mac = electronPlatformName === "darwin";
  const app = mac ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, "Contents", "Resources", "app") : path.join(appOutDir, "resources", "app");
  const dir = path.join(app, "node_modules", "@node-llama-cpp");
  if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir)) if (mac ? !d.startsWith("mac-") : d.startsWith("mac-")) fs.rmSync(path.join(dir, d), { recursive: true, force: true });
  if (!mac) fs.rmSync(path.join(app, "electron", "due-ai"), { force: true });
};
