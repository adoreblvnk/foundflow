"use client";

import AppHeader from "@/components/AppHeader";

export default function ChallengePage() {
  return (
    <main className="page-stage">
      <AppHeader />

      <div id="main-content" className="page-content page-content-narrow" style={{
        width: "min(760px, calc(100% - 40px))",
        marginInline: "auto",
        paddingBlock: "48px 80px",
      }}>
        <section style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
            <div>
              <p className="eyebrow">Launchpad 2026 AI Challenge</p>
              <h1 style={{ fontSize: "2.2rem", lineHeight: 1.1, letterSpacing: "-0.025em", marginBottom: "16px" }}>
                FoundFlow — AI-Powered Found-Item Intake
              </h1>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="button"
              style={{ minHeight: "40px", paddingInline: "16px", fontSize: "0.82rem", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Print / Save PDF
            </button>
          </div>
          <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--muted)" }}>
            Staff-confirmed, photo-linked item logging for airport found-item teams.
            FoundFlow replaces manual data entry with guided AI vision to document complex
            nested containers accurately and accountably.
          </p>
        </section>

        <section style={{ display: "grid", gap: "40px" }}>
          {/* Pillar 1: Problem */}
          <div>
            <h2 style={{ fontSize: "1.35rem", marginBottom: "12px", color: "var(--ink)" }}>1. Problem</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.75, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                At Changi Airport, staff document found items by hand — photographing, then typing every
                label, quantity, serial number, and currency total into a form. A bag with 10–15 nested items
                takes 20–30 minutes. Cash with mixed currencies and denominations is the worst case: one
                miscount means the record doesn&apos;t balance.
              </p>
              <p style={{ margin: 0 }}><strong>Scale of the problem:</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li>Changi Airport handles <strong>54,000 lost items per year</strong> across 4 terminals serving 58.9 million passengers <sup>[1]</sup></li>
                <li>SPF&apos;s Found and Unclaimed Property Office processed <strong>50,000 found property reports in 2024</strong> — up from 42,000 in 2022 <sup>[2]</sup></li>
                <li>SITA estimates repatriation costs of up to <strong>US$95 per item</strong> <sup>[3]</sup></li>
                <li>ICA officers at checkpoints spent <strong>~8 minutes to report</strong> and <strong>~10 minutes to search</strong> for a single item using physical logbooks <sup>[4]</sup></li>
              </ul>
              <p style={{ margin: 0 }}><strong>Why existing approaches fall short:</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li><strong>FindX</strong> (ICA/GovTech, 2025) digitised reporting and tracking at land checkpoints — reduced report time from 8 to 3 minutes — but focuses on <em>logging and search</em>, not structured multi-item extraction <sup>[4]</sup></li>
                <li><strong>SPF FUPO</strong> uses AI optical cameras + RPA to read serial numbers and auto-fill inventory — but processes items <em>after</em> they reach the central office, not at point of discovery <sup>[2]</sup></li>
                <li><strong>SITA WorldTracer Lost &amp; Found</strong> handles matching and repatriation across 2,800 airports — but relies on staff manually entering item descriptions <sup>[3]</sup></li>
                <li>None of these systems handle <em>nested container intake</em>: documenting what&apos;s inside a bag with multiple compartments, mixed currencies, and layered contents</li>
              </ul>
              <p style={{ margin: 0 }}><strong>Success criteria (defined before building):</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li>Reduce intake time for complex multi-item cases</li>
                <li>Maintain or improve item recall and quantity accuracy</li>
                <li>Preserve container hierarchy (bag → pouch → contents)</li>
                <li>Never allow AI to auto-approve — staff must confirm every record</li>
              </ul>
            </div>
          </div>

          {/* Pillar 2: Approach */}
          <div>
            <h2 style={{ fontSize: "1.35rem", marginBottom: "12px", color: "var(--ink)" }}>2. Approach</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.75, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                <strong>Core idea: replace typing with scanning, keep humans in the loop.</strong> Staff
                photograph each container level. AI drafts a structured inventory. Staff verify and correct.
              </p>
              <p style={{ margin: 0 }}><strong>Alternatives ruled out:</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li><em>Fully autonomous AI</em> — accountability requires human sign-off, especially for currency and ID documents.</li>
                <li><em>Single-pass extraction</em> — missed items and quantity errors. Replaced with a <strong>two-pass pipeline</strong> (extraction + independent verifier).</li>
                <li><em>Flat AI inventory</em> — loses nesting relationships. We preserve parent-child hierarchies throughout.</li>
              </ul>
              <p style={{ margin: 0 }}><strong>Key design decisions:</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li><strong>Guided photography</strong> — outer item first, one container level at a time. Reduces occlusion, improves detection.</li>
                <li><strong>Two-model verification</strong> — gpt-5.6-sol for both extraction and independent re-verification. The verifier never sees the first pass&apos;s output.</li>
                <li><strong>Per-item bounding boxes</strong> — every record links to a specific region in its source photo.</li>
                <li><strong>Review gating</strong> — money, documents, and uncertain items require explicit staff confirmation before case completion.</li>
                <li><strong>Private matching details</strong> — hidden from search, used only during ownership claim verification.</li>
                <li><strong>Graceful degradation</strong> — if AI fails, staff can still complete intake manually. No data is lost.</li>
              </ul>
            </div>
          </div>

          {/* Pillar 3: Evidence */}
          <div>
            <h2 style={{ fontSize: "1.35rem", marginBottom: "12px", color: "var(--ink)" }}>3. Evidence</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.75, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>
                <strong>Staged test:</strong> Synthetic backpack with mixed SGD/MYR currency (notes + coins),
                electronics, cardholder, and nested pouches.
              </p>
              <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse", margin: "8px 0" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px 8px 0" }}>Metric</th>
                    <th style={{ padding: "8px 12px 8px 0" }}>Result</th>
                    <th style={{ padding: "8px 12px 8px 0" }}>Baseline</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>Item recall</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>11/11 (100%)</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>Generic captioning: ~7/11</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>Nesting accuracy</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>3/3 levels correct</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>Flat AI: 0 (no hierarchy)</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>Currency totals</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>SGD 104.00, MYR 50.40 ✓</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>Manual: same (but 15+ min)</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>Denomination groups</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>5/5 separated correctly</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>—</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px 12px 8px 0" }}>False positives</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>0 hallucinated items</td>
                    <td style={{ padding: "8px 12px 8px 0" }}>—</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ margin: 0 }}><strong>Additional verification:</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li>Automated domain tests — session security, upload magic-number validation, cycle detection, finalisation rules</li>
                <li>Playwright E2E — full workflow from sign-in through photo upload, AI scan, review, completion, and collection</li>
                <li>Layout guide impact — spread items reliably detected; piled items correctly flagged for review (not silently misidentified)</li>
              </ul>
            </div>
          </div>

          {/* Pillar 4: Constraints */}
          <div>
            <h2 style={{ fontSize: "1.35rem", marginBottom: "12px", color: "var(--ink)" }}>4. Constraints</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.75, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}>Real-world limits we measured and designed around:</p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "6px" }}>
                <li><strong>Cost:</strong> ~$0.10–0.30 per case (two gpt-5.6-sol calls). Acceptable vs. 20–30 min of staff time at airport labour rates.</li>
                <li><strong>Latency:</strong> 8–15 seconds per scan. Non-blocking — staff review existing items while AI processes.</li>
                <li><strong>Reliability:</strong> Verifier failure retains primary draft with review gates. Complete AI failure allows manual completion. No data loss path.</li>
                <li><strong>Privacy:</strong> Passport/IC stored as last-four-characters only. Private matching details segregated from search. Photos in access-controlled storage.</li>
                <li><strong>Network:</strong> Required for AI scan. Manual intake remains functional offline. Service worker queue planned.</li>
                <li><strong>Security:</strong> Constant-time HMAC verification, magic-number file signatures, atomic database transactions, audit trail on every action.</li>
              </ul>
            </div>
          </div>

          {/* Pillar 5: Honesty & Trajectory */}
          <div>
            <h2 style={{ fontSize: "1.35rem", marginBottom: "12px", color: "var(--ink)" }}>5. Honesty &amp; Trajectory</h2>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.75, color: "var(--muted)", display: "grid", gap: "12px" }}>
              <p style={{ margin: 0 }}><strong>Known failure modes:</strong></p>
              <ul style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li>Bounding boxes can be imprecise for small or overlapping objects — staff correction needed</li>
                <li>Piled items (not spread apart) significantly reduce detection accuracy</li>
                <li>Worn/damaged currency with illegible markings requires manual entry</li>
                <li>No concurrent multi-staff editing on the same case</li>
                <li>No offline AI — manual entry only without network</li>
              </ul>
              <p style={{ margin: 0, marginTop: "8px" }}><strong>What we would build next:</strong></p>
              <ol style={{ paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
                <li><strong>On-device ML from staff corrections</strong> — every confirmed/corrected item is a labeled training sample (photo + verified output). Fine-tune a lightweight model (YOLO for detection, small VLM for classification) on Changi-specific items to reduce cloud API dependency and enable offline intake</li>
                <li>Offline capture queue (service worker + IndexedDB sync) with local model handling basic detection</li>
                <li>Optimistic locking for multi-staff concurrent access</li>
                <li>Barcode/QR scanning for tagged item bags</li>
                <li>Vector-indexed semantic search (pgvector) for production-scale matching</li>
                <li>Role-based access with supervisor approval and shift handover</li>
                <li>Passenger-facing lost report portal with auto-matching against found items</li>
              </ol>
              <p style={{ margin: 0, marginTop: "8px" }}>
                <strong>ML trajectory:</strong> Phase 1 (current) — cloud AI for all scans, staff corrections
                build a labeled dataset. Phase 2 — fine-tuned local model handles common items (bags, phones,
                wallets, SGD/MYR currency), cloud only for edge cases. Phase 3 — fully offline-capable
                on-device model, cloud as optional verifier. Each staff confirmation today makes the
                system cheaper and faster tomorrow.
              </p>
              <p style={{ margin: 0, marginTop: "8px" }}>
                <strong>Scope statement:</strong> This is a functional prototype demonstrating a complete
                vertical slice — intake → nested draft → correction → completion → verified collection.
                Production deployment requires organisational access controls, operational review, and
                integration with existing airport systems.
              </p>
            </div>
          </div>
          {/* References */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px", marginTop: "16px" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--ink)" }}>References</h2>
            <ol style={{ fontSize: "0.8rem", lineHeight: 1.8, color: "var(--muted)", paddingLeft: "20px", margin: 0, display: "grid", gap: "4px" }}>
              <li>National World (2024). &quot;World&apos;s best airport reveals unusual items left behind&quot; — Changi Airport handles 54,000 lost items/year, 58.9M passengers. <em>nationalworld.com</em></li>
              <li>Singapore Police Force (2025). &quot;Lost and Found: The SPF&apos;s Tech-Powered Property Detectives&quot; — FUPO processed 50,000 reports in 2024 (up from 42,000 in 2022). AI optical cameras + RPA reduce manual entry. <em>police.gov.sg</em></li>
              <li>SITA (2021). &quot;WorldTracer Lost and Found Property&quot; — Industry-standard matching across 500+ airlines, 2,800 airports. Repatriation costs up to US$95/item. <em>sita.aero</em></li>
              <li>Hack for Public Good (2025). &quot;FindX&quot; — ICA digital platform replacing physical logbooks at Woodlands Checkpoint. Reduced report time from 8 min to 3 min, search from 10 min to &lt;5 min. <em>hack.gov.sg/2025/findx</em></li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
