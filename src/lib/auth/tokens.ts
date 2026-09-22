import "server-only";
import { randomBytes, createHash } from "crypto";

/* ==========================================================================
   tokens.ts  -  opaque bearer tokens for cookies, invites and resets
   --------------------------------------------------------------------------
   The raw token goes in the cookie or the emailed link. Only its SHA-256
   hash is ever written to the database, so a leaked backup or a read-only
   DB compromise never yields a usable token.
   ========================================================================== */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
