/**
 * src/pages/Register.jsx
 *
 * Registration page — username, email, password + confirm password.
 * Client-side validation before hitting the API.
 * On success: calls auth.login(), navigates to "home".
 */

import { useState } from "react";
import { Languages, Eye, EyeOff, UserPlus, LogIn, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin } from '@react-oauth/google';

const API_BASE = "http://localhost:8000";

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 mt-1">{msg}</p>;
}

function StrengthBar({ password }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < score ? colors[score - 1] : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">{labels[score - 1] ?? "Too short"}</p>
    </div>
  );
}

export default function Register({ navigate }) {
  const { login } = useAuth();

  const [form, setForm] = useState({
    username: "",
    email: "", // Will be filled from Google token
    password: "",
    confirm: "",
  });
  const [googleToken, setGoogleToken] = useState(null);
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [apiError,    setApiError]    = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [field]: null }));
    setApiError(null);
  };

  const validate = () => {
    const errs = {};
    if (form.username.trim().length < 3)
      errs.username = "Username must be at least 3 characters.";
    if (!/^[a-zA-Z0-9_.-]+$/.test(form.username.trim()))
      errs.username = "Only letters, numbers, underscores, dots, hyphens allowed.";
    if (!googleToken)
      errs.email = "Please verify your email with Google first.";
    if (form.password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirm)
      errs.confirm = "Passwords do not match.";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/register/google`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          google_token: googleToken,
          username: form.username.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed.");

      login(data.access_token, data.user);
      navigate("home");
    } catch (err) {
      setApiError(err.message);
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
          <h1 className="font-serif font-bold text-3xl text-slate-900">Create account</h1>
          <p className="text-slate-500 text-sm mt-1">Start translating in seconds</p>
        </div>

        {/* ── Card ── */}
        <div className="card p-8 shadow-lg">

          {/* API error banner */}
          {apiError && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{apiError}</span>
            </div>
          )}

          {/* Step 1: Google Email Verification */}
          {!googleToken ? (
            <div className="flex flex-col items-center justify-center space-y-4 my-8">
              <p className="text-sm text-slate-600 font-medium text-center mb-2">
                Step 1: Verify your email to begin
              </p>
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  setGoogleToken(credentialResponse.credential);
                  try {
                    // Extract email for display purposes
                    const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
                    setForm(f => ({ ...f, email: payload.email }));
                  } catch(e) {}
                  setApiError(null);
                }}
                onError={() => {
                  setApiError("Google authentication failed. Please try again.");
                }}
                shape="rectangular"
                theme="outline"
                size="large"
                text="continue_with"
                width="300"
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <CheckCircle size={18} />
                <span className="text-sm font-medium">Email verified: {form.email}</span>
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reg-username" className="text-sm font-medium text-slate-700">
                  Choose Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={set("username")}
                  placeholder="john_doe"
                  className={`input ${fieldErrors.username ? "border-red-400 focus:ring-red-300" : ""}`}
                  required
                />
                <FieldError msg={fieldErrors.username} />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reg-password" className="text-sm font-medium text-slate-700">
                  Create Password
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min. 8 characters"
                    className={`input pr-11 ${fieldErrors.password ? "border-red-400 focus:ring-red-300" : ""}`}
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
                <StrengthBar password={form.password} />
                <FieldError msg={fieldErrors.password} />
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1">
                <label htmlFor="reg-confirm" className="text-sm font-medium text-slate-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.confirm}
                    onChange={set("confirm")}
                    placeholder="Re-enter your password"
                    className={`input pr-11 ${fieldErrors.confirm ? "border-red-400 focus:ring-red-300" : ""}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirm ? "Hide" : "Show"}
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <FieldError msg={fieldErrors.confirm} />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base mt-2"
                id="register-submit-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus size={17} /> Complete Registration
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">ALREADY HAVE AN ACCOUNT?</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Login link */}
          <button
            onClick={() => navigate("login")}
            className="btn-secondary w-full justify-center py-2.5"
            id="register-to-login-btn"
          >
            <LogIn size={15} /> Sign in instead
          </button>
        </div>
      </div>
    </div>
  );
}
