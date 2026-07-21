import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { getCases } from "@/lib/db";
import { handleLogout } from "@/app/login/actions";
import { handleSeedDemo } from "@/app/cases/actions";

export default async function CasesPage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  const currentUser = await getCurrentUser();
  const cases = getCases();

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="shell nav" style={{ borderBottom: "1px solid var(--line)" }}>
        <div>
          <Link className="brand" href="/">FoundFlow</Link>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
            Officer Portal · Active Session: <strong>{currentUser?.username}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link className="button" href="/cases/new" style={{ minHeight: "40px" }}>
            + Create New Case
          </Link>
          <form action={handleLogout}>
            <button className="button button-secondary" type="submit" style={{ minHeight: "40px" }}>
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <section className="shell" style={{ flex: 1, paddingBlock: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "28px" }}>
          <div>
            <p className="eyebrow">Case Management</p>
            <h1 style={{ fontSize: "2.5rem", letterSpacing: "-0.04em", margin: 0 }}>Active Handover Cases</h1>
          </div>
          <span className="muted" style={{ fontSize: "0.95rem" }}>{cases.length} cases found</span>
        </div>

        {cases.length === 0 ? (
          <div style={{
            border: "1px dashed var(--line)",
            borderRadius: "16px",
            padding: "48px",
            textAlign: "center",
            background: "var(--panel)",
            maxWidth: "600px",
            margin: "40px auto"
          }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "12px" }}>No Cases Found</h2>
            <p className="muted" style={{ fontSize: "0.95rem", marginBottom: "24px", lineHeight: 1.5 }}>
              The database is currently clean and empty. You can create a brand new case, or seed the pre-populated demo sample case to explore the verification and approval features.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <Link href="/cases/new" className="button">
                + Create New Case
              </Link>
              <form action={handleSeedDemo}>
                <button type="submit" className="button button-secondary" style={{ minHeight: "40px" }}>
                  📥 Load Demo Case (FF-0241)
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
            {cases.map((c) => {
              const unresolvedCount = c.manifest.filter(i => i.status === "review").length;

              return (
                <article
                  key={c.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "16px",
                    background: "var(--panel)",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "box-shadow 0.2s",
                    boxShadow: "0 4px 12px rgba(22, 49, 37, 0.02)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "1.15rem" }}>{c.id}</strong>
                        {c.isDemo && (
                          <span style={{ background: "#edf1ea", color: "var(--muted)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: 700 }}>
                            DEMO SAMPLE
                          </span>
                        )}
                      </div>
                      <span className={c.status === "finalised" ? "status status-complete" : "status"}>
                        {c.status === "finalised" ? "Finalised" : "Draft Intake"}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 10px" }}>
                      {c.outerItemDescription}
                    </h3>

                    <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 16px" }}>
                      📍 {c.location}<br />
                      📅 {new Date(c.foundTime).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}
                    </p>

                    <div style={{
                      display: "flex",
                      gap: "10px",
                      background: "var(--paper)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      marginBottom: "20px"
                    }}>
                      <div>📁 <strong>{c.uploads.length}</strong> Evidence files</div>
                      <div>📦 <strong>{c.manifest.length}</strong> Manifest items</div>
                      {unresolvedCount > 0 && (
                        <div style={{ color: "var(--amber)", fontWeight: "bold" }}>⚠️ <strong>{unresolvedCount}</strong> Review</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <Link href={`/cases/${c.id}`} className="button full-width" style={{ minHeight: "40px", fontSize: "0.9rem" }}>
                      Open Case File →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="shell footer" style={{ borderTop: "1px solid var(--line)", paddingBlock: "24px" }}>
        <span>FoundFlow Copilot Operational Dashboard</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
