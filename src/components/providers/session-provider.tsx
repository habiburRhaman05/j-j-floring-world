"use client";

/* ==========================================================================
   session-provider.tsx  -  who is signed in
   --------------------------------------------------------------------------
   Backed by a real httpOnly session cookie now (src/lib/auth/session.server.ts
   on the server). On mount, hydrate whatever cookie the browser already
   holds by asking the server who it belongs to - this is what lets a reload
   keep you signed in, and it is also literally "show session data that
   currently exists" from the header outward.
   ========================================================================== */

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchCurrentSession,
  signIn as signInRequest,
  signOutRequest,
  ROLE_HOME,
  type SessionUser,
} from "@/lib/auth/auth-service";
import type { Role } from "@/lib/types";

interface SessionApi {
  session: SessionUser | null;
  role: Role | null;
  /** True until the initial GET /auth/session hydration finishes. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await fetchCurrentSession());
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    // One-time hydration of whatever session cookie the browser already
    // holds; the loading flag it clears exists so RoleGuard can wait for it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await signInRequest(email, password);
    setSession(user);
    return user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutRequest();
    } finally {
      setSession(null);
    }
  }, []);

  const api = useMemo<SessionApi>(
    () => ({ session, role: session?.role ?? null, loading, signIn, signOut, refresh }),
    [session, loading, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** The signed-in user. Sourced from the real session, not the mock dataset. */
export function useCurrentUser(): SessionUser | null {
  return useSession().session;
}

/**
 * Page guard.
 *
 * This is a courtesy for a smooth client-side experience (no flash of the
 * wrong workspace); it is not the security boundary. The authoritative check
 * is server-side `requireUser()` in each role's layout.tsx, which runs before
 * this component's effect ever gets a chance to.
 */
export function RoleGuard({ role, children }: { role: Role; children: ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  const signedIn = Boolean(session);
  const allowed = session?.role === role;

  useEffect(() => {
    if (loading) return;
    if (!signedIn) {
      router.replace("/login");
      return;
    }
    if (!allowed && session) {
      router.replace(ROLE_HOME[session.role] ?? "/login");
    }
  }, [loading, signedIn, allowed, session, router]);

  if (loading || !allowed) return null;
  return <>{children}</>;
}
