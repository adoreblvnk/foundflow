import fs from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

const BLOB_PREFIX = "evidence";

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
  if (usesBlobStorage()) {
    await put(blobPath(filename), data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }

  const uploadsDir = localUploadsDir();
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, filename), data);
}

export async function readEvidence(filename: string): Promise<Buffer | null> {
  if (usesBlobStorage()) {
    const result = await get(blobPath(filename), {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  try {
    return await fs.readFile(path.join(localUploadsDir(), filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteEvidence(filename: string): Promise<void> {
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
    return await fs.readFile(path.join(process.cwd(), "public", "demo", "found-property-evidence.webp"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (!host) throw new Error("Vercel deployment URL is unavailable for the demo fixture");
  const response = await fetch(`https://${host}/demo/found-property-evidence.webp`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Demo evidence fixture returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
