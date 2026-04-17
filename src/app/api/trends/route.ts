import { db } from "@/lib/db";
import { trends } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');

  try {
    let query = db.select().from(trends).orderBy(desc(trends.batchIndex));
    
    // If productId is provided, filter; otherwise return all recent snapshots
    const data = productId 
      ? query.where(eq(trends.productId, productId)).limit(50).all()
      : query.limit(100).all();

    return NextResponse.json(data.reverse());
  } catch (error) {
    console.error("trends error", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
