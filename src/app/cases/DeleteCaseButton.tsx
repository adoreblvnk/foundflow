"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { handleDeleteCase } from "@/app/cases/actions";

export default function DeleteCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteCase() {
    if (!window.confirm(`Delete case ${caseId}? This also removes its uploaded photos and cannot be undone.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const result = await handleDeleteCase(caseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <button
        type="button"
        aria-label={`Delete case ${caseId}`}
        disabled={isDeleting}
        onClick={() => { void deleteCase(); }}
        style={{
          border: 0,
          background: "transparent",
          color: "#991b1b",
          cursor: isDeleting ? "wait" : "pointer",
          padding: "4px 0",
          justifySelf: "start",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        {isDeleting ? "Deleting…" : "Delete Case"}
      </button>
      {error && <span role="alert" style={{ color: "#991b1b", fontSize: "0.72rem" }}>{error}</span>}
    </div>
  );
}
