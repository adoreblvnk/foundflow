import Link from "next/link";
import { redirect } from "next/navigation";
import { getCases, type Case } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

type CaseGroup = {
  key: "pending" | "ready" | "confirmed" | "collected" | "archived";
  title: string;
  cases: Case[];
};

function caseStage(caseFile: Case): CaseGroup["key"] {
  if (caseFile.archivedAt) return "archived";
  if (caseFile.claims?.some((claim) => claim.collectedAt)) return "collected";
  if (caseFile.status === "finalised") return "confirmed";
  const unresolved = caseFile.manifest.some((item) => item.status === "review");
  if (caseFile.uploads.length > 0 && caseFile.manifest.length > 0 && !unresolved) return "ready";
  return "pending";
}

function CaseCard({ caseFile, stage }: { caseFile: Case; stage: CaseGroup["key"] }) {
  const unresolved = caseFile.manifest.filter((item) => item.status === "review").length;
  const totalItems = caseFile.manifest.length;
  const confirmedItems = caseFile.manifest.filter((item) => item.status === "confirmed").length;
  const stageLabel = {
    pending: unresolved > 0 ? `${unresolved} to review` : caseFile.uploads.length ? "Scan required" : "Photos required",
    ready: "Ready to complete",
    confirmed: "Confirmed",
    collected: "Collected",
    archived: "Archived",
  }[stage];

  return (
    <Link
      href={`/cases/${caseFile.id}`}
      style={{ display: "grid", gap: "8px", padding: "14px 16px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--panel)", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
        <strong style={{ fontSize: "0.82rem", minWidth: 0, overflowWrap: "anywhere" }}>{caseFile.id}</strong>
        <span className={caseFile.status === "finalised" ? "status status-complete" : "status"} style={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}>
          {stageLabel}
        </span>
      </div>

      <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{caseFile.outerItemDescription}</h3>
      <div className="muted" style={{ fontSize: "0.78rem" }}>📍 {caseFile.location}</div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--muted)" }}>
        <span>📷 {caseFile.uploads.length}</span>
        <span>📦 {totalItems}</span>
        <span>✅ {confirmedItems}/{totalItems}</span>
        {unresolved > 0 && <span style={{ color: "var(--amber)", fontWeight: 700 }}>⚠️ {unresolved}</span>}
      </div>

      {totalItems > 0 && (
        <div style={{ height: "3px", background: "var(--line)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.round((confirmedItems / totalItems) * 100)}%`, background: "var(--green)", borderRadius: "2px" }} />
        </div>
      )}
    </Link>
  );
}

export default async function CasesPage() {
  if (!(await isAuthenticated())) redirect("/login");
  const cases = await getCases();
  const groups: CaseGroup[] = [
    { key: "pending", title: "Pending Review", cases: [] },
    { key: "ready", title: "Ready to Complete", cases: [] },
    { key: "confirmed", title: "Confirmed Cases", cases: [] },
    { key: "collected", title: "Collected", cases: [] },
    { key: "archived", title: "Archived", cases: [] },
  ];
  for (const caseFile of cases) groups.find((group) => group.key === caseStage(caseFile))!.cases.push(caseFile);

  return (
    <main className="demo-page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header className="shell nav" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link className="brand" href="/">FoundFlow</Link>
        <Link className="button" href="/cases/new" style={{ minHeight: "40px" }}>+ New Case</Link>
      </header>

      <section className="shell" style={{ paddingBlock: "32px 40px", display: "grid", gap: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>Cases</h1>
          <span className="muted" style={{ fontSize: "0.85rem" }}>{cases.length} case{cases.length !== 1 ? "s" : ""}</span>
        </div>

        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`case-group-${group.key}`} style={{ display: "grid", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
              <h2 id={`case-group-${group.key}`} style={{ fontSize: "1.05rem", margin: 0 }}>{group.title}</h2>
              <span className="muted" style={{ fontSize: "0.78rem" }}>{group.cases.length}</span>
            </div>
            {group.cases.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>No cases.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: "16px" }}>
                {group.cases.map((caseFile) => <CaseCard key={caseFile.id} caseFile={caseFile} stage={group.key} />)}
              </div>
            )}
          </section>
        ))}
      </section>

      <footer className="shell footer" style={{ borderTop: "1px solid var(--line)", paddingBlock: "20px", marginTop: "auto" }}>
        <span>FoundFlow Intake Copilot</span>
        <span>AI drafts. Staff decide.</span>
      </footer>
    </main>
  );
}
