import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { handleCreateCase } from "@/app/cases/actions";
import { INTAKE_ACKNOWLEDGEMENT_COOKIE } from "@/lib/intake";
import { TERMINALS, AREAS } from "@/lib/constants";

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
        <p className="eyebrow">Step 1</p>
        <h1 style={{ fontSize: "2rem", letterSpacing: "-0.04em", margin: "0 0 26px" }}>Where and when found</h1>

        <form action={handleCreateCase} style={{ display: "grid", gap: "20px" }}>
          {/* Terminal */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            <span>Terminal <span style={{ color: "var(--green)" }}>*</span></span>
            <select name="terminal" required style={fieldStyle} defaultValue="">
              <option value="" disabled>Select terminal...</option>
              {TERMINALS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          {/* Area */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            <span>Area <span style={{ color: "var(--green)" }}>*</span></span>
            <select name="area" required style={fieldStyle} defaultValue="">
              <option value="" disabled>Select area...</option>
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </label>

          {/* Specific location */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            Specific location
            <input
              name="specificLocation"
              type="text"
              placeholder="e.g. Beside Gate B5 charging station"
              style={fieldStyle}
            />
          </label>

          {/* Found date/time */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            <span>Found date and time <span style={{ color: "var(--green)" }}>*</span></span>
            <input name="foundTime" type="datetime-local" defaultValue={currentIsoString} required style={fieldStyle} />
          </label>

          {/* Outer item */}
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

          {/* Found / handed in by */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            Found or handed in by
            <input name="foundBy" type="text" placeholder="e.g. Passenger, cleaner, staff" style={fieldStyle} />
          </label>

          {/* Storage location */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            Current storage location
            <input name="storageLocation" type="text" placeholder="e.g. L&F Cabinet A3" style={fieldStyle} />
          </label>

          {/* Staff notes */}
          <label style={{ display: "grid", gap: "6px", fontWeight: 600, fontSize: "0.88rem" }}>
            Staff notes
            <textarea
              name="notes"
              placeholder="Optional internal notes"
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
