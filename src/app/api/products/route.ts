import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products
 * Returns all products grouped by category.
 */
export async function GET() {
  try {
    const data = db.select().from(products).all();
    return NextResponse.json(data);
  } catch (error) {
    console.error('products error', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
