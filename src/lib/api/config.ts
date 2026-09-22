/* ==========================================================================
   config.ts  -  where the API lives
   --------------------------------------------------------------------------
   Frontend-first build: the app ships pointed at an in-memory repository so
   every screen works with no server running. Set NEXT_PUBLIC_API_BASE_URL (and
   NEXT_PUBLIC_USE_MOCK_API=false) to send every call to a real backend
   instead. Nothing else in the app changes.
   ========================================================================== */

function readFlag(value: string | undefined): boolean | null {
  if (value === undefined || value.trim() === "") return null;
  return value.trim().toLowerCase() !== "false";
}

/** e.g. https://api.jjflooringworld.com/v1. Empty means "same origin". */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

/** Request timeout in milliseconds. */
export const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 20000) || 20000;

/**
 * Which repository to build.
 *
 * Default: mock when no base URL is configured, HTTP once one is. The explicit
 * flag wins, so a real backend can be pointed at from a preview deploy before
 * its URL is set as the default.
 */
export const USE_MOCK_API: boolean =
  readFlag(process.env.NEXT_PUBLIC_USE_MOCK_API) ?? API_BASE_URL === "";

/** True when the running build talks to a real server. */
export const IS_LIVE_API = !USE_MOCK_API;
