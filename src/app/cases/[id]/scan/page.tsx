"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StepIndicator from "@/components/StepIndicator";
import ScanProgress from "@/components/ScanProgress";
import { consumeScanStream, type ScanEvent } from "@/lib/scan-events";

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressEvent, setProgressEvent] = useState<ScanEvent | null>(null);

  async function runScan() {
    setIsScanning(true);
    setError(null);
    setProgressEvent(null);
    try {
      const completed = await consumeScanStream(caseId, setProgressEvent);
      setScanResult({ count: completed.itemCount ?? 0 });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <main className="page-stage">
      <AppHeader />
      <div id="main-content" className="workflow-shell work-surface">
        <StepIndicator currentStep={3} />

        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "32px",
          marginTop: "24px",
          textAlign: "center",
        }}>
          <p className="eyebrow">Step 3 of 5</p>
          <h1 style={{ fontSize: "1.8rem", letterSpacing: "-0.025em", margin: "0 0 8px" }}>
            Scan Item Photos
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 32px", lineHeight: 1.5 }}>
            AI will read your uploaded photos and generate a structured inventory draft.
          </p>

          {!scanResult && (
            <button
              type="button"
              className="button"
              onClick={runScan}
              disabled={isScanning}
              style={{
                width: "100%",
                maxWidth: "320px",
                minHeight: "56px",
                fontSize: "1rem",
                background: "var(--green-dark)",
              }}
            >
              {isScanning ? (
                <span>Scanning… please wait</span>
              ) : (
                <span>Scan Photos</span>
              )}
            </button>
          )}

          <ScanProgress event={progressEvent} />

          {error && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.85rem", color: "#991b1b", textAlign: "left" }}>
              {error}
            </div>
          )}

          {scanResult && (
            <div style={{ marginTop: "16px", padding: "20px", background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: "12px" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>✓</div>
              <strong style={{ fontSize: "1.1rem" }}>Scan Complete</strong>
              <p style={{ margin: "8px 0 0", fontSize: "0.88rem", color: "var(--muted)" }}>
                Found <strong>{scanResult.count}</strong> items. Review them in the next step.
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
            <Link href={`/cases/${caseId}/upload`} className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>
              ← Back
            </Link>
            <button
              type="button"
              className="button"
              disabled={!scanResult}
              onClick={() => router.push(`/cases/${caseId}/review`)}
              style={{ flex: 2 }}
            >
              Next: Review Items →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
