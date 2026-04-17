import { db } from "@/lib/db";
import { featureForecasts } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, sql, and } from "drizzle-orm";

export const dynamic = 'force-dynamic';

/**
 * GET /api/forecasts?product_id=X&feature=Y
 * 
 * Returns the ARIMA forecast data for a specific feature.
 * If feature is omitted, returns all forecasts for the product.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  const feature = searchParams.get('feature');

  if (!productId) {
    return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
  }

  try {
    const data = await db.query.featureForecasts.findMany({
      where: (ff: any, { and, eq }: any) => {
        const conditions = [eq(ff.productId, productId)];
        if (feature) conditions.push(eq(ff.feature, feature));
        return and(...conditions);
      }
    });

    // Parse the dataJson for the frontend
    const results = data.map((item: any) => ({
      ...item,
      data: JSON.parse(item.dataJson)
    }));

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("forecasts error", error);
    return NextResponse.json({ error: "Failed to fetch forecasts" }, { status: 500 });
  }
}
