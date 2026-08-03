import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { handleAcknowledgeIntakeInstructions } from "@/app/cases/actions";

const instructions = [
  "Photograph the outer item first.",
  "Open one container at a time and photograph each level before moving its contents.",
  "Show the numbered and worded side of every coin; do not guess unreadable details.",
  "Check every listed item and photo box before completing the case.",
];

export default async function NewCaseInstructionsPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const currentUser = await getCurrentUser();

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="shell nav" style={{ borderBottom: "1px solid var(--line)" }}>
        <div>
          <Link className="brand" href="/">FoundFlow</Link>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
            New Case · <strong>{currentUser?.username}</strong>
          </p>
        </div>
        <Link className="button button-secondary" href="/cases" style={{ minHeight: "40px" }}>
          Cancel
        </Link>
      </header>

      <section style={{
        width: "min(600px, calc(100% - 40px))",
        margin: "48px auto",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "32px",
      }}>
        <p className="eyebrow">Before you start</p>
        <h1 style={{ fontSize: "2rem", letterSpacing: "-0.04em", margin: "0 0 24px" }}>
          Intake order
        </h1>

        <ol style={{ margin: "0 0 28px", paddingLeft: "22px", display: "grid", gap: "14px", lineHeight: 1.45 }}>
          {instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
        </ol>

        <form action={handleAcknowledgeIntakeInstructions} style={{ display: "grid", gap: "16px" }}>
          <label style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            padding: "14px",
            border: "1px solid var(--line)",
            borderRadius: "9px",
            background: "var(--paper)",
            fontSize: "0.88rem",
            fontWeight: 600,
            lineHeight: 1.4,
          }}>
            <input type="checkbox" name="acknowledged" value="yes" required style={{ marginTop: "2px" }} />
            I understand and will follow this intake order.
          </label>
          <button type="submit" className="button" style={{ minHeight: "46px" }}>
            Acknowledge & Continue
          </button>
        </form>
      </section>
    </main>
  );
}
