"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { ITEM_CATEGORIES, LOCATION_PRESETS } from "@/lib/constants";

interface SearchResult {
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
  relevance?: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [foundBy, setFoundBy] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"text" | "ai">("text");
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch() {
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          mode: searchMode,
          filters: {
            location: location || undefined,
            category: category || undefined,
            foundBy: foundBy.trim() || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
        }),
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

  function getCategoryLabel(val: string) {
    return ITEM_CATEGORIES.find((c) => c.value === val)?.label || val;
  }

  function getCategoryIcon(val: string) {
    return ITEM_CATEGORIES.find((c) => c.value === val)?.icon || "📦";
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />
      <div style={{ width: "min(820px, calc(100% - 40px))", marginInline: "auto", paddingBlock: "36px 60px" }}>
        <h1 style={{ fontSize: "1.8rem", letterSpacing: "-0.03em", margin: "0 0 8px" }}>Search Items</h1>
        <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 24px" }}>
          Search staff-confirmed items from completed cases by date, location, finder, item type, or description.
        </p>

        {/* Filters */}
        <div className="search-filter-card" style={{
          padding: "20px",
          display: "grid",
          gap: "14px",
        }}>
          {/* Row 1: Location + Category */}
          <div className="search-filter-row search-filter-row-two">
            <div className="search-filter-field">
              <label htmlFor="search-location" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Location</label>
              <select
                id="search-location"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  paddingInline: "10px",
                  fontSize: "0.84rem",
                  background: "var(--paper)",
                }}
              >
                <option value="">All locations</option>
                {LOCATION_PRESETS.map((loc) => (
                  <option key={loc.value} value={loc.value}>{loc.label}</option>
                ))}
              </select>
            </div>
            <div className="search-filter-field">
              <label htmlFor="search-category" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Item Type</label>
              <select
                id="search-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  paddingInline: "10px",
                  fontSize: "0.84rem",
                  background: "var(--paper)",
                }}
              >
                <option value="">All types</option>
                {ITEM_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date range + Found By */}
          <div className="search-filter-row search-filter-row-three">
            <div className="search-filter-field">
              <label htmlFor="search-date-from" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Date From</label>
              <input
                id="search-date-from"
                name="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  paddingInline: "10px",
                  fontSize: "0.84rem",
                  background: "var(--paper)",
                }}
              />
            </div>
            <div className="search-filter-field">
              <label htmlFor="search-date-to" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Date To</label>
              <input
                id="search-date-to"
                name="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  paddingInline: "10px",
                  fontSize: "0.84rem",
                  background: "var(--paper)",
                }}
              />
            </div>
            <div className="search-filter-field">
              <label htmlFor="search-found-by" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Found By</label>
              <input
                id="search-found-by"
                name="foundBy"
                type="text"
                autoComplete="off"
                value={foundBy}
                onChange={(e) => setFoundBy(e.target.value)}
                placeholder="Staff name…"
                style={{
                  height: "40px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  paddingInline: "10px",
                  fontSize: "0.84rem",
                  background: "var(--paper)",
                }}
              />
            </div>
          </div>

          {/* Row 3: Free text / AI query */}
          <div className="search-filter-field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="search-description" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)" }}>Description (optional)</label>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => setSearchMode("text")}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--line)",
                    background: searchMode === "text" ? "var(--green)" : "transparent",
                    color: searchMode === "text" ? "white" : "var(--muted)",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("ai")}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--line)",
                    background: searchMode === "ai" ? "var(--green)" : "transparent",
                    color: searchMode === "ai" ? "white" : "var(--muted)",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  AI
                </button>
              </div>
            </div>
            <input
              id="search-description"
              name="description"
              type="text"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
              placeholder={searchMode === "text"
                ? "e.g. USB cable, leather wallet, SGD…"
                : "e.g. black bag with Malaysian money found near Terminal 3 last week"
              }
              style={{
                height: "42px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                paddingInline: "12px",
                fontSize: "0.88rem",
                background: "var(--paper)",
              }}
            />
          </div>

          {/* Search button */}
          <button
            type="button"
            className="button"
            onClick={runSearch}
            disabled={isSearching}
            style={{ width: "100%", minHeight: "44px" }}
          >
            {isSearching ? "Searching..." : "🔍 Search"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: "14px", padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.82rem", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && !isSearching && (
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "12px", fontWeight: 600 }}>
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </div>

            {results.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", background: "var(--panel)", borderRadius: "12px", border: "1px solid var(--line)" }}>
                No items match your filters.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {results.map((item) => (
                  <Link
                    key={`${item.caseId}-${item.id}`}
                    href={`/cases/${item.caseId}`}
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{getCategoryIcon(item.category)}</span>
                        <strong style={{ fontSize: "0.9rem" }}>{item.label}</strong>
                        <span style={{ fontSize: "0.68rem", background: "var(--paper)", padding: "2px 6px", borderRadius: "4px", color: "var(--muted)" }}>
                          {getCategoryLabel(item.category)}
                        </span>
                      </div>
                      {item.relevance != null && (
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{Math.round(item.relevance * 100)}%</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginTop: "6px", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                      <span>📍 {item.location}</span>
                      <span>📅 {new Date(item.foundTime).toLocaleDateString("en-SG")}</span>
                      {item.foundBy && <span>👤 {item.foundBy}</span>}
                      {item.currencyCode && <span>💰 {item.currencyCode} {item.currencyTotal}</span>}
                    </div>
                    {item.visibleAttributes && (
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "3px" }}>
                        {item.visibleAttributes.slice(0, 100)}{item.visibleAttributes.length > 100 ? "..." : ""}
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
