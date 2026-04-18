import { db } from "@/lib/db";
import { reviews, flaggedReviews, featureSentiments } from "@/lib/db/schema";
import { gt, eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let lastCheck = new Date(Date.now() - 5000).toISOString();

  const stream = new ReadableStream({
    async start(controller) {
      const timer = setInterval(async () => {
        try {
          const now = new Date().toISOString();

          // Fetch new valid reviews using Drizzle query API (async-safe)
          const newReviews = await db.query.reviews.findMany({
            where: (r, { gt: gtFn }) => gtFn(r.createdAt, lastCheck),
            orderBy: (r, { desc: descFn }) => [descFn(r.createdAt)],
            limit: 10,
          });

          // Fetch features for those reviews
          const reviewIds = newReviews.map(r => r.id);
          const feats = reviewIds.length > 0
            ? await db.query.featureSentiments.findMany({
                where: (fs, { inArray }) => inArray(fs.reviewId, reviewIds),
              })
            : [];

          // Fetch flagged reviews
          const newFlagged = await db.query.flaggedReviews.findMany({
            where: (fr, { gt: gtFn }) => gtFn(fr.flaggedAt, lastCheck),
            orderBy: (fr, { desc: descFn }) => [descFn(fr.flaggedAt)],
            limit: 5,
          });

          lastCheck = now;

          const events: object[] = [];

          for (const row of newReviews) {
            const rowFeats = feats.filter(f => f.reviewId === row.id);
            events.push({
              type: 'review',
              id: row.id,
              text: row.text,
              sentiment: row.overallSentiment || 'neutral',
              feature: rowFeats[0]?.feature || 'general',
              timestamp: row.createdAt,
            });
          }

          for (const row of newFlagged) {
            events.push({
              type: 'flagged',
              id: row.id,
              text: row.rawText,
              reason: row.flagReason,
              score: row.similarityScore,
              timestamp: row.flaggedAt,
            });
          }

          if (events.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(events)}\n\n`));
          }
        } catch (error) {
          console.error('[SSE stream]', error);
        }
      }, 1000);

      req.signal.addEventListener('abort', () => {
        clearInterval(timer);
        try { controller.close(); } catch { /* already closed */ }
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
