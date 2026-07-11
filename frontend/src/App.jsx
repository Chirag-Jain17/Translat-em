/**
 * src/App.jsx
 *
 * Root application component.
 * Implements pure-state routing using a `currentPage` string.
 * No react-router-dom required.
 *
 * Auth-gated pages: 'home', 'profile'  — redirect to 'login' if not signed in.
 * Public pages:     'explore', 'login', 'register'
 */

import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar   from "./components/Navbar.jsx";
import Home     from "./pages/Home.jsx";
import Explore  from "./pages/Explore.jsx";
import Profile  from "./pages/Profile.jsx";
import Login    from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// ── Global constant used by all fetch calls ───────────────────────────────────
export const API_BASE_URL = "http://localhost:8000";

// ── Pages that require authentication ────────────────────────────────────────
const PROTECTED_PAGES = new Set(["home", "profile"]);

// ── Inner app — has access to AuthContext ─────────────────────────────────────
function AppInner() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState("home");

  const navigate = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Redirect unauthenticated users away from protected pages
  useEffect(() => {
    if (!isLoading && !user && PROTECTED_PAGES.has(currentPage)) {
      setCurrentPage("login");
    }
  }, [user, isLoading, currentPage]);

  // Redirect already-logged-in users away from auth pages
  useEffect(() => {
    if (!isLoading && user && (currentPage === "login" || currentPage === "register")) {
      setCurrentPage("home");
    }
  }, [user, isLoading, currentPage]);

  // While re-hydrating from localStorage, show nothing (prevents flash)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                 fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
              <path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
            </svg>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  const showNavbar = !["login", "register"].includes(currentPage);

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      {showNavbar && <Navbar currentPage={currentPage} navigate={navigate} />}

      <main className="flex-1 animate-fade-in">
        {currentPage === "login"    && <Login    navigate={navigate} />}
        {currentPage === "register" && <Register navigate={navigate} />}
        {currentPage === "home"     && <Home     navigate={navigate} />}
        {currentPage === "explore"  && <Explore  navigate={navigate} />}
        {currentPage === "profile"  && <Profile  navigate={navigate} />}
      </main>

      {/* ── Footer (hidden on auth pages) ── */}
      {showNavbar && (
        <footer className="border-t border-slate-100 bg-white mt-16">
          <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
                <span className="text-white font-serif font-bold text-xs">T</span>
              </div>
              <span className="text-sm font-semibold text-slate-700">AI Translator</span>
            </div>
            <p className="text-xs text-slate-400">
              Built with FastAPI + React · AI-powered translation engine
            </p>
            <div className="flex gap-4 text-xs text-slate-400">
              <button onClick={() => navigate("home")}    className="hover:text-indigo-600 transition-colors">Studio</button>
              <button onClick={() => navigate("explore")} className="hover:text-indigo-600 transition-colors">Explore</button>
              <button onClick={() => navigate("profile")} className="hover:text-indigo-600 transition-colors">Profile</button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

// ── Root export — wraps everything in AuthProvider ────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
