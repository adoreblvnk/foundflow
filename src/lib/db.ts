import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface EvidenceUpload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  containerContext?: string; // e.g. "bag", "pouch", "outer-item"
}

export interface ManifestItem {
  id: string;
  label: string;
  parentId: string | null;
  quantity: number;
  status: "confirmed" | "review";
  confidence: number;
  reviewReason: string | null;
  evidenceId: string | null; // linked to EvidenceUpload.id, "staff-added", or "manual-creation"
  ocrText?: string;
  visibleAttributes?: string;
  source?: "ai" | "staff" | "system";
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string; // "case_created", "evidence_uploaded", "ai_analysis_triggered", "item_confirmed", "item_updated", "item_added", "item_deleted", "case_finalised", "manifest_exported", "demo_seeded"
  details: string;
}

export interface Case {
  id: string; // cryptographically random UUID; the optional demo fixture keeps its human-readable ID
  isDemo?: boolean;
  location: string;
  foundTime: string;
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

let dbInstance: DatabaseSync | null = null;

export function getDbPath(): string {
  const DATA_DIR = process.env.DATA_DIR || "./data";
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return path.join(/*turbopackIgnore: true*/ DATA_DIR, "foundflow.db");
}

export function getDbInstance(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const dbPath = getDbPath();
  dbInstance = new DatabaseSync(dbPath);

  // Enable foreign keys
  dbInstance.exec("PRAGMA foreign_keys = ON;");

  // Create tables with normalized schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      isDemo INTEGER DEFAULT 0,
      location TEXT NOT NULL,
      foundTime TEXT NOT NULL,
      outerItemDescription TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      finalisedAt TEXT,
      finalisedBy TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      filename TEXT NOT NULL,
      originalName TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploadedAt TEXT NOT NULL,
      containerContext TEXT,
      FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manifest_items (
      id TEXT,
      caseId TEXT,
      label TEXT NOT NULL,
      parentId TEXT,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      reviewReason TEXT,
      evidenceId TEXT,
      ocrText TEXT,
      visibleAttributes TEXT,
      source TEXT NOT NULL DEFAULT 'staff',
      PRIMARY KEY (id, caseId),
      FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      FOREIGN KEY (caseId) REFERENCES cases(id) ON DELETE CASCADE
    );
  `);

  const manifestColumns = dbInstance.prepare("PRAGMA table_info(manifest_items)").all() as unknown as Array<{ name: string }>;
  if (!manifestColumns.some((column) => column.name === "source")) {
    dbInstance.exec("ALTER TABLE manifest_items ADD COLUMN source TEXT NOT NULL DEFAULT 'staff'");
    dbInstance.exec("UPDATE manifest_items SET source = 'system' WHERE id = 'outer-item-root'");
  }

  return dbInstance;
}

// Reset the singleton instance (primarily for testing with isolated databases)
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = null;
}

// Global flag to track active transaction
let inTransaction = false;

// Transaction execution wrapper
export function runInTransaction<T>(fn: () => T): T {
  if (inTransaction) {
    return fn(); // Already nested inside a transaction
  }
  const db = getDbInstance();
  db.exec("BEGIN TRANSACTION");
  inTransaction = true;
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    inTransaction = false;
  }
}

interface CaseRow {
  id: string;
  isDemo: number;
  location: string;
  foundTime: string;
  outerItemDescription: string;
  notes: string;
  status: string;
  finalisedAt: string | null;
  finalisedBy: string | null;
  createdAt: string;
}

interface UploadRow {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  containerContext: string | null;
}

interface ManifestItemRow {
  id: string;
  label: string;
  parentId: string | null;
  quantity: number;
  status: string;
  confidence: number;
  reviewReason: string | null;
  evidenceId: string | null;
  ocrText: string | null;
  visibleAttributes: string | null;
  source: string;
}

interface AuditLogRow {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  details: string;
}

export function getCases(): Case[] {
  const db = getDbInstance();
  const rows = db.prepare("SELECT id FROM cases ORDER BY createdAt DESC").all() as { id: string }[];
  const cases: Case[] = [];
  for (const r of rows) {
    const c = getCaseById(r.id);
    if (c) cases.push(c);
  }
  return cases;
}

export function getCaseById(id: string): Case | undefined {
  const db = getDbInstance();
  const caseRow = db.prepare("SELECT * FROM cases WHERE id = ?").get(id) as CaseRow | undefined;
  if (!caseRow) return undefined;

  // Retrieve uploads
  const uploadRows = db.prepare("SELECT * FROM uploads WHERE caseId = ? ORDER BY uploadedAt ASC").all(id) as unknown as UploadRow[];
  const uploads: EvidenceUpload[] = uploadRows.map((u) => ({
    id: u.id,
    filename: u.filename,
    originalName: u.originalName,
    mimeType: u.mimeType,
    size: Number(u.size),
    uploadedAt: u.uploadedAt,
    containerContext: u.containerContext || undefined,
  }));

  // Retrieve manifest items
  const manifestRows = db.prepare("SELECT * FROM manifest_items WHERE caseId = ?").all(id) as unknown as ManifestItemRow[];
  const manifest: ManifestItem[] = manifestRows.map((m) => ({
    id: m.id,
    label: m.label,
    parentId: m.parentId || null,
    quantity: Number(m.quantity),
    status: m.status as "confirmed" | "review",
    confidence: Number(m.confidence),
    reviewReason: m.reviewReason || null,
    evidenceId: m.evidenceId || null,
    ocrText: m.ocrText || undefined,
    visibleAttributes: m.visibleAttributes || undefined,
    source: m.source === "ai" || m.source === "system" ? m.source : "staff",
  }));

  // Retrieve audit logs
  const auditRows = db.prepare("SELECT * FROM audit_logs WHERE caseId = ? ORDER BY timestamp ASC").all(id) as unknown as AuditLogRow[];
  const auditLogs: AuditLog[] = auditRows.map((a) => ({
    id: a.id,
    timestamp: a.timestamp,
    userId: a.userId,
    action: a.action,
    details: a.details,
  }));

  return {
    id: caseRow.id,
    isDemo: Boolean(caseRow.isDemo),
    location: caseRow.location,
    foundTime: caseRow.foundTime,
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

export function generateCaseId(): string {
  return crypto.randomUUID();
}

export function createCase(caseData: Partial<Case> & { location: string; foundTime: string; outerItemDescription: string }): Case {
  const db = getDbInstance();
  const id = generateCaseId();
  const isDemo = caseData.isDemo ? 1 : 0;
  const location = caseData.location;
  const foundTime = caseData.foundTime;
  const outerItemDescription = caseData.outerItemDescription;
  const notes = caseData.notes || "";
  const status = "reviewing";
  const finalisedAt = null;
  const finalisedBy = null;
  const createdAt = new Date().toISOString();

  runInTransaction(() => {
    db.prepare(`
      INSERT INTO cases (id, isDemo, location, foundTime, outerItemDescription, notes, status, finalisedAt, finalisedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, isDemo, location, foundTime, outerItemDescription, notes, status, finalisedAt, finalisedBy, createdAt);

    // Initial manifest item (root) representing the outer container
    db.prepare(`
      INSERT INTO manifest_items (id, caseId, label, parentId, quantity, status, confidence, reviewReason, evidenceId, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "outer-item-root",
      id,
      outerItemDescription,
      null,
      1,
      "confirmed",
      1.0,
      null,
      "manual-creation",
      "system"
    );

    // Initial audit log
    const logId = `log-${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      id,
      createdAt,
      caseData.finalisedBy || "staff",
      "case_created",
      `Case created with outer property: ${outerItemDescription} at ${location}`
    );
  });

  const created = getCaseById(id);
  if (!created) throw new Error("CRITICAL DATABASE ERROR: Failed to create and retrieve case.");
  return created;
}

export function updateCase(id: string, updatedCase: Case): Case {
  const db = getDbInstance();

  // Verify case existence
  const existing = db.prepare("SELECT 1 FROM cases WHERE id = ?").get(id);
  if (!existing) {
    throw new Error(`Case ${id} not found`);
  }

  runInTransaction(() => {
    // Update main case details
    db.prepare(`
      UPDATE cases
      SET location = ?, foundTime = ?, outerItemDescription = ?, notes = ?, status = ?, finalisedAt = ?, finalisedBy = ?
      WHERE id = ?
    `).run(
      updatedCase.location,
      updatedCase.foundTime,
      updatedCase.outerItemDescription,
      updatedCase.notes,
      updatedCase.status,
      updatedCase.finalisedAt,
      updatedCase.finalisedBy,
      id
    );

    // Re-sync uploads
    db.prepare("DELETE FROM uploads WHERE caseId = ?").run(id);
    const insertUpload = db.prepare(`
      INSERT INTO uploads (id, caseId, filename, originalName, mimeType, size, uploadedAt, containerContext)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const u of updatedCase.uploads) {
      insertUpload.run(
        u.id,
        id,
        u.filename,
        u.originalName,
        u.mimeType,
        u.size,
        u.uploadedAt,
        u.containerContext || null
      );
    }

    // Re-sync manifest items (audit logs are completely untouched and append-only)
    db.prepare("DELETE FROM manifest_items WHERE caseId = ?").run(id);
    const insertItem = db.prepare(`
      INSERT INTO manifest_items (id, caseId, label, parentId, quantity, status, confidence, reviewReason, evidenceId, ocrText, visibleAttributes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of updatedCase.manifest) {
      insertItem.run(
        m.id,
        id,
        m.label,
        m.parentId,
        m.quantity,
        m.status,
        m.confidence,
        m.reviewReason,
        m.evidenceId,
        m.ocrText || null,
        m.visibleAttributes || null,
        m.source || (m.id === "outer-item-root" ? "system" : "staff")
      );
    }
  });

  const updated = getCaseById(id);
  if (!updated) throw new Error("CRITICAL DATABASE ERROR: Failed to update and retrieve case.");
  return updated;
}

export function addAuditLog(id: string, userId: string, action: string, details: string) {
  const db = getDbInstance();

  // Verify case existence
  const existing = db.prepare("SELECT 1 FROM cases WHERE id = ?").get(id);
  if (!existing) return;

  const logId = `log-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(logId, id, timestamp, userId, action, details);
}

// Explicitly controlled seeding for the deterministic demo case.
export function seedDemoCase(): Case {
  const db = getDbInstance();
  const id = "FF-0241";
  const createdAt = "2026-07-21T09:30:00.000Z";
  const evidenceId = "demo-evidence-1";
  const evidenceFilename = "ff-0241-staged-evidence.webp";
  const sourcePath = path.join(process.cwd(), "public", "demo", "found-property-evidence.webp");
  const uploadsDir = path.join(process.env.DATA_DIR || "./data", "uploads");
  const destinationPath = path.join(uploadsDir, evidenceFilename);
  const existing = db.prepare("SELECT isDemo FROM cases WHERE id = ?").get(id) as { isDemo: number } | undefined;

  if (existing && !existing.isDemo) {
    throw new Error(`Cannot replace non-demo case ${id}`);
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Demo evidence fixture is missing: ${sourcePath}`);
  }
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  const evidenceSize = fs.statSync(destinationPath).size;

  runInTransaction(() => {
    if (existing) {
      db.prepare("DELETE FROM cases WHERE id = ?").run(id);
    }

    db.prepare(`
      INSERT INTO cases (id, isDemo, location, foundTime, outerItemDescription, notes, status, finalisedAt, finalisedBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      1,
      "Changi Airport Terminal 3 Arrivals",
      createdAt,
      "Black backpack",
      "Staged synthetic property for the FoundFlow demonstration. No passenger data is present.",
      "reviewing",
      null,
      null,
      createdAt
    );

    db.prepare(`
      INSERT INTO uploads (id, caseId, filename, originalName, mimeType, size, uploadedAt, containerContext)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evidenceId,
      id,
      evidenceFilename,
      "staged-found-property.webp",
      "image/webp",
      evidenceSize,
      "2026-07-21T09:31:00.000Z",
      "bag-contents"
    );

    const items = [
      { id: "outer-item-root", label: "Black backpack", parentId: null, quantity: 1, confidence: 1.0, status: "confirmed", reviewReason: null, ocrText: null, visibleAttributes: "Colour: black; condition: clean; main compartment open", source: "system" },
      { id: "pouch", label: "Brown coin pouch", parentId: "outer-item-root", quantity: 1, confidence: 0.98, status: "confirmed", reviewReason: null, ocrText: null, visibleAttributes: "Brown leather; zip closure; open", source: "system" },
      { id: "coins", label: "Mixed coins", parentId: "pouch", quantity: 7, confidence: 0.86, status: "review", reviewReason: "Staff must verify the count and denominations.", ocrText: "", visibleAttributes: "Seven metallic coins in mixed sizes and colours", source: "system" },
      { id: "sgd", label: "Singapore specimen note", parentId: "pouch", quantity: 1, confidence: 0.97, status: "review", reviewReason: "Currency requires staff confirmation before custody approval.", ocrText: "SPECIMEN · SINGAPORE · 100 · ZX0000241", visibleAttributes: "Orange specimen note", source: "system" },
      { id: "myr", label: "Malaysian specimen note", parentId: "pouch", quantity: 1, confidence: 0.96, status: "review", reviewReason: "Currency requires staff confirmation before custody approval.", ocrText: "SPECIMEN · BANK NEGARA MALAYSIA · 50 · MYX0000241", visibleAttributes: "Blue-green specimen note", source: "system" },
      { id: "cable", label: "White USB-C charging cable", parentId: "outer-item-root", quantity: 1, confidence: 0.99, status: "confirmed", reviewReason: null, ocrText: "", visibleAttributes: "White; coiled; USB-C connectors", source: "system" },
      { id: "cardholder", label: "Black leather cardholder", parentId: "outer-item-root", quantity: 1, confidence: 0.98, status: "confirmed", reviewReason: null, ocrText: "", visibleAttributes: "Black leather; empty card slots", source: "system" },
      { id: "notebook", label: "Plain kraft notebook", parentId: "outer-item-root", quantity: 1, confidence: 0.97, status: "confirmed", reviewReason: null, ocrText: "", visibleAttributes: "Plain brown cover; no visible writing", source: "system" },
      { id: "tag", label: "Orange luggage tag", parentId: "outer-item-root", quantity: 1, confidence: 0.99, status: "confirmed", reviewReason: null, ocrText: "SAMPLE-0241", visibleAttributes: "Orange synthetic demo tag", source: "system" },
    ] as const;

    const insertItem = db.prepare(`
      INSERT INTO manifest_items (id, caseId, label, parentId, quantity, status, confidence, reviewReason, evidenceId, ocrText, visibleAttributes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItem.run(
        item.id,
        id,
        item.label,
        item.parentId,
        item.quantity,
        item.status,
        item.confidence,
        item.reviewReason,
        evidenceId,
        item.ocrText,
        item.visibleAttributes,
        item.source
      );
    }

    const logs = [
      { id: "log-1", timestamp: createdAt, userId: "demo-staff", action: "case_created", details: "Demo case created from a staged synthetic found-property set" },
      { id: "log-2", timestamp: "2026-07-21T09:31:00.000Z", userId: "demo-staff", action: "evidence_uploaded", details: "Staged synthetic evidence linked to the bag-contents level" },
      { id: "log-3", timestamp: "2026-07-21T09:32:00.000Z", userId: "demo-staff", action: "demo_seeded", details: "Deterministic sample manifest loaded; no live AI call was made" },
    ];

    const insertLog = db.prepare(`
      INSERT INTO audit_logs (id, caseId, timestamp, userId, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const log of logs) {
      insertLog.run(log.id, id, log.timestamp, log.userId, log.action, log.details);
    }
  });

  const seeded = getCaseById(id);
  if (!seeded) throw new Error("CRITICAL DATABASE ERROR: Failed to seed demo case");
  return seeded;
}
