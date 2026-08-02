"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

interface SearchResult {
  id: string;
  label: string;
  caseId: string;
  location: string;
  itemType: string;
  currencyCode: string | null;
  currencyTotal: string | null;
  ocrText: string;
  visibleAttributes: string;
  confidence: number;
  relevance?: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"text" | "ai">("text");
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode: searchMode }),
      });
      if (!res.ok) {
        setError("Search failed. Please try again.");
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />
      <div style={{ width: "min(760px, calc(100% - 40px))", marginInline: "auto", paddingBlock: "36px 60px" }}>
        <h1 style={{ fontSize: "2rem", letterSpacing: "-0.03em", margin: "0 0 8px" }}>🔍 Search Items</h1>
        <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 24px" }}>
          Find items across all cases by description, or use AI to match a natural language query.
        </p>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <button
            type="button"
            onClick={() => setSearchMode("text")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              background: searchMode === "text" ? "var(--green)" : "transparent",
              color: searchMode === "text" ? "white" : "var(--muted)",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Text Match
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("ai")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
              background: searchMode === "ai" ? "var(--green)" : "transparent",
              color: searchMode === "ai" ? "white" : "var(--muted)",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            AI Semantic
          </button>
        </div>

        {/* Search input */}
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
            placeholder={searchMode === "text"
              ? "e.g. USB cable, leather wallet, SGD..."
              : "e.g. black bag with Malaysian money found at Terminal 3 last week"
            }
            style={{
              flex: 1,
              height: "46px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              paddingInline: "14px",
              fontSize: "0.9rem",
              background: "var(--panel)",
            }}
          />
          <button
            type="button"
            className="button"
            onClick={runSearch}
            disabled={isSearching || !query.trim()}
            style={{ minHeight: "46px", paddingInline: "20px" }}
          >
            {isSearching ? "..." : "Search"}
          </button>
        </div>

        {searchMode === "ai" && (
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "6px 0 0" }}>
            AI mode sends your query to OpenAI to rank items by relevance to your description.
          </p>
        )}

        {error && (
          <div style={{ marginTop: "14px", padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.82rem", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !isSearching && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "12px" }}>
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </div>

            {results.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", background: "var(--panel)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                No items match your query.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {results.map((item) => (
                  <Link
                    key={`${item.caseId}-${item.id}`}
                    href={`/cases/${item.caseId}/review`}
                    style={{
                      display: "block",
                      padding: "14px 16px",
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{item.label}</strong>
                      {item.relevance != null && (
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{Math.round(item.relevance * 100)}% match</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      <span>📍 {item.location}</span>
                      <span>📦 Case {item.caseId}</span>
                      {item.currencyCode && <span>💰 {item.currencyCode} {item.currencyTotal}</span>}
                      {item.ocrText && <span>📝 {item.ocrText.slice(0, 40)}</span>}
                    </div>
                    {item.visibleAttributes && (
                      <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "3px" }}>
                        {item.visibleAttributes.slice(0, 80)}{item.visibleAttributes.length > 80 ? "..." : ""}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
