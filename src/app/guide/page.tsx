import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const steps = [
  {
    number: "01",
    title: "Create the case",
    body: "Acknowledge the intake order, then record where and when the item was found, who handed it in, its outer description, and its storage location.",
  },
  {
    number: "02",
    title: "Photograph one level at a time",
    body: "Start with the outer item. Open one container at a time and photograph that level before moving its contents. Add close-ups only when text or identifiers are unclear.",
  },
  {
    number: "03",
    title: "Scan all uploaded photos",
    body: "One scan reads the complete photo set and proposes a nested item list. The progress indicator reports each completed scan stage. AI output remains provisional.",
  },
  {
    number: "04",
    title: "Review the linked inventory",
    body: "Check every listed object, quantity, container relationship, currency group, source photo, and photo box. Correct missing, duplicate, shifted, or uncertain records.",
  },
  {
    number: "05",
    title: "Confirm and complete",
    body: "Confirm each review item only after inspecting the physical item and its source photo. Complete the case when no reviews remain.",
  },
  {
    number: "06",
    title: "Verify ownership and collect",
    body: "Search confirmed records, create a claim, record at least two independent ownership checks, make one staff decision, and record the handover.",
  },
];

const photoOrder = [
  "Outer item in full",
  "First opened container level",
  "Each deeper pouch, pocket, or compartment",
  "Loose items arranged without hiding one another",
  "Close-ups of unreadable text, currency, or identifiers",
];

const reviewChecks = [
  "Every visible object has a record, including containers and holders.",
  "Grouped quantity agrees with the number of visible instances.",
  "Every record links to the correct source photo or is explicitly staff-added.",
  "Parent and child relationships match the physical nesting.",
  "Currency, denomination and count are never guessed when unreadable.",
  "Every photo box tightly covers only its intended object.",
];

export default function GuidePage() {
  return (
    <main className="page-stage">
      <AppHeader />

      <section id="main-content" className="page-content" style={{ maxWidth: "1000px", display: "grid", gap: "40px" }}>
        <header style={{ maxWidth: "720px" }}>
          <p className="eyebrow">Staff guide</p>
          <h1 style={{ fontSize: "2.35rem", letterSpacing: "-0.025em", lineHeight: 1.12, margin: "0 0 18px" }}>
            From found item to verified handover
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.65, margin: 0 }}>
            FoundFlow drafts a photo-linked item list. Staff remain responsible for checking every object, correcting uncertainty, completing the record, and approving collection.
          </p>
        </header>

        <nav aria-label="Guide actions" style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Link className="button" href="/cases/new">Start New Case</Link>
          <Link className="button button-secondary" href="/cases">Open Cases</Link>
          <Link className="button button-secondary" href="/search">Search Items</Link>
        </nav>

        <section aria-labelledby="workflow-title">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "18px" }}>
            <h2 id="workflow-title" style={{ fontSize: "1.35rem", margin: 0 }}>Complete workflow</h2>
            <span className="muted" style={{ fontSize: "0.78rem" }}>6 stages</span>
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "12px" }}>
            {steps.map((step) => (
              <li key={step.number} style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "18px", background: "var(--panel)", display: "grid", gap: "10px" }}>
                <span style={{ color: "var(--green)", fontFamily: "var(--font-geist-mono)", fontSize: "0.75rem", fontWeight: 700 }}>{step.number}</span>
                <h3 style={{ fontSize: "1rem", margin: 0 }}>{step.title}</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.84rem", lineHeight: 1.55, margin: 0 }}>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "20px" }}>
          <section aria-labelledby="photo-order-title" style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "22px", background: "var(--panel)" }}>
            <p className="eyebrow">Capture order</p>
            <h2 id="photo-order-title" style={{ fontSize: "1.25rem", margin: "0 0 14px" }}>Photograph the structure</h2>
            <ol style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "10px", color: "var(--muted)", fontSize: "0.86rem", lineHeight: 1.5 }}>
              {photoOrder.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>

          <section aria-labelledby="review-title" style={{ border: "1px solid var(--line)", borderRadius: "12px", padding: "22px", background: "var(--panel)" }}>
            <p className="eyebrow">Before confirmation</p>
            <h2 id="review-title" style={{ fontSize: "1.25rem", margin: "0 0 14px" }}>Review every link</h2>
            <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "10px", color: "var(--muted)", fontSize: "0.86rem", lineHeight: 1.5 }}>
              {reviewChecks.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>

        <section aria-labelledby="scan-title" className="work-surface" style={{ maxWidth: "760px", padding: "20px 22px" }}>
          <h2 id="scan-title" style={{ fontSize: "1.15rem", margin: "0 0 8px" }}>What the scan does</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.6, margin: 0 }}>
            The scan evaluates all uploaded photos as one case so it can propose cross-photo nesting and reduce duplicate records. Independent extraction and verification stages may run concurrently for speed. The progress bar reports completed server stages, not an estimated timer. A successful scan is still a draft until staff review.
          </p>
        </section>

        <section aria-labelledby="demo-title" style={{ borderTop: "1px solid var(--line)", paddingTop: "24px", display: "grid", gap: "10px", maxWidth: "760px" }}>
          <p className="eyebrow">Team demonstration</p>
          <h2 id="demo-title" style={{ fontSize: "1.15rem", margin: 0 }}>Automated walkthrough</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.86rem", lineHeight: 1.55, margin: 0 }}>
            The repository includes a deterministic browser walkthrough that fills the intake, review, completion and collection workflow with synthetic data. Run <code>npm run demo:automated</code> locally; it does not require a live AI provider.
          </p>
        </section>
      </section>
    </main>
  );
}
