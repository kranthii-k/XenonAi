import { db } from '../src/lib/db';
import { products, reviews, featureSentiments } from '../src/lib/db/schema';
import { getCohortAndDays } from '../src/lib/utils/cohorts';
import { Forecaster } from '../src/lib/nlp/forecaster';
import { eq } from 'drizzle-orm';

async function setup() {
  console.log('--- Setting up Layer 3 Analysis ---');

  const productId = 'demo-smartphone';

  // 1. Seed Product metadata
  console.log('Seeding product metadata...');
  await db.insert(products).values({
    id: productId,
    name: 'Xenon Pro Max',
    launchDate: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString(), // 6 months ago
    category: 'smartphones'
  }).onConflictDoUpdate({
    target: products.id,
    set: {
      launchDate: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString()
    }
  });

  const product = await db.query.products.findFirst({
    where: eq(products.id, productId)
  });
  
  if (!product) throw new Error('Product seeding failed');

  // 2. Backfill Cohorts for existing reviews
  console.log('Backfilling cohorts for existing reviews...');
  const allReviews = await db.select().from(reviews).where(eq(reviews.productId, productId));
  
  for (const r of allReviews) {
    const { cohort, daysSinceLaunch } = getCohortAndDays(r.createdAt, product.launchDate);
    await db.update(reviews)
      .set({ cohort, daysSinceLaunch })
      .where(eq(reviews.id, r.id));
  }
  console.log(`Backfilled ${allReviews.length} reviews.`);

  // 3. Trigger Initial Forecast
  console.log('Triggering initial ARIMA forecasting...');
  await Forecaster.updateProductForecasts(productId);
  console.log('Forecasting complete.');

  console.log('\n--- Layer 3 Setup Successfully Complete ---');
}

setup().catch(console.error);
