// The code map (9 November 2026, his words: "make me have a better claude coding experience"): notes/code-map.md, every
// component of src/App.jsx and every function of electron/main.cjs with its line, by area, and the file's own section
// banners in order. `npm run check` runs it (tools/check.sh), so the lines are those of the last check. Read the map, then
// the file at that line, instead of searching a 1.3 MB file. Written only when something changed.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8").split("\n");
const shell = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8").split("\n");

// area of a component, by its name: the first rule that matches wins (specific ones first)
const AREAS = [
  ["Panels before an app", "stage", /^(CoinFace|BtcCoin|FxDie|IdxGlobe|CardFace|CardPattern|Fa[A-Z]\w*|CrocLogo|PuzzleBody|ArenaSkin|ArenaBody|PythonBody|SimChip|RollWord|FootLogo|HlRings3D|Chevron)$/],
  ["Test data", "dev-test-data", /^(CardFlask|PartTestPop|TestCfg|TradeTestCfg|DayGrid)$/],
  ["Time plan", "time-plan", /^(Tp[A-Z]\w*|TimePlan|DgPlan)$/],
  ["Worth it", "worth-it", /^(Wi[A-Z]\w*|WorthIt)$/],
  ["Money exchanger", "exchanger", /^(FxRoll|FxDoor|Exchanger|CalcPad|DgFx)$/],
  ["Home widgets", "dashboard", /^(Dg[A-Z]\w*|DashWidget|HomeDash)$/],
  ["Health", "health", /^(Hl[A-Z]\w*|HealthApp|CardArrange|TimeField|ColorPick|RichBox)$/],
  ["Calculators", "calculators", /^(PositionCalc|StockCalc|CalcUndo|PcStatus|QuoteChip)$/],
  ["Trading", "trading", /^(Trade[A-Z]\w*|PnlAnalysis|CoinRing|Idx[A-Z]\w*|DepositBox|Shot|ShotView|Jr[A-Z]\w*|AnChart|PairBox|SideChip)$/],
  ["Accounts", "accounts", /^(AccountGate|Avatar|AvBack)$/],
  ["Navigation and settings", "navigation-settings", /^(SideNav|CmdBar|CtxMenu|Settings\w*|Set[A-Z]\w*|Kb\w*|ThemeSwitch|GlassSlider|XcleanNote|HamburgerIcon)$/],
  ["Undo", "data-export-undo", /^(UndoNote)$/],
  ["Split bill", "split-bill", /^(Bill[A-Z]\w*|SplitFold)$/],
  ["Logging on the finance side", "finance-day", /^(QuickLog|QlDate|AmountField|NoteFold|PartLines|RowAmt|TrashIcon)$/],
  ["Weekly expenses", "weekly-plans", /^(WeekPlans|WeekBox|WeekPin|WeekendFund)$/],
  ["Money flow, goals, debts", "money-flow-goals", /^(ProjChart|Debts|Subs|SubPick|GoalRing|GoalBar|SplitBar|InsFold|InsB|SecHead|RulePop)$/],
  ["Charts", "charts", /^(GlassTip|CmpButton|GhostLine|HoverSlot|RangePop)$/],
  ["Year and month panels, wrapped", "year-month-panels", /^(PnlCalendar|Reveal|FoldCard|Wr[A-Z]\w*|PxCount|PxFig|CatTitleReel|CatReel)$/],
];
const SHARED = ["Shared pieces (every side)", "style"];

const comps = [];
app.forEach((l, i) => {
  const m = l.match(/^(?:export default )?function ([A-Z]\w*)\(/) || l.match(/^const ([A-Z][a-z]\w*) = (?:memo\(|React\.memo\(|forwardRef\(|\(|async \()/);
  if (m) comps.push([m[1], i + 1]);
});
const groups = new Map();
for (const [name, line] of comps) {
  const a = AREAS.find((r) => r[2].test(name)) || SHARED;
  if (!groups.has(a[0])) groups.set(a[0], { note: a[1], items: [] });
  groups.get(a[0]).items.push(`\`${name}\` ${line}`);
}

// the tables and helpers every session ends up looking for (first declaration only)
const KEYS = ["store", "rawStore", "flowEl", "ld", "toLight", "lightCss", "LIGHT_EXTRA", "PAGE_BG", "TILE", "LG_LENS", "GLASS_KEY", "glassK",
  "THEME_KEY", "migrateSpending", "migrateIncomes", "MAX_AMOUNT", "fmt", "fmtLive", "liveText", "curBody", "curLive", "sanitizeAmount", "grp",
  "SHOT_KEYS", "CARD_TINT", "DG_W", "DG_SIZE", "DGH", "dgPlan", "dgRoom", "dgRows", "projectMonth", "useCmds", "openCtx", "warmWhenIdle",
  "warmFonts", "YEARS", "hlReadTimetable", "hlAsgReadMany", "CROC_LOGO"];
const keys = [];
for (const k of KEYS) {
  const re = new RegExp(`^(?:export )?(?:const|let|function|async function) ${k}\\b`), inner = new RegExp(`^\\s+const ${k} = `);
  let i = app.findIndex((l) => re.test(l));
  if (i < 0) i = app.findIndex((l) => inner.test(l));      // inside a component: the first one in the file (fmt and fmtLive are the finance panel's, YEARS the trading one's)
  if (i >= 0) keys.push(`\`${k}\` ${i + 1}`);
}

// the file's own section banners: /* ----- … ----- */ and /* ===== … ===== */
const secs = [];
app.forEach((l, i) => {
  const m = l.match(/\/\* [-=]{5,} (.+?) [-=]{5,}/);
  if (m) secs.push(`- ${i + 1} ${m[1].replace(/\s+/g, " ").slice(0, 110)}`);
});

const fns = [];
shell.forEach((l, i) => {
  const m = l.match(/^(?:async )?function (\w+)\(/) || l.match(/^const (\w+) = (?:async )?\(/);
  if (m) fns.push(`\`${m[1]}\` ${i + 1}`);
});

const out = [
  "# Code map",
  "",
  "Back to [[HOME]] · Made by `tools/vault/codemap.mjs`, run by `npm run check`: **don't edit by hand**. The numbers are lines of `src/App.jsx` (or `electron/main.cjs`) at the last check: read the file at that line instead of searching it. A file edited since the last check may have moved by a few lines.",
  "",
  `## Key tables and helpers`,
  keys.join(" · "),
  "",
  ...[...groups.entries()].flatMap(([label, g]) => [`## ${label}`, `Notes: [[notes/${g.note}]]`, "", g.items.join(" · "), ""]),
  "## The Mac shell (electron/main.cjs)",
  "Notes: [[notes/shell]]",
  "",
  fns.join(" · "),
  "",
  "## Sections of App.jsx, in order",
  "Its own banners. The stylesheet is one template near the end: liquid glass, Home and the rest of the look are there.",
  "",
  ...secs,
  "",
].join("\n");

const file = path.join(root, "notes/code-map.md");
let was = "";
try { was = fs.readFileSync(file, "utf8"); } catch (e) { /* first time */ }
if (was !== out) fs.writeFileSync(file, out);
