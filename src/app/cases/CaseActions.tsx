"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { handleDeleteCase, handleSetCaseArchived } from "@/app/cases/actions";

export default function CaseActions({ caseId, archived, canDelete }: { caseId: string; archived: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setArchived() {
    setActiveAction("archive");
    setError(null);
    try {
      const result = await handleSetCaseArchived(caseId, !archived);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteCase() {
    if (!window.confirm(`Delete case ${caseId}? This also removes its uploaded photos and cannot be undone.`)) return;
    setActiveAction("delete");
    setError(null);
    try {
      const result = await handleDeleteCase(caseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setActiveAction(null);
    }
  }

  const actionStyle = {
    border: 0,
    background: "transparent",
    cursor: activeAction ? "wait" : "pointer",
    padding: "4px 0",
    fontSize: "0.75rem",
    fontWeight: 700,
  } as const;

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <button
          type="button"
          aria-label={`${archived ? "Restore" : "Archive"} case ${caseId}`}
          disabled={Boolean(activeAction)}
          onClick={() => { void setArchived(); }}
          style={{ ...actionStyle, color: "var(--green-dark)" }}
        >
          {activeAction === "archive" ? (archived ? "Restoring…" : "Archiving…") : (archived ? "Restore Case" : "Archive Case")}
        </button>
        {canDelete && (
          <button
            type="button"
            aria-label={`Delete case ${caseId}`}
            disabled={Boolean(activeAction)}
            onClick={() => { void deleteCase(); }}
            style={{ ...actionStyle, color: "#991b1b" }}
          >
            {activeAction === "delete" ? "Deleting…" : "Delete Case"}
          </button>
        )}
      </div>
      {error && <span role="alert" style={{ color: "#991b1b", fontSize: "0.72rem" }}>{error}</span>}
    </div>
  );
}
