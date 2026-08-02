import type { Case, ClaimPath } from "./db";

export const claimVerificationMethods = [
  "lost-report-match",
  "identity-match",
  "singpass-or-government-id",
  "undisclosed-contents",
  "distinctive-features",
  "receipt-or-serial",
  "device-unlock",
] as const;

export type ClaimVerificationMethod = typeof claimVerificationMethods[number];
export type ClaimEvidenceClass = "report" | "identity" | "private-knowledge" | "documentary" | "possession";

const evidenceClassByMethod: Record<ClaimVerificationMethod, ClaimEvidenceClass> = {
  "lost-report-match": "report",
  "identity-match": "identity",
  "singpass-or-government-id": "identity",
  "undisclosed-contents": "private-knowledge",
  "distinctive-features": "private-knowledge",
  "receipt-or-serial": "documentary",
  "device-unlock": "possession",
};

export function caseContainsIdentityEvidence(caseFile: Pick<Case, "manifest">): boolean {
  return caseFile.manifest.some((item) => {
    const text = `${item.label} ${item.category || ""}`.toLowerCase();
    return /passport|identity|identification|\bic\b|driver.?s licence|documents/.test(text);
  });
}

export function evaluateClaimVerification(input: {
  path: ClaimPath;
  methods: readonly string[];
  identityEvidenceInProperty: boolean;
}): { allowed: boolean; message: string; evidenceClasses: ClaimEvidenceClass[] } {
  const methods = [...new Set(input.methods)].filter((method): method is ClaimVerificationMethod =>
    claimVerificationMethods.includes(method as ClaimVerificationMethod));
  const classes = [...new Set(methods.map((method) => evidenceClassByMethod[method]))];

  if (methods.length < 2) {
    return { allowed: false, message: "Record at least two ownership checks before creating the claim.", evidenceClasses: classes };
  }
  if (classes.length < 2) {
    return { allowed: false, message: "Use checks from at least two independent evidence groups.", evidenceClasses: classes };
  }
  if (input.path === "lost-report" && !methods.includes("lost-report-match")) {
    return { allowed: false, message: "Confirm that the recorded Lost Report details match this property.", evidenceClasses: classes };
  }
  if (input.identityEvidenceInProperty && !classes.includes("identity")) {
    return { allowed: false, message: "This property contains identity evidence. Record an identity check before release.", evidenceClasses: classes };
  }

  return { allowed: true, message: "Independent ownership checks recorded.", evidenceClasses: classes };
}
