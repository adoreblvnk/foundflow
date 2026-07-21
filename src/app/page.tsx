import Link from "next/link";

const steps = [
  ["Capture", "Photograph the outer property and each container level."],
  ["Structure", "Turn images and spoken notes into a nested inventory draft."],
  ["Verify", "Review uncertain details and link every item to evidence."],
  ["Export", "Send an approved manifest to the organisation's existing system."],
];

export default function Home() {
  return (
    <main>
      <nav className="shell nav">
        <Link className="brand" href="/">FoundFlow</Link>
        <Link className="button button-secondary" href="/cases">Open Case Dashboard</Link>
      </nav>

      <section className="shell hero">
        <div>
          <p className="eyebrow">AI intake copilot for found-property teams</p>
          <h1>Turn a complex found bag into a verified inventory.</h1>
          <p className="lede">
            FoundFlow helps frontline staff capture, structure and review nested property
            without surrendering human control.
          </p>
          <div className="actions">
            <Link className="button" href="/cases">Try the complex-bag workflow</Link>
            <a className="text-link" href="#workflow">See how it works</a>
          </div>
        </div>

        <div className="manifest-card" aria-label="Example nested inventory">
          <div className="card-heading">
            <span>Case FF-0241</span>
            <span className="status">Reviewing</span>
          </div>
          <div className="tree">
            <strong>Black backpack</strong>
            <div><strong>Brown coin pouch</strong></div>
            <div className="nested">Singapore currency <span className="verified">Confirmed</span></div>
            <div className="nested">Malaysian currency <span className="warning">Review</span></div>
            <div>USB-C cable <span className="verified">Confirmed</span></div>
            <div>Cardholder <span className="private">Private</span></div>
          </div>
        </div>
      </section>

      <section className="evidence-strip">
        <div className="shell evidence-grid">
          <div><strong>50,000</strong><span>SPF found-property reports in 2024</span></div>
          <div><strong>68.4M</strong><span>Changi passenger movements in FY2024/25</span></div>
          <div><strong>Human-approved</strong><span>No AI draft becomes an official record on its own</span></div>
        </div>
      </section>

      <section className="shell section" id="workflow">
        <p className="eyebrow">Operational workflow</p>
        <h2>Capture → Structure → Verify → Export</h2>
        <div className="steps">
          {steps.map(([title, description], index) => (
            <article className="step" key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="shell footer">
        <span>Built for the Launchpad 2026 AI Challenge.</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
