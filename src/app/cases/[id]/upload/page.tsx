"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StepIndicator from "@/components/StepIndicator";
import LayoutGuide from "@/components/LayoutGuide";
import { handleUploadEvidence } from "@/app/cases/actions";
import { PHOTO_CONTEXT_OPTIONS, type PhotoContext } from "@/lib/photo-context";

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploads, setUploads] = useState<{ id: string; name: string; mimeType: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoContext, setPhotoContext] = useState<PhotoContext>("loose-item");

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("containerContext", photoContext);

    try {
      const result = await handleUploadEvidence(caseId, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.upload) {
        setUploads((prev) => [...prev, {
          id: result.upload!.id,
          name: result.upload!.originalName,
          mimeType: result.upload!.mimeType,
        }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <main className="page-stage">
      <AppHeader />
      <div id="main-content" className="workflow-shell work-surface">
        <StepIndicator currentStep={2} />

        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "32px",
          marginTop: "24px",
        }}>
          <p className="eyebrow">Step 2 of 5</p>
          <h1 style={{ fontSize: "1.8rem", letterSpacing: "-0.025em", margin: "0 0 8px" }}>
            Add Item Photos
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 24px", lineHeight: 1.5 }}>
            Take photos of each layer of contents. Spread items out and scan one nesting level at a time.
          </p>

          <LayoutGuide />

          <div style={{ marginTop: "24px", display: "grid", gap: "12px" }}>
            <label htmlFor="photo-context" style={{ display: "grid", gap: "5px", fontSize: "0.78rem", fontWeight: 700 }}>
              Photo context
              <select
                id="photo-context"
                value={photoContext}
                onChange={(event) => setPhotoContext(event.target.value as PhotoContext)}
                style={{ width: "100%", height: "42px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--paper)", paddingInline: "10px" }}
              >
                {PHOTO_CONTEXT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={onUpload}
              style={{ display: "none" }}
              id="evidence-upload"
            />
            <button
              type="button"
              className="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{ width: "100%", minHeight: "50px", fontSize: "0.95rem" }}
            >
              {isUploading ? "Uploading…" : "Choose Image or Take Photo"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", fontSize: "0.82rem", color: "#991b1b" }}>
              {error}
            </div>
          )}

          {uploads.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <strong style={{ fontSize: "0.82rem", display: "block", marginBottom: "8px" }}>
                {uploads.length} photo{uploads.length !== 1 ? "s" : ""} uploaded
              </strong>
              <div style={{ display: "grid", gap: "6px" }}>
                {uploads.map((u) => (
                  <div key={u.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: "var(--paper)",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                  }}>
                    <span style={{ color: "var(--green)" }}>✓</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{u.mimeType.split("/")[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
            <Link href={`/cases/${caseId}`} className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>
              ← Back
            </Link>
            <button
              type="button"
              className="button"
              disabled={uploads.length === 0}
              onClick={() => router.push(`/cases/${caseId}/scan`)}
              style={{ flex: 2 }}
            >
              Next: Scan →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
