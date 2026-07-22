import type { Case, ManifestItem } from "./db.ts";
import { addDecimals, isValidCurrencyCode, multiplyDecimal, normalizeDecimal } from "./currency.ts";

const sensitiveItemPattern = /\b(?:cash|money|currency|banknotes?|notes?|coins?|dollars?|ringgit|passport|identity|id card|credit card|debit card|serial(?: number)?|jewel(?:ry|lery)|watch|valuable)\b/i;
const currencyItemPattern = /(?:[$€£¥₹₩₽₺₫฿₱]|\b(?:cash|money|currency|banknotes?|specimen\s+notes?|coins?|dollars?|cents?|ringgit|sen|singapore\s+notes?|malaysian?\s+notes?|sgd|myr|usd|eur|gbp|jpy|cny)\b)/i;
const currencyContainerPattern = /\b(?:pouch|wallet|bag|container|envelope)\b/i;

export function requiresSensitiveReview(label: string, ocrText = "", visibleAttributes = ""): boolean {
  return sensitiveItemPattern.test(`${label} ${ocrText} ${visibleAttributes}`);
}

export function isCurrencyItem(item: ManifestItem): boolean {
  if (item.itemType === "currency") return true;
  if (item.currencyCode || item.denomination != null || item.currencyTotal != null) return true;
  return currencyItemPattern.test(`${item.label} ${item.ocrText ?? ""} ${item.visibleAttributes ?? ""}`)
    && !currencyContainerPattern.test(item.label);
}

export function summarizeCurrency(items: ManifestItem[]): Array<{ currencyCode: string; total: string }> {
  const totals = new Map<string, string>();
  for (const item of items) {
    const total = normalizeDecimal(item.currencyTotal);
    if (!isValidCurrencyCode(item.currencyCode) || total == null) continue;
    const code = item.currencyCode.toUpperCase();
    totals.set(code, addDecimals(totals.get(code) ?? "0", total));
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currencyCode, total]) => ({ currencyCode, total }));
}

export function mergeAiDraftWithStaffItems(existing: ManifestItem[], draft: ManifestItem[]): ManifestItem[] {
  const preservedStaffItems = existing.filter(
    (item) => item.id !== "outer-item-root" && (item.source ?? "staff") === "staff"
  );
  const preservedByLabel = new Map(
    preservedStaffItems.map((item) => [item.label.trim().toLowerCase(), item] as const)
  );
  const replacementIds = new Map<string, string>();

  for (const item of draft) {
    if (item.id === "outer-item-root") continue;
    const preserved = preservedByLabel.get(item.label.trim().toLowerCase());
    if (preserved) replacementIds.set(item.id, preserved.id);
  }

  const freshDraftItems = draft
    .filter((item) => item.id === "outer-item-root" || !replacementIds.has(item.id))
    .map((item) => ({
      ...item,
      parentId: item.parentId ? (replacementIds.get(item.parentId) ?? item.parentId) : null,
    }));

  return [...freshDraftItems, ...preservedStaffItems];
}

/**
 * Checks if a manifest contains any cyclic nesting dependencies.
 */
export function hasCycle(items: ManifestItem[]): boolean {
  const adj = new Map<string, string | null>();
  for (const item of items) {
    adj.set(item.id, item.parentId);
  }
  for (const item of items) {
    const visited = new Set<string>();
    let current: string | null = item.id;
    while (current !== null) {
      if (visited.has(current)) {
        return true;
      }
      visited.add(current);
      current = adj.get(current) || null;
    }
  }
  return false;
}

/**
 * Full domain validator for case manifest structure, labels, quantities, evidence links, and cycles.
 */
export function validateManifestStructure(caseFile: Case): string | null {
  const items = caseFile.manifest;

  // Basic case-level validation
  if (!caseFile.location || caseFile.location.trim() === "") {
    return "Location cannot be empty.";
  }
  const parsedTime = Date.parse(caseFile.foundTime);
  if (isNaN(parsedTime) || parsedTime <= 0) {
    return "Invalid found time.";
  }
  if (!caseFile.outerItemDescription || caseFile.outerItemDescription.trim() === "") {
    return "Outer item description cannot be empty.";
  }

  // Manifest-level validation
  if (items.length === 0) {
    return "Manifest must contain at least one item.";
  }

  const root = items.find((i) => i.id === "outer-item-root");
  if (!root) {
    return "Outer container item root is missing.";
  }
  if (root.parentId !== null) {
    return "Outer container item root cannot have a parent container.";
  }

  const itemIds = new Set(items.map((i) => i.id));

  // Verify unique IDs (prevent duplicate temp IDs or saved IDs)
  if (itemIds.size !== items.length) {
    return "Manifest contains items with duplicate identifiers.";
  }

  for (const item of items) {
    // Label check
    if (!item.label || item.label.trim() === "") {
      return `Item has an empty label.`;
    }

    // Status check
    if (item.status !== "confirmed" && item.status !== "review") {
      return `Item "${item.label}" has an invalid status: "${item.status}".`;
    }

    // Confidence check
    if (typeof item.confidence !== "number" || isNaN(item.confidence) || item.confidence < 0 || item.confidence > 1) {
      return `Item "${item.label}" has an invalid confidence level: "${item.confidence}".`;
    }

    if (isCurrencyItem(item)) {
      const codeValid = isValidCurrencyCode(item.currencyCode) && item.currencyCode === item.currencyCode.toUpperCase();
      const denomination = normalizeDecimal(item.denomination);
      const total = normalizeDecimal(item.currencyTotal);
      const denominationValid = denomination != null && denomination !== "0";
      const countValid = item.quantityKnown !== false && Number.isInteger(item.quantity) && item.quantity > 0;
      if (item.status === "confirmed" && (!codeValid || !denominationValid || !countValid || total == null)) {
        return `Currency item "${item.label}" requires a valid ISO 4217 currency code, denomination, known quantity, and exact total before confirmation.`;
      }
      if (denominationValid && countValid && total != null) {
        const expectedTotal = multiplyDecimal(denomination, item.quantity);
        if (expectedTotal !== total) {
          return `Currency item "${item.label}" total must equal denomination × quantity (${expectedTotal}).`;
        }
      }
    }

    // Parent container check
    if (item.id !== "outer-item-root") {
      if (!item.parentId) {
        return `Item "${item.label}" must be nested within a parent container.`;
      }
      if (!itemIds.has(item.parentId)) {
        return `Item "${item.label}" references a non-existent parent container ID: "${item.parentId}".`;
      }
      if (item.parentId === item.id) {
        return `Item "${item.label}" cannot reference itself as its parent container.`;
      }
    }
  }

  if (hasCycle(items)) {
    return "Manifest structure contains cyclic container references.";
  }

  for (const item of items) {
    if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      return `Item "${item.label}" has an invalid quantity (${item.quantity}). Must be a positive integer.`;
    }
  }

  // Determine allowed evidence IDs
  // NOT including 'unsupported-evidence-id' to ensure it blocks validation!
  const validEvidenceIds = new Set([
    "manual-creation",
    "manual-entry",
    "voice-command",
    "staff-added",
    ...caseFile.uploads.map((u) => u.id),
  ]);

  for (const item of items) {
    if (!item.evidenceId || !validEvidenceIds.has(item.evidenceId)) {
      return `Item "${item.label}" references an invalid or non-existent evidence ID: "${item.evidenceId}".`;
    }
  }

  return null;
}
