#!/bin/sh
# Every screen of every side, hidden, before a release (4 November 2026, his words: "check for errors, bugs, lag, ui
# overlapping, and inconsistencies … make sure no bugs appear in the future"): `hunt` on finance, crypto, IDX and forex
# (the Dev account with full test data: text that should never show, text cut off, controls of one panel covering each
# other, the page's errors), the design tour of Health (the same read on every card), `bins` (every bin and its slide)
# and `hlkind` (classes and events). Prints only what was found; exit 1 if anything was.
# It draws on the graphics chip: never while he is trying the app (see tools/perf/CLAUDE.md). About 10 minutes.
cd "$(dirname "$0")/../.." || exit 1
E="env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron tools/perf/run.cjs"
OUT="${TMPDIR:-/tmp}/flow-perf/out"
npx vite build --outDir "${TMPDIR:-/tmp}/flow-perf/dist" >/dev/null 2>&1 || { echo "BUILD FAILED"; exit 1; }
for s in finance crypto idx fx; do
  f=""; [ "$s" = finance ] && f="--fresh"
  $E hunt "--side=$s" --profile=hunt $f "--name=hunt-$s" >/dev/null 2>&1
done
$E uitour --only=health --fresh --profile=tourh --name=tour-health >/dev/null 2>&1
$E bins --fresh --profile=bins --name=bins >/dev/null 2>&1
$E hlkind --fresh --profile=hlkind --name=hlkind >/dev/null 2>&1
found=0
for n in hunt-finance hunt-crypto hunt-idx hunt-fx tour-health bins hlkind; do
  log="$OUT/$n/log.txt"
  if [ ! -f "$log" ]; then echo "== $n: no log (the run did not start)"; found=1; continue; fi
  hits=$(grep -E "^(FOUND|CONSOLE error|JOURNEY ERROR|MISSING)|ERRORS [^n]" "$log")
  if [ -n "$hits" ]; then echo "== $n"; echo "$hits" | cut -c1-300; found=1; fi
done
rm -rf "${TMPDIR:-/tmp}/flow-perf/profile-tourh" "${TMPDIR:-/tmp}/flow-perf/profile-bins" "${TMPDIR:-/tmp}/flow-perf/profile-hlkind"
[ $found -eq 0 ] && echo "nothing found" || exit 1
