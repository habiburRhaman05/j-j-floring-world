import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, API_TIMEOUT_MS } from "./config";
import { ApiError, toApiError } from "./errors";

/* ==========================================================================
   client.ts  -  the single axios instance
   --------------------------------------------------------------------------
   One instance for the whole app, so timeouts, headers, the auth token and
   error normalisation are configured exactly once.

   The token is held in memory (the session lives in memory too, matching this
   frontend-first build). When the backend starts issuing httpOnly cookies
   instead, drop `withCredentials: true` in and the bearer header stops being
   needed — nothing at the call sites changes.
   ========================================================================== */

let authToken: string | null = null;

/** Called by the session provider on sign-in and sign-out. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * A 401 means the session is gone. The session provider registers here rather
 * than the client importing the provider, which would be a cycle.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL || undefined,
    timeout: API_TIMEOUT_MS,
    headers: { Accept: "application/json" },
    withCredentials: true,
  });

  instance.interceptors.request.use((config) => {
    if (authToken) {
      config.headers.set("Authorization", `Bearer ${authToken}`);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const apiError = toApiError(error);
      const config = (axios.isAxiosError(error) ? error.config : undefined) as
        | (InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean })
        | undefined;

      // An expired access cookie: trade the refresh cookie for a new pair and
      // replay the request once. Auth endpoints themselves are never retried.
      if (
        apiError.isUnauthorized &&
        config &&
        !config._retriedAfterRefresh &&
        !NO_REFRESH_PATHS.some((path) => config.url?.startsWith(path))
      ) {
        config._retriedAfterRefresh = true;
        if (await refreshSession()) return instance.request(config);
      }

      if (apiError.isUnauthorized) onUnauthorized?.();
      return Promise.reject(apiError);
    },
  );

  return instance;
}

/** Requests whose 401 means "wrong credentials" or "refresh failed", not "access expired". */
const NO_REFRESH_PATHS = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"];

let refreshing: Promise<boolean> | null = null;

/**
 * One refresh at a time: every request that 401s while a refresh is already in
 * flight waits on that same call, so parallel requests never present the same
 * refresh token twice.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= axios
    .post("/api/auth/refresh", undefined, {
      baseURL: API_BASE_URL || undefined,
      timeout: API_TIMEOUT_MS,
      withCredentials: true,
    })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** The shared instance. Import this rather than calling axios directly. */
export const api = createApiClient();

/* ------------------------------------------------------------ tiny helpers */
/* Call sites get the parsed body, not an AxiosResponse, and always get an
   ApiError on failure — never a raw axios error. */

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.get<T>(url, config);
  return data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.post<T>(url, body, config);
  return data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.patch<T>(url, body, config);
  return data;
}

export async function apiPut<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await api.put<T>(url, body, config);
  return data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await api.delete<T>(url, config);
  return data;
}

export { ApiError };
