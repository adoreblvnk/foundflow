import fs from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { assertDataProtectionReady, isProtectedBuffer, protectBuffer, unprotectBuffer } from "./data-protection.ts";

const BLOB_PREFIX = "evidence";

function assertEvidenceFilename(filename: string): void {
  if (!filename || filename !== path.basename(filename) || filename.includes("\0") || filename.length > 200) {
    throw new Error("Invalid evidence filename");
  }
}

export function usesBlobStorage(): boolean {
  return process.env.STORAGE_MODE === "blob" || Boolean(process.env.VERCEL);
}

function localUploadsDir(): string {
  return path.join(process.env.DATA_DIR || "./data", "uploads");
}

function blobPath(filename: string): string {
  return `${BLOB_PREFIX}/${filename}`;
}

export async function writeEvidence(filename: string, data: Buffer, contentType: string): Promise<void> {
  assertDataProtectionReady();
  assertEvidenceFilename(filename);
  const storedData = protectBuffer(data, `evidence:${filename}`);
  const storedContentType = isProtectedBuffer(storedData) ? "application/octet-stream" : contentType;
  if (usesBlobStorage()) {
    await put(blobPath(filename), storedData, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: storedContentType,
    });
    return;
  }

  const uploadsDir = localUploadsDir();
  await fs.mkdir(uploadsDir, { recursive: true, mode: 0o700 });
  await fs.chmod(uploadsDir, 0o700);
  await fs.writeFile(path.join(uploadsDir, filename), storedData, { mode: 0o600 });
}

export async function readEvidence(filename: string): Promise<Buffer | null> {
  assertDataProtectionReady();
  assertEvidenceFilename(filename);
  if (usesBlobStorage()) {
    const result = await get(blobPath(filename), {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const storedData = Buffer.from(await new Response(result.stream).arrayBuffer());
    return unprotectBuffer(storedData, `evidence:${filename}`);
  }

  try {
    const storedData = await fs.readFile(path.join(localUploadsDir(), filename));
    return unprotectBuffer(storedData, `evidence:${filename}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteEvidence(filename: string): Promise<void> {
  assertDataProtectionReady();
  assertEvidenceFilename(filename);
  if (usesBlobStorage()) {
    await del(blobPath(filename));
    return;
  }

  try {
    await fs.unlink(path.join(localUploadsDir(), filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readDemoEvidence(): Promise<Buffer> {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", "demo", "found-item-evidence.webp"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (!host) throw new Error("Vercel deployment URL is unavailable for the demo fixture");
  const response = await fetch(`https://${host}/demo/found-item-evidence.webp`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Demo evidence fixture returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
