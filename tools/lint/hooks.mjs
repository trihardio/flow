// hooks called where React can't count on them: under a condition or loop, in a nested callback, after an early return
import { readFileSync } from "node:fs";
const [dir, file] = process.argv.slice(2);
const { parseAst } = await import(dir + "/node_modules/rolldown/dist/parse-ast-index.mjs");
const code = readFileSync(file, "utf8");
const ast = parseAst(code, { lang: "jsx" });
const nl = []; for (let i = 0; i < code.length; i++) if (code[i] === "\n") nl.push(i);
const line = (o) => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < o) lo = m + 1; else hi = m; } return lo + 1; };
const isFn = (n) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
const COND = /^(IfStatement|ConditionalExpression|LogicalExpression|ForStatement|ForInStatement|ForOfStatement|WhileStatement|DoWhileStatement|SwitchCase|TryStatement|CatchClause)$/;
const fnName = (f, parent) => f.id ? f.id.name : parent && parent.type === "VariableDeclarator" && parent.id.type === "Identifier" ? parent.id.name
  : parent && parent.type === "CallExpression" && parent.callee && /^(memo|forwardRef)$/.test(parent.callee.name || (parent.callee.property && parent.callee.property.name)) ? "(memo)" : null;
const out = [];
const returned = new WeakMap();   // a component's body: has a return been passed yet
function walk(n, anc) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, anc));
  if (n.type === "CallExpression") {
    const c = n.callee, nm = c.type === "Identifier" ? c.name : c.type === "MemberExpression" && c.object.name === "React" ? c.property.name : null;
    if (nm && /^use[A-Z]/.test(nm)) {
      let fi = anc.length - 1; while (fi >= 0 && !isFn(anc[fi])) fi--;
      const f = anc[fi], name = f ? fnName(f, anc[fi - 1]) || (anc[fi - 1] && anc[fi - 1].type === "CallExpression" && anc[fi - 2] && anc[fi - 2].type === "VariableDeclarator" ? anc[fi - 2].id.name : null) : null;
      const why = [];
      if (!f) why.push("outside a function");
      else if (!name || !/^(use[A-Z]|[A-Z]|\(memo\))/.test(name)) why.push(`inside ${name || "an unnamed function"}`);
      for (let i = fi + 1; i < anc.length; i++) if (COND.test(anc[i].type)) { why.push(`under ${anc[i].type}`); break; }
      if (f && returned.get(f)) why.push("after an early return");
      if (why.length) out.push(`${line(n.start)}: ${nm} ${why.join(", ")}`);
    }
  }
  if (n.type === "ReturnStatement") { let fi = anc.length - 1; while (fi >= 0 && !isFn(anc[fi])) fi--; if (fi >= 0 && anc.slice(fi + 1).some((a) => COND.test(a.type))) returned.set(anc[fi], true); }
  const a2 = anc.concat([n]);
  for (const k in n) if (k !== "loc" && k !== "range" && n[k] && typeof n[k] === "object") walk(n[k], a2);
}
walk(ast, []);
console.log(out.join("\n") || "none"); console.log(out.length, "suspect hook calls");
