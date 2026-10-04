// One step per swipe: the wheel rule (wheelSwipe) exactly as it stands in src/App.jsx, fed trackpad-like streams of
// wheel events on a made-up clock. Run: node tools/wheel-test.mjs
// The streams are shaped like a Mac trackpad's (fingers speed up, then a glide that dies away), not recorded from one.
import fs from "node:fs";
const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const a = src.indexOf("const WHEEL_QUIET_MS"), b = src.indexOf("\n};\n", a) + 4;      // the constants and wheelSwipe, to its closing brace
let now = 0;
const wheelSwipe = new Function("performance", src.slice(a, b) + "; return wheelSwipe;")({ now: () => now });

// a swipe: the fingers speed up for `rise` ms to `peak` px an event, then the glide dies away over `glide` ms; an event every 8ms
const swipe = (at, peak = 45, rise = 90, glide = 1100, merged = false) => {
  const ev = [];
  for (let t = 0; t <= rise; t += 8) ev.push([at + t, Math.max(4, peak * (t / rise))]);
  for (let t = 8; t <= glide; t += 8) { let v = peak * Math.exp(-4 * t / glide); if (merged && (t / 8) % 3 === 0) v *= 2; if (v >= 0.5) ev.push([at + rise + t, v]); }
  return ev;
};
// swipes one after another: fingers coming down again end the glide before them
const then = (...swipes) => swipes.flatMap((ev, i) => (swipes[i + 1] ? ev.filter(([t]) => t < swipes[i + 1][0][0]) : ev));
let failed = 0;
const run = (name, events, want) => {
  const lock = { current: null }; const at = [];
  for (const [t, d] of events) { now = t; if (wheelSwipe(lock, Math.abs(d) >= 4, d)) at.push(Math.round(t)); }
  if (at.length !== want) failed++;
  console.log(`  ${at.length === want ? "ok  " : "FAIL"} ${name}: ${at.length} (want ${want})${at.length ? ` at ${at.join(", ")}ms` : ""}`);
};
console.log("one swipe must be one step:");
run("a swipe with a long glide", swipe(0, 45, 90, 1500), 1);
run("a hard swipe with a very long glide", swipe(0, 120, 70, 2200), 1);
run("a slow swipe, fingers down for half a second", swipe(0, 30, 500, 900), 1);
run("glide events merged two to a frame every so often", swipe(0, 45, 90, 1300, true), 1);
run("a 200ms hole in the glide", swipe(0, 45, 90, 1300).filter(([t]) => t < 400 || t > 600), 1);
run("a hole in the glide after 700ms", swipe(0, 45, 90, 1500).filter(([t]) => t < 720 || t > 900), 1);
run("a 500ms hole in a long glide", swipe(0, 80, 90, 2200).filter(([t]) => t < 500 || t > 1000), 1);
run("a resting finger twitching 1 to 3px afterwards", [...swipe(0, 45, 90, 900), ...Array.from({ length: 60 }, (_, i) => [1000 + i * 30, 1 + (i % 3)])], 1);
run("a resting finger twitching up to 6px during the glide", swipe(0, 45, 90, 1500).map(([t, v], i) => [t, v + (i % 5 === 0 ? 6 : 0)]), 1);
console.log("a second swipe must count, with the pointer where it was:");
run("two swipes, the second 400ms after the first", then(swipe(0), swipe(400)), 2);
run("two swipes 500ms apart (the first one's glide still running)", then(swipe(0), swipe(500)), 2);
run("two swipes 800ms apart", then(swipe(0), swipe(800)), 2);
run("two swipes 1300ms apart", then(swipe(0), swipe(1300)), 2);
run("three swipes 600ms apart", then(swipe(0), swipe(600), swipe(1200)), 3);
run("four hard swipes 450ms apart", then(swipe(0, 120), swipe(450, 120), swipe(900, 120), swipe(1350, 120)), 4);
run("two gentle swipes (15px an event) 700ms apart", then(swipe(0, 15, 120, 600), swipe(700, 15, 120, 600)), 2);
run("two slow drags with no glide, 450ms apart", then(swipe(0, 20, 150, 0), swipe(450, 20, 150, 0)), 2);
run("a swipe, then one much later", then(swipe(0), swipe(3000)), 2);
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
