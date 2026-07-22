"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Case, ManifestItem } from "@/lib/db";
import {
  handleUploadEvidence,
  handleAiAnalysis,
  handleConfirmItem,
  handleUpdateItem,
  handleAddItem,
  handleDeleteItem,
  handleFinaliseCase
} from "../actions";

interface CustomSpeechErrorEvent {
  error: string;
}

interface CustomSpeechEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface CustomSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onerror: (event: CustomSpeechErrorEvent) => void;
  onend: () => void;
  onresult: (event: CustomSpeechEvent) => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => CustomSpeechRecognition;
    SpeechRecognition: new () => CustomSpeechRecognition;
  }
}

interface CaseDetailClientProps {
  initialCase: Case;
  currentUser: { username: string };
}

export default function CaseDetailClient({ initialCase, currentUser }: CaseDetailClientProps) {
  const [caseFile, setCaseFile] = useState<Case>(initialCase);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state for item editing/adding
  const [editingItem, setEditingItem] = useState<ManifestItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemData, setNewItemData] = useState<Partial<ManifestItem>>({
    label: "",
    parentId: "outer-item-root",
    quantity: 1,
    status: "confirmed",
  });

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [speechCommand, setSpeechCommand] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const unresolved = caseFile.manifest.filter((item) => item.status === "review").length;
  const isFinalised = caseFile.status === "finalised";
  const hasLiveAiDraft = caseFile.manifest.some((item) => item.source === "ai");

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

  // Deterministic Speech/Text Command Parser
  const applyVoiceCorrection = useCallback(async (commandText: string) => {
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
        evidenceId: "voice-command",
      });

      if (result.success && result.manifest) {
        setCaseFile(prev => ({ ...prev, manifest: result.manifest! }));
        setSuccessMsg(`Voice Action: Added "${label}" (Qty: ${quantity})`);
        await refreshCase();
      } else {
        setErrorMsg("Failed to apply voice action: Add item");
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
          setSuccessMsg(`Voice Action: Deleted item "${matched.label}"`);
          await refreshCase();
        } else {
          setErrorMsg("Failed to delete matched item.");
        }
      } else {
        setErrorMsg(`Voice Action: No item matched "${targetLabel}" to delete.`);
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
          setSuccessMsg(`Voice Action: Confirmed "${matched.label}"`);
          await refreshCase();
        } else {
          setErrorMsg("Failed to confirm item.");
        }
      } else {
        setErrorMsg(`Voice Action: No item matched "${targetLabel}" to confirm.`);
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
          setSuccessMsg(`Voice Action: Set quantity of "${matched.label}" to ${newQty}`);
          await refreshCase();
        } else {
          setErrorMsg("Failed to update item quantity.");
        }
      } else {
        setErrorMsg(`Voice Action: No item matched "${targetLabel}" to update quantity.`);
      }
      return;
    }

    setErrorMsg(`Voice Command parsed: "${commandText}" but no deterministic action matched. Try: "add backpack", "confirm malaysian", "delete USB-C", or "set quantity of cardholder to 2"`);
  }, [caseFile.id, caseFile.manifest, refreshCase, isFinalised]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "en-SG"; // Changi localized

        rec.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        rec.onerror = (event: CustomSpeechErrorEvent) => {
          console.error("Speech error", event);
          setSpeechError(`Speech recognition failed: ${event.error}`);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        rec.onresult = (event: CustomSpeechEvent) => {
          const resultText = event.results[0][0].transcript;
          setSpeechCommand(resultText);
          setSuccessMsg("Voice transcript captured. Review it, then select Apply before the manifest changes.");
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  function startListening() {
    if (isFinalised) return;
    if (recognitionRef.current) {
      setSpeechCommand("");
      setSpeechError(null);
      recognitionRef.current.start();
    } else {
      setSpeechError("Web Speech API is not supported in this browser.");
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }

  // Handle image upload submission
  async function onUploadSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isFinalised) return;
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
        setSuccessMsg("Evidence photo uploaded successfully.");
        form.reset();
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
        setSuccessMsg(`AI analysis complete. Nested manifest draft generated with ${result.manifest?.length} items!`);
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
      status: newItemData.status || "confirmed",
      confidence: 1.0,
      reviewReason: null,
      evidenceId: newItemData.evidenceId || "staff-added",
      ocrText: newItemData.ocrText || "",
      visibleAttributes: newItemData.visibleAttributes || "",
    });

    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setSuccessMsg(`Added item "${newItemData.label}" successfully.`);
      setIsAddingItem(false);
      setNewItemData({ label: "", parentId: "outer-item-root", quantity: 1, status: "confirmed", ocrText: "", visibleAttributes: "", evidenceId: "staff-added" });
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
        setSuccessMsg("Item deleted and manifest updated.");
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
    if (item.parentId === null) return 0;
    if (item.parentId === "outer-item-root") return 1;

    // Check if parent's parent is null
    const parent = caseFile.manifest.find(i => i.id === item.parentId);
    if (!parent) return 1;
    if (parent.parentId === null) return 1;
    return 2; // Maximum depth 2 for pouch-level content (bag -> pouch -> content)
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
            Guided intake · Case <strong>{caseFile.id}</strong> {caseFile.isDemo && "(Demo Sample)"} · Officer: <strong>{currentUser.username}</strong>
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
            <p className="eyebrow">Custody Details</p>
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
          <div>
            <p className="eyebrow" style={{ marginBottom: "12px" }}>Evidence Gallery ({caseFile.uploads.length})</p>
            {caseFile.uploads.length === 0 ? (
              <div style={{ padding: "30px", border: "1px dashed var(--line)", borderRadius: "12px", textAlign: "center", color: "var(--muted)", background: "var(--paper)" }}>
                No photographic evidence uploaded yet.<br />
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
                        (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23edf1ea'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='10' fill='%2368736c'>Evidence</text></svg>";
                      }}
                    />
                    <div style={{ padding: "8px", fontSize: "0.72rem" }}>
                      <strong style={{ display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{u.originalName}</strong>
                      <span className="muted" style={{ display: "block" }}>Level: {u.containerContext}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Upload Form */}
          {!isFinalised && (
            <div style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", background: "var(--panel)" }}>
              <strong style={{ fontSize: "0.88rem", display: "block", marginBottom: "12px" }}>📸 Upload New Photographic Evidence</strong>
              <form onSubmit={onUploadSubmit} style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "grid", gap: "4px" }}>
                  <label htmlFor="file" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Select JPG / PNG / WebP</label>
                  <input
                    ref={fileInputRef}
                    id="file"
                    name="file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    style={{ fontSize: "0.8rem" }}
                  />
                </div>

                <div style={{ display: "grid", gap: "4px" }}>
                  <label htmlFor="containerContext" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Container / Nesting Level</label>
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
                    <option value="outer-item">Outer Custody Layer (backpack/suitcase)</option>
                    <option value="bag-contents">Bag Contents Level (general bag space)</option>
                    <option value="inner-container">Inner Container Level (pouch/wallet/box)</option>
                  </select>
                </div>

                <button
                  className="button full-width"
                  type="submit"
                  disabled={isUploading}
                  style={{ minHeight: "36px", fontSize: "0.85rem" }}
                >
                  {isUploading ? "Uploading file..." : "Upload & Associate"}
                </button>
              </form>
            </div>
          )}

          {/* Audit Timeline */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
            <p className="eyebrow" style={{ marginBottom: "16px" }}>🔒 Custody Audit Timeline</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {caseFile.auditLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", gap: "12px", fontSize: "0.78rem" }}>
                  <div style={{ color: "var(--green)", fontWeight: 700 }}>•</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
                      {new Date(log.timestamp).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} by <strong>{log.userId}</strong>
                    </span>
                    <span style={{ color: "var(--ink)", fontWeight: 550 }}>
                      {log.action.replaceAll("_", " ").toUpperCase()}: {log.details}
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
              <h2 style={{ fontSize: "1.8rem" }}>Manifest Workspace</h2>
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

          {/* Notifications */}
          {errorMsg && (
            <div style={{ background: "#fdf2f2", border: "1px solid #fbd5d5", color: "#c81e1e", borderRadius: "8px", padding: "12px", fontSize: "0.85rem" }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ background: "#f3faf5", border: "1px solid #def7ec", color: "var(--green)", borderRadius: "8px", padding: "12px", fontSize: "0.85rem" }}>
              ✅ {successMsg}
            </div>
          )}

          {/* Live AI triggering control */}
          {!isFinalised && (
            <div className="ai-analysis-panel" style={{
              background: "#f4f8f5",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px"
            }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: "0.88rem", display: "block" }}>Generate a Fresh Inventory Draft</strong>
                <p className="muted" style={{ fontSize: "0.78rem", margin: "4px 0 0", lineHeight: 1.4 }}>
                  Analyze every uploaded image for objects, visible text and nested container relationships.
                </p>
              </div>
              <button
                className="button"
                onClick={triggerAI}
                disabled={isAnalyzing || caseFile.uploads.length === 0}
                style={{ minHeight: "40px", whiteSpace: "nowrap", background: "var(--green-dark)" }}
              >
                {isAnalyzing ? "Analyzing Images..." : "Live AI Analysis"}
              </button>
            </div>
          )}

          {/* Spoken / Text Corrections Assistant */}
          {!isFinalised && (
            <div style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "18px", background: "var(--paper)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: "0.88rem", display: "block", color: "var(--green)" }}>🎙️ Spoken Observation Correction</strong>
                <span className="muted" style={{ fontSize: "0.72rem" }}>Uses browser Speech API</span>
              </div>

              <div style={{ display: "flex", gap: "10px", marginBlock: "12px" }}>
                <button
                  type="button"
                  className="button"
                  onClick={isListening ? stopListening : startListening}
                  style={{
                    background: isListening ? "#c81e1e" : "var(--green)",
                    border: isListening ? "1px solid #c81e1e" : "1px solid var(--green)",
                    minHeight: "40px",
                    flex: 1,
                    fontSize: "0.85rem"
                  }}
                >
                  {isListening ? "🔴 Listening... Click to Stop" : "🎤 Click to Speak Correction"}
                </button>
              </div>

              {speechError && (
                <div style={{ color: "#c81e1e", fontSize: "0.78rem", marginBottom: "8px" }}>{speechError}</div>
              )}

              {speechCommand && (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBlock: "8px", background: "var(--panel)", padding: "8px", borderRadius: "6px" }}>
                  Speech Heard: <strong style={{ color: "var(--ink)" }}>&quot;{speechCommand}&quot;</strong>
                </div>
              )}

              {/* Text fallback input */}
              <div style={{ display: "grid", gap: "4px" }}>
                <label htmlFor="text-correction" style={{ fontSize: "0.75rem", fontWeight: 700 }}>Text-Command Fallback</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="text-correction"
                    type="text"
                    placeholder="e.g. confirm Malaysian currency, add charging cable..."
                    style={{
                      flex: 1,
                      height: "36px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      paddingInline: "12px",
                      fontSize: "0.82rem",
                      background: "var(--panel)"
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value;
                        if (val) {
                          void applyVoiceCorrection(val);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="button"
                    style={{ minHeight: "36px", paddingInline: "12px", fontSize: "0.8rem" }}
                    onClick={() => {
                      const input = document.getElementById("text-correction") as HTMLInputElement;
                      if (input && input.value) {
                        void applyVoiceCorrection(input.value);
                        input.value = "";
                      }
                    }}
                  >
                    Apply
                  </button>
                </div>
                <small className="muted" style={{ fontSize: "0.7rem", marginTop: "2px" }}>
                  {"Supported verbs: add [item], delete [item], confirm [item], set quantity of [item] to [qty]"}
                </small>
              </div>
            </div>
          )}

          {/* Interactive Manifest Tree View */}
          <div className="item-list" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>Nested Hierarchy</span>
              {!isFinalised && (
                <button
                  onClick={() => setIsAddingItem(true)}
                  className="text-link"
                  style={{ background: "transparent", border: "none", fontSize: "0.82rem", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  + Add Item Manually
                </button>
              )}
            </div>

            {sortedManifest.map((item) => {
              const depth = getIndentDepth(item);

              return (
                <article
                  key={item.id}
                  className="review-item"
                  style={{
                    marginLeft: `${depth * 28}px`,
                    borderLeft: depth > 0 ? "2px solid var(--line)" : "none",
                    paddingLeft: depth > 0 ? "16px" : "4px",
                    background: item.status === "review" ? "#fffdf5" : "transparent",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <strong style={{ fontSize: "0.98rem" }}>{item.label}</strong>
                      <span style={{ fontSize: "0.75rem", background: "var(--paper)", padding: "2px 6px", borderRadius: "4px", color: "var(--muted)" }}>
                        Qty: {item.quantity}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "4px 0 0" }}>
                      Confidence {Math.round(item.confidence * 100)}%
                      {item.evidenceId && ` · Evidence: ${item.evidenceId}`}
                    </p>
                    {(item.ocrText || item.visibleAttributes) && (
                      <div style={{ marginTop: "4px", fontSize: "0.74rem", color: "var(--muted)", background: "var(--paper)", padding: "4px 8px", borderRadius: "4px", display: "inline-block" }}>
                        {item.ocrText && <div style={{ fontFamily: "monospace" }}>📝 <strong>OCR:</strong> &quot;{item.ocrText}&quot;</div>}
                        {item.visibleAttributes && <div>🔍 <strong>Attributes:</strong> {item.visibleAttributes}</div>}
                      </div>
                    )}
                    {item.reviewReason && (
                      <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "var(--amber)", fontWeight: 550 }}>
                        ⚠️ {item.reviewReason}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {!isFinalised && item.status === "review" && (
                      <button
                        className="review-button"
                        onClick={() => { void confirmItemDirect(item.id); }}
                        type="button"
                        style={{ padding: "6px 10px", fontSize: "0.78rem" }}
                      >
                        Confirm Entry
                      </button>
                    )}

                    {item.status === "confirmed" && (
                      <span className="verified" style={{ padding: "4px 8px" }}>Confirmed</span>
                    )}

                    {!isFinalised && (
                      <>
                        <button
                          onClick={() => setEditingItem(item)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.85rem" }}
                          title="Edit Item"
                        >
                          ✏️
                        </button>
                        {item.id !== "outer-item-root" && (
                          <button
                            onClick={() => { void deleteItemDirect(item.id); }}
                            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.85rem" }}
                            title="Delete Item"
                          >
                            ❌
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
                The manifest is completely empty. Please trigger live AI analysis or add items manually.
              </div>
            )}
          </div>

          {/* Finalisation Control & Download Exports Panel */}
          <div className="finalise-row" style={{ borderTop: "1px solid var(--line)", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="finalise-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                {isFinalised ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 700, color: "var(--green)" }}>✅ Custody Case Finalised & Approved</p>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Approved by: <strong>{caseFile.finalisedBy}</strong> on {caseFile.finalisedAt ? new Date(caseFile.finalisedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" }) : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <p style={{ margin: 0, fontWeight: 550 }}>
                      {caseFile.uploads.length === 0
                        ? "Upload at least one validated evidence image before finalising."
                        : unresolved === 0
                          ? "Manifest is complete. Ready for approval and export."
                          : `Resolve ${unresolved} remaining review items before finalising.`}
                    </p>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Approved state creates a durable custody chain.
                    </span>
                  </>
                )}
              </div>

              {!isFinalised && (
                <button
                  className="button"
                  disabled={unresolved > 0 || caseFile.uploads.length === 0 || isFinalised}
                  onClick={() => { void finaliseIntake(); }}
                  style={{ paddingInline: "24px" }}
                >
                  Approve and Finalise
                </button>
              )}
            </div>

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
                <strong style={{ fontSize: "0.85rem", color: "var(--green)" }}>📥 Export Manifest Handover Data</strong>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Download approved inventory reports with nested parent IDs and evidence references.
                </span>
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                  <a
                    href={`/api/cases/${caseFile.id}/export/json`}
                    download={`foundflow_manifest_${caseFile.id}.json`}
                    className="button"
                    style={{ flex: 1, minHeight: "36px", fontSize: "0.82rem", background: "var(--green)" }}
                  >
                    Download JSON Manifest
                  </a>
                  <a
                    href={`/api/cases/${caseFile.id}/export/csv`}
                    download={`foundflow_manifest_${caseFile.id}.csv`}
                    className="button button-secondary"
                    style={{ flex: 1, minHeight: "36px", fontSize: "0.82rem" }}
                  >
                    Download CSV Manifest
                  </a>
                </div>
              </div>
            )}
          </div>

        </section>
      </div>

      {/* MODAL 1: Edit Item Form Overlay */}
      {editingItem && (
        <div style={{
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
          <div style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "24px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
          }}>
            <h3 style={{ fontSize: "1.25rem", margin: "0 0 16px" }}>✏️ Edit Manifest Record</h3>
            <form onSubmit={(e) => { void submitEditItem(e); }} style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Item Label</label>
                <input
                  type="text"
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
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Quantity</label>
                <input
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
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Evidence Reference</label>
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
        <div style={{
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
          <div style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "24px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
          }}>
            <h3 style={{ fontSize: "1.25rem", margin: "0 0 16px" }}>➕ Add New Manifest Record</h3>
            <form onSubmit={(e) => { void submitAddItem(e); }} style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Item Label</label>
                <input
                  type="text"
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
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Quantity</label>
                <input
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
                <label style={{ fontSize: "0.75rem", fontWeight: 700 }}>Evidence Reference</label>
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
        <span>FoundFlow Intake Workspace · Custody Copilot</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
