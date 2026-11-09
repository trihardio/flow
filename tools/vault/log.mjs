// One line into today's daily note (9 November 2026): `node tools/vault/log.mjs "what changed [[notes/area]]"`.
// Makes notes/log/YYYY-MM-DD.md from notes/templates/daily.md if it isn't there (his Mac's date), and puts the line
// at the end of "## Changed today". Saves reading and rewriting the note by hand after every change.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const line = process.argv.slice(2).join(" ").trim();
if (!line) { console.error('usage: node tools/vault/log.mjs "what changed [[notes/area]]"'); process.exit(1); }
const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const file = path.join(root, "notes/log", `${day}.md`);
let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8")
  : fs.readFileSync(path.join(root, "notes/templates/daily.md"), "utf8").replace(/\{\{date:YYYY-MM-DD\}\}/g, day);
const lines = text.split("\n");
let at = lines.findIndex((l) => l.trim() === "## Changed today");
if (at < 0) { lines.push("", "## Changed today"); at = lines.length - 1; }
let end = at + 1;
while (end < lines.length && !lines[end].startsWith("## ")) end++;
while (end > at + 1 && lines[end - 1].trim() === "") end--;      // after the last line of the section, before its blank lines
lines.splice(end, 0, `- ${line.replace(/^- /, "")}`);
fs.writeFileSync(file, lines.join("\n"));
console.log(path.relative(root, file));
