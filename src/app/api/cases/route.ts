import { NextRequest, NextResponse } from "next/server";
import { createCase } from "@/lib/db";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const location = (formData.get("location") as string) || "Unknown";
  const foundTime = (formData.get("foundTime") as string) || new Date().toISOString();
  const foundBy = (formData.get("foundBy") as string) || "Kiosk officer";
  const outerItemDescription = (formData.get("outerItemDescription") as string) || "Found property";
  const notes = (formData.get("notes") as string) || "";

  try {
    const newCase = await createCase({
      location,
      foundTime,
      foundBy,
      outerItemDescription,
      notes,
      finalisedBy: "kiosk-staff",
    });
    return NextResponse.json({ id: newCase.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create case";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
