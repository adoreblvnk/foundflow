import type { Case } from "./db";

export interface SearchableItem {
  id: string;
  label: string;
  caseId: string;
  location: string;
  foundTime: string;
  foundBy: string;
  itemType: string;
  category: string;
  currencyCode: string | null;
  currencyTotal: string | null;
  ocrText: string;
  visibleAttributes: string;
  confidence: number;
}

export function buildConfirmedSearchItems(cases: Case[]): SearchableItem[] {
  return cases
    .filter((caseFile) => caseFile.status === "finalised" && Boolean(caseFile.finalisedBy))
    .flatMap((caseFile) =>
      caseFile.manifest
        .filter((item) => item.status === "confirmed")
        .map((item) => ({
          id: item.id,
          label: item.label,
          caseId: caseFile.id,
          location: caseFile.location,
          foundTime: caseFile.foundTime,
          foundBy: caseFile.foundBy,
          itemType: item.itemType ?? "property",
          category: item.category ?? "other",
          currencyCode: item.currencyCode ?? null,
          currencyTotal: item.currencyTotal ?? null,
          ocrText: item.ocrText ?? "",
          visibleAttributes: item.visibleAttributes ?? "",
          confidence: item.confidence,
        })),
    );
}
