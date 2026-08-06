import { NextResponse } from "next/server";
import { seedDemoCase } from "@/lib/db";

export async function POST() {
  if (process.env.PLAYWRIGHT_TEST_MODE !== "1") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(await seedDemoCase());
}