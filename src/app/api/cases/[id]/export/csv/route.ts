import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { getCaseById, addAuditLog, runInTransaction } from "@/lib/db";
import { escapeCsvCell } from "@/lib/csv-utils";
import { summarizeCurrency } from "@/lib/validation";
import { formatDecimal } from "@/lib/currency";

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
      addAuditLog(id, user!.username, "manifest_exported", "Exported approved CSV manifest report.");
    });

    // Header Row
    const headers = [
      "Item ID",
      "Label",
      "Parent ID",
      "Quantity",
      "Quantity Known",
      "Item Type",
      "Confidence %",
      "Status",
      "Source",
      "Evidence ID",
      "Currency Code",
      "Denomination",
      "Line Currency Total",
      "Case Currency Total",
      "OCR Text",
      "Visible Attributes",
    ];
    const csvRows = [headers.map(escapeCsvCell).join(",")];
    const currencyTotals = new Map(
      summarizeCurrency(caseFile.manifest).map(({ currencyCode, total }) => [currencyCode, total] as const)
    );

    caseFile.manifest.forEach((item) => {
      const row = [
        item.id,
        item.label,
        item.parentId || "",
        item.quantity.toString(),
        (item.quantityKnown ?? true).toString(),
        item.itemType ?? "property",
        Math.round(item.confidence * 100).toString(),
        item.status,
        item.source ?? "staff",
        item.evidenceId || "",
        item.currencyCode || "",
        item.denomination ? formatDecimal(item.denomination) : "",
        item.currencyTotal ? formatDecimal(item.currencyTotal) : "",
        item.currencyCode && currencyTotals.get(item.currencyCode) ? formatDecimal(currencyTotals.get(item.currencyCode)!) : "",
        item.ocrText || "",
        item.visibleAttributes || "",
      ];
      csvRows.push(row.map(escapeCsvCell).join(","));
    });

    const csvContent = csvRows.join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="foundflow_manifest_${caseFile.id}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate CSV export:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
