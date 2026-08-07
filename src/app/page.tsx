import Link from "next/link";
import AppHeader, { FoundFlowBrand } from "@/components/AppHeader";

const operations = [
  { href: "/cases/new", mark: "+", label: "Log Found Item", description: "Create a case and record where the item was found" },
  { href: "/cases", mark: "C", label: "Manage Cases", description: "Upload evidence, review linked inventory and complete cases" },
  { href: "/search", mark: "S", label: "Search Records", description: "Find records and begin a verified claimant handover" },
];

export default function Home() {
  return (
    <main className="portal-page home-portal">
      <AppHeader />
      <div id="main-content" className="portal-home">
        <section className="portal-intro" aria-labelledby="portal-title">
          <FoundFlowBrand />
          <h1 id="portal-title" className="portal-title">Lost and Found</h1>
          <p className="portal-copy">
            Capture found items, link every listed object to photo evidence and keep staff in control from intake through collection.
          </p>
          <p className="portal-version">Independent Launchpad 2026 prototype · Team Adore</p>
        </section>

        <section className="portal-panel" aria-labelledby="operations-heading">
          <div className="portal-panel-heading">
            <h2 id="operations-heading">Staff Portal</h2>
            <p>Select a task to continue.</p>
          </div>
          <div className="operation-list">
            {operations.map((operation) => (
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
