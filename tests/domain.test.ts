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
import { hasCycle, mergeAiDraftWithStaffItems, requiresSensitiveReview, validateManifestStructure } from "../src/lib/validation.ts";

test("Database Layer, Seeding & Isolation", async (t) => {
  await t.test("should start with 0 cases on fresh setup", () => {
    const cases = getCases();
    assert.strictEqual(cases.length, 0);
  });

  await t.test("should explicitly seed and retrieve the demo case", () => {
    const demo = seedDemoCase();
    assert.strictEqual(demo.id, "FF-0241");
    assert.strictEqual(demo.isDemo, true);
    assert.strictEqual(demo.uploads.length, 0); // Correctly pruned nonexistent files

    const cases = getCases();
    assert.strictEqual(cases.length, 1);
  });

  await t.test("should retrieve demo case by id", () => {
    const caseFile = getCaseById("FF-0241");
    assert.ok(caseFile);
    assert.strictEqual(caseFile!.id, "FF-0241");
  });

  await t.test("should create a new case and persist audit event", () => {
    const newCase = createCase({
      location: "Gate B22 Arrivals",
      foundTime: new Date().toISOString(),
      outerItemDescription: "Blue Suitcase",
      notes: "Test Suitcase",
    });

    assert.ok(newCase.id);
    assert.notStrictEqual(newCase.id, "FF-0241");
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
});

// Clean up test databases
test.after(() => {
  closeDb();
  try {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    if (fs.existsSync(TEST_DIR)) {
      fs.rmdirSync(TEST_DIR);
    }
  } catch (err) {
    console.error("Cleanup failed", err);
  }
});
