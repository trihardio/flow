#!/bin/sh
# For Claude Code's Stop hook (4 November 2026): when a turn ends and the app's code changed since the last check that
# passed, tools/check.sh runs; a failure is handed back (exit 2) so the turn does not end on a broken app. A second stop
# in a row (stop_hook_active) is let through with the report, so a check that can't pass never loops. The fingerprint of
# the last pass is .claude/.check-ok (not in git). Set in .claude/settings.json as a Stop hook: sh tools/check-hook.sh
cd "$(dirname "$0")/.." || exit 0
in=$(cat)
sum=$(cat src/App.jsx src/main.jsx src/fonts.css electron/*.cjs electron/*.mjs 2>/dev/null | shasum | cut -c1-40)
[ -f .claude/.check-ok ] && [ "$(cat .claude/.check-ok)" = "$sum" ] && exit 0
if out=$(sh tools/check.sh 2>&1); then echo "$sum" > .claude/.check-ok; exit 0; fi
case "$in" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) echo "Flow's check still fails:" >&2; echo "$out" >&2; exit 0;; esac
echo "Flow's check (npm run check) failed after this change. Fix it before finishing:" >&2; echo "$out" >&2; exit 2
