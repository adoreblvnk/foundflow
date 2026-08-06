"use client";

import type { ScanEvent } from "@/lib/scan-events";

export default function ScanProgress({ event }: { event: ScanEvent | null }) {
  if (!event) return null;
  const photoLabel = `${event.photoCount} item photo${event.photoCount === 1 ? "" : "s"}`;
  return (
    <section
      aria-label="Photo scan progress"
      style={{ marginTop: "16px", display: "grid", gap: "8px", textAlign: "left" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "0.8rem" }}>
        <strong aria-live="polite">{event.label}</strong>
        <span>{event.progress}%</span>
      </div>
      <progress
        aria-label="Photo scan progress"
        max={100}
        value={event.progress}
        style={{ width: "100%", height: "12px", accentColor: "var(--green-dark)" }}
      />
      <span className="muted" style={{ fontSize: "0.75rem" }}>{photoLabel}</span>
    </section>
  );
}
