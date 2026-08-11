import Link from "next/link";
import AppHeader from "@/components/AppHeader";

const secondaryOperations = [
  {
    href: "/cases",
    mark: "C",
    label: "Manage Cases",
    description: "Continue reviews, complete records and prepare handovers",
  },
  {
    href: "/search",
    mark: "S",
    label: "Search Records",
    description: "Find an item and begin a verified claimant handover",
  },
];

const workflow = [
  ["Capture", "Record where the item was found and add clear evidence."],
  ["Review", "Confirm every detected object before completing the record."],
  ["Handover", "Verify the claimant and preserve the collection history."],
];

export default function Home() {
  return (
    <main className="portal-page home-portal">
      <AppHeader />
      <div id="main-content" className="portal-home">
        <section className="portal-intro" aria-labelledby="portal-title">
          <h1 id="portal-title" className="portal-title">
            Lost &amp; found, clearly accounted for.
          </h1>
          <p className="portal-copy">
            Turn photos and staff observations into verified, evidence-linked records from intake through collection.
          </p>

          <ol className="home-flow" aria-label="Found-item workflow">
            {workflow.map(([label, description], index) => (
              <li key={label}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="portal-panel home-task-panel" aria-labelledby="operations-heading">
          <div className="portal-panel-heading">
            <h2 id="operations-heading">Start a task</h2>
            <p>Choose what you need to do next.</p>
          </div>

          <Link href="/cases/new" className="home-primary-action">
            <span className="operation-icon" aria-hidden="true">+</span>
            <span className="operation-copy">
              <strong>Log a Found Item</strong>
              <small>Create a record and capture where the item was found</small>
            </span>
            <span className="operation-arrow" aria-hidden="true">→</span>
          </Link>

          <div className="home-secondary-heading">Or continue with</div>
          <div className="operation-list">
            {secondaryOperations.map((operation) => (
              <Link key={operation.href} href={operation.href} className="operation-link">
                <span className="operation-icon" aria-hidden="true">{operation.mark}</span>
                <span className="operation-copy">
                  <strong>{operation.label}</strong>
                  <small>{operation.description}</small>
                </span>
                <span className="operation-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <footer className="portal-footer">
        <span>FoundFlow · Lost &amp; Found Operations</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
