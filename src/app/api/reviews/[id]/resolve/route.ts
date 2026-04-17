import { db } from "@/lib/db";
import { reviews } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: "No review ID provided" }, { status: 400 });

    const body = await req.json();
    const { newSentiment } = body;

    if (!['positive', 'negative', 'neutral'].includes(newSentiment)) {
      return NextResponse.json({ error: "Invalid sentiment provided" }, { status: 400 });
    }

    await db.update(reviews)
      .set({ 
        overallSentiment: newSentiment,
        isSarcastic: false,
        isAmbiguous: false, 
      })
      .where(eq(reviews.id, id));
    
    return NextResponse.json({ success: true, newSentiment });
  } catch (error) {
    console.error("Failed to resolve review", error);
    return NextResponse.json({ error: "Failed to resolve review" }, { status: 500 });
  }
}
