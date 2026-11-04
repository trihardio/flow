// names used but declared in no enclosing scope; usage: node undef.mjs <projectDir> <file> [jsx|js]
import { readFileSync } from "node:fs";
const [dir, file, lang = "jsx"] = process.argv.slice(2);
const { parseAst } = await import(dir + "/node_modules/rolldown/dist/parse-ast-index.mjs");
const code = readFileSync(file, "utf8");
const ast = parseAst(code, { lang });
const nl = []; for (let i = 0; i < code.length; i++) if (code[i] === "\n") nl.push(i);
const line = (o) => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < o) lo = m + 1; else hi = m; } return lo + 1; };
const G = new Set([...Object.getOwnPropertyNames(globalThis), ..."window document navigator CSSAnimation localStorage sessionStorage requestAnimationFrame cancelAnimationFrame getComputedStyle matchMedia HTMLElement HTMLInputElement HTMLTextAreaElement HTMLCanvasElement HTMLImageElement Image FileReader ResizeObserver IntersectionObserver MutationObserver CSS DOMRect DOMMatrix PointerEvent KeyboardEvent FocusEvent MouseEvent WheelEvent InputEvent CustomEvent alert confirm prompt location history screen indexedDB Node Element SVGElement DOMParser XMLSerializer OffscreenCanvas createImageBitmap ImageData Path2D devicePixelRatio innerWidth innerHeight scrollX scrollY getSelection Range Selection DataTransfer ClipboardItem Notification CompressionStream DecompressionStream FontFace caches requestIdleCallback cancelIdleCallback require module exports __dirname __filename process Buffer arguments undefined NodeFilter Text visualViewport ShadowRoot HTMLDivElement HTMLButtonElement HTMLSelectElement HTMLMediaElement HTMLVideoElement Audio AudioContext Worker SharedWorker scrollTo scroll print open close focus blur self top parent frames VideoFrame ImageDecoder File FileList IDBKeyRange CSSStyleSheet StyleSheet getEventListeners".split(" ")]);
const stack = []; const miss = new Map();
const add = (n) => stack[stack.length - 1].add(n);
const has = (n) => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].has(n)) return true; return G.has(n); };
const ref = (n, at) => { if (!has(n)) { const k = miss.get(n) || []; k.push(line(at)); miss.set(n, k); } };
const bind = (p) => { if (!p) return; switch (p.type) {
  case "Identifier": add(p.name); break;
  case "ObjectPattern": p.properties.forEach((q) => bind(q.type === "RestElement" ? q.argument : q.value)); break;
  case "ArrayPattern": p.elements.forEach(bind); break;
  case "RestElement": bind(p.argument); break;
  case "AssignmentPattern": bind(p.left); break; } };
// the defaults and computed keys inside a pattern are references
const patRefs = (p) => { if (!p) return; switch (p.type) {
  case "ObjectPattern": p.properties.forEach((q) => { if (q.type === "RestElement") patRefs(q.argument); else { if (q.computed) walk(q.key); patRefs(q.value); } }); break;
  case "ArrayPattern": p.elements.forEach(patRefs); break;
  case "RestElement": patRefs(p.argument); break;
  case "AssignmentPattern": patRefs(p.left); walk(p.right); break;
  case "Identifier": break; default: walk(p); } };
const isFn = (n) => n && /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
const hoistVar = (n) => { if (!n || typeof n !== "object") return; if (Array.isArray(n)) return n.forEach(hoistVar); if (isFn(n)) return;
  if (n.type === "VariableDeclaration" && n.kind === "var") n.declarations.forEach((d) => bind(d.id));
  for (const k in n) if (k !== "loc" && k !== "range" && n[k] && typeof n[k] === "object") hoistVar(n[k]); };
const hoistBlock = (body) => { for (const s0 of body) { const s = s0.type === "ExportNamedDeclaration" || s0.type === "ExportDefaultDeclaration" ? s0.declaration || s0 : s0;
  if (s.type === "VariableDeclaration") s.declarations.forEach((d) => bind(d.id));
  else if ((s.type === "FunctionDeclaration" || s.type === "ClassDeclaration") && s.id) add(s.id.name);
  else if (s.type === "ImportDeclaration") s.specifiers.forEach((x) => add(x.local.name)); } };
const scoped = (f) => { stack.push(new Set()); f(); stack.pop(); };
const fn = (n) => scoped(() => {
  if (n.type === "FunctionExpression" && n.id) add(n.id.name);
  n.params.forEach(bind); n.params.forEach(patRefs);
  if (n.body.type === "BlockStatement") { hoistBlock(n.body.body); hoistVar(n.body.body); n.body.body.forEach(walk); } else walk(n.body); });
function walk(n) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach(walk);
  switch (n.type) {
    case "Program": return scoped(() => { hoistBlock(n.body); hoistVar(n.body); n.body.forEach(walk); });
    case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": return fn(n);
    case "BlockStatement": case "StaticBlock": return scoped(() => { hoistBlock(n.body); n.body.forEach(walk); });
    case "SwitchStatement": walk(n.discriminant); return scoped(() => { n.cases.forEach((c) => hoistBlock(c.consequent)); n.cases.forEach((c) => { walk(c.test); c.consequent.forEach(walk); }); });
    case "ForStatement": case "ForInStatement": case "ForOfStatement": return scoped(() => { const d = n.init || n.left; if (d && d.type === "VariableDeclaration") d.declarations.forEach((x) => bind(x.id));
      for (const k of ["init", "left", "test", "update", "right", "body"]) walk(n[k]); });
    case "CatchClause": return scoped(() => { bind(n.param); walk(n.body); });
    case "ClassDeclaration": case "ClassExpression": return scoped(() => { if (n.id) add(n.id.name); walk(n.superClass); walk(n.body); });
    case "VariableDeclarator": patRefs(n.id); return walk(n.init);
    case "Identifier": return ref(n.name, n.start);
    case "MemberExpression": walk(n.object); if (n.computed) walk(n.property); return;
    case "Property": case "MethodDefinition": case "PropertyDefinition": if (n.computed) walk(n.key); else if (n.shorthand && n.value && n.value.type === "Identifier") return walk(n.value); return walk(n.value);
    case "LabeledStatement": return walk(n.body);
    case "BreakStatement": case "ContinueStatement": return;
    case "ImportDeclaration": return;
    case "ExportSpecifier": return walk(n.local);
    case "MetaProperty": return;
    case "JSXOpeningElement": case "JSXClosingElement": { let x = n.name; while (x.type === "JSXMemberExpression") x = x.object; if (x.type === "JSXIdentifier" && /^[A-Z]/.test(x.name)) ref(x.name, x.start); if (n.attributes) walk(n.attributes); return; }
    case "JSXAttribute": return walk(n.value);
    case "JSXIdentifier": return;
  }
  for (const k in n) if (k !== "loc" && k !== "range" && n[k] && typeof n[k] === "object") walk(n[k]);
}
walk(ast);
const out = [...miss].sort((a, b) => a[1][0] - b[1][0]);
for (const [n, l] of out) console.log(n.padEnd(28), l.length, "uses, lines", l.slice(0, 6).join(" "));
console.log(out.length, "names not found");
