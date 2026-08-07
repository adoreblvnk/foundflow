import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { handleCreateCase } from "@/app/cases/actions";
import { INTAKE_ACKNOWLEDGEMENT_COOKIE } from "@/lib/intake";
import { TERMINALS, AREAS } from "@/lib/constants";

export default async function NewCaseIntakePage() {
  if (!(await isAuthenticated())) redirect("/login");
  const currentUser = await getCurrentUser();
  const cookieStore = await cookies();
  if (cookieStore.get(INTAKE_ACKNOWLEDGEMENT_COOKIE)?.value !== currentUser?.username) redirect("/cases/new");

  const currentIsoString = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date()).replace(" ", "T");

  return (
    <main className="page-stage">
      <AppHeader />
      <section id="main-content" className="workflow-shell work-surface">
        <div className="workflow-head">
          <div>
            <p className="eyebrow">Step 1 of 5 · Case Intake</p>
            <h1>Where and when found</h1>
            <p>Record the outer item before adding photo evidence.</p>
          </div>
          <Link className="button button-secondary" href="/cases/new">Back</Link>
        </div>

        <form action={handleCreateCase} className="intake-form">
          <label>
            <span>Terminal <b aria-label="required">*</b></span>
            <select name="terminal" required defaultValue="" autoComplete="off">
              <option value="" disabled>Select terminal…</option>
              {TERMINALS.map((terminal) => <option key={terminal.value} value={terminal.value}>{terminal.label}</option>)}
            </select>
          </label>
          <label>
            <span>Area <b aria-label="required">*</b></span>
            <select name="area" required defaultValue="" autoComplete="off">
              <option value="" disabled>Select area…</option>
              {AREAS.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}
            </select>
          </label>
          <label className="full-row">
            Specific location
            <input name="specificLocation" type="text" placeholder="Example: beside the Gate B5 charging station…" autoComplete="off" />
          </label>
          <label>
            <span>Found date and time <b aria-label="required">*</b></span>
            <input name="foundTime" type="datetime-local" defaultValue={currentIsoString} required autoComplete="off" />
          </label>
          <label>
            <span>Outer item <b aria-label="required">*</b></span>
            <input name="outerItemDescription" type="text" placeholder="Example: blue canvas backpack…" required autoComplete="off" />
          </label>
          <label>
            Found or handed in by
            <input name="foundBy" type="text" placeholder="Example: passenger, cleaner or staff…" autoComplete="off" />
          </label>
          <label>
            Current storage location
            <input name="storageLocation" type="text" placeholder="Example: Lost & Found cabinet A3…" autoComplete="off" />
          </label>
          <label className="full-row">
            Staff notes
            <textarea name="notes" placeholder="Add optional internal notes…" rows={4} autoComplete="off" />
          </label>
          <div className="workflow-actions full-row">
            <button className="button" type="submit">Create Case</button>
            <Link href="/cases" className="button button-secondary">Cancel</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
