import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { desc, or, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = db.select().from(reviews).where(
      or(
        eq(reviews.isSarcastic, true),
        eq(reviews.isAmbiguous, true)
      )
    ).orderBy(desc(reviews.createdAt)).all();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("reviews queue error", error);
    return NextResponse.json({ error: "Failed to fetch review queue" }, { status: 500 });
  }
}
