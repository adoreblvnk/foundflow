import Link from "next/link";
import { getCases } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CasesPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const cases = await getCases();

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="shell nav" style={{ borderBottom: "1px solid var(--line)" }}>
        <div>
          <Link className="brand" href="/">FoundFlow</Link>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link className="button" href="/cases/new" style={{ minHeight: "40px" }}>
            + New Case
          </Link>
        </div>
      </header>

      <section className="shell" style={{ paddingBlock: "32px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>Cases</h1>
          <span className="muted" style={{ fontSize: "0.85rem" }}>{cases.length} case{cases.length !== 1 ? "s" : ""}</span>
        </div>

        {cases.length === 0 ? (
          <div style={{
            border: "1px dashed var(--line)",
            borderRadius: "12px",
            padding: "40px",
            textAlign: "center",
            background: "var(--panel)",
          }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 8px" }}>No cases yet</p>
            <p className="muted" style={{ fontSize: "0.9rem", margin: "0 0 20px" }}>
              Create a new case or load the demo to see the full workflow.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link href="/cases/new" className="button">+ New Case</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {cases.map((c) => {
              const unresolvedCount = c.manifest.filter(i => i.status === "review").length;
              const totalItems = c.manifest.length;
              const confirmedItems = c.manifest.filter(i => i.status === "confirmed").length;

              // Determine current step
              let currentStep = "Create";
              if (c.claims?.some((claim) => claim.decision === "approved")) {
                currentStep = "Collected";
              } else if (c.status === "finalised") {
                currentStep = "Complete";
              } else if (totalItems > 0 && unresolvedCount === 0) {
                currentStep = "Ready to Finalise";
              } else if (totalItems > 0) {
                currentStep = "Review";
              } else if (c.uploads.length > 0) {
                currentStep = "Scan";
              } else {
                currentStep = "Upload";
              }

              return (
                <Link
                  href={`/cases/${c.id}`}
                  key={c.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    background: "var(--panel)",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "box-shadow 0.15s, border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.85rem" }}>{c.id}</strong>
                    <span className={c.status === "finalised" ? "status status-complete" : "status"}
                      style={{ fontSize: "0.72rem" }}>
                      {currentStep}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                    {c.outerItemDescription}
                  </h3>

                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    📍 {c.location}
                  </div>

                  <div style={{
                    display: "flex",
                    gap: "12px",
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                  }}>
                    <span>📷 {c.uploads.length}</span>
                    <span>📦 {totalItems}</span>
                    <span>✅ {confirmedItems}/{totalItems}</span>
                    {unresolvedCount > 0 && (
                      <span style={{ color: "var(--amber)", fontWeight: 600 }}>⚠️ {unresolvedCount}</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {totalItems > 0 && (
                    <div style={{
                      height: "4px",
                      background: "var(--line)",
                      borderRadius: "2px",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.round((confirmedItems / totalItems) * 100)}%`,
                        background: c.status === "finalised" ? "var(--green)" : "var(--green)",
                        borderRadius: "2px",
                        transition: "width 0.3s",
                      }} />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="shell footer" style={{ borderTop: "1px solid var(--line)", paddingBlock: "20px", marginTop: "auto" }}>
        <span>FoundFlow Intake Copilot</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
