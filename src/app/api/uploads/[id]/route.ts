import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getCases } from "@/lib/db";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const { id } = await params;

  // Find the upload record in our database
  const cases = getCases();
  let uploadRecord = null;
  for (const c of cases) {
    const upload = c.uploads.find((u) => u.id === id);
    if (upload) {
      uploadRecord = upload;
      break;
    }
  }

  if (!uploadRecord) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const filePath = path.join(UPLOADS_DIR, uploadRecord.filename);
  if (!fs.existsSync(filePath)) {
    return new NextResponse("File Not Found on Disk", { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": uploadRecord.mimeType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to serve private evidence upload:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
