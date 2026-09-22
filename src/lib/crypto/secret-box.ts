import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/* ==========================================================================
   secret-box.ts  -  AES-256-GCM for secrets we must store, not just hash
   --------------------------------------------------------------------------
   Passwords and tokens are hashed (one-way, see auth/password.ts and
   auth/tokens.ts). The GHL private integration token is different: we need
   the plaintext back to call the GHL API with it, so it is encrypted instead,
   with a key that lives outside the database (NFR-SEC-03).
   ========================================================================== */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).");
  }
  return key;
}

/** Returns a single base64 string: iv + authTag + ciphertext, packed together. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(packed: string): string {
  const key = getKey();
  const buffer = Buffer.from(packed, "base64");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Shows enough of a secret to recognise it, never enough to reuse it. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return "••••••••";
  return `${plaintext.slice(0, 4)}${"•".repeat(8)}${plaintext.slice(-4)}`;
}
