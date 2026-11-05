// Takes plain functions out of src/App.jsx with everything they lean on, so they can be run and tested in Node (5 November
// 2026: the picture readers, tested on his reference screenshots). Top-level `const`s are followed from the names asked for
// to every top-level name they mention (not property names or object keys), and written in the file's own order to a
// module that is imported. A name that turns out to be JSX can't be taken out: keep tested functions free of it.
//   const { hlReadTimetable } = await pick(["hlReadTimetable"]);
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const { parseAst } = await import(pathToFileURL(join(root, "node_modules/rolldown/dist/parse-ast-index.mjs")).href);

export const pick = async (names) => {
  const code = readFileSync(join(root, "src/App.jsx"), "utf8");
  const ast = parseAst(code, { lang: "jsx" });
  const decl = new Map();          // name → { start, end, refs }
  const refs = (node, out) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((n) => refs(n, out)); return; }
    if (node.type === "Identifier") { out.add(node.name); return; }
    if (node.type === "MemberExpression") { refs(node.object, out); if (node.computed) refs(node.property, out); return; }
    if (node.type === "Property" || node.type === "MethodDefinition") { if (node.computed) refs(node.key, out); refs(node.value, out); return; }
    for (const k in node) if (k !== "loc" && k !== "range" && k !== "start" && k !== "end" && node[k] && typeof node[k] === "object") refs(node[k], out);
  };
  for (const st of ast.body) {
    if (st.type !== "VariableDeclaration") continue;
    for (const d of st.declarations) if (d.id.type === "Identifier") { const r = new Set(); refs(d.init, r); decl.set(d.id.name, { start: st.start, end: st.end, refs: r }); }
  }
  const need = new Set(), todo = [...names];
  while (todo.length) {
    const n = todo.pop();
    if (need.has(n) || !decl.has(n)) continue;
    need.add(n);
    for (const r of decl.get(n).refs) if (decl.has(r) && !need.has(r)) todo.push(r);
  }
  const missing = names.filter((n) => !decl.has(n));
  if (missing.length) throw new Error("not in App.jsx: " + missing.join(", "));
  const spans = [...new Map([...need].map((n) => [decl.get(n).start, decl.get(n)])).values()].sort((a, b) => a.start - b.start);   // (one statement may declare several)
  const out = spans.map((s) => code.slice(s.start, s.end)).join("\n") + `\nexport { ${names.join(", ")} };\n`;
  const file = join(tmpdir(), `flow-pick-${process.pid}.mjs`);
  writeFileSync(file, out);
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
};
