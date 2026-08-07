import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCases, type Case } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import CaseActions from "./CaseActions";

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
    <article className="case-card">
      <Link href={`/cases/${caseFile.id}`} className="case-card-link">
        <div className="case-card-topline">
          <strong>{caseFile.id}</strong>
          <span className={`status status-${stage}`}>{stageLabel}</span>
        </div>
        <h3>{caseFile.outerItemDescription}</h3>
        <p className="case-location">{caseFile.location}</p>
        <div className="case-metrics" aria-label={`${caseFile.uploads.length} photos, ${totalItems} items, ${confirmedItems} confirmed`}>
          <span>{caseFile.uploads.length} photos</span>
          <span>{totalItems} items</span>
          <span>{confirmedItems}/{totalItems} confirmed</span>
          {unresolved > 0 && <span className="case-warning">{unresolved} need review</span>}
        </div>
        {totalItems > 0 && (
          <div className="case-progress" aria-hidden="true">
            <span style={{ width: `${Math.round((confirmedItems / totalItems) * 100)}%` }} />
          </div>
        )}
      </Link>
      <CaseActions caseId={caseFile.id} archived={stage === "archived"} canDelete={caseFile.status !== "finalised"} />
    </article>
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
    <main className="page-stage">
      <AppHeader />
      <section id="main-content" className="page-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Case Management</p>
            <h1>Cases</h1>
            <p>Continue intake, review evidence and manage completed handovers.</p>
          </div>
          <Link className="button" href="/cases/new">New Case</Link>
        </div>

        <div className="case-groups">
          {groups.map((group) => (
            <section key={group.key} className="case-group" aria-labelledby={`case-group-${group.key}`}>
              <div className="case-group-heading">
                <h2 id={`case-group-${group.key}`}>{group.title}</h2>
                <span>{group.cases.length}</span>
              </div>
              {group.cases.length === 0 ? (
                <p className="case-empty">No cases in this stage.</p>
              ) : (
                <div className="case-grid">
                  {group.cases.map((caseFile) => <CaseCard key={caseFile.id} caseFile={caseFile} stage={group.key} />)}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
