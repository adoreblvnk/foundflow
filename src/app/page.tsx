import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />

      <div style={{
        width: "min(600px, calc(100% - 40px))",
        marginInline: "auto",
        paddingBlock: "80px 60px",
        textAlign: "center",
      }}>
        <p className="eyebrow">Found-Property Intake Copilot</p>
        <h1 style={{ fontSize: "2.8rem", letterSpacing: "-0.04em", margin: "0 0 16px", lineHeight: 1 }}>
          FoundFlow
        </h1>
        <p style={{ fontSize: "1rem", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 48px" }}>
          Photograph. Scan. Verify. Replace 25 minutes of typing with 5 minutes of review.
        </p>

        <div style={{ marginBottom: "24px" }}>
          <Link href="/cases" style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            padding: "32px 20px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "14px",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}>
            <strong style={{ fontSize: "1.05rem" }}>Start Staff Intake</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.4 }}>
              Register found property, add item photos and verify the structured item list.
            </span>
          </Link>
        </div>

        <Link href="/search" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "14px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "10px",
          textDecoration: "none",
          color: "var(--muted)",
          fontSize: "0.88rem",
          fontWeight: 600,
        }}>
          Search staff-confirmed items from completed cases
        </Link>
      </div>
    </main>
  );
}
