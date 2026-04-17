/**
 * direct-analyze.js
 * Directly analyzes seeded reviews by calling the ML server and inserting
 * feature_sentiments into the DB — bypasses the HTTP ingest endpoint.
 * Run: node scripts/direct-analyze.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const ML_URL = 'http://127.0.0.1:5000/extract';

const products = ['earbuds', 'laptops', 'geyser', 'refrigerator', 'microwave-oven'];

// Check if ML server is running
async function checkMLServer() {
  try {
    const res = await fetch(ML_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Rule-based feature extractor (offline fallback)
function extractFeaturesOffline(text) {
  const lower = text.toLowerCase();
  const features = [];

  const featureKeywords = {
    'battery_life':       { pos: ['lasts','long battery','great battery'], neg: ['drains','battery dies','short battery','poor battery'] },
    'sound_quality':      { pos: ['sound quality','great audio','crisp','bass'], neg: ['muddy','tinny','poor sound','bad audio'] },
    'build_quality':      { pos: ['sturdy','solid build','premium feel','durable'], neg: ['creaks','flex','cheap feeling','broke'] },
    'performance':        { pos: ['fast','blazing','handles','smooth'], neg: ['throttles','slow','lag','hangs'] },
    'heating_speed':      { pos: ['heats quickly','fast heating','ready in'], neg: ['takes long','slow heating','25 minutes'] },
    'energy_efficiency':  { pos: ['energy efficient','low consumption','saves electricity'], neg: ['high consumption','electricity bill','power hungry'] },
    'cooling':            { pos: ['cool','fresh','cools well','maintains'], neg: ['warm inside','does not cool','temperature fluctuates'] },
    'noise':              { pos: ['quiet','silent','whisper'], neg: ['loud','noisy','annoying sound','buzzing'] },
    'display':            { pos: ['stunning display','great screen','crisp display'], neg: ['washed out','glare','dim screen'] },
    'heating':            { pos: ['evenly heats','no cold spots'], neg: ['cold spots','unevenly heats','burns edge'] },
    'comfort':            { pos: ['comfortable','fits well','lightweight','snug'], neg: ['hurts','falls out','uncomfortable','heavy'] },
    'durability':         { pos: ['durable','lasting','long lasting'], neg: ['broken','failed','cracked','rusted'] },
    'pairing':            { pos: ['seamless pairing','connects instantly','easy pairing'], neg: ['pairing issue','drops connection','difficult to pair'] },
    'safety':             { pos: ['safe','thermostat','safety feature'], neg: ['safety hazard','scalding','sparking','dangerous'] },
  };

  for (const [feature, kw] of Object.entries(featureKeywords)) {
    let sentiment = null;
    let quote = '';
    for (const word of kw.pos) {
      if (lower.includes(word)) { sentiment = 'positive'; quote = text.slice(0, 80); break; }
    }
    if (!sentiment) {
      for (const word of kw.neg) {
        if (lower.includes(word)) { sentiment = 'negative'; quote = text.slice(0, 80); break; }
      }
    }
    if (sentiment) {
      features.push({ feature, sentiment, confidence: 0.8, quote });
    }
  }

  const isPositive = /great|love|excellent|best|impressive|perfect|outstanding|solid/i.test(text);
  const isNegative = /terrible|worst|broken|failed|poor|bad|hate|regret|garbage/i.test(text);
  const overallSentiment = isNegative ? 'negative' : isPositive ? 'positive' : 'neutral';

  return { overall_sentiment: overallSentiment, overall_confidence: 0.75, features };
}

// Call ML server for analysis
async function analyzeWithML(text) {
  try {
    const res = await fetch(ML_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`ML server ${res.status}`);
    return await res.json();
  } catch {
    return null; // Will use offline fallback
  }
}

const insertFeature = db.prepare(`
  INSERT OR IGNORE INTO feature_sentiments (id, review_id, feature, sentiment, confidence, quote)
  VALUES (@id, @review_id, @feature, @sentiment, @confidence, @quote)
`);

const updateReview = db.prepare(`
  UPDATE reviews SET overall_sentiment = @sentiment WHERE id = @id
`);

async function analyzeProduct(productId, useML) {
  const unanalyzed = db.prepare(`
    SELECT id, text FROM reviews
    WHERE product_id = ? AND (overall_sentiment IS NULL OR overall_sentiment = '')
  `).all(productId);

  if (unanalyzed.length === 0) {
    console.log(`⏭  ${productId}: all reviews already analyzed`);
    return;
  }

  console.log(`\n🔄 ${productId}: analyzing ${unanalyzed.length} reviews (${useML ? 'ML server' : 'offline rules'})...`);
  let done = 0;

  for (const review of unanalyzed) {
    let result = useML ? await analyzeWithML(review.text) : null;
    if (!result) result = extractFeaturesOffline(review.text);

    // Insert features
    const insertFeatures = db.transaction((feats) => {
      for (const f of feats) {
        insertFeature.run({
          id: crypto.randomUUID(),
          review_id: review.id,
          feature: f.feature,
          sentiment: f.sentiment,
          confidence: f.confidence ?? 0.75,
          quote: f.quote ?? review.text.slice(0, 80),
        });
      }
    });

    if (result.features?.length > 0) {
      insertFeatures(result.features);
    }

    updateReview.run({ sentiment: result.overall_sentiment, id: review.id });
    done++;

    if (done % 10 === 0 || done === unanalyzed.length) {
      process.stdout.write(`\r  ✓ ${done}/${unanalyzed.length} done`);
    }

    if (useML) await new Promise(r => setTimeout(r, 80));
  }
  console.log(`\n  ✅ ${productId}: complete`);
}

(async () => {
  console.log('=== Direct Analysis ===\n');
  const mlAvailable = await checkMLServer();
  console.log(`ML server: ${mlAvailable ? '✓ online' : '✗ offline — using rule-based fallback'}\n`);

  for (const pid of products) {
    await analyzeProduct(pid, mlAvailable);
  }

  db.close();
  console.log('\n🎉 All done! Reload the dashboard to see real data.\n');
})();
