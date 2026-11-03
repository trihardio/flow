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
