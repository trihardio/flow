// Builds the due-date reader (due.swift) into electron/due-ai. `npm run build-due-ai`.
// The Command Line Tools may carry SDKs newer than their compiler, which refuses them: each SDK that has FoundationModels
// is tried, newest first, until one compiles.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path");
const src = path.join(__dirname, "due.swift"), out = path.join(__dirname, "..", "..", "electron", "due-ai");
const roots = ["/Library/Developer/CommandLineTools/SDKs", "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs"];
const sdks = roots.filter((r) => fs.existsSync(r)).flatMap((r) => fs.readdirSync(r).filter((n) => /^MacOSX\d[\d.]*\.sdk$/.test(n)).map((n) => path.join(r, n)))
  .filter((p) => fs.existsSync(path.join(p, "System/Library/Frameworks/FoundationModels.framework")))
  .sort((a, b) => parseFloat(path.basename(b).slice(6)) - parseFloat(path.basename(a).slice(6)));
for (const sdk of sdks) {
  try {
    execFileSync("swiftc", ["-O", "-sdk", sdk, "-target", "arm64-apple-macos26.0", src, "-o", out], { stdio: "pipe" });
    console.log(`built ${path.relative(process.cwd(), out)} with ${path.basename(sdk)}`);
    process.exit(0);
  } catch (e) { console.log(`${path.basename(sdk)}: no (${String(e.stderr || e.message).split("\n").find((l) => /error/.test(l)) || "failed"})`.slice(0, 200)); }
}
console.error("No SDK with FoundationModels compiled it (it needs macOS 26 or later's SDK)");
process.exit(1);
