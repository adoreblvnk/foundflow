import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { getCaseById, addAuditLog, runInTransaction } from "@/lib/db";
import { summarizeCurrency } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const user = await getCurrentUser();
  const { id } = await params;
  const caseFile = getCaseById(id);

  if (!caseFile) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Block export if not finalised
  if (caseFile.status !== "finalised") {
    return new NextResponse("Forbidden: Case must be finalised and approved before export", { status: 403 });
  }

  try {
    // Record audit event for export
    runInTransaction(() => {
      addAuditLog(id, user!.username, "manifest_exported", "Exported approved JSON manifest data.");
    });

    // Clean payload for system ingestion with complete attributes and OCR references
    const exportData = {
      caseId: caseFile.id,
      location: caseFile.location,
      foundTime: caseFile.foundTime,
      outerItemDescription: caseFile.outerItemDescription,
      finalisedAt: caseFile.finalisedAt,
      finalisedBy: caseFile.finalisedBy,
      currencySummary: summarizeCurrency(caseFile.manifest),
      manifest: caseFile.manifest.map((item) => ({
        id: item.id,
        label: item.label,
        parentId: item.parentId,
        quantity: item.quantity,
        quantityKnown: item.quantityKnown ?? true,
        itemType: item.itemType ?? "property",
        confidence: item.confidence,
        status: item.status,
        source: item.source ?? "staff",
        evidenceId: item.evidenceId,
        currencyCode: item.currencyCode ?? null,
        denomination: item.denomination ?? null,
        currencyTotal: item.currencyTotal ?? null,
        ocrText: item.ocrText || "",
        visibleAttributes: item.visibleAttributes || "",
      })),
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="foundflow_manifest_${caseFile.id}.json"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate JSON export:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
