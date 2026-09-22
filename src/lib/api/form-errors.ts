import type { ApiError } from "./errors";

/* ==========================================================================
   form-errors.ts  -  one way to read a caught ApiError into a form
   --------------------------------------------------------------------------
   The server attaches field-level messages when it can (see server-response
   .ts's zodErrorResponse and each route's own validation failures). Forms
   that only render `error.displayMessage` throw that detail away, which is
   what "not a meaningful error message" usually turns out to mean in
   practice - the field IS named, the UI just was not showing it.
   ========================================================================== */

export function formErrors(error: ApiError | null) {
  const fieldError = (field: string): string | null =>
    error?.fields.find((f) => f.field === field)?.message ?? null;
  /** Shown as a banner only when there is no more specific field to attach it to. */
  const generalError = error && error.fields.length === 0 ? error.displayMessage : null;
  return { fieldError, generalError };
}
