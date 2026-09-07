/**
 * Auth API helpers
 * ----------------
 * One job: talk to /api/auth/* endpoints.
 * React state lives in auth-context.tsx — this file only does network I/O.
 */

import { api, ApiError, User } from "./api";

/** Current user from access-token cookie. */
export function fetchCurrentUser() {
  return api<User>("/api/auth/me");
}

/** Rotate refresh cookie → new access cookie. Returns false if refresh fails. */
export async function refreshSession(): Promise<boolean> {
  try {
    await api("/api/auth/refresh", { method: "POST", skipAuthRefresh: true });
    return true;
  } catch {
    return false;
  }
}

export type AuthPortal = "customer" | "admin" | "reception";

/** Email + password login. Sets cookies server-side; returns the user. */
export async function loginRequest(
  email: string,
  password: string,
  portal: AuthPortal = "customer"
) {
  const res = await api<{ user: User }>("/api/auth/login", {
    method: "POST",
    json: { email, password, portal },
    retries: 3,
    skipAuthRefresh: true,
  });
  return res.user;
}

/** Register a new customer account. */
export async function registerRequest(
  email: string,
  password: string,
  fullName: string
) {
  const res = await api<{ user: User }>("/api/auth/register", {
    method: "POST",
    json: { email, password, fullName },
    retries: 3,
    skipAuthRefresh: true,
  });
  return res.user;
}

/** Clear server cookies (best effort). */
export async function logoutRequest() {
  await api("/api/auth/logout", { method: "POST" });
}

/**
 * Load the current user; on 401 try one refresh, then /me again.
 * Returns null when the visitor is logged out.
 */
export async function loadSessionUser(
  refreshOnce: () => Promise<boolean>
): Promise<User | null> {
  try {
    return await fetchCurrentUser();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status !== 401) return null;

    const refreshed = await refreshOnce();
    if (!refreshed) return null;

    try {
      return await fetchCurrentUser();
    } catch {
      return null;
    }
  }
}
