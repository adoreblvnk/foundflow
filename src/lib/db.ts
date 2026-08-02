import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { normalizeDecimal } from "./currency.ts";
import { readDemoEvidence, writeEvidence } from "./evidence-storage.ts";

export interface EvidenceUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  containerContext?: string;
}

export interface ManifestItem {
  id: string;
  label: string;
  parentId: string | null;
  quantity: number;
  quantityKnown?: boolean;
  itemType?: "property" | "currency";
  status: "confirmed" | "review";
  confidence: number;
  reviewReason: string | null;
  evidenceId: string | null;
  ocrText?: string;
  visibleAttributes?: string;
  currencyCode?: string | null;
  denomination?: string | null;
  currencyTotal?: string | null;
  category?: string;
  source?: "ai" | "staff" | "system";
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  details: string;
}

export interface Case {
  id: string;
  isDemo?: boolean;
  location: string;
  foundTime: string;
  foundBy: string;
  outerItemDescription: string;
  notes: string;
  status: "reviewing" | "finalised";
  finalisedAt: string | null;
  finalisedBy: string | null;
  uploads: EvidenceUpload[];
  manifest: ManifestItem[];
  auditLogs: AuditLog[];
  createdAt: string;
}

interface Statement {
  sql: string;
  args: Array<string | number | null>;
}

type DbClient = ReturnType<typeof createClient>;
let dbInstance: DbClient | null = null;
let schemaPromise: Promise<void> | null = null;

function usesRemoteDatabase(): boolean {
  return process.env.DATABASE_MODE === "turso" || Boolean(process.env.VERCEL);
}

export function getDbPath(): string {
  const dataDir = process.env.DATA_DIR || "./data";
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.resolve(dataDir, "foundflow.db");
}

function createDbClient(): DbClient {
  if (usesRemoteDatabase()) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Turso database credentials are not configured");
    return createClient({ url, authToken });
  }
  return createClient({ url: `file:${getDbPath()}` });
}

async function initializeSchema(db: DbClient): Promise<void> {
  await db.batch([
    { sql: "PRAGMA foreign_keys = ON", args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      isDemo INTEGER DEFAULT 0,
      location TEXT NOT NULL,
      foundTime TEXT NOT NULL,
      foundBy TEXT DEFAULT '',
      outerItemDescription TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      finalisedAt TEXT,
      finalisedBy TEXT,
      createdAt TEXT NOT NULL
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploadedAt TEXT NOT NULL,
      containerContext TEXT,
      FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS manifest_items (
      id TEXT,
      caseId TEXT,
      label TEXT NOT NULL,
      parentId TEXT,
      quantity INTEGER NOT NULL,
      quantityKnown INTEGER NOT NULL DEFAULT 1,
      itemType TEXT NOT NULL DEFAULT 'property',
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      reviewReason TEXT,
      evidenceId TEXT,
      ocrText TEXT,
      visibleAttributes TEXT,
      currencyCode TEXT,
      denomination TEXT,
      currencyTotal TEXT,
      category TEXT DEFAULT 'other',
      source TEXT NOT NULL DEFAULT 'staff',
      PRIMARY KEY (id, caseId),
      FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
    )`, args: [] },
  ], "write");

  const caseColumns = (await db.execute("PRAGMA table_info(cases)")).rows as unknown as Array<{ name: string }>;
  if (!caseColumns.some((column) => column.name === "foundBy")) {
    await db.execute("ALTER TABLE cases ADD COLUMN foundBy TEXT DEFAULT ''");
  }

  let columns = (await db.execute("PRAGMA table_info(manifest_items)")).rows as unknown as Array<{ name: string; type: string }>;
  const refresh = async () => {
    columns = (await db.execute("PRAGMA table_info(manifest_items)")).rows as unknown as Array<{ name: string; type: string }>;
  };
  const addColumn = async (name: string, definition: string) => {
    if (!columns.some((column) => column.name === name)) {
      await db.execute(`ALTER TABLE manifest_items ADD COLUMN ${name} ${definition}`);
      await refresh();
    }
  };

  if (!columns.some((column) => column.name === "source")) {
    await db.batch([
      { sql: "ALTER TABLE manifest_items ADD COLUMN source TEXT NOT NULL DEFAULT 'staff'", args: [] },
      { sql: "UPDATE manifest_items SET source = 'system' WHERE id = 'outer-item-root'", args: [] },
    ], "write");
    await refresh();
  }
  await addColumn("quantityKnown", "INTEGER NOT NULL DEFAULT 1");
  await addColumn("itemType", "TEXT NOT NULL DEFAULT 'property'");
  await addColumn("currencyCode", "TEXT");
  await addColumn("category", "TEXT DEFAULT 'other'");

  for (const name of ["denomination", "currencyTotal"] as const) {
    const column = columns.find((candidate) => candidate.name === name);
    if (!column) {
      await addColumn(name, "TEXT");
    } else if (column.type.toUpperCase() !== "TEXT") {
      const legacyName = `${name}Legacy`;
      await db.batch([
        { sql: `ALTER TABLE manifest_items RENAME COLUMN ${name} TO ${legacyName}`, args: [] },
        { sql: `ALTER TABLE manifest_items ADD COLUMN ${name} TEXT`, args: [] },
        { sql: `UPDATE manifest_items SET ${name} = CAST(${legacyName} AS TEXT) WHERE ${legacyName} IS NOT NULL`, args: [] },
      ], "write");
      await refresh();
    }
  }
  await db.execute(`UPDATE manifest_items SET itemType = 'currency'
    WHERE currencyCode IS NOT NULL OR denomination IS NOT NULL OR currencyTotal IS NOT NULL`);
}

export async function getDbInstance(): Promise<DbClient> {
  if (!dbInstance) dbInstance = createDbClient();
  if (!schemaPromise) schemaPromise = initializeSchema(dbInstance);
  await schemaPromise;
  return dbInstance;
}

export function closeDb(): void {
  dbInstance?.close();
  dbInstance = null;
  schemaPromise = null;
}

interface CaseRow {
  id: string; isDemo: number; location: string; foundTime: string; foundBy: string; outerItemDescription: string;
  notes: string; status: string; finalisedAt: string | null; finalisedBy: string | null; createdAt: string;
}
interface UploadRow {
  id: string; filename: string; originalName: string; mimeType: string; size: number;
  uploadedAt: string; containerContext: string | null;
}
interface ManifestItemRow {
  id: string; label: string; parentId: string | null; quantity: number; quantityKnown: number; itemType: string;
  status: string; confidence: number; reviewReason: string | null; evidenceId: string | null; ocrText: string | null;
  visibleAttributes: string | null; currencyCode: string | null; denomination: string | number | null;
  currencyTotal: string | number | null; category: string | null; source: string;
}
interface AuditLogRow {
  id: string; timestamp: string; userId: string; action: string; details: string;
}

export async function getCases(): Promise<Case[]> {
  const db = await getDbInstance();
  const rows = (await db.execute("SELECT id FROM cases ORDER BY createdAt DESC")).rows as unknown as Array<{ id: string }>;
  const cases = await Promise.all(rows.map((row) => getCaseById(row.id)));
  return cases.filter((entry): entry is Case => Boolean(entry));
}

export async function getCaseById(id: string): Promise<Case | undefined> {
  const db = await getDbInstance();
  const [caseResult, uploadResult, manifestResult, auditResult] = await Promise.all([
    db.execute({ sql: "SELECT * FROM cases WHERE id = ?", args: [id] }),
    db.execute({ sql: "SELECT * FROM uploads WHERE caseId = ? ORDER BY uploadedAt ASC", args: [id] }),
    db.execute({ sql: "SELECT * FROM manifest_items WHERE caseId = ?", args: [id] }),
    db.execute({ sql: "SELECT * FROM audit_logs WHERE caseId = ? ORDER BY timestamp ASC", args: [id] }),
  ]);
  const caseRow = caseResult.rows[0] as unknown as CaseRow | undefined;
  if (!caseRow) return undefined;

  const uploads = (uploadResult.rows as unknown as UploadRow[]).map((upload) => ({
    id: upload.id,
    filename: upload.filename,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    size: Number(upload.size),
    uploadedAt: upload.uploadedAt,
    containerContext: upload.containerContext || undefined,
  }));
  const manifest = (manifestResult.rows as unknown as ManifestItemRow[]).map((item) => ({
    id: item.id,
    label: item.label,
    parentId: item.parentId || null,
    quantity: Number(item.quantity),
    quantityKnown: Boolean(item.quantityKnown),
    itemType: item.itemType === "currency" ? "currency" as const : "property" as const,
    status: item.status as "confirmed" | "review",
    confidence: Number(item.confidence),
    reviewReason: item.reviewReason || null,
    evidenceId: item.evidenceId || null,
    ocrText: item.ocrText || undefined,
    visibleAttributes: item.visibleAttributes || undefined,
    currencyCode: item.currencyCode || null,
    denomination: normalizeDecimal(item.denomination),
    currencyTotal: normalizeDecimal(item.currencyTotal),
    category: item.category || "other",
    source: (item.source === "ai" || item.source === "system" ? item.source : "staff") as ManifestItem["source"],
  }));
  const auditLogs = (auditResult.rows as unknown as AuditLogRow[]).map((log) => ({ ...log }));

  return {
    id: caseRow.id,
    isDemo: Boolean(caseRow.isDemo),
    location: caseRow.location,
    foundTime: caseRow.foundTime,
    foundBy: caseRow.foundBy || "",
    outerItemDescription: caseRow.outerItemDescription,
    notes: caseRow.notes || "",
    status: caseRow.status as "reviewing" | "finalised",
    finalisedAt: caseRow.finalisedAt || null,
    finalisedBy: caseRow.finalisedBy || null,
    uploads,
    manifest,
    auditLogs,
    createdAt: caseRow.createdAt,
  };
}

export function generateCaseId(location?: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let locationTag = "LOC";
  if (location) {
    const words = location.trim().replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
    if (words.length >= 2) locationTag = `${words[0][0]}${words[1]}`.toUpperCase().slice(0, 5);
    else if (words.length === 1) locationTag = words[0].toUpperCase().slice(0, 5);
  }
  return `${locationTag}-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function createCase(caseData: Partial<Case> & { location: string; foundTime: string; outerItemDescription: string }): Promise<Case> {
  const db = await getDbInstance();
  const id = generateCaseId(caseData.location);
  const createdAt = new Date().toISOString();
  const logId = `log-${crypto.randomUUID()}`;
  await db.batch([
    { sql: `INSERT INTO cases (id, isDemo, location, foundTime, foundBy, outerItemDescription, notes, status, finalisedAt, finalisedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [id, caseData.isDemo ? 1 : 0, caseData.location, caseData.foundTime, caseData.foundBy || "", caseData.outerItemDescription, caseData.notes || "", "reviewing", null, null, createdAt] },
    { sql: `INSERT INTO manifest_items (id, caseId, label, parentId, quantity, status, confidence, reviewReason, evidenceId, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: ["outer-item-root", id, caseData.outerItemDescription, null, 1, "confirmed", 1, null, "manual-creation", "system"] },
    { sql: `INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [logId, id, createdAt, caseData.finalisedBy || "staff", "case_created", `Case created with outer property: ${caseData.outerItemDescription} at ${caseData.location}`] },
  ], "write");
  const created = await getCaseById(id);
  if (!created) throw new Error("CRITICAL DATABASE ERROR: Failed to create and retrieve case.");
  return created;
}

function updateStatements(id: string, updatedCase: Case): Statement[] {
  const statements: Statement[] = [
    { sql: `UPDATE cases SET location = ?, foundTime = ?, foundBy = ?, outerItemDescription = ?, notes = ?, status = ?, finalisedAt = ?, finalisedBy = ? WHERE id = ?`,
      args: [updatedCase.location, updatedCase.foundTime, updatedCase.foundBy, updatedCase.outerItemDescription, updatedCase.notes, updatedCase.status, updatedCase.finalisedAt, updatedCase.finalisedBy, id] },
    { sql: "DELETE FROM uploads WHERE caseId = ?", args: [id] },
  ];
  for (const upload of updatedCase.uploads) {
    statements.push({ sql: `INSERT INTO uploads (id, caseId, filename, originalName, mimeType, size, uploadedAt, containerContext) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [upload.id, id, upload.filename, upload.originalName, upload.mimeType, upload.size, upload.uploadedAt, upload.containerContext || null] });
  }
  statements.push({ sql: "DELETE FROM manifest_items WHERE caseId = ?", args: [id] });
  for (const item of updatedCase.manifest) {
    statements.push({ sql: `INSERT INTO manifest_items (id, caseId, label, parentId, quantity, quantityKnown, itemType, status, confidence, reviewReason, evidenceId, ocrText, visibleAttributes, currencyCode, denomination, currencyTotal, category, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [item.id, id, item.label, item.parentId, item.quantity, item.quantityKnown === false ? 0 : 1, item.itemType ?? "property", item.status, item.confidence, item.reviewReason, item.evidenceId, item.ocrText || null, item.visibleAttributes || null, item.currencyCode || null, item.denomination ?? null, item.currencyTotal ?? null, item.category || "other", item.source || (item.id === "outer-item-root" ? "system" : "staff")] });
  }
  return statements;
}

export async function updateCase(id: string, updatedCase: Case): Promise<Case> {
  const db = await getDbInstance();
  const existing = await db.execute({ sql: "SELECT 1 FROM cases WHERE id = ?", args: [id] });
  if (existing.rows.length === 0) throw new Error(`Case ${id} not found`);
  await db.batch(updateStatements(id, updatedCase), "write");
  const updated = await getCaseById(id);
  if (!updated) throw new Error("CRITICAL DATABASE ERROR: Failed to update and retrieve case.");
  return updated;
}

export async function updateCaseWithAudit(id: string, updatedCase: Case, userId: string, action: string, details: string): Promise<Case> {
  const db = await getDbInstance();
  const existing = await db.execute({ sql: "SELECT 1 FROM cases WHERE id = ?", args: [id] });
  if (existing.rows.length === 0) throw new Error(`Case ${id} not found`);
  const statements = updateStatements(id, updatedCase);
  statements.push({ sql: `INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`log-${crypto.randomUUID()}`, id, new Date().toISOString(), userId, action, details] });
  await db.batch(statements, "write");
  const updated = await getCaseById(id);
  if (!updated) throw new Error("CRITICAL DATABASE ERROR: Failed to update and retrieve case.");
  return updated;
}

export async function addAuditLog(id: string, userId: string, action: string, details: string): Promise<void> {
  const db = await getDbInstance();
  const existing = await db.execute({ sql: "SELECT 1 FROM cases WHERE id = ?", args: [id] });
  if (existing.rows.length === 0) return;
  await db.execute({ sql: `INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [`log-${crypto.randomUUID()}`, id, new Date().toISOString(), userId, action, details] });
}

export async function seedDemoCase(): Promise<Case> {
  const db = await getDbInstance();
  const id = "CT3A-20260721-DEMO";
  const createdAt = "2026-07-21T09:30:00.000Z";
  const evidenceId = "demo-evidence-1";
  const evidenceFilename = "demo-staged-evidence.webp";
  const existingResult = await db.execute({ sql: "SELECT isDemo FROM cases WHERE id = ?", args: [id] });
  const existing = existingResult.rows[0] as unknown as { isDemo: number } | undefined;
  if (existing && !existing.isDemo) throw new Error(`Cannot replace non-demo case ${id}`);

  const evidence = await readDemoEvidence();
  await writeEvidence(evidenceFilename, evidence, "image/webp");
  const items: ManifestItem[] = [
    { id: "outer-item-root", label: "Black backpack", parentId: null, quantity: 1, confidence: 1, status: "confirmed", reviewReason: null, evidenceId, ocrText: "", visibleAttributes: "Colour: black; condition: clean; main compartment open", category: "bags", source: "system" },
    { id: "pouch", label: "Brown coin pouch", parentId: "outer-item-root", quantity: 1, confidence: 0.98, status: "confirmed", reviewReason: null, evidenceId, ocrText: "", visibleAttributes: "Brown leather; zip closure; open", category: "bags", source: "system" },
    { id: "sgd-100", label: "Singapore 100-dollar specimen note", parentId: "pouch", quantity: 1, quantityKnown: true, itemType: "currency", confidence: 0.99, status: "review", reviewReason: "Currency amount requires staff confirmation before custody approval.", evidenceId, ocrText: "SPECIMEN · SINGAPORE · 100 · ZX0000241", visibleAttributes: "Orange specimen note", currencyCode: "SGD", denomination: "100", currencyTotal: "100", source: "system" },
    { id: "sgd-1-coins", label: "Singapore 1-dollar specimen coins", parentId: "pouch", quantity: 3, quantityKnown: true, itemType: "currency", confidence: 0.98, status: "review", reviewReason: "Coin count and denomination require staff confirmation.", evidenceId, ocrText: "SGD 1", visibleAttributes: "Three gold-colour synthetic coins marked SGD 1", currencyCode: "SGD", denomination: "1", currencyTotal: "3", source: "system" },
    { id: "sgd-050-coins", label: "Singapore 50-cent specimen coins", parentId: "pouch", quantity: 2, quantityKnown: true, itemType: "currency", confidence: 0.98, status: "review", reviewReason: "Coin count and denomination require staff confirmation.", evidenceId, ocrText: "SGD 0.50", visibleAttributes: "Two silver-colour synthetic coins marked SGD 0.50", currencyCode: "SGD", denomination: "0.5", currencyTotal: "1", source: "system" },
    { id: "myr-50", label: "Malaysian 50-ringgit specimen note", parentId: "pouch", quantity: 1, quantityKnown: true, itemType: "currency", confidence: 0.99, status: "review", reviewReason: "Currency amount requires staff confirmation before custody approval.", evidenceId, ocrText: "SPECIMEN · BANK NEGARA MALAYSIA · 50 · MYX0000241", visibleAttributes: "Blue-green specimen note", currencyCode: "MYR", denomination: "50", currencyTotal: "50", source: "system" },
    { id: "myr-020-coins", label: "Malaysian 20-sen specimen coins", parentId: "pouch", quantity: 2, quantityKnown: true, itemType: "currency", confidence: 0.98, status: "review", reviewReason: "Coin count and denomination require staff confirmation.", evidenceId, ocrText: "MYR 0.20", visibleAttributes: "Two gold-colour synthetic coins marked MYR 0.20", currencyCode: "MYR", denomination: "0.2", currencyTotal: "0.4", source: "system" },
    { id: "cable", label: "White USB-C charging cable", parentId: "outer-item-root", quantity: 1, confidence: 0.99, status: "confirmed", reviewReason: null, evidenceId, ocrText: "", visibleAttributes: "White; coiled; USB-C connectors", source: "system" },
    { id: "cardholder", label: "Black leather cardholder", parentId: "outer-item-root", quantity: 1, confidence: 0.98, status: "confirmed", reviewReason: null, evidenceId, ocrText: "", visibleAttributes: "Black leather; empty card slots", source: "system" },
    { id: "notebook", label: "Plain kraft notebook", parentId: "outer-item-root", quantity: 1, confidence: 0.97, status: "confirmed", reviewReason: null, evidenceId, ocrText: "", visibleAttributes: "Plain brown cover; no visible writing", source: "system" },
    { id: "tag", label: "Orange luggage tag", parentId: "outer-item-root", quantity: 1, confidence: 0.99, status: "confirmed", reviewReason: null, evidenceId, ocrText: "SAMPLE-0241", visibleAttributes: "Orange synthetic demo tag", source: "system" },
  ];
  for (const item of items) {
    if (item.itemType === "currency") item.category = "cash";
    else if (item.id === "cable") item.category = "electronics";
    else if (item.id === "notebook") item.category = "books";
    else if (!item.category) item.category = "other";
  }
  const statements: Statement[] = [
    { sql: "DELETE FROM audit_logs WHERE caseId = ?", args: ["FF-0241"] },
    { sql: "DELETE FROM manifest_items WHERE caseId = ?", args: ["FF-0241"] },
    { sql: "DELETE FROM uploads WHERE caseId = ?", args: ["FF-0241"] },
    { sql: "DELETE FROM cases WHERE id = ? AND isDemo = 1", args: ["FF-0241"] },
    { sql: "DELETE FROM audit_logs WHERE caseId = ?", args: [id] },
    { sql: "DELETE FROM manifest_items WHERE caseId = ?", args: [id] },
    { sql: "DELETE FROM uploads WHERE caseId = ?", args: [id] },
    { sql: "DELETE FROM cases WHERE id = ?", args: [id] },
    { sql: `INSERT INTO cases (id, isDemo, location, foundTime, foundBy, outerItemDescription, notes, status, finalisedAt, finalisedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, 1, "Changi Airport Terminal 3 Arrivals", createdAt, "Demo staff", "Black backpack", "Staged synthetic property for the FoundFlow demonstration. No passenger data is present.", "reviewing", null, null, createdAt] },
    { sql: `INSERT INTO uploads (id, caseId, filename, originalName, mimeType, size, uploadedAt, containerContext) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [evidenceId, id, evidenceFilename, "staged-found-property.webp", "image/webp", evidence.byteLength, "2026-07-21T09:31:00.000Z", "bag-contents"] },
  ];
  for (const item of items) {
    statements.push({ sql: `INSERT INTO manifest_items (id, caseId, label, parentId, quantity, quantityKnown, itemType, status, confidence, reviewReason, evidenceId, ocrText, visibleAttributes, currencyCode, denomination, currencyTotal, category, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [item.id, id, item.label, item.parentId, item.quantity, item.quantityKnown === false ? 0 : 1, item.itemType ?? "property", item.status, item.confidence, item.reviewReason, item.evidenceId, item.ocrText ?? null, item.visibleAttributes ?? null, item.currencyCode ?? null, item.denomination ?? null, item.currencyTotal ?? null, item.category ?? "other", item.source ?? "system"] });
  }
  const logs = [
    ["log-1", createdAt, "demo-staff", "case_created", "Demo case created from a staged synthetic found-property set"],
    ["log-2", "2026-07-21T09:31:00.000Z", "demo-staff", "evidence_uploaded", "Staged synthetic evidence linked to the bag-contents level"],
    ["log-3", "2026-07-21T09:32:00.000Z", "demo-staff", "demo_seeded", "Deterministic sample manifest loaded; no live AI call was made"],
  ];
  for (const [logId, timestamp, userId, action, details] of logs) {
    statements.push({ sql: `INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details) VALUES (?, ?, ?, ?, ?, ?)`, args: [logId, id, timestamp, userId, action, details] });
  }
  await db.batch(statements, "write");
  const seeded = await getCaseById(id);
  if (!seeded) throw new Error("CRITICAL DATABASE ERROR: Failed to seed demo case");
  return seeded;
}
