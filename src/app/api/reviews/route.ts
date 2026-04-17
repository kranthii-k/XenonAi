import { db } from '@/lib/db';
import { reviews } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

/**
 * GET /api/reviews?product_id=X&limit=50&offset=0
 * Returns paginated reviews with their analysis results.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

  try {
    const query = db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(limit).offset(offset);
    const results = productId
      ? await db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt)).limit(limit).offset(offset)
      : await query;

    // Summary counts
    const total = results.length;
    const sentimentCounts = results.reduce(
      (acc, r) => {
        const s = r.overallSentiment ?? 'unknown';
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Response.json({ reviews: results, total, sentimentCounts, limit, offset });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
