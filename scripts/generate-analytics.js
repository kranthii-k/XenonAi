/**
 * generate-analytics.js
 * Generates trends and forecasts for the new products.
 * This ensures the dashboard charts don't stay empty.
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const products = ['earbuds', 'laptops', 'geyser', 'refrigerator', 'microwave-oven'];

// ─────────────────────────────────────────────────────────────────────────────
// Simple trend generator
// ─────────────────────────────────────────────────────────────────────────────
function generateTrendsForProduct(productId) {
  const reviews = db.prepare(`SELECT id, text, created_at FROM reviews WHERE product_id = ?`).all(productId);
  if (reviews.length === 0) return;

  const features = db.prepare(`
    SELECT feature, sentiment FROM feature_sentiments fs
    JOIN reviews r ON fs.review_id = r.id
    WHERE r.product_id = ?
  `).all(productId);

  const featureNames = [...new Set(features.map(f => f.feature))];
  const now = new Date().toISOString();
  const batchIndex = Math.floor(Date.now() / 1000);

  for (const feature of featureNames) {
    const fData = features.filter(f => f.feature === feature);
    const pos = fData.filter(f => f.sentiment === 'positive').length;
    const neg = fData.filter(f => f.sentiment === 'negative').length;
    const total = fData.length;

    const posPct = total > 0 ? (pos / total) * 100 : 0;
    const negPct = total > 0 ? (neg / total) * 100 : 0;

    db.prepare(`
      INSERT INTO trends (id, product_id, feature, batch_index, negative_pct, positive_pct, z_score, is_anomaly)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), productId, feature, batchIndex, negPct, posPct, 0.5, 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple forecast generator (Dummy data for ARIMA visual)
// ─────────────────────────────────────────────────────────────────────────────
function generateForecastsForProduct(productId) {
  const features = ['battery_life', 'sound_quality', 'heating_speed', 'cooling', 'heating'];
  
  for (const feature of features) {
    const data = [
      { cohort: 'M1', actual: 80 + Math.random() * 10, predicted: null },
      { cohort: 'M3', actual: 75 + Math.random() * 10, predicted: null },
      { cohort: 'M6', actual: 70 + Math.random() * 10, predicted: 72 },
      { cohort: 'M9', actual: null, predicted: 68 },
      { cohort: 'M12', actual: null, predicted: 65 },
      { cohort: 'M18', actual: null, predicted: 60 },
      { cohort: 'M24', actual: null, predicted: 55 },
    ];

    db.prepare(`
      INSERT INTO feature_forecasts (id, product_id, feature, data_json, last_updated)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, feature) DO UPDATE SET data_json = excluded.data_json
    `).run(crypto.randomUUID(), productId, feature, JSON.stringify(data), new Date().toISOString());
  }
}

(async () => {
  console.log('Generating trends and forecasts...');
  for (const pid of products) {
    generateTrendsForProduct(pid);
    generateForecastsForProduct(pid);
    console.log(`✓ Generated analytics for ${pid}`);
  }
  db.close();
  console.log('\nDone! Dashboard should now show charts for all products.');
})();
