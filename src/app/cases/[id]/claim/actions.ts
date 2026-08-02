"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClaimRecord, decideClaimRecord, getCaseById } from "@/lib/db";

const verificationMethodSchema = z.enum([
  "lost-report-match",
  "identity-match",
  "singpass-or-government-id",
  "undisclosed-contents",
  "distinctive-features",
  "receipt-or-serial",
  "device-unlock",
]);

const createClaimSchema = z.object({
  caseId: z.string().min(1).max(100),
  path: z.enum(["lost-report", "walk-in"]),
  lostReportId: z.string().trim().max(100).nullable(),
  claimantName: z.string().trim().min(2).max(120),
  claimantContact: z.string().trim().min(3).max(160),
  maskedIdentifier: z.string().trim().regex(/^\*{2,12}[A-Za-z0-9]{1,4}$/, "Use a masked identifier such as ****123A").nullable(),
  verificationMethods: z.array(verificationMethodSchema).min(1).max(7),
  verificationNotes: z.string().trim().min(3).max(1000),
}).superRefine((value, context) => {
  if (value.path === "lost-report" && !value.lostReportId) {
    context.addIssue({ code: "custom", path: ["lostReportId"], message: "Lost Report ID is required for this claim path" });
  }
  if (value.path === "walk-in" && value.lostReportId) {
    context.addIssue({ code: "custom", path: ["lostReportId"], message: "Walk-in claims cannot include a Lost Report ID" });
  }
});

const decideClaimSchema = z.object({
  caseId: z.string().min(1).max(100),
  claimId: z.string().min(1).max(100),
  decision: z.enum(["approved", "rejected", "escalated"]),
  decisionReason: z.string().trim().min(3).max(1000),
  acknowledgement: z.boolean(),
});

export async function handleCreateClaim(input: z.input<typeof createClaimSchema>) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const parsed = createClaimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid claim details" };

  const caseFile = await getCaseById(parsed.data.caseId);
  if (!caseFile) return { error: "Property case not found" };
  if (caseFile.status !== "finalised") return { error: "Complete the property record before starting a collection claim" };
  if (caseFile.claims?.some((claim) => claim.decision === "pending" || claim.decision === "approved")) {
    return { error: "This property already has an active or approved claim" };
  }

  const claim = await createClaimRecord({
    caseId: parsed.data.caseId,
    path: parsed.data.path,
    lostReportId: parsed.data.path === "lost-report" ? parsed.data.lostReportId : null,
    claimantName: parsed.data.claimantName,
    claimantContact: parsed.data.claimantContact,
    maskedIdentifier: parsed.data.maskedIdentifier || null,
    verificationMethods: [...new Set(parsed.data.verificationMethods)],
    verificationNotes: parsed.data.verificationNotes,
    createdBy: user.username,
  });
  return { success: true, claim };
}

export async function handleDecideClaim(input: z.input<typeof decideClaimSchema>) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthenticated" };

  const parsed = decideClaimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid decision" };

  const caseFile = await getCaseById(parsed.data.caseId);
  if (!caseFile) return { error: "Property case not found" };
  const claim = caseFile.claims?.find((entry) => entry.id === parsed.data.claimId);
  if (!claim) return { error: "Claim not found" };
  if (claim.decision !== "pending") return { error: "This claim has already been decided" };

  if (parsed.data.decision === "approved") {
    if (claim.verificationMethods.length < 2) return { error: "Approval requires at least two recorded ownership checks" };
    if (!parsed.data.acknowledgement) return { error: "Claimant acknowledgement is required before handover" };
  }

  const updated = await decideClaimRecord(parsed.data.caseId, parsed.data.claimId, {
    decision: parsed.data.decision,
    decisionReason: parsed.data.decisionReason,
    acknowledgement: parsed.data.acknowledgement,
    decidedBy: user.username,
  });
  return updated ? { success: true, claim: updated } : { error: "Unable to update claim" };
}
