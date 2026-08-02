import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { handleCreateCase } from "@/app/cases/actions";
import { LOCATION_PRESETS } from "@/lib/constants";

export default async function NewCasePage() {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  const currentUser = await getCurrentUser();
  const currentIsoString = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date()).replace(" ", "T");

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="shell nav" style={{ borderBottom: "1px solid var(--line)" }}>
        <div>
          <Link className="brand" href="/">FoundFlow</Link>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
            New Intake Session · <strong>{currentUser?.username}</strong>
          </p>
        </div>
        <Link className="button button-secondary" href="/cases" style={{ minHeight: "40px" }}>
          Back to Dashboard
        </Link>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{
          width: "100%",
          maxWidth: "580px",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "16px",
          padding: "36px",
          boxShadow: "0 20px 40px rgba(22, 49, 37, 0.05)"
        }}>
          <p className="eyebrow" style={{ marginBottom: "8px" }}>Form FF-01</p>
          <h1 style={{ fontSize: "2.2rem", letterSpacing: "-0.04em", margin: "0 0 10px" }}>Start Case Intake</h1>
          <p className="muted" style={{ fontSize: "0.95rem", marginBottom: "30px", lineHeight: 1.4 }}>
            Capture initial custody details. This initializes a new, empty nested inventory manifest where you can link photos and observations.
          </p>

          <form action={handleCreateCase} style={{ display: "grid", gap: "24px" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="outerItemDescription" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                Outer Custody Description <span style={{ color: "var(--green)" }}>*</span>
              </label>
              <input
                id="outerItemDescription"
                name="outerItemDescription"
                type="text"
                placeholder="e.g. Leather wheeled suitcase, Blue Canvas Backpack"
                required
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem"
                }}
              />
              <small className="muted" style={{ fontSize: "0.78rem" }}>
                Describe the outer-most property item containing nested contents.
              </small>
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="location" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                Found Location <span style={{ color: "var(--green)" }}>*</span>
              </label>
              <select
                id="location"
                name="location"
                required
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem"
                }}
              >
                <option value="">Select location...</option>
                {LOCATION_PRESETS.map((loc) => (
                  <option key={loc.value} value={loc.value}>{loc.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="foundBy" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                Found / Handed In By
              </label>
              <input
                id="foundBy"
                name="foundBy"
                type="text"
                placeholder="e.g. Officer Tan, Passenger (self-report), Cleaner"
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem"
                }}
              />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="foundTime" style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                Custody Handover / Found Time <span style={{ color: "var(--green)" }}>*</span>
              </label>
              <input
                id="foundTime"
                name="foundTime"
                type="datetime-local"
                defaultValue={currentIsoString}
                required
                style={{
                  minHeight: "44px",
                  paddingInline: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem"
                }}
              />
            </div>

            <div style={{ display: "grid", gap: "6px" }}>
              <label htmlFor="notes" style={{ fontWeight: 600, fontSize: "0.88rem" }}>Optional Handover Notes</label>
              <textarea
                id="notes"
                name="notes"
                placeholder="e.g. Handed in by passenger. Checked for immediate hazardous materials."
                rows={3}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "var(--paper)",
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
              <button className="button" type="submit" style={{ flex: 2 }}>
                Initialize Case File
              </button>
              <Link href="/cases" className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>

      <footer className="shell footer" style={{ borderTop: "1px solid var(--line)", paddingBlock: "24px" }}>
        <span>FoundFlow Intake Control Form</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
