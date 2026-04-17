import { db } from "@/lib/db";
import { featureSentiments } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = db.select({
      feature: featureSentiments.feature,
      sentiment: featureSentiments.sentiment,
      count: sql<number>`count(${featureSentiments.id})`
    }).from(featureSentiments).groupBy(featureSentiments.feature, featureSentiments.sentiment).all();
    
    const featureMap: Record<string, any> = {};
    for (const row of data as any[]) {
       if (!featureMap[row.feature]) featureMap[row.feature] = { positive: 0, neutral: 0, negative: 0, total: 0 };
       featureMap[row.feature][row.sentiment.toLowerCase()] += Number(row.count);
       featureMap[row.feature].total += Number(row.count);
    }
    
    const result = Object.keys(featureMap).map(feature => {
      const counts = featureMap[feature];
      return {
        feature,
        positive: Math.round((counts.positive / counts.total) * 100) || 0,
        neutral: Math.round((counts.neutral / counts.total) * 100) || 0,
        negative: Math.round((counts.negative / counts.total) * 100) || 0,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("features error", error);
    return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 });
  }
}
