import { db } from '../db';
import { featureSentiments, reviews } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function triggerCrisisSwarm(productId: string, feature: string, alertMessage: string) {
  try {
    const rawUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/crisis-swarm';

    // 1. Fetch recent negative reviews for context
    const recentBadReviews = await db
      .select({ quote: featureSentiments.quote })
      .from(featureSentiments)
      .innerJoin(reviews, eq(featureSentiments.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.productId, productId),
          eq(featureSentiments.feature, feature),
          eq(featureSentiments.sentiment, 'negative')
        )
      )
      .orderBy(desc(reviews.createdAt))
      .limit(5);

    const quotes = recentBadReviews.map(r => r.quote);

    const payload = {
      product_id: productId,
      feature: feature,
      alert_message: alertMessage,
      recent_negative_quotes: quotes
    };

    // 2. Fire and forget
    fetch(rawUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      // Prevent blocking or hanging
      signal: AbortSignal.timeout(3000)
    }).catch(err => {
      console.warn('[webhook] Non-blocking crisis webhook failed to reach n8n:', err.message);
    });

  } catch (error) {
    console.warn('[webhook] Failed to trigger crisis swarm:', error);
  }
}
