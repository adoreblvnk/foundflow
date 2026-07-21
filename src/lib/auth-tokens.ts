import crypto from "crypto";
import { z } from "zod";

// Zod Schema for robust session payload validation
export const sessionPayloadSchema = z.object({
  username: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

// Get and validate the AUTH_SECRET environment variable
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "CRITICAL SECURITY ERROR: AUTH_SECRET environment variable is not defined. " +
      "Provide a secure random string of at least 32 characters."
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "CRITICAL SECURITY ERROR: AUTH_SECRET is too short. " +
      "It must be at least 32 characters long to ensure cryptographic signing safety."
    );
  }
  return secret;
}

// Get and validate the LOGIN_PASSWORD environment variable
export function getLoginPassword(): string {
  const password = process.env.LOGIN_PASSWORD;
  if (!password) {
    throw new Error(
      "CRITICAL SECURITY ERROR: LOGIN_PASSWORD environment variable is not defined. " +
      "Please set a strong login password."
    );
  }
  if (password.length < 8) {
    throw new Error(
      "CRITICAL SECURITY ERROR: LOGIN_PASSWORD is too short. " +
      "It must be at least 8 characters long."
    );
  }
  return password;
}

// Get and validate the LOGIN_USERNAME environment variable
export function getLoginUsername(): string {
  const username = process.env.LOGIN_USERNAME;
  if (!username) {
    throw new Error(
      "CRITICAL SECURITY ERROR: LOGIN_USERNAME environment variable is not defined. " +
      "Please set a login username."
    );
  }
  if (username.length < 4) {
    throw new Error(
      "CRITICAL SECURITY ERROR: LOGIN_USERNAME is too short. " +
      "It must be at least 4 characters long."
    );
  }
  return username;
}

// Constant-time string comparison using SHA-256 hashes to mitigate timing attacks
export function timingSafeCompare(str1: string, str2: string): boolean {
  const hash1 = crypto.createHash("sha256").update(str1).digest();
  const hash2 = crypto.createHash("sha256").update(str2).digest();
  return crypto.timingSafeEqual(hash1, hash2);
}

// Simple secure session signing using HMAC
export function signSession(username: string, expiresMs: number = 24 * 60 * 60 * 1000): string {
  const secret = getAuthSecret();
  const expiresAt = Date.now() + expiresMs;
  const payload: SessionPayload = { username, expiresAt };
  const payloadStr = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadStr);
  const signature = hmac.digest("hex");
  return `${Buffer.from(payloadStr).toString("base64")}.${signature}`;
}

// Pure session verification function
export function verifySession(token: string): { username: string } | null {
  try {
    const secret = getAuthSecret();
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadBase64, signature] = parts;
    if (!payloadBase64 || !signature) return null;

    const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf8");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payloadStr);
    const expectedSignature = hmac.digest("hex");

    if (!timingSafeCompare(signature, expectedSignature)) {
      return null;
    }

    const parsed = JSON.parse(payloadStr);
    const validated = sessionPayloadSchema.parse(parsed);

    if (Date.now() > validated.expiresAt) {
      return null; // Token expired
    }

    return { username: validated.username };
  } catch {
    return null;
  }
}
