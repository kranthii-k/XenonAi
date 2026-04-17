
import { db } from '@/lib/db';
import { featureSentiments, reviews } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/features?product_id=X
 *
 * Aggregates feature-level sentiment counts across all analyzed reviews.
 * Returns data in the shape expected by the FeatureSentimentChart component.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');

  try {
    // Fetch all feature sentiments, optionally filtered by product
    let allFeatures;

    if (productId) {
      // Join feature_sentiments → reviews to filter by product
      allFeatures = await db
        .select({
          feature: featureSentiments.feature,
          sentiment: featureSentiments.sentiment,
          confidence: featureSentiments.confidence,
        })
        .from(featureSentiments)
        .innerJoin(reviews, eq(featureSentiments.reviewId, reviews.id))
        .where(eq(reviews.productId, productId));
    } else {
      allFeatures = await db
        .select({
          feature: featureSentiments.feature,
          sentiment: featureSentiments.sentiment,
          confidence: featureSentiments.confidence,
        })
        .from(featureSentiments);
    }

    // Aggregate: feature → { positive, negative, neutral, total }
    const aggregated = new Map<string, { positive: number; negative: number; neutral: number; total: number }>();

    for (const row of allFeatures) {
      if (!aggregated.has(row.feature)) {
        aggregated.set(row.feature, { positive: 0, negative: 0, neutral: 0, total: 0 });
      }
      const entry = aggregated.get(row.feature)!;
      entry.total++;
      if (row.sentiment === 'positive') entry.positive++;
      else if (row.sentiment === 'negative') entry.negative++;
      else entry.neutral++;
    }

    const features = [...aggregated.entries()]
      .map(([feature, counts]) => ({
        feature: feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        positive: Math.round((counts.positive / counts.total) * 100),
        negative: Math.round((counts.negative / counts.total) * 100),
        neutral: Math.round((counts.neutral / counts.total) * 100),
        total_mentions: counts.total,
      }))
      .sort((a, b) => b.total_mentions - a.total_mentions);

    return Response.json({ features, total_records: allFeatures.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });

  }
}
