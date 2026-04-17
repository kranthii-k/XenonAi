import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');

  try {
    let query = db.select().from(alerts).orderBy(desc(alerts.createdAt));
    
    const data = productId
      ? query.where(eq(alerts.productId, productId)).limit(20).all()
      : query.limit(20).all();

    return NextResponse.json(data);
  } catch (error) {
    console.error("alerts error", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
