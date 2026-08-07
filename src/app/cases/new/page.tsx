import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
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
    <main className="page-stage">
      <AppHeader />
      <section id="main-content" className="page-content page-content-narrow">
        <div className="workflow-head">
          <div>
            <p className="eyebrow">New Case · {currentUser?.username}</p>
            <h1>Step-by-step instructions</h1>
            <p>Follow the evidence order so the linked item hierarchy remains clear.</p>
          </div>
          <Link className="button button-secondary" href="/cases">Cancel</Link>
        </div>

        <section className="work-surface">
          <p className="eyebrow">Before you start</p>
          <ol className="instruction-list">
            {instructions.map((instruction, index) => (
              <li key={instruction}>
                <span aria-hidden="true">{index + 1}</span>
                <p>{instruction}</p>
              </li>
            ))}
          </ol>

          <form action={handleAcknowledgeIntakeInstructions} className="acknowledgement-form">
            <label className="acknowledgement-row">
              <input type="checkbox" name="acknowledged" value="yes" required />
              <span>I understand and will follow these instructions.</span>
            </label>
            <button type="submit" className="button">Acknowledge &amp; Continue</button>
          </form>
        </section>
      </section>
    </main>
  );
}
