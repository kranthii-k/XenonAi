import { db } from '@/lib/db';
import { flaggedReviews } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/flagged?product_id=X&limit=50
 *
 * Returns flagged reviews (bot patterns, exact/near duplicates)
 * so operators can audit what was filtered.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 500);

  try {
    const results = productId
      ? await db
          .select()
          .from(flaggedReviews)
          .where(eq(flaggedReviews.productId, productId))
          .orderBy(desc(flaggedReviews.flaggedAt))
          .limit(limit)
      : await db
          .select()
          .from(flaggedReviews)
          .orderBy(desc(flaggedReviews.flaggedAt))
          .limit(limit);

    const summary = results.reduce(
      (acc, r) => {
        acc[r.flagReason] = (acc[r.flagReason] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Response.json({ flagged: results, summary, total: results.length });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
