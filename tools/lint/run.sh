#!/bin/sh
# Code checks with rolldown's own parser (no linter is installed): names used but declared in no scope around them,
# hooks under a condition or after an early return, and mistakes that make no error (a list's element without a key,
# a prop or object key given twice, x === NaN, a value compared with itself).   sh tools/lint/run.sh
cd "$(dirname "$0")/../.." || exit 1
for f in src/App.jsx src/main.jsx; do echo "== $f"; node tools/lint/undef.mjs "$PWD" $f jsx | tail -20; done
for f in electron/main.cjs electron/preload.cjs electron/ai.mjs electron/ai-classify.mjs; do echo "== $f"; node tools/lint/undef.mjs "$PWD" $f js | tail -5; done
echo "== hooks"; node tools/lint/hooks.mjs "$PWD" src/App.jsx
echo "== silent"; node tools/lint/silent.mjs "$PWD" src/App.jsx
