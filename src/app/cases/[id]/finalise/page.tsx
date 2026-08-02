"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StepIndicator from "@/components/StepIndicator";
import { handleFinaliseCase } from "@/app/cases/actions";
import type { Case } from "@/lib/db";
import { formatDecimal } from "@/lib/currency";
import { summarizeCurrency } from "@/lib/validation";

export default function FinalisePage() {
  const params = useParams();
  const caseId = params.id as string;

  const [caseFile, setCaseFile] = useState<Case | null>(null);
  const [isFinalising, setIsFinalising] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}`, { cache: "no-store" });
      if (res.ok) setCaseFile(await res.json());
    } catch { /* ignore */ }
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cases/${caseId}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!cancelled && data) setCaseFile(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [caseId]);

  if (!caseFile) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
        <AppHeader />
        <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>Loading...</div>
      </main>
    );
  }

  const isFinalised = caseFile.status === "finalised";
  const unresolved = caseFile.manifest.filter((i) => i.status === "review").length;
  const currencyTotals = summarizeCurrency(caseFile.manifest);

  async function finalise() {
    setIsFinalising(true);
    setError(null);
    try {
      const result = await handleFinaliseCase(caseId);
      if (result.error) {
        setError(result.error);
      } else {
        await loadCase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete case");
    } finally {
      setIsFinalising(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />
      <div style={{ width: "min(640px, calc(100% - 40px))", marginInline: "auto", paddingBlock: "24px 60px" }}>
        <StepIndicator currentStep={5} />

        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "32px",
          marginTop: "24px",
        }}>
          <p className="eyebrow">Step 5 of 5</p>
          <h1 style={{ fontSize: "1.8rem", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
            {isFinalised ? "Case Completed ✓" : "Complete & Export"}
          </h1>

          {/* Summary */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px",
            marginTop: "24px",
            marginBottom: "24px",
          }}>
            <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{caseFile.manifest.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Items</div>
            </div>
            <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{caseFile.uploads.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Photos</div>
            </div>
            <div style={{ padding: "14px", background: "var(--paper)", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{currencyTotals.length}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Currencies</div>
            </div>
          </div>

          {/* Currency totals */}
          {currencyTotals.length > 0 && (
            <div style={{ marginBottom: "24px", padding: "14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px" }}>
              <strong style={{ fontSize: "0.8rem", display: "block", marginBottom: "8px" }}>Currency Totals</strong>
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {currencyTotals.map((ct) => (
                  <span key={ct.currencyCode} style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1rem" }}>
                    {ct.currencyCode} {formatDecimal(ct.total)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Case info */}
          <div style={{ fontSize: "0.84rem", color: "var(--muted)", marginBottom: "24px", lineHeight: 1.7 }}>
            <div>📍 <strong>Location:</strong> {caseFile.location}</div>
            <div>📦 <strong>Item:</strong> {caseFile.outerItemDescription}</div>
            <div>🆔 <strong>Case ID:</strong> {caseFile.id}</div>
          </div>

          {/* Actions */}
          {!isFinalised && (
            <>
              {unresolved > 0 && (
                <div style={{ padding: "10px 14px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px", fontSize: "0.82rem", color: "#856404", marginBottom: "16px" }}>
                  ⚠️ {unresolved} item{unresolved !== 1 ? "s" : ""} still need review. Go back to resolve them.
                </div>
              )}
              <button
                type="button"
                className="button"
                onClick={finalise}
                disabled={isFinalising || unresolved > 0}
                style={{ width: "100%", minHeight: "50px", fontSize: "0.95rem", background: "var(--green-dark)" }}
              >
                {isFinalising ? "Completing..." : "Complete Case"}
              </button>
            </>
          )}

          {isFinalised && (
            <div style={{ display: "grid", gap: "10px" }}>
              <Link href={`/cases/${caseId}/claim`} className="button" style={{ textAlign: "center" }}>
                {caseFile.claims?.length ? "View Collection Claim" : "Start Collection Claim"}
              </Link>
              <a
                href={`/api/cases/${caseId}/export/json`}
                download={`foundflow_${caseId}.json`}
                className="button button-secondary"
                style={{ textAlign: "center" }}
              >
                📥 Download JSON
              </a>
              <a
                href={`/api/cases/${caseId}/export/csv`}
                download={`foundflow_${caseId}.csv`}
                className="button button-secondary"
                style={{ textAlign: "center" }}
              >
                📥 Download CSV
              </a>
            </div>
          )}

          {error && (
            <div style={{ marginTop: "12px", fontSize: "0.82rem", color: "#991b1b" }}>{error}</div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <Link href={`/cases/${caseId}/review`} className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>
              ← Back to Review
            </Link>
            <Link href="/cases" className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>
              All Cases
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
