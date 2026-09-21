import "server-only";

/**
 * Server components run inside the web container, where the API is reachable
 * at http://api:3001, not at the browser-facing localhost URL.
 */
const SERVER_API_URL = process.env.API_URL_INTERNAL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Unauthenticated server-side fetch. Returns null on 404 so pages can notFound(). */
export async function serverApi<T>(path: string): Promise<T | null> {
  const res = await fetch(`${SERVER_API_URL}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return (await res.json()) as T;
}
