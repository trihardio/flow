# The installer (DMG)

One area of Flow: what `npm run dmg` makes. Back to [[HOME]] · the rules that hold everywhere: [[CLAUDE]].

## Its window: a swamp at sunset (30 October 2026)
His words: "make custom pixel art background on the dmg distribution file on mac. following the crocodile theme i want you to make a detailed swamp with a croc somewhere surrounded by trees (the forest) and a sort of sunset, though not covering the flow logo or the applications file logo. be super creative about this, look for reference images, use advanced photography skills (focus points etc)".
- Made by `node tools/dmg/swamp.mjs` (no image library: the pixels and the PNG are written by the script; seeded, so the same every run): `build/background.png` (660 × 405) and `build/background@2x.png` (1320 × 810, picked by electron-builder for Retina). Pixel art on a 220 × 135 grid, one square = 3 points.
- `package.json` › `build.dmg`: the background, icons 96, names 13, the window 660 × 405, Flow at (165, 240) and Applications at (495, 240) (icon centres, in points).
- Built like a photograph, back to front: a dithered sunset sky with lit cloud strata, the first stars and birds; the sun banded as it sets; a far canopy in haze (lighter and warmer near the sun: atmospheric perspective); two stands of bald cypress framing it (Spanish moss, a rim of sun on the edges facing it, knees at their feet); the water mirroring all of it with the sun's path; ground fog on the water; reeds and cattails at the left, lily pads, a lotus, a drifting log with a turtle at the right; fireflies in the trees; a soft vignette.
- **The point of focus is the croc**: the sun's path pools into a patch of light nearest us and the croc crosses it as a crisp silhouette (backlit, the eye catching the light, a few teeth), below and between the two icons, swimming towards Applications with its wake opening back towards Flow: the way to drag.
- **Nothing behind the icons**: where they and their names sit the water is calm (no trees, ripples or reflections, `iconAt`). The names sit on the fog bank, mid-toned on purpose, as Finder writes them black in the light look and white in the dark one: about 3.4:1 for black and 6:1 for white (the script prints both).
- References looked at: bald cypress swamps at sunset, Lospec's swamp palettes, electron-builder's DMG docs (the @2x background, `contents` as icon centres at 1x).
- **Not yet seen in a real DMG**: `npm run dmg` lays the window out through Finder, which opens a window on the screen, so it was left for him to run.

## Windows installer and the GitHub release (3 November 2026)
- His words: "update the latest app release of flow so other people can easily download it … make sure it works for windows users". `npm run win` builds `release/Flow-Setup-<version>.exe` (NSIS, x64, one click, per user, desktop and Start shortcuts; 350 MB) on this Mac, with no Wine.
- The on-device AI needs Windows' own runtime in `node_modules/@node-llama-cpp/win-x64` (fetched with `npm pack`, see README's developer part). `build/after-pack.cjs` (electron-builder's `afterPack`) takes the other system's runtime out of each app, and `electron/due-ai` out of Windows': a platform's own `files` list only adds to the shared one (tried: a Windows `files` with only exclusions packed `tools/` and `savepoints/`, 620 MB).
- Windows in the code: ⌘ / ⌥ in labels are shown as Ctrl / Alt off a Mac (`KEY_MAC`, `keyText` in `flowEl`), ⌘1–6 of the quick log also take Ctrl, the menu bar is hidden (`autoHideMenuBar`), notifications get the app's id (`setAppUserModelId`), `dueAI` answers "none" off a Mac. The timetable from a picture and the iPhone steps stay Mac-only.
- Release `v1.0.0` on github.com/trihardio/flow, assets uploaded under fixed names (`Flow-Mac.dmg`, `Flow-Windows-Setup.exe`) so the README's buttons (`releases/latest/download/…`) keep working for later versions: upload a new version's files under the same names.
- The README is the GitHub page: the swamp as a banner with FLOW in pixel letters, a sprite per app, pixel download buttons (`docs/art/*.svg`, made by `node tools/readme/art.mjs`).
- **Not tried on a real Windows PC** (none here): the build was checked by what is inside it.

## Release 1.1.0 (4 November 2026)
- His words: "check for errors, bugs, lag, ui overlapping, and inconsistencies … then update the newest and latest release to my files folder and update the github". He chose: the files go in the project's `release/` folder, version **1.1.0**.
- **The routine for a release**: `npm run check` (must pass), `sh tools/perf/hunt-all.sh` (must print "nothing found"; not while he is using the app), the version in `package.json`, `npm run dmg` and `npm run win` (into `release/`), commit and push to `main`, then the GitHub release `v<version>` with the two files under the fixed names `Flow-Mac.dmg` and `Flow-Windows-Setup.exe`.
- The upload needs his GitHub login: auto mode refuses to read it from the keychain (and `gh` is not installed), so he uploads the two files on the release page himself, or installs `gh` and runs `gh auth login` once, after which `gh release create` can do it.
