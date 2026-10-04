/* One-off teacher run: a large local model writes many realistic expense notes per topic and then
   categorises each one itself. The teacher is not shipped and not kept in the project (2.5 GB); it was
   https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf A note is kept only when its answer matches the topic's
   category, which filters out most of its mistakes. Output: distilled.txt, used by train.mjs.
   usage: node tools/ai/distill.mjs <big-model.gguf> */
import fs from "node:fs";
import path from "node:path";
import { getLlama, LlamaChatSession } from "node-llama-cpp";
import { HERE, norm } from "./lib.mjs";
import { catPrompt } from "./teacher-prompts.mjs";

const TOPICS = {
  food: [
    "Indonesian traditional snacks and market cakes (jajanan pasar, kue tradisional)", "Indonesian street food and fried snacks", "dishes from Padang, Java, Sunda, Bali, Manado, Makassar, Aceh, Palembang and Betawi cooking",
    "Indonesian drinks, iced desserts, herbal drinks and coffee orders", "Malaysian mamak, kopitiam and hawker dishes and drinks", "Japanese, Korean, Chinese, Thai, Indian, Middle Eastern and Western dishes as Indonesians write them",
    "restaurant, fast food, cafe, bakery and bubble tea brands in Indonesia", "restaurant, fast food, cafe and drink brands in Malaysia and Singapore", "cooking ingredients: vegetables, fruits, meat, fish, spices and staples in Indonesian and Malay",
    "packaged snacks, instant food, sweets and bottled drink brands sold in Indonesian and Malaysian minimarkets",
  ],
  transport: [
    "public transport and ride-hailing in Indonesia (words and operator names)", "public transport, tolls and ride-hailing in Malaysia and Singapore (words and operator names)", "fuel, parking and toll expenses in Indonesian, Malay and English",
    "motorbike and car service, spare parts and repairs in Indonesian and Malay", "airlines, intercity bus, train, ferry and travel shuttle operators in Southeast Asia", "vehicle paperwork and rentals in Indonesian and Malay (not taxes)",
  ],
  shopping: [
    "clothing, footwear and fashion accessories in Indonesian and Malay", "electronics, gadgets, computer and phone accessories", "furniture, bedding and home appliances in Indonesian and Malay", "kitchen tools and tableware in Indonesian and Malay",
    "toiletries, cleaning products and household supplies in Indonesian and Malay, including product brands", "cosmetics, skincare and perfume items and brands popular in Indonesia and Malaysia", "stationery, books, toys and gifts in Indonesian and Malay",
    "hand tools, hardware and home-repair materials in Indonesian and Malay", "baby items and pet supplies in Indonesian and Malay", "sports, outdoor and hobby equipment in Indonesian and Malay",
    "marketplaces, department stores, fashion, electronics and home-goods shop brands in Indonesia, Malaysia and Singapore",
  ],
  bills: [
    "utility bills in Indonesian, Malay and English (electricity, water, gas, waste, neighbourhood fees)", "mobile, internet and TV providers and plans in Indonesia and Malaysia", "streaming, music, cloud, software, AI and app subscriptions (brand names)",
    "loans, instalments, paylater, credit cards and insurance in Indonesia and Malaysia (words and company names)", "taxes, fines, bank fees, rent and school fees in Indonesian and Malay",
  ],
  other: [
    "health care: doctors, clinics, tests, treatments and medicines in Indonesian and Malay", "personal care services: hair, beauty, massage and spa in Indonesian and Malay", "entertainment and leisure: cinema, concerts, games, attractions and hotels in Indonesian and Malay",
    "sports activities, classes and venue rental in Indonesian and Malay", "donations, religious giving and money given to family or friends in Indonesian and Malay", "services: laundry, tailoring, repairs of gadgets and appliances, couriers, printing, documents in Indonesian and Malay",
    "courses, tutoring, exams and certifications in Indonesian and Malay", "game top-ups and in-game currencies as Indonesians write them",
  ],
};

const llama = await getLlama({ build: "never", logLevel: "error" });
const model = await llama.loadModel({ modelPath: process.argv[2] });
const seq = (await model.createContext({ contextSize: 4096 })).getSequence();
const labels = Object.keys(TOPICS);
const grammar = await llama.createGrammar({ grammar: `root ::= ${labels.map((l) => JSON.stringify(l)).join(" | ")}` });
const chat = async (prompt, opts) => {
  const s = new LlamaChatSession({ contextSequence: seq, autoDisposeSequence: false });
  try { return await s.prompt(prompt, opts); } finally { s.dispose({ disposeSequence: false }); }
};

const raw = new Map();      // note -> topic category
let seed = 100;
for (const [cat, topics] of Object.entries(TOPICS)) {
  for (const topic of topics) {
    for (const style of ["single words or two-word names only", "short notes of 1 to 3 words, the way people type quickly in a spending tracker"]) {
      await seq.clearHistory();
      const txt = await chat(`List 60 different real examples of: ${topic}.\nUse ${style}, lowercase, specific and commonly used. One per line, no numbering, no explanations, no prices.`, { maxTokens: 900, temperature: 0.8, seed: seed++ });
      for (const line of txt.split("\n")) {
        const t = norm(line.replace(/^[\s\-*•\d.)]+/, "").replace(/\(.*?\)/g, ""));
        if (t && t.length >= 2 && t.length <= 32 && !/[:;]/.test(t) && !raw.has(t)) raw.set(t, cat);
      }
    }
    console.log(cat, "|", topic.slice(0, 50), "| total", raw.size);
  }
}

await seq.clearHistory();
const kept = Object.fromEntries(labels.map((l) => [l, []]));
let dropped = 0, n = 0;
for (const [text, cat] of raw) {
  const answer = (await chat(catPrompt(text), { grammar, maxTokens: 8, temperature: 0 })).trim();
  if (answer === cat) kept[cat].push(text); else dropped++;
  if (++n % 500 === 0) console.log(`labelled ${n}/${raw.size}, dropped ${dropped}`);
}
const out = ["# Notes written and labelled by the teacher model (tools/ai/distill.mjs). Kept only where its label matched the topic.", ""];
for (const l of labels) out.push(`# ${l}`, kept[l].join(", "), "");
fs.writeFileSync(path.join(HERE, "distilled.txt"), out.join("\n"));
console.log(`kept ${n - dropped} of ${n}`);
process.exit(0);
