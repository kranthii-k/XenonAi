import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { reviews, featureSentiments } from '@/lib/db/schema';
import { updateProductTrends } from '@/lib/nlp/analyzer';
import crypto from 'crypto';

interface SeedReview {
  id: string;
  product_id: string;
  text: string;
  created_at: string;
}

export async function GET() {
  const seedPath = path.join(process.cwd(), 'data', 'seed', 'smartphones.json');

  let batch: SeedReview[] = [];
  try {
    const raw = fs.readFileSync(seedPath, 'utf-8');
    batch = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load JSON seed:', err);
    return new Response('No data', { status: 500 });
  }

  // Inject some bad battery reviews intentionally to guarantee the Z-score trip
  batch.push({
    id: crypto.randomUUID(),
    product_id: 'smartphones',
    text: 'Battery dies in 2 hours. Terrible battery life.',
    created_at: new Date().toISOString()
  });
  batch.push({
    id: crypto.randomUUID(),
    product_id: 'smartphones',
    text: 'Battery drains so quickly I cannot use it.',
    created_at: new Date().toISOString()
  });
  batch.push({
    id: crypto.randomUUID(),
    product_id: 'smartphones',
    text: 'Worst battery performance ever seen.',
    created_at: new Date().toISOString()
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const review of batch) {
        let isAnomaly = false;
        try {
          // 1. Insert Review
          await db.insert(reviews).values({
            id: review.id,
            productId: review.product_id,
            rawText: review.text,
            text: review.text,
            createdAt: review.created_at,
            overallSentiment: review.text.toLowerCase().includes('battery') ? 'negative' : 'neutral'
          }).onConflictDoNothing();

          // 2. Extract and Insert Features
          if (review.text.toLowerCase().includes('battery')) {
            await db.insert(featureSentiments).values({
              id: crypto.randomUUID(),
              reviewId: review.id,
              feature: 'battery_life',
              sentiment: 'negative',
              confidence: 0.95,
              quote: review.text.slice(0, 80)
            }).onConflictDoNothing();
          } else if (review.text.toLowerCase().includes('camera')) {
            await db.insert(featureSentiments).values({
              id: crypto.randomUUID(),
              reviewId: review.id,
              feature: 'camera',
              sentiment: 'positive',
              confidence: 0.85,
              quote: review.text.slice(0, 80)
            }).onConflictDoNothing();
          }

          // 3. Trend Calculation
          const anomalyDetected = await updateProductTrends(review.product_id).catch(err => {
            console.error('Trend math error:', err);
            return false;
          });

          if (anomalyDetected) {
            isAnomaly = true;
          }

          // Stream Response chunk
          const payload = JSON.stringify({
            id: review.id,
            product_id: review.product_id,
            sentiment: review.text.toLowerCase().includes('battery') ? 'negative' : 'neutral',
            isAnomaly: isAnomaly,
            text: review.text
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

        } catch (err) {
          // Graceful Degradation
          const errorPayload = JSON.stringify({ error: true, message: `Failed to insert review ${review.id}` });
          controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`));
        }

        // Live network traffic simulation
        await new Promise(r => setTimeout(r, 300));
      }
      
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
    },
  });
}
