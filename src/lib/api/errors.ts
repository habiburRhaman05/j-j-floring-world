import axios from "axios";

/* ==========================================================================
   errors.ts  -  one error shape for the whole app
   --------------------------------------------------------------------------
   Components should never have to care whether a failure came from axios, from
   a validation rule on the server, or from the browser being offline. Every
   failure is normalised into ApiError before it reaches a call site.
   ========================================================================== */

export interface ApiFieldError {
  field: string;
  message: string;
}

/** The body the backend is expected to return on a failed request. */
interface ApiErrorBody {
  message?: string;
  code?: string;
  /** Field-level messages. Either name is accepted from the server. */
  fields?: ApiFieldError[];
  errors?: ApiFieldError[];
  fieldErrors?: ApiFieldError[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ApiFieldError[];
  /** No response at all: offline, DNS failure, CORS, timeout. */
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      fields?: ApiFieldError[];
      isNetworkError?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? (options.isNetworkError ? "network_error" : "request_failed");
    this.fields = options.fields ?? [];
    this.isNetworkError = options.isNetworkError ?? false;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isValidationError(): boolean {
    return this.status === 422 || this.status === 400;
  }

  /** The message to put in front of a person. */
  get displayMessage(): string {
    if (this.isNetworkError) {
      return "Cannot reach the server. Check your connection and try again.";
    }
    return this.message || "Something went wrong. Please try again.";
  }
}

/** Type guard for UI code that catches a thrown value. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

const STATUS_FALLBACK: Record<number, string> = {
  400: "That request was not valid.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to do that.",
  404: "That record no longer exists.",
  409: "That conflicts with an existing record.",
  422: "Please correct the highlighted fields.",
  429: "Too many requests. Try again in a moment.",
  500: "The server ran into a problem.",
  503: "The service is temporarily unavailable.",
};

/** Normalise anything thrown by axios (or by our own code) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const response = error.response;
    const body = (response?.data ?? {}) as ApiErrorBody;

    if (!response) {
      return new ApiError(error.message || "Network request failed", {
        code: error.code ?? "network_error",
        isNetworkError: true,
        cause: error,
      });
    }

    const status = response.status;
    return new ApiError(body.message || STATUS_FALLBACK[status] || "Request failed", {
      status,
      code: body.code ?? `http_${status}`,
      fields: body.fields ?? body.fieldErrors ?? [],
      cause: error,
    });
  }

  if (error instanceof Error) return new ApiError(error.message, { cause: error });

  return new ApiError("Unexpected error", { code: "unknown" });
}
