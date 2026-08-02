import test from "node:test";
import assert from "node:assert";
import fs from "fs";

// Set isolated test environment variables
process.env.DATA_DIR = "./data-test";
process.env.AUTH_SECRET = "test-secret-key-32-chars-minimum-foundflow-2026";
process.env.LOGIN_PASSWORD = "testpassword123";

const TEST_DIR = "./data-test";
const TEST_DB = "./data-test/foundflow.db";

// Ensure clean database state
if (fs.existsSync(TEST_DB)) {
  try {
    fs.unlinkSync(TEST_DB);
  } catch (e) {
    console.error("Failed to delete old test DB", e);
  }
}

// We can safely import database library
import {
  getCases,
  getCaseById,
  createCase,
  updateCase,
  createClaimRecord,
  decideClaimRecord,
  seedDemoCase,
  closeDb
} from "../src/lib/db.ts";
import type { Case, ManifestItem } from "../src/lib/db.ts";

import {
  signSession,
  verifySession,
  timingSafeCompare,
  isAuthDisabled
} from "../src/lib/auth-tokens.ts";

import { verifyImageSignature } from "../src/lib/image-utils.ts";
import { escapeCsvCell } from "../src/lib/csv-utils.ts";
import { buildDetectedItemLabel, FIRST_STAFF_CHECK_PREFIX, hasCycle, hasFirstStaffCheck, isCurrencyItem, isValidImageRegion, mergeAiDraftWithStaffItems, requiresDoubleStaffCheck, requiresSensitiveReview, summarizeCurrency, validateManifestStructure } from "../src/lib/validation.ts";
import { addDecimals, isValidCurrencyCode, multiplyDecimal, normalizeDecimal } from "../src/lib/currency.ts";
import { buildConfirmedSearchItems } from "../src/lib/search.ts";
import { caseContainsIdentityEvidence, evaluateClaimVerification } from "../src/lib/claim-policy.ts";

test("Database Layer, Seeding & Isolation", async (t) => {
  await t.test("should start with 0 cases on fresh setup", async () => {
    const cases = await getCases();
    assert.strictEqual(cases.length, 0);
  });

  await t.test("should explicitly seed a complete photo-linked demo case", async () => {
    const demo = await seedDemoCase();
    assert.strictEqual(demo.id, "CT3A-20260721-DEMO");
    assert.strictEqual(demo.isDemo, true);
    assert.strictEqual(demo.uploads.length, 1);
    assert.strictEqual(demo.uploads[0].mimeType, "image/webp");
    assert.ok(fs.existsSync(`${TEST_DIR}/uploads/${demo.uploads[0].filename}`));
    assert.strictEqual(demo.manifest.length, 11);
    assert.ok(demo.manifest.every((item) => item.evidenceId === demo.uploads[0].id));
    assert.deepStrictEqual(summarizeCurrency(demo.manifest), [
      { currencyCode: "MYR", total: "50.4" },
      { currencyCode: "SGD", total: "104" },
    ]);
    assert.strictEqual(demo.manifest.filter(isCurrencyItem).length, 5);
    assert.ok(demo.manifest.filter(isCurrencyItem).every((item) => item.status === "review"));
    assert.strictEqual(validateManifestStructure(demo), null);
    assert.ok(demo.auditLogs.some((log) => log.action === "demo_seeded" && log.details.includes("no live AI call")));

    const cases = await getCases();
    assert.strictEqual(cases.length, 1);
  });

  await t.test("should retrieve demo case by id", async () => {
    const caseFile = await getCaseById("CT3A-20260721-DEMO");
    assert.ok(caseFile);
    assert.strictEqual(caseFile!.id, "CT3A-20260721-DEMO");
  });

  await t.test("should create a new case and persist audit event", async () => {
    const newCase = await createCase({
      location: "Gate B22 Arrivals",
      foundTime: new Date().toISOString(),
      foundBy: "Airport Staff Test",
      outerItemDescription: "Blue Suitcase",
      notes: "Test Suitcase",
    });

    assert.ok(newCase.id);
    assert.notStrictEqual(newCase.id, "CT3A-20260721-DEMO");
    assert.strictEqual(newCase.location, "Gate B22 Arrivals");
    assert.strictEqual(newCase.manifest.length, 1);
    assert.strictEqual(newCase.manifest[0].id, "outer-item-root");

    const retrieved = await getCaseById(newCase.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved!.location, "Gate B22 Arrivals");

    const createdLog = retrieved!.auditLogs.find(l => l.action === "case_created");
    assert.ok(createdLog);
  });

  await t.test("should persist a walk-in claim, decision, handover time and audit history", async () => {
    const claim = await createClaimRecord({
      caseId: "CT3A-20260721-DEMO",
      path: "walk-in",
      lostReportId: null,
      claimantName: "Synthetic Claimant",
      claimantContact: "synthetic@example.test",
      maskedIdentifier: "****123A",
      verificationMethods: ["identity-match", "undisclosed-contents"],
      verificationNotes: "Synthetic identity and hidden bag content matched.",
      createdBy: "test-staff",
    });
    assert.strictEqual(claim.decision, "pending");

    const decided = await decideClaimRecord("CT3A-20260721-DEMO", claim.id, {
      decision: "approved",
      decisionReason: "Two independent ownership checks matched.",
      acknowledgement: true,
      decidedBy: "test-staff",
    });
    assert.ok(decided);
    assert.strictEqual(decided!.decision, "approved");
    assert.ok(decided!.collectedAt);

    const retrieved = await getCaseById("CT3A-20260721-DEMO");
    assert.strictEqual(retrieved!.claims?.[0].id, claim.id);
    assert.deepStrictEqual(retrieved!.claims?.[0].verificationMethods, ["identity-match", "undisclosed-contents"]);
    assert.ok(retrieved!.auditLogs.some((log) => log.action === "claim_created"));
    assert.ok(retrieved!.auditLogs.some((log) => log.action === "item_collected"));

    const repeatedDecision = await decideClaimRecord("CT3A-20260721-DEMO", claim.id, {
      decision: "rejected",
      decisionReason: "A second transition must not be recorded.",
      acknowledgement: false,
      decidedBy: "second-test-staff",
    });
    assert.strictEqual(repeatedDecision, undefined);
    const afterRepeat = await getCaseById("CT3A-20260721-DEMO");
    assert.strictEqual(afterRepeat!.auditLogs.filter((log) => log.action === "item_collected" || log.action === "claim_rejected").length, 1);
  });
});

test("Photo Region Persistence & Validation", async (t) => {
  await t.test("does not misclassify a currency-described outer property as a currency manifest record", async () => {
    const demo = structuredClone((await getCaseById("CT3A-20260721-DEMO"))!);
    demo.outerItemDescription = "Loose mixed coins";
    const root = demo.manifest.find((item) => item.id === "outer-item-root")!;
    root.label = "Loose mixed coins";
    assert.strictEqual(validateManifestStructure(demo), null);
  });

  await t.test("accepts normalized regions and rejects boxes outside the image", () => {
    assert.strictEqual(isValidImageRegion({ id: "region-1", x: 0.1, y: 0.2, width: 0.3, height: 0.4 }), true);
    assert.strictEqual(isValidImageRegion({ id: "region-2", x: 0.9, y: 0.2, width: 0.2, height: 0.2 }), false);
    assert.strictEqual(isValidImageRegion({ id: "region-3", x: 0.1, y: 0.2, width: 0, height: 0.2 }), false);
  });

  await t.test("marks every visible demo object with one region per instance", async () => {
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    const photoItems = demo.manifest.filter((item) => item.evidenceId === "demo-evidence-1");
    assert.ok(photoItems.some((item) => item.id === "outer-item-root"));
    assert.ok(photoItems.every((item) => item.quantityKnown === false || item.regions?.length === item.quantity));
    assert.strictEqual(photoItems.reduce((count, item) => count + (item.regions?.length ?? 0), 0), 15);
  });

  await t.test("round-trips multiple regions through the database", async () => {
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    const item = demo.manifest.find((candidate) => candidate.id === "sgd-1-coins")!;
    item.regions = [
      { id: "region-a", x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
      { id: "region-b", x: 0.3, y: 0.2, width: 0.12, height: 0.14 },
      { id: "region-c", x: 0.5, y: 0.3, width: 0.11, height: 0.13 },
    ];
    await updateCase(demo.id, demo);
    const reloaded = (await getCaseById(demo.id))!;
    assert.deepStrictEqual(reloaded.manifest.find((candidate) => candidate.id === item.id)!.regions, item.regions);
    assert.strictEqual(validateManifestStructure(reloaded), null);
  });

  await t.test("rejects regions attached without an uploaded source photo", async () => {
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    const item = demo.manifest.find((candidate) => candidate.id === "sgd-1-coins")!;
    item.evidenceId = "staff-added";
    assert.match(validateManifestStructure(demo) ?? "", /photo regions without a valid source photo/);
  });
});

test("Collection Verification Policy", async (t) => {
  await t.test("rejects duplicate evidence groups", () => {
    const result = evaluateClaimVerification({
      path: "walk-in",
      methods: ["identity-match", "singpass-or-government-id"],
      identityEvidenceInProperty: true,
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /independent evidence groups/i);
  });

  await t.test("requires an identity check when identity evidence is inside the property", () => {
    const result = evaluateClaimVerification({
      path: "walk-in",
      methods: ["undisclosed-contents", "receipt-or-serial"],
      identityEvidenceInProperty: true,
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /identity check/i);
  });

  await t.test("accepts identity plus private knowledge for an identity-bearing property", () => {
    const result = evaluateClaimVerification({
      path: "walk-in",
      methods: ["identity-match", "undisclosed-contents"],
      identityEvidenceInProperty: true,
    });
    assert.strictEqual(result.allowed, true);
  });

  await t.test("requires a report-details match on the lost-report path", () => {
    const result = evaluateClaimVerification({
      path: "lost-report",
      methods: ["distinctive-features", "receipt-or-serial"],
      identityEvidenceInProperty: false,
    });
    assert.strictEqual(result.allowed, false);
    assert.match(result.message, /Lost Report details/i);
  });

  await t.test("detects identity evidence from the recorded item list", async () => {
    const caseFile = await getCaseById("CT3A-20260721-DEMO");
    assert.ok(caseFile);
    assert.strictEqual(caseContainsIdentityEvidence({
      ...caseFile!,
      manifest: [...caseFile!.manifest, { ...caseFile!.manifest[0], id: "synthetic-id", label: "Identification card" }],
    }), true);
  });
});

test("Authentication & Security Session Tokens", async (t) => {
  await t.test("should successfully sign and verify a session token", () => {
    const token = signSession("officer-tan");
    assert.ok(token);
    assert.ok(token.includes("."));

    const verified = verifySession(token);
    assert.ok(verified);
    assert.strictEqual(verified!.username, "officer-tan");
  });

  await t.test("should fail verification when signature is tampered", () => {
    const token = signSession("officer-tan");
    const [payload, signature] = token.split(".");

    // Change a character in the signature
    const tamperedSignature = signature.replace(/[0-9a-f]/, 'z');
    const tamperedToken = `${payload}.${tamperedSignature}`;

    const verified = verifySession(tamperedToken);
    assert.strictEqual(verified, null);
  });

  await t.test("should fail verification when payload is tampered", () => {
    const token = signSession("officer-tan");
    const [payload, signature] = token.split(".");

    // Decode, change payload, re-encode
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    const modifiedDecoded = decoded.replace("officer-tan", "hacker");
    const tamperedPayload = Buffer.from(modifiedDecoded).toString("base64");

    const tamperedToken = `${tamperedPayload}.${signature}`;
    const verified = verifySession(tamperedToken);
    assert.strictEqual(verified, null);
  });

  await t.test("should fail verification when token is expired", () => {
    // Generate an expired token (expiresMs = -1000)
    const token = signSession("officer-tan", -1000);
    const verified = verifySession(token);
    assert.strictEqual(verified, null);
  });

  await t.test("timingSafeCompare should prevent timing attacks", () => {
    assert.strictEqual(timingSafeCompare("secret-pass", "secret-pass"), true);
    assert.strictEqual(timingSafeCompare("secret-pass", "wrong-pass"), false);
  });

  await t.test("temporary demo mode is controlled by an explicit environment flag", () => {
    process.env.AUTH_DISABLED = "true";
    try {
      assert.strictEqual(isAuthDisabled(), true);
    } finally {
      delete process.env.AUTH_DISABLED;
    }
    assert.strictEqual(isAuthDisabled(), false);
  });
});

test("Brand-aware item labels", () => {
  assert.strictEqual(buildDetectedItemLabel("tote bag", "Louis Vuitton", "Neverfull MM"), "Louis Vuitton Neverfull MM tote bag");
  assert.strictEqual(buildDetectedItemLabel("Apple iPhone", "Apple", "iPhone 15 Pro"), "Apple iPhone 15 Pro");
  assert.strictEqual(buildDetectedItemLabel("watch", "Apple", "Apple Watch Ultra 2"), "Apple Watch Ultra 2");
  assert.strictEqual(buildDetectedItemLabel("black backpack", null, null), "black backpack");
});

test("Search Visibility", () => {
  const confirmedItem: ManifestItem = {
    id: "confirmed-item",
    label: "Black wallet",
    parentId: null,
    quantity: 1,
    status: "confirmed",
    confidence: 1,
    reviewReason: null,
    evidenceId: "staff-entry",
  };
  const reviewItem: ManifestItem = {
    ...confirmedItem,
    id: "review-item",
    label: "Unverified card",
    status: "review",
  };
  const baseCase: Case = {
    id: "completed-case",
    location: "Terminal 3",
    foundTime: "2026-08-02T12:00:00.000Z",
    foundBy: "Airport staff",
    outerItemDescription: "Black wallet",
    notes: "",
    status: "finalised",
    finalisedAt: "2026-08-02T12:10:00.000Z",
    finalisedBy: "Airport staff",
    uploads: [],
    manifest: [confirmedItem, reviewItem],
    auditLogs: [],
    createdAt: "2026-08-02T12:00:00.000Z",
  };

  const results = buildConfirmedSearchItems([
    baseCase,
    { ...baseCase, id: "open-case", status: "reviewing", finalisedAt: null, finalisedBy: null },
    { ...baseCase, id: "unconfirmed-case", finalisedBy: null },
  ]);

  assert.deepStrictEqual(results.map((item) => item.id), ["confirmed-item"]);
  assert.strictEqual(results[0].caseId, "completed-case");
});

test("Upload Hardening & Image Signature Validation", async (t) => {
  await t.test("should validate JPG files", () => {
    const mockJpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    assert.strictEqual(verifyImageSignature(mockJpg, "image/jpeg"), true);
  });

  await t.test("should validate PNG files", () => {
    const mockPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    assert.strictEqual(verifyImageSignature(mockPng, "image/png"), true);
  });

  await t.test("should validate WebP files", () => {
    const mockWebp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    assert.strictEqual(verifyImageSignature(mockWebp, "image/webp"), true);
  });

  await t.test("should reject non-image file formats", () => {
    const mockText = Buffer.from("hello world this is a test text file which is not an image");
    assert.strictEqual(verifyImageSignature(mockText, "image/jpeg"), false);
    assert.strictEqual(verifyImageSignature(mockText, "image/png"), false);
    assert.strictEqual(verifyImageSignature(mockText, "image/webp"), false);
  });
});

test("Domain, Cycles & Finalisation Validations", async (t) => {
  await t.test("should detect cycle in manifest items", () => {
    const items: ManifestItem[] = [
      { id: "outer-item-root", label: "Root", parentId: null, quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" },
      { id: "item-a", label: "A", parentId: "item-b", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" },
      { id: "item-b", label: "B", parentId: "item-a", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" },
    ];
    assert.strictEqual(hasCycle(items), true);
  });

  await t.test("should approve cyclic-free nested structures", () => {
    const items: ManifestItem[] = [
      { id: "outer-item-root", label: "Root", parentId: null, quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" },
      { id: "item-a", label: "A", parentId: "outer-item-root", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" },
      { id: "item-b", label: "B", parentId: "item-a", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" },
    ];
    assert.strictEqual(hasCycle(items), false);
  });

  await t.test("should reject missing root container on structure check", () => {
    const mockCase: Case = {
      id: "FF-TEST",
      location: "Terminal",
      foundTime: new Date().toISOString(),
      foundBy: "",
      outerItemDescription: "Bag",
      notes: "",
      status: "reviewing",
      finalisedAt: null,
      finalisedBy: null,
      uploads: [],
      manifest: [
        { id: "item-a", label: "A", parentId: null, quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual" }
      ],
      auditLogs: [],
      createdAt: new Date().toISOString(),
    };
    const error = validateManifestStructure(mockCase);
    assert.ok(error && error.includes("root"));
  });

  await t.test("should reject invalid photo references on structure check", () => {
    const mockCase: Case = {
      id: "FF-TEST",
      location: "Terminal",
      foundTime: new Date().toISOString(),
      foundBy: "",
      outerItemDescription: "Bag",
      notes: "",
      status: "reviewing",
      finalisedAt: null,
      finalisedBy: null,
      uploads: [],
      manifest: [
        { id: "outer-item-root", label: "Bag", parentId: null, quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual-creation" },
        { id: "item-a", label: "A", parentId: "outer-item-root", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "fake-evidence-id" }
      ],
      auditLogs: [],
      createdAt: new Date().toISOString(),
    };
    const error = validateManifestStructure(mockCase);
    assert.ok(error && error.includes("photo"));
  });

  await t.test("requires exact denomination totals before currency confirmation", async () => {
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    const currency = demo.manifest.find((item) => item.id === "sgd-1-coins")!;
    currency.status = "confirmed";
    currency.currencyCode = null;
    assert.match(validateManifestStructure(demo) ?? "", /requires a valid ISO 4217 currency code/);

    currency.currencyCode = "SGD";
    currency.currencyTotal = "99";
    assert.match(validateManifestStructure(demo) ?? "", /denomination × quantity/);
  });
});

test("Exact Currency Arithmetic & Review Boundaries", async (t) => {
  await t.test("uses canonical decimal arithmetic without cent rounding", () => {
    assert.strictEqual(normalizeDecimal("000.0010"), null);
    assert.strictEqual(normalizeDecimal("0.0010"), "0.001");
    assert.strictEqual(multiplyDecimal("0.001", 3), "0.003");
    assert.strictEqual(addDecimals("50", "0.4"), "50.4");
    assert.deepStrictEqual(summarizeCurrency([
      { id: "kwd", label: "Kuwaiti coin", parentId: "outer-item-root", quantity: 3, quantityKnown: true, itemType: "currency", status: "review", confidence: 1, reviewReason: null, evidenceId: "staff-added", currencyCode: "KWD", denomination: "0.001", currencyTotal: "0.003" },
    ]), [{ currencyCode: "KWD", total: "0.003" }]);
  });

  await t.test("recognizes generic currency wording even when amount fields are unreadable", async () => {
    const item: ManifestItem = { id: "note", label: "Singapore note", parentId: "outer-item-root", quantity: 1, quantityKnown: false, status: "confirmed", confidence: 0.5, reviewReason: null, evidenceId: "demo-evidence-1" };
    assert.strictEqual(isCurrencyItem(item), true);
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    demo.manifest.push(item);
    assert.match(validateManifestStructure(demo) ?? "", /valid ISO 4217 currency code/);
  });

  await t.test("blocks confirmation when the observed count is unknown", async () => {
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    const item = demo.manifest.find((candidate) => candidate.id === "sgd-100")!;
    item.status = "confirmed";
    item.quantityKnown = false;
    item.currencyTotal = null;
    assert.match(validateManifestStructure(demo) ?? "", /known quantity/);
  });

  await t.test("rejects invented three-letter currency codes", async () => {
    assert.strictEqual(isValidCurrencyCode("SGD"), true);
    assert.strictEqual(isValidCurrencyCode("ZZZ"), false);
    const demo = (await getCaseById("CT3A-20260721-DEMO"))!;
    const item = demo.manifest.find((candidate) => candidate.id === "sgd-100")!;
    item.status = "confirmed";
    item.currencyCode = "ZZZ";
    assert.match(validateManifestStructure(demo) ?? "", /valid ISO 4217 currency code/);
  });
});

test("CSV Injection Protection (OWASP)", async (t) => {
  await t.test("should escape formula trigger characters", () => {
    assert.strictEqual(escapeCsvCell("=SUM(1,2)"), '"\'=SUM(1,2)"');
    assert.strictEqual(escapeCsvCell("+100"), '"\'+100"');
    assert.strictEqual(escapeCsvCell("-20"), '"\'-20"');
    assert.strictEqual(escapeCsvCell("@ATTACK"), '"\'@ATTACK"');
    assert.strictEqual(escapeCsvCell(" \t=CMD()"), '"\' \t=CMD()"');
  });

  await t.test("should quote benign values normally", () => {
    assert.strictEqual(escapeCsvCell("Standard Backpack"), '"Standard Backpack"');
    assert.strictEqual(escapeCsvCell("SGD 50 note"), '"SGD 50 note"');
  });
});

test("Sensitive Item Review Policy", async (t) => {
  const item = (label: string, category = "other", itemType: "property" | "currency" = "property"): ManifestItem => ({
    id: `test-${label}`,
    label,
    parentId: "outer-item-root",
    quantity: 1,
    itemType,
    category,
    status: "review",
    confidence: 1,
    reviewReason: null,
    evidenceId: "test-photo",
  });

  await t.test("requires two staff checks for money, identification documents, and perishables", () => {
    assert.strictEqual(requiresDoubleStaffCheck(item("SGD 50 note", "cash", "currency")), true);
    assert.strictEqual(requiresDoubleStaffCheck(item("Identification card", "documents")), true);
    assert.strictEqual(requiresDoubleStaffCheck(item("Chicken sandwich", "food")), true);
    assert.strictEqual(requiresDoubleStaffCheck(item("USB-C cable", "electronics")), false);
  });

  await t.test("recognizes the persisted first staff check marker", () => {
    const checked = item("Passport", "documents");
    checked.reviewReason = `${FIRST_STAFF_CHECK_PREFIX} by test-staff. Second staff check required.`;
    assert.strictEqual(hasFirstStaffCheck(checked), true);
    checked.status = "confirmed";
    assert.strictEqual(hasFirstStaffCheck(checked), false);
  });

  await t.test("flags money, identity documents, and serial identifiers", () => {
    assert.strictEqual(requiresSensitiveReview("Singapore $50 banknotes"), true);
    assert.strictEqual(requiresSensitiveReview("Leather holder", "PASSPORT S1234567A"), true);
    assert.strictEqual(requiresSensitiveReview("Camera", "", "Serial number: ABC123"), true);
  });

  await t.test("does not flag ordinary low-risk objects", () => {
    assert.strictEqual(requiresSensitiveReview("White USB-C cable", "", "Length: 1 metre"), false);
  });

  await t.test("preserves staff records while replacing stale AI drafts", () => {
    const root: ManifestItem = { id: "outer-item-root", label: "Bag", parentId: null, quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual-creation", source: "system" };
    const staff: ManifestItem = { id: "staff-1", label: "Orange tag", parentId: "outer-item-root", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "staff-added", source: "staff" };
    const staleAi: ManifestItem = { id: "ai-old", label: "Old cable", parentId: "outer-item-root", quantity: 1, status: "confirmed", confidence: 0.9, reviewReason: null, evidenceId: "ev-old", source: "ai" };
    const freshAi: ManifestItem = { id: "ai-new", label: "New cable", parentId: "outer-item-root", quantity: 1, status: "confirmed", confidence: 0.95, reviewReason: null, evidenceId: "ev-new", source: "ai" };
    const duplicateStaffLabel: ManifestItem = { ...freshAi, id: "ai-duplicate", label: "Orange tag" };

    const merged = mergeAiDraftWithStaffItems([root, staff, staleAi], [root, freshAi, duplicateStaffLabel]);
    assert.deepStrictEqual(merged.map((item) => item.id), ["outer-item-root", "ai-new", "staff-1"]);
  });

  await t.test("remaps fresh AI children to preserved staff-owned containers", () => {
    const root: ManifestItem = { id: "outer-item-root", label: "Bag", parentId: null, quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "manual-creation", source: "system" };
    const preservedPouch: ManifestItem = { id: "staff-pouch", label: "Brown pouch", parentId: "outer-item-root", quantity: 1, status: "confirmed", confidence: 1, reviewReason: null, evidenceId: "staff-added", source: "staff" };
    const freshPouch: ManifestItem = { ...preservedPouch, id: "fresh-pouch", evidenceId: "evidence-1", source: "ai" };
    const freshCoin: ManifestItem = { id: "fresh-coin", label: "Coin", parentId: "fresh-pouch", quantity: 1, status: "review", confidence: 0.8, reviewReason: "Verify denomination", evidenceId: "evidence-1", source: "ai" };

    const merged = mergeAiDraftWithStaffItems([root, preservedPouch], [root, freshPouch, freshCoin]);
    assert.deepStrictEqual(merged.map((item) => item.id), ["outer-item-root", "fresh-coin", "staff-pouch"]);
    assert.strictEqual(merged.find((item) => item.id === "fresh-coin")?.parentId, "staff-pouch");
  });
});

// Clean up test databases
test.after(() => {
  closeDb();
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch (err) {
    console.error("Cleanup failed", err);
  }
});
