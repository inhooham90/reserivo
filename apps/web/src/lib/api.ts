import type { AuthResponse } from "@reserivo/shared";

/** Browser-side base URL. Server components use ./api-server.ts instead. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// The access token lives only in memory. The refresh token is an httpOnly
// cookie the browser sends to /auth/* on its own, so a reload recovers the
// session via refresh() without ever exposing a credential to JS.
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues: ApiIssue[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiInit extends Omit<RequestInit, "body"> {
  json?: unknown;
  /** Internal: set when this call is the retry after a refresh. */
  _retried?: boolean;
}

/**
 * fetch() against the API with auth handling:
 *  - attaches the bearer token when present
 *  - on 401 (outside /auth/*), refreshes once and retries
 *  - throws ApiError with the server's message and zod issues
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, _retried, headers: extraHeaders, ...rest } = init;
  const headers = new Headers(extraHeaders);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers,
    credentials: "include",
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (res.status === 401 && !_retried && !path.startsWith("/auth/")) {
    const refreshed = await refresh();
    if (refreshed) return api<T>(path, { ...init, _retried: true });
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[]; issues?: ApiIssue[] };
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message ?? res.statusText;
    throw new ApiError(res.status, message, body.issues ?? []);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Exchanges the refresh cookie for a new access token. Null when the session is gone. */
export async function refresh(): Promise<AuthResponse | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }
    const data = (await res.json()) as AuthResponse;
    setAccessToken(data.accessToken);
    return data;
  } catch {
    setAccessToken(null);
    return null;
  }
}
