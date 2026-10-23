/* Probes the expense categoriser the way the app runs it: the keyword lists of App.jsx first (inferCat), the on-device
   model and electron/ai-head.json for whatever they pass on (classify, as electron/ai.mjs does). The notes below are
   written to be hard: words hidden inside other words (sweatpants has "eat", seat cover has "eat", theater has "tea"),
   Indonesian and slang, brands, and the things the lists know only one meaning of. An answer may be one of several
   ("food|shopping") where the training lists themselves go both ways. Nothing is written; it prints every miss.
   usage: node tools/ai/probe.mjs [model.gguf] [ai-head.json]       (14 October 2026) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLlama } from "node-llama-cpp";
import { ROOT, norm, appRules } from "./lib.mjs";
import { classify, unpack, loadHeads } from "../../electron/ai-classify.mjs";

export const PROBE = {
  food: ["nasi goreng", "mie ayam", "gorengan", "martabak manis", "es kopi susu", "indomie", "seblak", "pecel lele", "warteg", "roti bakar",
    "meat for bbq", "beef steak", "great wall restaurant", "sweet corn", "wheat bread", "oat milk", "kopi kenangan", "janji jiwa", "makan siang kantor",
    "dinner with family", "beras 5kg|shopping", "sayur pasar", "galon aqua", "telur", "ayam geprek", "bakso pak kumis", "sushi tei", "kfc", "mcd drive thru",
    "grabfood", "gofood martabak", "shopeefood", "cheesecake", "croissant", "dimsum", "ramen", "pho", "durian", "buah apel", "susu ultra",
    "jajan", "ngopi", "makan malam", "brunch", "teh tarik", "boba", "matcha latte", "nasi padang", "soto ayam", "gado gado",
    "hot dog", "corn dog", "sate kelinci", "nasi sepiring", "bakso semangkok", "kopi saring", "es teh teko", "nasi kotak", "teh kotak", "martabak kertas", "nasi kucing"],
  transport: ["grab ke kantor", "gojek pulang", "bensin motor", "isi pertalite", "parkir mall", "tol cipali", "tiket kereta bandung", "krl", "mrt",
    "ojol", "taxi ke bandara", "servis motor", "ganti oli", "e-toll topup", "flazz", "bluebird", "busway", "pesawat ke bali", "damri", "tambal ban",
    "parking", "uber", "petrol", "train ticket", "boat to gili", "ferry", "toll road", "car wash", "gocar", "grabcar airport"],
  shopping: ["sweatpants", "sweater", "sweatshirt", "seat cover", "teapot", "beats headphones", "uniqlo", "zara", "h&m", "erigo", "kaos polos",
    "celana jeans", "kemeja", "sepatu", "sandal jepit", "jaket", "hoodie", "sneakers nike", "adidas", "tas kerja", "dompet", "shopee", "tokopedia",
    "lazada", "ikea", "sabun mandi", "shampoo", "skincare", "parfum", "charger hp", "mouse logitech", "keyboard", "detergen", "pet food", "makanan kucing",
    "kado ulang tahun|other", "socks", "underwear", "sunglasses", "watch strap", "phone case", "eat pray love book|other", "treadmill", "yoga mat", "cutlery set",
    "pants", "t-shirt", "kacamata", "jam tangan", "powerbank",
    "meja makan", "alat makan", "sendok makan", "steak knife", "lunch box", "termos es", "grinder kopi", "coffee table", "rice cooker", "snack kucing", "sweatpant"],
  bills: ["listrik", "token listrik", "pln", "pdam", "wifi", "indihome", "internet bulanan", "pulsa", "paket data", "bpjs", "netflix", "spotify",
    "youtube premium", "icloud", "sewa kos", "bayar kos", "rent", "cicilan motor", "asuransi", "iuran rt", "gas elpiji", "air bulanan", "chatgpt plus",
    "disney+", "apple music", "electricity bill", "water bill", "phone bill", "insurance", "mortgage"],
  other: ["potong rambut", "haircut", "dokter", "dentist", "zakat", "donasi", "sedekah", "gym membership", "nonton bioskop", "concert ticket",
    "theater ticket", "laundry kiloan|shopping", "vet kucing", "arisan", "kondangan", "angpao", "transfer ke mama", "bayar hutang|bills", "pijat", "spa",
    "kursus bahasa", "fotokopi", "print tugas", "biaya admin bank|bills", "denda tilang|bills", "steam wallet", "game top up", "treatment wajah", "massage", "museum",
    "jahit celana", "cuci sepatu", "permak jeans", "reparasi tas", "coffee maker repair", "kursus membuat roti", "hospital bill", "vet bill", "makeup artist"],
};

const MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (MAIN) {
  const modelPath = process.argv[2] || path.join(ROOT, "models", "flow-ai.gguf");
  const headPath = process.argv[3] || path.join(ROOT, "electron", "ai-head.json");
  const { inferCat } = appRules();
  const head = unpack(loadHeads(headPath).cat);
  const llama = await getLlama({ build: "never", logLevel: "error" });
  const model = await llama.loadModel({ modelPath });
  const ctx = await model.createEmbeddingContext();
  const rows = Object.entries(PROBE).flatMap(([cat, list]) => list.map((t) => { const [text, ...alt] = t.split("|"); return { text: norm(text), ok: [cat, ...alt] }; }));
  let listRight = 0, listWrong = 0, aiRight = 0, aiWrong = 0, ms = 0;
  const miss = [];
  for (const r of rows) {
    const byList = inferCat(r.text);
    if (byList) { if (r.ok.includes(byList)) listRight++; else { listWrong++; miss.push(`list  ${r.text} -> ${byList} (want ${r.ok.join("/")})`); } continue; }
    const t0 = performance.now();
    const { vector } = await ctx.getEmbeddingFor(head.prefix + r.text);
    ms += performance.now() - t0;
    const got = classify(head, vector);
    if (r.ok.includes(got)) aiRight++; else { aiWrong++; miss.push(`ai    ${r.text} -> ${got} (want ${r.ok.join("/")})`); }
  }
  const asked = aiRight + aiWrong;
  console.log(`${rows.length} notes · lists placed ${listRight + listWrong} (${listWrong} wrong) · the AI ${asked} (${aiWrong} wrong) · right in all ${listRight + aiRight}/${rows.length}`);
  console.log(`model ${path.basename(modelPath)} ${(fs.statSync(modelPath).size / 1e6).toFixed(0)} MB · head ${(fs.statSync(headPath).size / 1e6).toFixed(1)} MB · ${asked ? (ms / asked).toFixed(1) : 0} ms a note`);
  for (const m of miss) console.log("  " + m);
  await ctx.dispose(); await model.dispose();
}
