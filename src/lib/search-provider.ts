interface ProviderSearchCandidate {
  category: string;
  itemType: string;
  currencyCode: string | null;
  foundTime: string;
}

const safeCategories = new Set(["bags", "books", "cash", "clothing", "documents", "electronics", "jewellery", "keys", "other"]);

export function buildProviderCandidateSummaries(candidates: ProviderSearchCandidate[]): string {
  return candidates.map((item, index) => {
    const category = safeCategories.has(item.category) ? item.category : "other";
    const itemType = item.itemType === "currency" ? "currency" : "property";
    const currencyCode = /^[A-Z]{3}$/.test(item.currencyCode || "") ? item.currencyCode : null;
    const foundDate = /^\d{4}-\d{2}-\d{2}/.exec(item.foundTime)?.[0] || "unknown";
    return `[${index}] Category: ${category} | Type: ${itemType} | Currency: ${currencyCode || "none"} | Found date: ${foundDate}`;
  }).join("\n");
}
