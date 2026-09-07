"use client";

/**
 * Auth React context
 * ------------------
 * One job: hold the logged-in user in client state and expose login/logout.
 * Network calls are delegated to auth-api.ts.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { User } from "./api";
import {
  loadSessionUser,
  loginRequest,
  logoutRequest,
  refreshSession,
  registerRequest,
  type AuthPortal,
} from "./auth-api";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, portal?: AuthPortal) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

/** How often we re-check / refresh the session in the background (ms). */
const SESSION_POLL_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Share one in-flight refresh so parallel 401s do not spam /refresh.
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const runRefreshOnce = useCallback(() => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshSession().finally(() => {
        refreshInFlight.current = null;
      });
    }
    return refreshInFlight.current;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await loadSessionUser(runRefreshOnce);
      setUser(next);
    } finally {
      setLoading(false);
    }
  }, [runRefreshOnce]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, SESSION_POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const login = async (email: string, password: string, portal: AuthPortal = "customer") => {
    const next = await loginRequest(email, password, portal);
    setUser(next);
    return next;
  };

  const register = async (email: string, password: string, fullName: string) => {
    const next = await registerRequest(email, password, fullName);
    setUser(next);
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
