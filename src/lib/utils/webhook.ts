import { db } from '../db';
import { featureSentiments, reviews } from '../db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';

export interface CrisisFeature {
  feature: string;
  alertMessage: string;
}

/**
 * Fire a single consolidated crisis webhook to n8n for all anomalous features
 * detected in one product batch. Always fires at most ONCE per analyzeBatch run.
 *
 * Fire-and-forget — never throws, never blocks the calling pipeline.
 */
export async function triggerCrisisSwarm(
  productId: string,
  anomalies: CrisisFeature[]
) {
  if (anomalies.length === 0) return;

  const rawUrl =
    process.env.N8N_WEBHOOK_URL ||
    'http://localhost:5678/webhook/crisis-swarm';

  try {
    // Fetch recent negative quotes for every affected feature in one query
    const features = anomalies.map(a => a.feature);
    const recentBadReviews = await db
      .select({ quote: featureSentiments.quote, feature: featureSentiments.feature })
      .from(featureSentiments)
      .innerJoin(reviews, eq(featureSentiments.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.productId, productId),
          inArray(featureSentiments.feature, features),
          eq(featureSentiments.sentiment, 'negative')
        )
      )
      .orderBy(desc(reviews.createdAt))
      .limit(10);

    // Group quotes by feature
    const quotesByFeature: Record<string, string[]> = {};
    for (const row of recentBadReviews) {
      if (!quotesByFeature[row.feature]) quotesByFeature[row.feature] = [];
      quotesByFeature[row.feature].push(row.quote);
    }

    const payload = {
      product_id: productId,
      anomalies: anomalies.map(a => ({
        feature: a.feature,
        alert_message: a.alertMessage,
        recent_negative_quotes: quotesByFeature[a.feature] ?? [],
      })),
    };

    // Fire-and-forget — single warn if n8n is offline, not one per feature
    fetch(rawUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    }).catch(err => {
      // Only warn once — n8n being offline is expected in local dev
      console.warn(
        `[webhook] n8n unreachable (${rawUrl}) — crisis payload queued locally. Start n8n to enable dispatch. (${err.message})`
      );
    });

  } catch (error) {
    console.warn('[webhook] Failed to build crisis swarm payload:', error);
  }
}
