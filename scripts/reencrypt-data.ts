import { closeDb, getDbInstance } from "../src/lib/db.ts";
import { getActiveDataKeyId, protectText, protectedTextKeyId, unprotectText } from "../src/lib/data-protection.ts";
import { readEvidence, writeEvidence } from "../src/lib/evidence-storage.ts";

interface ProtectedColumn {
  table: string;
  idColumns: string[];
  fields: string[];
}

const protectedColumns: ProtectedColumn[] = [
  { table: "cases", idColumns: ["id"], fields: ["notes", "storageLocation"] },
  { table: "uploads", idColumns: ["id"], fields: ["originalName"] },
  { table: "manifest_items", idColumns: ["caseId", "id"], fields: ["ocrText", "nameOnItem", "lastFourChars", "serialNumber", "privateMatchingDetails"] },
  { table: "audit_logs", idColumns: ["id"], fields: ["details"] },
  { table: "claims", idColumns: ["id"], fields: ["lostReportId", "claimantName", "claimantContact", "maskedIdentifier", "verificationNotes", "decisionReason"] },
];

const apply = process.argv.includes("--apply");
if (process.env.DATA_PROTECTION_MODE !== "required") {
  throw new Error("Set DATA_PROTECTION_MODE=required before running the data-protection migration");
}

const db = await getDbInstance();
const activeKeyId = getActiveDataKeyId();
if (!activeKeyId) throw new Error("No active data-encryption key is configured");
let fieldCount = 0;
let rowCount = 0;

try {
  for (const definition of protectedColumns) {
    const selected = [...definition.idColumns, ...definition.fields].join(", ");
    const result = await db.execute(`SELECT ${selected} FROM ${definition.table}`);
    for (const row of result.rows) {
      const updates: Array<{ field: string; value: string }> = [];
      for (const field of definition.fields) {
        const stored = row[field];
        if (stored === null || stored === undefined) continue;
        if (protectedTextKeyId(String(stored)) === activeKeyId) continue;
        const scope = `db:${definition.table}.${field}`;
        const plain = unprotectText(String(stored), scope);
        if (plain === null) continue;
        const protectedValue = protectText(plain, scope);
        if (protectedValue && protectedValue !== stored) updates.push({ field, value: protectedValue });
      }
      if (updates.length === 0) continue;
      rowCount += 1;
      fieldCount += updates.length;
      if (!apply) continue;
      const setClause = updates.map(({ field }) => `${field} = ?`).join(", ");
      const whereClause = definition.idColumns.map((field) => `${field} = ?`).join(" AND ");
      await db.execute({
        sql: `UPDATE ${definition.table} SET ${setClause} WHERE ${whereClause}`,
        args: [...updates.map(({ value }) => value), ...definition.idColumns.map((field) => String(row[field]))],
      });
    }
  }

  const uploads = await db.execute("SELECT filename, mimeType FROM uploads");
  if (apply) {
    for (const upload of uploads.rows) {
      const filename = String(upload.filename);
      const data = await readEvidence(filename);
      if (!data) throw new Error("An expected item photo is missing during migration");
      await writeEvidence(filename, data, String(upload.mimeType));
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    databaseRows: rowCount,
    protectedFields: fieldCount,
    itemPhotos: uploads.rows.length,
  }));
} finally {
  closeDb();
}
