import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { handleCreateCase } from "@/app/cases/actions";
import { INTAKE_ACKNOWLEDGEMENT_COOKIE } from "@/lib/intake";
import { LOCATION_PRESETS } from "@/lib/constants";

const fieldStyle = {
  minHeight: "44px",
  paddingInline: "12px",
  borderRadius: "8px",
  border: "1px solid var(--line)",
  background: "var(--paper)",
  fontSize: "0.95rem",
};

export default async function NewCaseIntakePage() {
  if (!(await isAuthenticated())) redirect("/login");
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  if (cookieStore.get(INTAKE_ACKNOWLEDGEMENT_COOKIE)?.value !== currentUser?.username) {
    redirect("/cases/new");
  }

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
            New Case · <strong>{currentUser?.username}</strong>
          </p>
        </div>
        <Link className="button button-secondary" href="/cases/new" style={{ minHeight: "40px" }}>
          Back
        </Link>
      </header>

      <section style={{
        width: "min(580px, calc(100% - 40px))",
        margin: "40px auto",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "32px",
      }}>
        <p className="eyebrow">New Case</p>
        <h1 style={{ fontSize: "2rem", letterSpacing: "-0.04em", margin: "0 0 26px" }}>Item details</h1>

        <form action={handleCreateCase} style={{ display: "grid", gap: "20px" }}>
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            <span>Outer item <span style={{ color: "var(--green)" }}>*</span></span>
            <input
              name="outerItemDescription"
              type="text"
              placeholder="e.g. Blue canvas backpack"
              required
              style={fieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            <span>Found location <span style={{ color: "var(--green)" }}>*</span></span>
            <select name="location" required style={fieldStyle} defaultValue="">
              <option value="" disabled>Select location...</option>
              {LOCATION_PRESETS.map((location) => (
                <option key={location.value} value={location.value}>{location.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            Found or handed in by
            <input name="foundBy" type="text" placeholder="e.g. Passenger, cleaner, staff" style={fieldStyle} />
          </label>

          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            <span>Found or handover time <span style={{ color: "var(--green)" }}>*</span></span>
            <input name="foundTime" type="datetime-local" defaultValue={currentIsoString} required style={fieldStyle} />
          </label>

          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            Notes
            <textarea
              name="notes"
              placeholder="Optional handover details"
              rows={3}
              style={{ ...fieldStyle, padding: "12px", fontFamily: "inherit", resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
            <button className="button" type="submit" style={{ flex: 2 }}>Create Case</button>
            <Link href="/cases" className="button button-secondary" style={{ flex: 1, minHeight: "46px" }}>Cancel</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
