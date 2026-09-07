/** Role helpers for THE CLOVER storefront / dashboards. */

export type AppRole = "customer" | "admin" | "reception";

export function isAdmin(role?: string | null) {
  return role === "admin";
}

/** Floor workers (reception) or owners. */
export function isStoreStaff(role?: string | null) {
  return role === "admin" || role === "reception";
}

export function isReception(role?: string | null) {
  return role === "reception";
}

export function isCustomer(role?: string | null) {
  return role === "customer";
}

/** Where to send the user after login. */
export function homePathForRole(role?: string | null) {
  if (role === "admin") return "/admin";
  if (role === "reception") return "/reception";
  return "/account";
}

export function customerLoginPath() {
  return "/login";
}

export function adminLoginPath() {
  return "/admin/login";
}

export function receptionLoginPath() {
  return "/reception/login";
}

/** Owner console paths (including dedicated login). */
export function isAdminAppPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminLoginPath(pathname: string) {
  return pathname === "/admin/login";
}

/** Floor portal paths. */
export function isReceptionAppPath(pathname: string) {
  return pathname === "/reception" || pathname.startsWith("/reception/");
}

export function isReceptionLoginPath(pathname: string) {
  return pathname === "/reception/login";
}
