import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getCases } from "@/lib/db";
import { buildConfirmedSearchItems } from "@/lib/search";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const searchRequestSchema = z.object({
  query: z.string().trim().max(500).default(""),
  mode: z.enum(["auto", "text"]).optional(),
  filters: z.object({
    location: z.string().trim().max(120).optional(),
    category: z.string().trim().max(50).optional(),
    foundBy: z.string().trim().max(120).optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
  }).optional(),
}).strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

class RequestTooLargeError extends Error {}

async function readBoundedJson(request: NextRequest, maximumBytes: number): Promise<unknown> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new RequestTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) return json({ error: "Unauthenticated" }, 401);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return json({ error: "Search request is too large" }, 413);

  let parsed: z.infer<typeof searchRequestSchema>;
  try {
    parsed = searchRequestSchema.parse(await readBoundedJson(request, 16_384));
  } catch (error) {
    if (error instanceof RequestTooLargeError) return json({ error: "Search request is too large" }, 413);
    return json({ error: "Invalid search request" }, 400);
  }
  const { query, filters } = parsed;
  const cases = await getCases();

  let allItems = buildConfirmedSearchItems(cases);
  if (filters?.location) {
    const location = filters.location.toLowerCase();
    allItems = allItems.filter((item) => item.location.toLowerCase().includes(location));
  }
  if (filters?.category) allItems = allItems.filter((item) => item.category === filters.category);
  if (filters?.foundBy) {
    const foundBy = filters.foundBy.toLowerCase();
    allItems = allItems.filter((item) => item.foundBy.toLowerCase().includes(foundBy));
  }
  if (filters?.dateFrom) {
    const from = new Date(filters.dateFrom).getTime();
    allItems = allItems.filter((item) => new Date(item.foundTime).getTime() >= from);
  }
  if (filters?.dateTo) {
    const to = new Date(filters.dateTo).getTime() + 86_400_000;
    allItems = allItems.filter((item) => new Date(item.foundTime).getTime() <= to);
  }

  if (!query) return json({ results: allItems.slice(0, 50) });

  const terms = query.toLowerCase().split(/\s+/);
  const keywordSearch = (matchEvery: boolean, limit: number) => allItems.filter((item) => {
    const haystack = `${item.label} ${item.ocrText} ${item.visibleAttributes} ${item.location} ${item.currencyCode || ""} ${item.itemType} ${item.category} ${item.foundBy}`.toLowerCase();
    return matchEvery ? terms.every((term) => haystack.includes(term)) : terms.some((term) => haystack.includes(term));
  }).slice(0, limit);

  const wordCount = terms.length;
  const hasNaturalLanguageSignals = /\b(with|near|from|found|last|this|that|which|where|who|any|some)\b/i.test(query);
  const requestsSemanticSearch = wordCount >= 4 || (wordCount >= 3 && hasNaturalLanguageSignals);
  const useAI = process.env.AI_SEARCH_ENABLED === "true" && requestsSemanticSearch && Boolean(process.env.OPENAI_API_KEY);
  if (!useAI) return json({ results: keywordSearch(true, 50) });
  if (allItems.length === 0) return json({ results: [] });

  const candidateItems = allItems.slice(0, 100);
  try {
    // Minimise provider egress: claimant contacts, staff identities, OCR and private matching fields never leave FoundFlow.
    const itemDescriptions = candidateItems.map((item, index) => (
      `[${index}] ${JSON.stringify(item.label)} | Category: ${item.category} | Location: ${item.location} | Found: ${item.foundTime} | Attributes: ${JSON.stringify(item.visibleAttributes)}`
    )).join("\n");

    const result = await generateObject({
      model: openai(process.env.OPENAI_SEARCH_MODEL || "gpt-4o-mini"),
      schema: z.object({
        matches: z.array(z.object({
          index: z.number().int().min(0),
          relevance: z.number().min(0).max(1),
        })).max(20),
      }),
      messages: [{
        role: "user",
        content: `Match this found-item query to the numbered candidate summaries. Query: ${JSON.stringify(query)}\n\n${itemDescriptions}\n\nReturn matching indices ranked by relevance. Include only relevance above 0.3, with at most 20 results.`,
      }],
    });

    const matches = result.object.matches
      .sort((a, b) => b.relevance - a.relevance)
      .filter((match) => match.index >= 0 && match.index < candidateItems.length);
    return json({ results: matches.map((match) => ({ ...candidateItems[match.index], relevance: match.relevance })) });
  } catch {
    console.error("AI search failed; request and response details were suppressed.");
    return json({ results: keywordSearch(false, 20) });
  }
}
