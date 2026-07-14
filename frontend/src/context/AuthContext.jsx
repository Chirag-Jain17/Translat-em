/**
 * src/context/AuthContext.jsx
 *
 * Provides authentication state (user, token) throughout the app.
 *
 * On mount: reads JWT from localStorage and calls /api/auth/me to
 * re-hydrate the user object (handles page refresh while logged in).
 *
 * Exports:
 *   useAuth()  — hook to read { user, token, isLoading, login, logout }
 *   AuthProvider — wrap your app with this
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "ai_translator_token";
const API_BASE  = "http://localhost:8000";

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [token,     setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);  // true until we've verified the token

  // ── Re-hydrate user from stored token on app load ─────────────────────────
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Token invalid");
        return res.json();
      })
      .then((u) => setUser(u))
      .catch(() => {
        // Token is expired or invalid — clear it
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  // ── Called after successful register / login ──────────────────────────────
  const login = useCallback((newToken, newUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  // ── Called when user clicks "Logout" ─────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook — use inside any component wrapped by AuthProvider. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
