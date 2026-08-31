/**
 * Auth cookies
 * ------------
 * One job: put JWT cookies on the response, or clear them.
 * Cookie flags must match on set and clear or browsers keep stale tokens.
 */

const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** Shared cookie flags for access + refresh tokens. */
function cookieFlags() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  };
}

/** Attach access + refresh JWT cookies to the HTTP response. */
export function setAuthCookies(res, accessToken, refreshToken) {
  const flags = cookieFlags();
  res.cookie("accessToken", accessToken, { ...flags, maxAge: ACCESS_MS });
  res.cookie("refreshToken", refreshToken, { ...flags, maxAge: REFRESH_MS });
}

/** Remove auth cookies (must use the same flags used when setting them). */
export function clearAuthCookies(res) {
  const flags = cookieFlags();
  res.clearCookie("accessToken", flags);
  res.clearCookie("refreshToken", flags);
}

/** Read refresh token from JSON body or cookie. */
export function readRefreshToken(req) {
  return req.body?.refreshToken || req.cookies?.refreshToken || null;
}
