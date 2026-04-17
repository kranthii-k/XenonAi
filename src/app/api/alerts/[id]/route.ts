import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "No alert ID provided" }, { status: 400 });

    await db.delete(alerts).where(eq(alerts.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete alert", error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
}
