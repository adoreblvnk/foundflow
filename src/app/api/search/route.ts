import { NextRequest, NextResponse } from "next/server";
import { getCases } from "@/lib/db";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, mode } = body as { query: string; mode: "text" | "ai" };

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  const cases = getCases();

  // Build flat list of all items with case metadata
  const allItems = cases.flatMap((c) =>
    c.manifest.map((item) => ({
      id: item.id,
      label: item.label,
      caseId: c.id,
      location: c.location,
      foundTime: c.foundTime,
      itemType: item.itemType || "property",
      currencyCode: item.currencyCode || null,
      currencyTotal: item.currencyTotal || null,
      ocrText: item.ocrText || "",
      visibleAttributes: item.visibleAttributes || "",
      confidence: item.confidence,
    }))
  );

  if (mode === "text") {
    // Simple text matching across label, ocrText, visibleAttributes, location
    const terms = query.toLowerCase().split(/\s+/);
    const results = allItems.filter((item) => {
      const haystack = `${item.label} ${item.ocrText} ${item.visibleAttributes} ${item.location} ${item.currencyCode || ""} ${item.itemType}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }).slice(0, 50);

    return NextResponse.json({ results });
  }

  // AI semantic mode
  if (allItems.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Limit to 100 items for the AI call
  const candidateItems = allItems.slice(0, 100);

  try {
    const itemDescriptions = candidateItems.map((item, i) => (
      `[${i}] "${item.label}" | Type: ${item.itemType} | Location: ${item.location} | OCR: "${item.ocrText}" | Attributes: "${item.visibleAttributes}" | Currency: ${item.currencyCode || "none"} ${item.currencyTotal || ""}`
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
          content: `A user is searching for found property items. Their query is: "${query}"\n\nHere are the available items:\n${itemDescriptions}\n\nReturn the indices of items that match or are similar to the user's query, ranked by relevance. Only include items with relevance > 0.3. Maximum 20 results.`,
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
      const haystack = `${item.label} ${item.ocrText} ${item.visibleAttributes} ${item.location} ${item.currencyCode || ""} ${item.itemType}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    }).slice(0, 20);

    return NextResponse.json({ results });
  }
}
