import type { Case, ManifestItem } from "./db.ts";

const sensitiveItemPattern = /\b(?:cash|currency|banknotes?|coins?|dollars?|ringgit|passport|identity|id card|credit card|debit card|serial(?: number)?|jewel(?:ry|lery)|watch|valuable)\b/i;

export function requiresSensitiveReview(label: string, ocrText = "", visibleAttributes = ""): boolean {
  return sensitiveItemPattern.test(`${label} ${ocrText} ${visibleAttributes}`);
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
