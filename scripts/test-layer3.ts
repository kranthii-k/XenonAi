import { analyzeBatch } from '../src/lib/nlp/analyzer';
import { db } from '../src/lib/db';
import { trends, alerts, reviews, featureSentiments } from '../src/lib/db/schema';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('--- Layer 3 Verification ---');
  
  // 1. Cleanup
  await db.delete(trends);
  await db.delete(alerts);
  console.log('Cleaned up trends/alerts tables.');

  // 2. Load seed data (smartphones.json is reliable)
  const seedPath = path.join(process.cwd(), 'data', 'seed', 'smartphones.json');
  if (!fs.existsSync(seedPath)) {
    console.error('Seed file not found at:', seedPath);
    return;
  }
  const seedReviews = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  // 3. Process a batch
  const testBatch = seedReviews.slice(0, 120).map((r: any) => ({
    id: r.id || Math.random().toString(36).substring(7),
    product_id: r.product_id || 'test-smartphone',
    rawText: r.text,
    text: r.text,
    created_at: new Date().toISOString()
  }));

  console.log(`Processing ${testBatch.length} reviews for trend analysis...`);
  
  // This will use mock fallback if ANTHROPIC_API_KEY is missing, 
  // which still populates features for testing trends.
  await analyzeBatch(testBatch);

  console.log('Batch processed.');

  // 4. Check Results
  const currentTrends = db.select().from(trends).all();
  const currentAlerts = db.select().from(alerts).all();

  console.log(`\n--- DB STATE ---`);
  console.log(`Total Trends Recorded: ${currentTrends.length}`);
  console.log(`Total Alerts Recorded: ${currentAlerts.length}`);

  if (currentTrends.length > 0) {
    console.log('\nSample Trends:');
    currentTrends.slice(0, 5).forEach(t => {
      console.log(`- Feature: ${t.feature}, Neg: ${t.negativePct}%, Z-Score: ${t.zScore.toFixed(2)}`);
    });
  }

  if (currentAlerts.length > 0) {
    console.log('\nSystemic Alerts Generated:');
    currentAlerts.forEach(a => {
      console.log(`[${a.severity.toUpperCase()}] ${a.message} (Delta: ${a.delta}%)`);
    });
  }
  
  console.log('\nVerification complete.');
}

run().catch(console.error);
