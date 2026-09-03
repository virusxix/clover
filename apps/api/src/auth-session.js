/**
 * Auth session
 * ------------
 * One job: create / rotate login sessions (tokens + cookies + DB row).
 * Route handlers call these; they do not talk to Express cookies directly.
 */

import {
  signAccessToken,
  signRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  isRefreshValid,
  verifyToken,
} from "./utils/jwt.js";
import { getUserById, toUserResponse, checkDb } from "./auth-data.js";
import { setAuthCookies } from "./auth-cookies.js";

/**
 * Start a new session for a logged-in user.
 * Signs tokens, stores refresh hash in DB (when available), sets cookies.
 */
export async function createSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await saveRefreshOrFailInProd(user.id, refreshToken);
  setAuthCookies(res, accessToken, refreshToken);

  // Tokens included so the Vercel proxy can set cookies if Set-Cookie is stripped.
  // Browser-facing proxy responses should omit these fields.
  return { user: toUserResponse(user), accessToken, refreshToken };
}

/**
 * Rotate refresh token: revoke old, issue new pair, update cookies.
 * Returns false-y errors via thrown Error for the route to map to 401.
 */
export async function rotateSession(res, refreshToken) {
  const payload = verifyToken(refreshToken);

  if (payload.type !== "refresh") {
    throw new Error("INVALID_REFRESH");
  }

  const stillValid = await isRefreshValid(refreshToken);
  if (!stillValid) {
    throw new Error("INVALID_REFRESH");
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw new Error("INVALID_REFRESH");
  }

  await revokeRefreshToken(refreshToken);

  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  await storeRefreshToken(user.id, newRefresh);
  setAuthCookies(res, accessToken, newRefresh);

  return { accessToken, refreshToken: newRefresh };
}

/**
 * In production (or when DB is up), refresh storage must succeed.
 * In local dev without DB, we still allow cookie-only sessions.
 */
async function saveRefreshOrFailInProd(userId, refreshToken) {
  try {
    await storeRefreshToken(userId, refreshToken);
  } catch (err) {
    const dbUp = await checkDb();
    const isProd = process.env.NODE_ENV === "production";
    if (isProd || dbUp) throw err;
  }
}
