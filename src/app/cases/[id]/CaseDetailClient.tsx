"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Case, ManifestItem } from "@/lib/db";
import { isCurrencyItem, summarizeCurrency } from "@/lib/validation";
import { formatDecimal, multiplyDecimal, normalizeDecimal } from "@/lib/currency";
import PhotoRegionVerifier, { RegionCrops } from "./PhotoRegionVerifier";
import { formatPhotoContext, PHOTO_CONTEXT_OPTIONS } from "@/lib/photo-context";
import {
  handleUploadEvidence,
  handleAiAnalysis,
  handleConfirmItem,
  handleUpdateItem,
  handleAddItem,
  handleDeleteItem,
  handleReassignPhotoRegion,
  handleFinaliseCase
} from "../actions";



interface CaseDetailClientProps {
  initialCase: Case;
  currentUser: { username: string };
}

function displayCurrencyTotal(item: Pick<ManifestItem, "itemType" | "denomination" | "quantity" | "quantityKnown">): string {
  const denomination = normalizeDecimal(item.denomination);
  if (item.itemType !== "currency" || !denomination || item.quantityKnown === false) return "-";
  return formatDecimal(multiplyDecimal(denomination, item.quantity));
}

function conciseReviewWarning(item: ManifestItem): string {
  if (/region|photo box/i.test(item.reviewReason ?? "")) return "Fix photo boxes.";
  if (isCurrencyItem(item)) return "Verify currency, value and count.";
  if (/quantity|count/i.test(item.reviewReason ?? "")) return "Verify quantity.";
  return "Staff review required.";
}

const activityLabels: Record<string, string> = {
  evidence_uploaded: "PHOTO ADDED",
  ai_analysis_complete: "PHOTO SCAN COMPLETE",

  case_finalised: "CASE COMPLETED",
  manifest_exported: "ITEM LIST EXPORTED",
  claim_created: "CLAIM CREATED",
  photo_region_reassigned: "PHOTO REGION REASSIGNED",
  item_collected: "ITEM COLLECTED",
  claim_rejected: "CLAIM REJECTED",
  claim_escalated: "CLAIM ESCALATED",
};


export default function CaseDetailClient({ initialCase, currentUser }: CaseDetailClientProps) {
  const [caseFile, setCaseFile] = useState<Case>(initialCase);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Modal / Form state for item editing/adding
  const [editingItem, setEditingItem] = useState<ManifestItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemData, setNewItemData] = useState<Partial<ManifestItem>>({
    label: "",
    parentId: "outer-item-root",
    quantity: 1,
    quantityKnown: true,
    itemType: "property",
    status: "confirmed",
    currencyCode: null,
    denomination: null,
    currencyTotal: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const unresolved = caseFile.manifest.filter((item) => item.status === "review").length;
  const isFinalised = caseFile.status === "finalised";
  const hasLiveAiDraft = caseFile.manifest.some((item) => item.source === "ai");
  const currencySummary = summarizeCurrency(caseFile.manifest);

  // Refresh case client side from server db
  const refreshCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${caseFile.id}`, { cache: "no-store" });
      if (res.ok) {
        const updated = await res.json();
        setCaseFile(updated);
      }
    } catch (err) {
      console.error("Failed to refresh case:", err);
    }
  }, [caseFile.id]);

  const updatePhotoRegions = useCallback(async (item: ManifestItem) => {
    setErrorMsg(null);
    const result = await handleUpdateItem(caseFile.id, item);
    if (result.error || !result.manifest) {
      setErrorMsg(result.error || "Could not update photo regions.");
      return;
    }
    setCaseFile((previous) => ({ ...previous, manifest: result.manifest! }));
    setSuccessMsg("Photo regions updated. Staff confirmation is required.");
  }, [caseFile.id]);

  const reassignPhotoRegion = useCallback(async (regionId: string, targetItemId: string) => {
    setErrorMsg(null);
    const result = await handleReassignPhotoRegion(caseFile.id, regionId, targetItemId);
    if (result.error || !result.manifest) {
      setErrorMsg(result.error || "Could not reassign photo region.");
      return;
    }
    setCaseFile((previous) => ({ ...previous, manifest: result.manifest! }));
    setSelectedItemId(targetItemId);
    setSuccessMsg("Photo region reassigned. Both records require confirmation.");
  }, [caseFile.id]);

  // Deterministic Speech/Text Command Parser
  const applyCommand = useCallback(async (commandText: string) => {
    if (isFinalised) return;
    const cmd = commandText.trim().toLowerCase();

    // Clear notifications
    setErrorMsg(null);
    setSuccessMsg(null);

    // Helper: find items fuzzy matching label
    const findItemByLabel = (label: string) => {
      return caseFile.manifest.find(item =>
        item.label.toLowerCase().includes(label) ||
        label.includes(item.label.toLowerCase())
      );
    };

    // 1. ADD ITEM: "add [item]" or "add quantity [qty] of [item]"
    if (cmd.startsWith("add ")) {
      let label = cmd.slice(4);
      let quantity = 1;

      const qtyMatch = label.match(/^(\d+)\s+(?:of\s+)?(.*)/);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10);
        label = qtyMatch[2];
      }

      const result = await handleAddItem(caseFile.id, {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        parentId: "outer-item-root",
        quantity,
        status: "confirmed",
        confidence: 1.0,
        reviewReason: null,
        evidenceId: "staff-command",
      });

      if (result.success && result.manifest) {
        setCaseFile(prev => ({ ...prev, manifest: result.manifest! }));
        setSuccessMsg(`Added "${label}" (Qty: ${quantity})`);
        await refreshCase();
      } else {
        setErrorMsg("Failed to add item.");
      }
      return;
    }

    // 2. DELETE ITEM: "delete [item]" or "remove [item]"
    if (cmd.startsWith("delete ") || cmd.startsWith("remove ")) {
      const targetLabel = cmd.replace(/^(delete|remove)\s+/, "");
      const matched = findItemByLabel(targetLabel);

      if (matched) {
        if (matched.id === "outer-item-root") {
          setErrorMsg("Cannot delete the outer container item.");
          return;
        }

        const result = await handleDeleteItem(caseFile.id, matched.id);
        if (result.success && result.manifest) {
          setCaseFile(prev => ({ ...prev, manifest: result.manifest! }));
          setSuccessMsg(`Deleted item "${matched.label}"`);
          await refreshCase();
        } else {
          setErrorMsg("Failed to delete matched item.");
        }
      } else {
        setErrorMsg(`No item matched "${targetLabel}" to delete.`);
      }
      return;
    }

    // 3. CONFIRM ITEM: "confirm [item]" or "verify [item]"
    if (cmd.startsWith("confirm ") || cmd.startsWith("verify ")) {
      const targetLabel = cmd.replace(/^(confirm|verify)\s+/, "");
      const matched = findItemByLabel(targetLabel);

      if (matched) {
        const result = await handleConfirmItem(caseFile.id, matched.id);
        if (result.success && result.manifest) {
          setCaseFile(prev => ({ ...prev, manifest: result.manifest! }));
          setSuccessMsg(`Confirmed "${matched.label}"`);
          await refreshCase();
        } else {
          setErrorMsg("Failed to confirm item.");
        }
      } else {
        setErrorMsg(`No item matched "${targetLabel}" to confirm.`);
      }
      return;
    }

    // 4. QUANTITY CHANGE: "set quantity of [item] to [qty]" or "change quantity of [item] to [qty]"
    const qtyChangeMatch = cmd.match(/(?:set|change)\s+quantity\s+(?:of\s+)?(.*)\s+to\s+(\d+)/);
    if (qtyChangeMatch) {
      const targetLabel = qtyChangeMatch[1].trim();
      const newQty = parseInt(qtyChangeMatch[2], 10);
      const matched = findItemByLabel(targetLabel);

      if (matched) {
        const result = await handleUpdateItem(caseFile.id, {
          ...matched,
          quantity: newQty
        });
        if (result.success && result.manifest) {
          setCaseFile(prev => ({ ...prev, manifest: result.manifest! }));
          setSuccessMsg(`Set quantity of "${matched.label}" to ${newQty}`);
          await refreshCase();
        } else {
          setErrorMsg("Failed to update item quantity.");
        }
      } else {
        setErrorMsg(`No item matched "${targetLabel}" to update quantity.`);
      }
      return;
    }

    setErrorMsg(`Command not recognized: "${commandText}". Try: "add backpack", "confirm malaysian", "delete USB-C", or "set quantity of cardholder to 2"`);
  }, [caseFile.id, caseFile.manifest, refreshCase, isFinalised]);

  useEffect(() => {
    if (!editingItem && !isAddingItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingItem(null);
        setIsAddingItem(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editingItem, isAddingItem]);

  // Handle image upload submission
  async function onUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isFinalised) return;
    if (!fileInputRef.current?.files?.[0]) {
      setErrorMsg("Choose an image before uploading.");
      return;
    }
    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await handleUploadEvidence(caseFile.id, formData);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.success) {
        setSuccessMsg("Item photo uploaded successfully.");
        form.reset();
        setSelectedFileName(null);
        await refreshCase();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setErrorMsg(msg);
    } finally {
      setIsUploading(false);
    }
  }

  // Handle AI analysis trigger
  async function triggerAI() {
    if (isFinalised || caseFile.uploads.length === 0) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await handleAiAnalysis(caseFile.id);
      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.success) {
        setSuccessMsg(`Scan complete - ${result.manifest?.length} items detected. Review below.`);
        await refreshCase();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI Analysis failed";
      setErrorMsg(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Handle manual item confirmations
  async function confirmItemDirect(id: string) {
    if (isFinalised) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    const result = await handleConfirmItem(caseFile.id, id);
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg("Item confirmed.");
      await refreshCase();
    }
  }

  // Edit item form submit
  async function submitEditItem(event: React.FormEvent) {
    event.preventDefault();
    if (!editingItem || isFinalised) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await handleUpdateItem(caseFile.id, editingItem);
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg(`Updated item "${editingItem.label}" successfully.`);
      setEditingItem(null);
      await refreshCase();
    }
  }

  // Add manual item submit
  async function submitAddItem(event: React.FormEvent) {
    event.preventDefault();
    if (isFinalised) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await handleAddItem(caseFile.id, {
      label: newItemData.label || "Unnamed item",
      parentId: newItemData.parentId === "none" ? null : (newItemData.parentId || null),
      quantity: newItemData.quantity || 1,
      quantityKnown: newItemData.quantityKnown ?? true,
      itemType: newItemData.itemType ?? "property",
      status: newItemData.status || "confirmed",
      confidence: 1.0,
      reviewReason: null,
      evidenceId: newItemData.evidenceId || "staff-added",
      ocrText: newItemData.ocrText || "",
      visibleAttributes: newItemData.visibleAttributes || "",
      currencyCode: newItemData.currencyCode || null,
      denomination: normalizeDecimal(newItemData.denomination),
      currencyTotal: newItemData.itemType === "currency" && newItemData.currencyCode && newItemData.denomination && newItemData.quantityKnown !== false
        ? multiplyDecimal(newItemData.denomination, newItemData.quantity || 1)
        : null,
    });

    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg(`Added item "${newItemData.label}" successfully.`);
      setIsAddingItem(false);
      setNewItemData({ label: "", parentId: "outer-item-root", quantity: 1, quantityKnown: true, itemType: "property", status: "confirmed", ocrText: "", visibleAttributes: "", evidenceId: "staff-added", currencyCode: null, denomination: null, currencyTotal: null });
      await refreshCase();
    }
  }

  // Delete manual item
  async function deleteItemDirect(id: string) {
    if (isFinalised) return;
    if (id === "outer-item-root") {
      setErrorMsg("Cannot delete the outer-most property item.");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    if (confirm("Are you sure you want to delete this item? Any nested child items will be re-parented to protect the nesting hierarchy.")) {
      const result = await handleDeleteItem(caseFile.id, id);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg("Item deleted and item list updated.");
        await refreshCase();
      }
    }
  }

  // Finalise case
  async function finaliseIntake() {
    if (isFinalised || unresolved > 0 || caseFile.uploads.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await handleFinaliseCase(caseFile.id);
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg("Case intake finalised and locked successfully!");
      await refreshCase();
    }
  }

  // Build the indented tree structure
  function getIndentDepth(item: ManifestItem): number {
    let depth = 0;
    let current: ManifestItem | undefined = item;
    const visited = new Set<string>();

    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      depth += 1;
      current = caseFile.manifest.find((candidate) => candidate.id === current?.parentId);
    }
    return depth;
  }

  // Sort manifest items to keep children adjacent to parents
  function getSortedManifest(): ManifestItem[] {
    const sorted: ManifestItem[] = [];
    const roots = caseFile.manifest.filter(i => i.parentId === null);

    const rootNodes = roots.length > 0 ? roots : caseFile.manifest.filter(i => i.parentId === "outer-item-root");

    function traverse(parentId: string | null) {
      const children = caseFile.manifest.filter(i => i.parentId === parentId);
      children.forEach(child => {
        if (!sorted.some(s => s.id === child.id)) {
          sorted.push(child);
          traverse(child.id);
        }
      });
    }

    rootNodes.forEach(rn => {
      if (!sorted.some(s => s.id === rn.id)) {
        sorted.push(rn);
        traverse(rn.id);
      }
    });

    caseFile.manifest.forEach(item => {
      if (!sorted.some(s => s.id === item.id)) {
        sorted.push(item);
      }
    });

    return sorted;
  }

  const sortedManifest = getSortedManifest();

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="demo-header shell">
        <div>
          <Link className="brand" href="/cases">FoundFlow</Link>
          <p>
            Guided intake · Case <strong>{caseFile.id}</strong> {caseFile.isDemo && "(Demo Sample)"} · Staff: <strong>{currentUser.username}</strong>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className={isFinalised ? "status status-complete" : "status"}>
            {isFinalised ? "Finalised & Approved" : `${unresolved} item${unresolved === 1 ? "" : "s"} require review`}
          </span>
          <Link className="button button-secondary" href="/cases" style={{ minHeight: "40px" }}>
            ← All Cases
          </Link>
        </div>
      </header>

      <div className="shell demo-layout" style={{ position: "relative" }}>

        {/* LEFT PANEL: Custody Details, Evidence Upload & Timeline */}
        <section className="capture-panel" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div>
            <p className="eyebrow">Property Details</p>
            <h1 style={{ fontSize: "2rem", marginBottom: "8px" }}>{caseFile.outerItemDescription}</h1>
            <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 12px" }}>
              📍 <strong>Location:</strong> {caseFile.location}<br />
              📅 <strong>Found Time:</strong> {new Date(caseFile.foundTime).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}
            </p>
            {caseFile.notes && (
              <div style={{ background: "var(--paper)", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", color: "var(--muted)", border: "1px solid var(--line)" }}>
                <strong>Staff Notes:</strong> {caseFile.notes}
              </div>
            )}
          </div>

          {/* Private Evidence Gallery */}
          <div className="item-photos-section">
            <p className="eyebrow" style={{ marginBottom: "12px" }}>Item Photos ({caseFile.uploads.length})</p>
            {caseFile.uploads.length === 0 ? (
              <div style={{ padding: "30px", border: "1px dashed var(--line)", borderRadius: "12px", textAlign: "center", color: "var(--muted)", background: "var(--paper)" }}>
                No item photos added yet.<br />
                <small>Upload at least one image to unlock AI structure drafting.</small>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {caseFile.uploads.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "var(--paper)",
                      display: "flex",
                      flexDirection: "column"
                    }}
                  >
                    {/* Authenticated evidence is intentionally served directly; the image optimiser cannot forward the session cookie. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/uploads/${u.id}`}
                      alt={u.originalName}
                      style={{ width: "100%", height: "120px", objectFit: "cover", borderBottom: "1px solid var(--line)" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23edf1ea'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%2368736c'>Photo</text></svg>";
                      }}
                    />
                    <div style={{ padding: "8px", fontSize: "0.72rem" }}>
                      <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{u.originalName}</strong>
                      <span className="muted" style={{ display: "block" }}>Context: {formatPhotoContext(u.containerContext)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isFinalised && (
            <button
              type="button"
              className="button full-width"
              onClick={triggerAI}
              disabled={isAnalyzing || caseFile.uploads.length === 0}
              style={{ minHeight: "42px", whiteSpace: "nowrap", background: "var(--green-dark)" }}
            >
              {isAnalyzing ? "Scanning..." : "Scan Item Photos"}
            </button>
          )}

          {/* Evidence Upload Form */}
          {!isFinalised && (
            <div className="item-photo-upload" style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", background: "var(--panel)" }}>
              <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: "12px" }}>Add Item Photo</strong>
              <form onSubmit={onUploadSubmit} style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <label htmlFor="file" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Select JPG / PNG / WebP</label>
                  <input
                    ref={fileInputRef}
                    id="file"
                    name="file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? null)}
                    style={{ display: "none" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      style={{ minHeight: "36px", whiteSpace: "nowrap" }}
                    >
                      Choose Image
                    </button>
                    <span aria-live="polite" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.78rem", color: "var(--muted)" }}>
                      {selectedFileName ?? "No image selected"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "4px" }}>
                  <label htmlFor="containerContext" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Photo context</label>
                  <select
                    id="containerContext"
                    name="containerContext"
                    style={{
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      paddingInline: "8px",
                      fontSize: "0.82rem",
                      background: "var(--paper)"
                    }}
                  >
                    {PHOTO_CONTEXT_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  className="button full-width"
                  type="submit"
                  disabled={isUploading || !selectedFileName}
                  style={{ minHeight: "36px", fontSize: "0.85rem" }}
                >
                  {isUploading ? "Uploading image..." : "Upload Photo"}
                </button>
              </form>
            </div>
          )}

          {/* Audit Timeline */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
            <p className="eyebrow" style={{ marginBottom: "16px" }}>Activity History</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {caseFile.auditLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", gap: "12px", fontSize: "0.78rem" }}>
                  <div style={{ color: "var(--green)", fontWeight: 700 }}>•</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                      {new Date(log.timestamp).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} by <strong>{log.userId}</strong>
                    </span>
                    <span style={{ color: "var(--ink)", fontWeight: 550 }}>
                      {activityLabels[log.action] ?? log.action.replaceAll("_", " ").toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
              {caseFile.auditLogs.length === 0 && (
                <span className="muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>No timeline logged yet.</span>
              )}
            </div>
          </div>
        </section>


        {/* RIGHT PANEL: Manifest Review, Voice Assistant & Finalisation */}
        <section className="review-panel" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          <div className="review-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">Linked Inventory</p>
              <h2 style={{ fontSize: "1.8rem" }}>Item List</h2>
            </div>
            <span style={{ fontSize: "0.95rem" }}>{caseFile.manifest.length} records</span>
          </div>

          {caseFile.isDemo && (
            <div style={{ background: "#edf4ef", border: "1px solid var(--line)", borderRadius: "10px", padding: "12px 14px", fontSize: "0.8rem", lineHeight: 1.5 }}>
              <strong>{hasLiveAiDraft ? "Live AI draft active." : "Deterministic demo fixture."}</strong>{" "}
              {hasLiveAiDraft
                ? "Review the fresh extraction below before approval."
                : "The staged image and sample inventory are ready for a reliable walkthrough; run image analysis to replace the sample with a fresh extraction."}
            </div>
          )}

          {caseFile.uploads.length > 0 && (
            <PhotoRegionVerifier
              uploads={caseFile.uploads}
              items={caseFile.manifest}
              selectedItemId={selectedItemId}
              readOnly={isFinalised}
              onSelectItem={setSelectedItemId}
              onUpdateItem={updatePhotoRegions}
              onReassignRegion={reassignPhotoRegion}
            />
          )}

          {/* Notifications */}
          {errorMsg && (
            <div role="alert" style={{ background: "#fdf2f2", border: "1px solid #fbd5d5", color: "#c81e1e", borderRadius: "8px", padding: "12px", fontSize: "0.85rem" }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div role="status" aria-live="polite" style={{ background: "#f3faf5", border: "1px solid #def7ec", color: "var(--green)", borderRadius: "8px", padding: "12px", fontSize: "0.85rem" }}>
              ✅ {successMsg}
            </div>
          )}

          {/* Quick Command Prompt */}
          {!isFinalised && (
            <div style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "18px", background: "var(--paper)" }}>
              <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--green)", marginBottom: "12px" }}>💬 Quick Command</strong>

              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  id="text-correction"
                  type="text"
                  placeholder="e.g. confirm Malaysian currency, add charging cable, delete USB-C..."
                  style={{
                    flex: 1,
                    height: "40px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "12px",
                    fontSize: "0.84rem",
                    background: "var(--panel)"
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = e.currentTarget.value;
                      if (val) {
                        void applyCommand(val);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="button"
                  style={{ minHeight: "40px", paddingInline: "16px", fontSize: "0.84rem" }}
                  onClick={() => {
                    const input = document.getElementById("text-correction") as HTMLInputElement;
                    if (input && input.value) {
                      void applyCommand(input.value);
                      input.value = "";
                    }
                  }}
                >
                  Apply
                </button>
              </div>
              <small className="muted" style={{ fontSize: "0.72rem", marginTop: "6px", display: "block" }}>
                {"Supported: add [item], delete [item], confirm [item], set quantity of [item] to [qty]"}
              </small>
            </div>
          )}

          {/* Interactive Manifest Tree View */}
          <div className="item-list" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>Items Found</span>
              {!isFinalised && (
                <button
                  onClick={() => setIsAddingItem(true)}
                  className="text-link"
                  style={{ background: "transparent", border: "none", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  + Add Item
                </button>
              )}
            </div>

            {!isFinalised && unresolved > 0 && (
              <div style={{ fontSize: "0.75rem", color: "var(--amber)", fontWeight: 600, marginBottom: "10px", padding: "6px 10px", background: "#fffdf5", borderRadius: "6px", border: "1px solid #f5e6c8" }}>
                ⚠️ {unresolved} require review.
              </div>
            )}

            {sortedManifest.map((item) => {
              const depth = getIndentDepth(item);
              const isCurrency = item.itemType === "currency";

              return (
                <article
                  key={item.id}
                  className={selectedItemId === item.id ? "review-item selected" : "review-item"}
                  onClick={() => setSelectedItemId(item.id)}
                  style={{
                    marginLeft: `${depth * 20}px`,
                    borderLeft: depth > 0 ? "2px solid var(--line)" : "none",
                    paddingLeft: depth > 0 ? "12px" : "0",
                    paddingBlock: "8px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.9rem" }}>{item.label}</strong>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: "0.72rem", background: "var(--paper)", padding: "1px 6px", borderRadius: "4px", color: "var(--muted)" }}>
                          ×{item.quantity}
                        </span>
                      )}
                      {isCurrency && item.currencyCode && (
                        <span style={{ fontSize: "0.72rem", fontFamily: "monospace", fontWeight: 700, color: "var(--green-dark)" }}>
                          {item.currencyCode} {item.currencyTotal != null ? formatDecimal(item.currencyTotal) : "-"}
                        </span>
                      )}
                      {item.status === "review" && (
                        <span style={{ fontSize: "0.68rem", background: "#fff3cd", color: "#856404", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                          Needs Review
                        </span>
                      )}
                    </div>
                    {item.reviewReason && (
                      <div style={{ fontSize: "0.72rem", color: "var(--amber)", marginTop: "3px" }}>
                        <span title={item.reviewReason}>⚠️ {conciseReviewWarning(item)}</span>
                      </div>
                    )}
                    <RegionCrops item={item} selected={selectedItemId === item.id} onSelect={() => setSelectedItemId(item.id)} />
                  </div>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                    {!isFinalised && item.status === "review" && (
                      <button
                        className="review-button"
                        onClick={() => { void confirmItemDirect(item.id); }}
                        type="button"
                        style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                      >
                        Confirm
                      </button>
                    )}

                    {item.status === "confirmed" && (
                      <span style={{ fontSize: "0.7rem", color: "var(--green-dark)" }}>✓</span>
                    )}

                    {!isFinalised && (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit ${item.label}`}
                          onClick={() => setEditingItem(item)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: "2px" }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        {item.id !== "outer-item-root" && (
                          <button
                            type="button"
                            aria-label={`Delete ${item.label}`}
                            onClick={() => { void deleteItemDirect(item.id); }}
                            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: "2px" }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}

            {sortedManifest.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                No items yet. Add photos and scan, or add items manually.
              </div>
            )}
          </div>

          {currencySummary.length > 0 && (
            <section aria-labelledby="currency-summary-title" style={{ border: "1px solid var(--line)", borderRadius: "10px", padding: "12px 14px", background: "var(--paper)" }}>
              <strong id="currency-summary-title" style={{ display: "block", fontSize: "0.82rem", marginBottom: "8px" }}>Currency totals</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {currencySummary.map(({ currencyCode, total }) => (
                  <span key={currencyCode} style={{ border: "1px solid var(--line)", borderRadius: "999px", padding: "6px 10px", fontFamily: "monospace", fontWeight: 700 }}>
                    {currencyCode} {formatDecimal(total)}
                  </span>
                ))}
              </div>
              <p className="muted" style={{ fontSize: "0.72rem", margin: "8px 0 0" }}>Provisional until staff verification.</p>
            </section>
          )}

          {/* Finalisation Control & Download Exports Panel */}
          <div className="finalise-row" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="finalise-actions">
              <div className="finalise-copy">
                {isFinalised ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, color: "var(--green)" }}>✅ Property Record Completed</p>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Completed by: <strong>{caseFile.finalisedBy}</strong> on {caseFile.finalisedAt ? new Date(caseFile.finalisedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" }) : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontWeight: 550 }}>
                      {caseFile.uploads.length === 0
                        ? "Add a photo."
                        : unresolved === 0
                          ? "Ready to complete."
                          : `${unresolved} reviews remaining.`}
                    </p>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Records reviewer and time.
                    </span>
                  </>
                )}
              </div>

              {!isFinalised && (
                <button
                  className="button"
                  disabled={unresolved > 0 || caseFile.uploads.length === 0 || isFinalised}
                  onClick={() => { void finaliseIntake(); }}
                  style={{ paddingInline: "24px", whiteSpace: "nowrap" }}
                >
                  Confirm & Complete
                </button>
              )}
            </div>

            {/* Collection workflow */}
            {isFinalised && (
              <div style={{
                background: caseFile.claims?.some((claim) => claim.decision === "approved") ? "#f3faf5" : "var(--paper)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "16px",
                display: "grid",
                gap: "10px"
              }}>
                <strong style={{ fontSize: "0.85rem", color: "var(--green-dark)" }}>
                  {caseFile.claims?.some((claim) => claim.decision === "approved") ? "Collection completed" : "Ownership verification and collection"}
                </strong>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Every handover requires a claim record. Link an existing lost report or create a staff-initiated walk-in claim.
                </span>
                <Link href={`/cases/${caseFile.id}/claim`} className="button" style={{ minHeight: "38px", fontSize: "0.82rem" }}>
                  {caseFile.claims?.length ? "View collection claim" : "Start collection claim"}
                </Link>
              </div>
            )}

            {/* Approved manifest exports */}
            {isFinalised && (
              <div style={{
                background: "#f3faf5",
                border: "1px solid #def7ec",
                borderRadius: "10px",
                padding: "16px",
                display: "grid",
                gap: "10px"
              }}>
                <strong style={{ fontSize: "0.85rem", color: "var(--green)" }}>📥 Export Item Handover Data</strong>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Download the confirmed item list with nested container links and photo references.
                </span>
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <a
                    href={`/api/cases/${caseFile.id}/export/json`}
                    download={`foundflow_item_list_${caseFile.id}.json`}
                    className="button"
                    style={{ flex: 1, minHeight: "36px", fontSize: "0.82rem", background: "var(--green)" }}
                  >
                    Download JSON Item List
                  </a>
                  <a
                    href={`/api/cases/${caseFile.id}/export/csv`}
                    download={`foundflow_item_list_${caseFile.id}.csv`}
                    className="button button-secondary"
                    style={{ flex: 1, minHeight: "36px", fontSize: "0.82rem" }}
                  >
                    Download CSV Item List
                  </a>
                </div>
              </div>
            )}
          </div>

        </section>
      </div>

      {/* MODAL 1: Edit Item Form Overlay */}
      {editingItem && (
        <div className="modal-backdrop" style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-item-title"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 8px 16px rgba(0,0,0,0.15)"
            }}
          >
            <h3 id="edit-item-title" style={{ fontSize: "1.25rem", margin: "0 0 16px" }}>Edit Item</h3>
            <form onSubmit={(e) => { void submitEditItem(e); }} style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Item Label</label>
                <input
                  type="text"
                  aria-label="Item Label"
                  autoFocus
                  value={editingItem.label}
                  onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
                  required
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>OCR Extracted Text</label>
                <input
                  type="text"
                  value={editingItem.ocrText || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, ocrText: e.target.value })}
                  placeholder="e.g. Serial CC123, MAS $50"
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Visible Attributes</label>
                <input
                  type="text"
                  value={editingItem.visibleAttributes || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, visibleAttributes: e.target.value })}
                  placeholder="e.g. Color: Brown, Material: Leather"
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label htmlFor="edit-item-quantity" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Quantity</label>
                <input
                  id="edit-item-quantity"
                  type="number"
                  min={1}
                  value={editingItem.quantity}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value, 10) })}
                  required
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <fieldset style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", display: "grid", gap: "10px" }}>
                <legend style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0 4px" }}>Currency amount (notes or coins)</legend>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={editingItem.itemType === "currency"} onChange={(e) => setEditingItem({ ...editingItem, itemType: e.target.checked ? "currency" : "property", quantityKnown: true, currencyCode: e.target.checked ? editingItem.currencyCode : null, denomination: e.target.checked ? editingItem.denomination : null, currencyTotal: null })} />
                  This record is currency
                </label>
                {editingItem.itemType === "currency" && (
                  <>
                    <label style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input type="checkbox" checked={editingItem.quantityKnown !== false} onChange={(e) => setEditingItem({ ...editingItem, quantityKnown: e.target.checked })} />
                      Exact count is visible
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label style={{ fontSize: "0.72rem", display: "grid", gap: "4px" }}>
                        ISO currency code
                        <input aria-label="ISO currency code" maxLength={3} value={editingItem.currencyCode || ""} onChange={(e) => setEditingItem({ ...editingItem, currencyCode: e.target.value.toUpperCase() || null })} placeholder="SGD" style={{ height: "36px", borderRadius: "6px", border: "1px solid var(--line)", paddingInline: "10px" }} />
                      </label>
                      <label style={{ fontSize: "0.72rem", display: "grid", gap: "4px" }}>
                        Denomination
                        <input aria-label="Currency denomination" type="text" inputMode="decimal" value={editingItem.denomination ?? ""} onChange={(e) => setEditingItem({ ...editingItem, denomination: e.target.value || null })} placeholder="100.00" style={{ height: "36px", borderRadius: "6px", border: "1px solid var(--line)", paddingInline: "10px" }} />
                      </label>
                    </div>
                    <output style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700 }}>
                      Total: {editingItem.currencyCode || "-"} {displayCurrencyTotal(editingItem)}
                    </output>
                  </>
                )}
              </fieldset>

              {editingItem.id !== "outer-item-root" && (
                <div style={{ display: "grid", gap: "4px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Parent Container</label>
                  <select
                    value={editingItem.parentId || "none"}
                    onChange={(e) => setEditingItem({ ...editingItem, parentId: e.target.value === "none" ? null : e.target.value })}
                    style={{
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      paddingInline: "8px",
                      fontSize: "0.82rem",
                      background: "var(--panel)"
                    }}
                  >
                    <option value="none">None (Root Container)</option>
                    {caseFile.manifest
                      .filter((item) => item.id !== editingItem.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                  </select>
                </div>
              )}

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Source Photo</label>
                <select
                  value={editingItem.evidenceId || "staff-added"}
                  disabled={editingItem.id === "outer-item-root"}
                  onChange={(e) => setEditingItem({ ...editingItem, evidenceId: e.target.value })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "8px",
                    fontSize: "0.82rem",
                    background: "var(--panel)"
                  }}
                >
                  {editingItem.id === "outer-item-root" ? (
                    <option value="manual-creation">Manual Creation (Root)</option>
                  ) : (
                    <>
                      <option value="staff-added">Staff Added (No image link)</option>
                      {caseFile.uploads.map((u) => (
                        <option key={u.id} value={u.id}>{u.originalName} ({u.id})</option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Status</label>
                <select
                  value={editingItem.status}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as "confirmed" | "review" })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "8px",
                    fontSize: "0.82rem",
                    background: "var(--panel)"
                  }}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="review">Needs Review</option>
                </select>
              </div>

              {editingItem.status === "review" && (
                <div style={{ display: "grid", gap: "4px" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Review Reason</label>
                  <input
                    type="text"
                    value={editingItem.reviewReason || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, reviewReason: e.target.value })}
                    placeholder="e.g. markings are blurry in image"
                    style={{
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      paddingInline: "10px",
                      fontSize: "0.88rem"
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button className="button" type="submit" style={{ flex: 1, minHeight: "36px" }}>
                  Save Changes
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setEditingItem(null)}
                  style={{ flex: 1, minHeight: "36px" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Manual Item Overlay */}
      {isAddingItem && (
        <div className="modal-backdrop" style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-item-title"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 8px 16px rgba(0,0,0,0.15)"
            }}>
            <h3 id="add-item-title" style={{ fontSize: "1.25rem", margin: "0 0 16px" }}>Add Item</h3>
            <form onSubmit={(e) => { void submitAddItem(e); }} style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Item Label</label>
                <input
                  type="text"
                  aria-label="Item Label"
                  autoFocus
                  placeholder="e.g. Leather wallet, Gold Ring"
                  value={newItemData.label}
                  onChange={(e) => setNewItemData({ ...newItemData, label: e.target.value })}
                  required
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>OCR Extracted Text</label>
                <input
                  type="text"
                  placeholder="e.g. Serial CC123, MAS $50"
                  value={newItemData.ocrText || ""}
                  onChange={(e) => setNewItemData({ ...newItemData, ocrText: e.target.value })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Visible Attributes</label>
                <input
                  type="text"
                  placeholder="e.g. Color: Brown, Material: Leather"
                  value={newItemData.visibleAttributes || ""}
                  onChange={(e) => setNewItemData({ ...newItemData, visibleAttributes: e.target.value })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label htmlFor="add-item-quantity" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Quantity</label>
                <input
                  id="add-item-quantity"
                  type="number"
                  min={1}
                  value={newItemData.quantity}
                  onChange={(e) => setNewItemData({ ...newItemData, quantity: parseInt(e.target.value, 10) })}
                  required
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "10px",
                    fontSize: "0.88rem"
                  }}
                />
              </div>

              <fieldset style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "12px", display: "grid", gap: "10px" }}>
                <legend style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0 4px" }}>Currency amount (notes or coins)</legend>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={newItemData.itemType === "currency"} onChange={(e) => setNewItemData({ ...newItemData, itemType: e.target.checked ? "currency" : "property", quantityKnown: true, currencyCode: e.target.checked ? newItemData.currencyCode : null, denomination: e.target.checked ? newItemData.denomination : null, currencyTotal: null })} />
                  This record is currency
                </label>
                {newItemData.itemType === "currency" && (
                  <>
                    <label style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input type="checkbox" checked={newItemData.quantityKnown !== false} onChange={(e) => setNewItemData({ ...newItemData, quantityKnown: e.target.checked })} />
                      Exact count is visible
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label style={{ fontSize: "0.72rem", display: "grid", gap: "4px" }}>
                        ISO currency code
                        <input aria-label="ISO currency code" maxLength={3} value={newItemData.currencyCode || ""} onChange={(e) => setNewItemData({ ...newItemData, currencyCode: e.target.value.toUpperCase() || null })} placeholder="SGD" style={{ height: "36px", borderRadius: "6px", border: "1px solid var(--line)", paddingInline: "10px" }} />
                      </label>
                      <label style={{ fontSize: "0.72rem", display: "grid", gap: "4px" }}>
                        Denomination
                        <input aria-label="Currency denomination" type="text" inputMode="decimal" value={newItemData.denomination ?? ""} onChange={(e) => setNewItemData({ ...newItemData, denomination: e.target.value || null })} placeholder="100.00" style={{ height: "36px", borderRadius: "6px", border: "1px solid var(--line)", paddingInline: "10px" }} />
                      </label>
                    </div>
                    <output style={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700 }}>
                      Total: {newItemData.currencyCode || "-"} {displayCurrencyTotal({ itemType: newItemData.itemType, denomination: newItemData.denomination, quantity: newItemData.quantity || 1, quantityKnown: newItemData.quantityKnown })}
                    </output>
                  </>
                )}
              </fieldset>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Parent Container</label>
                <select
                  value={newItemData.parentId || "none"}
                  onChange={(e) => setNewItemData({ ...newItemData, parentId: e.target.value === "none" ? undefined : e.target.value })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "8px",
                    fontSize: "0.82rem",
                    background: "var(--panel)"
                  }}
                >
                  <option value="none">None (Root Container)</option>
                  {caseFile.manifest.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Source Photo</label>
                <select
                  value={newItemData.evidenceId || "staff-added"}
                  onChange={(e) => setNewItemData({ ...newItemData, evidenceId: e.target.value })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "8px",
                    fontSize: "0.82rem",
                    background: "var(--panel)"
                  }}
                >
                  <option value="staff-added">Staff Added (No image link)</option>
                  {caseFile.uploads.map((u) => (
                    <option key={u.id} value={u.id}>{u.originalName} ({u.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Status</label>
                <select
                  value={newItemData.status}
                  onChange={(e) => setNewItemData({ ...newItemData, status: e.target.value as "confirmed" | "review" })}
                  style={{
                    height: "36px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    paddingInline: "8px",
                    fontSize: "0.82rem",
                    background: "var(--panel)"
                  }}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="review">Needs Review</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button className="button" type="submit" style={{ flex: 1, minHeight: "36px" }}>
                  Add Item
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  style={{ flex: 1, minHeight: "36px" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="shell footer">
        <span>FoundFlow · Airport Lost Property Intake</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
