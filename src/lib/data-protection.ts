import crypto from "node:crypto";

export type DataProtectionMode = "required" | "optional" | "disabled";

const TEXT_PREFIX = "ffenc:v1:";
const BINARY_MAGIC = Buffer.from("FFENC1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

interface DataKey {
  id: string;
  value: Buffer;
}

export function getDataProtectionMode(): DataProtectionMode {
  const configured = process.env.DATA_PROTECTION_MODE;
  if (configured === "required" || configured === "optional" || configured === "disabled") return configured;
  if (configured) throw new Error("DATA_PROTECTION_MODE must be required, optional, or disabled");
  return process.env.NODE_ENV === "production" ? "required" : "optional";
}

function parseKeyring(): DataKey[] {
  const raw = process.env.DATA_ENCRYPTION_KEYS?.trim();
  if (!raw) return [];

  const seen = new Set<string>();
  return raw.split(",").map((entry) => {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error("DATA_ENCRYPTION_KEYS entries must use key-id:base64-key");
    const id = entry.slice(0, separator).trim();
    const encoded = entry.slice(separator + 1).trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw new Error("Data-encryption key IDs must contain 1-32 URL-safe characters");
    if (seen.has(id)) throw new Error(`Data-encryption key ID ${id} is duplicated`);
    seen.add(id);
    if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error(`Data-encryption key ${id} must use canonical base64`);
    const value = Buffer.from(encoded, "base64");
    if (value.length !== 32) throw new Error(`Data-encryption key ${id} must decode to exactly 32 bytes`);
    return { id, value };
  });
}

function keyringForOperation(): DataKey[] {
  const mode = getDataProtectionMode();
  if (mode === "disabled") return [];
  const keys = parseKeyring();
  if (mode === "required" && keys.length === 0) {
    throw new Error("CRITICAL SECURITY ERROR: DATA_ENCRYPTION_KEYS is required when data protection is required");
  }
  return keys;
}

export function assertDataProtectionReady(): void {
  keyringForOperation();
}

function aad(scope: string): Buffer {
  if (!/^[A-Za-z0-9:._/-]{1,160}$/.test(scope)) throw new Error("Invalid data-protection scope");
  return Buffer.from(`foundflow:v1:${scope}`, "utf8");
}

function encrypt(data: Buffer, scope: string, key: DataKey): { iv: Buffer; tag: Buffer; ciphertext: Buffer } {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key.value, iv);
  cipher.setAAD(aad(scope));
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function decrypt(iv: Buffer, tag: Buffer, ciphertext: Buffer, scope: string, key: DataKey): Buffer {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key.value, iv);
  decipher.setAAD(aad(scope));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function keyById(keys: DataKey[], id: string): DataKey {
  const key = keys.find((candidate) => candidate.id === id);
  if (!key) throw new Error(`CRITICAL SECURITY ERROR: Data-encryption key ${id} is unavailable`);
  return key;
}

export function isProtectedText(value: string): boolean {
  return value.startsWith(TEXT_PREFIX);
}

export function getActiveDataKeyId(): string | null {
  return keyringForOperation()[0]?.id ?? null;
}

export function protectedTextKeyId(value: string): string | null {
  if (!isProtectedText(value)) return null;
  const separator = value.indexOf(":", TEXT_PREFIX.length);
  return separator < 0 ? null : value.slice(TEXT_PREFIX.length, separator);
}

export function protectText(value: string | null | undefined, scope: string): string | null {
  if (value === null || value === undefined) return null;
  const keys = keyringForOperation();
  if (keys.length === 0) return value;
  const { iv, tag, ciphertext } = encrypt(Buffer.from(value, "utf8"), scope, keys[0]);
  const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64url");
  return `${TEXT_PREFIX}${keys[0].id}:${payload}`;
}

export function unprotectText(value: string | null | undefined, scope: string): string | null {
  if (value === null || value === undefined) return null;
  if (!isProtectedText(value)) return value;
  const keys = keyringForOperation();
  const separator = value.indexOf(":", TEXT_PREFIX.length);
  if (separator < 0) throw new Error("Invalid protected text envelope");
  const keyId = value.slice(TEXT_PREFIX.length, separator);
  const payload = Buffer.from(value.slice(separator + 1), "base64url");
  if (payload.length < IV_BYTES + TAG_BYTES) throw new Error("Invalid protected text payload");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);
  return decrypt(iv, tag, ciphertext, scope, keyById(keys, keyId)).toString("utf8");
}

export function isProtectedBuffer(value: Buffer): boolean {
  return value.length > BINARY_MAGIC.length && value.subarray(0, BINARY_MAGIC.length).equals(BINARY_MAGIC);
}

export function protectBuffer(value: Buffer, scope: string): Buffer {
  const keys = keyringForOperation();
  if (keys.length === 0) return value;
  const keyId = Buffer.from(keys[0].id, "utf8");
  const { iv, tag, ciphertext } = encrypt(value, scope, keys[0]);
  return Buffer.concat([BINARY_MAGIC, Buffer.from([keyId.length]), keyId, iv, tag, ciphertext]);
}

export function unprotectBuffer(value: Buffer, scope: string): Buffer {
  if (!isProtectedBuffer(value)) return value;
  const keys = keyringForOperation();
  const keyLength = value[BINARY_MAGIC.length];
  const headerLength = BINARY_MAGIC.length + 1 + keyLength + IV_BYTES + TAG_BYTES;
  if (keyLength < 1 || keyLength > 32 || value.length < headerLength) throw new Error("Invalid protected binary envelope");
  const keyStart = BINARY_MAGIC.length + 1;
  const keyId = value.subarray(keyStart, keyStart + keyLength).toString("utf8");
  const ivStart = keyStart + keyLength;
  const iv = value.subarray(ivStart, ivStart + IV_BYTES);
  const tag = value.subarray(ivStart + IV_BYTES, ivStart + IV_BYTES + TAG_BYTES);
  const ciphertext = value.subarray(ivStart + IV_BYTES + TAG_BYTES);
  return decrypt(iv, tag, ciphertext, scope, keyById(keys, keyId));
}
