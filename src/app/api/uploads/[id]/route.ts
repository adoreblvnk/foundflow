import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getCases } from "@/lib/db";
import { readEvidence } from "@/lib/evidence-storage";

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
  const cases = await getCases();
  let uploadRecord = null;
  for (const caseFile of cases) {
    const upload = caseFile.uploads.find((candidate) => candidate.id === id);
    if (upload) {
      uploadRecord = upload;
      break;
    }
  }

  if (!uploadRecord) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const fileBuffer = await readEvidence(uploadRecord.filename);
    if (!fileBuffer) return new NextResponse("File Not Found", { status: 404 });
    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": uploadRecord.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to serve private evidence upload:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
