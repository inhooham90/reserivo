"use client";

import type { AuthResponse, CurrentUser, LoginInput, RegisterInput } from "@reserivo/shared";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, refresh, setAccessToken } from "./api";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: CurrentUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Adopts a session minted somewhere other than the login form — confirming
   * an email, or completing a password reset. Without this the token would be
   * set but the provider would still think nobody is signed in.
   */
  acceptSession: (result: AuthResponse) => void;
  /** Site admins only. Swaps the in-memory token for one that acts as another user. */
  impersonate: (userId: string) => Promise<void>;
  /** Drops back to the admin's own identity by refreshing their untouched session. */
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const queryClient = useQueryClient();

  // On first load, try to recover the session from the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    void refresh().then((result) => {
      if (cancelled) return;
      setUser(result?.user ?? null);
      setStatus(result ? "authenticated" : "anonymous");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback((result: AuthResponse) => {
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (input: LoginInput) => accept(await api<AuthResponse>("/auth/login", { method: "POST", json: input })),
    [accept],
  );

  const register = useCallback(
    async (input: RegisterInput) => accept(await api<AuthResponse>("/auth/register", { method: "POST", json: input })),
    [accept],
  );

  const logout = useCallback(async () => {
    await api<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  const acceptSession = useCallback(
    (result: AuthResponse) => {
      queryClient.clear();
      accept(result);
    },
    [accept, queryClient],
  );

  const impersonate = useCallback(
    async (userId: string) => {
      const result = await api<AuthResponse>(`/admin/impersonate/${userId}`, { method: "POST" });
      // Cached data belongs to the previous identity — none of it is theirs.
      queryClient.clear();
      accept(result);
    },
    [accept, queryClient],
  );

  const stopImpersonating = useCallback(async () => {
    // The admin's refresh cookie was never replaced, so this returns them to themselves.
    const result = await refresh();
    queryClient.clear();
    setUser(result?.user ?? null);
    setStatus(result ? "authenticated" : "anonymous");
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, login, register, logout, acceptSession, impersonate, stopImpersonating }),
    [status, user, login, register, logout, acceptSession, impersonate, stopImpersonating],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
