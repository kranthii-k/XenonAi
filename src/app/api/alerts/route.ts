import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(10).all();
    return NextResponse.json(data);
  } catch (error) {
    console.error("alerts error", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
