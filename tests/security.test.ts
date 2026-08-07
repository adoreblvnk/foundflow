import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  getActiveDataKeyId,
  isProtectedBuffer,
  protectBuffer,
  protectText,
  protectedTextKeyId,
  unprotectBuffer,
  unprotectText,
} from "../src/lib/data-protection.ts";
import { closeDb, createCase, createClaimRecord, getCaseById, getDbInstance, seedDemoCase } from "../src/lib/db.ts";
import { readEvidence, writeEvidence } from "../src/lib/evidence-storage.ts";
import { runAiScan } from "../src/lib/ai-scan.ts";
import { buildProviderCandidateSummaries } from "../src/lib/search-provider.ts";

const original = {
  authDisabled: process.env.AUTH_DISABLED,
  dataDir: process.env.DATA_DIR,
  demoAiScanEnabled: process.env.DEMO_AI_SCAN_ENABLED,
  keys: process.env.DATA_ENCRYPTION_KEYS,
  mode: process.env.DATA_PROTECTION_MODE,
  storageMode: process.env.STORAGE_MODE,
};

function key(byte: number): string {
  return Buffer.alloc(32, byte).toString("base64");
}

function restoreEnvironment() {
  for (const [name, value] of [
    ["AUTH_DISABLED", original.authDisabled],
    ["DATA_DIR", original.dataDir],
    ["DEMO_AI_SCAN_ENABLED", original.demoAiScanEnabled],
    ["DATA_ENCRYPTION_KEYS", original.keys],
    ["DATA_PROTECTION_MODE", original.mode],
    ["STORAGE_MODE", original.storageMode],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test.after(() => {
  closeDb();
  restoreEnvironment();
});

test("AES-256-GCM text envelopes support authenticated decryption and key rotation", () => {
  process.env.DATA_PROTECTION_MODE = "required";
  process.env.DATA_ENCRYPTION_KEYS = `old:${key(1)}`;
  const protectedValue = protectText("masked claimant detail", "db:claims.claimantContact");
  assert.ok(protectedValue?.startsWith("ffenc:v1:old:"));
  assert.equal(unprotectText(protectedValue, "db:claims.claimantContact"), "masked claimant detail");
  assert.throws(() => unprotectText(protectedValue, "db:claims.claimantName"));

  process.env.DATA_ENCRYPTION_KEYS = `current:${key(2)},old:${key(1)}`;
  assert.equal(getActiveDataKeyId(), "current");
  assert.equal(protectedTextKeyId(protectedValue!), "old");
  assert.equal(unprotectText(protectedValue, "db:claims.claimantContact"), "masked claimant detail");
  assert.equal(protectedTextKeyId(protectText("new value", "db:claims.claimantContact")!), "current");
});

test("binary envelopes protect item-photo bytes and reject scope changes", () => {
  process.env.DATA_PROTECTION_MODE = "required";
  process.env.DATA_ENCRYPTION_KEYS = `current:${key(3)}`;
  const plain = Buffer.from("synthetic image bytes");
  const protectedValue = protectBuffer(plain, "evidence:test.webp");
  assert.equal(isProtectedBuffer(protectedValue), true);
  assert.deepEqual(unprotectBuffer(protectedValue, "evidence:test.webp"), plain);
  assert.throws(() => unprotectBuffer(protectedValue, "evidence:other.webp"));
});

test("required mode fails closed while optional mode preserves legacy plaintext", async () => {
  closeDb();
  delete process.env.DATA_ENCRYPTION_KEYS;
  process.env.DATA_PROTECTION_MODE = "required";
  assert.throws(() => protectText("secret", "db:cases.notes"), /DATA_ENCRYPTION_KEYS is required/);
  await assert.rejects(() => getDbInstance(), /DATA_ENCRYPTION_KEYS is required/);
  process.env.DATA_PROTECTION_MODE = "optional";
  assert.equal(protectText("legacy", "db:cases.notes"), "legacy");
  assert.equal(unprotectText("legacy", "db:cases.notes"), "legacy");
  process.env.DATA_PROTECTION_MODE = "invalid";
  assert.throws(() => protectText("secret", "db:cases.notes"), /DATA_PROTECTION_MODE/);
  process.env.DATA_PROTECTION_MODE = "required";
  process.env.DATA_ENCRYPTION_KEYS = `duplicate:${key(5)},duplicate:${key(6)}`;
  assert.throws(() => protectText("secret", "db:cases.notes"), /duplicated/);
});

test("login-disabled mode blocks AI scans at the shared provider boundary", async () => {
  process.env.AUTH_DISABLED = "true";
  delete process.env.DEMO_AI_SCAN_ENABLED;
  await assert.rejects(
    () => runAiScan({ caseId: "synthetic-case-id", username: "demo-staff" }),
    /Live AI scanning is disabled while login is disabled/,
  );
  process.env.AUTH_DISABLED = "false";
});

test("provider search summaries omit free-form operational data", () => {
  const sensitive = "SYNTHETIC-PRIVATE-IDENTIFIER";
  const summaries = buildProviderCandidateSummaries([{
    category: sensitive,
    itemType: sensitive,
    currencyCode: sensitive,
    foundTime: `2026-08-07T10:00:00Z ${sensitive}`,
  }]);
  assert.equal(summaries.includes(sensitive), false);
  assert.match(summaries, /Category: other \| Type: property \| Currency: none \| Found date: 2026-08-07/);
});

test("evidence storage and sensitive database fields are encrypted at rest", async () => {
  closeDb();
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "foundflow-security-"));
  process.env.AUTH_DISABLED = "false";
  process.env.DATA_DIR = dataDir;
  process.env.DATA_PROTECTION_MODE = "required";
  process.env.DATA_ENCRYPTION_KEYS = `current:${key(4)}`;
  process.env.STORAGE_MODE = "local";

  const bytes = Buffer.from("synthetic private photo");
  await writeEvidence("security-test.webp", bytes, "image/webp");
  const storedBytes = await fs.readFile(path.join(dataDir, "uploads", "security-test.webp"));
  assert.equal(isProtectedBuffer(storedBytes), true);
  assert.deepEqual(await readEvidence("security-test.webp"), bytes);
  assert.equal((await fs.stat(path.join(dataDir, "uploads", "security-test.webp"))).mode & 0o777, 0o600);
  await assert.rejects(() => writeEvidence("../escape.webp", bytes, "image/webp"), /Invalid evidence filename/);

  const created = await createCase({
    location: "Synthetic test location",
    foundTime: new Date().toISOString(),
    outerItemDescription: "Synthetic bag",
    notes: "Private synthetic note",
    storageLocation: "Secure shelf 4",
  });
  await createClaimRecord({
    caseId: created.id,
    path: "walk-in",
    lostReportId: null,
    claimantName: "Synthetic Claimant",
    claimantContact: "synthetic@example.invalid",
    maskedIdentifier: "****123A",
    verificationMethods: ["private-knowledge", "item-description"],
    verificationNotes: "Synthetic verification detail",
    createdBy: "security-test",
  });

  const db = await getDbInstance();
  const rawCase = (await db.execute({ sql: "SELECT notes, storageLocation FROM cases WHERE id = ?", args: [created.id] })).rows[0];
  assert.match(String(rawCase.notes), /^ffenc:v1:current:/);
  assert.match(String(rawCase.storageLocation), /^ffenc:v1:current:/);
  const rawClaim = (await db.execute({ sql: "SELECT claimantName, claimantContact, verificationNotes FROM claims WHERE caseId = ?", args: [created.id] })).rows[0];
  assert.match(String(rawClaim.claimantName), /^ffenc:v1:current:/);
  assert.match(String(rawClaim.claimantContact), /^ffenc:v1:current:/);
  assert.match(String(rawClaim.verificationNotes), /^ffenc:v1:current:/);

  const secondCase = await createCase({
    location: "Second synthetic location",
    foundTime: new Date().toISOString(),
    outerItemDescription: "Second synthetic bag",
    notes: "Second private synthetic note",
  });
  const secondRawCase = (await db.execute({ sql: "SELECT notes FROM cases WHERE id = ?", args: [secondCase.id] })).rows[0];
  await db.execute({ sql: "UPDATE cases SET notes = ? WHERE id = ?", args: [String(secondRawCase.notes), created.id] });
  await assert.rejects(() => getCaseById(created.id));
  await db.execute({ sql: "UPDATE cases SET notes = ? WHERE id = ?", args: [String(rawCase.notes), created.id] });

  const seeded = await seedDemoCase();
  const rawUpload = (await db.execute({ sql: "SELECT originalName FROM uploads WHERE caseId = ?", args: [seeded.id] })).rows[0];
  assert.match(String(rawUpload.originalName), /^ffenc:v1:current:/);
  assert.equal(seeded.uploads[0].originalName, "staged-found-item.webp");

  const hydrated = await getCaseById(created.id);
  assert.equal(hydrated?.notes, "Private synthetic note");
  assert.equal(hydrated?.storageLocation, "Secure shelf 4");
  assert.equal(hydrated?.claims?.[0]?.claimantName, "Synthetic Claimant");

  process.env.AUTH_DISABLED = "true";
  assert.equal(await getCaseById(created.id), undefined);
  const demoOnlyCase = await createCase({
    location: "Synthetic demo location",
    foundTime: new Date().toISOString(),
    outerItemDescription: "Synthetic demo item",
    notes: "Synthetic data only",
  });
  assert.equal(demoOnlyCase.isDemo, true);
  process.env.AUTH_DISABLED = "false";

  const legacyNote = protectText("Legacy scoped synthetic note", "db:cases.notes");
  await db.execute({ sql: "UPDATE cases SET notes = ? WHERE id = ?", args: [legacyNote, created.id] });
  closeDb();
  const databasePath = path.join(dataDir, "foundflow.db");
  const beforeDryRun = await fs.readFile(databasePath);
  const migrationEnvironment = { ...process.env, AUTH_DISABLED: "false", DATA_DIR: dataDir, STORAGE_MODE: "local" };
  const dryRun = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/reencrypt-data.ts"], {
    cwd: process.cwd(),
    env: migrationEnvironment,
    encoding: "utf8",
  });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const dryRunResult = JSON.parse(dryRun.stdout.trim()) as { databaseRows: number; protectedFields: number };
  assert.ok(dryRunResult.databaseRows >= 1);
  assert.ok(dryRunResult.protectedFields >= 1);
  assert.deepEqual(await fs.readFile(databasePath), beforeDryRun);

  const applyMigration = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/reencrypt-data.ts", "--apply"], {
    cwd: process.cwd(),
    env: migrationEnvironment,
    encoding: "utf8",
  });
  assert.equal(applyMigration.status, 0, applyMigration.stderr);
  assert.equal((await getCaseById(created.id))?.notes, "Legacy scoped synthetic note");

  closeDb();
  await fs.rm(dataDir, { recursive: true, force: true });
});
