import { NextResponse } from 'next/server';
import { reviews, ingestionJobs } from '@/lib/db/schema';
import { analyzeBatch, BatchReview } from '@/lib/nlp/analyzer';
import * as crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reviews: reviewData, productId, url } = body;

    // Batch insert and prepare for analysis
    const batchId = crypto.randomUUID();
    const batchReviews: BatchReview[] = reviewData.map((r: any) => ({
      id: crypto.randomUUID(),
      product_id: productId || 'manual-ingest',
      batch_id: batchId,
      rawText: r.text,
      text: r.text,
      created_at: r.created_at || new Date().toISOString()
    }));

    // Trigger Async Batch Analysis (handles DB insertion and trends)
    analyzeBatch(batchReviews).catch((err: Error) => {
        console.error('[Sidecar API] Analysis trigger failed:', err);
    });

    return NextResponse.json({
      message: 'Successfully ingested from Sidecar',
      count: batchReviews.length,
      redirect_hint: '/dashboard'
    }, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });

  } catch (error) {
    console.error('[Sidecar API] Critical failure:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
