/**
 * src/pages/Login.jsx
 *
 * Login page — accepts username OR email + password.
 * On success: calls auth.login(), navigates to "home".
 */

import { useState } from "react";
import { Languages, Eye, EyeOff, LogIn, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin } from '@react-oauth/google';

const API_BASE = "http://localhost:8000";

export default function Login({ navigate }) {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed.");

      login(data.access_token, data.user);
      navigate("home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* ── Logo ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Languages size={28} className="text-white" />
          </div>
          <h1 className="font-serif font-bold text-3xl text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue translating</p>
        </div>

        {/* ── Card ── */}
        <div className="card p-8 shadow-lg">

          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Google Login */}
          <div className="flex flex-col items-center mb-6">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                setLoading(true);
                setError(null);
                try {
                  const res = await fetch(`${API_BASE}/api/auth/login/google`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ google_token: credentialResponse.credential }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.detail || "Google Login failed.");

                  login(data.access_token, data.user);
                  navigate("home");
                } catch (err) {
                  setError(err.message);
                } finally {
                  setLoading(false);
                }
              }}
              onError={() => {
                setError("Google authentication failed. Please try again.");
              }}
              shape="rectangular"
              theme="outline"
              size="large"
              text="signin_with"
              width="330"
            />
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">OR EMAIL</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Identifier */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-identifier" className="text-sm font-medium text-slate-700">
                Username or Email
              </label>
              <input
                id="login-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="john_doe or john@example.com"
                className="input"
                required
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
              id="login-submit-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={17} /> Sign In
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">NEW HERE?</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Register link */}
          <button
            onClick={() => navigate("register")}
            className="btn-secondary w-full justify-center py-2.5"
            id="login-to-register-btn"
          >
            <Sparkles size={15} /> Create a free account
          </button>
        </div>
      </div>
    </div>
  );
}
