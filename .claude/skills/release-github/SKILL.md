---
name: release-github
description: Release Flow to GitHub. Use when the user says "release to github", "release it", "publish a release", "new release", "update the download". Writes the release notes, bumps the version, builds the Mac and Windows installers, commits and pushes, publishes the GitHub release with its two files and checks the download buttons — with one script, few tokens.
---

# Release Flow to GitHub

Everything is in `tools/release/release.sh`. Do only these steps, quietly; don't re-read the scripts or the notes about them.

1. **What changed** (one command, read only its output):
   `git describe --tags --abbrev=0; git log --oneline $(git describe --tags --abbrev=0)..HEAD | head -30; git status --short | wc -l`
   and the "Changed today" lines of `notes/log/` since that tag's date (`grep -h "^- " notes/log/<dates>.md`).
2. **The version**: `minor` when something new he can see was added, `patch` for fixes only, `major` only when he says so (or the version he names).
3. **The notes**: write `release/RELEASE-NOTES-<new version>.md` in the shape of `release/RELEASE-NOTES-1.1.0.md`:
   `# Flow X.Y.Z`, `## New`, `## Fixed`, `## Download` (the two fixed file names). At most ~10 bullets, plain words for
   somebody who uses the app, no code names. Under 250 words.
4. **Run** in the background (about 5 minutes; builds and a 700 MB upload):
   `sh tools/release/release.sh <patch|minor|major|X.Y.Z>` — add `--hunt` only if he asks for the full test (10 more
   minutes, hidden runs that make his app lag).
5. **Then**: one line in `notes/installer.md` ("Release X.Y.Z (date)") and one in today's `notes/log/`; tell him the version
   and that both download buttons work (the script's last two lines), in two or three sentences.

If a step fails the script prints its tail and stops: fix that one thing, run the script again (it reuses the version
already set: pass the same X.Y.Z, not `patch` again). The login it uses is git's own (the Mac's keychain); if GitHub
refuses it, ask him to push once from this Mac. Never rename the two files: the README's buttons are
`releases/latest/download/Flow-Mac.dmg` and `…/Flow-Windows-Setup.exe`.
