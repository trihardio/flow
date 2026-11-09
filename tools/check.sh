#!/bin/sh
# The check every change must pass before it is called done (4 November 2026, his words: "make sure no bugs appear in the
# future if and when i make changes and send new prompts"): the app builds, and the lint (tools/lint) finds nothing new.
# Quiet and exit 0 when all is well; what is wrong and exit 1 otherwise. `npm run check`. tools/check-hook.sh runs it when
# a Claude Code turn ends with the app's code changed (once that hook is set in .claude/settings.json). It builds into a
# folder of its own, so the app's dist/ is never touched. The heavier hidden runs (every screen of every side) are
# tools/perf/hunt-all.sh, before a release
cd "$(dirname "$0")/.." || exit 1
fail=0
out=$(npx vite build --outDir "${TMPDIR:-/tmp}/flow-check" --emptyOutDir 2>&1)
if [ $? -ne 0 ]; then
  echo "BUILD FAILED"; echo "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -E "Error|error|\.jsx?:[0-9]|│" | head -14; exit 1
fi
# the code map (notes/code-map.md): every component's line, for the next session to read instead of searching
node tools/vault/codemap.mjs >/dev/null 2>&1
lint=$(sh tools/lint/run.sh 2>&1)
# names used but declared nowhere (a hook not imported once built fine and crashed the card at run time)
if echo "$lint" | grep -qE "^[1-9][0-9]* names not found"; then
  fail=1; echo "UNDECLARED NAMES"; echo "$lint" | awk '/^== /{f=$2} /^[A-Za-z_$][A-Za-z0-9_$]* +[0-9]+ uses/{print "  " f ": " $0}'
fi
# hooks under a condition: the three useRead lines are Health's plain function of that name, not a hook
hooks=$(echo "$lint" | awk '/^== hooks/{on=1; next} /^== /{on=0} on' | grep -E "^[0-9]+:" | grep -v "useRead")
if [ -n "$hooks" ]; then fail=1; echo "HOOKS UNDER A CONDITION"; echo "$hooks" | sed 's/^/  /'; fi
# mistakes that make no error (a list without keys, a prop twice, === NaN)
silent=$(echo "$lint" | awk '/^== silent/{on=1; next} on')
if ! echo "$silent" | grep -q "^0 found"; then fail=1; echo "SILENT MISTAKES"; echo "$silent" | sed 's/^/  /' | head -20; fi
# the picture readers on his reference screenshots (tools/ocr/fixtures: timetables and assignments, about a second)
ocr=$(node tools/ocr/fixtures.mjs 2>&1) || { fail=1; echo "PICTURE READERS"; echo "$ocr" | grep -v "^ok" | sed 's/^/  /' | head -20; }
[ $fail -eq 0 ] || exit 1
