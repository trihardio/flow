/* Wording of the questions put to the teacher model (tools/ai/distill.mjs). The note goes last so the long
   fixed part stays cached between questions. Gemma ignores system prompts, so this is sent as the user message. */

const quote = (text) => `"${String(text).replace(/"/g, "'")}"`;

export const catPrompt = (text) => `Categories for a personal expense tracker:
- food: anything you eat or drink (dishes, snacks, drinks, groceries, cafes, restaurants)
- transport: getting around and vehicles (rides, fuel, parking, tolls, tickets, vehicle rental, vehicle service, repair and washing)
- shopping: any physical item or product you buy (clothes, electronics, cables, tools, household and personal-care items, cosmetics, books)
- bills: recurring or mandatory payments (utilities, phone and internet, rent, instalments, credit card, insurance, taxes, fees, fines, and subscriptions to apps, streaming or AI services)
- other: services and activities that fit none of the above (health, haircut, entertainment, sport, donations, money given to people, postage, repairs of non-vehicles)

Examples:
"rendang" = food
"es teh manis" = food
"tambal ban" = transport
"tiket bus" = transport
"sabun mandi" = shopping
"powerbank" = shopping
"netflix" = bills
"token listrik" = bills
"periksa ke dokter" = other
"tiket bioskop" = other

The expense note below is short and may be Indonesian, Malay or English. It often just names a dish, a product, a shop, a brand or an app. Pick the category that fits best and answer with the category name only.

Expense note: ${quote(text)}`;

const ICON_MEANING = {
  savings: "general savings with no specific purpose",
  account_balance: "bank deposit, paying off debt, retirement",
  shield: "emergency fund, safety net",
  laptop_mac: "laptop, computer, tablet, monitor",
  phone_iphone: "phone",
  headphones: "headphones, speakers, audio gear",
  photo_camera: "camera, lens, drone",
  watch: "watch",
  sports_esports: "game console, gaming PC, video games",
  flight: "travel abroad, a trip to another country or city, pilgrimage",
  beach_access: "beach or island holiday",
  luggage: "domestic trip, road trip, going home for the holidays",
  home: "buying a house or land, home appliances",
  apartment: "renting a place, moving out",
  chair: "furniture, home decor",
  directions_car: "car",
  two_wheeler: "motorbike, scooter",
  school: "tuition, university, courses, thesis, studying abroad",
  menu_book: "books, reading",
  favorite: "wedding, engagement, honeymoon, partner",
  diamond: "jewellery, ring, gold, luxury item",
  celebration: "party, family event, religious celebration or ritual",
  redeem: "gift or present for someone",
  child_care: "baby, children, family outing",
  pets: "pets, aquarium, animals",
  fitness_center: "gym, sport, sports gear, running, cycling",
  medical_services: "medical or dental treatment, health",
  checkroom: "clothes, shoes, bags, fashion",
  music_note: "musical instrument, concert",
  trending_up: "investment, business capital",
  construction: "renovation, repairs, tools",
  star: "anything that fits nothing else",
};

export const goalPrompt = (text, icons) => `Icons for savings goals in a personal finance app:
${icons.map((ic) => `- ${ic}: ${ICON_MEANING[ic] || ic.replace(/_/g, " ")}`).join("\n")}

Examples:
"Macbook Air" = laptop_mac
"Liburan ke Bali" = beach_access
"DP rumah" = home
"Dana pensiun" = account_balance
"Sepeda lipat" = fitness_center
"Kado buat ayah" = redeem

The savings goal below is short and may be Indonesian, Malay or English. It often just names the thing being saved for. Pick the icon that fits best and answer with the icon name only.

Savings goal: ${quote(text)}`;
