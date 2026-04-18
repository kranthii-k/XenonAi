import { NextResponse } from 'next/server';
import { DEMO_REVIEWS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');

  if (!productId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: product_id' },
      { status: 400 }
    );
  }

  const reviews = DEMO_REVIEWS[productId];

  if (!reviews) {
    return NextResponse.json(
      {
        error: `No demo reviews found for product_id: "${productId}"`,
        valid_product_ids: Object.keys(DEMO_REVIEWS),
      },
      { status: 400 }
    );
  }

  return NextResponse.json(reviews);
}
