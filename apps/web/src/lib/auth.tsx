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
    async (input: RegisterInput) =>
      accept(await api<AuthResponse>("/auth/register", { method: "POST", json: input })),
    [accept],
  );

  const logout = useCallback(async () => {
    await api<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({ status, user, login, register, logout }), [status, user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
