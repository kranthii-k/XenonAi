import { db } from "@/lib/db";
import { reviews, flaggedReviews, featureSentiments } from "@/lib/db/schema";
import { gt, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let lastCheck = new Date(Date.now() - 5000).toISOString(); // fetch last 5 seconds initially to populate

  const stream = new ReadableStream({
    async start(controller) {
      const timer = setInterval(async () => {
        try {
          const now = new Date().toISOString();
          
          // Fetch new valid reviews with features
          const newReviews = db
            .select({
              id: reviews.id,
              text: reviews.text,
              sentiment: reviews.overallSentiment,
              createdAt: reviews.createdAt,
              feature: featureSentiments.feature,
            })
            .from(reviews)
            .leftJoin(featureSentiments, eq(reviews.id, featureSentiments.reviewId))
            .where(gt(reviews.createdAt, lastCheck))
            .all();

          // Fetch new flagged reviews
          const newFlagged = db
            .select({
              id: flaggedReviews.id,
              text: flaggedReviews.rawText,
              reason: flaggedReviews.flagReason,
              score: flaggedReviews.similarityScore,
              flaggedAt: flaggedReviews.flaggedAt,
            })
            .from(flaggedReviews)
            .where(gt(flaggedReviews.flaggedAt, lastCheck))
            .all();

          lastCheck = now;

          const events: any[] = [];
          
          for (const row of newReviews) {
            events.push({
              type: 'review',
              id: row.id,
              text: row.text,
              sentiment: row.sentiment || 'neutral',
              feature: row.feature || 'General',
              timestamp: row.createdAt,
            });
          }

          for (const row of newFlagged) {
            events.push({
              type: 'flagged',
              id: row.id,
              text: row.text,
              reason: row.reason,
              score: row.score,
              timestamp: row.flaggedAt,
            });
          }

          if (events.length > 0) {
            const data = `data: ${JSON.stringify(events)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch (error) {
          console.error('[SSE]', error);
        }
      }, 1000);

      req.signal.addEventListener('abort', () => {
        clearInterval(timer);
        controller.close();
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
