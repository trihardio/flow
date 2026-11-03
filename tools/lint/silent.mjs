// mistakes that make no error: a list's element without a key, a prop given twice, an object key given twice,
// x === NaN, a value compared with itself
import { readFileSync } from "node:fs";
const [dir, file] = process.argv.slice(2);
const { parseAst } = await import(dir + "/node_modules/rolldown/dist/parse-ast-index.mjs");
const code = readFileSync(file, "utf8");
const ast = parseAst(code, { lang: "jsx" });
const nl = []; for (let i = 0; i < code.length; i++) if (code[i] === "\n") nl.push(i);
const line = (o) => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < o) lo = m + 1; else hi = m; } return lo + 1; };
const out = [];
const src = (n) => code.slice(n.start, n.end);
const keyless = (el) => {
  if (!el) return false;
  if (el.type === "JSXFragment") return true;
  if (el.type === "JSXElement") return !el.openingElement.attributes.some((a) => a.type === "JSXAttribute" && a.name.name === "key");
  if (el.type === "ConditionalExpression") return keyless(el.consequent) || keyless(el.alternate);
  if (el.type === "LogicalExpression") return keyless(el.right);
  if (el.type === "ParenthesizedExpression") return keyless(el.expression);
  return false;
};
const returns = (fn) => { if (fn.body.type !== "BlockStatement") return [fn.body]; const r = [];
  const w = (n) => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(w); if (/Function/.test(n.type)) return; if (n.type === "ReturnStatement") r.push(n.argument); for (const k in n) if (n[k] && typeof n[k] === "object") w(n[k]); };
  w(fn.body.body); return r; };
function walk(n) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach(walk);
  if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && /^(map|flatMap)$/.test(n.callee.property.name)) {
    const f = n.arguments[0];
    if (f && /Function/.test(f.type) && returns(f).some(keyless)) out.push(`${line(n.start)}: a ${n.callee.property.name}'s element has no key`);
  }
  if (n.type === "JSXOpeningElement") {
    const seen = new Set();
    for (const a of n.attributes) if (a.type === "JSXAttribute") { const k = a.name.name; if (seen.has(k)) out.push(`${line(a.start)}: prop ${k} given twice`); seen.add(k); }
  }
  if (n.type === "ObjectExpression") {
    const seen = new Set();
    for (const p of n.properties) if (p.type === "Property" && !p.computed && p.kind === "init") { const k = p.key.name ?? String(p.key.value); if (seen.has(k)) out.push(`${line(p.start)}: key ${k} given twice`); seen.add(k); }
  }
  if (n.type === "BinaryExpression" && /^[!=]==?$/.test(n.operator)) {
    if (src(n.left) === "NaN" || src(n.right) === "NaN") out.push(`${line(n.start)}: compared with NaN`);
    else if (src(n.left) === src(n.right)) out.push(`${line(n.start)}: ${src(n.left).slice(0, 40)} compared with itself`);
  }
  for (const k in n) if (k !== "loc" && k !== "range" && n[k] && typeof n[k] === "object") walk(n[k]);
}
walk(ast);
console.log(out.join("\n") || "none"); console.log(out.length, "found");
