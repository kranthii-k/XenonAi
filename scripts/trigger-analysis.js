/**
 * trigger-analysis.js
 * Triggers NLP analysis for all seeded products that have un-analyzed reviews.
 * Posts each product's un-analyzed reviews through the ingest API so the
 * full analysis pipeline (ML server → feature_sentiments → trends → alerts) runs.
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(process.cwd(), 'sqlite.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const PRODUCTS = ['earbuds', 'laptops', 'geyser', 'refrigerator', 'microwave-oven'];
const BASE_URL = 'http://localhost:3000';

async function triggerProduct(productId) {
  // Get un-analyzed reviews (no overall_sentiment yet)
  const unanalyzed = db.prepare(`
    SELECT id, text, created_at FROM reviews
    WHERE product_id = ? AND (overall_sentiment IS NULL OR overall_sentiment = '')
    ORDER BY created_at ASC
  `).all(productId);

  if (unanalyzed.length === 0) {
    console.log(`⏭  ${productId}: no unanalyzed reviews`);
    return;
  }

  console.log(`🔄 Triggering analysis for ${productId} (${unanalyzed.length} reviews)...`);

  const reviewText = unanalyzed.map(r => r.text).join('\n');

  // Build multipart form data manually
  const boundary = `----FormBoundary${crypto.randomUUID().replace(/-/g, '')}`;
  const body = [
    `--${boundary}\r\nContent-Disposition: form-data; name="product_id"\r\n\r\n${productId}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n${reviewText}`,
    `--${boundary}--`
  ].join('\r\n');

  try {
    const res = await fetch(`${BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { 
      console.error(`  ✗ ${productId}: non-JSON response (${res.status}): ${text.slice(0, 120)}`);
      return;
    }

    if (data.error) {
      console.error(`  ✗ ${productId}: ${data.error}`);
    } else {
      console.log(`  ✓ ${productId}: job_id=${data.job_id?.slice(0, 8)} · queued=${data.queued_for_analysis}`);
    }
  } catch (e) {
    console.error(`  ✗ ${productId}: network error:`, e.message);
  }

  await new Promise(r => setTimeout(r, 600));
}

(async () => {
  console.log('Starting analysis trigger for all seeded products...\n');
  for (const pid of PRODUCTS) {
    await triggerProduct(pid);
  }
  console.log('\n✅ All analysis jobs submitted. Monitor progress on the Ingestion page.');
  db.close();
})();
