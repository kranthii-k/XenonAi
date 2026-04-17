import path from 'path';
import fs from 'fs';

interface SeedReview {
  id: string;
  product_id: string;
  text: string;
  created_at: string;
}

/**
 * GET /api/feed
 *
 * Server-Sent Events stream that emits reviews from the seed dataset
 * one at a time (0.8s interval), simulating a live inbound feed.
 *
 * The client (upload page) renders them in a live list.
 * This does NOT auto-ingest — the user decides to ingest via the upload form.
 */
export async function GET() {
  const seedPath = path.join(process.cwd(), 'data', 'seed', 'smartphones.json');

  let seedReviews: SeedReview[] = [];
  try {
    const raw = fs.readFileSync(seedPath, 'utf-8');
    seedReviews = JSON.parse(raw);
  } catch {
    // Fallback if seed file is missing
    seedReviews = [
      { id: 'fallback-1', product_id: 'demo', text: 'Seed data file not found. Add data/seed/smartphones.json.', created_at: new Date().toISOString() },
    ];
  }

  // Shuffle so each feed session is different
  const shuffled = [...seedReviews].sort(() => Math.random() - 0.5);
  // Stream at most 30 reviews per session to keep the demo snappy
  const batch = shuffled.slice(0, 30);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Periodic heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      for (const review of batch) {
        // Stop streaming if client closed connection
        if (controller.desiredSize === null) {
          clearInterval(heartbeat);
          return;
        }

        const payload = JSON.stringify({
          id: review.id,
          product_id: review.product_id,
          text: review.text,
          created_at: review.created_at,
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        await new Promise(r => setTimeout(r, 800));
      }
      
      clearInterval(heartbeat);
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
    cancel() {
      console.log('[feed] Client disconnected.');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
