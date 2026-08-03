import { NextRequest, NextResponse } from "next/server";
import { getCases } from "@/lib/db";
import { buildConfirmedSearchItems } from "@/lib/search";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

interface SearchFilters {
  location?: string;
  category?: string;
  foundBy?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, mode, filters } = body as { query: string; mode: "text" | "ai"; filters?: SearchFilters };

  const cases = await getCases();

  // Search only completed cases and items confirmed by staff.
  let allItems = buildConfirmedSearchItems(cases);

  // Apply structured filters
  if (filters) {
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      allItems = allItems.filter((i) => i.location.toLowerCase().includes(loc));
    }
    if (filters.category) {
      allItems = allItems.filter((i) => i.category === filters.category);
    }
    if (filters.foundBy) {
      const by = filters.foundBy.toLowerCase();
      allItems = allItems.filter((i) => i.foundBy.toLowerCase().includes(by));
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      allItems = allItems.filter((i) => new Date(i.foundTime).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime() + 86400000; // end of day
      allItems = allItems.filter((i) => new Date(i.foundTime).getTime() <= to);
    }
  }

  // If no text query, just return filtered results
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: allItems.slice(0, 50) });
  }

  if (mode === "text") {
    const terms = query.toLowerCase().split(/\s+/);
    const results = allItems.filter((item) => {
      const haystack = `${item.label} ${item.ocrText} ${item.visibleAttributes} ${item.location} ${item.currencyCode || ""} ${item.itemType} ${item.category} ${item.foundBy}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).slice(0, 50);

    return NextResponse.json({ results });
  }

  // AI semantic mode
  if (allItems.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const candidateItems = allItems.slice(0, 100);

  try {
    const itemDescriptions = candidateItems.map((item, i) => (
      `[${i}] "${item.label}" | Category: ${item.category} | Location: ${item.location} | Found: ${item.foundTime} | By: ${item.foundBy || "unknown"} | OCR: "${item.ocrText}" | Attributes: "${item.visibleAttributes}" | Currency: ${item.currencyCode || "none"} ${item.currencyTotal || ""}`
    )).join("\n");

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        matches: z.array(z.object({
          index: z.number().int().min(0).describe("Index of the matching item"),
          relevance: z.number().min(0).max(1).describe("How relevant this item is to the query (0-1)"),
        })).max(20),
      }),
      messages: [
        {
          role: "user",
          content: `A user is searching for found items. Their query is: "${query}"\n\nHere are the available items:\n${itemDescriptions}\n\nReturn the indices of items that match or are similar to the user's query, ranked by relevance. Only include items with relevance > 0.3. Maximum 20 results.`,
        },
      ],
    });

    const matches = result.object.matches
      .sort((a, b) => b.relevance - a.relevance)
      .filter((m) => m.index >= 0 && m.index < candidateItems.length);

    const results = matches.map((m) => ({
      ...candidateItems[m.index],
      relevance: m.relevance,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("AI search failed:", err);
    // Fallback to text search
    const terms = query.toLowerCase().split(/\s+/);
    const results = allItems.filter((item) => {
      const haystack = `${item.label} ${item.ocrText} ${item.visibleAttributes} ${item.location} ${item.category} ${item.foundBy}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    }).slice(0, 20);

    return NextResponse.json({ results });
  }
}
