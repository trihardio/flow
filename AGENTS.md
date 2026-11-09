# Flow project instructions

## Start of each session

- Read `CLAUDE.md` in full and follow its project guidance. It is the shared source of project rules for Claude and Codex.
- Read `HOME.md`, `PRODUCT.md`, `notes/handoff.md`, and `notes/inbox.md`.
- Read today's note in `notes/log/` if it exists; otherwise read the most recent daily note. Use the user's local date for new daily notes.
- Read `notes/claude-memory/MEMORY.md` when available, then any memory notes relevant to the task. This is a link to Claude Code's memory on this Mac; if it is unavailable, continue with the shared project notes and mention the missing context.
- Check the current code and Git state against older notes. Handoffs and product descriptions may describe work that has since changed. Current user instructions and verified code take precedence over outdated notes.

## Before working on a feature

- Read its area notes listed in `CLAUDE.md` and the notes for any other area the change touches.
- Read relevant nested `CLAUDE.md` files before working in their folders or running their tools, including `tools/perf/CLAUDE.md` and `savepoints/CLAUDE.md` when applicable. Do not assume Codex loads these filenames automatically.
- Preserve existing uncommitted work. Other Claude or Codex sessions may be editing the same files: reread the affected section before writing and merge targeted edits onto the current file.
- Follow the existing backup, data protection, offline, design, and performance rules in `CLAUDE.md` and `PRODUCT.md`.

## Shared knowledge and Obsidian

This project folder is also the Obsidian vault. Codex, Claude Code, Claudian, and Obsidian use the same Markdown files here; direct file access is sufficient for this setup.

- Follow `CLAUDE.md`'s inbox workflow. Remove an inbox item only after it has been filed or completed, and briefly report where it went.
- Before calling a change done, run `npm run check` (build and lint, about 3 seconds) and fix whatever it reports. Before a release, also `sh tools/perf/hunt-all.sh` (see `tools/perf/CLAUDE.md`; not while the user is using the app).
- After a change, update the relevant area note and add a line to today's daily note with `node tools/vault/log.mjs "what changed [[notes/area]]"` (it makes the note from `notes/templates/daily.md` if needed), linking the area note with Obsidian links.
- To find code, read `notes/code-map.md` first: every component of `src/App.jsx` and function of `electron/main.cjs` with its line, by area (rewritten by `npm run check`). Then read the file at that line instead of searching the 1.3 MB file. The Mac shell and its network rules are in `notes/shell.md`.
- Record important decisions, rejected approaches, and relevant user preferences in the existing area notes. Keep unfinished work, checks, and blockers in `notes/handoff.md` so either assistant can continue.
- Keep this file as the Codex entry point and keep detailed shared knowledge in `CLAUDE.md` and the existing notes. Add any new area note to both the area list in `CLAUDE.md` and `HOME.md`.
- Shared notes carry saved knowledge between assistants; past conversations, Claude-specific hooks, tools, and permissions are not automatically imported.
