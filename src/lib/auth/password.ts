import "server-only";
import * as argon2 from "argon2";

/* ==========================================================================
   password.ts  -  Argon2id hashing, per doc 04 ("Sessions and login")
   --------------------------------------------------------------------------
   memoryCost is in KiB: 65536 KiB = 64 MB. These parameters are a documented
   product decision, not a default to casually tune.
   ========================================================================== */

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

export function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext).catch(() => false);
}
