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
  seedDemoCase,
  closeDb
} from "../src/lib/db.ts";
import type { Case, ManifestItem } from "../src/lib/db.ts";

import {
  signSession,
  verifySession,
  timingSafeCompare
} from "../src/lib/auth-tokens.ts";

import { verifyImageSignature } from "../src/lib/image-utils.ts";
import { escapeCsvCell } from "../src/lib/csv-utils.ts";
import { hasCycle, isCurrencyItem, mergeAiDraftWithStaffItems, requiresSensitiveReview, summarizeCurrency, validateManifestStructure } from "../src/lib/validation.ts";
import { addDecimals, isValidCurrencyCode, multiplyDecimal, normalizeDecimal } from "../src/lib/currency.ts";

test("Database Layer, Seeding & Isolation", async (t) => {
  await t.test("should start with 0 cases on fresh setup", () => {
    const cases = getCases();
    assert.strictEqual(cases.length, 0);
  });

  await t.test("should explicitly seed a complete evidence-backed demo case", () => {
    const demo = seedDemoCase();
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

    const cases = getCases();
    assert.strictEqual(cases.length, 1);
  });

  await t.test("should retrieve demo case by id", () => {
    const caseFile = getCaseById("CT3A-20260721-DEMO");
    assert.ok(caseFile);
    assert.strictEqual(caseFile!.id, "CT3A-20260721-DEMO");
  });

  await t.test("should create a new case and persist audit event", () => {
    const newCase = createCase({
      location: "Gate B22 Arrivals",
      foundTime: new Date().toISOString(),
      outerItemDescription: "Blue Suitcase",
      notes: "Test Suitcase",
    });

    assert.ok(newCase.id);
    assert.notStrictEqual(newCase.id, "CT3A-20260721-DEMO");
    assert.strictEqual(newCase.location, "Gate B22 Arrivals");
    assert.strictEqual(newCase.manifest.length, 1);
    assert.strictEqual(newCase.manifest[0].id, "outer-item-root");

    const retrieved = getCaseById(newCase.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved!.location, "Gate B22 Arrivals");

    const createdLog = retrieved!.auditLogs.find(l => l.action === "case_created");
    assert.ok(createdLog);
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

  await t.test("should reject invalid evidence references on structure check", () => {
    const mockCase: Case = {
      id: "FF-TEST",
      location: "Terminal",
      foundTime: new Date().toISOString(),
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
    assert.ok(error && error.includes("evidence"));
  });

  await t.test("requires exact denomination totals before currency confirmation", () => {
    const demo = getCaseById("CT3A-20260721-DEMO")!;
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

  await t.test("recognizes generic currency wording even when amount fields are unreadable", () => {
    const item: ManifestItem = { id: "note", label: "Singapore note", parentId: "outer-item-root", quantity: 1, quantityKnown: false, status: "confirmed", confidence: 0.5, reviewReason: null, evidenceId: "demo-evidence-1" };
    assert.strictEqual(isCurrencyItem(item), true);
    const demo = getCaseById("CT3A-20260721-DEMO")!;
    demo.manifest.push(item);
    assert.match(validateManifestStructure(demo) ?? "", /valid ISO 4217 currency code/);
  });

  await t.test("blocks confirmation when the observed count is unknown", () => {
    const demo = getCaseById("CT3A-20260721-DEMO")!;
    const item = demo.manifest.find((candidate) => candidate.id === "sgd-100")!;
    item.status = "confirmed";
    item.quantityKnown = false;
    item.currencyTotal = null;
    assert.match(validateManifestStructure(demo) ?? "", /known quantity/);
  });

  await t.test("rejects invented three-letter currency codes", () => {
    assert.strictEqual(isValidCurrencyCode("SGD"), true);
    assert.strictEqual(isValidCurrencyCode("ZZZ"), false);
    const demo = getCaseById("CT3A-20260721-DEMO")!;
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
