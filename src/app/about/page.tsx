import AppHeader from "@/components/AppHeader";

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <AppHeader />

      <div style={{
        width: "min(720px, calc(100% - 40px))",
        marginInline: "auto",
        paddingBlock: "48px 80px",
      }}>
        {/* Short Summary */}
        <section style={{ marginBottom: "48px" }}>
          <p className="eyebrow">What is FoundFlow</p>
          <h1 style={{ fontSize: "2.4rem", lineHeight: 1.05, letterSpacing: "-0.04em", marginBottom: "20px" }}>
            AI-Assisted Found-Property Intake
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--muted)" }}>
            Today, frontline officers log found property by photographing items and manually typing each
            description into a mobile app, a process that takes 20 to 30 minutes for a bag with many items,
            and is especially error-prone for mixed-currency cash that requires exact denomination counts.
            FoundFlow replaces that manual typing with AI vision: officers photograph each layer of contents,
            AI reads the image and drafts a complete structured inventory with nesting relationships and
            computed currency totals, and staff simply review and confirm. A 15-item backpack that took
            25 minutes of typing now takes under 5 minutes of verification.
          </p>
        </section>

        {/* Full Write-up */}
        <section style={{ display: "grid", gap: "36px" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>The Problem & Our Approach</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                In transit hubs like airports, frontline officers handle found property daily. The current
                workflow requires them to open their mobile device, photograph items, then manually type
                every single item description: label, quantity, condition, serial numbers. For a bag
                containing 10 to 15 items across multiple compartments, this takes 20 to 30 minutes.
              </p>
              <p style={{ margin: 0 }}>
                Cash is the worst case. A pouch with mixed Singapore dollars and Malaysian ringgit (notes
                and coins of different denominations) requires the officer to count each denomination group,
                calculate totals, and type them without error. One miscount means the custody record
                doesn&apos;t balance, creating accountability issues.
              </p>
              <p style={{ margin: 0 }}>
                Our approach: <strong>replace typing with scanning.</strong> The officer photographs each
                layer of contents spread on a surface. AI vision reads the photo and produces a structured
                draft: item labels, nesting (what was inside what), OCR text, and exact denomination ×
                quantity totals for currency. The officer&apos;s job shifts from data entry to data verification:
                confirm what&apos;s correct, fix what isn&apos;t. The AI never auto-approves; every item requires
                human sign-off before the case can be finalised and exported.
              </p>
              <p style={{ margin: 0 }}>
                Two intake modes serve different contexts: <strong>Kiosk Mode</strong> uses a fixed camera
                at a scanning station for rapid batch processing, while <strong>Field Mode</strong> provides
                a guided step-by-step wizard for officers working from their phone in the field.
              </p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Evidence & Experiments</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                We staged a synthetic backpack with mixed SGD/MYR currency (notes and coins), electronics,
                a cardholder, and nested pouches. AI correctly identified 11 items across 3 nesting levels
                with exact denomination × quantity calculations. Currency totals matched manual count:
                SGD 104.00 and MYR 50.40.
              </p>
              <p style={{ margin: 0 }}>
                The layout guide (instructing officers to spread items apart, face text upward, and scan
                one layer at a time) significantly improved AI accuracy. Spread items were reliably
                detected, while piled items triggered &quot;review&quot; flags requiring manual intervention.
              </p>
              <p style={{ margin: 0 }}>
                A comprehensive domain test suite validates 35 automated tests covering session security,
                magic-number upload validation, cycle detection in nested hierarchies, CSV formula injection
                prevention, and finalisation rules that block unresolved items.
              </p>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>Constraints, Mitigations & Limitations</h2>
            <ul style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", paddingLeft: "20px", margin: 0, display: "grid", gap: "10px" }}>
              <li>
                <strong>Single-server SQLite storage</strong> - not horizontally scalable.
                <br /><em>Mitigation:</em> Swap to Turso (libSQL) or Vercel Postgres with minimal schema changes since our queries are standard SQL.
              </li>
              <li>
                <strong>Kiosk camera requires HTTPS</strong> - browser getUserMedia demands a secure context.
                <br /><em>Mitigation:</em> Vercel deploys with HTTPS by default. For local dev, use mkcert for trusted local certificates.
              </li>
              <li>
                <strong>AI accuracy varies</strong> - low-confidence items and unreadable currency are flagged for review.
                <br /><em>Mitigation:</em> Layout guide reduces misreads. Officers can edit items or split mixed-currency groups into individual denominations. The system blocks confirmation until details are exact.
              </li>
              <li>
                <strong>No multi-user collaboration</strong> - one officer per case at a time.
                <br /><em>Mitigation:</em> Add optimistic locking (version column) to prevent overwrites. Real-time sync possible with Supabase Realtime or Ably.
              </li>
              <li>
                <strong>Search is not vector-indexed</strong> - uses keyword matching + AI re-ranking.
                <br /><em>Mitigation:</em> For production scale, add pgvector embeddings on item descriptions for sub-second semantic search without per-query AI calls.
              </li>
              <li>
                <strong>No offline fallback</strong> - requires network for AI scan and data persistence.
                <br /><em>Mitigation:</em> Service worker with IndexedDB queue. Officers capture photos offline, sync and scan when reconnected.
              </li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: "1.4rem", marginBottom: "12px" }}>What We Would Improve Next</h2>
            <ol style={{ fontSize: "0.92rem", lineHeight: 1.7, color: "var(--muted)", paddingLeft: "20px", margin: 0, display: "grid", gap: "6px" }}>
              <li>Persistent cloud database (Postgres or Turso) for production multi-server deployment</li>
              <li>Offline-first capability with service worker and sync queue for connectivity dead zones</li>
              <li>Barcode/QR scanning for tagged evidence bags and registered items</li>
              <li>Batch mode for high-volume lost-and-found centres processing 50+ items per day</li>
              <li>Role-based access with supervisor approval workflow and shift handover</li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
