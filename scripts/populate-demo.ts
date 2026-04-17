import { analyzeBatch } from '../src/lib/nlp/analyzer';
import { db } from '../src/lib/db';
import { trends, alerts, reviews, featureSentiments, ingestionJobs } from '../src/lib/db/schema';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('--- Populating Dynamic Demo Data ---');
  
  // 1. Wipe old data for a fresh start (Order matters for FK constraints!)
  await db.delete(featureSentiments);
  await db.delete(reviews);
  await db.delete(trends);
  await db.delete(alerts);
  await db.delete(ingestionJobs);
  console.log('Database cleared.');

  // 2. Load seed data
  const seedPath = path.join(process.cwd(), 'data', 'seed', 'smartphones.json');
  const seedReviews = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  // 3. Process in 5 distinct batches to generate a timeline
  const batchSize = 25;
  const productId = 'demo-smartphone';

  for (let i = 0; i < 5; i++) {
    const start = i * batchSize;
    const end = start + batchSize;
    const batchReviews = seedReviews.slice(start, end).map((r: any) => ({
      id: Math.random().toString(36).substring(7),
      product_id: productId,
      batch_id: `batch-${i}`,
      rawText: r.text,
      text: r.text,
      created_at: new Date(Date.now() - (5 - i) * 3600000).toISOString() // 1 hour intervals
    }));

    console.log(`Processing batch ${i+1}/5 (${batchReviews.length} reviews)...`);
    await analyzeBatch(batchReviews);
    
    // Slight pause to ensure distinct timestamps if needed
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n--- Demo Data Population Complete ---');
  const rCount = (await db.select().from(reviews)).length;
  const tCount = (await db.select().from(trends)).length;
  console.log(`Final State: ${rCount} reviews, ${tCount} trend snapshots.`);
}

run().catch(console.error);
