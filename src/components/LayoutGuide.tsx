"use client";

import { useState } from "react";

export default function LayoutGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      border: "1px solid var(--line)",
      borderRadius: "12px",
      background: "var(--panel)",
      color: "var(--ink)",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "0.84rem",
          fontWeight: 700,
          color: "var(--green)",
        }}
      >
        <span>📐 How to Arrange Items for Scanning</span>
        <span style={{ fontSize: "0.9rem" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", fontSize: "0.82rem", lineHeight: 1.6 }}>
          <ol style={{ margin: "0 0 16px", paddingLeft: "20px", display: "grid", gap: "10px" }}>
            <li><strong>Separate each layer</strong> - Open the bag. Remove contents one nesting level at a time.</li>
            <li><strong>Spread on a flat surface</strong> - Place items ~5cm apart on a plain background. No overlapping.</li>
            <li><strong>Face text upward</strong> - Currency, cards, labels: face the readable side to the camera.</li>
            <li><strong>Group by container</strong> - Items from the same pouch/pocket stay together. Scan each group separately.</li>
            <li><strong>Include a reference object</strong> - A pen or ruler in frame helps gauge size.</li>
          </ol>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{
              padding: "12px",
              borderRadius: "8px",
              background: "#e8f5e9",
              border: "1px solid #c8e6c9",
            }}>
              <strong style={{ fontSize: "0.76rem", display: "block", marginBottom: "6px" }}>✅ Good</strong>
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.75rem", color: "var(--muted)" }}>
                <li>Items spread apart</li>
                <li>Text facing camera</li>
                <li>One layer at a time</li>
                <li>Plain background</li>
              </ul>
            </div>
            <div style={{
              padding: "12px",
              borderRadius: "8px",
              background: "#fff3e0",
              border: "1px solid #ffe0b2",
            }}>
              <strong style={{ fontSize: "0.76rem", display: "block", marginBottom: "6px" }}>❌ Avoid</strong>
              <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.75rem", color: "var(--muted)" }}>
                <li>Piled or stacked items</li>
                <li>Currency folded/overlapping</li>
                <li>Items still inside bag</li>
                <li>Reflections on text</li>
              </ul>
            </div>
          </div>

          <p style={{ margin: "12px 0 0", fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
            Tip: Scan once per nesting level - Bag (outer) then Pouch contents then Wallet contents
          </p>
        </div>
      )}
    </div>
  );
}
