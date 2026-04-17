import { db } from "@/lib/db";
import { trends } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = db.select().from(trends).orderBy(desc(trends.batchIndex)).limit(30).all();
    return NextResponse.json(data.reverse());
  } catch (error) {
    console.error("trends error", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
