"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import type { Case, ClaimPath, ClaimRecord } from "@/lib/db";
import { caseContainsIdentityEvidence, evaluateClaimVerification } from "@/lib/claim-policy";
import { handleCreateClaim, handleDecideClaim } from "./actions";

const verificationOptions = [
  { id: "lost-report-match", label: "Lost report details match", detail: "Dates, location and description align with the found record." },
  { id: "identity-match", label: "Identity-bearing item matches claimant", detail: "Staff visually matched the claimant; no document copy retained." },
  { id: "singpass-or-government-id", label: "Singpass or government ID checked", detail: "Record only a masked identifier where required." },
  { id: "undisclosed-contents", label: "Undisclosed contents described", detail: "Claimant named contents not shown in public search results." },
  { id: "distinctive-features", label: "Distinctive features described", detail: "Marks, damage or modifications matched the item." },
  { id: "receipt-or-serial", label: "Receipt or serial number matched", detail: "Ownership record matched without storing a full copy." },
  { id: "device-unlock", label: "Device unlock demonstrated", detail: "Claimant unlocked the device in front of staff." },
] as const;

type VerificationMethod = typeof verificationOptions[number]["id"];

const fieldStyle = { width: "100%", minHeight: "44px", border: "1px solid var(--line)", borderRadius: "8px", padding: "10px 12px", background: "var(--panel)", color: "var(--ink)", font: "inherit" } as const;

function statusLabel(claim: ClaimRecord): string {
  if (claim.decision === "approved") return "Collected";
  if (claim.decision === "rejected") return "Rejected";
  if (claim.decision === "escalated") return "Escalated";
  return "Verification pending";
}

export default function ClaimWorkflow({ initialCase, currentUser }: { initialCase: Case; currentUser: { username: string } }) {
  const [claims, setClaims] = useState<ClaimRecord[]>(initialCase.claims || []);
  const [path, setPath] = useState<ClaimPath>("walk-in");
  const [lostReportId, setLostReportId] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [claimantContact, setClaimantContact] = useState("");
  const [maskedIdentifier, setMaskedIdentifier] = useState("");
  const [methods, setMethods] = useState<VerificationMethod[]>([]);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [acknowledgement, setAcknowledgement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeClaim = claims.find((claim) => claim.decision === "pending" || claim.decision === "approved");
  const latestClaim = activeClaim || claims[0];
  const hasIdentityEvidence = useMemo(() => caseContainsIdentityEvidence(initialCase), [initialCase]);
  const verificationPolicy = useMemo(() => evaluateClaimVerification({
    path,
    methods,
    identityEvidenceInProperty: hasIdentityEvidence,
  }), [hasIdentityEvidence, methods, path]);

  function toggleMethod(method: VerificationMethod) {
    setMethods((current) => current.includes(method) ? current.filter((entry) => entry !== method) : [...current, method]);
  }

  async function createClaim(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await handleCreateClaim({
      caseId: initialCase.id,
      path,
      lostReportId: path === "lost-report" ? lostReportId : null,
      claimantName,
      claimantContact,
      maskedIdentifier: maskedIdentifier || null,
      verificationMethods: methods,
      verificationNotes,
    });
    if (result.error) setError(result.error);
    else if (result.claim) {
      setClaims((current) => [result.claim!, ...current]);
      setSuccess(`Claim ${result.claim.id} created. Staff decision is required before handover.`);
    }
    setBusy(false);
  }

  async function decide(decision: "approved" | "rejected" | "escalated") {
    if (!latestClaim) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await handleDecideClaim({
      caseId: initialCase.id,
      claimId: latestClaim.id,
      decision,
      decisionReason,
      acknowledgement,
    });
    if (result.error) setError(result.error);
    else if (result.claim) {
      setClaims((current) => current.map((claim) => claim.id === result.claim!.id ? result.claim! : claim));
      setSuccess(decision === "approved" ? "Collection recorded and item handed over." : `Claim ${decision}.`);
    }
    setBusy(false);
  }

  return (
    <main className="page-stage">
      <AppHeader />
      <header className="page-heading shell case-detail-heading">
        <div>
          <p className="eyebrow">Collection Claim · Case {initialCase.id}</p>
          <h1>Verify Ownership &amp; Handover</h1>
          <p>Staff: <strong>{currentUser.username}</strong></p>
        </div>
        <Link className="button button-secondary" href={`/cases/${initialCase.id}`} style={{ minHeight: "40px" }}>Back to item</Link>
      </header>

      <div id="main-content" className="claim-shell">
        <section className="claim-summary">
          <p className="eyebrow">Item ready for collection</p>
          <h2>{initialCase.outerItemDescription}</h2>
          <dl>
            <div><dt>Found at</dt><dd>{initialCase.location}</dd></div>
            <div><dt>Found time</dt><dd>{new Date(initialCase.foundTime).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}</dd></div>
            <div><dt>Confirmed records</dt><dd>{initialCase.manifest.length}</dd></div>
          </dl>
          {hasIdentityEvidence && (
            <div className="claim-guidance">
              <strong>Identity evidence is recorded inside this item.</strong>
              <span>Use it as one ownership check. Record only a masked identifier and do not retain a document photo.</span>
            </div>
          )}
          <div className="claim-rule">
            <strong>Release rule</strong>
            <span>Every handover needs a claim record, at least two ownership checks, a staff decision and claimant acknowledgement.</span>
          </div>
        </section>

        <section className="claim-panel">
          {initialCase.status !== "finalised" ? (
            <div className="claim-empty"><h2>Complete intake first</h2><p>The item list must be confirmed before collection claims can begin.</p></div>
          ) : !activeClaim ? (
            <form onSubmit={createClaim} className="claim-form">
              <div>
                <p className="eyebrow">1 · Start claim</p>
                <h2>How did the claimant arrive?</h2>
                <div className="claim-paths" role="radiogroup" aria-label="Claim path">
                  <button type="button" role="radio" aria-checked={path === "lost-report"} className={path === "lost-report" ? "claim-path selected" : "claim-path"} onClick={() => setPath("lost-report")}>
                    <strong>Existing lost report</strong><span>Record the passenger-submitted report ID and compare its details.</span>
                  </button>
                  <button type="button" role="radio" aria-checked={path === "walk-in"} className={path === "walk-in" ? "claim-path selected" : "claim-path"} onClick={() => setPath("walk-in")}>
                    <strong>No lost report</strong><span>Create a staff-initiated walk-in claim.</span>
                  </button>
                </div>
              </div>

              {path === "lost-report" && <label>Lost Report ID recorded<input style={fieldStyle} value={lostReportId} onChange={(event) => setLostReportId(event.target.value)} required placeholder="LR-2026-000123" /></label>}
              <div className="claim-fields">
                <label>Claimant name<input style={fieldStyle} value={claimantName} onChange={(event) => setClaimantName(event.target.value)} required /></label>
                <label>Contact details<input style={fieldStyle} value={claimantContact} onChange={(event) => setClaimantContact(event.target.value)} required placeholder="Phone or email" /></label>
              </div>
              <label>Masked identifier <span className="optional">Optional</span><input style={fieldStyle} value={maskedIdentifier} onChange={(event) => setMaskedIdentifier(event.target.value)} placeholder="Example: ****123A — never enter the full ID" /></label>

              <div>
                <p className="eyebrow">2 · Verify ownership</p>
                <h2>Record the checks performed</h2>
                <p className="muted">Use at least two independent evidence groups. Keep undisclosed details in the staff-only note.</p>
                <div className="verification-list">
                  {verificationOptions.filter((option) => path === "lost-report" || option.id !== "lost-report-match").map((option) => (
                    <label key={option.id} className={methods.includes(option.id) ? "verification-option selected" : "verification-option"}>
                      <input type="checkbox" checked={methods.includes(option.id)} onChange={() => toggleMethod(option.id)} />
                      <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                    </label>
                  ))}
                </div>
              </div>
              <label>Staff-only verification note<textarea style={{ ...fieldStyle, minHeight: "92px", resize: "vertical" }} value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} required placeholder="Record what matched without copying full identity-document details." /></label>

              {methods.length > 0 && !verificationPolicy.allowed && <div className="claim-message error">{verificationPolicy.message}</div>}

              {error && <div className="claim-message error" role="alert">{error}</div>}
              {success && <div className="claim-message success">{success}</div>}
              <button className="button" disabled={busy || !verificationPolicy.allowed}>{busy ? "Creating claim..." : "Create claim record"}</button>
            </form>
          ) : (
            <div className="claim-form">
              <div className="claim-status-row">
                <div><p className="eyebrow">Claim {latestClaim.id}</p><h2>{statusLabel(latestClaim)}</h2></div>
                <span className={latestClaim.decision === "approved" ? "status status-complete" : "status"}>{latestClaim.path === "lost-report" ? "Lost Report ID recorded" : "Walk-in claim"}</span>
              </div>

              <div className="claim-record">
                <div><span>Claimant</span><strong>{latestClaim.claimantName}</strong></div>
                <div><span>Contact</span><strong>{latestClaim.claimantContact}</strong></div>
                {latestClaim.lostReportId && <div><span>Lost Report ID</span><strong>{latestClaim.lostReportId}</strong></div>}
                {latestClaim.maskedIdentifier && <div><span>Masked identifier</span><strong>{latestClaim.maskedIdentifier}</strong></div>}
              </div>

              <div>
                <h3>Ownership checks</h3>
                <ul className="claim-checks">
                  {latestClaim.verificationMethods.map((method) => <li key={method}>{verificationOptions.find((option) => option.id === method)?.label || method}</li>)}
                </ul>
                <div className="claim-guidance"><strong>Staff-only note</strong><span>{latestClaim.verificationNotes}</span></div>
              </div>

              {latestClaim.decision === "pending" ? (
                <>
                  <div>
                    <p className="eyebrow">3 · Staff decision and handover</p>
                    <h2>Decide this claim</h2>
                  </div>
                  <label>Decision reason<textarea style={{ ...fieldStyle, minHeight: "82px", resize: "vertical" }} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} required placeholder="Explain why the checks are sufficient, insufficient or require escalation." /></label>
                  <label className="acknowledgement"><input type="checkbox" checked={acknowledgement} onChange={(event) => setAcknowledgement(event.target.checked)} /><span><strong>Staff attests claimant acknowledgement</strong><small>I confirm the claimant acknowledged receipt of this item. Required for approval and handover.</small></span></label>
                  {error && <div className="claim-message error" role="alert">{error}</div>}
                  {success && <div className="claim-message success">{success}</div>}
                  <div className="decision-actions">
                    <button type="button" className="button" disabled={busy || !acknowledgement || decisionReason.trim().length < 3} onClick={() => void decide("approved")}>Approve and record handover</button>
                    <button type="button" className="button button-secondary" disabled={busy || decisionReason.trim().length < 3} onClick={() => void decide("escalated")}>Escalate</button>
                    <button type="button" className="button danger-button" disabled={busy || decisionReason.trim().length < 3} onClick={() => void decide("rejected")}>Reject</button>
                  </div>
                </>
              ) : (
                <div className={latestClaim.decision === "approved" ? "handover-complete" : "claim-message error"}>
                  <strong>{latestClaim.decision === "approved" ? "Handover complete" : statusLabel(latestClaim)}</strong>
                  <span>{latestClaim.decisionReason}</span>
                  {latestClaim.collectedAt && <small>Collected {new Date(latestClaim.collectedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} · Staff: {latestClaim.decidedBy}</small>}
                </div>
              )}
            </div>
          )}

          {!activeClaim && claims.length > 0 && (
            <div className="claim-history">
              <h3>Previous claims</h3>
              {claims.map((claim) => <div key={claim.id}><strong>{claim.id}</strong><span>{statusLabel(claim)} · {claim.claimantName}</span></div>)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
