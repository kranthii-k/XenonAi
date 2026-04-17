/**
 * seed-products.js
 * Seeds the DB with product records + curated reviews for 5 new categories.
 * Uses better-sqlite3 directly (same pattern as migrate-db.js).
 * Run: node scripts/seed-products.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ─────────────────────────────────────────────────────────────────────────────
// Products to seed (id must match what the ingest API uses as product_id)
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 'smartphones',    name: 'Smartphones',    category: 'Electronics',       launch_date: '2024-01-01' },
  { id: 'earbuds',        name: 'Earbuds',        category: 'Electronics',       launch_date: '2024-03-01' },
  { id: 'laptops',        name: 'Laptops',        category: 'Electronics',       launch_date: '2024-02-01' },
  { id: 'geyser',         name: 'Geyser',         category: 'Home Appliances',   launch_date: '2024-04-01' },
  { id: 'refrigerator',  name: 'Refrigerator',   category: 'Home Appliances',   launch_date: '2024-01-15' },
  { id: 'microwave-oven', name: 'Microwave Oven', category: 'Home Appliances',   launch_date: '2024-02-15' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Curated review texts per product (realistic, domain-specific, varied)
// ─────────────────────────────────────────────────────────────────────────────
const REVIEWS = {
  earbuds: [
    "Sound quality is absolutely incredible, deep bass and crisp highs.",
    "ANC works brilliantly, completely blocks out metro noise.",
    "Battery lasts 8 hours on a single charge, very impressive.",
    "Pairing is seamless with my phone, connected instantly.",
    "The fit is snug and comfortable even during workouts.",
    "Microphone picks up my voice clearly on calls.",
    "Sound quality is decent but bass is a bit weak for my taste.",
    "ANC doesn't block wind noise very well outdoors.",
    "Battery drains faster than advertised, barely 5 hours.",
    "Pairing with multiple devices is a pain, keeps dropping.",
    "The ear tips hurt after about an hour of use.",
    "Call quality is muffled, people on calls can barely hear me.",
    "Absolutely love the transparency mode, very natural.",
    "Charging case charges the buds 3 times, great for travel.",
    "The touch controls are very responsive and customizable.",
    "Sound leakage is noticeable at high volumes.",
    "Water resistance is solid, survived a heavy rain session.",
    "The companion app is intuitive and has good EQ options.",
    "Bass is too boosted, muddy for detailed music listening.",
    "Keeps falling out of my ears during runs.",
    "ANC level is adjustable which is a great feature.",
    "Latency is noticeable when watching videos, lip sync is off.",
    "Sound stage is wide and very immersive for the price.",
    "The carrying case feels premium and charges wirelessly.",
    "Right earbud stopped working after 2 months. Terrible quality.",
    "Very lightweight, you forget you're wearing them.",
    "Noise cancellation doesn't block low hum of AC units.",
    "The buds charge to 100% in just 45 minutes.",
    "Audio codec support is limited, no LDAC or aptX.",
    "Best earbuds I've ever owned in this price range.",
    "Microphone has terrible wind noise rejection.",
    "The auto-pause when removing one earbud works perfectly.",
    "Battery indicator in the case is not very accurate.",
    "Impressive dynamic range, from whispers to loud concerts.",
    "Both earbuds randomly disconnect sometimes.",
    "Voice assistant integration works hands-free flawlessly.",
    "The stem design looks sleek and professional.",
    "EQ presets in the app are all very similar and bland.",
    "Comfortable enough for 6-hour listening sessions.",
    "The seal creates a slight pressure feeling in the ear.",
    "Excellent call quality even in noisy environments.",
    "Software update bricked one of my earbuds, terrible.",
    "The spatial audio feature is a game changer for movies.",
    "Charging case hinge feels flimsy, might break soon.",
    "Great product overall, highly recommended for commuters."
  ],
  laptops: [
    "Battery life is phenomenal, lasts over 12 hours on a charge.",
    "Display is stunning, 2K resolution with excellent color accuracy.",
    "The keyboard has perfect travel and tactile feedback.",
    "Performance is blazing fast, handles heavy multitasking easily.",
    "Build quality feels premium, all-metal chassis is solid.",
    "Thermals are excellent, stays cool even under full load.",
    "Battery lasts only 5 hours under real-world usage.",
    "Display has a washed out color profile out of the box.",
    "Keyboard has flex and the trackpad is unresponsive sometimes.",
    "It throttles badly when running large ML models.",
    "The chassis creaks when you pick it up, cheap feeling.",
    "Fan noise is extremely loud when doing any heavy task.",
    "Stunning OLED display, perfect blacks and vibrant colors.",
    "Charges to 80% in just 30 minutes with fast charging.",
    "RAM and storage are not upgradeable, makes it feel dated.",
    "The trackpad is smooth and supports all multi-touch gestures.",
    "Speakers are surprisingly loud and clear for a thin laptop.",
    "Wifi connectivity drops frequently in crowded networks.",
    "The hinge wobbles when you type, very distracting.",
    "Boot time is under 10 seconds, incredibly fast startup.",
    "Webcam quality is terrible for video calls.",
    "Port selection is good: 2 USB-A, 2 USB-C, HDMI.",
    "Gets uncomfortably hot on the bottom during gaming.",
    "Comes with too much bloatware pre-installed.",
    "The build quality is exceptional, no flex anywhere.",
    "Weight is under 1.2kg, best lightweight laptop I've owned.",
    "Battery drains to zero in sleep mode overnight.",
    "Screen brightness is insufficient in direct sunlight.",
    "Performance benchmarks are excellent for the price point.",
    "Cooling vents are placed awkwardly and get blocked on lap.",
    "Keyboard backlight is adjustable and looks great.",
    "The speaker grille accumulates dust very quickly.",
    "This laptop handles 4K video editing without frame drops.",
    "Fingerprint reader is very fast and reliable.",
    "The charger brick is bulky and inconvenient for travel.",
    "Battery capacity degraded noticeably after 8 months.",
    "Screen glare is terrible even with anti-glare coating.",
    "Linux compatibility is excellent, everything works out of box.",
    "Powerful enough to run virtual machines smoothly.",
    "Thermal paste application was very poor from factory.",
    "The keyboard layout has a well-spaced numpad, great.",
    "USB-C charging is convenient, any charger works.",
    "The display's high refresh rate makes everything buttery smooth.",
    "Customer support was unhelpful when my unit arrived damaged.",
    "Easily the best productivity laptop in this category."
  ],
  geyser: [
    "Water heats up very quickly, ready in under 10 minutes.",
    "Energy efficiency is impressive, noticed a drop in electricity bill.",
    "Safety thermostat works perfectly, never overheats.",
    "Build quality is solid, stainless steel tank feels durable.",
    "Installation was straightforward and took less than an hour.",
    "Makes a loud popping noise when heating, very annoying.",
    "Water takes 25 minutes to heat up, too slow for mornings.",
    "Electricity consumption is very high, bill shot up this month.",
    "Thermostat failed after 3 months, water was scalding hot.",
    "The casing has already started rusting near the inlet.",
    "Reliable hot water supply even in cold winters, love it.",
    "Temperature control dial is very precise and easy to use.",
    "The pilot light keeps going out, frustrating to relight.",
    "Heating element failed within 6 months, poor component quality.",
    "Anti-siphon valve works correctly, great safety feature.",
    "Body feels very lightweight and appears to be thin metal.",
    "Excellent insulation, water stays hot for over 4 hours.",
    "The pressure relief valve drips constantly, must be defective.",
    "Warranty service was excellent, technician arrived same day.",
    "The outer body gets extremely hot to touch, safety hazard.",
    "Energy star rated, very efficient for a glass-lined tank.",
    "Makes grinding noise during operation, concerning sound.",
    "The anode rod is replaceable which extends the product life.",
    "Bracket mounting is wobbly, not secure on the wall.",
    "Hot water supply is consistent throughout the day.",
    "Sediment build-up clogged the outlet within 4 months.",
    "Temperature uniformity is excellent from first to last bucket.",
    "The digital display for temperature setting is very helpful.",
    "Paint on the body started peeling within weeks of installation.",
    "Outstanding performance, zero complaints after one year of use.",
    "Takes too long to recover between back-to-back showers.",
    "The inlet and outlet fittings are standard size, easy to plumb.",
    "Makes a ticking sound when heating that gradually worsens.",
    "Thermal cut-out activated twice in a week, reliability concern.",
    "Extremely quiet operation, can't tell when it's heating.",
    "Tank leaked from the bottom after 5 months of use.",
    "The capacity is perfect for a family of four.",
    "Pilot assembly is difficult to access for maintenance.",
    "Long-lasting performance, 3 years and still going strong.",
    "The safety valve rusted and cannot be operated anymore.",
    "Very compact design, fits in a tight bathroom corner easily.",
    "Heating coil burned out well before the warranty period.",
    "Anti-scale coating on the tank is highly effective.",
    "The power cord length is too short for flexible installation.",
    "Best geyser I've owned, exceeds all my expectations."
  ],
  refrigerator: [
    "Cooling performance is outstanding, vegetables stay fresh for weeks.",
    "Very energy efficient, consumes less than 2 units per day.",
    "Compressor is whisper quiet, can barely hear it running.",
    "Build quality is excellent, robust shelves and sturdy doors.",
    "Ice maker works flawlessly, produces ice very quickly.",
    "Takes over 3 hours to reach set temperature from warm start.",
    "Energy consumption is higher than the rated specification.",
    "Compressor is extremely loud at night, disturbs sleep.",
    "Door seal worn out in less than a year, warm spots inside.",
    "Ice maker jams frequently and dispenser makes cracking noises.",
    "Freezer maintains an even -18°C consistently, very reliable.",
    "The LED interior lighting is bright and coverage is excellent.",
    "Frost build-up in freezer every week despite auto-defrost claim.",
    "Water dispenser leaks slowly from the fitting, constant drip.",
    "Vegetable crisper drawer humidity control works perfectly.",
    "The door bins are too shallow and bottles keep falling.",
    "Digital temperature display is easy to read and set precisely.",
    "Fridge runs warm at the back, dairy spoils faster than expected.",
    "The handles feel cheap and plastic, don't match the price point.",
    "Impressive capacity for the compact footprint, very spacious inside.",
    "Alarm for open door is loud and triggers even for short durations.",
    "Adjustable shelving system accommodates tall items very well.",
    "Paint on the exterior scratches easily, shows marks quickly.",
    "Delivered with a dent on the door, poor packaging protection.",
    "Freezer door doesn't seal completely, frost everywhere.",
    "Smart diagnostics app helps identify issues before they occur.",
    "Runs continuously without cycling off, must have a fault.",
    "Temperature fluctuates 3-4 degrees throughout the day.",
    "The glass shelves are tempered and very easy to clean.",
    "Refrigerant smell detected when first powered on, alarming.",
    "Excellent after-sales service, technician fixed issue quickly.",
    "Produces vibration noise when compressor starts that rattles items.",
    "Fresh food zone keeps food at ideal humidity automatically.",
    "The water filter replacement cost is very expensive annually.",
    "Five years and the compressor is still going strong.",
    "Thermostat probe seems inaccurate, set to 4°C but reads 6°C.",
    "Perfect size for a family of five, plenty of storage.",
    "The plastic interior cracked after minor accidental impact.",
    "Inverter compressor technology noticeably reduces energy use.",
    "Ice dispenser is noisy and wakes up family members at night.",
    "Vegetable drawer gasket wore out after 8 months of use.",
    "Door-in-door feature is convenient for frequently used items.",
    "Control panel became unresponsive after a power surge.",
    "The finish is fingerprint-resistant and always looks clean.",
    "Best refrigerator purchase I've made in fifteen years."
  ],
  'microwave-oven': [
    "Heats food very evenly, no cold spots even in dense meals.",
    "Timer and power level controls are intuitive and responsive.",
    "The turntable rotates smoothly and distributes heat well.",
    "Pre-programmed cooking modes work accurately for most foods.",
    "Door seal is tight, no microwave leakage detected.",
    "Heats unevenly, edges burn while center stays cold.",
    "Controls are confusing, the manual is poorly written.",
    "Turntable stopped rotating after just two months of use.",
    "Auto-cook programs are wildly inaccurate for most dishes.",
    "Door latch broken after repeated use, safety concern.",
    "Convection mode bakes bread perfectly, crispy crust every time.",
    "Interior is very spacious, fits a large casserole dish easily.",
    "The fan continues running for 5 minutes after cooking, very odd.",
    "Paint inside the cavity is peeling and ending up in food.",
    "Display brightness is poor, cannot read in daylight.",
    "Defrost function is excellent, defrosts without cooking edges.",
    "Touch pad is very responsive and easy to program.",
    "Sparking occurred inside on first use, extremely dangerous.",
    "Energy consumption per cycle is very efficient and low.",
    "Door handle broke off completely within three months of use.",
    "Grill function creates a perfect golden crust on food.",
    "The magnetron emits a humming noise during high power use.",
    "Interior light stays on after door closes, must be a defect.",
    "Timer accuracy is perfect, consistent to the second.",
    "Plastic interior smells when heating food, chemical odour.",
    "Child lock feature works well, prevents accidental operation.",
    "Steam cooking accessory included works better than expected.",
    "Exterior gets very hot during operation, risk of burns.",
    "Consistent performance across all power levels is impressive.",
    "Touchpad stopped working after a minor water splash.",
    "Converts from microwave to oven mode very quickly.",
    "Buttons are too small and require too much pressure to activate.",
    "Auto-reheat function detects food amount and adjusts power.",
    "Makes a loud buzzing noise that increases over time.",
    "Easy to clean interior coating prevents stains from sticking.",
    "The clock resets after every power cut, frustrating.",
    "Excellent value for the combination of features offered.",
    "Carousel stopped working and customer service was unhelpful.",
    "Multi-stage cooking programs simplify complex recipes.",
    "Interior dimensions are smaller than shown in product photos.",
    "Sensor cooking detects steam and stops automatically, great.",
    "Glass turntable cracked from thermal shock during normal use.",
    "The silent mode mutes the beeping, perfect for late night use.",
    "Door alignment shifted over time causing a poor seal.",
    "Absolutely the best microwave oven in this price segment."
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Upsert products table
// ─────────────────────────────────────────────────────────────────────────────
const upsertProduct = db.prepare(`
  INSERT INTO products (id, name, launch_date, category)
  VALUES (@id, @name, @launch_date, @category)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category
`);

for (const p of PRODUCTS) {
  upsertProduct.run(p);
  console.log(`✓ Upserted product: ${p.id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert review rows (skip already-existing product_ids to avoid re-seeding)
// ─────────────────────────────────────────────────────────────────────────────
const checkExisting = db.prepare(`SELECT COUNT(*) as count FROM reviews WHERE product_id = ?`);
const insertReview = db.prepare(`
  INSERT OR IGNORE INTO reviews (id, product_id, text, created_at, batch_id, language)
  VALUES (@id, @product_id, @text, @created_at, @batch_id, 'en')
`);

const batchInsert = db.transaction((productId, reviews) => {
  const batchId = crypto.randomUUID();
  let count = 0;
  const base = new Date('2026-04-01T00:00:00Z');
  for (let i = 0; i < reviews.length; i++) {
    const ts = new Date(base.getTime() + i * 3600 * 1000).toISOString();
    insertReview.run({
      id: crypto.randomUUID(),
      product_id: productId,
      text: reviews[i],
      created_at: ts,
      batch_id: batchId,
    });
    count++;
  }
  return { batchId, count };
});

for (const [productId, reviews] of Object.entries(REVIEWS)) {
  const existing = checkExisting.get(productId);
  if (existing.count > 0) {
    console.log(`⏭  Skipping ${productId} — already has ${existing.count} reviews`);
    continue;
  }
  const { batchId, count } = batchInsert(productId, reviews);
  console.log(`✓ Seeded ${count} reviews for ${productId} (batch: ${batchId.slice(0, 8)}...)`);
}

db.close();
console.log('\n✅ Seed complete. Reviews are in DB — NLP analysis will run on next ingest trigger.');
console.log('   The dashboard product selector will now show all 6 products.');
