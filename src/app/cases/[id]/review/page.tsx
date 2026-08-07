"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StepIndicator from "@/components/StepIndicator";
import {
  handleConfirmItem,
  handleDeleteItem,
  handleAddItem,
} from "@/app/cases/actions";
import type { Case, ManifestItem } from "@/lib/db";
import { formatDecimal } from "@/lib/currency";


export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseFile, setCaseFile] = useState<Case | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState("");

  // Load case data
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
      <main className="page-stage">
        <AppHeader />
        <div style={{ padding: "60px", textAlign: "center", color: "var(--muted)" }}>Loading case...</div>
      </main>
    );
  }

  const manifest = caseFile.manifest;
  const unresolved = manifest.filter((i) => i.status === "review").length;

  async function confirmItem(itemId: string) {
    const result = await handleConfirmItem(caseId, itemId);
    if (result.success) {
      setSuccess("Item confirmed.");
      await loadCase();
    } else if (result.error) {
      setError(result.error);
    }
  }

  async function deleteItem(itemId: string) {
    const result = await handleDeleteItem(caseId, itemId);
    if (result.success) await loadCase();
  }

  async function applyCommand() {
    if (!commandInput.trim()) return;
    const cmd = commandInput.trim().toLowerCase();
    setError(null);
    setSuccess(null);

    const findItem = (label: string) =>
      manifest.find((i) => i.label.toLowerCase().includes(label) || label.includes(i.label.toLowerCase()));

    if (cmd.startsWith("add ")) {
      const label = cmd.slice(4);
      const result = await handleAddItem(caseId, {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        parentId: "outer-item-root",
        quantity: 1,
        status: "confirmed",
        confidence: 1.0,
        reviewReason: null,
        evidenceId: "staff-command",
      });
      if (result.success) { setSuccess(`Added "${label}"`); await loadCase(); }
      else setError("Failed to add item.");
    } else if (cmd.startsWith("confirm ")) {
      const matched = findItem(cmd.slice(8));
      if (matched) await confirmItem(matched.id);
      else setError(`No match for "${cmd.slice(8)}"`);
    } else if (cmd.startsWith("delete ") || cmd.startsWith("remove ")) {
      const label = cmd.replace(/^(delete|remove)\s+/, "");
      const matched = findItem(label);
      if (matched && matched.id !== "outer-item-root") { await deleteItem(matched.id); setSuccess(`Deleted "${matched.label}"`); }
      else setError(matched ? "Cannot delete the outer container." : `No match for "${label}"`);
    } else {
      setError(`Unknown command. Try: add [item], confirm [item], delete [item]`);
    }

    setCommandInput("");
  }

  // Build tree with depth
  function getDepth(item: ManifestItem): number {
    let depth = 0;
    let current = item;
    while (current.parentId) {
      depth++;
      const parent = manifest.find((i) => i.id === current.parentId);
      if (!parent || depth > 10) break;
      current = parent;
    }
    return depth;
  }

  // Sort by tree order
  function getSorted(): ManifestItem[] {
    const result: ManifestItem[] = [];
    function addChildren(parentId: string | null) {
      const children = manifest.filter((i) => i.parentId === parentId);
      for (const child of children) {
        result.push(child);
        addChildren(child.id);
      }
    }
    addChildren(null);
    if (result.length === 0) return manifest;
    return result;
  }

  const sorted = getSorted();

  return (
    <main className="page-stage">
      <AppHeader />
      <div id="main-content" className="workflow-shell work-surface">
        <StepIndicator currentStep={4} />

        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "28px",
          marginTop: "24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <p className="eyebrow" style={{ margin: "0 0 4px" }}>Step 4 of 5</p>
              <h1 style={{ fontSize: "1.6rem", letterSpacing: "-0.025em", margin: 0 }}>Review Items</h1>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: unresolved > 0 ? "var(--amber)" : "var(--green)" }}>
              {unresolved > 0 ? `${unresolved} need review` : "All confirmed"}
            </span>
          </div>

          {/* Items list */}
          <div style={{ marginTop: "20px", display: "grid", gap: "0" }}>
            {sorted.map((item) => {
              const depth = getDepth(item);
              const isCurrency = item.itemType === "currency";
              return (
                <div
                  key={item.id}
                  style={{
                    marginLeft: `${depth * 18}px`,
                    borderLeft: depth > 0 ? "2px solid var(--line)" : "none",
                    paddingLeft: depth > 0 ? "12px" : "0",
                    paddingBlock: "10px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.88rem" }}>{item.label}</strong>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: "0.7rem", background: "var(--paper)", padding: "1px 5px", borderRadius: "4px", color: "var(--muted)" }}>×{item.quantity}</span>
                      )}
                      {isCurrency && item.currencyCode && (
                        <span style={{ fontSize: "0.7rem", fontFamily: "monospace", fontWeight: 700, color: "var(--green-dark)" }}>
                          {item.currencyCode} {item.currencyTotal != null ? formatDecimal(item.currencyTotal) : "-"}
                        </span>
                      )}
                      {item.status === "review" && (
                        <span style={{ fontSize: "0.65rem", background: "#fff3cd", color: "#856404", padding: "1px 5px", borderRadius: "4px", fontWeight: 600 }}>Review</span>
                      )}
                    </div>
                    {item.reviewReason && (
                      <div title={item.reviewReason} style={{ fontSize: "0.72rem", color: "var(--amber)", marginTop: "2px" }}>Staff review required.</div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    {item.status === "review" && (
                      <button
                        type="button"
                        onClick={() => void confirmItem(item.id)}
                        style={{ padding: "3px 8px", fontSize: "0.72rem", borderRadius: "6px", border: "1px solid #d4a34f", background: "#fff7e8", color: "#744400", fontWeight: 700, cursor: "pointer" }}
                      >
                        Confirm
                      </button>
                    )}
                    {item.status === "confirmed" && (
                      <span style={{ fontSize: "0.68rem", color: "var(--green)" }}>✓</span>
                    )}
                    {item.id !== "outer-item-root" && (
                      <button
                        type="button"
                        onClick={() => void deleteItem(item.id)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: "2px" }}
                        title="Delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick command */}
          <div style={{ marginTop: "20px", display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void applyCommand(); }}
              placeholder="add [item], confirm [item], delete [item]..."
              style={{
                flex: 1,
                height: "38px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                paddingInline: "12px",
                fontSize: "0.82rem",
                background: "var(--paper)",
              }}
            />
            <button type="button" className="button" onClick={() => void applyCommand()} style={{ minHeight: "38px", paddingInline: "14px", fontSize: "0.8rem" }}>
              Apply
            </button>
          </div>

          {error && <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "#991b1b" }}>{error}</div>}
          {success && <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "var(--green)" }}>{success}</div>}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
            <Link href={`/cases/${caseId}/scan`} className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>
              ← Back
            </Link>
            <button
              type="button"
              className="button"
              disabled={unresolved > 0}
              onClick={() => router.push(`/cases/${caseId}/finalise`)}
              style={{ flex: 2 }}
            >
              {unresolved > 0 ? `${unresolved} items need review` : "Next: Finalise →"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
